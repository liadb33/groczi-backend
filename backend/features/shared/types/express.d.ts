import "express";

declare global {
  namespace Express {
    interface Request {
      deviceId?: string; // Make deviceId optional with ?
    }
  
  }
}

export {};
