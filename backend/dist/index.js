"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const auth_1 = __importDefault(require("./routes/auth"));
const doctors_1 = __importDefault(require("./routes/doctors"));
const supabase_1 = require("./config/supabase");
const screening_1 = __importDefault(require("./routes/screening"));
const progress_1 = __importDefault(require("./routes/progress"));
const agents_1 = __importDefault(require("./routes/agents"));
dotenv_1.default.config();
if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID.includes('your_google_client_id')) {
    console.warn('\x1b[33m%s\x1b[0m', '⚠️  WARNING: Google OAuth keys are missing or invalid in .env. Google Sign-In will not work.');
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY.includes('your_supabase_service_role_key')) {
    console.warn('\x1b[31m%s\x1b[0m', '❌ CRITICAL: Supabase Service Role Key is missing or invalid. Signups will fail.');
}
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Security Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: true, // Allow any origin dynamically (for development)
    credentials: true
}));
app.use(express_1.default.json());
// Request Logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
// Rate Limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/doctors', doctors_1.default);
app.use('/api/screening', screening_1.default);
app.use('/api/progress', progress_1.default);
app.use('/api/agents', agents_1.default);
// Health Check
app.get('/health', async (req, res) => {
    const { error } = await supabase_1.supabase.from('profiles').select('count', { count: 'exact', head: true });
    if (error) {
        return res.status(500).json({ status: 'error', message: 'Database connection failed' });
    }
    res.json({ status: 'ok', message: 'Backend is running' });
});
// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ status: 'error', message: 'Something went wrong!' });
});
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
