# Backend Integration Guide

## ✅ Backend is Connected and Running!

### Status
- 🟢 Backend Server: **RUNNING** on http://localhost:3001
- 🟢 MongoDB: **CONNECTED**
- 🟢 API Endpoint: http://localhost:3001/api
- 🟢 Health Check: http://localhost:3001/health

---

## What's Been Set Up

### 1. Environment Variables ✅
**Frontend (`.env.local`):**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

**Backend (`backend/.env`):**
```env
PORT=3001
MONGODB_URI=mongodb+srv://...
CLERK_SECRET_KEY=sk_test_...
AWS_ACCESS_KEY_ID=...
(all credentials configured)
```

### 2. API Client Created ✅
**Location:** `lib/api/client.ts`

Features:
- ✅ Automatic Clerk authentication
- ✅ Error handling
- ✅ TypeScript types
- ✅ File upload support

**Usage:**
```typescript
import { api } from '@/lib/api/client';

// GET request
const data = await api.get('/groups');

// POST request
const group = await api.post('/groups', { name: 'My Group' });

// File upload
const formData = new FormData();
formData.append('file', file);
const result = await api.upload('/groups/123/upload', formData);
```

### 3. Groups API Functions ✅
**Location:** `lib/api/groups.ts`

Available functions:
```typescript
import { groupsApi } from '@/lib/api/groups';

// Create group
const group = await groupsApi.create({
  name: 'Family Photos',
  description: 'Our family memories'
});

// Join group
const joined = await groupsApi.join('ABC12345');

// List groups
const { data, pagination } = await groupsApi.list(1, 10);

// Get group by ID
const group = await groupsApi.getById('group-id');
```

---

## How to Use in Your Components

### Server Components (Recommended)
```typescript
// app/dashboard/page.tsx
import { groupsApi } from '@/lib/api/groups';

export default async function DashboardPage() {
  const { data: groups } = await groupsApi.list();

  return (
    <div>
      {groups.map(group => (
        <div key={group.id}>{group.name}</div>
      ))}
    </div>
  );
}
```

### Client Components
```typescript
'use client';

import { useState, useEffect } from 'react';
import { groupsApi } from '@/lib/api/groups';

export function GroupList() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGroups() {
      try {
        const { data } = await groupsApi.list();
        setGroups(data);
      } catch (error) {
        console.error('Failed to load groups:', error);
      } finally {
        setLoading(false);
      }
    }

    loadGroups();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {groups.map(group => (
        <div key={group.id}>{group.name}</div>
      ))}
    </div>
  );
}
```

### With React Query (Recommended for Client Components)
```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { groupsApi } from '@/lib/api/groups';

export function GroupList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupsApi.list(),
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading groups</div>;

  return (
    <div>
      {data?.data.map(group => (
        <div key={group.id}>{group.name}</div>
      ))}
    </div>
  );
}
```

---

## Testing the Connection

### 1. Test Health Endpoint
```bash
curl http://localhost:3001/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-02T02:44:57.712Z",
  "environment": "development"
}
```

### 2. Test API with Auth
```bash
# Get auth token from Clerk (in browser console)
const token = await window.Clerk.session.getToken();

# Test API
curl http://localhost:3001/api/groups \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 3. Test from Frontend
Create a test page: `app/test-backend/page.tsx`

```typescript
import { groupsApi } from '@/lib/api/groups';

export default async function TestPage() {
  try {
    const { data: groups } = await groupsApi.list();

    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Backend Connection Test</h1>
        <div className="bg-green-100 p-4 rounded">
          ✅ Backend Connected!
        </div>
        <div className="mt-4">
          <h2 className="font-bold">Groups:</h2>
          <pre>{JSON.stringify(groups, null, 2)}</pre>
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div className="p-8">
        <div className="bg-red-100 p-4 rounded">
          ❌ Backend Connection Failed
        </div>
        <pre className="mt-4">{JSON.stringify(error, null, 2)}</pre>
      </div>
    );
  }
}
```

Visit: http://localhost:3000/test-backend

---

## Migration Guide

### Replace Next.js API Routes with Backend Calls

**Before (Next.js API Routes):**
```typescript
// app/api/groups/route.ts
export async function POST(req: Request) {
  // ... code
}

// Frontend usage
const response = await fetch('/api/groups', {
  method: 'POST',
  body: JSON.stringify(data)
});
```

**After (Backend API):**
```typescript
// Delete app/api/groups/route.ts

// Frontend usage
import { groupsApi } from '@/lib/api/groups';
const group = await groupsApi.create(data);
```

### Update Existing Components

**Example: Update group creation form**

**Before:**
```typescript
const response = await fetch('/api/groups', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, description }),
});
```

**After:**
```typescript
import { groupsApi } from '@/lib/api/groups';

const group = await groupsApi.create({ name, description });
```

---

## Available Backend Endpoints

### Groups
- `POST /api/groups` - Create group
- `POST /api/groups/join` - Join group
- `GET /api/groups` - List groups
- `GET /api/groups/:id` - Get group

### Coming Soon (Need to implement)
- `POST /api/groups/:id/upload` - Upload media
- `GET /api/groups/:id/media` - List media
- `GET /api/groups/:id/clusters` - List face clusters
- `GET /api/clusters/:id/media` - Get cluster media
- `PUT /api/clusters/:id` - Update cluster name
- `DELETE /api/media/:id` - Delete media

---

## Error Handling

### API Errors
```typescript
import { ApiError } from '@/lib/api/client';

try {
  await groupsApi.create({ name: 'Test' });
} catch (error) {
  if (error instanceof ApiError) {
    console.log('Status:', error.status);
    console.log('Message:', error.message);
    console.log('Data:', error.data);

    if (error.status === 401) {
      // Redirect to login
    } else if (error.status === 403) {
      // Show permission denied
    }
  }
}
```

### Global Error Handler (Recommended)
```typescript
// lib/api/errorHandler.ts
export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 401:
        window.location.href = '/sign-in';
        break;
      case 403:
        toast.error('Permission denied');
        break;
      case 404:
        toast.error('Not found');
        break;
      case 500:
        toast.error('Server error. Please try again.');
        break;
      default:
        toast.error(error.message);
    }
  } else {
    toast.error('An unexpected error occurred');
  }
}
```

---

## Development Workflow

### Starting Both Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
# Server running on http://localhost:3001
```

**Terminal 2 - Frontend:**
```bash
npm run dev
# Frontend running on http://localhost:3000
```

### Making Changes

**Backend Changes:**
1. Edit `backend/src/**/*.ts`
2. Server auto-restarts (tsx watch)
3. Test changes immediately

**Frontend Changes:**
1. Edit components/pages
2. Next.js auto-reloads
3. Test changes immediately

---

## Deployment

### Production Environment Variables

**Frontend (.env.production):**
```env
NEXT_PUBLIC_API_URL=https://your-backend.railway.app/api
```

**Backend (Railway/Production):**
```env
NODE_ENV=production
CORS_ORIGIN=https://your-frontend.vercel.app
```

---

## Troubleshooting

### Backend won't start
```bash
# Check if port 3001 is in use
lsof -i :3001

# Kill the process
kill -9 PID

# Or change port in backend/.env
PORT=3002
```

### CORS errors
- Verify `CORS_ORIGIN` in `backend/.env` matches your frontend URL
- Check browser console for specific error
- Ensure both servers are running

### 401 Unauthorized
- Verify Clerk is configured correctly
- Check if user is signed in
- Verify `CLERK_SECRET_KEY` in backend/.env

### MongoDB connection failed
- Check `MONGODB_URI` in backend/.env
- Verify IP whitelist in MongoDB Atlas
- Check network connectivity

---

## Next Steps

1. ✅ Backend is running
2. ✅ API client created
3. ✅ Groups API implemented
4. ⏳ **Create test page** to verify connection
5. ⏳ **Update existing components** to use backend API
6. ⏳ **Implement media upload** endpoint
7. ⏳ **Implement face clustering** endpoints

---

## 🎉 Success!

Your frontend and backend are now connected! You can start replacing Next.js API routes with backend API calls.

**Test it:** Visit http://localhost:3000/test-backend (after creating the test page)
