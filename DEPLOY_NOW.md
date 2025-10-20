# 🚀 Deploy NOW - Fastest Path to Production

## Simplest Deployment (5 Steps, ~20 minutes)

### Step 1: Deploy Web App to Vercel (5 min)

```bash
# Install Vercel CLI
npm i -g vercel

# Login and deploy
vercel login
vercel

# Follow prompts (use defaults)
```

**Add environment variables in Vercel Dashboard:**
1. Go to https://vercel.com/dashboard
2. Your project → Settings → Environment Variables
3. Copy ALL variables from your `.env.local`
4. Click "Deploy" to redeploy

### Step 2: Deploy Worker to Railway (5 min)

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

**Add environment variables in Railway Dashboard:**
1. Go to https://railway.app/dashboard
2. Your project → Variables
3. Copy ALL variables from your `.env.local`
4. Change start command to: `npm run worker`

### Step 3: Update Clerk URLs (2 min)

1. Go to https://dashboard.clerk.com
2. Your application → Settings → URLs
3. Add your Vercel URL: `https://your-app.vercel.app`

### Step 4: Test (5 min)

1. Visit your Vercel URL
2. Create a group
3. Upload images
4. Check Railway logs for worker activity
5. Wait 1-2 minutes
6. See grouped faces!

### Step 5: Done! 🎉

You're live! Share your URL.

---

## Alternative: All-in-One Railway (10 min)

Deploy BOTH web app and worker on Railway:

```bash
railway login
railway init
```

**Create TWO services:**

**Service 1 - Web:**
- Name: `web`
- Start command: `npm run start`
- Build command: `npm install && npm run build`
- Enable public networking
- Add ALL env variables

**Service 2 - Worker:**
- Name: `worker`
- Start command: `npm run worker`
- Build command: `npm install`
- Add ALL env variables (same as web)

Done! Railway gives you a URL for the web service.

---

## Cost Breakdown

### Vercel + Railway (Recommended)
- Vercel Free: $0/month (hobby projects)
- Railway: $5/month (worker)
- **Total: $5/month**

### All Railway
- Railway: ~$10/month (both services)
- **Total: $10/month**

### Plus External Services (Already Set Up)
- Upstash Redis: Free tier
- MongoDB Atlas: Free tier
- Clerk: Free tier
- AWS: Pay per use (~$1-5/month)

---

## ⚠️ Before You Deploy

Make sure you have:
- ✅ Real AWS credentials (not placeholders!)
- ✅ S3 bucket created
- ✅ All services working locally
- ✅ Code committed to GitHub
- ✅ `.env.local` ready to copy

---

## 🆘 Quick Troubleshooting

### "Build failed"
- Check `package.json` scripts
- Ensure all dependencies installed
- Check Node version (use 18 or 20)

### "Environment variable not found"
- Copy ALL vars from `.env.local`
- Redeploy after adding variables

### "Worker not processing"
- Check Railway worker logs
- Verify Redis URL
- Ensure worker service is running

---

## 📞 Quick Links

- Vercel: https://vercel.com
- Railway: https://railway.app
- Clerk Dashboard: https://dashboard.clerk.com
- AWS Console: https://console.aws.amazon.com
- Upstash: https://console.upstash.com

---

## 🎯 My Recommendation

**For You:** Use **Vercel (web) + Railway (worker)**

**Why?**
- ✅ Vercel = Best Next.js hosting
- ✅ Railway = Easy worker deployment
- ✅ Both have great free/cheap tiers
- ✅ Simple setup
- ✅ Good developer experience

**Total cost: $5/month** 🎉

---

**Ready? Start with Step 1 above! 🚀**
