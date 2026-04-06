import { ZodError } from 'zod';

export const validate = (schema, source = 'body') => async (req, res, next) => {
    try {
        const data =
            source === 'query' ? req.query :
                source === 'params' ? req.params :
                    req.body;

        const cleanData = await schema.parseAsync(data);

        // ✅ spread instead of reassign — req.query and req.params are read-only
        if (source === 'query') Object.assign(req.query, cleanData);
        else if (source === 'params') Object.assign(req.params, cleanData);
        else req.body = cleanData;

        next();
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({
                statusCode: 400,
                status: 'failed',
                message: 'Validation failed',
                errors: error.issues.map((err) => ({
                    field: err.path[0] ?? 'unknown',
                    message: err.message,
                })),
            });
        }
        next(error);
    }
};