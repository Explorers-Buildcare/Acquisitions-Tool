-- ─────────────────────────────────────────────────────────────────────────
-- 26-explorers-centres.sql
--
-- Seeds the 28 Explorers Early Learning centres (from explorers.com.au/centres,
-- fetched 2026-10-28) as projects rows with type = 'centre', so they can be
-- ticked in the "Nearby Explorers centres" picker (feasibility_nearby_explorers
-- has an FK to projects). IDs are deterministic (uuid5 of the website slug) and
-- match data/explorers-centres.json shipped with the app. IDEMPOTENT — inserts
-- only codes that don't already exist; re-running updates name/address/notes.
-- ─────────────────────────────────────────────────────────────────────────
insert into public.projects (id, type, name, code, address, active, notes)
values
  ('3ad1f806-d9ba-58fc-8194-35ef2b269a5b', 'centre', 'Explorers Armadale', 'EXP-ARMADALE', '117A Kooyong Road, Armadale VIC 3143', true, 'Open · https://explorers.com.au/centres/armadale'),
  ('75f8eec1-0452-58e1-9394-06070f1b7a68', 'centre', 'Explorers Armstrong Creek', 'EXP-ARMSTRONGCRE', '12-16 Main St, Armstrong Creek VIC 3217', true, 'Open · https://explorers.com.au/centres/armstrong-creek'),
  ('c57fc188-209f-56f6-9ad5-61abb0cc6a31', 'centre', 'Explorers Ascot Vale', 'EXP-ASCOTVALE', '307 Maribyrnong Road, Ascot Vale VIC 3032', false, 'Opening soon · https://explorers.com.au/centres/ascot-vale'),
  ('210825a5-17ea-5d82-8ce8-9967da9d623d', 'centre', 'Explorers Ashwood', 'EXP-ASHWOOD', '205 High Street Road, Ashwood VIC 3147', true, 'Open · https://explorers.com.au/centres/ashwood'),
  ('4de50dc2-da18-5e5a-814a-b6ba368923b9', 'centre', 'Explorers Beaconsfield', 'EXP-BEACONSFIELD', '2 Pink Hill Blvd, Beaconsfield VIC 3807', true, 'Open · https://explorers.com.au/centres/beaconsfield'),
  ('beb4736d-61f4-53a4-a0a4-ee04c10d31dd', 'centre', 'Explorers Boronia', 'EXP-BORONIA', '265 Boronia Road, Boronia VIC 3155', true, 'Open · https://explorers.com.au/centres/boronia'),
  ('950f9245-9fe8-5e15-b5f7-7e99b76ac839', 'centre', 'Explorers Brighton East', 'EXP-BRIGHTONEAST', '761-763 Nepean Highway, Brighton East VIC 3187', true, 'Open · https://explorers.com.au/centres/brighton-east'),
  ('4f33fc21-4023-5e5b-a1c0-1ce4b51256f3', 'centre', 'Explorers Charlemont', 'EXP-CHARLEMONT', '3 Baratheon Road, Charlemont VIC 3217', false, 'Opening soon · https://explorers.com.au/centres/charlemont'),
  ('9dcbaf93-05fa-5bd2-bda8-c46ce2e32232', 'centre', 'Explorers Clyde North', 'EXP-CLYDENORTH', '15S Australorp Drive, Clyde North VIC 3978', true, 'Open · https://explorers.com.au/centres/clyde-north'),
  ('6c95d12e-47d4-54b9-a829-274ded9344c2', 'centre', 'Explorers Croydon', 'EXP-CROYDON', '84-86 Hull Road, Croydon VIC 3136', true, 'Open · https://explorers.com.au/centres/croydon'),
  ('8de0bd85-0f8b-5d78-a9f0-2ea04864d92e', 'centre', 'Explorers Dandenong', 'EXP-DANDENONG', '159 Princes Hwy, Dandenong VIC 3175', true, 'Open · https://explorers.com.au/centres/dandenong'),
  ('55575f94-414f-56b0-bad9-fe88cb6e19fb', 'centre', 'Explorers Essendon', 'EXP-ESSENDON', '30-32 Lincoln Road, Essendon VIC 3040', true, 'Open · https://explorers.com.au/centres/essendon'),
  ('2b156ce4-0977-5add-9057-04889cb167bf', 'centre', 'Explorers Frankston North', 'EXP-FRANKSTONNOR', '2-8 Ballarto Road, Frankston North VIC 3200', true, 'Open · https://explorers.com.au/centres/frankston-north'),
  ('baa80af0-8727-5b84-9e57-4605857fda15', 'centre', 'Explorers Greenvale', 'EXP-GREENVALE', '1 Darmain Drive, Greenvale VIC 3059', true, 'Open · https://explorers.com.au/centres/greenvale'),
  ('d17182ec-152c-556b-a2be-f22eefa982ed', 'centre', 'Explorers Lynbrook', 'EXP-LYNBROOK', '7S Henning Avenue, Lynbrook VIC 3975', false, 'Opening soon · https://explorers.com.au/centres/lynbrook'),
  ('75ce0134-d899-556b-bb50-3e723425cf43', 'centre', 'Explorers Mornington', 'EXP-MORNINGTON', '102 Strachans Road, Mornington VIC 3931', true, 'Open · https://explorers.com.au/centres/mornington'),
  ('a930e2c8-bbae-56b1-a9f2-7bddf3e0b98e', 'centre', 'Explorers Mt Cottrell', 'EXP-MTCOTTRELL', '55 Goodison Grove, Mt Cottrell VIC 3024', true, 'Open · https://explorers.com.au/centres/mt-cottrell'),
  ('4da10f49-a75a-57bd-8207-8027a76ed5a2', 'centre', 'Explorers Nunawading', 'EXP-NUNAWADING', '86-88 Springvale Road, Nunawading VIC 3131', true, 'Open · https://explorers.com.au/centres/nunawading'),
  ('d32ec38d-05e4-531a-9d2d-50557dc9fe93', 'centre', 'Explorers Officer', 'EXP-OFFICER', '1 Niki Place, Officer VIC 3809', false, 'Opening soon · https://explorers.com.au/centres/officer'),
  ('acd19130-b461-5d72-acb4-5845fe2330cd', 'centre', 'Explorers Shepparton North', 'EXP-SHEPPARTONNO', '2 Samaria Boulevard, Shepparton North VIC 3631', false, 'Opening soon · https://explorers.com.au/centres/shepparton-north'),
  ('a7c98117-9b3e-5d6f-94a5-7f2ecb551090', 'centre', 'Explorers Somerville', 'EXP-SOMERVILLE', '103 Bungower Road, Somerville VIC 3912', false, 'Opening soon · https://explorers.com.au/centres/somerville'),
  ('931e86f3-10d5-51c3-89db-f23866c77539', 'centre', 'Explorers Surrey Hills Elgar Road', 'EXP-SURREYHILLSE', '221 Elgar Road, Surrey Hills VIC 3127', true, 'Open · https://explorers.com.au/centres/surrey-hills-elgar-road'),
  ('4fdc172b-9038-5f7b-a2e2-de02d111faf1', 'centre', 'Explorers Surrey Hills Stanley Terrace', 'EXP-SURREYHILLSS', '1 Stanley Terrace, Surrey Hills VIC 3127', true, 'Open · https://explorers.com.au/centres/surrey-hills-stanley-terrace'),
  ('e06cdbb4-1522-50d9-9f5f-bd40bf3168bc', 'centre', 'Explorers Tarneit', 'EXP-TARNEIT', '80 Homebush Drive, Tarneit VIC 3029', true, 'Open · https://explorers.com.au/centres/tarneit'),
  ('c751ae2a-07ca-5499-a499-77da11d26cc1', 'centre', 'Explorers Wallan', 'EXP-WALLAN', '101-103 Stanley St, Wallan VIC 3756', true, 'Open · https://explorers.com.au/centres/wallan'),
  ('14cbb4e6-f33b-51da-999d-fc48e3c4b8a8', 'centre', 'Explorers Werribee', 'EXP-WERRIBEE', '24 Scotsburn Grove, Werribee VIC 3030', true, 'Open · https://explorers.com.au/centres/werribee'),
  ('d69e42b3-9f20-5020-a101-06030b5a3bbc', 'centre', 'Explorers Williams Landing', 'EXP-WILLIAMSLAND', '2 Fogarty Street, Williams Landing VIC 3027', true, 'Open · https://explorers.com.au/centres/williams-landing'),
  ('6559cd34-fd16-5d07-8d86-6a498d0d7552', 'centre', 'Explorers Williamstown', 'EXP-WILLIAMSTOWN', '130 Ferguson Street, Williamstown VIC 3016', true, 'Open · https://explorers.com.au/centres/williamstown')
on conflict (id) do update
  set name = excluded.name, address = excluded.address, active = excluded.active, notes = excluded.notes;

-- Verify: select code, name, active from projects where type = 'centre' order by name;
