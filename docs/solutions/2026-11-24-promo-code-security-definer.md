# Promo codes: listable and redeemable for any account with the public key

**Problem.** A readiness check ran Supabase's security advisor. It flagged `redeem_promo_code` as a `SECURITY DEFINER` function the anon role can execute. Reading the function and the tables around it showed two holes that together gave away paid plans:
1. The function upgraded the account named by its `p_user_id` argument, and anyone holding the public anon key (it ships in the app bundle) could call it.
2. An RLS policy, "Anyone can view active promo codes" (`to public using (is_active = true)`), let the same key `SELECT` the codes.

Neither object was in a migration; both were made in the SQL editor in January.

## Approach
- **Read the function's source and the policies on every table it touches** (`pg_get_functiondef`, `pg_policies`, `has_function_privilege`). The advisor only named the function; the readable codes came from the policy next to it.
- **Reproduce without writing or exposing anything.** Call the RPC as anon with a code that doesn't exist and an arbitrary account id. It answers "Invalid or expired promo code" with HTTP 200, so the call ran, and the lookup fails before any write. Read the table as anon with `select=id&limit=0` and `Prefer: count=exact`: `content-range: */4` proves it is readable without fetching a code.
- **Fix in the function, keep its signature.** `v_user := auth.uid()`; refuse when null or when `p_user_id` differs; use `v_user` everywhere. The client (`hooks/useSubscription.ts`) and `lib/database.types.ts` don't change. Pin `search_path = ''` and qualify names (lint 0011). `REVOKE EXECUTE … FROM PUBLIC, anon`. Drop the read policy after grepping that the app never reads the table directly.
- **Spec it read-only** (`tests/e2e/issues/issue-<N>.spec.ts`): anon and QA list 0 rows; anon gets `42501`; the QA session redeeming for another id is refused before the lookup; its own call still answers "Invalid or expired promo code"; the Pricing page's promo box still works. The happy path (a real redemption) runs in a transaction that raises at the end, so nothing persists.

## Judgment calls
- `p_user_id` stays rather than being dropped: removing it changes the RPC signature, the generated types and the client in one deploy. Requiring it to equal `auth.uid()` makes it harmless.
- The 4 active codes (unused since January) stay active, by the owner's call. They were readable until the fix, so anyone who copied one can still redeem it once per account.
- The Supabase MCP `apply_migration` declined twice with no prompt shown: the server asks its own confirmation for destructive statements (`DROP POLICY`), and this client can't show it. The owner ran the file in the SQL editor instead of the SQL being split to dodge the check.

## Reusable rule
A `SECURITY DEFINER` function takes the user from `auth.uid()`, never from an argument, and anon can't execute it unless it must. When the advisor flags one, read the RLS policies of the tables it touches in the same pass. Every database object comes from a migration in the repo, so a review of the repo sees it.
