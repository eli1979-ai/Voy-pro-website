import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];

const phone='<input id="checkout-phone" name="phone" type="tel" required autocomplete="tel">';
if(!js.includes(phone)){
  failures.push('Budapest live checkout phone field must use type="tel" and autocomplete="tel"');
}
if(js.includes('<input id="checkout-phone" name="phone" required autocomplete="tel">')){
  failures.push('legacy text-like checkout phone field is still present');
}
if(failures.length){
  console.error('Checkout phone input guard failed.');
  for(const failure of failures) console.error('- '+failure);
  process.exit(1);
}
console.log('Checkout phone input guard OK: mobile checkout requests the telephone keyboard and preserves tel autocomplete.');
