-- Profile Creation Trigger + Backfill
-- Auto-creates a profiles row when a new user signs up.
-- Previously, profiles table existed but had no trigger — new users got auth.users
-- entries and subscriptions but no profile row, causing orphaned data.

-- 1. Function: create profile from auth.users data on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger: fires after every new auth user row
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- 3. Backfill: sync existing auth.users into profiles (idempotent)
INSERT INTO profiles (id, email, full_name)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', '')
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), profiles.full_name);
