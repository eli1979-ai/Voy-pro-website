# VOY PRO Website

Staging deployment repository for the VOY PRO website.

Current staged release: **v1.32.7**.

v1.32.7 fixes two customer-facing booking regressions:
- WhatsApp links now have a real wa.me fallback in the HTML and are refreshed before click, instead of relying on changing a # link at the last moment.
- Submitting tour/date/group no longer resets the wizard to Step 1. Once the inputs validate, the UI advances to Step 2 while live availability is checked.
- The resilient Buda/Margaret selector and API timeout from v1.32.5–v1.32.6 remain active.
- A matching backend fix allows browser CORS preflight from configured public-booking origins while keeping the real API request protected by the client key.

Production booking is not enabled by this staging repository.
