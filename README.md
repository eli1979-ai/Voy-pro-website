# VOY PRO Website

Staging deployment repository for the VOY PRO website.

Current staged release: **v1.32.6**.

v1.32.6 fixes the Budapest booking selector across English, Hebrew and Hungarian:
- Buda and Margaret are embedded directly in the booking form HTML in every Budapest locale.
- The selector no longer depends on a language-specific “Loading tours…” placeholder.
- The live catalog is still requested in the background, with a timeout and a safe known-tour fallback.
- The user’s selected tour is preserved if live catalog data arrives later.
- v1.32.4 branding/location polish and the full-photo presentation remain active.

Production booking is not enabled by this staging repository.
