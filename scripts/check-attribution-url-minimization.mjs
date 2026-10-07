import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
const requireText=(text,label)=>{if(!js.includes(text))failures.push(label);};
const forbidText=(text,label)=>{if(js.includes(text))failures.push(label);};

requireText('function analyticsReferrer(value)','sanitized referrer helper missing');
requireText('return u.origin+u.pathname','stored referrer must exclude query and hash');
requireText('referrer: analyticsReferrer(referrer)','attribution payload must store the sanitized referrer');
requireText('landing_page: location.pathname','landing page attribution must be path-only');
forbidText('landing_page: location.pathname + location.search','full landing query string must not be stored in attribution');
forbidText('referrer: referrer || null','raw document.referrer must not be stored in attribution');

for(const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','gbraid','wbraid','fbclid','msclkid','ttclid']){
  requireText("qs.get('"+key+"')",key+' must remain available as an explicit attribution field');
}

if(failures.length){
  console.error('Attribution URL minimization guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Attribution URL minimization guard OK: stored landing/referrer URLs exclude arbitrary query/hash data while explicit marketing fields remain available.');
