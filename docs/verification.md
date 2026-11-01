# Verification in this environment

How to drive the app and check a change here without wasting turns on process launches. Read before starting a browser or dev-server check.

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
git commit -F "$env:TEMP\commit-msg.txt"
```

Verify the result with `git log --oneline -1` and `git status --porcelain` before reporting success.
