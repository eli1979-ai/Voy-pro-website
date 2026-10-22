import fs from 'node:fs';
import assert from 'node:assert/strict';

const draft=JSON.parse(fs.readFileSync('docs/budapest-review-20-staging.json','utf8'));
const audit=JSON.parse(fs.readFileSync('docs/budapest-review-20-candidates.json','utf8'));
const publicList=JSON.parse(fs.readFileSync('site/assets/budapest-approved-reviews.json','utf8'));
const languages=['en','he','hu'];
assert.equal(draft.status,'ready_for_publication','Owner-approved review roster must be marked ready');
assert.equal(draft.reviews?.length,20,'Require the complete selected 20-review set');
assert.equal(audit.candidates?.length,20);
assert.equal(publicList.status,'approved','Visitor-facing reviews require explicit publication approval');
assert.equal(publicList.reviews?.length,20,'Public review manifest must contain all 20 approved reviews');
assert.equal(audit.owner_publication_approval?.status,'approved_by_owner');
assert.equal(audit.owner_publication_approval?.approved_on,'2026-10-22');

const counts={tripadvisor:0,google:0,getyourguide:0};
for(let i=0;i<draft.reviews.length;i++){
  const review=draft.reviews[i],source=audit.candidates[i];
  assert.equal(review.id,source.id);
  assert.equal(review.author,source.reviewer);
  assert.equal(review.source,source.platform);
  assert.equal(review.approved,true,'Every published review must be approved by owner');
  assert.equal(review.translations_approved,true,'Every published translation set must be approved by owner');
  assert.equal(review.translation_review_status,'owner_approved_for_publication_2026-10-22');
  assert.equal(review.content_approval?.approved_by,'VOY PRO owner');
  assert.equal(review.content_approval?.independent_native_language_editor_check,false,
    'Owner approval must not misrepresent unperformed independent language certification');
  const visible=publicList.reviews[i];
  assert(visible,'All approved reviews must be visible in the public manifest');
  assert.equal(visible.id,review.id);
  assert.equal(visible.full_text,review.full_text);
  assert.equal(visible.review_url,review.review_url);
  assert.equal(visible.date,review.date);
  assert.equal(visible.rating,review.rating);
  assert.equal(visible.approved,true);
  assert.equal(visible.translations_approved,true);
  assert.deepEqual(visible.translations,review.translations);
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
    assert.equal(review.approved,true,'Tripadvisor original must be approved before publication');
    assert.equal(review.full_text_verified,true,'Tripadvisor source transcription must have passed original-page visual crosscheck');
    assert.equal(source.source_evidence?.operator_original_text_evidence?.line_by_line_proofread_complete,true);
    assert.equal(review.date,source.review_date,'Retain screenshot-displayed date');
    const evidence=source.source_evidence;
    assert.equal(typeof evidence?.source_review_title,'string','Screenshot review title must be recorded');
    assert(evidence.source_review_title.trim().length>=5,'Source title must not be empty');
    assert(Array.isArray(evidence.owner_screenshot_files)&&evidence.owner_screenshot_files.length>=1,
      'Proofread record must reference user-supplied screenshot files');
    assert(evidence.owner_screenshot_files.every(path=>/^10005128[0-9]{2}[.]jpg$/.test(path)),
      'Source evidence must point to original supplied screenshot filename');
    assert.equal(evidence.visual_review?.reviewer_checked,true);
    assert.equal(evidence.visual_review?.published_day_checked,true);
    assert.equal(evidence.visual_review?.five_star_rating_checked,true);
    assert.equal(evidence.visual_review?.body_checked_against_attached_screenshots,true);
    assert.equal(review.source_review_status,'source_verified_owner_approved');
    assert.equal(evidence.original_text_transcription_status,'assistant_visually_crosschecked_owner_approved_2026-10-22');
    assert.equal(evidence.publication_status,'owner_rights_confirmed_verbatim_original_recovered');
    assert.equal(evidence.visual_review?.publisher_signoff,true,
      'Publishing requires owner approval of the source crosscheck');
    assert.equal(evidence.visual_review?.publisher_signoff_by,'VOY PRO owner');

  }else{
    assert.equal(review.approved,true);
    assert.equal(review.full_text_verified,true);
  }
  assert(Object.hasOwn(counts,review.source));
  counts[review.source]++;
}
assert.deepEqual(counts,{tripadvisor:10,google:7,getyourguide:3});
assert.equal(audit.source_audit.original_full_texts_cleared_for_republication,20);
console.log('Budapest approved-review QA OK: 20 source-matched originals and 60 owner-approved EN/HE/HU versions published with unchanged provider links.');
