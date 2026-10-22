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
  "isPrivate()&&hold?.id?{hold_id:hold.id}:{}",
  "'/ancillary/offers'",
  "Boolean(capabilities?.online_card",
  "address.hostname!=='checkout.stripe.com'",
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
  scrollIntoView(){}
}
function mount({affiliate='TESTPARTNER',clientKey='public_fixture_key',apiRoot='https://fbm-staging.example.invalid',rejectCoupon=false,wrongPartnerQuote=false}={}){
  const calls=[];
  const timers=[];
  const script=new Element('script');
  script.dataset={voyAffiliateWidget:'',target:'affiliate-target',affiliate,clientKey,apiRoot};
  const mountEl=new Element('div');
  const elements={};
  for(const selector of ['#search','#customer','#searchButton','#confirmButton','#results',
    '#checkout','#success','#status','#slots','#extras','#price','#holdExpiry','#changeButton'])
    elements[selector]=new Element(selector);
  const search=elements['#search'],customer=elements['#customer'];
  search.elements={
    experience:new Element('select'),date:new Element('input'),
    riders:new Element('input'),children:new Element('input'),babies:new Element('input'),
    language:new Element('select'),private:new Element('input'),
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
    '/api/v1/experiences?destination=budapest':[
      {id:'exp_bud_buda',title:'Buda Tour',priceFrom:70,currency:'EUR',
        bookingEnabled:true,privateAllowed:true,privateMinRiders:2,
        guideLanguages:['en','he'],maxIndependentRiders:12},
    ],
    '/api/v1/payments/capabilities':{online_card:false},
  };
  let held=false;
  let expires=new Date(Date.now()+15*60*1000).toISOString();
  const responseFor=(key,payload)=>{
    if(key.includes('/availability?')){
      return {slots:[{id:'22222222-2222-4222-8222-222222222222',time:'10:00',sellable:true}]};
    }
    if(key==='/api/v1/promotions/validate')return {
      valid:!rejectCoupon&&payload.code===affiliate,code:affiliate,type:'fixed',value:10,
    };
    if(key==='/api/v1/quotes'){
      const data={
        promo_code_applied:wrongPartnerQuote?'OTHERPARTNER':payload.promo_code,
        total:payload.is_private?180:120,discount:20,
        currency:'EUR',lines:[{type:'discount',label:'Partner discount',line_total_minor:-2000}],
      };
      if(payload.extras?.length)data.total+=10;
      return data;
    }
    if(key==='/api/v1/holds'&&payload)return {
      id:'33333333-3333-4333-8333-333333333333',departure_id:payload.slot_id,
      expires_at:expires,is_private:payload.is_private,requires_staff_confirmation:false,
    };
    if(key==='/api/v1/ancillary/offers')return [{
      product_id:'44444444-4444-4444-8444-444444444444',name:'Fleece hat',
      price_minor:1000,currency:'EUR',max_per_booking:2,available_quantity:4,
    }];
    if(key==='/api/v1/bookings')return {
      reference:'VOY-MOCK-BOOKING',status:'confirmed',manage_token:'not-a-real-token',
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
    if(key==='/api/v1/holds'&&payload)held=true;
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
  vm.runInNewContext(code,context,{timeout:1500,filename:'affiliate-booking-widget.js'});
  return {script,elements,calls,search,customer,root,timers,redirect:()=>redirect};
}
function budapestToday(){
  const parts=new Intl.DateTimeFormat('en-GB',{
    timeZone:'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit',
  }).formatToParts(new Date());
  const d=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return [d.year,d.month,d.day].join('-');
}
async function chooseFirstDeparture(app){
  await flush();
  app.search.elements.experience.value='exp_bud_buda';
  await app.search.elements.experience.trigger('change');
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
  assert.equal(app.calls[0].key,'/api/v1/experiences?destination=budapest');
  app.search.elements.experience.value='exp_bud_buda';
  await app.search.elements.experience.trigger('change');
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

console.log('Affiliate native booking widget QA passed: configuration, CORS key, private held quote, extras, attribution, checkout.');
