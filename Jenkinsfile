pipeline {
    agent any

    environment {
        EC2_HOST = "ubuntu@34.207.243.122"
        SSH_KEY = credentials('jenkins-key') // Jenkins credential ID for the private key
    }

    stages {
        stage('Clone Repository') {
            steps {
                echo "Cloning repository..."
                checkout scm
            }
        }

        stage('Build') {
            steps {
                echo "Building the application..."
                // Add your build steps if any (like npm install, mvn build etc)
            }
        }

        stage('Deploy to EC2') {
            steps {
                echo "Deploying to EC2 instance..."
                sshagent(['jenkins-key']) {
                    sh "ssh -o StrictHostKeyChecking=no -i ~/.ssh/jenkins-key ${EC2_HOST} 'echo Connected to EC2'"
                    // Add your actual deployment steps here, e.g. pulling code, restarting app, etc.
                }
            }
        }
    }

    post {
        success {
            echo "✅ Deployment completed successfully!"
        }
        failure {
            echo "❌ Deployment failed!"
        }
    }
}
