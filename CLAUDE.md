# k8sjob — Codebase Guide

Internal tool that generates Kubernetes Job manifests. Engineers provide a command + args and select a `wahed-tech` GitHub repo; the app reads `.kube/base/deployment.yaml` from that repo to build a correct Job spec.

## Tech stack

- **Backend**: Go 1.21, standard library only (no external dependencies)
- **Frontend**: Preact 10 + htm (JSX via tagged template literals), loaded from CDN via ES module importmap — no build step
- **Auth**: GitHub OAuth 2.0 (authorization code flow), stateless AES-256-GCM encrypted session cookie

## File responsibilities

### Go backend

| File          | Responsibility                                                                                                  |
|---------------|-----------------------------------------------------------------------------------------------------------------|
| `main.go`     | Config from env vars, route registration, `http.ListenAndServe`                                                 |
| `server.go`   | `Server` struct holding config and session key                                                                  |
| `session.go`  | `SessionData` type, `getSession` / `setSession` / `clearSession`, AES-GCM `encrypt` / `decrypt`                 |
| `auth.go`     | OAuth handlers (`handleLogin`, `handleCallback`, `handleLogout`, `handleMe`), `exchangeCode`                    |
| `github.go`   | GitHub API client: `fetchUserInfo`, `listRepos` (with pagination), `fetchDeploymentYAML`, shared header helpers |
| `handlers.go` | API handlers: `handleRepos`, `handleDeployment`, `parseRepoFromPath`, `errNotFound` sentinel                    |
| `static.go`   | `embed.FS` over the whole `frontend/` dir, served at `/static/*`; SPA catch-all at `/`                          |

### Frontend

| File                                    | Responsibility                                                                                |
|-----------------------------------------|-----------------------------------------------------------------------------------------------|
| `frontend/app.js`                       | Root `App` component — all wizard state, auth check, repo pre-fetch, navigation between steps |
| `frontend/utils/manifest.js`            | Pure functions: `generateJobName`, `validateJobName`, `generateManifest` (uses js-yaml)       |
| `frontend/components/Login.js`          | Login page (unauthenticated state)                                                            |
| `frontend/components/Header.js`         | User avatar, login name, sign-out link                                                        |
| `frontend/components/StepsIndicator.js` | Step bubbles + connectors                                                                     |
| `frontend/components/Step1Command.js`   | Command input + dynamic argument rows; validates on Next                                      |
| `frontend/components/Step2Repo.js`      | Searchable repo dropdown with click-outside handling                                          |
| `frontend/components/Step3JobName.js`   | Job name input + async deployment fetch + manifest generation                                 |
| `frontend/components/Step4Manifest.js`  | Syntax-highlighted YAML, download, copy, start-over                                           |

## Key patterns

### Session
The GitHub OAuth token is never stored on the server. It is AES-256-GCM encrypted with a randomly generated key (created at startup) and stored in an HTTP-only browser session cookie (`k8sjob_session`). Sessions are invalidated on pod restart — acceptable for an internal tool.

### GitHub API proxy
All GitHub API calls are made server-side. The frontend never touches the GitHub token directly — it calls `/api/repos` and `/api/repos/{repo}/deployment`, which the Go backend proxies with the token from the session cookie.

### Manifest generation
`generateManifest` in `frontend/utils/manifest.js` reads the first `kind: Deployment` document from the deployment YAML (using `jsyaml.loadAll` to handle multi-document files). It extracts `image`, `env`, `envFrom`, `volumeMounts`, `volumes`, `imagePullSecrets`, and `serviceAccountName`, then builds a `batch/v1 Job` object and serializes it with `jsyaml.dump`.

Fixed job spec values (not configurable by the user):
- `namespace: wahed`
- `backoffLimit: 0`
- `restartPolicy: Never`
- No parallelism / completions overrides

### Job name generation
`generateJobName(command, args)` in `utils/manifest.js`:
- Takes the basename of the command path
- Appends up to 3 argument tokens (strips `--` prefix, replaces `=` with `-`)
- Lowercases, deduplicates dashes, truncates to 52 chars

Auto-updates in `App` whenever `command` or `args` change. Once the user manually edits the name in Step 3, the `jobNameEdited` flag prevents further auto-updates until the command/args change again.

### Frontend ES modules
The frontend uses native browser ES modules with an importmap defined in `index.html`. No build step, no bundler. Component files import each other with relative paths (`./components/Header.js`, `../utils/manifest.js`). Importmap aliases:
- `preact` → esm.sh
- `preact/hooks` → esm.sh
- `htm/preact` → esm.sh (provides `html` tagged template function)
- `js-yaml` → esm.sh

`highlight.js` is loaded as a classic `<script>` tag and accessed as `window.hljs` in `Step4Manifest.js`.

## Adding a new API endpoint

1. Add a GitHub API helper to `github.go` if it involves a GitHub call
2. Add an HTTP handler to `handlers.go`
3. Register the route in `main.go`

