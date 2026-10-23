// The website/affiliate widget must follow FBM #774's explicit-language rule
// without prematurely activating optional English alternative consent (#777).
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const widget=fs.readFileSync('site/assets/affiliate-booking-widget.js','utf8');
const required=(needle,message)=>assert.ok(widget.includes(needle),message);
required('name="language" required aria-required="true"','Guiding-language selector must be mandatory');
required('aria-describedby="voy-partner-guide-language-help"','Language must have an accessible explanation');
required('No language is selected automatically.','Explain the absence of defaults');
assert.ok(!widget.includes('No preference'),'Unknown guiding language must never be offered as a valid choice');
required("languageSelect.value='';",'Changing a tour must reset previous language choice');
required('languageSelect.disabled=!offered.length;','Missing catalog languages must fail closed');
required("if(loading||!requireSelectedGuideLanguage())return;",'Availability/hold must require a choice');
required("if(!requireSelectedGuideLanguage())return;\n      const staffRequest=",
  'Request-to-Book and checkout must revalidate the language');
assert.equal((widget.match(/guide_language:selectedGuideLanguage\(\)/g)||[]).length,2,
  'Hold and capacity-request paths must send a catalog-valid language');
assert.ok(!widget.includes('guide_language:languageSelect.value||null'),
  'The partner widget must not silently send a null guide language');
assert.ok(!widget.includes('english_alternative_accepted'),
  'English alternative is not active for the partner widget before FBM release gate');

// Exercise the production selection helper, not a duplicate implementation.
const start=widget.indexOf('    function selectedGuideLanguage(){');
const end=widget.indexOf('    function requireSelectedGuideLanguage(){',start);
assert.ok(start>0&&end>start,'Production guiding-language validator missing');
const validator=widget.slice(start,end);
for(const [choice,activeId,products,expected] of [
  ['', 'tour-1', [{id:'tour-1',guideLanguages:['en','he']}],null],
  ['he', 'tour-1', [{id:'tour-1',guideLanguages:['en','he']}],'he'],
  ['HU', 'tour-2', [{id:'tour-2',guideLanguages:['HU','en']}],'hu'],
  ['fr', 'tour-1', [{id:'tour-1',guideLanguages:['en','he']}],null],
  ['en', 'tour-3', [{id:'tour-3',guideLanguages:[]}],null],
  ['en', 'tour-4', [{id:'tour-4'}],null],
  ['en', '', [{id:'tour-1',guideLanguages:['en']}],null],
  ['he', 'tour-2', [{id:'tour-1',guideLanguages:['he']}],null],
]){
 const actual=vm.runInNewContext(
   '(()=>{const languageSelect={value:choice};const experienceSelect={value:active};const experiences=products;'+validator+'return selectedGuideLanguage();})()',
   {choice,active:activeId,products},{timeout:1000});
 assert.equal(actual,expected,'Guide language must match active product catalog and be explicitly chosen');
}

// Fail early, before any availability, quote, hold or capacity API request.
const availability=widget.slice(widget.indexOf('async function loadAvailability('),widget.indexOf('async function confirm('));
assert.ok(availability.indexOf('requireSelectedGuideLanguage()')<
  availability.indexOf("api('/experiences/"),'Fail closed before the availability call');
const slot=widget.slice(widget.indexOf('async function selectSlot('),widget.indexOf('async function loadAvailability('));
assert.ok(slot.indexOf('requireSelectedGuideLanguage()')<
  slot.indexOf("api('/promotions/validate'"),'Fail closed before promotion and hold calls');
const confirm=widget.slice(widget.indexOf('async function confirm('),widget.indexOf('function showRequestSuccess('));
assert.ok(confirm.indexOf('requireSelectedGuideLanguage()')<
  confirm.indexOf("api('/booking-capacity-requests'"),'Fail closed before staff approval request');

console.log('Affiliate guiding-language guard OK: explicitly chosen/catalog-valid, no null holds/requests, no silent English alternative.');
