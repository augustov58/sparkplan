-- 14-Day Business Trial for New Signups + Admin Plan Override
-- New users now start with a 14-day Business trial instead of free plan.
-- After trial expires, useSubscription.ts effectivePlan falls back to 'free'.

-- 1. Update the new-user trigger to start with Business trial
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan, status, trial_start, trial_end)
  VALUES (NEW.id, 'business', 'trialing', NOW(), NOW() + INTERVAL '14 days')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Admin plan override RPC
-- Only callable by the admin user (augustovalbuena@gmail.com).
-- Sets target user's plan directly, bypassing Stripe.
CREATE OR REPLACE FUNCTION public.admin_set_user_plan(
  target_email TEXT,
  new_plan TEXT
)
RETURNS JSONB AS $$
DECLARE
  caller_email TEXT;
  target_user_id UUID;
  result JSONB;
BEGIN
  -- Verify caller is admin
  SELECT email INTO caller_email
  FROM auth.users
  WHERE id = auth.uid();

  IF caller_email IS DISTINCT FROM 'augustovalbuena@gmail.com' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: admin access required');
  END IF;

  -- Validate plan value
  IF new_plan NOT IN ('free', 'starter', 'pro', 'business', 'enterprise') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid plan: ' || new_plan);
  END IF;

  -- Find target user
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = target_email;

  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found: ' || target_email);
  END IF;

  -- Update subscription
  UPDATE public.subscriptions
  SET plan = new_plan,
      status = 'active',
      trial_end = NULL,
      updated_at = NOW()
  WHERE user_id = target_user_id;

  -- If no subscription row exists, create one
  IF NOT FOUND THEN
    INSERT INTO public.subscriptions (user_id, plan, status)
    VALUES (target_user_id, new_plan, 'active');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_email', target_email,
    'new_plan', new_plan
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Admin user search RPC (search by email prefix)
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
      s.plan,
      s.status,
      s.trial_end,
      s.stripe_subscription_id
    FROM auth.users u
    LEFT JOIN public.subscriptions s ON s.user_id = u.id
    WHERE u.email ILIKE search_email || '%'
    ORDER BY u.created_at DESC
    LIMIT 20
  ) t;

  RETURN jsonb_build_object('success', true, 'users', COALESCE(results, '[]'::jsonb));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.admin_set_user_plan(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_search_users(TEXT) TO authenticated;
