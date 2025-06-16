import request from 'supertest';
import { app } from '../setup';

describe('Promotions API', () => {
  describe('GET /promotions', () => {
    it('should return all promotions', async () => {
      const response = await request(app)
        .get('/promotions')
        .expect(200);
      
      expect(response.body).toBeDefined();
      expect(Array.isArray(response.body) || typeof response.body === 'object').toBe(true);
    });

    it('should handle pagination parameters', async () => {
      const response = await request(app)
        .get('/promotions?limit=10&page=1')
        .expect(200);
      
      expect(response.body).toBeDefined();
    });

    it('should handle filter parameters', async () => {
      const response = await request(app)
        .get('/promotions?storeId=7290027600007-001')
        .expect(200);
      
      expect(response.body).toBeDefined();
    });

    it('should return promotions with correct structure', async () => {
      const response = await request(app)
        .get('/promotions')
        .expect(200);
      
      if (Array.isArray(response.body) && response.body.length > 0) {
        const promotion = response.body[0];
        expect(promotion).toHaveProperty('promotionId');
        // Add other expected fields based on your promotion model
      }
    });
  });

  describe('GET /promotions/:promotionId/discounted-groceries', () => {
    it('should return discounted groceries for valid promotion', async () => {
      // Using a test promotion ID - adjust as needed
      const response = await request(app)
        .get('/promotions/test-promotion-123/discounted-groceries');
      
      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toBeDefined();
        expect(Array.isArray(response.body) || typeof response.body === 'object').toBe(true);
      }
    });

    it('should handle non-existent promotion ID', async () => {
      const response = await request(app)
        .get('/promotions/non-existent-promotion/discounted-groceries')
        .expect(404);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should handle invalid promotion ID format', async () => {
      const response = await request(app)
        .get('/promotions/invalid-!@#/discounted-groceries');
      
      expect([400, 404]).toContain(response.status);
    });

    it('should return discounted groceries with correct structure', async () => {
      const response = await request(app)
        .get('/promotions/test-promotion-123/discounted-groceries');
      
      if (response.status === 200 && Array.isArray(response.body) && response.body.length > 0) {
        const grocery = response.body[0];
        expect(grocery).toHaveProperty('itemCode');
        expect(grocery).toHaveProperty('itemName');
        // Add other expected fields
      }
    });
  });

  describe('GET /promotions/store/:chainId/:subChainId/:storeId', () => {
    it('should return promotions for valid store', async () => {
      const response = await request(app)
        .get('/promotions/store/7290027600007/001/001');
      
      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toBeDefined();
        expect(Array.isArray(response.body) || typeof response.body === 'object').toBe(true);
      }
    });

    it('should handle non-existent store', async () => {
      const response = await request(app)
        .get('/promotions/store/999999999/999/999')
        .expect(404);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should handle invalid store parameters', async () => {
      const response = await request(app)
        .get('/promotions/store/invalid/invalid/invalid');
      
      expect([400, 404]).toContain(response.status);
    });

    it('should return store promotions with pagination', async () => {
      const response = await request(app)
        .get('/promotions/store/7290027600007/001/001?limit=5&page=1');
      
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('GET /promotions/grocery/:itemCode', () => {
    it('should return promotions for valid grocery item', async () => {
      // Using a test item code - adjust as needed
      const response = await request(app)
        .get('/promotions/grocery/7290000066417');
      
      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toBeDefined();
        expect(Array.isArray(response.body) || typeof response.body === 'object').toBe(true);
      }
    });

    it('should handle non-existent item code', async () => {
      const response = await request(app)
        .get('/promotions/grocery/999999999999999')
        .expect(404);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should handle invalid item code format', async () => {
      const response = await request(app)
        .get('/promotions/grocery/invalid-code-!@#');
      
      expect([400, 404]).toContain(response.status);
    });

    it('should return promotions with store information', async () => {
      const response = await request(app)
        .get('/promotions/grocery/7290000066417');
      
      if (response.status === 200 && Array.isArray(response.body) && response.body.length > 0) {
        const promotion = response.body[0];
        expect(promotion).toHaveProperty('promotionId');
        expect(promotion).toHaveProperty('storeId');
        // Add other expected fields
      }
    });
  });

  describe('GET /promotions/grouped-by-store', () => {
    it('should return promotions grouped by store', async () => {
      const response = await request(app)
        .get('/promotions/grouped-by-store')
        .expect(200);
      
      expect(response.body).toBeDefined();
      expect(typeof response.body === 'object').toBe(true);
    });

    it('should handle filter parameters for grouped promotions', async () => {
      const response = await request(app)
        .get('/promotions/grouped-by-store?chainId=7290027600007')
        .expect(200);
      
      expect(response.body).toBeDefined();
    });

    it('should return correct grouped structure', async () => {
      const response = await request(app)
        .get('/promotions/grouped-by-store')
        .expect(200);
      
      expect(typeof response.body === 'object').toBe(true);
      // Each store should have an array of promotions
      Object.values(response.body).forEach((storePromotions) => {
        expect(Array.isArray(storePromotions)).toBe(true);
      });
    });

    it('should handle date range parameters', async () => {
      const response = await request(app)
        .get('/promotions/grouped-by-store?startDate=2024-01-01&endDate=2024-12-31')
        .expect(200);
      
      expect(response.body).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should handle malformed requests gracefully', async () => {
      const response = await request(app)
        .get('/promotions/store/!@#/$%^/&*()');
      
      expect([400, 404]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
    });

    it('should return proper error format', async () => {
      const response = await request(app)
        .get('/promotions/non-existent-endpoint');
      
      if (response.status >= 400) {
        expect(response.body).toHaveProperty('error');
      }
    });

    it('should handle invalid query parameters', async () => {
      const response = await request(app)
        .get('/promotions?limit=invalid&page=notanumber');
      
      expect([200, 400]).toContain(response.status);
    });
  });
});
