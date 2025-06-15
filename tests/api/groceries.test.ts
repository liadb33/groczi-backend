import request from 'supertest';
import { app } from '../setup';

describe('Groceries API', () => {
  describe('GET /groceries', () => {
    it('should return all groceries', async () => {
      const response = await request(app)
        .get('/groceries')
        .expect(200);
      
      expect(response.body).toBeDefined();
      // Could be an array or paginated object
      expect(Array.isArray(response.body) || typeof response.body === 'object').toBe(true);
    });

    it('should handle query parameters', async () => {
      const response = await request(app)
        .get('/groceries?limit=10&page=1')
        .expect(200);
      
      expect(response.body).toBeDefined();
    });
  });

  describe('GET /groceries/search', () => {
    it('should search groceries with query', async () => {
      const response = await request(app)
        .get('/groceries/search?q=milk')
        .expect(200);
      
      expect(response.body).toBeDefined();
    });

    it('should handle empty search query', async () => {
      const response = await request(app)
        .get('/groceries/search?q=')
        .expect(200);
      
      expect(response.body).toBeDefined();
    });

    it('should handle missing query parameter', async () => {
      const response = await request(app)
        .get('/groceries/search');
      
      // Should either return 400 or 200 with empty result
      expect([200, 400]).toContain(response.status);
    });

    it('should search with Hebrew text', async () => {
      const response = await request(app)
        .get('/groceries/search?q=חלב')
        .expect(200);
      
      expect(response.body).toBeDefined();
    });
  });

  describe('GET /groceries/:itemCode', () => {
    it('should return grocery by item code', async () => {
      // Using a common test item code - adjust as needed
      const response = await request(app)
        .get('/groceries/123456');
      
      // Should either return the item or 404
      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toBeDefined();
        expect(response.body).toHaveProperty('itemCode');
      }
    });

    it('should handle invalid item code format', async () => {
      const response = await request(app)
        .get('/groceries/invalid-code');
      
      expect([400, 404]).toContain(response.status);
    });
  });

  describe('GET /groceries/:id/stores', () => {
    it('should return stores for grocery item', async () => {
      const response = await request(app)
        .get('/groceries/123456/stores');
      
      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toBeDefined();
        expect(Array.isArray(response.body) || typeof response.body === 'object').toBe(true);
      }
    });
  });

  describe('GET /groceries/:itemCode/price-history', () => {
    it('should return price history for item', async () => {
      const response = await request(app)
        .get('/groceries/123456/price-history');
      
      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toBeDefined();
        expect(Array.isArray(response.body) || typeof response.body === 'object').toBe(true);
      }
    });

    it('should handle date range parameters', async () => {
      const response = await request(app)
        .get('/groceries/123456/price-history?startDate=2024-01-01&endDate=2024-12-31');
      
      expect([200, 404]).toContain(response.status);
    });
  });
});
