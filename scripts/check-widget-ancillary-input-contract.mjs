import fs from 'node:fs';
import assert from 'node:assert/strict';

// Regression contract for the partner-site native booking widget.
// This guard intentionally fails until the visible quantity and accepted quote
// are kept in sync after an invalid ancillary input.
const source=fs.readFileSync('site/assets/affiliate-booking-widget.js','utf8');
const start=source.indexOf("qty.addEventListener('change',()=>{");
const end=source.indexOf("qty.dataset.productId=offer.product_id;",start);
assert(start>=0&&end>start,'Cannot find the optional-extra change handler');
const handler=source.slice(start,end);
assert.match(handler,/selectedExtras\.set\(offer\.product_id,quantity\)/,
  'Valid quantity must continue to update the accepted extras');
assert.match(handler,/selectedExtras\.get\(offer\.product_id\)/,
  'Invalid input must restore the previously accepted extra quantity');
assert.doesNotMatch(handler,/qty\.value\s*=\s*['"]0['"]/,
  'Do not show zero after an invalid edit when the quoted extra is still nonzero');
assert.match(handler,/return refreshQuote\(\)/,
  'A valid ancillary change must continue to re-quote through FBM');
console.log('PASS: invalid extra quantity restores the last accepted quote value.');
