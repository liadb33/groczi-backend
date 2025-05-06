import express, { Router } from 'express';
import { getGroceriesHandler } from '../controllers/groceries.controller.js';

// Create a router
const groceriesRoute = Router();

// GET /groceries
groceriesRoute.get('/', getGroceriesHandler);

// Add other grocery routes here if needed

export default groceriesRoute;
