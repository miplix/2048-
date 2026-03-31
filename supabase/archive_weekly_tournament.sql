-- =============================================
-- Архивирование недельного турнира
-- Запускать каждый понедельник в Supabase SQL Editor
-- или через pg_cron / внешний cron
-- =============================================

-- Вычисляем прошлую неделю (понедельник прошлой недели)
DO $$
DECLARE
  v_week_start DATE;
  v_week_end DATE;
  v_results JSONB;
BEGIN
  -- Прошлый понедельник
  v_week_start := DATE_TRUNC('week', NOW() - INTERVAL '7 days')::DATE;
  v_week_end   := v_week_start + INTERVAL '6 days';

  -- Собираем результаты топ-100 за прошлую неделю
  SELECT jsonb_agg(
    jsonb_build_object(
      'rank',       row_number() OVER (ORDER BY best_score DESC),
      'player_id',  player_id,
      'nickname',   nickname,
      'best_score', best_score,
      'max_tile',   max_tile
    )
  )
  INTO v_results
  FROM leaderboard_weekly
  WHERE week_start = v_week_start
  ORDER BY best_score DESC
  LIMIT 100;

  -- Сохраняем архив только если есть данные
  IF v_results IS NOT NULL THEN
    INSERT INTO tournament_archive (week_start, week_end, results)
    VALUES (v_week_start, v_week_end, v_results)
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Archived tournament: % to %, % players', v_week_start, v_week_end, jsonb_array_length(v_results);
  ELSE
    RAISE NOTICE 'No data for week %', v_week_start;
  END IF;
END $$;

-- =============================================
-- Просмотр последнего архива (для рассылки)
-- =============================================
SELECT
  week_start,
  week_end,
  jsonb_array_length(results) AS total_players,
  results->0 AS first_place,
  results->1 AS second_place,
  results->2 AS third_place,
  results
FROM tournament_archive
ORDER BY week_start DESC
LIMIT 1;
