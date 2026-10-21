# Native affiliate widget: ancillary quantity display mismatch

Status: regression test prepared, runtime correction pending. Do not merge this draft as a completed fix.

Reproduction: select a private Budapest departure, hold it, and choose quantity 1 of an optional extra. Wait for the partner quote. Then enter 999 or a negative/fractional quantity and blur. The current handler resets the visible field to zero without changing the previously accepted extras or quote. The booking can still include quantity 1 although the form displays zero.

Required fix: in `site/assets/affiliate-booking-widget.js`, within the optional-extra `change` handler, replace the invalid-input `qty.value='0'` fallback with `qty.value=String(selectedExtras.get(offer.product_id)||0);`. Keep the existing accepted quote unchanged and do not submit a new quote on invalid input.

Run `node scripts/check-widget-ancillary-input-contract.mjs` after implementing the fix. This guard is expected to fail against current main. Then run `npm run build`, `npm run verify:launch` and `npm run qa:site` and add a behavioral invalid-after-valid-quantity test before merging.

No pricing, payments, production configuration, partner origin or FBM change is requested.
