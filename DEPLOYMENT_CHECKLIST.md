# 📋 AWS Deployment Checklist

Complete this checklist to ensure successful deployment.

## ✅ Pre-Deployment

### Local Testing
- [ ] Backend runs locally without errors
- [ ] Frontend runs locally without errors
- [ ] All features work end-to-end
- [ ] Environment variables documented
- [ ] Code committed to Git repository

### AWS Account Setup
- [ ] AWS account created and verified
- [ ] AWS CLI installed and configured
- [ ] EB CLI installed (`pip install awsebcli`)
- [ ] IAM user created with necessary permissions
- [ ] AWS credentials configured locally

### Third-Party Services
- [ ] Clerk account set up
- [ ] Clerk production keys obtained
- [ ] MongoDB Atlas account created
- [ ] MongoDB cluster created (M0 Free tier)

---

## 🗄️ Database & Storage

### MongoDB Atlas
- [ ] Cluster created in AWS us-east-1
- [ ] Database user created with password
- [ ] Network access allows Elastic Beanstalk IPs (or 0.0.0.0/0)
- [ ] Connection string obtained and tested
- [ ] Database name set: `face-media-sharing`

### AWS ElastiCache (Redis)
- [ ] Redis cluster created (cache.t3.micro)
- [ ] Security group allows inbound on port 6379
- [ ] Endpoint URL obtained
- [ ] Can connect from EC2 instance

### AWS S3
- [ ] S3 bucket created with unique name
- [ ] CORS policy configured
- [ ] Bucket is in same region as backend (us-east-1)
- [ ] IAM user has S3FullAccess policy

### AWS Rekognition
- [ ] IAM user has AmazonRekognitionFullAccess policy
- [ ] Service available in your region
- [ ] Test image processed successfully

---

## 🚀 Backend Deployment

### Elastic Beanstalk Setup
- [ ] EB environment created
- [ ] Node.js 18 platform selected
- [ ] Instance type: t3.small or larger
- [ ] Load balancer configured (optional for scaling)
- [ ] Auto-scaling settings configured

### Environment Variables Set
- [ ] NODE_ENV=production
- [ ] PORT=8080
- [ ] MONGODB_URI (from MongoDB Atlas)
- [ ] REDIS_HOST (from ElastiCache)
- [ ] REDIS_PORT=6379
- [ ] AWS_REGION=us-east-1
- [ ] AWS_ACCESS_KEY_ID
- [ ] AWS_SECRET_ACCESS_KEY
- [ ] S3_BUCKET
- [ ] REKOGNITION_COLLECTION_PREFIX
- [ ] CLERK_PUBLISHABLE_KEY
- [ ] CLERK_SECRET_KEY
- [ ] CORS_ORIGIN (frontend URL)
- [ ] API_PREFIX=/api

### Deployment
- [ ] TypeScript compiled successfully (`npm run build`)
- [ ] Deployment successful (`eb deploy`)
- [ ] Health check passing
- [ ] Backend URL accessible
- [ ] `/api/health` endpoint responds

### Backend Testing
- [ ] Can connect to MongoDB
- [ ] Can connect to Redis
- [ ] Can upload to S3
- [ ] Rekognition API works
- [ ] Clerk authentication works

---

## 🌐 Frontend Deployment

### AWS Amplify Setup
- [ ] GitHub repository connected
- [ ] Build settings configured
- [ ] Environment variables added
- [ ] Automatic deployments enabled

### Frontend Environment Variables
- [ ] NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
- [ ] CLERK_SECRET_KEY
- [ ] NEXT_PUBLIC_API_URL (backend URL + /api)

### Deployment
- [ ] Initial build successful
- [ ] Site is accessible
- [ ] All pages load correctly
- [ ] Static assets load (images, CSS, JS)

### Frontend Testing
- [ ] Homepage loads
- [ ] Sign up/login works
- [ ] Dashboard displays
- [ ] Can create groups
- [ ] Can upload photos
- [ ] Face detection triggers
- [ ] Face clusters display

---

## 🔐 Security & Configuration

### Clerk Configuration
- [ ] Production instance created
- [ ] Frontend domain added to allowed origins
- [ ] Backend domain added to allowed origins
- [ ] JWT template configured
- [ ] Social login providers configured (optional)

### CORS Configuration
- [ ] Backend CORS_ORIGIN set to frontend URL
- [ ] S3 bucket CORS allows frontend domain
- [ ] No wildcard (*) in production (optional)

### Security Groups
- [ ] Elastic Beanstalk EC2 can access ElastiCache
- [ ] Elastic Beanstalk EC2 can access MongoDB Atlas
- [ ] Frontend can access backend API
- [ ] Backend can access S3 and Rekognition

---

## 📊 Monitoring & Maintenance

### CloudWatch
- [ ] Backend logs available in CloudWatch
- [ ] Set up log groups for application logs
- [ ] Create alarms for errors (optional)
- [ ] Set up billing alerts

### Application Monitoring
- [ ] Can view EB logs with `eb logs`
- [ ] Can view Amplify build logs
- [ ] Health dashboard shows green
- [ ] Error tracking configured (Sentry - optional)

### Backups
- [ ] MongoDB Atlas automatic backups enabled
- [ ] S3 versioning enabled (optional)
- [ ] Database backup schedule created

---

## 🎯 Post-Deployment

### End-to-End Testing
- [ ] User can sign up
- [ ] User can create a group
- [ ] User can upload photos
- [ ] Face detection processes
- [ ] Face clusters appear
- [ ] User can view face clusters
- [ ] User can name clusters
- [ ] User can delete photos
- [ ] Storage management works
- [ ] Member management works

### Performance
- [ ] Page load time < 3 seconds
- [ ] API response time < 500ms
- [ ] Images load efficiently
- [ ] No console errors in browser
- [ ] No errors in backend logs

### Documentation
- [ ] Production URLs documented
- [ ] Environment variables documented
- [ ] Deployment process documented
- [ ] Recovery procedures documented

---

## 🌟 Optional Enhancements

- [ ] Custom domain configured (Route 53)
- [ ] SSL certificate added (ACM)
- [ ] CDN enabled for static assets (CloudFront)
- [ ] Database indexes optimized
- [ ] Caching strategy implemented
- [ ] Rate limiting added
- [ ] Email notifications configured
- [ ] Analytics added (Google Analytics)
- [ ] SEO optimization completed

---

## 🆘 Rollback Plan

In case of issues:

```bash
# Rollback backend to previous version
cd backend
eb deploy --version PREVIOUS_VERSION

# Rollback frontend (Amplify)
# Use Amplify Console to redeploy previous build

# Check backend health
eb health

# View recent logs
eb logs --stream
```

---

## 📞 Support Contacts

- AWS Support: https://console.aws.amazon.com/support
- Clerk Support: https://clerk.com/support
- MongoDB Atlas: https://www.mongodb.com/support

---

## ✅ Deployment Complete!

Once all items are checked:

**Frontend URL**: _______________________________

**Backend URL**: _______________________________

**MongoDB URL**: _______________________________

**Deployed by**: _____________ **Date**: _______

---

## 🎉 Congratulations!

Your Face Media Sharing app is now live on AWS!

Next steps:
1. Share the URL with users
2. Monitor usage and performance
3. Gather feedback
4. Plan next features
