# VOY PRO Website — FBM Dependencies (W1)

Last verified: 2026-10-06

This document records website requirements that **must be owned by FBM or deployment configuration**. The website must not satisfy these dependencies by hardcoding operational truth.

## Dependency rules

- FBM owns operational truth; the website owns presentation.
- A missing production dependency must fail closed. Production must never fall back to the staging backend.
- Public browser configuration may contain a public client key, but never an FBM secret.
- New website consumers must not ship before the corresponding FBM contract exists and is verified.
- WhatsApp may remain a customer channel, but it must not become the system of record for structured commercial enquiries.

---

## FBM-DEP-001 — Production public API environment

**Priority:** P0  
**Owner:** FBM + VERCEL/ENV  
**Status:** BLOCKED — no distinct production FBM Vercel project/domain was found in the 2026-10-06 Reality Check.

### Needed by

All production website runtime flows, including catalog, destination policy, availability, quote, hold, booking, payment capabilities, Manage Booking, ancillary offers, sessions and marketing events.

### Required deployment inputs

- stable production public API base URL;
- production public browser client key;
- CORS/host policy allowing `https://voy-pro.com`;
- production data/services isolated from staging;
- verified release/environment identity.

### Acceptance

- the production API hostname/base URL does not identify itself as staging;
- the public client key is a production-scoped browser key;
- the website can execute read-only smoke checks for the existing public consumer contract;
- staging remains separately reachable for preview/testing;
- production does **not** fall back to staging when configuration is absent.

### Website fallback

Fail the production build / disable the affected live capability. Do not use the staging API.

---

## FBM-DEP-002 — Production payment capability truth

**Priority:** P0  
**Owner:** FBM  
**Existing endpoint:** `GET /api/v1/payments/capabilities`  
**Status:** Contract exists; production value not yet verified.

### Required response semantics

The public capability response must unambiguously expose:

- whether online card payment is enabled;
- provider;
- mode/environment;
- readiness status and reason when unavailable.

### Acceptance

The website can determine the customer-visible payment choices from this endpoint without inferring Stripe state from frontend configuration.

### Website fallback

Do not advertise online payment as available when capability truth cannot be verified.

---

## FBM-DEP-003 — Public destination safety and suitability policy

**Priority:** P1  
**Owner:** FBM Catalog/Destination + Safety/Compliance  
**Status:** Partial. Budapest public destination config already exposes rider/passenger age policy and meeting point; broader policy is not in the current website consumer contract.

### Needed facts

A versioned public policy contract must cover, where applicable:

- training/briefing requirement;
- helmet/PPE requirement;
- pregnancy restriction;
- rider suitability/assessment rules;
- passenger/child-seat eligibility semantics;
- customer path when an intended rider cannot safely continue after assessment/training;
- effective policy version.

The exact FBM schema may differ, but these facts must be machine-readable or exposed through a stable public policy object rather than duplicated as permanent website truth.

### Website fallback

Use neutral safety copy and direct the guest to the local team. Do not invent eligibility/refund consequences.

---

## FBM-DEP-004 — Pre-purchase cancellation/change/payment policy

**Priority:** P1  
**Owner:** FBM Booking Policy  
**Status:** Partial. Post-booking Manage Booking exposes capabilities, but the website lacks a sufficiently detailed canonical pre-purchase policy snapshot.

### Needed facts

For the selected destination/product/rate:

- cancellation eligibility/window semantics;
- refund implications;
- change eligibility/window semantics;
- payment timing/options;
- whether staff confirmation is required;
- policy version/effective date;
- customer-readable summary or stable structured policy codes that the website can localize.

### Acceptance

The customer can understand the commercial commitment before confirmation, and the facts shown match the policy later enforced by FBM/Manage Booking.

### Website fallback

Do not promise a cancellation, refund or change right that FBM has not supplied.

---

## FBM-DEP-005 — Portugal / Marvão canonical destination and catalog

**Priority:** P1  
**Owner:** FBM Catalog/Destination  
**Status:** BLOCKED BY FBM. Portugal currently contains static operational facts on the website.

### Required destination/product truth

At minimum:

- destination identity and timezone;
- active products/routes;
- product status / request-vs-instant-booking mode;
- price/currency;
- duration;
- party/capacity constraints;
- guide languages;
- eligibility/safety policy references;
- operator/fulfilment relationship where needed for customer disclosure;
- availability/request semantics.

### Migration target

FBM canonical configuration
→ validated website runtime/build snapshot
→ human-readable page copy and matching structured data.

### Website fallback

Keep the current Portugal journey conservative and request-led until the canonical FBM data exists. Do not expand static operational truth.

---

## FBM-DEP-006 — Structured Groups / Corporate commercial enquiry

**Priority:** P1  
**Owner:** FBM CRM/Commercial Lifecycle  
**Status:** BLOCKED BY FBM. Website pages are differentiated and WhatsApp-aware, but no canonical CRM enquiry write contract is currently consumed.

### Required write contract

A public endpoint such as a canonical commercial enquiry/lead action must accept the appropriate subset of:

- destination;
- enquiry type: group / corporate;
- requested date and time window;
- approximate headcount;
- preferred language;
- private/customization intent;
- organizer/customer contact;
- company/invoicing requirements where relevant;
- attribution/session/campaign identifiers;
- free-text operational notes.

### Required response

- stable enquiry/lead id;
- reference;
- accepted/current status;
- optional safe continuation metadata for WhatsApp.

### Target journey

structured enquiry
→ attribution
→ FBM CRM lead
→ optional “Continue on WhatsApp”.

WhatsApp remains a channel, not the database.

---

## FBM-DEP-007 — Revenue/conversion outcome semantics

**Priority:** P1  
**Owner:** FBM Finance/Payments/Analytics  
**Status:** Needs contract/alignment.

The platform must distinguish at least:

- lead;
- availability search;
- hold;
- booking created/confirmed;
- payment authorized;
- payment collected;
- completed;
- cancelled;
- refunded.

Website analytics may report funnel interaction, but must not turn booked GMV into collected revenue. Server-side payment/booking outcomes should be the source for downstream Google/Meta conversion uploads when those outcomes depend on FBM state.

---

## FBM-DEP-008 — Destination entity/operator facts for SEO/entity architecture

**Priority:** P2  
**Owner:** FBM Network/Destination + Business configuration  
**Status:** Partial.

For scalable LocalBusiness/Organization relationships, expose stable destination configuration for:

- customer-facing branch/experience brand;
- legal/fulfilment operator;
- address/meeting location where public;
- contact channels;
- parent/network relationship;
- partner/operator relationship where applicable.

The website decides how to present these relationships to customers; FBM owns the canonical entity facts.

---

## Current website-side checkpoint

As of 2026-10-06:

- Budapest catalog price and rider/passenger age policy are largely FBM-driven;
- hold duration display uses `hold.expires_at` rather than a website-owned TTL promise;
- tour-card duration is hydrated from FBM `durationMinutes`;
- production still points to the staging FBM endpoint;
- production remains intentionally/non-intentionally non-indexable in the deployed release state;
- Portugal canonical migration and structured B2B enquiry remain blocked by the FBM dependencies above.

## Website-owned read-only Staging public contract watch (23 October 2026)

The website can now run `node scripts/check-fbm-staging-public-api.mjs` to verify three public FBM Staging endpoints against the consumer contract: Budapest destination policy, Budapest experience catalog, and payment capability status. For each, it verifies the browser's unauthenticated **OPTIONS CORS preflight** followed by one allowed **GET**. Browser requests carry `content-type`, `x-voy-client-key`, and `x-voy-client`; without the preflight headers, standalone server-side GET checks can pass while visitors' browsers fail. It uses the existing **public browser client key** already committed in `site/assets/runtime-config.js` but never echoes the key or API response bodies. All requests restrict the host to `ezraider-os-staging.vercel.app`, use `Origin: https://voy-pro.com`, require allowed CORS, and reject external/mutating-path redirects. It performs **no** quote, hold, request, booking, Stripe intent, authentication, writes, or customer-data operations. In particular, the FBM route `GET /experiences/[experienceId]/availability` invokes `ensure_public_departures` and may prepare departure records, so it is **intentionally excluded** from this no-mutation network smoke despite its HTTP method. That endpoint needs separately approved synthetic/staged integration tests.

The GitHub Action `FBM Staging browser CORS and public read-only contract` runs for relevant PRs, on manual invocation, and weekly. Its short-lived artifact indicates which public GET route succeeded or failed, without preserving business/financial response values. The synthetic tests run in every normal website build.

**Scope limits:** a green report proves only these public reads responded with compatible shapes at that instant. It is **not** proof of live departure availability, payment activation authorization, staffing, complete booking integration, or a genuinely isolated Production API. It must never change the owner-gated `NO-GO` status from the public-release report.

**Cross-team next gate:** FBM must independently approve Production database migration history/schema, public API URL and scoped browser key, domain CORS, privacy and payment capability mode. Only after those gates can the website run a separate, reviewed **Production-safe read-only** consumer probe, before any live transaction or DNS/SEO switch.
