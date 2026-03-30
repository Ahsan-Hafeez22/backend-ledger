import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// REUSABLE FIELD DEFINITIONS
// Define once, reuse across multiple schemas.
// This avoids copy-pasting the same rules.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * emailField — reused in register, login, resendOtp, forgotPassword, verifyOtp
 *
 * z.string()          → must be a string
 * .email()            → must match email format (has @ and domain)
 * .toLowerCase()      → transforms "USER@Gmail.COM" → "user@gmail.com"
 * .trim()             → removes leading/trailing whitespace
 */
const emailField = z
    .string({ required_error: 'Email is required' })
    .email('Please enter a valid email address')
    .toLowerCase()
    .trim();

/**
 * passwordField — reused in register, login, resetPassword, changePassword
 *
 * .min(8)             → minimum 8 characters
 * .max(128)           → prevents absurdly long passwords (DoS protection)
 * .regex(...)         → must have at least 1 uppercase letter
 * .regex(...)         → must have at least 1 number
 */
const passwordField = z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number');

/**
 * otpField — reused in verifyOtp, verifyResetOtp
 *
 * .length(4)          → OTP must be exactly 4 digits
 * .regex(/^\d+$/)     → only digits allowed (no letters, no spaces)
 */
const otpField = z
    .string({ required_error: 'OTP is required' })
    .length(4, 'OTP must be exactly 4 digits')
    .regex(/^\d+$/, 'OTP must contain only numbers');

/**
 * resetTokenField — reused in verifyResetOtp response usage & resetPassword
 *
 * .min(1)             → just ensure it's not empty
 */
const resetTokenField = z
    .string({ required_error: 'Reset token is required' })
    .min(1, 'Reset token cannot be empty');


// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/register
// What we expect: name, email, password — required
//                 phone, dateOfBirth, country, defaultCurrency, role — optional
// ─────────────────────────────────────────────────────────────────────────────

/**
 * z.object({}) defines the shape of req.body.
 * Any field NOT listed here is STRIPPED by default (safe behavior).
 * So if someone sends { email, password, hackField: "..." },
 * hackField is automatically removed from req.body.
 */
export const registerDto = z.object({
    name: z
        .string({ required_error: 'Name is required' })
        .min(2, 'Name must be at least 2 characters')
        .max(100, 'Name cannot exceed 100 characters')
        .trim(),

    email: emailField,
    password: passwordField,

    /**
     * .optional() — field doesn't need to be in the request body.
     * If absent, the value will be `undefined` in your controller.
     */
    phone: z
        .string()
        .regex(/^\+?[0-9\s\-\(\)]+$/, 'Invalid phone number format')
        .optional(),

    dateOfBirth: z.string().optional(),

    /**
     * .default("Pakistan") — if field is absent, set it to "Pakistan".
     * So your DB always gets a country value even if user didn't send one.
     */
    country: z.string().optional().default('Pakistan'),

    /**
     * z.enum([...]) — value MUST be one of these options exactly.
     * Anything else fails validation.
     */
    defaultCurrency: z
        .enum(['PKR', 'USD', 'EUR', 'GBP', 'INR'])
        .optional()
        .default('PKR'),

    role: z.enum(['user', 'admin']).optional().default('user'),
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/verify-otp
// What we expect: email, otp — both required
// ─────────────────────────────────────────────────────────────────────────────
export const verifyOtpDto = z.object({
    email: emailField,
    otp: otpField,
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/resend-otp
// What we expect: just the email
// ─────────────────────────────────────────────────────────────────────────────
export const resendOtpDto = z.object({
    email: emailField,
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/login
// What we expect: email, password
// ─────────────────────────────────────────────────────────────────────────────
export const loginDto = z.object({
    email: emailField,
    password: z
        .string({ required_error: 'Password is required' })
        .min(1, 'Password cannot be empty'),
    /**
     * NOTE: We don't apply the full passwordField rules here intentionally.
     * Login should just check "is it there?" — the DB handles the real check.
     * Applying regex rules on login would confuse users who signed up
     * before you added those rules.
     */
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/refresh-token
// What we expect: the refresh token string
// ─────────────────────────────────────────────────────────────────────────────
export const refreshTokenDto = z.object({
    refreshToken: z
        .string({ required_error: 'Refresh token is required' })
        .min(1, 'Refresh token cannot be empty'),
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/forgot-password
// What we expect: just email
// ─────────────────────────────────────────────────────────────────────────────
export const forgotPasswordDto = z.object({
    email: emailField,
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/verify-reset-otp
// What we expect: email + otp
// ─────────────────────────────────────────────────────────────────────────────
export const verifyResetOtpDto = z.object({
    email: emailField,
    otp: otpField,
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/reset-password
// What we expect: the resetToken from verifyResetOtp + the new password
// ─────────────────────────────────────────────────────────────────────────────
export const resetPasswordDto = z.object({
    resetToken: resetTokenField,
    password: passwordField,
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/change-password
// What we expect: old password + new password
// Extra rule: oldPassword and newPassword must NOT be the same
// ─────────────────────────────────────────────────────────────────────────────
export const changePasswordDto = z
    .object({
        oldPassword: z
            .string({ required_error: 'Old password is required' })
            .min(1, 'Old password cannot be empty'),

        newPassword: passwordField,
    })
    /**
     * .refine() lets you add CUSTOM validation rules that span multiple fields.
     * Here we check that oldPassword !== newPassword AT THE SCHEMA LEVEL.
     * This means the controller never even sees this case — Zod handles it.
     *
     * First arg:  a function that returns true (valid) or false (invalid)
     * Second arg: the error config if the check fails
     */
    .refine((data) => data.oldPassword !== data.newPassword, {
        message: 'New password cannot be the same as your current password',
        path: ['newPassword'], // Which field the error is attached to
    });