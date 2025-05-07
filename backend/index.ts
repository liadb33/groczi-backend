import express, { Request, Response, NextFunction } from 'express';
import groceriesRoute from './features/groceries/routes/groceries.routes.js';
import cors from 'cors';
import storesRoute from './features/stores/routes/stores.routes.js';

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Request logger middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Routes
//app.use('/api/v1/groceries', groceriesRoute);
app.use('/api/v1/stores', storesRoute);

// Start the server
app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
}); 