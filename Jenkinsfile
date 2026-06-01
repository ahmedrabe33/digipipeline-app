pipeline {
    agent { label 'linux' }

    options {
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
            description: 'Run SonarQube Quality Gate. Keep false unless webhook is configured.'
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
        // Architecture:
        // Jenkins controller/agents are in us-west-2
        // EKS + ECR are in us-east-1
        AWS_REGION = 'us-east-1'

        IMAGE_TAG_PREFIX = 'build'

        // Services from AuraWeb app
        SERVICES_DEFAULT = 'gateway frontend admin catalog inventory shopping order-payment fulfillment user-auth platform'

        // ECR repo naming
        ECR_REPO_PREFIX = 'auraweb'

        // Jenkins credentials and configs from your first Jenkinsfile
        GITHUB_CRED_ID = 'github-pat-creds'

        SONARQUBE_SERVER = 'sonarqube'
        SONAR_PROJECT_KEY = 'auraweb'
        SONAR_PROJECT_NAME = 'AuraWeb Platform'

        // GitOps repo from your project
        GITOPS_REPO = 'github.com/ahmedrabe33/digipipeline-gitops.git'
        GITOPS_BRANCH = 'main'

        // Expected GitOps structure
        // Example: k8s/base/frontend-deployment.yaml
        GITOPS_DEPLOYMENT_DIR = 'k8s/base'

        TRIVY_SEVERITY = 'HIGH,CRITICAL'
    }

    stages {
        stage('Checkout App Repo') {
            steps {
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

                      docker run --rm \
                        -v "$PWD:/usr/src" \
                        -w /usr/src \
                        -e SONAR_HOST_URL="$SONAR_HOST_URL" \
                        -e SONAR_TOKEN="$SONAR_AUTH_TOKEN" \
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
                            -t "\$IMAGE_TAGGED" \
                            -t "\$IMAGE_LATEST" \
                            "services/${svc}"
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

                      if [ ! -d "$GITOPS_DEPLOYMENT_DIR" ]; then
                        echo "ERROR: GitOps deployment directory not found: $GITOPS_DEPLOYMENT_DIR"
                        echo "Repo tree:"
                        find . -maxdepth 4 -type f | sort
                        exit 1
                      fi

                      echo "Updating GitOps manifests in: $GITOPS_DEPLOYMENT_DIR"

                      python3 - <<'PY'
import os
import re
import sys
from pathlib import Path

services = os.environ["BUILD_SERVICES"].split()
ecr_base = os.environ["ECR_BASE"]
repo_prefix = os.environ["ECR_REPO_PREFIX"]
image_tag = os.environ["IMAGE_TAG"]
deployment_dir = Path(os.environ["GITOPS_DEPLOYMENT_DIR"])

missing = []
updated_files = []

for svc in services:
    image_name = f"{repo_prefix}-{svc}"
    new_image = f"{ecr_base}/{image_name}:{image_tag}"

    file_path = deployment_dir / f"{svc}-deployment.yaml"

    if not file_path.exists():
        missing.append(str(file_path))
        continue

    text = file_path.read_text()

    pattern = re.compile(
        rf'(^\\s*image:\\s*)(["\\']?)(\\S*{re.escape(image_name)})(?::[^\\s"\\']+)?(["\\']?)\\s*$',
        re.MULTILINE
    )

    new_text, count = pattern.subn(rf'\\1{new_image}', text)

    if count == 0:
        # fallback: update first image line in this deployment
        fallback = re.compile(r'(^\\s*image:\\s*)(["\\']?)(\\S+)(["\\']?)\\s*$', re.MULTILINE)
        new_text, count = fallback.subn(rf'\\1{new_image}', text, count=1)

    if count == 0:
        print(f"ERROR: No image line found in {file_path}")
        sys.exit(1)

    file_path.write_text(new_text)
    updated_files.append(str(file_path))
    print(f"Updated {file_path} -> {new_image}")

if missing:
    print("ERROR: Missing deployment files:")
    for item in missing:
        print(f" - {item}")
    print("\\nRepo files:")
    for p in sorted(Path(".").rglob("*.yaml")):
        print(f" - {p}")
    sys.exit(1)

print("\\nUpdated files:")
for item in updated_files:
    print(f" - {item}")
PY

                      echo "Git diff:"
                      git diff

                      git config user.email "jenkins@digipipeline.local"
                      git config user.name "Jenkins CI"

                      git add "$GITOPS_DEPLOYMENT_DIR"

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

