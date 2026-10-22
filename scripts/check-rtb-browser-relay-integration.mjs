// Full mock-only integration of the actual VOY PRO browser script and Vercel
// relay. No network, secrets, public flags, CRM mutation or payments.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const server=require('../api/request-to-book.js');
const browserSource=readFileSync('site/assets/rtb-request.js','utf8');
const originalEnv={...process.env},originalFetch=globalThis.fetch;
const ORIGIN='https://website-staging.example';
const statuses=[];
const nextDate=()=>{
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
    timeZone:'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(new Date(Date.now()+5*86400000)).map(p=>[p.type,p.value]));
  return [parts.year,parts.month,parts.day].join('-');
};
async function postRelay(url,opts){
  assert.equal(url,'/api/request-to-book');
  assert.equal(opts.method,'POST');
  assert.equal(opts.credentials,'omit');
  assert.equal(opts.cache,'no-store');
  assert.equal(opts.redirect,'error');
  assert.ok(opts.body.length<4096);
  assert.ok(!opts.body.includes('x-fbm-intake-secret'));
  let code=0,raw='';
  const res={setHeader(){},set statusCode(x){code=x;},get statusCode(){return code;},
    end(x){raw=x;}};
  await server({
    method:opts.method,headers:{
      host:'website-staging.example',origin:ORIGIN,'content-type':opts.headers['content-type']
    },body:JSON.parse(opts.body)
  },res);
  const parsed=JSON.parse(raw);
  statuses.push({code,response:parsed});
  return {status:code,json:async()=>parsed};
}
function browser(){
  const elems=[],fields=new Map(),listeners={},nav=[];
  const formValues={
    requested_date:nextDate(),requested_time:'14:00',
    party_size:'2',requested_guide_language:'he',contact_name:'Test Guest',
    contact_email:'test@example.invalid',contact_phone:'',
    english_alternative_accepted:null
  };
  const build=tag=>{
    const v={tag,dataset:{},hidden:false,disabled:false,textContent:'',checked:false,
      listeners:{},children:[],value:'',
      classList:{add(){},remove(){}},
      appendChild(child){this.children.push(child);},
      insertAdjacentElement(){},
      addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);},
      setAttribute(){},remove(){},reportValidity(){return true;},
      closest(){return fields.get('row')},
      querySelector(sel){return fields.get(sel)||null;}
    };
    elems.push(v);return v;
  };
  const doc={
    querySelector(q){return q==='main'?build('main'):null;},
    createElement(tag){
      const v=build(tag);
      if(tag==='form'){
        for(const field of ['[name="requested_guide_language"]',
          '[name="english_alternative_accepted"]','[name="requested_date"]',
          '.voy-rtb-feedback','button[type="submit"]'])
          fields.set(field,build('field'));
        fields.set('row',build('row'));
      }
      return v;
    }
  };
  let issued=0;
  const world={
    location:{pathname:'/he/budapest/tours/heroes-square-city-ezraider-tour/',
      assign(url){nav.push(url);}},
    document:doc,FormData:class{get(key){return formValues[key]??null;}},
    crypto:{randomUUID(){return '99999999-9999-4999-8999-'+String(++issued).padStart(12,'0')}},
    fetch:postRelay,Intl,Date,URL,AbortSignal,console
  };
  world.globalThis=world;
  vm.runInNewContext(browserSource,world,{filename:'site/assets/rtb-request.js'});
  const form=elems.find(x=>x.tag==='form');
  assert.ok(form);
  const set=(key,value)=>{
    formValues[key]=value;
    if(key==='requested_guide_language'){
      fields.get('[name="requested_guide_language"]').value=value;
      fields.get('[name="requested_guide_language"]').listeners.change?.forEach(fn=>fn());
    }
    form.listeners.input?.forEach(fn=>fn());
    form.listeners.change?.forEach(fn=>fn());
  };
  return {
    submit:()=>form.listeners.submit[0]({preventDefault(){}}),
    set,nav,fields,formValues,get issued(){return issued;},
    get message(){return fields.get('.voy-rtb-feedback').textContent;}
  };
}
try{
  delete process.env.VOY_RTB_RELAY_ENABLED;
  delete process.env.VOY_RTB_ABUSE_PROTECTION_VERIFIED;
  delete process.env.VOY_RTB_FBM_INTAKE_SECRET;
  delete process.env.VOY_RTB_FBM_BASE_URL;
  globalThis.fetch=async()=>{throw new Error('disabled must never fetch upstream')};
  const disabled=browser();
  disabled.set('requested_guide_language','he');
  await disabled.submit();
  assert.equal(statuses.at(-1).code,404);
  assert.equal(statuses.at(-1).response.error,'request_intake_disabled');
  assert.equal(disabled.nav.length,1);
  assert.ok(disabled.nav[0].startsWith('https://wa.me/'));
  assert.ok(!disabled.message.includes('הפנייה התקבלה'));
  // In-process synthetic relay enablement only: no changes to Vercel/FBM.
  process.env.VOY_RTB_RELAY_ENABLED='true';
  process.env.VOY_RTB_ABUSE_PROTECTION_VERIFIED='true';
  process.env.VOY_RTB_FBM_BASE_URL='https://ezraider-os-staging.vercel.app/';
  process.env.VOY_RTB_FBM_INTAKE_SECRET='synthetic-only-test-secret-32-chars-min';
  const accepted=new Map();
  let firstAttempt503=false;
  const upstreamPayloads=[];
  globalThis.fetch=async(url,opts)=>{
    assert.equal(new URL(url).pathname,'/api/public/request-to-book');
    assert.equal(opts.headers['x-fbm-intake-secret'],process.env.VOY_RTB_FBM_INTAKE_SECRET);
    const p=JSON.parse(opts.body);
    upstreamPayloads.push(p);
    assert.equal(p.requestedGuideLanguage,'he');
    assert.equal(p.englishAlternativeAccepted,true);
    assert.ok(/Z$/.test(p.preferredStartAt));
    assert.ok(!('preferredLocalDate' in p));
    const prev=accepted.get(p.requestId);
    if(prev&&prev!==JSON.stringify(p))return {status:409};
    if(!prev)accepted.set(p.requestId,JSON.stringify(p));
    if(!firstAttempt503){firstAttempt503=true;return {status:503}};
    return {status:202,json:async()=>({requestId:'00000000-0000-4000-8000-000000000001',status:'pending_review'})};
  };
  const enabled=browser();
  enabled.set('requested_guide_language','he');
  enabled.set('english_alternative_accepted','yes');
  await enabled.submit();
  assert.equal(statuses.at(-1).code,503);
  assert.equal(enabled.nav.length,0,'CRM uncertain: never auto-navigate WhatsApp');
  assert.ok(!enabled.message.includes('הפנייה התקבלה'));
  await enabled.submit();
  assert.equal(statuses.at(-1).code,202);
  assert.equal(enabled.nav.length,0);
  assert.ok(enabled.message.includes('הפנייה התקבלה'));
  assert.equal(enabled.issued,1);
  assert.equal(upstreamPayloads.length,2);
  assert.equal(upstreamPayloads[0].requestId,upstreamPayloads[1].requestId);
  assert.equal(JSON.stringify(upstreamPayloads[0]),JSON.stringify(upstreamPayloads[1]));
  assert.equal(accepted.size,1);
  const changed={...upstreamPayloads[0],requestedGuideLanguage:'hu'};
  const answer=await globalThis.fetch('https://ezraider-os-staging.vercel.app/api/public/request-to-book',
    {body:JSON.stringify(changed),headers:{'x-fbm-intake-secret':process.env.VOY_RTB_FBM_INTAKE_SECRET}});
  assert.equal(answer.status,409,'an identical key with changed language must be rejected');
  console.log('Budapest RTB browser → local server relay → mocked CRM contract OK: disabled WhatsApp, uncertain retry, 202 inquiry, 409 changed preference.');
}finally{
  globalThis.fetch=originalFetch;
  for(const key of ['VOY_RTB_RELAY_ENABLED','VOY_RTB_ABUSE_PROTECTION_VERIFIED',
    'VOY_RTB_FBM_BASE_URL','VOY_RTB_FBM_INTAKE_SECRET']){
    if(originalEnv[key]===undefined)delete process.env[key];
    else process.env[key]=originalEnv[key];
  }
}
