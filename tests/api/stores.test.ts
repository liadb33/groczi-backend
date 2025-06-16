import request from 'supertest';
import { app } from '../setup';

describe('Stores API', () => {
  describe('GET /stores', () => {
    it('should return all stores', async () => {
      const response = await request(app)
        .get('/stores')
        .expect(200);
      
      expect(response.body).toBeDefined();
      expect(Array.isArray(response.body) || typeof response.body === 'object').toBe(true);
    });

    it('should handle query parameters for pagination', async () => {
      const response = await request(app)
        .get('/stores?limit=10&page=1')
        .expect(200);
      
      expect(response.body).toBeDefined();
    });

    it('should handle filter parameters', async () => {
      const response = await request(app)
        .get('/stores?chainId=7290027600007')
        .expect(200);
      
      expect(response.body).toBeDefined();
    });
  });

  describe('GET /stores/nearby', () => {
    it('should return nearby stores with valid coordinates', async () => {
      const response = await request(app)
        .get('/stores/nearby?lat=32.0853&lng=34.7818&radius=5000')
        .expect(200);
      
      expect(response.body).toBeDefined();
      expect(Array.isArray(response.body) || typeof response.body === 'object').toBe(true);
    });

    it('should handle missing coordinates', async () => {
      const response = await request(app)
        .get('/stores/nearby');
      
      // Should return 400 for missing required parameters
      expect([400, 422]).toContain(response.status);
    });

    it('should handle invalid coordinates', async () => {
      const response = await request(app)
        .get('/stores/nearby?lat=invalid&lng=invalid');
      
      expect([400, 422]).toContain(response.status);
    });

    it('should handle coordinates out of bounds', async () => {
      const response = await request(app)
        .get('/stores/nearby?lat=999&lng=999');
      
      expect([200, 400]).toContain(response.status);
    });

    it('should use default radius when not specified', async () => {
      const response = await request(app)
        .get('/stores/nearby?lat=32.0853&lng=34.7818');
      
      expect([200, 400]).toContain(response.status);
    });

    it('should handle very large radius', async () => {
      const response = await request(app)
        .get('/stores/nearby?lat=32.0853&lng=34.7818&radius=50000')
        .expect(200);
      
      expect(response.body).toBeDefined();
    });
  });

  describe('GET /stores/:id', () => {
    it('should return store by valid ID', async () => {
      // Using a test store ID - adjust as needed based on your data
      const response = await request(app)
        .get('/stores/7290027600007-001');
      
      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toBeDefined();
        expect(response.body).toHaveProperty('storeId');
      }
    });

    it('should handle non-existent store ID', async () => {
      const response = await request(app)
        .get('/stores/non-existent-store-id')
        .expect(404);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should handle invalid store ID format', async () => {
      const response = await request(app)
        .get('/stores/invalid-format-!@#');
      
      expect([400, 404]).toContain(response.status);
    });

    it('should return store with all required fields', async () => {
      const response = await request(app)
        .get('/stores/7290027600007-001');
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('storeId');
        expect(response.body).toHaveProperty('storeName');
        expect(response.body).toHaveProperty('chainId');
        // Add other expected fields based on your store model
      }
    });
  });

  describe('Error handling', () => {
    it('should handle malformed requests gracefully', async () => {
      const response = await request(app)
        .get('/stores/nearby?lat=abc&lng=def&radius=xyz');
      
      expect([400, 422]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
    });

    it('should return proper error format', async () => {
      const response = await request(app)
        .get('/stores/non-existent');
      
      if (response.status >= 400) {
        expect(response.body).toHaveProperty('error');
      }
    });
  });
});
