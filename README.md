# RizzPDF

Free, browser-based PDF tools at [rizzpdf.com](https://www.rizzpdf.com). All PDF processing runs client-side with pdf-lib and PDF.js, so files never leave the user's device.

## Stack

Next.js (App Router), React, Tailwind CSS, pdf-lib, pdfjs-dist, docx, Clerk (auth), Supabase (subscriptions), Stripe (payments), Vercel (hosting).

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # Vitest unit tests
npm run lint
npx tsc --noEmit
```

## Environment

Put these in `.env.local` (production values live in Vercel):

`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `STRIPE_PRO_ANNUAL_PRICE_ID`, `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## Scripts

- `scripts/check-subscription.mjs <email>` shows a user's subscription row.
- `scripts/grant-lifetime.mjs <email>` grants lifetime Pro.
- `scripts/check-subscriptions-constraint.mjs` confirms `subscriptions.user_id` is unique.

Run them with `node --env-file=.env.local scripts/<name>`.

## Deploy

Push to `main`. Vercel builds and deploys automatically.

## Docs

Project rules are in `CLAUDE.md`. Specs and plans are in `docs/superpowers/`.
