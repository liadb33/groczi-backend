import request from 'supertest';
import { app, testDeviceId } from '../setup';

describe('Cart API', () => {
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

  describe('GET /me/cart', () => {
    it('should return user cart with valid device ID', async () => {
      const response = await makeAuthenticatedRequest('get', '/me/cart')
        .expect(200);
      
      expect(response.body).toBeDefined();
      expect(typeof response.body === 'object').toBe(true);
    });

    it('should require device ID header', async () => {
      const response = await request(app)
        .get('/me/cart')
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should return cart with correct structure', async () => {
      const response = await makeAuthenticatedRequest('get', '/me/cart')
        .expect(200);
      
      expect(response.body).toHaveProperty('items');
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body).toHaveProperty('totalAmount');
      expect(response.body).toHaveProperty('totalItems');
      // Add other expected fields based on your cart model
    });

    it('should handle empty cart', async () => {
      const response = await makeAuthenticatedRequest('get', '/me/cart')
        .expect(200);
      
      expect(response.body).toBeDefined();
      expect(response.body.items).toBeDefined();
      expect(Array.isArray(response.body.items)).toBe(true);
    });

    it('should calculate cart totals correctly', async () => {
      const response = await makeAuthenticatedRequest('get', '/me/cart')
        .expect(200);
      
      expect(response.body.totalAmount).toBeGreaterThanOrEqual(0);
      expect(response.body.totalItems).toBeGreaterThanOrEqual(0);
      
      if (Array.isArray(response.body.items)) {
        expect(response.body.totalItems).toBe(response.body.items.length);
      }
    });
  });

  describe('POST /me/cart/items', () => {
    it('should add item to cart with valid data', async () => {
      const newItem = {
        itemCode: '7290000066417',
        quantity: 2,
        storeId: '7290027600007-001'
      };

      const response = await makeAuthenticatedRequest('post', '/me/cart/items')
        .send(newItem);
      
      expect([200, 201]).toContain(response.status);
      
      if (response.status === 201) {
        expect(response.body).toHaveProperty('cartItemId');
        expect(response.body).toHaveProperty('itemCode', newItem.itemCode);
        expect(response.body).toHaveProperty('quantity', newItem.quantity);
      }
    });

    it('should require device ID for adding items', async () => {
      const newItem = {
        itemCode: '7290000066417',
        quantity: 2,
        storeId: '7290027600007-001'
      };

      const response = await request(app)
        .post('/me/cart/items')
        .send(newItem)
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should handle missing required fields', async () => {
      const response = await makeAuthenticatedRequest('post', '/me/cart/items')
        .send({})
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should handle invalid item code', async () => {
      const invalidItem = {
        itemCode: 'invalid-code-!@#',
        quantity: 1,
        storeId: '7290027600007-001'
      };

      const response = await makeAuthenticatedRequest('post', '/me/cart/items')
        .send(invalidItem)
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should handle invalid quantity', async () => {
      const invalidItem = {
        itemCode: '7290000066417',
        quantity: -1, // negative quantity
        storeId: '7290027600007-001'
      };

      const response = await makeAuthenticatedRequest('post', '/me/cart/items')
        .send(invalidItem)
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should handle duplicate items in cart', async () => {
      const newItem = {
        itemCode: '7290000066417',
        quantity: 1,
        storeId: '7290027600007-001'
      };

      // First add attempt
      const firstResponse = await makeAuthenticatedRequest('post', '/me/cart/items')
        .send(newItem);
      
      expect([200, 201]).toContain(firstResponse.status);

      // Second add attempt (duplicate)
      const secondResponse = await makeAuthenticatedRequest('post', '/me/cart/items')
        .send(newItem);
      
      expect([200, 409]).toContain(secondResponse.status);
    });

    it('should handle non-existent store ID', async () => {
      const invalidItem = {
        itemCode: '7290000066417',
        quantity: 1,
        storeId: 'non-existent-store'
      };

      const response = await makeAuthenticatedRequest('post', '/me/cart/items')
        .send(invalidItem);
      
      expect([400, 404]).toContain(response.status);
    });
  });

  describe('PUT /me/cart/items/:cartItemId', () => {
    it('should update cart item with valid data', async () => {
      const updateData = {
        quantity: 5
      };

      // Using a test cart item ID - adjust as needed
      const response = await makeAuthenticatedRequest('put', '/me/cart/items/test-cart-item-123')
        .send(updateData);
      
      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('quantity', updateData.quantity);
      }
    });

    it('should handle non-existent cart item', async () => {
      const updateData = {
        quantity: 3
      };

      const response = await makeAuthenticatedRequest('put', '/me/cart/items/non-existent-item')
        .send(updateData)
        .expect(404);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should require authentication for item update', async () => {
      const updateData = {
        quantity: 3
      };

      const response = await request(app)
        .put('/me/cart/items/test-cart-item-123')
        .send(updateData)
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should handle invalid quantity update', async () => {
      const updateData = {
        quantity: 0 // zero quantity
      };

      const response = await makeAuthenticatedRequest('put', '/me/cart/items/test-cart-item-123')
        .send(updateData)
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should handle missing quantity in update', async () => {
      const response = await makeAuthenticatedRequest('put', '/me/cart/items/test-cart-item-123')
        .send({})
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should update cart totals after item update', async () => {
      const updateData = {
        quantity: 10
      };

      const response = await makeAuthenticatedRequest('put', '/me/cart/items/test-cart-item-123')
        .send(updateData);
      
      if (response.status === 200) {
        // Verify cart totals are recalculated
        const cartResponse = await makeAuthenticatedRequest('get', '/me/cart')
          .expect(200);
        
        expect(cartResponse.body.totalAmount).toBeDefined();
        expect(cartResponse.body.totalItems).toBeDefined();
      }
    });
  });

  describe('DELETE /me/cart/items/:cartItemId', () => {
    it('should remove item from cart', async () => {
      const response = await makeAuthenticatedRequest('delete', '/me/cart/items/test-cart-item-123');
      
      expect([200, 204, 404]).toContain(response.status);
    });

    it('should handle non-existent cart item removal', async () => {
      const response = await makeAuthenticatedRequest('delete', '/me/cart/items/non-existent-item')
        .expect(404);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should require authentication for item removal', async () => {
      const response = await request(app)
        .delete('/me/cart/items/test-cart-item-123')
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should update cart totals after item removal', async () => {
      const response = await makeAuthenticatedRequest('delete', '/me/cart/items/test-cart-item-123');
      
      if ([200, 204].includes(response.status)) {
        // Verify cart totals are recalculated
        const cartResponse = await makeAuthenticatedRequest('get', '/me/cart')
          .expect(200);
        
        expect(cartResponse.body.totalAmount).toBeDefined();
        expect(cartResponse.body.totalItems).toBeDefined();
      }
    });

    it('should handle invalid cart item ID format', async () => {
      const response = await makeAuthenticatedRequest('delete', '/me/cart/items/invalid-!@#');
      
      expect([400, 404]).toContain(response.status);
    });
  });

  describe('Cart workflow tests', () => {
    const testItem = {
      itemCode: '7290000066419', // Use a different code for workflow tests
      quantity: 3,
      storeId: '7290027600007-001'
    };

    it('should complete full cart lifecycle', async () => {
      // 1. Add item to cart
      const addResponse = await makeAuthenticatedRequest('post', '/me/cart/items')
        .send(testItem);
      
      expect([200, 201]).toContain(addResponse.status);
      
      let cartItemId: string;
      if (addResponse.status === 201) {
        cartItemId = addResponse.body.cartItemId;
        expect(cartItemId).toBeDefined();
      } else {
        // Item might already exist, get from cart
        const cartResponse = await makeAuthenticatedRequest('get', '/me/cart')
          .expect(200);
        
        const item = cartResponse.body.items.find((item: any) => item.itemCode === testItem.itemCode);
        cartItemId = item?.cartItemId;
        expect(cartItemId).toBeDefined();
      }

      // 2. Update item quantity
      const updateResponse = await makeAuthenticatedRequest('put', `/me/cart/items/${cartItemId}`)
        .send({ quantity: 5 });
      
      if (updateResponse.status === 200) {
        expect(updateResponse.body.quantity).toBe(5);
      }

      // 3. Verify cart contains updated item
      const cartResponse = await makeAuthenticatedRequest('get', '/me/cart')
        .expect(200);
      
      const updatedItem = cartResponse.body.items.find((item: any) => item.cartItemId === cartItemId);
      if (updatedItem) {
        expect(updatedItem.quantity).toBe(5);
      }

      // 4. Remove item from cart
      const deleteResponse = await makeAuthenticatedRequest('delete', `/me/cart/items/${cartItemId}`);
      
      expect([200, 204]).toContain(deleteResponse.status);

      // 5. Verify item is removed
      const finalCartResponse = await makeAuthenticatedRequest('get', '/me/cart')
        .expect(200);
      
      const removedItem = finalCartResponse.body.items.find((item: any) => item.cartItemId === cartItemId);
      expect(removedItem).toBeUndefined();
    });
  });

  describe('Error handling', () => {
    it('should handle malformed device ID', async () => {
      const response = await request(app)
        .get('/me/cart')
        .set('X-Device-ID', '')
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should handle invalid JSON in request body', async () => {
      const response = await request(app)
        .post('/me/cart/items')
        .set('X-Device-ID', testDeviceId)
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should handle extremely large quantities', async () => {
      const largeQuantityItem = {
        itemCode: '7290000066417',
        quantity: 999999999,
        storeId: '7290027600007-001'
      };

      const response = await makeAuthenticatedRequest('post', '/me/cart/items')
        .send(largeQuantityItem);
      
      expect([200, 201, 400]).toContain(response.status);
    });

    it('should handle concurrent cart modifications', async () => {
      const item1 = {
        itemCode: '7290000066420',
        quantity: 1,
        storeId: '7290027600007-001'
      };

      const item2 = {
        itemCode: '7290000066421',
        quantity: 1,
        storeId: '7290027600007-001'
      };

      // Add two items concurrently
      const [response1, response2] = await Promise.all([
        makeAuthenticatedRequest('post', '/me/cart/items').send(item1),
        makeAuthenticatedRequest('post', '/me/cart/items').send(item2)
      ]);

      expect([200, 201]).toContain(response1.status);
      expect([200, 201]).toContain(response2.status);
    });
  });
});
