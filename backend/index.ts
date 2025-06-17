import express, { Request, Response, NextFunction } from 'express';
import groceriesRoute from './features/groceries/routes/groceries.routes.js';
import cors from 'cors';
import storesRoute from './features/stores/routes/stores.routes.js';
import promotionsRoute from './features/promotions/routes/promotions.routes.js';
import bookmarksRoute from './features/bookmarks/routes/bookmarks.routes.js';
import cartRoute from './features/cart/routes/cart.routes.js';
import listsRoute from './features/lists/routes/lists.routes.js';
import singleStoreOptimizationRoute from './features/optimization/routes/single-store-optimization.routes.js';
import multiStoreOptimizationRoute from './features/optimization/routes/multi-store-optimization.routes.js';
import authenticationRoutes from './features/authentication/routes/authentication.routes.js';
import requestsRoutes from './features/requests/routes/requests.routes.js';

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Request logger middleware


// Routes
app.use('/stores', storesRoute);
app.use("/groceries", groceriesRoute);
app.use("/promotions", promotionsRoute);
app.use("/me/bookmarks", bookmarksRoute);
app.use("/me/cart", cartRoute);
app.use("/me/lists", listsRoute);
app.use("/optimize/single-store", singleStoreOptimizationRoute);
app.use("/optimize/multi-store", multiStoreOptimizationRoute);
app.use("/authentication", authenticationRoutes);
app.use("/requests", requestsRoutes);

// Export app for testing
export { app };

// Start the server
app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
}); 