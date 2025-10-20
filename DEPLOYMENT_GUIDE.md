# 🚀 Deployment Guide - Face Media Sharing App

## Overview

Your app has **two parts** that need to be deployed:
1. **Web App** (Next.js frontend + API routes)
2. **Worker** (Background job processor)

---

## 📋 Architecture

```
┌─────────────────────────────────────────┐
│  Web App (Vercel/Railway/etc)          │
│  - Next.js frontend                     │
│  - API routes                           │
│  - Handles uploads                      │
│  - Queues jobs to Redis                 │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  External Services                      │
│  - Upstash Redis (already set up)      │
│  - MongoDB Atlas (already set up)       │
│  - Clerk Auth (already set up)          │
│  - AWS S3 + Rekognition                 │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  Worker (Separate service)              │
│  - Railway/Render/DigitalOcean          │
│  - Processes background jobs            │
│  - Connects to same Redis/MongoDB       │
└─────────────────────────────────────────┘
```

---

## Option 1: Vercel (Recommended for Web App) ⭐

### Why Vercel?
- ✅ Made by Next.js team
- ✅ Zero-config deployment
- ✅ Automatic HTTPS
- ✅ Global CDN
- ✅ Free tier available

### Steps:

#### 1. Prepare Your Repository
```bash
# Make sure your code is committed
git add .
git commit -m "Ready for deployment"
git push origin main
```

#### 2. Deploy to Vercel

**Option A: Using Vercel CLI**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow the prompts:
# - Link to existing project? No
# - Project name? face-media-sharing
# - Directory? ./
# - Override settings? No
```

**Option B: Using Vercel Dashboard**
1. Go to https://vercel.com
2. Sign up with GitHub
3. Click "New Project"
4. Import your repository
5. Configure settings (see below)
6. Click "Deploy"

#### 3. Configure Environment Variables in Vercel

Go to: Project Settings → Environment Variables

Add all your `.env.local` variables:

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# MongoDB
MONGODB_URI=mongodb+srv://...

# Redis
REDIS_URL=rediss://...

# AWS Credentials
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=your-bucket-name
AWS_REKOGNITION_COLLECTION_PREFIX=face-media-group

# App Configuration
NODE_ENV=production
MAX_FILE_SIZE=10485760
MAX_FILES_PER_UPLOAD=50
ENABLE_RATE_LIMITING=true
ENABLE_PERFORMANCE_MONITORING=true
```

#### 4. Update Clerk Settings
1. Go to Clerk Dashboard
2. Navigate to your app
3. Add your Vercel URL to allowed origins:
   - `https://your-app.vercel.app`
   - `https://your-custom-domain.com` (if using custom domain)

#### 5. Redeploy
```bash
vercel --prod
```

---

## Option 2: Railway (Good for Both Web App + Worker) 🚂

### Why Railway?
- ✅ Can deploy both web app AND worker
- ✅ Simple pricing ($5/month)
- ✅ Built-in Redis (optional)
- ✅ Easy environment variables

### Steps:

#### 1. Create `railway.toml`
```toml
[build]
builder = "nixpacks"
buildCommand = "npm install && npm run build"

[deploy]
startCommand = "npm run start"
healthcheckPath = "/"
healthcheckTimeout = 100
restartPolicyType = "never"

[[services]]
name = "web"
startCommand = "npm run start"

[[services]]
name = "worker"
startCommand = "npm run worker"
```

#### 2. Deploy

**Using Railway CLI:**
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize
railway init

# Deploy
railway up
```

**Using Railway Dashboard:**
1. Go to https://railway.app
2. Sign up with GitHub
3. "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Add services: Web + Worker (two separate services)
6. Configure environment variables
7. Deploy!

#### 3. Configure Two Services

**Service 1: Web App**
- Start command: `npm run start`
- Add all environment variables
- Enable public networking

**Service 2: Worker**
- Start command: `npm run worker`
- Add same environment variables
- No public networking needed

---

## Option 3: Render (Good Alternative) 🎨

### Steps:

#### 1. Create `render.yaml`
```yaml
services:
  # Web App
  - type: web
    name: face-media-sharing-web
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm run start
    envVars:
      - key: NODE_ENV
        value: production
      # Add all other env vars in dashboard

  # Worker
  - type: worker
    name: face-media-sharing-worker
    env: node
    buildCommand: npm install
    startCommand: npm run worker
    envVars:
      - key: NODE_ENV
        value: production
      # Add all other env vars in dashboard
```

#### 2. Deploy
1. Go to https://render.com
2. Sign up with GitHub
3. "New" → "Blueprint"
4. Connect repository
5. Render will detect `render.yaml`
6. Add environment variables
7. Deploy!

---

## Option 4: DigitalOcean App Platform 🌊

### Steps:

#### 1. Create `.do/app.yaml`
```yaml
name: face-media-sharing
services:
  # Web App
  - name: web
    github:
      repo: your-username/face-media-sharing
      branch: main
      deploy_on_push: true
    build_command: npm install && npm run build
    run_command: npm run start
    envs:
      - key: NODE_ENV
        value: production
    http_port: 3000

  # Worker
  - name: worker
    github:
      repo: your-username/face-media-sharing
      branch: main
    build_command: npm install
    run_command: npm run worker
    instance_count: 1
    instance_size_slug: basic-xs
```

#### 2. Deploy
1. Go to DigitalOcean App Platform
2. Create new app from GitHub
3. Configure services
4. Add environment variables
5. Deploy!

---

## 🔧 Important: Worker Deployment

### The Worker MUST Run Separately

**Why?**
- Vercel has 10-second timeout for serverless functions
- Face processing takes 1-2 minutes
- Worker needs to run continuously

### Worker Deployment Options:

#### Option 1: Railway Worker Service (Recommended)
- Deploy worker as separate service
- Always running
- Automatic restarts
- ~$5/month

#### Option 2: Render Background Worker
- Free tier available
- Spins down after inactivity
- May have cold starts

#### Option 3: DigitalOcean Droplet
- Full control
- $5/month for basic droplet
- Manual setup required

#### Option 4: AWS EC2 (Advanced)
- Since you're using AWS already
- t2.micro eligible for free tier
- More setup required

---

## 📦 Dockerfile for Worker (Optional)

If deploying to services that support Docker:

```dockerfile
# Dockerfile.worker
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source
COPY . .

# Run worker
CMD ["npm", "run", "worker"]
```

Build and deploy:
```bash
docker build -f Dockerfile.worker -t face-worker .
docker run -d face-worker
```

---

## 🌍 Environment Variables Checklist

Make sure ALL these are set in BOTH web app AND worker:

```bash
# Authentication
✅ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
✅ CLERK_SECRET_KEY

# Database
✅ MONGODB_URI

# Redis
✅ REDIS_URL

# AWS
✅ AWS_ACCESS_KEY_ID
✅ AWS_SECRET_ACCESS_KEY
✅ AWS_REGION
✅ AWS_S3_BUCKET_NAME
✅ AWS_REKOGNITION_COLLECTION_PREFIX

# App Config
✅ NODE_ENV=production
✅ MAX_FILE_SIZE
✅ MAX_FILES_PER_UPLOAD
```

---

## 🔒 Security Checklist

Before deploying:

- [ ] Change all API keys/secrets from development
- [ ] Enable HTTPS (automatic with Vercel/Railway/Render)
- [ ] Set `NODE_ENV=production`
- [ ] Enable rate limiting: `ENABLE_RATE_LIMITING=true`
- [ ] Configure CORS if needed
- [ ] Set secure S3 bucket policies
- [ ] Use presigned URLs for private files
- [ ] Enable Clerk production mode
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Configure AWS billing alerts

---

## 📊 Monitoring & Logs

### Vercel
- Logs: Vercel Dashboard → Your Project → Logs
- Analytics: Built-in
- Errors: Integrated with Sentry (optional)

### Railway
- Logs: Service → Deployments → View Logs
- Metrics: Built-in CPU/Memory graphs
- Alerts: Configure in settings

### Worker Monitoring
- Check worker logs regularly
- Monitor Redis queue length
- Set up alerts for failed jobs
- Track processing times

---

## 💰 Cost Estimate (Production)

### Vercel (Web App)
- **Free tier:** Enough for testing
- **Pro:** $20/month (recommended for production)

### Railway (Worker)
- **Basic:** ~$5/month
- **Includes:** 500 hours execution

### External Services (Already Set Up)
- **Upstash Redis:** $0 (free tier) - $10/month
- **MongoDB Atlas:** $0 (free tier) - $9/month
- **Clerk:** $0 (free tier) - $25/month
- **AWS S3:** ~$0.50-5/month (depending on usage)
- **AWS Rekognition:** Pay per use (~$1 per 1000 images)

### Total Estimated Monthly Cost:
- **Hobby/Testing:** $0-10/month
- **Small Production:** $30-50/month
- **Growing App:** $50-100/month

---

## 🚀 Recommended Setup for You

Based on your stack:

### 1. **Web App → Vercel** ($0-20/month)
- Best Next.js hosting
- Free HTTPS
- Global CDN
- Easy deployment

### 2. **Worker → Railway** ($5/month)
- Simple setup
- Always running
- Good logs
- Auto-restart

### 3. **Keep Existing Services**
- Upstash Redis (free tier)
- MongoDB Atlas (free tier)
- Clerk (free tier)
- AWS S3 + Rekognition (pay per use)

**Total: $5-25/month**

---

## 📋 Quick Deployment Steps

### Step 1: Deploy Web App to Vercel
```bash
npm i -g vercel
vercel
# Add environment variables in dashboard
vercel --prod
```

### Step 2: Deploy Worker to Railway
```bash
npm i -g @railway/cli
railway login
railway init
railway up
# Add environment variables in dashboard
```

### Step 3: Test Everything
1. Visit your Vercel URL
2. Create a group
3. Upload images
4. Check Railway worker logs
5. Verify faces are processed

---

## 🆘 Troubleshooting

### Web app deployed but uploads fail
- Check AWS credentials in Vercel
- Verify S3 bucket exists
- Check CORS settings

### Worker not processing jobs
- Check worker logs in Railway
- Verify Redis URL is correct
- Ensure MongoDB connection works
- Check AWS credentials

### Jobs queued but not processed
- Worker might be down
- Check Railway service status
- Restart worker service

---

## 📞 Next Steps

1. **Choose your deployment platform** (Vercel + Railway recommended)
2. **Set up production AWS resources** (if not done)
3. **Deploy web app** first
4. **Deploy worker** second
5. **Test end-to-end** with real images
6. **Monitor for 24 hours** before announcing
7. **Set up error tracking** (Sentry)
8. **Configure custom domain** (optional)

---

## 🎉 You're Ready to Deploy!

**Recommended Quick Start:**
1. Sign up for Vercel
2. Deploy from GitHub
3. Add environment variables
4. Sign up for Railway
5. Deploy worker
6. Test!

**Good luck! 🚀**
