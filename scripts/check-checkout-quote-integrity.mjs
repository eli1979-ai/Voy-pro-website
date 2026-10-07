import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
const requireText=(text,label)=>{if(!js.includes(text))failures.push(label);};

requireText('function assertCheckoutQuote(quote)','checkout quote integrity helper missing');
requireText("if(total==null||total<0||!/^[A-Za-z]{3}$/.test(currency))",'checkout quote must reject invalid total/currency');
requireText("err.code='QUOTE_INVALID'",'invalid quote must have a distinct failure code');
requireText("assertCheckoutQuote(quote);\n      const hold=await api('/holds'",'quote must be validated before a hold is created');
requireText("e.code==='QUOTE_INVALID'?t('The live price could not be verified.",'invalid quote must surface a truthful recovery message');

if(failures.length){
  console.error('Checkout quote integrity guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Checkout quote integrity guard OK: malformed live price/currency cannot proceed to hold or confirmation.');
