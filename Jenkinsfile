pipeline {
    agent any

    tools {
        nodejs 'node20'
    }

    environment {
        JWT_SECRET           = credentials('jwt-secret')
        STRIPE_SECRET_KEY    = credentials('stripe-secret-key')
        STRIPE_WEBHOOK_SECRET = credentials('stripe-webhook-secret')

        DOCKER_REGISTRY      = "${env.DOCKER_REGISTRY ?: ''}"
        BUILD_TAG            = "${env.BUILD_NUMBER ?: 'latest'}"
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

                    def registry = DOCKER_REGISTRY ? "${DOCKER_REGISTRY}/" : ''
                    def tag = BUILD_TAG

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
            when {
                expression { return DOCKER_REGISTRY != '' }
            }
            steps {
                script {
                    def registry = DOCKER_REGISTRY
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
                        sh "docker push ${registry}/${imageName}:${BUILD_TAG}"
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
                    if (DOCKER_REGISTRY) {
                        sh """
                            kubectl set image -n ${K8S_NAMESPACE} deployment/gateway          gateway=${DOCKER_REGISTRY}/void-gateway:${BUILD_TAG}
                            kubectl set image -n ${K8S_NAMESPACE} deployment/user-service     user-service=${DOCKER_REGISTRY}/void-user-service:${BUILD_TAG}
                            kubectl set image -n ${K8S_NAMESPACE} deployment/product-service  product-service=${DOCKER_REGISTRY}/void-product-service:${BUILD_TAG}
                            kubectl set image -n ${K8S_NAMESPACE} deployment/cart-service     cart-service=${DOCKER_REGISTRY}/void-cart-service:${BUILD_TAG}
                            kubectl set image -n ${K8S_NAMESPACE} deployment/order-service    order-service=${DOCKER_REGISTRY}/void-order-service:${BUILD_TAG}
                            kubectl set image -n ${K8S_NAMESPACE} deployment/payment-service  payment-service=${DOCKER_REGISTRY}/void-payment-service:${BUILD_TAG}
                        """
                    } else {
                        sh "kubectl apply -k ${K8S_MANIFESTS}/"
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
        }
        success {
            echo 'Deployment successful! All services running in Minikube.'
        }
        failure {
            echo 'Pipeline failed. Check the console output for details.'
        }
    }
}
