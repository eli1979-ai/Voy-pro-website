# VOY PRO Website

Staging deployment repository for the VOY PRO website.

Current staged release artifact: **v1.31.0**.

v1.31 adds:
- complete Budapest Hungarian locale routing;
- locale-safe shared UI and footers;
- Hungarian dynamic booking/UI translations;
- locale-preserving Manage Booking links;
- automated language-integrity QA;
- the real-tour-photo build introduced in v1.30.

The reviewed staging site is stored as `artifact/site-v1.31-staging.tgz`.
`npm run build` expands it into `dist/` for Vercel.
