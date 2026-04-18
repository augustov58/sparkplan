-- Admin User Management RPCs
-- Extends admin panel with create and delete user capabilities.

-- 1. Create a new user with a specific plan
CREATE OR REPLACE FUNCTION public.admin_create_user(
  user_email TEXT,
  user_password TEXT,
  user_plan TEXT DEFAULT 'free'
)
RETURNS JSONB AS $$
DECLARE
  caller_email TEXT;
  new_user_id UUID;
BEGIN
  -- Verify caller is admin
  SELECT email INTO caller_email
  FROM auth.users WHERE id = auth.uid();

  IF caller_email IS DISTINCT FROM 'augustovalbuena@gmail.com' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: admin access required');
  END IF;

  -- Validate plan
  IF user_plan NOT IN ('free', 'starter', 'pro', 'business', 'enterprise') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid plan: ' || user_plan);
  END IF;

  -- Check if email already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = user_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User already exists: ' || user_email);
  END IF;

  -- Create user in auth.users
  new_user_id := gen_random_uuid();
  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    created_at, updated_at, confirmation_token,
    raw_app_meta_data, raw_user_meta_data
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id, 'authenticated', 'authenticated', user_email,
    crypt(user_password, gen_salt('bf')),
    NOW(), NOW(), NOW(), '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb
  );

  -- Create identity record (required for Supabase auth to work)
  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), new_user_id, user_email,
    jsonb_build_object('sub', new_user_id::text, 'email', user_email),
    'email', NOW(), NOW(), NOW()
  );

  -- The trigger will auto-create a subscription, but we want a specific plan
  -- Wait for trigger, then override
  UPDATE public.subscriptions
  SET plan = user_plan, status = 'active', trial_end = NULL
  WHERE user_id = new_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', new_user_id,
    'email', user_email,
    'plan', user_plan
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Delete a user entirely (cascades to subscriptions via FK)
CREATE OR REPLACE FUNCTION public.admin_delete_user(
  target_email TEXT
)
RETURNS JSONB AS $$
DECLARE
  caller_email TEXT;
  target_user_id UUID;
BEGIN
  -- Verify caller is admin
  SELECT email INTO caller_email
  FROM auth.users WHERE id = auth.uid();

  IF caller_email IS DISTINCT FROM 'augustovalbuena@gmail.com' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: admin access required');
  END IF;

  -- Prevent self-deletion
  IF target_email = 'augustovalbuena@gmail.com' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot delete admin user');
  END IF;

  -- Find target user
  SELECT id INTO target_user_id
  FROM auth.users WHERE email = target_email;

  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found: ' || target_email);
  END IF;

  -- Delete user (cascades to subscriptions, identities, etc.)
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true, 'deleted_email', target_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.admin_create_user(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(TEXT) TO authenticated;
