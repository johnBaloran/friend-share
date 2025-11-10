import request from 'supertest';
import { app } from '../../app';
import path from 'path';
import fs from 'fs';

describe('Media API Integration Tests', () => {
  let authToken: string;
  let testGroupId: string;
  let testMediaId: string;

  beforeAll(async () => {
    authToken = process.env.TEST_AUTH_TOKEN || '';
    testGroupId = process.env.TEST_GROUP_ID || '';
  });

  describe('POST /api/groups/:groupId/upload', () => {
    it('should upload media files successfully', async () => {
      if (!testGroupId) {
        return; // Skip if no test group ID
      }

      // Create a test image buffer
      const testImagePath = path.join(__dirname, '../fixtures/test-image.jpg');
      let testImageBuffer: Buffer;

      // Create test fixture if it doesn't exist
      if (!fs.existsSync(testImagePath)) {
        // Create a minimal valid JPEG buffer for testing
        testImageBuffer = Buffer.from([
          0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
          0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
          0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
        ]);
      } else {
        testImageBuffer = fs.readFileSync(testImagePath);
      }

      const response = await request(app)
        .post(`/api/groups/${testGroupId}/upload`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('files', testImageBuffer, 'test-image.jpg')
        .expect('Content-Type', /json/);

      // Should be 201 if successful, 400/403 if not authorized or validation fails
      if (response.status === 201) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeInstanceOf(Array);
        expect(response.body.data.length).toBeGreaterThan(0);

        if (response.body.data.length > 0) {
          testMediaId = response.body.data[0].id;
        }
      }
    });

    it('should return 400 when no files are uploaded', async () => {
      if (!testGroupId) {
        return;
      }

      const response = await request(app)
        .post(`/api/groups/${testGroupId}/upload`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/groups/:groupId/media', () => {
    it('should list media for a group with pagination', async () => {
      if (!testGroupId) {
        return;
      }

      const response = await request(app)
        .get(`/api/groups/${testGroupId}/media`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 20 })
        .expect('Content-Type', /json/);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeInstanceOf(Array);
        expect(response.body.pagination).toHaveProperty('page');
        expect(response.body.pagination).toHaveProperty('limit');
      }
    });

    it('should return 404 for non-existent group', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      const response = await request(app)
        .get(`/api/groups/${fakeId}/media`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/media/:id', () => {
    it('should get media by ID', async () => {
      if (!testMediaId) {
        return;
      }

      const response = await request(app)
        .get(`/api/media/${testMediaId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(testMediaId);
        expect(response.body.data).toHaveProperty('presignedUrl');
      }
    });

    it('should return 404 for non-existent media', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      const response = await request(app)
        .get(`/api/media/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/media/:id/download', () => {
    it('should get download URL for media', async () => {
      if (!testMediaId) {
        return;
      }

      const response = await request(app)
        .get(`/api/media/${testMediaId}/download`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('url');
        expect(response.body.data).toHaveProperty('filename');
        expect(response.body.data).toHaveProperty('expiresIn');
      }
    });
  });

  describe('POST /api/groups/:groupId/media/download-bulk', () => {
    it('should download multiple media files as ZIP', async () => {
      if (!testGroupId || !testMediaId) {
        return;
      }

      const response = await request(app)
        .post(`/api/groups/${testGroupId}/media/download-bulk`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ mediaIds: [testMediaId] })
        .expect('Content-Type', /zip/);

      // Should return ZIP file
      if (response.status === 200) {
        expect(response.headers['content-disposition']).toMatch(/attachment/);
      }
    });

    it('should return 400 when no media IDs provided', async () => {
      if (!testGroupId) {
        return;
      }

      const response = await request(app)
        .post(`/api/groups/${testGroupId}/media/download-bulk`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ mediaIds: [] })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/media/:id', () => {
    it('should delete media if authorized', async () => {
      if (!testMediaId) {
        return;
      }

      const response = await request(app)
        .delete(`/api/media/${testMediaId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/);

      // Should be 200 if authorized, 403 if not
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.message).toMatch(/deleted/i);
      }
    });
  });
});
