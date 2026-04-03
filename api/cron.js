// Vercel Cron Job — автозавершение турниров
// Запускается каждое воскресенье в 20:00 UTC = 00:00 Тбилиси (UTC+4)
// Расписание задаётся в vercel.json

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://egchnyodvvewcmkucijx.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function supabase(path, method, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase ${method} ${path}: ${err}`);
  }
  return res.status === 204 ? null : res.json();
}

async function finishTournament(type) {
  // Получаем топ участников
  let topRows = [];
  if (type === 'score') {
    topRows = await supabase('leaderboard_weekly?select=player_id,nickname,best_score&best_score=gt.0&order=best_score.desc&limit=10', 'GET') || [];
  } else {
    topRows = await supabase('tournament_lives?select=player_id,nickname,games_played&games_played=gt.0&order=games_played.desc&limit=10', 'GET') || [];
  }

  // Получаем награды
  const rewards = await supabase(`tournament_rewards?tournament_type=eq.${type}&order=place.asc`, 'GET') || [];
  const rewardMap = {};
  rewards.forEach(r => { rewardMap[r.place] = r.coins_reward; });

  let awarded = 0;
  for (let i = 0; i < topRows.length; i++) {
    const coins = rewardMap[i + 1];
    if (!coins || coins <= 0) continue;
    const row = topRows[i];

    // Проверяем что уведомление ещё не создавалось за последний час
    const hourAgo = new Date(Date.now() - 3600000).toISOString();
    const existing = await supabase(
      `tournament_notifications?player_id=eq.${row.player_id}&message=ilike.*Турнир завершён*${i+1} место*&created_at=gte.${hourAgo}&limit=1`,
      'GET'
    );
    if (existing && existing.length > 0) continue;

    // Начисляем монеты
    const player = await supabase(`players?id=eq.${row.player_id}&select=coins`, 'GET');
    if (player && player[0]) {
      await supabase(`players?id=eq.${row.player_id}`, 'PATCH', {
        coins: (player[0].coins || 0) + coins
      });
    }

    // Создаём уведомление
    await supabase('tournament_notifications', 'POST', {
      player_id: row.player_id,
      message: `🏆 Турнир завершён! Ты занял ${i + 1} место и получил +${coins} монет!`,
      coins_awarded: coins
    });
    awarded++;
  }

  // Сброс таблицы
  if (type === 'score') {
    await supabase('leaderboard_weekly?best_score=gt.0', 'PATCH', { best_score: 0, max_tile: 0 });
  } else {
    await supabase('tournament_lives?games_played=gt.0', 'PATCH', { games_played: 0 });
  }

  return awarded;
}

export default async function handler(req, res) {
  // Проверяем что запрос от Vercel Cron (или от нас)
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' });
  }

  try {
    const scoreAwarded = await finishTournament('score');
    const livesAwarded = await finishTournament('lives');
    console.log(`Cron: score tournament finished, ${scoreAwarded} awarded`);
    console.log(`Cron: lives tournament finished, ${livesAwarded} awarded`);
    res.status(200).json({ ok: true, score: scoreAwarded, lives: livesAwarded });
  } catch (e) {
    console.error('Cron error:', e);
    res.status(500).json({ error: e.message });
  }
}
