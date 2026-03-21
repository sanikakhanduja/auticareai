# AutiCare AI Backend

Secure Node.js/Express server for AutiCare AI, handling Authentication, Validation, and External Integrations.

## Features
- **Express Server**: Robust REST API architecture.
- **Security**: Helmet, Rate Limiting, CORS.
- **Validation**: Zod middleware for strict input validation.
- **Authentication**: 
  - Email/Password via Supabase Admin (bypassing client-side limits).
  - Google OAuth 2.0 via Passport.js.

## Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Variables**:
   Update `.env` with your credentials:
   ```env
   PORT=3000
   FRONTEND_URL=http://localhost:5173
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   ```

3. **Run Server**:
   ```bash
   npm run dev
   ```

## API Endpoints

- `POST /api/auth/signup`: Register new user (Parent/Doctor/Therapist).
- `POST /api/auth/login`: Sign in.
- `GET /api/auth/google`: Google OAuth initiation.
