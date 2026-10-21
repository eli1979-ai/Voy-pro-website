import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const code=readFileSync('site/assets/site.js','utf8');
assert.match(code,/qs\.get\('affiliate'\)/,'landing link must bind affiliate reference');
assert.match(code,/sessionStorage\.setItem\(AFFILIATE_SESSION_KEY,affiliateQuery\)/,'referral must survive internal page navigation');
assert.match(code,/AFFILIATE_SESSION_KEY='voy_active_affiliate_ref_v1:'\+destinationId/,'partner attribution must be scoped by branch');
assert.match(code,/const initialPromoCode=affiliateCode\|\|campaignPromo\|\|null/,'affiliate link must override promotional query params');
assert.match(code,/if\(affiliateCode\)\{[\s\S]{0,100}panel\.hidden=true/,'hide coupon field whenever a partner link is active');
assert.match(code,/button\.addEventListener\('click',async/,'direct visitors can apply one coupon');
assert.match(code,/api\('\/promotions\/validate'/,'coupon is validated on the server');
assert.match(code,/api\('\/quotes'/,'price is recalculated after coupon entry');
assert.match(code,/promo_code:submission\.promo_code/,'referral must follow human confirmation requests');
assert.match(code,/promo_code:effectivePromoCode\(\)/,'no discount stacking in the checkout request');
assert.match(code,/checkoutForm\.querySelector\('\[data-affiliate-coupon-panel\]'\)/,'block submission during coupon validation');
assert.match(code,/if\(\!bookingState\.capacityRequest\)[\s\S]*?hold_id:bookingState\.hold\.id[\s\S]*?promo_code:next\|\|null/,'private coupon re-quote must use the active hold');
assert.match(code,/bookingState\.isPrivate&&bookingState\.hold\?\.id\?\{hold_id:bookingState\.hold\.id\}:\{\}/,'held re-quote must be private-only');
// A native partner widget is loaded on a third-party domain; the browser-visible
// FBM client key must only be sent to the intentionally configured HTTPS origin.
const nativeWidget=readFileSync('site/assets/affiliate-booking-widget.js','utf8');
assert.match(nativeWidget,/apiRoot\.pathname!=='\\/'/,
  'widget API root must be exactly an origin, without untrusted path prefixes');
assert.match(nativeWidget,/redirect:'error'/,
  'widget must never follow API redirects that could carry the public client key to another host');
console.log('affiliate referral and single-coupon website contract passed');
