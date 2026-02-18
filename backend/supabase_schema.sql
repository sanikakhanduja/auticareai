-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  specialty TEXT,
  state TEXT,
  district TEXT,
  role TEXT CHECK (role IN ('parent', 'doctor', 'therapist')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Children Table
CREATE TABLE public.children (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  parent_id UUID REFERENCES public.profiles(id) NOT NULL,
  name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  screening_status TEXT CHECK (screening_status IN ('not-started', 'in-progress', 'pending-review', 'under-observation', 'diagnosed')) DEFAULT 'not-started',
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')),
  assigned_doctor_id UUID REFERENCES public.profiles(id),
  assigned_therapist_id UUID REFERENCES public.profiles(id),
  observation_end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Screening Results Table
CREATE TABLE public.screening_results (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  child_id UUID REFERENCES public.children(id) ON DELETE CASCADE NOT NULL,
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')),
  indicators JSONB, -- Array of strings
  cv_report JSONB, -- Full CV report JSON
  video_url TEXT,
  answers JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Reports Table
CREATE TABLE public.reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  child_id UUID REFERENCES public.children(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES public.profiles(id) NOT NULL,
  type TEXT CHECK (type IN ('observation', 'diagnostic')),
  content JSONB NOT NULL, -- Flexible structure for different report types
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Therapy Sessions Table
CREATE TABLE public.therapy_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  child_id UUID REFERENCES public.children(id) ON DELETE CASCADE NOT NULL,
  therapist_id UUID REFERENCES public.profiles(id) NOT NULL,
  type TEXT CHECK (type IN ('speech', 'motor', 'social')),
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  status TEXT CHECK (status IN ('scheduled', 'completed', 'cancelled')) DEFAULT 'scheduled',
  goals TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Therapist Feedback Table
CREATE TABLE public.therapist_feedback (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  therapist_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  child_id UUID REFERENCES public.children(id) ON DELETE CASCADE NOT NULL,
  rating INT CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Second Opinion Requests Table
CREATE TABLE public.second_opinion_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  child_id UUID REFERENCES public.children(id) ON DELETE CASCADE NOT NULL,
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT CHECK (status IN ('requested', 'in-review', 'completed')) DEFAULT 'requested',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screening_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapy_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapist_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.second_opinion_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Profiles
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Children
-- Parent can view their own children
CREATE POLICY "Parents can view own children" ON public.children
  FOR SELECT USING (auth.uid() = parent_id);

-- Parent can insert their own children
CREATE POLICY "Parents can insert own children" ON public.children
  FOR INSERT WITH CHECK (auth.uid() = parent_id);

-- Parent can update their own children
CREATE POLICY "Parents can update own children" ON public.children
  FOR UPDATE USING (auth.uid() = parent_id);

-- Doctors can view all children (for diagnosis discovery) or assigned
CREATE POLICY "Doctors can view all children" ON public.children
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'doctor')
  );

-- Doctors can update children assigned to them (e.g. changing status)
CREATE POLICY "Doctors can update assigned children" ON public.children
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'doctor')
  );

-- Therapists can view assigned children (or diagnosed ones)
CREATE POLICY "Therapists can view assigned children" ON public.children
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'therapist')
  );

-- Reports
CREATE POLICY "Parents can view reports for their children" ON public.reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.children WHERE id = child_id AND parent_id = auth.uid())
  );

CREATE POLICY "Professionals can view reports" ON public.reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('doctor', 'therapist'))
  );

CREATE POLICY "Professionals can create reports" ON public.reports
  FOR INSERT WITH CHECK (
    auth.uid() = author_id AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('doctor', 'therapist'))
  );

-- Therapist Feedback
CREATE POLICY "Therapist feedback viewable by everyone" ON public.therapist_feedback
  FOR SELECT USING (true);

CREATE POLICY "Parents can submit feedback for their children" ON public.therapist_feedback
  FOR INSERT WITH CHECK (
    auth.uid() = parent_id AND
    EXISTS (
      SELECT 1
      FROM public.children
      WHERE id = child_id
        AND parent_id = auth.uid()
        AND assigned_therapist_id = therapist_id
    )
  );

-- Second Opinion Requests
CREATE POLICY "Parents can view second opinion requests" ON public.second_opinion_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.children
      WHERE id = child_id
        AND parent_id = auth.uid()
    )
  );

CREATE POLICY "Parents can request second opinion" ON public.second_opinion_requests
  FOR INSERT WITH CHECK (
    auth.uid() = parent_id AND
    EXISTS (
      SELECT 1
      FROM public.children
      WHERE id = child_id
        AND parent_id = auth.uid()
    ) AND
    EXISTS (
      SELECT 1
      FROM public.reports
      WHERE id = report_id
        AND child_id = second_opinion_requests.child_id
        AND type = 'diagnostic'
    )
  );

CREATE POLICY "Doctors can view second opinion requests" ON public.second_opinion_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'doctor'
    )
  );

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, specialty, state, district)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    COALESCE(new.raw_user_meta_data->>'role', 'parent'),
    new.raw_user_meta_data->>'specialty',
    new.raw_user_meta_data->>'state',
    new.raw_user_meta_data->>'district'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
