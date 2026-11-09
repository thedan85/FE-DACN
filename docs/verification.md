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

## The database and Redis are hosted, not local

`localhost:8080` is the backend process only. Both stores behind it are **remote and shared with the whole team**:

| Service | What it actually is |
|---|---|
| PostgreSQL | Supabase pooler in **ap-southeast-2 (Sydney)** — a cross-region hop, not a loopback |
| Redis | A hosted instance (rate limiter and catalog cache), also remote |

The backend's tracked config defaults to `localhost:5432`, which does not exist on a dev machine; the real URL is in the backend's untracked `.env`. So nothing about this stack is local, and two consequences follow.

**Every request pays a cross-region round trip.** Measured here: TCP connect to the Supabase pooler 320–475 ms, a cold `GET /products?size=20` **5.5 s**, the same call warm ~830 ms, against ~0 ms for loopback. Budget a browser check accordingly — a ten-page flow is 10–50 s of pure waiting, and it is the dominant cost, not process launch. Prefer a unit test over a page load whenever the question can be answered without a browser.

**Writes are permanent and shared.** The database is shared demo data, and `DELETE` on a product is archival (`status = DELETED`; the row survives and its slug stays reserved forever).

**Creating throwaway products is allowed for an agent session, and only for an agent session.** The coursework database is re-seeded from scratch before submission, so probing CRUD manually — creating a product, editing it, deleting it, checking the result — is expected and carries no cleanup obligation. That permission is scoped to a live, human-supervised session against the dev backend. It does **not** extend to CI/CD: an automated job must never write to this database, which is the first reason live E2E stays out of the pipeline (below). A probe row outlives the session that made it; an automated one would outlive the branch that made it.

**Flyway runs against the hosted database in the `dev` profile.** `application-dev.yml` sets `flyway.enabled: true` with `classpath:db/dev`, so starting the backend applies migrations plus a demo seed to the shared instance. Restarting the backend is a schema-mutating action here, not a read.

## Logging in once, and staying logged in

The API throttles login **10 per minute per IP** and **10 per 15 minutes per account** (see `docs/api-contract.md`). The limiter lives in the **shared hosted Redis**, so that window is global: it is exhausted by the team's combined sessions, not just yours, and your retries spend a budget everyone else needs.

An exhausted window returns `429`, which looks like a broken endpoint. **Treat a `429` as a stop sign: wait the window out. Do not retry in a loop and do not look for a way around it** — the limiter is there to protect a shared account, and working around it takes the whole team offline.

So: authenticate once, keep the token, and reuse it and the browser context.

```powershell
$body = @{ email = 'swagger.admin@example.com'; password = 'Swagger123!' } | ConvertTo-Json
$r = Invoke-RestMethod -Uri 'http://localhost:8080/api/v1/auth/login' -Method Post -ContentType 'application/json' -Body $body
$r.data.accessToken | Out-File -Encoding utf8 "$env:TEMP\dsh-admin-token.txt"
```

Then read that file in each later call instead of logging in again. If a call returns `401`, the token expired — re-login **once**, and check the response actually carried a token rather than a `429` body, because a `429` envelope deserialised as a login looks like an empty token and sends you hunting in the wrong place.

## Never put live end-to-end tests in CI

**Live E2E tests must not be added to the GitHub Actions pipeline.** This is a hard rule, not a preference, for four compounding reasons:

1. **The rate limit is shared and global.** Every CI run authenticates against the same account, and the 10-per-15-minutes window is spent by concurrent jobs as well as by developers. Two parallel runners starve each other and every human on the team.
2. **The database is shared and remote.** Creating throwaway products is an *agent-session* permission, not a general one (see above). A CI job would write rows to the same hosted Supabase instance on every push and PR, unattended, and `DELETE` only marks rows.
3. **Latency makes the suite slow and flaky.** A cross-region hop with a 5 s cold read turns a small browser suite into minutes, and hosts are not guaranteed reachable from a runner at all.
4. **It would need production-adjacent secrets in CI** — database URL, Redis credentials, seeded account passwords — for tests that verify nothing about the code under test that a unit test cannot.

What CI runs instead: **`npm run check`** — lint, `antd lint`, typecheck, the CSS-module check, the encoding check, and the vitest suite. All of it is hermetic: the API tests stub `fetch` and assert on URLs, so no socket is opened and no credential is needed. Keep it that way; a test that reaches the network belongs in a manual verification pass, not the pipeline.

The asymmetry, stated once: **a human-supervised agent session may CRUD against the dev backend; an automated pipeline may do neither.** Live browser and API verification stays a deliberate, manual, local action, following the rules above.

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

