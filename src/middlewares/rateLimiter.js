import rateLimit from 'express-rate-limit';
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        statusCode: 429,
        status: "failed",
        message: "Too many requests from this IP. Please try again after 15 minutes."
    },
    standardHeaders: true,
    legacyHeaders: false,
});

export const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: {
        statusCode: 429,
        status: "failed",
        message: "Too many authentication attempts. Please try again after 1 hour."
    },
    standardHeaders: true,
    legacyHeaders: false,
    // skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1',
});

export const otpLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 25,                           // ✅ Strict — this is now the enforcer for OTP routes
    message: {
        statusCode: 429,
        status: "failed",
        message: "Too many OTP attempts. Please wait 10 minutes before trying again."
    },
    standardHeaders: true,
    legacyHeaders: false,
});

export const sensitiveLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 100,
    message: {
        statusCode: 429,
        status: "failed",
        message: "Too many sensitive actions. Please try again after 1 hour."
    },
    standardHeaders: true,
    legacyHeaders: false,
});