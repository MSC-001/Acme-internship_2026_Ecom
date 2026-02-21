import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import authRouter from './auth.js';
import productRouter from './product.js';
import cartRouter from './cart.js';
import ordersRouter from './orders.js';
import profileRouter from './profile.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//middleware
var app = express();
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, '../client')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

//routes
app.use("/api/auth", authRouter);
app.use("/api/products", productRouter);
app.use("/api/cart", cartRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/profile", profileRouter);

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
