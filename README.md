# GLASSIFY — лендинг захисного скла

Односторінковий лендинг зі світлою і темною темою. Заявки з форм надходять у Telegram і на пошту.

## Структура

```
server.js          Express: віддає сторінку + POST /api/lead (Telegram + SMTP)
public/index.html  розмітка
public/styles.css  стилі (світла/темна тема через [data-theme])
public/script.js   тема, меню, підбір бренд/модель, модалка, маска телефону, відправка
.env.example       шаблон налаштувань
```

## GitHub Pages (без сервера)

Сайт автоматично публікується з папки `public/` при кожному пуші в `main` (workflow `.github/workflows/pages.yml`).

Одноразове налаштування:
1. Репозиторій має бути **публічним** (безкоштовні Pages не працюють для приватних).
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Перезапустіть workflow у вкладці **Actions** (або зробіть будь-який пуш).

Адреса сайту: `https://mivaniv.github.io/glassify/`

На Pages заявки надходять **лише на пошту** `glassifi.ua@gmail.com` через сервіс [FormSubmit](https://formsubmit.co).
Перша заявка надсилає на цю пошту лист з підтвердженням: натисніть **Activate Form**, після чого заявки почнуть приходити.
Telegram на Pages не працює: токен бота нема де сховати. Для Telegram використовуйте `server.js` на VPS.

## Запуск локально

```bash
npm install
cp .env.example .env   # заповнити ключі
npm start              # http://localhost:3000
```

## Налаштування

**Telegram**
1. Створіть бота в @BotFather і скопіюйте токен у `TELEGRAM_BOT_TOKEN`.
2. Напишіть боту будь-що (або додайте його в групу).
3. Свій ID візьміть у @userinfobot, ID групи — з `https://api.telegram.org/bot<TOKEN>/getUpdates`. Вкажіть його в `TELEGRAM_CHAT_ID` (якщо адрес кілька — через кому).

**Пошта (SMTP)**
- Gmail: увімкніть 2FA, створіть «Пароль застосунку» (App Password) і вкажіть його в `SMTP_PASS`.
- `MAIL_TO` — адреса, куди надходитимуть заявки (якщо адрес кілька — через кому).

Заявка вважається надісланою, якщо дійшла хоча б в один канал. Помилки каналів пишуться в лог сервера.

## Деплой на VPS (Ubuntu)

```bash
# Node 18+
git clone ... && cd glassify-landing
npm ci --omit=dev
cp .env.example .env && nano .env
npm i -g pm2
pm2 start server.js --name glassify && pm2 save && pm2 startup
```

Nginx як reverse proxy:

```nginx
server {
  server_name your-domain.com;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

SSL: `sudo certbot --nginx -d your-domain.com`.

## Що замінити перед запуском

- Посилання на Telegram у футері (`t.me/your_username`) — `public/index.html`.
- Ціни 399 / 499 / 449 ₴ у картках типів.
- Список моделей — об'єкт `MODELS` у `public/script.js`.
- Тексти FAQ і умови доставки/повернення (14 днів, відправка до 16:00).

## Корисне

- `?theme=light` або `?theme=dark` у URL примусово вмикає тему (зручно для показу).
- UTM-мітки з URL автоматично додаються до заявки.
- Захист від спаму: приховане поле-пастка + ліміт 5 заявок / 10 хв з одного IP.
