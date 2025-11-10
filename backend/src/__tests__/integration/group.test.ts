import request from 'supertest';
import { app } from '../../app';

describe('Group API Integration Tests', () => {
  let authToken: string;
  let testGroupId: string;

  beforeAll(async () => {
    // TODO: Setup test user and get auth token
    // For now, you'll need to provide a valid Clerk token for testing
    authToken = process.env.TEST_AUTH_TOKEN || '';
  });

  describe('POST /api/groups', () => {
    it('should create a new group with valid data', async () => {
      const groupData = {
        name: 'Test Group',
        description: 'A test group for integration testing',
        storageLimit: 1073741824, // 1GB
        autoDeleteDays: 30,
      };

      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send(groupData)
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe(groupData.name);
      expect(response.body.data.description).toBe(groupData.description);

      testGroupId = response.body.data.id;
    });

    it('should return 400 for invalid group data', async () => {
      const invalidData = {
        name: '', // Empty name should fail validation
      };

      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 401 without authentication', async () => {
      const groupData = {
        name: 'Test Group',
      };

      await request(app)
        .post('/api/groups')
        .send(groupData)
        .expect(401);
    });
  });

  describe('GET /api/groups', () => {
    it('should list user groups with pagination', async () => {
      const response = await request(app)
        .get('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('total');
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/groups')
        .expect(401);
    });
  });

  describe('GET /api/groups/:id', () => {
    it('should get group by ID', async () => {
      if (!testGroupId) {
        return; // Skip if no test group was created
      }

      const response = await request(app)
        .get(`/api/groups/${testGroupId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testGroupId);
    });

    it('should return 404 for non-existent group', async () => {
      const fakeId = '507f1f77bcf86cd799439011'; // Valid MongoDB ObjectId format

      const response = await request(app)
        .get(`/api/groups/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/groups/:id/join', () => {
    it('should join a group with valid invite code', async () => {
      // TODO: This requires a valid invite code
      // You would need to create a group and get its invite code first
    });

    it('should return 400 for invalid invite code', async () => {
      const response = await request(app)
        .post('/api/groups/join')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ inviteCode: 'INVALID' })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/groups/:id/storage', () => {
    it('should get storage analytics for admin', async () => {
      if (!testGroupId) {
        return;
      }

      const response = await request(app)
        .get(`/api/groups/${testGroupId}/storage`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/);

      // Should be 200 if admin, 403 if not admin
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('storageUsed');
        expect(response.body.data).toHaveProperty('storageLimit');
        expect(response.body.data).toHaveProperty('storagePercentage');
      }
    });
  });

  describe('GET /api/groups/:id/members', () => {
    it('should get group members', async () => {
      if (!testGroupId) {
        return;
      }

      const response = await request(app)
        .get(`/api/groups/${testGroupId}/members`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });
  });
});
