# Budapest review ribbon: page-language translations and original-source links

## Approved presentation policy (22 October 2026)

- On English, Hebrew and Hungarian Budapest pages, each of the **twenty selected full reviews** is rendered entirely in that page's language.
- Preserve `full_text` as the verified, unedited original in the reviewer’s actual source language (`language`).
- Add a separate `translations` object with **complete** `en`, `he`, `hu` strings. Where the source language is one of these three, that entry must be byte-for-byte identical to `full_text`.
- Set `translations_approved: true` **only after editorial verification** of all three localized full texts. This flag does not replace `source_verified`, `full_text_verified`, `approved` or authorization to republish originals.
- Add a small language-appropriate **"Translated from the original"** disclosure when the page language differs from the verified source language. Translate neither the reviewer name nor the factual five-star rating.
- The outbound link must go to the `review_url` recorded for the exact reviewer. For Tripadvisor, use the individual original `ShowUserReviews` URL. For Google/GetYourGuide where only an official listing is available, keep `link_kind: "listing"` and clearly label the link as a review listing, **never** claim it is an individual review.
- Show the exact verified publication date in the visitor’s date format. If contradictory source dates cannot be reconciled, keep `date: null` and omit it. Do not substitute a visit month for the review publication date.
- Use text nodes and existing source host allowlists. No HTML from the review body is interpreted as markup.

## Publication gate

`docs/budapest-review-20-staging.json` retains the verified originals and approved translations; `docs/budapest-review-20-candidates.json` retains the source audit. The publisher `scripts/prepare-budapest-review-manifest.mjs` refuses publication unless **all twenty** reviews have complete source-verified originals, documented metadata, `translations_approved: true`, complete EN/HE/HU texts, and `status: "ready_for_publication"`. Missing translations must not silently fall back to an untranslated body.

The public `site/assets/budapest-approved-reviews.json` remains empty and the ribbon remains hidden until source reconciliation and approval. A preview and owner-approved merge are separate from a public Production/DNS/payment cutover.

## Follow-up for the source screenshots

The owner supplied screenshots for all ten shortlisted Tripadvisor reviews (Katie M, Stav G, lihi F, אביעד כ, Shoshi R, Explore27235187907, ענת ל, אורטל פ, Sightsee44633083977, Flyer45428477043). Reconcile each `full_text` and date against those images and the official source, preserve punctuation and paragraph breaks, then commission and editorially review EN/HE/HU translations. Beware reviews whose original appears in Hebrew on a UK/Irish Tripadvisor domain and three previously conflicting regional dates. Do not declare screenshot transcription verified until every line is visually matched.
