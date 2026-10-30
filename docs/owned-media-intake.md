# VOY PRO owned-photo and tour-video intake

**Review date:** 2026-10-30. **Related:** #727. **Status:** candidate review only — **nothing approved for public publication**.

## Source and audit scope

The owner has supplied a shared Drive collection named `Media for Website Voy PRO` with two destination folders; future uploads are expected. The source folder and individual asset IDs/URLs deliberately **do not appear in this public repository**, because the set includes recognizable guests, children and future unpublished content. Authorized staff should use their existing Drive access to find filenames below, not paste source share links into source code.

| Folder | Total files | JPEG photos | MP4 videos |
| --- | ---: | ---: | ---: |
| Budapest | 65 | 64 | 1 |
| Marvão | 47 | 45 | 2 |
| **Total** | **112** | **109** | **3** |

The 13 photos below were **visually inspected** (not just classified from filenames). Each video was inspected from multiple frames across its duration using original stored file bytes and FFprobe. Remaining photos were inventoried by filename, MIME type and file size but not individually visually graded. Do not describe the *whole* folder as reviewed or any photo as definitely depicting an itinerary based on GPS/time alone.

## Photo short list: candidate, not approved

| Source filename | Observed content | Candidate surface | Status and outstanding verification |
| --- | --- | --- | --- |
| Budapest/`20260829_112020.jpg` | EZRaider with riders in front of the Budapest Parliament building; vertical, substantial architectural background | Budapest landmark editorial area or supporting tour image, **not** generic hero | **Candidate.** Confirm relevant tour really visits/passes this location; guest publication rights and crop |
| Budapest/`20260829_102423.jpg` | Several helmeted EZRaider riders on a green, shaded park path; portrait | Margaret Island supporting image | **Candidate — location not confirmed** by picture alone; check exact ride/route |
| Budapest/`20260829_103941.jpg` | Two riders on a broad landscaped park path; lots of sky; landscape | Margaret Island/park gallery | **Candidate — location unverified**, needs stronger crop/contrast; not a hero replacement yet |
| Budapest/`20261018_161634.jpg` | Wide Danube/city panorama taken from an elevated stone overlook; portrait, no riders | Budapest scenic secondary image | **Candidate — precise viewpoint unverified**; prefer existing action-oriented hero for bookings |
| Budapest/`20250920_121200.jpg` | Group of EZRaiders parked before an ornate historic facade in bright daytime; landscape | Fleet/group/landmark supporting editorial | **Candidate — architectural place and tour membership unverified** |
| Budapest/`20250416_142036.jpg` | EZRaider lineup against a Gothic-style building; portrait | Operations/group gallery | **Candidate**, but people/route and intended date must be verified |
| Budapest/`20261018_132210.jpg` | Long guided group visible on a city shopping street; landscape, foreground scooter and pedestrians | Budapest group/corporate editorial | **Candidate**, busy foreground makes it less suited as lead hero |
| Budapest/`20260827_131957.jpg` | Adult operating EZRaider with a child passenger; portrait street shot | Budapest with Kids / family guide | **HOLD — recognizable child; written parental/publication permission and equipment/rider-policy review** |
| Budapest/`20260805_201841.jpg` | Parked row of fleet units along a city roadside in muted evening light; portrait | Back-office/fleet rather than sales hero | **Low priority**; limited experience/atmosphere |
| Marvão/`20250313_125650.jpg` | Five EZRaiders lined up at a green, wooded streamside location; landscape | Marvão supporting photo/gallery | **Strong candidate**; optimize exposure/contrast and confirm on-route location |
| Marvão/`20250313_130402.jpg` | Close, well-framed view of EZRaider fleet at the same streamside setting; landscape | Marvão fleet/gallery image | **Strong candidate**, not headline hero since no riders in motion |
| Marvão/`20250313_121458.jpg` | Group of riders and an orange-vested staff member on outdoor path; portrait | Marvão safety/experience explanatory card | **Candidate**, confirm staff identification and publicity consent |
| Marvão/`20250313_112220.jpg` | Close-up rider and other guests during roadside activity; landscape | Maybe operational information | **Hold for guest consent**; not a stronger cover than active riding image |

**Do not replace heroes blindly.** Existing source assets: `site/assets/images/budapest/` includes `img12.jpg`, `img14.jpg`, selected `IMG-20261006-WA00*.jpg` (Citadella) and family photos; `site/assets/images/portugal/marvao-01.jpg` through `marvao-04.jpg` are already used on the Marvão landing. Preserve current routes/copies and image credits until an explicit side-by-side crop and quality comparison is documented.

## Video clips — actually inspected, route-specific decision

| Original file | Duration / original size | Frames show | Editorial decision |
| --- | --- | --- | --- |
| Budapest/`20260829_110902.mp4` | 51.21 seconds; 66.86 MB | Portrait-view city/treelined road ride with an adult and two children on an EZRaider | **HOLD**: identifiable minors, explicit permission/safety review, and no proven one-to-one tour identification; do not use as blanket Budapest tour clip |
| Marvão/`20250313_121101.mp4` | 24.60 seconds; 37.99 MB | Portrait-view riders traveling on a broad unpaved rural road | **Secondary candidate** for countryside/off-road experience; slow action, fewer changing viewpoints |
| Marvão/`20250313_125407.mp4` | 60.67 seconds; 93.39 MB | Portrait-view riders on a leafy narrow hillside trail in natural scenery | **Preferred pilot candidate** for a **verified Marvão countryside/off-road itinerary only**, **not** proof of the historic village/castle itinerary |

Original videos are high-bitrate HEVC and must **not** be copied directly into a customer page; phone video metadata/rotation must be respected. A **nonpublished working preview** was prepared from 21 seconds of the Marvão woodland source as muted/silent H.264, 720×1280, ~4.65 MB, with a separate still poster. It remains outside this repository. No viewer tracking, audio claims or face consent is implied.

## Where the video module could go

- **Budapest:** the five tour details exist in EN/HE/HU, and a route-specific clip should be attached only to the one tour it actually documents. Put an accessible `<video controls preload="none" playsinline poster="...">` section near the end of each **eligible** tour page, but **before** the footer; do not cover the floating WhatsApp/booking controls. Use translated video heading/caption and a non-media fallback. Only enable on pages with an independently verified route-to-clip mapping.
- **Marvão:** the current site has EN/HE/PT **destination landing pages** instead of a dedicated 1:1 detail page for each of its three experiences. A woodland video may first fit the nature/off-road explanatory area of the destination landing, explicitly labeled as sample footage, or wait for a specific longer-tour page. Do not present it as footage from the compact village/castle tour.
- **Privacy/performance:** no autoplay; no streaming/player requests before user action; keyboard controls and a responsive portrait frame; video bytes served via approved first-party optimized static asset or vetted host, **not** Google Drive preview hotlinks. Record the actual video poster, size, encoding, caption/transcript policy, relevant consent, and mobile performance result.
- **Deployment:** separate, atomic PR for one destination first. Validate `npm run build`, `npm run verify:launch`, `npm run qa:site`, real Chrome 320/390/desktop and accessibility. No new provider secrets, payments, public-domain redirects, network permissions or isolated Production changes.

## Repeatable intake for later uploads

1. Keep Drive as **unpublished source of truth**. Record stable source ID privately (not in this public repo), capture date, branch, optional itinerary and owner; deduplicate by SHA-256 and preserve the untouched original.
2. For each image extract orientation, width/height, sharpness, exposure and crop fit. Review actual pixels at mobile and desktop aspect ratios; avoid false location/route claims.
3. For each video record codec, duration, rotation and sound; review a 7-frame strip and actual playback; confirm route, safety, identifiable people and minors before publication.
4. Gate fields **rights_to_publish = verified**, **people_consent = verified/not_applicable**, **child_consent = verified/not_applicable**, **route_identity = verified**. Unknown fails closed. If location irrelevant to a branch, do not auto-assign based only on folder.
5. Once approved, make WebP/AVIF or optimized JPEG derivatives, use descriptive versioned filenames, preserve informative alt text, commit only reviewed derivatives, and log old and new source/crop in the per-page PR.
6. Run all source/Chrome QA and compare imagery/performance against live versions. Owner approval for the exact PR merge; do not create routine Vercel Preview for every raw photo intake.
7. Weekly scan can **propose** new candidates as Drive receives additional files, but must never automatically publish media, identify guests or silently replace approved tour imagery.

## Important access observation

At the time of intake, Google Drive reported the **source parent folder** has an `anyone: reader` permission with discovery disabled. This does not prove every descendant has identical effective permissions, but the public-with-link setting can expose the folder and newly added media to people possessing its URL. Consider a **restricted unpublished intake folder** plus a separately reviewed public-derivatives location. **No permissions were changed by this review.**

## Boundaries

This is an editorial/media assessment, not publication consent, route attestation, GDPR clearance, booking/FBM change, or Production approval. This document intentionally omits raw Drive links/IDs and images of guests from the public repository.
