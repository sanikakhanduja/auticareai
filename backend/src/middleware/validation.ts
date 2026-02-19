import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

export const validateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
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

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['parent', 'doctor', 'therapist']),
  state: z.string().trim().optional(),
  district: z.string().trim().optional(),
}).superRefine((data, ctx) => {
  const isProvider = data.role === 'doctor' || data.role === 'therapist';
  if (isProvider && !data.state) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['state'],
      message: 'State is required for doctors and therapists',
    });
  }
  if (isProvider && !data.district) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['district'],
      message: 'District is required for doctors and therapists',
    });
  }
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});
