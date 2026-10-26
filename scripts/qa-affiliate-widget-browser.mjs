// Real Chrome coverage of affiliate embedding, fully isolated from live FBM.
// Closed shadow root is opened ONLY in this test context for inspection.
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright';

const out=resolve('visual-qa-output');
const widget=await readFile('dist/assets/affiliate-booking-widget.js');
// Source gate is part of the public safety boundary. A test-only clone,
// served solely by the local fixture, is the ONLY enabled browser version.
const source=widget.toString('utf8');
const dormantGate='const ENGLISH_ALT_PILOT_ENABLED=false;';
if(source.split(dormantGate).length!==2)
  throw new Error('English-alternative source gate is missing or repeated');
const pilotWidget=Buffer.from(source.replace(dormantGate,
  'const ENGLISH_ALT_PILOT_ENABLED=true;'));
const originAPI='https://fbm-widget-fixture.invalid';
const partnerScript='<script src="/assets/affiliate-booking-widget.js" data-voy-affiliate-widget data-target="affiliate-target" data-affiliate="TESTPARTNER" data-client-key="public_fixture_key" data-api-root="'+originAPI+'"></script>';
const pageHTML='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Simulated Partner</title></head><body><main><h1>Partner-only demo</h1><div id="affiliate-target"></div></main>'+partnerScript+'</body></html>';
const pilotPartnerHTML=pageHTML.replace(
  'src="/assets/affiliate-booking-widget.js"',
  'src="/assets/affiliate-booking-widget-pilot-fixture.js"');
const headEmbedHTML='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Simulated Head Embed</title>'+partnerScript+'</head><body><main><h1>Partner-only demo</h1><div id="affiliate-target"></div></main></body></html>';
const duplicateEmbedHTML='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Double Partner Embed</title>'+partnerScript+partnerScript+'</head><body><main><h1>Partner-only demo</h1><div id="affiliate-target"></div></main></body></html>';
const wpLikeHTML='<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Isolated RTL WordPress-style partner fixture</title><style>.entry-content button,.entry-content input,.entry-content select{background:#f00!important;color:#000!important}body{font-family:serif}</style></head><body><article class="entry-content"><h1>דף שותף לדוגמה</h1><form id="wp-contact"><label>טופס עצמאי <input type="text" value="guest"></label><button type="button">Host form</button></form><div id="affiliate-target"></div>'+partnerScript+'</article></body></html>';
// Rehearse the real WordPress distribution shape: the partner HTML and
// the VOY PRO widget script are on DIFFERENT HTTPS origins. The cross-origin
// asset is fulfilled from local bytes; no public network requests are made.
const crossOriginPartnerHTML=wpLikeHTML.replace(partnerScript,
  partnerScript.replace('src="/assets/affiliate-booking-widget.js"',
    'src="https://voy-pro.com/assets/affiliate-booking-widget.js" defer'));
const partnerCsp="default-src 'none'; script-src https://voy-pro.com; "+
  "connect-src "+originAPI+"; style-src 'unsafe-inline'; form-action 'self'";
const server=createServer((req,res)=>{
  if(req.url==='/'||req.url==='/?head-embed'||req.url==='/?duplicate-embed'||req.url==='/?wp-rtl'||req.url==='/?wp-cross-origin'||req.url==='/?synthetic-english-pilot'){
    res.writeHead(200,{'content-type':'text/html',
      ...(req.url==='/?wp-cross-origin'?{'content-security-policy':partnerCsp}:{})});
    res.end(req.url==='/?synthetic-english-pilot'?pilotPartnerHTML:req.url==='/?wp-cross-origin'?crossOriginPartnerHTML:
      req.url==='/?wp-rtl'?wpLikeHTML:req.url==='/?duplicate-embed'?duplicateEmbedHTML:req.url==='/?head-embed'?headEmbedHTML:pageHTML);
  }
  else if(req.url==='/assets/affiliate-booking-widget-pilot-fixture.js'){
    res.writeHead(200,{'content-type':'text/javascript'});res.end(pilotWidget);
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
async function run(name,{mobile=false,staffRequest=false,staleLanguageRace=false,expiredSlots=false,slowFinalSubmission=false,firstPostFails=false,headEmbed=false,duplicateEmbed=false,holdExpiresDuringPost=null,badHold=null,malformedBookingReply=null,malformedStaffReply=null,wpRtl=false,mutatedRetryAfter503=false,badQuote=null,withExtras=false,switchSlotAfterExtras=false,quoteExpiresBeforeConfirmation=false,departureStartsBeforeSubmit=false,slowHoldReleaseSwitch=false,bookingPriceMismatch=null,quoteExpiresAfterFailedPost=false,allocatedHold=false,midnightRollover=false,badOffers=null,wpCrossOrigin=false,badFinalGuideLanguage=null,badStaffPromoCode=null,bookingSelectionMismatch=null,englishPilot=null,onlinePayment=null,badAvailability=null}={}){
  const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:800},reducedMotion:'reduce'});
  const calls=[],errors=[];
  // Budapest switches from UTC+1 to the next local date at 23:00Z in winter.
  // Simulate a WordPress tab left open across that boundary, without
  // changing the real system clock or sending live booking requests.
  if(midnightRollover)await page.clock.install({time:new Date('2026-10-25T22:59:30.000Z')});
  let delayNextAvailability=false,finalAttempts=0,externalAssetServed=false;
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    const shadow=Element.prototype.attachShadow;
    Element.prototype.attachShadow=function(settings){
      return shadow.call(this,{...settings,mode:'open'});
    };
  });
  await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(wpCrossOrigin&&url.origin==='https://voy-pro.com'&&
      url.pathname==='/assets/affiliate-booking-widget.js'&&!url.search){
      externalAssetServed=true;
      return route.fulfill({status:200,body:widget,contentType:'application/javascript'});
    }
    if(url.origin===host){
      // Never let the cross-origin fixture accidentally use a same-origin
      // script, even if the partner HTML is later accidentally rewritten.
      if(wpCrossOrigin&&url.pathname==='/assets/affiliate-booking-widget.js')
        return route.abort();
      return route.continue();
    }
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
    else if(path==='/api/v1/payments/capabilities')data={online_card:Boolean(onlinePayment),provider:onlinePayment?'stripe':null};
    else if(path.includes('/availability?')){
      const params=url.searchParams;
      const selectedPrivate=params.get('is_private')==='true';
      const composition={
        riders_16_plus:Number(params.get('riders_16_plus')),
        child_passengers_3_15:Number(params.get('child_passengers_3_15')),
        baby_passengers_1_2:Number(params.get('baby_passengers_1_2')),
        request_15yo_independent_assessment:false,
      };
      data={
        experience_id:badAvailability==='wrong-experience'?alternateTourId:tourId,
        date:badAvailability==='wrong-date'?'2030-01-01':params.get('date'),
        is_private:badAvailability==='wrong-private'?!selectedPrivate:selectedPrivate,
        group_composition:{...composition,...(badAvailability==='wrong-group'
          ?{riders_16_plus:composition.riders_16_plus+1}:{})},
        party_size:composition.riders_16_plus+
          composition.child_passengers_3_15+composition.baby_passengers_1_2+
          (badAvailability==='wrong-party-size'?1:0),
        slots:expiredSlots?[
      {id:'11111111-1111-4111-8111-111111111111',time:'09:00',
        starts_at:new Date(Date.now()-60000).toISOString(),sellable:true,requestable:false},
      {id:slotId,time:'10:00',starts_at:new Date(Date.now()+60000).toISOString(),
        sellable:!staffRequest,requestable:staffRequest}
    ]:[
      {id:slotId,time:'10:00',sellable:!staffRequest,requestable:staffRequest,
        ...(departureStartsBeforeSubmit?{starts_at:new Date(Date.now()+60000).toISOString()}: {})},
      ...(switchSlotAfterExtras||slowHoldReleaseSwitch?[{id:'44444444-4444-4444-8444-444444444444',
        time:'11:00',sellable:true,requestable:false}]:[])
      };
      if(Array.isArray(data.slots))data.slots=data.slots.map(slot=>({
        ...slot,is_private:badAvailability==='wrong-slot-private'?!selectedPrivate:selectedPrivate
      }));
      if(badAvailability==='duplicate-slot')data.slots.push({...data.slots[0]});
      if(badAvailability==='missing-slots')delete data.slots;
      if(badAvailability==='missing-slot-id')delete data.slots[0].id;
    }
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
      departure_id:allocatedHold?'55555555-5555-4555-8555-555555555555':(payload?.slot_id||slotId),
      ...(badHold==='missing-requested-slot'?{}:{requested_slot_id:badHold==='wrong-requested-slot'
        ?'66666666-6666-4666-8666-666666666666':(payload?.slot_id||slotId)}),
      guide_language:badHold==='wrong-guide-language'?'en':
        badHold==='missing-guide-language'?null:payload?.guide_language,
      ...(badHold==='missing-expiry'?{}:{expires_at:badHold==='invalid-expiry'?'not-a-date':
        new Date(Date.now()+(badHold==='past-expiry'?-60000:600000)).toISOString()}),
      requires_staff_confirmation:false,
      english_alternative_accepted:payload?.english_alternative_accepted??null
    };
    else if(path==='/api/v1/ancillary/offers'){
      if(badOffers==='unavailable')return route.fulfill({
        status:503,headers:{...h,'content-type':'application/json'},
        body:JSON.stringify({error:'Synthetic optional extras outage'})
      });
      data=withExtras||badOffers?[{
        product_id:'extra-camera',name:'Camera rental',price_minor:1000,
        max_per_booking:3,available_quantity:3,currency:'EUR',product_kind:'rental'
      }]:[];
      if(badOffers==='missing-price')delete data[0].price_minor;
      if(badOffers==='invalid-limit')data[0].max_per_booking='unlimited';
      if(badOffers==='currency-mismatch')data[0].currency='USD';
      if(badOffers==='duplicate-product')data.push({...data[0]});
    }
    else if(path==='/api/v1/payments/intents'){
      const completed=Boolean(onlinePayment?.startsWith('completed'));
      data={
        status:completed?'completed':'requires_action',
        ui_mode:completed?'none':'redirect',
        id:'pi_mock_123',payment_type:'online',payment_method:'pay_now_card',
        booking_id:'44444444-4444-4444-8444-444444444444',
        booking_reference:'VOY-PAY-MOCK',
        amount:completed?0:120,
        currency:'EUR',
        checkout_url:'https://checkout.stripe.com/c/pay/cs_test_mock_no_network',
        payment_link_request_id:'link-request-123',
        expires_at:new Date(Date.now()+10*60*1000).toISOString()
      };
      if(onlinePayment==='wrong-total')data.amount=125;
      if(onlinePayment==='wrong-currency')data.currency='USD';
      if(onlinePayment==='untrusted-host')data.checkout_url='https://not-stripe.invalid/checkout';
      if(onlinePayment==='credential-url')
        data.checkout_url='https://customer:secret@checkout.stripe.com/c/pay/cs_mock';
      if(onlinePayment==='custom-port')
        data.checkout_url='https://checkout.stripe.com:8443/c/pay/cs_mock';
      if(onlinePayment==='expired-checkout')
        data.expires_at=new Date(Date.now()-1000).toISOString();
      if(onlinePayment==='missing-link-id')delete data.payment_link_request_id;
      if(onlinePayment==='wrong-method'||onlinePayment==='completed-wrong-method')
        data.payment_method='pay_arrival_card';
      if(onlinePayment==='completed-wrong-amount')data.amount=15;
      if(onlinePayment==='completed-wrong-currency')data.currency='USD';
      if(onlinePayment==='missing-reference'||onlinePayment==='completed-no-reference')
        delete data.booking_reference;
    }
    else if(path==='/api/v1/bookings'){
      if(slowFinalSubmission)await new Promise(done=>setTimeout(done,650));
      const expectedTotal=withExtras&&payload?.extras?.some(x=>x.quantity>0)?130:120;
      const availabilityCall=calls.filter(c=>c.path.includes('/availability?')).at(-1);
      const requestDetails=new URL(availabilityCall?.path||'/',originAPI).searchParams;
      const expectedGroup={
        riders_16_plus:Number(requestDetails.get('riders_16_plus')),
        child_passengers_3_15:Number(requestDetails.get('child_passengers_3_15')),
        baby_passengers_1_2:Number(requestDetails.get('baby_passengers_1_2'))
      };
      data=malformedBookingReply==='missing-reference'
        ?{status:'confirmed',manage_token:null}
        :malformedBookingReply==='missing-status'
          ?{reference:'VOY-FAKE-CONFIRMED',manage_token:null}
          :{reference:'VOY-FAKE-CONFIRMED',status:'confirmed',manage_token:null,
            experience_id:bookingSelectionMismatch==='experience'?'other-tour':tourId,
            selected_date:bookingSelectionMismatch==='date'?'2030-01-02':requestDetails.get('date'),
            group_composition:{...expectedGroup,...(bookingSelectionMismatch==='group'
              ?{child_passengers_3_15:expectedGroup.child_passengers_3_15+1}:{})},
            is_private:bookingSelectionMismatch==='private'
              ?requestDetails.get('is_private')!=='true':requestDetails.get('is_private')==='true',
            guide_language:badFinalGuideLanguage==='missing'?null:(badFinalGuideLanguage||'he'),
            english_alternative_accepted:englishPilot==='booking-mismatch'?false:
              (calls.filter(c=>c.path==='/api/v1/holds').at(-1)?.payload?.english_alternative_accepted??null),
            total:bookingPriceMismatch==='different-total'?expectedTotal+25:expectedTotal,
            discount:20,currency:'EUR',
            ...(bookingPriceMismatch==='missing-partner-code'?{}:{promo_code_applied:payload?.promo_code})};
    }else if(path==='/api/v1/booking-capacity-requests'){
      if(slowFinalSubmission)await new Promise(done=>setTimeout(done,650));
      data=malformedStaffReply==='missing-reference'
        ?{type:'booking_capacity_request',status:'pending'}
        :malformedStaffReply==='wrong-status'
          ?{type:'booking_capacity_request',status:'approved',reference:'VP-CAP-FAKE'}
          :{type:'booking_capacity_request',status:'pending',reference:'VP-CAP-FAKE',
            guide_language:badFinalGuideLanguage==='missing'?null:(badFinalGuideLanguage||'he'),
            english_alternative_accepted:englishPilot==='staff-mismatch'?false:
              (payload?.english_alternative_accepted??null),
            pricing:{promo_code_applied:badStaffPromoCode==='missing'?null:
              (badStaffPromoCode||payload?.promo_code)}};
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
    const response=await page.goto(host+(englishPilot?'/?synthetic-english-pilot':wpCrossOrigin?'/?wp-cross-origin':wpRtl?'/?wp-rtl':duplicateEmbed?'/?duplicate-embed':headEmbed?'/?head-embed':'/'),{waitUntil:'domcontentloaded',timeout:20000});
    check(response?.status()===200,name+' local partner host loads');
    if(wpCrossOrigin){
      check(externalAssetServed&&
        await page.locator('script[data-voy-affiliate-widget]').getAttribute('src')===
          'https://voy-pro.com/assets/affiliate-booking-widget.js',
        name+' script is loaded from a separate approved first-party HTTPS origin');
      check(response?.headers()['content-security-policy']===partnerCsp,
        name+' WordPress-like CSP permits only the reviewed widget host and API');
    }
    const root=page.locator('#affiliate-target');
    const experience=root.locator('select[name="experience"]');
    await experience.locator('option[value="'+tourId+'"]').waitFor({state:'attached',timeout:10000});
    if(headEmbed){
      check(await page.locator('script[data-voy-affiliate-widget]').getAttribute('data-voy-mounted')==='true',
        name+' script in document head waits for target before marking mounted');
      check(await root.locator('section[aria-label="VOY PRO partner booking"]').count()===1,
        name+' head-included embed attaches exactly one accessible widget');
    }
    if(wpRtl||wpCrossOrigin){
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
    const englishAlt=root.locator('select[name="englishAlternative"]');
    if(englishPilot){
      check(await root.locator('#englishAltRow').isVisible()&&
        !await englishAlt.isDisabled(),
        name+' isolated test clone shows the optional English fallback');
      // The shared Chrome suite intentionally switches Hebrew → English →
      // Hebrew below. It must erase a previous answer. For normal consent
      // tests, choose Yes/No/blank only AFTER that regression step.
      if(englishPilot==='reset'){
        await englishAlt.selectOption('yes');
        check(await language.inputValue()==='he',
          name+' optional English answer never replaces requested Hebrew');
        await language.selectOption('en');
        check(!await root.locator('#englishAltRow').isVisible()&&
          await englishAlt.inputValue()===''&&await englishAlt.isDisabled(),
          name+' selecting English as primary clears old fallback');
        await language.selectOption('he');
        check(await root.locator('#englishAltRow').isVisible()&&
          await englishAlt.inputValue()==='',
          name+' returning to Hebrew requires a fresh explicit fallback choice');
        check(!calls.some(c=>c.path.includes('/availability?')||
          c.path==='/api/v1/holds'||c.path==='/api/v1/bookings'),
          name+' guide changes alone cannot create commercial requests');
        check(errors.length===0,name+' no Chrome exceptions in consent reset');
        await page.screenshot({path:join(out,'affiliate-'+name+'.png'),fullPage:true});
        return;
      }
    }else{
      check(!await root.locator('#englishAltRow').isVisible()&&
        await englishAlt.isDisabled(),
        name+' public source gate keeps English alternative hidden and disabled');
    }
    if(badAvailability){
      await root.locator('#searchButton').click();
      await root.locator('#status.error').waitFor({timeout:10000});
      check((await root.locator('#status').innerText()).includes(
        'availability details could not be verified'),
        name+' mismatched FBM availability displays a clear error');
      check(await root.locator('#results:not(.hidden)').count()===0&&
        await root.locator('#slots button').count()===0,
        name+' mismatched availability cannot render selectable departure slots');
      check(!calls.some(c=>/^\\/api\\/v1\\/(?:promotions\\/validate|quotes|holds|bookings|booking-capacity-requests|payments\\/intents)/.test(c.path)),
        name+' malformed availability never triggers commercial operations');
      check(errors.length===0,name+' no Chrome exception on invalid availability');
      await page.screenshot({path:join(out,'affiliate-'+name+'.png'),fullPage:true});
      return;
    }
    if(midnightRollover){
      const oldDate=await dateField.inputValue();
      check(oldDate==='2026-10-25',name+' tab began with Budapest local October 25');
      await page.clock.setFixedTime(new Date('2026-10-25T23:01:30.000Z'));
      await dateField.focus();
      const picker=await dateField.evaluate(el=>({min:el.min,max:el.max,value:el.value}));
      check(picker.min==='2026-10-26'&&picker.max==='2026-11-16'&&
        picker.value===oldDate,name+' reopening calendar after midnight updates its FBM range before search');
      check(!calls.some(c=>c.path.includes('/availability?')),
        name+' picker focus causes no availability or commercial API request');
      check(await dateField.evaluate(el=>el.validity.rangeUnderflow),
        name+' browser natively prevents a previously selected past date');
      // Native invalid inputs suppress the browser submit event. Invoke the
      // submit handler directly as well to verify the independent app guard.
      await root.locator('#search').evaluate(form=>
        form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
      const fresh=await dateField.evaluate(el=>({min:el.min,max:el.max,value:el.value}));
      check(fresh.min==='2026-10-26'&&fresh.max==='2026-11-16'&&
        fresh.value==='2026-10-25',name+' refreshed FBM 21-day date bounds without silently changing selection');
      check((await root.locator('#status').innerText()).includes('now in the past in Budapest'),
        name+' old selected date is explicitly rejected after Budapest midnight');
      check(!calls.some(c=>c.path.includes('/availability?')),
        name+' stale previous-day date never reaches the booking API');
      await dateField.fill('2026-10-26');
      await root.locator('#searchButton').click();
      await root.locator('#slots button').first().waitFor({timeout:10000});
      check(calls.some(c=>c.path.includes('/availability?')&&c.path.includes('date=2026-10-26')),
        name+' corrected date searches only current Budapest day');
      check(errors.length===0,name+' no JavaScript errors after overnight date correction');
      await page.screenshot({path:join(out,'affiliate-'+name+'.png'),fullPage:true});
      return;
    }
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
    if(englishPilot){
      const answer=englishPilot==='no'?'no':englishPilot==='unanswered'?'':'yes';
      await englishAlt.selectOption(answer);
      check(await englishAlt.inputValue()===answer&&await language.inputValue()==='he',
        name+' refreshed Hebrew selection retains its explicit optional answer');
    }
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
    if(badOffers){
      const warning=root.locator('#extras [role="status"]');
      await warning.waitFor({timeout:10000});
      check((await warning.innerText()).includes('could not be verified'),
        name+' incomplete ancillary list gives clear customer guidance');
      const qty=root.locator('#extras input[data-product-id="extra-camera"]');
      check(await qty.count()===(badOffers==='duplicate-product'?1:0),
        name+' malformed, mismatched or duplicate product rows cannot be selected');
      check(await root.locator('#price').innerText().then(s=>s.includes('Total:')),
        name+' authoritative FBM tour quote remains visible');
      check(await root.locator('#confirmButton').isEnabled(),
        name+' unverified optional extras do not block ordinary booking');
      check(!calls.some(c=>c.path==='/api/v1/quotes'&&c.payload?.extras?.length),
        name+' no malformed extra quantity is sent in a requote');
      check(errors.length===0,name+' no browser JavaScript errors');
      await page.screenshot({path:join(out,'affiliate-'+name+'.png'),fullPage:true});
      return;
    }
    if(allocatedHold){
      check(calls.some(c=>c.path==='/api/v1/holds'&&c.payload?.slot_id===slotId),
        name+' customer requested slot retains its identity on FBM hold creation');
      check(calls.some(c=>c.path==='/api/v1/ancillary/offers'&&
        c.payload?.slot_id==='55555555-5555-4555-8555-555555555555'),
        name+' canonical allocated departure is used only for inventory-linked ancillary offers');
      check(await root.locator('#checkout:not(.hidden)').count()===1,
        name+' valid FBM inventory reallocation does not incorrectly block checkout');
    }
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
    if(onlinePayment){
      const payment=root.locator('#customer [name="payment"]');
      check(await payment.locator('option[value="pay_now_card"]').count()===1,
        name+' payment option appears only when mock FBM enables Stripe');
      await payment.selectOption('pay_now_card');
    }
    await root.locator('#confirmButton').click();
    if(onlinePayment){
      await root.locator('#success:not(.hidden)').waitFor({timeout:10000});
      const textResult=await root.locator('#success').innerText();
      const finalPosts=calls.filter(c=>c.path==='/api/v1/payments/intents');
      check(finalPosts.length===1&&Boolean(finalPosts[0]?.idempotencyKey)&&
        finalPosts[0]?.payload?.promo_code==='TESTPARTNER'&&
        finalPosts[0]?.payload?.payment_method==='pay_now_card',
        name+' one idempotent online request preserves affiliate and selected payment');
      const completed=onlinePayment==='completed';
      check(completed?
        textResult.includes('Payment confirmed')&&textResult.includes('VOY-PAY-MOCK'):
        textResult.includes('Online payment needs verification')&&
          !textResult.includes('Payment confirmed'),
        name+' provider response never fabricates a payment success');
      check(!calls.some(c=>c.path==='/api/v1/bookings')&&
        !calls.some(c=>c.method==='DELETE'&&c.path.startsWith('/api/v1/holds/')),
        name+' online checkout failure never creates duplicate arrival booking or deletes converted hold');
      check(await root.locator('#checkout:not(.hidden)').count()===0,
        name+' payment outcome closes original payment form');
      await root.locator('#customer').evaluate(el=>el.dispatchEvent(
        new Event('submit',{bubbles:true,cancelable:true})));
      check(calls.filter(c=>c.path==='/api/v1/payments/intents').length===1,
        name+' response cannot be submitted again without staff reconciliation');
      check(errors.length===0,name+' mocked online payment has no Chrome exceptions');
      await page.screenshot({path:join(out,'affiliate-'+name+'.png'),fullPage:true});
      return;
    }
    if(bookingSelectionMismatch){
      await root.locator('#success:not(.hidden)').waitFor({timeout:10000});
      const receipt=await root.locator('#success').innerText();
      check(receipt.includes('Booking selection needs verification')&&
        receipt.includes('Booking reference: VOY-FAKE-CONFIRMED')&&
        !receipt.includes('Your booking has been received'),
        name+' different tour/date/group cannot be shown as completed booking');
      check(await root.locator('#checkout:not(.hidden)').count()===0&&
        (await root.locator('#status.error').innerText()).includes('Do not submit again'),
        name+' inconsistent booking response locks customer checkout');
      await root.locator('#customer').evaluate(el=>el.dispatchEvent(
        new Event('submit',{bubbles:true,cancelable:true})));
      check(calls.filter(c=>c.path==='/api/v1/bookings').length===1&&
        !calls.some(c=>c.method==='DELETE'&&c.path.startsWith('/api/v1/holds/')),
        name+' mismatched booking never triggers a duplicate post or unsafe hold release');
      check(errors.length===0,name+' no Chrome exceptions with unexpected booking selection');
      await page.screenshot({path:join(out,'affiliate-'+name+'.png'),fullPage:true});
      return;
    }
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
    if(badStaffPromoCode){
      await root.locator('#success:not(.hidden)').waitFor({timeout:10000});
      const receipt=await root.locator('#success').innerText();
      check(receipt.includes('Partner attribution needs verification')&&
        receipt.includes('Request reference: VP-CAP-FAKE')&&
        !receipt.includes('Your confirmation request was received'),
        name+' wrong/missing partner code keeps request reference but denies ordinary receipt');
      check((await root.locator('#status.error').innerText()).includes('Do not submit again')&&
        await root.locator('#checkout:not(.hidden)').count()===0,
        name+' staff promotion discrepancy locks another submission');
      await root.locator('#customer').evaluate(el=>el.dispatchEvent(
        new Event('submit',{bubbles:true,cancelable:true})));
      check(calls.filter(c=>c.path==='/api/v1/booking-capacity-requests').length===1&&
        !calls.some(c=>c.path==='/api/v1/bookings'||c.path==='/api/v1/payments/intents'||c.path==='/api/v1/holds'),
        name+' no repeated staff request, hold, booking or payment after mismatch');
      check(errors.length===0,name+' partner mismatch has no Chrome exceptions');
      await page.screenshot({path:join(out,'affiliate-'+name+'.png'),fullPage:true});
      return;
    }
    if(badFinalGuideLanguage){
      await root.locator('#success:not(.hidden)').waitFor({timeout:10000});
      const receipt=await root.locator('#success').innerText();
      check(receipt.includes('Guiding language needs verification')&&
        receipt.includes('Requested guiding language: Hebrew')&&
        receipt.includes(staffRequest?'Reference: VP-CAP-FAKE':'Reference: VOY-FAKE-CONFIRMED')&&
        !receipt.includes('Your booking has been received')&&
        !receipt.includes('Your confirmation request was received'),
        name+' missing/mismatched server language fails closed with original request and real reference');
      check((await root.locator('#status.error').innerText()).includes('Do not submit again')&&
        await root.locator('#checkout:not(.hidden)').count()===0,
        name+' recorded language discrepancy disables checkout');
      await root.locator('#customer').evaluate(el=>el.dispatchEvent(
        new Event('submit',{bubbles:true,cancelable:true})));
      const endpoint=staffRequest?'/api/v1/booking-capacity-requests':'/api/v1/bookings';
      check(calls.filter(c=>c.path===endpoint).length===1&&
        !calls.some(c=>c.method==='DELETE'&&c.path.startsWith('/api/v1/holds/')),
        name+' persisted language mismatch cannot duplicate POST or delete possibly converted hold');
      check(errors.length===0,name+' no browser exceptions for language mismatch');
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
      check(await experience.isDisabled()&&await language.isDisabled()&&
        await dateField.isDisabled()&&await root.locator('#changeButton').isDisabled()&&
        await root.locator('#searchButton').isDisabled()&&
        await root.locator('#slots button').first().isDisabled()&&
        !await root.locator('#confirmButton').isDisabled(),
        name+' uncertain final POST prevents a new search/departure while keeping same-key retry available');
      check(await root.locator('#checkout:not(.hidden)').count()===1,
        name+' failed request keeps original checkout details visible for same-key retry');
      const callsBeforeGuard=calls.length;
      await root.locator('#changeButton').evaluate(el=>el.dispatchEvent(
        new MouseEvent('click',{bubbles:true,cancelable:true})));
      await root.locator('#search').evaluate(el=>el.dispatchEvent(
        new Event('submit',{bubbles:true,cancelable:true})));
      await root.locator('#slots button').first().evaluate(el=>el.dispatchEvent(
        new MouseEvent('click',{bubbles:true,cancelable:true})));
      check(calls.length===callsBeforeGuard&&
        await root.locator('#checkout:not(.hidden)').count()===1,
        name+' scripted click/submit cannot delete converted hold or create a second departure after ambiguous POST');
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
    if(englishPilot){
      const answer=englishPilot==='no'?false:
        englishPilot==='unanswered'?null:true;
      const entry=staffRequest?'/api/v1/booking-capacity-requests':'/api/v1/holds';
      const sent=calls.find(c=>c.path===entry&&c.method==='POST');
      check(sent&&Object.hasOwn(sent.payload,'english_alternative_accepted')&&
        sent.payload.english_alternative_accepted===answer,
        name+' persisted preference is exact Yes/No/unanswered rather than inferred');
      check(calls.filter(c=>c.path.includes('/availability?')).every(
        c=>c.path.includes('guide_language=he')),
        name+' fallback preference preserves original Hebrew availability choice');
      if(englishPilot==='staff-mismatch'||englishPilot==='booking-mismatch'){
        const textResult=await root.locator('#success').innerText();
        check(textResult.includes('English alternative needs verification')&&
          !textResult.includes('Your booking has been received')&&
          !textResult.includes('Your confirmation request was received'),
          name+' server consent discrepancy never generates a success receipt');
        check((await root.locator('#status.error').innerText()).includes('Do not submit again')&&
          await root.locator('#checkout:not(.hidden)').count()===0,
          name+' consent mismatch disables new checkout');
        await root.locator('#customer').evaluate(el=>el.dispatchEvent(
          new Event('submit',{bubbles:true,cancelable:true})));
        const finalEndpoint=staffRequest?'/api/v1/booking-capacity-requests':'/api/v1/bookings';
        check(calls.filter(c=>c.path===finalEndpoint).length===1&&
          !calls.some(c=>c.method==='DELETE'&&c.path.startsWith('/api/v1/holds/')),
          name+' server mismatch cannot retry final POST or delete converted hold');
        check(errors.length===0,name+' no Chrome exception in opt-in mismatch');
        await page.screenshot({path:join(out,'affiliate-'+name+'.png'),fullPage:true});
        return;
      }
      const textResult=await root.locator('#success').innerText();
      const label=answer===true?'Accepted':answer===false?'Declined':'Not answered';
      check(textResult.includes('English alternative: '+label)&&
        textResult.includes('Requested guiding language: Hebrew'),
        name+' receipt includes both original language and recorded consent');
    }else{
      check(!calls.some(c=>c.payload&&
        Object.hasOwn(c.payload,'english_alternative_accepted')),
        name+' publicly shipped widget never transmits optional English consent');
    }
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
  await run('desktop-availability-other-experience',{badAvailability:'wrong-experience'});
  await run('mobile-availability-wrong-date',{mobile:true,badAvailability:'wrong-date'});
  await run('desktop-availability-wrong-group',{badAvailability:'wrong-group'});
  await run('mobile-availability-wrong-private',{mobile:true,badAvailability:'wrong-private'});
  await run('desktop-availability-duplicate-slot',{badAvailability:'duplicate-slot'});
  await run('mobile-availability-without-slots',{mobile:true,badAvailability:'missing-slots'});
  await run('desktop-online-payment-completed',{onlinePayment:'completed'});
  await run('mobile-online-payment-wrong-total',{mobile:true,onlinePayment:'wrong-total'});
  await run('desktop-online-payment-wrong-currency',{onlinePayment:'wrong-currency'});
  await run('mobile-online-payment-untrusted-host',{mobile:true,onlinePayment:'untrusted-host'});
  await run('desktop-online-payment-missing-reference',{onlinePayment:'missing-reference'});
  await run('mobile-online-payment-completed-missing-reference',{mobile:true,onlinePayment:'completed-no-reference'});
  await run('desktop-online-payment-completed-wrong-amount',{onlinePayment:'completed-wrong-amount'});
  await run('mobile-online-payment-completed-wrong-currency',{mobile:true,onlinePayment:'completed-wrong-currency'});
  await run('desktop-online-payment-completed-wrong-method',{onlinePayment:'completed-wrong-method'});
  await run('desktop-online-payment-expired-checkout',{onlinePayment:'expired-checkout'});
  await run('mobile-online-payment-credentialed-checkout',{mobile:true,onlinePayment:'credential-url'});
  await run('desktop-online-payment-unexpected-port',{onlinePayment:'custom-port'});
  await run('mobile-online-payment-missing-link-id',{mobile:true,onlinePayment:'missing-link-id'});
  await run('desktop-online-payment-wrong-method',{onlinePayment:'wrong-method'});
  await run('desktop-pilot-english-yes-booking',{englishPilot:'yes'});
  await run('mobile-pilot-english-no-staff-request',{mobile:true,staffRequest:true,englishPilot:'no'});
  await run('desktop-pilot-english-unanswered-booking',{englishPilot:'unanswered'});
  await run('mobile-pilot-english-mismatch-booking',{mobile:true,englishPilot:'booking-mismatch'});
  await run('desktop-pilot-english-mismatch-staff-request',{staffRequest:true,englishPilot:'staff-mismatch'});
  await run('mobile-pilot-english-choice-reset',{mobile:true,englishPilot:'reset'});
  await run('desktop-ancillary-missing-price',{badOffers:'missing-price'});
  await run('desktop-ancillary-service-unavailable',{badOffers:'unavailable'});
  await run('mobile-ancillary-service-unavailable',{mobile:true,badOffers:'unavailable'});
  await run('mobile-ancillary-invalid-limit',{mobile:true,badOffers:'invalid-limit'});
  await run('desktop-ancillary-cross-currency',{badOffers:'currency-mismatch'});
  await run('mobile-ancillary-duplicate-product',{mobile:true,badOffers:'duplicate-product'});
  await run('desktop-overnight-budapest-date-rollover',{midnightRollover:true});
  await run('mobile-overnight-budapest-date-rollover',{mobile:true,midnightRollover:true});
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
  await run('desktop-booking-with-wrong-persisted-language',{badFinalGuideLanguage:'en'});
  await run('mobile-staff-request-with-missing-persisted-language',{mobile:true,staffRequest:true,badFinalGuideLanguage:'missing'});
  await run('desktop-staff-request-wrong-partner-pricing',{staffRequest:true,badStaffPromoCode:'OTHERPARTNER'});
  await run('mobile-staff-request-missing-partner-pricing',{mobile:true,staffRequest:true,badStaffPromoCode:'missing'});
  await run('desktop-hold-already-expired',{badHold:'past-expiry'});
  await run('mobile-hold-with-missing-id',{mobile:true,badHold:'missing-id'});
  await run('desktop-hold-with-wrong-requested-slot',{badHold:'wrong-requested-slot'});
  await run('mobile-hold-with-missing-requested-slot',{mobile:true,badHold:'missing-requested-slot'});
  await run('desktop-hold-with-wrong-guide-language',{badHold:'wrong-guide-language'});
  await run('mobile-hold-with-missing-guide-language',{mobile:true,badHold:'missing-guide-language'});
  await run('desktop-legitimate-reallocated-hold',{allocatedHold:true});
  await run('desktop-wordpress-rtl-embed',{wpRtl:true});
  await run('mobile-wordpress-rtl-staff-request',{mobile:true,staffRequest:true,wpRtl:true});
  await run('desktop-wordpress-cross-origin-csp-booking',{wpCrossOrigin:true});
  await run('mobile-wordpress-cross-origin-csp-staff-request',{mobile:true,staffRequest:true,wpCrossOrigin:true});
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
  await run('desktop-wrong-booked-experience',{bookingSelectionMismatch:'experience'});
  await run('mobile-wrong-booked-date',{mobile:true,bookingSelectionMismatch:'date'});
  await run('desktop-wrong-booked-group',{bookingSelectionMismatch:'group'});
  await run('mobile-wrong-booked-private-mode',{mobile:true,bookingSelectionMismatch:'private'});
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
