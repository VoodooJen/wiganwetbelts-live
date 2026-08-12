/* ============================================================
   /api/book — send a booking request to Torque.

   Creates (in Torque) the customer, vehicle, a draft quote and a
   PROVISIONAL booking the workshop accepts. Secret stays server side.
   Env: TORQUE_URL, WWB_BOOKING_KEY
   ============================================================ */
const ALLOWED = ['https://wiganwetbelts.co.uk', 'https://www.wiganwetbelts.co.uk'];

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', ALLOWED.includes(origin) ? origin : ALLOWED[0]);
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const r0 = String(req.headers.referer || '');
  if (origin && !ALLOWED.includes(origin)) return res.status(403).json({ ok: false });
  if (!origin && r0 && !ALLOWED.some((a) => r0.indexOf(a) === 0)) return res.status(403).json({ ok: false });

  const base = process.env.TORQUE_URL;
  const key = process.env.WWB_BOOKING_KEY;
  if (!base || !key) return res.status(200).json({ ok: false, reason: 'not_configured' });

  try {
    const r = await fetch(base.replace(/\/+$/, '') + '/api/public/booking-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-booking-key': key },
      body: JSON.stringify(req.body || {}),
    });
    const body = await r.json();
    return res.status(r.status).json(body);
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'Could not reach the booking system.' });
  }
}
