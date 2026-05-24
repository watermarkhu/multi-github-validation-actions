# multi-github-validation-workflows

Reusable workflow + actions for cross-validating CI across multiple GitHub
instances. The same change opened on an "upstream" GitHub is mirrored to a
"target" GitHub + repo, where the same CI runs and reports its progress back
to the upstream PR as a single, consolidated check.

## Pieces

- **`.github/workflows/push.yaml`** — reusable workflow (`workflow_call`).
  Pushes a single ref to a single target. Callers fan out to multiple
  targets via their own matrix.
- **`./` (root) — `report` action.** TypeScript JS action. Called from
  target CI. Reads the marker, mints an installation token for the
  upstream GitHub App, and updates the upstream check run.
- **`./.github/actions/push/` — internal helper action.** Used by `push.yaml`.

## GitHub App setup

You need **two** GitHub Apps, one registered on each instance:

| App | Lives on | Stored as a secret on | Permissions |
|-----|----------|-----------------------|-------------|
| Upstream app | Upstream GitHub (A) | Target repo (B) — used by `report` | `checks: write` |
| Target app | Target GitHub (B) | Upstream repo (A) — used by `push.yaml` | `contents: write`, `pull_requests: write` |

For each app, install it on the relevant repo and store its `app_id` and PEM
private key as repository or organization secrets.

When `sign_commit: true`, the target app must also have permission to write
to the repository's git data — `contents: write` is sufficient. Commits
created via the Git Data API are automatically signed by the GitHub App's
identity, satisfying branch-protection rules that require signed commits.

## Caller workflow (upstream side)

The reusable workflow handles a single target. To validate against multiple
targets, fan out from your caller workflow:

```yaml
# .github/workflows/cross-validate.yaml in your upstream repo
on:
  pull_request:
    branches: [main]

jobs:
  cross:
    strategy:
      fail-fast: false
      matrix:
        target:
          - { server_url: "https://ghes.eu.example", repository: "qa/app" }
          - { server_url: "https://ghes.us.example", repository: "qa/app" }
    uses: your-org/multi-github-validation-workflows/.github/workflows/push.yaml@v1
    with:
      ref: ${{ github.event.pull_request.head.sha }}
      target_server_url: ${{ matrix.target.server_url }}
      repository: ${{ matrix.target.repository }}
      base_branch: main
      mode: pr
      pr_labels: "cross-validation automated"
      sign_commit: true
    secrets:
      upstream_app_id: ${{ secrets.UPSTREAM_APP_ID }}
      upstream_private_key: ${{ secrets.UPSTREAM_APP_PRIVATE_KEY }}
      target_app_id: ${{ secrets.TARGET_APP_ID }}
      target_private_key: ${{ secrets.TARGET_APP_PRIVATE_KEY }}
```

The same workflow also works for *same-instance* validation (e.g. push from
`org/repo` to `org/repo-validation` on the same GitHub) — just point
`target_server_url` and `repository` at the other repo. If they happen to
match the current repo, the action skips automatically (see
[Anti-circular protection](#anti-circular-protection)).

## Target CI workflow

```yaml
# .github/workflows/qualify.yaml in your target repo
on:
  push:
    branches: ["cross-validation/**"]
  pull_request:

jobs:
  qualify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: your-org/multi-github-validation-workflows@v1
        with:
          state: started
          app_id: ${{ secrets.UPSTREAM_APP_ID }}
          private_key: ${{ secrets.UPSTREAM_APP_PRIVATE_KEY }}

      - run: ./scripts/run-tests.sh
        id: tests

      - if: success()
        uses: your-org/multi-github-validation-workflows@v1
        with:
          state: success
          app_id: ${{ secrets.UPSTREAM_APP_ID }}
          private_key: ${{ secrets.UPSTREAM_APP_PRIVATE_KEY }}

      - if: failure()
        uses: your-org/multi-github-validation-workflows@v1
        with:
          state: failure
          app_id: ${{ secrets.UPSTREAM_APP_ID }}
          private_key: ${{ secrets.UPSTREAM_APP_PRIVATE_KEY }}
```

You can also report intermediate progress:

```yaml
- uses: your-org/multi-github-validation-workflows@v1
  with:
    state: in_progress
    progress: 50
    summary: "Integration suite passed; running E2E."
    app_id: ${{ secrets.UPSTREAM_APP_ID }}
    private_key: ${{ secrets.UPSTREAM_APP_PRIVATE_KEY }}
```

## Anti-circular protection

Because the repository is cloned to every participating GitHub instance, it
guards against infinite reflection in two ways:

1. **`push.yaml`** — skips with a notice (and sets the `skipped` output to
   `"true"`) when `target_server_url + repository` matches the current
   `github.server_url + github.repository`. This makes it safe to use the
   same caller workflow on every instance.
2. **`report` action** — exits 0 with a notice if the triggering commit's
   message has no `<!-- upstream-check ... -->` marker. Native target
   commits never carry the marker, so they never trigger an upstream callback.

## Report states

| state | GitHub status | conclusion | notes |
|-------|---------------|------------|-------|
| `started` | `in_progress` | — | Sets `details_url` to the target run by default. |
| `in_progress` | `in_progress` | — | Optional `progress` (0-100) renders a progress bar in the summary. |
| `success` | `completed` | `success` | |
| `failure` | `completed` | `failure` | |
| `cancelled` | `completed` | `cancelled` | |
| `skipped` | `completed` | `skipped` | |

## Signed commits

Set `sign_commit: true` to construct the amended commit via the GitHub Git
Data API on the target. The flow is:

1. Push the original (unmodified) commit to a scratch branch on the target.
2. Call `POST /repos/{owner}/{repo}/git/commits` with the same tree + parents
   but the new commit message — GitHub signs the resulting commit with the
   target App's GPG key.
3. Move the real branch ref to the signed commit.
4. Delete the scratch ref.

This is required when target branch protection mandates signed commits. It
costs an extra round-trip per push but produces a verified commit owned by
the target App.

## Development

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build      # writes dist/ for both actions
```

Both actions are bundled with esbuild (CJS, node20 target) to a single
`dist/index.js` per action. `dist/` is gitignored — the release workflow
builds and force-pushes the bundle onto the release tag, which is what
consumers reference (`@v1`, `@v2`, etc.).
