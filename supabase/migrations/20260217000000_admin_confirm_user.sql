-- Admin: Confirm User Email + Show Confirmation Status
-- Adds ability to manually confirm users whose email verification link expired.

-- 1. Update admin_search_users to include email_confirmed_at
CREATE OR REPLACE FUNCTION public.admin_search_users(
  search_email TEXT
)
RETURNS JSONB AS $$
DECLARE
  caller_email TEXT;
  results JSONB;
BEGIN
  -- Verify caller is admin
  SELECT email INTO caller_email
  FROM auth.users
  WHERE id = auth.uid();

  IF caller_email IS DISTINCT FROM 'augustovalbuena@gmail.com' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: admin access required');
  END IF;

  SELECT jsonb_agg(row_to_json(t))
  INTO results
  FROM (
    SELECT
      u.id,
      u.email,
      u.created_at AS user_created_at,
      u.email_confirmed_at,
      s.plan,
      s.status,
      s.trial_end,
      s.stripe_subscription_id
    FROM auth.users u
    LEFT JOIN public.subscriptions s ON s.user_id = u.id
    WHERE search_email = '' OR u.email ILIKE search_email || '%'
    ORDER BY u.created_at DESC
    LIMIT 50
  ) t;

  RETURN jsonb_build_object('success', true, 'users', COALESCE(results, '[]'::jsonb));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Admin confirm user function
CREATE OR REPLACE FUNCTION public.admin_confirm_user(
  target_email TEXT
)
RETURNS JSONB AS $$
DECLARE
  caller_email TEXT;
  target_user_id UUID;
  already_confirmed TIMESTAMPTZ;
BEGIN
  -- Verify caller is admin
  SELECT email INTO caller_email
  FROM auth.users
  WHERE id = auth.uid();

  IF caller_email IS DISTINCT FROM 'augustovalbuena@gmail.com' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: admin access required');
  END IF;

  -- Find target user and check current status
  SELECT id, email_confirmed_at INTO target_user_id, already_confirmed
  FROM auth.users
  WHERE email = target_email;

  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found: ' || target_email);
  END IF;

  IF already_confirmed IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User already confirmed');
  END IF;

  -- Confirm the user's email
  UPDATE auth.users
  SET email_confirmed_at = NOW()
  WHERE id = target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_email', target_email,
    'confirmed_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.admin_confirm_user(TEXT) TO authenticated;
