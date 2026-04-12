/**
 * lib/media.js — Bird species image aggregator
 * Layer 1: Curated Wikimedia Commons mapping (static, fast)
 * Layer 2: iNaturalist API (recent photos with CC license)
 * Layer 3: Nuthatch API fallback
 */

const { Redis } = require('@upstash/redis');
const IMG_CACHE_TTL = 86400; // 24 hours for recent observation photos

let redis;
function getRedis() {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_URL,
      token: process.env.UPSTASH_REDIS_TOKEN,
    });
  }
  return redis;
}

/**
 * Curated Wikimedia Commons images for top Michigan species.
 * Format: speciesCode -> { url, attribution, license }
 * These are hand-picked high-quality CC images.
 */
const W = 'https://upload.wikimedia.org/wikipedia/commons/thumb';
const SPECIES_IMAGES = {
  // === WARBLERS ===
  kirwar: { url: `${W}/1/17/Kirtland%27s_Warbler_%28Setophaga_kirtlandii%29.jpg/600px-Kirtland%27s_Warbler_%28Setophaga_kirtlandii%29.jpg`, attribution: 'Joel Trick/USFWS', license: 'PD' },
  yelwar: { url: `${W}/3/3e/Setophaga_petechia_-Canopy_Lodge%2C_El_Valle_de_Ant%C3%B3n%2C_Cocl%C3%A9%2C_Panama-8.jpg/600px-Setophaga_petechia_-Canopy_Lodge%2C_El_Valle_de_Ant%C3%B3n%2C_Cocl%C3%A9%2C_Panama-8.jpg`, attribution: 'Michael Woodruff', license: 'CC BY-SA 2.0' },
  btbwar: { url: `${W}/5/59/Blackburnian_Warbler_-_Setophaga_fusca.jpg/600px-Blackburnian_Warbler_-_Setophaga_fusca.jpg`, attribution: 'Mdf', license: 'CC BY-SA 3.0' },
  bkbwar: { url: `${W}/7/7e/Mniotilta_varia1.jpg/600px-Mniotilta_varia1.jpg`, attribution: 'Mdf', license: 'CC BY-SA 3.0' },
  magwar: { url: `${W}/0/0d/Setophaga_magnolia_-Chiquimula%2C_Guatemala-8.jpg/600px-Setophaga_magnolia_-Chiquimula%2C_Guatemala-8.jpg`, attribution: 'Francesco Veronesi', license: 'CC BY-SA 2.0' },
  prowar: { url: `${W}/f/f1/Prothonotary_warbler.jpg/600px-Prothonotary_warbler.jpg`, attribution: 'Mdf', license: 'CC BY-SA 3.0' },
  comyel: { url: `${W}/6/6e/Geothlypis_trichas_-_Common_Yellowthroat%2C_Chesterfield_County%2C_South_Carolina.jpg/600px-Geothlypis_trichas_-_Common_Yellowthroat%2C_Chesterfield_County%2C_South_Carolina.jpg`, attribution: 'Andy Reago', license: 'CC BY 2.0' },
  palwar: { url: `${W}/a/a0/Setophaga_palmarum_-Loess_Bluffs_National_Wildlife_Refuge%2C_Missouri%2C_USA-8.jpg/600px-Setophaga_palmarum_-Loess_Bluffs_National_Wildlife_Refuge%2C_Missouri%2C_USA-8.jpg`, attribution: 'Andy Reago', license: 'CC BY 2.0' },
  norpar: { url: `${W}/5/53/Setophaga_americana%2C_Northern_parula%2C_Terre_Haute.jpg/600px-Setophaga_americana%2C_Northern_parula%2C_Terre_Haute.jpg`, attribution: 'Caleb Putnam', license: 'CC BY-SA 2.0' },

  // === RAPTORS ===
  baleag: { url: `${W}/1/1a/About_to_Launch_%2826075320352%29.jpg/600px-About_to_Launch_%2826075320352%29.jpg`, attribution: 'Andy Morffew', license: 'CC BY 2.0' },
  rethaw: { url: `${W}/4/45/Red-tailed_Hawk_%28Buteo_jamaicensis%29_in_flight.jpg/600px-Red-tailed_Hawk_%28Buteo_jamaicensis%29_in_flight.jpg`, attribution: 'Jason Crotty', license: 'CC BY 2.0' },
  merlin: { url: `${W}/8/8b/Merlin_%28Falco_columbarius%29.jpg/600px-Merlin_%28Falco_columbarius%29.jpg`, attribution: 'Mdf', license: 'CC BY-SA 3.0' },
  snoowl1:{ url: `${W}/e/e4/Snowy_Owl_-_Bubo_scandiacus.jpg/600px-Snowy_Owl_-_Bubo_scandiacus.jpg`, attribution: 'Bert de Tilly', license: 'CC BY-SA 4.0' },
  grhowl: { url: `${W}/0/07/Great_Horned_Owl_-_Bubo_virginianus.jpg/600px-Great_Horned_Owl_-_Bubo_virginianus.jpg`, attribution: 'Mdf', license: 'CC BY-SA 3.0' },
  amekes: { url: `${W}/7/73/AmericanKestrel02.jpg/600px-AmericanKestrel02.jpg`, attribution: 'Greg Hume', license: 'CC BY-SA 3.0' },
  shshaw: { url: `${W}/f/f6/Accipiter_striatus_-near_Belleville%2C_Ontario%2C_Canada_-flying-8.jpg/600px-Accipiter_striatus_-near_Belleville%2C_Ontario%2C_Canada_-flying-8.jpg`, attribution: 'Ken Thomas', license: 'CC BY-SA 2.0' },
  norhar2:{ url: `${W}/7/7d/Circus_hudsonius_male_in_flight.jpg/600px-Circus_hudsonius_male_in_flight.jpg`, attribution: 'Becky Matsubara', license: 'CC BY 2.0' },
  coohaw: { url: `${W}/7/78/Accipiter_cooperii_2.jpg/600px-Accipiter_cooperii_2.jpg`, attribution: 'Mdf', license: 'CC BY-SA 3.0' },
  goleag: { url: `${W}/b/b2/Golden_Eagle_in_flight_-_5.jpg/600px-Golden_Eagle_in_flight_-_5.jpg`, attribution: 'Tony Hisgett', license: 'CC BY 2.0' },
  swahaw: { url: `${W}/6/60/Swainson_hawk_02.jpg/600px-Swainson_hawk_02.jpg`, attribution: 'Greg Schechter', license: 'CC BY 2.0' },

  // === WATERFOWL ===
  mallar3:{ url: `${W}/b/bf/Anas_platyrhynchos_male_female_quadrat.jpg/600px-Anas_platyrhynchos_male_female_quadrat.jpg`, attribution: 'Richard Bartz', license: 'CC BY-SA 2.5' },
  wooduc: { url: `${W}/d/d9/Wood_Duck_%28Aix_sponsa%29%2C_Parc_du_Rouge-Clo%C3%AEtre%2C_Brussels.jpg/600px-Wood_Duck_%28Aix_sponsa%29%2C_Parc_du_Rouge-Clo%C3%AEtre%2C_Brussels.jpg`, attribution: 'Frank Vassen', license: 'CC BY 2.0' },
  cangoo: { url: `${W}/e/e0/Canada_goose_on_Seedskadee_NWR_%2827826185489%29.jpg/600px-Canada_goose_on_Seedskadee_NWR_%2827826185489%29.jpg`, attribution: 'USFWS', license: 'CC BY 2.0' },
  tunswa: { url: `${W}/0/09/Tundra_Swan_RWD3.jpg/600px-Tundra_Swan_RWD3.jpg`, attribution: 'DickDaniels', license: 'CC BY-SA 3.0' },
  truswa: { url: `${W}/5/56/Trumpeter_Swan_-_natures_pics.jpg/600px-Trumpeter_Swan_-_natures_pics.jpg`, attribution: 'Natures Pics', license: 'CC BY 2.0' },
  mutswa: { url: `${W}/4/45/Mute_Swan_Vrhnika.jpg/600px-Mute_Swan_Vrhnika.jpg`, attribution: 'Yerpo', license: 'CC BY-SA 3.0' },
  ambduc: { url: `${W}/3/30/Anas_rubripes_FWS.jpg/600px-Anas_rubripes_FWS.jpg`, attribution: 'USFWS', license: 'PD' },
  amewig: { url: `${W}/2/2e/American_Wigeon.jpg/600px-American_Wigeon.jpg`, attribution: 'Minette Layne', license: 'CC BY-SA 2.0' },
  buffle: { url: `${W}/8/82/Bucephala-albeola-010.jpg/600px-Bucephala-albeola-010.jpg`, attribution: 'Alan D. Wilson', license: 'CC BY-SA 3.0' },
  buwtea: { url: `${W}/3/3f/Blue-winged_Teal_%28Spatula_discors%29%2C_Jamaica_Bay_Wildlife_Refuge.jpg/600px-Blue-winged_Teal_%28Spatula_discors%29%2C_Jamaica_Bay_Wildlife_Refuge.jpg`, attribution: 'Rhododendrites', license: 'CC BY-SA 4.0' },
  gadwal: { url: `${W}/f/ff/Mareca_strepera_%28Gadwall%29_male%2C_Parc_Angrignon%2C_Montr%C3%A9al.jpg/600px-Mareca_strepera_%28Gadwall%29_male%2C_Parc_Angrignon%2C_Montr%C3%A9al.jpg`, attribution: 'Francis C. Franklin', license: 'CC BY-SA 3.0' },
  commer: { url: `${W}/c/cf/Common_Merganser_%28Mergus_merganser%29_RWD1.jpg/600px-Common_Merganser_%28Mergus_merganser%29_RWD1.jpg`, attribution: 'DickDaniels', license: 'CC BY-SA 3.0' },
  hoomer: { url: `${W}/5/51/Hooded_Merganser_%28Male%29.jpg/600px-Hooded_Merganser_%28Male%29.jpg`, attribution: 'Peter Massas', license: 'CC BY-SA 2.0' },
  norpin: { url: `${W}/4/46/Northern_Pintails_%28Male_%26_Female%29_I_IMG_0911.jpg/600px-Northern_Pintails_%28Male_%26_Female%29_I_IMG_0911.jpg`, attribution: 'J.M.Garg', license: 'CC BY-SA 3.0' },
  norsho: { url: `${W}/0/0b/Northern_Shoveler_Anas_clypeata.jpg/600px-Northern_Shoveler_Anas_clypeata.jpg`, attribution: 'BS Thurner Hof', license: 'CC BY-SA 3.0' },
  lessca: { url: `${W}/f/f1/Aythya_affinis_-_male.jpg/600px-Aythya_affinis_-_male.jpg`, attribution: 'DickDaniels', license: 'CC BY-SA 3.0' },
  rinduc: { url: `${W}/e/e2/Ring-necked_duck_male.jpg/600px-Ring-necked_duck_male.jpg`, attribution: 'Mdf', license: 'CC BY-SA 3.0' },
  gnwtea: { url: `${W}/b/b1/Green_winged_teal_FWS.jpg/600px-Green_winged_teal_FWS.jpg`, attribution: 'USFWS', license: 'PD' },
  redhea: { url: `${W}/2/24/Aythya_americana2.jpg/600px-Aythya_americana2.jpg`, attribution: 'Mdf', license: 'CC BY-SA 3.0' },
  rudduc: { url: `${W}/3/35/Ruddy_Duck_male_RWD.jpg/600px-Ruddy_Duck_male_RWD.jpg`, attribution: 'DickDaniels', license: 'CC BY-SA 3.0' },
  snogoo: { url: `${W}/0/05/Chen_caerulescens_33364.jpg/600px-Chen_caerulescens_33364.jpg`, attribution: 'Walter Siegmund', license: 'CC BY-SA 3.0' },
  rosgoo: { url: `${W}/3/37/Chen_rossii2.jpg/600px-Chen_rossii2.jpg`, attribution: 'Alan D. Wilson', license: 'CC BY-SA 3.0' },

  // === HERONS & WADING ===
  grbher3:{ url: `${W}/2/28/Ardea_herodias_-_Great_Blue_Heron.jpg/600px-Ardea_herodias_-_Great_Blue_Heron.jpg`, attribution: 'Mike Baird', license: 'CC BY 2.0' },
  greegr: { url: `${W}/a/a7/Ardea_alba_-_Rabida.jpg/600px-Ardea_alba_-_Rabida.jpg`, attribution: 'Putneymark', license: 'CC BY-SA 2.0' },
  bcnher: { url: `${W}/c/c2/Nycticorax_nycticorax_2.jpg/600px-Nycticorax_nycticorax_2.jpg`, attribution: 'Pkuczynski', license: 'CC BY-SA 3.0' },
  amebit: { url: `${W}/f/f5/Botaurus_lentiginosus1.jpg/600px-Botaurus_lentiginosus1.jpg`, attribution: 'Mdf', license: 'CC BY-SA 3.0' },
  virrai: { url: `${W}/e/e1/Virginia_Rail_%28Rallus_limicola%29.jpg/600px-Virginia_Rail_%28Rallus_limicola%29.jpg`, attribution: 'Mdf', license: 'CC BY-SA 3.0' },

  // === SHOREBIRDS ===
  sander: { url: `${W}/5/5c/Sanderling_%28Calidris_alba%29.jpg/600px-Sanderling_%28Calidris_alba%29.jpg`, attribution: 'Estormiz', license: 'PD' },
  killde: { url: `${W}/6/6a/Charadrius_vociferus_-Kellogg_Beach%2C_Crescent_City%2C_California-8.jpg/600px-Charadrius_vociferus_-Kellogg_Beach%2C_Crescent_City%2C_California-8.jpg`, attribution: 'Minette Layne', license: 'CC BY-SA 2.0' },
  solsan: { url: `${W}/a/ac/Tringa_solitaria_1.jpg/600px-Tringa_solitaria_1.jpg`, attribution: 'Mdf', license: 'CC BY-SA 3.0' },

  // === GULLS ===
  ribgul: { url: `${W}/3/3a/Larus_delawarensis_-_Syracuse.jpg/600px-Larus_delawarensis_-_Syracuse.jpg`, attribution: 'SariSari', license: 'CC BY-SA 3.0' },
  bongul: { url: `${W}/4/4e/Bonaparte%27s_Gull_%28non-breeding_plumage%29.jpg/600px-Bonaparte%27s_Gull_%28non-breeding_plumage%29.jpg`, attribution: 'Becky Matsubara', license: 'CC BY 2.0' },
  amhgul1:{ url: `${W}/5/56/American_Herring_Gull_Larus_smithsonianus.jpg/600px-American_Herring_Gull_Larus_smithsonianus.jpg`, attribution: 'D. Gordon E. Robertson', license: 'CC BY-SA 3.0' },

  // === SONGBIRDS ===
  amerob: { url: `${W}/b/b8/Turdus-migratorius-002.jpg/600px-Turdus-migratorius-002.jpg`, attribution: 'Mdf', license: 'CC BY-SA 3.0' },
  norcar: { url: `${W}/5/5c/Male_Northern_Cardinal.jpg/600px-Male_Northern_Cardinal.jpg`, attribution: 'Dick Daniels', license: 'CC BY-SA 3.0' },
  eastbl: { url: `${W}/f/f4/Eastern_Bluebird-27527-2.jpg/600px-Eastern_Bluebird-27527-2.jpg`, attribution: 'Sandysphotos2009', license: 'CC BY 2.0' },
  easblu: { url: `${W}/f/f4/Eastern_Bluebird-27527-2.jpg/600px-Eastern_Bluebird-27527-2.jpg`, attribution: 'Sandysphotos2009', license: 'CC BY 2.0' },
  bkcchi: { url: `${W}/4/4a/Poecile-atricapilla-001.jpg/600px-Poecile-atricapilla-001.jpg`, attribution: 'Mdf', license: 'CC BY-SA 3.0' },
  whbnut: { url: `${W}/2/2a/Sitta-carolinensis-001.jpg/600px-Sitta-carolinensis-001.jpg`, attribution: 'Mdf', license: 'CC BY-SA 3.0' },
  balori: { url: `${W}/d/d5/Baltimore_Oriole-_dorsal_02.jpg/600px-Baltimore_Oriole-_dorsal_02.jpg`, attribution: 'Mdf', license: 'CC BY-SA 3.0' },
  scatan: { url: `${W}/0/0a/Scarlet_Tanager_%28Piranga_olivacea%29_male.jpg/600px-Scarlet_Tanager_%28Piranga_olivacea%29_male.jpg`, attribution: 'Mdf', license: 'CC BY-SA 3.0' },
  indbun: { url: `${W}/6/6b/Passerina_cyanea_-Michigan%2C_USA_-male-8.jpg/600px-Passerina_cyanea_-Michigan%2C_USA_-male-8.jpg`, attribution: 'GrrlScientist', license: 'CC BY 2.0' },
  rewbla: { url: `${W}/7/7f/Red-winged_Blackbird_-_Agelaius_phoeniceus%2C_Occoquan_Bay_National_Wildlife_Refuge%2C_Virginia.jpg/600px-Red-winged_Blackbird_-_Agelaius_phoeniceus%2C_Occoquan_Bay_National_Wildlife_Refuge%2C_Virginia.jpg`, attribution: 'Andy Reago', license: 'CC BY 2.0' },
  comgra: { url: `${W}/e/e5/Quiscalus_quiscula_-Basilica_of_the_National_Shrine_of_the_Immaculate_Conception%2C_Washington_DC%2C_USA-8.jpg/600px-Quiscalus_quiscula_-Basilica_of_the_National_Shrine_of_the_Immaculate_Conception%2C_Washington_DC%2C_USA-8.jpg`, attribution: 'Tim Sackton', license: 'CC BY-SA 2.0' },
  eursta: { url: `${W}/5/5e/Sturnus_vulgaris_2.jpg/600px-Sturnus_vulgaris_2.jpg`, attribution: 'Pierre Selim', license: 'CC BY 3.0' },
  sonspa: { url: `${W}/0/01/Song_Sparrow-27527.jpg/600px-Song_Sparrow-27527.jpg`, attribution: 'Mdf', license: 'CC BY-SA 3.0' },
  amtspa: { url: `${W}/5/56/American_Tree_Sparrow_%28Spizelloides_arborea%29.jpg/600px-American_Tree_Sparrow_%28Spizelloides_arborea%29.jpg`, attribution: 'Andy Reago', license: 'CC BY 2.0' },
  savspa: { url: `${W}/4/42/Passerculus_sandwichensis_-Ontario%2C_Canada-8.jpg/600px-Passerculus_sandwichensis_-Ontario%2C_Canada-8.jpg`, attribution: 'Mdf', license: 'CC BY-SA 3.0' },
  swaspa: { url: `${W}/7/7c/Swamp_Sparrow_RWD.jpg/600px-Swamp_Sparrow_RWD.jpg`, attribution: 'DickDaniels', license: 'CC BY-SA 3.0' },
  whcspa: { url: `${W}/5/5e/White-crowned_Sparrow%2C_Sax-Zim_Bog.jpg/600px-White-crowned_Sparrow%2C_Sax-Zim_Bog.jpg`, attribution: 'Fyn Kynd', license: 'CC BY 2.0' },
  amecro: { url: `${W}/e/e2/Corvus_brachyrhynchos_30196.jpg/600px-Corvus_brachyrhynchos_30196.jpg`, attribution: 'Walter Siegmund', license: 'CC BY-SA 3.0' },
  brncre: { url: `${W}/c/c6/Certhia_americana_Yosemite.jpg/600px-Certhia_americana_Yosemite.jpg`, attribution: 'Steve Ryan', license: 'CC BY-SA 2.0' },
  gockin: { url: `${W}/2/21/Golden-crowned_Kinglet%2C_Sax-Zim_Bog.jpg/600px-Golden-crowned_Kinglet%2C_Sax-Zim_Bog.jpg`, attribution: 'Fyn Kynd', license: 'CC BY 2.0' },
  ruckin: { url: `${W}/3/3e/Regulus_calendula1.jpg/600px-Regulus_calendula1.jpg`, attribution: 'Mdf', license: 'CC BY-SA 3.0' },
  moudov: { url: `${W}/b/b7/Mourning_Dove_2006.jpg/600px-Mourning_Dove_2006.jpg`, attribution: 'Ken Thomas', license: 'PD' },
  bnhcow: { url: `${W}/e/e7/Molothrus_ater2.jpg/600px-Molothrus_ater2.jpg`, attribution: 'Mdf', license: 'CC BY-SA 3.0' },
  treswa: { url: `${W}/b/b2/Tree_swallow_at_Stroud_Preserve.jpg/600px-Tree_swallow_at_Stroud_Preserve.jpg`, attribution: 'Kati Fleming', license: 'CC BY-SA 3.0' },
  grycat: { url: `${W}/9/99/Dumetella_carolinensis1.jpg/600px-Dumetella_carolinensis1.jpg`, attribution: 'Mdf', license: 'CC BY-SA 3.0' },
  evegro: { url: `${W}/0/0f/Evening_Grosbeak.jpg/600px-Evening_Grosbeak.jpg`, attribution: 'Cephas', license: 'CC BY-SA 3.0' },
  rusbla: { url: `${W}/9/97/Euphagus_carolinus.jpg/600px-Euphagus_carolinus.jpg`, attribution: 'Cephas', license: 'CC BY-SA 3.0' },
  brebla: { url: `${W}/c/cd/Euphagus_cyanocephalus_-California-8.jpg/600px-Euphagus_cyanocephalus_-California-8.jpg`, attribution: 'Kevin Cole', license: 'CC BY 2.0' },
  amwpel: { url: `${W}/b/b3/American_white_pelicans_%28Pelecanus_erythrorhynchos%29.jpg/600px-American_white_pelicans_%28Pelecanus_erythrorhynchos%29.jpg`, attribution: 'Frank Schulenburg', license: 'CC BY-SA 3.0' },

  // === WOODPECKERS ===
  pilwoo: { url: `${W}/5/5a/Pileated_Woodpecker_Sax-Zim_Bog_MN_IMG_8596.jpg/600px-Pileated_Woodpecker_Sax-Zim_Bog_MN_IMG_8596.jpg`, attribution: 'Fyn Kynd', license: 'CC BY 2.0' },
  dowwoo: { url: `${W}/3/34/Dryobates_pubescens_male_Palo_Alto.jpg/600px-Dryobates_pubescens_male_Palo_Alto.jpg`, attribution: 'Becky Matsubara', license: 'CC BY 2.0' },
  rehwoo: { url: `${W}/a/ad/Red-headed_Woodpecker-27527-2.jpg/600px-Red-headed_Woodpecker-27527-2.jpg`, attribution: 'Mdf', license: 'CC BY-SA 3.0' },
  yebsap: { url: `${W}/c/c7/Yellow-bellied_Sapsucker%2C_Sphyrapicus_varius%2C_male.jpg/600px-Yellow-bellied_Sapsucker%2C_Sphyrapicus_varius%2C_male.jpg`, attribution: 'Mykola Swarnyk', license: 'CC BY-SA 3.0' },

  // === GREAT LAKES SPECIALS ===
  comloo: { url: `${W}/a/a3/Gavia_immer_-Minocqua%2C_Wisconsin%2C_USA_-swimming-8.jpg/600px-Gavia_immer_-Minocqua%2C_Wisconsin%2C_USA_-swimming-8.jpg`, attribution: 'John Oswald', license: 'CC BY-SA 2.0' },
  sancra: { url: `${W}/e/ea/Antigone_canadensis_-Sandhill_Crane.jpg/600px-Antigone_canadensis_-Sandhill_Crane.jpg`, attribution: 'Mdf', license: 'CC BY-SA 3.0' },
  wiltur: { url: `${W}/5/50/Gall-dansen.jpg/600px-Gall-dansen.jpg`, attribution: 'D. Gordon E. Robertson', license: 'CC BY-SA 3.0' },
  rinphe1:{ url: `${W}/9/9f/Common_Pheasant_%28Phasianus_colchicus%29_%282%29.jpg/600px-Common_Pheasant_%28Phasianus_colchicus%29_%282%29.jpg`, attribution: 'Pierre Dalous', license: 'CC BY-SA 3.0' },
  pibgre: { url: `${W}/3/31/Podilymbus-podiceps-001.jpg/600px-Podilymbus-podiceps-001.jpg`, attribution: 'Mdf', license: 'CC BY-SA 3.0' },
  rengre: { url: `${W}/6/69/Podiceps_grisegena_%28summer%29.jpg/600px-Podiceps_grisegena_%28summer%29.jpg`, attribution: 'Mdf', license: 'CC BY-SA 3.0' },
  neocor: { url: `${W}/d/dc/Phalacrocorax_brasilianus_%28Olivaceous_Cormorant%29.jpg/600px-Phalacrocorax_brasilianus_%28Olivaceous_Cormorant%29.jpg`, attribution: 'Mdf', license: 'CC BY-SA 3.0' },
  sheowl: { url: `${W}/3/3d/Asio_flammeus_-_Short-eared_Owl%2C_Skagit_Co.%2C_WA.jpg/600px-Asio_flammeus_-_Short-eared_Owl%2C_Skagit_Co.%2C_WA.jpg`, attribution: 'Brendan Lally', license: 'CC BY 2.0' },
  houwre: { url: `${W}/2/24/Troglodytes_aedon.jpg/600px-Troglodytes_aedon.jpg`, attribution: 'Mdf', license: 'CC BY-SA 3.0' },
};

/** Get curated image for a species code */
function getCuratedImage(speciesCode) {
  return SPECIES_IMAGES[speciesCode] || null;
}

/**
 * Fetch recent bird photos from iNaturalist for a species in Michigan
 * Returns CC-licensed photos with direct URLs
 */
async function getINatPhotos(taxonName, options = {}) {
  const { perPage = 6 } = options;
  const cacheKey = `birding:inat:photos:${taxonName}`;

  try {
    const r = getRedis();
    const cached = await r.get(cacheKey);
    if (cached) return typeof cached === 'string' ? JSON.parse(cached) : cached;
  } catch (e) { /* continue */ }

  const url = `https://api.inaturalist.org/v1/observations?` +
    `taxon_name=${encodeURIComponent(taxonName)}` +
    `&place_id=31` + // Michigan
    `&quality_grade=research` +
    `&photos=true` +
    `&order=desc&order_by=observed_on` +
    `&per_page=${perPage}`;

  const res = await fetch(url);
  if (!res.ok) return [];

  const data = await res.json();
  const photos = (data.results || [])
    .filter(obs => obs.photos && obs.photos.length > 0)
    .map(obs => ({
      photoUrl: obs.photos[0].url.replace('square', 'medium'),
      observer: obs.user?.login || 'Unknown',
      date: obs.observed_on,
      location: obs.place_guess,
      license: obs.photos[0].license_code || 'unknown',
      inatUrl: `https://www.inaturalist.org/observations/${obs.id}`,
    }));

  try {
    const r = getRedis();
    await r.set(cacheKey, JSON.stringify(photos), { ex: IMG_CACHE_TTL });
  } catch (e) { /* continue */ }

  return photos;
}

/**
 * Fetch the curated default photo from iNaturalist's taxa endpoint.
 * These are high-quality, community-selected field photos of each species.
 * Cached permanently (365 days) since taxon photos rarely change.
 */
async function getINatTaxonPhoto(commonName) {
  const cacheKey = `birding:inat:taxon:${commonName.toLowerCase().replace(/[^a-z]/g, '')}`;

  try {
    const r = getRedis();
    const cached = await r.get(cacheKey);
    if (cached) return typeof cached === 'string' ? JSON.parse(cached) : cached;
  } catch (e) { /* continue */ }

  const res = await fetch(
    `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(commonName)}&rank=species&per_page=1`
  );

  if (!res.ok) return null;

  const data = await res.json();
  const taxon = data.results?.[0];
  if (!taxon?.default_photo?.medium_url) return null;

  const photo = taxon.default_photo;
  const result = {
    url: photo.medium_url,
    attribution: photo.attribution || 'iNaturalist',
    license: photo.license_code || 'CC',
    sciName: taxon.name,
    inatId: taxon.id,
  };

  try {
    const r = getRedis();
    await r.set(cacheKey, JSON.stringify(result), { ex: 86400 * 365 });
  } catch (e) { /* continue */ }

  return result;
}

/**
 * Get the best available image for a species.
 * Priority: curated Wikimedia > iNaturalist taxon photo > placeholder
 * Every real bird gets a real photo. No more stock/drawn images.
 */
async function getBestImage(speciesCode, commonName) {
  // Layer 1: Curated Wikimedia (instant, no API call, hand-picked best)
  const curated = getCuratedImage(speciesCode);
  if (curated) return { source: 'wikimedia', ...curated };

  // Layer 2: iNaturalist taxon default photo (real field photography)
  try {
    const inat = await getINatTaxonPhoto(commonName);
    if (inat) return { source: 'inaturalist', ...inat };
  } catch (e) { /* continue */ }

  // Layer 3: Placeholder (should almost never reach here)
  return {
    source: 'placeholder',
    url: `/placeholder-bird.svg`,
    attribution: 'Michigan Birding Report',
    license: 'n/a',
  };
}

module.exports = {
  SPECIES_IMAGES,
  getCuratedImage,
  getINatPhotos,
  getINatTaxonPhoto,
  getBestImage,
};
