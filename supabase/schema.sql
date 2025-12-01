-- NEC Pro Compliance Database Schema
-- Supabase PostgreSQL Database
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS & AUTHENTICATION
-- ============================================================================
-- Note: Supabase Auth handles users table automatically
-- We just need to add our custom profile data

CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    company_name TEXT,
    license_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only read/update their own profile
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- ============================================================================
-- PROJECTS
-- ============================================================================

CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Residential', 'Commercial', 'Industrial')),
    nec_edition TEXT NOT NULL CHECK (nec_edition IN ('2020', '2023')),
    status TEXT NOT NULL CHECK (status IN ('Planning', 'In Progress', 'Under Review', 'Compliant')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),

    -- Service parameters
    service_voltage INTEGER NOT NULL,
    service_phase INTEGER NOT NULL CHECK (service_phase IN (1, 3)),

    -- Settings (JSON)
    settings JSONB NOT NULL DEFAULT '{}',

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_projects_created_at ON public.projects(created_at DESC);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own projects"
    ON public.projects FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own projects"
    ON public.projects FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
    ON public.projects FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
    ON public.projects FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- LOADS
-- ============================================================================

CREATE TABLE public.loads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL,
    watts INTEGER NOT NULL CHECK (watts > 0),
    type TEXT NOT NULL CHECK (type IN ('lighting', 'receptacle', 'motor', 'hvac', 'appliance', 'range', 'dryer', 'water_heater')),
    continuous BOOLEAN DEFAULT FALSE,
    phase TEXT NOT NULL CHECK (phase IN ('A', 'B', 'C', '3-Phase')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_loads_project_id ON public.loads(project_id);

-- Enable RLS
ALTER TABLE public.loads ENABLE ROW LEVEL SECURITY;

-- Policies: Users can manage loads for their own projects
CREATE POLICY "Users can view loads for own projects"
    ON public.loads FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = loads.project_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create loads for own projects"
    ON public.loads FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = loads.project_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update loads for own projects"
    ON public.loads FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = loads.project_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete loads for own projects"
    ON public.loads FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = loads.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- ============================================================================
-- PANELS
-- ============================================================================

CREATE TABLE public.panels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    bus_rating INTEGER NOT NULL CHECK (bus_rating > 0),
    voltage INTEGER NOT NULL,
    phase INTEGER NOT NULL CHECK (phase IN (1, 3)),
    main_breaker_amps INTEGER,
    location TEXT,
    fed_from UUID REFERENCES public.panels(id) ON DELETE SET NULL,
    is_main BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_panels_project_id ON public.panels(project_id);
CREATE INDEX idx_panels_fed_from ON public.panels(fed_from);

-- Enable RLS
ALTER TABLE public.panels ENABLE ROW LEVEL SECURITY;

-- Policies: Users can manage panels for their own projects
CREATE POLICY "Users can view panels for own projects"
    ON public.panels FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = panels.project_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create panels for own projects"
    ON public.panels FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = panels.project_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update panels for own projects"
    ON public.panels FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = panels.project_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete panels for own projects"
    ON public.panels FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = panels.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- ============================================================================
-- CIRCUITS
-- ============================================================================

CREATE TABLE public.circuits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    panel_id UUID REFERENCES public.panels(id) ON DELETE CASCADE,
    circuit_number INTEGER NOT NULL,
    description TEXT NOT NULL,
    breaker_amps INTEGER NOT NULL,
    pole INTEGER NOT NULL CHECK (pole IN (1, 2, 3)),
    load_watts INTEGER NOT NULL,
    conductor_size TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_circuits_project_id ON public.circuits(project_id);
CREATE INDEX idx_circuits_panel_id ON public.circuits(panel_id);

-- Enable RLS
ALTER TABLE public.circuits ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view circuits for own projects"
    ON public.circuits FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = circuits.project_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create circuits for own projects"
    ON public.circuits FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = circuits.project_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update circuits for own projects"
    ON public.circuits FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = circuits.project_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete circuits for own projects"
    ON public.circuits FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = circuits.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- ============================================================================
-- ISSUES
-- ============================================================================

CREATE TABLE public.issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    article TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Open', 'Resolved')),
    severity TEXT NOT NULL CHECK (severity IN ('Critical', 'Warning', 'Info')),
    location TEXT,
    photo_url TEXT,
    assigned_to TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_issues_project_id ON public.issues(project_id);
CREATE INDEX idx_issues_status ON public.issues(status);

-- Enable RLS
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

-- Policies (same pattern as circuits)
CREATE POLICY "Users can view issues for own projects"
    ON public.issues FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = issues.project_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage issues for own projects"
    ON public.issues FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = issues.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- ============================================================================
-- INSPECTION ITEMS
-- ============================================================================

CREATE TABLE public.inspection_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    category TEXT NOT NULL,
    requirement TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Pending', 'Pass', 'Fail', 'N/A')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_inspection_items_project_id ON public.inspection_items(project_id);

-- Enable RLS
ALTER TABLE public.inspection_items ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage inspection items for own projects"
    ON public.inspection_items FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = inspection_items.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- ============================================================================
-- GROUNDING DETAILS
-- ============================================================================

CREATE TABLE public.grounding_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    electrodes TEXT[] NOT NULL DEFAULT '{}',
    gec_size TEXT NOT NULL,
    bonding TEXT[] NOT NULL DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_grounding_details_project_id ON public.grounding_details(project_id);

-- Enable RLS
ALTER TABLE public.grounding_details ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage grounding details for own projects"
    ON public.grounding_details FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = grounding_details.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grounding_details_updated_at
    BEFORE UPDATE ON public.grounding_details
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Composite indexes for common queries
CREATE INDEX idx_projects_user_status ON public.projects(user_id, status);
CREATE INDEX idx_loads_project_type ON public.loads(project_id, type);
CREATE INDEX idx_issues_project_status ON public.issues(project_id, status);

-- ============================================================================
-- INITIAL DATA (Optional)
-- ============================================================================

-- You can add seed data here if needed
-- Example: Default inspection checklist items

-- ============================================================================
-- NOTES
-- ============================================================================

-- 1. Row Level Security (RLS) is enabled on all tables
-- 2. Users can only access their own data
-- 3. All foreign keys cascade on delete
-- 4. Updated_at timestamps are automatically maintained
-- 5. UUIDs are used for all primary keys
-- 6. JSONB is used for flexible settings data

-- To apply this schema:
-- 1. Go to your Supabase project dashboard
-- 2. Navigate to SQL Editor
-- 3. Paste this entire file
-- 4. Click "Run"
