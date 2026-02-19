"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const passport_1 = __importDefault(require("passport"));
const passport_google_oauth20_1 = require("passport-google-oauth20");
const supabase_1 = require("../config/supabase");
const validation_1 = require("../middleware/validation");
const router = express_1.default.Router();
// Google OAuth Strategy
passport_1.default.use(new passport_google_oauth20_1.Strategy({
    clientID: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackURL: "/api/auth/google/callback"
}, async function (accessToken, refreshToken, profile, cb) {
    // In a real scenario, you'd find/create user in Supabase here
    // For now, we'll pass the profile
    return cb(null, profile);
}));
// Signup Route
router.post('/signup', (0, validation_1.validateRequest)(validation_1.registerSchema), async (req, res) => {
    const { email, password, full_name, role, state, district } = req.body;
    try {
        // 1. Create User in Supabase Auth
        const { data: authData, error: authError } = await supabase_1.supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto confirm for this example
            user_metadata: { full_name, role, state, district }
        });
        if (authError) {
            console.error('Supabase Auth Error:', authError);
            return res.status(400).json({ status: 'error', message: authError.message });
        }
        if (!authData.user) {
            console.error('User creation failed: No user returned');
            return res.status(500).json({ status: 'error', message: 'User creation failed' });
        }
        // 2. Insert Profile Data Manually (if trigger fails)
        // We try to insert into profiles to ensure data consistency
        const { error: profileError } = await supabase_1.supabase
            .from('profiles')
            .upsert({
            id: authData.user.id,
            full_name,
            role,
            email,
            state: state ?? null,
            district: district ?? null,
        });
        if (profileError) {
            console.error('Profile Creation Error:', profileError);
            // We don't block registration if profile fails, but we log it.
            // In strict mode, you might want to rollback user creation.
        }
        res.status(201).json({
            status: 'success',
            message: 'User registered successfully',
            user: {
                id: authData.user.id,
                email: authData.user.email,
                role: role
            }
        });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
});
// Login Route
router.post('/login', (0, validation_1.validateRequest)(validation_1.loginSchema), async (req, res) => {
    const { email, password } = req.body;
    try {
        const { data, error } = await supabase_1.supabase.auth.signInWithPassword({
            email,
            password
        });
        if (error) {
            return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
        }
        res.json({
            status: 'success',
            token: data.session?.access_token,
            user: data.user
        });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
});
// Google Routes
router.get('/google', passport_1.default.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport_1.default.authenticate('google', { failureRedirect: '/login', session: false }), function (req, res) {
    // Successful authentication, redirect home.
    // In a real app, you would issue a JWT here and redirect with it
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=mock_token`);
});
exports.default = router;
