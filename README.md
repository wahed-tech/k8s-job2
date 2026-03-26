# k8sjob

Internal tool for generating Kubernetes Job manifests. It reads `.kube/base/deployment.yaml` from a GitHub repository to inherit the correct container image, environment variables, volumes, and service account — so engineers don't have to copy-paste and manually edit deployment configs when running one-off jobs.

## How it works

1. **Command & args** — enter the command and arguments to run inside the container
2. **Repository** — select a repo from the `wahed-tech` GitHub org
3. **Job name** — review or edit the auto-suggested name (derived from command + args)
4. **Manifest** — copy or download the generated `batch/v1 Job` YAML, ready to apply

The generated job inherits from the first `Deployment` document in `.kube/base/deployment.yaml`:
- Container image
- `env` / `envFrom`
- `volumeMounts` / `volumes`
- `imagePullSecrets`
- `serviceAccountName`

Fixed values: `namespace: wahed`, `backoffLimit: 0`, `restartPolicy: Never`.

---

## Local development

### 1. Create a GitHub OAuth App

Go to **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**.

| Field                      | Value                                 |
|----------------------------|---------------------------------------|
| Homepage URL               | `http://localhost:8080`               |
| Authorization callback URL | `http://localhost:8080/auth/callback` |

Copy the **Client ID** and generate a **Client Secret**.

Grant the OAuth app access to the `wahed-tech` organization when authorizing (the authorization page shows an "Organization access" section — click **Grant** next to `wahed-tech`).

### 2. Set environment variables

```bash
export GITHUB_CLIENT_ID=<your-client-id>
export GITHUB_CLIENT_SECRET=<your-client-secret>
```

### 3. Run

```bash
go run .
```

Open [http://localhost:8080](http://localhost:8080).

---

### Update the GitHub OAuth App

Once deployed, update the OAuth App callback URL to match your real hostname:

**Authorization callback URL:** `https://<your-hostname>/auth/callback`

---

## Environment variables

| Variable               | Required | Description                           |
|------------------------|----------|---------------------------------------|
| `GITHUB_CLIENT_ID`     | yes      | GitHub OAuth App client ID            |
| `GITHUB_CLIENT_SECRET` | yes      | GitHub OAuth App client secret        |
| `PORT`                 | no       | HTTP listen port. Defaults to `8080`  |

> **Note:** The session encryption key is generated randomly on startup. Sessions are invalidated when the pod restarts — users will need to log in again.

---

## Project structure

```
.
├── main.go              # Bootstrap: config, routes, server start
├── server.go            # Server struct
├── session.go           # AES-GCM session cookie (encrypt / decrypt)
├── auth.go              # GitHub OAuth handlers + token exchange
├── github.go            # GitHub API client (repos, user, deployment YAML)
├── handlers.go          # HTTP API handlers (/api/repos, /api/repos/*/deployment)
├── static.go            # Embedded frontend (embed.FS)
├── go.mod
├── Dockerfile
├── .kube/base/
│   ├── deployment.yaml  # k8s Deployment + Service for this app
│   ├── configmap.yaml
│   └── kustomization.yaml
└── frontend/
    ├── index.html       # Entry point with importmap (Preact + htm + js-yaml)
    ├── app.js           # Root App component, wizard state, navigation
    ├── style.css
    ├── utils/
    │   └── manifest.js  # generateJobName, validateJobName, generateManifest
    └── components/
        ├── Login.js
        ├── Header.js
        ├── StepsIndicator.js
        ├── Step1Command.js
        ├── Step2Repo.js
        ├── Step3JobName.js
        └── Step4Manifest.js
```
