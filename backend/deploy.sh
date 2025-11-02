#!/bin/bash

# Deployment script for Elastic Beanstalk

echo "🚀 Starting deployment to AWS Elastic Beanstalk..."

# Check if EB CLI is installed
if ! command -v eb &> /dev/null; then
    echo "❌ EB CLI not found. Please install it:"
    echo "   pip install awsebcli"
    exit 1
fi

# Build the application
echo "📦 Building application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"

# Deploy to Elastic Beanstalk
echo "🚢 Deploying to Elastic Beanstalk..."
eb deploy

if [ $? -ne 0 ]; then
    echo "❌ Deployment failed!"
    exit 1
fi

echo "✅ Deployment successful!"

# Show status
echo "📊 Environment status:"
eb status

echo "🎉 Deployment complete!"
echo "Run 'eb open' to view your application"
