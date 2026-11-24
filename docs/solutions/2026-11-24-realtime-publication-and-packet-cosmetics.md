# Lists never updated live; packet and one-line cosmetics (#315)

**Problem.** Seven small findings from the #301, #307 and #313 verifiers: E-202 printed the main breaker as "800" (no unit); E-201 printed "MDP (MDP)" and its AIC line in dark red; the in-app AIC chip sat on the panel's bottom border; the Short Circuit dropdown said "(all panels already calculated)" when only the MDP existed; the packet filename used the UTC date; and an update made outside the app didn't reach an open panel list.

## Approach

1. **Realtime: look at the database, not the hook.** Every list hook subscribes to `postgres_changes`, so the code looked right. A read-only query of `pg_publication_tables` showed the publication held 11 tables, none of them `panels`, `circuits` or `feeders`. 23 of the 31 subscribed tables were missing, so no event had ever fired. Before adding them, check `pg_class.relrowsecurity` and `pg_policies`: Realtime filters events through RLS, so a table without RLS would broadcast its rows. All 23 had RLS. The migration was written, the owner was asked, and it was applied. The fix was proven in the QA browser: before it, an update from a second client showed only after a reload; after it, it showed in 0.7 s.
2. **Sweep each cosmetic before fixing it.** `main_breaker_amps` readers in `services/pdfExport/`: only E-202's two cells lacked the unit (the panel schedules already printed `${n}A`). `toISOString()` dates: 22 more sites beyond the packet filename. They are outside the ruling, so they were filed as #327.
3. **Test the colour, not only the text.** `pdftotext` can't see colour. The unit test reads the riser label's `style.color` from the element tree; the e2e spec reads the span colour with PyMuPDF (`python3 -P`, because `-I` hides the user site-packages where `fitz` lives).
4. **Test the chip's geometry**, not a screenshot. `getBBox()` of the chip rect versus the enclosure rect plus half its stroke. On main the chip top was 276 against a bottom of 280.

## Judgment calls

- **Filename date:** a fake clock (`page.clock.setFixedTime` to 11:30 PM) moved `Date.now` past the session token's expiry, supabase-js treated the session as expired, the page fell back to sign-in, and the spec's fixture restore never ran (restored by hand). The spec instead picks a browser time zone whose date differs from UTC's at run time (UTC+14 from 10:00Z, else UTC−11), and asserts the filename equals the date the pages print.
- **Dropdown:** "(no downstream panels)" only when the project has no panel besides the MDP. When downstream panels exist but are all calculated, "(all panels already calculated)" is accurate and stays.
- **AIC line:** the colour override was removed, and the line keeps its bold weight. Riser labels default to `#000`, the name's colour.
- **OneLineDiagram.tsx (Stable Module):** only the chip's two `y` values changed, under the owner's OK for this change.

## Reusable rule

When a client-side subscription "never fires", check the server side first (`pg_publication_tables` for Supabase Realtime). To test a date that depends on the time of day, change the time zone, not the clock: a fake time breaks token expiry.
