# Budapest review ribbon: page-language translations and original-source links

## Approved presentation policy (22 October 2026)

- On English, Hebrew and Hungarian Budapest pages, each of the **twenty selected full reviews** is rendered entirely in that page's language.
- Preserve `full_text` as the verified, unedited original in the reviewer’s actual source language (`language`).
- Add a separate `translations` object with **complete** `en`, `he`, `hu` strings. Where the source language is one of these three, that entry must be byte-for-byte identical to `full_text`.
- Set `translations_approved: true` **only after explicit content-owner approval** of all three complete localized texts; independent native-speaker proofreading may be requested separately and must not be represented as completed unless actually performed. This flag does not replace `source_verified`, `full_text_verified`, `approved` or authorization to republish originals.
- Add a small language-appropriate **"Translated from the original"** disclosure when the page language differs from the verified source language. Translate neither the reviewer name nor the factual five-star rating.
- The outbound link must go to the `review_url` recorded for the exact reviewer. For Tripadvisor, use the individual original `ShowUserReviews` URL. For Google/GetYourGuide where only an official listing is available, keep `link_kind: "listing"` and clearly label the link as a review listing, **never** claim it is an individual review.
- Show the exact verified publication date in the visitor’s date format. If contradictory source dates cannot be reconciled, keep `date: null` and omit it. Do not substitute a visit month for the review publication date.
- Use text nodes and existing source host allowlists. No HTML from the review body is interpreted as markup.

## Publication gate

`docs/budapest-review-20-staging.json` retains the verified originals and approved translations; `docs/budapest-review-20-candidates.json` retains the source audit. The publisher `scripts/prepare-budapest-review-manifest.mjs` refuses publication unless **all twenty** reviews have complete source-verified originals, documented metadata, `translations_approved: true`, complete EN/HE/HU texts, and `status: "ready_for_publication"`. Missing translations must not silently fall back to an untranslated body.

The VOY PRO owner explicitly approved the 20 source-verified full reviews and EN/HE/HU copies for publication on 2026-10-22. `site/assets/budapest-approved-reviews.json` now contains exactly 20 approved reviews. The Budapest ribbon activates from this manifest without touching FBM Production, DNS, booking/payment behavior, or root-site indexing.

## Follow-up for the source screenshots

The owner supplied screenshots for all ten shortlisted Tripadvisor reviews (Katie M, Stav G, lihi F, אביעד כ, Shoshi R, Explore27235187907, ענת ל, אורטל פ, Sightsee44633083977, Flyer45428477043). The ten complete original text bodies, displayed ratings and dates were crosschecked against the owner-supplied Tripadvisor screenshots. Three conflicting regional dates were resolved using the direct screenshot dates. The owner's final authorization covers publication of the complete EN/HE/HU copies; no independent professional Hungarian-language certification is claimed. The original-language text and link provenance remain available for future corrections.
