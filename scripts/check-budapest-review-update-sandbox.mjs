// Safely rehearse future weekly review-count changes against a disposable copy
// of the current EN/HE/HU Budapest tree. Never contact external services,
// modify the repository checkout, or create real/fake production reviews.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const source=process.cwd();
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'voy-budapest-count-qa-'));
const copy=(relative)=>{
  const dest=path.join(tmp,relative);
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.cpSync(path.join(source,relative),dest,{recursive:true});
};
const script=['scripts/budapest-review-counts.mjs'];
const run=args=>execFileSync(process.execPath,[...script,...args],{
  cwd:tmp,encoding:'utf8',timeout:15000,stdio:['ignore','pipe','pipe']
});
const read=relative=>fs.readFileSync(path.join(tmp,relative),'utf8');
const write=(relative,content)=>fs.writeFileSync(path.join(tmp,relative),content);
const snapshots={
  google:'https://www.google.com/maps/search/?api=1&query=EZRaider%20Budapest%20by%20Voy%20PRO',
  tripadvisor:'https://www.tripadvisor.co.uk/Attraction_Review-g274887-d24081931-Reviews-Ezraider_Budapest_By_Voy_Pro-Budapest_Central_Hungary.html',
  getyourguide:'https://www.getyourguide.com/ezraider-budapest-by-voy-pro-s269621/'
};
const format=(n,locale)=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,locale==='hu'?' ':',');

try{
  for(const relative of [
    'scripts/budapest-review-counts.mjs','site/assets/budapest-reputation.json',
    'site/assets/site.css','site/budapest','site/he/budapest','site/hu/budapest'
  ])copy(relative);
  const original=JSON.parse(read('site/assets/budapest-reputation.json'));
  const sample='site/budapest/first-day/index.html';
  const extra='<aside data-reputation-qa-sentinel="not-a-rating">'+
    'unrelated inventory 660; reference number 1,315; 6 units; '+
    'archived metrics: 660 reviews, 1,315 ratings, 6 ratings</aside>';
  write(sample,read(sample).replace('</body>',extra+'</body>'));
  assert.match(read(sample),/data-reputation-qa-sentinel/);
  assert.match(run(['--check']),/Budapest review layout and counts consistent/);

  const scenarios=[
    ['google',original.google.review_count+1],
    ['tripadvisor',original.tripadvisor.review_count+1],
    ['getyourguide',original.getyourguide.review_count+1]
  ];
  for(const [provider,count] of scenarios){
    const args=['--update',provider,String(count),'2026-10-23',snapshots[provider]];
    const beforePlanSnapshot=read('site/assets/budapest-reputation.json');
    const beforePlanLanding=read('site/budapest/index.html');
    const beforePlanSample=read(sample);
    const plan=JSON.parse(run([...args,'--dry-run']));
    assert.deepEqual([plan.mode,plan.platform,plan.newCount],
      ['dry-run',provider,count],'read-only plan must describe the requested platform');
    assert.ok(plan.changedPageCount>0&&plan.changedPageCount===plan.changedPages.length,
      'a real count change must preview specific page edits');
    assert.ok(plan.changedPages.includes('site/budapest/index.html')&&
      plan.changedPages.includes('site/he/budapest/index.html')&&
      plan.changedPages.includes('site/hu/budapest/index.html'),
      'preview must list every localized Budapest landing page');
    assert.equal(read('site/assets/budapest-reputation.json'),beforePlanSnapshot,
      'dry-run must never touch the current reputation snapshot');
    assert.equal(read('site/budapest/index.html'),beforePlanLanding,
      'dry-run must never change localized site pages');
    assert.equal(read(sample),beforePlanSample,
      'dry-run must leave the injected unrelated numbers untouched');
    assert.match(run(args),/Updated verified/);
    const noop=JSON.parse(run([...args,'--dry-run']));
    assert.equal(noop.changedPageCount,0,
      'unchanged verified count should not produce a pointless page PR');
    assert.equal(noop.snapshotChanged,false,
      'same provider/count/date/source should not modify provenance metadata');
    // A normal Monday check often re-confirms the SAME count on a later date.
    // The snapshot must not change just because a new weekly check happened.
    const currentBeforeWeekly=read('site/assets/budapest-reputation.json');
    const nextMondayArgs=[...args];
    nextMondayArgs[3]='2026-10-30';
    const nextMonday=JSON.parse(run([...nextMondayArgs,'--dry-run']));
    assert.equal(nextMonday.noCountChange,true,
      'the plan must explicitly report unchanged provider counts');
    assert.equal(nextMonday.snapshotChanged,false,
      'newer re-verification date alone must not trigger a metadata-only PR');
    assert.equal(nextMonday.changedPageCount,0,
      'newer re-verification date must not require HTML edits');
    assert.match(run(nextMondayArgs),/No review count change/,
      'applying unchanged weekly reviews should report a no-op');
    assert.equal(read('site/assets/budapest-reputation.json'),currentBeforeWeekly,
      'weekly re-verification must not overwrite existing provenance by default');
    assert.match(run(['--check']),/Budapest review layout and counts consistent/);
    assert.ok(read(sample).includes(extra),
      'a review-count update must not alter unrelated numeric content: '+provider);
    const current=JSON.parse(read('site/assets/budapest-reputation.json'));
    assert.equal(current[provider].review_count,count);
    assert.equal(current[provider].verified_at,'2026-10-23');
    for(const [locale,page] of [
      ['en','site/budapest/index.html'],
      ['he','site/he/budapest/index.html'],
      ['hu','site/hu/budapest/index.html'],
      ['en','site/budapest/with-kids/index.html'],
      ['hu','site/hu/budapest/first-day/index.html']
    ]){
      assert.ok(read(page).includes(format(count,locale)),
        provider+' must update its count in '+page);
    }
  }

  // Provenance can still be corrected explicitly without changing any
  // consumer-facing review count. This action must be opt-in, not weekly noise.
  const fixArgs=['--update','tripadvisor',String(original.tripadvisor.review_count+1),
    '2026-10-30',snapshots.tripadvisor,'--refresh-metadata'];
  const repairPlan=JSON.parse(run([...fixArgs,'--dry-run']));
  assert.equal(repairPlan.changedPageCount,0,
    'opt-in provenance fix must not touch review HTML if the count is stable');
  assert.equal(repairPlan.snapshotChanged,true,
    'explicit metadata refresh must produce an auditable snapshot change');
  assert.equal(repairPlan.metadataRefreshRequested,true,
    'the plan must reveal that metadata refresh was explicitly requested');
  assert.match(run(fixArgs),/Updated verified/,
    'explicit metadata refresh should update only the canonical snapshot');
  assert.equal(JSON.parse(read('site/assets/budapest-reputation.json')).tripadvisor.verified_at,
    '2026-10-30','intentional metadata correction must be persisted');
  const before=read('site/assets/budapest-reputation.json');
  for(const bad of [
    ['--update','tripadvisor','-1','2026-10-23',snapshots.tripadvisor],
    ['--update','tripadvisor','123','2026-10-23','https://not-tripadvisor.example/reviews'],
    ['--update','google','1','2026-10-23',snapshots.google],
    ['--update','getyourguide','999','2026-02-31',snapshots.getyourguide]
  ]){
    const result=spawnSync(process.execPath,[...script,...bad],{cwd:tmp,encoding:'utf8',timeout:15000});
    assert.notEqual(result.status,0,'invalid/unverified update must fail: '+bad.join(' '));
    assert.equal(read('site/assets/budapest-reputation.json'),before,
      'invalid updates must not change the canonical snapshot');
    assert.ok(read(sample).includes(extra),'invalid updates must not change page text');
  }
  console.log('Budapest weekly review update rehearsal OK: preview plans, cross-week no-op behavior, explicit metadata refresh, all 3 sources, three languages, source metadata, unrelated-number protection and fail-closed validation; repository checkout unchanged.');
}finally{
  fs.rmSync(tmp,{recursive:true,force:true});
}
