# A reload on a project page landed on the dashboard (#297)

**Problem:** `App.tsx::ProjectWrapper` rendered `<Navigate to="/" />` whenever `projects.find(id)` was undefined. After a browser reload, `hooks/useProjects.ts` first ran with no user. It set `projects = []` and `loading = false`. When the session arrived, the first render with the user still had `[]` and `loading = false`, so the page redirected before the fetch started. The e2e specs enter from the dashboard card, which is why it showed up there only intermittently (#179's spec, 2026-11-21).

## Approach

1. **Reproduce the reliable case first:** a reload on `#/project/<id>/short-circuit` → `#/` every time. `refreshSession()` and an unknown id already behaved, so they became guardrails.
2. **Why `setLoading(true)` in the hook's effect can't fix it:** React runs child effects before parent effects. `<Navigate>` (a child of the wrapper) navigates in its effect before `useProjects`' effect (in the parent `App`) runs. The loading signal has to be correct during render.
3. **Render-time loading:** `useProjects` stores `fetchedForUserId`, set in the fetch's `finally` (even on error, so a failed fetch doesn't spin forever). `loading` = `isProjectsListLoading(loading, user?.id, fetchedForUserId)` (`lib/projectRoute.ts`). No consumer read `useProjects().loading` before, so redefining it is safe.
4. **The wrapper renders when it has the project, even during a refetch.** A token refresh re-runs the hook's effect (new user object, same id); it must not unmount the open page and its form state. It shows a spinner only when the project is missing and the list is loading. It redirects only when a loaded list lacks the project (`projectRouteState`).

## Reusable rules

- **A guard that redirects on "missing" must know the difference between missing and not loaded yet**, and must read that from state that is correct during render, not from an effect.
- **Test route guards with a reload, not only by entering from a link:** in-app navigation keeps the list loaded and hides the race.
