cd ~/digipipeline-workspace/digipipeline-app

cat > Jenkinsfile <<'EOF'
pipeline {
    agent { label 'linux' }

    options {
        skipDefaultCheckout(true)
        timestamps()
        disableConcurrentBuilds()
    }

    parameters {
        booleanParam(
            name: 'SKIP_SONAR',
            defaultValue: false,
            description: 'Skip SonarQube scan'
        )

        booleanParam(
            name: 'RUN_QUALITY_GATE',
            defaultValue: false,
            description: 'Run SonarQube Quality Gate only if webhook is configured.'
        )

        booleanParam(
            name: 'SKIP_TRIVY',
            defaultValue: false,
            description: 'Skip Trivy scans'
        )

        booleanParam(
            name: 'FAIL_ON_TRIVY',
            defaultValue: false,
            description: 'Fail pipeline if Trivy finds HIGH/CRITICAL vulnerabilities'
        )

        string(
            name: 'ONLY_SERVICES',
            defaultValue: '',
            description: 'Optional. Space-separated services. Empty = all services.'
        )
    }

    environment {
        // Jenkins controller/agents are in us-west-2
        // EKS + ECR are in us-east-1
        AWS_REGION = 'us-east-1'

        IMAGE_TAG_PREFIX = 'build'

        SERVICES_DEFAULT = 'frontend admin gateway catalog inventory shopping order-payment fulfillment user-auth platform'

        // ECR repo names:
        // auraweb-frontend
        // auraweb-admin
        // auraweb-gateway
        ECR_REPO_PREFIX = 'auraweb'

        GITHUB_CRED_ID = 'github-pat-creds'

        SONARQUBE_SERVER = 'sonarqube'
        SONAR_PROJECT_KEY = 'auraweb'
        SONAR_PROJECT_NAME = 'AuraWeb Platform'

        GITOPS_REPO = 'github.com/ahmedrabe33/digipipeline-gitops.git'
        GITOPS_BRANCH = 'main'

        // عدل المسار ده لو ملف kustomization عندك في مكان مختلف
        GITOPS_KUSTOMIZATION_FILE = 'apps/fullstack/overlays/dev/kustomization.yaml'

        TRIVY_SEVERITY = 'HIGH,CRITICAL'
    }

    stages {
        stage('Checkout App Repo') {
            steps {
                sh '''
                  rm -rf gitops-tmp .scannerwork || true
                '''
                checkout scm
            }
        }

        stage('Prepare Variables') {
            steps {
                script {
                    env.GIT_SHORT = sh(
                        script: 'git rev-parse --short HEAD',
                        returnStdout: true
                    ).trim()

                    env.IMAGE_TAG = "${env.IMAGE_TAG_PREFIX}-${env.BUILD_NUMBER}-${env.GIT_SHORT}"

                    env.AWS_ACCOUNT_ID = sh(
                        script: 'aws sts get-caller-identity --query Account --output text',
                        returnStdout: true
                    ).trim()

                    env.ECR_BASE = "${env.AWS_ACCOUNT_ID}.dkr.ecr.${env.AWS_REGION}.amazonaws.com"

                    def selectedServices = params.ONLY_SERVICES?.trim()
                    env.BUILD_SERVICES = selectedServices ? selectedServices : env.SERVICES_DEFAULT

                    echo "AWS Region: ${env.AWS_REGION}"
                    echo "AWS Account: ${env.AWS_ACCOUNT_ID}"
                    echo "ECR Base: ${env.ECR_BASE}"
                    echo "Image Tag: ${env.IMAGE_TAG}"
                    echo "Services: ${env.BUILD_SERVICES}"
                }
            }
        }

        stage('Verify Tools') {
            steps {
                sh '''
                  set -e

                  echo "==== User ===="
                  whoami

                  echo "==== Host ===="
                  hostname

                  echo "==== Java ===="
                  java -version

                  echo "==== Docker ===="
                  docker --version

                  echo "==== Git ===="
                  git --version

                  echo "==== AWS ===="
                  aws --version
                  aws sts get-caller-identity

                  echo "==== Trivy ===="
                  trivy --version
                '''
            }
        }

        stage('Validate Services') {
            steps {
                sh '''
                  set -e

                  echo "Validating services and Dockerfiles..."

                  for svc in $BUILD_SERVICES; do
                    if [ ! -d "services/$svc" ]; then
                      echo "ERROR: service directory not found: services/$svc"
                      echo "Available services:"
                      find services -maxdepth 1 -mindepth 1 -type d -printf "%f\\n" | sort
                      exit 1
                    fi

                    if [ ! -f "services/$svc/Dockerfile" ]; then
                      echo "ERROR: Dockerfile not found: services/$svc/Dockerfile"
                      echo "Dockerfiles found:"
                      find services -maxdepth 2 -name Dockerfile -print | sort
                      exit 1
                    fi

                    echo "OK: $svc"
                  done
                '''
            }
        }

        stage('SonarQube Scan') {
            when {
                expression { return !params.SKIP_SONAR }
            }

            steps {
                withSonarQubeEnv("${SONARQUBE_SERVER}") {
                    sh '''
                      set -e

                      echo "SonarQube URL: $SONAR_HOST_URL"

                      rm -rf .scannerwork
                      mkdir -p .scannerwork

                      docker run --rm \
                        -u "$(id -u):$(id -g)" \
                        -v "$PWD:/usr/src" \
                        -w /usr/src \
                        -e SONAR_HOST_URL="$SONAR_HOST_URL" \
                        -e SONAR_TOKEN="$SONAR_AUTH_TOKEN" \
                        -e SONAR_USER_HOME="/tmp/.sonar" \
                        sonarsource/sonar-scanner-cli:latest \
                        sonar-scanner \
                          -Dsonar.projectKey="$SONAR_PROJECT_KEY" \
                          -Dsonar.projectName="$SONAR_PROJECT_NAME" \
                          -Dsonar.sources=services \
                          -Dsonar.exclusions="**/node_modules/**,**/.git/**,**/dist/**,**/build/**" \
                          -Dsonar.javascript.lcov.reportPaths="**/coverage/lcov.info" \
                          -Dsonar.working.directory=.scannerwork
                    '''
                }
            }
        }

        stage('Quality Gate') {
            when {
                expression { return !params.SKIP_SONAR && params.RUN_QUALITY_GATE }
            }

            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        stage('Trivy Filesystem Scan') {
            when {
                expression { return !params.SKIP_TRIVY }
            }

            steps {
                sh '''
                  set -e

                  if [ "$FAIL_ON_TRIVY" = "true" ]; then
                    EXIT_CODE=1
                  else
                    EXIT_CODE=0
                  fi

                  trivy fs \
                    --scanners vuln \
                    --severity "$TRIVY_SEVERITY" \
                    --exit-code "$EXIT_CODE" \
                    --no-progress \
                    services
                '''
            }
        }

        stage('ECR Login') {
            steps {
                sh '''
                  set -e

                  aws ecr get-login-password --region "$AWS_REGION" \
                    | docker login --username AWS --password-stdin "$ECR_BASE"
                '''
            }
        }

        stage('Ensure ECR Repositories') {
            steps {
                sh '''
                  set -e

                  for svc in $BUILD_SERVICES; do
                    repo="${ECR_REPO_PREFIX}-${svc}"

                    aws ecr describe-repositories \
                      --region "$AWS_REGION" \
                      --repository-names "$repo" >/dev/null 2>&1 \
                    || aws ecr create-repository \
                      --region "$AWS_REGION" \
                      --repository-name "$repo" >/dev/null

                    echo "ECR repository ready: $repo"
                  done
                '''
            }
        }

        stage('Build Images') {
            steps {
                script {
                    def services = env.BUILD_SERVICES.split(' ').findAll { it.trim() }

                    services.each { svc ->
                        sh """
                          set -e

                          IMAGE_REPO="${env.ECR_BASE}/${env.ECR_REPO_PREFIX}-${svc}"
                          IMAGE_TAGGED="\$IMAGE_REPO:${env.IMAGE_TAG}"
                          IMAGE_LATEST="\$IMAGE_REPO:latest"

                          echo "Building ${svc}"
                          echo "Image: \$IMAGE_TAGGED"

                          docker build \
                            -f "services/${svc}/Dockerfile" \
                            -t "\$IMAGE_TAGGED" \
                            -t "\$IMAGE_LATEST" \
                            "services/${svc}"

                          docker images | grep "${env.ECR_REPO_PREFIX}-${svc}" || true
                        """
                    }
                }
            }
        }

        stage('Trivy Image Scan') {
            when {
                expression { return !params.SKIP_TRIVY }
            }

            steps {
                script {
                    def services = env.BUILD_SERVICES.split(' ').findAll { it.trim() }

                    services.each { svc ->
                        sh """
                          set -e

                          if [ "${params.FAIL_ON_TRIVY}" = "true" ]; then
                            EXIT_CODE=1
                          else
                            EXIT_CODE=0
                          fi

                          IMAGE="${env.ECR_BASE}/${env.ECR_REPO_PREFIX}-${svc}:${env.IMAGE_TAG}"

                          echo "Scanning image: \$IMAGE"

                          trivy image \
                            --scanners vuln \
                            --severity "${env.TRIVY_SEVERITY}" \
                            --exit-code "\$EXIT_CODE" \
                            --no-progress \
                            "\$IMAGE"
                        """
                    }
                }
            }
        }

        stage('Push Images to ECR us-east-1') {
            steps {
                script {
                    def services = env.BUILD_SERVICES.split(' ').findAll { it.trim() }

                    services.each { svc ->
                        sh """
                          set -e

                          IMAGE_REPO="${env.ECR_BASE}/${env.ECR_REPO_PREFIX}-${svc}"

                          docker push "\$IMAGE_REPO:${env.IMAGE_TAG}"
                          docker push "\$IMAGE_REPO:latest"

                          echo "Pushed:"
                          echo "\$IMAGE_REPO:${env.IMAGE_TAG}"
                          echo "\$IMAGE_REPO:latest"
                        """
                    }
                }
            }
        }

        stage('Update GitOps Repo') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: "${GITHUB_CRED_ID}",
                        usernameVariable: 'GIT_USER',
                        passwordVariable: 'GH_TOKEN'
                    )
                ]) {
                    sh '''
                      set -e

                      rm -rf gitops-tmp

                      git clone "https://${GIT_USER}:${GH_TOKEN}@${GITOPS_REPO}" gitops-tmp

                      cd gitops-tmp
                      git checkout "$GITOPS_BRANCH"

                      if [ ! -f "$GITOPS_KUSTOMIZATION_FILE" ]; then
                        echo "ERROR: kustomization file not found: $GITOPS_KUSTOMIZATION_FILE"
                        echo "Trying to find it..."
                        find . -name kustomization.yaml -print
                        exit 1
                      fi

                      echo "Updating GitOps kustomization:"
                      echo "$GITOPS_KUSTOMIZATION_FILE"

                      echo "Before:"
                      cat "$GITOPS_KUSTOMIZATION_FILE"

                      python3 - <<'PY'
import os
import sys
import yaml
from pathlib import Path

services = os.environ["BUILD_SERVICES"].split()
ecr_base = os.environ["ECR_BASE"]
repo_prefix = os.environ["ECR_REPO_PREFIX"]
image_tag = os.environ["IMAGE_TAG"]
file_path = Path(os.environ["GITOPS_KUSTOMIZATION_FILE"])

if not file_path.exists():
    print(f"ERROR: File not found: {file_path}")
    sys.exit(1)

data = yaml.safe_load(file_path.read_text())

if not isinstance(data, dict):
    print("ERROR: Invalid kustomization.yaml")
    sys.exit(1)

existing_images = data.get("images", [])

if existing_images is None:
    existing_images = []

if not isinstance(existing_images, list):
    print("ERROR: images must be a list")
    sys.exit(1)

images_by_name = {}

for item in existing_images:
    if isinstance(item, dict) and "name" in item:
        images_by_name[item["name"]] = item

for svc in services:
    repo_name = f"{repo_prefix}-{svc}"
    new_name = f"{ecr_base}/{repo_name}"

    if svc not in images_by_name:
        images_by_name[svc] = {"name": svc}

    images_by_name[svc]["newName"] = new_name
    images_by_name[svc]["newTag"] = image_tag

final_images = []

# preserve original order
for item in existing_images:
    if isinstance(item, dict) and "name" in item:
        name = item["name"]
        if name in images_by_name:
            final_images.append(images_by_name.pop(name))

# append missing services
for svc in services:
    if svc in images_by_name:
        final_images.append(images_by_name.pop(svc))

# keep any unrelated images
for _, item in images_by_name.items():
    final_images.append(item)

data["images"] = final_images

# dump without sorting keys
file_path.write_text(
    yaml.safe_dump(data, sort_keys=False, default_flow_style=False)
)

print("Updated images:")
for svc in services:
    print(f" - {svc}: {ecr_base}/{repo_prefix}-{svc}:{image_tag}")
PY

                      echo "After:"
                      cat "$GITOPS_KUSTOMIZATION_FILE"

                      echo "Git diff:"
                      git diff

                      git config user.email "jenkins@digipipeline.local"
                      git config user.name "Jenkins CI"

                      git add "$GITOPS_KUSTOMIZATION_FILE"

                      if git diff --cached --quiet; then
                        echo "No GitOps changes to commit."
                      else
                        git commit -m "ci: update AuraWeb images to ${IMAGE_TAG} [skip ci]"
                        git push origin "$GITOPS_BRANCH"
                      fi

                      cd ..
                      rm -rf gitops-tmp
                    '''
                }
            }
        }
    }

    post {
        success {
            echo "SUCCESS"
            echo "Images pushed to ECR us-east-1 with tag: ${IMAGE_TAG}"
            echo "GitOps repo updated: ${GITOPS_REPO}"
        }

        failure {
            echo "FAILED"
            echo "Check the failed stage logs."
        }

        always {
            sh '''
              docker system prune -f --filter "until=2h" || true
              rm -rf gitops-tmp || true
            '''
        }
    }
}
EOF