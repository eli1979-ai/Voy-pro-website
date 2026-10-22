import fs from 'node:fs';
import assert from 'node:assert/strict';

const draft=JSON.parse(fs.readFileSync('docs/budapest-review-20-staging.json','utf8'));
const audit=JSON.parse(fs.readFileSync('docs/budapest-review-20-candidates.json','utf8'));
const publicList=JSON.parse(fs.readFileSync('site/assets/budapest-approved-reviews.json','utf8'));
const languages=['en','he','hu'];
assert.equal(draft.status,'draft_unpublished','Translation drafts must never auto-publish');
assert.equal(draft.reviews?.length,20,'Require the complete selected 20-review set');
assert.equal(audit.candidates?.length,20);
assert.equal(publicList.status,'awaiting_verified_approval');
assert.equal(publicList.reviews?.length,0,'Public review manifest must remain intentionally empty');

const counts={tripadvisor:0,google:0,getyourguide:0};
for(let i=0;i<draft.reviews.length;i++){
  const review=draft.reviews[i],source=audit.candidates[i];
  assert.equal(review.id,source.id);
  assert.equal(review.author,source.reviewer);
  assert.equal(review.source,source.platform);
  assert.equal(review.translations_approved,false,'Translations cannot be treated as editorially approved');
  assert.equal(review.translation_review_status,'draft_pending_editorial_review');
  assert.equal(review.full_text,source.source_evidence?.operator_original_text_evidence?.original_text,
    'The original must match the source evidence exactly: '+review.id);
  assert.equal(review.language,source.source_evidence?.operator_original_text_evidence?.source_text_language,
    'Original source language mismatch: '+review.id);
  assert.equal(review.rating,5,'All shortlisted reviews show 5 stars in their original sources');
  assert.equal(review.source_verified,true);
  assert.equal(review.review_url,source.platform==='tripadvisor'
    ?source.source_evidence?.direct_review_url
    :(source.source_evidence?.platform_product_review_listing||source.source_evidence?.evidence_url||source.source_profile_url),
    'The truthful original-source link must not change: '+review.id);
  assert.deepEqual(Object.keys(review.translations).sort(),[...languages].sort(),
    'Every full translation is required: '+review.id);
  for(const locale of languages){
    const translation=review.translations[locale];
    assert.equal(typeof translation,'string');
    assert(translation.trim().length>=35,'Short/empty translation: '+review.id+' '+locale);
    assert(translation.trim().length>=review.full_text.trim().length*0.30,
      'Suspiciously short translation, needs complete-text review: '+review.id+' '+locale);
    if(locale===review.language)assert.equal(translation,review.full_text,
      'Original language must be preserved verbatim: '+review.id);
  }
  if(review.source==='tripadvisor'){
    assert.equal(review.approved,false,'Tripadvisor screenshot draft must not be approved before proofread');
    assert.equal(review.full_text_verified,false,'A transcription is not final source verification');
    assert.equal(source.source_evidence?.operator_original_text_evidence?.line_by_line_proofread_complete,false);
    assert.equal(review.date,source.review_date,'Retain screenshot-displayed date');
  }else{
    assert.equal(review.approved,true);
    assert.equal(review.full_text_verified,true);
  }
  assert(Object.hasOwn(counts,review.source));
  counts[review.source]++;
}
assert.deepEqual(counts,{tripadvisor:10,google:7,getyourguide:3});
console.log('Budapest review translation-draft QA OK: 20 source-matched originals, 60 full EN/HE/HU texts, all unpublished and awaiting editorial approval.');
