pipeline {
    agent any

    tools {
        nodejs 'node20'
    }

    environment {
        JWT_SECRET           = credentials('jwt-secret')
        STRIPE_SECRET_KEY    = credentials('stripe-secret-key')
        STRIPE_WEBHOOK_SECRET = credentials('stripe-webhook-secret')

        DOCKER_REGISTRY       = "${env.DOCKER_REGISTRY ?: ''}"
        DOCKER_REGISTRY_SERVER = "${env.DOCKER_REGISTRY_SERVER ?: ''}"
        DOCKER_REGISTRY_CREDS  = credentials('docker-registry-creds')
        BUILD_TAG             = "${env.BUILD_NUMBER ?: 'latest'}"
        K8S_NAMESPACE        = 'void-backend'
        K8S_MANIFESTS        = 'k8s'
    }

    stages {
        stage('Install Dependencies') {
            steps {
                sh 'npm install'
                sh 'npm run install:all'
            }
        }

        stage('Run Tests') {
            steps {
                sh 'npm test'
            }
            post {
                failure {
                    junit '**/test-results/**/*.xml'
                }
            }
        }

        stage('Login to Registry') {
            steps {
                script {
                    if (!env.DOCKER_REGISTRY?.trim()) {
                        echo 'No DOCKER_REGISTRY set — skipping login'
                        return
                    }
                    def server = env.DOCKER_REGISTRY_SERVER?.trim() ?: ''
                    sh """
                        echo "${DOCKER_REGISTRY_CREDS_PSW}" | docker login \
                            -u "${DOCKER_REGISTRY_CREDS_USR}" \
                            --password-stdin ${server}
                    """
                }
            }
        }

        stage('Build Docker Images') {
            steps {
                script {
                    def services = [
                        'gateway',
                        'user-service',
                        'product-service',
                        'cart-service',
                        'order-service',
                        'payment-service'
                    ]

                    def registry = env.DOCKER_REGISTRY ? "${env.DOCKER_REGISTRY}/" : ''
                    def tag = env.BUILD_TAG

                    services.each { service ->
                        def imageName = "void-${service}"
                        def fullImage = registry ? "${registry}${imageName}:${tag}" : "${imageName}:${tag}"

                        sh "docker build -t ${fullImage} -f ${service}/Dockerfile ."

                        if (registry) {
                            sh "docker tag ${fullImage} ${registry}${imageName}:latest"
                        }
                    }
                }
            }
        }

        stage('Push Images') {
            steps {
                script {
                    if (!env.DOCKER_REGISTRY?.trim()) {
                        echo 'No DOCKER_REGISTRY set — skipping push'
                        return
                    }
                    def registry = env.DOCKER_REGISTRY
                    def tag = env.BUILD_TAG
                    def services = [
                        'gateway',
                        'user-service',
                        'product-service',
                        'cart-service',
                        'order-service',
                        'payment-service'
                    ]

                    services.each { service ->
                        def imageName = "void-${service}"
                        sh "docker push ${registry}/${imageName}:${tag}"
                        sh "docker push ${registry}/${imageName}:latest"
                    }
                }
            }
        }

        stage('Update Kubernetes Secrets') {
            steps {
                sh """
                    kubectl create secret generic void-secret -n ${K8S_NAMESPACE} \
                        --from-literal=JWT_SECRET='${JWT_SECRET}' \
                        --from-literal=STRIPE_SECRET_KEY='${STRIPE_SECRET_KEY}' \
                        --from-literal=STRIPE_WEBHOOK_SECRET='${STRIPE_WEBHOOK_SECRET}' \
                        --dry-run=client -o yaml | kubectl apply -f -
                """
            }
        }

        stage('Deploy to Minikube') {
            steps {
                script {
                    if (env.DOCKER_REGISTRY) {
                        def ns = env.K8S_NAMESPACE
                        def tag = env.BUILD_TAG
                        def reg = env.DOCKER_REGISTRY
                        sh """
                            kubectl set image -n ${ns} deployment/gateway          gateway=${reg}/void-gateway:${tag}
                            kubectl set image -n ${ns} deployment/user-service     user-service=${reg}/void-user-service:${tag}
                            kubectl set image -n ${ns} deployment/product-service  product-service=${reg}/void-product-service:${tag}
                            kubectl set image -n ${ns} deployment/cart-service     cart-service=${reg}/void-cart-service:${tag}
                            kubectl set image -n ${ns} deployment/order-service    order-service=${reg}/void-order-service:${tag}
                            kubectl set image -n ${ns} deployment/payment-service  payment-service=${reg}/void-payment-service:${tag}
                        """
                    } else {
                        sh "kubectl apply -k ${env.K8S_MANIFESTS}/"
                    }
                }
            }
        }

        stage('Verify Deployment') {
            steps {
                sh """
                    kubectl rollout status -n ${K8S_NAMESPACE} deployment/gateway         --timeout=120s
                    kubectl rollout status -n ${K8S_NAMESPACE} deployment/user-service    --timeout=120s
                    kubectl rollout status -n ${K8S_NAMESPACE} deployment/product-service --timeout=120s
                    kubectl rollout status -n ${K8S_NAMESPACE} deployment/cart-service    --timeout=120s
                    kubectl rollout status -n ${K8S_NAMESPACE} deployment/order-service   --timeout=120s
                    kubectl rollout status -n ${K8S_NAMESPACE} deployment/payment-service --timeout=120s
                """
            }
        }
    }

    post {
        always {
            sh 'rm -f .env'
            script {
                if (env.DOCKER_REGISTRY?.trim()) {
                    def server = env.DOCKER_REGISTRY_SERVER?.trim() ?: ''
                    sh "docker logout ${server}"
                }
            }
        }
        success {
            echo 'Deployment successful! All services running in Minikube.'
        }
        failure {
            echo 'Pipeline failed. Check the console output for details.'
        }
    }
}
