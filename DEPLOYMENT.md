# Deployment Guide

## Overview

Your project uses a **monorepo structure** with:
- **Frontend**: Next.js app (root directory)
- **Backend**: Express API (`backend/` folder)

They deploy to **different platforms**:
- Frontend → **Vercel** (or similar)
- Backend → **Railway** (or AWS/Render)

---

## ✅ Configuration Files Created

### 1. `.vercelignore`
Tells Vercel to **ignore the backend folder** when deploying frontend.

```
backend/
worker/
```

### 2. `.gitignore` (updated)
Ensures backend artifacts aren't committed to Git.

```
backend/node_modules/
backend/dist/
backend/.env
```

---

## 🚀 Deployment Instructions

### Frontend Deployment (Vercel)

**Option A: Via Vercel Dashboard**

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repo
4. Vercel auto-detects Next.js ✅
5. Configure environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.railway.app
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   MONGODB_URI=mongodb+srv://...
   (all other env vars from .env.local)
   ```
6. Click "Deploy"

**Option B: Via Vercel CLI**

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Deploy to production
vercel --prod
```

**What happens:**
- ✅ Vercel deploys only Next.js app (root)
- ✅ Ignores `backend/` folder (due to `.vercelignore`)
- ✅ Your frontend is live!

---

### Backend Deployment (Railway)

**Recommended: Railway** (easiest for Node.js)

#### Step 1: Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub

#### Step 2: Deploy Backend

**Option A: Via Railway Dashboard**

1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your repository
4. **Important:** Set root directory to `backend`
5. Railway auto-detects Node.js ✅
6. Configure environment variables:
   ```
   NODE_ENV=production
   MONGODB_URI=mongodb+srv://...
   REDIS_URL=redis://...
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   AWS_S3_BUCKET_NAME=...
   CLERK_PUBLISHABLE_KEY=...
   CLERK_SECRET_KEY=...
   CORS_ORIGIN=https://your-frontend.vercel.app
   ```
7. Click "Deploy"

**Option B: Via Railway CLI**

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link project (from root directory)
railway init

# Deploy backend only
cd backend
railway up

# Add environment variables
railway variables set NODE_ENV=production
railway variables set MONGODB_URI=mongodb+srv://...
# ... add all other env vars
```

**What happens:**
- ✅ Railway deploys only `backend/` folder
- ✅ Runs `npm run build` and `npm start`
- ✅ Your backend is live!

---

### Alternative Backend Platforms

#### **AWS ECS/Fargate**
```bash
# Build Docker image
cd backend
docker build -t face-media-backend .

# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login ...
docker push your-account.dkr.ecr.us-east-1.amazonaws.com/face-media-backend

# Deploy with ECS
aws ecs create-service ...
```

#### **Render**
1. Go to [render.com](https://render.com)
2. New Web Service
3. Connect GitHub repo
4. Set root directory: `backend`
5. Build command: `npm install && npm run build`
6. Start command: `npm start`

#### **Heroku**
```bash
# Create Heroku app
heroku create face-media-backend

# Set buildpack
heroku buildpacks:set heroku/nodejs

# Configure
heroku config:set NODE_ENV=production
heroku config:set MONGODB_URI=...

# Deploy
git subtree push --prefix backend heroku main
```

---

## 🔗 Connect Frontend to Backend

### Update Frontend Environment Variables

**In Vercel Dashboard:**
```env
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

**Or in `.env.production`:**
```env
NEXT_PUBLIC_API_URL=https://your-backend.railway.app/api
```

### Update Backend CORS

**In Railway environment variables:**
```env
CORS_ORIGIN=https://your-frontend.vercel.app
```

This allows frontend to call backend API.

---

## 🔒 Security Checklist

Before deploying:

- [ ] All `.env` files are in `.gitignore`
- [ ] No secrets committed to Git
- [ ] CORS configured correctly
- [ ] MongoDB IP whitelist includes deployment IPs
- [ ] Clerk webhook secrets configured
- [ ] AWS credentials have minimal permissions
- [ ] Rate limiting enabled in production

---

## 📊 Deployment Architecture

```
┌─────────────────────────────────────────┐
│  Users                                   │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  Vercel (Frontend)                      │
│  https://your-app.vercel.app            │
│  - Next.js                               │
│  - Static assets                         │
│  - Server-side rendering                 │
└─────────────┬───────────────────────────┘
              │ API Calls
              ▼
┌─────────────────────────────────────────┐
│  Railway (Backend)                      │
│  https://your-backend.railway.app       │
│  - Express API                           │
│  - BullMQ workers                        │
│  - AWS S3/Rekognition                    │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  External Services                      │
│  - MongoDB Atlas (Database)             │
│  - Upstash Redis (Queue)                │
│  - AWS S3 (Storage)                     │
│  - AWS Rekognition (AI)                 │
│  - Clerk (Auth)                          │
└─────────────────────────────────────────┘
```

---

## 🧪 Testing Deployment

### Test Frontend
```bash
curl https://your-app.vercel.app
# Should return Next.js page
```

### Test Backend
```bash
# Health check
curl https://your-backend.railway.app/health
# Should return: {"status":"ok","timestamp":"..."}

# Test API (with auth token)
curl https://your-backend.railway.app/api/groups \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"
```

### Test Integration
```bash
# From frontend, call backend
# Check browser console for API calls
# Verify CORS works
```

---

## 🐛 Troubleshooting

### Frontend Issues

**"API calls failing"**
- Check `NEXT_PUBLIC_API_URL` is set correctly
- Verify backend is running
- Check browser console for CORS errors

**"Build failing"**
- Check all dependencies are in `package.json`
- Verify TypeScript compiles locally
- Check build logs in Vercel dashboard

### Backend Issues

**"Module not found"**
- Ensure `"type": "module"` in `backend/package.json`
- Check all imports use `.js` extensions
- Verify `tsconfig.json` has correct settings

**"MongoDB connection timeout"**
- Whitelist deployment IP in MongoDB Atlas
- Check connection string is correct
- Verify MongoDB cluster is running

**"CORS errors"**
- Set `CORS_ORIGIN` to frontend URL
- Include protocol (https://)
- No trailing slash

---

## 📝 Deployment Checklist

### Before First Deploy
- [ ] Create MongoDB Atlas cluster
- [ ] Create Upstash Redis instance
- [ ] Set up AWS S3 bucket
- [ ] Configure Clerk application
- [ ] Test locally with all services

### Frontend Deploy
- [ ] Push code to GitHub
- [ ] Connect Vercel to repo
- [ ] Set environment variables
- [ ] Deploy
- [ ] Test deployment

### Backend Deploy
- [ ] Choose platform (Railway/AWS/Render)
- [ ] Set root directory to `backend`
- [ ] Configure environment variables
- [ ] Deploy
- [ ] Test health endpoint
- [ ] Test API endpoints with auth

### Post-Deploy
- [ ] Update frontend API URL
- [ ] Update backend CORS origin
- [ ] Test end-to-end flow
- [ ] Monitor logs for errors
- [ ] Set up custom domains (optional)

---

## 💰 Estimated Costs

### Development (Free Tier)
- Vercel: Free
- Railway: $5/month (500MB RAM)
- MongoDB Atlas: Free (512MB)
- Upstash Redis: Free (10K commands/day)
- AWS S3: ~$1/month (1GB storage)
- Clerk: Free (10K MAU)

**Total: ~$6/month**

### Production (Scaled)
- Vercel: $20/month (Pro)
- Railway: $20/month (8GB RAM)
- MongoDB Atlas: $57/month (M10)
- Upstash Redis: $10/month (Pro)
- AWS S3: Variable (based on usage)
- AWS Rekognition: Pay per use
- Clerk: $25/month (Pro)

**Total: ~$130/month + AWS usage**

---

## 🎉 You're Ready to Deploy!

Your monorepo structure is properly configured:
- ✅ `.vercelignore` prevents backend deployment to Vercel
- ✅ `.gitignore` keeps secrets safe
- ✅ Both apps can deploy independently

**Next steps:**
1. Choose your deployment platforms
2. Set up environment variables
3. Deploy!

Good luck! 🚀
