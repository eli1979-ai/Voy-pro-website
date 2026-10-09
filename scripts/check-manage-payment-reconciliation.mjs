import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src=fs.readFileSync('site/manage/index.html','utf8');
const loadStart=src.indexOf('async function load(){');
const loadEnd=src.indexOf(' function esc(v)',loadStart);
assert.ok(loadStart>=0&&loadEnd>loadStart,'Manage Booking load workflow missing');
const loadBlock=src.slice(loadStart,loadEnd);

for(const locale of ['en','he','hu']){
  for(const optionsDown of [false,true]){
    const calls=[],sandbox={
      token:'fictional_test_token',paymentReturn:true,booking:null,opt:null,riderIntake:null,
      destinationRuntime:null,optionsUnavailable:false,box:{innerHTML:''},lang:locale,
      T:(en,he,hu)=>locale==='he'?he:locale==='hu'?hu:en,
      supportWhatsApp:()=> 'https://wa.me/36300993099',
      encodeURIComponent,Promise,
      render:()=>calls.push('render'),
      reconcilePaymentReturn:async()=>calls.push('reconcile'),
      api:async path=>{
        calls.push(path);
        if(path.endsWith('/options')){
          if(optionsDown)throw Object.assign(new Error('Options temporarily unavailable'),{code:'HTTP_503'});
          return {can_change_datetime:true,cancellation:{allowed:true}};
        }
        if(path.endsWith('/riders'))return {riders:[]};
        if(path==='/destinations/budapest')return {rider_policy:{standard_min_age:16}};
        if(path==='/manage/fictional_test_token')return {reference:'V-TEST',payment_status:'paid'};
        throw new Error('Unexpected API request '+path);
      }
    };
    vm.runInNewContext(loadBlock+';testLoad=load;',sandbox,{timeout:1000});
    await sandbox.testLoad();
    assert.equal(sandbox.booking?.payment_status,'paid',locale+': payment status lost when options unavailable');
    assert.equal(calls.includes('reconcile'),true,locale+': payment return not reconciled');
    assert.equal(sandbox.optionsUnavailable,optionsDown,locale+': options outage state invalid');
    assert.equal(sandbox.opt.can_change_datetime,!optionsDown,locale+': unsafe change-date permission on outage');
    assert.equal(sandbox.opt.cancellation.allowed,!optionsDown,locale+': unsafe cancel permission on outage');
    assert.equal(sandbox.box.innerHTML,'',locale+': should not display booking-not-loaded error when options fail');
  }
}
const messageStart=src.indexOf(' function paymentReturnMarkup(){');
const messageEnd=src.indexOf(' function waiverHandoffUrl()',messageStart);
assert.ok(messageStart>=0&&messageEnd>messageStart,'payment confirmation banner missing');
const messageFn=src.slice(messageStart,messageEnd);
for(const locale of ['en','he','hu']){
  const s={
    T:(en,he,hu)=>locale==='he'?he:locale==='hu'?hu:en,
    paymentReturn:true,paymentReturnPending:true,paymentReturnSettled:false,
    paymentIsSettled:()=>false
  };
  vm.runInNewContext(messageFn+';testPaymentMarkup=paymentReturnMarkup;',s,{timeout:1000});
  const pending=s.testPaymentMarkup();
  assert.ok(!pending.includes('Payment completed in Stripe'),locale+': must not presume Stripe completed');
  assert.ok(!pending.includes('התשלום הושלם')&&!pending.includes('fizetés befejeződött'),locale+': payment success must be verified');
  s.paymentReturnPending=false;
  const unresolved=s.testPaymentMarkup();
  assert.ok(!unresolved.includes('Payment received.'),locale+': unresolved must not show payment received');
  s.paymentIsSettled=()=>true;
  assert.ok(s.testPaymentMarkup().includes(s.T('Payment received. Your booking payment status is updated.','התשלום התקבל. סטטוס התשלום בהזמנה עודכן.','A fizetés megérkezett. A foglalás fizetési állapota frissült.')),locale+': only verified booking status confirms receipt');
}
const renderer=fs.readFileSync('scripts/render-manage-payment-return-lock.mjs','utf8');
assert.ok(renderer.includes("box.removeAttribute('aria-busy')"),'must clear busy state after return reconciliation');
assert.ok(renderer.includes("box.removeAttribute('data-payment-return-lock')"),'must clear lock marker after return reconciliation');
assert.ok(src.includes("optionsUnavailable?'<div class=\"notice\" role=\"status\">'"),'customers must see optional action outage explanation');
console.log('PASS: Manage Booking EN/HE/HU retains verified payment data through options outage, restricts actions, avoids presumed Stripe success, and clears reconciliation lock.');
