import { z } from 'zod';


// ─────────────────────────────────────────────────────────────────────────────
// POST /account/create-account
// What we expect: accountTitle, pin
// ─────────────────────────────────────────────────────────────────────────────

export const createAccountDTO = z.object({
    accountTitle: z
        .string({ required_error: 'AccountTitle is required' })
        .min(2, 'Name must be at least 6 characters')
        .max(100, 'Name cannot exceed 100 characters')
        .trim(),

    pin: z
        .string({ required_error: 'Pin is required' })
        .length(4, 'Pin must be exactly 4 digits')
        .regex(/^\d+$/, 'Pin must contain only numbers')
});

export default createAccountDTO;