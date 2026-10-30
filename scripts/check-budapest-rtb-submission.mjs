import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync('site/assets/rtb-request.js','utf8');
const defaultPath='/he/budapest/tours/heroes-square-city-ezraider-tour/';

function browser(fetcher,pagePath=defaultPath,clock=Date,{explicitNo=true}={}){
  const nodes=[];
  const locations=[];
  const requests=[];
  let uuidCount=0;
  const statuses={};
  const created=new Map();
  const make=(tag)=>{
    const node={
      tag,children:[],dataset:{},textContent:'',hidden:false,disabled:false,
      value:'',checked:false,attrs:{},classes:new Set(),listeners:{},
      classList:{
        add(name){node.classes.add(name);},
        remove(name){node.classes.delete(name);}
      },
      appendChild(child){node.children.push(child);},
      insertAdjacentElement(where,other){
        assert.equal(where,'afterend');
        if(other.dataset.rtbManual!==undefined)statuses.manual=other;
      },
      setAttribute(name,value){node.attrs[name]=String(value);},
      getAttribute(name){return node.attrs[name]??null;},
      dispatchEvent(event){node.listeners[event.type]?.forEach(fn=>fn(event));},
      addEventListener(type,handler){(node.listeners[type]??=[]).push(handler);},
      reportValidity(){return true;},
      closest(selector){return selector==='.voy-rtb-checkbox'?created.get('row'):null;},
      querySelectorAll(selector){
        if(node.tag!=='form'||selector!=='input,select,textarea')return [];
        return [...created.entries()].filter(([key])=>key.startsWith('[name="'))
          .map(([,control])=>control);
      },
      querySelector(selector){
        if(node.tag!=='form')return null;
        if(selector==='[data-rtb-manual]')return statuses.manual??null;
        return created.get(selector)??null;
      },
      remove(){if(statuses.manual===node)delete statuses.manual;},
    };
    nodes.push(node);
    return node;
  };
  const main=make('main');
  const dateParts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Budapest',
    year:'numeric',month:'2-digit',day:'2-digit'})
    .formatToParts(new Date(Date.now()+5*86400000)).map(x=>[x.type,x.value]));
  const formData={
    requested_date:[dateParts.year,dateParts.month,dateParts.day].join('-'),requested_time:'14:00',party_size:'2',
    requested_guide_language:'he',contact_name:'Synthetic Guest',
    contact_email:'synthetic@example.invalid',contact_phone:'',
    english_alternative_accepted:null
  };
  const doc={
    querySelector(selector){return selector==='main'?main:null;},
    createElement(tag){
      const node=make(tag);
      if(tag==='form'){
        const register=(selector,ele)=>{created.set(selector,ele);return ele;};
        register('[name="requested_guide_language"]',make('select'));
        register('[name="english_alternative_accepted"]',make('checkbox'));
        register('[data-rtb-english-decline]',make('button'));
        register('[name="requested_date"]',make('input'));
        for(const name of ['requested_time','party_size','contact_name','contact_email','contact_phone'])
          register('[name="'+name+'"]',make('input'));
        register('.voy-rtb-feedback',make('p'));
        register('button[type="submit"]',make('button'));
        created.set('row',make('label'));
      }
      return node;
    }
  };
  const ctx={
    document:doc,
    location:{pathname:pagePath,assign(url){locations.push(url);}},
    FormData:class{constructor(){this.data=formData;}get(key){
      // Model native FormData: an unchecked or disabled checkbox is ABSENT.
      if(key==='english_alternative_accepted'){
        const checkbox=created.get('[name="english_alternative_accepted"]');
        return checkbox.checked&&!checkbox.disabled?'yes':null;
      }
      return this.data[key]??null;
    }},
    crypto:{randomUUID(){uuidCount++;return '11111111-1111-4111-8111-'+String(uuidCount).padStart(12,'0');}},
    fetch:async(url,init)=>{requests.push({url,init});return fetcher(url,init);},
    Intl,Date:clock,URL,AbortSignal,console,Event:class{constructor(type){this.type=type;}}
  };
  ctx.globalThis=ctx;
  vm.runInNewContext(source,ctx,{filename:'site/assets/rtb-request.js'});
  const form=nodes.find(x=>x.tag==='form');
  assert.ok(form,'the Budapest request form must be attached');
  const declined=created.get('[data-rtb-english-decline]');
  function markExplicitNo(){
    if(declined.disabled||declined.getAttribute('aria-pressed')==='true')return;
    declined.listeners.click?.forEach(fn=>fn({}));
  }
  const set=(key,value)=>{formData[key]=value;
    if(key==='requested_guide_language'){
      created.get('[name="requested_guide_language"]').value=value;
      created.get('[name="requested_guide_language"]').listeners.change?.forEach(fn=>fn({}));
      // Most historical fixture scenarios represent a guest who explicitly
      // refuses English, not an unanswered question. The separate no-answer
      // test below opts out; production never auto-chooses No.
      if(value!=='en'&&explicitNo)markExplicitNo();
    }else if(key==='english_alternative_accepted'){
      const yes=created.get('[name="english_alternative_accepted"]');
      yes.checked=value==='yes';
      yes.listeners.change?.forEach(fn=>fn({}));
    }
    form.listeners.input?.forEach(fn=>fn({}));
    form.listeners.change?.forEach(fn=>fn({}));
  };
  set('requested_guide_language','he');
  const submit=()=>form.listeners.submit[0]({preventDefault(){}});
  return {form,submit,requests,locations,created,set,declined,formData,statuses,get uuidCount(){return uuidCount}};
}
const payloadOf=b=>JSON.parse(b.requests.at(-1).init.body);
const statusOf=b=>b.created.get('.voy-rtb-feedback').textContent;
const acknowledge=async()=>({status:202,json:async()=>({status:'pending_review',requestId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'})});

// Successfully received is ALWAYS an inquiry, not a confirmed tour.
{
  const b=browser(acknowledge);
  b.set('requested_guide_language','he');
  await b.submit();
  assert.equal(b.requests.length,1);
  assert.equal(b.requests[0].url,'/api/request-to-book');
  assert.equal(b.requests[0].init.credentials,'omit');
  assert.equal(b.requests[0].init.redirect,'error');
  assert.equal(b.requests[0].init.cache,'no-store');
  assert.equal(payloadOf(b).englishAlternativeAccepted,false);
  assert.equal(payloadOf(b).requestedGuideLanguage,'he');
  assert.equal(payloadOf(b).preferredLocalTime,'14:00');
  assert.ok(!('preferredTimezone' in payloadOf(b)));
  assert.ok(!('preferredStartAt' in payloadOf(b)));
  assert.ok(!('secret' in payloadOf(b)));
  assert.ok(statusOf(b).includes('הפנייה התקבלה'));
  assert.equal(b.locations.length,0);
  assert.equal(b.created.get('button[type="submit"]').disabled,true);
  await b.submit();
  assert.equal(b.requests.length,1);
}
// A malformed 202 must never be mistaken for a persisted FBM/CRM request.
// The UUID returned is the FBM request row ID, not the browser's idempotency ID.
for(const invalid of [
  {status:'pending_review',requestId:'accepted'},
  {status:'pending_review',requestId:'00000000-0000-0000-0000-000000000000'},
  {status:'pending_review',requestId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc\\n'},
  {status:'confirmed',requestId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'}
]){
  let attempts=0;
  const b=browser(async()=>({status:202,json:async()=>{
    attempts++;
    return attempts===1?invalid:{status:'pending_review',requestId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'};
  }}));
  b.set('requested_guide_language','he');
  await b.submit();
  assert.equal(attempts,1);
  assert.ok(!statusOf(b).includes('הפנייה התקבלה'));
  assert.ok(statusOf(b).includes('לא ניתן לאמת'));
  assert.equal(b.locations.length,0);
  assert.equal(b.created.get('button[type="submit"]').disabled,false);
  const original=JSON.stringify(payloadOf(b));
  await b.submit();
  assert.equal(attempts,2);
  assert.equal(JSON.stringify(payloadOf(b)),original);
  assert.equal(b.uuidCount,1);
  assert.ok(statusOf(b).includes('הפנייה התקבלה'));
}

// The relay enforces a 1-hour Budapest lead. The browser must reject an
// earlier same-day clock time before sending personal details to the relay.
// A fixed instant avoids timezone and DST dependence in test runner hosts.
const fixedNow='2026-10-23T12:00:00.000Z'; // 14:00 in Budapest
class FixedDate extends Date{
  constructor(...args){super(...(args.length?args:[fixedNow]));}
  static now(){return Date.parse(fixedNow);}
}
for(const [pagePath,earlyMessage] of [
  ['/budapest/tours/heroes-square-city-ezraider-tour/','at least one hour'],
  ['/he/budapest/tours/heroes-square-city-ezraider-tour/','לפחות שעה'],
  ['/hu/budapest/tours/heroes-square-city-ezraider-tour/','legalább egy órával']
]){
  const b=browser(acknowledge,pagePath,FixedDate);
  b.set('requested_guide_language','he');
  b.set('requested_date','2026-10-23');
  b.set('requested_time','14:30');
  await b.submit();
  assert.equal(b.requests.length,0,pagePath+' must reject a departure in 30 minutes locally');
  assert.ok(statusOf(b).includes(earlyMessage),pagePath+' needs localized minimum lead guidance');
  assert.equal(b.uuidCount,0,pagePath+' must not allocate an idempotency key for early times');
  assert.equal(b.locations.length,0,pagePath+' must not open WhatsApp for local validation');
  b.set('requested_time','16:15');
  await b.submit();
  assert.equal(b.requests.length,1,pagePath+' must submit an eligible future clock time');
  assert.equal(payloadOf(b).preferredLocalDate,'2026-10-23');
  assert.equal(payloadOf(b).preferredLocalTime,'16:15');
  assert.equal(b.uuidCount,1);
  assert.ok(statusOf(b).includes(pagePath.startsWith('/he/')?'הפנייה התקבלה':
    pagePath.startsWith('/hu/')?'megérkezett':'Enquiry received'));
}

// Regression for second-level precision: 60 minutes at the displayed
// minute can in fact be only 59m01s away. Reject before the browser sends
// any personal data. At the *next* minute, allow the relay to decide.
const secondNow='2026-10-23T12:00:59.000Z'; // Budapest 14:00:59
class SecondsDate extends Date{
  constructor(...args){super(...(args.length?args:[secondNow]));}
  static now(){return Date.parse(secondNow);}
}
for(const [pagePath,leadLabel] of [
  ['/budapest/tours/heroes-square-city-ezraider-tour/','at least one hour'],
  ['/he/budapest/tours/heroes-square-city-ezraider-tour/','לפחות שעה'],
  ['/hu/budapest/tours/heroes-square-city-ezraider-tour/','legalább egy órával']
]){
  const b=browser(acknowledge,pagePath,SecondsDate);
  b.set('requested_date','2026-10-23');
  b.set('requested_time','15:00'); // only 59m01s from now, not a full hour
  await b.submit();
  assert.equal(b.requests.length,0,pagePath+' must not POST a sub-hour time');
  assert.equal(b.uuidCount,0,pagePath+' must not allocate UUID for early time');
  assert.ok(statusOf(b).includes(leadLabel),pagePath+' must explain lead time');
  assert.equal(b.locations.length,0,pagePath+' must not open WhatsApp');

  b.set('requested_time','15:01'); // a genuine full 60 minutes away
  await b.submit();
  assert.equal(b.requests.length,1,pagePath+' must allow first full eligible minute');
  assert.equal(payloadOf(b).preferredLocalTime,'15:01');
  assert.equal(b.uuidCount,1);
}

// Budapest changes from summer to winter time on 2026-10-25: 02:30
// repeats. On 2027-03-28 it jumps over 02:30. Both are rejected by the
// relay. The visitor should receive a precise local explanation BEFORE any
// contact details, request UUID or WhatsApp handoff are generated.
for(const [pagePath,dstMessage] of [
  ['/budapest/tours/heroes-square-city-ezraider-tour/','does not exist or occurs twice'],
  ['/he/budapest/tours/citadella-advanced-ezraider-tour/','אינה קיימת או מופיעה פעמיים'],
  ['/hu/budapest/tours/buda-margaret-extended-tour/','nem létezik, vagy kétszer fordul elő']
]){
  for(const date of ['2026-10-25','2027-03-28']){
    const b=browser(acknowledge,pagePath,FixedDate);
    b.set('requested_guide_language','he');
    b.set('requested_date',date);
    b.set('requested_time','02:30');
    await b.submit();
    assert.equal(b.requests.length,0,pagePath+' '+date+': DST gap/fold must never POST PII');
    assert.equal(b.uuidCount,0,pagePath+' '+date+': invalid DST time must not allocate a request UUID');
    assert.equal(b.locations.length,0,pagePath+' '+date+': invalid DST time must not hand off to WhatsApp');
    assert.ok(statusOf(b).includes(dstMessage),pagePath+' '+date+': DST explanation must be localized');
    b.set('requested_time','03:30');
    await b.submit();
    assert.equal(b.requests.length,1,pagePath+' '+date+': unique post-transition time should remain available');
    assert.equal(b.uuidCount,1,pagePath+' '+date+': valid replacement is one distinct request');
    assert.equal(payloadOf(b).preferredLocalDate,date);
    assert.equal(payloadOf(b).preferredLocalTime,'03:30');
    assert.ok(statusOf(b).includes(pagePath.startsWith('/he/')?'הפנייה התקבלה':
      pagePath.startsWith('/hu/')?'megérkezett':'Enquiry received'));
  }
}
// DST does not only create invalid wall times: a valid wall time can be
// less than an *absolute* hour from now even when the clock label says
// otherwise. Always measure lead/horizon against the unique UTC instant.
// 2026-10-25 00:30Z is 02:30 CEST (ambiguous, cannot be selected); at
// 01:30Z the clocks read 02:30 CET. Check 03:00/03:30 later that morning.
const foldNow='2026-10-24T23:30:00.000Z'; // local 01:30, before fallback
class FoldDate extends Date{
  constructor(...args){super(...(args.length?args:[foldNow]));}
  static now(){return Date.parse(foldNow);}
}
{
  const b=browser(acknowledge,'/budapest/tours/heroes-square-city-ezraider-tour/',FoldDate);
  b.set('requested_date','2026-10-25');
  b.set('requested_time','03:00'); // 02:00Z; absolute lead 2h30m
  await b.submit();
  assert.equal(b.requests.length,1,'Valid unique DST day instant must pass exact lead comparison');
  assert.equal(payloadOf(b).preferredLocalTime,'03:00');
}

// The relay and FBM enforce an absolute 180-day horizon, not an
// unlimited calendar picker. Guard this before transmitting guest contact
// fields, including the final minute of the allowed 180-day window.
const horizonStamp=SecondsDate.now()+180*86400000;
const horizonParts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
  timeZone:'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',hourCycle:'h23'
}).formatToParts(new Date(horizonStamp)).map(x=>[x.type,x.value]));
const horizonDay=[horizonParts.year,horizonParts.month,horizonParts.day].join('-');
const horizonMinute=horizonParts.hour+':'+horizonParts.minute;
const nextWallMinute=new Date(Date.UTC(Number(horizonParts.year),
  Number(horizonParts.month)-1,Number(horizonParts.day),
  Number(horizonParts.hour),Number(horizonParts.minute)+1))
  .toISOString().slice(11,16);
for(const [pagePath,localizedHorizon] of [
  ['/budapest/tours/heroes-square-city-ezraider-tour/','180 days'],
  ['/he/budapest/tours/citadella-advanced-ezraider-tour/','180 הימים'],
  ['/hu/budapest/tours/buda-margaret-extended-tour/','180 napon']
]){
  const b=browser(acknowledge,pagePath,SecondsDate);
  b.set('requested_date',horizonDay);
  b.set('requested_time',nextWallMinute);
  await b.submit();
  assert.equal(b.requests.length,0,pagePath+' cannot post beyond 180-day horizon');
  assert.equal(b.uuidCount,0,pagePath+' cannot create a request UUID beyond horizon');
  assert.equal(b.locations.length,0,pagePath+' cannot start WhatsApp on invalid date');
  assert.ok(statusOf(b).includes(localizedHorizon),pagePath+' needs localized horizon guidance');
  b.set('requested_time',horizonMinute);
  await b.submit();
  assert.equal(b.requests.length,1,pagePath+' must permit final complete minute of horizon');
  assert.equal(payloadOf(b).preferredLocalDate,horizonDay);
  assert.equal(payloadOf(b).preferredLocalTime,horizonMinute);
  assert.equal(b.uuidCount,1);
}

// 404 is the sole automatic fallback. WhatsApp must be sent by the guest.
{
  const b=browser(async()=>({status:404}));
  b.set('requested_guide_language','he');
  await b.submit();
  assert.equal(b.requests.length,1);
  assert.equal(b.locations.length,1);
  assert.ok(b.locations[0].startsWith('https://wa.me/36300993099?text='));
  assert.ok(!statusOf(b).includes('הפנייה התקבלה'));
}
// Very long multibyte contact details can exceed WhatsApp's reliable
// percent-encoded URL size even though native field maxlengths are valid.
// Fallback must be an *explicit, blank* local WhatsApp link with a warning,
// never a truncated prefilled URL or an automatic redirect to a broken URL.
for(const [path,language] of [
  ['/budapest/tours/heroes-square-city-ezraider-tour/','en'],
  ['/he/budapest/tours/citadella-advanced-ezraider-tour/','he'],
  ['/hu/budapest/tours/buda-margaret-extended-tour/','hu']
]){
  const veryLongName='🚀'.repeat(100); // 200 UTF-16 units, within maxlength 200
  const longEmail='a'.repeat(60)+'@'+Array(5).fill('b'.repeat(35)).join('.')+'.com';
  const huge=b=>{
    b.set('requested_guide_language',language);
    b.set('contact_name',veryLongName);
    b.set('contact_email',longEmail);
    b.set('contact_phone','+'+'1'.repeat(39));
  };
  const disabled=browser(async()=>({status:404}),path);
  huge(disabled);
  await disabled.submit();
  assert.equal(disabled.requests.length,1,path+': 404 still attempts one relay POST');
  assert.equal(disabled.locations.length,0,path+': overlong 404 must not auto-open unusable WhatsApp URL');
  assert.equal(disabled.statuses.manual?.href,'https://wa.me/36300993099',
    path+': overlong 404 offers the correct blank team WhatsApp link');
  assert.ok((disabled.statuses.manual?.textContent||'').length>15,
    path+': blank WhatsApp fallback has a descriptive action');
  assert.ok(statusOf(disabled).length>80&&!statusOf(disabled).includes(veryLongName),
    path+': long-link warning must be visible without reproducing PII');
  const warning=language==='en'?'This prefilled WhatsApp enquiry is too long':
    language==='he'?'הפנייה ארוכה מדי לקישור WhatsApp':
      'Az előre kitöltött WhatsApp-üzenet túl hosszú';
  const disabledReason=language==='en'?'Secure enquiry intake is disabled':
    language==='he'?'קליטת הפניות המאובטחת אינה פעילה':
      'A biztonságos kérések fogadása nem aktív';
  const unknownReason=language==='en'?'English alternative not answered':
    language==='he'?'לא נבחרה תשובה לגבי אנגלית':
      'Az angol alternatívára nem érkezett válasz';
  const uncertainReason=language==='en'?'Request delivery could not be verified':
    language==='he'?'לא ניתן לאמת שהפנייה נמסרה':
      'Nem sikerült ellenőrizni a kézbesítést';
  const limitedReason=language==='en'?'Too many enquiries were sent':
    language==='he'?'נשלחו יותר מדי בקשות':
      'Túl sok kérés érkezett';
  const conflictReason=language==='en'?'This enquiry ID belongs':
    language==='he'?'מספר הפנייה כבר קשור':
      'Ez a kérésazonosító más adatokhoz tartozik';
  const assertReasons=(b,reason,step)=>{
    const status=statusOf(b);
    assert.ok(status.includes(reason),path+': '+step+' delivery/consent reason hidden');
    assert.ok(status.includes(warning),path+': '+step+' missing long-link warning');
    assert.ok(!status.includes(veryLongName),path+': '+step+' leaked customer name into feedback');
  };
  assertReasons(disabled,disabledReason,'404 disabled relay');
  const unknown=browser(async()=>({status:404}),path,Date,{explicitNo:false});
  huge(unknown);
  unknown.set('requested_guide_language','es');
  await unknown.submit();
  assert.equal(unknown.requests.length,0,path+': unanswered English alternative still forbids POST');
  assert.equal(unknown.uuidCount,0,path+': unanswered English alternative has no CRM id');
  assert.equal(unknown.locations.length,0,path+': unknown consent must never auto-navigate');
  assert.equal(unknown.statuses.manual?.href,'https://wa.me/36300993099',
    path+': overlong unknown-consent fallback is an explicit blank message');
  assertReasons(unknown,unknownReason,'unknown language consent');
  const uncertain=browser(async()=>({status:503}),path);
  huge(uncertain);
  await uncertain.submit();
  assert.equal(uncertain.requests.length,1,path+': uncertain fallback keeps single original POST');
  assert.equal(uncertain.locations.length,0,path+': uncertain 503 never auto-opens WhatsApp');
  assert.equal(uncertain.statuses.manual?.href,'https://wa.me/36300993099',
    path+': uncertain overlong manual link cannot silently discard encoded text');
  assertReasons(uncertain,uncertainReason,'503 uncertain receipt');
  const limited=browser(async()=>({status:429}),path);
  huge(limited);
  await limited.submit();
  assert.equal(limited.requests.length,1,path+': 429 only sends one relay request');
  assert.equal(limited.locations.length,0,path+': 429 never automatically opens WhatsApp');
  assert.equal(limited.statuses.manual?.href,'https://wa.me/36300993099',
    path+': 429 links only to the blank team chat when message is too long');
  assertReasons(limited,limitedReason,'429 rate limit');
  const conflicting=browser(async()=>({status:409}),path);
  huge(conflicting);
  await conflicting.submit();
  assert.equal(conflicting.requests.length,1,path+': 409 makes exactly one conflicting request');
  assert.equal(conflicting.created.get('button[type="submit"]').disabled,true,
    path+': oversized link does not unlock a conflicting request');
  assert.equal(conflicting.statuses.manual?.href,'https://wa.me/36300993099',
    path+': conflict uses blank chat instead of a broken encoded URL');
  assertReasons(conflicting,conflictReason,'409 idempotency conflict');
}
// Transient 503 may have accepted the upstream CRM write.
// No automatic WhatsApp; retry exact same payload including same UUID.
{
  let tryCount=0;
  const b=browser(async()=>{tryCount++;return {status:tryCount===1?503:202,
    json:async()=>({status:'pending_review',requestId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'})}});
  b.set('requested_guide_language','he');
  await b.submit();
  assert.equal(b.locations.length,0);
  assert.ok(statusOf(b).includes('לא ניתן לאמת'));
  assert.ok(b.created.get('.voy-rtb-feedback'));
  const first=JSON.stringify(payloadOf(b));
  await b.submit();
  assert.equal(b.requests.length,2);
  assert.equal(JSON.stringify(payloadOf(b)),first);
  assert.equal(b.uuidCount,1);
  assert.equal(b.locations.length,0);
}
// A materially changed payload must NEVER reuse a prior request ID.
{
  const b=browser(async()=>({status:503}));
  b.set('requested_guide_language','he');
  await b.submit();
  const previous=payloadOf(b).requestId;
  b.set('contact_name','Different Synthetic Guest');
  await b.submit();
  assert.equal(b.requests.length,2);
  assert.notEqual(payloadOf(b).requestId,previous);
}
// Explicit affirmative consent is never derived from Hebrew page locale.
{
  const b=browser(acknowledge);
  b.set('requested_guide_language','he');
  b.set('english_alternative_accepted','yes');
  await b.submit();
  assert.equal(payloadOf(b).englishAlternativeAccepted,true);
}
{
  const b=browser(acknowledge);
  b.set('requested_guide_language','en');
  b.set('english_alternative_accepted','yes');
  await b.submit();
  assert.equal(payloadOf(b).englishAlternativeAccepted,false);
}
// 409 never creates a fresh idempotency ID for a silent retry.
{
  const b=browser(async()=>({status:409}));
  b.set('requested_guide_language','he');
  await b.submit();
  assert.equal(b.locations.length,0);
  assert.equal(b.created.get('button[type="submit"]').disabled,true);
  assert.ok(statusOf(b).includes('מספר הפנייה'));
}
// A 409 is terminal only for the exact conflicting enquiry data. Guests can
// correct a date/name/language and submit a genuinely NEW request/UUID, but
// never silently retry the old body, even after editing and reverting.
for(const [pagePath,conflictLabel] of [
  ['/budapest/tours/heroes-square-city-ezraider-tour/','enquiry ID'],
  ['/he/budapest/tours/citadella-advanced-ezraider-tour/','מספר הפנייה'],
  ['/hu/budapest/tours/buda-margaret-extended-tour/','kérésazonosító']
]){
  let attempts=0;
  const b=browser(async()=>++attempts===1?{status:409}:acknowledge(),pagePath);
  b.set('requested_guide_language','he');
  await b.submit();
  const bad=JSON.stringify(payloadOf(b)),oldId=payloadOf(b).requestId;
  assert.equal(attempts,1,pagePath+' should issue only one conflicting request');
  assert.equal(b.uuidCount,1);
  assert.equal(b.created.get('button[type="submit"]').disabled,true,
    pagePath+' cannot retry same 409 by clicking again');
  assert.ok(statusOf(b).includes(conflictLabel));
  assert.ok(b.statuses.manual?.href.startsWith('https://wa.me/'));
  await b.submit();
  assert.equal(attempts,1,'409 must never resend identical data under same request ID');
  b.set('contact_name','Changed Synthetic Guest');
  assert.equal(b.created.get('button[type="submit"]').disabled,false,
    pagePath+' must allow materially changed details after 409');
  assert.equal(b.statuses.manual,undefined,
    pagePath+' must remove WhatsApp fallback with stale contact data');
  assert.equal(statusOf(b),'','old error message must clear after material change');
  // Restore the original conflict payload: even with a new edit history it
  // remains blocked, without minting a second UUID or making another POST.
  b.set('contact_name','Synthetic Guest');
  assert.equal(b.created.get('button[type="submit"]').disabled,true,
    pagePath+' must not allow edit-and-revert replay of a 409');
  assert.ok(statusOf(b).includes(conflictLabel));
  await b.submit();
  assert.equal(attempts,1);
  assert.equal(JSON.stringify(payloadOf(b)),bad);
  assert.equal(b.uuidCount,1);
  b.set('contact_name','Changed Synthetic Guest');
  await b.submit();
  assert.equal(attempts,2,pagePath+' must permit a new edited enquiry');
  assert.equal(b.requests.length,2);
  assert.notEqual(payloadOf(b).requestId,oldId,pagePath+' needs a new UUID');
  assert.equal(b.uuidCount,2);
  assert.equal(payloadOf(b).contactName,'Changed Synthetic Guest');
  assert.equal(b.created.get('button[type="submit"]').disabled,true,
    'valid 202 must remain terminal with input controls frozen');
  assert.ok(!statusOf(b).includes(conflictLabel),
    'new valid 202 should replace previous conflict status');
  assert.equal(b.locations.length,0,'409 never auto-opens WhatsApp');
}
// Validation and unknown upstream status never turn into a success.
for(const code of [400,503,500]){
  const b=browser(async()=>({status:code}));
  b.set('requested_guide_language','he');
  await b.submit();
  assert.equal(b.locations.length,0);
  assert.ok(!statusOf(b).includes('הפנייה התקבלה'));
}
// Prevent double click while first network submission is unsettled.
{
  let release;
  const b=browser(()=>new Promise(resolve=>{release=resolve;}));
  b.set('requested_guide_language','he');
  const first=b.submit();
  await b.submit();
  assert.equal(b.requests.length,1);
  release(await acknowledge());
  await first;
  assert.equal(b.requests.length,1);
}
// A guest cannot edit the form while awaiting a response. A verified 202
// freezes all original details; a failed or conflict response releases them.
{
  let release;
  const b=browser(()=>new Promise(resolve=>{release=resolve;}));
  b.set('requested_guide_language','he');
  const sent=b.submit();
  const inputs=b.form.querySelectorAll('input,select,textarea');
  assert.equal(inputs.length,8,'all editable guest controls must be included');
  assert.ok(inputs.every(field=>field.disabled===true),'fields must be locked during POST');
  assert.equal(b.created.get('button[type="submit"]').disabled,true);
  release(await acknowledge());
  await sent;
  assert.ok(inputs.every(field=>field.disabled===true),'acknowledged details must stay frozen');
  assert.equal(b.requests.length,1);
}
{
  let release;
  const b=browser(()=>new Promise(resolve=>{release=resolve;}));
  const sent=b.submit();
  const inputs=b.form.querySelectorAll('input,select,textarea');
  assert.ok(inputs.every(field=>field.disabled===true));
  release({status:503});
  await sent;
  assert.ok(inputs.every(field=>field.disabled===false),'a delivery failure must unlock inputs');
  assert.equal(b.created.get('button[type="submit"]').disabled,false);
  assert.ok(b.statuses.manual?.href.startsWith('https://wa.me/'));
}
{
  const b=browser(async()=>({status:409}));
  await b.submit();
  assert.ok(b.form.querySelectorAll('input,select,textarea').every(f=>f.disabled===false),
    '409 is not a confirmed enquiry and must not freeze manual-contact details');
  assert.equal(b.created.get('button[type="submit"]').disabled,true);
}
// If a guest edits details after an unverified POST, an existing manual
// WhatsApp fallback (including stale personal details) must disappear. A new
// attempt uses fresh text and UUID. Retrying unchanged details retains UUID.
{
  const b=browser(async()=>({status:503}));
  await b.submit();
  const priorUUID=payloadOf(b).requestId;
  assert.ok(b.statuses.manual?.href.includes('Synthetic%20Guest'));
  b.set('contact_name','Changed Synthetic Guest');
  assert.equal(b.statuses.manual,undefined,'stale WhatsApp URL must be removed on edit');
  assert.equal(statusOf(b),'','previous delivery status must be cleared on edit');
  await b.submit();
  assert.notEqual(payloadOf(b).requestId,priorUUID);
  assert.ok(b.statuses.manual?.href.includes('Changed%20Synthetic%20Guest'));
  assert.equal(b.locations.length,0,'manual fallback is never sent automatically');
}
// Network error preserves idempotency and must not send WhatsApp.
{
  const b=browser(async()=>{throw new Error('simulated network drop')});
  b.set('requested_guide_language','he');
  await b.submit();
  assert.equal(b.locations.length,0);
  const old=payloadOf(b).requestId;
  await b.submit();
  assert.equal(payloadOf(b).requestId,old);
}
// Each request-only tour must map to its own canonical FBM slug across
// English, Hebrew and Hungarian pages, independent of the chosen guiding
// language. All 9 pages must retain localized acknowledgements and manual
// WhatsApp handoff when the Staging relay is disabled.
const routeMatrix=[
  ['heroes-square-city-ezraider-tour','heroes-square'],
  ['citadella-advanced-ezraider-tour','citadella-advanced'],
  ['buda-margaret-extended-tour','buda-margaret-extended']
];
const localeMatrix=[
  ['', 'Enquiry received','Request this tour','Too many enquiries'],
  ['he/', 'הפנייה התקבלה','בקשת סיור','יותר מדי בקשות'],
  ['hu/', 'megérkezett','Túraigénylés','Túl sok kérés']
];
for(const [pageSlug,apiSlug] of routeMatrix){
  for(const [localePrefix,successLabel,whatsappLabel,throttledLabel] of localeMatrix){
    const pagePath='/'+localePrefix+'budapest/tours/'+pageSlug+'/';
    const received=browser(acknowledge,pagePath);
    received.set('requested_guide_language','es');
    received.set('english_alternative_accepted','yes');
    await received.submit();
    assert.equal(received.requests.length,1,pagePath+' must submit to the relay');
    assert.equal(received.requests[0].url,'/api/request-to-book');
    assert.equal(payloadOf(received).tourSlug,apiSlug,pagePath+' must map to FBM slug');
    assert.equal(payloadOf(received).requestedGuideLanguage,'es',
      pagePath+' cannot infer guiding language from page locale');
    assert.equal(payloadOf(received).englishAlternativeAccepted,true,
      pagePath+' must transmit affirmative fallback consent');
    assert.ok(statusOf(received).includes(successLabel),
      pagePath+' must display locale-specific inquiry acknowledgement');
    assert.equal(received.locations.length,0,pagePath+' cannot auto-open WhatsApp on 202');

    const disabled=browser(async()=>({status:404}),pagePath);
    disabled.set('requested_guide_language','es');
    await disabled.submit();
    assert.equal(disabled.requests.length,1);
    assert.equal(disabled.locations.length,1,pagePath+' needs guest-controlled fallback');
    const url=new URL(disabled.locations[0]);
    assert.equal(url.origin,'https://wa.me');
    assert.equal(url.pathname,'/36300993099');
    const message=url.searchParams.get('text')||'';
    assert.ok(message.includes(whatsappLabel),pagePath+' must localize WhatsApp message');
    assert.ok(message.includes(apiSlug),pagePath+' must identify the correct tour');
    const requestSpanish=localePrefix==='he/'?'ספרדית':localePrefix==='hu/'?'Spanyol':'Spanish';
    const englishFallback=localePrefix==='he/'?'אנגלית כשפה חלופית':localePrefix==='hu/'?'Angol mint alternatíva':'English as an alternative';
    const unanswered=localePrefix==='he/'?'לא נענתה השאלה (לא ניתנה הסכמה)'
      :localePrefix==='hu/'?'Nincs válasz (nincs rögzített beleegyezés)'
      :'Not answered (no acceptance recorded)';
    const declined=localePrefix==='he/'?'לא אושרה; רק שפת ההדרכה המבוקשת'
      :localePrefix==='hu/'?'Nem elfogadott; kizárólag a kért nyelv'
      :'Not accepted; requested language only';
    const affirmed=localePrefix==='he/'?'אושרה במפורש עבור כל חברי הקבוצה'
      :localePrefix==='hu/'?'Kifejezetten elfogadva az egész csoport számára'
      :'Explicitly accepted for everyone in the group';
    assert.ok(message.includes(requestSpanish),pagePath+' manual message must show a localized guiding-language name, not "es"');
    assert.ok(message.includes(englishFallback+': '+declined),
      pagePath+' explicitly declined English must be conveyed as No, not unknown');
    const unknown=browser(async()=>({status:404}),pagePath,Date,{explicitNo:false});
    unknown.set('requested_guide_language','es');
    await unknown.submit();
    assert.equal(unknown.requests.length,0,
      pagePath+' an unanswered alternative must never be submitted as a false consent to the Boolean-only relay');
    assert.equal(unknown.uuidCount,0,
      pagePath+' unknown alternative must not allocate a CRM idempotency key');
    assert.equal(unknown.locations.length,0,
      pagePath+' unknown alternative leaves WhatsApp sending under explicit guest control');
    assert.ok(unknown.statuses.manual?.href.startsWith('https://wa.me/'),
      pagePath+' unknown alternative offers a guest-clicked manual link');
    assert.ok(new URL(unknown.statuses.manual.href).searchParams.get('text').includes(englishFallback+': '+unanswered),
      pagePath+' unknown alternative must be labeled unanswered, never No');
    const accepted=browser(async()=>({status:404}),pagePath);
    accepted.set('requested_guide_language','es');
    accepted.set('english_alternative_accepted','yes');
    await accepted.submit();
    assert.equal(accepted.locations.length,1);
    assert.ok(new URL(accepted.locations[0]).searchParams.get('text').includes(englishFallback+': '+affirmed),
      pagePath+' affirmative English acceptance must be reflected explicitly for the whole group');
    assert.equal(payloadOf(accepted).englishAlternativeAccepted,true,
      pagePath+' manual copy must not change the existing relay payload contract');
    const englishPrimary=browser(async()=>({status:404}),pagePath);
    englishPrimary.set('requested_guide_language','he');
    englishPrimary.set('english_alternative_accepted','yes');
    englishPrimary.set('requested_guide_language','en');
    await englishPrimary.submit();
    assert.equal(englishPrimary.locations.length,1);
    const englishMessage=new URL(englishPrimary.locations[0]).searchParams.get('text');
    assert.ok(!englishMessage.includes(englishFallback),
      pagePath+' English primary should not ask for English as a substitute');
    assert.equal(payloadOf(englishPrimary).englishAlternativeAccepted,false,
      pagePath+' old English consent must not survive the guiding-language change');
    assert.ok(!statusOf(disabled).includes(successLabel),
      pagePath+' disabled intake cannot claim CRM receipt');

    // An actual WAF 429 can arrive without JSON. It must never become an
    // accepted CRM enquiry or silently send WhatsApp. An explicit later retry
    // must reuse the same immutable browser UUID and payload across locales.
    let attempts=0;
    const throttled=browser(async()=>({
      status:++attempts===1?429:202,
      json:async()=>({status:'pending_review',requestId:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'})
    }),pagePath);
    throttled.set('requested_guide_language','es');
    throttled.set('english_alternative_accepted','yes');
    await throttled.submit();
    assert.equal(attempts,1,pagePath+' must perform one throttled attempt');
    assert.ok(statusOf(throttled).includes(throttledLabel),
      pagePath+' must localize the 429 feedback');
    assert.ok(!statusOf(throttled).includes(successLabel),
      pagePath+' cannot claim CRM receipt after 429');
    assert.equal(throttled.locations.length,0,
      pagePath+' cannot auto-send WhatsApp after rate limit');
    assert.equal(throttled.created.get('button[type="submit"]').disabled,false);
    const firstPayload=JSON.stringify(payloadOf(throttled));
    await throttled.submit();
    assert.equal(attempts,2);
    assert.equal(throttled.uuidCount,1,pagePath+' 429 retry must retain UUID');
    assert.equal(JSON.stringify(payloadOf(throttled)),firstPayload,
      pagePath+' 429 retry must retain original body');
    assert.ok(statusOf(throttled).includes(successLabel),
      pagePath+' a subsequent valid 202 can confirm a pending inquiry');
  }
}
console.log('Budapest RTB route/locale matrix OK: all 3 tour slugs × EN/HE/HU, 202 pending inquiry, disabled 404 WhatsApp, and throttled 429 retry.');

// A long-lived RTB tab must update its local date picker before the guest
// selects a date on the next Budapest day; focus never sends guest data.
{
  let clockMs=Date.parse('2026-10-23T12:00:00.000Z');
  class AdjustableDate extends Date{
    constructor(...args){super(...(args.length?args:[clockMs]));}
    static now(){return clockMs;}
  }
  for(const route of [
    '/budapest/tours/heroes-square-city-ezraider-tour/',
    '/he/budapest/tours/citadella-advanced-ezraider-tour/',
    '/hu/budapest/tours/buda-margaret-extended-tour/'
  ]){
    const b=browser(acknowledge,route,AdjustableDate);
    const date=b.created.get('[name="requested_date"]');
    const oldMin=date.min,oldMax=date.max;
    assert.equal(oldMin,'2026-10-23',route+' initial Budapest minimum');
    assert.equal(date.listeners.focus?.length,1,route+' date focus guard installed');
    clockMs=Date.parse('2026-10-24T12:00:00.000Z');
    date.listeners.focus[0]();
    assert.equal(date.min,'2026-10-24',route+' date minimum refreshed on focus');
    assert.ok(date.max>oldMax,route+' end of 180-day request range also advances');
    assert.equal(b.requests.length,0,route+' date focus causes no request');
    assert.equal(b.uuidCount,0,route+' date focus creates no idempotency key');
    clockMs=Date.parse('2026-10-23T12:00:00.000Z');
  }
}
console.log('Budapest RTB date picker focus refresh OK in EN/HE/HU; no POST or guest data.');

console.log('Budapest RTB request UI: 202/404/400/409/503, consent, stable replay, new payload, double submit and network failure OK.');
