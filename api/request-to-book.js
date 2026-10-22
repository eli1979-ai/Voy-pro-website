'use strict';

// Staging-only Request to Book relay. NEVER store or serve FBM intake credentials
// in site/, dist/, browser scripts, logs, query strings or analytics.
// No public enablement until owner-approved abuse protection and staged E2E QA.
const ALLOWED_FBMS=new Set(['ezraider-os-staging.vercel.app']);
const BUDAPEST='Europe/Budapest';
const TOUR_SLUGS=new Set(['heroes-square','citadella-advanced','buda-margaret-extended']);
const BODY_LIMIT=4096;
const FIELDS=new Set(['tourSlug','preferredLocalDate','preferredLocalTime','partySize',
  'contactName','email','phone','requestedGuideLanguage','englishAlternativeAccepted','requestId']);
const say=(res,status,data)=>{
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.end(JSON.stringify(data));
};
const validDate=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\d$/.test(s);
const validTime=s=>typeof s==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s);
const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:BUDAPEST,
  year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const localParts=ms=>{
  const parts=Object.fromEntries(formatter.formatToParts(new Date(ms)).map(v=>[v.type,v.value]));
  return parts.year+'-'+parts.month+'-'+parts.day+'T'+parts.hour+':'+parts.minute;
};
// Never use the visitor's timezone or Date.parse('YYYY-MM-DDTHH:mm').
// Reject nonexistent spring-forward times and ambiguous fall-back times.
function resolveBudapestInstant(day,time){
  if(!validDate(day)||!validTime(time))return null;
  const [year,month,date]=day.split('-').map(Number);
  const [hour,minute]=time.split(':').map(Number);
  const asIfUtc=Date.UTC(year,month-1,date,hour,minute);
  if(new Date(asIfUtc).toISOString().slice(0,16)!==day+'T'+time)return null;
  const choices=[];
  for(let offset=-180;offset<=180;offset+=15){
    const candidate=asIfUtc-offset*60000;
    if(localParts(candidate)===day+'T'+time)choices.push(candidate);
  }
  return choices.length===1?new Date(choices[0]).toISOString():null;
}
function validate(data){
  if(!data||typeof data!=='object'||Array.isArray(data))return null;
  if(Object.keys(data).some(k=>!FIELDS.has(k)))return null;
  const slug=data.tourSlug;
  const name=typeof data.contactName==='string'?data.contactName.trim():'';
  const email=typeof data.email==='string'?data.email.trim().toLowerCase():'';
  const phone=typeof data.phone==='string'?data.phone.trim():'';
  const lang=typeof data.requestedGuideLanguage==='string'?data.requestedGuideLanguage.trim().toLowerCase():'';
  const id=data.requestId;
  if(!TOUR_SLUGS.has(slug)||typeof id!=='string'||
     !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id)||
     name.length<2||name.length>200||email.length>254||phone.length>40||
     (!email&&!phone)||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))||
     !Number.isInteger(data.partySize)||data.partySize<1||data.partySize>12||
     !/^[a-z]{2,3}$/.test(lang)||
     typeof data.englishAlternativeAccepted!=='boolean')return null;
  const start=resolveBudapestInstant(data.preferredLocalDate,data.preferredLocalTime);
  if(!start||Date.parse(start)<Date.now()+3600000||Date.parse(start)>Date.now()+180*86400000)return null;
  return {tourSlug:slug,contactName:name,email,phone,partySize:data.partySize,
    requestId:id,preferredStartAt:start,requestedGuideLanguage:lang,
    englishAlternativeAccepted:data.englishAlternativeAccepted};
}
function exactSameOrigin(headers){
  const origin=headers?.origin||'';
  const host=headers?.host||'';
  try{
    const u=new URL(origin);
    return u.protocol==='https:'&&u.host===host&&
      /^[a-z0-9.-]+(?::\d+)?$/i.test(host)&&!u.username&&!u.password;
  }catch{return false;}
}
async function handler(req,res){
  if(process.env.VOY_RTB_RELAY_ENABLED!=='true'
     ||process.env.VOY_RTB_ABUSE_PROTECTION_VERIFIED!=='true')
    return say(res,404,{error:'request_intake_disabled'});
  if(req.method!=='POST')return say(res,405,{error:'method_not_allowed'});
  if(!exactSameOrigin(req.headers))return say(res,403,{error:'origin_not_allowed'});
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))
    return say(res,415,{error:'json_required'});
  const secret=process.env.VOY_RTB_FBM_INTAKE_SECRET||'';
  if(secret.length<32)return say(res,503,{error:'service_unavailable'});
  let target;
  try{
    target=new URL(process.env.VOY_RTB_FBM_BASE_URL||'');
    // Hostname alone is insufficient: an allowed host with an arbitrary
    // non-default TLS port is not the verified FBM Staging origin.
    if(target.protocol!=='https:'||!ALLOWED_FBMS.has(target.hostname)||target.port
      ||target.pathname!=='/'||target.search||target.hash||target.username||target.password)
      return say(res,503,{error:'service_unavailable'});
  }catch{return say(res,503,{error:'service_unavailable'});}
  const declaredSize=Number(req.headers['content-length']);
  if(Number.isFinite(declaredSize)&&declaredSize>BODY_LIMIT)
    return say(res,413,{error:'request_too_large'});
  let input;
  try{input=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{
    return say(res,400,{error:'invalid_request'});
  }
  let size;
  try{size=Buffer.byteLength(JSON.stringify(input),'utf8');}catch{
    return say(res,400,{error:'invalid_request'});
  }
  if(size>BODY_LIMIT)return say(res,413,{error:'request_too_large'});
  const payload=validate(input);
  if(!payload)return say(res,400,{error:'invalid_request'});
  try{
    const response=await fetch(new URL('/api/public/request-to-book',target.origin),{
      method:'POST',
      headers:{'content-type':'application/json','x-fbm-intake-secret':secret},
      body:JSON.stringify(payload),
      redirect:'error',signal:AbortSignal.timeout(7000),
    });
    if(response.status===202){
      const data=await response.json();
      if(typeof data?.requestId!=='string'||!data.requestId
         ||data.status!=='pending_review')return say(res,503,{error:'upstream_invalid_response'});
      return say(res,202,{requestId:data.requestId,status:'pending_review',
        message:'Inquiry received for human review; this is not a reservation.'});
    }
    if(response.status===409)return say(res,409,{error:'idempotency_payload_mismatch'});
    if(response.status===400)return say(res,400,{error:'invalid_request'});
    if(response.status===404)return say(res,503,{error:'request_unavailable'});
    return say(res,503,{error:'request_unavailable'});
  }catch{return say(res,503,{error:'request_unavailable'});}
}
module.exports=handler;
// Pure functions, exposed for local regression tests, never sent to browsers.
module.exports._test={resolveBudapestInstant,validate,exactSameOrigin};
