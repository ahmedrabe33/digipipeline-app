// =============================================================================
// DigiPipeline — Jenkinsfile
// Runs on Jenkins Docker Agent (label: docker)
// =============================================================================
pipeline {
  agent { label 'docker' }

  parameters {
    string(name: 'ONLY_SERVICES', defaultValue: '',
           description: 'Comma-separated list of services to build. Empty = all.')
    string(name: 'MAX_PARALLEL', defaultValue: '2',
           description: 'Max parallel build threads.')
    booleanParam(name: 'SKIP_SONAR', defaultValue: false,
                 description: 'Skip SonarQube scan.')
    booleanParam(name: 'SKIP_TRIVY', defaultValue: false,
                 description: 'Skip Trivy vulnerability scan.')
  }

  environment {
    AWS_REGION       = 'us-west-2'
    AWS_ACCOUNT_ID   = '429104603739'
    ECR_BASE         = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
    PROJECT          = 'digipipeline'
    ENV              = 'dev'
    GITOPS_REPO      = 'https://github.com/ahmedrabe33/digipipeline-gitops'
    GITHUB_CRED_ID   = 'github-pat-creds'
    SONAR_PROJECT    = 'digipipeline'
  }

  stages {

    // ── 0. Setup ──────────────────────────────────────────────────────────────
    stage('Setup') {
      steps {
        script {
          env.GIT_SHORT = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
          env.IMAGE_TAG  = "build-${BUILD_NUMBER}-${env.GIT_SHORT}"
          def requested  = params.ONLY_SERVICES?.trim()
          def allServices = ['frontend','admin','gateway','user-auth','catalog',
                             'order-payment','fulfillment','shopping','platform','inventory']
          env.BUILD_SERVICES = requested ?
            requested.split(',').collect { it.trim() }.findAll { it in allServices }.join(',') :
            allServices.join(',')
          echo "Image tag  : ${env.IMAGE_TAG}"
          echo "Services   : ${env.BUILD_SERVICES}"
        }
      }
    }

    // ── 1. SonarQube scan (monorepo, once) ───────────────────────────────────
    stage('SonarQube') {
      when { expression { !params.SKIP_SONAR } }
      steps {
        withSonarQubeEnv('sonarqube') {
          sh """
            sonar-scanner \
              -Dsonar.projectKey=${SONAR_PROJECT} \
              -Dsonar.sources=. \
              -Dsonar.exclusions=**/node_modules/**,**/*.test.* \
              -Dsonar.host.url=\${SONAR_HOST_URL} \
              -Dsonar.login=\${SONAR_AUTH_TOKEN}
          """
        }
      }
    }

    // ── 2. ECR Login ─────────────────────────────────────────────────────────
    stage('ECR Login') {
      steps {
        sh """
          aws ecr get-login-password --region ${AWS_REGION} \
            | docker login --username AWS --password-stdin ${ECR_BASE}
        """
      }
    }

    // ── 3. Build, Scan, Push (parallel) ──────────────────────────────────────
    stage('Build → Scan → Push') {
      steps {
        script {
          def services = env.BUILD_SERVICES.split(',').collect { it.trim() }
          def maxP     = params.MAX_PARALLEL.toInteger()

          // chunk services into batches of maxP
          def batches = []
          def batch   = []
          services.each { svc ->
            batch << svc
            if (batch.size() == maxP) { batches << batch; batch = [] }
          }
          if (batch) batches << batch

          batches.each { batchList ->
            def parallelSteps = [:]
            batchList.each { svc ->
              def service = svc  // closure capture
              parallelSteps["${service}"] = {
                def ecrRepo   = "${ECR_BASE}/${PROJECT}-${ENV}-${service}"
                def imageTag  = "${ecrRepo}:${env.IMAGE_TAG}"

                stage("Build: ${service}") {
                  sh "docker build -t ${imageTag} ./services/${service}"
                }

                if (!params.SKIP_TRIVY) {
                  stage("Trivy: ${service}") {
                    sh """
                      trivy image \
                        --exit-code 1 \
                        --severity HIGH,CRITICAL \
                        --no-progress \
                        ${imageTag} || true
                    """
                    // Using || true — change to exit-code 1 to fail on vulns
                  }
                }

                stage("Push: ${service}") {
                  sh "docker push ${imageTag}"
                }
              }
            }
            parallel parallelSteps
          }
        }
      }
    }

    // ── 4. Update GitOps repo ─────────────────────────────────────────────────
    stage('Update GitOps') {
      steps {
        withCredentials([string(credentialsId: "${GITHUB_CRED_ID}", variable: 'GH_TOKEN')]) {
          sh """
            git clone https://\${GH_TOKEN}@github.com/ahmedrabe33/digipipeline-gitops.git gitops-tmp
            cd gitops-tmp

            SERVICES="${env.BUILD_SERVICES}"
            TAG="${env.IMAGE_TAG}"
            ACCOUNT="${AWS_ACCOUNT_ID}"
            REGION="${AWS_REGION}"
            PROJECT="${PROJECT}"
            ENV_NAME="${ENV}"

            for svc in \$(echo \$SERVICES | tr ',' ' '); do
              ECR_REPO="\${ACCOUNT}.dkr.ecr.\${REGION}.amazonaws.com/\${PROJECT}-\${ENV_NAME}-\${svc}"
              # Update kustomization.yaml images section
              sed -i "s|newTag:.*# \${svc}|newTag: \${TAG} # \${svc}|g" \
                apps/fullstack/overlays/dev/kustomization.yaml || true
            done

            git config user.email "jenkins@digipipeline.local"
            git config user.name  "Jenkins CI"
            git add -A
            git diff --cached --quiet || \
              git commit -m "ci: update image tags to \${TAG} [skip ci]"
            git push
            cd ..
            rm -rf gitops-tmp
          """
        }
      }
    }
  } // stages

  post {
    always {
      sh 'docker system prune -f --filter "until=1h" || true'
    }
    success {
      echo "✅ Pipeline succeeded — tag: ${env.IMAGE_TAG}"
    }
    failure {
      echo "❌ Pipeline failed — check logs above."
    }
  }
}
