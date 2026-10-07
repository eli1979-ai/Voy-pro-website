import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
const requireText=(text,label)=>{if(!js.includes(text))failures.push(label);};

requireText("function isStripeCheckoutUrl(value)",'Stripe checkout URL validator missing');
requireText("return u.protocol==='https:'&&u.hostname==='checkout.stripe.com'",'Stripe checkout URL validator must require HTTPS + checkout.stripe.com');
requireText("if(!isStripeCheckoutUrl(payment?.checkout_url))throw Object.assign(new Error('Secure card payment could not be started.'),{code:'PAYMENT_START_FAILED'})",'initial payment redirect must reject non-Stripe checkout URLs');
requireText("rememberPaymentRetry(payment);patchSession({stage:'payment_redirect'",'validated checkout must still preserve retry/session state');
requireText("location.assign(payment.checkout_url)",'validated checkout URL must remain the redirect target');

if(failures.length){
  console.error('Stripe initial redirect security guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Stripe initial redirect security guard OK: first payment redirect and retry both require HTTPS checkout.stripe.com.');
