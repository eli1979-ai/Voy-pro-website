# Affiliate-hosted Budapest booking widget — implementation boundary

**Status: developer preview only; NOT safe/functional for third-party embedding yet.**
This branch adds the client-side widget and a compact presentation of the **existing** Budapest booking flow. There is no new booking engine and no production rollout.

## Intended affiliate snippet (AFTER framing/security activation)

```html
<div>
  <script
    src="https://voy-pro.com/assets/affiliate-booking-widget.js"
    data-affiliate="PARTNER_CODE"
    data-lang="en"
    defer
  ></script>
</div>
```

The loader constructs a single iframe to the VOY PRO origin and sends the affiliate code as an explicit `?affiliate=PARTNER_CODE&embed=booking` parameter. The existing site binds this code to its one-coupon booking state, hides the manual coupon box and calls canonical FBM quote, hold, booking and payment endpoints. The iframe reports **only its numeric height** to the parent; the parent accepts that message only from its expected VOY origin and iframe. No public server credentials are inserted by this loader. The widget always includes a direct **Open secure booking** link as a fallback.

## Mandatory steps before production partner-site use

1. **Hosting security configuration is currently blocking embedding.** `vercel.json` sets `X-Frame-Options: DENY` globally. Do NOT remove this globally. A separately reviewed, narrowly scoped framing policy is needed for a dedicated affiliate booking entry point, with `Content-Security-Policy: frame-ancestors` restricted to verified partner domains. This requires explicit human approval under AGENTS.md and a known allowed-domain list. Until then, only the direct booking link works.
2. **Payment handoff must be completed and tested.** Stripe/hosted checkout redirects cannot be assumed to work from a nested third-party frame. Design a provider-hosted, top-level handoff where the customer actively continues on the secure provider/VOY site, without posting payment/PII data to the parent.
3. **Affiliate financial accrual gap.** FBM supports `commission_bps` and booking attribution, but current canonical public booking RPCs do not appear to create `commissions` ledger entries automatically. Implement auditable, idempotent commission capture for real eligible receipts (and refunds/partial payments), preserving historical commission terms. Commission accrual policy and net-receipts basis require explicit business validation before implementation.
4. **Partner-origin governance:** define the authorized external domains per affiliate and prohibit arbitrary unaudited framing. No booking API keys or privileged session tokens belong in the parent site. The embedded app remains hosted by VOY PRO.
5. **Acceptance testing:** run affiliate create/coupon/link, per-tour fixed and percent discounts, actual booking with `affiliate_id` captured, partial/refunded payout treatment, desktop/mobile iframe, accessibility, consent, internationalization, expired holds, confirmation emails, and Stripe/pay-on-arrival cases on staging; never create live payments during development.
6. **Validation:** after framing is enabled, verify actual response headers on the embed-only route; a visually similar unframed page is not proof that an iframe works.

## Supported scope of this code-only foundation

- English/Hebrew/Hungarian Budapest destination selection.
- Single affiliate code, with the existing per-tour discount behavior.
- Existing Budapest booking logic reused in a compact display.
- Height-only `postMessage` and a direct-link fallback.

Not included: iframe deployment/security enablement, payment frame handoff, payout accrual changes, public production deployment or affiliate-domain onboarding.
