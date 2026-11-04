# Verification in this environment

How to drive the app and check a change here without wasting turns on process launches. Read before starting a browser or dev-server check.

## The shell is Windows PowerShell 5.1

The tool is named `pwsh`, but what runs is **Windows PowerShell 5.1 (Desktop)**. PowerShell 7 idioms are missing, and each one fails as an ordinary parameter error that reads like a typo rather than a version gap:

| Missing in 5.1 | Use instead |
|---|---|
| `-SkipHttpErrorCheck` on `Invoke-RestMethod` / `Invoke-WebRequest` | `curl.exe -s -o body.json -w "%{http_code}" <url>` — the body of a 4xx is otherwise swallowed |
| `-Form` (multipart) | `curl.exe -s -F "file=@path" <url>` |
| `Join-String` | `[string]::Join(", ", $items)` or `-join` |
| `Get-ChildItem -File`/`-Directory` by default | available here, but `-Include` needs a trailing `\*` or a `-Recurse` |

Three more that cost real debugging time:

- **`$pid` is a reserved automatic variable.** A probe that assigns to it silently reads the process ID instead, and the mistake surfaces as nonsense output, not an error. Use `$productId`.
- **Bracket paths need `-LiteralPath`.** `src/app/(storefront)/products/[slug]/…` and any `[` in a path are treated as wildcards by `-Path`, which then matches nothing and looks like a missing file.
- **`> file` writes UTF-16**, and the read tool reports that file as binary. Use `Out-File -Encoding utf8` (or `-Encoding utf8` on `Set-Content`) every time.

And the one that corrupts source: **never rewrite a source file with `Get-Content -Raw | Set-Content`.** On a non-UTF-8 console that reads UTF-8 as Windows-1252 and writes it back double-encoded. Use the edit and write tools; `npm run check:encoding` exists because both round trips that happened here passed the whole gate.

## Check the policy first

The runtime context states the file policy for the session: `danger-full-access` runs everything, `workspace-write` (the default) blocks four things entirely:

| Blocked under `workspace-write` | Symptom |
|---|---|
| Launching a browser | Playwright CLI `EPERM` on launch |
| `next dev` / `next build`/ `npm run dev` | child process fork with piped stdio → `spawn EPERM` |
| Writing `.git` | `git commit`, `git add` fail on `.git/index.lock` |
| Writing outside the workspace | any write to `$env:TEMP` |

Without an escalation those operations fail closed. Escalation is per call, not per session, so the cost of a check is the number of processes it starts — which is the whole point of the rules below.

## One process per flow

Each `playwright-cli` invocation is a separate escalated process, and a sandboxed session pays an approval for every one. A flow written as individual `goto`/`fill`/`click`/`snapshot` calls costs 15–40 approvals for one check.

Write the flow as a single script and run it with one call:

```powershell
playwright-cli run-code --filename=$env:TEMP\check-login.js
```

```js
// check-login.js — one process, every case
async (page) => {
  const results = [];
  await page.goto("http://localhost:3000/admin/login", { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Sign in" }).click();
  results.push(["empty submit", await page.getByText("required").count() > 0]);

  await page.getByLabel("Email address").fill("swagger.customer@example.com");
  await page.getByLabel("Password").fill("Swagger123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByText("company accounts only").waitFor();
  results.push(["customer rejected", new URL(page.url()).pathname === "/admin/login"]);

  return JSON.stringify(results);
}
```

`@playwright/test` (already installed) is the same trade: one `npx playwright test` process runs every spec. Prefer it when a check will be re-run.

Use single-shot `playwright-cli` subcommands only for interactive exploration where each step depends on seeing the last result. When a flow stabilises, fold it into a script.

**Dev servers:** start one with a background job and keep it running (`npm run dev` in `run_in_background`), then point every check at it. Starting a server per check multiplies the approval cost.

Two things that wedge a `run-code` session, both hit twice in the admin-products work:

- **A file chooser or `beforeunload` dialog.** Once either is open every subsequent tool call fails with `does not handle the modal state`, and no `upload`/`press`/`eval` gets through. Recover with `close` then `open` — that is the only way out, and it costs a re-login. So never register `page.on("dialog")`, and drive an antd `Upload` by calling `setFiles` on its hidden `input[type=file]` rather than clicking the control.
- **Positional element refs** (`e15`) go stale after navigation and turn into `f1e19`. Use role and label locators, and expect strict-mode violations when a label matches twice — scope with `.filter()` or `.nth()`.

## Logging in once, and staying logged in

The API throttles login **10 per minute per IP** and **10 per 15 minutes per account** (see `docs/api-contract.md`). A loop that re-authenticates per check exhausts the account window within a few minutes, and the resulting `429` looks like a broken endpoint. Recovering needs a ~15-minute wait, not a retry.

So: authenticate once, keep the token, and reuse the browser context.

```powershell
$body = @{ email = 'swagger.admin@example.com'; password = 'Swagger123!' } | ConvertTo-Json
$r = Invoke-RestMethod -Uri 'http://localhost:8080/api/v1/auth/login' -Method Post -ContentType 'application/json' -Body $body
$r.data.accessToken | Out-File -Encoding utf8 "$env:TEMP\dsh-admin-token.txt"
```

Then read that file in each later call instead of logging in again. If a call returns `401`, the token expired — re-login **once**, and check the response actually carried a token rather than a `429` body, because a `429` envelope deserialised as a login looks like an empty token and sends you hunting in the wrong place.

## Throwaway scripts live in the temp directory

Scripts written to inspect the app — capture harnesses, screenshot diffing, snapshot probes — go to `$env:TEMP`, never the repo. They are disposable by definition, and keeping them out of the tree means no cleanup step, no lint noise, and no risk of committing them.

```powershell
Set-Content "$env:TEMP\probe.js" -Value $code
node "$env:TEMP\probe.js"
```

If a script genuinely must sit in the repo, put it in `.scratch/` (git- and lint-ignored) and delete it in the same turn. `npm run check` is the gate; a probe that makes it fail is a probe in the wrong place.

## Screenshots as evidence

A screenshot is proof only if someone can see it. When the active model declares no image input, `read_image` fails with `model … does not declare image input`, and a pixel comparison has to be scripted — which is expensive and only as good as the tolerance it prints.

Check which you are before promising a visual match:

- **Image input available:** capture, read the image, compare against the reference by eye, cite the visible difference.
- **No image input:** verify against the measured values in `docs/design.md` § Measured surfaces (widths, heights, radii, colours, type) rather than pixels. State the numbers that were checked, and say the visual match was not eyeballed.

Never write "visually matches" on the strength of a scripted pixel diff alone; write what was actually compared.

## Committing

Pass the message as a file, never inline. Multi-paragraph messages with quotes and backticks break PowerShell argument parsing:

```powershell
git commit -F .git/COMMIT_MSG.txt
```

Keep the message file inside the repo (`.git/COMMIT_MSG.txt`): a write to `$env:TEMP` is refused under `workspace-write`, so the commit fails for a reason that looks nothing like the real one.

Verify the result with `git log --oneline -1` and `git status --porcelain` before reporting success.

## Reporting a check

A script that prints `ok= | |` has not checked anything — the Playwright `run-code` result is a JSON *string*, so `ConvertFrom-Json` on it yields one string and a `$r.ok` read comes back empty. Either return a compact summary from the script itself:

```js
return JSON.stringify(results.map(([name, ok]) => `${ok ? "PASS" : "FAIL"} ${name}`));
```

or write the JSON to a file and parse it there. Then quote the counts (`16/16 passed`) and the exit code in the report, not the word "passed".

