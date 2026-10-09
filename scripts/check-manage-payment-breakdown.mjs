import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=fs.readFileSync('site/manage/index.html','utf8');
const start=html.indexOf('function paymentMethodLabel(value)');
const end=html.indexOf(' function supportWhatsApp()',start);
assert.ok(start>=0&&end>start,'payment method/amount label helpers missing');
const methods=html.slice(start,end);
const paymentStart=html.indexOf('function paymentReturnMarkup()');
const paymentEnd=html.indexOf(' function waiverHandoffUrl()',paymentStart);
assert.ok(paymentStart>=0&&paymentEnd>paymentStart,'Stripe return messages missing');
const messages=html.slice(paymentStart,paymentEnd);
assert.ok(html.includes(String.fromCharCode(36)+'{paymentAmountsMarkup(booking)}'),'paid and due values missing from booking detail');
assert.ok(!html.includes("pay_now_card:T('Paid online by card'"),'method label wrongly implies settlement');

for(const locale of ['en','he','hu']){
 const T=(en,he,hu)=>locale==='he'?he:locale==='hu'?hu:en;
 const ctx={
  T,Number,String,booking:{},he:locale==='he',hu:locale==='hu',
  manageMoney:(amount,currency)=>String(amount)+' '+currency,
  esc:v=>String(v).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])),
 };
 vm.runInNewContext(methods+';testMethod=paymentMethodLabel;testAmounts=paymentAmountsMarkup;',ctx,{timeout:1000});
 const online=ctx.testMethod('pay_now_card');
 assert.ok(!/paid|שולם|fizetve/i.test(online),locale+': method must not imply payment success');
 const b={paid_amount:40,balance_due:100,currency:'EUR'};
 const mixed=ctx.testAmounts(b);
 assert.ok(mixed.includes('40 EUR')&&mixed.includes('100 EUR'),locale+': partial paid amount and balance missing');
 assert.ok(mixed.indexOf('40 EUR')<mixed.indexOf('100 EUR'),locale+': breakdown order wrong');
 assert.ok(ctx.testAmounts({paid_amount:0,balance_due:140,currency:'EUR'}).includes('0 EUR'),locale+': known zero paid amount hidden');
 assert.equal(ctx.testAmounts({paid_amount:null,balance_due:undefined,currency:'EUR'}),'',locale+': missing paid/due values fabricated');
 assert.equal(ctx.testAmounts({paid_amount:'bad',balance_due:-5,currency:'EUR'}),'',locale+': invalid paid/due amounts displayed');
 assert.ok(ctx.testAmounts({paid_amount:140,balance_due:0,currency:'EUR'}).includes('0 EUR'),locale+': zero outstanding balance missing');

 ctx.paymentReturn=true;ctx.paymentReturnPending=false;ctx.paymentReturnSettled=false;ctx.paymentIsSettled=()=>true;
 vm.runInNewContext(messages+';testReturn=paymentReturnMarkup;',ctx,{timeout:1000});
 ctx.booking={payment_status:'partially_paid'};
 assert.ok(ctx.testReturn().includes(T('Partial payment received. Your outstanding balance appears below.','התקבל תשלום חלקי. יתרת התשלום מוצגת בהמשך.','Részleges fizetés érkezett. A fennmaradó összeg lent látható.')),locale+': partially-paid message inaccurate');
 ctx.booking={payment_status:'paid'};
 assert.ok(ctx.testReturn().includes(T('Payment received. Your booking payment status is updated.','התשלום התקבל. סטטוס התשלום בהזמנה עודכן.','A fizetés megérkezett. A foglalás fizetési állapota frissült.')),locale+': full payment confirmation missing');
 ctx.paymentIsSettled=()=>false;ctx.paymentReturnSettled=false;ctx.paymentReturnPending=true;ctx.booking={payment_status:'unpaid'};
 assert.ok(!ctx.testReturn().includes('Payment received.'),locale+': Stripe URL cannot confirm settlement');
}
console.log('PASS: EN/HE/HU method labels, server paid/due values and partial/full Stripe return states.');
