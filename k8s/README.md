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
    repoURL: registry-1.docker.io/YOUR_USERNAME  # Your Docker Hub Registry
    chart: bullseye
    targetRevision: 0.1.0  # The version you want to deploy
    # Note: 'path' is NOT used for OCI charts
```

## 3. Accessing the App
The Ingress is configured for `bullseye.local`.
- **DNS**: Add `bullseye.local` to your `/etc/hosts` pointing to your k3s node IP.
- **URL**: http://bullseye.local
