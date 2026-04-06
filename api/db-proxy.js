// Серверный proxy для Supabase — ключи не видны клиенту
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  // Принимаем: { path, method, body, params }
  const { path, method, body } = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  if (!path) return res.status(400).json({ error: 'path required' });

  const m = (method || 'GET').toUpperCase();
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
  if (m === 'POST') headers['Prefer'] = 'return=representation';
  if (m === 'PATCH' || m === 'DELETE') headers['Prefer'] = 'return=minimal';

  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: m,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await resp.text();
    try {
      res.status(resp.status).json(JSON.parse(text));
    } catch {
      res.status(resp.status).send(text);
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
