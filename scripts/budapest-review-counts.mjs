// A single audited snapshot for the two deliberate ratings displays in each
// Budapest locale (hero trust strip and original-source links above the ticker).
// No third-party scraping, API keys, build-time network or fabricated "live" data.
// Usage:
//   node scripts/budapest-review-counts.mjs --check
//   node scripts/budapest-review-counts.mjs --update tripadvisor 660 2026-10-23 https://www.tripadvisor.co.uk/Attraction_Review-...
// For periodic refresh, open the original listing, verify the exact count,
// then run --update and review/commit the JSON + localized HTML diffs.
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const recordPath=path.join(root,'site/assets/budapest-review-counts.json');
const cssPath=path.join(root,'site/assets/site.css');
const pages=[
  {locale:'en',file:'site/budapest/index.html'},
  {locale:'he',file:'site/he/budapest/index.html'},
  {locale:'hu',file:'site/hu/budapest/index.html'}
];
const keys=['google','tripadvisor','getyourguide'];
const format=(n,locale)=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,locale==='hu'?' ':',');
const fail=message=>{throw new Error('Budapest review source/count integrity: '+message)};
const readRecord=()=>{
  const v=JSON.parse(fs.readFileSync(recordPath,'utf8'));
  if(v.schemaVersion!==1||!v.sources||keys.some(k=>
    !Number.isSafeInteger(v.sources[k]?.count)||v.sources[k].count<0||
    !/^https:\/\//.test(v.sources[k].sourceUrl)))fail('invalid source snapshot');
  return v;
};
const countMatcher=key=>new RegExp('(<span data-review-count="'+key+'">)([\\d ,]+)(</span>)','g');
const validatePage=(record,html,locale,filename)=>{
  for(const key of keys){
    const found=[...html.matchAll(countMatcher(key))];
    if(found.length!==2)fail(filename+': expected exactly two '+key+' counters (trust + source), got '+found.length);
    for(const match of found)
      if(match[2]!==format(record.sources[key].count,locale))
        fail(filename+': stale '+key+' count; refresh via --update after source verification');
  }
  const trust=html.indexOf('<section class="trust">');
  const bridge=html.indexOf('class="section ez-vehicle-bridge"');
  const tour=html.indexOf('class="section tour-picker"');
  const seo=html.indexOf('class="section budapest-seo-links"');
  const sources=html.indexOf('class="section budapest-review-sources"');
  const sourceGrid=html.indexOf('class="review-source-grid"');
  const sourceCta=html.indexOf('class="review-source-actions"');
  const ticker=html.indexOf('data-vp-reviews-root hidden');
  if(!(trust>=0&&bridge>trust&&tour>bridge&&seo>tour&&sources>seo&&
       sourceGrid>sources&&sourceCta>sourceGrid&&ticker>sourceCta))
    fail(filename+': section sequence or consolidated source CTA is invalid');
  if((html.match(/class="wrap proof"/g)||[]).length!==1)
    fail(filename+': duplicated mid-page ratings proof block must stay removed');
  if((html.match(/class="review-source-grid"/g)||[]).length!==1||
     (html.match(/data-review-source="/g)||[]).length!==3||
     (html.match(/class="review-source-actions"/g)||[]).length!==1)
    fail(filename+': original Google/Tripadvisor/GYG links or unified CTA missing');
  const sourceBlock=html.slice(sources,ticker);
  if(!/class="review-source-actions"><a class="btn" data-track="booking_cta"/.test(sourceBlock))
    fail(filename+': consolidated review CTA must preserve booking attribution');
};
const updatePage=(html,record,locale,file)=>{
  let result=html;
  for(const key of keys){
    let n=0;
    result=result.replace(countMatcher(key),(_full,a,_number,z)=>{
      n++;
      return a+format(record.sources[key].count,locale)+z;
    });
    if(n!==2)fail(file+': missing '+key+' trust/source markers');
  }
  validatePage(record,result,locale,file);
  return result;
};

const args=process.argv.slice(2);
let record=readRecord();
if(args[0]==='--update'){
  if(args.length<5||args.length>6||!keys.includes(args[1]))
    fail('usage: --update google|tripadvisor|getyourguide COUNT YYYY-MM-DD OFFICIAL_URL [--allow-decrease]');
  const [,key,countArg,verifiedAt,url,optional]=args;
  const count=Number(countArg);
  if(!/^\d+$/.test(countArg)||!Number.isSafeInteger(count)||count>10000000)
    fail('count must be a nonnegative integer from the actual public source');
  if(!/^\d{4}-\d\d-\d\d$/.test(verifiedAt)||
      new Date(verifiedAt+'T00:00:00Z').toISOString().slice(0,10)!==verifiedAt)
    fail('verification date must be valid YYYY-MM-DD');
  const source=new URL(url);
  const host=source.hostname.toLowerCase();
  const allowed=key==='google'?/^(?:www\.)?google\.[a-z.]+$/:
    key==='tripadvisor'?/^(?:www\.)?tripadvisor\.(?:com|co\.uk|co\.il|ie)$/:
    /^(?:www\.)?getyourguide\.com$/;
  if(source.protocol!=='https:'||!allowed.test(host)||source.username||source.password)
    fail('URL must be the official platform verification page');
  if(count<record.sources[key].count&&optional!=='--allow-decrease')
    fail('decreasing a publicly stated count requires explicit --allow-decrease');
  if(optional&&optional!=='--allow-decrease')fail('unknown option '+optional);
  record.sources[key]={count,verifiedAt,sourceUrl:url,note:'Manually verified from the official platform listing'};
  record.updatedAt=verifiedAt;
  // Validate and stage every output in memory BEFORE writing any file.
  const updated=pages.map(({locale,file})=>{
    const full=path.join(root,file);
    return {full,text:updatePage(fs.readFileSync(full,'utf8'),record,locale,file)};
  });
  for(const p of updated)fs.writeFileSync(p.full,p.text);
  fs.writeFileSync(recordPath,JSON.stringify(record,null,2)+'\n');
  console.log('Updated verified '+key+' count to '+count+' across Budapest EN/HE/HU; review all diffs before publishing.');
}else if(args.length===0||args[0]==='--check'){
  if(args.length>1)fail('only --check without other arguments is accepted');
  const css=fs.readFileSync(cssPath,'utf8');
  for(const marker of ['.section.ez-vehicle-bridge+.tour-picker',
      '.section.budapest-seo-links','.section.budapest-review-sources',
      '.review-source-actions']){
    if(!css.includes(marker))fail('compact mobile layout styles missing: '+marker);
  }
  for(const {locale,file} of pages)
    validatePage(record,fs.readFileSync(path.join(root,file),'utf8'),locale,file);
  console.log('Budapest review layout and counts consistent in EN/HE/HU: '+
    keys.map(k=>k+' '+record.sources[k].count+
      (record.sources[k].verifiedAt?' verified '+record.sources[k].verifiedAt:' baseline/unverified')).join('; '));
}else fail('use --check or --update');
