import { ZodError } from 'zod';

/**
 * validate() is a HOF — Higher Order Function.
 * It takes a Zod schema and returns an Express middleware.
 *
 * HOF means: a function that takes a function (or schema)
 * as an argument and returns a new function.
 *
 * Usage on route: router.post('/register', validate(registerDto), register)
 *                                           └──────────────────┘
 *                                           this returns a middleware fn
 */
export const validate = (schema) => async (req, res, next) => {
    try {
        /**
         * schema.parseAsync() does TWO things at once:
         * 1. VALIDATES  — checks all rules (required, min, format, etc.)
         * 2. TRANSFORMS — trims strings, lowercases email, applies defaults
         *
         * If validation passes, it returns the clean data.
         * If it fails, it throws a ZodError.
         */
        const cleanData = await schema.parseAsync(req.body);

        /**
         * Replace the raw req.body with the clean, transformed data.
         * Now your controller gets trimmed, lowercased, sanitized data
         * without doing anything extra.
         */
        req.body = cleanData;

        next(); // Everything is clean — proceed to controller
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({
                statusCode: 400,
                status: 'failed',
                message: 'Validation failed',
                errors: error.issues.map((err) => ({  // ✅ .issues not .errors
                    field: err.path[0] ?? 'unknown',
                    message: err.message,
                })),
            });
        }

        // Not a validation error — pass to global error handler
        next(error);
    }
};