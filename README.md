# VOY PRO Website

Staging deployment repository for the VOY PRO website.

Current staged release: **v1.32.5**.

v1.32.5 hardens the Budapest booking selector:
- Buda and Margaret are present in the HTML immediately, so the tour selector is usable even before the live catalog responds.
- The live API request now has a timeout instead of leaving customers on “Loading tours…” indefinitely.
- If the catalog request fails or is slow, the booking form keeps the known Budapest tour choices and checks live availability when the customer searches.
- A later live catalog response preserves the customer’s current tour selection.
- The v1.32.4 brand/location lockup and full-photo presentation remain active.

Production booking is not enabled by this staging repository.
