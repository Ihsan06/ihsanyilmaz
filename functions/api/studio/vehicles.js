// Cloudflare Pages Function — GET /api/vehicles
// Liefert den Fahrzeugbestand im normalisierten Format für die Galerie.
//
// Zwei Modi (Frontend bleibt identisch):
//   1) LIVE  – wenn MOBILE_API_USER + MOBILE_API_PASSWORD gesetzt sind:
//              ruft die offizielle mobile.de Search-API (Ad-Integration) per
//              HTTP-Basic-Auth ab und mappt die Ads mit mapMobileAd().
//   2) DEMO  – sonst: liefert Beispiel-Fahrzeuge im selben mobile.de-Format,
//              gemappt mit DERSELBEN mapMobileAd()-Funktion.
//
// Umstieg auf echt = nur Env-Variablen setzen:
//   MOBILE_API_USER, MOBILE_API_PASSWORD, MOBILE_SELLER_ID

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=300'
};

export async function onRequestGet({ env }) {
  try {
    const { live, vehicles: full } = await fetchVehicleList(env);
    // Wie bei der echten mobile.de-Suche trägt die Liste nur das Titelbild; die
    // komplette Galerie holt die Detailseite (functions/fahrzeug/[id].js) selbst.
    // Die Demo spiegelt dieses Verhalten (nur Bild 1).
    const vehicles = live ? full : full.map(v => ({ ...v, images: v.images.slice(0, 1) }));
    return new Response(JSON.stringify({ ok: true, demo: !live, count: vehicles.length, vehicles }), { headers: JSON_HEADERS });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: 'Fahrzeuge konnten nicht geladen werden.', detail: String(e) }), { status: 502, headers: JSON_HEADERS });
  }
}

// Gemeinsamer Listen-Abruf (live oder Demo) -> gemappte Fahrzeuge mit voller
// Bildliste. Wird von /api/vehicles und von der Detailseite (Ähnliche Fahrzeuge)
// genutzt. Wirft bei Live-Fehlern; Aufrufer fangen selbst ab.
export async function fetchVehicleList(env) {
  const live = env.MOBILE_API_USER && env.MOBILE_API_PASSWORD;
  const ads = live ? await fetchMobileAds(env) : DEMO_ADS;
  return { live, vehicles: ads.map(mapMobileAd).filter(Boolean) };
}

// ─── Gemeinsame mobile.de-Header (Basic-Auth + Media-Type) ───
// Auch vom Detail-Endpoint /api/vehicle genutzt.
export function mobileHeaders(env) {
  return {
    Authorization: 'Basic ' + btoa(`${env.MOBILE_API_USER}:${env.MOBILE_API_PASSWORD}`),
    // mobile.de Search-API verlangt ihren eigenen Media-Type (sonst HTTP 406)
    Accept: 'application/vnd.de.mobile.api+json',
    'Accept-Language': 'de'
  };
}

// ─── Live: mobile.de Search-API (Ad-Integration) ───
async function fetchMobileAds(env) {
  // Mit Händler-Login liefert die Search-API automatisch den eigenen Bestand.
  // Hinweis: ein customerId-Query-Param führt hier zu HTTP 405 – daher weglassen.
  const params = new URLSearchParams();
  params.set('page.size', '100');

  const res = await fetch(`https://services.mobile.de/search-api/search?${params}`, {
    headers: mobileHeaders(env)
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`mobile.de API ${res.status} ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  // Struktur kann je nach API-Variante leicht abweichen; defensiv auslesen.
  return data?.['search-result']?.ads?.ad
      ?? data?.ads?.ad
      ?? data?.ads
      ?? [];
}

// ─── Mapping mobile.de-Ad -> normalisiertes Fahrzeug ───
// Liest Felder defensiv mit Fallbacks, damit Demo und Live dieselbe Logik nutzen.
// Auch von der Fahrzeug-Detailseite (functions/fahrzeug/[id].js) genutzt.
export function mapMobileAd(ad) {
  if (!ad) return null;

  const priceVal = num(ad?.price?.consumerPriceGross ?? ad?.price?.amount ?? ad?.price);
  const images = extractImages(ad);
  const reg = ad.firstRegistration ?? ad.firstRegistrationDate ?? '';

  return {
    id: String(ad.mobileAdId ?? ad.adId ?? ad.id ?? cryptoId()),
    make: ad.make ?? '',
    model: ad.model ?? '',
    title: [ad.make, ad.model, ad.modelDescription].filter(Boolean).join(' ').trim() || (ad.modelDescription ?? 'Fahrzeug'),
    description: ad.modelDescription ?? '',
    price: priceVal,
    priceLabel: ad?.price?.type ?? ad.priceRating ?? '',
    firstRegistration: formatReg(reg),
    firstRegistrationSort: regSort(reg),
    mileage: num(ad.mileage),
    powerKw: num(ad.power),
    powerPs: ad.power ? Math.round(num(ad.power) * 1.35962) : null,
    fuel: ad.fuel ?? '',
    gearbox: ad.gearbox ?? '',
    category: kategorieDe(ad.vehicleCategory ?? ad.category ?? ''),
    features: extractFeatures(ad),
    images,
    mobileUrl: ad.detailPageUrl ?? ad.url ?? 'https://home.mobile.de/ADW',
    vat: extractVat(ad)
  };
}

// Fahrzeugart auf Deutsch. mobile.de liefert hier englische Schluessel
// ("EstateCar", "StakeBodyAndTarpaulinTruck"), die bisher unveraendert auf
// der Fahrzeugseite standen – bei den PKW faellt das kaum auf, weil
// "Limousine" und "Van" zufaellig auch deutsch sind, bei den Nutzfahrzeugen
// dagegen sofort. Die Begriffe sind die, die mobile.de selbst in seiner
// deutschen Oberflaeche benutzt.
//
// Unbekanntes bleibt unveraendert stehen: lieber ein englischer Begriff als
// eine falsche Uebersetzung. Taucht einer auf, gehoert er hier ergaenzt.
const KATEGORIE = {
  // PKW
  Limousine: 'Limousine',
  EstateCar: 'Kombi',
  SmallCar: 'Kleinwagen',
  OffRoad: 'SUV / Geländewagen',
  SportsCar: 'Sportwagen / Coupé',
  Cabrio: 'Cabrio / Roadster',
  Van: 'Van / Kleinbus',
  OtherCar: 'Andere',
  // Transporter bis 7,5 t
  BoxTypeDeliveryVan: 'Kastenwagen',
  HighBoxTypeDeliveryVan: 'Kastenwagen, hoch',
  LongBoxTypeDeliveryVan: 'Kastenwagen, lang',
  HighAndLongBoxTypeDeliveryVan: 'Kastenwagen, hoch und lang',
  EstateMinibusUpTo9Seats: 'Kleinbus bis 9 Sitze',
  EstateMinibusUpTo9SeatsVan: 'Kleinbus bis 9 Sitze',
  BoxVan: 'Koffer',
  StakeBodyAndTarpaulinVan: 'Pritsche / Plane',
  TipperVan: 'Kipper',
  RefrigeratorVan: 'Kühlwagen',
  PlatformVan: 'Pritsche',
  OtherVanUpTo7500: 'Transporter bis 7,5 t',
  // LKW und Auflieger
  StakeBodyAndTarpaulinTruck: 'Pritsche / Plane',
  StakeBodyAndTarpaulinSemiTrailer: 'Auflieger Pritsche / Plane',
  SwapChassisTruck: 'Wechselfahrgestell',
  SwapChassisSemiTrailer: 'Auflieger Wechselfahrgestell',
  DumperTruck: 'Kipper',
  BoxTruck: 'Koffer',
  RefrigeratorTruck: 'Kühlkoffer',
  TankTruck: 'Tankwagen',
  TractorUnit: 'Sattelzugmaschine',
  Pickup: 'Pick-up',
  Bus: 'Bus',
  OtherTruck: 'Andere'
};

const kategorieDe = c => KATEGORIE[c] || c || '';

// MwSt-Status ableiten:
//   Regelbesteuerung (MwSt ausweisbar)  -> price.consumerPriceNet + price.vatRate vorhanden
//   Differenzbesteuerung (§25a UStG)    -> nur Bruttopreis, kein Netto/vatRate
function extractVat(ad) {
  const p = ad?.price ?? {};
  const rate = num(p.vatRate);
  const net = num(p.consumerPriceNet ?? p.dealerPriceNet);
  const deductible = rate != null && rate > 0 && net != null;
  return { deductible, rate: deductible ? rate : null, net: deductible ? net : null };
}

export function extractImages(ad) {
  const imgs = ad?.images?.image ?? ad?.images ?? [];
  const arr = Array.isArray(imgs) ? imgs : [imgs];
  return arr
    .map(i => {
      if (typeof i === 'string') return i;
      // mobile.de Search-API: Bild-Objekt mit Größen icon/s/m/l/xl/xxl/xxxl
      return i?.xxl ?? i?.xl ?? i?.l ?? i?.m ?? i?.url ?? i?.ref ?? i?.['@uri'] ?? i?.s ?? null;
    })
    .filter(Boolean);
}

// Boolesche mobile.de-Ausstattungsfelder -> deutsche Labels.
const FEATURE_FIELDS = {
  abs: 'ABS', airbag: 'Airbags', alloyWheels: 'Leichtmetallfelgen',
  automaticRainSensor: 'Regensensor', bluetooth: 'Bluetooth', cdPlayer: 'CD-Player',
  centralLocking: 'Zentralverriegelung', electricAdjustableSeats: 'Elektr. Sitzeinstellung',
  electricExteriorMirrors: 'Elektr. Außenspiegel', electricHeatedSeats: 'Sitzheizung',
  electricWindows: 'Elektr. Fensterheber', esp: 'ESP', frontFogLights: 'Nebelscheinwerfer',
  handsFreePhoneSystem: 'Freisprecheinrichtung', immobilizer: 'Wegfahrsperre', isofix: 'Isofix',
  lightSensor: 'Lichtsensor', multifunctionalWheel: 'Multifunktionslenkrad',
  navigationSystem: 'Navigationssystem', onBoardComputer: 'Bordcomputer', radio: 'Radio',
  daytimeRunningLamps: 'Tagfahrlicht', sunroof: 'Schiebedach', tractionControlSystem: 'Traktionskontrolle',
  armRest: 'Armlehne', leatherSteeringWheel: 'Lederlenkrad', lumbarSupport: 'Lordosenstütze',
  tirePressureMonitoring: 'Reifendruckkontrolle', soundSystem: 'Soundsystem', voiceControl: 'Sprachsteuerung',
  usb: 'USB', winterTires: 'Winterreifen', winterPackage: 'Winterpaket',
  distanceWarningSystem: 'Abstandswarner', ambientLighting: 'Ambientebeleuchtung',
  integratedMusicStreaming: 'Musik-Streaming', cargoBarrier: 'Trenngitter',
  speedLimiter: 'Geschwindigkeitsbegrenzer', powerAssistedSteering: 'Servolenkung',
  navigationPreparation: 'Navigationsvorbereitung', fullServiceHistory: 'Scheckheftgepflegt',
  nonSmokerVehicle: 'Nichtraucherfahrzeug'
};

const truthy = v => v === true || v === 'true' || (Array.isArray(v) && v.length > 0)
  || (v && typeof v === 'object' && Object.keys(v).length > 0)
  || (typeof v === 'string' && v && v !== 'false');

// Ausstattung auslesen. Zwei Formate:
//   Demo/Alt: ad.features = ["Navigationssystem", …] (fertige Liste)
//   mobile.de-Detail: einzelne (Bool-/Enum-)Felder -> deutsche Labels ableiten.
export function extractFeatures(ad) {
  if (!ad) return [];
  if (Array.isArray(ad.features) && ad.features.length && typeof ad.features[0] === 'string') {
    return ad.features;
  }
  const out = [];
  const seen = new Set();
  const add = s => { if (s && !seen.has(s)) { seen.add(s); out.push(s); } };

  for (const [key, label] of Object.entries(FEATURE_FIELDS)) {
    if (ad[key] === true || ad[key] === 'true') add(label);
  }
  const clima = String(ad.climatisation ?? '');
  if (/AUTOMATIC/i.test(clima)) add('Klimaautomatik');
  else if (/MANUAL/i.test(clima)) add('Klimaanlage');

  const speed = String(ad.speedControl ?? '');
  if (/ADAPTIVE/i.test(speed)) add('Adaptiver Tempomat');
  else if (/CRUISE|SPEED/i.test(speed)) add('Tempomat');

  if (truthy(ad.parkingAssistants)) {
    const p = JSON.stringify(ad.parkingAssistants).toUpperCase();
    if (/CAM/.test(p)) add('Rückfahrkamera');
    add('Einparkhilfe');
  }
  const hl = String(ad.headlightType ?? '');
  if (/LED/i.test(hl)) add('LED-Scheinwerfer');
  else if (/XENON|BI_XENON/i.test(hl)) add('Xenon-Scheinwerfer');
  else if (/LASER/i.test(hl)) add('Laser-Scheinwerfer');

  return out;
}

const num = v => { const n = parseFloat(String(v ?? '').replace(/[^\d.,-]/g, '').replace(',', '.')); return isNaN(n) ? null : n; };
const cryptoId = () => 'v' + Math.random().toString(36).slice(2, 9);

function formatReg(reg) {
  const s = String(reg);
  if (/^\d{6}$/.test(s)) return `${s.slice(4, 6)}/${s.slice(0, 4)}`;     // YYYYMM
  if (/^\d{4}-\d{2}/.test(s)) return `${s.slice(5, 7)}/${s.slice(0, 4)}`; // YYYY-MM
  return s;
}
function regSort(reg) {
  const s = String(reg);
  if (/^\d{6}$/.test(s)) return parseInt(s, 10);
  if (/^\d{4}-\d{2}/.test(s)) return parseInt(s.slice(0, 4) + s.slice(5, 7), 10);
  return 0;
}

// ─── DEMO-Daten im mobile.de-Format ───
const IMG = id => `https://images.unsplash.com/photo-${id}?w=900&q=80&auto=format&fit=crop`;
// Geprüfter Auto-Bildpool (Unsplash) — nur für die Demo; Live kommen die echten mobile.de-Bilder.
const C1 = '1503376780353-7e6692767b70'; // dunkle Limousine
const C2 = '1555215695-3004980ad54e';    // BMW grau
const C3 = '1618843479313-40f8afb4b4d8'; // Mercedes silber
const C4 = '1549317661-bd32c8ce0db2';    // Kleinwagen blau
const C5 = '1605559424843-9e4c228bf1c2'; // sportlich gelb
export const DEMO_ADS = [
  {
    mobileAdId: '1001', make: 'Volkswagen', model: 'Golf', modelDescription: '1.5 TSI Life DSG',
    price: { consumerPriceGross: '21980', type: 'FAIR_PRICE' }, mileage: '34500', firstRegistration: '202203',
    power: '110', fuel: 'PETROL', gearbox: 'AUTOMATIC_GEAR', vehicleCategory: 'Limousine',
    features: ['Navigationssystem', 'Einparkhilfe', 'Klimaautomatik', 'LED-Scheinwerfer', 'Sitzheizung'],
    images: { image: [IMG(C1), IMG(C2), IMG(C3), IMG(C4)] },
    detailPageUrl: 'https://home.mobile.de/ADW'
  },
  {
    mobileAdId: '1002', make: 'BMW', model: '320d', modelDescription: 'Touring Aut. M Sport',
    price: { consumerPriceGross: '28490', consumerPriceNet: '23941.18', vatRate: '19.00', type: 'GOOD_PRICE' }, mileage: '68900', firstRegistration: '202010',
    power: '140', fuel: 'DIESEL', gearbox: 'AUTOMATIC_GEAR', vehicleCategory: 'Kombi',
    features: ['Navigationssystem', 'Leder', 'Head-up-Display', 'AHK', 'Sitzheizung', 'PDC'],
    images: { image: [IMG(C2), IMG(C3), IMG(C1), IMG(C5)] },
    detailPageUrl: 'https://home.mobile.de/ADW'
  },
  {
    mobileAdId: '1003', make: 'Audi', model: 'A3', modelDescription: 'Sportback 35 TFSI advanced',
    price: { consumerPriceGross: '24750', type: 'FAIR_PRICE' }, mileage: '41200', firstRegistration: '202105',
    power: '110', fuel: 'PETROL', gearbox: 'MANUAL_GEAR', vehicleCategory: 'Limousine',
    features: ['Virtual Cockpit', 'Einparkhilfe', 'Klimaautomatik', 'Apple CarPlay'],
    images: { image: [IMG(C3), IMG(C1), IMG(C4)] },
    detailPageUrl: 'https://home.mobile.de/ADW'
  },
  {
    mobileAdId: '1004', make: 'Opel', model: 'Corsa', modelDescription: '1.2 Edition',
    price: { consumerPriceGross: '13990', type: 'GOOD_PRICE' }, mileage: '29800', firstRegistration: '202106',
    power: '55', fuel: 'PETROL', gearbox: 'MANUAL_GEAR', vehicleCategory: 'Kleinwagen',
    features: ['Klimaanlage', 'Tempomat', 'Bluetooth', 'DAB-Radio'],
    images: { image: [IMG(C4), IMG(C1), IMG(C5)] },
    detailPageUrl: 'https://home.mobile.de/ADW'
  },
  {
    mobileAdId: '1005', make: 'Mercedes-Benz', model: 'C 200', modelDescription: 'Avantgarde 9G-Tronic',
    price: { consumerPriceGross: '32900', type: 'FAIR_PRICE' }, mileage: '52300', firstRegistration: '202101',
    power: '135', fuel: 'PETROL', gearbox: 'AUTOMATIC_GEAR', vehicleCategory: 'Limousine',
    features: ['MBUX', 'Leder', 'LED High Performance', 'Kamera', 'Sitzheizung', 'Navigationssystem'],
    images: { image: [IMG(C3), IMG(C5), IMG(C2), IMG(C1)] },
    detailPageUrl: 'https://home.mobile.de/ADW'
  },
  {
    mobileAdId: '1006', make: 'Ford', model: 'Focus', modelDescription: 'Turnier 1.5 EcoBlue Titanium',
    price: { consumerPriceGross: '17950', type: 'GOOD_PRICE' }, mileage: '79800', firstRegistration: '201911',
    power: '88', fuel: 'DIESEL', gearbox: 'MANUAL_GEAR', vehicleCategory: 'Kombi',
    features: ['Navigationssystem', 'Einparkhilfe', 'Klimaautomatik', 'AHK', 'Tempomat'],
    images: { image: [IMG(C5), IMG(C2), IMG(C3)] },
    detailPageUrl: 'https://home.mobile.de/ADW'
  },
  {
    mobileAdId: '1007', make: 'Škoda', model: 'Octavia', modelDescription: 'Combi 2.0 TDI Style DSG',
    price: { consumerPriceGross: '23990', type: 'FAIR_PRICE' }, mileage: '61500', firstRegistration: '202008',
    power: '110', fuel: 'DIESEL', gearbox: 'AUTOMATIC_GEAR', vehicleCategory: 'Kombi',
    features: ['Navigationssystem', 'ACC', 'Kessy', 'LED-Scheinwerfer', 'Sitzheizung'],
    images: { image: [IMG(C2), IMG(C3), IMG(C4), IMG(C1)] },
    detailPageUrl: 'https://home.mobile.de/ADW'
  },
  {
    mobileAdId: '1008', make: 'Renault', model: 'Clio', modelDescription: 'TCe 90 Experience',
    price: { consumerPriceGross: '12490', type: 'FAIR_PRICE' }, mileage: '44900', firstRegistration: '202004',
    power: '67', fuel: 'PETROL', gearbox: 'MANUAL_GEAR', vehicleCategory: 'Kleinwagen',
    features: ['Klimaanlage', 'Navigationssystem', 'Tempomat', 'PDC'],
    images: { image: [IMG(C4), IMG(C5), IMG(C1)] },
    detailPageUrl: 'https://home.mobile.de/ADW'
  }
];
