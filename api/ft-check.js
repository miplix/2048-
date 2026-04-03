// Серверный proxy для проверки FT транзакций — API ключ не виден клиенту
export default async function handler(req, res) {
  const { wallet, direction, symbol, limit } = req.query;
  if (!wallet) return res.status(400).json({ error: 'wallet required' });

  const apiKey = process.env.SENDLER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const params = new URLSearchParams({
      wallet_id: wallet,
      direction: direction || 'in',
      symbol: symbol || 'darai.tkn.near',
      limit: limit || '50'
    });
    const resp = await fetch(
      `https://api.sendler.xyz/history/ft-transfers/?${params}`,
      { headers: { 'accept': 'application/json', 'X-API-Key': apiKey } }
    );
    const data = await resp.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
