-- =============================================
-- 2048+ Supabase Schema
-- Выполнить в: Supabase Dashboard → SQL Editor
-- =============================================

-- 1. Игроки
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname TEXT NOT NULL UNIQUE,
  coins INTEGER NOT NULL DEFAULT 0,
  best_score INTEGER NOT NULL DEFAULT 0,
  max_tile INTEGER NOT NULL DEFAULT 0,
  upgrades JSONB NOT NULL DEFAULT '{}',
  achievements JSONB NOT NULL DEFAULT '{}',
  lives INTEGER NOT NULL DEFAULT 5,
  lives_reset_date TEXT NOT NULL DEFAULT '',
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Таблица лидеров — за всё время (один рекорд на игрока)
CREATE TABLE IF NOT EXISTS leaderboard_alltime (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  best_score INTEGER NOT NULL DEFAULT 0,
  max_tile INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(player_id)
);

-- 3. Таблица лидеров — недельная (один рекорд на игрока за текущую неделю)
CREATE TABLE IF NOT EXISTS leaderboard_weekly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  best_score INTEGER NOT NULL DEFAULT 0,
  max_tile INTEGER NOT NULL DEFAULT 0,
  week_start DATE NOT NULL, -- понедельник текущей недели
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(player_id, week_start)
);

-- 4. Архив завершённых турниров (недельных)
CREATE TABLE IF NOT EXISTS tournament_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  results JSONB NOT NULL, -- массив [{rank, player_id, nickname, best_score, max_tile}]
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- Индексы для быстрой сортировки лидербордов
-- =============================================
CREATE INDEX IF NOT EXISTS idx_leaderboard_alltime_score ON leaderboard_alltime(best_score DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_weekly_score ON leaderboard_weekly(best_score DESC, week_start);
CREATE INDEX IF NOT EXISTS idx_leaderboard_weekly_week ON leaderboard_weekly(week_start);

-- =============================================
-- Row Level Security
-- =============================================
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_alltime ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_weekly ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_archive ENABLE ROW LEVEL SECURITY;

-- players: читать может любой, писать только свою строку (по id из localStorage)
CREATE POLICY "players_select" ON players FOR SELECT USING (true);
CREATE POLICY "players_insert" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "players_update" ON players FOR UPDATE USING (true);

-- leaderboard_alltime: читать может любой, писать — через upsert из игры
CREATE POLICY "alltime_select" ON leaderboard_alltime FOR SELECT USING (true);
CREATE POLICY "alltime_insert" ON leaderboard_alltime FOR INSERT WITH CHECK (true);
CREATE POLICY "alltime_update" ON leaderboard_alltime FOR UPDATE USING (true);

-- leaderboard_weekly: читать может любой, писать — через upsert из игры
CREATE POLICY "weekly_select" ON leaderboard_weekly FOR SELECT USING (true);
CREATE POLICY "weekly_insert" ON leaderboard_weekly FOR INSERT WITH CHECK (true);
CREATE POLICY "weekly_update" ON leaderboard_weekly FOR UPDATE USING (true);

-- tournament_archive: только чтение для всех (запись — через service_role вручную или cron)
CREATE POLICY "archive_select" ON tournament_archive FOR SELECT USING (true);

-- Миграция: добавить колонки lives если их нет (для существующих БД)
ALTER TABLE players ADD COLUMN IF NOT EXISTS lives INTEGER NOT NULL DEFAULT 5;
ALTER TABLE players ADD COLUMN IF NOT EXISTS lives_reset_date TEXT NOT NULL DEFAULT '';
ALTER TABLE players ADD COLUMN IF NOT EXISTS lives_bought INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS game_state JSONB;

-- 5. Таблица покупок (защита от двойного начисления)
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  tx_hash TEXT NOT NULL UNIQUE,  -- уникальность предотвращает двойное начисление
  lives_bought INTEGER NOT NULL DEFAULT 0,
  amount_darai TEXT NOT NULL,    -- сумма в наименьших единицах (строка, т.к. большое число)
  status TEXT NOT NULL DEFAULT 'pending', -- pending | confirmed | failed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchases_tx_hash ON purchases(tx_hash);
CREATE INDEX IF NOT EXISTS idx_purchases_player ON purchases(player_id);

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchases_select" ON purchases FOR SELECT USING (true);
CREATE POLICY "purchases_insert" ON purchases FOR INSERT WITH CHECK (true);
CREATE POLICY "purchases_update" ON purchases FOR UPDATE USING (true);
