# digipipeline-app

Application source code for the DigiPipeline project.

## Services
| Service | Port |
|---------|------|
| frontend | 3000 |
| admin | 3001 |
| gateway | 8080 |
| user-auth | 8081 |
| catalog | 8082 |
| order-payment | 8083 |
| fulfillment | 8084 |
| shopping | 8085 |
| platform | 8086 |
| inventory | 8087 |

## Local Development
```bash
docker compose up --build
```

## CI/CD
Jenkins reads the `Jenkinsfile` at repo root.
Image tag format: `build-<BUILD_NUMBER>-<GIT_SHORT>`
