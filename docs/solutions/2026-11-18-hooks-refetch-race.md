# A refetch started before a delete brought the deleted row back (#234)

**Problem:** the data hooks refetch the whole list on every realtime event and change local state optimistically before each write. A fetch that started before a delete (triggered by an earlier change's realtime event) could return after it and replace the state with the pre-delete rows. The #209 spec saw the removed EVEMS setpoint card come back once in four folder runs. If the realtime socket is down, nothing refetches afterwards, and the row stays.

## Approach

1. **Guard the fetch, not every mutation body.** `lib/fetchGuard.ts::FetchGuard` keeps a sequence number and an in-flight count:
   - a fetch takes `token()` when it starts and drops its result if `stale(token)`, i.e. a write began, ended or is running since then;
   - mutations are returned as `guard.wrap(fn)`, which brackets the call with `begin()` / `end()`;
   - when the last write settles, the guard refetches once (debounced, so a loop of creates refetches once), so the list converges even without the realtime event.
2. **Touch each hook in four places**, by script, then read the diff: the guard, the token, the stale check before the set, and `wrap` in the return object. That covered all 13 hooks with the pattern. `wrap` caches per function, so a memoized mutation keeps its identity.
3. **Reproduce the race the right way.** The first spec passed on `main`:
   - `page.route` that sleeps then calls `continue()` delays the *request*;
   - the server read the rows after the delete, so it returned fresh data.

   Holding back the *response* (`route.fetch()` → wait 3 s → `route.fulfill`) models a slow fetch. The refetch itself is started with `dataRefreshEvents.emit('circuits')`, so the test doesn't depend on the realtime socket (which is often down in this dev setup). A timing diagnostic (request vs response times, card count every 100 ms) showed which case was happening.

## Verification

- `tests/e2e/issues/issue-234.spec.ts`: on `main` the removed card comes back (seen 1); on the fix, 0 for 6 s.
- `tests/fetchGuard234.test.ts` (stale rules, one refetch after a burst, a throwing write settles).
- The whole issue folder (32 specs, every write flow) passes. Independent verifier: the race, plus a smoke test of add / edit / delete on the guarded hooks.

## Reusable lessons

- **Optimistic UI plus full-list refetch needs an ordering rule.** Results older than the latest local write must lose.
- **To test a slow network response, delay the response, not the request.** Otherwise the server sees the request late and the race disappears.
- **When a repro passes on the buggy code, log the timeline before changing the test again.** Here that meant request sent, response received, and UI state every 100 ms.
