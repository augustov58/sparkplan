# Evening dates were tomorrow's: "today" taken as the UTC day (#327)

**Problem.** `new Date().toISOString().split('T')[0]` (or `.slice(0, 10)`) is the **UTC** day. From 7 PM EST (8 PM EDT) on, that is tomorrow in Florida. 22 places used it for something the user reads as "today" or "this month":
- the packet's Revision Log, whose Rev 0 printed tomorrow next to a footer "Generated" today, on one page;
- `deriveInvoiceStatus`, which compared the due date with the UTC day, so an invoice due today turned Overdue that evening;
- billing's default dates and months;
- 12 download filenames.

## Approach
1. **Sweep before filtering.** Every `toISOString()` in app code (57), sorted into: instants (`created_at`, `sent_at`, … correct in UTC: 30), dates (22), months (3) and clock times (2).
2. **Read each date site against its writer before changing it.** Three were right and stayed:
   - `addDays` / `addDaysISO` parse at `T00:00:00Z`, add days and format, all in UTC, so the day doesn't move.
   - `PermitDetailDrawer::toDateInput` reads permit dates that the same drawer stores at UTC midnight (`fromDateInput`, the only writer). Switching the reader to local time would show every permit date a day early in Florida.
3. **One helper.** `lib/localDate.ts` (`localDateStamp`, `localMonthStamp`); the #315 packet helper moved there, re-exported from `permitPacketGenerator.tsx` for its test.
4. **Pin the rest with a source test.** `tests/localDate327.test.ts` runs `git grep` for date, month and clock slices of `toISOString()` in app code and expects exactly the known UTC-consistent sites (plus the 2 site-visit clock defaults filed as #337). A new UTC "today" fails CI.
5. **Unit tests in a fixed zone.** `process.env.TZ = 'America/New_York'` at the top of the file (Vitest 4 runs files in forked processes, so it takes effect), with the instant 2026-11-25T01:30Z = 20:30 EST; a guard test checks the zone took effect.
6. **e2e in a zone where the days differ now.** `test.use({ timezoneId })`: Kiritimati (UTC+14) from 10:00 UTC, Pago Pago (UTC−11) before, so the local day is never the UTC day while the spec runs. "Generate invoice" needs an unbilled entry and the QA account has none: the spec answers the `time_entries` GET with one stub row, which writes nothing.

## Not this issue
The reverse problem: a date or time the user types is stored as UTC (`CalendarView` saves `new Date('YYYY-MM-DD')`, which is UTC midnight; `SiteVisitManager` saves a zoneless `datetime-local` value). It depends on how those rows are stored (`timestamptz`) and whether to migrate them, so it is filed as #337.

## Reusable rule
"Today" in a user's eyes is the local day: `lib/localDate.ts`. `toISOString()` is for instants. A date reader follows its writer's convention: change both or neither.
