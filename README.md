# VOY PRO Website

Staging deployment repository for the VOY PRO website.

Current staged release: **v1.32.0**.

v1.32 is the stabilization release before content/trust and booking release-candidate work. It adds:
- one build-generated locale-safe header/footer source for Budapest EN / HE / HU;
- one build-generated locale-safe header/footer source for Portugal EN / HE / PT;
- locale-preserving navigation and Manage Booking links;
- tour-intent deep links so Buda, Margaret and Private CTAs open the matching booking mode;
- private-mode restoration from the URL;
- stricter customer-copy hygiene for availability/confirmation messages;
- expanded language-integrity and internal-copy QA across public pages;
- the real-tour photography presentation already introduced in v1.30/v1.31.

The existing reviewed v1.31 staging artifact remains the immutable base. During build, `overrides/apply-v1.32.mjs` applies the v1.32 stabilization layer and updates `release.json` to 1.32.0.

Production booking is not enabled by this staging repository.
