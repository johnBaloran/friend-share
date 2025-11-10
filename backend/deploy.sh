#!/bin/bash

# Face Media Sharing - Deployment Script
# Deploys both API and Worker environments to AWS Elastic Beanstalk

set -e  # Exit on error

echo "=================================="
echo "Face Media Sharing Deployment"
echo "=================================="
echo ""

# Check if EB CLI is installed
if ! command -v eb &> /dev/null; then
    echo "❌ Error: EB CLI is not installed"
    echo "Install it with: pip install awsebcli"
    exit 1
fi

# Build TypeScript
echo "📦 Building TypeScript..."
npm run build

if [ ! -d "dist" ]; then
    echo "❌ Error: Build failed - dist/ directory not found"
    exit 1
fi

echo "✅ Build complete"
echo ""

# Backup original Procfile
if [ -f "Procfile" ]; then
    cp Procfile Procfile.backup
fi

# Deploy API
echo "🚀 Deploying API (face-media-api)..."
echo "web: node dist/index.js" > Procfile
eb deploy face-media-api --timeout 10

if [ $? -eq 0 ]; then
    echo "✅ API deployed successfully"
else
    echo "❌ API deployment failed"
    # Restore Procfile
    if [ -f "Procfile.backup" ]; then
        mv Procfile.backup Procfile
    fi
    exit 1
fi
echo ""

# Deploy Workers
echo "🚀 Deploying Workers (face-media-workers)..."
echo "worker: node dist/workers/index.js" > Procfile
eb deploy face-media-workers --timeout 10

if [ $? -eq 0 ]; then
    echo "✅ Workers deployed successfully"
else
    echo "❌ Workers deployment failed"
    # Restore Procfile
    if [ -f "Procfile.backup" ]; then
        mv Procfile.backup Procfile
    fi
    exit 1
fi
echo ""

# Restore original Procfile
if [ -f "Procfile.backup" ]; then
    mv Procfile.backup Procfile
else
    echo "web: node dist/index.js" > Procfile
fi

# Get API URL
echo "=================================="
echo "✅ Deployment Complete!"
echo "=================================="
echo ""

API_URL=$(eb status face-media-api | grep CNAME | awk '{print $2}')
if [ -n "$API_URL" ]; then
    echo "API URL: https://$API_URL"
fi

echo ""
echo "Check status:"
echo "  API:     eb status face-media-api"
echo "  Workers: eb status face-media-workers"
echo ""
echo "View logs:"
echo "  API:     eb logs face-media-api --stream"
echo "  Workers: eb logs face-media-workers --stream"
echo ""
