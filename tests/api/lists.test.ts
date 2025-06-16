import request from 'supertest';
import { app, testDeviceId } from '../setup';

describe('Lists API', () => {
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

  describe('GET /me/lists', () => {
    it('should return user lists with valid device ID', async () => {
      const response = await makeAuthenticatedRequest('get', '/me/lists')
        .expect(200);
      
      expect(response.body).toBeDefined();
      expect(Array.isArray(response.body) || typeof response.body === 'object').toBe(true);
    });

    it('should require device ID header', async () => {
      const response = await request(app)
        .get('/me/lists')
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should handle pagination parameters', async () => {
      const response = await makeAuthenticatedRequest('get', '/me/lists?limit=10&page=1')
        .expect(200);
      
      expect(response.body).toBeDefined();
    });

    it('should return lists with correct structure', async () => {
      const response = await makeAuthenticatedRequest('get', '/me/lists')
        .expect(200);
      
      if (Array.isArray(response.body) && response.body.length > 0) {
        const list = response.body[0];
        expect(list).toHaveProperty('listId');
        expect(list).toHaveProperty('listName');
        // Add other expected fields based on your list model
      }
    });
  });

  describe('POST /me/lists', () => {
    it('should create a new list with valid data', async () => {
      const newList = {
        listName: 'Test Shopping List',
        description: 'A test list for groceries'
      };

      const response = await makeAuthenticatedRequest('post', '/me/lists')
        .send(newList)
        .expect(201);
      
      expect(response.body).toBeDefined();
      expect(response.body).toHaveProperty('listId');
      expect(response.body).toHaveProperty('listName', newList.listName);
    });

    it('should require device ID for list creation', async () => {
      const newList = {
        listName: 'Test Shopping List'
      };

      const response = await request(app)
        .post('/me/lists')
        .send(newList)
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should handle missing required fields', async () => {
      const response = await makeAuthenticatedRequest('post', '/me/lists')
        .send({})
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should handle invalid data types', async () => {
      const invalidList = {
        listName: 123, // should be string
        description: true // should be string
      };

      const response = await makeAuthenticatedRequest('post', '/me/lists')
        .send(invalidList)
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /me/lists/:listId', () => {
    it('should return list details for valid list ID', async () => {
      // Using a test list ID - adjust as needed
      const response = await makeAuthenticatedRequest('get', '/me/lists/test-list-123');
      
      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toBeDefined();
        expect(response.body).toHaveProperty('listId');
        expect(response.body).toHaveProperty('items');
        expect(Array.isArray(response.body.items)).toBe(true);
      }
    });

    it('should handle non-existent list ID', async () => {
      const response = await makeAuthenticatedRequest('get', '/me/lists/non-existent-list')
        .expect(404);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should require authentication for list details', async () => {
      const response = await request(app)
        .get('/me/lists/test-list-123')
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /me/lists/:listId', () => {
    it('should update list name with valid data', async () => {
      const updateData = {
        listName: 'Updated List Name'
      };

      const response = await makeAuthenticatedRequest('put', '/me/lists/test-list-123')
        .send(updateData);
      
      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('listName', updateData.listName);
      }
    });

    it('should handle non-existent list for update', async () => {
      const updateData = {
        listName: 'Updated List Name'
      };

      const response = await makeAuthenticatedRequest('put', '/me/lists/non-existent-list')
        .send(updateData)
        .expect(404);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should require authentication for list update', async () => {
      const updateData = {
        listName: 'Updated List Name'
      };

      const response = await request(app)
        .put('/me/lists/test-list-123')
        .send(updateData)
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /me/lists', () => {
    it('should delete lists with valid list IDs', async () => {
      const deleteData = {
        listIds: ['test-list-123', 'test-list-456']
      };

      const response = await makeAuthenticatedRequest('delete', '/me/lists')
        .send(deleteData);
      
      expect([200, 204]).toContain(response.status);
    });

    it('should handle missing list IDs', async () => {
      const response = await makeAuthenticatedRequest('delete', '/me/lists')
        .send({})
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should require authentication for list deletion', async () => {
      const deleteData = {
        listIds: ['test-list-123']
      };

      const response = await request(app)
        .delete('/me/lists')
        .send(deleteData)
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /me/lists/:listId/items', () => {
    it('should add item to list with valid data', async () => {
      const newItem = {
        itemCode: '7290000066417',
        quantity: 2,
        notes: 'Need fresh ones'
      };

      const response = await makeAuthenticatedRequest('post', '/me/lists/test-list-123/items')
        .send(newItem);
      
      expect([200, 201]).toContain(response.status);
      
      if (response.status === 201) {
        expect(response.body).toHaveProperty('itemCode', newItem.itemCode);
        expect(response.body).toHaveProperty('quantity', newItem.quantity);
      }
    });

    it('should handle duplicate items in list', async () => {
      const newItem = {
        itemCode: '7290000066417',
        quantity: 1
      };

      const response = await makeAuthenticatedRequest('post', '/me/lists/test-list-123/items')
        .send(newItem);
      
      expect([200, 201, 409]).toContain(response.status);
    });

    it('should require authentication for adding items', async () => {
      const newItem = {
        itemCode: '7290000066417',
        quantity: 1
      };

      const response = await request(app)
        .post('/me/lists/test-list-123/items')
        .send(newItem)
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PATCH /me/lists/:listId/items/:itemCode', () => {
    it('should update item quantity with valid data', async () => {
      const updateData = {
        quantity: 5
      };

      const response = await makeAuthenticatedRequest('patch', '/me/lists/test-list-123/items/7290000066417')
        .send(updateData);
      
      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('quantity', updateData.quantity);
      }
    });

    it('should handle non-existent item in list', async () => {
      const updateData = {
        quantity: 3
      };

      const response = await makeAuthenticatedRequest('patch', '/me/lists/test-list-123/items/999999999')
        .send(updateData)
        .expect(404);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should require authentication for quantity update', async () => {
      const updateData = {
        quantity: 3
      };

      const response = await request(app)
        .patch('/me/lists/test-list-123/items/7290000066417')
        .send(updateData)
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /me/lists/:listId/items/:itemCode', () => {
    it('should remove item from list', async () => {
      const response = await makeAuthenticatedRequest('delete', '/me/lists/test-list-123/items/7290000066417');
      
      expect([200, 204, 404]).toContain(response.status);
    });

    it('should handle non-existent item removal', async () => {
      const response = await makeAuthenticatedRequest('delete', '/me/lists/test-list-123/items/999999999')
        .expect(404);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should require authentication for item removal', async () => {
      const response = await request(app)
        .delete('/me/lists/test-list-123/items/7290000066417')
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Error handling', () => {
    it('should handle malformed device ID', async () => {
      const response = await request(app)
        .get('/me/lists')
        .set('X-Device-ID', '')
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should handle invalid JSON in request body', async () => {
      const response = await request(app)
        .post('/me/lists')
        .set('X-Device-ID', testDeviceId)
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
  });
});
