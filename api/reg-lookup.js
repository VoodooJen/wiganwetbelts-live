/* ============================================================
   /api/reg-lookup — vehicle registration lookup (Vercel serverless)

   Combines two free government APIs:
   1. DVLA Vehicle Enquiry Service (VES): make, year, fuel type,
      engine capacity, colour. Register for a free key at
      https://register-for-ves.driver-vehicle-licensing.api.gov.uk/
      -> env var DVLA_API_KEY
   2. DVSA MOT History API (optional, supplies the MODEL): register at
      https://documentation.history.mot.api.gov.uk/
      -> env vars MOT_CLIENT_ID, MOT_CLIENT_SECRET, MOT_API_KEY,
         MOT_TOKEN_URL (the OAuth token URL from your registration email),
         MOT_SCOPE (default https://tapi.dvsa.gov.uk/.default)

   Works with either key alone; the response says which fields it found.
   CORS is open because vehicle look-up data is not sensitive and the
   site may be hosted on a different origin than this function.
   ============================================================ */

const VES_URL = 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';
const MOT_URL = 'https://history.mot.api.gov.uk/v1/trade/vehicles/registration/';

let motToken = null;
let motTokenExpiry = 0;

async function getMotToken() {
  if (motToken && Date.now() < motTokenExpiry - 60000) return motToken;
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.MOT_CLIENT_ID,
    client_secret: process.env.MOT_CLIENT_SECRET,
    scope: process.env.MOT_SCOPE || 'https://tapi.dvsa.gov.uk/.default'
  });
  const r = await fetch(process.env.MOT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  if (!r.ok) throw new Error('MOT token request failed: ' + r.status);
  const j = await r.json();
  motToken = j.access_token;
  motTokenExpiry = Date.now() + (j.expires_in || 3600) * 1000;
  return motToken;
}

async function lookupVes(reg) {
  const r = await fetch(VES_URL, {
    method: 'POST',
    headers: {
      'x-api-key': process.env.DVLA_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ registrationNumber: reg })
  });
  if (r.status === 404) return { notFound: true };
  if (!r.ok) throw new Error('VES error ' + r.status);
  return await r.json();
}

async function lookupMot(reg) {
  const token = await getMotToken();
  const r = await fetch(MOT_URL + encodeURIComponent(reg), {
    headers: {
      'Authorization': 'Bearer ' + token,
      'X-API-Key': process.env.MOT_API_KEY
    }
  });
  if (r.status === 404) return { notFound: true };
  if (!r.ok) throw new Error('MOT API error ' + r.status);
  return await r.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, reason: 'method' });

  const reg = String(req.query.reg || '').toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z0-9]{2,8}$/.test(reg)) {
    return res.status(400).json({ ok: false, reason: 'bad_reg' });
  }

  const hasVes = !!process.env.DVLA_API_KEY;
  const hasMot = !!(process.env.MOT_CLIENT_ID && process.env.MOT_CLIENT_SECRET && process.env.MOT_API_KEY && process.env.MOT_TOKEN_URL);
  if (!hasVes && !hasMot) {
    return res.status(503).json({ ok: false, reason: 'not_configured' });
  }

  let ves = null, mot = null, vesErr = null, motErr = null;
  await Promise.all([
    hasVes ? lookupVes(reg).then(v => { ves = v; }).catch(e => { vesErr = String(e.message || e); }) : Promise.resolve(),
    hasMot ? lookupMot(reg).then(m => { mot = m; }).catch(e => { motErr = String(e.message || e); }) : Promise.resolve()
  ]);

  const vesData = ves && !ves.notFound ? ves : null;
  const motData = mot && !mot.notFound ? mot : null;

  if (!vesData && !motData) {
    const notFound = (ves && ves.notFound) || (mot && mot.notFound);
    return res.status(notFound ? 404 : 502).json({
      ok: false,
      reason: notFound ? 'not_found' : 'upstream_error'
    });
  }

  // MOT History API supplies the model; VES supplies year/capacity reliably.
  const year =
    (vesData && vesData.yearOfManufacture) ||
    (motData && motData.manufactureDate ? parseInt(String(motData.manufactureDate).slice(0, 4), 10) : null);

  const cc =
    (vesData && vesData.engineCapacity) ||
    (motData && motData.engineSize ? parseInt(motData.engineSize, 10) : null);

  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
  return res.status(200).json({
    ok: true,
    reg,
    make: (vesData && vesData.make) || (motData && motData.make) || null,
    model: (motData && motData.model) || null,
    year: year || null,
    fuelType: (vesData && vesData.fuelType) || (motData && motData.fuelType) || null,
    engineCapacityCc: cc || null,
    colour: (vesData && vesData.colour) || (motData && motData.primaryColour) || null,
    sources: { ves: !!vesData, mot: !!motData }
  });
}
