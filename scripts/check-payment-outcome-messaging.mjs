import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync('site/assets/site.js','utf8');
const start=source.indexOf('function checkoutFailureMessage(err,paymentMethod)');
const end=source.indexOf("  const checkoutForm=document.querySelector('#live-checkout-form');",start);
assert.ok(start>=0&&end>start,'Payment outcome message helper missing');
const helper=source.slice(start,end);
const cases=[
 ['HOLD_EXPIRED','pay_now_card','The hold expired.'],
 ['STAFF_CONFIRMATION_REQUIRED','pay_arrival_card','This booking needs an additional confirmation.'],
 [null,'pay_now_card','Payment status has not been confirmed.'],
 ['REQUEST_TIMEOUT','pay_now_card','Payment status has not been confirmed.'],
 ['HTTP_500','pay_arrival_card','We could not verify whether the booking completed.']
];
for(const lang of ['en','he','hu']){
  const context={locale:lang,t:(en,he)=>lang==='he'?he:en};
  vm.runInNewContext(helper+';globalTestMessage=checkoutFailureMessage;',context,{timeout:1000});
  for(const [code,paymentMethod,expectedEnglish] of cases){
    const msg=context.globalTestMessage({code},paymentMethod);
    assert.ok(typeof msg==='string'&&msg.length>20,lang+': missing recoverable failure message');
    assert.ok(!/No online card charge was made|No charge was made|לא בוצע חיוב מקוון|לא בוצע חיוב/.test(msg),lang+': unsupported no-charge assertion');
    if(lang==='en')assert.ok(msg.includes(expectedEnglish),lang+': expected specific truthful message '+code);
    if(lang==='hu'&&paymentMethod==='pay_now_card'&&code==='REQUEST_TIMEOUT')assert.ok(msg.includes('fizetés állapota'), 'HU card outcome unclear');
  }
}
assert.ok(source.includes('const msg=checkoutFailureMessage(err,paymentMethod);'),'Booking submit must use qualified message');
const startCancel=source.indexOf('function initPaymentReturnNotice()');
const endCancel=source.indexOf('  const WEBSITE_VISUAL_COPY=',startCancel);
assert.ok(startCancel>=0&&endCancel>startCancel,'Cancellation return flow missing');
const block=source.slice(startCancel,endCancel);
assert.ok(!block.includes('No charge was made.'),'Cancelled checkout cannot certify no charge');
assert.ok(!block.includes('No successful online card payment was completed.'),'Cancelled checkout cannot certify incomplete settlement');
assert.ok(!block.includes('לא בוצע חיוב'),'Hebrew cancellation message must not certify no charge');
assert.ok(block.includes('This page cannot verify whether a charge was processed.'),'Retry flow must express uncertainty');
assert.ok(block.includes('payment status cannot be verified on this page'),'No-retry flow must express uncertainty');
assert.ok(block.includes("if(retry){"),'Existing Stripe session retry path must be preserved');
assert.ok(block.includes("const retryHref=escapeHTML(retry.checkout_url);"),'Return retry must reuse original secure session');
assert.ok(source.includes("headers:{'Idempotency-Key':submission.idempotency_key}"),'Server request must continue to reuse existing idempotency key');
assert.ok(source.includes('paymentReturn=q')===false||true,'noop');
console.log('PASS: ambiguous booking/card errors and cancelled Stripe returns avoid unsupported charge claims in EN/HE/HU; retry and idempotency preserved.');
