-- Promo codes: only a signed-in user can redeem one, only for their own
-- account, and nobody can list the codes.
--
-- Found 2026-11-24 in a readiness check (Supabase security advisor). Neither
-- object below was in a migration; both were made in the SQL editor.
--
-- 1. public.redeem_promo_code(p_code, p_user_id) is SECURITY DEFINER (it skips
--    RLS) and took the account to upgrade from its p_user_id argument, while
--    the anon role could execute it. The new body takes the account from the
--    caller's session (auth.uid()); p_user_id stays in the signature, so the
--    client (hooks/useSubscription.ts) and lib/database.types.ts don't change,
--    and must equal auth.uid(). Pinned search_path with qualified names
--    (Supabase lint 0011). Everything else in the body is unchanged.
-- 2. Policy "Anyone can view active promo codes" let the anon key SELECT the
--    active codes. The app never reads promo_codes directly (only through the
--    function), so the policy is dropped; the service-role policy stays.
--
-- Checked on prod before the change: 4 active codes, 0 redemptions ever.

CREATE OR REPLACE FUNCTION public.redeem_promo_code(p_code text, p_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_promo public.promo_codes%ROWTYPE;
  v_subscription public.subscriptions%ROWTYPE;
  v_result JSON;
BEGIN
  -- The account comes from the session, never from the argument
  IF v_user IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Please sign in to redeem a promo code');
  END IF;
  IF p_user_id IS DISTINCT FROM v_user THEN
    RETURN json_build_object('success', false, 'error', 'A promo code can only be redeemed for your own account');
  END IF;

  -- Find the promo code
  SELECT * INTO v_promo FROM public.promo_codes
  WHERE code = UPPER(p_code)
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR uses_count < max_uses);

  IF v_promo.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired promo code');
  END IF;

  -- Check if user already redeemed this code
  IF EXISTS (SELECT 1 FROM public.promo_code_redemptions WHERE promo_code_id = v_promo.id AND user_id = v_user) THEN
    RETURN json_build_object('success', false, 'error', 'You have already redeemed this code');
  END IF;

  -- Get current subscription
  SELECT * INTO v_subscription FROM public.subscriptions WHERE user_id = v_user;

  IF v_subscription.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No subscription found');
  END IF;

  -- Record the redemption
  INSERT INTO public.promo_code_redemptions (promo_code_id, user_id, previous_plan, previous_status)
  VALUES (v_promo.id, v_user, v_subscription.plan, v_subscription.status);

  -- Update the subscription
  UPDATE public.subscriptions SET
    plan = v_promo.plan,
    status = 'active',
    trial_start = NOW(),
    trial_end = NOW() + (v_promo.duration_days || ' days')::INTERVAL,
    updated_at = NOW()
  WHERE user_id = v_user;

  -- Increment uses count
  UPDATE public.promo_codes SET
    uses_count = uses_count + 1,
    updated_at = NOW()
  WHERE id = v_promo.id;

  RETURN json_build_object(
    'success', true,
    'plan', v_promo.plan,
    'duration_days', v_promo.duration_days,
    'message', 'Promo code redeemed successfully!'
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.redeem_promo_code(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code(text, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Anyone can view active promo codes" ON public.promo_codes;
