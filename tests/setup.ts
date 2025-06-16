import { app } from '../backend/index.js';

// Export the app for testing
export { app };

// Optional: Add any global test utilities here
export const testDeviceId = 'test-device-123';

// Global test utilities
export const createAuthHeaders = (deviceId: string = testDeviceId) => ({
  'X-Device-ID': deviceId,
  'Content-Type': 'application/json'
});

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
