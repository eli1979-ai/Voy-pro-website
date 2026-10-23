import assert from 'node:assert/strict';
import fs from 'node:fs';
const site=fs.readFileSync('site/assets/site.js','utf8');
const req=(term,msg)=>assert.ok(site.includes(term),msg);
req("const requestedGuideLanguageLabel=()=>locale==='he'?'שפת הדרכה מבוקשת'",
 'Hebrew label must clarify the guest requested the language');
req(":'Kért idegenvezetési nyelv'","Hungarian label must clarify this is a request");
req(":'Requested guiding language';","English label must not promise assigned language coverage");
for(const snippet of [
 "${requestedGuideLanguageLabel()} · ${escapeHTML(guideLanguageLabel(bookingState.guideLanguage))}",
 "${requestedGuideLanguageLabel()} · ${escapeHTML(guideLanguageLabel(guideLanguage))}",
 "${requestedGuideLanguageLabel()} · ${escapeHTML(guideLanguageLabel(confirmed.guideLanguage))}",
 'data-requested-guide-language-note',
 'The Budapest team will confirm language coverage with the assigned staff.',
 'צוות בודפשט יאשר את אפשרות ההדרכה בשפה זו',
 'budapesti csapat egyezteti a nyelvi teljesíthetőséget',
 'Requested guiding language: ${guideLanguageLabel(details.guide_language)}',
 'Kért idegenvezetési nyelv: ${m[1]}',
]){
 req(snippet,'Requested language must be distinguished from staffed delivery: '+snippet);
}
assert.equal((site.match(/\$\{requestedGuideLanguageLabel\(\)\}/g)||[]).length,3,
 'The normal checkout, staff-request checkout and booking confirmation all require requested-language labels');
assert.ok(!site.includes("${t('Guide','הדרכה')} · ${escapeHTML(guideLanguageLabel(confirmed.guideLanguage))}"),
 'Confirmed booking must not claim unverified guiding delivery');
assert.ok(!site.includes('english_alternative_accepted'),
 'Main booking must not silently opt the customer into English before FBM end-to-end release');
for(const api of ['/holds','/bookings','/booking-capacity-requests']){
 req("api('"+api+"'","Existing backend journey must remain present: "+api);
}
req('guide_language:guideLanguage','Hold/request retains originally selected guide language');
req('guide_language:submission.guide_language','Booking continues passing original guide preference');
console.log('Website guiding-language copy QA OK: request vs staffing, localized confirmations, no fallback activation.');
