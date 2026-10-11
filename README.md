# PlayPick

Сервис для поиска игр на основе настроения, свободного времени и предпочтений.
Текущий стек: Next.js App Router, TypeScript, Drizzle ORM, Neon PostgreSQL.

## Локальный запуск

```bash
npm ci
```

Создайте `.env.local` в корне проекта:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
```

Используйте строку подключения своей Neon-базы. `.env.local` исключён из Git.
Для новой базы примените существующую миграцию командой `npx drizzle-kit migrate`.
Не применяйте миграции повторно вручную к уже настроенной общей базе.

```bash
npm run dev
```

Сайт: http://localhost:3000. Проверки: `npm test`, `npm run lint`, `npm run build`.
`npm run test:db` проверяет SQL импорта в временной таблице Neon, не меняя каталог.

## API каталога

`GET /api/games?search=elden&page=1&limit=20`

- `search`: поиск подстроки в названии без учёта регистра, до 200 символов.
- `page`: положительное целое число, по умолчанию 1, максимум 1000000.
- `limit`: число игр на странице, по умолчанию 20, максимум 100.
- Сортировка по названию, затем ID; поиск трактует `%` и `_` как обычные символы.
- Ответ остаётся массивом игр, совместимым с существующим frontend-контрактом.
- Заголовки `X-Total-Count`, `X-Page`, `X-Limit`, `X-Total-Pages` содержат пагинацию.
- Пустая страница возвращает `[]` со статусом 200; неверные параметры — 400.

```ts
const response = await fetch('/api/games?search=elden&page=1&limit=20');
if (!response.ok) throw new Error('Не удалось загрузить каталог');
const games = await response.json();
const total = Number(response.headers.get('X-Total-Count'));
```

`GET /api/games/elden-ring` возвращает объект игры. Неизвестный slug — 404.
Ошибка базы — 500 с безопасным сообщением. Поля description, coverUrl, developer,
publisher и внешние ID могут быть null; даты createdAt/updatedAt — строки JSON.
releaseDate пока отсутствует в схеме и не возвращается API.

## Контракт интеграции с IGDB

Серверный коллектор `collect:igdb` преобразует ответ IGDB в JSON-массив:

```json
[
  {
    "igdbId": 119133,
    "slug": "elden-ring",
    "title": "Elden Ring",
    "description": "Описание игры",
    "coverUrl": "https://images.igdb.com/igdb/image/upload/t_cover_big/IMAGE_ID.jpg",
    "developer": "FromSoftware",
    "publisher": "Bandai Namco Entertainment"
  }
]
```

Это пример формата, а не файл для импорта: замените данные ответом коллектора.
Обязательны igdbId, slug и title. Необязательные поля можно опустить.
Партия содержит 1–100 игр, без повторяющихся ID и slug.

```bash
npm run import:games -- path/to/games.json --dry-run
npm run import:games -- path/to/games.json
```

Сначала используйте `--dry-run`: он проверяет файл без подключения к базе.
Обычный запуск записывает всю партию одной атомарной SQL-командой.
Повторный импорт обновляет игру по igdbId; ID, slug и createdAt существующей игры
сохраняются, пропущенные необязательные поля не стирают имеющиеся данные.
Если slug уже принадлежит другой записи (в том числе игре без igdbId), вся партия
отменяется: сначала проверьте и согласуйте соответствие записей.
Публичного endpoint записи нет: импорт запускается серверной командой.
Twitch Client Secret и DATABASE_URL не должны попадать в браузер или Git.

## Следующие этапы

### Получение реальных игр из IGDB

Создайте приложение в Twitch Developer Console. Тип клиента — Confidential.
Для IGDB применяется Client Credentials; интерактивный вход пользователей не нужен.
Добавьте в существующий `.env.local`, сохранив DATABASE_URL:

```dotenv
TWITCH_CLIENT_ID=your_client_id
TWITCH_CLIENT_SECRET=your_client_secret
```

```bash
npm run collect:igdb -- data/igdb-games.json --limit 50
npm run import:games -- data/igdb-games.json --dry-run
npm run import:games -- data/igdb-games.json
```

Первая команда получает одну партию игр с обложками и более чем 10 общими оценками,
по убыванию количества оценок. Она сохраняет JSON, не меняя базу, и не перезаписывает
существующий файл. Для следующей партии используйте другое имя и `--offset 50`.
`--limit` допускает 1–100, `--offset` — 0–100000. Между партиями порядок источника
может измениться; повторяющиеся игры обновляются импортёром по IGDB ID.

Коллектор использует серверные запросы, таймаут 15 секунд, хранит токен только в памяти,
один раз обновляет его при HTTP 401 и один раз повторяет запрос при HTTP 429.
Ошибка сервиса не выводит токены или содержимое ответа в логи.
Ссылки обложек принимаются только с HTTPS-хоста images.igdb.com.

После сохранения проверьте JSON и dry-run. Если импорт сообщает о конфликте slug с
первой вручную созданной игрой, согласуйте IGDB ID существующей записи перед импортом.
Dry-run проверяет формат, но не конфликты с базой. Данные игр импортируются целой партией.

Документация источника: [IGDB API](https://api-docs.igdb.com/),
[Twitch Client Credentials](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#client-credentials-grant-flow).

Без Twitch-настроек можно выполнить `npm test`; запрос реальных игр требует ключей.
После наполнения каталога проектируются GameDNA, подбор игр, авторизация, оценки и избранное.
