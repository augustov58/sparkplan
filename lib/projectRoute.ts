/**
 * #297 (owner ruling 2026-11-23): a project page redirects to the dashboard
 * only when a loaded projects list lacks the project — never while the list
 * or the session behind it is (re)loading.
 */

/**
 * The projects list is loading until it has been fetched for the signed-in
 * user. Read at render time: right after a reload the hook's `loading` state
 * is already false (it ran once with no user), and a child's <Navigate>
 * effect runs before the hook's effect could set it back.
 */
export function isProjectsListLoading(
  loading: boolean,
  userId: string | null | undefined,
  fetchedForUserId: string | null,
): boolean {
  return loading || (!!userId && fetchedForUserId !== userId);
}

/** What a project route does with the list it has. */
export function projectRouteState(projectFound: boolean, projectsLoading: boolean): 'render' | 'wait' | 'redirect' {
  if (projectFound) return 'render';
  return projectsLoading ? 'wait' : 'redirect';
}
