pipeline {
    agent any

    tools {
        nodejs 'node20'
    }

    stages {
        stage('Install Dependencies') {
            steps {
                sh 'node -v'
                sh 'npm -v'
                sh 'npm install'
            }
        }
    }
}
