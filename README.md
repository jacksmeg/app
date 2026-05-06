# JHIMS

JHIMS is a React + Vite marketplace app with buyer, seller, and admin workspaces. It now includes a real Supabase-ready backend foundation for authentication, roles, Postgres data, storage uploads, realtime chat/notifications, delivery events, and Stripe checkout scaffolding.

## What ships now

- Buyer marketplace UI with cart, checkout entry points, order tracking, chat, and notifications
- Seller workspace with order handling, payout requests, and product create/edit form with image upload support
- Admin workspace with user moderation, seller verification, complaints, escrow visibility, and delivery monitoring
- Supabase database schema, RLS policies, storage bucket policies, realtime tables, and auth profile bootstrap trigger
- Stripe checkout function and webhook handler for live hosted checkout flows
- Demo mode fallback when Supabase env vars are not configured

## Run locally

```bash
npm install
npm run dev
```

Without `.env`, the app runs in demo mode.

## Deploy to Cloudflare Pages

Recommended production URL:

- `https://app.jhimssoftware.com`

Cloudflare Pages settings for this project:

- Framework preset: `React (Vite)` or `None`
- Build command: `npm run build`
- Build output directory: `dist`
- Node version: `22.16.0`

Cloudflare Pages build environment variables:

```bash
VITE_SUPABASE_URL=https://usyaplolibrpkvoyogvs.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_mx-PYoUua6dhPiTiq8goSw_8HyeUjSQ
VITE_SITE_URL=https://app.jhimssoftware.com
```

After the first deployment, add the custom domain in Cloudflare Pages:

- `app.jhimssoftware.com`

Then update Supabase Auth URL configuration:

- Site URL: `https://app.jhimssoftware.com`
- Redirect URLs:
  - `https://app.jhimssoftware.com`
  - `http://localhost:5173`

Then update Google OAuth in Google Cloud:

- Authorized JavaScript origins:
  - `https://app.jhimssoftware.com`
  - `http://localhost:5173`
- Authorized redirect URI:
  - `https://usyaplolibrpkvoyogvs.supabase.co/auth/v1/callback`

The project includes [public/_redirects](</C:/Users/El/Desktop/MARKETPLACE APP/public/_redirects>) so direct loads and refreshes keep serving the app entry point on Cloudflare Pages.

## Enable the real backend

1. Create a Supabase project.
2. Copy [.env.example](</C:/Users/El/Desktop/MARKETPLACE APP/.env.example>) to `.env` and fill in:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_SITE_URL=http://localhost:5173
```

3. Apply the database migration:

- [supabase/migrations/20260506_init_jhims_marketplace.sql](</C:/Users/El/Desktop/MARKETPLACE APP/supabase/migrations/20260506_init_jhims_marketplace.sql>)

4. Deploy the Edge Functions:

- [supabase/functions/create-checkout-session/index.ts](</C:/Users/El/Desktop/MARKETPLACE APP/supabase/functions/create-checkout-session/index.ts>)
- [supabase/functions/stripe-webhook/index.ts](</C:/Users/El/Desktop/MARKETPLACE APP/supabase/functions/stripe-webhook/index.ts>)

5. Set these Supabase function secrets:

```bash
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
SITE_URL
```

6. In Stripe, point your webhook to the deployed `stripe-webhook` function and subscribe at minimum to:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
```

## Auth and roles

- Buyer and seller accounts can sign up from the UI.
- Google sign-in/sign-up is supported from the auth screen once the Google provider is enabled in Supabase Auth.
- Admin accounts should be promoted manually in `public.profiles.role`.
- New users automatically get a `profiles` row and a `carts` row.
- New seller signups also get a `seller_profiles` row.

### Enable Google auth

1. In Supabase, open `Authentication` -> `Providers` -> `Google`.
2. Turn Google on and paste your Google OAuth client ID and client secret.
3. Add your callback URL from Supabase to Google Cloud, and add your app URL such as `http://localhost:5173` to Supabase redirect URLs.

## Current payment scope

- Live hosted Stripe checkout is wired for `Card`, `Wallet`, and `Escrow`-mode status tracking.
- `Cash on Delivery`, `Bank Transfer`, and `Mobile Money` currently create manual order/payment records instead of automated provider settlement.
- Seller payout routing to connected Stripe accounts is not fully implemented yet. The schema is prepared, but funds splitting/onboarding still need a dedicated Connect pass.

## Key files

- [src/App.tsx](</C:/Users/El/Desktop/MARKETPLACE APP/src/App.tsx>) app shell and live/demo gating
- [src/state/JhimsStore.tsx](</C:/Users/El/Desktop/MARKETPLACE APP/src/state/JhimsStore.tsx>) shared app state, Supabase session handling, live queries, and actions
- [src/components/AuthScreen.tsx](</C:/Users/El/Desktop/MARKETPLACE APP/src/components/AuthScreen.tsx>) sign-in and sign-up flow
- [src/components/LivePanels.tsx](</C:/Users/El/Desktop/MARKETPLACE APP/src/components/LivePanels.tsx>) notifications, chat, delivery, and seller product composer
- [src/lib/supabase.ts](</C:/Users/El/Desktop/MARKETPLACE APP/src/lib/supabase.ts>) Supabase client bootstrap
- [src/lib/jhimsData.ts](</C:/Users/El/Desktop/MARKETPLACE APP/src/lib/jhimsData.ts>) data options and backend row mappers

## Verification

- `npm run build` passes
- built app preview smoke test returned HTTP `200`

## Next recommended pass

1. Add Stripe Connect onboarding and destination charges for real seller fund routing.
2. Add buyer review submission UI tied to completed orders.
3. Add route-based pages instead of one-shell workspace switching.
4. Add image gallery support instead of a single product cover image.
5. Add provider support for Ghana-specific payment rails if you want live Mobile Money instead of manual status flow.
