# Kubernetes Deployment Guide

## 1. Install ArgoCD
Since you are using k3s, you need to install ArgoCD if it's not already present.

```bash
# Create namespace
kubectl create namespace argocd

# Install ArgoCD (Stable)
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for components to be ready
kubectl wait --for=condition=ready pod --all -n argocd
```

## 2. Deploy Bullseye Tracker
Once ArgoCD is running, you can deploy the application.

### Option A: Git Source (Recommended for Dev)
This watches your repository directly. Any change to `charts/bullseye` in `main` will be synced.

```bash
kubectl apply -f argocd-app.yaml
```

### Option B: OCI Chart (Production Style)
If you prefer to deploy the packaged Helm chart from Docker Hub (which is built by the GitHub Action), edit `argocd-app.yaml`:

```yaml
  source:
    repoURL: registry-1.docker.io/wakalou  # Your Docker Hub Registry
    chart: bullseye
    targetRevision: 0.1.0  # The version you want to deploy
    # Note: 'path' is NOT used for OCI charts
```

## 3. Configuration

### Basic Authentication
By default, the credentials are `admin` / `bullseye`. To change them:

1. **Generate the hash**:
   You can use the `htpasswd` utility:
   ```bash
   htpasswd -nb USERNAME PASSWORD
   # Example: htpasswd -nb admin supersecret
   # Output: admin:$apr1$xyz...
   ```
2. **Update values**:
   Set this value in your `values.yaml` (or ArgoCD parameter overrides):
   ```yaml
   ingress:
     basicAuth:
       htpasswd: "admin:$apr1$xyz..." # The output from step 1
   ```

### Custom Hostname
To change the domain from `bullseye.local` to your own domain:

1. Update `ingress.hosts` in `values.yaml`:
   ```yaml
   ingress:
     hosts:
       - host: game.example.com
         paths:
           - path: /
             pathType: Prefix
   ```

2. If using **Gateway API**, the same host config above is used for `HTTPRoute` hostnames.

### API Key (Backend)
The backend requires an API Key to secure endpoints.

1. **Generate a secure key**:
   ```bash
   openssl rand -hex 32
   ```

2. **Update values**:
   Uncomment and set the `API_KEY` in `values.yaml`:
   ```yaml
   backend:
     env:
       API_KEY: "your-super-secret-key" # Replace with generated key
   ```



## 4. Accessing the App
The Ingress is configured for `bullseye.local`.
- **DNS**: Add `bullseye.local` to your `/etc/hosts` pointing to your k3s node IP.
- **URL**: http://bullseye.local
