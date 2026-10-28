// Reference data shipped with the app (not user data).
//  - VIC_LGAS: the 79 Victorian local government areas (council dropdown)
//  - RPM_ESTATES: estate master list by council, carried over from the old tool
//    (name, suburb, lots/month) — the estate dropdown on the input page
//  - EXPLORERS_CENTRES: the 28 centres on explorers.com.au/centres (fetched
//    2026-10-28); ids match sql/26-explorers-centres.sql and data/explorers-centres.json

export const VIC_LGAS = ["Alpine", "Ararat", "Ballarat", "Banyule", "Bass Coast", "Baw Baw", "Bayside", "Benalla", "Boroondara", "Brimbank", "Buloke", "Campaspe", "Cardinia", "Casey", "Central Goldfields", "Colac Otway", "Corangamite", "Darebin", "East Gippsland", "Frankston", "Gannawarra", "Glen Eira", "Glenelg", "Golden Plains", "Greater Bendigo", "Greater Dandenong", "Greater Geelong", "Greater Shepparton", "Hepburn", "Hindmarsh", "Hobsons Bay", "Horsham", "Hume", "Indigo", "Kingston", "Knox", "Latrobe", "Loddon", "Macedon Ranges", "Manningham", "Mansfield", "Maribyrnong", "Maroondah", "Melbourne", "Melton", "Merri-bek", "Mildura", "Mitchell", "Moira", "Monash", "Moonee Valley", "Moorabool", "Mornington Peninsula", "Mount Alexander", "Moyne", "Murrindindi", "Nillumbik", "Northern Grampians", "Port Phillip", "Pyrenees", "Queenscliffe", "South Gippsland", "Southern Grampians", "Stonnington", "Strathbogie", "Surf Coast", "Swan Hill", "Towong", "Wangaratta", "Warrnambool", "Wellington", "West Wimmera", "Whitehorse", "Whittlesea", "Wodonga", "Wyndham", "Yarra", "Yarra Ranges", "Yarriambiack"];

export const RPM_ESTATES = {
  Whittlesea:[
    {name:'Aurora',suburb:'Wollert',rate:10.6},{name:'Lyndarum North',suburb:'Wollert',rate:7.8},
    {name:'Arramont',suburb:'Wollert',rate:10.1},{name:'Rathdowne',suburb:'Wollert',rate:6.9},
    {name:'Ellery',suburb:'Wollert',rate:3.4},{name:'Mason Quarter',suburb:'Wollert',rate:8.3},
    {name:'Elyssia',suburb:'Wollert',rate:3.7},{name:'Wollert Rise',suburb:'Wollert',rate:6.1},
    {name:'Riverhills',suburb:'Wollert',rate:2.8},{name:'The Patch',suburb:'Wollert',rate:2.9},
    {name:'Stonefields',suburb:'Wollert',rate:5.1},{name:'Kinbrook',suburb:'Donnybrook',rate:5.0},
    {name:'Olivine',suburb:'Donnybrook',rate:9.5},{name:'Katalia',suburb:'Donnybrook',rate:7.3},
    {name:'Peppercorn Hill',suburb:'Donnybrook',rate:17.8},{name:'Balmain',suburb:'Donnybrook',rate:2.4},
    {name:'Heartford',suburb:'Donnybrook',rate:2.4},{name:'Matilda',suburb:'Donnybrook',rate:6.1},
    {name:'Atticus',suburb:'Woodstock',rate:3.7},{name:'Katandra Rise',suburb:'Doreen',rate:6.2},
    {name:'Aspect',suburb:'Mernda',rate:2.6},{name:'Elana Place',suburb:'Epping',rate:1.8},
  ],
  Casey:[
    {name:'Berwick Waters',suburb:'Clyde North',rate:6.9},{name:'Meridian',suburb:'Clyde North',rate:10.0},
    {name:'Smiths Lane',suburb:'Clyde North',rate:14.6},{name:'Orana',suburb:'Clyde North',rate:13.8},
    {name:'Five Farms',suburb:'Clyde North',rate:9.0},{name:'Verve',suburb:'Clyde North',rate:5.2},
    {name:'Riverfield',suburb:'Clyde',rate:10.3},{name:'One Bells',suburb:'Clyde',rate:3.5},
    {name:'Evergreen',suburb:'Clyde',rate:7.2},{name:'Minta',suburb:'Berwick',rate:6.7},
    {name:'Kingbird',suburb:'Botanic Ridge',rate:2.4},{name:'Canopy at Amstel',suburb:'Cranbourne',rate:3.2},
    {name:'Brompton Life',suburb:'Cranbourne South',rate:7.2},{name:'Smiths Park',suburb:'Clyde North',rate:3.8},
    {name:'Oak Grove',suburb:'Clyde North',rate:6.3},{name:'Northside',suburb:'Clyde North',rate:4.2},
  ],
  Melton:[
    {name:'Woodlea',suburb:'Aintree',rate:10.6},{name:'Atherstone',suburb:'Strathtulloh',rate:14.0},
    {name:'Mt Atkinson',suburb:'Truganina',rate:17.4},{name:'Grandview',suburb:'Truganina',rate:7.0},
    {name:'Exford Waters',suburb:'Weir Views',rate:7.6},{name:'Deanside Village',suburb:'Deanside',rate:3.6},
    {name:'Carolina',suburb:'Deanside',rate:3.1},{name:'Aspire West',suburb:'Fraser Rise',rate:2.9},
    {name:'Botania',suburb:'Fraser Rise',rate:2.5},{name:'Westwood',suburb:'Fraser Rise',rate:9.4},
    {name:'Attwell',suburb:'Deanside',rate:3.5},{name:'Seventh Bend',suburb:'Weir Views',rate:6.7},
    {name:'Key West',suburb:'Thornhill Park',rate:3.5},{name:'Thornhill Central',suburb:'Thornhill Park',rate:2.5},
  ],
  Wyndham:[
    {name:'Manor Lakes',suburb:'Manor Lakes',rate:13.0},{name:'Harpley',suburb:'Werribee',rate:10.5},
    {name:'The Grove',suburb:'Tarneit',rate:12.2},{name:'Riverwalk',suburb:'Werribee',rate:3.8},
    {name:'Creekstone',suburb:'Tarneit',rate:4.0},{name:'Newhaven',suburb:'Tarneit',rate:3.6},
    {name:'Windermere',suburb:'Mambourin',rate:7.0},{name:'Verdant Hill',suburb:'Tarneit',rate:3.5},
    {name:'Emerald Park',suburb:'Tarneit',rate:3.7},{name:'Alamora',suburb:'Tarneit',rate:8.0},
    {name:'Westbrook',suburb:'Truganina',rate:6.6},{name:'Grand Central',suburb:'Tarneit',rate:3.7},
    {name:'Mambourin',suburb:'Mambourin',rate:7.4},{name:'Unity Park',suburb:'Tarneit',rate:3.7},
  ],
  Hume:[
    {name:'Highlands',suburb:'Craigieburn',rate:11.5},{name:'Merrifield',suburb:'Mickleham',rate:13.4},
    {name:'Cloverton',suburb:'Kalkallo',rate:10.9},{name:'Botanical',suburb:'Mickleham',rate:6.5},
    {name:'True North Greenvale',suburb:'Greenvale',rate:3.1},{name:'Woodsong',suburb:'Mickleham',rate:3.3},
    {name:'Dunhelen',suburb:'Greenvale',rate:1.4},
  ],
  Cardinia:[{name:'Arcadia',suburb:'Officer',rate:2.2}],
  Mitchell:[{name:'Seymour Estate',suburb:'Seymour',rate:1.0}],
};

export const EXPLORERS_CENTRES = [
 {
  "id": "3ad1f806-d9ba-58fc-8194-35ef2b269a5b",
  "code": "EXP-ARMADALE",
  "name": "Explorers Armadale",
  "address": "117A Kooyong Road, Armadale VIC 3143",
  "suburb": "Armadale",
  "state": "VIC",
  "postcode": "3143",
  "status": "open",
  "url": "https://explorers.com.au/centres/armadale"
 },
 {
  "id": "75f8eec1-0452-58e1-9394-06070f1b7a68",
  "code": "EXP-ARMSTRONGCRE",
  "name": "Explorers Armstrong Creek",
  "address": "12-16 Main St, Armstrong Creek VIC 3217",
  "suburb": "Armstrong Creek",
  "state": "VIC",
  "postcode": "3217",
  "status": "open",
  "url": "https://explorers.com.au/centres/armstrong-creek"
 },
 {
  "id": "c57fc188-209f-56f6-9ad5-61abb0cc6a31",
  "code": "EXP-ASCOTVALE",
  "name": "Explorers Ascot Vale",
  "address": "307 Maribyrnong Road, Ascot Vale VIC 3032",
  "suburb": "Ascot Vale",
  "state": "VIC",
  "postcode": "3032",
  "status": "opening",
  "url": "https://explorers.com.au/centres/ascot-vale"
 },
 {
  "id": "210825a5-17ea-5d82-8ce8-9967da9d623d",
  "code": "EXP-ASHWOOD",
  "name": "Explorers Ashwood",
  "address": "205 High Street Road, Ashwood VIC 3147",
  "suburb": "Ashwood",
  "state": "VIC",
  "postcode": "3147",
  "status": "open",
  "url": "https://explorers.com.au/centres/ashwood"
 },
 {
  "id": "4de50dc2-da18-5e5a-814a-b6ba368923b9",
  "code": "EXP-BEACONSFIELD",
  "name": "Explorers Beaconsfield",
  "address": "2 Pink Hill Blvd, Beaconsfield VIC 3807",
  "suburb": "Beaconsfield",
  "state": "VIC",
  "postcode": "3807",
  "status": "open",
  "url": "https://explorers.com.au/centres/beaconsfield"
 },
 {
  "id": "beb4736d-61f4-53a4-a0a4-ee04c10d31dd",
  "code": "EXP-BORONIA",
  "name": "Explorers Boronia",
  "address": "265 Boronia Road, Boronia VIC 3155",
  "suburb": "Boronia",
  "state": "VIC",
  "postcode": "3155",
  "status": "open",
  "url": "https://explorers.com.au/centres/boronia"
 },
 {
  "id": "950f9245-9fe8-5e15-b5f7-7e99b76ac839",
  "code": "EXP-BRIGHTONEAST",
  "name": "Explorers Brighton East",
  "address": "761-763 Nepean Highway, Brighton East VIC 3187",
  "suburb": "Brighton East",
  "state": "VIC",
  "postcode": "3187",
  "status": "open",
  "url": "https://explorers.com.au/centres/brighton-east"
 },
 {
  "id": "4f33fc21-4023-5e5b-a1c0-1ce4b51256f3",
  "code": "EXP-CHARLEMONT",
  "name": "Explorers Charlemont",
  "address": "3 Baratheon Road, Charlemont VIC 3217",
  "suburb": "Charlemont",
  "state": "VIC",
  "postcode": "3217",
  "status": "opening",
  "url": "https://explorers.com.au/centres/charlemont"
 },
 {
  "id": "9dcbaf93-05fa-5bd2-bda8-c46ce2e32232",
  "code": "EXP-CLYDENORTH",
  "name": "Explorers Clyde North",
  "address": "15S Australorp Drive, Clyde North VIC 3978",
  "suburb": "Clyde North",
  "state": "VIC",
  "postcode": "3978",
  "status": "open",
  "url": "https://explorers.com.au/centres/clyde-north"
 },
 {
  "id": "6c95d12e-47d4-54b9-a829-274ded9344c2",
  "code": "EXP-CROYDON",
  "name": "Explorers Croydon",
  "address": "84-86 Hull Road, Croydon VIC 3136",
  "suburb": "Croydon",
  "state": "VIC",
  "postcode": "3136",
  "status": "open",
  "url": "https://explorers.com.au/centres/croydon"
 },
 {
  "id": "8de0bd85-0f8b-5d78-a9f0-2ea04864d92e",
  "code": "EXP-DANDENONG",
  "name": "Explorers Dandenong",
  "address": "159 Princes Hwy, Dandenong VIC 3175",
  "suburb": "Dandenong",
  "state": "VIC",
  "postcode": "3175",
  "status": "open",
  "url": "https://explorers.com.au/centres/dandenong"
 },
 {
  "id": "55575f94-414f-56b0-bad9-fe88cb6e19fb",
  "code": "EXP-ESSENDON",
  "name": "Explorers Essendon",
  "address": "30-32 Lincoln Road, Essendon VIC 3040",
  "suburb": "Essendon",
  "state": "VIC",
  "postcode": "3040",
  "status": "open",
  "url": "https://explorers.com.au/centres/essendon"
 },
 {
  "id": "2b156ce4-0977-5add-9057-04889cb167bf",
  "code": "EXP-FRANKSTONNOR",
  "name": "Explorers Frankston North",
  "address": "2-8 Ballarto Road, Frankston North VIC 3200",
  "suburb": "Frankston North",
  "state": "VIC",
  "postcode": "3200",
  "status": "open",
  "url": "https://explorers.com.au/centres/frankston-north"
 },
 {
  "id": "baa80af0-8727-5b84-9e57-4605857fda15",
  "code": "EXP-GREENVALE",
  "name": "Explorers Greenvale",
  "address": "1 Darmain Drive, Greenvale VIC 3059",
  "suburb": "Greenvale",
  "state": "VIC",
  "postcode": "3059",
  "status": "open",
  "url": "https://explorers.com.au/centres/greenvale"
 },
 {
  "id": "d17182ec-152c-556b-a2be-f22eefa982ed",
  "code": "EXP-LYNBROOK",
  "name": "Explorers Lynbrook",
  "address": "7S Henning Avenue, Lynbrook VIC 3975",
  "suburb": "Lynbrook",
  "state": "VIC",
  "postcode": "3975",
  "status": "opening",
  "url": "https://explorers.com.au/centres/lynbrook"
 },
 {
  "id": "75ce0134-d899-556b-bb50-3e723425cf43",
  "code": "EXP-MORNINGTON",
  "name": "Explorers Mornington",
  "address": "102 Strachans Road, Mornington VIC 3931",
  "suburb": "Mornington",
  "state": "VIC",
  "postcode": "3931",
  "status": "open",
  "url": "https://explorers.com.au/centres/mornington"
 },
 {
  "id": "a930e2c8-bbae-56b1-a9f2-7bddf3e0b98e",
  "code": "EXP-MTCOTTRELL",
  "name": "Explorers Mt Cottrell",
  "address": "55 Goodison Grove, Mt Cottrell VIC 3024",
  "suburb": "Mt Cottrell",
  "state": "VIC",
  "postcode": "3024",
  "status": "open",
  "url": "https://explorers.com.au/centres/mt-cottrell"
 },
 {
  "id": "4da10f49-a75a-57bd-8207-8027a76ed5a2",
  "code": "EXP-NUNAWADING",
  "name": "Explorers Nunawading",
  "address": "86-88 Springvale Road, Nunawading VIC 3131",
  "suburb": "Nunawading",
  "state": "VIC",
  "postcode": "3131",
  "status": "open",
  "url": "https://explorers.com.au/centres/nunawading"
 },
 {
  "id": "d32ec38d-05e4-531a-9d2d-50557dc9fe93",
  "code": "EXP-OFFICER",
  "name": "Explorers Officer",
  "address": "1 Niki Place, Officer VIC 3809",
  "suburb": "Officer",
  "state": "VIC",
  "postcode": "3809",
  "status": "opening",
  "url": "https://explorers.com.au/centres/officer"
 },
 {
  "id": "acd19130-b461-5d72-acb4-5845fe2330cd",
  "code": "EXP-SHEPPARTONNO",
  "name": "Explorers Shepparton North",
  "address": "2 Samaria Boulevard, Shepparton North VIC 3631",
  "suburb": "Shepparton North",
  "state": "VIC",
  "postcode": "3631",
  "status": "opening",
  "url": "https://explorers.com.au/centres/shepparton-north"
 },
 {
  "id": "a7c98117-9b3e-5d6f-94a5-7f2ecb551090",
  "code": "EXP-SOMERVILLE",
  "name": "Explorers Somerville",
  "address": "103 Bungower Road, Somerville VIC 3912",
  "suburb": "Somerville",
  "state": "VIC",
  "postcode": "3912",
  "status": "opening",
  "url": "https://explorers.com.au/centres/somerville"
 },
 {
  "id": "931e86f3-10d5-51c3-89db-f23866c77539",
  "code": "EXP-SURREYHILLSE",
  "name": "Explorers Surrey Hills Elgar Road",
  "address": "221 Elgar Road, Surrey Hills VIC 3127",
  "suburb": "Surrey Hills",
  "state": "VIC",
  "postcode": "3127",
  "status": "open",
  "url": "https://explorers.com.au/centres/surrey-hills-elgar-road"
 },
 {
  "id": "4fdc172b-9038-5f7b-a2e2-de02d111faf1",
  "code": "EXP-SURREYHILLSS",
  "name": "Explorers Surrey Hills Stanley Terrace",
  "address": "1 Stanley Terrace, Surrey Hills VIC 3127",
  "suburb": "Surrey Hills",
  "state": "VIC",
  "postcode": "3127",
  "status": "open",
  "url": "https://explorers.com.au/centres/surrey-hills-stanley-terrace"
 },
 {
  "id": "e06cdbb4-1522-50d9-9f5f-bd40bf3168bc",
  "code": "EXP-TARNEIT",
  "name": "Explorers Tarneit",
  "address": "80 Homebush Drive, Tarneit VIC 3029",
  "suburb": "Tarneit",
  "state": "VIC",
  "postcode": "3029",
  "status": "open",
  "url": "https://explorers.com.au/centres/tarneit"
 },
 {
  "id": "c751ae2a-07ca-5499-a499-77da11d26cc1",
  "code": "EXP-WALLAN",
  "name": "Explorers Wallan",
  "address": "101-103 Stanley St, Wallan VIC 3756",
  "suburb": "Wallan",
  "state": "VIC",
  "postcode": "3756",
  "status": "open",
  "url": "https://explorers.com.au/centres/wallan"
 },
 {
  "id": "14cbb4e6-f33b-51da-999d-fc48e3c4b8a8",
  "code": "EXP-WERRIBEE",
  "name": "Explorers Werribee",
  "address": "24 Scotsburn Grove, Werribee VIC 3030",
  "suburb": "Werribee",
  "state": "VIC",
  "postcode": "3030",
  "status": "open",
  "url": "https://explorers.com.au/centres/werribee"
 },
 {
  "id": "d69e42b3-9f20-5020-a101-06030b5a3bbc",
  "code": "EXP-WILLIAMSLAND",
  "name": "Explorers Williams Landing",
  "address": "2 Fogarty Street, Williams Landing VIC 3027",
  "suburb": "Williams Landing",
  "state": "VIC",
  "postcode": "3027",
  "status": "open",
  "url": "https://explorers.com.au/centres/williams-landing"
 },
 {
  "id": "6559cd34-fd16-5d07-8d86-6a498d0d7552",
  "code": "EXP-WILLIAMSTOWN",
  "name": "Explorers Williamstown",
  "address": "130 Ferguson Street, Williamstown VIC 3016",
  "suburb": "Williamstown",
  "state": "VIC",
  "postcode": "3016",
  "status": "open",
  "url": "https://explorers.com.au/centres/williamstown"
 }
];

// Case-insensitive council match: 'Hume City Council', 'City of Hume', 'HUME' → 'Hume'
export function matchLga(text){
  const t = String(text || '').toLowerCase().replace(/\b(city|shire|rural city|borough|of|council)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const hit = VIC_LGAS.find(l => l.toLowerCase() === t) || VIC_LGAS.find(l => t.includes(l.toLowerCase()));
  return hit || '';
}
export function estatesFor(council){
  const lga = matchLga(council);
  if (lga && RPM_ESTATES[lga]) return RPM_ESTATES[lga].map(e => ({ ...e, lga }));
  return Object.entries(RPM_ESTATES).flatMap(([l, es]) => es.map(e => ({ ...e, lga: l })));
}
