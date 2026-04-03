// Серверный proxy для проверки NFT — API ключ не виден клиенту
export default async function handler(req, res) {
  const { owner } = req.query;
  if (!owner) return res.status(400).json({ error: 'owner required' });

  const apiKey = process.env.SENDLER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const resp = await fetch(
      `https://api.sendler.xyz/nft/collections-by-owner/?owner_id=${encodeURIComponent(owner)}`,
      { headers: { 'accept': 'application/json', 'X-API-Key': apiKey } }
    );
    const data = await resp.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
