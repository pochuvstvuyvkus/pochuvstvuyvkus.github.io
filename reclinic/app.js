/* =====================================================================
   Re:clinic Mini App — движок кликабельного прототипа и доски макетов.
   Экраны регистрируются через RC.register({...}) в screens/*.js.
   ===================================================================== */
(function () {
  'use strict';

  const RC = (window.RC = window.RC || {});
  RC.screens = {};
  RC.actions = {};
  RC.order = [];

  /* ------------------------------------------------------------ утилиты */

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (RC.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]));
  const json = (v) => esc(JSON.stringify(v));

  RC.fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
  RC.priceLabel = (p) => {
    if (!p) return '';
    if (p.price === 0) return 'Бесплатно';
    if (p.price == null) {
      const note = String(p.priceNote || 'Цена после подбора');
      return esc(/^после подбора/i.test(note) ? 'Цена после подбора' : note.charAt(0).toUpperCase() + note.slice(1));
    }
    // «10 000 / 11 000 ₽» — вилка цен с сайта показывается как есть
    if (!p.priceFrom && p.priceNote && /\d\s*\/\s*\d/.test(p.priceNote) && /₽/.test(p.priceNote)) return esc(p.priceNote).replace(/ /g, ' ');
    return (p.priceFrom ? 'от ' : '') + RC.fmt(p.price);
  };
  RC.plural = (n, one, few, many) => {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  };
  RC.clone = (o) => JSON.parse(JSON.stringify(o));
  RC.deepMerge = (base, over) => {
    if (over === undefined) return base;
    if (over === null || typeof over !== 'object' || Array.isArray(over)) return over;
    const out = base && typeof base === 'object' && !Array.isArray(base) ? Object.assign({}, base) : {};
    Object.keys(over).forEach((k) => { out[k] = RC.deepMerge(out[k], over[k]); });
    return out;
  };
  RC.getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  RC.setPath = (obj, path, value) => {
    const ks = path.split('.');
    let o = obj;
    ks.slice(0, -1).forEach((k) => { if (o[k] == null || typeof o[k] !== 'object') o[k] = {}; o = o[k]; });
    o[ks[ks.length - 1]] = value;
  };

  /** Атрибуты навигации: RC.link('product', {id:'iv-nad'}, {'catalog.category':'iv'}) */
  RC.link = (screen, params, set) =>
    `data-go="${esc(screen)}"` +
    (params && Object.keys(params).length ? ` data-params="${json(params)}"` : '') +
    (set ? ` data-set="${json(set)}"` : '');
  /** Переход со сбросом истории (например, после оплаты). */
  RC.linkRoot = (screen, params, set) => RC.link(screen, params, set) + ' data-root';
  /** Атрибуты действия: RC.act('add', {id:'iv-nad'}) */
  RC.act = (name, payload) => `data-action="${esc(name)}"` + (payload !== undefined ? ` data-payload="${json(payload)}"` : '');

  /* --------------------------------------------------------------- иконки */

  const ICONS = {
    home: '<path d="M3.5 10.2 12 3.5l8.5 6.7V19a1.5 1.5 0 0 1-1.5 1.5h-4.3v-5.6H9.3v5.6H5A1.5 1.5 0 0 1 3.5 19z"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2.2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2.2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2.2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2.2"/>',
    bag: '<path d="M5.2 8h13.6l-1 11.6a1.6 1.6 0 0 1-1.6 1.4H7.8a1.6 1.6 0 0 1-1.6-1.4z"/><path d="M9 10V6.8a3 3 0 0 1 6 0V10"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c.6-3.9 3.7-6.5 7.5-6.5s6.9 2.6 7.5 6.5"/>',
    chevL: '<path d="m15 18-6-6 6-6"/>',
    chevR: '<path d="m9 18 6-6-6-6"/>',
    chevD: '<path d="m6 9 6 6 6-6"/>',
    heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/>',
    heartF: 'F:<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
    sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
    pin: '<path d="M12 21s-7-6.1-7-11.6a7 7 0 0 1 14 0C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    phone: '<path d="M21.5 16.4v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 1.6 3.7 2 2 0 0 1 3.6 1.5h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L7.6 9.4a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    trash: '<path d="M4 7h16M9.5 11v6M14.5 11v6M6 7l.9 12.2A2 2 0 0 0 8.9 21h6.2a2 2 0 0 0 2-1.8L18 7M9 7V4.5h6V7"/>',
    star: 'F:<path d="m12 2.8 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.3l-5.7 3 1.1-6.3-4.6-4.5 6.4-.9z"/>',
    gift: '<rect x="3" y="8" width="18" height="4.5" rx="1.2"/><path d="M12 8v13M19 12.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    chart: '<path d="M3.5 3.5v17h17"/><path d="m7.5 14.5 3.5-4 3 2.5 5-6"/>',
    chat: '<path d="M20.5 11.6a8.4 8.4 0 0 1-12.2 7.5L3.5 20.5l1.4-4.4A8.4 8.4 0 1 1 20.5 11.6z"/>',
    bell: '<path d="M6 8.5a6 6 0 0 1 12 0c0 6.5 2.5 8.5 2.5 8.5h-17S6 15 6 8.5"/><path d="M10.3 20.5a2 2 0 0 0 3.4 0"/>',
    drop: '<path d="M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11z"/><path d="M9.2 14.6a2.9 2.9 0 0 0 2.4 2.6"/>',
    flask: '<path d="M9 3h6M10 3v5.5L4.6 18.3A2 2 0 0 0 6.3 21.3h11.4a2 2 0 0 0 1.7-3L14 8.5V3"/><path d="M7.2 15h9.6"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"/><path d="M2.5 21c0-3 1.8-5.4 5-6 2.4-.5 4.5-1.9 5.5-3"/>',
    sparkles: '<path d="m11 3 1.7 4.8L17.5 9.5l-4.8 1.7L11 16l-1.7-4.8-4.8-1.7 4.8-1.7z"/><path d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
    shield: '<path d="M12 21.5s7.5-3.6 7.5-9.6V5.4L12 2.5 4.5 5.4v6.5c0 6 7.5 9.6 7.5 9.6z"/><path d="m8.8 11.8 2.2 2.2 4.2-4.3"/>',
    card: '<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M2.5 10h19M6.5 15h4"/>',
    route: '<path d="M3.5 11 21 3l-8 17.5-1.9-7.6z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8h.01"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    arrowR: '<path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5"/>',
    share: '<path d="M12 3.5v12M7.5 8 12 3.5 16.5 8M5 13.5v5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5v-5"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="m20.5 15.5-4.5-4.5-8.5 8.5"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    stetho: '<path d="M5 3.5v5a4.5 4.5 0 0 0 9 0v-5"/><path d="M9.5 13v1.5a5 5 0 0 0 10 0V13"/><circle cx="19.5" cy="10.5" r="2.3"/>',
    body: '<rect x="4" y="3" width="16" height="18" rx="4"/><path d="M8 9a5.2 5.2 0 0 1 8 0M12 9l1.6-2.2"/>',
    percent: '<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
    tag: '<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.4 1.4 0 0 1 0 2l-6.7 6.7a1.4 1.4 0 0 1-2 0z"/><circle cx="8" cy="8" r="1.4"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3"/>',
    bolt: '<path d="M13 2.5 4.5 13.5H12l-1 8 8.5-11H12z"/>',
    quote: 'F:<path d="M4 18.5v-5.2C4 9 6.3 6.3 10 5.5l.8 1.8C8.6 8.2 7.6 9.7 7.5 12H10v6.5zm9.5 0v-5.2c0-4.3 2.3-7 6-7.8l.8 1.8c-2.2.9-3.2 2.4-3.3 4.7H20v6.5z"/>',
    dots: 'F:<circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>',
    telegram: 'F:<path d="M20.7 3.6 2.9 10.5c-1.2.5-1.2 1.2-.2 1.5l4.6 1.4 1.7 5.4c.2.6.1.9.8.9.5 0 .7-.2 1-.5l2.2-2.1 4.6 3.4c.8.5 1.4.2 1.6-.8l3-14.1c.3-1.3-.5-1.8-1.5-1.5zM8.9 13.1l8.6-5.4c.4-.3.8-.1.5.2l-7.1 6.4-.3 3z"/>',
  };

  RC.icon = (name, size = 22, cls = '') => {
    let body = ICONS[name] || ICONS.info;
    const filled = body.startsWith('F:');
    if (filled) body = body.slice(2);
    const paint = filled
      ? 'fill="currentColor" stroke="none"'
      : 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
    return `<svg class="ico${cls ? ' ' + cls : ''}" width="${size}" height="${size}" viewBox="0 0 24 24" ${paint} aria-hidden="true">${body}</svg>`;
  };
  const I = RC.icon;

  /* --------------------------------------------------------------- данные */

  const CAT_FALLBACK = { iv: 'Капельницы', checkups: 'Чек-апы', consultations: 'Консультации', programs: 'Программы', cosmetology: 'Косметология' };
  RC.CAT_ICON = { iv: 'drop', checkups: 'flask', consultations: 'stetho', programs: 'leaf', cosmetology: 'sparkles' };
  const GOAL_FALLBACK = {
    weight: 'Снижение веса', energy: 'Энергия', detox: 'Детокс', beauty: 'Красота', skin: 'Кожа', hair: 'Волосы',
    stress: 'Анти-стресс', immunity: 'Иммунитет', women: 'Женское здоровье', men: 'Мужское здоровье',
    antiage: 'Anti-age', recovery: 'Восстановление', diagnostics: 'Диагностика',
  };

  RC.data = () => window.RC_DATA || { products: [], categories: [], goals: [] };
  RC.product = (id) => (RC.data().products || []).find((p) => p.id === id) || null;
  /** Единый каталог: разделение «онлайн / офлайн» отключено, направление — только свойство продукта. */
  RC.UNIFIED = true;
  RC.inDir = (p, dir) => RC.UNIFIED || !dir || !p.directions || p.directions.includes(dir);
  /** Формат услуги для подписи: «Онлайн», «В клинике» или «Онлайн или в клинике». */
  RC.formatLabel = (p) => {
    const d = (p && p.directions) || [];
    if (d.includes('online') && d.includes('offline')) return 'Онлайн или в клинике';
    if (d.includes('online')) return 'Онлайн';
    return 'В клинике';
  };
  RC.productsBy = (f = {}) =>
    (RC.data().products || []).filter((p) =>
      (!f.category || f.category === 'all' || p.category === f.category) &&
      (!f.goal || (p.goals || []).includes(f.goal)) &&
      RC.inDir(p, f.dir) &&
      (!f.ids || f.ids.includes(p.id)));
  RC.category = (id) => (RC.data().categories || []).find((c) => c.id === id) || { id, title: CAT_FALLBACK[id] || id };
  RC.categoriesFor = (dir) => {
    const cats = RC.data().categories && RC.data().categories.length
      ? RC.data().categories
      : Object.keys(CAT_FALLBACK).map((id) => ({ id, title: CAT_FALLBACK[id] }));
    return cats.filter((c) => RC.productsBy({ category: c.id, dir }).length);
  };
  RC.goalTitle = (id) => ((RC.data().goals || []).find((g) => g.id === id) || {}).title || GOAL_FALLBACK[id] || id;
  RC.branch = (id) => { const bs = RC.data().branches || []; return bs.find((b) => b.id === id) || bs[0] || null; };
  RC.teamMember = (id) => (RC.data().team || []).find((t) => t.id === id) || null;
  RC.day = (iso) => ((window.RC_DEMO && RC_DEMO.days) || []).find((d) => d.iso === iso) || null;
  RC.kicker = (p) => [RC.category(p.category).title, p.duration].filter(Boolean).join(' · ');

  /* ------------------------------------------------ тона и иллюстрации */

  const TONES = (RC.TONES = {
    sage: { bg: '#E4EBE0', accent: '#497259', accent2: '#C8B78A' },
    mint: { bg: '#DCEBE4', accent: '#2F7A62', accent2: '#9FD0BA' },
    sand: { bg: '#F1EADA', accent: '#A88A4E', accent2: '#497259' },
    blush: { bg: '#F3E4DE', accent: '#C0776A', accent2: '#E7B8A8' },
    sky: { bg: '#E1E8EE', accent: '#56708A', accent2: '#A9BDD1' },
    lilac: { bg: '#E8E3EE', accent: '#7C6A94', accent2: '#C6B8DA' },
    butter: { bg: '#F3EDD2', accent: '#AE8C2C', accent2: '#E1CC83' },
    stone: { bg: '#ECECE7', accent: '#545F4C', accent2: '#C2BA9D' },
    deep: { bg: '#2B4A34', accent: '#C8B78A', accent2: '#6A9277' },
  });
  const GOAL_TONE = {
    weight: 'sage', energy: 'butter', detox: 'mint', beauty: 'blush', skin: 'blush', hair: 'sand', stress: 'lilac',
    immunity: 'sky', women: 'blush', men: 'sky', antiage: 'sand', recovery: 'mint', diagnostics: 'stone',
  };
  const CAT_TONE = { checkups: 'sage', consultations: 'stone', programs: 'sand', cosmetology: 'blush' };
  RC.tone = (p) => {
    if (!p) return TONES.sage;
    if (p.tone && TONES[p.tone]) return TONES[p.tone];
    if (p.id === 'iv-nad') return TONES.sand;
    const g = (p.goals || []).find((x) => GOAL_TONE[x]);
    if (p.category === 'iv' && g) return TONES[GOAL_TONE[g]];
    if (CAT_TONE[p.category] && p.category !== 'checkups') return TONES[CAT_TONE[p.category]];
    return g ? TONES[GOAL_TONE[g]] : TONES.sage;
  };
  RC.toneStyle = (t) => `--tone-bg:${t.bg};--tone-accent:${t.accent};--tone-accent2:${t.accent2}`;

  const IV_LABEL = {
    'iv-nad': 'NAD+', 'iv-total-detox': 'DETOX', 'iv-detox-relax': 'RELAX', 'iv-detox-plus': 'DETOX+',
    'iv-brightening': 'GLOW', 'iv-drain-boost': 'DRAIN', 'iv-stress-release': 'CALM', 'iv-stop-acne': 'SKIN',
    'iv-fe': 'Fe', 'iv-slim-body': 'SLIM', 'iv-collagen-before': 'COLL', 'iv-collagen-after': 'COLL+',
    'iv-immune': 'IMMUNE', 'iv-long-hair': 'HAIR', 'iv-total-regeneration': 'REGEN', 'iv-deep-breath': 'O₂',
    'iv-energy-boost': 'ENERGY', 'iv-metabol': 'META', 'iv-water-out': 'LYMPH', 'iv-sos': 'SOS',
  };
  RC.ivLabel = (p) => IV_LABEL[p.id] || String(p.code || p.title || '').split(/[\s/&]+/)[0].slice(0, 6);

  RC.illuKind = (p) => {
    if (!p) return 'gift';
    if (p.category === 'iv') return 'iv';
    if (p.category === 'checkups') return 'checkup';
    if (p.category === 'cosmetology') return 'cosmetology';
    if (p.category === 'consultations') return p.directions && p.directions.includes('offline') && !p.directions.includes('online') ? 'consult-offline' : 'consult-online';
    if (p.category === 'programs') {
      const BY_ID = { 'peptide-box': 'peptide-box', 'program-iv-course': 'iv', 'program-lifestyle': 'program-energy', 'program-support': 'doctor', 'program-antiage': 'program-antiage' };
      if (BY_ID[p.id]) return BY_ID[p.id];
      const g = p.goals || [];
      if (g.includes('weight')) return 'program-weight';
      if (g.includes('energy')) return 'program-energy';
      return 'program-antiage';
    }
    return 'gift';
  };

  let fallbackSeq = 0;
  RC.illu = (kind, opts = {}) => {
    if (window.RCIllu && typeof window.RCIllu.render === 'function') {
      try { return window.RCIllu.render(kind, opts); } catch (e) { console.warn('[RC] illustration', kind, e); }
    }
    const t = opts.tone || TONES.sage;
    const id = 'fb' + (++fallbackSeq);
    return `<svg viewBox="0 0 240 200" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs><radialGradient id="${id}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="${t.accent}"/></radialGradient></defs>
      <ellipse cx="120" cy="180" rx="58" ry="8" fill="rgba(17,16,19,.08)"/>
      <circle cx="120" cy="98" r="64" fill="${t.accent}" opacity=".16"/>
      <circle cx="120" cy="98" r="44" fill="url(#${id})"/>
      ${opts.label ? `<text x="120" y="104" text-anchor="middle" font-family="Rubik,Arial" font-weight="600" font-size="17" fill="#fff">${esc(opts.label)}</text>` : ''}
    </svg>`;
  };
  /* ------------------------------------------------ фото с сайта */

  const IMG = () => window.RC_IMAGES || null;
  /** Позиции без своей картинки на сайте — тематические фото с того же сайта. */
  const PHOTO_FALLBACK = {
    'iv-detox-plus': 'products:iv-total-detox', 'iv-drain-boost': 'products:iv-water-out', 'iv-total-regeneration': 'products:iv-long-hair',
    'consult-online-repeat': 'products:consult-online-60', 'consult-offline-primary': 'products:consult-offline-endo',
    'program-peptide-weight-loss': 'hero:8', 'program-weight-loss-online': 'hero:3', 'program-support': 'clinic:5',
    'program-lifestyle': 'hero:6', 'program-antiage': 'hero:10', 'peptide-box': 'clinic:3',
    'cosmo-biorevitalization': 'hero:10', 'cosmo-plasmolifting': 'hero:11', 'cosmo-contour-fillers': 'products:checkup-beauty',
    'cosmo-botulinum': 'hero:11', 'cosmo-thread-lifting': 'hero:10', 'cosmo-hydropeptide-cleansing': 'products:checkup-women',
    'cosmo-scalp-mesotherapy': 'products:checkup-beauty', 'cosmo-rsl-sculpting': 'hero:8', 'cosmo-massage-classic': 'products:checkup-men',
    'cosmo-massage-anticellulite': 'hero:9', 'cosmo-massage-body-face': 'hero:6', 'cosmo-wrap-whisky': 'hero:9',
    'cosmo-wrap-cellogel': 'products:checkup-weight', 'cosmo-wrap-cellogel-massage': 'hero:8', 'cosmo-wrap-whisky-rsl': 'hero:4',
    'cosmo-injection-lipolysis': 'products:checkup-weight',
  };
  /** RC.image('hero:1') / RC.image('clinic:2') / RC.image('products:iv-nad') → путь к файлу или null. */
  RC.image = (ref) => {
    const im = IMG();
    if (!im || !ref) return null;
    const [g, k] = String(ref).split(':');
    if (g === 'products' || g === 'team') return (im[g] && im[g][k]) || null;
    if (g === 'logo') return im.logo || null;
    const it = (im[g] || [])[+k - 1];
    return it ? it.src : null;
  };
  RC.photoFor = (p) => {
    const im = IMG();
    if (!im || !p) return null;
    return (im.products && im.products[p.id]) || RC.image(PHOTO_FALLBACK[p.id]);
  };
  /** Фото специалиста по id или имени («Екатерина Кулакова», «Кулакова Екатерина Геннадьевна»). */
  RC.teamPhoto = (idOrName) => {
    const im = IMG();
    if (!im || !im.team || !idOrName) return null;
    if (im.team[idOrName]) return im.team[idOrName];
    const words = String(idOrName).toLowerCase().replace(/ё/g, 'е').split(/\s+/).filter(Boolean);
    const m = (RC.data().team || []).find((t) => {
      const parts = String(t.name || '').toLowerCase().replace(/ё/g, 'е').split(/\s+/);
      return words.length > 0 && words.every((w) => parts.includes(w));
    });
    return m ? im.team[m.id] || null : null;
  };
  const photoFit = (p, src) => {
    if (/\.png$/i.test(src) && /consult/.test(src)) return 'cutout';
    if (p.id === 'checkup-individual') return 'contain';
    return 'cover';
  };

  RC.productIllu = (p, variant) => {
    const photo = RC.photoFor(p);
    if (photo) return `<img class="rc-photo rc-photo--${photoFit(p, photo)}" src="${esc(photo)}" alt="${esc(p.title)}">`;
    const kind = RC.illuKind(p);
    const label = p && p.category === 'iv' ? RC.ivLabel(p) : kind === 'iv' ? 'КУРС' : undefined;
    return RC.illu(kind, { tone: RC.tone(p), label, variant: variant || 0 });
  };
  /** Экран карточки: программы (кроме пептид-бокса) открываются на странице программы. */
  RC.productScreen = (p) => (p && p.category === 'programs' && p.id !== 'peptide-box' && RC.screens.program ? 'program' : 'product');

  /* ------------------------------------------------------------- корзина */

  RC.cartCount = (s) => (s.cart || []).reduce((a, i) => a + (i.qty || 1), 0);
  RC.cartTotal = (s) => (s.cart || []).reduce((a, i) => { const p = RC.product(i.id); return a + (p && p.price ? p.price * (i.qty || 1) : 0); }, 0);
  RC.inCart = (s, id) => (s.cart || []).some((i) => i.id === id);
  RC.isFav = (s, id) => (s.favorites || []).includes(id);

  RC.actions.add = ({ id, slot }, ctx) => {
    const s = ctx.state;
    const item = s.cart.find((i) => i.id === id);
    if (item) { if (slot) item.slot = slot; else item.qty = (item.qty || 1) + 1; }
    else s.cart.push(Object.assign({ id, qty: 1 }, slot ? { slot } : {}));
    const p = RC.product(id);
    RC.toast('Добавлено в корзину', { sub: p ? p.title : '', go: { screen: 'cart', label: 'Корзина' } });
  };
  RC.actions.inc = ({ id }, ctx) => { const it = ctx.state.cart.find((i) => i.id === id); if (it) it.qty = (it.qty || 1) + 1; };
  RC.actions.dec = ({ id }, ctx) => {
    const s = ctx.state, it = s.cart.find((i) => i.id === id);
    if (!it) return;
    if ((it.qty || 1) > 1) it.qty -= 1; else s.cart = s.cart.filter((i) => i.id !== id);
  };
  RC.actions.remove = ({ id }, ctx) => { ctx.state.cart = ctx.state.cart.filter((i) => i.id !== id); };
  RC.actions.fav = ({ id }, ctx) => {
    const f = ctx.state.favorites;
    const on = f.includes(id);
    ctx.state.favorites = on ? f.filter((x) => x !== id) : f.concat(id);
    if (!on) RC.toast('Добавлено в избранное', { icon: 'heart', sub: (RC.product(id) || {}).title });
  };
  RC.actions['go-cart'] = () => { RC.go('cart'); return false; };
  /** Универсальная установка состояния: RC.act('set', {'booking.time': '12:30'}); '$toggle' — инверсия. */
  RC.actions.set = (payload, ctx) => {
    Object.keys(payload).forEach((k) => {
      const v = payload[k];
      RC.setPath(ctx.state, k, v === '$toggle' ? !RC.getPath(ctx.state, k) : v);
    });
  };
  RC.actions['sheet-open'] = ({ key }) => { RC.proto.sheet = key; };
  RC.actions['sheet-close'] = () => { RC.proto.sheet = null; };
  RC.actions.toast = ({ text, sub, icon }) => { RC.toast(text, { sub, icon }); return false; };

  /* ------------------------------------------------------------ компоненты */

  const ui = (RC.ui = {});

  ui.btn = (label, o = {}) => {
    const cls = ['btn', 'btn--' + (o.variant || 'primary'), o.size ? 'btn--' + o.size : '', o.block ? 'btn--block' : '', o.cls || ''].filter(Boolean).join(' ');
    const ic = o.size === 'sm' ? 18 : 20;
    return `<button class="${cls}" ${o.attrs || ''}${o.disabled ? ' disabled' : ''}>${o.icon ? I(o.icon, ic) : ''}<span>${o.html ? label : esc(label)}</span>${o.iconRight ? I(o.iconRight, ic) : ''}</button>`;
  };
  ui.iconBtn = (icon, attrs = '', o = {}) =>
    `<button class="ibtn ibtn--${o.variant || 'soft'}${o.on ? ' on' : ''}${o.cls ? ' ' + o.cls : ''}" ${attrs} aria-label="${esc(o.label || icon)}">${I(icon, o.size || 20)}${o.badge ? `<span class="ibtn__badge">${esc(o.badge)}</span>` : ''}</button>`;
  ui.chip = (label, o = {}) =>
    `<button class="chip${o.on ? ' on' : ''}" ${o.attrs || ''}>${o.icon ? I(o.icon, 17) : ''}<span>${esc(label)}</span>${o.count != null ? `<em>${esc(o.count)}</em>` : ''}</button>`;
  ui.seg = (options, value, path) =>
    `<div class="seg">${options.map((op) => `<button class="seg__b${op.value === value ? ' on' : ''}" ${RC.act('set', { [path]: op.value })}><b>${esc(op.label)}</b>${op.sub ? `<small>${esc(op.sub)}</small>` : ''}</button>`).join('')}</div>`;
  ui.tag = (t, o = {}) => `<span class="tag${o.tone ? ' tag--' + o.tone : ''}">${o.icon ? I(o.icon, 14) : ''}${esc(t)}</span>`;
  ui.badge = (t, tone = 'dark') => `<span class="badge badge--${tone}">${esc(t)}</span>`;
  ui.sectionHead = (title, o = {}) =>
    `<div class="sec__head"><div><h3 class="sec__title">${esc(title)}</h3>${o.sub ? `<p class="sec__sub">${esc(o.sub)}</p>` : ''}</div>${o.link ? `<button class="sec__link" ${o.attrs || ''}>${esc(o.link)}</button>` : ''}</div>`;
  ui.appbar = (title, o = {}) =>
    `<header class="appbar"><div><h1 class="appbar__title">${esc(title)}</h1>${o.sub ? `<p class="appbar__sub">${esc(o.sub)}</p>` : ''}</div>${o.right || ''}</header>`;
  /** Аватар: o.photo — путь к фото, o.name — имя специалиста (фото подтянется с сайта). */
  ui.avatar = (initials, o = {}) => {
    const photo = o.photo || (o.name ? RC.teamPhoto(o.name) : null);
    return `<span class="avatar${photo ? ' avatar--photo' : ''}" style="--s:${o.size || 52}px">${photo ? `<img src="${esc(photo)}" alt="">` : esc(initials)}${o.tg ? `<span class="avatar__tg">${I('telegram', 11)}</span>` : ''}</span>`;
  };

  ui.productCard = (p, ctx, o = {}) => {
    if (!p) return '';
    const s = ctx.state;
    const variant = o.variant || 'grid';
    const inCart = RC.inCart(s, p.id);
    const fav = RC.isFav(s, p.id);
    const add = p.price != null
      ? `<button class="pcard__add${inCart ? ' is-in' : ''}" ${RC.act(inCart ? 'go-cart' : 'add', { id: p.id })} aria-label="${inCart ? 'Уже в корзине' : 'В корзину'}">${I(inCart ? 'check' : 'plus', 20)}</button>`
      : '';
    return `<article class="pcard pcard--${variant}" ${RC.link(o.screen || RC.productScreen(p), { id: p.id })}>
      <div class="pcard__media" style="${RC.toneStyle(RC.tone(p))}">
        <div class="pcard__illu">${RC.productIllu(p, o.illuVariant)}</div>
        ${p.badge ? `<span class="pcard__badge">${ui.badge(p.badge)}</span>` : ''}
        <button class="pcard__fav${fav ? ' on' : ''}" ${RC.act('fav', { id: p.id })} aria-label="В избранное">${I(fav ? 'heartF' : 'heart', 18)}</button>
        ${add}
      </div>
      <div class="pcard__body">
        <div class="pcard__title">${esc(p.title)}</div>
        <div class="pcard__sub">${esc(o.sub != null ? o.sub : (p.short || p.subtitle || ''))}</div>
        <div class="pcard__price">${RC.priceLabel(p)}</div>
      </div>
    </article>`;
  };

  ui.illuBox = (p, o = {}) =>
    `<div class="illubox${o.cls ? ' ' + o.cls : ''}" style="${RC.toneStyle(RC.tone(p))}">${RC.productIllu(p, o.variant)}</div>`;

  ui.row = (o) => {
    const tag = o.attrs ? 'button' : 'div';
    return `<${tag} class="lrow" ${o.attrs || ''}>${o.icon ? `<span class="lrow__ico${o.tone ? ' lrow__ico--' + o.tone : ''}">${I(o.icon, 20)}</span>` : ''}${o.lead || ''}<span class="lrow__main"><b>${esc(o.title)}</b>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</span>${o.right ? `<span class="lrow__right">${o.right}</span>` : ''}${o.attrs && o.chevron !== false ? I('chevR', 18, 'lrow__chev') : ''}</${tag}>`;
  };
  ui.list = (rows) => `<div class="list">${rows.join('')}</div>`;
  ui.qty = (id, qty) =>
    `<div class="qty"><button ${RC.act('dec', { id })} aria-label="Меньше">${I('minus', 16)}</button><b>${qty}</b><button ${RC.act('inc', { id })} aria-label="Больше">${I('plus', 16)}</button></div>`;
  ui.field = (label, value, o = {}) =>
    `<label class="field${o.cls ? ' ' + o.cls : ''}">${o.icon ? I(o.icon, 20, 'field__ico') : ''}<span class="field__body"><small>${esc(label)}</small>${o.bind ? `<input value="${esc(value)}" data-bind="${esc(o.bind)}" placeholder="${esc(o.placeholder || '')}">` : `<b>${esc(value)}</b>`}</span>${o.right || ''}</label>`;
  ui.option = (o) =>
    `<button class="opt${o.on ? ' on' : ''}" ${o.attrs || ''}>${o.icon ? `<span class="opt__ico">${I(o.icon, 20)}</span>` : ''}${o.lead || ''}<span class="opt__main"><b>${esc(o.title)}</b>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</span>${o.right ? `<span class="opt__right">${o.right}</span>` : ''}<span class="opt__radio"></span></button>`;
  /** Чекбокс; labelHtml может содержать разметку (ссылки на документы). */
  ui.check = (labelHtml, on, path) =>
    `<button class="check${on ? ' on' : ''}" ${RC.act('set', { [path]: '$toggle' })}><span class="check__box">${on ? I('check', 14) : ''}</span><span>${labelHtml}</span></button>`;
  ui.buybar = (inner) => `<div class="buybar">${inner}</div>`;
  ui.sheet = (inner, o = {}) =>
    `<div class="sheet-wrap"><div class="sheet-backdrop" ${RC.act('sheet-close')}></div><div class="sheet"><span class="sheet__grab"></span>${o.title ? `<h3 class="sheet__title">${esc(o.title)}</h3>` : ''}${inner}</div></div>`;
  ui.progress = (v, o = {}) =>
    `<div class="progress${o.cls ? ' ' + o.cls : ''}"><span style="width:${Math.max(0, Math.min(100, v * 100)).toFixed(1)}%"></span></div>`;
  ui.disclaimer = (t) => `<p class="disclaimer">${esc(t || 'Имеются противопоказания. Необходима консультация специалиста')}</p>`;
  ui.empty = (kind, title, text, cta) =>
    `<div class="empty"><div class="empty__illu">${RC.illu(kind, { tone: TONES.sage })}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${cta || ''}</div>`;
  ui.acc = (q, a, open) =>
    `<details class="acc"${open ? ' open' : ''}><summary><span>${esc(q)}</span>${I('chevD', 18)}</summary><div class="acc__body">${esc(a)}</div></details>`;
  ui.tabbar = (active, ctx) => {
    const n = RC.cartCount(ctx.state);
    const tabs = [['home', 'home', 'Главная'], ['catalog', 'grid', 'Каталог'], ['cart', 'bag', 'Корзина'], ['profile', 'user', 'Кабинет']];
    return `<nav class="tabbar"><div class="tabbar__pill">${tabs.map(([id, icon, label]) =>
      `<button class="tab${active === id ? ' on' : ''}" ${RC.link(id)} aria-label="${label}">${I(icon, 22)}${active === id ? `<span>${label}</span>` : ''}${id === 'cart' && n ? `<em class="tab__badge">${n}</em>` : ''}</button>`).join('')}</div></nav>`;
  };

  /* ------------------------------------------------------- реестр экранов */

  /**
   * RC.register({
   *   id, title, short, note, points: [],
   *   tabbar: 'home'|'catalog'|'cart'|'profile' (активная вкладка; без него — нет нижней навигации),
   *   root: true (в шапке Telegram «Закрыть» вместо «Назад»),
   *   dark: bool|fn(ctx) (светлый статус-бар), bg: '#fff'|fn(ctx),
   *   examples: [{ label, params, state }],
   *   render(ctx) → html, overlay(ctx) → html, mount(host, ctx)
   * })
   */
  RC.register = (def) => {
    if (!def || !def.id || typeof def.render !== 'function') throw new Error('[RC] screen needs id and render()');
    RC.screens[def.id] = def;
    if (!RC.order.includes(def.id)) RC.order.push(def.id);
  };

  RC.flows = [
    { id: 'auth', title: 'Вход через Telegram', text: 'Клиент открывает бота — Mini App сам узнаёт его по Telegram-аккаунту. Без паролей и форм регистрации: имя и фото приходят из Telegram, номер телефона — одной кнопкой по согласию.', screens: ['splash', 'welcome'] },
    { id: 'shop', title: 'Витрина и каталог', text: 'Главная работает как магазин, а не как сайт-визитка: главный оффер, категории, хиты с покупкой в один тап, программы. Каталог — все услуги клиники в одном месте, онлайн и в клинике, с фильтрами по цели.', screens: ['home', 'catalog'] },
    { id: 'product', title: 'Продукт и программы', text: 'Карточка продукта — продающая страница: цена, что входит, эффекты, ответы на вопросы и две кнопки — «Записаться» и «В корзину». Программу помогает выбрать короткий тест.', screens: ['product', 'program', 'quiz'] },
    { id: 'buy', title: 'Запись, корзина и оплата', text: 'Выбор филиала, даты и времени, корзина с несколькими услугами, оформление с контактами из Telegram и оплата.', screens: ['booking', 'cart', 'checkout', 'success'] },
    { id: 'cabinet', title: 'Личный кабинет', text: 'Всё купленное — в одном месте: записи, заказы и их статусы, результаты анализов, прогресс по программе.', screens: ['profile', 'orders', 'results', 'progress'] },
    { id: 'clinic', title: 'О клинике', text: 'Доверие и навигация: результаты клиентов, команда специалистов, филиалы с маршрутом.', screens: ['beforeafter', 'team', 'contacts'] },
  ];

  RC.freshState = () => RC.clone((window.RC_DEMO && window.RC_DEMO.state) || { direction: 'offline', cart: [], favorites: [] });
  RC.ctx = (state, params, o = {}) => ({
    state, params: params || {}, data: RC.data(), demo: window.RC_DEMO || {}, ui: RC.ui, interactive: !!o.interactive,
  });

  /* ------------------------------------------------------------- телефон */

  const STATUS_ICONS =
    '<svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>' +
    '<svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor" aria-hidden="true"><path d="M8 2.3c2.3 0 4.4.9 6 2.4l1.2-1.3A10.2 10.2 0 0 0 8 .5 10.2 10.2 0 0 0 .8 3.4L2 4.7a8.4 8.4 0 0 1 6-2.4zm0 3.6c1.3 0 2.5.5 3.5 1.3l1.2-1.3A7 7 0 0 0 8 4.1a7 7 0 0 0-4.7 1.8l1.2 1.3c1-.8 2.2-1.3 3.5-1.3zm0 3.6c.4 0 .8.1 1.1.4L8 11.1 6.9 9.9c.3-.3.7-.4 1.1-.4z"/></svg>' +
    '<svg width="27" height="13" viewBox="0 0 27 13" aria-hidden="true"><rect x=".5" y=".5" width="23" height="12" rx="3.8" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="20" height="9" rx="2.4" fill="currentColor"/><path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2z" fill="currentColor" opacity=".45"/></svg>';

  const tghead = (canBack) =>
    `<div class="tghead">
      ${canBack
        ? `<button class="tghead__side" data-back>${I('chevL', 22)}<span>Назад</span></button>`
        : `<button class="tghead__side" ${RC.act('toast', { text: 'Mini App закроется', sub: 'и вернёт в чат с ботом Re:clinic', icon: 'telegram' })}><span>Закрыть</span></button>`}
      <div class="tghead__title"><b>Re:clinic</b><span>мини-приложение</span></div>
      <button class="tghead__more" ${RC.act('toast', { text: 'Меню Telegram', sub: 'поделиться, настройки, сообщить о проблеме', icon: 'telegram' })} aria-label="Меню">${I('dots', 18)}</button>
    </div>`;

  RC.phoneHTML = (id, ctx, opt = {}) => {
    const scr = RC.screens[id];
    let body = '';
    let overlay = '';
    if (!scr) {
      body = `<div class="scr-missing">Экран «${esc(id)}» ещё в работе</div>`;
    } else {
      try {
        body = scr.render(ctx) || '';
        overlay = scr.overlay ? scr.overlay(ctx) || '' : '';
      } catch (e) {
        console.error('[RC] render error in', id, e);
        body = `<div class="scr-error"><b>Ошибка экрана «${esc(id)}»</b><pre>${esc((e && e.stack) || e)}</pre></div>`;
      }
    }
    const val = (v) => (typeof v === 'function' ? v(ctx) : v);
    const dark = scr ? val(scr.dark) : false;
    const bg = (scr && val(scr.bg)) || '#FFFFFF';
    const canBack = opt.interactive ? !!opt.canBack : !(scr && (scr.tabbar || scr.root));
    const tab = scr && scr.tabbar ? ui.tabbar(scr.tabbar, ctx) : '';
    return `<div class="phone${opt.tall ? ' phone--tall' : ''}${dark ? ' theme-dark' : ''}" lang="ru" data-phone="${esc(id)}">
  <div class="phone__screen" style="--app-bg:${esc(bg)}">
    <div class="phone__island"></div>
    <div class="statusbar"><span>9:41</span><span class="statusbar__icons">${STATUS_ICONS}</span></div>
    ${tghead(canBack)}
    <div class="app" data-app>${body}${tab}</div>
    <div class="phone__overlay" data-overlay>${overlay}${opt.sheetHTML || ''}</div>
    <div class="phone__home"></div>
  </div>
</div>`;
  };

  /* --------------------------------------------------------- прототип */

  RC.proto = { stack: [], state: null, sheet: null };
  RC._toasts = [];
  RC._zoom = 0.8;
  const top = () => RC.proto.stack[RC.proto.stack.length - 1] || { screen: 'home', params: {} };

  RC.toast = (text, o = {}) => {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span class="toast__ico">${I(o.icon || 'check', 18)}</span><span class="toast__txt"><b>${esc(text)}</b>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</span>${o.go ? `<button class="toast__btn" ${RC.link(o.go.screen, o.go.params)}>${esc(o.go.label)}</button>` : ''}`;
    RC._toasts.forEach((t) => t.remove());
    RC._toasts = [el];
    const layer = document.querySelector('[data-proto-phone] [data-overlay]');
    if (layer) layer.appendChild(el);
    setTimeout(() => el.classList.add('is-out'), 2400);
    setTimeout(() => { el.remove(); RC._toasts = RC._toasts.filter((t) => t !== el); }, 2750);
  };

  RC.go = (screen, params = {}, o = {}) => {
    const scr = RC.screens[screen];
    if (!scr) { RC.toast('Экран в работе', { icon: 'info', sub: screen }); return; }
    RC.proto.sheet = null;
    if (o.root || scr.tabbar) RC.proto.stack = [{ screen, params }];
    else RC.proto.stack.push({ screen, params });
    renderProto(false);
  };
  RC.back = () => {
    if (RC.proto.stack.length > 1) RC.proto.stack.pop();
    RC.proto.sheet = null;
    renderProto(false);
  };
  RC.replace = (screen, params = {}) => {
    RC.proto.stack[RC.proto.stack.length - 1] = { screen, params };
    RC.proto.sheet = null;
    renderProto(false);
  };
  RC.refresh = () => renderProto(true);

  function renderProto(keepScroll) {
    const host = document.querySelector('[data-proto-phone]');
    if (!host) return;
    const prev = host.querySelector('[data-app]');
    const y = keepScroll && prev ? prev.scrollTop : 0;
    const cur = top();
    const scr = RC.screens[cur.screen];
    const ctx = RC.ctx(RC.proto.state, cur.params, { interactive: true });
    host.innerHTML = RC.phoneHTML(cur.screen, ctx, { interactive: true, canBack: RC.proto.stack.length > 1 });
    const app = host.querySelector('[data-app]');
    if (app) app.scrollTop = y;
    const layer = host.querySelector('[data-overlay]');
    if (layer && RC.proto.sheet && scr && scr.sheets && scr.sheets[RC.proto.sheet]) {
      layer.insertAdjacentHTML('beforeend', scr.sheets[RC.proto.sheet](ctx));
    }
    if (layer) RC._toasts.forEach((t) => layer.appendChild(t));
    if (scr && scr.mount) { try { scr.mount(host, ctx); } catch (e) { console.error('[RC] mount', cur.screen, e); } }
    syncChrome();
  }

  function onPhoneClick(e) {
    const host = document.querySelector('[data-proto-phone]');
    const el = e.target.closest('[data-go],[data-back],[data-action],[data-set]');
    if (!el || !host.contains(el)) return;
    e.preventDefault();
    e.stopPropagation();
    const ctx = RC.ctx(RC.proto.state, top().params, { interactive: true });
    if (el.dataset.set) RC.actions.set(JSON.parse(el.dataset.set), ctx);
    if (el.hasAttribute('data-back')) return RC.back();
    if (el.dataset.go) return RC.go(el.dataset.go, el.dataset.params ? JSON.parse(el.dataset.params) : {}, { root: el.hasAttribute('data-root') });
    if (el.dataset.action) {
      const fn = RC.actions[el.dataset.action];
      if (!fn) { console.warn('[RC] unknown action', el.dataset.action); return; }
      const res = fn(el.dataset.payload ? JSON.parse(el.dataset.payload) : {}, ctx, el);
      if (res !== false) RC.refresh();
      return;
    }
    if (el.dataset.set) RC.refresh();
  }

  function onBind(e) {
    const el = e.target.closest('[data-bind]');
    if (!el || !el.closest('[data-proto-phone]')) return;
    RC.setPath(RC.proto.state, el.dataset.bind, el.type === 'checkbox' ? el.checked : el.value);
    if (e.type === 'change' && el.hasAttribute('data-refresh')) RC.refresh();
  }

  /* ------------------------------------------------------------ презентация */

  RC.boardList = () => {
    const out = [];
    RC.flows.forEach((f, fi) => {
      f.screens.forEach((id) => {
        const s = RC.screens[id];
        if (!s) return;
        const exs = s.examples && s.examples.length ? s.examples : [{}];
        exs.forEach((ex, ei) => out.push({
          flow: f.id, flowIndex: fi, screen: id, example: ei,
          label: ex.label || null, params: ex.params || {}, state: ex.state || {}, sheet: ex.sheet || null,
        }));
      });
    });
    return out;
  };

  const deckShell = () => `
    <header class="deck-top">
      <div class="brand">
        <div class="brand__mark">Re<i>:</i>clinic</div>
        <div class="brand__meta">Telegram Mini App<br>макеты · демо-данные</div>
      </div>
      <nav class="modes" aria-label="Режим просмотра">
        <button data-mode="proto">Прототип</button>
        <button data-mode="board">Все экраны</button>
      </nav>
      <div class="deck-top__right"><span data-zoom-wrap>Масштаб
        <button data-zoom="0.6">60%</button><button data-zoom="0.8">80%</button><button data-zoom="1">100%</button></span>
      </div>
    </header>
    <main data-view></main>`;

  const protoLayout = () => `
    <div class="proto">
      <aside class="flownav" data-flownav>${RC.flows.map((f) => {
        const ids = f.screens.filter((id) => RC.screens[id]);
        if (!ids.length) return '';
        return `<div class="flownav__group"><h4>${esc(f.title)}</h4>${ids.map((id) => `<button class="flownav__item" data-jump="${esc(id)}">${esc(RC.screens[id].title)}</button>`).join('')}</div>`;
      }).join('')}</aside>
      <div class="proto__stage">
        <div data-proto-phone></div>
        <p class="proto__hint">Прототип кликабельный — нажимайте на карточки, кнопки и вкладки</p>
      </div>
      <aside class="notes" data-notes></aside>
    </div>`;

  function renderNotes() {
    const box = document.querySelector('[data-notes]');
    if (!box) return;
    const cur = top();
    const s = RC.screens[cur.screen];
    if (!s) { box.innerHTML = ''; return; }
    const flow = RC.flows.find((f) => f.screens.includes(cur.screen));
    const exs = s.examples || [];
    const curKey = JSON.stringify(cur.params || {});
    box.innerHTML = `
      <p class="notes__flow">${esc(flow ? flow.title : '')}</p>
      <h2 class="notes__title">${esc(s.title)}</h2>
      <p class="notes__text">${esc(s.note || s.short || '')}</p>
      ${s.points && s.points.length ? `<ul class="notes__points">${s.points.map((x) => `<li>${I('check', 16)}<span>${esc(x)}</span></li>`).join('')}</ul>` : ''}
      ${exs.length > 1 ? `<div class="notes__ex"><p>Варианты экрана</p>${exs.map((ex, i) => `<button data-ex="${i}" class="${JSON.stringify(ex.params || {}) === curKey && Object.keys(ex.params || {}).length ? 'on' : ''}">${esc(ex.label || 'Вариант ' + (i + 1))}</button>`).join('')}</div>` : ''}
      <div class="notes__actions"><button data-reset>Сбросить демо-данные</button><button data-mode="board">Все экраны</button></div>`;
  }

  function syncChrome() {
    const cur = top();
    document.querySelectorAll('[data-jump]').forEach((b) => b.classList.toggle('on', b.dataset.jump === cur.screen));
    renderNotes();
    const h = '#/' + cur.screen + (cur.params && Object.keys(cur.params).length ? '?' + encodeURIComponent(JSON.stringify(cur.params)) : '');
    try { if (location.hash !== h) history.replaceState(null, '', h); } catch (e) { /* sandbox */ }
  }

  function jumpTo(screen, exIndex) {
    const scr = RC.screens[screen];
    if (!scr) return;
    const ex = (scr.examples || [])[exIndex] || {};
    if (ex.state) RC.proto.state = RC.deepMerge(RC.proto.state, RC.clone(ex.state));
    RC.proto.sheet = ex.sheet || null;
    const params = ex.params || {};
    RC.proto.stack = scr.tabbar || scr.root ? [{ screen, params }] : [{ screen: 'home', params: {} }, { screen, params }];
    renderProto(false);
  }

  function artboard(it) {
    const scr = RC.screens[it.screen];
    const state = RC.deepMerge(RC.freshState(), RC.clone(it.state));
    const ctx = RC.ctx(state, it.params, {});
    const sheetHTML = it.sheet && scr.sheets && scr.sheets[it.sheet] ? scr.sheets[it.sheet](ctx) : '';
    return `<figure class="artboard" tabindex="0" data-artboard="${esc(JSON.stringify({ screen: it.screen, example: it.example }))}">
      <figcaption><b>${esc(scr.title)}${it.label ? ` <em>· ${esc(it.label)}</em>` : ''}</b>${scr.short ? `<span>${esc(scr.short)}</span>` : ''}</figcaption>
      ${RC.phoneHTML(it.screen, ctx, { tall: !sheetHTML, sheetHTML })}
    </figure>`;
  }

  function renderBoard(view) {
    const list = RC.boardList();
    view.innerHTML = `<div class="board" style="--zoom:${RC._zoom}">
      <div class="board__intro">
        <h1>Макеты Telegram Mini App Re:clinic</h1>
        <p>${list.length} ${RC.plural(list.length, 'экран', 'экрана', 'экранов')} по пути клиента: от входа через Telegram до оплаты и личного кабинета. Экраны показаны целиком, во всю длину прокрутки. Нажмите на любой, чтобы открыть его в кликабельном прототипе.</p>
      </div>
      ${RC.flows.map((f, fi) => {
        const items = list.filter((x) => x.flowIndex === fi);
        if (!items.length) return '';
        return `<section class="flow">
          <header class="flow__head"><span class="flow__num">${String(fi + 1).padStart(2, '0')}</span><h2>${esc(f.title)}</h2><p>${esc(f.text)}</p></header>
          <div class="flow__row">${items.map(artboard).join('')}</div>
        </section>`;
      }).join('')}
    </div>`;
  }

  function syncZoom() {
    document.querySelectorAll('[data-zoom]').forEach((b) => b.classList.toggle('on', +b.dataset.zoom === RC._zoom));
  }

  function setMode(mode) {
    RC._mode = mode;
    document.body.dataset.mode = mode;
    document.querySelectorAll('.modes [data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
    const view = document.querySelector('[data-view]');
    if (mode === 'board') {
      renderBoard(view);
      syncZoom();
      try { history.replaceState(null, '', '#board'); } catch (e) { /* sandbox */ }
      window.scrollTo(0, 0);
    } else {
      view.innerHTML = protoLayout();
      if (!RC.proto.stack.length) RC.proto.stack = [{ screen: 'home', params: {} }];
      renderProto(false);
    }
  }

  function onDeckClick(e) {
    if (e.target.closest('[data-proto-phone]')) return onPhoneClick(e);
    const t = e.target.closest('[data-mode],[data-zoom],[data-jump],[data-ex],[data-reset],[data-artboard]');
    if (!t) return;
    if (t.dataset.mode) return setMode(t.dataset.mode);
    if (t.dataset.zoom) {
      RC._zoom = +t.dataset.zoom;
      const b = document.querySelector('.board');
      if (b) b.style.setProperty('--zoom', RC._zoom);
      return syncZoom();
    }
    if (t.dataset.jump) return jumpTo(t.dataset.jump, 0);
    if (t.dataset.ex) return jumpTo(top().screen, +t.dataset.ex);
    if (t.hasAttribute('data-reset')) { RC.proto.state = RC.freshState(); RC.proto.sheet = null; return renderProto(false); }
    if (t.dataset.artboard) {
      const a = JSON.parse(t.dataset.artboard);
      setMode('proto');
      jumpTo(a.screen, a.example);
      window.scrollTo(0, 0);
    }
  }

  function applyHash() {
    let h = location.hash.slice(1);
    try { h = decodeURIComponent(h); } catch (e) { /* keep raw */ }
    if (h === 'board') return setMode('board');
    const m = h.match(/^\/([\w-]+)(?:\?(.*))?$/);
    if (m && RC.screens[m[1]]) {
      let params = {};
      try { params = m[2] ? JSON.parse(m[2]) : {}; } catch (e) { params = {}; }
      const scr = RC.screens[m[1]];
      RC.proto.stack = scr.tabbar || scr.root ? [{ screen: m[1], params }] : [{ screen: 'home', params: {} }, { screen: m[1], params }];
    }
    setMode('proto');
  }

  function bootShot(q) {
    document.body.classList.add('is-shot');
    const screen = q.get('screen') || 'home';
    let params = {};
    let over = {};
    try { params = JSON.parse(q.get('params') || '{}'); } catch (e) { /* ignore */ }
    try { over = JSON.parse(q.get('state') || '{}'); } catch (e) { /* ignore */ }
    const state = RC.deepMerge(RC.freshState(), over);
    const ctx = RC.ctx(state, params, {});
    const root = document.getElementById('deck');
    root.innerHTML = `<div id="shot">${RC.phoneHTML(screen, ctx, { tall: q.get('tall') === '1' })}</div>`;
    const sheetKey = q.get('sheet');
    const scr = RC.screens[screen];
    if (sheetKey && scr && scr.sheets && scr.sheets[sheetKey]) {
      root.querySelector('[data-overlay]').insertAdjacentHTML('beforeend', scr.sheets[sheetKey](ctx));
    }
    window.__RC_READY = true;
  }

  RC.start = () => {
    const q = new URLSearchParams(location.search);
    if (q.get('view') === 'shot') return bootShot(q);
    RC.proto.state = RC.freshState();
    const root = document.getElementById('deck');
    root.innerHTML = deckShell();
    root.addEventListener('click', onDeckClick);
    root.addEventListener('input', onBind);
    root.addEventListener('change', onBind);
    root.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.artboard')) { e.preventDefault(); e.target.click(); }
    });
    applyHash();
    window.__RC_READY = true;
  };
})();
