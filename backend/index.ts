import express, { Request, Response, NextFunction } from 'express';
import groceriesRoute from './features/groceries/routes/groceries.routes.js';
import cors from 'cors';
import storesRoute from './features/stores/routes/stores.routes.js';
import promotionsRoute from './features/promotions/routes/promotions.routes.js';
import bookmarksRoute from './features/bookmarks/routes/bookmarks.routes.js';
import cartRoute from './features/cart/routes/cart.routes.js';
import listsRoute from './features/lists/routes/lists.routes.js';

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
app.use('/stores', storesRoute);
app.use("/groceries", groceriesRoute);
app.use("/promotions", promotionsRoute);
app.use("/me/bookmarks", bookmarksRoute);
app.use("/me/cart", cartRoute);
app.use("/me/lists", listsRoute);


// Start the server
app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
}); 