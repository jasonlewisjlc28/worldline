// Well-known named mine & refinery sites per country and mineral.
// Sources: USGS, company filings, national geological surveys.
export type MineSite = { name: string; lat: number; lon: number; kind: "mine" | "refinery"; note: string };
export const MINES: Record<string, Record<string, MineSite[]>> = {
"Algeria":{
"Phosphate":[{name:"Djebel Onk, Tébessa",lat:35.0,lon:8.1,kind:"mine",note:""},{name:"Bled el Hadba",lat:34.8,lon:7.8,kind:"mine",note:""}],
"Iron ore":[{name:"Ouenza & Boukhadra, Tébessa",lat:35.95,lon:8.13,kind:"mine",note:""},{name:"Gara Djebilet (giant, new)",lat:26.7,lon:-7.2,kind:"mine",note:""}],
"Zinc":[{name:"El Abed, Tlemcen",lat:34.7,lon:-1.5,kind:"mine",note:""}],
},
"Angola":{
"Diamonds":[{name:"Catoca, Lunda Sul",lat:-9.4,lon:20.3,kind:"mine",note:"4th largest kimberlite"},{name:"Lulo (Lucapa)",lat:-9.9,lon:19.9,kind:"mine",note:""}],
"Iron ore":[{name:"Cassinga (reopening)",lat:-15.1,lon:16.1,kind:"mine",note:""}],
},
"Argentina":{
"Lithium":[{name:"Salar de Olaroz & Cauchari, Jujuy",lat:-23.4,lon:-66.7,kind:"mine",note:"brine operations"},{name:"Salar del Hombre Muerto",lat:-25.4,lon:-67.0,kind:"mine",note:"Livent/Arcadium"}],
"Silver":[{name:"Cerro Moro, Santa Cruz",lat:-47.1,lon:-67.9,kind:"mine",note:""},{name:"Manantial Espejo",lat:-48.0,lon:-68.6,kind:"mine",note:""}],
"Copper":[{name:"Bajo de la Alumbrera, Catamarca",lat:-27.3,lon:-66.6,kind:"mine",note:""}],
},
"Australia":{
"Iron ore":[{name:"Pilbara — Mt Newman / Tom Price",lat:-22.7,lon:117.8,kind:"mine",note:"Rio Tinto & BHP iron-ore hub"},{name:"Port Hedland export terminal",lat:-20.3,lon:118.6,kind:"refinery",note:"World's largest bulk export port"}],
"Gold":[{name:"Kalgoorlie Super Pit",lat:-30.75,lon:121.5,kind:"mine",note:"Australia's largest open-cut gold mine"},{name:"Cadia Valley",lat:-33.4,lon:149.0,kind:"mine",note:"Newmont gold-copper"}],
"Lithium":[{name:"Greenbushes",lat:-33.85,lon:116.05,kind:"mine",note:"World's largest hard-rock lithium mine (Talison)"},{name:"Pilgangoora",lat:-21.1,lon:118.9,kind:"mine",note:"Pilbara Minerals spodumene"}],
"Bauxite & alumina":[{name:"Weipa",lat:-12.6,lon:141.9,kind:"mine",note:"Rio Tinto bauxite"},{name:"Pinjarra alumina refinery",lat:-32.6,lon:115.9,kind:"refinery",note:"Alcoa"}],
"Copper & nickel":[{name:"Olympic Dam",lat:-30.45,lon:136.9,kind:"mine",note:"BHP copper-uranium-gold"},{name:"Kambalda nickel",lat:-31.2,lon:121.7,kind:"mine",note:""}],
},
"Azerbaijan":{
"Copper":[{name:"Gadabay & Dashkasan fields",lat:40.6,lon:45.8,kind:"mine",note:""},{name:"Filizchay (project)",lat:41.3,lon:48.5,kind:"mine",note:""}],
"Gold":[{name:"Gadabay & Chovdar",lat:40.6,lon:45.8,kind:"mine",note:""}],
},
"Belarus":{
"Potash":[{name:"Soligorsk (Belaruskali)",lat:52.8,lon:27.55,kind:"mine",note:"top-3 world"},{name:"Petrikov (new)",lat:52.55,lon:28.5,kind:"mine",note:""}],
"Salt & other":[{name:"Mozyr & Starobin salt",lat:52.05,lon:27.5,kind:"mine",note:""}],
},
"Belgium":{
"Diamond trading & recycling":[{name:"Antwerp diamond district",lat:51.2,lon:4.42,kind:"refinery",note:"~85% of rough-diamond trade"},{name:"Umicore Hoboken recycling",lat:51.17,lon:4.37,kind:"refinery",note:""}],
},
"Bolivia":{
"Zinc":[{name:"San Cristóbal",lat:-21.1,lon:-67.2,kind:"mine",note:""},{name:"Colquiri",lat:-17.4,lon:-67.1,kind:"mine",note:""}],
"Silver":[{name:"Cerro Rico, Potosí",lat:-19.6,lon:-65.75,kind:"mine",note:"historic"},{name:"San Cristóbal",lat:-21.1,lon:-67.2,kind:"mine",note:""}],
"Tin":[{name:"Huanuni & Colquiri",lat:-18.3,lon:-66.8,kind:"mine",note:""}],
"Lithium (pilot)":[{name:"Salar de Uyuni",lat:-20.13,lon:-67.5,kind:"mine",note:"world's largest lithium resources — pilot plants"}],
},
"Botswana":{
"Diamonds":[{name:"Jwaneng",lat:-24.6,lon:24.7,kind:"mine",note:"world's richest diamond mine (Debswana)"},{name:"Orapa & Letlhakane",lat:-21.3,lon:25.4,kind:"mine",note:""}],
},
"Brazil":{
"Iron ore":[{name:"Carajás, Pará",lat:-6.05,lon:-50.17,kind:"mine",note:"Vale — world's largest iron-ore complex"},{name:"Iron Quadrangle, Minas Gerais",lat:-20.3,lon:-43.8,kind:"mine",note:""}],
"Gold":[{name:"Minas Gerais belt",lat:-20.0,lon:-44.0,kind:"mine",note:"AngloGold Cuiabá, Kinross Paracatu"}],
"Bauxite":[{name:"Paragominas & Trombetas, Pará",lat:-2.0,lon:-54.7,kind:"mine",note:""}],
"Niobium":[{name:"Araxá & Catalão, Minas Gerais/Goiás",lat:-19.6,lon:-46.9,kind:"mine",note:"CBMM — ~90% of world supply"}],
},
"Bulgaria":{
"Copper":[{name:"Panagyurishte — Asarel, Elatsite",lat:42.5,lon:24.2,kind:"mine",note:""},{name:"Chelopech (Dundee)",lat:42.7,lon:23.7,kind:"mine",note:""}],
"Zinc & lead":[{name:"Kardzhali",lat:41.65,lon:25.4,kind:"refinery",note:""}],
},
"Cameroon":{
"Gold (artisanal)":[{name:"Betaré Oya & artisanal east",lat:5.8,lon:14.1,kind:"mine",note:""}],
"Bauxite & iron (undeveloped)":[{name:"Mbalam (project)",lat:2.2,lon:13.2,kind:"mine",note:""}],
},
"Canada":{
"Gold":[{name:"Canadian Malartic, Quebec",lat:48.13,lon:-78.13,kind:"mine",note:"Agnico Eagle"},{name:"Detour Lake, Ontario",lat:50.0,lon:-79.7,kind:"mine",note:""}],
"Potash":[{name:"Nutrien Rocanville, Saskatchewan",lat:50.4,lon:-101.7,kind:"mine",note:"world's largest potash facility"},{name:"Mosaic Esterhazy",lat:50.65,lon:-102.1,kind:"mine",note:""}],
"Nickel & copper":[{name:"Sudbury Basin, Ontario",lat:46.5,lon:-81.0,kind:"mine",note:"Vale & Glencore"},{name:"Voisey's Bay, Labrador",lat:56.3,lon:-62.1,kind:"mine",note:""}],
"Uranium":[{name:"Cigar Lake, Saskatchewan",lat:58.07,lon:-104.5,kind:"mine",note:"highest-grade uranium mine"},{name:"McArthur River",lat:57.77,lon:-105.03,kind:"mine",note:""}],
"Iron ore":[{name:"Labrador Trough (IOC, Carol Lake)",lat:52.9,lon:-67.0,kind:"mine",note:""}],
},
"Chad":{
"Gold":[{name:"Manda & Pala artisanal",lat:9.35,lon:15.0,kind:"mine",note:""}],
},
"Chile":{
"Copper":[{name:"Escondida, Antofagasta",lat:-24.27,lon:-69.07,kind:"mine",note:"World's largest copper mine"},{name:"Codelco Chuquicamata",lat:-22.3,lon:-68.9,kind:"mine",note:""},{name:"Collahuasi",lat:-20.9,lon:-68.6,kind:"mine",note:""}],
"Lithium":[{name:"Salar de Atacama",lat:-23.6,lon:-68.25,kind:"mine",note:"SQM & Albemarle brine operations"}],
},
"China":{
"Coal":[{name:"Datong & Ordos basins",lat:40.1,lon:111.7,kind:"mine",note:"Shanxi/Inner Mongolia heartland"}],
"Rare earths":[{name:"Bayan Obo, Inner Mongolia",lat:41.77,lon:109.97,kind:"mine",note:"World's largest rare-earth mine"},{name:"Ganzhou ionic clays",lat:25.8,lon:114.9,kind:"mine",note:"heavy rare earths"}],
"Gold":[{name:"Shandong (Zhaojin/Shandong Gold)",lat:37.4,lon:120.4,kind:"mine",note:"top producing province"}],
"Tungsten & other metals":[{name:"Ganzhou tungsten belt",lat:25.7,lon:114.8,kind:"mine",note:"world's tungsten capital"}],
},
"Colombia":{
"Gold":[{name:"Buriticá, Antioquia",lat:6.7,lon:-75.9,kind:"mine",note:"Zijin"},{name:"Segovia-Remedios",lat:7.1,lon:-74.7,kind:"mine",note:"Gran Colombia Gold"}],
"Nickel":[{name:"Cerro Matoso, Córdoba",lat:7.9,lon:-75.6,kind:"mine",note:""}],
"Emeralds":[{name:"Muzo & Chivor, Boyacá",lat:5.5,lon:-73.35,kind:"mine",note:"~90% of world emeralds"}],
},
"Congo":{
"Potash":[{name:"Kola & Sintoukola (projects)",lat:-4.1,lon:12.0,kind:"mine",note:""}],
"Iron ore":[{name:"Zanaga & Mayoko (projects)",lat:-2.9,lon:13.6,kind:"mine",note:""}],
},
"Dem. Rep. Congo":{
"Copper":[{name:"Kolwezi, Lualaba",lat:-10.7,lon:25.5,kind:"mine",note:"Kamoto, Tenke Fungurume (CMOC)"},{name:"Mutanda",lat:-10.8,lon:25.8,kind:"mine",note:"Glencore"}],
"Cobalt":[{name:"Tenke Fungurume",lat:-10.55,lon:26.15,kind:"mine",note:"world's largest cobalt mine"},{name:"Mutanda",lat:-10.8,lon:25.8,kind:"mine",note:""}],
"Gold":[{name:"Kibali, Ituri",lat:3.1,lon:29.6,kind:"mine",note:"Barrick/AngloGold"}],
"Coltan & other":[{name:"Bisie, North Kivu",lat:-1.0,lon:28.0,kind:"mine",note:"cassiterite"},{name:"Rubaya coltan belt",lat:-1.6,lon:28.9,kind:"mine",note:""}],
},
"Ecuador":{
"Copper":[{name:"Mirador, Zamora-Chinchipe",lat:-3.6,lon:-78.9,kind:"mine",note:"CRCC-Tongguan"},{name:"Fruta del Norte (gold)",lat:-3.8,lon:-78.4,kind:"mine",note:"Lundin Gold"}],
"Gold":[{name:"Fruta del Norte",lat:-3.8,lon:-78.4,kind:"mine",note:""},{name:"Zaruma-Portovelo",lat:-3.7,lon:-79.6,kind:"mine",note:""}],
},
"Egypt":{
"Gold":[{name:"Sukari, Eastern Desert (Centamin)",lat:24.95,lon:34.7,kind:"mine",note:""},{name:"Hamash",lat:24.3,lon:34.6,kind:"mine",note:""}],
"Phosphate":[{name:"Abu Tartur, New Valley",lat:25.5,lon:30.1,kind:"mine",note:""}],
"Titanium sands & other":[{name:"Rosetta & Rashid black sands",lat:31.4,lon:30.4,kind:"mine",note:""}],
},
"Eq. Guinea":{
"Gold (artisanal)":[{name:"Mongomo & Aconibe placer fields",lat:1.7,lon:11.3,kind:"mine",note:""}],
},
"Ethiopia":{
"Gold":[{name:"Lega Dembi & Sakaro, Oromia",lat:5.5,lon:38.8,kind:"mine",note:""},{name:"Tulu Kapi (project)",lat:8.9,lon:34.6,kind:"mine",note:""}],
"Tantalum":[{name:"Kenticha, Oromia",lat:5.6,lon:38.1,kind:"mine",note:""}],
},
"Fiji":{
"Gold":[{name:"Vatukoula, Viti Levu",lat:-17.5,lon:177.85,kind:"mine",note:""}],
"Bauxite & other":[{name:"Nawailevu, Bua",lat:-16.7,lon:178.7,kind:"mine",note:""}],
},
"Finland":{
"Nickel & cobalt":[{name:"Terrafame, Sotkamo",lat:64.1,lon:27.9,kind:"mine",note:""},{name:"Kevitsa, Sodankylä",lat:67.7,lon:26.9,kind:"mine",note:"Boliden"}],
"Chrome":[{name:"Kemi",lat:65.75,lon:24.55,kind:"mine",note:"only EU chrome mine (Outokumpu)"}],
"Gold":[{name:"Kittilä",lat:67.94,lon:25.35,kind:"mine",note:"largest gold mine in Europe (Agnico)"}],
"Lithium (new)":[{name:"Keliber — Kaustinen/Kokkola",lat:63.9,lon:23.7,kind:"mine",note:"Sibanye-Stillwater"}],
},
"Gabon":{
"Manganese":[{name:"Moanda (Comilog/Eramet)",lat:-1.57,lon:13.2,kind:"mine",note:"2nd world"},{name:"Franceville",lat:-1.63,lon:13.58,kind:"refinery",note:""}],
"Gold":[{name:"Bétébété & artisanal",lat:0.4,lon:13.0,kind:"mine",note:""}],
},
"Germany":{
"Lignite & coal":[{name:"Rhineland — Garzweiler & Hambach (RWE)",lat:51.05,lon:6.5,kind:"mine",note:""},{name:"Lusatia",lat:51.6,lon:14.4,kind:"mine",note:""}],
"Potash & salt":[{name:"K+S — Werra & Zielitz",lat:51.1,lon:10.1,kind:"mine",note:""}],
},
"Ghana":{
"Gold":[{name:"Tarkwa & Damang",lat:5.3,lon:-2.0,kind:"mine",note:"Gold Fields"},{name:"Obuasi",lat:6.2,lon:-1.66,kind:"mine",note:"AngloGold"},{name:"Ahafo",lat:7.0,lon:-2.35,kind:"mine",note:"Newmont"}],
"Bauxite":[{name:"Awaso",lat:5.27,lon:-2.27,kind:"mine",note:""}],
},
"Greece":{
"Lignite":[{name:"Ptolemaida & Megalopoli",lat:40.5,lon:21.7,kind:"mine",note:""}],
"Nickel":[{name:"Larco — Larymna",lat:38.6,lon:23.3,kind:"refinery",note:""}],
"Bauxite":[{name:"Parnassus-Ghiona",lat:38.7,lon:22.6,kind:"mine",note:""}],
},
"Guinea":{
"Bauxite":[{name:"Boké — Sangarédi (CBG)",lat:11.1,lon:-14.1,kind:"mine",note:"world's largest bauxite exporter"},{name:"Kindia",lat:10.05,lon:-12.85,kind:"mine",note:""}],
"Gold":[{name:"Siguiri",lat:11.4,lon:-9.17,kind:"mine",note:"AngloGold"}],
"Iron ore (Simandou ramping)":[{name:"Simandou, Nzérékoré",lat:8.55,lon:-9.1,kind:"mine",note:"Rio Tinto/Winning — largest undeveloped"}],
},
"India":{
"Coal":[{name:"Jharia & Raniganj, Jharkhand/WB",lat:23.7,lon:86.4,kind:"mine",note:""},{name:"Korba, Chhattisgarh",lat:22.35,lon:82.7,kind:"mine",note:""}],
"Iron ore":[{name:"Bailadila, Chhattisgarh",lat:18.7,lon:81.2,kind:"mine",note:""},{name:"Keonjhar, Odisha",lat:21.6,lon:85.6,kind:"mine",note:""},{name:"Bellary, Karnataka",lat:15.15,lon:76.9,kind:"mine",note:""}],
"Bauxite":[{name:"Panchpatmali, Odisha",lat:18.8,lon:82.9,kind:"mine",note:"NALCO"},{name:"Lanjigarh refinery",lat:19.7,lon:83.4,kind:"refinery",note:"Vedanta"}],
},
"Indonesia":{
"Nickel":[{name:"Morowali, Sulawesi (IMIP)",lat:-2.9,lon:121.6,kind:"mine",note:"Tsingshan industrial park"},{name:"Weda Bay, Halmahera",lat:0.5,lon:127.9,kind:"mine",note:""},{name:"Sorowako",lat:-2.55,lon:121.35,kind:"mine",note:"Vale"}],
"Copper & gold":[{name:"Grasberg, Papua",lat:-4.05,lon:137.12,kind:"mine",note:"Freeport — largest gold & 2nd copper"},{name:"Batu Hijau, Sumbawa",lat:-8.97,lon:116.87,kind:"mine",note:""}],
"Tin":[{name:"Bangka-Belitung",lat:-2.1,lon:106.1,kind:"mine",note:"PT Timah"}],
},
"Iran":{
"Copper":[{name:"Sarcheshmeh, Kerman",lat:29.9,lon:55.9,kind:"mine",note:""},{name:"Sungun, East Azerbaijan",lat:38.7,lon:46.8,kind:"mine",note:""}],
"Iron ore":[{name:"Golgohar, Kerman",lat:29.2,lon:55.3,kind:"mine",note:""},{name:"Chadormalu, Yazd",lat:32.3,lon:54.6,kind:"mine",note:""}],
"Zinc & lead":[{name:"Angouran, Zanjan",lat:36.6,lon:47.4,kind:"mine",note:""}],
},
"Iraq":{
"Sulfur":[{name:"Mishraq, Nineveh",lat:36.0,lon:43.1,kind:"mine",note:""}],
"Phosphate":[{name:"Akashat, Anbar",lat:33.7,lon:40.0,kind:"mine",note:""}],
},
"Israel":{
"Potash":[{name:"Dead Sea Works, Sodom (ICL)",lat:31.0,lon:35.4,kind:"refinery",note:""}],
"Bromine":[{name:"Dead Sea — Sodom",lat:31.0,lon:35.4,kind:"refinery",note:"world's largest bromine producer"}],
},
"Italy":{
"Marble & dimension stone":[{name:"Carrara quarries, Tuscany",lat:44.08,lon:10.1,kind:"mine",note:"world-famous white marble"}],
"Feldspar & industrial minerals":[{name:"Sardinia — Sulcis-Iglesiente (historic mining)",lat:39.2,lon:8.5,kind:"mine",note:""}],
},
"Kazakhstan":{
"Uranium":[{name:"Inkai & Muyunkum, Kyzylorda region",lat:45.2,lon:64.5,kind:"mine",note:"Kazatomprom — 40% of world output"},{name:"Tortkuduk",lat:44.7,lon:65.4,kind:"mine",note:""}],
"Copper":[{name:"Bozshakol & Aktogay, Pavlodar/East",lat:51.9,lon:75.3,kind:"mine",note:"KAZ Minerals"}],
"Iron ore & chromite":[{name:"Kostanay (Sokolov-Sarbai)",lat:53.2,lon:63.6,kind:"mine",note:""},{name:"Aktobe ferrochrome",lat:50.3,lon:57.2,kind:"refinery",note:""}],
},
"Kenya":{
"Soda ash":[{name:"Lake Magadi (Tata Chemicals)",lat:-1.9,lon:36.3,kind:"mine",note:""}],
"Titanium sands":[{name:"Kwale (Base Resources, closed 2024)",lat:-4.2,lon:39.45,kind:"mine",note:""}],
"Gold":[{name:"Kakamega artisanal",lat:0.3,lon:34.75,kind:"mine",note:""}],
"Fluorspar & other":[{name:"Kerio Valley",lat:0.6,lon:35.6,kind:"mine",note:""}],
},
"Kyrgyzstan":{
"Gold":[{name:"Kumtor",lat:41.87,lon:78.2,kind:"mine",note:"10%+ of GDP — Centerra/state"}],
},
"Malaysia":{
"Tin":[{name:"Kinta Valley, Perak",lat:4.6,lon:101.1,kind:"mine",note:"historic"}],
"Rare-earth processing":[{name:"Lynas plant, Gebeng (Pahang)",lat:3.95,lon:103.4,kind:"refinery",note:"largest outside China"}],
"Bauxite & gold":[{name:"Bukit Goh, Kuantan",lat:3.8,lon:103.3,kind:"mine",note:""}],
},
"Mali":{
"Gold":[{name:"Loulo-Gounkoto",lat:13.1,lon:-11.35,kind:"mine",note:"Barrick"},{name:"Fekola",lat:12.8,lon:-11.5,kind:"mine",note:"B2Gold"}],
"Lithium (new)":[{name:"Goulamina",lat:11.5,lon:-8.3,kind:"mine",note:"spodumene, ramping"}],
},
"Mauritania":{
"Iron ore":[{name:"Zouérat (SNIM)",lat:22.73,lon:-12.48,kind:"mine",note:"Guelb el Rhein, M'Haoudat"},{name:"Nouadhibou port",lat:20.9,lon:-17.0,kind:"refinery",note:"export terminal"}],
"Gold":[{name:"Tasiast",lat:20.55,lon:-15.5,kind:"mine",note:"Kinross"}],
},
"Mexico":{
"Silver":[{name:"Fresnillo & Saucito, Zacatecas",lat:23.17,lon:-102.87,kind:"mine",note:"world's largest silver mine"},{name:"Peñasquito",lat:24.6,lon:-101.7,kind:"mine",note:"Newmont"}],
"Gold":[{name:"Peñasquito",lat:24.6,lon:-101.7,kind:"mine",note:""},{name:"Mulatos & Los Filos",lat:28.7,lon:-108.5,kind:"mine",note:""}],
"Copper":[{name:"Cananea & La Caridad, Sonora",lat:30.98,lon:-110.3,kind:"mine",note:"Grupo México"},{name:"Buenavista del Cobre",lat:30.98,lon:-110.35,kind:"mine",note:""}],
},
"Mongolia":{
"Coal":[{name:"Tavan Tolgoi, South Gobi",lat:43.6,lon:105.5,kind:"mine",note:"giant coking-coal deposit"}],
"Copper":[{name:"Oyu Tolgoi, South Gobi",lat:43.0,lon:106.85,kind:"mine",note:"Rio Tinto — one of world's largest"}],
"Gold":[{name:"Oyu Tolgoi gold credits",lat:43.0,lon:106.85,kind:"mine",note:""},{name:"Bornuur placer belt",lat:48.3,lon:106.3,kind:"mine",note:""}],
},
"Mozambique":{
"Graphite":[{name:"Balama, Cabo Delgado (Syrah)",lat:-13.3,lon:38.6,kind:"mine",note:"world's largest graphite mine"}],
"Titanium sands":[{name:"Moma, Nampula (Kenmare)",lat:-16.6,lon:39.1,kind:"mine",note:"world's largest ilmenite mine"}],
"Rubies & gemstones":[{name:"Montepuez (Gemfields)",lat:-13.1,lon:39.0,kind:"mine",note:"world's largest ruby deposit"}],
},
"Myanmar":{
"Jade":[{name:"Hpakant, Kachin",lat:25.6,lon:96.3,kind:"mine",note:"world's top jade source"}],
"Rare earths":[{name:"Kachin ionic-clay belt — Chipwi/Pangwa",lat:25.9,lon:98.1,kind:"mine",note:""}],
"Tin & tungsten":[{name:"Dawei & Mawchi",lat:14.1,lon:98.2,kind:"mine",note:""}],
},
"Namibia":{
"Uranium":[{name:"Rössing",lat:-22.5,lon:15.05,kind:"mine",note:"CNNC"},{name:"Husab",lat:-22.7,lon:15.05,kind:"mine",note:"world-class open pit"}],
"Diamonds":[{name:"Oranjemund coastal mines",lat:-28.55,lon:16.43,kind:"mine",note:"Namdeb"}],
"Gold & lithium":[{name:"Karibib & Uis belt",lat:-21.8,lon:15.85,kind:"mine",note:"tin-lithium"}],
},
"New Zealand":{
"Gold":[{name:"Macraes, Otago (OceanaGold)",lat:-45.4,lon:170.4,kind:"mine",note:""},{name:"Waihi",lat:-37.4,lon:175.85,kind:"mine",note:""}],
"Iron sands":[{name:"Taharoa & Waikato North Head",lat:-38.2,lon:174.8,kind:"mine",note:""}],
},
"Niger":{
"Uranium":[{name:"Arlit & Akokan (SOMAÏR/COMINAK)",lat:18.75,lon:7.35,kind:"mine",note:""},{name:"Imouraren (project)",lat:19.1,lon:7.9,kind:"mine",note:"world-class deposit"}],
"Gold":[{name:"Samira Hill",lat:13.5,lon:2.1,kind:"mine",note:""}],
},
"Nigeria":{
"Gold":[{name:"Segilola, Osun (Thor)",lat:7.5,lon:4.9,kind:"mine",note:""},{name:"Zamfara artisanal belt",lat:12.2,lon:6.3,kind:"mine",note:""}],
"Tin & columbite":[{name:"Jos Plateau",lat:9.9,lon:8.9,kind:"mine",note:""}],
"Limestone & aggregates":[{name:"Obajana & Ewekoro cement plants",lat:7.9,lon:6.4,kind:"mine",note:""}],
},
"North Korea":{
"Coal":[{name:"Pyongan coalfields",lat:39.9,lon:125.7,kind:"mine",note:""}],
"Iron ore":[{name:"Musan",lat:42.2,lon:129.2,kind:"mine",note:"largest open pit in Asia"}],
"Magnesite":[{name:"Tanchon",lat:40.5,lon:128.9,kind:"mine",note:"world #2 magnesite"}],
},
"Norway":{
"Titanium":[{name:"Tellnes, Sokndal (Titania)",lat:58.35,lon:6.3,kind:"mine",note:"world's largest ilmenite mine"}],
"Aluminum":[{name:"Hydro smelters — Sunndal, Karmøy, Årdal",lat:62.7,lon:8.6,kind:"refinery",note:""}],
},
"Oman":{
"Copper":[{name:"Sohar — Al Hadeetha & Mawarid",lat:24.35,lon:56.7,kind:"mine",note:""}],
"Chromite":[{name:"Samail ophiolite belt",lat:23.3,lon:57.9,kind:"mine",note:""}],
"Gypsum & limestone":[{name:"Thumrait & Salalah",lat:17.6,lon:54.0,kind:"mine",note:""}],
},
"Papua New Guinea":{
"Gold":[{name:"Porgera, Enga",lat:-5.47,lon:143.08,kind:"mine",note:"Barrick"},{name:"Lihir Island",lat:-3.13,lon:152.65,kind:"mine",note:"Newmont"},{name:"Ok Tedi",lat:-5.2,lon:141.15,kind:"mine",note:""}],
"Copper":[{name:"Ok Tedi, Western Province",lat:-5.2,lon:141.15,kind:"mine",note:""},{name:"Frieda River (project)",lat:-4.6,lon:141.9,kind:"mine",note:""}],
"Nickel & cobalt":[{name:"Ramu, Madang",lat:-5.7,lon:145.5,kind:"mine",note:""}],
},
"Peru":{
"Copper":[{name:"Cerro Verde, Arequipa",lat:-16.5,lon:-71.6,kind:"mine",note:"Freeport-McMoRan"},{name:"Las Bambas, Apurímac",lat:-14.2,lon:-72.3,kind:"mine",note:"MMG"},{name:"Antamina, Ancash",lat:-9.5,lon:-77.1,kind:"mine",note:"BHP/Glencore"}],
"Gold":[{name:"Yanacocha, Cajamarca",lat:-6.95,lon:-78.55,kind:"mine",note:"Newmont — largest in S. America"}],
"Zinc":[{name:"Antamina",lat:-9.5,lon:-77.1,kind:"mine",note:"zinc-copper"},{name:"Cerro de Pasco",lat:-10.68,lon:-76.26,kind:"mine",note:"historic silver-zinc"}],
},
"Philippines":{
"Nickel":[{name:"Surigao — Taganito & Cagdianao",lat:9.4,lon:125.9,kind:"mine",note:"world #2 producer"},{name:"Rio Tuba, Palawan",lat:8.5,lon:117.4,kind:"mine",note:""}],
"Gold":[{name:"Didipio, Nueva Vizcaya",lat:16.35,lon:121.45,kind:"mine",note:""},{name:"Padcal, Benguet",lat:16.4,lon:120.75,kind:"mine",note:""}],
},
"Poland":{
"Coal":[{name:"Upper Silesia — Katowice region",lat:50.25,lon:19.0,kind:"mine",note:""},{name:"Bełchatów lignite",lat:51.27,lon:19.35,kind:"mine",note:""}],
"Copper":[{name:"Legnica-Głogów basin (KGHM)",lat:51.6,lon:16.0,kind:"mine",note:"largest copper producer in Europe"},{name:"Polkowice-Sieroszowice",lat:51.5,lon:15.95,kind:"mine",note:""}],
"Silver":[{name:"KGHM by-product",lat:51.6,lon:16.0,kind:"mine",note:"top-3 world silver"}],
},
"Portugal":{
"Copper":[{name:"Neves-Corvo, Alentejo (Lundin)",lat:37.57,lon:-7.96,kind:"mine",note:""},{name:"Aljustrel",lat:37.9,lon:-8.2,kind:"mine",note:""}],
"Tungsten":[{name:"Panasqueira, Fundão",lat:40.05,lon:-7.73,kind:"mine",note:""}],
"Lithium (new)":[{name:"Barroso, Boticas (Savannah, contested)",lat:41.7,lon:-7.7,kind:"mine",note:""}],
},
"Qatar":{
"Aluminum":[{name:"Qatalum, Mesaieed",lat:25.0,lon:51.55,kind:"refinery",note:""}],
},
"Romania":{
"Copper":[{name:"Roșia Poieni & Moldova Nouă",lat:46.1,lon:23.2,kind:"mine",note:""}],
"Gold & silver":[{name:"Roșia Montană (blocked)",lat:46.3,lon:23.1,kind:"mine",note:""},{name:"Certej",lat:45.95,lon:22.98,kind:"mine",note:""}],
},
"Russia":{
"Nickel & palladium":[{name:"Norilsk, Krasnoyarsk",lat:69.35,lon:88.2,kind:"mine",note:"Nornickel — 40% of world palladium"},{name:"Kola Peninsula (Pechenga)",lat:69.6,lon:31.2,kind:"mine",note:""}],
"Diamonds":[{name:"Mirny & Udachny, Yakutia",lat:62.5,lon:113.9,kind:"mine",note:"ALROSA"},{name:"Lomonosov, Arkhangelsk",lat:64.9,lon:40.9,kind:"mine",note:""}],
"Gold":[{name:"Krasnoyarsk & Magadan fields",lat:56.0,lon:93.0,kind:"mine",note:"Polyus Olimpiada, Blagodatnoye"},{name:"Olimpiada",lat:60.7,lon:92.7,kind:"mine",note:"Russia's largest gold mine"}],
"Potash & iron ore":[{name:"Solikamsk, Perm Krai",lat:59.65,lon:56.77,kind:"mine",note:"Uralkali"},{name:"Kursk Magnetic Anomaly",lat:51.7,lon:36.1,kind:"mine",note:""}],
},
"Saudi Arabia":{
"Phosphate":[{name:"Ras Al Khair / Wa'ad Al Shamal",lat:27.5,lon:48.9,kind:"mine",note:"Ma'aden phosphate city"}],
"Gold":[{name:"Mahd adh-Dhahab",lat:23.5,lon:40.9,kind:"mine",note:"historic"}],
"Bauxite & aluminum":[{name:"Al Ba'itha mine + Ras Al Khair smelter",lat:27.5,lon:48.9,kind:"refinery",note:"Ma'aden integrated complex"}],
},
"Senegal":{
"Phosphate":[{name:"Taïba & Matam (ICS)",lat:14.6,lon:-17.0,kind:"mine",note:""}],
"Zircon & titanium sands":[{name:"Grande Côte, Diogo (Eramet)",lat:14.9,lon:-17.1,kind:"mine",note:""}],
"Gold":[{name:"Sabodala",lat:13.2,lon:-12.1,kind:"mine",note:""}],
},
"Serbia":{
"Copper":[{name:"Bor (Zijin)",lat:44.13,lon:22.1,kind:"mine",note:""},{name:"Čukaru Peki (Timok)",lat:44.2,lon:22.1,kind:"mine",note:"Zijin high-grade"}],
"Gold & silver":[{name:"Čukaru Peki",lat:44.2,lon:22.1,kind:"mine",note:""},{name:"Majdanpek",lat:44.4,lon:21.9,kind:"mine",note:""}],
"Lithium (blocked)":[{name:"Jadar, Loznica",lat:44.55,lon:19.3,kind:"mine",note:"Rio Tinto — contested"}],
},
"South Africa":{
"Platinum group metals":[{name:"Rustenburg belt",lat:-25.7,lon:27.25,kind:"mine",note:"Anglo American, Impala"},{name:"Bushveld — Marikana",lat:-25.65,lon:27.5,kind:"mine",note:""}],
"Gold":[{name:"Witwatersrand basin",lat:-26.2,lon:28.0,kind:"mine",note:"historic heartland — Mponeng, South Deep"},{name:"South Deep",lat:-26.4,lon:27.65,kind:"mine",note:"world's deepest"}],
"Chrome":[{name:"Bushveld Complex, Steelpoort",lat:-24.8,lon:30.1,kind:"mine",note:"~80% of world reserves"}],
"Manganese & iron ore":[{name:"Kalahari field, Kuruman",lat:-27.45,lon:23.4,kind:"mine",note:"manganese"},{name:"Sishen",lat:-27.8,lon:22.98,kind:"mine",note:"Kumba iron ore"}],
"Diamonds & other":[{name:"Kimberley (Big Hole / Venetia)",lat:-28.75,lon:24.77,kind:"mine",note:""}],
},
"Spain":{
"Copper":[{name:"Riotinto — Atalaya Mining",lat:37.7,lon:-6.6,kind:"mine",note:""},{name:"Cobre Las Cruces, Seville",lat:37.5,lon:-6.2,kind:"mine",note:""}],
"Tungsten":[{name:"Los Santos, Salamanca",lat:40.5,lon:-6.0,kind:"mine",note:""},{name:"Barruecopardo",lat:41.1,lon:-6.7,kind:"mine",note:""}],
},
"Sudan":{
"Gold":[{name:"Hassai, Red Sea Hills",lat:20.4,lon:36.0,kind:"mine",note:""},{name:"Jebel Amer artisanal, Darfur",lat:13.4,lon:24.0,kind:"mine",note:"RSF-controlled"}],
},
"Sweden":{
"Iron ore":[{name:"Kiruna",lat:67.86,lon:20.2,kind:"mine",note:"LKAB — world's largest underground iron mine"},{name:"Malmberget",lat:67.17,lon:20.65,kind:"mine",note:""}],
"Copper & zinc":[{name:"Aitik, Gällivare",lat:67.07,lon:20.96,kind:"mine",note:"Boliden"},{name:"Garpenberg",lat:60.3,lon:16.2,kind:"mine",note:""}],
},
"Tajikistan":{
"Aluminum":[{name:"TALCO, Tursunzoda",lat:38.5,lon:68.2,kind:"refinery",note:""}],
"Gold":[{name:"Zarafshan (JV)",lat:39.9,lon:68.7,kind:"mine",note:""},{name:"Pakrut",lat:39.4,lon:70.5,kind:"mine",note:""}],
"Silver & antimony":[{name:"Koni Mansur",lat:38.7,lon:71.4,kind:"mine",note:"giant silver deposit"}],
},
"Tanzania":{
"Gold":[{name:"Geita",lat:-2.87,lon:32.17,kind:"mine",note:"AngloGold"},{name:"North Mara",lat:-1.5,lon:34.5,kind:"mine",note:"Barrick"},{name:"Bulyanhulu",lat:-3.2,lon:34.6,kind:"mine",note:""}],
"Diamonds":[{name:"Williamson, Mwadui",lat:-3.5,lon:33.6,kind:"mine",note:""}],
},
"Thailand":{
"Gypsum":[{name:"Nakhon Sawan & Chaiyaphum fields",lat:15.8,lon:100.1,kind:"mine",note:""}],
"Tin":[{name:"Phuket-Phangnga belt (historic)",lat:8.0,lon:98.4,kind:"mine",note:""}],
"Potash (new)":[{name:"Bamnet Narong & Udon Thani (projects)",lat:15.5,lon:101.1,kind:"mine",note:""}],
"Zinc & other":[{name:"Mae Sot (Padaeng)",lat:16.7,lon:98.6,kind:"refinery",note:""}],
},
"Turkey":{
"Boron":[{name:"Eti Mine — Emet & Bigadiç, Kütahya",lat:39.3,lon:30.0,kind:"mine",note:"~70% of world boron reserves"},{name:"Kirka, Eskişehir",lat:39.3,lon:30.5,kind:"refinery",note:""}],
"Chromite":[{name:"Guleman, Elazığ",lat:38.7,lon:39.9,kind:"mine",note:""}],
"Gold & copper":[{name:"Çöpler, Erzincan",lat:39.4,lon:38.55,kind:"mine",note:""},{name:"Kışladağ, Uşak",lat:38.5,lon:29.4,kind:"mine",note:""}],
},
"Turkmenistan":{
"Iodine & bromine":[{name:"Balkanabat & Hazar plants",lat:39.5,lon:54.4,kind:"refinery",note:""}],
"Salt":[{name:"Garabogazgöl lagoon",lat:41.4,lon:53.0,kind:"mine",note:""}],
},
"Ukraine":{
"Iron ore":[{name:"Kryvyi Rih basin",lat:47.9,lon:33.35,kind:"mine",note:"ArcelorMittal, Metinvest"},{name:"Poltava GOK",lat:49.6,lon:34.55,kind:"mine",note:""}],
"Titanium":[{name:"Zhytomyr & Kirovohrad ilmenite",lat:50.3,lon:28.7,kind:"mine",note:""}],
},
"United Arab Emirates":{
"Aluminum":[{name:"EGA — Jebel Ali & Al Taweelah smelters",lat:25.0,lon:55.1,kind:"refinery",note:"top-5 world smelter"}],
},
"United Kingdom":{
"Tin & metals (revival)":[{name:"South Crofty, Cornwall (project)",lat:50.2,lon:-5.3,kind:"mine",note:""},{name:"Tungsten West — Hemerdon",lat:50.4,lon:-4.0,kind:"mine",note:""}],
},
"United States of America":{
"Copper":[{name:"Morenci, Arizona",lat:33.07,lon:-109.36,kind:"mine",note:"Freeport-McMoRan"},{name:"Bingham Canyon, Utah",lat:40.52,lon:-112.15,kind:"mine",note:"Rio Tinto Kennecott"}],
"Coal":[{name:"Powder River Basin, Wyoming — North Antelope Rochelle",lat:43.6,lon:-105.3,kind:"mine",note:"largest US coal mine"},{name:"Appalachia — West Virginia coalfields",lat:38.0,lon:-81.5,kind:"mine",note:"met & thermal coal"},{name:"Illinois Basin",lat:38.3,lon:-89.0,kind:"mine",note:""}],
"Iron ore":[{name:"Mesabi Range, Minnesota",lat:47.4,lon:-92.9,kind:"mine",note:"taconite iron ore"},{name:"Marquette Range, Michigan",lat:46.6,lon:-87.6,kind:"mine",note:""}],
"Gold":[{name:"Carlin Trend, Nevada",lat:40.8,lon:-116.2,kind:"mine",note:"Nevada Gold Mines"},{name:"Cortez, Nevada",lat:40.2,lon:-116.7,kind:"mine",note:""}],
"Lithium & rare earths":[{name:"Mountain Pass, California",lat:35.48,lon:-115.53,kind:"mine",note:"MP Materials rare earths"},{name:"Thacker Pass, Nevada",lat:41.7,lon:-119.0,kind:"mine",note:"lithium clay project"}],
},
"Uzbekistan":{
"Gold":[{name:"Muruntau, Kyzylkum",lat:41.5,lon:64.6,kind:"mine",note:"world's largest open-pit gold mine"},{name:"Almalyk",lat:40.85,lon:69.6,kind:"mine",note:""}],
"Uranium":[{name:"Navoi (Navoiyuran)",lat:40.1,lon:65.4,kind:"mine",note:""}],
"Copper":[{name:"Almalyk (AMMC)",lat:40.85,lon:69.6,kind:"refinery",note:""}],
},
"Venezuela":{
"Gold":[{name:"Orinoco Mining Arc — Las Cristinas, Brisas",lat:7.5,lon:-61.5,kind:"mine",note:""},{name:"El Callao",lat:7.35,lon:-61.8,kind:"mine",note:""}],
"Iron ore":[{name:"Cerro San Isidro / Los Barrancos, Bolívar",lat:8.0,lon:-62.8,kind:"mine",note:""}],
"Bauxite":[{name:"Los Pijiguaos, Bolívar",lat:6.6,lon:-66.8,kind:"mine",note:""}],
},
"Vietnam":{
"Coal":[{name:"Quảng Ninh — Cẩm Phả, Hạ Long",lat:21.0,lon:107.3,kind:"mine",note:""}],
"Bauxite":[{name:"Tân Rai & Nhân Cơ, Central Highlands",lat:11.9,lon:108.1,kind:"mine",note:"Vinacomin"}],
"Tin & titanium":[{name:"Cao Bằng & coastal sands",lat:22.7,lon:105.7,kind:"mine",note:""}],
},
"Zambia":{
"Copper":[{name:"Kitwe-Nkana, Copperbelt",lat:-12.8,lon:28.2,kind:"mine",note:""},{name:"Kansanshi, Solwezi",lat:-12.1,lon:26.4,kind:"mine",note:"First Quantum — largest in Africa"}],
"Emeralds & other":[{name:"Kagem, Copperbelt",lat:-13.0,lon:28.05,kind:"mine",note:"world's largest emerald mine (Gemfields)"}],
},
"Zimbabwe":{
"Lithium":[{name:"Bikita Minerals",lat:-20.1,lon:31.6,kind:"mine",note:"Africa's largest lithium mine"},{name:"Arcadia",lat:-17.8,lon:31.1,kind:"mine",note:""}],
"Platinum":[{name:"Great Dyke — Mimosa, Unki, Zimplats",lat:-19.5,lon:30.0,kind:"mine",note:""}],
"Gold":[{name:"Kwekwe & Kadoma fields",lat:-18.9,lon:29.8,kind:"mine",note:""}],
},
};

const STOP = new Set(["ore", "and", "the", "of", "other", "mining", "output", "use", "non", "fuel", "metal", "metals", "mineral", "minerals", "gems", "gemstones", "precious", "rare", "earths", "earth", "production", "etc", "mixed", "various", "stone", "stones", "nonfuel"]);

function tokens(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t && !STOP.has(t));
}

/** Look up sites for a minerals-chart label: exact key first, then word-overlap match. */
export function findMineSites(country: string, label: string): MineSite[] {
  const table = MINES[country];
  if (!table) return [];
  if (table[label]) return table[label];
  const lt = tokens(label);
  let best: MineSite[] = [];
  let bestScore = 0;
  for (const [key, sites] of Object.entries(table)) {
    const kt = tokens(key);
    const score = kt.filter((t) => lt.includes(t)).length + lt.filter((t) => kt.includes(t)).length;
    if (score > bestScore) {
      bestScore = score;
      best = sites;
    }
  }
  return bestScore > 0 ? best : [];
}