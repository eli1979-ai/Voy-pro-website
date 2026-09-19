# VOY PRO Website

Staging deployment repository for the VOY PRO website.

Current staged release: **v1.32.9**.

v1.32.9 extends the working Budapest booking flow:
- the WhatsApp button shown after a confirmed booking now opens a booking-specific message with the booking reference, tour, date/time, party, guide language, payment method, total, and existing referral attribution;
- the checkout reads live payment capabilities from EZRaider OS;
- when Stripe is enabled in the backend, a **Pay now by card** option appears automatically alongside card/cash on arrival;
- selecting Pay now starts a provider-backed secure checkout and redirects only after the backend has created the pending booking/payment session;
- the option stays hidden while no real online-card provider is configured, so staging never presents a fake payment method;
- JavaScript syntax checking and live CORS/catalog/availability API smoke tests remain mandatory.

Automatic email and WhatsApp booking confirmations are queued by EZRaider OS after a booking becomes confirmed/paid. Delivery activates only when the real email and Meta WhatsApp provider credentials are configured.
