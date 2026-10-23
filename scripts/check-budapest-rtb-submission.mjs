import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync('site/assets/rtb-request.js','utf8');
const path='/he/budapest/tours/heroes-square-city-ezraider-tour/';

function browser(fetcher){
  const nodes=[];
  const locations=[];
  const requests=[];
  let uuidCount=0;
  const statuses={};
  const created=new Map();
  const make=(tag)=>{
    const node={
      tag,children:[],dataset:{},textContent:'',hidden:false,disabled:false,
      value:'',checked:false,classes:new Set(),listeners:{},
      classList:{
        add(name){node.classes.add(name);},
        remove(name){node.classes.delete(name);}
      },
      appendChild(child){node.children.push(child);},
      insertAdjacentElement(where,other){
        assert.equal(where,'afterend');
        if(other.dataset.rtbManual!==undefined)statuses.manual=other;
      },
      setAttribute(){},
      addEventListener(type,handler){(node.listeners[type]??=[]).push(handler);},
      reportValidity(){return true;},
      closest(selector){return selector==='.voy-rtb-checkbox'?created.get('row'):null;},
      querySelector(selector){
        if(node.tag!=='form')return null;
        if(selector==='[data-rtb-manual]')return statuses.manual??null;
        return created.get(selector)??null;
      },
      remove(){},
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
        register('[name="requested_date"]',make('input'));
        register('.voy-rtb-feedback',make('p'));
        register('button[type="submit"]',make('button'));
        created.set('row',make('label'));
      }
      return node;
    }
  };
  const ctx={
    document:doc,
    location:{pathname:path,assign(url){locations.push(url);}},
    FormData:class{constructor(){this.data=formData;}get(key){return this.data[key]??null;}},
    crypto:{randomUUID(){uuidCount++;return '11111111-1111-4111-8111-'+String(uuidCount).padStart(12,'0');}},
    fetch:async(url,init)=>{requests.push({url,init});return fetcher(url,init);},
    Intl,Date,URL,AbortSignal,console
  };
  ctx.globalThis=ctx;
  vm.runInNewContext(source,ctx,{filename:'site/assets/rtb-request.js'});
  const form=nodes.find(x=>x.tag==='form');
  assert.ok(form,'the Budapest request form must be attached');
  const set=(key,value)=>{formData[key]=value;
    if(key==='requested_guide_language'){
      created.get('[name="requested_guide_language"]').value=value;
      created.get('[name="requested_guide_language"]').listeners.change?.forEach(fn=>fn({}));
    }else if(key==='english_alternative_accepted'){
      created.get('[name="english_alternative_accepted"]').checked=value==='yes';
    }
    form.listeners.input?.forEach(fn=>fn({}));
    form.listeners.change?.forEach(fn=>fn({}));
  };
  const submit=()=>form.listeners.submit[0]({preventDefault(){}});
  return {form,submit,requests,locations,created,set,formData,get uuidCount(){return uuidCount}};
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
console.log('Budapest RTB request UI: 202/404/400/409/503, consent, stable replay, new payload, double submit and network failure OK.');
