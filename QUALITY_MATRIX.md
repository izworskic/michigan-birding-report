# Michigan Birding Report: Quality Scoring Matrix & Execution Plan

## The Birder's Core Questions (Value Function)

Every page must answer at least one of these. If it doesn't, it has no reason to exist.

1. **"What's happening right now?"**: Live sightings, conditions, migration activity
2. **"What can I see today, and where?"**: Species + locations + map
3. **"Tell me about this bird"**: ID, behavior, status, seasonal context
4. **"Where should I go birding?"**: Hotspot recommendations with data
5. **"What's coming next?"**: Migration forecast, seasonal preview

## Scoring Matrix (0-5 per dimension, 30 max per page)

| Dimension | Weight | Description |
|---|---|---|
| **Answers a question** | x1 | Does this page answer a specific birder question above? |
| **Has a map** | x1 | Can the user SEE where birds are? Maps are the #1 engagement driver. |
| **Fresh data** | x1 | Is there timestamped, live data that changes? Not static text. |
| **Actionable** | x1 | Does it tell the user what to DO? Go here, look for this, at this time. |
| **Linked depth** | x1 | Does it connect naturally to other pages (species, counties, hotspots)? |
| **SEO target** | x1 | Does it target a specific search query someone would actually Google? |

## Current State Audit

### Homepage (/)
- Answers question: 3/5: Shows notable birds but "80 Bay species" is context-free noise
- Has a map: 4/5: Statewide notable map works, but no Bay map
- Fresh data: 4/5: Notable feed is live, but KPIs feel disconnected
- Actionable: 2/5: Shows birds but doesn't say "go HERE today"
- Linked depth: 3/5: Cards link to species profiles
- SEO target: 4/5: Good title/meta for "Michigan birding"
- **TOTAL: 20/30**

### Saginaw Bay (/saginaw-bay)
- Answers question: 2/5: Lists species but no "so what" context
- Has a map: 0/5: **NO MAP. Critical failure.** 8 hotspots, no map.
- Fresh data: 3/5: Species list is live but feels like a dump
- Actionable: 2/5: Hotspot descriptions exist but no "go here because X"
- Linked depth: 3/5: Species link to profiles, hotspots link to eBird
- SEO target: 4/5: "Saginaw Bay birding" is a real query
- **TOTAL: 14/30** ← Worst page

### Species Profile (/species/{code})
- Answers question: 5/5: Directly answers "tell me about this bird"
- Has a map: 4/5: Sighting map with markers
- Fresh data: 4/5: Live eBird sightings + Haiku seasonal text
- Actionable: 4/5: "Where to find" + "look for" sections
- Linked depth: 3/5: Links back to home, audio, photos
- SEO target: 3/5: Species names are searched but URL structure could be cleaner
- **TOTAL: 23/30** ← Best page

### Predictions (/predictions)
- Answers question: 5/5: Directly answers "what can I see" + "ask about a bird"
- Has a map: 0/5: **No map at all**
- Fresh data: 5/5: Live weather + Haiku predictions
- Actionable: 5/5: Specific locations, species, timing
- Linked depth: 2/5: Doesn't link to species profiles from predictions
- SEO target: 3/5: "Michigan birding forecast" is a real query
- **TOTAL: 20/30**

### Migration (/migration)
- Answers question: 3/5: Timeline and links but no live data on page
- Has a map: 0/5: **Links to BirdCast but no embedded map**
- Fresh data: 2/5: Conditions badge is live, rest is static
- Actionable: 3/5: Tells you when but not specifically where today
- Linked depth: 4/5: Good BirdCast links + county links
- SEO target: 4/5: "Michigan bird migration" is a real query
- **TOTAL: 16/30**

### County Pages (/county/{fips})
- Answers question: 3/5: Shows species for a county
- Has a map: 4/5: Has a Leaflet map
- Fresh data: 4/5: Live eBird data
- Actionable: 2/5: Lists birds but doesn't recommend hotspots or timing
- Linked depth: 4/5: Cross-links to other counties + species
- SEO target: 5/5: "birding [county] county michigan" is perfect long-tail
- **TOTAL: 22/30**

## Gap Analysis (Priority Order)

### CRITICAL: Saginaw Bay needs a map (0/5 → 5/5)
The flagship destination page has 8 named hotspots and NO MAP. This is the single biggest failure.
Fix: Add Leaflet map with all 8 hotspots plotted, clickable markers with species counts.

### CRITICAL: KPIs must be contextual, not just numbers
"80 species" means nothing. "80 species across 7 counties in the past 14 days" is information.
"30 Notable" means nothing. "30 rare species spotted this week including 3 warblers" is information.
Fix: Make every KPI a complete sentence with context and recency.

### HIGH: Predictions page needs a map
When Haiku says "check Tawas Point" the user should SEE Tawas Point on a map.
Fix: Map the recommended locations from the forecast.

### HIGH: Saginaw Bay needs "why go today" intelligence
Not just a species dump. "South winds today are pushing shorebirds into the Bay. 
Nayanquing Point had 12 species reported yesterday including Great Egret and Virginia Rail."
Fix: Add weather context + highlight top hotspot of the day.

### MEDIUM: Homepage KPIs need rewrite
Replace meaningless numbers with contextual insights:
- "30 notable species this week" → "30 rare birds spotted this week, including [top 3]"
- "80 Bay species" → "Bay County: 80 species in 14 days" (link to /saginaw-bay)
- "Migration ACTIVE" → "Migration active: south winds tonight" (link to /migration)

### MEDIUM: Species profiles from predictions should link through
When "Ask about a bird" returns a result, the bird name should link to its full profile.

### MEDIUM: County pages need hotspot recommendations
Not just a species list. "Top hotspot: [name] with [X] species this week."

## Execution Order

1. Saginaw Bay page: Add Leaflet map with 8 hotspots + weather context + "today's pick" hotspot
2. Homepage KPIs: Rewrite as contextual sentences with links
3. Predictions: Add map for recommended locations, link bird answers to profiles
4. Migration: Embed a simple radar or map element
5. County pages: Add top hotspot recommendation
6. Cross-linking pass: Every bird answer links to profile, every location links to county

## SEO Keyword Targets (mapped to pages)

| Query | Monthly Volume | Page |
|---|---|---|
| michigan birding | ~2,400 | Homepage |
| bird watching michigan | ~1,900 | Homepage |
| saginaw bay birding | ~390 | /saginaw-bay |
| michigan bird migration | ~590 | /migration |
| birds in [county] county michigan | 83 variants | /county/{fips} |
| [species] michigan | hundreds of variants | /species/{code} |
| michigan birding forecast | ~210 | /predictions |
| tawas point birding | ~480 | /saginaw-bay |
| whitefish point birding | ~390 | /migration |
| kirtland's warbler michigan | ~720 | /species/kirwar |

## Success Metrics

- Every page scores 22+ on the matrix
- Zero pages without a map
- Every KPI links to its source data
- Every notable bird on homepage matches its species profile data
- Time on site > 3 minutes (engagement)
- Pages per session > 2.5 (depth)
- Bounce rate < 50% (relevance)
