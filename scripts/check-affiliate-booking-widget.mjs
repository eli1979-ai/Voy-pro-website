import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const code=fs.readFileSync('site/assets/affiliate-booking-widget.js','utf8');
const required=[
  "document.querySelectorAll('script[data-voy-affiliate-widget]')",
  "const VALID_CODE=",
  "clientKey",
  "x-voy-client-key",
  "credentials:'omit'",
  "mode:'cors'",
  "attachShadow({mode:'closed'})",
  "'/promotions/validate'",
  "promo_code:affiliate",
  "quote.promo_code_applied",
  "'/experiences?destination=budapest'",
  "'/quotes'",
  "'/holds'",
  "'/bookings'",
  "'/payments/intents'",
  "'/booking-capacity-requests'",
  "isPrivate()&&hold?.id?{hold_id:hold.id}:{}",
  "'/ancillary/offers'",
  "Boolean(capabilities?.online_card",
  "address?.hostname!=='checkout.stripe.com'",
];
for(const str of required)assert(code.includes(str),'Required affiliate-widget boundary missing: '+str);
assert(!/\biframe\b/.test(code.replace(/\/\*[\s\S]*?\*\//g,'')),'Do not weaken global frame protection');
assert(!/window\.localStorage|sessionStorage|document\.cookie/.test(code),'Partner widget must not track/store personal data');

class Element {
  constructor(tag='div'){
    this.tagName=tag;this.dataset={};this.value='';this.type='';this.disabled=false;
    this.checked=false;this.children=[];this.listeners={};this.className='';
    this.attributes={};this.classList={
      values:new Set(['hidden']),add:(name)=>this.classList.values.add(name),
      remove:(name)=>this.classList.values.delete(name),
      contains:(name)=>this.classList.values.has(name),
    };
  }
  set innerHTML(value){this.html=value;}
  get innerHTML(){return this.html||'';}
  addEventListener(name,fn){this.listeners[name]=fn;}
  async trigger(name){return this.listeners[name]?.({preventDefault(){}});}
  setAttribute(name,value){this.attributes[name]=value;}
  append(...els){this.children.push(...els);}
  appendChild(el){this.children.push(el);return el;}
  replaceChildren(...els){this.children=[...els];}
  querySelectorAll(selector){return selector==='button'?this.children.filter(x=>x.tagName==='button'):[];}
  focus(){this.focused=true;}
  scrollIntoView(){}
}
function mount({affiliate='TESTPARTNER',clientKey='public_fixture_key',apiRoot='https://fbm-staging.example.invalid',rejectCoupon=false,wrongPartnerQuote=false,staffConfirmation=false,bookingStatus='confirmed',onlinePayment=false,badPaymentReply=null,bookingGuideLanguage='he',staffGuideLanguage='he',staffPromoCode='TESTPARTNER',bookingSelectionOverride=null,
  englishPilot=false,recordedEnglishAlternative='match'}={}){
  const calls=[];
  const timers=[];
  const script=new Element('script');
  script.dataset={voyAffiliateWidget:'',target:'affiliate-target',affiliate,clientKey,apiRoot};
  const mountEl=new Element('div');
  const elements={};
  for(const selector of ['#search','#customer','#searchButton','#confirmButton','#results',
    '#checkout','#success','#status','#slots','#extras','#price','#holdExpiry','#changeButton',
    '#englishAltRow','#englishAltPreferred'])
    elements[selector]=new Element(selector);
  const search=elements['#search'],customer=elements['#customer'];
  search.elements={
    experience:new Element('select'),date:new Element('input'),
    riders:new Element('input'),children:new Element('input'),babies:new Element('input'),
    language:new Element('select'),englishAlternative:new Element('select'),
    private:new Element('input'),
  };
  search.elements.riders.value='2';
  search.elements.children.value='0';
  search.elements.babies.value='0';
  customer.elements={
    name:new Element('input'),email:new Element('input'),
    phone:new Element('input'),payment:new Element('select'),terms:new Element('input'),
  };
  customer.elements.payment.value='pay_arrival_card';
  const root={
    innerHTML:'',
    querySelector:selector=>elements[selector]||null,
  };
  mountEl.attachShadow=()=>root;
  const requests={
    '/api/v1/destinations/budapest':{booking_horizon_days:21},
    '/api/v1/experiences?destination=budapest':[
      {id:'exp_bud_buda',title:'Buda Tour',priceFrom:70,currency:'EUR',
        bookingEnabled:true,privateAllowed:true,privateMinRiders:2,
        guideLanguages:['en','he'],maxIndependentRiders:12},
    ],
    '/api/v1/payments/capabilities':{online_card:onlinePayment,provider:onlinePayment?'stripe':null},
  };
  let held=false;
  let heldPrivate=false;
  let heldEnglishAlternative=null;
  let acceptedQuote=null;
  let expires=new Date(Date.now()+15*60*1000).toISOString();
  const responseFor=(key,payload)=>{
    if(key.includes('/availability?')){
      return {slots:[{id:'22222222-2222-4222-8222-222222222222',time:'10:00',sellable:!staffConfirmation,requestable:staffConfirmation}]};
    }
    if(key==='/api/v1/promotions/validate')return {
      valid:!rejectCoupon&&payload.code===affiliate,code:affiliate,type:'fixed',value:10,
    };
    if(key==='/api/v1/quotes'){
      const data={
        promo_code_applied:wrongPartnerQuote?'OTHERPARTNER':payload.promo_code,
        total:payload.is_private?180:120,discount:20,
        currency:'EUR',expiresAt:new Date(Date.now()+10*60*1000).toISOString(),
        lines:[{type:'discount',label:'Partner discount',line_total_minor:-2000}],
      };
      if(payload.extras?.length)data.total+=10;
      acceptedQuote=data;
      return data;
    }
    if(key==='/api/v1/holds'&&payload)return {
      id:'33333333-3333-4333-8333-333333333333',departure_id:payload.slot_id,
      requested_slot_id:payload.slot_id,guide_language:payload.guide_language,
      expires_at:expires,is_private:payload.is_private,requires_staff_confirmation:false,
      english_alternative_accepted:payload.english_alternative_accepted??null,
    };
    if(key==='/api/v1/ancillary/offers')return [{
      product_id:'44444444-4444-4444-8444-444444444444',name:'Fleece hat',
      price_minor:1000,currency:'EUR',max_per_booking:2,available_quantity:4,
    }];
    if(key==='/api/v1/payments/intents'){
      const result={
        status:badPaymentReply==='completed-missing-reference'||badPaymentReply==='completed'?'completed':'requires_action',
        ui_mode:badPaymentReply==='completed-missing-reference'||badPaymentReply==='completed'?'none':'redirect',
        booking_id:'44444444-4444-4444-8444-444444444444',
        booking_reference:'VP-PAY-MOCK',
        amount:acceptedQuote?.total??120,currency:acceptedQuote?.currency??'EUR',
        checkout_url:'https://checkout.stripe.com/c/pay/cs_test_mock_only'
      };
      if(badPaymentReply==='wrong-total')result.amount+=15;
      if(badPaymentReply==='wrong-currency')result.currency='USD';
      if(badPaymentReply==='untrusted-host')result.checkout_url='https://untrusted.example.invalid/checkout';
      if(badPaymentReply==='missing-reference'||badPaymentReply==='completed-missing-reference')
        delete result.booking_reference;
      if(badPaymentReply==='completed'||badPaymentReply==='completed-missing-reference')
        result.amount=0;
      return result;
    }
    if(key==='/api/v1/bookings')return {
      reference:'VOY-MOCK-BOOKING',status:bookingStatus,manage_token:'not-a-real-token',
      experience_id:'exp_bud_buda',selected_date:budapestToday(),
      group_composition:{riders_16_plus:2,child_passengers_3_15:0,baby_passengers_1_2:0},
      is_private:heldPrivate,
      english_alternative_accepted:recordedEnglishAlternative==='match'
        ?heldEnglishAlternative:!heldEnglishAlternative,
      ...(bookingSelectionOverride||{}),
      guide_language:bookingGuideLanguage,
      total:acceptedQuote?.total,discount:acceptedQuote?.discount,
      currency:acceptedQuote?.currency,promo_code_applied:payload.promo_code,
    };
    if(key==='/api/v1/booking-capacity-requests')return {
      type:'booking_capacity_request',status:'pending',reference:'VP-CAP-TEST',
      guide_language:staffGuideLanguage,pricing:{promo_code_applied:staffPromoCode},
      english_alternative_accepted:recordedEnglishAlternative==='match'
        ?(payload.english_alternative_accepted??null):!(payload.english_alternative_accepted??null),
    };
    throw new Error('Unexpected mocked route: '+key);
  };
  const fetch=async(url,options)=>{
    const parsed=new URL(url);
    const key=parsed.pathname+parsed.search;
    let payload=options?.body?JSON.parse(options.body):null;
    calls.push({key,payload,options});
    if(options?.method==='DELETE'){held=false;return {ok:true,status:204,json:async()=>null};}
    const result=requests[key]||responseFor(key,payload);
    if(key==='/api/v1/holds'&&payload){
      held=true;heldPrivate=payload.is_private;
      heldEnglishAlternative=payload.english_alternative_accepted??null;
    }
    return {ok:true,status:payload?201:200,json:async()=>result};
  };
  const document={
    querySelectorAll:s=>s==='script[data-voy-affiliate-widget]'?[script]:[],
    getElementById:s=>s==='affiliate-target'?mountEl:null,
    createElement:tag=>new Element(tag),
  };
  let redirect=null;
  const location={href:'https://partner.example.invalid/tours',assign:url=>redirect=url};
  const context={document,location,URL,URLSearchParams,Intl,Date,Number,Math,Set,Map,
    Object,String,Boolean,Error,RegExp,Array,fetch,crypto:{randomUUID:()=> '77777777-7777-4777-8777-777777777777'},
    setInterval:cb=>{timers.push(cb);return timers.length;},
    clearInterval:()=>{},console,
  };
  const fixtureCode=englishPilot
    ?code.replace('const ENGLISH_ALT_PILOT_ENABLED=false;',
      'const ENGLISH_ALT_PILOT_ENABLED=true;'):code;
  vm.runInNewContext(fixtureCode,context,{timeout:1500,filename:'affiliate-booking-widget.js'});
  return {script,elements,calls,search,customer,root,timers,redirect:()=>redirect};
}
function budapestToday(){
  const parts=new Intl.DateTimeFormat('en-GB',{
    timeZone:'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit',
  }).formatToParts(new Date());
  const d=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return [d.year,d.month,d.day].join('-');
}
async function chooseFirstDeparture(app,{englishAlternative=null}={}){
  await flush();
  app.search.elements.experience.value='exp_bud_buda';
  await app.search.elements.experience.trigger('change');
  app.search.elements.language.value='he';
  if(englishAlternative!==null){
    await app.search.elements.language.trigger('change');
    app.search.elements.englishAlternative.value=englishAlternative;
    await app.search.elements.englishAlternative.trigger('change');
  }
  app.search.elements.date.value=budapestToday();
  await app.search.trigger('submit');
  const button=app.elements['#slots'].children[0];
  assert(button?.listeners.click,'Expected a live bookable time button');
  await button.trigger('click');
}
async function flush(){
  for(let i=0;i<12;i++)await Promise.resolve();
}
{
  const app=mount({clientKey:''});
  await flush();
  assert.equal(app.calls.length,0,'Widget must fail closed without public client config');
  assert.match(app.elements['#status'].textContent,/not configured/i);
}
{
  const app=mount();
  await flush();
  app.search.elements.experience.value='exp_bud_buda';
  await app.search.elements.experience.trigger('change');
  app.search.elements.date.value=budapestToday();
  await app.search.trigger('submit');
  assert(!app.calls.some(call=>call.key.includes('/availability?')),
    'No customer should enter partner availability without explicitly choosing guiding language');
  assert.match(app.elements['#status'].textContent,/Choose a guiding language/i);
  assert(app.search.elements.language.focused,'Missing language selection should receive keyboard focus');
  app.search.elements.language.value='fr';
  await app.search.trigger('submit');
  assert(!app.calls.some(call=>call.key.includes('/availability?')),
    'An unsupported language is not equivalent to a valid customer choice');
  app.search.elements.language.value='he';
  const guideOption=app.search.elements.language.children.find(item=>item.value==='he');
  assert.equal(guideOption?.textContent,'Hebrew',
    'Partner language options should be human-readable while values stay canonical codes');
  await app.search.trigger('submit');
  assert(app.calls.some(call=>call.key.includes('/availability?')),
    'A catalog-supported explicit choice should permit availability search');
  const slot=app.elements['#slots'].children[0];
  assert(slot?.listeners.click,'A valid explicit guiding language should allow selecting a departure');
  await slot.trigger('click');
  const hold=app.calls.find(call=>call.key==='/api/v1/holds'&&call.payload);
  assert.equal(hold?.payload.guide_language,'he',
    'The exact customer-selected guiding language must persist in the hold');
}
{
  const app=mount();
  await flush();
  assert(app.calls.some(c=>c.key==='/api/v1/experiences?destination=budapest'),
    'Widget must fetch the server-owned tour catalog');
  assert(app.calls.some(c=>c.key==='/api/v1/destinations/budapest'),
    'Widget must request the canonical Budapest date horizon');
  const dateField=app.search.elements.date;
  const days=Math.round((Date.parse(dateField.max+'T12:00:00Z')-
    Date.parse(dateField.min+'T12:00:00Z'))/86400000);
  assert.equal(days,21,'Date max must derive from the server horizon as calendar days');
  assert.equal(dateField.value,dateField.min,'Current Budapest date remains initially selected');
  app.search.elements.experience.value='exp_bud_buda';
  await app.search.elements.experience.trigger('change');
  app.search.elements.language.value='he';
  app.search.elements.private.checked=true;
  await app.search.elements.private.trigger('change');
  app.search.elements.date.value=budapestToday();
  await app.search.trigger('submit');
  const avail=app.calls.find(c=>c.key.includes('/availability?'));
  assert(avail,'Availability must use the existing public endpoint');
  assert.equal(avail.options.headers['x-voy-client-key'],'public_fixture_key');
  assert.equal(avail.options.credentials,'omit','Widget must not send partner cookies to FBM');
  const button=app.elements['#slots'].children[0];
  assert(button?.listeners.click,'Expected a live bookable time button');
  await button.trigger('click');
  assert(!app.elements['#checkout'].classList.contains('hidden'),'Held private quote must open checkout');
  const quoteCalls=app.calls.filter(c=>c.key==='/api/v1/quotes');
  assert(quoteCalls.length>=2,'Private held booking must re-quote after hold');
  assert.equal(quoteCalls[0].payload.promo_code,'TESTPARTNER');
  assert.equal(quoteCalls[1].payload.hold_id,'33333333-3333-4333-8333-333333333333');
  const extras=app.elements['#extras'].children.filter(c=>c.tagName==='label');
  assert.equal(extras.length,1);
  const qty=extras[0].children[1];qty.value='1';await qty.trigger('change');
  const extraQuote=app.calls.filter(c=>c.key==='/api/v1/quotes').at(-1);
  assert.equal(extraQuote.payload.extras[0].quantity,1);
  assert.equal(extraQuote.payload.hold_id,'33333333-3333-4333-8333-333333333333');
  // Invalid edits must not silently change the previously accepted add-on
  // or alter the live FBM quote. The number field must reflect the same value
  // that will eventually be sent with the booking.
  const quoteCallsBeforeInvalid=app.calls.filter(c=>c.key==='/api/v1/quotes').length;
  for(const invalid of ['', '-1', '2.5', '999']){
    qty.value=invalid;
    await qty.trigger('change');
    assert.equal(qty.value,'1','The field must restore the last accepted ancillary quantity');
    assert.equal(app.calls.filter(c=>c.key==='/api/v1/quotes').length,
      quoteCallsBeforeInvalid,'Invalid quantity must not create an amended quote');
  }
  assert.equal(app.elements['#checkout'].classList.contains('hidden'),false,
    'The accepted booking must remain available after rejected quantity edits');


  app.customer.elements.name.value='Example Person';
  app.customer.elements.email.value='guest@example.invalid';
  app.customer.elements.phone.value='+1555000000';
  app.customer.elements.terms.checked=true;
  await app.customer.trigger('submit');
  const final=app.calls.find(c=>c.key==='/api/v1/bookings');
  assert(final,'Booking confirmation must use FBM rather than partner-form submission');
  assert.equal(final.payload.promo_code,'TESTPARTNER');
  assert.equal(final.payload.hold_id,'33333333-3333-4333-8333-333333333333');
  assert.equal(final.payload.extras[0].quantity,1);
  assert.equal(final.options.headers['idempotency-key'],'77777777-7777-4777-8777-777777777777');
  assert.equal(app.redirect(),null,'Pay-on-arrival booking should finish inside the host website');
  assert(!app.elements['#success'].classList.contains('hidden'));
  const confirmedText=app.elements['#success'].children.map(x=>x.textContent).join(' ');
  assert.match(confirmedText,/Requested guiding language: Hebrew/,
    'Partner booking confirmation must show the original customer-selected guide language');
  assert.match(confirmedText,/will be confirmed with the assigned guide/,
    'Booking success must not guarantee unverified guide-language staffing');
  assert.doesNotMatch(confirmedText,/English would also|English fallback accepted/i,
    'Partner widget must not imply customer accepted an English alternative');
}

{
  const app=mount({affiliate:'SECOND_PARTNER'});
  await chooseFirstDeparture(app);
  const promotion=app.calls.find(c=>c.key==='/api/v1/promotions/validate');
  const quote=app.calls.find(c=>c.key==='/api/v1/quotes');
  assert.equal(promotion?.payload.code,'SECOND_PARTNER',
    'An embedded partner must validate its own coupon, not a fixture default');
  assert.equal(quote?.payload.promo_code,'SECOND_PARTNER',
    'The initial quote must retain the exact embedded affiliate');
  assert(!app.elements['#checkout'].classList.contains('hidden'),
    'A second valid partner must be allowed to complete the booking');
  app.customer.elements.name.value='Example Person';
  app.customer.elements.email.value='guest@example.invalid';
  app.customer.elements.phone.value='+1555000000';
  app.customer.elements.terms.checked=true;
  await app.customer.trigger('submit');
  const booking=app.calls.find(c=>c.key==='/api/v1/bookings');
  assert.equal(booking?.payload.promo_code,'SECOND_PARTNER',
    'Booking must preserve the originating affiliate through confirmation');
}

{
  const app=mount({affiliate:'SECOND_PARTNER'});
  await chooseFirstDeparture(app);
  const firstHold=app.calls.find(c=>c.key==='/api/v1/holds'&&c.payload);
  assert(firstHold,'First selection must create a hold');
  await app.elements['#changeButton'].trigger('click');
  assert(app.calls.some(c=>c.key==='/api/v1/holds/33333333-3333-4333-8333-333333333333'&&c.options.method==='DELETE'),
    'Changing selection must release the previous hold');
  app.search.elements.date.value=budapestToday();
  await app.search.trigger('submit');
  const nextSlot=app.elements['#slots'].children[0];
  assert(nextSlot?.listeners.click,'New selection must expose a bookable departure');
  await nextSlot.trigger('click');
  const validations=app.calls.filter(c=>c.key==='/api/v1/promotions/validate');
  assert.equal(validations.length,2,'Changing selection must revalidate the partner discount');
  assert(validations.every(c=>c.payload.code==='SECOND_PARTNER'),
    'Affiliate must persist through both selections');
  const quotes=app.calls.filter(c=>c.key==='/api/v1/quotes');
  assert(quotes.length>=2&&quotes.every(c=>c.payload.promo_code==='SECOND_PARTNER'),
    'Both selections must use the same originating partner in quotes');
  app.customer.elements.name.value='Example Person';
  app.customer.elements.email.value='guest@example.invalid';
  app.customer.elements.phone.value='+1555000000';
  app.customer.elements.terms.checked=true;
  await app.customer.trigger('submit');
  const booking=app.calls.find(c=>c.key==='/api/v1/bookings');
  assert.equal(booking?.payload.promo_code,'SECOND_PARTNER',
    'Booking after selection change must retain originating affiliate');
}

{
  for(const config of [{affiliate:'BAD CODE'},{clientKey:''},
    {apiRoot:'http://unsecured.example.invalid'},
    {apiRoot:'https://username:password@fbm-staging.example.invalid'}]){
    const app=mount(config);
    await flush();
    assert.equal(app.calls.length,0,'Malformed partner configuration must not call the booking API');
    assert.match(app.elements['#status'].textContent,/not configured/i,
      'Invalid partner configuration needs a clear accessible error');
    assert(app.elements['#searchButton'].disabled,
      'Invalid partner config must leave booking disabled');
  }
}
{
  const app=mount({rejectCoupon:true});
  await chooseFirstDeparture(app);
  assert(app.calls.some(x=>x.key==='/api/v1/promotions/validate'),
    'The selected affiliate coupon must be validated for the exact departure');
  assert(!app.calls.some(x=>x.key==='/api/v1/holds'),
    'Invalid affiliate coupons must never reserve a departure');
  assert(app.elements['#checkout'].classList.contains('hidden'),
    'Invalid affiliate coupon must not expose checkout');
  assert.match(app.elements['#status'].textContent,/not currently valid/i);
}
{
  const app=mount({wrongPartnerQuote:true});
  await chooseFirstDeparture(app);
  assert(app.calls.some(x=>x.key==='/api/v1/quotes'),
    'The server must calculate the partner quote');
  assert(!app.calls.some(x=>x.key==='/api/v1/holds'),
    'A quote assigned to another partner must never reserve a departure');
  assert(app.elements['#checkout'].classList.contains('hidden'),
    'Wrong partner quote must not expose checkout');
  assert.match(app.elements['#status'].textContent,/not attributed/i);
}

// The distributed widget has the English-alternative flag hard disabled.
// Only this isolated VM fixture clones the source with a synthetic true flag.
{
  const app=mount();
  await chooseFirstDeparture(app);
  assert(app.elements['#englishAltRow'].classList.contains('hidden'),
    'Public source must not display optional English alternative');
  assert(app.search.elements.englishAlternative.disabled,
    'Public English alternative input must remain disabled');
  assert(!app.calls.some(c=>c.payload&&Object.hasOwn(c.payload,'english_alternative_accepted')),
    'Unapproved public pilot never sends an English-alternative field');
}
for(const [answer,expected] of [['yes',true],['no',false],['',null]]){
  for(const staffConfirmation of [false,true]){
    const app=mount({englishPilot:true,staffConfirmation});
    await chooseFirstDeparture(app,{englishAlternative:answer});
    assert(!app.elements['#englishAltRow'].classList.contains('hidden'),
      'Test-only enabled pilot shows optional language choice for Hebrew');
    assert(!app.search.elements.englishAlternative.disabled);
    if(!staffConfirmation){
      const hold=app.calls.find(c=>c.key==='/api/v1/holds');
      assert.strictEqual(hold?.payload.english_alternative_accepted,expected,
        'Hold records explicit Yes/No/unknown without replacing Hebrew');
    }
    app.customer.elements.name.value='Example Person';
    app.customer.elements.email.value='guest@example.invalid';
    app.customer.elements.phone.value='+1555000000';
    app.customer.elements.terms.checked=true;
    await app.customer.trigger('submit');
    if(staffConfirmation){
      const request=app.calls.find(c=>c.key==='/api/v1/booking-capacity-requests');
      assert.strictEqual(request?.payload.english_alternative_accepted,expected,
        'Pending staff request records explicit Yes/No/unknown');
    }
    const receipt=app.elements['#success'].children.map(x=>x.textContent).join(' ');
    assert.match(receipt,/Requested guiding language: Hebrew/,
      'Original guiding language must never silently change to English');
    assert.match(receipt,new RegExp('English alternative: '+
      (expected===true?'Accepted':expected===false?'Declined':'Not answered')),
      'Receipt accurately preserves distinct Yes/No/unanswered statuses');
  }
}
{
  const app=mount({englishPilot:true,staffConfirmation:true,
    recordedEnglishAlternative:'mismatch'});
  await chooseFirstDeparture(app,{englishAlternative:'yes'});
  app.customer.elements.name.value='Example Person';
  app.customer.elements.email.value='guest@example.invalid';
  app.customer.elements.phone.value='+1555000000';
  app.customer.elements.terms.checked=true;
  await app.customer.trigger('submit');
  assert.match(app.elements['#success'].children.map(x=>x.textContent).join(' '),
    /English alternative needs verification/,
    'Mismatched server-recorded English consent requires staff verification');
  assert.equal(app.calls.filter(c=>c.key==='/api/v1/booking-capacity-requests').length,1,
    'No duplicate staff request after ambiguous opt-in');
}
// A superficially valid booking response must reflect the product/date/group
// the customer selected, not a different FBM record with a matching total.
const changedSelections=[
  {experience_id:'exp_bud_margaret'},
  {selected_date:'2026-11-30'},
  {group_composition:{riders_16_plus:1,child_passengers_3_15:0,baby_passengers_1_2:0}},
  {group_composition:{riders_16_plus:2,child_passengers_3_15:1,baby_passengers_1_2:0}},
  {group_composition:null},
  {is_private:true},
  {is_private:null},
];
for(const bookingSelectionOverride of changedSelections){
  const app=mount({bookingSelectionOverride});
  await chooseFirstDeparture(app);
  app.customer.elements.name.value='Example Person';
  app.customer.elements.email.value='guest@example.invalid';
  app.customer.elements.phone.value='+1555000000';
  app.customer.elements.terms.checked=true;
  await app.customer.trigger('submit');
  const receipt=app.elements['#success'].children.map(x=>x.textContent).join(' ');
  assert.match(receipt,/Booking selection needs verification/,
    'Unexpected booking identity must be held for staff review');
  assert.match(receipt,/Booking reference: VOY-MOCK-BOOKING/,
    'Preserve the original FBM reference');
  assert.doesNotMatch(receipt,/Your booking has been received/,
    'Do not claim wrong tour, date or group was successfully booked');
  assert.match(app.elements['#status'].textContent,/Do not submit again/,
    'No new commercial request after an unexpected server identity');
  assert(app.elements['#checkout'].classList.contains('hidden'),
    'Do not leave a second booking form open');
  assert.equal(app.calls.filter(c=>c.key==='/api/v1/bookings').length,1,
    'No duplicate booking request');
  assert(!app.calls.some(c=>c.options.method==='DELETE'),
    'Do not release a hold that may already have been converted');
}
// Online Stripe redirects must carry the exact quoted amount/currency
// and a verifiable booking identity. The simulated URLs are never opened.
for(const badPaymentReply of ['wrong-total','wrong-currency','untrusted-host',
  'missing-reference','completed-missing-reference']){
  const app=mount({onlinePayment:true,badPaymentReply});
  await chooseFirstDeparture(app);
  app.customer.elements.name.value='Example Person';
  app.customer.elements.email.value='guest@example.invalid';
  app.customer.elements.phone.value='+1555000000';
  app.customer.elements.terms.checked=true;
  app.customer.elements.payment.value='pay_now_card';
  await app.customer.trigger('submit');
  assert.equal(app.calls.filter(c=>c.key==='/api/v1/payments/intents').length,1,
    'Ambiguous online payment must submit once with the preserved idempotency key');
  assert.equal(app.redirect(),null,
    'Mismatch '+badPaymentReply+' must not redirect the guest to Stripe/another site');
  assert.match(app.elements['#status'].textContent,/Do not submit again/,
    'Ambiguous online payment requires staff review and locks another checkout');
  assert(app.elements['#checkout'].classList.contains('hidden'),
    'Ambiguous online payment must close the checkout form');
  assert(!app.calls.some(c=>c.options.method==='DELETE'),
    'Possible prepared payment must not release a converted hold');
}
for(const badPaymentReply of [null,'completed']){
  const app=mount({onlinePayment:true,badPaymentReply});
  await chooseFirstDeparture(app);
  app.customer.elements.name.value='Example Person';
  app.customer.elements.email.value='guest@example.invalid';
  app.customer.elements.phone.value='+1555000000';
  app.customer.elements.terms.checked=true;
  app.customer.elements.payment.value='pay_now_card';
  await app.customer.trigger('submit');
  if(badPaymentReply===null)
    assert.match(String(app.redirect()),/^https:\/\/checkout\.stripe\.com\//,
      'Valid server-quoted online checkout must retain the Stripe redirect');
  else
    assert.match(app.elements['#success'].children.map(x=>x.textContent).join(' '),
      /VP-PAY-MOCK.*Payment confirmed/s,
      'Idempotent completed payment with verified booking identity shows a receipt');
}
// Staff-review requests are not bookings, but the returned FBM pricing
// must still attribute the request to the originating affiliate offer.
for(const staffPromoCode of [null,'OTHERPARTNER','']){
  const app=mount({staffConfirmation:true,staffPromoCode});
  await chooseFirstDeparture(app);
  app.customer.elements.name.value='Example Person';
  app.customer.elements.email.value='guest@example.invalid';
  app.customer.elements.phone.value='+1555000000';
  app.customer.elements.terms.checked=true;
  await app.customer.trigger('submit');
  const requests=app.calls.filter(c=>c.key==='/api/v1/booking-capacity-requests');
  assert.equal(requests.length,1,'Ambiguous promotion attribution cannot submit twice');
  assert.equal(requests[0]?.payload.promo_code,'TESTPARTNER',
    'Original affiliate code was sent to FBM');
  const receipt=app.elements['#success'].children.map(x=>x.textContent).join(' ');
  assert.match(receipt,/Partner attribution needs verification/,
    'Partner mismatch must have manual verification rather than a success receipt');
  assert.match(receipt,/Request reference: VP-CAP-TEST/,
    'Staff can reconcile the actual pending request');
  assert.doesNotMatch(receipt,/Your confirmation request was received/,
    'Do not claim expected partner discount was recorded');
  assert(app.elements['#checkout'].classList.contains('hidden'),
    'Pending ambiguous request must close the form');
  assert.match(app.elements['#status'].textContent,/Do not submit again/,
    'Avoid another staff request after uncertain response');
  assert(!app.calls.some(c=>c.key==='/api/v1/bookings'||c.key==='/api/v1/payments/intents'),
    'Pending staff request cannot create booking or payment');
}
// Validate the guide language persisted by FBM, not only the one submitted.
for(const badLanguage of [null,'en','fr']){
  for(const staffConfirmation of [false,true]){
    const app=mount(staffConfirmation
      ?{staffConfirmation,staffGuideLanguage:badLanguage}
      :{bookingGuideLanguage:badLanguage});
    await chooseFirstDeparture(app);
    app.customer.elements.name.value='Example Person';
    app.customer.elements.email.value='guest@example.invalid';
    app.customer.elements.phone.value='+1555000000';
    app.customer.elements.terms.checked=true;
    await app.customer.trigger('submit');
    const endpoint=staffConfirmation?'/api/v1/booking-capacity-requests':'/api/v1/bookings';
    assert.equal(app.calls.filter(c=>c.key===endpoint).length,1,
      'Language mismatch never sends an automatic second booking or staff request');
    const receipt=app.elements['#success'].children.map(x=>x.textContent).join(' ');
    assert.match(receipt,/Guiding language needs verification/,
      'Missing/mismatched recorded language goes to manual review');
    assert.match(receipt,/Reference: (?:VP-CAP-TEST|VOY-MOCK-BOOKING)/,
      'Keep the real booking or staff-request reference');
    assert.match(receipt,/Requested guiding language: Hebrew/,
      'Preserve original customer choice');
    assert.doesNotMatch(receipt,/Your booking has been received|Your confirmation request was received/,
      'Do not claim a successfully persisted language');
    assert(app.elements['#checkout'].classList.contains('hidden'),
      'Close checkout after language discrepancy');
    assert.match(app.elements['#status'].textContent,/Do not submit again/,
      'Warn against an unverified second submission');
    assert(!app.calls.some(c=>c.options.method==='DELETE'),
      'Do not release possibly converted hold');
  }
}
{
  const app=mount({bookingGuideLanguage:'HE'});
  await chooseFirstDeparture(app);
  app.customer.elements.name.value='Example Person';
  app.customer.elements.email.value='guest@example.invalid';
  app.customer.elements.phone.value='+1555000000';
  app.customer.elements.terms.checked=true;
  await app.customer.trigger('submit');
  assert.match(app.elements['#success'].children.map(x=>x.textContent).join(' '),
    /Your booking has been received/,
    'A case-insensitive valid recorded guide language must still succeed');
}
// The backend's public response schema accepts any non-empty status string.
 // In particular, HTTP 2xx + a valid reference must NOT make a cancelled,
 // refunded, pending or unknown result look like an active confirmed booking.
for(const bookingStatus of ['cancelled','refunded','pending','unknown_status']){
  const app=mount({bookingStatus});
  await chooseFirstDeparture(app);
  app.customer.elements.name.value='Example Person';
  app.customer.elements.email.value='guest@example.invalid';
  app.customer.elements.phone.value='+1555000000';
  app.customer.elements.terms.checked=true;
  await app.customer.trigger('submit');
  assert.equal(app.calls.filter(call=>call.key==='/api/v1/bookings').length,1,
    'Unexpected '+bookingStatus+' status must not cause automatic booking retry');
  const detail=app.elements['#success'].children.map(node=>node.textContent).join(' ');
  assert.match(detail,/Booking needs staff review/,
    'Unexpected booking status must use a manual verification outcome');
  assert.match(detail,/VOY-MOCK-BOOKING/,
    'Keep the server reference for staff reconciliation');
  assert.match(detail,new RegExp('Reported status: '+bookingStatus),
    'Show the actual status instead of inferring confirmed');
  assert.doesNotMatch(detail,/Your booking has been received/,
    'Never label unusual status as a successful booking');
  assert(app.elements['#checkout'].classList.contains('hidden'),
    'Ambiguous/terminal status must close the final booking form');
  assert(!app.calls.some(call=>call.options.method==='DELETE'),
    'Do not release a hold possibly converted by the booking server');
  assert.match(app.elements['#status'].textContent,/Do not submit again/,
    'Prevent a customer from creating a second booking without staff review');
}
{
  const app=mount({staffConfirmation:true});
  await chooseFirstDeparture(app);
  assert(!app.elements['#checkout'].classList.contains('hidden'),
    'Staff-requestable time must offer a customer request form');
  assert(!app.calls.some(c=>c.key==='/api/v1/holds'),
    'A request to book must not reserve any fleet or departure');
  assert(!app.calls.some(c=>c.key==='/api/v1/quotes'),
    'Human-review-required availability must not be shown as a guaranteed live price');
  assert(!app.calls.some(c=>c.key==='/api/v1/bookings'||c.key==='/api/v1/payments/intents'),
    'No booking or payment should be attempted before staff approval');
  assert.match(app.elements['#holdExpiry'].textContent,/No place is reserved/i);
  assert.equal(app.elements['#confirmButton'].textContent,'Send confirmation request');
  app.customer.elements.name.value='Test Guest';
  app.customer.elements.email.value='guest@example.invalid';
  app.customer.elements.phone.value='+1555000000';
  app.customer.elements.terms.checked=true;
  await app.customer.trigger('submit');
  const req=app.calls.find(c=>c.key==='/api/v1/booking-capacity-requests');
  assert(req,'A staff request must use the central FBM Request to Book API');
  assert.equal(req.payload.promo_code,'TESTPARTNER');
  assert.equal(req.payload.group_composition.riders_16_plus,2);
  assert.equal(req.payload.is_private,false);
  assert.equal(req.options.headers['idempotency-key'],'77777777-7777-4777-8777-777777777777');
  assert(!app.calls.some(c=>c.key==='/api/v1/bookings'||c.key==='/api/v1/payments/intents'),
    'A submitted human approval request is never a confirmed booking or charged');
  assert(!app.elements['#success'].classList.contains('hidden'));
  const messages=app.elements['#success'].children.map(x=>x.textContent).join(' ');
  assert.match(messages,/not a confirmed booking/i);
  assert.match(messages,/VP-CAP-TEST/);
  assert.match(messages,/Requested guiding language: Hebrew/,
    'Staff request receipt must display original requested guiding language');
  assert.doesNotMatch(messages,/English fallback accepted|English would also/i,
    'Staff request cannot infer acceptance of English alternative');
}
{
  const app=mount({staffConfirmation:true,rejectCoupon:true});
  await chooseFirstDeparture(app);
  assert(!app.calls.some(c=>c.key==='/api/v1/booking-capacity-requests'),
    'Invalid affiliate code must never produce a staff request');
  assert(app.elements['#checkout'].classList.contains('hidden'));
}
console.log('Affiliate native booking widget QA passed: configuration, explicit requested guide language in booking/request receipts, CORS key, held quotes, extras, attribution and staff approval.');
