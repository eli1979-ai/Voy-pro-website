# VOY PRO Website

Staging deployment repository for the VOY PRO website.

Current staged release: **v1.32.8**.

v1.32.8 restores the full customer-side JavaScript flow and strengthens regression protection:
- The malformed bilingual browser-script line that prevented all site JavaScript from executing has been fixed.
- The build now runs a real JavaScript syntax check and fails if `site.js` is invalid.
- WhatsApp opens with prefilled tour context again and now also carries referral context when present: source/medium, campaign, and `ref`/affiliate code.
- Tour/date/group submission no longer resets to Step 1 while availability is checked.
- CI now performs a live public-booking smoke test from the website origin: CORS preflight, experiences, and availability.

Production booking is not enabled by this staging repository.
