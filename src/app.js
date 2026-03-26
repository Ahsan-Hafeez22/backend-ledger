import express from 'express';
import cookieParser from "cookie-parser";
import authRoutes from './routes/auth.routes.js';
import accountRoutes from './routes/account.routes.js';
import transactionRoutes from './routes/transaction.routes.js';
import morgan from "morgan";

const app = express();
app.use(cookieParser());
app.use(express.json());
app.use(morgan("dev"));
app.use('/api/auth', authRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/transaction', transactionRoutes);

export default app;