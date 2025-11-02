# 🔔 Clerk Webhook Setup Guide

This guide will help you configure Clerk webhooks to automatically sync users to your database.

## 📋 What You'll Achieve

- ✅ Automatic user creation when someone signs up
- ✅ Automatic user updates when profile changes
- ✅ Real-time sync without API latency
- ✅ Secure webhook verification using Svix

---

## 🚀 Setup Steps

### Step 1: Get Your Webhook Secret from Clerk

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your application
3. Navigate to **Webhooks** in the sidebar
4. Click **Add Endpoint**
5. Enter your webhook URL:
   ```
   https://your-backend-url.com/api/webhooks/clerk
   ```

   For local development:
   ```
   http://localhost:3001/api/webhooks/clerk
   ```

6. Select the events to subscribe to:
   - ✅ `user.created`
   - ✅ `user.updated`
   - ✅ `user.deleted`

7. Click **Create**

8. Copy the **Signing Secret** (starts with `whsec_...`)

### Step 2: Add Webhook Secret to Environment Variables

Add the webhook secret to your backend `.env` file:

```bash
# In backend/.env
CLERK_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### Step 3: Test the Webhook (Local Development)

For local development, you need to expose your localhost to the internet using a tunneling service.

#### Option 1: Using ngrok (Recommended)

```bash
# Install ngrok
npm install -g ngrok

# Start your backend server
cd backend
npm run dev

# In a new terminal, create tunnel
ngrok http 3001
```

You'll get a URL like: `https://abc123.ngrok.io`

Update your Clerk webhook endpoint to:
```
https://abc123.ngrok.io/api/webhooks/clerk
```

#### Option 2: Using Clerk's Built-in Testing

1. In Clerk Dashboard → Webhooks → Select your endpoint
2. Click **Testing** tab
3. Click **Send Example** to test events

### Step 4: Verify Webhook is Working

1. Sign up a new user in your frontend
2. Check your backend logs - you should see:
   ```
   📨 Webhook received: user.created
   ✅ Creating user: user_xxxxx
   ```

3. Check your MongoDB database - the user should be created in the `users` collection

---

## 🔍 How It Works

### Webhook Flow

```
┌─────────────────────────────────────────────────┐
│  User signs up in frontend                      │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Clerk creates user account                     │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Clerk sends webhook to your backend            │
│  POST /api/webhooks/clerk                       │
│  {                                              │
│    type: "user.created",                        │
│    data: { id, email, name, ... }               │
│  }                                              │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Backend verifies webhook signature (Svix)      │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Backend creates user in MongoDB                │
│  {                                              │
│    clerkId: "user_xxxxx",                       │
│    email: "user@example.com",                   │
│    name: "John Doe"                             │
│  }                                              │
└─────────────────────────────────────────────────┘
```

### Events Handled

**1. user.created**
- New user signs up
- Backend creates user record in MongoDB
- User is now available for group member population

**2. user.updated**
- User changes name, email, or avatar
- Backend updates user record in MongoDB
- Changes reflect immediately in group member lists

**3. user.deleted**
- User deletes their account
- Backend logs the event
- (You may want to implement cleanup logic here)

---

## 🔐 Security

### Webhook Signature Verification

All webhooks are verified using Svix signatures:

```typescript
// Automatically handled by ClerkService
const webhook = new Webhook(CLERK_WEBHOOK_SECRET);
webhook.verify(payload, headers);
```

**What this does:**
- ✅ Prevents unauthorized webhook calls
- ✅ Ensures webhooks come from Clerk
- ✅ Protects against replay attacks
- ✅ Validates payload integrity

### Required Headers

Clerk sends these headers with every webhook:
- `svix-id` - Unique message ID
- `svix-timestamp` - Timestamp of the message
- `svix-signature` - HMAC signature

If any header is missing, the webhook is rejected with `400 Bad Request`.

---

## 📊 Monitoring Webhooks

### Check Webhook Logs in Clerk Dashboard

1. Go to Clerk Dashboard → Webhooks
2. Click on your endpoint
3. View **Recent Deliveries**
4. See status codes, response times, payloads

### Check Backend Logs

Your backend logs webhook events:

```
📨 Webhook received: user.created
✅ Creating user: user_2abc123def456
```

Or if there's an error:
```
❌ Webhook signature verification failed
```

---

## 🚨 Troubleshooting

### Webhook Returns 401 Unauthorized

**Problem:** Webhook signature verification failed

**Solutions:**
1. Check that `CLERK_WEBHOOK_SECRET` is set correctly in `.env`
2. Make sure the secret starts with `whsec_`
3. Verify you copied the entire secret from Clerk Dashboard
4. Restart your backend server after changing `.env`

### Webhook Returns 400 Bad Request

**Problem:** Missing Svix headers

**Solutions:**
1. Make sure you're using the webhook URL from Clerk, not calling it manually
2. Check that the webhook is coming from Clerk's servers
3. Verify the endpoint URL is correct in Clerk Dashboard

### Webhook Not Receiving Events

**Problem:** No webhook calls being made

**Solutions:**
1. Check the webhook URL in Clerk Dashboard is correct
2. For local dev, make sure ngrok tunnel is running
3. Verify the events (`user.created`, etc.) are enabled in Clerk
4. Test using Clerk's "Send Example" button

### User Not Created in Database

**Problem:** Webhook received but user not created

**Solutions:**
1. Check backend logs for errors
2. Verify MongoDB connection is working
3. Check that `UserRepository` is properly initialized
4. Ensure `ClerkService` is registered in DI container

---

## 🎯 Testing Checklist

- [ ] Webhook endpoint added in Clerk Dashboard
- [ ] `CLERK_WEBHOOK_SECRET` set in backend `.env`
- [ ] Backend server restarted after adding secret
- [ ] Test webhook using Clerk's "Send Example"
- [ ] Sign up a new user and verify webhook is received
- [ ] Check MongoDB - user should be created
- [ ] Update user profile and verify webhook is received
- [ ] Check MongoDB - user should be updated

---

## 🌐 Production Deployment

### AWS Elastic Beanstalk

Your webhook URL will be:
```
https://your-eb-environment.us-east-1.elasticbeanstalk.com/api/webhooks/clerk
```

### AWS Amplify (Frontend) + Elastic Beanstalk (Backend)

Make sure to:
1. Update Clerk webhook endpoint to production backend URL
2. Add `CLERK_WEBHOOK_SECRET` to Elastic Beanstalk environment variables:
   ```bash
   eb setenv CLERK_WEBHOOK_SECRET=whsec_your_secret
   ```

---

## 📚 Additional Resources

- [Clerk Webhooks Documentation](https://clerk.com/docs/integrations/webhooks/overview)
- [Svix Webhook Verification](https://docs.svix.com/receiving/verifying-payloads/how)
- [ngrok Documentation](https://ngrok.com/docs)

---

## ✅ You're All Set!

Your webhook is now configured and ready to sync users automatically!

**What happens now:**
- New users automatically sync to your database
- Profile updates sync in real-time
- No manual user management needed
- Group members display with correct names and emails

🎉 Enjoy automatic user synchronization!
