(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;

  /* ---------- тема ---------- */
  $('#themeToggle').addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('glassify-theme', next); } catch (e) {}
  });

  /* ---------- мобільне меню ---------- */
  const nav = $('#nav');
  const burger = $('#burger');
  burger.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
  });
  $$('a', nav).forEach((a) => a.addEventListener('click', () => {
    nav.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
  }));

  $('#year').textContent = new Date().getFullYear();

  /* ---------- підбір бренд/модель ---------- */
  const MODELS = {
    Apple: ['iPhone 17 Pro Max', 'iPhone 17 Pro', 'iPhone 17', 'iPhone Air', 'iPhone 16 Pro Max', 'iPhone 16 Pro', 'iPhone 16', 'iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15', 'iPhone 14 Pro Max', 'iPhone 14 Pro', 'iPhone 14', 'iPhone 13 / 13 Pro', 'iPhone 12 / 12 Pro', 'iPhone 11', 'iPhone SE'],
    Samsung: ['Galaxy S25 Ultra', 'Galaxy S25+', 'Galaxy S25', 'Galaxy S24 Ultra', 'Galaxy S24', 'Galaxy S23', 'Galaxy A56', 'Galaxy A55', 'Galaxy A36', 'Galaxy A35', 'Galaxy A26', 'Galaxy A16', 'Galaxy A15'],
    Xiaomi: ['Xiaomi 15', 'Xiaomi 14T Pro', 'Xiaomi 14T', 'Xiaomi 14', 'Xiaomi 13T'],
    Redmi: ['Redmi Note 14 Pro', 'Redmi Note 14', 'Redmi Note 13 Pro', 'Redmi Note 13', 'Redmi 14C', 'Redmi 13'],
    POCO: ['POCO X7 Pro', 'POCO X7', 'POCO F7', 'POCO X6 Pro', 'POCO M6 Pro'],
    Google: ['Pixel 10 Pro', 'Pixel 10', 'Pixel 9 Pro', 'Pixel 9', 'Pixel 8'],
    'Інший бренд': ['Вкажу в заявці'],
  };
  const brandSel = $('#pickBrand');
  const modelSel = $('#pickModel');
  const fill = (sel, items) => { sel.innerHTML = items.map((v) => `<option>${v}</option>`).join(''); };
  fill(brandSel, Object.keys(MODELS));
  const syncModels = () => fill(modelSel, MODELS[brandSel.value]);
  brandSel.addEventListener('change', syncModels);
  syncModels();
  modelSel.value = 'iPhone 15 Pro';

  $('#pickerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    openModal({
      brand: brandSel.value === 'Інший бренд' ? '' : brandSel.value,
      model: modelSel.value === 'Вкажу в заявці' ? '' : modelSel.value,
      source: 'Підбір у першому екрані',
    });
  });

  /* ---------- модалка ---------- */
  const modal = $('#leadModal');
  const modalForm = $('form', modal);
  let lastFocus = null;

  function openModal(data = {}) {
    lastFocus = document.activeElement;
    modalForm.source.value = data.source || 'Модалка';
    if (data.brand !== undefined) modalForm.brand.value = data.brand;
    if (data.model !== undefined) modalForm.model.value = data.model;
    const glass = modalForm.querySelector(`input[name="glass"][value="${data.glass || 'Classic'}"]`);
    if (glass) glass.checked = true;
    modal.hidden = false;
    document.body.classList.add('no-scroll');
    setTimeout(() => modalForm.name.focus(), 50);
  }
  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove('no-scroll');
    if (lastFocus) lastFocus.focus();
  }
  $$('[data-open-lead]').forEach((b) => b.addEventListener('click', () => openModal({
    glass: b.dataset.glass,
    source: b.dataset.source,
  })));
  $$('[data-close-modal]', modal).forEach((el) => el.addEventListener('click', closeModal));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

  /* ---------- маска телефону +380 ---------- */
  function formatPhone(value) {
    let d = value.replace(/\D/g, '');
    if (d.startsWith('0')) d = '38' + d;
    if (d && !d.startsWith('380')) d = '380' + d.replace(/^3?8?0?/, '');
    d = d.slice(0, 12);
    if (!d) return '';
    const p = [d.slice(0, 3), d.slice(3, 5), d.slice(5, 8), d.slice(8, 10), d.slice(10, 12)];
    let out = '+' + p[0];
    if (p[1]) out += ' ' + p[1];
    if (p[2]) out += ' ' + p[2];
    if (p[3]) out += ' ' + p[3];
    if (p[4]) out += ' ' + p[4];
    return out;
  }
  $$('input[type="tel"]').forEach((inp) => {
    inp.addEventListener('focus', () => { if (!inp.value) inp.value = '+380 '; });
    inp.addEventListener('blur', () => { if (inp.value.replace(/\D/g, '').length <= 3) inp.value = ''; });
    inp.addEventListener('input', () => { inp.value = formatPhone(inp.value); });
  });

  /* ---------- UTM ---------- */
  const utm = (() => {
    try {
      const q = new URLSearchParams(location.search);
      const parts = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']
        .filter((k) => q.get(k)).map((k) => `${k}=${q.get(k)}`);
      if (parts.length) sessionStorage.setItem('glassify-utm', parts.join('&'));
      return parts.join('&') || sessionStorage.getItem('glassify-utm') || '';
    } catch (e) { return ''; }
  })();

  /* ---------- відправка ---------- */
  const toast = $('#toast');
  let toastTimer;
  function showToast(msg, isError) {
    toast.textContent = msg;
    toast.classList.toggle('is-error', !!isError);
    toast.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-show'), 4500);
  }

  function validate(form) {
    let ok = true;
    const name = form.name;
    const phone = form.phone;
    const nameOk = name.value.trim().length >= 2;
    const digits = phone.value.replace(/\D/g, '').length;
    const phoneOk = digits >= 10 && digits <= 13;
    name.closest('.field').classList.toggle('is-invalid', !nameOk);
    phone.closest('.field').classList.toggle('is-invalid', !phoneOk);
    if (!nameOk) { ok = false; name.focus(); } else if (!phoneOk) { ok = false; phone.focus(); }
    return ok;
  }

  $$('[data-lead-form]').forEach((form) => {
    $$('input', form).forEach((i) => i.addEventListener('input', () => i.closest('.field')?.classList.remove('is-invalid')));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validate(form)) return;

      const payload = Object.fromEntries(new FormData(form).entries());
      if (!payload.source) payload.source = form.dataset.source || 'Форма';
      payload.utm = utm;

      const btn = $('button[type="submit"]', form);
      const label = btn.innerHTML;
      btn.disabled = true;
      btn.textContent = 'Надсилаємо…';

      try {
        const res = await fetch('/api/lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || 'Помилка відправки');

        form.reset();
        if (!modal.hidden) closeModal();
        showToast('Дякуємо! Заявку отримано — скоро передзвонимо.');
      } catch (err) {
        showToast(err.message || 'Не вдалося надіслати. Спробуйте ще раз.', true);
      } finally {
        btn.disabled = false;
        btn.innerHTML = label;
      }
    });
  });
})();
