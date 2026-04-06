// db.js — Supabase клиент (ключи в env переменных Vercel, не в коде)
// Этот файл — модульная версия для Vercel, не используется в index.html

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Получить понедельник текущей недели в формате YYYY-MM-DD
function getWeekStart() {
  const now = new Date();
  const day = now.getDay(); // 0=вс, 1=пн ...
  const diff = (day === 0 ? -6 : 1 - day);
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().split('T')[0];
}

class DB {
  constructor() {
    this._ready = false;
    this._client = null;
    this._init();
  }

  async _init() {
    // Загружаем Supabase SDK динамически
    if (!window.supabase) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    this._client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    this._ready = true;
  }

  async _wait() {
    if (this._ready) return;
    await new Promise(r => {
      const check = setInterval(() => { if (this._ready) { clearInterval(check); r(); } }, 50);
    });
  }

  // ---- Игрок ----

  // Создать или получить игрока по nickname
  async getOrCreatePlayer(nickname) {
    await this._wait();
    // Проверяем существующего
    const { data: existing } = await this._client
      .from('players')
      .select('*')
      .eq('nickname', nickname)
      .maybeSingle();

    if (existing) {
      // Обновляем last_seen_at
      await this._client
        .from('players')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', existing.id);
      return existing;
    }

    // Создаём нового
    const { data: created, error } = await this._client
      .from('players')
      .insert({ nickname })
      .select()
      .single();

    if (error) throw error;
    return created;
  }

  // Сохранить прогресс игрока
  async savePlayer(playerId, { coins, bestScore, maxTile, upgrades, achievements }) {
    await this._wait();
    const { error } = await this._client
      .from('players')
      .update({
        coins,
        best_score: bestScore,
        max_tile: maxTile,
        upgrades,
        achievements,
        last_seen_at: new Date().toISOString(),
      })
      .eq('id', playerId);
    if (error) console.error('savePlayer error:', error);
  }

  // ---- Лидерборды ----

  // Обновить рекорд в обоих лидербордах после партии
  async submitScore(playerId, nickname, score, maxTile) {
    await this._wait();

    // All-time: upsert, обновляем только если новый счёт выше
    const { data: atRow } = await this._client
      .from('leaderboard_alltime')
      .select('best_score')
      .eq('player_id', playerId)
      .maybeSingle();

    if (!atRow || score > atRow.best_score) {
      await this._client
        .from('leaderboard_alltime')
        .upsert({
          player_id: playerId,
          nickname,
          best_score: score,
          max_tile: maxTile,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'player_id' });
    }

    // Weekly: upsert по (player_id, week_start)
    const weekStart = getWeekStart();
    const { data: wRow } = await this._client
      .from('leaderboard_weekly')
      .select('best_score')
      .eq('player_id', playerId)
      .eq('week_start', weekStart)
      .maybeSingle();

    if (!wRow || score > wRow.best_score) {
      await this._client
        .from('leaderboard_weekly')
        .upsert({
          player_id: playerId,
          nickname,
          best_score: score,
          max_tile: maxTile,
          week_start: weekStart,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'player_id, week_start' });
    }
  }

  // Получить топ-50 за всё время
  async getAlltimeLeaderboard(limit = 50) {
    await this._wait();
    const { data, error } = await this._client
      .from('leaderboard_alltime')
      .select('nickname, best_score, max_tile, updated_at')
      .order('best_score', { ascending: false })
      .limit(limit);
    if (error) { console.error(error); return []; }
    return data;
  }

  // Получить топ-50 за текущую неделю
  async getWeeklyLeaderboard(limit = 50) {
    await this._wait();
    const weekStart = getWeekStart();
    const { data, error } = await this._client
      .from('leaderboard_weekly')
      .select('nickname, best_score, max_tile, updated_at')
      .eq('week_start', weekStart)
      .order('best_score', { ascending: false })
      .limit(limit);
    if (error) { console.error(error); return []; }
    return data;
  }

  // Получить позицию игрока в all-time
  async getPlayerRankAlltime(playerId) {
    await this._wait();
    const { data: me } = await this._client
      .from('leaderboard_alltime')
      .select('best_score')
      .eq('player_id', playerId)
      .maybeSingle();
    if (!me) return null;
    const { count } = await this._client
      .from('leaderboard_alltime')
      .select('*', { count: 'exact', head: true })
      .gt('best_score', me.best_score);
    return (count || 0) + 1;
  }
}

export const db = new DB();
export { getWeekStart };
