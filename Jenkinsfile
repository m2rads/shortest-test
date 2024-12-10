pipeline {
    agent {
        docker {
            image 'node:20'
            args '-u root'  // Run as root to handle permissions
        }
    }
    
    stages {
        stage('Checkout') {
            steps {
                // First configure git to trust the workspace directory
                sh 'git config --global --add safe.directory "*"'
                
                // Then do the git checkout
                git branch: 'feat/tdd',
                    url: 'https://github.com/m2rads/shortest-test'
                
                // Print current branch for verification
                sh 'git branch --show-current'
            }
        }
        
        stage('Setup PNPM') {
            steps {
                sh '''
                    npm install -g pnpm
                    pnpm --version
                '''
            }
        }
        
        stage('Install Dependencies') {
            steps {
                sh 'pnpm install'
            }
        }
        
        stage('Install Coverage Tool') {
            steps {
                sh 'pnpm add -D @vitest/coverage-v8'
            }
        }
        
        stage('Run Tests') {
            steps {
                sh 'npx vitest run'
            }
        }
    }
}