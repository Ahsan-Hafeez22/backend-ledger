import { z } from 'zod';


// ─────────────────────────────────────────────────────────────────────────────
// POST /account/create-account
// What we expect: accountTitle, pin
// ─────────────────────────────────────────────────────────────────────────────

export const createAccountDTO = z.object({
    accountTitle: z
        .string({ required_error: 'AccountTitle is required' })
        .min(2, 'Account title must be at least 2 characters')
        .max(100, 'Account title cannot exceed 100 characters')
        .trim(),

    pin: z
        .string({ required_error: 'Pin is required' })
        .length(4, 'Pin must be exactly 4 digits')
        .regex(/^\d+$/, 'Pin must contain only numbers')
});


export const changePinDTO = z.object({
    oldPin: z
        .string({ required_error: 'Pin is required' })
        .length(4, 'Pin must be exactly 4 digits')
        .regex(/^\d+$/, 'Pin must contain only numbers'),


    newPin: z
        .string({ required_error: 'Pin is required' })
        .length(4, 'Pin must be exactly 4 digits')
        .regex(/^\d+$/, 'Pin must contain only numbers')
}).refine((data) => data.oldPin !== data.newPin, {
    message: 'Old and new pin cannot be the same',
    path: ['newPin'],
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /account/change-account-status/:status
// ─────────────────────────────────────────────────────────────────────────────
export const changeAccountStatusParamsDTO = z.object({
    status: z.enum(['ACTIVE', 'CLOSED', 'FROZEN'], {
        errorMap: () => ({ message: 'Invalid status' }),
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /account/balance/:accountNumber
// ─────────────────────────────────────────────────────────────────────────────
export const accountNumberParamsDTO = z.object({
    accountNumber: z
        .string({ required_error: 'accountNumber is required' })
        .trim()
        .min(5, 'Invalid accountNumber')
        .max(30, 'Invalid accountNumber'),
});

export default createAccountDTO;