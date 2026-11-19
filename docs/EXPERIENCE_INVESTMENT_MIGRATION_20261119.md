# Experience Investment: Michigan Bird Migration departure board

**Mode:** IMPLEMENT. **Owner:** `izworskic/michigan-birding-report`. **Canonical:** https://michiganbirdingreport.com/migration. **Date:** 2026-11-19.

## Visitor job and baseline
A birder deciding where to go tomorrow morning wants to choose a credible *kind of habitat*, see Michigan places that fit it, then check current weather, reports, radar and park access before starting the drive.

Before this change, the page had an NWS/eBird regional pulse, a separate BirdCast radar link, three instructional boxes, a 380px map and six rich field-stop cards. All six remained equally prominent regardless of the birder's interest. The tutorial preceded the actual list of places. Leaflet CDN failure prevented the remainder of the inline script from rendering. These are source-inspected findings; mobile and desktop screenshots are **NOT CAPTURED**.

The BirdCast radar dashboard is the source for actual nocturnal flight, not our weather-derived screening; Cornell says its live feed operates during March 1-June 15 and August 1-November 15: https://birdcast.org/migration-tools/migration-dashboard/. eBird provides county-level reported sightings, not a promise that a species remains at a stop. Nearby comparison: BirdCast's dashboard focuses on airborne flight intensity, whereas this page must finish a field-stop visitor task. Two closest internal tools compared: Michigan Birding Report's species/county records (bird identity and reports) and Michigan Bloom Tracker (date/place selection).

## Three opportunities investigated
1. **Habitat-led decision**: choosing waterbirds, songbirds or raptors changes the *list of appropriate regional field stops*, without changing live flight evidence. Uses existing region geography and official visitor links; small code cost and low source risk.
2. **Fail-closed map**: if Leaflet/tiles cannot load, keep a practical source-linked list instead of a blank large map. Reuses existing card links; small cost, important mobile risk reduction.
3. **Exact arrival routes**: stronger verified park entrances and route-mile details could support turn-by-turn plans, but access provenance, closure dates and parking permission remain incomplete, so do not invent them.

## Two credible experience concepts
- **A. Geographic field atlas:** map-first, grouped habitat pins, one selected-place photo and evidence. On a 390px phone the map takes over the first screen. Clicking a pin selects a dossier; without tiles the browser must fall back to a list. Credible but expensive to make robust, and depends on the same third-party tiles that can fail.
- **B. Habitat departure board (selected):** weather pulse stays near the top, then a small native-button question: *What do you want to watch for?* Choices filter the six real corridors and the markers together; a count and habitat interpretation change immediately. A direct link jumps to source-backed field notes. Desktop presents a broad editorial band followed by geographic context. Mobile stacks the short chooser above the map/list. If evidence fails, it explicitly withholds the current recommendation.

Choice B solves a visitor task without a score, invented bird species, travel-time estimate or new library. It has two function-led distinctions from Snow Totals (which ranks measured inches) and Bloom Tracker (which selects typical months): this interaction filters habitat geography rather than numbers or months, and its next step is radar/eBird/operator verification rather than a season calendar.

## Source truth, actions and state matrix
**Input**: habitat lens, one of all/water/songbird/raptor. **Stable ID**: six existing region IDs from `lib/migration.js`. **Output**: list of regions matching source-authored regional habitat characteristics, marker visibility, count, habitat description and existing official/Google Maps/county actions.

- all -> water -> all: restores six regions, not a reordered ranking.
- water -> raptor -> water: switches five to three to five region choices; no change to observed count, bird presence, flight verdict, weather issue date or BirdCast evidence.
- map library missing: collapse map, keep honest field-stop cards, BirdCast and official links.
- map tiles consistently fail: collapse map without hiding the list.
- no JavaScript: static BirdCast and six official visitor resources, explicitly not live regional verdicts.
- missing API: show live decision unavailable and link to BirdCast. Selection never fabricates observation.
- keyboard: native buttons with aria-pressed, focus styles, accessible field-note link; reduced-motion scroll avoids forced animation.
- photo fails: the place title, arrival and official links remain textual.
- no new geolocation, exact parking coordinate, third-party API, function, dependency, Redis or extra Vercel runtime.

**Visual grammar:** one field-departure band and six evidence dossiers, not a general-purpose card dashboard. First-screen target is a compact pulse and a usable habitat shortcut with less explanation above the decision; visual screenshot verification is still outstanding.

## Verification and release boundaries
Targeted tests: `node scripts/test-migration-habitat-deck.js` and full `npm test`. Verify no source/SEO/ad changes beyond an additive API metadata array. Compare actual screenshots at 360/390/768/1280/1440, map enabled/disabled, keyboard and no-JS after preview is reachable. Foundry's full improve/assess/prove CLI requires a complete local owning-repository checkout and reviewed before/after adapter; it was **NOT EXECUTED** in this connector session. These source-level A/B/A test outcomes do not certify browser appearance. No independently measured visitor completion, CTR or revenue claim. Keep PR open for owner review; no merge implied.
