# Golden Attic

A marketplace app + website for selling collectibles and used items (Amazon x OfferUp style).

## Structure
- `apps/mobile` — React Native (Expo) app for iOS + Android
- `apps/web` — Next.js website, shares the same backend
- `packages/backend` — API server (Node/Express + Postgres via Supabase)
- `packages/shared` — Shared types, constants, utils used across apps
- `docs` — Product/architecture notes

## Core features (v1 scope)
- Multi-seller marketplace with commission-based revenue
- Bidding: buyers can bid, sellers can counter-offer at a lower price
- AI-assisted listing creation (photo -> auto title/description/category/price)
- Monetization: first month free hosting per listing, then 1%/month hosting fee + sale commission on sell-through
- Stripe Connect for payments/payouts
- Target audience: retirees downsizing collections — prioritize a dead-simple listing flow
