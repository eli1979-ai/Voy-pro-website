// Regression for a Hungarian runtime crash: references to a matcher declared
// later in huDynamic() previously stopped all subsequent site.js initialization.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync('site/assets/site.js','utf8');
const start=source.indexOf('  const HU={');
const end=source.indexOf('  const t=(en,he)=>',start);
assert.ok(start>=0&&end>start,'Hungarian translation helper not found');
const result=vm.runInNewContext(source.slice(start,end)+`
({
  menu:huDynamic('Menu'),
  price:huDynamic('Price item 3'),
  selected:huDynamic('Selected: Buda. Choose your date and group size.'),
  available:huDynamic('Available from 7 independent riders.'),
  fallback:huDynamic('Untranslated site message')
})`,{},{timeout:1000});
assert.equal(result.menu,'Menü');
assert.equal(result.price,'Árelem 3');
assert.equal(result.selected,'Kiválasztva: Buda. Válassz dátumot és csoportlétszámot.');
assert.equal(result.available,'7 önálló vezetőtől elérhető.');
assert.equal(result.fallback,'Untranslated site message');
console.log('HU dynamic translations OK: known, parameterized and fallback text work without TDZ crash.');
