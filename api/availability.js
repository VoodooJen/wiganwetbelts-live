/* ============================================================
   /api/availability — free booking dates for the quote form.

   Keeps the shared secret server side and asks Torque, which owns
   the real workshop calendar. Locked to this site's own pages.
   Env: TORQUE_URL, WWB_BOOKING_KEY
   ============================================================ */
const ALLOWED = ['https://wiganwetbelts.co.uk', 'https://www.wiganwetbelts.co.uk'];

function allowed(req) {
  const o = req.headers.origin || '';
  const r = String(req.headers.referer || '');
  if (!o && !r) return true; // same origin fetches often send neither
  return ALLOWED.includes(o) || ALLOWED.some((a) => r.indexOf(a) === 0);
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', ALLOWED.includes(origin) ? origin : ALLOWED[0]);
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false });
  if (!allowed(req)) return res.status(403).json({ ok: false });

  const base = process.env.TORQUE_URL;
  const key = process.env.WWB_BOOKING_KEY;
  if (!base || !key) {
    // Not wired up yet. The form falls back to a plain date box.
    return res.status(200).json({ ok: false, reason: 'not_configured', slots: [] });
  }

  const hours = String(req.query.hours || '');
  const limit = String(req.query.limit || '12');
  const url = base.replace(/\/+$/, '') + '/api/public/availability?hours=' +
    encodeURIComponent(hours) + '&limit=' + encodeURIComponent(limit);

  try {
    const r = await fetch(url, { headers: { 'x-booking-key': key } });
    const body = await r.json();
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(r.ok ? 200 : 502).json(r.ok ? body : { ok: false, slots: [] });
  } catch (e) {
    return res.status(200).json({ ok: false, reason: 'upstream', slots: [] });
  }
}
