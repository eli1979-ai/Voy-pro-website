import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
const requireText=(text,label)=>{if(!js.includes(text))failures.push(label);};

requireText('function assertCheckoutQuote(quote)','checkout quote integrity helper missing');
requireText("if(total==null||total<0||!/^[A-Za-z]{3}$/.test(currency))",'checkout quote must reject invalid total/currency');
requireText("err.code='QUOTE_INVALID'",'invalid quote must have a distinct failure code');
requireText("assertCheckoutQuote(quote);\n      const hold=await api('/holds'",'quote must be validated before a hold is created');
requireText("e.code==='QUOTE_INVALID'?t('The live price could not be verified.",'invalid quote must surface a truthful recovery message');

// The in-browser checkout must fail closed even when the backend returned
// HTTP 200 but supplied a missing token, malformed timestamp or expired hold.
requireText('function checkoutHoldIsValid(hold,atMs=Date.now())',
  'temporary hold integrity helper is missing');
requireText('if(!checkoutHoldIsValid(hold))abandonInvalidHold(hold);',
  'checkout is not gated by verified hold id and expiry');
requireText("err.code='HOLD_INVALID'",'invalid hold needs an explicit failure code');
requireText("e.code==='HOLD_INVALID'?t('Temporary reservation could not be verified.",
  'a malformed hold should give a truthful recovery message');
const gated=js.indexOf('if(!checkoutHoldIsValid(hold))abandonInvalidHold(hold);');
const open=js.indexOf('bookingState={slot,composition,quote,hold,experience,date,isPrivate');
if(gated<0||open<0||gated>=open)
  failures.push('invalid hold can enter checkout before validation');
const captured=js.match(/function checkoutHoldIsValid\(hold,atMs=Date\.now\(\)\)\{[\s\S]*?\n  \}/);
if(!captured)failures.push('could not inspect hold validity function');
else{
  const valid=Function('return ('+captured[0]+')')();
  const when=Date.parse('2026-10-27T12:00:00Z');
  const later='2026-10-27T12:05:00Z',past='2026-10-27T11:59:59Z';
  const cases=[
    [{id:'hold_123',expires_at:later},true,'future valid token'],
    [{id:'',expires_at:later},false,'empty hold token'],
    [{expires_at:later},false,'missing hold token'],
    [null,false,'missing response'],
    [{id:'hold_123'},false,'missing expiry'],
    [{id:'hold_123',expires_at:'not-a-time'},false,'invalid expiry'],
    [{id:'hold_123',expires_at:past},false,'expired hold'],
    [{id:'hold_123',expires_at:'2026-10-27T12:00:00Z'},false,'expiry equal to now'],
    [{id:0,expires_at:later},false,'numeric token']
  ];
  for(const [input,expected,description] of cases){
    if(valid(input,when)!==expected)failures.push('unexpected hold validation: '+description);
  }
}

if(failures.length){
  console.error('Checkout quote integrity guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Checkout quote/hold integrity guard OK: malformed live quotes and missing/expired hold tokens cannot expose checkout.');
