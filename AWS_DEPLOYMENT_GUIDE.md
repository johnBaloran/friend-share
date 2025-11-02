# AWS Deployment Guide - Face Media Sharing App

This guide will help you deploy the complete application to AWS.

## 📋 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    AWS DEPLOYMENT                           │
│                                                             │
│  ┌──────────────┐         ┌──────────────────┐            │
│  │ AWS Amplify  │         │ Elastic Beanstalk│            │
│  │  (Frontend)  │────────▶│    (Backend)     │            │
│  └──────────────┘         └──────────────────┘            │
│         │                          │                        │
│         │                          ├──▶ ElastiCache Redis  │
│         │                          │                        │
│         │                          ├──▶ MongoDB Atlas      │
│         │                          │                        │
│         └──────────────────────────┼──▶ S3 Bucket          │
│                                    │                        │
│                                    └──▶ Rekognition        │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 Services Used

1. **AWS Amplify** - Frontend hosting (Next.js)
2. **AWS Elastic Beanstalk** - Backend API (Express)
3. **MongoDB Atlas** - Database (free tier available)
4. **AWS ElastiCache** - Redis for job queues
5. **AWS S3** - Media storage (already configured)
6. **AWS Rekognition** - Face detection (already configured)
7. **AWS Route 53** (Optional) - Custom domain

---

## 📦 Prerequisites

### 1. Install Required Tools

```bash
# AWS CLI
aws --version

# EB CLI (Elastic Beanstalk)
pip install awsebcli

# Verify installation
eb --version
```

### 2. Configure AWS Credentials

```bash
aws configure
# Enter:
# - AWS Access Key ID
# - AWS Secret Access Key
# - Default region (e.g., us-east-1)
# - Default output format: json
```

---

## 🗄️ STEP 1: Set Up MongoDB Atlas

### 1.1 Create MongoDB Cluster

1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free account
3. Create a new cluster (M0 Free tier)
4. Choose AWS as cloud provider
5. Select same region as your app (e.g., us-east-1)
6. Click "Create Cluster"

### 1.2 Configure Database Access

1. Go to **Database Access** → **Add New Database User**
   - Username: `face-media-admin`
   - Password: Generate secure password
   - Database User Privileges: Read and write to any database
   - Save credentials securely

2. Go to **Network Access** → **Add IP Address**
   - Click "Allow Access from Anywhere" (0.0.0.0/0)
   - Or add Elastic Beanstalk IP ranges
   - Confirm

### 1.3 Get Connection String

1. Click **Connect** on your cluster
2. Choose "Connect your application"
3. Copy the connection string:
   ```
   mongodb+srv://face-media-admin:<password>@cluster0.xxxxx.mongodb.net/face-media-sharing?retryWrites=true&w=majority
   ```
4. Replace `<password>` with your actual password
5. Save this for later

---

## 🔴 STEP 2: Set Up ElastiCache Redis

### 2.1 Create Redis Cluster

```bash
# Using AWS CLI
aws elasticache create-cache-cluster \
  --cache-cluster-id face-media-redis \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --engine-version 7.0 \
  --num-cache-nodes 1 \
  --preferred-availability-zone us-east-1a \
  --tags Key=Name,Value=face-media-redis
```

### 2.2 Get Redis Endpoint

```bash
aws elasticache describe-cache-clusters \
  --cache-cluster-id face-media-redis \
  --show-cache-node-info
```

Save the endpoint (e.g., `face-media-redis.xxxxx.0001.use1.cache.amazonaws.com:6379`)

---

## 🗂️ STEP 3: Set Up S3 Bucket

### 3.1 Create S3 Bucket

```bash
# Create bucket
aws s3 mb s3://face-media-sharing-storage --region us-east-1

# Enable CORS
cat > cors.json << 'EOF'
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
EOF

aws s3api put-bucket-cors \
  --bucket face-media-sharing-storage \
  --cors-configuration file://cors.json
```

### 3.2 Create IAM User for S3 & Rekognition

```bash
# Create IAM user
aws iam create-user --user-name face-media-app-user

# Attach policies
aws iam attach-user-policy \
  --user-name face-media-app-user \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess

aws iam attach-user-policy \
  --user-name face-media-app-user \
  --policy-arn arn:aws:iam::aws:policy/AmazonRekognitionFullAccess

# Create access keys
aws iam create-access-key --user-name face-media-app-user
```

Save the Access Key ID and Secret Access Key.

---

## 🚀 STEP 4: Deploy Backend to Elastic Beanstalk

### 4.1 Initialize Elastic Beanstalk

```bash
cd backend

# Initialize EB
eb init -p node.js-18 face-media-backend --region us-east-1

# Create environment
eb create face-media-prod \
  --instance-type t3.small \
  --envvars PORT=8080,NODE_ENV=production
```

### 4.2 Set Environment Variables

```bash
eb setenv \
  NODE_ENV=production \
  PORT=8080 \
  MONGODB_URI="mongodb+srv://face-media-admin:PASSWORD@cluster0.xxxxx.mongodb.net/face-media-sharing" \
  REDIS_HOST="face-media-redis.xxxxx.0001.use1.cache.amazonaws.com" \
  REDIS_PORT=6379 \
  AWS_REGION=us-east-1 \
  AWS_ACCESS_KEY_ID="YOUR_ACCESS_KEY" \
  AWS_SECRET_ACCESS_KEY="YOUR_SECRET_KEY" \
  S3_BUCKET="face-media-sharing-storage" \
  REKOGNITION_COLLECTION_PREFIX="face-media" \
  CLERK_PUBLISHABLE_KEY="YOUR_CLERK_KEY" \
  CLERK_SECRET_KEY="YOUR_CLERK_SECRET" \
  CORS_ORIGIN="https://your-frontend-domain.com" \
  API_PREFIX="/api"
```

### 4.3 Deploy Backend

```bash
# Build first
npm run build

# Deploy to Elastic Beanstalk
eb deploy

# Check status
eb status

# Get URL
eb open
```

Your backend URL will be something like:
`http://face-media-prod.us-east-1.elasticbeanstalk.com`

---

## 🌐 STEP 5: Deploy Frontend to AWS Amplify

### 5.1 Update Frontend Environment

Create `frontend/.env.production`:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxxx
CLERK_SECRET_KEY=sk_live_xxxxx
NEXT_PUBLIC_API_URL=http://face-media-prod.us-east-1.elasticbeanstalk.com/api
```

### 5.2 Deploy to Amplify

#### Option A: Using Amplify Console (Recommended)

1. Go to AWS Amplify Console
2. Click **New app** → **Host web app**
3. Choose **GitHub** (or your git provider)
4. Select repository: `face-media-sharing`
5. Branch: `main`
6. Configure build settings:
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - npm ci
       build:
         commands:
           - npm run build
     artifacts:
       baseDirectory: .next
       files:
         - '**/*'
     cache:
       paths:
         - node_modules/**/*
   ```
7. Add environment variables in Amplify Console:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `NEXT_PUBLIC_API_URL`
8. Click **Save and Deploy**

#### Option B: Using Amplify CLI

```bash
# Install Amplify CLI
npm install -g @aws-amplify/cli

# Initialize Amplify
amplify init

# Add hosting
amplify add hosting

# Publish
amplify publish
```

Your frontend will be available at:
`https://main.xxxxx.amplifyapp.com`

---

## 🔐 STEP 6: Configure Clerk for Production

### 6.1 Update Clerk Dashboard

1. Go to https://dashboard.clerk.com
2. Select your application
3. Go to **Domains** → **Frontend API**
4. Add your Amplify URL: `https://main.xxxxx.amplifyapp.com`
5. Add backend URL to allowed origins

### 6.2 Update CORS in Backend

Update backend environment variable:

```bash
eb setenv CORS_ORIGIN="https://main.xxxxx.amplifyapp.com"
```

---

## 🎨 STEP 7: (Optional) Set Up Custom Domain

### 7.1 Frontend Custom Domain (Amplify)

1. Go to Amplify Console → Your app
2. Click **Domain management**
3. Add domain (e.g., `app.yourdomain.com`)
4. Follow DNS verification steps

### 7.2 Backend Custom Domain (Elastic Beanstalk)

1. Go to Route 53
2. Create hosted zone for your domain
3. Create A record pointing to EB load balancer
4. Add SSL certificate via ACM

---

## 📊 STEP 8: Monitoring & Logs

### Backend Logs (Elastic Beanstalk)

```bash
# View logs
eb logs

# Stream logs
eb logs --stream

# SSH into instance
eb ssh
```

### Frontend Logs (Amplify)

1. Go to Amplify Console
2. Click your app → **Monitoring**
3. View build logs and runtime logs

### CloudWatch Logs

Both services send logs to CloudWatch automatically.

---

## 💰 Cost Estimation

### Free Tier Eligible:
- **Elastic Beanstalk**: No additional charge (pay for EC2)
- **EC2 t3.small**: ~$15/month
- **MongoDB Atlas M0**: Free
- **ElastiCache t3.micro**: ~$12/month
- **S3**: ~$0.023 per GB + requests
- **Rekognition**: $1 per 1000 images
- **Amplify**: $0.01 per build minute, $0.15 per GB served

**Estimated Total**: ~$30-50/month for moderate usage

---

## 🔧 Troubleshooting

### Backend Issues

```bash
# Check environment
eb printenv

# View health
eb health

# Restart app
eb restart
```

### Common Issues

1. **MongoDB Connection Failed**
   - Check MongoDB Atlas whitelist IP
   - Verify connection string format
   - Check credentials

2. **Redis Connection Failed**
   - Check ElastiCache security group
   - Verify VPC settings
   - Check endpoint URL

3. **S3 Upload Failed**
   - Verify IAM permissions
   - Check bucket CORS policy
   - Verify bucket name

---

## 🔄 Deployment Updates

### Update Backend

```bash
cd backend
npm run build
eb deploy
```

### Update Frontend

With Amplify connected to Git:
```bash
git add .
git commit -m "Update frontend"
git push origin main
```

Amplify will auto-deploy!

---

## 📝 Production Checklist

- [ ] MongoDB Atlas cluster created
- [ ] ElastiCache Redis created
- [ ] S3 bucket created with CORS
- [ ] IAM user created with S3/Rekognition access
- [ ] Elastic Beanstalk environment created
- [ ] All backend environment variables set
- [ ] Backend deployed and accessible
- [ ] Frontend environment variables configured
- [ ] Frontend deployed to Amplify
- [ ] Clerk production keys configured
- [ ] CORS configured correctly
- [ ] Custom domain configured (optional)
- [ ] Monitoring set up
- [ ] Backup strategy in place

---

## 🎉 Success!

Your application is now deployed to AWS!

- **Frontend**: https://main.xxxxx.amplifyapp.com
- **Backend**: http://face-media-prod.us-east-1.elasticbeanstalk.com/api

Test the complete flow:
1. Sign up/Login with Clerk
2. Create a group
3. Upload photos
4. View face detection results
5. Check face clusters

---

## 📞 Support

For issues:
- AWS Support: https://console.aws.amazon.com/support
- Clerk Support: https://clerk.com/support
- MongoDB Atlas: https://www.mongodb.com/cloud/atlas/support
