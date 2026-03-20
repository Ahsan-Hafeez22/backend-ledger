const express = require('express');
const app = express();
const authRoutes = require('./routes/auth.routes');
const accountRoutes = require('./routes/account.routes');
const transactionRoutes = require('./routes/transaction.routes');
const cookieParser = require("cookie-parser");

app.use(cookieParser());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/transaction', transactionRoutes);

module.exports = app;