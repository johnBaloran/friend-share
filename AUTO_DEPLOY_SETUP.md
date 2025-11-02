# 🚀 Auto-Deploy Setup Guide

Set up automatic deployment from Git for both frontend and backend!

## 🎯 What You'll Get

- **Push to GitHub** → **Auto-deploy Backend & Frontend**
- No manual commands needed
- Runs tests before deploying
- Deploys only changed code (backend or frontend)
- Deployment notifications
- Rollback capability

---

## 📋 Option 1: GitHub Actions (Recommended)

### Why GitHub Actions?
- ✅ Free for public repos, 2000 min/month for private
- ✅ Easy to set up (5 minutes)
- ✅ Integrated with GitHub
- ✅ Great for small-medium projects

### Setup Steps

#### Step 1: Add GitHub Secrets (2 minutes)

1. Go to your GitHub repository
2. **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add these secrets:

**Backend Secrets:**
```
AWS_ACCESS_KEY_ID = Your AWS access key
AWS_SECRET_ACCESS_KEY = Your AWS secret key
```

**Frontend Secrets:**
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = pk_live_xxxxx
CLERK_SECRET_KEY = sk_live_xxxxx
NEXT_PUBLIC_API_URL = http://your-backend-url.com/api
```

**Optional:**
```
SLACK_WEBHOOK = https://hooks.slack.com/xxxxx (for notifications)
```

#### Step 2: Verify Workflow Files (Already Done!)

These files are already created:
- `.github/workflows/deploy-backend.yml` ✅
- `.github/workflows/deploy-frontend.yml` ✅

#### Step 3: Test Auto-Deploy

```bash
# Make a change to backend
echo "# Test change" >> backend/README.md

# Commit and push
git add .
git commit -m "test: trigger backend auto-deploy"
git push origin main

# Watch deployment
# Go to: https://github.com/YOUR_USERNAME/YOUR_REPO/actions
```

**That's it!** Your backend will auto-deploy to Elastic Beanstalk!

---

## 📋 Option 2: AWS CodePipeline (Enterprise)

### Why CodePipeline?
- ✅ Native AWS solution
- ✅ Better for large teams
- ✅ Advanced deployment strategies
- ✅ Integrated with AWS services

### Setup Steps

#### Step 1: Create CodePipeline for Backend

```bash
# Create buildspec.yml for CodeBuild
cat > backend/buildspec.yml << 'EOF'
version: 0.2

phases:
  pre_build:
    commands:
      - echo Installing dependencies...
      - cd backend
      - npm ci
  build:
    commands:
      - echo Building application...
      - npm run build
      - echo Build completed on `date`
  post_build:
    commands:
      - echo Creating deployment package...

artifacts:
  files:
    - backend/dist/**/*
    - backend/package*.json
    - backend/.ebextensions/**/*
  name: BackendBuild

cache:
  paths:
    - 'backend/node_modules/**/*'
EOF
```

#### Step 2: Create Pipeline via AWS Console

1. Go to **AWS CodePipeline** Console
2. **Create Pipeline**
3. **Pipeline settings:**
   - Name: `face-media-backend-pipeline`
   - Service role: Create new
4. **Source:**
   - Source provider: GitHub (Version 2)
   - Connect to GitHub
   - Repository: your-repo
   - Branch: main
   - Trigger: Push events
5. **Build:**
   - Build provider: AWS CodeBuild
   - Create build project
   - Environment: Ubuntu Standard 5.0
   - Buildspec: `backend/buildspec.yml`
6. **Deploy:**
   - Deploy provider: AWS Elastic Beanstalk
   - Application name: face-media-backend
   - Environment: face-media-prod

#### Step 3: Test Pipeline

```bash
git push origin main
# Watch in CodePipeline console
```

---

## 🔄 How Auto-Deploy Works

### GitHub Actions Flow

```
┌─────────────────────────────────────────────────┐
│  1. You push code to GitHub                     │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  2. GitHub Actions detects changes              │
│     - Backend changed? Run backend workflow     │
│     - Frontend changed? Run frontend workflow   │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  3. Run Tests                                   │
│     - Install dependencies                      │
│     - Run linter                                │
│     - Run tests                                 │
│     - Build application                         │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  4. Deploy to AWS                               │
│     - Create deployment package                 │
│     - Upload to Elastic Beanstalk               │
│     - Wait for deployment                       │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  5. Notify                                      │
│     ✅ Deployment successful!                   │
│     or                                          │
│     ❌ Deployment failed (with logs)            │
└─────────────────────────────────────────────────┘
```

---

## 🎛️ Workflow Features

### Smart Deployments

**Backend workflow only runs when:**
- Files in `backend/` change
- Workflow file changes
- Manual trigger

**Frontend workflow only runs when:**
- Files in `app/`, `components/`, `lib/` change
- Workflow file changes
- Manual trigger

### Manual Deployment

You can also trigger deployments manually:

1. Go to **Actions** tab in GitHub
2. Select workflow (Backend or Frontend)
3. Click **Run workflow**
4. Choose branch
5. Click **Run workflow**

---

## 📊 Monitoring Deployments

### GitHub Actions

1. Go to repository → **Actions** tab
2. See all workflow runs
3. Click on a run to see details
4. View logs, artifacts, deployment status

### AWS Elastic Beanstalk

```bash
# Check current version
eb status

# View recent deployments
eb logs

# Stream logs
eb logs --stream
```

---

## 🔄 Rollback

### Option 1: Via GitHub Actions

```bash
# Revert to previous commit
git revert HEAD
git push origin main
# Auto-deploys previous version
```

### Option 2: Via EB Console

1. Go to Elastic Beanstalk Console
2. Select environment
3. Click **Application versions**
4. Select previous version
5. Click **Deploy**

### Option 3: Via EB CLI

```bash
# List versions
eb appversion lifecycle

# Deploy specific version
eb deploy --version v20240101_120000
```

---

## 🚨 Troubleshooting

### Deployment Fails

**Check GitHub Actions logs:**
1. Go to Actions tab
2. Click failed workflow
3. Expand failed step
4. Read error message

**Common issues:**

**1. AWS Credentials Invalid**
```
Error: Invalid AWS credentials
```
Solution: Update GitHub secrets with correct credentials

**2. Build Failed**
```
Error: npm run build failed
```
Solution: Fix TypeScript/build errors locally first

**3. EB Environment Not Found**
```
Error: Environment 'face-media-prod' not found
```
Solution: Create EB environment first: `eb create face-media-prod`

**4. Insufficient Permissions**
```
Error: Access Denied
```
Solution: Ensure IAM user has ElasticBeanstalk permissions

### Deployment Succeeds but App Doesn't Work

**Check environment variables:**
```bash
eb printenv
# Ensure all variables are set correctly
```

**Check application logs:**
```bash
eb logs
# Look for runtime errors
```

---

## ⚙️ Advanced Configuration

### Add Environment-Specific Deployments

Create multiple workflows for different environments:

```
.github/workflows/
  ├── deploy-backend-dev.yml    # Deploys to dev
  ├── deploy-backend-staging.yml # Deploys to staging
  └── deploy-backend-prod.yml    # Deploys to production
```

### Add Tests to Workflow

Update workflow to run tests:

```yaml
- name: Run unit tests
  run: npm test

- name: Run integration tests
  run: npm run test:integration

# Only deploy if tests pass
```

### Add Slack Notifications

Already included! Just add `SLACK_WEBHOOK` secret:

```bash
# Get webhook from Slack
# Settings → Incoming Webhooks → Add to GitHub secrets
```

### Add Deployment Approvals

For production, require manual approval:

```yaml
jobs:
  deploy:
    environment:
      name: production
      url: https://your-app.com
    # Requires approval in GitHub settings
```

---

## 🎯 Best Practices

### 1. Branch Protection

Protect `main` branch:
- Require pull request reviews
- Require status checks to pass
- Auto-deploy only from main

### 2. Semantic Versioning

Use version tags:
```bash
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

### 3. Deployment Frequency

- **Development**: Every commit
- **Staging**: Daily
- **Production**: Weekly or on-demand

### 4. Monitoring

Set up CloudWatch alarms:
- CPU usage > 80%
- Error rate > 5%
- Response time > 2s

---

## 📈 Deployment Metrics

Track these in GitHub Actions:
- ✅ Deployment success rate
- ⏱️ Deployment duration
- 🔄 Deployment frequency
- 🐛 Failed deployments

View in: **Insights** → **Actions** tab

---

## 🎉 You're Ready!

Your application now has:
- ✅ Auto-deploy from Git
- ✅ Automated testing
- ✅ Build verification
- ✅ Deployment notifications
- ✅ Easy rollback

### Next Steps:

1. **Push code** to test auto-deploy:
   ```bash
   git add .
   git commit -m "feat: setup auto-deploy"
   git push origin main
   ```

2. **Watch deployment** in GitHub Actions

3. **Verify** application is running

4. **Celebrate!** 🎊

---

## 📚 Resources

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [AWS CodePipeline Docs](https://docs.aws.amazon.com/codepipeline/)
- [Elastic Beanstalk CLI](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/eb-cli3.html)
- [AWS Amplify CI/CD](https://docs.aws.amazon.com/amplify/latest/userguide/build-settings.html)
