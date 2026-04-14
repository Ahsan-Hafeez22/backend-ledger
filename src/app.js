// app.js
import express from 'express';
import cookieParser from "cookie-parser";
import morgan from "morgan";

import authRoutes from './routes/auth.routes.js';
import accountRoutes from './routes/account.routes.js';
import transactionRoutes from './routes/transaction.routes.js';
import notificationRoutes from './routes/notification.routes.js';

import { apiLimiter, authLimiter } from './middlewares/rateLimiter.js';

const app = express();

// Global Middlewares
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

// ✅ Apply limiters only to their specific route groups
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/account', apiLimiter, accountRoutes);
app.use('/api/transaction', apiLimiter, transactionRoutes);
app.use('/api/notifications', notificationRoutes);

export default app;