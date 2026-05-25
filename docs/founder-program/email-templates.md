# Founding Contractors — Email Templates

Manually-sent Gmail templates for the Founders cohort program. Paste into Gmail, edit the `{{placeholders}}`, send.

These will eventually become Resend templates triggered by a `review_status` transition on `founding_applications`. Until then, the source of truth is this file.

**Workflow context**:
- Applications arrive at `support@sparkplan.app` from the `/founders` form
- Augusto reviews + verifies FL DBPR license + makes approve/decline call
- For approvals: create a Stripe Promotion Code (e.g., `FOUNDER-DAVIS`), paste it into the `coupon_code` column of the `founding_applications` row
- Send the approval email below
- Founder uses `/#/founder-signup` to redeem (one-step activation, no card)

## Stripe coupon setup (one-time per Founder)

In the Stripe Dashboard before sending the approval email:
1. **Products → Coupons → Create new**
   - Type: 100% off
   - Duration: Repeating, 2 months
   - Name: "Founders 2026 — {{Last Name}}"
2. **Promotion codes → Create promotion code** (for the coupon you just made)
   - Code: a memorable string, e.g. `FOUNDER-DAVIS` (uppercase letters + numbers + dashes)
   - Max redemptions: 1
   - Customer-facing: yes
3. Copy the code string and paste into `founding_applications.coupon_code` in Supabase Studio. Set `review_status = 'approved'`.

---

# Approved — base template

## Subject

```
You're in — SparkPlan Founding Contractors
```

## Body

```
Hi {{first_name}},

Quick one — I read your application and you're in.

You're one of the first 20 Florida contractors getting full SparkPlan
access plus a direct line to me for the next 60 days.

Activate your account in one step here:

  https://sparkplan.app/#/founder-signup

You'll be asked for the coupon code below, your name, email, and a
password. We've already pre-vetted your application, so there's no
email verification step and no 14-day trial to wait out — you'll
go straight to Stripe Checkout where your coupon makes the first
60 days free, no card required.

──────────────────────────────────────
YOUR COUPON CODE:  {{COUPON_CODE}}
──────────────────────────────────────

If you'd rather skip the typing, this direct link pre-fills the code:

  https://sparkplan.app/#/founder-signup?code={{COUPON_CODE}}

{{CHANNEL_BLOCK}}   ← pick one of the three below based on what they
                      selected on the application

What I'll ask of you over the next 60 days:

  • Submit at least one real FL permit using the packet
  • A 30-minute call at the end of month 1 (we'll book it in week 3)
  • Share inspector responses — red-lines, approvals, anything
  • Be open to being an anonymized case study

That's it. If anything breaks, you've stumped a feature, or you want
a packet sanity-checked before submitting, I'm one message away.

Welcome to the program.

— Augusto Valbuena
  PE, Florida · {{your PE #}}
  Founder, SparkPlan
  augustovalbuena@gmail.com · {{your phone}}
```

## Channel block variants — paste one based on `preferred_contact`

### Slack

```
YOUR SLACK INVITE
Click to join the private Founders channel:
{{SLACK_INVITE_URL}}

I'm in there daily. Drop a note when you're set up — even just to
say hi — so I know you got in OK.
```

### Phone call

```
LET'S GET ON A CALL THIS WEEK
You picked "Phone call" on the application — works for me. Reply
with two or three times this week (any 30-min slot) and I'll call
you. My direct line is {{your phone}} if you want to call me first.

I'll also drop you into our private Slack channel as a backup —
optional, no pressure.
```

### SMS / iMessage

```
LET'S PICK THIS UP OVER TEXT
You picked SMS / iMessage on the application — easiest channel
for someone on-site. Text me at {{your phone}} when you've got a
minute. I'll text back to confirm and we'll go from there.

I'll also drop you into our private Slack channel as a backup —
optional, no pressure.
```

---

# Declined — base template

## Subject

```
Re: Founding Contractors application
```

(Reply to the application notification email so it threads in the same Gmail conversation.)

## Body

```
Hi {{first_name}},

Thanks for applying to the Founding Contractors cohort — appreciate
you taking the time to lay out your work.

{{DECLINE_REASON_BLOCK}}   ← pick one below

That said: SparkPlan is fully open to you on the standard plan —
14-day free trial of every feature, no card required. Sign up at
https://sparkplan.app/#/signup whenever you'd like.

{{OPTIONAL_BRIDGE_SENTENCE}}   ← pick one below; can also delete

Best,
— Augusto Valbuena
  PE, Florida
  SparkPlan
```

## Decline reason variants

### Out-of-state

```
For this round, the Founding Contractors program is Florida-only —
the cohort leans heavily on FL-specific AHJ work (Pompano,
Miami-Dade, Davie, Tampa, Orlando) and the per-jurisdiction packet
engine that's most mature there. I'll be opening cohorts in other
states later in 2026.
```

### Inactive or no FL license

```
Your DBPR license search came back as {{inactive | not found}} — the
cohort program requires an active EC or ER credential since the
case studies depend on real permit submittals under your license.
If you've renewed (or are about to), just reply and I'll happily
re-check.
```

### Too few permits / not a pulling contractor

```
The cohort focuses on contractors who pull permits regularly —
5+ per year minimum — because case studies need real AHJ
submittals to mean anything. From your application it sounds like
that's not your current volume, which is totally fine, just not
the right fit for this particular program.
```

### Wedge mismatch (residential-only without EV / SU / MF focus)

```
The cohort is currently focused on multi-family EV, service upgrades,
and commercial work — that's where SparkPlan's calc engine adds the
most value over a manual workflow. Your work sounds solid but a bit
outside that lane for now.
```

## Optional bridge sentences

| Decline reason | Bridge sentence |
|---|---|
| Out-of-state | "Also — if you have a FL job coming up and want a permit packet engineered, drop me a note. I can help on a one-off basis through the PE-as-service path." |
| Inactive license | "No rush — apply again when you're set on the renewal." |
| Too few permits | "If the volume picks up, the application is always open." |
| Wedge mismatch | "If you start picking up MF / EV / commercial work, ping me — happy to re-look." |
