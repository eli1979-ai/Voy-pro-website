// Read-only weekly evidence checklist for Budapest public reputation.
// This does not fetch/scrape third-party content or assert that stored counts
// are current. A person or separately authorized source must verify each
// official platform before editing the published canonical snapshot.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const source=JSON.parse(fs.readFileSync('site/assets/budapest-reputation.json','utf8'));
const platforms=[
  {key:'google',label:'Google Maps'},
  {key:'tripadvisor',label:'Tripadvisor'},
  {key:'getyourguide',label:'GetYourGuide'}
];
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
const day=24*60*60*1000;
const FRESHNESS_DAYS=7; // A weekly check is due after seven full UTC days.
const asDay=value=>{
  if(!datePattern.test(String(value||'')))throw Error('Missing source verification date');
  const parsed=Date.parse(value+'T00:00:00Z');
  if(!Number.isFinite(parsed)||new Date(parsed).toISOString().slice(0,10)!==value)throw Error('Invalid source verification date: '+value);
  return parsed;
};
function render(reference=new Date()){
  const utcDate=reference.toISOString().slice(0,10);
  const now=asDay(utcDate);
  const rows=[];
  for(const {key,label} of platforms){
    const entry=source[key],count=entry?.review_count,verified=entry?.verified_at,sourceUrl=entry?.source_url;
    if(!Number.isSafeInteger(count)||count<0||typeof sourceUrl!=='string')throw Error('Invalid '+label+' snapshot');
    const url=new URL(sourceUrl);
    const host=url.hostname.toLowerCase();
    const trusted=key==='google'?/(^|\.)google\.[a-z.]+$/.test(host):
      key==='tripadvisor'?/(^|\.)tripadvisor\.(com|co\.uk|co\.il|ie)$/.test(host):
      host==='getyourguide.com'||host==='www.getyourguide.com';
    if(url.protocol!=='https:'||!trusted||url.username||url.password)throw Error('Invalid '+label+' source URL');
    const verifiedDay=asDay(verified);
    if(verifiedDay>now)throw Error(label+': future verification date cannot be treated as fresh');
    const days=Math.floor((now-verifiedDay)/day);
    rows.push({label,count,verified,days,sourceUrl,due:days>=FRESHNESS_DAYS});
  }
  return [
    '<!-- voy-pro-budapest-weekly-reputation -->',
    '# Budapest — weekly review-count verification',
    '',
    '**Evidence checklist generated:** '+utcDate+' (UTC). This is a read-only task, not a freshly verified count.',
    '',
    '| Platform | Last published count | Last verified | Age | Verification needed | Official verification link |',
    '| --- | ---: | --- | ---: | --- | --- |',
    ...rows.map(r=>`| ${r.label} | ${r.count.toLocaleString('en-US')} | ${r.verified} | ${r.days} days | ${r.due?'DUE — source check required':'Within 7-day interval — not a live reading'} | [Open listing](${r.sourceUrl}) |`),
    '',
    '**Action:** '+(rows.some(r=>r.due)
      ?rows.filter(r=>r.due).map(r=>r.label).join(', ')+' require fresh official-page verification; do not auto-update published counts.'
      :'No source has reached the 7-day age threshold. This report still does **not** verify present review counts.'),
    '',
    '## Verification steps',
    '',
    '1. Open each source link; read the displayed review count on the actual business page (not a search-result snippet).',
    '2. Record the **observed count**, **verification date**, and exact **official listing URL**. If it is hidden or ambiguous, mark unverified—do not guess.',
    '3. For changed counts, run the existing `node scripts/budapest-review-counts.mjs --update PROVIDER COUNT YYYY-MM-DD OFFICIAL_URL --dry-run`; inspect all affected EN/HE/HU pages before updating and proposing a PR.',
    '4. If the counts are unchanged, close the weekly check without changing the repository snapshot solely to refresh the timestamp.',
    '',
    '**Guardrails:** never change the live website, fabricate or scrape counts, publish unreviewed changes, or infer that a past snapshot is current.',
    ''
  ].join('\n');
}
if(process.argv.includes('--test')){
  const result=render(new Date('2026-10-30T12:00:00Z'));
  for(const {label} of platforms)assert.ok(result.includes(label));
  assert.ok(result.includes('2026-10-30'));
  for(const {key} of platforms)assert.ok(result.includes(source[key].verified_at));
  assert.ok(result.includes('dry-run')&&result.includes('unverified'));
  assert.ok(result.includes('voy-pro-budapest-weekly-reputation'));
  assert.equal((result.match(/\[Open listing\]/g)||[]).length,3);
  assert.ok(result.includes('Within 7-day interval — not a live reading'),
    'Recent stored counts are still not live counts');
  const stale=render(new Date('2026-11-10T12:00:00Z'));
  for(const {label} of platforms)assert.ok(stale.includes('| '+label+' |')&&stale.includes('DUE — source check required'));
  assert.ok(stale.includes('require fresh official-page verification'));
  assert.throws(()=>render(new Date('2026-10-20T12:00:00Z')),/future verification date/,
    'The checklist must reject future-dated verification rather than report 0-day freshness');
  console.log('Budapest weekly review evidence report QA passed: three canonical sources, explicit provenance, safe no-update guardrails.');
}else if(process.argv.length>2||process.argv.length===3)throw Error('Usage: weekly-review-audit.mjs [--test]');
else process.stdout.write(render());
