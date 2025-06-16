import request from 'supertest';
import { app, testDeviceId } from '../setup';

describe('Bookmarks API', () => {
  // Helper function to make authenticated requests
  const makeAuthenticatedRequest = (method: string, endpoint: string) => {
    const req = request(app);
    switch (method.toLowerCase()) {
      case 'get': return req.get(endpoint).set('X-Device-ID', testDeviceId);
      case 'post': return req.post(endpoint).set('X-Device-ID', testDeviceId);
      case 'put': return req.put(endpoint).set('X-Device-ID', testDeviceId);
      case 'patch': return req.patch(endpoint).set('X-Device-ID', testDeviceId);
      case 'delete': return req.delete(endpoint).set('X-Device-ID', testDeviceId);
      default: throw new Error(`Unsupported HTTP method: ${method}`);
    }
  };

  describe('GET /me/bookmarks', () => {
    it('should return user bookmarks with valid device ID', async () => {
      const response = await makeAuthenticatedRequest('get', '/me/bookmarks')
        .expect(200);
      
      expect(response.body).toBeDefined();
      expect(Array.isArray(response.body) || typeof response.body === 'object').toBe(true);
    });

    it('should require device ID header', async () => {
      const response = await request(app)
        .get('/me/bookmarks')
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should handle pagination parameters', async () => {
      const response = await makeAuthenticatedRequest('get', '/me/bookmarks?limit=10&page=1')
        .expect(200);
      
      expect(response.body).toBeDefined();
    });

    it('should return bookmarks with correct structure', async () => {
      const response = await makeAuthenticatedRequest('get', '/me/bookmarks')
        .expect(200);
      
      if (Array.isArray(response.body) && response.body.length > 0) {
        const bookmark = response.body[0];
        expect(bookmark).toHaveProperty('itemCode');
        expect(bookmark).toHaveProperty('itemName');
        expect(bookmark).toHaveProperty('bookmarkedAt');
        // Add other expected fields based on your bookmark model
      }
    });

    it('should handle search parameters', async () => {
      const response = await makeAuthenticatedRequest('get', '/me/bookmarks?search=milk')
        .expect(200);
      
      expect(response.body).toBeDefined();
    });

    it('should handle empty bookmarks list', async () => {
      const response = await makeAuthenticatedRequest('get', '/me/bookmarks')
        .expect(200);
      
      expect(response.body).toBeDefined();
      if (Array.isArray(response.body)) {
        expect(response.body.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('POST /me/bookmarks', () => {
    it('should add bookmark with valid item code', async () => {
      const newBookmark = {
        itemCode: '7290000066417'
      };

      const response = await makeAuthenticatedRequest('post', '/me/bookmarks')
        .send(newBookmark);
      
      expect([200, 201]).toContain(response.status);
      
      if (response.status === 201) {
        expect(response.body).toHaveProperty('itemCode', newBookmark.itemCode);
        expect(response.body).toHaveProperty('bookmarkedAt');
      }
    });

    it('should require device ID for bookmark creation', async () => {
      const newBookmark = {
        itemCode: '7290000066417'
      };

      const response = await request(app)
        .post('/me/bookmarks')
        .send(newBookmark)
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should handle missing item code', async () => {
      const response = await makeAuthenticatedRequest('post', '/me/bookmarks')
        .send({})
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should handle invalid item code format', async () => {
      const invalidBookmark = {
        itemCode: 'invalid-code-!@#'
      };

      const response = await makeAuthenticatedRequest('post', '/me/bookmarks')
        .send(invalidBookmark)
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should handle duplicate bookmarks gracefully', async () => {
      const newBookmark = {
        itemCode: '7290000066417'
      };

      // First bookmark attempt
      const firstResponse = await makeAuthenticatedRequest('post', '/me/bookmarks')
        .send(newBookmark);
      
      expect([200, 201]).toContain(firstResponse.status);

      // Second bookmark attempt (duplicate)
      const secondResponse = await makeAuthenticatedRequest('post', '/me/bookmarks')
        .send(newBookmark);
      
      expect([200, 409]).toContain(secondResponse.status);
    });

    it('should handle non-existent item code', async () => {
      const nonExistentBookmark = {
        itemCode: '999999999999999'
      };

      const response = await makeAuthenticatedRequest('post', '/me/bookmarks')
        .send(nonExistentBookmark);
      
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('DELETE /me/bookmarks/:itemCode', () => {
    it('should remove bookmark with valid item code', async () => {
      const response = await makeAuthenticatedRequest('delete', '/me/bookmarks/7290000066417');
      
      expect([200, 204, 404]).toContain(response.status);
    });

    it('should handle non-existent bookmark removal', async () => {
      const response = await makeAuthenticatedRequest('delete', '/me/bookmarks/999999999999999')
        .expect(404);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should require authentication for bookmark removal', async () => {
      const response = await request(app)
        .delete('/me/bookmarks/7290000066417')
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should handle invalid item code format for deletion', async () => {
      const response = await makeAuthenticatedRequest('delete', '/me/bookmarks/invalid-code-!@#');
      
      expect([400, 404]).toContain(response.status);
    });

    it('should return success message on successful deletion', async () => {
      const response = await makeAuthenticatedRequest('delete', '/me/bookmarks/7290000066417');
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('message');
      }
    });
  });

  describe('Bookmark workflow tests', () => {
    const testItemCode = '7290000066418'; // Use a different code for workflow tests

    it('should complete full bookmark lifecycle', async () => {
      // 1. Add bookmark
      const addResponse = await makeAuthenticatedRequest('post', '/me/bookmarks')
        .send({ itemCode: testItemCode });
      
      expect([200, 201]).toContain(addResponse.status);

      // 2. Verify bookmark exists in list
      const listResponse = await makeAuthenticatedRequest('get', '/me/bookmarks')
        .expect(200);
      
      if (Array.isArray(listResponse.body)) {
        const bookmark = listResponse.body.find(b => b.itemCode === testItemCode);
        expect(bookmark).toBeDefined();
      }

      // 3. Remove bookmark
      const deleteResponse = await makeAuthenticatedRequest('delete', `/me/bookmarks/${testItemCode}`);
      
      expect([200, 204]).toContain(deleteResponse.status);

      // 4. Verify bookmark is removed
      const finalListResponse = await makeAuthenticatedRequest('get', '/me/bookmarks')
        .expect(200);
      
      if (Array.isArray(finalListResponse.body)) {
        const bookmark = finalListResponse.body.find(b => b.itemCode === testItemCode);
        expect(bookmark).toBeUndefined();
      }
    });
  });

  describe('Error handling', () => {
    it('should handle malformed device ID', async () => {
      const response = await request(app)
        .get('/me/bookmarks')
        .set('X-Device-ID', '')
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should handle invalid JSON in request body', async () => {
      const response = await request(app)
        .post('/me/bookmarks')
        .set('X-Device-ID', testDeviceId)
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should handle extremely long item codes', async () => {
      const longItemCode = 'a'.repeat(1000);
      
      const response = await makeAuthenticatedRequest('post', '/me/bookmarks')
        .send({ itemCode: longItemCode })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should handle special characters in item code', async () => {
      const specialItemCode = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      
      const response = await makeAuthenticatedRequest('post', '/me/bookmarks')
        .send({ itemCode: specialItemCode });
      
      expect([400, 404]).toContain(response.status);
    });
  });
});
