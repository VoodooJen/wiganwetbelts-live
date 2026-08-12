/* ============================================================
   /api/vehicle-lookup — reg lookup for the wet belt checker.
   Proxies to Torque so the provider key stays server side and
   repeat lookups of the same reg are served from Torque's cache.
   Env: TORQUE_URL, WWB_BOOKING_KEY
   ============================================================ */
const ALLOWED = ['https://wiganwetbelts.co.uk', 'https://www.wiganwetbelts.co.uk'];

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', ALLOWED.includes(origin) ? origin : ALLOWED[0]);
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false });

  const ref = String(req.headers.referer || '');
  if (origin && !ALLOWED.includes(origin)) return res.status(403).json({ ok: false });
  if (!origin && ref && !ALLOWED.some((a) => ref.indexOf(a) === 0)) return res.status(403).json({ ok: false });

  const base = process.env.TORQUE_URL;
  const key = process.env.WWB_BOOKING_KEY;
  if (!base || !key) return res.status(200).json({ ok: false, error: 'Lookup is not switched on yet.' });

  const vrm = String(req.query.vrm || '').toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z0-9]{2,8}$/.test(vrm)) return res.status(400).json({ ok: false, error: 'Enter a valid registration.' });

  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');

  // 1. Torque first. It returns the engine code, which is what lets the
  //    checker be definitive rather than working from make and model.
  try {
    const r = await fetch(base.replace(/\/+$/, '') + '/api/public/vehicle-lookup?vrm=' + encodeURIComponent(vrm), {
      headers: { 'x-booking-key': key },
    });
    const body = await r.json();
    if (body && body.ok && (body.make || body.model)) return res.status(200).json(body);
  } catch (e) { /* fall through */ }

  // 2. Fall back to the same provider the quote form uses. No engine code,
  //    so the checker will say "likely" rather than "confirmed", which is
  //    exactly what we want it to say when it cannot be certain.
  try {
    const r2 = await fetch('https://www.voodoofiles.co.uk/api/wwb-reg-lookup?vrm=' + encodeURIComponent(vrm));
    const b2 = await r2.json();
    if (b2 && b2.ok) {
      return res.status(200).json({
        ok: true, reg: vrm, cached: false,
        make: b2.make || null,
        model: b2.model || null,
        year: b2.year || null,
        fuel: b2.fuel || null,
        engineSize: b2.engineCc || null,
        engineCode: b2.engineCode || null,
        variant: b2.model || null,
      });
    }
    return res.status(200).json({ ok: false, error: (b2 && b2.error) || 'No vehicle found for that registration.' });
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'Could not reach the lookup service.' });
  }
}
