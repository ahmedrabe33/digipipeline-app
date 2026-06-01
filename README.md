# AuraWeb — App Repository

> Source code, Dockerfiles, and CI pipeline for the AuraWeb e-commerce platform.  
> The companion infrastructure repo lives at [Khairy-808/auraweb-k8s](https://github.com/Khairy-808/auraweb-k8s).

---

## What is AuraWeb?

AuraWeb is a full-stack e-commerce platform built as a set of independent microservices.  
Customers browse products, manage carts, and place orders through a React storefront.  
Admins manage products, orders, users, and reports through a separate React dashboard.  
All traffic flows through an Nginx gateway.

---

## Architecture

```
                        ┌─────────────┐
         customers ───▶ │   Frontend  │  React storefront
                        └──────┬──────┘
                               │
                        ┌──────▼──────┐
          admins ──────▶│   Admin     │  React admin dashboard
                        └──────┬──────┘
                               │
                        ┌──────▼──────┐
                        │   Gateway   │  Nginx — routes all API traffic
                        └──────┬──────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
   ┌──────▼──────┐     ┌───────▼──────┐    ┌───────▼──────┐
   │  user-auth  │     │   catalog    │    │  inventory   │
   │  JWT, users │     │  products,   │    │  stock mgmt  │
   │             │     │  search,     │    │              │
   └─────────────┘     │  reviews     │    └──────────────┘
                        └─────────────┘
   ┌─────────────┐     ┌─────────────┐    ┌──────────────┐
   │  shopping   │     │order-payment│    │ fulfillment  │
   │  cart,      │     │  orders,    │    │  shipping,   │
   │  wishlist   │     │  Stripe     │    │  coupons     │
   └─────────────┘     └─────────────┘    └──────────────┘
                        ┌─────────────┐
                        │  platform   │
                        │  analytics, │
                        │  audit,     │
                        │  files,     │
                        │  reporting  │
                        └─────────────┘

   ┌──────────────────────────────────────────────────────┐
   │  PostgreSQL   Redis   RabbitMQ   MinIO               │
   │  (database)  (cache)  (events)  (file storage)      │
   └──────────────────────────────────────────────────────┘
```

---

## Services

| Service | Tech | Responsibility |
|---|---|---|
| `frontend` | React + Vite | Customer storefront |
| `admin` | React + Vite | Admin dashboard |
| `gateway` | Nginx | API routing and load balancing |
| `user-auth` | Node.js | Registration, login, JWT tokens |
| `catalog` | Node.js | Products, search, reviews, recommendations |
| `inventory` | Node.js | Stock levels |
| `shopping` | Node.js | Cart and wishlist |
| `order-payment` | Node.js | Orders and Stripe payments |
| `fulfillment` | Node.js | Shipping and coupons |
| `platform` | Node.js | Analytics, audit logs, file uploads, reports |

---

## Run Locally

**Requirements:** Docker and Docker Compose

```bash
# 1. Clone the repo
git clone https://github.com/Khairy-808/auraweb-app.git
cd auraweb-app

# 2. Copy environment variables
cp .env.example .env

# 3. Start everything
docker compose up
```

| URL | What you get |
|---|---|
| `http://localhost` | Customer storefront |
| `http://localhost/admin` | Admin dashboard |
| `http://localhost/api` | API gateway |

---

## CI Pipeline (Jenkins)

Every push triggers the pipeline automatically:

```
Push to GitHub
      │
      ▼
  Lint (frontend, admin, services)
      │
      ▼
  Tests + Coverage report
      │
      ▼
  Security scan (npm audit + Trivy)
      │
      ▼
  Build Docker images → push to registry
  e.g. khairy808/frontend:abc1234
       khairy808/admin:abc1234
       khairy808/gateway:abc1234
      │
      ▼
  Update image tags in auraweb-k8s repo
  (kustomize edit set image ...)
      │
      ▼
  ArgoCD detects the commit → syncs cluster
  (no kubectl in Jenkins — ArgoCD deploys)
```

- **`develop` branch** → deploys to staging automatically
- **`main` branch** → waits for manual approval, then deploys to production

---

## Repository Structure

```
auraweb-app/
├── services/
│   ├── frontend/          # React customer storefront
│   ├── admin/             # React admin dashboard
│   ├── gateway/           # Nginx config
│   ├── catalog/           # Product, search, reviews
│   ├── inventory/         # Stock management
│   ├── shopping/          # Cart and wishlist
│   ├── order-payment/     # Orders and Stripe
│   ├── fulfillment/       # Shipping and coupons
│   ├── user-auth/         # Auth and users
│   └── platform/          # Analytics, files, reporting
├── database/
│   ├── init.sql           # Schema
│   └── seed_demo_data.sql # Demo data
├── docker-compose.yml     # Local development
├── Jenkinsfile            # CI pipeline
└── .env.example           # Environment variable template
```

---

## Related

- **Infrastructure / GitOps repo:** [Khairy-808/auraweb-k8s](https://github.com/Khairy-808/auraweb-k8s)  
  Kubernetes manifests, Kustomize overlays, and ArgoCD Applications.  
  Jenkins commits image tag updates here — ArgoCD handles the actual cluster deploy.
