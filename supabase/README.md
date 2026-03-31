# Supabase — инструкция по настройке

## 1. Создать таблицы

Открой **Supabase Dashboard → SQL Editor**, вставь и выполни содержимое файла:
```
supabase/schema.sql
```

## 2. Переменные окружения

Для локальной разработки — файл `.env` уже создан (не коммитится в git).

Для Vercel деплоя:
- Открой **Vercel Dashboard → Project → Settings → Environment Variables**
- Добавь:
  - `SUPABASE_URL` = `https://egchnyodvvewcmkucijx.supabase.co`
  - `SUPABASE_ANON_KEY` = `eyJhbGci...` (anon public key)

## 3. Архивирование турниров

Каждый **понедельник** выполняй в SQL Editor:
```
supabase/archive_weekly_tournament.sql
```

Результат — строка в таблице `tournament_archive` с полем `results` (JSON массив топ-100).

Чтобы получить данные для рассылки призов:
```sql
SELECT week_start, week_end, results
FROM tournament_archive
ORDER BY week_start DESC
LIMIT 1;
```

## 4. Структура таблиц

| Таблица | Назначение |
|---------|-----------|
| `players` | Игроки: ник, монеты, рекорд, апгрейды, достижения, last_seen |
| `leaderboard_alltime` | Лучший счёт каждого игрока за всё время |
| `leaderboard_weekly` | Лучший счёт каждого игрока за текущую неделю (пн–вс) |
| `tournament_archive` | Архив завершённых недельных турниров (JSON топ-100) |

## 5. Безопасность

- В коде используется только `anon` ключ — он безопасен для фронтенда
- `service_role` и пароль БД — никогда не добавлять в код
- RLS (Row Level Security) включён на всех таблицах
