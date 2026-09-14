/* Запись, корзина, оформление и экран успешной оплаты.
   Компоненты — RC.ui, данные — RC.product / data.branches / data.team, слоты — RC_DEMO. */
(function () {
  const { esc, icon: I } = RC;

  const NB = ' ';
  const VISIT_CATS = ['iv', 'consultations', 'cosmetology'];
  const ORDER_ID = 'RC-10428';
  const DIAG_ID = 'consult-offline-diagnostic';
  const TEAM_PICK = ['victoriafomenko', 'anastasiachakileva', 'polinasorokina'];
  const DEMO_EMAIL = 'anna.smirnova@mail.ru';
  const PAY = {
    card: { icon: 'card', title: 'Банковская карта', sub: 'Данные карты клиника не хранит', short: 'Карта' },
    sbp: { icon: 'bolt', title: 'СБП', sub: 'Оплата в приложении вашего банка', short: 'СБП' },
    credit: { icon: 'percent', title: 'Кредит или рассрочка', sub: 'Оформление у банка-партнёра', short: 'Рассрочка' },
  };
  const CONTACT = [
    { id: 'telegram', icon: 'telegram', label: 'Telegram' },
    { id: 'whatsapp', icon: 'chat', label: 'WhatsApp' },
    { id: 'call', icon: 'phone', label: 'Звонок' },
  ];

  /* ------------------------------------------------------------ хелперы */

  const cartOf = (s) => (Array.isArray(s.cart) ? s.cart : []);
  const demoDays = (ctx) => (ctx.demo && ctx.demo.days) || [];
  const dayOf = (ctx, iso) => demoDays(ctx).find((d) => d.iso === iso) || null;
  const dateLong = (ctx, iso) => { const d = dayOf(ctx, iso); return d ? `${d.dow}, ${d.d} ${d.month}` : (iso || ''); };
  const dateShort = (ctx, iso) => { const d = dayOf(ctx, iso); return d ? `${d.dow} ${d.d}` : ''; };
  const branchShort = (b) => (b ? b.shortName || String(b.name || '').replace(/^Re:clinic\s*/, '') : '');
  const branchAddr = (b) => (b ? String(b.address || '').replace(/^Москва,\s*/, '') : '');
  const needsVisit = (p) => !!p && VISIT_CATS.includes(p.category);
  const isCheckup = (p) => !!p && p.category === 'checkups';
  /** Слот есть только у визитов: чек-ап не записывают на время — направление в лабораторию приходит после оплаты. */
  const slotOf = (p, it) => (p && !isCheckup(p) && it && it.slot && it.slot.date ? it.slot : null);
  const services = (n) => `${n} ${RC.plural(n, 'услуга', 'услуги', 'услуг')}`;
  const itemsCount = (items) => items.reduce((a, i) => a + (i.qty || 1), 0);
  const itemsTotal = (items) => items.reduce((a, i) => { const p = RC.product(i.id); return a + (p && p.price ? p.price * (i.qty || 1) : 0); }, 0);
  const durShort = (p) => String((p && p.duration) || '').replace(/^Консультация\s*/, '').replace(/\s*минут\S*$/, ' мин');
  const joinRu = (list) => (list.length > 1 ? list.slice(0, -1).join(', ') + ' и ' + list[list.length - 1] : list.join(''));
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const emailOk = (v) => EMAIL_RE.test(String(v || '').trim());

  /** Вилка цен с сайта («10 000 / 11 000 ₽») — так же, как её распознаёт RC.priceLabel. */
  const isFork = (p) => !!p && p.price != null && !p.priceFrom && !!p.priceNote && /\d\s*\/\s*\d/.test(p.priceNote) && /₽/.test(p.priceNote);
  /** Сумма позиции: «от», если цена на сайте указана как «от» или вилкой. */
  function sumLabel(p, qty) {
    if (p.price == null) return RC.priceLabel(p);
    if (p.price === 0) return 'Бесплатно';
    return (p.priceFrom || isFork(p) ? 'от ' : '') + RC.fmt(p.price * (qty || 1));
  }
  /** Позиции с ценой, известной после подбора, не входят ни в итог, ни в счётчик услуг с ценой. */
  const priced = (items) => items.filter((i) => { const p = RC.product(i.id); return p && p.price != null; });
  const unpriced = (items) => items.filter((i) => { const p = RC.product(i.id); return p && p.price == null; });
  /** «2 услуги · 20 000 ₽ + 1 после подбора» */
  function countLine(items, total) {
    const a = itemsCount(priced(items));
    const b = itemsCount(unpriced(items));
    if (!a) return `${services(b)} · цена после подбора`;
    return `${services(a)} · ${RC.fmt(total)}${b ? ` + ${b} после подбора` : ''}`;
  }
  /** «4 услуги + 1 после подбора» — для чека на экране оплаты. */
  function countShort(items) {
    const a = itemsCount(priced(items));
    const b = itemsCount(unpriced(items));
    if (!a) return `${services(b)} после подбора`;
    return services(a) + (b ? ` + ${b} после подбора` : '');
  }
  /** Строки под итогом: откуда взята сумма, если цена «от», вилкой или по прайсу. Факты — только из data.js. */
  function priceNotes(items, withDiag) {
    const out = [];
    items.forEach((i) => {
      const p = RC.product(i.id);
      if (!p || p.price == null) return;
      /* диагностика: в корзине пояснение уже в позиции, сноска — только при оформлении */
      if (p.id === DIAG_ID) { if (withDiag) out.push(`Диагностическая консультация — ${RC.fmt(p.price)} по${NB}прайсу`); }
      else if (isFork(p)) out.push(`${p.title} — ${p.priceNote}, в${NB}итоге по${NB}минимальной`);
      else if (p.priceFrom) out.push(`${p.title} — в${NB}итоге по${NB}минимальной цене, от${NB}${RC.fmt(p.price)}`);
    });
    return out;
  }
  /* суммы не рвутся на строки: «10 000 ₽» — неразрывные пробелы между разрядами и перед ₽ */
  const keepSums = (t) => String(t).replace(/(\d) (?=\d)/g, `$1${NB}`).replace(/ ₽/g, `${NB}₽`);
  const noteRows = (notes, cls) => notes.map((t) => `<div class="${cls}">${I('info', 16)}<span>${esc(keepSums(t))}</span></div>`).join('');

  /* Каталог единый: формат — свойство продукта. Визит в клинику, если продукт очный;
     онлайн — только когда продукт доступен исключительно онлайн. */
  const formatsOf = (p) => (p && p.directions) || [];
  const hasOnline = (p) => formatsOf(p).includes('online');
  const hasOffline = (p) => formatsOf(p).includes('offline');
  const onlineOnly = (p) => hasOnline(p) && !hasOffline(p);
  const dirFor = (p) => (onlineOnly(p) ? 'online' : 'offline');
  function branchesFor(p, data) {
    const all = data.branches || [];
    const ids = p && p.branchIds;
    const list = ids && ids.length ? all.filter((b) => ids.includes(b.id)) : all;
    return (list.length ? list : all).slice(0, 2);
  }
  /** Слот двумя смысловыми строками: «пт, 18 сентября · 12:30» и «Мосфильмовская». */
  function slotParts(ctx, p, slot) {
    if (!slot || !slot.date) return null;
    const when = [dateLong(ctx, slot.date), slot.time].filter(Boolean).join(' · ');
    const where = dirFor(p) === 'online' ? 'Онлайн' : branchShort(RC.branch(slot.branch));
    return { when, where };
  }

  function specialists(ctx) {
    const team = ctx.data.team || [];
    let list = TEAM_PICK.map((id) => team.find((t) => t.id === id)).filter(Boolean);
    if (list.length < 2) list = team.filter((t) => t.group === 'doctor').slice(0, 3);
    return list;
  }
  const personName = (t) => { const n = String(t.name || '').split(' '); return n.length >= 3 ? `${n[1]} ${n[0]}` : t.name; };
  const personInitials = (t) => personName(t).split(' ').map((x) => x[0] || '').join('').slice(0, 2).toUpperCase();

  /** Текущий выбор записи для продукта: state.booking → слот из корзины → разумные дефолты. */
  function bookingSel(ctx, p) {
    const s = ctx.state;
    const b = s.booking || {};
    let base = {};
    if (b.productId === p.id) base = b;
    else {
      const it = cartOf(s).find((i) => i.id === p.id);
      if (it && it.slot) base = it.slot;
    }
    const dir = dirFor(p);
    const branches = branchesFor(p, ctx.data);
    const branch = dir === 'offline' ? ((branches.find((x) => x.id === base.branch) || branches[0] || {}).id || null) : null;
    const days = demoDays(ctx);
    const date = days.some((d) => d.iso === base.date) ? base.date : (days[0] ? days[0].iso : null);
    const busy = ((ctx.demo.busy || {})[date]) || [];
    const times = ctx.demo.times || [];
    const time = base.time && times.includes(base.time) && !busy.includes(base.time) ? base.time : null;
    const specialist = p.category === 'consultations' ? base.specialist || 'any' : null;
    return { dir, branches, branch, date, time, specialist, busy, times, days };
  }

  /* ------------------------------------------------------------ действия */

  RC.actions['bk-pick'] = ({ id, key, value }, ctx) => {
    const p = RC.product(id);
    if (!p) return false;
    const cur = bookingSel(ctx, p);
    const next = { productId: id, branch: cur.branch, date: cur.date, time: cur.time, specialist: cur.specialist };
    next[key] = value;
    if (key === 'date' && next.time && (((ctx.demo.busy || {})[value]) || []).includes(next.time)) next.time = null;
    ctx.state.booking = next;
  };

  /** Запись в корзину: без тоста (он перекрывал бы кнопку «Оформить») — позиция подсвечивается в корзине. */
  RC.actions['bk-book'] = ({ id }, ctx) => {
    const p = RC.product(id);
    if (!p || p.price == null || isCheckup(p)) return false;
    const sel = bookingSel(ctx, p);
    if (!sel.date || !sel.time) return false;
    const slot = { date: sel.date, time: sel.time };
    if (sel.branch) slot.branch = sel.branch;
    if (sel.specialist) slot.specialist = sel.specialist;
    const s = ctx.state;
    if (!Array.isArray(s.cart)) s.cart = [];
    const it = s.cart.find((i) => i.id === id);
    if (it) it.slot = slot;
    else s.cart.push({ id, qty: 1, slot });
    s.booking = Object.assign({ productId: id }, slot);
    s.bkFlash = { id, text: it ? 'Время записи обновлено' : 'Добавлено в корзину' };
    RC.go('cart');
    return false;
  };

  /** Чек-ап — в корзину без времени: направление в лабораторию приходит после оплаты. */
  RC.actions['bk-add-plain'] = ({ id }, ctx) => {
    const s = ctx.state;
    if (!Array.isArray(s.cart)) s.cart = [];
    const it = s.cart.find((i) => i.id === id);
    if (it) delete it.slot;
    else s.cart.push({ id, qty: 1 });
    s.bkFlash = { id, text: it ? 'Уже в корзине' : 'Добавлено в корзину' };
    RC.go('cart');
    return false;
  };

  /** Запись, которая уже входит в оплаченный заказ (разбор чек-апа, замер программы): без корзины и оплаты. */
  RC.actions['bk-confirm'] = ({ id, included }, ctx) => {
    const p = RC.product(id);
    if (!p) return false;
    const sel = bookingSel(ctx, p);
    if (!sel.date || !sel.time) return false;
    const s = ctx.state;
    s.booking = { productId: id, branch: sel.branch, date: sel.date, time: sel.time, specialist: sel.specialist, included: included || null };
    s.orders = Object.assign({}, s.orders, { tab: 'active' });
    RC.toast('Запись подтверждена', { sub: `${dateLong(ctx, sel.date)}, ${sel.time} · оплачивать не нужно`, icon: 'calendar' });
    RC.go('orders');
    return false;
  };

  /** Подсказка в корзине: добавить диагностическую консультацию без тоста и без перехода. */
  RC.actions['bk-add-diag'] = (payload, ctx) => {
    const s = ctx.state;
    if (!Array.isArray(s.cart)) s.cart = [];
    if (!s.cart.some((i) => i.id === DIAG_ID)) s.cart.push({ id: DIAG_ID, qty: 1 });
    s.bkFlash = { id: DIAG_ID, text: 'Добавлено в корзину' };
  };

  /* ============================================================ booking */

  const laneScroll = {};

  /** Бесплатная запись из кабинета: params.included — номер заказа ('RC-10427'), 'checkup' или 'program'. */
  function includedInfo(ctx, raw) {
    if (!raw) return null;
    const id = String(raw);
    const isOrder = /^RC-\d+$/.test(id);
    const order = isOrder ? (ctx.demo.orders || []).find((o) => o.id === id) || null : null;
    const cats = order ? (order.items || []).map((i) => (RC.product(i.id) || {}).category) : [];
    const kind = id === 'program' || cats.includes('programs') ? 'program' : 'checkup';
    let title;
    if (isOrder) title = `Входит в заказ ${id}`;
    else if (kind === 'program') {
      const pp = RC.product((ctx.demo.program || {}).productId);
      title = pp ? `Входит в программу «${pp.title}»` : 'Входит в вашу программу';
    } else title = 'Входит в оплаченный чек-ап';
    return { id, kind, title, label: kind === 'program' ? 'Входит в программу' : 'Входит в чек-ап' };
  }

  /** Карточка продукта строкой. meta — готовый HTML строки под названием. */
  function prodRow(ctx, p, o = {}) {
    return `<button class="bk-prod" ${RC.link('product', { id: p.id })}>
      ${ctx.ui.illuBox(p, { cls: 'bk-prod__illu' })}
      <span class="bk-prod__main">
        <small>${esc(o.kicker || RC.category(p.category).title)}</small>
        <b>${esc(o.title || p.title)}</b>
        ${o.meta ? `<span class="bk-prod__meta">${o.meta}</span>` : ''}
      </span>
      ${I('chevR', 20, 'bk-prod__chev')}
    </button>`;
  }
  /** «цена · 60 мин»: разделитель «·» только если перед ним что-то есть. */
  const metaLine = (lead, extra) => (lead || '') + (extra ? `<span${lead ? ' class="is-sep"' : ''}>${esc(extra)}</span>` : '');
  const infoCard = (icon, title, text) =>
    `<div class="bk-info"><span class="bk-info__ico">${I(icon, 22)}</span><span class="bk-info__main"><b>${esc(title)}</b><small>${esc(text)}</small></span></div>`;
  const stepsList = (steps) =>
    `<ol class="bk-steps">${steps.map((st, i) => `<li class="bk-step"><span class="bk-step__n num">${i + 1}</span><span class="bk-step__main"><b>${esc(st.t)}</b><small>${esc(st.d)}</small></span></li>`).join('')}</ol>`;

  /** Чек-ап время не выбирает: после оплаты приходит направление, анализы — 30 дней, консультация — через 3–7 дней после результатов. */
  function bookingCheckup(ctx, p) {
    const { ui, state } = ctx;
    const analyses = String(p.short || '').split('→')[0].trim();
    const dur = durShort(p);
    const inCart = RC.inCart(state, p.id);
    const steps = [
      { t: 'Направление в лабораторию придёт в чат с ботом', d: 'Подберём ближайшую лабораторию-партнёра: Инвитро, Хеликс, ЛабКвест или Ситилаб' },
      { t: 'Сдаёте анализы в течение 30 дней', d: 'Утром натощак. В лаборатории ничего не оплачиваете — только показываете направление' },
      { t: 'Результаты — в личном кабинете', d: 'Показатели и документы соберём в разделе «Результаты»' },
      { t: `Консультация с разбором${dur ? ' · ' + dur : ''}`, d: 'Дату и время согласуем в течение 3–7 дней после результатов' },
    ];
    const rows = [
      ui.row({ icon: 'shield', tone: 'sand', title: 'Отказаться можно до начала услуг', sub: 'Деньги вернут полностью, за вычетом комиссий банков' }),
      ui.row({ icon: 'flask', title: 'Дополнительные анализы', sub: 'Можно добавить за отдельную плату' }),
    ];
    const cta = inCart
      ? ui.btn('Уже в корзине', { variant: 'primary', iconRight: 'arrowR', cls: 'bk-cta', attrs: RC.link('cart') })
      : ui.btn(`В корзину · ${RC.priceLabel(p)}`, { variant: 'primary', html: true, cls: 'bk-cta', attrs: RC.act('bk-add-plain', { id: p.id }) });
    return `
      ${ui.appbar('Запись на чек-ап', { sub: 'Анализы и консультация в одном заказе' })}
      <div class="pad">${prodRow(ctx, p, { kicker: p.subtitle || RC.category(p.category).title, meta: metaLine(`<em class="num">${RC.priceLabel(p)}</em>`, analyses) })}</div>
      <section class="pad mt-16">${infoCard('calendar', 'Время выбирать не нужно', `После оплаты направление в лабораторию придёт в чат с ботом, сдать анализы можно в${NB}течение 30${NB}дней`)}</section>
      <section class="pad sec">${ui.sectionHead('Как проходит чек-ап')}${stepsList(steps)}</section>
      <section class="pad sec">${ui.sectionHead('Важно знать')}${ui.list(rows)}</section>
      <div class="mt-24">${ui.disclaimer()}</div>
      ${ui.buybar(`<div class="buybar__price"><b>${RC.priceLabel(p)}</b><small>анализы + консультация</small></div>${cta}`)}`;
  }

  /** Цена после подбора: слот не выбираем — ведём на консультацию по формату продукта (очно — диагностическая, только онлайн — экспресс). */
  function bookingUnpriced(ctx, p) {
    const { ui } = ctx;
    const online = dirFor(p) === 'online';
    const c = RC.product(online ? 'consult-online-express' : DIAG_ID);
    /* программа доступна в обоих форматах — подсказываем, что подобрать можно и онлайн */
    const alt = !online && hasOnline(p) ? RC.product('consult-online-express') : null;
    const rows = [];
    if (c && c.id === DIAG_ID) {
      rows.push(ui.row({ icon: 'tag', tone: 'sand', title: 'Бесплатна при покупке программы', sub: 'По прайсу клиники — также с курсом капельниц или пептид-боксом' }));
      const br = RC.branch((c.branchIds || [])[0]);
      if (br) rows.push(ui.row({ icon: 'pin', title: branchShort(br), sub: [br.metro ? 'м. ' + br.metro : '', br.hours].filter(Boolean).join(' · ') }));
      if (alt) rows.push(ui.row({ icon: 'globe', title: 'Удобнее онлайн?', sub: `${alt.title} · ${RC.priceLabel(alt)}`, attrs: RC.link('booking', { id: alt.id }), chevron: true }));
    } else if (c) {
      rows.push(ui.row({ icon: 'globe', title: 'Онлайн · звонок или видеозвонок', sub: 'Ссылка на встречу придёт в чат с ботом' }));
    }
    return `
      ${ui.appbar('Запись', { sub: 'Цену программы назовём после подбора' })}
      <div class="pad">${prodRow(ctx, p, { kicker: [RC.category(p.category).title, p.duration].filter(Boolean).join(' · '), meta: `<em>${RC.priceLabel(p)}</em>` })}</div>
      <section class="pad mt-16">${infoCard('stetho', 'Сначала — консультация', 'Специалист подберёт программу под ваши цели и назовёт её цену')}</section>
      ${c ? `<section class="pad sec">
        ${ui.sectionHead('Консультация для подбора')}
        ${prodRow(ctx, c, { meta: metaLine(`<em class="num">${RC.priceLabel(c)}</em>`, durShort(c)) })}
        ${rows.length ? `<div class="mt-12">${ui.list(rows)}</div>` : ''}
      </section>` : ''}
      <div class="mt-24">${ui.disclaimer()}</div>
      ${ui.buybar(ui.btn('Подобрать на консультации', { variant: 'primary', size: 'lg', iconRight: 'arrowR', attrs: RC.link('booking', { id: c ? c.id : DIAG_ID }) }))}`;
  }

  function bookingRender(ctx) {
    const { state, ui, params } = ctx;
    const id = params.id || (state.booking && state.booking.productId) || 'iv-nad';
    const p = RC.product(id) || RC.product('iv-nad');
    if (!p) return ui.empty('calendar', 'Услуга не найдена', 'Вернитесь в каталог и выберите услугу', '');
    if (isCheckup(p)) return bookingCheckup(ctx, p);
    if (p.price == null) return bookingUnpriced(ctx, p);
    const inc = includedInfo(ctx, params.included);
    const sel = bookingSel(ctx, p);
    const pick = (key, value) => RC.act('bk-pick', { id: p.id, key, value });
    const isConsult = p.category === 'consultations';
    const oneBranch = sel.dir === 'offline' && sel.branches.length === 1;

    /* где */
    let where;
    if (sel.dir === 'online') {
      where = `<div class="bk-online">
        <span class="bk-online__ico">${I('telegram', 22)}</span>
        <span class="bk-online__main"><b>Онлайн · ссылка на встречу придёт в чат с ботом</b><small>Понадобятся смартфон или компьютер, наушники и микрофон</small></span>
      </div>`;
    } else {
      /* время пешком — в nowrap-спане вместе с разделителем: точка не повиснет в конце строки */
      const walkOf = (b) => (b.walk && b.walk.time ? String(b.walk.time).replace(/\s*минут\S*$/, `${NB}мин`) : '');
      const branchMain = (b) => `<span class="opt__main"><b>${esc(branchShort(b))}</b>${b.metro ? `<span class="bk-branch__metro">м. ${esc(b.metro)}${walkOf(b) ? `<span class="bk-branch__walk"> · ${esc(walkOf(b))}</span>` : ''}</span>` : ''}<small>${esc(branchAddr(b).replace(/корпус/g, 'корп.'))}</small></span>`;
      where = oneBranch
        /* выбирать не из чего — статичная карточка без радиокнопки */
        ? `<div class="opt bk-branch bk-branch--static"><span class="opt__ico">${I('pin', 20)}</span>${branchMain(sel.branches[0])}</div>`
        : `<div class="stack bk-branches">${sel.branches.map((b) => `<button class="opt bk-branch${b.id === sel.branch ? ' on' : ''}" ${pick('branch', b.id)}>
        <span class="opt__ico">${I('pin', 20)}</span>${branchMain(b)}<span class="opt__radio"></span>
      </button>`).join('')}</div>`;
    }

    /* дата */
    const selIdx = Math.max(0, sel.days.findIndex((d) => d.iso === sel.date));
    const start = !ctx.interactive && selIdx > 4 ? selIdx - 3 : 0;
    const days = sel.days.slice(start);
    const lane = `<div class="bk-days" data-key="${esc(p.id)}">${days.map((d) => {
      const weekend = d.dow === 'сб' || d.dow === 'вс';
      return `<button class="bk-day${d.iso === sel.date ? ' on' : ''}${weekend ? ' is-weekend' : ''}" ${pick('date', d.iso)} aria-label="${esc(d.dow + ', ' + d.d + ' ' + d.month)}"><span>${esc(d.dow)}</span><b class="num">${d.d}</b></button>`;
    }).join('')}</div>`;

    /* время */
    const free = sel.times.filter((t) => !sel.busy.includes(t)).length;
    const freeLabel = free === sel.times.length ? 'Все окна свободны' : `Свободно ${free} ${RC.plural(free, 'окно', 'окна', 'окон')} из ${sel.times.length}`;
    const slots = `<div class="bk-slots">${sel.times.map((t) => {
      const busy = sel.busy.includes(t);
      if (busy) return `<button class="bk-slot is-busy" disabled aria-label="${esc(t)} — занято"><s>${esc(t)}</s></button>`;
      return `<button class="bk-slot${t === sel.time ? ' on' : ''}" ${pick('time', t)}>${esc(t)}</button>`;
    }).join('')}</div>`;

    /* специалист */
    let spec = '';
    if (isConsult) {
      const opts = [ui.option({
        lead: `<span class="bk-any">${I('sparkles', 20)}</span>`,
        title: 'Любой свободный',
        sub: 'Подберём под ваш запрос',
        on: sel.specialist === 'any',
        attrs: pick('specialist', 'any'),
      })].concat(specialists(ctx).map((t) => ui.option({
        lead: ui.avatar(personInitials(t), { size: 40, photo: RC.teamPhoto && RC.teamPhoto(t.id) }),
        title: personName(t),
        sub: [t.cardRole ? t.cardRole.charAt(0).toUpperCase() + t.cardRole.slice(1) : '', t.experience ? 'стаж' + NB + String(t.experience).replace(/ /g, NB) : ''].filter(Boolean).join(', '),
        on: sel.specialist === t.id,
        attrs: pick('specialist', t.id),
      })));
      spec = `<section class="pad sec">${ui.sectionHead('Специалист')}<div class="stack bk-spec">${opts.join('')}</div></section>`;
    }

    /* сводка */
    const br = sel.branch ? RC.branch(sel.branch) : null;
    const member = sel.specialist && sel.specialist !== 'any' ? RC.teamMember(sel.specialist) : null;
    /* Сроки переноса — только там, где они есть в офертах: онлайн-консультации 24 ч, очные консультации 48 ч. */
    let move;
    if (sel.dir === 'online') move = { icon: 'shield', title: 'Перенос — за 24 часа', sub: 'Предупредите нас в чате с ботом' };
    else if (isConsult) move = { icon: 'shield', title: 'Перенос — за 48 часов', sub: 'Предупредите нас в чате с ботом' };
    else move = { icon: 'chat', title: 'Перенести запись — в чате с ботом', sub: '' };
    const rows = [
      ui.row({
        icon: 'calendar',
        title: sel.time ? `${dateLong(ctx, sel.date)}, ${sel.time}` : `${dateLong(ctx, sel.date)} · время не выбрано`,
        sub: p.duration ? 'Длительность ' + String(p.duration).replace(/^Консультация\s*/, '') : '',
      }),
      sel.dir === 'online'
        ? ui.row({ icon: 'globe', title: 'Онлайн', sub: 'Звонок или видеозвонок' })
        : ui.row({ icon: 'pin', title: br ? branchShort(br) : '', sub: br ? [br.metro ? 'м. ' + br.metro : '', br.hours].filter(Boolean).join(' · ') : '' }),
      isConsult ? ui.row({ icon: 'stetho', title: member ? personName(member) : 'Любой свободный специалист', sub: member ? 'Стаж ' + member.experience : 'Назначим при подтверждении записи' }) : '',
      inc ? ui.row({ icon: 'check', title: inc.title, sub: 'Оплачивать не нужно' }) : '',
      ui.row({ icon: move.icon, tone: 'sand', title: move.title, sub: move.sub }),
    ].filter(Boolean);

    const when = sel.time ? `${dateShort(ctx, sel.date)}, ${sel.time}` : '';
    const ctaLabel = !sel.time ? 'Выберите время' : (inc ? `Записаться · ${when}` : `В корзину · ${when}`);
    const dur = durShort(p);
    /* подпись под ценой: капельницы и косметология — «за процедуру» (или единица с сайта: «за 1 единицу»), консультации — длительность */
    const unitNote = p.priceNote && !isFork(p) && p.price != null && p.id !== DIAG_ID && p.priceNote.length <= 16 ? p.priceNote : '';
    const priceSub = p.category === 'iv' ? 'за процедуру' : (p.category === 'cosmetology' ? unitNote || 'за процедуру' : dur || 'за процедуру');
    const appSub = sel.dir === 'online' ? 'Выберите дату и время консультации' : (oneBranch ? 'Выберите дату и время' : 'Выберите филиал, дату и время');
    /* из кабинета: услуга уже оплачена в заказе — вместо цены «Входит в чек-ап / программу», в корзину не кладём */
    const title = inc && inc.kind === 'checkup' && p.id === 'consult-online-60' ? 'Разбор результатов чек-апа' : p.title;
    /* с плашкой «Входит в …» длительность уходит в верхнюю строку — иначе «· 60 мин» переносится с висящей точкой */
    const kicker = inc ? [RC.category(p.category).title, dur].filter(Boolean).join(' · ') : '';
    const meta = inc
      ? ui.tag(inc.label, { tone: 'sage', icon: 'check' })
      : metaLine(`<em class="num">${RC.priceLabel(p)}</em>`, dur);
    const price = inc
      ? `<div class="buybar__price"><b>Оплачено</b><small>${esc(inc.label.toLowerCase())}</small></div>`
      : `<div class="buybar__price"><b>${RC.priceLabel(p)}</b><small>${esc(priceSub)}</small></div>`;
    const action = inc ? RC.act('bk-confirm', { id: p.id, included: inc.id }) : RC.act('bk-book', { id: p.id });

    return `
      ${ui.appbar('Запись', { sub: appSub })}
      <div class="pad">${prodRow(ctx, p, { title, meta, kicker })}</div>
      <section class="pad sec">${ui.sectionHead(sel.dir === 'online' ? 'Формат' : 'Где', oneBranch ? { sub: 'Приём — только здесь' } : {})}${where}</section>
      <section class="pad sec">${ui.sectionHead('Дата', { sub: 'Сентябрь 2026' })}${lane}</section>
      <section class="pad sec">${ui.sectionHead('Время', { sub: freeLabel })}${slots}</section>
      ${spec}
      <section class="pad sec">${ui.sectionHead('Ваша запись')}${ui.list(rows)}</section>
      <div class="mt-24">${ui.disclaimer()}</div>
      ${ui.buybar(`${price}${ui.btn(ctaLabel, { variant: 'primary', cls: 'bk-cta', disabled: !sel.time, attrs: action })}`)}`;
  }

  function bookingMount(host) {
    const lane = host.querySelector('.bk-days');
    if (!lane) return;
    const key = lane.dataset.key;
    const on = lane.querySelector('.bk-day.on');
    let x = laneScroll[key] || 0;
    if (on) {
      const left = on.offsetLeft;
      const right = left + on.offsetWidth;
      if (left - x < 20 || right - x > lane.clientWidth - 20) x = Math.max(0, left - (lane.clientWidth - on.offsetWidth) / 2);
    }
    lane.scrollLeft = x;
    lane.addEventListener('scroll', () => { laneScroll[key] = lane.scrollLeft; }, { passive: true });
  }

  RC.register({
    id: 'booking',
    title: 'Запись: место и время',
    short: 'Филиал, дата, свободное окно и специалист',
    note: 'Клиент сам выбирает филиал, день и свободное окно — без переписки с администратором. Занятое время видно сразу, поэтому запись не срывается, а услуга попадает в корзину уже с закреплённым слотом.',
    points: [
      'Формат берётся из услуги: очно — филиал с метро и адресом, онлайн — ссылка в чат',
      'Лента дат и сетка слотов: занятое время перечёркнуто',
      'Для консультаций — выбор специалиста или «любой свободный»',
      'Кнопка показывает выбранное время и кладёт услугу в корзину',
      'Разбор чек-апа и замер программы из кабинета — запись без повторной оплаты',
      'Чек-ап без выбора времени: направление приходит после оплаты',
    ],
    examples: [
      { label: 'Капельница NAD+', params: { id: 'iv-nad' }, state: { booking: { productId: 'iv-nad', branch: 'mosfilm', date: '2026-09-18', time: '12:30' } } },
      { label: 'Онлайн-консультация', params: { id: 'consult-online-60' }, state: { booking: { productId: 'consult-online-60', date: '2026-09-22', time: '18:30' } } },
      { label: 'Разбор из кабинета', params: { id: 'consult-online-60', included: 'RC-10427' }, state: { booking: { productId: 'consult-online-60', date: '2026-09-22', time: '18:30' } } },
      { label: 'Чек-ап', params: { id: 'checkup-weight' }, state: { cart: [{ id: 'consult-online-60', qty: 1, slot: { date: '2026-09-22', time: '18:30' } }] } },
      { label: 'Программа без цены', params: { id: 'program-antiage' } },
    ],
    render: bookingRender,
    mount: bookingMount,
  });

  /* =============================================================== cart */

  const fact = (icon, html) => `<div class="bk-item__fact">${I(icon, 18)}<span>${html}</span></div>`;

  /** Левая часть подвала позиции — полезная деталь вместо пустоты. */
  function unitInfo(ctx, p, it) {
    if (p.category === 'checkups') return p.short || '';
    if (p.category === 'consultations') {
      const m = it.slot && it.slot.specialist && it.slot.specialist !== 'any' ? RC.teamMember(it.slot.specialist) : null;
      if (m) return personName(m);
      /* длительность уже в kicker, «Онлайн» — в строке слота: здесь только формат встречи */
      return dirFor(p) === 'online' ? 'Звонок или видеозвонок' : '';
    }
    if (p.category === 'cosmetology') return (p.price != null && p.priceNote) || durShort(p) || 'процедура';
    return p.duration || '';
  }

  function cartItem(ctx, it, flash) {
    const { ui } = ctx;
    const p = RC.product(it.id);
    if (!p) return '';
    const qty = it.qty || 1;
    const kicker = p.category === 'checkups' ? (p.subtitle || RC.kicker(p)) : RC.kicker(p);
    const isNew = !!(flash && flash.id === p.id);
    const metas = [];
    const sp = slotParts(ctx, p, slotOf(p, it));
    if (sp) {
      metas.push(`<div class="bk-item__slot">${I('calendar', 18)}<span class="bk-item__when"><b class="num">${esc(sp.when)}</b>${sp.where ? `<small>${esc(sp.where)}</small>` : ''}</span><button class="bk-item__edit" ${RC.link('booking', { id: p.id })}>Изменить</button></div>`);
    } else if (needsVisit(p)) {
      metas.push(`<button class="bk-item__warn" ${RC.link('booking', { id: p.id })}>${I('clock', 18)}<span>Выберите время визита</span>${I('chevR', 18)}</button>`);
    }
    if (p.category === 'checkups') metas.push(fact('flask', `Анализы можно сдать позже — в${NB}течение 30${NB}дней`));
    if (p.id === DIAG_ID) metas.push(fact('tag', `По${NB}прайсу бесплатна с${NB}курсом капельниц, программой или <span class="bk-nw">пептид-боксом</span>`));
    if (p.price == null) {
      /* цену назовут после подбора — ведём на консультацию по формату услуги: очная — диагностическая, только онлайн — экспресс */
      const consultId = dirFor(p) === 'online' ? 'consult-online-express' : DIAG_ID;
      metas.push(`<button class="bk-item__pick" ${RC.link('booking', { id: consultId })}>${I('stetho', 18)}<span>Подобрать на консультации</span>${I('chevR', 18)}</button>`);
    }

    let left;
    /* цена за процедуру — под названием: вилка с сайта видна всегда, «от» и обычная — когда процедур несколько */
    const unitPrice = p.category === 'iv' && p.price != null && (isFork(p) || qty > 1)
      ? `<small class="bk-item__each num">${RC.priceLabel(p)} за${NB}процедуру</small>` : '';
    if (p.category === 'iv') {
      left = `<div class="bk-item__qty">${ui.qty(p.id, qty)}</div>`;
    } else {
      left = `<small class="bk-item__unit">${esc(unitInfo(ctx, p, it))}</small>`;
    }
    const sum = p.price == null
      ? `<span class="bk-item__sum is-note">${RC.priceLabel(p)}</span>`
      : `<b class="bk-item__sum num">${sumLabel(p, qty)}</b>`;
    const kick = isNew
      ? `<small class="bk-item__kicker is-flash" data-kicker="${esc(kicker)}">${I('check', 14)}<span>${esc(flash.text)}</span></small>`
      : `<small class="bk-item__kicker">${esc(kicker)}</small>`;
    return `<article class="bk-item${isNew ? ' is-new' : ''}">
      <div class="bk-item__top">
        <button class="bk-item__media" ${RC.link('product', { id: p.id })} aria-label="${esc(p.title)}">${ui.illuBox(p, { cls: 'bk-item__illu' })}</button>
        <div class="bk-item__main">
          ${kick}
          <b ${RC.link('product', { id: p.id })}>${esc(p.title)}</b>
          ${unitPrice}
        </div>
        <button class="bk-item__del" ${RC.act('remove', { id: p.id })} aria-label="Удалить">${I('trash', 19)}</button>
      </div>
      ${metas.join('')}
      <div class="bk-item__foot">${left}${sum}</div>
    </article>`;
  }

  function upsell(ctx) {
    const { state, ui } = ctx;
    const cart = cartOf(state);
    /* по составу корзины: есть капельница (всегда очно) и ещё нет приёма врача */
    if (!cart.some((i) => (RC.product(i.id) || {}).category === 'iv')) return '';
    if (cart.some((i) => i.id === DIAG_ID)) return '';
    const p = RC.product(DIAG_ID);
    if (!p) return '';
    const br = RC.branch((p.branchIds || [])[0]);
    return `<section class="pad mt-16">
      <article class="bk-upsell">
        <span class="bk-upsell__kicker">${I('stetho', 14)}Приём врача${p.duration ? ' · ' + esc(p.duration) : ''}</span>
        <div class="bk-upsell__body">
          <div class="bk-upsell__main">
            <b ${RC.link('product', { id: p.id })}>Диагностическая консультация</b>
            <small>Врач подберёт капельницы под ваши цели и проведёт анализ состава тела${br ? `. Приём — на${NB}${esc(branchShort(br).replace(/ая$/, 'ой'))}` : ''}</small>
          </div>
          <div class="bk-upsell__illu">${RC.illu('consult-offline', { tone: RC.TONES.sand })}</div>
        </div>
        <div class="bk-upsell__foot">
          <span class="bk-upsell__price"><b class="num">${RC.priceLabel(p)}</b><em>По прайсу клиники бесплатна при покупке курса капельниц</em></span>
          ${ui.btn('Добавить', { variant: 'dark', size: 'sm', icon: 'plus', attrs: RC.act('bk-add-diag') })}
        </div>
      </article>
    </section>`;
  }

  function cartRender(ctx) {
    const { state, ui } = ctx;
    const cart = cartOf(state);
    const n = RC.cartCount(state);
    if (!cart.length) {
      const hits = RC.productsBy({}).filter((p) => p.badge === 'Хит' && p.price != null).slice(0, 2);
      return `
        ${ui.appbar('Корзина')}
        ${ui.empty('empty-cart', 'В корзине пока пусто', `Добавьте капельницу, чек-ап или консультацию — запись и оплата займут пару${NB}минут`,
          `<div class="bk-empty-cta">${ui.btn('В каталог', { variant: 'dark', iconRight: 'arrowR', attrs: RC.link('catalog', null, { 'catalog.category': 'all', 'catalog.goal': null }) })}</div>`)}
        ${hits.length ? `<section class="pad sec">${ui.sectionHead('Часто выбирают')}<div class="pgrid">${hits.map((p, i) => ui.productCard(p, ctx, { illuVariant: i })).join('')}</div></section>` : ''}`;
    }
    const total = RC.cartTotal(state);
    const promo = (state.checkout && state.checkout.promo) || '';
    const flash = state.bkFlash || null;
    const notes = priceNotes(cart, false);
    const pricedN = itemsCount(priced(cart));
    return `
      ${ui.appbar('Корзина', { sub: countLine(cart, total) })}
      <section class="pad stack bk-items">${cart.map((it) => cartItem(ctx, it, flash)).join('')}</section>
      ${upsell(ctx)}
      <section class="pad sec">
        ${ui.field('Промокод', promo, {
          icon: 'tag', bind: 'checkout.promo', placeholder: 'Введите код', cls: 'bk-promo',
          right: `<button class="bk-promo__apply" ${RC.act('toast', { text: 'Промокод проверим при оплате', sub: 'Скидка появится в итоге, если код действует', icon: 'tag' })}>Применить</button>`,
        })}
        <div class="bk-total mt-12">
          <div class="bk-total__row"><span>Услуги · ${esc(String(pricedN))}</span><span class="num">${RC.fmt(total)}</span></div>
          ${pricedN < n ? `<div class="bk-total__row"><span>После подбора · ${esc(String(n - pricedN))}</span><span>не входит в итог</span></div>` : ''}
          <div class="bk-total__row bk-total__row--big"><span>Итого</span><b class="num">${RC.fmt(total)}</b></div>
          ${noteRows(notes, 'bk-total__note')}
          <div class="bk-total__note">${I('card', 16)}<span>Картой, через СБП или в кредит и рассрочку от банка-партнёра</span></div>
        </div>
      </section>
      <div class="bk-cartbar">${ui.btn(`Оформить · ${RC.fmt(total)}`, { variant: 'primary', block: true, attrs: RC.link('checkout') })}</div>`;
  }

  /** Подсветка только что добавленной позиции: подпись «Добавлено» на пару секунд, затем обычный kicker. */
  function cartMount(host, ctx) {
    if (!ctx.state.bkFlash) return;
    delete ctx.state.bkFlash;
    const item = host.querySelector('.bk-item.is-new');
    if (!item) return;
    const app = host.querySelector('[data-app]');
    if (app) {
      const r = item.getBoundingClientRect();
      const a = app.getBoundingClientRect();
      if (r.top < a.top || r.bottom > a.bottom - 200) app.scrollTop += r.top - a.top - 96;
    }
    setTimeout(() => {
      item.classList.remove('is-new');
      const k = item.querySelector('.is-flash');
      if (k) { k.classList.remove('is-flash'); k.textContent = k.dataset.kicker || ''; }
    }, 2700);
  }

  const DEMO_CART = [
    { id: 'checkup-weight', qty: 1 },
    { id: 'iv-nad', qty: 1, slot: { branch: 'mosfilm', date: '2026-09-18', time: '12:30' } },
  ];
  const ONLINE_CART = [
    { id: 'checkup-women', qty: 1 },
    { id: 'consult-online-60', qty: 1, slot: { date: '2026-09-22', time: '18:30' } },
  ];

  RC.register({
    id: 'cart',
    title: 'Корзина',
    short: 'Несколько услуг, время визитов, промокод и итог',
    tabbar: 'cart',
    note: 'Корзина собирает капельницы, чек-апы и консультации в один заказ с одной оплатой. У каждой записи видно время и филиал, а если время не выбрано — корзина подскажет. Подсказка о диагностической консультации помогает продать капельницы вместе с приёмом врача.',
    points: [
      'Дата, время и филиал у каждой записи, «Изменить» в один тап',
      'Предупреждение, если у услуги с визитом нет времени',
      'Количество процедур для капельниц',
      'Подсказка о диагностической консультации к капельницам',
      'Промокод и прозрачный итог без скрытых сумм',
      'Пустая корзина ведёт в каталог и показывает хиты',
    ],
    examples: [
      { label: 'С услугами', state: { cart: DEMO_CART } },
      { label: 'Пустая', state: { cart: [] } },
      { label: 'Онлайн-услуги', state: { cart: ONLINE_CART } },
    ],
    render: cartRender,
    mount: cartMount,
  });

  /* ============================================================ checkout */

  /** 2–4 пункта из data.purchaseTerms — только те, что относятся к составу заказа. */
  function termsFor(items) {
    const ps = items.map((i) => RC.product(i.id)).filter(Boolean);
    const has = (fn) => ps.some(fn);
    const checkup = has((p) => p.category === 'checkups');
    const offlineConsult = has((p) => p.category === 'consultations' && dirFor(p) === 'offline');
    const onlineConsult = has((p) => p.category === 'consultations' && dirFor(p) === 'online');
    /* программа, которую можно пройти онлайн, — даже если доступна и в клинике */
    const onlineProgram = has((p) => p.category === 'programs' && hasOnline(p));
    const offlineVisit = has((p) => needsVisit(p) && dirFor(p) === 'offline');
    /* prio: 1 — отмена и оплата, 2 — подтверждение, 3 — рассрочка и срок анализов, 4 — изменение цены.
       Берём 4 самых важных и показываем в исходном порядке; общие пункты гарантируют минимум 2 при любом составе. */
    const list = [];
    const add = (prio, text) => list.push({ prio, text, i: list.length });
    add(1, 'Оплата картой или через СБП — платёжные данные клиника не хранит.');
    add(3, 'Можно оформить кредит или рассрочку у банка-партнёра.');
    if (checkup) {
      add(3, 'Чек-ап можно оплатить сейчас, а анализы сдать позже — по направлению, в течение 30 дней.');
      add(1, 'От чек-апа можно отказаться в любой момент: до оказания услуг деньги вернут полностью, за вычетом комиссий банков, в течение 10 дней после заявления.');
    }
    if (offlineConsult) add(1, 'Очную консультацию врача можно перенести, если предупредить не позднее чем за 48 часов. При отказе до начала приёма деньги вернут за вычетом фактических расходов.');
    if (onlineConsult) add(1, 'Онлайн-консультацию переносят или отменяют минимум за 24 часа — иначе она считается оказанной.');
    if (offlineVisit) add(2, 'Подтверждение записи придёт в мессенджер или по телефону — тем способом связи, что вы выбрали выше.');
    if (onlineConsult || onlineProgram) add(4, 'Если цена изменится между оформлением и оплатой, действует новая цена — уже оплаченные услуги не дорожают.');
    return list.slice().sort((a, b) => a.prio - b.prio || a.i - b.i).slice(0, 4).sort((a, b) => a.i - b.i).map((x) => x.text);
  }

  function payReason(consent, needEmail, email) {
    const noEmail = needEmail && !emailOk(email);
    if (noEmail && !consent) return 'Укажите email и отметьте согласие с офертой';
    if (noEmail) return 'Укажите email для документов по чек-апу';
    if (!consent) return 'Отметьте согласие с офертой';
    return '';
  }

  function checkoutRender(ctx) {
    const { state, ui, demo } = ctx;
    const items = cartOf(state);
    const co = Object.assign({ pay: 'card', contact: 'telegram', consent: false, promo: '' }, state.checkout || {});
    /* демо: email ещё не задан (undefined) — подставляем адрес Анны, чтобы путь «Корзина → Оплатить» не обрывался; пустая строка остаётся пустой */
    if (co.email === undefined) co.email = DEMO_EMAIL;
    const user = demo.user || {};
    const total = RC.cartTotal(state);
    if (!items.length) {
      return `${ui.appbar('Оформление')}${ui.empty('empty-cart', 'Нечего оформлять', 'Корзина пуста — выберите услугу в каталоге', `<div class="bk-empty-cta">${ui.btn('В каталог', { variant: 'dark', attrs: RC.link('catalog', null, { 'catalog.category': 'all', 'catalog.goal': null }) })}</div>`)}`;
    }
    const hasCheckup = items.some((i) => (RC.product(i.id) || {}).category === 'checkups');
    const contactHint = {
      telegram: `Напишем в Telegram · @${user.username || ''}`,
      whatsapp: `Напишем в WhatsApp · ${user.phone || ''}`,
      call: `Позвоним на ${user.phone || ''}`,
    }[co.contact] || '';

    const lines = items.map((it) => {
      const p = RC.product(it.id);
      if (!p) return '';
      const qty = it.qty || 1;
      const sp = slotParts(ctx, p, slotOf(p, it));
      const subs = sp ? [sp.when, sp.where] : [needsVisit(p) ? 'Время согласуем после оплаты' : (p.subtitle || RC.kicker(p))];
      return `<div class="bk-line"><span class="bk-line__main"><b>${esc(p.title)}${qty > 1 ? ` <em class="num">× ${qty}</em>` : ''}</b>${subs.filter(Boolean).map((x) => `<small>${esc(x)}</small>`).join('')}</span><span class="bk-line__sum num">${sumLabel(p, qty)}</span></div>`;
    }).join('');
    const promo = String(co.promo || '').trim();
    const promoLine = promo
      ? `<div class="bk-line bk-line--promo"><span class="bk-line__main"><b>Промокод ${esc(promo.toUpperCase())}</b><small>Проверим при оплате</small></span>${I('tag', 18, 'bk-line__tag')}</div>`
      : '';
    const notes = priceNotes(items, true);

    const order = { id: ORDER_ID, items: RC.clone(items), total, pay: co.pay, contact: co.contact };
    const terms = termsFor(items);
    const reason = payReason(!!co.consent, hasCheckup, co.email);
    const emailValid = emailOk(co.email);

    return `
      ${ui.appbar('Оформление', { sub: countLine(items, total) })}
      <section class="pad">
        <div class="bk-me">
          <div class="bk-me__top">
            ${ui.avatar(user.initials || 'RC', { size: 52, tg: true })}
            <span class="bk-me__main"><b>${esc([user.firstName, user.lastName].filter(Boolean).join(' '))}</b><small>@${esc(user.username || '')}</small></span>
            <button class="bk-me__edit" ${RC.act('toast', { text: 'Можно указать другие данные', sub: 'Например, если записываете другого человека', icon: 'user' })}>Изменить</button>
          </div>
          <div class="bk-me__phone">${I('phone', 18)}<b class="num">${esc(user.phone || '')}</b><span class="bk-me__tg">${I('telegram', 12)}из Telegram</span></div>
        </div>
      </section>
      ${hasCheckup ? `<section class="pad mt-12">
        <label class="field bk-email${emailValid ? ' is-ok' : ''}">${I('file', 20, 'field__ico')}<span class="field__body"><small>Email</small><input type="email" inputmode="email" autocomplete="email" value="${esc(co.email || '')}" data-bind="checkout.email" data-bk-email placeholder="Например, anna@mail.ru"></span><span class="bk-email__ok">${I('check', 16)}</span></label>
        <div class="bk-hint">${I('info', 16)}<span>Нужен для документов по чек-апу</span></div>
      </section>` : ''}
      <section class="pad sec">
        ${ui.sectionHead('Как с вами связаться')}
        <div class="bk-contact">${CONTACT.map((c) => `<button class="bk-contact__b${co.contact === c.id ? ' on' : ''}" ${RC.act('set', { 'checkout.contact': c.id })}>${I(c.icon, 20)}<span>${esc(c.label)}</span></button>`).join('')}</div>
        <div class="bk-hint">${I('chat', 16)}<span>${esc(contactHint)}</span></div>
      </section>
      <section class="pad sec">
        ${ui.sectionHead('Оплата')}
        <div class="stack bk-pay">${Object.keys(PAY).map((k) => ui.option({ icon: PAY[k].icon, title: PAY[k].title, sub: PAY[k].sub, on: co.pay === k, attrs: RC.act('set', { 'checkout.pay': k }) })).join('')}</div>
      </section>
      <section class="pad sec">
        ${ui.sectionHead('Ваш заказ', { link: 'Изменить', attrs: RC.link('cart') })}
        <div class="bk-lines">
          ${lines}
          ${promoLine}
          <div class="bk-lines__total"><span>Итого</span><b class="num">${RC.fmt(total)}</b></div>
          ${noteRows(notes, 'bk-lines__note')}
        </div>
      </section>
      <section class="pad sec">
        <details class="acc bk-terms"${co.termsOpen ? ' open' : ''}>
          <summary><span>Условия оплаты и отмены</span>${I('chevD', 18)}</summary>
          <ul class="bk-terms__list">${terms.map((t) => `<li>${I('check', 16)}<span>${esc(t)}</span></li>`).join('')}</ul>
        </details>
        <div class="bk-consent mt-16">${ui.check('Принимаю <u>публичную оферту</u> и <u>политику обработки персональных данных</u>', !!co.consent, 'checkout.consent')}</div>
      </section>
      ${ui.buybar(`<div class="bk-paycta">
        <div class="bk-paycta__why" data-bk-why${reason ? '' : ' hidden'}>${I('info', 15)}<span>${esc(reason)}</span></div>
        ${ui.btn(`Оплатить ${RC.fmt(total)}`, {
          variant: 'primary', size: 'lg', icon: 'lock', disabled: !!reason,
          attrs: RC.linkRoot('success', null, { 'checkout.order': order, cart: [] }) + (hasCheckup ? ' data-bk-need-email' : '') + ' data-bk-pay',
        })}
      </div>`)}`;
  }

  /** Email проверяется на лету, без перерисовки экрана: кнопка и причина над ней обновляются при вводе. */
  function checkoutMount(host, ctx) {
    const input = host.querySelector('[data-bk-email]');
    const btn = host.querySelector('[data-bk-pay]');
    const why = host.querySelector('[data-bk-why]');
    if (!input || !btn || !why) return;
    const sync = () => {
      const co = ctx.state.checkout || {};
      const r = payReason(!!co.consent, btn.hasAttribute('data-bk-need-email'), input.value);
      btn.disabled = !!r;
      why.hidden = !r;
      why.querySelector('span').textContent = r;
      input.closest('.field').classList.toggle('is-ok', emailOk(input.value));
    };
    input.addEventListener('input', sync);
  }

  RC.register({
    id: 'checkout',
    title: 'Оформление',
    short: 'Контакты из Telegram, способ связи и оплаты',
    note: 'Оформление занимает меньше минуты: имя, username и телефон уже пришли из Telegram, клиенту остаётся выбрать способ связи и оплаты. Условия отмены и оферта — прямо на экране, чтобы снять вопросы до оплаты.',
    points: [
      'Контакты подставлены из Telegram — вводить ничего не нужно',
      'Email спрашиваем только для чек-апа, как требует оферта',
      'Связь как в форме сайта: Telegram, WhatsApp или звонок',
      'Карта, СБП или кредит и рассрочка от банка-партнёра',
      'Условия оплаты и отмены — коротко, по оферте',
      'Оплата активна после согласия и email для чек-апа — причина видна над кнопкой',
    ],
    examples: [
      { label: 'Чек-ап и NAD+', state: { cart: DEMO_CART, checkout: { consent: true, pay: 'card', contact: 'telegram', email: DEMO_EMAIL } } },
      { label: 'Без согласия', state: { cart: DEMO_CART, checkout: { consent: false, pay: 'sbp', contact: 'whatsapp', email: '' } } },
      { label: 'Онлайн-услуги · условия', state: { cart: ONLINE_CART, checkout: { consent: true, pay: 'credit', contact: 'telegram', termsOpen: true, email: DEMO_EMAIL } } },
    ],
    render: checkoutRender,
    mount: checkoutMount,
  });

  /* ============================================================= success */

  const GEN = { iv: 'капельницы', consultations: 'консультации', cosmetology: 'процедуры' };

  function successSteps(ctx, items) {
    const ps = items.map((i) => ({ it: i, p: RC.product(i.id) })).filter((x) => x.p);
    const steps = [];
    const offline = ps.filter((x) => slotOf(x.p, x.it) && dirFor(x.p) === 'offline');
    const online = ps.filter((x) => slotOf(x.p, x.it) && dirFor(x.p) === 'online');
    const noSlot = ps.filter((x) => needsVisit(x.p) && !slotOf(x.p, x.it));
    if (offline.length) {
      const kosmo = offline.some((x) => x.it.slot.branch === 'kosmo');
      const ivs = offline.filter((x) => x.p.category === 'iv');
      let d;
      if (kosmo) d = 'На Космодамианской приём ведётся на площадке CosMos: на ресепшене скажите, что вы записаны в Re:clinic';
      else if (ivs.length === offline.length) d = `Напомним о записи на ${ivs.length > 1 ? 'капельницы' : 'капельницу'} ${joinRu(ivs.map((x) => x.p.title))} накануне визита`;
      else d = offline.length > 1 ? 'Напомним о каждой записи накануне визита' : 'Напомним о записи накануне визита';
      steps.push({ t: 'Подтверждение записи и напоминание — в Telegram', d });
    }
    if (online.length) steps.push({ t: 'Ссылка на встречу придёт в чат с ботом', d: 'Напомним о консультации заранее. Понадобятся смартфон или компьютер, наушники и микрофон' });
    if (noSlot.length) {
      let what = 'каждого визита';
      if (noSlot.length === 1) {
        const p = noSlot[0].p;
        if (p.id === DIAG_ID) what = 'диагностической консультации';
        else if (p.category === 'consultations') what = 'консультации';
        else what = `${GEN[p.category] || 'визита'} «${p.title}»`;
      }
      steps.push({ t: 'Согласуем время визита', d: `Свяжемся удобным вам способом и подберём время для ${what}` });
    }
    /* цена после подбора: в оплату не вошло — объясняем, что будет дальше */
    const toPick = ps.filter((x) => x.p.price == null);
    if (toPick.length) {
      const allPrograms = toPick.every((x) => x.p.category === 'programs');
      const names = joinRu(toPick.map((x) => `«${x.p.title}»`));
      steps.push({
        t: `Подберём ${allPrograms ? (toPick.length > 1 ? 'программы' : 'программу') : 'услугу'} на консультации`,
        d: `${names}: цену назовём после подбора, в${NB}эту оплату не${NB}входит`,
      });
    }
    const checkup = ps.find((x) => x.p.category === 'checkups');
    if (checkup) {
      steps.push(
        { t: 'Направление в лабораторию придёт в чат с ботом', d: 'Подберём ближайшую лабораторию-партнёра: Инвитро, Хеликс, ЛабКвест или Ситилаб' },
        { t: 'Сдаёте анализы', d: 'В течение 30 дней, утром натощак. Памятка по подготовке придёт вместе с направлением' },
        { t: 'Результаты — в личном кабинете', d: 'Показатели и документы соберём в разделе «Результаты»' },
        { t: 'Консультация с разбором', d: 'Дату согласуем в течение 3–7 дней после результатов' },
      );
    }
    if (!steps.length) steps.push({ t: 'Подтверждение придёт в чат с ботом', d: 'Детали заказа сохранятся в личном кабинете' });
    return steps;
  }

  function visitCard(ctx, it, p) {
    const slot = it.slot;
    const d = dayOf(ctx, slot.date);
    const online = dirFor(p) === 'online';
    const br = online ? null : RC.branch(slot.branch);
    const actions = [
      online ? '' : ctx.ui.btn('Маршрут', { variant: 'white', size: 'sm', icon: 'route', attrs: RC.act('toast', { text: 'Маршрут в Яндекс Картах', sub: br ? br.address : '', icon: 'route' }) }),
      ctx.ui.btn('В календарь', { variant: 'white', size: 'sm', icon: 'calendar', attrs: RC.act('toast', { text: 'Добавлено в календарь', sub: `${p.title} · ${dateLong(ctx, slot.date)}, ${slot.time}`, icon: 'calendar' }) }),
    ].filter(Boolean);
    return `<article class="bk-visit">
      <div class="bk-visit__top">
        <div class="bk-visit__date"><b class="num">${d ? d.d : ''}</b><span>${d ? esc(d.dow) : ''}</span></div>
        <div class="bk-visit__main">
          <b>${esc(p.title)}</b>
          <small class="num">${esc(dateLong(ctx, slot.date))} · ${esc(slot.time)}</small>
          <small>${online ? 'Онлайн · ссылка придёт в чат с ботом' : esc(br ? `${branchShort(br)} · м. ${br.metro}` : '')}</small>
        </div>
      </div>
      <div class="bk-visit__actions${actions.length === 1 ? ' is-one' : ''}">${actions.join('')}</div>
    </article>`;
  }

  function successRender(ctx) {
    const { state, ui, demo } = ctx;
    const saved = state.checkout && state.checkout.order;
    let items = saved && saved.items && saved.items.length ? saved.items : cartOf(state);
    if (!items.length) items = (demo.state && demo.state.cart) || [];
    const total = itemsTotal(items);
    const payKey = (saved && saved.pay) || (state.checkout && state.checkout.pay) || 'card';
    const visits = items.map((it) => ({ it, p: RC.product(it.id) })).filter((x) => x.p && slotOf(x.p, x.it));
    const steps = successSteps(ctx, items);
    return `
      <section class="bk-done">
        <div class="bk-done__illu">${RC.illu('success', { tone: RC.TONES.sage })}</div>
        <h1 class="bk-done__title">Оплачено</h1>
        <p class="bk-done__sub">Спасибо, ${esc((demo.user || {}).firstName || '')}! Детали заказа сохранили в личном кабинете</p>
      </section>
      <section class="pad mt-24">
        <div class="bk-receipt">
          <div><small>Заказ</small><b class="num">${ORDER_ID}</b></div>
          <div><small>Сумма</small><b class="num">${RC.fmt(total)}</b></div>
          <div><small>Оплата</small><b>${esc((PAY[payKey] || PAY.card).short)}</b></div>
        </div>
        <p class="bk-receipt__meta">${esc(countShort(items))} · ${esc(items.map((i) => (RC.product(i.id) || {}).title).filter(Boolean).join(', '))}</p>
      </section>
      ${visits.length ? `<section class="pad sec">${ui.sectionHead(visits.length > 1 ? 'Ваши записи' : 'Ваша запись')}<div class="stack">${visits.map((x) => visitCard(ctx, x.it, x.p)).join('')}</div></section>` : ''}
      <section class="pad sec">
        ${ui.sectionHead('Что дальше')}
        ${stepsList(steps)}
      </section>
      <section class="pad sec">${ui.btn('На главную', { variant: 'ghost', block: true, attrs: RC.linkRoot('home') })}</section>
      ${ui.buybar(ui.btn('В личный кабинет', { variant: 'primary', size: 'lg', iconRight: 'arrowR', attrs: RC.linkRoot('profile') }))}`;
  }

  RC.register({
    id: 'success',
    title: 'Оплата прошла',
    short: 'Номер заказа, запись и план «что дальше»',
    root: true,
    note: 'Экран после оплаты снимает вопрос «а что теперь»: номер заказа, сумма, карточка записи и пошаговый план — от направления в лабораторию до консультации. Отсюда клиент сразу переходит в личный кабинет, где следит за заказом.',
    points: [
      'Номер заказа, сумма и способ оплаты — как в чеке',
      'Карточка визита с маршрутом и добавлением в календарь',
      'Шаги «Что дальше» собираются по составу заказа',
      'Для чек-апа — путь от направления до разбора результатов',
      'Подтверждение и напоминания приходят в Telegram',
    ],
    examples: [
      { label: 'Чек-ап и NAD+', state: { cart: DEMO_CART, checkout: { pay: 'card', order: null } } },
      { label: 'Онлайн-услуги', state: { cart: ONLINE_CART, checkout: { pay: 'sbp', order: null } } },
    ],
    render: successRender,
  });
})();
