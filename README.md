# VOY PRO Website

Staging deployment repository for the VOY PRO website.

Current staged release: **v1.28.0**.

The deployment artifact is stored as split base64 chunks under `.deploy-parts/`.
The Vercel build reconstructs the reviewed v1.28 staging artifact and publishes `dist/`.

Production booking is not managed from this repository.
