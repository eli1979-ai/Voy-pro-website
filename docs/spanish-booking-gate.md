# Spanish Budapest booking — SOURCE-ONLY; DO NOT MERGE/DEPLOY YET

The 14 generated Spanish Budapest pages render a disabled, accessible booking
form and retain route-specific human WhatsApp inquiry. With committed runtime
configuration, they cannot call the booking API or open payment checkout.

Only shared `site.js` is the canonical FBM booking client, and it remains
behind `bookingEnabled && esBookingEnabled && esBookingLocaleCertified`.
Both independent Spanish flags are **absent** from the committed production
configuration. No independent writer, price calculation, availability or
capacity logic was added. Experiences must be hydrated from the canonical
FBM catalog, not hard-coded into the static page.

Supported source copy includes 173 literal booking labels, dynamic
interpolations, customer/child/infant notices, guide language requests,
canonical checkout/discount/hold messages, extras and payment ambiguity.
This is an editorial **draft**, not a professionally certified full Spanish
checkout, and some Manage Booking/legal endpoints remain English.

SOURCE/INERT DEPLOY GATE: exact-head build, 14-page mobile/desktop browser
tests, dual-ES-flag synthetic negative tests, and source diff review.
Even with a green source CI, activation requires an independent ES translation
review, synthetic signed booking/payment/expiry/retry E2E through canonical FBM,
FBM runtime/recovery authorization, and separate owner permission for
source merge, Production deployment, flag change and commercial cutover.
