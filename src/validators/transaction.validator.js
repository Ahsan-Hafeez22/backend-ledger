import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// POST /transactions/create
// ─────────────────────────────────────────────────────────────────────────────
export const createTransactionDTO = z.object({
    toAccount: z
        .string({ required_error: 'toAccount is required' })
        .trim()
        .min(1, 'toAccount cannot be empty'),

    amount: z
        .number({ required_error: 'amount is required' })
        .positive('Amount must be greater than 0')
        .max(1_000_000, 'Amount cannot exceed 1,000,000'),

    idempotencyKey: z
        .string({ required_error: 'idempotencyKey is required' })
        .uuid('idempotencyKey must be a valid UUID'),

    description: z
        .string()
        .max(200, 'Description cannot exceed 200 characters')
        .optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /transactions
// Query params validation
// ─────────────────────────────────────────────────────────────────────────────
export const getTransactionsDTO = z.object({
    page: z
        .string()
        .optional()
        .transform(val => (val ? Number(val) : 1))
        .pipe(z.number().int().positive('Page must be a positive number')),

    limit: z
        .string()
        .optional()
        .transform(val => (val ? Number(val) : 10))
        .pipe(z.number().int().min(1).max(50, 'Limit cannot exceed 50')),

    status: z
        .enum(['PENDING', 'COMPLETED', 'FAILED', 'REVERSED'])
        .optional(),

    startDate: z
        .string()
        .optional()
        .refine(val => !val || !isNaN(Date.parse(val)), 'startDate must be a valid date'),

    endDate: z
        .string()
        .optional()
        .refine(val => !val || !isNaN(Date.parse(val)), 'endDate must be a valid date'),
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /transactions/check-status
// ─────────────────────────────────────────────────────────────────────────────
export const checkTransactionStatusDTO = z.object({
    idempotencyKey: z
        .string({ required_error: 'idempotencyKey is required' })
        .uuid('idempotencyKey must be a valid UUID'),
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /transactions/:transactionId
// ─────────────────────────────────────────────────────────────────────────────
export const transactionIdDTO = z.object({
    transactionId: z
        .string({ required_error: 'transactionId is required' })
        .regex(/^[a-fA-F0-9]{24}$/, 'transactionId must be a valid MongoDB ObjectId'),
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /transactions/verify-pin
// ─────────────────────────────────────────────────────────────────────────────
export const verifyPinDTO = z.object({
    pin: z
        .string({ required_error: 'Pin is required' })
        .length(4, 'Pin must be exactly 4 digits')
        .regex(/^\d+$/, 'Pin must contain only numbers')
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /transactions/initial-funds
// System-only route. What we expect: toAccount, amount, idempotencyKey
// ─────────────────────────────────────────────────────────────────────────────
export const createInitialFundsDTO = z.object({
    toAccount: z
        .string({ required_error: 'toAccount is required' })
        .trim()
        .min(1, 'toAccount cannot be empty'),

    amount: z
        .number({ required_error: 'amount is required' })
        .positive('Amount must be greater than 0')
        .max(1_000_000, 'Amount cannot exceed 1,000,000'),

    idempotencyKey: z
        .string({ required_error: 'idempotencyKey is required' })
        .uuid('idempotencyKey must be a valid UUID'),
});