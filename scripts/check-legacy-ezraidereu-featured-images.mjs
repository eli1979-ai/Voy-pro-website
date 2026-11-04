#!/usr/bin/env node
/**
 * READ-ONLY legacy EZRaiderEU image continuity candidate.
 * Work #685: PHP homepage tour loop uses get_the_post_thumbnail().
 * Evidence: authenticated /budapest/ WordPress REST on 2026-10-30.
 * Reuses existing English featured media; no uploads or writes.
 *
 * node scripts/check-legacy-ezraidereu-featured-images.mjs --self-test
 * node scripts/check-legacy-ezraidereu-featured-images.mjs --baseline
 * node scripts/check-legacy-ezraidereu-featured-images.mjs --snapshot /private/meta.json
 * Snapshot schema: {records:[{id,status:'publish',featured_media}],
 *  media:[{id,source_url,mime_type,media_details:{width,height},alt_text}]}.
 * Read both fresh from authorized WordPress; do not commit private snapshots.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const contract=JSON.parse(readFileSync(new URL('../docs/legacy-wordpress/ezraidereu-published-link-contract-20261028.json',import.meta.url),'utf8'));
const evidence=[
  {
    "family": "buda-castle",
    "imageId": 431,
    "file": "budai-var-karoly-corner-residences5.jpg",
    "ids": {
      "en": 38,
      "hu": 256,
      "he": 271
    },
    "current": {
      "en": 431,
      "hu": 0,
      "he": 0
    }
  },
  {
    "family": "citadella",
    "imageId": 433,
    "file": "7474.jpg",
    "ids": {
      "en": 43,
      "hu": 258,
      "he": 272
    },
    "current": {
      "en": 433,
      "hu": 0,
      "he": 0
    }
  },
  {
    "family": "heroes-square",
    "imageId": 430,
    "file": "heroes-square.jpg",
    "ids": {
      "en": 44,
      "hu": 259,
      "he": 273
    },
    "current": {
      "en": 430,
      "hu": 0,
      "he": 0
    }
  },
  {
    "family": "margaret-island",
    "imageId": 429,
    "file": "Depositphotos_321919464_L.jpg",
    "ids": {
      "en": 45,
      "hu": 260,
      "he": 274
    },
    "current": {
      "en": 429,
      "hu": 0,
      "he": 0
    }
  },
  {
    "family": "extended",
    "imageId": 428,
    "file": "andras-kovacs-AKWV2GrWark-unsplash.jpg",
    "ids": {
      "en": 46,
      "hu": 261,
      "he": 275
    },
    "current": {
      "en": 428,
      "hu": 0,
      "he": 0
    }
  },
  {
    "family": "night",
    "imageId": 427,
    "file": "janos-venczak-WUJQoRFRwQg-unsplash-1.jpg",
    "ids": {
      "en": 47,
      "hu": 262,
      "he": 276
    },
    "current": {
      "en": 427,
      "hu": 0,
      "he": 0
    }
  },
  {
    "family": "off-road",
    "imageId": 424,
    "file": "img02.jpg",
    "ids": {
      "en": 48,
      "hu": 263,
      "he": 277
    },
    "current": {
      "en": 424,
      "hu": 424,
      "he": 0
    }
  }
];
const langs=['en','hu','he'];
// Media provenance as of 2026-10-30, not live-file or restore proof.
const mediaEvidence=[
  {
    "id": 424,
    "source_url": "https://ezraidereu.com/budapest/wp-content/uploads/2021/09/img02.jpg",
    "mime_type": "image/jpeg",
    "media_details": {
      "width": 1920,
      "height": 1281
    },
    "alt_text": ""
  },
  {
    "id": 427,
    "source_url": "https://ezraidereu.com/budapest/wp-content/uploads/2021/09/janos-venczak-WUJQoRFRwQg-unsplash-1.jpg",
    "mime_type": "image/jpeg",
    "media_details": {
      "width": 1200,
      "height": 800
    },
    "alt_text": ""
  },
  {
    "id": 428,
    "source_url": "https://ezraidereu.com/budapest/wp-content/uploads/2021/09/andras-kovacs-AKWV2GrWark-unsplash.jpg",
    "mime_type": "image/jpeg",
    "media_details": {
      "width": 1200,
      "height": 800
    },
    "alt_text": ""
  },
  {
    "id": 429,
    "source_url": "https://ezraidereu.com/budapest/wp-content/uploads/2021/09/Depositphotos_321919464_L.jpg",
    "mime_type": "image/jpeg",
    "media_details": {
      "width": 1200,
      "height": 675
    },
    "alt_text": ""
  },
  {
    "id": 430,
    "source_url": "https://ezraidereu.com/budapest/wp-content/uploads/2021/09/heroes-square.jpg",
    "mime_type": "image/jpeg",
    "media_details": {
      "width": 1200,
      "height": 800
    },
    "alt_text": "Heroes’ Square and Millennium Monument in Budapest"
  },
  {
    "id": 431,
    "source_url": "https://ezraidereu.com/budapest/wp-content/uploads/2021/09/budai-var-karoly-corner-residences5.jpg",
    "mime_type": "image/jpeg",
    "media_details": {
      "width": 1000,
      "height": 600
    },
    "alt_text": "Buda Castle district in Budapest"
  },
  {
    "id": 433,
    "source_url": "https://ezraidereu.com/budapest/wp-content/uploads/2021/09/7474.jpg",
    "mime_type": "image/jpeg",
    "media_details": {
      "width": 1200,
      "height": 896
    },
    "alt_text": ""
  }
];
function originalSnapshot(){
 return evidence.flatMap(f=>langs.map(lang=>({id:f.ids[lang],status:'publish',featured_media:f.current[lang]})));
}
export function auditImageReuse(raw, source=evidence, manifest=contract, suppliedMedia){
 const errors=[],changes=[],list=Array.isArray(raw)?raw:raw?.records;
 // A staging snapshot must provide independently read attachment metadata.
 // The source's own image IDs/filenames alone cannot prove their existence.
 const mediaList=suppliedMedia??(Array.isArray(raw)?undefined:raw?.media);
 if(!Array.isArray(mediaList)||mediaList.length!==7)errors.push('REQUIRE_7_INDEPENDENT_MEDIA_RECORDS');
 const mediaById=new Map();
 for(const item of Array.isArray(mediaList)?mediaList:[]){
  if(!Number.isSafeInteger(item?.id)||item.id<1||mediaById.has(item.id))
   errors.push('INVALID_OR_DUPLICATE_MEDIA_ID');
  else mediaById.set(item.id,item);
 }
 if(!Array.isArray(list)||list.length!==21)errors.push('INVALID_SNAPSHOT_SIZE');
 const byId=new Map();
 for(const item of Array.isArray(list)?list:[]){
  if(!Number.isSafeInteger(item?.id)||item.id<1||byId.has(item.id))errors.push('INVALID_OR_DUPLICATE_ID');
  else byId.set(item.id,item);
 }
 if(!Array.isArray(source)||source.length!==7||!Array.isArray(manifest?.families)||manifest.families.length!==7)
  errors.push('INVALID_FAMILY_COUNT');
 const sources=new Map((Array.isArray(source)?source:[]).map(x=>[x.family,x]));
 const expectedIds=new Set();
 for(const family of manifest?.families||[]){
  const f=sources.get(family.family);
  if(!f||!Number.isSafeInteger(f.imageId)||f.imageId<=0||
    !/^[\w.-]+\.(?:png|jpg|jpeg|webp)$/i.test(f.file||'')||
    f.ids?.en!==family.en.id||f.ids?.hu!==family.hu.id||f.ids?.he!==family.he.id||
    f.current?.en!==f.imageId){
   errors.push('UNVERIFIED_FAMILY_OR_IMAGE:'+family.family);continue;
  }
  const item=mediaById.get(f.imageId);
  const url=String(item?.source_url??'').match(/^https:\/\/ezraidereu\.com\/budapest\/wp-content\/uploads\/(?:\d{4}\/\d{2}\/)?([^\/?#]+)$/i);
  if(!item||!url||url[1]!==f.file||
     item.mime_type!=='image/jpeg'||
     !Number.isFinite(item.media_details?.width)||item.media_details.width<640||
     !Number.isFinite(item.media_details?.height)||item.media_details.height<480)
   errors.push('MISSING_OR_UNVERIFIED_MEDIA_ASSET:'+f.imageId);
  for(const lang of langs){
   const id=family[lang].id,old=f.current[lang],actual=byId.get(id);
   expectedIds.add(id);
   if(!Number.isSafeInteger(old)||old<0||(lang!=='en'&&old!==0&&old!==f.imageId))
    errors.push('INVALID_OLD_MEDIA:'+id);
   if(!actual||actual.status!=='publish'||actual.featured_media!==old)
    errors.push('DRIFT_OR_UNPUBLISHED:'+id);
   if(lang!=='en'&&old===0)changes.push({family:family.family,language:lang,postId:id,from:0,toMediaId:f.imageId});
  }
 }
 if(sources.size!==7||byId.size!==21||[...byId.keys()].some(id=>!expectedIds.has(id))||mediaById.size!==7||[...mediaById.keys()].some(id=>![...sources.values()].some(f=>f.imageId===id)))
  errors.push('UNEXPECTED_POST_OR_FAMILY');
 if(changes.length!==13)errors.push('EXPECTED_13_PROPOSALS');
 return {status:errors.length?'blocked-source-reconciliation':'candidate-only',
  errors:[...new Set(errors)],proposedChanges:errors.length?[]:changes,
  preserveEnglish:true,preserveHungarianOffroad:byId.get(263)?.featured_media===424,
  independentMediaMetadataPresent:mediaById.size===7,
  missingAltTextMediaIds:[...mediaById.values()].filter(x=>!String(x.alt_text??'').trim()).map(x=>x.id).sort((a,b)=>a-b),
  localizedAltTextReviewed:false,imageBytesVerified:false,
  restoreTested:false,liveBrowserVerified:false,ownerReleaseApproved:false,mayApplyAutomatically:false};
}
function selfTest(){
 const snapshot=originalSnapshot(),good=auditImageReuse(snapshot,evidence,contract,mediaEvidence);
 assert.equal(good.status,'candidate-only',JSON.stringify(good.errors));
 assert.deepEqual(good.proposedChanges.map(x=>x.postId).sort((a,b)=>a-b),
  [256,258,259,260,261,262,271,272,273,274,275,276,277]);
 assert.equal(good.preserveHungarianOffroad,true);
 assert.equal(good.mayApplyAutomatically,false);
 assert.deepEqual(good.missingAltTextMediaIds,[424,427,428,429,433]);
 const change=(id,d)=>snapshot.map(x=>x.id===id?{...x,...d}:x);
 const altered=[
  change(256,{featured_media:431}),change(272,{status:'draft'}),
  change(38,{featured_media:430}),change(263,{featured_media:270}),
  snapshot.slice(1),[...snapshot.slice(1),snapshot[1]],change(277,{id:999})
 ];
 for(const [index,item] of altered.entries()){
  const result=auditImageReuse(item,evidence,contract,mediaEvidence);
  assert.equal(result.status,'blocked-source-reconciliation','drift '+index);
  assert.equal(result.proposedChanges.length,0);
  assert.equal(result.mayApplyAutomatically,false);
 }
 const withChange=structuredClone(evidence);withChange[0].imageId=430;
 assert.equal(auditImageReuse(snapshot,withChange,contract,mediaEvidence).status,'blocked-source-reconciliation');
 const withSwap=structuredClone(evidence);withSwap[0].ids.hu=258;
 assert.equal(auditImageReuse(snapshot,withSwap,contract,mediaEvidence).status,'blocked-source-reconciliation');
 const withFamily=structuredClone(evidence);withFamily[0].family='unexpected';
 assert.equal(auditImageReuse(snapshot,withFamily,contract,mediaEvidence).status,'blocked-source-reconciliation');
 assert.equal(auditImageReuse(snapshot,evidence.slice(1),contract,mediaEvidence).status,'blocked-source-reconciliation');
 const withContract=structuredClone(contract);withContract.families[0].he.id=999;
 assert.equal(auditImageReuse(snapshot,evidence,withContract,mediaEvidence).status,'blocked-source-reconciliation');
 const mediaDrift=(id,delta)=>mediaEvidence.map(x=>x.id===id?{...x,...delta}:x);
 const mediaMutations=[
  mediaDrift(431,{mime_type:'application/javascript'}),
  mediaDrift(433,{source_url:'https://attacker.example/budapest/wp-content/uploads/2021/09/7474.jpg'}),
  mediaDrift(430,{source_url:'https://ezraidereu.com/budapest/wp-content/uploads/2021/09/other.jpg'}),
  mediaDrift(429,{media_details:{width:320,height:180}}),
  mediaEvidence.slice(1),
  [...mediaEvidence.slice(1),mediaEvidence[1]],
  mediaDrift(424,{id:999})
 ];
 for(const [index,variant] of mediaMutations.entries()){
  const report=auditImageReuse(snapshot,evidence,contract,variant);
  assert.equal(report.status,'blocked-source-reconciliation','media drift '+index);
  assert.equal(report.proposedChanges.length,0);
  assert.equal(report.mayApplyAutomatically,false);
 }
 assert.equal(auditImageReuse(snapshot).status,'blocked-source-reconciliation','missing independent media snapshot');
 console.log('PASS: 21 isolated checks; 13 review-only localized featured-image reuse candidates');
}
if(process.argv.includes('--self-test'))selfTest();
else if(process.argv.includes('--baseline'))console.log(JSON.stringify(auditImageReuse(originalSnapshot(),evidence,contract,mediaEvidence),null,2));
else if(process.argv.includes('--snapshot')){
 const i=process.argv.indexOf('--snapshot'),file=process.argv[i+1];
 if(!file||file.startsWith('--'))throw Error('Supply a private sanitized snapshot');
 const result=auditImageReuse(JSON.parse(readFileSync(file,'utf8')));
 console.log(JSON.stringify(result,null,2));
 if(result.status!=='candidate-only')process.exitCode=2;
}else{console.error('Use --self-test, --baseline, or --snapshot /private/meta.json');process.exitCode=2;}
