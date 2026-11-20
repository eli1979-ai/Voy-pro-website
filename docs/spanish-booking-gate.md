# Spanish Budapest booking — canonical UI parity, release gated

The 14 Spanish Budapest pages share the normal `/assets/site.js` FBM adapter.
Eleven pages use **the same booking form markup, field names, DOM hooks and
checkout/confirmation logic** as their English equivalents. The three
manual-only English routes (Heroes’ Square, Citadella Advanced and the
Extended Buda + Margaret tour) remain manual-only in Spanish and navigate
to the Spanish Budapest booking home or the local WhatsApp team.

Static source strings: `tools/es-budapest/booking-dictionary.json`.
Runtime strings: `site/assets/es-booking-module.js` (translation-only; no
independent booking form, API calls or business rules). The generator
preserves the exact common form and dynamic data attributes.

**NO-GO for hosted booking activation**: Both `esBookingEnabled===true` and
`esBookingLocaleCertified===true` are still required by the canonical FBM
adapter, and both are absent from committed Production runtime config.
Static/visual parity does not prove safe real booking, cancellation, payment,
availability, or complete Spanish legal content.

Commercial activation additionally requires synthetic signed FBM E2E,
independent localization/legal check (including Manage Booking), financial,
capacity and security sign-off, recovery readiness and a new explicit
owner approval for the exact PR/commit, environment, hosted flags and launch.
