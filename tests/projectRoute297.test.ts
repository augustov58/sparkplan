/**
 * #297 (owner ruling 2026-11-23): a project page redirects to the dashboard
 * only when a loaded projects list lacks the project, never while the list or
 * auth is (re)loading. On main a reload on #/project/<id>/... landed on #/:
 * the list hook ran once with no user (loading=false, []), and the first
 * render with the user already redirected.
 */
import { describe, it, expect } from 'vitest';
import { isProjectsListLoading, projectRouteState } from '../lib/projectRoute';

describe('#297 projects list loading, read at render time', () => {
  it('right after a reload: the user just arrived, nothing fetched for them yet → loading', () => {
    // the hook's own state already says false (it ran once with no user)
    expect(isProjectsListLoading(false, 'user-1', null)).toBe(true);
  });
  it('fetched for this user → loaded', () => {
    expect(isProjectsListLoading(false, 'user-1', 'user-1')).toBe(false);
  });
  it('a token refresh keeps the same user id → still loaded (the page stays mounted)', () => {
    expect(isProjectsListLoading(false, 'user-1', 'user-1')).toBe(false);
  });
  it('another user signed in → loading until their list arrives', () => {
    expect(isProjectsListLoading(false, 'user-2', 'user-1')).toBe(true);
  });
  it('no user → not loading (the protected route handles it)', () => {
    expect(isProjectsListLoading(false, null, null)).toBe(false);
  });
});

describe('#297 project route', () => {
  it('found → render, even while a refetch runs', () => {
    expect(projectRouteState(true, true)).toBe('render');
    expect(projectRouteState(true, false)).toBe('render');
  });
  it('missing while loading → wait (main: redirect)', () => {
    expect(projectRouteState(false, true)).toBe('wait');
  });
  it('missing from a loaded list → redirect to the dashboard', () => {
    expect(projectRouteState(false, false)).toBe('redirect');
  });
});
