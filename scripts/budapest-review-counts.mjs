// A single audited snapshot for the two deliberate ratings displays in each
// Budapest locale (hero trust strip and original-source links above the ticker).
// No third-party scraping, API keys, build-time network or fabricated "live" data.
// Usage:
//   node scripts/budapest-review-counts.mjs --check
//   node scripts/budapest-review-counts.mjs --update tripadvisor 661 2026-10-23 https://www.tripadvisor.co.uk/Attraction_Review-... --dry-run
//   Repeat without --dry-run only after source verification and checking the plan.
// For periodic refresh, open the original listing, verify the exact count,
// then run --update and review/commit the JSON + localized HTML diffs.
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const recordPath=path.join(root,'site/assets/budapest-reputation.json');
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
  if(v.schema_version!==1||keys.some(k=>
    !Number.isSafeInteger(v[k]?.review_count)||v[k].review_count<0||
    !/^https:\/\//.test(v[k].source_url)))fail('invalid source snapshot');
  return v;
};
const countMatcher=key=>new RegExp('(<span data-review-count="'+key+'">)([\\d ,]+)(</span>)','g');
const validatePage=(record,html,locale,filename)=>{
  for(const key of keys){
    const found=[...html.matchAll(countMatcher(key))];
    if(found.length!==2)fail(filename+': expected exactly two '+key+' counters (trust + source), got '+found.length);
    for(const match of found)
      if(match[2]!==format(record[key].review_count,locale))
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
  // The three real review-source links use the same short label, stars,
  // score and rating count hierarchy as the first Budapest trust strip.
  if(!html.includes('/assets/budapest-review-sources-compact.css?v=20261023r1'))
    fail(filename+': Budapest compact review stylesheet missing');
  if((sourceBlock.match(/class="trust-source"/g)||[]).length!==3||
     (sourceBlock.match(/class="stars" aria-hidden="true">★★★★★<\/span>/g)||[]).length!==3||
     (sourceBlock.match(/class="trust-score">5\.0<\/span>/g)||[]).length!==3||
     (sourceBlock.match(/class="trust-sub"/g)||[]).length!==3||
     /class="score"|<small>/.test(sourceBlock))
    fail(filename+': lower review sources must match the first compact trust-strip hierarchy');
  for(const source of ['google_maps','tripadvisor','getyourguide']){
    if(!new RegExp('class="review-source-card" data-review-source="'+source+'" href="https://').test(sourceBlock))
      fail(filename+': external review source link missing: '+source);
  }
  if(!/class="review-source-actions"><a class="btn" data-track="booking_cta"/.test(sourceBlock))
    fail(filename+': consolidated review CTA must preserve booking attribution');
};
const updatePage=(html,record,locale,file)=>{
  let result=html;
  for(const key of keys){
    let n=0;
    result=result.replace(countMatcher(key),(_full,a,_number,z)=>{
      n++;
      return a+format(record[key].review_count,locale)+z;
    });
    if(n!==2)fail(file+': missing '+key+' trust/source markers');
  }
  validatePage(record,result,locale,file);
  return result;
};

const args=process.argv.slice(2);
let record=readRecord();
if(args[0]==='--update'){
  if(args.length<5||args.length>8||!keys.includes(args[1]))
    fail('usage: --update google|tripadvisor|getyourguide COUNT YYYY-MM-DD OFFICIAL_URL [--dry-run] [--allow-decrease] [--refresh-metadata]');
  const [,key,countArg,verifiedAt,url,...options]=args;
  const supported=new Set(['--dry-run','--allow-decrease','--refresh-metadata']);
  if(options.some(option=>!supported.has(option))||new Set(options).size!==options.length)
    fail('unknown or duplicate update option');
  const dryRun=options.includes('--dry-run');
  const allowDecrease=options.includes('--allow-decrease');
  const refreshMetadata=options.includes('--refresh-metadata');
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
  if(count<record[key].review_count&&!allowDecrease)
    fail('decreasing a publicly stated count requires explicit --allow-decrease');
  const previous=record[key].review_count;
  // The Monday watch may re-verify an unchanged count using a newer date or
  // a different official URL. That is not a ratings change and should NOT
  // create a new PR just to bump metadata every single week.
  // Intentional provenance repairs can opt in with --refresh-metadata.
  if(count!==previous||refreshMetadata)
    Object.assign(record[key],{review_count:count,verified_at:verifiedAt,source_url:url});
  // The canonical reputation number is also printed in SEO/support/tour and
  // family pages, not just the two displays on each landing page. Refresh
  // those pages in the same audited transaction or the legacy QA will fail.
  const escaping=value=>{if(!/^[0-9 ,]+$/.test(value))fail('invalid formatted count');return value;};
  const units={
    en:key==='tripadvisor'?'reviews':'ratings',
    he:key==='tripadvisor'?'ביקורות':'דירוגים',
    hu:'értékelés'
  };
  const all=[];
  for(const locale of ['en','he','hu']){
    const prefix=locale==='en'?'site/budapest/':'site/'+locale+'/budapest/';
    const visit=dir=>{
      for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
        const absolute=path.join(dir,entry.name);
        if(entry.isDirectory())visit(absolute);
        else if(entry.isFile()&&entry.name==='index.html')
          all.push({file:path.relative(root,absolute),full:absolute,locale});
      }
    };
    visit(path.join(root,prefix));
  }
  const updated=all.map(({locale,file,full})=>{
    let html=fs.readFileSync(full,'utf8');
    if(count!==previous){
      const from=format(previous,locale),to=format(count,locale);
      const regexp=key==='getyourguide'
        ?new RegExp('(?<!\\d)'+escaping(from)+'(?=\\s+'+units[locale]+')','g')
        :new RegExp('(?<!\\d)'+escaping(from)+'(?!\\d)','g');
      // The full page may contain unrelated numbers (prices, IDs or
      // editorial examples). Only the explicitly designated reputation
      // sections can carry counts from this snapshot. Do not replace a
      // matching number merely because it occurs elsewhere on the page.
      html=html.replace(/<section\b[^>]*>[\s\S]*?<\/section>/g,section=>{
        if(!/<section\b[^>]*class="trust"/.test(section)&&
           !section.includes('class="wrap proof"')&&
           !section.includes('class="review-source-grid"'))return section;
        return section.replace(regexp,to);
      });
    }
    const landing=pages.some(p=>p.file===file);
    if(landing)html=updatePage(html,record,locale,file);
    return {full,text:html};
  });
  // Validate the full output set before touching the working tree.
  if(updated.filter(x=>pages.some(p=>path.join(root,p.file)===x.full)).length!==3)
    fail('missing localized Budapest landing files');
  const changedPages=updated.filter(p=>p.text!==fs.readFileSync(p.full,'utf8'));
  const nextSnapshot=JSON.stringify(record,null,2)+'\n';
  const snapshotChanged=nextSnapshot!==fs.readFileSync(recordPath,'utf8');
  if(dryRun){
    // Safe for the Monday SEO Watch: validate the entire proposed change and
    // report precisely what WOULD change without touching the working tree.
    console.log(JSON.stringify({
      mode:'dry-run',platform:key,oldCount:previous,newCount:count,
      noCountChange:count===previous,metadataRefreshRequested:refreshMetadata,
      changedPageCount:changedPages.length,snapshotChanged,
      changedPages:changedPages.map(p=>path.relative(root,p.full))
    }));
  }else{
    for(const p of changedPages)fs.writeFileSync(p.full,p.text);
    if(snapshotChanged)fs.writeFileSync(recordPath,nextSnapshot);
    console.log(!snapshotChanged&&changedPages.length===0
      ? 'No review count change for '+key+' ('+count+'); no files modified.'
      : 'Updated verified '+key+' count to '+count+' across '+
        changedPages.length+' changed Budapest HTML pages; review all diffs before publishing.');
  }
}else if(args.length===0||args[0]==='--check'){
  if(args.length>1)fail('only --check without other arguments is accepted');
  const css=fs.readFileSync(cssPath,'utf8');
  for(const marker of ['.section.ez-vehicle-bridge+.tour-picker',
      '.section.budapest-seo-links','.section.budapest-review-sources',
      '.review-source-actions']){
    if(!css.includes(marker))fail('compact mobile layout styles missing: '+marker);
  }
  const compact=fs.readFileSync(path.join(root,'site/assets/budapest-review-sources-compact.css'),'utf8');
  if(!/\.budapest-review-sources \.review-source-grid\s*\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/.test(compact)||
    !compact.includes('.budapest-review-sources .review-source-card:focus-visible'))
    fail('review summary must have three columns and keyboard-visible focus');
  for(const {locale,file} of pages)
    validatePage(record,fs.readFileSync(path.join(root,file),'utf8'),locale,file);
  console.log('Budapest review layout and counts consistent in EN/HE/HU: '+
    keys.map(k=>k+' '+record[k].review_count+
      (record[k].verified_at?' verified '+record[k].verified_at:' baseline/unverified')).join('; '));
}else fail('use --check or --update');
