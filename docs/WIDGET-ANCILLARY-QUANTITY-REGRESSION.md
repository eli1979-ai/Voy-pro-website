# Native affiliate widget: ancillary quantity validation

Status: corrected and covered by mandatory booking fixture. The widget keeps the last
accepted optional-extra quantity visible if a subsequent edit is blank, negative,
fractional, or above the permitted maximum. The retained quote and extra selection
are not modified by invalid edits, avoiding a mismatch between the form and the
eventual booking payload.

Verified behavioral flow in `scripts/check-affiliate-booking-widget.mjs`:
select a private Budapest departure, accept quantity 1 of a fleece hat,
confirm the held quote, enter each invalid value, and assert the input
reverts to 1 with no additional re-quote. The eventual booking still
submits quantity 1. This fixture is invoked by normal build and site QA;
`scripts/check-widget-ancillary-input-contract.mjs` supplies a separate
source-level regression check.

No changes to price calculations, commission policy, payments, release
configuration, API permissions, or FBM backend.
