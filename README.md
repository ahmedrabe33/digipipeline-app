# AuraWeb — DigiPipeline App Repository

> Application source code, Dockerfiles, and Jenkins CI/CD pipeline for the **AuraWeb** microservices platform.
> This repository is part of the **DigiPipeline DevOps Project**, which demonstrates a production-like CI/CD and GitOps workflow on AWS.

---

## What is AuraWeb?

**AuraWeb** is a full-stack web application built using a microservices architecture.

It includes a React-based user interface, multiple backend services, and supporting services such as PostgreSQL, Redis, RabbitMQ, and MinIO.

The application is designed to demonstrate how modern applications can be built, containerized, scanned, pushed to a container registry, and deployed to Kubernetes using a complete DevOps workflow.

---

## Project Repositories

DigiPipeline is divided into three repositories:

| Repository            | Responsibility                                                         |
| --------------------- | ---------------------------------------------------------------------- |
| `digipipeline-app`    | Application source code, Dockerfiles, and Jenkins pipeline             |
| `digipipeline-gitops` | Kubernetes manifests, Kustomize overlays, and Argo CD desired state    |
| `digipipeline-infra`  | AWS infrastructure and platform automation using Terraform and Ansible |

This repository represents the **application layer**.

---

## Application Screenshots

### Home Page

![Home Page](images/p-home.png)

### Sign Up Page

![Sign Up Page](images/p-sign-up.png)

### Sign In Page

![Sign In Page](images/p-sign-in.png)

### User Dashboard

![User Dashboard](images/p-after-sign.png)

### About Page

![About Page](images/p-about.png)

### Contact Page

![Contact Page](images/p-contact.png)

---

## CI/CD Pipeline Screenshot

The application is built and delivered using a Jenkins CI/CD pipeline.

The pipeline validates the application, runs code quality analysis, performs security scans, builds Docker images, pushes them to Amazon ECR, and updates the GitOps repository for Argo CD deployment.

![Jenkins Pipeline Success](images/p-pipeline.png)

---

## Architecture

```text
                        ┌─────────────┐
         Users ───────▶ │  Frontend   │
                        │ React + Vite│
                        └──────┬──────┘
                               │
                        ┌──────▼──────┐
                        │   Gateway   │
                        │    Nginx    │
                        └──────┬──────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
   ┌──────▼──────┐     ┌───────▼──────┐    ┌───────▼──────┐
   │  user-auth  │     │   catalog    │    │  inventory   │
   │ auth, JWT,  │     │ products and │    │ stock mgmt   │
   │ users       │     │ catalog APIs │    │              │
   └─────────────┘     └──────────────┘    └──────────────┘

   ┌─────────────┐     ┌──────────────┐    ┌──────────────┐
   │  shopping   │     │ order-payment│    │ fulfillment  │
   │ cart logic  │     │ orders logic │    │ fulfillment  │
   └─────────────┘     └──────────────┘    └──────────────┘

                        ┌─────────────┐
                        │  platform   │
                        │ platform APIs│
                        └─────────────┘

   ┌──────────────────────────────────────────────────────┐
   │ PostgreSQL        Redis        RabbitMQ       MinIO  │
   │ Database          Cache        Events         Storage│
   └──────────────────────────────────────────────────────┘
```

---

## Services

| Service         | Technology           | Responsibility                                            |
| --------------- | -------------------- | --------------------------------------------------------- |
| `frontend`      | React + Vite + Nginx | Main user-facing web interface                            |
| `admin`         | React + Vite + Nginx | Admin dashboard interface                                 |
| `gateway`       | Nginx                | API routing and reverse proxy                             |
| `user-auth`     | Node.js + Express    | Registration, login, JWT authentication, and profile APIs |
| `catalog`       | Node.js + Express    | Product catalog APIs                                      |
| `inventory`     | Node.js + Express    | Inventory and stock-related APIs                          |
| `shopping`      | Node.js + Express    | Shopping/cart-related APIs                                |
| `order-payment` | Node.js + Express    | Orders and payment-related APIs                           |
| `fulfillment`   | Node.js + Express    | Fulfillment-related APIs                                  |
| `platform`      | Node.js + Express    | Platform-related APIs                                     |

---

## Supporting Services

These services are deployed through the Kubernetes manifests in the GitOps repository:

| Service    | Purpose                                       |
| ---------- | --------------------------------------------- |
| PostgreSQL | Main relational database                      |
| Redis      | Cache layer                                   |
| RabbitMQ   | Message broker for asynchronous communication |
| MinIO      | S3-compatible object storage                  |

---

## Technology Stack

| Area                | Tools / Technologies   |
| ------------------- | ---------------------- |
| Frontend            | React, Vite, Nginx     |
| Backend             | Node.js, Express.js    |
| Database            | PostgreSQL             |
| Cache               | Redis                  |
| Messaging           | RabbitMQ               |
| Object Storage      | MinIO                  |
| Containerization    | Docker                 |
| CI/CD               | Jenkins                |
| Image Registry      | Amazon ECR             |
| Kubernetes Platform | Amazon EKS             |
| GitOps              | Argo CD                |
| Code Quality        | SonarQube              |
| Security Scanning   | Trivy                  |
| Monitoring          | Prometheus and Grafana |

---

## Repository Structure

```text
digipipeline-app/
├── database/
├── services/
│   ├── admin/
│   ├── catalog/
│   ├── frontend/
│   ├── fulfillment/
│   ├── gateway/
│   ├── inventory/
│   ├── order-payment/
│   ├── platform/
│   ├── shopping/
│   └── user-auth/
├── images/
│   ├── p-home.png
│   ├── p-sign-up.png
│   ├── p-sign-in.png
│   ├── p-after-sign.png
│   ├── p-about.png
│   ├── p-contact.png
│   └── p-pipeline.png
├── docker-compose.yml
├── Jenkinsfile
└── README.md
```

---

## DevOps Delivery Workflow

```text
Developer pushes code to digipipeline-app
        |
        v
Jenkins pipeline starts
        |
        v
Validate application services
        |
        v
Run SonarQube code analysis
        |
        v
Run Trivy security scans
        |
        v
Build Docker images
        |
        v
Push images to Amazon ECR
        |
        v
Update image tags in digipipeline-gitops
        |
        v
Argo CD detects the GitOps change
        |
        v
Application is deployed to Amazon EKS
```

---

## Jenkins CI/CD Pipeline

The `Jenkinsfile` automates the application delivery process.

Main stages include:

| Stage                     | Purpose                                       |
| ------------------------- | --------------------------------------------- |
| `Checkout App Repo`       | Pulls the latest application code             |
| `Prepare Variables`       | Prepares image tags and environment variables |
| `Verify Tools`            | Checks required tools on the Jenkins agent    |
| `Validate Services`       | Validates service folders before building     |
| `SonarQube Scan`          | Runs code quality analysis                    |
| `Quality Gate`            | Validates the SonarQube quality result        |
| `Trivy Filesystem Scan`   | Scans source code and dependencies            |
| `ECR Login`               | Authenticates Jenkins with Amazon ECR         |
| `Ensure ECR Repositories` | Creates or validates ECR repositories         |
| `Build Images`            | Builds Docker images for application services |
| `Trivy Image Scan`        | Scans built Docker images                     |
| `Push Images to ECR`      | Pushes images to Amazon ECR                   |
| `Update GitOps Repo`      | Updates image tags in the GitOps repository   |
| `Post Actions`            | Final reporting and cleanup                   |

---

## Image Tagging Strategy

Docker images are tagged using the Jenkins build number and Git commit hash.

Example tag:

```text
build-5-c8ae922
```

Example image pushed to Amazon ECR:

```text
429104603739.dkr.ecr.us-east-1.amazonaws.com/auraweb-user-auth:build-5-c8ae922
```

This makes each deployment traceable to:

* Jenkins build number
* Git commit
* Docker image tag
* GitOps revision
* Argo CD deployment

---

## GitOps Deployment

This repository does not directly apply Kubernetes manifests.

Instead:

1. Jenkins builds Docker images from this repository.
2. Jenkins pushes the images to Amazon ECR.
3. Jenkins updates image tags in the `digipipeline-gitops` repository.
4. Argo CD detects the GitOps change.
5. Argo CD deploys the new version to Amazon EKS.

This keeps Kubernetes deployment state controlled from Git.

---

## Fault-Tolerance Improvement

The `user-auth` service was improved to make the registration flow more resilient.

### Previous Behavior

If RabbitMQ restarted or the message channel was closed, user registration could fail with:

```text
500 Registration failed
```

Even if the user was already created in PostgreSQL.

### Improved Behavior

The registration flow now works like this:

```text
Create user in PostgreSQL
        |
        v
Try to publish USER_CREATED event to RabbitMQ
        |
        v
If RabbitMQ publish fails, log a warning only
        |
        v
Return 201 Created to the client
```

This means a temporary RabbitMQ issue does not break the main user registration flow.

---

## Main Authentication APIs

### Register User

```http
POST /api/auth/signup
```

Example request:

```json
{
  "firstName": "test",
  "lastName": "user",
  "name": "test user",
  "email": "test@example.com",
  "password": "123456789"
}
```

Expected response:

```json
{
  "id": 5,
  "email": "test@example.com",
  "name": "test user"
}
```

Expected status code:

```text
201 Created
```

---

### Login

```http
POST /api/auth/login
```

Example request:

```json
{
  "email": "test@example.com",
  "password": "123456789"
}
```

Expected response:

```json
{
  "token": "jwt-token",
  "user": {
    "id": 1,
    "email": "test@example.com",
    "name": "test user",
    "role": "user"
  }
}
```

---

### Current User

```http
GET /api/auth/me
```

Requires:

```http
Authorization: Bearer <token>
```

---

## Health Checks

Backend services expose health endpoints used by Kubernetes readiness and liveness probes.

Example:

```http
GET /health
```

Kubernetes uses these checks to decide whether a service is ready to receive traffic or should be restarted.

---

## Run Locally

### Requirements

* Docker
* Docker Compose

### Clone the Repository

```bash
git clone https://github.com/ahmedrabe33/digipipeline-app.git
cd digipipeline-app
```

### Start the Application

```bash
docker compose up --build
```

### Stop the Application

```bash
docker compose down
```

---

## Build a Service Manually

Example for the `user-auth` service:

```bash
docker build -t user-auth:local ./services/user-auth
```

Run it locally:

```bash
docker run --rm -p 3000:3000 user-auth:local
```

---

## Environment Variables

Common environment variables used by the services:

```env
PORT=3000
DB_HOST=postgres
DB_NAME=appdb
DB_USER=appuser
DB_PASSWORD=apppassword
REDIS_HOST=redis
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672
JWT_SECRET=dev-jwt-secret-123456
```

In Kubernetes, these values are managed using Kubernetes Secrets from the GitOps repository.

---

## Production-Like DevOps Practices

This repository demonstrates:

* Microservices architecture
* Containerized application services
* Jenkins CI/CD pipeline
* Docker image builds
* Amazon ECR image registry
* GitOps deployment workflow
* Argo CD automated deployment
* Kubernetes health checks
* Rolling deployment strategy
* SonarQube quality scanning
* Trivy security scanning
* Fault-tolerant service behavior
* Deployment on Amazon EKS

---

## Related Repositories

| Repository            | Description                                                  |
| --------------------- | ------------------------------------------------------------ |
| `digipipeline-app`    | Application source code and Jenkins pipeline                 |
| `digipipeline-gitops` | Kubernetes manifests and Argo CD configuration               |
| `digipipeline-infra`  | AWS infrastructure and automation with Terraform and Ansible |

---

## Final Result

After a successful pipeline run:

* Application services are validated.
* Source code is scanned.
* Docker images are built.
* Container images are scanned.
* Images are pushed to Amazon ECR.
* GitOps manifests are updated.
* Argo CD deploys the new version to Amazon EKS.
* AuraWeb becomes available through an AWS Application Load Balancer.

---

## Author

**Ahmed Rabie**  
DevOps Engineer | AWS • Docker • Kubernetes • Jenkins • Terraform • Ansible • GitOps

Built as part of the **DigiPipeline DevOps Project**.