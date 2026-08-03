/* ============================================================
   /api/keepalive — pinged daily by Vercel cron.
   Touches the Supabase API so the free tier project never
   pauses itself for inactivity again. Reads a single row from
   a public keepalive table; stores nothing, returns nothing
   sensitive.
   ============================================================ */
const SB_URL = 'https://ukwakszeslxkxcyosigp.supabase.co';
const SB_KEY = 'sb_publishable_QuwBESO6L6SwTK7a2kB6fw_bXDQElMo';

export default async function handler(req, res) {
  try {
    const r = await fetch(SB_URL + '/rest/v1/keepalive?select=id&limit=1', {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
    });
    return res.status(200).json({ ok: true, upstream: r.status, at: new Date().toISOString() });
  } catch (e) {
    return res.status(502).json({ ok: false });
  }
}
