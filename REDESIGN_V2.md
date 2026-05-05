# MICHIGAN BIRDING REPORT: FINAL REDESIGN

## The Birder Test

A birder opens this site on their phone at 6am before heading out.
They need exactly 3 things in under 5 seconds:

1. WHERE are birds being seen? (MAP)
2. WHAT is being seen? (SPECIES with photos)
3. Should I GO today? (CONDITIONS)

Everything else is secondary. If the first screen doesn't answer #1, the site fails.

## Usability Scoring Matrix

| Dimension | Weight | Question |
|-----------|--------|----------|
| Map-first | 3x | Is a map with real sightings the FIRST thing you see? |
| Data honesty | 2x | Does every number have context (what, when, where)? |
| Tap depth | 2x | Can I get species detail in 1 tap from any screen? |
| Actionable | 2x | Does it tell me WHERE to go and WHAT to look for? |
| Fresh signal | 1x | Can I tell this data is from today, not last month? |

Score: 0-5 per dimension, weighted, max 50.

## Current Scores

| Page | Map-first (3x) | Data honest (2x) | Tap depth (2x) | Actionable (2x) | Fresh (1x) | TOTAL |
|------|------|------|------|------|------|-------|
| Homepage | 2 (map exists but below fold, KPIs block it) | 1 ("80 species" is noise) | 3 (cards link to profiles) | 1 (no "go here today") | 3 (dates shown) | **22/50** |
| Saginaw Bay | 1 (map has pins but NO bird sightings) | 1 (species dump, no grouping) | 3 (species link to profiles) | 2 (hotspot descriptions) | 3 | **20/50** |
| Species | 4 (sighting map exists) | 4 (good context) | 4 (self-contained) | 4 (where to find) | 3 | **39/50** |
| Predictions | 0 (no map at all) | 4 (AI gives context) | 2 (no links from answers) | 5 (specific recommendations) | 5 (live weather) | **30/50** |

## Root Cause Analysis

### Problem 1: Bay "80 species" KPI
WHY it keeps appearing: The /api/hotspot endpoint returns speciesCount=80 and the homepage
displays it as a KPI. It has appeared in EVERY version of the homepage.
FIX: Remove the Bay KPI from the homepage entirely. The Bay is a secondary page.
The homepage should only show data from the notable sightings API.

### Problem 2: Bay sightings not mapped  
WHY: /api/hotspot uses eBird's species list endpoint which returns NO coordinates.
FIX: Create /api/bay-sightings that calls eBird's recent observations endpoint
for the 7 Bay counties. This returns lat/lng per observation. Plot THOSE on the Bay map.

### Problem 3: Homepage map feels disconnected
WHY: KPIs sit above the map. User sees numbers before seeing data.
FIX: Conditions strip → MAP → Feed. No KPIs. The map IS the data.

## Redesign Spec

### Homepage

```
[Fixed nav: MBR | 🔍 Search bird | Bay | Predictions | Migration]

[Thin conditions strip: 68° SW 12mph · Migration favorable tonight]

[FULL-WIDTH LEAFLET MAP: 50vh height]
[  Every green dot = a notable sighting this week from eBird     ]
[  Tap dot → popup: species name, location, date, "View profile →"]

[Filter pills: All MI | UP | Northern Lower | Southern Lower]

[Notable Sightings Feed]
[Photo | Wood Thrush          | Whitmore Lake    | Yesterday  ]
[Photo | Snow Goose           | Lake Isabella    | 3 days ago ]
[Photo | Brewer's Blackbird   | Buffalo Rd       | 4 days ago ]
[... all notable, same data as map dots ...]

[--- Quick Links: Saginaw Bay Hub · Ask About Any Bird · Migration ---]
[--- Gear · Footer with county links ---]
```

Rules:
- ZERO KPIs. No numbers without a bird next to them.
- Map is the hero. 50vh minimum on mobile.
- Every map dot matches a feed card. Same API call. Same data.
- Filter changes both map and feed.

### Saginaw Bay

```
[Nav]
[Hero: "Saginaw Bay Birding": one sentence, not a paragraph]
[Conditions: Bay County weather + wind + birding quality]

[MAP: 400px: TWO layers:]
[  Layer 1: Green pins = 8 hotspot locations (static, labeled)]
[  Layer 2: Gold dots = actual bird observations with lat/lng  ]
[  Tap pin → hotspot name, species count, "View on eBird"      ]
[  Tap dot → species name, date, location                      ]

[Hotspot Leaderboard:]
[  1. Tawas Point: 52 species: top: Yellow-rumped Warbler, Hermit Thrush]
[  2. Tobico Marsh: 41 species: top: Great Egret, Sora]
[  3. Nayanquing Point: 38 species: top: Virginia Rail, American Bittern]
[  (ranked by species count, not alphabetical)]

[Full Species List: grouped:]
[  WATERFOWL (12): Mallard, Wood Duck, Blue-winged Teal...]
[  SHOREBIRDS (8): Killdeer, Greater Yellowlegs...]
[  RAPTORS (4): Bald Eagle, Red-tailed Hawk...]
[  SONGBIRDS (45): American Robin, Song Sparrow...]
```

### API Changes Required

1. NEW: /api/bay-sightings
   - Calls eBird recent observations for 7 Bay counties
   - Returns lat/lng per observation (for map dots)
   - Returns species grouped by taxonomic order
   - Cached 15min in Redis

2. MODIFY: /api/hotspot
   - Add totalObservations count
   - Add per-hotspot species counts (query each locId individually)

3. KEEP: /api/notable (working well, has lat/lng)

## Execution Order

1. Build /api/bay-sightings endpoint (data layer fix)
2. Rebuild homepage: delete KPIs, map-first, feed below
3. Rebuild Saginaw Bay: dual-layer map, hotspot leaderboard, grouped species
4. Test: every dot on map matches a card, every card links to profile
5. Deploy + purge Cloudflare

## Success Criteria

- Open homepage on phone → see map with bird dots in < 2 seconds
- Tap any dot → see species name + location + link to profile
- No number appears without "what" and "when" context
- Saginaw Bay map shows WHERE individual birds were seen, not just hotspot pins
- Every species on every page links to its profile in 1 tap
