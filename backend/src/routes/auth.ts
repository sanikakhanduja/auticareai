import express from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { supabase } from '../config/supabase';
import { validateRequest, registerSchema, loginSchema } from '../middleware/validation';

const router = express.Router();

// Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackURL: "/api/auth/google/callback"
  },
  async function(accessToken, refreshToken, profile, cb) {
    // In a real scenario, you'd find/create user in Supabase here
    // For now, we'll pass the profile
    return cb(null, profile);
  }
));

// Signup Route
router.post('/signup', validateRequest(registerSchema), async (req, res) => {
  const { email, password, full_name, role, state, district } = req.body;

  try {
    // 1. Create User in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
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
    const { error: profileError } = await supabase
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

  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// Login Route
router.post('/login', validateRequest(loginSchema), async (req, res) => {
  const { email, password } = req.body;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
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

  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// Google Routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login', session: false }),
  function(req, res) {
    // Successful authentication, redirect home.
    // In a real app, you would issue a JWT here and redirect with it
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=mock_token`); 
  }
);

export default router;
