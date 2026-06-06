pipeline {
    agent any

    environment {
        JWT_SECRET           = credentials('jwt-secret')
        STRIPE_SECRET_KEY    = credentials('stripe-secret-key')
        STRIPE_WEBHOOK_SECRET = credentials('stripe-webhook-secret')
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

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
                sh 'docker compose build'
            }
        }

        stage('Deploy') {
            steps {
                sh '''cat > .env << EOF
JWT_SECRET=$JWT_SECRET
STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET=$STRIPE_WEBHOOK_SECRET
EOF'''
                sh 'docker compose down --remove-orphans'
                sh 'docker compose up -d'
            }
        }
    }

    post {
        always {
            sh 'rm -f .env'
        }
        success {
            echo 'Deployment successful! All services are running.'
        }
        failure {
            echo 'Pipeline failed. Check the console output for details.'
        }
    }
}
