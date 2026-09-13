# Changelog

All notable changes to Golden Attic are documented here, one entry per tagged
release. Format follows [Keep a Changelog](https://keepachangelog.com/), and
versions follow [Semantic Versioning](https://semver.org/) (while pre-1.0,
minor bumps mean "notable feature or fix," not a stability guarantee).

To check out any past release: `git checkout v0.9.0` (or any tag below).
To see exactly what changed between two releases: `git diff v0.9.0 v0.10.0`.

## [Unreleased]
Nothing yet.

## [v0.15.0] - 2026-09-13
### Added
- Listing pause/resume: sellers can hide a listing from browsing without
  deleting it (paused listings are meant to auto-remove after a 30-day
  grace period if never resumed - the endpoint logic exists, the actual
  scheduled trigger for that still needs a cron job set up)
- Likes/saves: buyers can like/save listings (sellers can't like their own),
  a saved-items list, like counts, and a "most liked" sort
- Multi-select filters: category and country now accept comma-separated
  values on the backend
- Web: filter sidebar redesign (left-side accordion, multi-select
  checkboxes for category/country, sort moved to its own dropdown)
- Web + mobile: new "My Listings" view - every listing you own across all
  statuses, with days-left-of-free-hosting shown only to the owner, plus
  pause/resume/delete actions, linked from the nav for easy access
- Auth-gated buy/bid: anonymous visitors see a clear "log in to buy or bid"
  prompt on both platforms instead of controls that would silently fail
### Fixed
- Mobile previously forced login before a person could even browse
  listings at all, contradicting the intended "browse without an account"
  behavior that already worked correctly on web - the navigator is now a
  single stack where only account-specific screens require login

## [v0.14.0] - 2026-09-13
### Added
- Delete-listing UI on both web and mobile listing detail pages (owner
  only, with confirmation) - the backend endpoint existed with no UI
  entry point anywhere
- Multi-photo gallery on listing detail pages (thumbnail strip + tap to
  switch main image) - previously only the first of up to 5 uploaded
  photos was ever displayed

## [v0.13.1] - 2026-09-13
### Fixed
- Filter dropdown text was invisible on systems/browsers in dark mode -
  the `<select>` elements forced a white background but never forced text
  color or `color-scheme`, so the browser rendered native white-on-white
  text to match OS dark mode preference

## [v0.13.0] - 2026-09-13
### Added
- `year` and `country` fields on listings (optional - most relevant for
  stamps, coins, and currency)
- AI-assisted drafting now suggests year/country when identifiable from
  photos, without fabricating them when not visible
- `GET /listings/filters` endpoint: real in-use countries, year range, and
  price range, for building a filter UI that never shows a dead-end option
- `GET /listings` filtering by category, country, decade, and $100-wide
  price bands, plus sorting (newest, oldest, price asc/desc, year asc/desc)
- Web homepage filter bar, wired to shareable/bookmarkable URL query params
- Year/country fields added to create-listing forms and detail views on
  both web and mobile
### Fixed
- Added a loading state to the web homepage - likely fix for the reported
  "clicking the logo does nothing" issue (probable cause: Render free-tier
  cold-start delay with no loading feedback)

## [v0.12.2] - 2026-09-13
### Fixed
- Added the missing "Resend verification email" button on both web and
  mobile profile screens - the backend endpoint existed but nothing called it

## [v0.12.1] - 2026-09-13
### Fixed
- Added the missing `/verify-email` and `/reset-password` pages to the
  website - the backend emailed links to these routes, but the pages
  didn't exist, so clicking them 404'd

## [v0.12.0] - 2026-09-13
### Added
- `DEPLOYMENT.md`: guide for local dev and free-tier hosting (Render +
  Vercel + Neon/Supabase)
- `render.yaml`: Render Blueprint for one-click backend deployment,
  verified end-to-end from a clean install

## [v0.11.0] - 2026-09-13
### Added
- Automated test suite: Vitest + Supertest, mocked Stripe/Resend/Anthropic,
  real Postgres test database
- 85+ passing tests across unit, integration, and security-regression
  categories (auth, listings, bids, orders/payments, users)
- Split `app.ts` (testable Express app) from `index.ts` (server entrypoint)

## [v0.10.0] - 2026-09-13
### Security
- Fixed: order amount was trusted from the client instead of derived from
  the listing/bid price (payment-fraud vector)
- Fixed: `GET/PATCH /orders/:id` and `GET /orders` had no authentication,
  leaking order history and letting anyone mark orders as paid
- Fixed: `GET /bids` had no authentication, exposing every bidder's
  identity and amount on any listing
- Fixed: `GET /listings/:id` exposed all bids to the public
- Fixed: `GET /listings?status=DRAFT` let anyone browse other sellers'
  unpublished listings
- Fixed: `GET /users/:id` leaked email/phone for any user ID
- Fixed: `PATCH /users/:id/become-seller` leaked password hash and
  verification/reset token hashes in its response
- Fixed: global error handler echoed raw internal exception messages to
  clients
### Changed
- `Order.listingId` is no longer a unique DB constraint - a failed payment
  used to permanently block any future order on that listing
- A listing no longer flips to SOLD until payment is confirmed by Stripe -
  previously any user could indefinitely soft-lock a listing by opening
  checkout and never paying
- Accepting a bid can now actually be checked out at the negotiated price
### Added
- `helmet` security headers, opt-in trust-proxy setting for correct
  rate-limiting behind a reverse proxy
- JWT_SECRET now fails startup in production instead of falling back to an
  insecure default

## [v0.9.0] - 2026-09-13
### Added
- Next.js website: auth pages, browse/listing/sell pages (AI-drafted
  listings), Stripe Elements checkout, seller onboarding, shared API client

## [v0.8.0] - 2026-09-13
### Added
- Mobile seller Stripe Connect onboarding screen: hosted onboarding link,
  status polling on app foreground, auto-flips `isSeller` once payouts are
  enabled

## [v0.7.0] - 2026-09-13
### Added
- Mobile checkout/payment flow: Stripe PaymentSheet integration, Buy Now
  button, order + payment API modules
### Fixed
- Missing `navigation` prop in `ListingDetailScreen` (bidding worked, but
  nothing on that screen could actually navigate anywhere)

## [v0.6.0] - 2026-09-13
### Added
- React Native (Expo) mobile app skeleton: auth screens, browse/listing/
  create-listing screens with AI-assisted drafting, bidding UI, API client

## [v0.5.0] - 2026-09-13
### Added
- AI-assisted listing drafting: photo(s) -> title/description/category/
  price via Claude, with a fixed category taxonomy
- npm workspaces set up so the backend can consume `@golden-attic/shared`

## [v0.4.0] - 2026-09-13
### Added
- Resend integration for transactional email (verification, password reset)
- Stripe Connect: seller onboarding, buyer checkout with commission split
  (destination charges), webhook handler for payment confirmation

## [v0.3.0] - 2026-09-13
### Added
- Email verification (signup sends a link, 24h expiry, resend endpoint)
- Password reset (forgot-password / reset-password, account-enumeration
  safe)
- Rate limiting on login, signup, and email-sending endpoints

## [v0.2.0] - 2026-09-13
### Added
- Password/JWT authentication: signup, login, `requireAuth` middleware
- Platform commission locked at 5%
- Ownership enforcement on listing/bid/order routes

## [v0.1.0] - 2026-09-13
### Added
- Monorepo project structure (npm workspaces)
- Prisma schema: users, listings, bids, orders, hosting fees
- Express API skeleton with the core CRUD routes
