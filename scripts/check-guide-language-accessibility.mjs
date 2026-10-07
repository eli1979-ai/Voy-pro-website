import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
const requireText=(text,label)=>{if(!js.includes(text))failures.push(label);};
const forbidText=(text,label)=>{if(js.includes(text))failures.push(label);};

requireText('label for="booking-guide-language"','dynamic guide-language label lacks a for target');
requireText('select id="booking-guide-language" name="guide_language"','dynamic guide-language select lacks matching id');
forbidText('<label>${t(\'Guide language\',\'שפת הדרכה\')}</label><select name="guide_language"','unassociated dynamic guide-language label remains');

if(failures.length){
  console.error('Guide-language accessibility guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Guide-language accessibility guard OK: dynamically inserted booking language control has an explicit label association.');
