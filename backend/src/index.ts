import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth';
import doctorRoutes from './routes/doctors';
import { supabase } from './config/supabase';
import screeningRoutes from './routes/screening';
import progressRoutes from './routes/progress';


dotenv.config();

if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID.includes('your_google_client_id')) {
  console.warn('\x1b[33m%s\x1b[0m', '⚠️  WARNING: Google OAuth keys are missing or invalid in .env. Google Sign-In will not work.');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY.includes('your_supabase_service_role_key')) {
  console.warn('\x1b[31m%s\x1b[0m', '❌ CRITICAL: Supabase Service Role Key is missing or invalid. Signups will fail.');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet());
app.use(cors({
  origin: true, // Allow any origin dynamically (for development)
  credentials: true
}));
app.use(express.json());

// Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/screening', screeningRoutes);
app.use('/api/progress', progressRoutes);


// Health Check
app.get('/health', async (req, res) => {
  const { error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
  if (error) {
    return res.status(500).json({ status: 'error', message: 'Database connection failed' });
  }
  res.json({ status: 'ok', message: 'Backend is running' });
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ status: 'error', message: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
