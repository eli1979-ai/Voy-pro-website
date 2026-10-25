// Exercise the *actual* website-local date helpers with deterministic clocks.
// This is isolated from customers, external APIs, bookings, calendars and payments.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync('site/assets/site.js','utf8');
function loadClockedDate(name,instant){
  const re=new RegExp('  function '+name+'\\(offsetDays=0\\)\\{[\\s\\S]*?\\n  \\}');
  const found=source.match(re);
  assert.ok(found,'Missing expected '+name+' function in actual website runtime');
  const ms=Date.parse(instant);
  assert.ok(Number.isFinite(ms),'Invalid test instant '+instant);
  class FixedDate extends Date{
    constructor(...args){if(args.length)super(...args);else super(ms);}
    static now(){return ms;}
  }
  const ctx=vm.createContext({Date:FixedDate,Intl});
  return vm.runInContext(found[0]+'\\n'+name,ctx,{timeout:1000});
}
const cases=[
  // EU DST falls back on October 25, 2026. 21 calendar days is NOT 21
  // elapsed 24-hour periods when the departure day is near local midnight.
  ['budapestDate','2026-10-24T22:30:00Z',0,'2026-10-25'],
  ['budapestDate','2026-10-24T22:30:00Z',21,'2026-11-15'],
  ['portugalDate','2026-10-24T23:30:00Z',0,'2026-10-25'],
  ['portugalDate','2026-10-24T23:30:00Z',21,'2026-11-15'],
  // Spring clock advance can add a spurious day if a UTC hour delta is used.
  ['budapestDate','2027-03-27T22:30:00Z',0,'2027-03-27'],
  ['budapestDate','2027-03-27T22:30:00Z',2,'2027-03-29'],
  ['portugalDate','2027-03-27T23:30:00Z',0,'2027-03-27'],
  ['portugalDate','2027-03-27T23:30:00Z',2,'2027-03-29'],
  ['budapestDate','2026-10-24T22:30:00Z',-1,'2026-10-24'],
  ['portugalDate','2026-10-24T23:30:00Z',-1,'2026-10-24'],
  ['budapestDate','2026-12-31T22:30:00Z',1,'2027-01-01'],
  ['portugalDate','2026-12-31T23:30:00Z',1,'2027-01-01']
];
for(const [name,instant,offset,expected] of cases){
  const actual=loadClockedDate(name,instant)(offset);
  assert.equal(actual,expected,name+' '+instant+' offset='+offset);
}
console.log('Destination-local calendar date QA passed: '+cases.length+' EU fall/spring DST, local-midnight and year-boundary cases.');
