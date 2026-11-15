require('dotenv').config();
const path = require('path');
const express = require('express');
const nodemailer = require('nodemailer');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.set('trust proxy', 1); // коректний IP за nginx
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

/* ---------- простий rate limit: 5 заявок / 10 хв з одного IP ---------- */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_HITS = 5;
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  return list.length > MAX_HITS;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, list] of hits) {
    if (!list.some((t) => now - t < WINDOW_MS)) hits.delete(ip);
  }
}, WINDOW_MS).unref();

/* ---------- утиліти ---------- */
const clean = (v, max = 200) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const list = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);

const LABELS = {
  name: "Ім'я",
  phone: 'Телефон',
  brand: 'Бренд',
  model: 'Модель',
  glass: 'Тип скла',
  comment: 'Коментар',
  source: 'Форма',
};

/* ---------- Telegram ---------- */
async function sendTelegram(lead, meta) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chats = list(process.env.TELEGRAM_CHAT_ID);
  if (!token || !chats.length) throw new Error('Telegram не налаштовано');

  const lines = ['🛡 <b>Нова заявка GLASSIFY</b>', ''];
  for (const [key, label] of Object.entries(LABELS)) {
    if (lead[key]) lines.push(`<b>${label}:</b> ${esc(lead[key])}`);
  }
  if (meta.utm) lines.push(`<b>UTM:</b> ${esc(meta.utm)}`);
  lines.push('', `🕒 ${esc(meta.time)}`);

  await Promise.all(
    chats.map(async (chat_id) => {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, text: lines.join('\n'), parse_mode: 'HTML', disable_web_page_preview: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) throw new Error(`Telegram ${chat_id}: ${data.description || res.status}`);
    })
  );
}

/* ---------- Пошта ---------- */
let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 465,
    secure: String(SMTP_SECURE ?? 'true') === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

async function sendEmail(lead, meta) {
  const t = getTransporter();
  const to = list(process.env.MAIL_TO);
  if (!t || !to.length) throw new Error('Пошту не налаштовано');

  const rows = Object.entries(LABELS)
    .filter(([key]) => lead[key])
    .map(([key, label]) => `<tr><td style="padding:6px 12px;color:#6b6880">${label}</td><td style="padding:6px 12px;font-weight:600">${esc(lead[key])}</td></tr>`);
  if (meta.utm) rows.push(`<tr><td style="padding:6px 12px;color:#6b6880">UTM</td><td style="padding:6px 12px">${esc(meta.utm)}</td></tr>`);

  const text = Object.entries(LABELS)
    .filter(([key]) => lead[key])
    .map(([key, label]) => `${label}: ${lead[key]}`)
    .concat(meta.utm ? [`UTM: ${meta.utm}`] : [], ['', meta.time])
    .join('\n');

  await t.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject: `Нова заявка GLASSIFY — ${lead.name}, ${lead.phone}`,
    text,
    html: `<div style="font-family:Arial,sans-serif;font-size:15px">
      <h2 style="color:#6A2BE2;margin:0 0 12px">Нова заявка GLASSIFY</h2>
      <table style="border-collapse:collapse">${rows.join('')}</table>
      <p style="color:#6b6880;font-size:13px">${esc(meta.time)}</p></div>`,
  });
}

/* ---------- API ---------- */
app.post('/api/lead', async (req, res) => {
  const body = req.body || {};

  // honeypot: боти заповнюють приховане поле
  if (body.website) return res.json({ ok: true });

  if (rateLimited(req.ip)) {
    return res.status(429).json({ ok: false, error: 'Забагато заявок. Спробуйте трохи пізніше.' });
  }

  const lead = {
    name: clean(body.name, 80),
    phone: clean(body.phone, 30),
    brand: clean(body.brand, 60),
    model: clean(body.model, 80),
    glass: clean(body.glass, 60),
    comment: clean(body.comment, 1000),
    source: clean(body.source, 60),
  };

  const digits = lead.phone.replace(/\D/g, '');
  if (lead.name.length < 2) return res.status(400).json({ ok: false, error: "Вкажіть ім'я" });
  if (digits.length < 10 || digits.length > 13) return res.status(400).json({ ok: false, error: 'Вкажіть коректний номер телефону' });

  const meta = {
    utm: clean(body.utm, 300),
    time: new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' }),
  };

  const results = await Promise.allSettled([sendTelegram(lead, meta), sendEmail(lead, meta)]);
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error(`[lead] ${i === 0 ? 'Telegram' : 'Email'}:`, r.reason?.message || r.reason);
  });

  // Заявка вважається прийнятою, якщо дійшла хоча б в один канал
  if (results.some((r) => r.status === 'fulfilled')) return res.json({ ok: true });
  return res.status(502).json({ ok: false, error: 'Не вдалося надіслати заявку. Зателефонуйте нам, будь ласка.' });
});

app.listen(PORT, () => {
  console.log(`GLASSIFY landing: http://localhost:${PORT}`);
  if (!process.env.TELEGRAM_BOT_TOKEN) console.warn('⚠ TELEGRAM_BOT_TOKEN не задано — заявки в Telegram не надсилатимуться');
  if (!process.env.SMTP_USER) console.warn('⚠ SMTP не налаштовано — заявки на пошту не надсилатимуться');
});
