import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const STAGING=path.join(ROOT,'docs/budapest-review-20-staging.json');
const AUDIT=path.join(ROOT,'docs/budapest-review-20-candidates.json');
const PUBLIC=path.join(ROOT,'site/assets/budapest-approved-reviews.json');
const EXPECTED={tripadvisor:10,google:7,getyourguide:3};
const HOSTS={
  tripadvisor:['tripadvisor.com','tripadvisor.co.uk','tripadvisor.co.il','tripadvisor.ie'],
  google:['google.com'],
  getyourguide:['getyourguide.com']
};
const source=JSON.parse(fs.readFileSync(STAGING,'utf8'));
const audit=JSON.parse(fs.readFileSync(AUDIT,'utf8'));
const published=JSON.parse(fs.readFileSync(PUBLIC,'utf8'));
const publish=process.argv.includes('--publish');
const allowedArgs=new Set(['--publish','--report']);
if(process.argv.slice(2).some(x=>!allowedArgs.has(x))){
  console.error('Usage: node scripts/prepare-budapest-review-manifest.mjs [--report|--publish]');
  process.exit(2);
}
const failures=[];
const error=(id,message)=>failures.push(id+': '+message);
const acceptableUrl=(raw,platform)=>{
  try{
    const url=new URL(raw);
    return url.protocol==='https:'&&HOSTS[platform]?.some(x=>
      url.hostname===x||url.hostname.endsWith('.'+x));
  }catch{return false;}
};
const roster=Array.isArray(source.reviews)?source.reviews:[];
if(source.schema_version!==1||source.expected_count!==20||roster.length!==20)
  error('manifest','must contain the original twenty selected reviewers');
if(!audit.owner_republication_authorization||audit.owner_republication_authorization.status!=='approved_by_owner')
  error('rights','owner republication permission is missing');
if(!Array.isArray(audit.candidates)||audit.candidates.length!==20)
  error('audit','source roster does not contain exactly 20 items');
const unique=new Set(),tally={tripadvisor:0,google:0,getyourguide:0};
const approved=[];
for(let i=0;i<roster.length;i++){
  const r=roster[i],original=audit.candidates?.[i],e=original?.source_evidence||{};
  if(!r||!original||r.id!==original.id||r.author!==original.reviewer||
      r.source!==original.platform||unique.has(r.id)){
    error('row '+i,'reviewer identity/order differs from audited 20-person shortlist');
    continue;
  }
  unique.add(r.id);
  if(!Object.hasOwn(tally,r.source)){
    error(r.id,'source platform not supported');continue;
  }
  tally[r.source]++;
  const full=typeof r.full_text==='string'&&r.full_text.trim().length>=35;
  const originalEvidence=e.operator_original_text_evidence;
  // The full text must come from the business's original source, not a third-party mirror.
  const officialSourceText=originalEvidence?.original_text;
  const textMatches=full&&typeof officialSourceText==='string'&&r.full_text===officialSourceText;
  const verified=e.presence_status==='platform_review_found'&&r.source_verified===true
    &&r.full_text_verified===true&&r.approved===true&&textMatches;
  if(!verified){error(r.id,'approved original text or first-party source evidence is missing');continue;}
  if(!Number.isInteger(r.rating)||r.rating<1||r.rating>5)
    error(r.id,'rating must be a documented number from one to five');
  if(typeof r.language!=='string'||!/^[a-z]{2}(-[A-Za-z]{2})?$/.test(r.language)||
     r.language!==originalEvidence.source_text_language)
    error(r.id,'original language is missing or differs from source evidence');
  if(!['review','listing'].includes(r.link_kind)||!acceptableUrl(r.review_url,r.source))
    error(r.id,'official HTTPS source link and truthful link kind are required');
  if(r.date!==null&&!(typeof r.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)))
    error(r.id,'unverified date must be null, not estimated');
  if(e.date_ambiguity&&r.date!==null)
    error(r.id,'regional dates conflict, so do not show a day');
  approved.push({
    id:r.id,author:r.author,full_text:r.full_text,date:r.date,
    rating:r.rating,source:r.source,link_kind:r.link_kind,
    review_url:r.review_url,language:r.language,
    approved:true,source_verified:true,full_text_verified:true
  });
}
for(const [k,v] of Object.entries(EXPECTED)){
  if(tally[k]!==v)error('distribution',k+' must have exactly '+v+' reviews');
}
if(unique.size!==20)error('uniqueness','review IDs are missing or duplicated');
if(source.status!=='ready_for_publication')
  error('approval','staging status must explicitly be ready_for_publication');
const ready=failures.length===0&&approved.length===20;
const report={
  ready,
  selected_count:roster.length,
  full_originals_verified:roster.filter(r=>r?.full_text_verified===true).length,
  publishable_now:approved.length,
  required:20,
  source_mix:tally,
  blockers:failures
};
if(!publish){
  console.log(JSON.stringify(report,null,2));
  process.exit(0);
}
if(!ready){
  console.error('Refusing to publish incomplete or unverified customer reviews.');
  console.error(JSON.stringify(report,null,2));
  process.exit(1);
}
if(published.status!=='awaiting_verified_approval'||published.reviews?.length!==0){
  console.error('Refusing to overwrite a published manifest without review.');
  process.exit(1);
}
fs.writeFileSync(PUBLIC,JSON.stringify({
  schema_version:1,location:'Budapest',status:'approved',expected_count:20,
  description:'Only complete source-verified original guest reviews, authorized for publication.',
  reviews:approved
},null,2)+'\n');
console.log('Wrote 20 verified reviews. Run npm run build, npm run verify:launch, npm run qa:site and get preview approval before merging.');
