"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginSchema = exports.registerSchema = exports.validateRequest = void 0;
const zod_1 = require("zod");
const validateRequest = (schema) => {
    return (req, res, next) => {
        try {
            schema.parse(req.body);
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                console.log('Validation Error:', JSON.stringify(error.errors, null, 2));
                console.log('Request Body:', req.body);
                return res.status(400).json({
                    status: 'error',
                    message: 'Validation failed',
                    errors: error.errors
                });
            }
            return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
        }
    };
};
exports.validateRequest = validateRequest;
exports.registerSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    full_name: zod_1.z.string().min(2, 'Name must be at least 2 characters'),
    role: zod_1.z.enum(['parent', 'doctor', 'therapist']),
    state: zod_1.z.string().trim().optional(),
    district: zod_1.z.string().trim().optional(),
}).superRefine((data, ctx) => {
    const isProvider = data.role === 'doctor' || data.role === 'therapist';
    if (isProvider && !data.state) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['state'],
            message: 'State is required for doctors and therapists',
        });
    }
    if (isProvider && !data.district) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['district'],
            message: 'District is required for doctors and therapists',
        });
    }
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string()
});
