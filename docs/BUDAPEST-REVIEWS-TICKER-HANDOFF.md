# Budapest full-review carousel: editorial handoff

## Status
The customer requested 20 **authentic, full-length** review quotes below the Google,
Tripadvisor and GetYourGuide rating strip. The earlier review-curation conversation
yielded a set of 20 **candidate reviewer identities**, but no retrievable approved
original-language full review text, original per-review URLs or documented permission
to republish all 20 texts. These candidates are not publishable testimonials yet.

The website file `site/assets/budapest-approved-reviews.json` therefore remains empty
and `publication_status` is `awaiting_verified_full_text`. All three languages
fail closed: no fabricated review cards appear.

## Candidate identities recorded from the curation conversation

| # | Platform | Reviewer as previously listed |
| - | - | - |
| 1 | Tripadvisor | Katie M |
| 2 | Tripadvisor | Stav G |
| 3 | Tripadvisor | lihi F |
| 4 | Tripadvisor | אביעד כ |
| 5 | Tripadvisor | Shoshi R |
| 6 | Tripadvisor | Explore27235187907 |
| 7 | Tripadvisor | ענת ל |
| 8 | Tripadvisor | אורטל פ |
| 9 | Tripadvisor | Sightsee44633083977 |
| 10 | Tripadvisor | Flyer45428477043 |
| 11 | Google Maps | Mor M. |
| 12 | Google Maps | Nir I. |
| 13 | Google Maps | Anne H. |
| 14 | Google Maps | Mike van de W. |
| 15 | Google Maps | Slavik G. |
| 16 | Google Maps | Yair G. |
| 17 | Google Maps | Inbal Y. |
| 18 | GetYourGuide | Cornelia |
| 19 | GetYourGuide | Keren Emili |
| 20 | GetYourGuide | Yariv |

These names are curation leads, **not evidence that any particular full quote
or source URL has been authenticated**. Do not convert Hebrew summaries into
original quotations. Do not publish until the user-supplied original texts have been
reconciled to the correct platform and author.

## Exact publication format

To activate the prebuilt ticker, replace `reviews: []` in the JSON with **exactly
20** reviewed items, keeping the approved order, and change
`publication_status` to `approved` after rights/source verification:

```json
{
  "schema_version": 1,
  "publication_status": "approved",
  "reviews": [
    {
      "platform": "google",
      "reviewer": "Actual reviewer display name",
      "date": "2026-10-01",
      "rating": 5,
      "review_url": "https://www.google.com/maps/reviews/...",
      "text": "Exact complete original review text, with original punctuation."
    }
  ]
}
```

The example is a **schema illustration only**, not a real review.
Platform identifiers: `google`, `tripadvisor`, `getyourguide`.
Use a real clickable public original review URL, not a made-up link.

The component safely uses `textContent` for full text, retains paragraphs/newlines,
shows author, five stars, source, date and original link, and never clips or
summarizes the review. Autoplay pauses on hover/focus, stops for reduced-motion,
and users can navigate manually or swipe on mobile. The entire component stays
invisible if records are missing, malformed or not explicitly approved.

## Publication checklist
- Confirm the full unedited original text and reviewer identity on its actual source.
- Confirm platform, date, five-star rating, and a functioning review/source link.
- Confirm permission/terms to reproduce the complete reviews in-site.
- Preserve the reviewer’s language; do not silently rewrite translations as originals.
- Populate all 20 source records as a **single reviewed atomic change**, with
  `publication_status: approved` set last.
- Run `npm run build`, `npm run verify:launch`, `npm run qa:site`.
- Manually test desktop, RTL Hebrew and Hungarian, reduced motion and mobile swipe.

No backend/FBM or production data is involved in this website-only module.
