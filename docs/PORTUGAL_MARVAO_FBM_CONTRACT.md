# Portugal / Marvão — FBM public integration contract

Status: website-side requirement for the next FBM integration step.
Website baseline: v1.40.0.
Destination id: `portugal-marvao`.

## Ownership

VOY PRO owns the customer journey and the booking/request relationship.
Pombais Experience & Villas may remain the transparent local operator, but the customer must not be redirected to Pombais to initiate the booking.

The website must not invent availability, final confirmation, pricing rules, payment state, partner state or operational capacity. Those remain FBM-authoritative.

## Current website behavior

The EN/HE/PT Portugal pages:
- keep every CTA inside VOY PRO;
- collect route, preferred date, party size, guide language, customer name and optional notes;
- prefill those details into VOY PRO WhatsApp;
- expose Pombais only as the local operator;
- do not send FBM sessions or marketing events through the Budapest public client.

The shared website runtime is destination-aware. A Portugal backend connection activates only when a dedicated public client is configured for `portugal-marvao`.

## Required FBM capability

FBM should expose a dedicated public booking client for Marvão, scoped to the Portugal location and allowed VOY PRO website origins.

The public contract should support a request-first flow rather than falsely presenting the request as an instantly confirmed booking.

Minimum public request input:
- destination_id = `portugal-marvao`
- experience_id / public product id
- experience_slug
- preferred_date
- party_size
- guide_language
- customer.full_name
- customer.email
- customer.phone
- customer.preferred_language
- customer_notes / special_request
- session_id when available
- canonical attribution object
- idempotency key

Minimum response:
- request id
- customer-safe reference
- status
- created_at
- customer/manage token when applicable
- explicit confirmation state
- next-action / expected-response metadata suitable for the website

## Initial public products

The website currently presents three Marvão products. FBM should become the authoritative source for their public availability, prices and conditions before the static website values are removed.

1. Vila de Marvão Express Tour
   - current published price shown by website: €30/person
   - current displayed duration: 1 hour
   - current displayed group size: 2–4

2. Marvão Explorer Tour
   - current published price shown by website: €50/person
   - current displayed duration: 1.5 hours
   - current displayed group size: 2–4

3. Megalithic Route
   - current published price shown by website: €60/person
   - current displayed duration: 2.5 hours
   - current displayed group size: 2–4

These figures are website fallbacks only until FBM owns the product records.

## Guide languages

The current Marvão public guide-language set is:
- English
- Portuguese

Guide language is required on every request.

## Partner fulfillment

The intended architecture is:

VOY PRO website → FBM request → partner fulfillment workflow → Pombais → FBM status → VOY PRO customer communication.

The partner transport must remain behind an adapter/outbox boundary. The website must never need to know the provider transport, partner endpoint or partner credentials.

Customer-facing status should distinguish at minimum:
- request received by VOY PRO;
- awaiting local confirmation;
- confirmed;
- unavailable / declined;
- customer action required.

Do not send a confirmed-booking message before FBM has an accepted/confirmed state.

## Runtime configuration expected by the website

The website already supports destination-scoped public clients:

```js
window.VOY_RUNTIME_CONFIG = {
  bookingEnabled: true,
  apiRoot: "https://<fbm-host>/api/v1",
  destinationClients: {
    budapest: { clientKey: "<public Budapest key>" },
    "portugal-marvao": { clientKey: "<public Marvao key>" }
  }
};
```

The existing top-level `clientKey` is retained only as a backward-compatible Budapest fallback.

## Website cutover after FBM is ready

Once the dedicated Marvão public client and request endpoint are live:

1. Add the Portugal client key to `destinationClients["portugal-marvao"]`.
2. Replace WhatsApp-only form submission with the canonical FBM request call.
3. Persist the returned request/reference in the customer flow.
4. Show an awaiting-confirmation state, not an instant booking confirmation.
5. Keep WhatsApp as support/follow-up, carrying the FBM reference.
6. Add CI smoke coverage for the Marvão client and request endpoint.
7. Remove static product pricing only after the catalog endpoint returns the three products reliably.

## Non-goals

- No direct website → Pombais booking link.
- No direct website → partner API call.
- No reuse of the Budapest public client for Portugal.
- No browser-side availability, pricing, confirmation or partner-routing logic.
- No external-provider coupling in the website.
