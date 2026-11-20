# Spanish Budapest booking — SOURCE ONLY, NO PUBLIC ACTIVATION

All 14 Spanish Budapest pages load a visible but disabled booking form and
keep their human WhatsApp inquiry. Presentation never calculates availability,
capacity, pricing, holds, payment, or booking records.

Only the existing canonical FBM site.js is permitted for live booking.
It is loaded solely when bookingEnabled, esBookingEnabled and
esBookingLocaleCertified are all explicitly true and the existing secure
Budapest API/client configuration exists. Neither ES-only switch is currently
present in site/assets/runtime-config.js.

STATUS: PREVIEW ONLY. Spanish policy, quote/hold, passenger, ancillary, payment
uncertainty and confirmation copy are now translated in the source. Full
translation, independent audit, and source-pinned synthetic acceptance.
The flags, merge/deploy and real booking/payment cutover each require
separate owner approval. Do not activate from this PR.
