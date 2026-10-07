import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
const requireText=(text,label)=>{if(!js.includes(text))failures.push(label);};
const forbidText=(text,label)=>{if(js.includes(text))failures.push(label);};

requireText('async function resumeAnalyticsAfterConsent()','post-consent analytics resume helper missing');
requireText("setStore('voy_visitor_id',visitorId)",'visitor id is not persisted after consent');
requireText("setStore('voy_first_attribution',JSON.stringify(firstTouch))",'first-touch attribution is not persisted after consent');
requireText("setStore('voy_last_attribution',JSON.stringify(attr))",'last-touch attribution is not persisted after consent');
requireText("setStore('voy_segment',segment)",'personalization segment is not persisted after consent');
requireText("setStore('voy_experiments',JSON.stringify(experiments))",'experiment assignments are not persisted after consent');
requireText("await api('/attribution/sync'",'existing essential session is not attribution-synced after consent');
requireText("track('page_view',{title:document.title,consent_transition:true})",'consented landing page view is not emitted');
requireText("const wasAnalytics=analyticsAllowed();setConsent({analytics:true,marketing:false})",'analytics consent transition is not detected');
requireText("if(!wasAnalytics)resumeAnalyticsAfterConsent()",'analytics resume must run only on denied/undecided to granted transition');
forbidText("bar.remove();location.reload();","analytics consent must not reload and lose the original referrer context");

if(failures.length){
  console.error('Consent attribution transition guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Consent attribution transition guard OK: analytics starts only after consent and preserves the current landing/referrer context.');
