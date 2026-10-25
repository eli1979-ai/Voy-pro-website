// Real Chrome coverage of affiliate embedding, fully isolated from live FBM.
// Closed shadow root is opened ONLY in this test context for inspection.
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright';

const out=resolve('visual-qa-output');
const widget=await readFile('dist/assets/affiliate-booking-widget.js');
const originAPI='https://fbm-widget-fixture.invalid';
const partnerScript='<script src="/assets/affiliate-booking-widget.js" data-voy-affiliate-widget data-target="affiliate-target" data-affiliate="TESTPARTNER" data-client-key="public_fixture_key" data-api-root="'+originAPI+'"></script>';
const pageHTML='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Simulated Partner</title></head><body><main><h1>Partner-only demo</h1><div id="affiliate-target"></div></main>'+partnerScript+'</body></html>';
const headEmbedHTML='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Simulated Head Embed</title>'+partnerScript+'</head><body><main><h1>Partner-only demo</h1><div id="affiliate-target"></div></main></body></html>';
const duplicateEmbedHTML='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Double Partner Embed</title>'+partnerScript+partnerScript+'</head><body><main><h1>Partner-only demo</h1><div id="affiliate-target"></div></main></body></html>';
const wpLikeHTML='<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Isolated RTL WordPress-style partner fixture</title><style>.entry-content button,.entry-content input,.entry-content select{background:#f00!important;color:#000!important}body{font-family:serif}</style></head><body><article class="entry-content"><h1>דף שותף לדוגמה</h1><form id="wp-contact"><label>טופס עצמאי <input type="text" value="guest"></label><button type="button">Host form</button></form><div id="affiliate-target"></div>'+partnerScript+'</article></body></html>';
const server=createServer((req,res)=>{
  if(req.url==='/'||req.url==='/?head-embed'||req.url==='/?duplicate-embed'||req.url==='/?wp-rtl'){
    res.writeHead(200,{'content-type':'text/html'});
    res.end(req.url==='/?wp-rtl'?wpLikeHTML:req.url==='/?duplicate-embed'?duplicateEmbedHTML:req.url==='/?head-embed'?headEmbedHTML:pageHTML);
  }
  else if(req.url==='/assets/affiliate-booking-widget.js'){
    res.writeHead(200,{'content-type':'text/javascript'});res.end(widget);
  }else{res.writeHead(404);res.end('not found');}
});
await mkdir(out,{recursive:true});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const host='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.CI?{channel:'chrome'}:{})});
let failures=0;
const lines=[];
const check=(value,label)=>{
  if(value)lines.push('PASS: '+label);
  else{failures++;lines.push('FAIL: '+label);}
};
const tourId='exp_bud_buda',alternateTourId='exp_bud_margaret',slotId='22222222-2222-4222-8222-222222222222';
async function run(name,{mobile=false,staffRequest=false,staleLanguageRace=false,expiredSlots=false,slowFinalSubmission=false,firstPostFails=false,headEmbed=false,duplicateEmbed=false,holdExpiresDuringPost=null,badHold=null,malformedBookingReply=null,malformedStaffReply=null,wpRtl=false,mutatedRetryAfter503=false,badQuote=null,withExtras=false,switchSlotAfterExtras=false,quoteExpiresBeforeConfirmation=false,departureStartsBeforeSubmit=false,slowHoldReleaseSwitch=false,bookingPriceMismatch=null,quoteExpiresAfterFailedPost=false}={}){
  const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:800},reducedMotion:'reduce'});
  const calls=[],errors=[];
  let delayNextAvailability=false,finalAttempts=0;
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    const shadow=Element.prototype.attachShadow;
    Element.prototype.attachShadow=function(settings){
      return shadow.call(this,{...settings,mode:'open'});
    };
  });
  await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin===host)return route.continue();
    if(url.origin!==originAPI||!url.pathname.startsWith('/api/v1/'))return route.abort();
    const method=req.method(),path=url.pathname+url.search;
    const h={'access-control-allow-origin':host,
      'access-control-allow-methods':'GET,POST,DELETE,OPTIONS',
      'access-control-allow-headers':'x-voy-client-key,content-type,idempotency-key'};
    if(method==='OPTIONS')return route.fulfill({status:204,headers:h,body:''});
    if(!['GET','POST','DELETE'].includes(method))return route.abort();
    const payload=method==='POST'?req.postDataJSON():null;
    calls.push({path,method,payload,idempotencyKey:req.headers()['idempotency-key']||null});
    if(firstPostFails&&method==='POST'&&
      (path==='/api/v1/bookings'||path==='/api/v1/booking-capacity-requests')){
      finalAttempts++;
      if(finalAttempts===1)return route.fulfill({
        status:503,headers:{...h,'content-type':'application/json'},
        body:JSON.stringify({error:'Simulated temporary upstream failure'})
      });
    }
    if(holdExpiresDuringPost&&path==='/api/v1/bookings'){
      await new Promise(done=>setTimeout(done,1850));
      if(holdExpiresDuringPost==='error')return route.fulfill({
        status:503,headers:{...h,'content-type':'application/json'},
        body:JSON.stringify({error:'Simulated booking gateway uncertainty'})
      });
    }
    if(staleLanguageRace&&delayNextAvailability&&path.includes('/availability?')){
      delayNextAvailability=false;
      await new Promise(done=>setTimeout(done,650));
    }
    let data;
    if(path==='/api/v1/destinations/budapest')
      data={booking_horizon_days:21,timezone:'Europe/Budapest'};
    else if(path==='/api/v1/experiences?destination=budapest')
      data=[{id:tourId,title:'Buda Tour',priceFrom:70,currency:'EUR',bookingEnabled:true,
        guideLanguages:['en','he'],privateAllowed:true,privateMinRiders:2,maxIndependentRiders:12},
        {id:alternateTourId,title:'Margaret Tour',priceFrom:70,currency:'EUR',bookingEnabled:true,
          guideLanguages:['en','hu'],privateAllowed:true,privateMinRiders:2,maxIndependentRiders:12}];
    else if(path==='/api/v1/payments/capabilities')data={online_card:false};
    else if(path.includes('/availability?'))data={slots:expiredSlots?[
      {id:'11111111-1111-4111-8111-111111111111',time:'09:00',
        starts_at:new Date(Date.now()-60000).toISOString(),sellable:true,requestable:false},
      {id:slotId,time:'10:00',starts_at:new Date(Date.now()+60000).toISOString(),
        sellable:!staffRequest,requestable:staffRequest}
    ]:[
      {id:slotId,time:'10:00',sellable:!staffRequest,requestable:staffRequest,
        ...(departureStartsBeforeSubmit?{starts_at:new Date(Date.now()+60000).toISOString()}: {})},
      ...(switchSlotAfterExtras||slowHoldReleaseSwitch?[{id:'44444444-4444-4444-8444-444444444444',
        time:'11:00',sellable:true,requestable:false}]:[])
    ]};
    else if(path==='/api/v1/promotions/validate')
      data={valid:payload?.code==='TESTPARTNER',code:'TESTPARTNER'};
    else if(path==='/api/v1/quotes'){
      data={promo_code_applied:payload?.promo_code,
        total:withExtras&&payload?.extras?.some(x=>x.quantity>0)?130:120,
        discount:20,currency:'EUR',expiresAt:new Date(Date.now()+
          (quoteExpiresBeforeConfirmation||quoteExpiresAfterFailedPost?2:10)*60*1000).toISOString(),
        lines:[{label:'Partner discount',line_total_minor:-2000}]};
      if(badQuote==='missing-total')delete data.total;
      if(badQuote==='invalid-currency')data.currency='NOT_A_CURRENCY';
      if(badQuote==='missing-expiry')delete data.expiresAt;
      if(badQuote==='expired-expiry')data.expiresAt=new Date(Date.now()-60000).toISOString();
    }
    else if(path==='/api/v1/holds')data={
      ...(badHold==='missing-id'?{}:{id:'33333333-3333-4333-8333-333333333333'}),
      departure_id:slotId,
      ...(badHold==='missing-expiry'?{}:{expires_at:badHold==='invalid-expiry'?'not-a-date':
        new Date(Date.now()+(badHold==='past-expiry'?-60000:600000)).toISOString()}),
      requires_staff_confirmation:false
    };
    else if(path==='/api/v1/ancillary/offers')data=withExtras?[{
      product_id:'extra-camera',name:'Camera rental',price_minor:1000,
      max_per_booking:3,available_quantity:3,currency:'EUR',product_kind:'rental'
    }]:[];
    else if(path==='/api/v1/bookings'){
      if(slowFinalSubmission)await new Promise(done=>setTimeout(done,650));
      const expectedTotal=withExtras&&payload?.extras?.some(x=>x.quantity>0)?130:120;
      data=malformedBookingReply==='missing-reference'
        ?{status:'confirmed',manage_token:null}
        :malformedBookingReply==='missing-status'
          ?{reference:'VOY-FAKE-CONFIRMED',manage_token:null}
          :{reference:'VOY-FAKE-CONFIRMED',status:'confirmed',manage_token:null,
            total:bookingPriceMismatch==='different-total'?expectedTotal+25:expectedTotal,
            discount:20,currency:'EUR',
            ...(bookingPriceMismatch==='missing-partner-code'?{}:{promo_code_applied:payload?.promo_code})};
    }else if(path==='/api/v1/booking-capacity-requests'){
      if(slowFinalSubmission)await new Promise(done=>setTimeout(done,650));
      data=malformedStaffReply==='missing-reference'
        ?{type:'booking_capacity_request',status:'pending'}
        :malformedStaffReply==='wrong-status'
          ?{type:'booking_capacity_request',status:'approved',reference:'VP-CAP-FAKE'}
          :{type:'booking_capacity_request',status:'pending',reference:'VP-CAP-FAKE'};
    }
    else if(method==='DELETE'&&path.startsWith('/api/v1/holds/')){
      if(slowHoldReleaseSwitch)await new Promise(done=>setTimeout(done,650));
      return route.fulfill({status:204,headers:h,body:''});
    }
    else return route.fulfill({status:500,headers:{...h,'content-type':'application/json'},
      body:JSON.stringify({error:'Unmocked API route'})});
    return route.fulfill({status:200,headers:{...h,'content-type':'application/json'},
      body:JSON.stringify(data)});
  });
  try{
    const response=await page.goto(host+(wpRtl?'/?wp-rtl':duplicateEmbed?'/?duplicate-embed':headEmbed?'/?head-embed':'/'),{waitUntil:'domcontentloaded',timeout:20000});
    check(response?.status()===200,name+' local partner host loads');
    const root=page.locator('#affiliate-target');
    const experience=root.locator('select[name="experience"]');
    await experience.locator('option[value="'+tourId+'"]').waitFor({state:'attached',timeout:10000});
    if(headEmbed){
      check(await page.locator('script[data-voy-affiliate-widget]').getAttribute('data-voy-mounted')==='true',
        name+' script in document head waits for target before marking mounted');
      check(await root.locator('section[aria-label="VOY PRO partner booking"]').count()===1,
        name+' head-included embed attaches exactly one accessible widget');
    }
    if(wpRtl){
      const hostButton=page.locator('#wp-contact button');
      check(await page.locator('html').getAttribute('dir')==='rtl'&&
        await hostButton.evaluate(node=>getComputedStyle(node).direction)==='rtl',
        name+' simulated Hebrew WordPress host retains its own RTL direction');
      check(await root.locator('#searchButton').evaluate(node=>
        getComputedStyle(node).direction==='ltr'&&
        getComputedStyle(node).backgroundColor==='rgb(18, 87, 137)'),
        name+' English booking widget retains LTR direction and original button styling despite hostile host CSS');
      check(await hostButton.evaluate(node=>getComputedStyle(node).backgroundColor)==='rgb(255, 0, 0)',
        name+' affiliate widget does not override sibling WordPress form styling');
    }
    if(duplicateEmbed){
      check(await page.locator('script[data-voy-affiliate-widget]').count()===2,
        name+' partner CMS fixture loaded two independent copies of same script');
      check(await page.locator('script[data-voy-mounted="true"]').count()===2,
        name+' both script tags settled without trying to attach second shadow root');
      check(await root.locator('section[aria-label="VOY PRO partner booking"]').count()===1,
        name+' duplicated script tags render exactly one booking widget');
      check(await root.getAttribute('data-voy-affiliate-mounted')==='true',
        name+' target is marked as independently installed');
    }
    const dateField=root.locator('input[name="date"]');
    await dateField.evaluate(el=>new Promise((ok,fail)=>{
      let attempts=0;
      const tick=()=>el.max?ok():attempts++<50?setTimeout(tick,30):fail(Error('Missing FBM booking horizon'));
      tick();
    }));
    const dateLimit=await dateField.evaluate(el=>({min:el.min,max:el.max,value:el.value}));
    const dateSpan=Math.round((Date.parse(dateLimit.max+'T12:00:00Z')-
      Date.parse(dateLimit.min+'T12:00:00Z'))/86400000);
    check(dateSpan===21&&dateLimit.value===dateLimit.min,
      name+' partner date picker uses 21-day FBM horizon from destination configuration');
    check(await dateField.evaluate(el=>el.validity.rangeOverflow===false),
      name+' initially selected Budapest local date remains inside verified booking horizon');
    check(await root.locator('h2').innerText()==='Book your Budapest EZRaider tour',
      name+' actual embedded widget renders');
    const language=root.locator('select[name="language"]');
    check(await language.isDisabled(),name+' guide choice is disabled before tour');
    await experience.selectOption(tourId);
    check(await language.locator('option[value="he"]').innerText()==='Hebrew',
      name+' catalog language label is readable');
    check(await language.inputValue()==='',name+' no language default');
    await root.locator('#searchButton').click();
    check(!calls.some(c=>c.path.includes('/availability?')),
      name+' native required validation blocks missing guide language');
    // A partner switching products must make a fresh explicit guide-language
    // choice. Never carry Hebrew into a product whose catalog lacks Hebrew.
    await language.selectOption('he');
    await experience.selectOption(alternateTourId);
    check(await language.inputValue()===''&&await language.locator('option[value="he"]').count()===0,
      name+' switching affiliate tour clears unsupported Hebrew without an English default');
    await root.locator('#searchButton').click();
    check(!calls.some(c=>c.path.includes('/availability?')),
      name+' changed affiliate tour cannot search without a fresh guide choice');
    await language.selectOption('hu');
    await experience.selectOption(tourId);
    check(await language.inputValue()===''&&await language.locator('option[value="hu"]').count()===0,
      name+' returning to original affiliate tour clears unsupported Hungarian');
    await language.selectOption('he');
    if(expiredSlots){
      await root.locator('#searchButton').click();
      const departures=root.locator('#slots button');
      await departures.first().waitFor({timeout:10000});
      check(await departures.count()===1&&await departures.first().innerText()==='10:00',
        name+' past departure filtered, only a future slot remains selectable');
      // The visible slot becomes old while the guest decides. Move only the
      // browser clock forward after rendering; no server data is changed.
      await page.evaluate(()=>{const now=Date.now;Date.now=()=>now()+120000;});
      await departures.first().click();
      check(await departures.count()===0,
        name+' previously visible departure expires at click time');
      check(await root.locator('#results').evaluate(el=>el.classList.contains('hidden')),
        name+' expired option invalidates the whole availability selection');
      check((await root.locator('#status').innerText()).includes('no longer available'),
        name+' expired selection tells customer to recheck availability');
      check(!calls.some(c=>/^\/api\/v1\/(?:promotions\/validate|quotes|holds|bookings|booking-capacity-requests)/.test(c.path)),
        name+' expired slot cannot reach price, hold, booking or staff request');
      check(errors.length===0,name+' no JS errors with time-expired departures');
      await page.screenshot({path:join(out,'affiliate-'+name+'.png'),fullPage:true});
      return;
    }
    if(staleLanguageRace){
      delayNextAvailability=true;
      await root.locator('#searchButton').click();
      for(let i=0;i<50&&!calls.some(c=>c.path.includes('/availability?'));i++)
        await new Promise(done=>setTimeout(done,20));
      check(calls.some(c=>c.path.includes('/availability?')&&c.path.includes('guide_language=he')),
        name+' delayed availability begins with explicitly chosen Hebrew');
      await language.selectOption('en');
      check(await root.locator('#slots button').count()===0,
        name+' guide-language switch immediately clears old departures');
      await new Promise(done=>setTimeout(done,750));
      check(await root.locator('#slots button').count()===0,
        name+' late Hebrew availability response cannot resurrect slots after English selection');
      check(await root.locator('#results').evaluate(node=>node.classList.contains('hidden')),
        name+' late response never reopens old availability panel');
      check(!calls.some(c=>/^\/api\/v1\/(?:holds|quotes|bookings|booking-capacity-requests)/.test(c.path)),
        name+' a stale availability response never triggers commercial requests');
      check(errors.length===0,name+' no JavaScript errors in delayed-language fixture');
      await page.screenshot({path:join(out,'affiliate-'+name+'.png'),fullPage:true});
      return;
    }
    await root.locator('#searchButton').click();
    const departure=root.locator('#slots button').first();
    await departure.waitFor({timeout:10000});
    check(calls.some(c=>c.path.includes('/availability?')&&c.path.includes('guide_language=he')),
      name+' catalog-valid Hebrew preference travels with affiliate availability request');
    // Language-specific sellable/requestable departure results must be removed
    // immediately when the guiding language changes, before any hold or CRM
    // request can be issued from that stale result.
    await language.selectOption('en');
    check(await departure.count()===0,
      name+' affiliate language change invalidates previously displayed departure');
    await language.selectOption('he');
    await root.locator('#searchButton').click();
    await departure.waitFor({timeout:10000});
    check(await departure.count()===1,
      name+' searching with current language produces a fresh departure');
    const availabilityCalls=calls.filter(c=>c.path.includes('/availability?'));
    check(availabilityCalls.length===2&&availabilityCalls.every(c=>c.path.includes('guide_language=he')),
      name+' refreshed affiliate availability never omits or changes the chosen language');
    await departure.click();
    if(badQuote){
      await root.locator('#status.error').waitFor({timeout:10000});
      const status=await root.locator('#status').innerText();
      check(status.includes('booking price could not be verified'),
        name+' malformed FBM quote shows an explicit unverified-price error');
      check(await root.locator('#checkout:not(.hidden)').count()===0&&
        await root.locator('#confirmButton').isDisabled()&&
        !calls.some(c=>c.path==='/api/v1/holds'),
        name+' malformed price cannot create hold or open checkout');
      check(!calls.some(c=>c.path==='/api/v1/bookings'||
        c.path==='/api/v1/payments/intents'||c.path==='/api/v1/booking-capacity-requests'),
        name+' malformed price never triggers booking, staff request or payment');
      check(errors.length===0,name+' no JS exceptions handling malformed price');
      await page.screenshot({path:join(out,'affiliate-'+name+'.png'),fullPage:true});
      return;
    }
    if(badHold){
      await root.locator('#status.error').waitFor({timeout:10000});
      const status=await root.locator('#status').innerText();
      check(status.includes('hold could not be verified'),
        name+' malformed, missing or expired FBM hold is rejected with a clear error');
      check(await root.locator('#checkout:not(.hidden)').count()===0&&
        !calls.some(c=>c.path==='/api/v1/ancillary/offers'),
        name+' no checkout or ancillary sales offered for unverifiable hold');
      check(!calls.some(c=>c.path==='/api/v1/bookings'||c.path==='/api/v1/payments/intents'),
        name+' unverifiable hold never reaches booking or payment');
      check(badHold==='missing-id'||
        calls.some(c=>c.method==='DELETE'&&c.path.startsWith('/api/v1/holds/')),
        name+' invalid hold with ID is released through canonical delete');
      check(errors.length===0,name+' no JavaScript errors handling invalid hold');
      await page.screenshot({path:join(out,'affiliate-'+name+'.png'),fullPage:true});
      return;
    }
    await root.locator('#checkout:not(.hidden)').waitFor({timeout:10000});
    if(slowHoldReleaseSwitch){
      const promoCount=calls.filter(c=>c.path==='/api/v1/promotions/validate').length;
      await root.locator('#slots button').nth(1).click();
      for(let i=0;i<50&&!calls.some(c=>c.method==='DELETE'&&c.path.startsWith('/api/v1/holds/'));i++)
        await new Promise(done=>setTimeout(done,20));
      check(calls.some(c=>c.method==='DELETE'&&c.path.startsWith('/api/v1/holds/')),
        name+' old departure hold release starts before changing guide language');
      await language.selectOption('en');
      check(await root.locator('#checkout:not(.hidden)').count()===0&&
        await root.locator('#slots button').count()===0,
        name+' guide language change immediately invalidates departure/checkout');
      await new Promise(done=>setTimeout(done,800));
      check(calls.filter(c=>c.path==='/api/v1/promotions/validate').length===promoCount&&
        !calls.some(c=>c.path==='/api/v1/holds'&&c.payload?.slot_id==='44444444-4444-4444-8444-444444444444'),
        name+' late hold release cannot revive old departure or request its promo and hold');
      check((await root.locator('#status').innerText()).includes('Selection changed. Check availability again.'),
        name+' previous asynchronous selection cannot overwrite current feedback');
      check(errors.length===0,name+' no JavaScript exceptions in delayed hold-release race');
      await page.screenshot({path:join(out,'affiliate-'+name+'.png'),fullPage:true});
      return;
    }
    if(withExtras){
      const qty=root.locator('#extras input[data-product-id="extra-camera"]');
      await qty.fill('1');
      // Native number inputs commit their change on blur in actual Chrome.
      await qty.press('Tab');
      for(let i=0;i<50&&!calls.some(c=>c.path==='/api/v1/quotes'&&
        c.payload?.extras?.some(x=>x.quantity===1));i++)
        await new Promise(done=>setTimeout(done,20));
      await root.locator('#price').getByText('€130.00',{exact:false}).waitFor({timeout:10000});
      check(calls.some(c=>c.path==='/api/v1/quotes'&&c.payload?.extras?.some(x=>x.quantity===1)),
        name+' selected optional rental has an FBM-requoted total');
      check(!await root.locator('#confirmButton').isDisabled(),
        name+' validated extra reprice restores the submit control');
      if(switchSlotAfterExtras){
        await root.locator('#slots button').nth(1).click();
        await root.locator('#checkout:not(.hidden)').waitFor({timeout:10000});
        await root.locator('#price').getByText('€120.00',{exact:false}).waitFor({timeout:10000});
        check(await root.locator('#extras input[data-product-id="extra-camera"]').inputValue()==='0',
          name+' switching to second departure visually clears earlier ancillary quantity');
        check(calls.filter(c=>c.path==='/api/v1/quotes').at(-1)?.payload?.extras?.length===0,
          name+' next departure quote contains no extras from previous hold');
        check(calls.filter(c=>c.path==='/api/v1/holds').at(-1)?.payload?.slot_id===
          '44444444-4444-4444-8444-444444444444',
          name+' new hold targets only the second departure');
      }
    }
    check(staffRequest?!calls.some(c=>c.path==='/api/v1/holds'):
      calls.some(c=>c.path==='/api/v1/holds'&&c.payload?.guide_language==='he'),
      name+' hold uses requested language; staff request does not reserve');
    await root.locator('#customer [name="name"]').fill('Browser Fixture');
    await root.locator('#customer [name="email"]').fill('fixture@example.invalid');
    await root.locator('#customer [name="phone"]').fill('+15551234567');
    await root.locator('#customer [name="terms"]').check();
    if(departureStartsBeforeSubmit){
      // User opened checkout while the departure was in the future. Advance
      // browser-only clock beyond starts_at, leaving FBM fixtures unchanged.
      await page.evaluate(()=>{
        const originalNow=Date.now;
        Date.now=()=>originalNow()+2*60*1000;
      });
    }
    if(quoteExpiresBeforeConfirmation){
      // The quote and hold are separate. Advance only the test browser clock
      // beyond the short quote deadline, but before the 10-minute hold TTL.
      await page.evaluate(()=>{
        const actualNow=Date.now;
        Date.now=()=>actualNow()+3*60*1000;
      });
    }
    await root.locator('#confirmButton').click();
    if(bookingPriceMismatch){
      await root.locator('#success:not(.hidden)').waitFor({timeout:10000});
      const receipt=await root.locator('#success').innerText();
      check(receipt.includes('Booking price needs verification')&&
        receipt.includes('Booking reference: VOY-FAKE-CONFIRMED')&&
        !receipt.includes('Your booking has been received'),
        name+' final price or coupon mismatch yields booking reference, not an ordinary confirmation');
      check((await root.locator('#status.error').innerText()).includes('partner discount needs staff verification')&&
        receipt.includes('before making another booking attempt'),
        name+' affected customer receives clear manual reconciliation guidance');
      check(await root.locator('#checkout:not(.hidden)').count()===0&&
        await root.locator('#confirmButton').isDisabled(),
        name+' mismatched final price cannot be booked or paid twice');
      await root.locator('#customer').evaluate(el=>el.dispatchEvent(
        new Event('submit',{bubbles:true,cancelable:true})));
      check(calls.filter(c=>c.path==='/api/v1/bookings').length===1&&
        !calls.some(c=>c.method==='DELETE'&&c.path.startsWith('/api/v1/holds/')),
        name+' final mismatch does not duplicate booking or delete possibly converted hold');
      check(errors.length===0,name+' no uncaught browser exceptions on final booking price mismatch');
      await page.screenshot({path:join(out,'affiliate-'+name+'.png'),fullPage:true});
      return;
    }
    if(departureStartsBeforeSubmit){
      await root.locator('#status.error').waitFor({timeout:10000});
      const message=await root.locator('#status').innerText();
      check(message.includes('departure has already started'),
        name+' departed slot rejected again at confirmation time');
      check(await root.locator('#checkout:not(.hidden)').count()===0&&
        await root.locator('#slots button').count()===0&&
        await root.locator('#confirmButton').isDisabled(),
        name+' expired departure no longer has actionable checkout or stale slots');
      check(!calls.some(c=>c.path==='/api/v1/bookings'||
        c.path==='/api/v1/booking-capacity-requests'||c.path==='/api/v1/payments/intents'),
        name+' past departure cannot send booking, staff request or payment');
      if(!staffRequest){
        for(let i=0;i<25&&!calls.some(c=>c.method==='DELETE'&&c.path.startsWith('/api/v1/holds/'));i++)
          await new Promise(done=>setTimeout(done,20));
        check(calls.some(c=>c.method==='DELETE'&&c.path.startsWith('/api/v1/holds/')),
          name+' stale paid departure releases unused hold via FBM');
      }else{
        check(!calls.some(c=>c.path==='/api/v1/holds'),
          name+' pending staff request never reserves a hold');
      }
      check(errors.length===0,name+' no JS error after departure starts before final submit');
      await page.screenshot({path:join(out,'affiliate-'+name+'.png'),fullPage:true});
      return;
    }
    if(quoteExpiresBeforeConfirmation){
      await root.locator('#status.error').waitFor({timeout:10000});
      const message=await root.locator('#status').innerText();
      check(message.includes('quoted price expired'),
        name+' quote expiry independently blocks checkout before hold expiry');
      check(await root.locator('#checkout:not(.hidden)').count()===0&&
        await root.locator('#confirmButton').isDisabled(),
        name+' quoted price is not shown as actionable after deadline');
      check(calls.some(c=>c.method==='DELETE'&&c.path.startsWith('/api/v1/holds/'))&&
        !calls.some(c=>c.path==='/api/v1/bookings'||c.path==='/api/v1/payments/intents'),
        name+' expired quote releases hold without posting a booking or payment');
      check(errors.length===0,name+' no JS errors on quote expiration');
      await page.screenshot({path:join(out,'affiliate-'+name+'.png'),fullPage:true});
      return;
    }
    if(switchSlotAfterExtras){
      await root.locator('#success:not(.hidden)').waitFor({timeout:10000});
      const posts=calls.filter(c=>c.path==='/api/v1/bookings');
      check(posts.length===1&&Array.isArray(posts[0]?.payload?.extras)&&
        posts[0].payload.extras.length===0,
        name+' confirmed booking payload cannot contain stale ancillary from previous slot');
      check(errors.length===0,name+' no JS errors on cross-departure ancillary reset');
      await page.screenshot({path:join(out,'affiliate-'+name+'.png'),fullPage:true});
      return;
    }
    if(malformedStaffReply){
      await root.locator('#success:not(.hidden)').waitFor({timeout:10000});
      const receipt=await root.locator('#success').innerText();
      check(receipt.includes('Staff request status needs verification')&&
        !receipt.includes('Your confirmation request was received')&&
        !receipt.includes('Request reference:'),
        name+' unverifiable 2xx staff request never creates a fabricated request receipt');
      check((await root.locator('#status.error').innerText()).includes('Staff request outcome is uncertain')&&
        receipt.includes('Please contact VOY PRO before sending another request.'),
        name+' incomplete response gives explicit staff reconciliation guidance');
      check(await root.locator('#checkout:not(.hidden)').count()===0&&
        await root.locator('#confirmButton').isDisabled(),
        name+' uncertain request outcome locks the final customer form');
      await root.locator('#customer').evaluate(el=>el.dispatchEvent(
        new Event('submit',{bubbles:true,cancelable:true})));
      check(calls.filter(c=>c.path==='/api/v1/booking-capacity-requests').length===1&&
        !calls.some(c=>c.path==='/api/v1/bookings'||c.path==='/api/v1/holds'),
        name+' uncertain staff request cannot send a second POST, booking or hold');
      check(errors.length===0,name+' no JavaScript errors from malformed staff response');
      await page.screenshot({path:join(out,'affiliate-'+name+'.png'),fullPage:true});
      return;
    }
    if(malformedBookingReply){
      await root.locator('#success:not(.hidden)').waitFor({timeout:10000});
      const result=await root.locator('#success').innerText();
      check(result.includes('Booking status needs verification')&&
        !result.includes('Your booking has been received')&&
        !result.includes('Status: confirmed'),
        name+' malformed 200 response never creates a fabricated booking receipt');
      check(await root.locator('#status.error').count()===1&&
        result.includes('Please contact VOY PRO before making another booking attempt.'),
        name+' ambiguous successful HTTP reply gives explicit human reconciliation guidance');
      check(await root.locator('#checkout:not(.hidden)').count()===0&&
        await root.locator('#confirmButton').isDisabled(),
        name+' no repeat booking is offered after unverifiable 200 reply');
      await root.locator('#customer').evaluate(el=>el.dispatchEvent(
        new Event('submit',{bubbles:true,cancelable:true})));
      check(calls.filter(c=>c.path==='/api/v1/bookings').length===1&&
        !calls.some(c=>c.method==='DELETE'&&c.path.startsWith('/api/v1/holds/')),
        name+' malformed receipt cannot retry booking or prematurely release possibly converted hold');
      check(errors.length===0,name+' no uncaught JavaScript errors in incomplete receipt case');
      await page.screenshot({path:join(out,'affiliate-'+name+'.png'),fullPage:true});
      return;
    }
    if(holdExpiresDuringPost){
      for(let i=0;i<50&&!calls.some(c=>c.path==='/api/v1/bookings');i++)
        await new Promise(done=>setTimeout(done,20));
      check(calls.filter(c=>c.path==='/api/v1/bookings').length===1,
        name+' booking POST started once before hold time elapsed');
      await page.evaluate(()=>{
        const originalNow=Date.now;
        Date.now=()=>originalNow()+11*60*1000;
      });
      await root.locator('#holdExpiry').getByText('Hold time reached',{exact:false}).waitFor({timeout:3000});
      check(await root.locator('#checkout:not(.hidden)').count()===1,
        name+' expiry during pending POST does not prematurely hide checkout or lose response');
      if(holdExpiresDuringPost==='error'){
        await root.locator('#status.error').waitFor({timeout:10000});
        const message=await root.locator('#status').innerText();
        check(message.includes('booking outcome may be uncertain')&&
          await root.locator('#checkout:not(.hidden)').count()===0&&
          await root.locator('#confirmButton').isDisabled(),
          name+' failed expired-hold POST offers staff recovery not a risky new booking retry');
        check(calls.filter(c=>c.path==='/api/v1/bookings').length===1,
          name+' ambiguous expired booking outcome causes no duplicate booking');
        check(errors.length===0,name+' no JavaScript errors in expired-hold failure recovery');
        await page.screenshot({path:join(out,'affiliate-'+name+'.png'),fullPage:true});
        return;
      }
    }
    if(firstPostFails){
      await root.locator('#status.error').waitFor({timeout:10000});
      const endpoint=staffRequest?'/api/v1/booking-capacity-requests':'/api/v1/bookings';
      const first=calls.filter(c=>c.path===endpoint);
      check(first.length===1,name+' simulated transient failure sends exactly one final POST');
      check(!await experience.isDisabled()&&!await language.isDisabled()&&
        !await dateField.isDisabled()&&!await root.locator('#changeButton').isDisabled()&&
        !await root.locator('#confirmButton').isDisabled(),
        name+' rejected final POST restores tour, language, date and booking controls');
      check(await root.locator('#checkout:not(.hidden)').count()===1,
        name+' failed request keeps original checkout details visible for retry');
      if(quoteExpiresAfterFailedPost){
        await page.evaluate(()=>{
          const realNow=Date.now;
          Date.now=()=>realNow()+3*60*1000;
        });
        await root.locator('#confirmButton').click();
        await root.locator('#success:not(.hidden)').waitFor({timeout:10000});
        const receipt=await root.locator('#success').innerText();
        check(receipt.includes('Previous booking attempt needs verification')&&
          receipt.includes('may already have created a booking')&&
          !receipt.includes('Your booking has been received'),
          name+' prior 503 followed by quote expiry does not suggest an entirely new booking');
        check((await root.locator('#status.error').innerText()).includes('Earlier booking attempt may have succeeded')&&
          await root.locator('#checkout:not(.hidden)').count()===0&&
          await root.locator('#confirmButton').isDisabled(),
          name+' expired quote after ambiguous POST has clear staff recovery and locked checkout');
        await root.locator('#customer').evaluate(el=>el.dispatchEvent(
          new Event('submit',{bubbles:true,cancelable:true})));
        check(calls.filter(c=>c.path==='/api/v1/bookings').length===1&&
          !calls.some(c=>c.method==='DELETE'&&c.path.startsWith('/api/v1/holds/')),
          name+' ambiguous POST and expired quote cannot retry or delete possibly converted hold');
        check(errors.length===0,name+' no uncaught JavaScript exceptions during uncertain quote expiry');
        await page.screenshot({path:join(out,'affiliate-'+name+'.png'),fullPage:true});
        return;
      }
      if(mutatedRetryAfter503){
        const customerEmail=root.locator('#customer [name="email"]');
        const originalEmail=await customerEmail.inputValue();
        await customerEmail.fill('changed-after-submit@example.invalid');
        await root.locator('#confirmButton').click();
        check(await root.locator('#status.error').innerText().then(s=>s.includes('Booking details changed after the previous submission.')),
          name+' modified customer details are explicitly rejected with the original idempotency key');
        check(calls.filter(c=>c.path===endpoint).length===1,
          name+' modified retry sends NO second POST after ambiguous gateway failure');
        await customerEmail.fill(originalEmail);
      }
      await root.locator('#confirmButton').click();
      await root.locator('#success:not(.hidden)').waitFor({timeout:10000});
      const attempts=calls.filter(c=>c.path===endpoint);
      check(attempts.length===2&&attempts.every(c=>c.idempotencyKey===first[0]?.idempotencyKey)&&
        Boolean(first[0]?.idempotencyKey)&&
        JSON.stringify(attempts[0]?.payload)===JSON.stringify(attempts[1]?.payload),
        name+' retry uses same idempotency key and identical original commercial payload');
    }
    if(slowFinalSubmission){
      const endpoint=staffRequest?'/api/v1/booking-capacity-requests':'/api/v1/bookings';
      for(let i=0;i<50&&!calls.some(c=>c.path===endpoint);i++)
        await new Promise(done=>setTimeout(done,20));
      check(calls.some(c=>c.path===endpoint),name+' final request was sent before response delay');
      check(await experience.isDisabled()&&await language.isDisabled()&&
        await dateField.isDisabled()&&await root.locator('#changeButton').isDisabled(),
        name+' tour, language, date and change button remain locked during final POST');
      if(withExtras){
        const quantity=root.locator('#extras input[data-product-id="extra-camera"]');
        check(await quantity.isDisabled()&&await quantity.inputValue()==='1',
          name+' chosen extra quantity is locked while final booking POST is pending');
        await quantity.evaluate(el=>{
          el.value='2';
          el.dispatchEvent(new Event('change',{bubbles:true}));
        });
        check(await quantity.inputValue()==='1'&&
          calls.filter(c=>c.path==='/api/v1/quotes').length===2,
          name+' forced quantity-change event cannot trigger repricing during submission');
      }
      // Even script-triggered form submission cannot bypass the in-flight
      // guard; the original idempotency key and requested intent stay stable.
      await root.locator('#customer').evaluate(el=>el.dispatchEvent(
        new Event('submit',{bubbles:true,cancelable:true})));
      check(calls.filter(c=>c.path===endpoint).length===1,
        name+' repeated submission during pending request cannot create duplicate POSTs');
    }
    await root.locator('#success:not(.hidden)').waitFor({timeout:10000});
    const receipt=await root.locator('#success').innerText();
    check(receipt.includes('Requested guiding language: Hebrew'),
      name+' receipt preserves requested language');
    check(staffRequest?receipt.includes('This is not a confirmed booking'):
      receipt.includes('Language coverage will be confirmed with the assigned guide'),
      name+' receipt never guarantees unverified staffing');
    check(!receipt.includes('English fallback accepted'),name+' no presumed English alternate');
    check(staffRequest?
      calls.some(c=>c.path==='/api/v1/booking-capacity-requests'&&
        c.payload?.guide_language==='he'&&c.payload?.promo_code==='TESTPARTNER')&&
        !calls.some(c=>c.path==='/api/v1/bookings'):
      calls.some(c=>c.path==='/api/v1/bookings'&&c.payload?.promo_code==='TESTPARTNER'),
      name+' affiliate attribution preserved in correct request/booking flow');
    check(!calls.some(c=>c.path==='/api/v1/payments/intents'),
      name+' no online payment attempts');
    check(errors.length===0,name+' no JavaScript exceptions'+
      (errors.length?' ('+errors.join('; ')+')':''));
    await page.screenshot({path:join(out,'affiliate-'+name+'.png'),fullPage:true});
  }catch(e){
    failures++;lines.push('FAIL: '+name+' unexpected error '+String(e.stack||e).slice(0,750));
    await page.screenshot({path:join(out,'affiliate-'+name+'-failed.png')}).catch(()=>{});
  }finally{await page.close();}
}
try{
  await run('desktop-booking');
  await run('mobile-pending-request',{mobile:true,staffRequest:true});
  await run('desktop-late-language-response',{staleLanguageRace:true});
  await run('mobile-late-language-response',{mobile:true,staleLanguageRace:true});
  await run('desktop-expired-departure',{expiredSlots:true});
  await run('mobile-expired-departure',{mobile:true,expiredSlots:true});
  await run('desktop-slow-booking-submit',{slowFinalSubmission:true});
  await run('mobile-slow-staff-request',{mobile:true,staffRequest:true,slowFinalSubmission:true});
  await run('desktop-booking-retry-after-503',{firstPostFails:true});
  await run('mobile-staff-request-retry-after-503',{mobile:true,staffRequest:true,firstPostFails:true});
  await run('desktop-quote-expired-after-ambiguous-booking',{firstPostFails:true,quoteExpiresAfterFailedPost:true});
  await run('mobile-quote-expired-after-ambiguous-booking-with-extra',{mobile:true,withExtras:true,firstPostFails:true,quoteExpiresAfterFailedPost:true});
  await run('desktop-mutated-booking-retry-after-503',{firstPostFails:true,mutatedRetryAfter503:true});
  await run('mobile-mutated-staff-request-retry-after-503',{mobile:true,staffRequest:true,firstPostFails:true,mutatedRetryAfter503:true});
  await run('desktop-head-embed-booking',{headEmbed:true});
  await run('mobile-head-embed-staff-request',{mobile:true,staffRequest:true,headEmbed:true});
  await run('desktop-duplicate-head-scripts',{duplicateEmbed:true});
  await run('mobile-duplicate-head-scripts',{mobile:true,staffRequest:true,duplicateEmbed:true});
  await run('desktop-booking-success-after-local-expiry',{holdExpiresDuringPost:'success'});
  await run('mobile-booking-error-after-local-expiry',{mobile:true,holdExpiresDuringPost:'error'});
  await run('desktop-hold-with-missing-expiry',{badHold:'missing-expiry'});
  await run('mobile-hold-with-invalid-expiry',{mobile:true,badHold:'invalid-expiry'});
  await run('desktop-booking-success-without-reference',{malformedBookingReply:'missing-reference'});
  await run('mobile-booking-success-without-status',{mobile:true,malformedBookingReply:'missing-status'});
  await run('desktop-staff-request-without-reference',{staffRequest:true,malformedStaffReply:'missing-reference'});
  await run('mobile-staff-request-with-wrong-status',{mobile:true,staffRequest:true,malformedStaffReply:'wrong-status'});
  await run('desktop-hold-already-expired',{badHold:'past-expiry'});
  await run('mobile-hold-with-missing-id',{mobile:true,badHold:'missing-id'});
  await run('desktop-wordpress-rtl-embed',{wpRtl:true});
  await run('mobile-wordpress-rtl-staff-request',{mobile:true,staffRequest:true,wpRtl:true});
  await run('desktop-quote-with-missing-total',{badQuote:'missing-total'});
  await run('mobile-quote-with-invalid-currency',{mobile:true,badQuote:'invalid-currency'});
  await run('desktop-quote-with-missing-expiry',{badQuote:'missing-expiry'});
  await run('mobile-quote-with-expired-expiry',{mobile:true,badQuote:'expired-expiry'});
  await run('desktop-quote-expires-before-hold',{quoteExpiresBeforeConfirmation:true});
  await run('mobile-quote-expires-before-hold',{mobile:true,quoteExpiresBeforeConfirmation:true});
  await run('desktop-departure-starts-before-confirm',{departureStartsBeforeSubmit:true});
  await run('mobile-departure-starts-before-staff-request',{mobile:true,staffRequest:true,departureStartsBeforeSubmit:true});
  await run('desktop-final-booking-price-mismatch',{bookingPriceMismatch:'different-total'});
  await run('mobile-final-booking-missing-affiliate-discount',{mobile:true,bookingPriceMismatch:'missing-partner-code'});
  await run('desktop-extra-quantity-locked-during-booking',{slowFinalSubmission:true,withExtras:true});
  await run('desktop-switch-departure-clears-extras',{withExtras:true,switchSlotAfterExtras:true});
  await run('mobile-switch-departure-clears-extras',{mobile:true,withExtras:true,switchSlotAfterExtras:true});
  await run('desktop-change-guide-during-hold-release',{slowHoldReleaseSwitch:true});
  await run('mobile-change-guide-during-hold-release',{mobile:true,slowHoldReleaseSwitch:true});
}finally{
  await browser.close();
  await new Promise(done=>server.close(done));
  const report=['# Affiliate embed real-Chrome report','','All data simulated locally, network to real FBM/vendors blocked; shadow opened ONLY in test context.','','- Failed checks: '+failures,'',...lines,''].join('\n');
  await writeFile(join(out,'affiliate-browser-report.md'),report);
  process.stdout.write(report+'\n');
}
if(failures)process.exitCode=1;
