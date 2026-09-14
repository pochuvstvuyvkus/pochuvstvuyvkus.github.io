/* Личный кабинет: профиль, записи и заказы, результаты анализов, прогресс программы.
   Все данные клиента — из RC_DEMO, продукты — из RC_DATA. Классы — с префиксом cb-. */
(function () {
  const { esc, icon: I } = RC;

  /* ------------------------------------------------------------ helpers */

  let svgSeq = 0;
  const kg = (v) => Number(v).toFixed(1).replace('.', ',');
  const kgShort = (v) => kg(v).replace(/,0$/, '');
  const num = (s) => parseFloat(String(s).replace(',', '.'));
  /** «Мосфильмовская» — короткое имя филиала из data (без висящего предлога «на»). */
  const branchShort = (br) => (br ? br.shortName || br.name.replace(/^Re:clinic( × CosMos)?( на)? /, '') : '');
  const toast = (text, sub, icon) => RC.act('toast', { text, sub, icon });

  const prog = (demo) => demo.program || { weights: [], today: [], week: 0, weeks: 1 };
  const activeOrder = (demo) => (demo.orders || []).find((o) => o.status === 'active') || null;

  /** Разбор результатов чек-апа — консультация, которая входит в заказ. */
  const REVIEW_ID = 'consult-online-60';
  const REVIEW_TITLE = 'Разбор результатов чек-апа';
  const reviewBooking = (demo) => (demo.bookings || []).find((b) => b.productId === REVIEW_ID) || null;
  /** Название записи: разбор, входящий в чек-ап, не называем каталожным именем платной консультации. */
  const bookingTitle = (b, p) => (b.productId === REVIEW_ID ? REVIEW_TITLE : p.title);
  /** Замер программы — диагностическая консультация, входит в программу. */
  const CHECK_ID = 'consult-offline-diagnostic';
  const DOW_FULL = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

  /* даты: «15 сент», «пт, 19 сентября» → Date; сравнение с demo.today */
  const MONTHS = ['янв', 'фев', 'мар', 'апр', 'ма', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const MONTH_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const DOW = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const pad2 = (n) => String(n).padStart(2, '0');
  const yearOf = (demo) => Number(String((demo && demo.today && demo.today.iso) || '2026').slice(0, 4));
  function parseRuDate(s, year) {
    const m = /(\d{1,2})\s+([а-яё]+)/i.exec(String(s || ''));
    if (!m) return null;
    const word = m[2].toLowerCase();
    const mi = MONTHS.findIndex((p) => word.startsWith(p));
    return mi < 0 ? null : new Date(year, mi, Number(m[1]));
  }
  const todayDate = (demo) => {
    const iso = (demo && demo.today && demo.today.iso) || '2026-09-14';
    return new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  };
  /** «сб, 19 сентября» — день недели считаем сами (RC.day или календарь), а не берём из строки. */
  function dayLabel(dt) {
    const iso = `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
    const day = RC.day(iso);
    return {
      iso,
      text: `${day ? day.dow : DOW[dt.getDay()]}, ${dt.getDate()} ${day ? day.month : MONTH_GEN[dt.getMonth()]}`,
    };
  }
  const isoDate = (iso) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  const shortDate = (iso) => {
    const d = isoDate(iso);
    return `${d.getDate()} ${MONTH_GEN[d.getMonth()].slice(0, 4)}`;
  };
  /** Смещение замеров в днях от первого: ось X графиков — по датам, а не по номеру точки. */
  function dayOffsets(ws, demo) {
    const year = yearOf(demo);
    const ds = ws.map((w) => parseRuDate(w.d, year));
    if (ds.some((d) => !d)) return ws.map((_, i) => i);
    return ds.map((d) => Math.round((d - ds[0]) / 864e5));
  }

  /** Индексы выполненных задач дня: из состояния, иначе — из демо (done:true). */
  function doneList(ctx) {
    const s = ctx.state.program;
    if (s && Array.isArray(s.done)) return s.done;
    return (prog(ctx.demo).today || []).map((t, i) => (t.done ? i : -1)).filter((i) => i >= 0);
  }

  RC.actions['cb-task'] = ({ i }, ctx) => {
    const cur = doneList(ctx);
    const next = cur.includes(i) ? cur.filter((x) => x !== i) : cur.concat(i).sort((a, b) => a - b);
    ctx.state.program = Object.assign({}, ctx.state.program, { done: next });
  };

  /** Отмена записи: шторка подтверждения с выбранной записью. */
  RC.actions['cb-cancel'] = ({ id }, ctx) => {
    ctx.state.orders = Object.assign({}, ctx.state.orders, { cancel: id });
    RC.proto.sheet = 'cancel';
  };
  RC.actions['cb-cancel-confirm'] = (_, ctx) => {
    const o = Object.assign({}, ctx.state.orders);
    const id = o.cancel;
    o.cancelled = (o.cancelled || []).filter((x) => x !== id).concat(id ? [id] : []);
    ctx.state.orders = o;
    RC.proto.sheet = null;
    RC.toast('Запрос на отмену отправлен', { sub: 'Администратор подтвердит отмену в Telegram', icon: 'check' });
  };

  /** Плитка даты: 18 / пт */
  function dateTile(iso, cls) {
    const day = RC.day(iso);
    const d = day ? day.d : Number(String(iso).slice(8, 10));
    const dow = day ? day.dow : '';
    return `<span class="cb-date${cls ? ' ' + cls : ''}"><b class="num">${esc(d)}</b><small>${esc(dow)}</small></span>`;
  }

  /** Формат записи — по самой записи и её продукту: онлайн-услуга без филиала идёт онлайн. */
  const isOnline = (b) => {
    if (b.online) return true;
    const p = RC.product(b.productId);
    return !b.branch && !!p && RC.formatLabel(p) === 'Онлайн';
  };
  /** Место записи: «онлайн» или короткое имя филиала. */
  const bookingPlace = (b) => (isOnline(b) ? 'онлайн' : branchShort(RC.branch(b.branch)));
  /** Полная подпись места: «Онлайн · ссылка в Telegram» или название филиала. */
  const bookingPlaceFull = (b) => (isOnline(b) ? 'Онлайн · ссылка в Telegram' : (RC.branch(b.branch) || {}).name || '');

  /** Строка продукта с покупкой в один тап (избранное, рекомендации). */
  function buyRow(p, ctx) {
    const inCart = RC.inCart(ctx.state, p.id);
    const btn = p.price == null
      ? `<button class="cb-buy__btn cb-buy__btn--soft" ${RC.link('product', { id: p.id })} aria-label="Подробнее">${I('arrowR', 20)}</button>`
      : `<button class="cb-buy__btn${inCart ? ' is-in' : ''}" ${RC.act(inCart ? 'go-cart' : 'add', { id: p.id })} aria-label="${inCart ? 'Уже в корзине' : 'В корзину'}">${I(inCart ? 'check' : 'plus', 20)}</button>`;
    return `<article class="cb-buy" ${RC.link('product', { id: p.id })}>
      ${RC.ui.illuBox(p, { cls: 'cb-buy__illu' })}
      <div class="cb-buy__main">
        <b>${esc(p.title)}</b>
        <small>${esc(p.subtitle || RC.category(p.category).title)}</small>
        <span class="cb-buy__price num">${RC.priceLabel(p)}${inCart ? '<em>в корзине</em>' : ''}</span>
      </div>
      ${btn}
    </article>`;
  }

  /** Линия веса для мини-графика в карточке программы */
  function sparkline(weights, w, h, demo) {
    if (weights.length < 2) return '';
    const vs = weights.map((x) => x.v);
    const offs = dayOffsets(weights, demo);
    const span = offs[offs.length - 1] || 1;
    const lo = Math.min(...vs), hi = Math.max(...vs);
    const pts = vs.map((v, i) => [4 + (offs[i] * (w - 8)) / span, 4 + ((hi - v) / (hi - lo || 1)) * (h - 8)]);
    const last = pts[pts.length - 1];
    return `<svg class="cb-spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
      <polyline points="${pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="#C8B78A" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="4.5" fill="#fff"/>
    </svg>`;
  }

  /* ------------------------------------------------------------ profile */

  function favSheet(ctx) {
    const list = (ctx.state.favorites || []).map(RC.product).filter(Boolean);
    const inner = list.length
      ? `<p class="cb-sheet__sub">${list.length} ${RC.plural(list.length, 'услуга', 'услуги', 'услуг')} · добавляйте в корзину в один тап</p>
         <div class="cb-buys">${list.map((p) => buyRow(p, ctx)).join('')}</div>
         <div class="mt-16">${ctx.ui.btn('Перейти в каталог', { variant: 'soft', block: true, attrs: RC.link('catalog', null, { 'catalog.category': 'all', 'catalog.goal': null }) })}</div>`
      : `<div class="cb-fav-empty">${ctx.ui.empty('empty-cart', 'Пока пусто', 'Отмечайте услуги сердечком — они появятся здесь', ctx.ui.btn('В каталог', { variant: 'dark', attrs: RC.link('catalog') }))}</div>`;
    return ctx.ui.sheet(inner, { title: 'Избранное' });
  }

  function nextVisit(ctx) {
    const { demo, ui } = ctx;
    /* ближайшая по дате — неважно, онлайн она или в клинике */
    const b = (demo.bookings || []).slice().sort((x, y) => `${x.date} ${x.time}`.localeCompare(`${y.date} ${y.time}`))[0];
    const p = b && RC.product(b.productId);
    if (!p) return '';
    const online = isOnline(b);
    const br = !online && RC.branch(b.branch);
    const actions = online
      ? ui.btn('В календарь', { variant: 'white', size: 'sm', icon: 'calendar', attrs: toast('Добавлено в календарь', b.dateLabel + ', ' + b.time, 'calendar') })
      : ui.btn('Маршрут', { variant: 'white', size: 'sm', icon: 'route', attrs: toast('Маршрут в Яндекс Картах', br ? br.address : '', 'route') });
    return `<section class="pad sec">
      ${ui.sectionHead('Ближайшая запись')}
      <article class="cb-visit">
        <div class="cb-visit__head" ${RC.link('orders', null, { 'orders.tab': 'active' })}>
          ${dateTile(b.date)}
          <div class="cb-visit__main">
            <b>${esc(bookingTitle(b, p))}</b>
            <small><span class="num">${esc(b.time)}</span> · ${esc(bookingPlace(b))}</small>
          </div>
        </div>
        <div class="cb-visit__btns">
          ${actions}
          ${ui.btn('Перенести', { variant: 'white', size: 'sm', icon: 'clock', attrs: toast('Перенос записи', 'Администратор предложит свободное время в Telegram', 'calendar') })}
        </div>
      </article>
    </section>`;
  }

  function programCard(ctx) {
    const pr = prog(ctx.demo);
    const p = RC.product(pr.productId);
    if (!p || !pr.weights.length) return '';
    const first = pr.weights[0].v, last = pr.weights[pr.weights.length - 1].v;
    return `<section class="pad sec">
      <article class="cb-prog" ${RC.link('progress')}>
        <div class="cb-prog__top">
          <span class="cb-kick">${I('leaf', 14)}Моя программа</span>
          <span class="cb-prog__go">${I('arrowR', 18)}</span>
        </div>
        <h3 class="cb-prog__title">${esc(p.title)}</h3>
        <div class="cb-prog__mid">
          <div class="cb-prog__metric"><b class="num">−${kg(first - last)} кг</b><small>с ${esc(pr.startedLabel)}</small></div>
          ${sparkline(pr.weights, 112, 46, ctx.demo)}
        </div>
        <div class="cb-prog__week"><span>Неделя ${pr.week} из ${pr.weeks}</span><span class="num">${Math.round((pr.week / pr.weeks) * 100)}%</span></div>
        ${ctx.ui.progress(pr.week / pr.weeks)}
      </article>
    </section>`;
  }

  function checkupCard(ctx) {
    const { demo, ui } = ctx;
    const o = activeOrder(demo);
    const p = o && RC.product(o.items[0].id);
    if (!p) return '';
    const r = demo.results || {};
    const next = (o.steps || []).find((s) => !s.done);
    const eta = next && parseRuDate(next.d, yearOf(demo));
    const ratio = r.total ? r.ready / r.total : 0;
    return `<section class="pad sec">
      ${ui.sectionHead('Чек-ап в работе')}
      <article class="cb-check" ${RC.link('results')}>
        <div class="cb-check__top">
          <span class="cb-check__ico">${I('flask', 22)}</span>
          <div class="cb-check__main"><b>Чек-ап «${esc(p.title)}»</b><small>${eta ? `Все результаты — примерно к ${eta.getDate()} ${MONTH_GEN[eta.getMonth()]}` : 'Все результаты готовы'}</small></div>
          ${I('chevR', 18, 'cb-check__chev')}
        </div>
        <div class="cb-check__bar">${ui.progress(ratio)}</div>
        <div class="cb-check__foot">
          ${ui.badge(o.statusLabel, 'ok')}
          ${r.total ? `<b class="num">Готово ${r.ready} из ${r.total}</b>` : ''}
        </div>
      </article>
    </section>`;
  }

  RC.register({
    id: 'profile',
    title: 'Личный кабинет',
    short: 'Профиль из Telegram, записи, программа, чек-ап',
    tabbar: 'profile',
    note: 'Кабинет собирает всё, что клиент купил, в одном месте: ближайший визит, прогресс программы, статус чек-апа и быстрый доступ к заказам и результатам. Клиенту не нужно искать переписку с администратором — а клинике это даёт повторные записи и меньше звонков «где мои анализы».',
    points: [
      'Профиль приходит из Telegram — без паролей и анкет',
      'Прогресс программы виден сразу — мотивирует дойти до конца',
      'Ближайшая запись с маршрутом и переносом в один тап',
      'Статус чек-апа ведёт прямо в результаты анализов',
      'Избранное открывается шторкой с покупкой в один тап',
      'Связь с администратором — сразу в чат Telegram',
    ],
    examples: [
      { label: 'Кабинет' },
      { label: 'Избранное', sheet: 'fav' },
      { label: 'Избранное пусто', state: { favorites: [] }, sheet: 'fav' },
    ],
    sheets: { fav: favSheet },
    render(ctx) {
      const { demo, state, ui } = ctx;
      const u = demo.user || {};
      const o = activeOrder(demo);
      const r = demo.results || {};
      const pr = prog(demo);
      const nFav = (state.favorites || []).length;
      const nBk = (demo.bookings || []).length;
      const nOrd = (demo.orders || []).length;
      const notif = (demo.notifications || []).length;
      const kpi = (n, label, attrs) => `<button class="cb-kpi" ${attrs}><b class="num">${n}</b><span>${esc(label)}</span></button>`;

      return `
        ${ui.appbar('Кабинет', { right: ui.iconBtn('bell', toast('Уведомления', (demo.notifications || [])[0] ? demo.notifications[0].title : '', 'bell'), { label: 'Уведомления', badge: notif || '' }) })}
        <section class="pad">
          <div class="cb-me">
            <div class="cb-me__top">
              ${ui.avatar(u.initials || 'Re', { size: 76, tg: true })}
              <div class="cb-me__id">
                <h2>${esc(u.firstName)} ${esc(u.lastName)}</h2>
                <p>@${esc(u.username)}</p>
                <span class="cb-pill cb-pill--tg">${I('telegram', 14)}Вход через Telegram</span>
              </div>
            </div>
            <div class="cb-me__row">
              <span class="cb-me__ico">${I('phone', 18)}</span>
              <span class="cb-me__lbl">Телефон</span>
              <b class="num">${esc(u.phone)}</b>
            </div>
          </div>
        </section>

        <section class="pad mt-12">
          <div class="cb-kpis">
            ${kpi(nBk, RC.plural(nBk, 'запись', 'записи', 'записей'), RC.link('orders', null, { 'orders.tab': 'active' }))}
            ${kpi(nOrd, RC.plural(nOrd, 'заказ', 'заказа', 'заказов'), RC.link('orders', null, { 'orders.tab': 'active' }))}
            ${kpi(nFav, 'в избранном', RC.act('sheet-open', { key: 'fav' }))}
          </div>
        </section>

        ${nextVisit(ctx)}
        ${programCard(ctx)}
        ${checkupCard(ctx)}

        <section class="pad sec">
          ${ui.list([
            ui.row({ icon: 'calendar', title: 'Записи и заказы', sub: 'Перенос и отмена без звонка', attrs: RC.link('orders', null, { 'orders.tab': 'active' }) }),
            ui.row({ icon: 'flask', title: 'Результаты анализов', sub: r.total || o ? 'PDF-бланки и показатели' : '', attrs: RC.link('results') }),
            ui.row({ icon: 'chart', title: 'Моя программа', sub: pr.weights.length ? 'График веса и задачи дня' : '', attrs: RC.link('progress') }),
            ui.row({ icon: 'heart', title: 'Избранное', right: `<span class="cb-count num">${nFav}</span>`, attrs: RC.act('sheet-open', { key: 'fav' }) }),
          ])}
          <div class="mt-12">${ui.list([
            ui.row({ icon: 'stetho', title: 'Специалисты', attrs: RC.link('team') }),
            ui.row({ icon: 'pin', title: 'Филиалы и контакты', attrs: RC.link('contacts') }),
            ui.row({ icon: 'file', title: 'Документы', sub: 'Договоры, оферты, лицензии', attrs: toast('Документы', 'Договоры и оферты откроются в PDF', 'file') }),
          ])}</div>
          <div class="mt-12">${ui.list([
            ui.row({ icon: 'telegram', tone: 'tg', title: 'Написать администратору', sub: 'Ответим в чате Telegram', attrs: toast('Откроется чат в Telegram', 'Администратор Re:clinic на связи', 'telegram') }),
          ])}</div>
        </section>

        <p class="cb-tgid">Telegram ID <span class="num">${esc(u.tgId)}</span></p>`;
    },
  });

  /* ------------------------------------------------------------- orders */

  function bookingCard(b, ctx) {
    const { ui, demo } = ctx;
    const p = RC.product(b.productId);
    if (!p) return '';
    const isReview = b.productId === REVIEW_ID;
    const order = isReview ? activeOrder(demo) : null;
    const cancelled = ((ctx.state.orders && ctx.state.orders.cancelled) || []).includes(b.id);
    const badge = cancelled
      ? ui.badge('Отмена на рассмотрении', 'warn')
      : ui.badge(b.status === 'confirmed' ? 'Подтверждена' : 'Ожидает', b.status === 'confirmed' ? 'ok' : 'warn');
    /* разбор входит в чек-ап — ведём к результатам, а не на страницу платной консультации */
    const titleLink = isReview ? RC.link('results') : RC.link('product', { id: p.id });
    return `<article class="cb-card cb-bk${cancelled ? ' is-cancelled' : ''}">
      <div class="cb-bk__head">
        ${dateTile(b.date, 'cb-date--white')}
        <div class="cb-bk__main">
          <div class="cb-bk__row"><span class="cb-bk__when num">${I('clock', 15)}${esc(b.time)}</span>${badge}</div>
          <b class="cb-bk__title" ${titleLink}>${esc(bookingTitle(b, p))}</b>
          <small class="cb-bk__place">${I(isOnline(b) ? 'globe' : 'pin', 15)}<span>${esc(bookingPlaceFull(b))}</span></small>
          ${order ? `<span class="cb-bk__note">${I('flask', 14)}Входит в заказ ${esc(order.id)}</span>` : ''}
        </div>
      </div>
      <div class="cb-bk__btns${cancelled || isReview ? ' cb-bk__btns--one' : ''}">
        ${ui.btn('Перенести', { variant: 'white', size: 'sm', attrs: toast('Перенос записи', isReview ? 'Время предложим в Telegram · без доплаты' : 'Администратор предложит свободное время в Telegram', 'calendar') })}
        ${cancelled || isReview ? '' : ui.btn('Отменить', { variant: 'ghost', size: 'sm', attrs: RC.act('cb-cancel', { id: b.id }) })}
      </div>
    </article>`;
  }

  function cancelSheet(ctx) {
    const { demo, state, ui } = ctx;
    const list = demo.bookings || [];
    const id = state.orders && state.orders.cancel;
    const b = list.find((x) => x.id === id) || list[0];
    const p = b && RC.product(b.productId);
    if (!p) return ui.sheet('', { title: 'Отмена записи' });
    const rule = b.productId === REVIEW_ID
      ? 'Разбор входит в чек-ап — его можно перенести на удобное время.'
      : isOnline(b)
      ? 'Онлайн-консультацию можно отменить или перенести, если предупредить не менее чем за 24 часа.'
      : 'Перенести визит можно, если предупредить не позднее чем за 48 часов. При отмене деньги вернут за вычетом фактических расходов.';
    return ui.sheet(`
      <div class="cb-cancel">
        <div class="cb-cancel__card">
          ${dateTile(b.date, 'cb-date--white')}
          <div class="cb-cancel__main">
            <b>${esc(bookingTitle(b, p))}</b>
            <span class="cb-cancel__when num">${esc(String(b.dateLabel).replace(/^[а-я]{2},\s*/, ''))}, ${esc(b.time)}</span>
            <small class="cb-cancel__place">${esc(bookingPlaceFull(b))}</small>
          </div>
        </div>
        <p class="cb-cancel__rule">${I('info', 18)}<span>${esc(rule)} Удобнее перенести — время подберёт администратор.</span></p>
        <div class="cb-cancel__btns">
          ${ui.btn('Оставить запись', { variant: 'dark', block: true, attrs: RC.act('sheet-close') })}
          ${ui.btn('Отменить запись', { variant: 'ghost', block: true, attrs: RC.act('cb-cancel-confirm') })}
        </div>
      </div>`, { title: 'Отменить запись?' });
  }

  function orderItems(o) {
    return (o.items || []).map((it) => {
      const p = RC.product(it.id);
      if (!p) return '';
      return `<div class="cb-item" ${RC.link('product', { id: p.id })}>
        ${RC.ui.illuBox(p, { cls: 'cb-item__illu' })}
        <div class="cb-item__main"><b>${esc(p.title)}</b><small>${esc(p.subtitle || RC.category(p.category).title)}</small></div>
        <span class="cb-item__price num">${p.price != null ? RC.fmt(p.price * (it.qty || 1)) : ''}</span>
      </div>`;
    }).join('');
  }

  /** Шаги заказа: выполненный шаг с датой позже сегодняшней (демо) подписываем «сегодня»;
      шаг консультации получает дату записи на разбор, если она есть. */
  function timeline(steps, demo) {
    const nowIdx = steps.findIndex((s) => !s.done);
    const today = todayDate(demo);
    const year = yearOf(demo);
    const rb = reviewBooking(demo);
    return `<ol class="cb-tl">${steps.map((s, i) => {
      const st = s.done ? 'is-done' : i === nowIdx ? 'is-now' : 'is-next';
      let d = s.d;
      const dt = parseRuDate(s.d, year);
      if (s.done && dt && dt > today) d = 'сегодня';
      const isReview = /консультац/i.test(s.t);
      if (isReview && rb) d = shortDate(rb.date);
      else if (isReview && !dt) d = '—';
      return `<li class="cb-tl__i ${st}">
        <span class="cb-tl__dot">${s.done ? I('check', 15) : ''}</span>
        <div class="cb-tl__body">
          <div class="cb-tl__row"><b>${esc(s.t)}</b>${d ? `<span class="num">${esc(d)}</span>` : ''}</div>
          ${i === nowIdx ? `<p class="cb-tl__sub">Часть анализов уже готова</p>
            <button class="cb-tl__link" ${RC.link('results')}>Открыть результаты${I('arrowR', 16)}</button>` : ''}
          ${isReview && rb && i !== nowIdx ? `<p class="cb-tl__sub">Вы записаны · <span class="num">${esc(rb.time)}</span>, ${esc(bookingPlace(rb))}</p>` : ''}
        </div>
      </li>`;
    }).join('')}</ol>`;
  }

  function activeOrderCard(o, ctx) {
    const { ui, demo } = ctx;
    return `<article class="cb-card cb-order">
      <div class="cb-order__head">
        <div><b class="cb-order__id">Заказ ${esc(o.id)}</b><small>от ${esc(o.dateLabel)}</small></div>
        ${ui.badge(o.statusLabel, 'ok')}
      </div>
      <div class="cb-order__items">${orderItems(o)}</div>
      <dl class="cb-sum">
        <div><dt>Оплата</dt><dd>${I('card', 16)}${esc(o.pay)}</dd></div>
        <div class="cb-sum__total"><dt>Итого</dt><dd class="num">${RC.fmt(o.total)}</dd></div>
      </dl>
      <div class="cb-order__tl">${timeline(o.steps || [], demo)}</div>
    </article>`;
  }

  function historyCard(o, ui) {
    const first = RC.product((o.items[0] || {}).id);
    return `<article class="cb-card cb-order">
      <div class="cb-order__head">
        <div><b class="cb-order__id">Заказ ${esc(o.id)}</b><small>от ${esc(o.dateLabel)}</small></div>
        ${ui.badge(o.statusLabel, 'ok')}
      </div>
      <div class="cb-order__items">${orderItems(o)}</div>
      <dl class="cb-sum">
        <div><dt>Оплата</dt><dd>${I('card', 16)}${esc(o.pay)}</dd></div>
        <div class="cb-sum__total"><dt>Итого</dt><dd class="num">${RC.fmt(o.total)}</dd></div>
      </dl>
      <div class="cb-order__btns">
        ${first ? ui.btn('Повторить', { variant: 'dark', size: 'sm', icon: 'plus', attrs: RC.act('add', { id: first.id }) }) : ''}
        ${ui.btn('Оставить отзыв', { variant: 'white', size: 'sm', icon: 'star', attrs: toast('Откроем форму отзыва в чате с ботом', 'Пара вопросов о визите — займёт минуту', 'star') })}
      </div>
    </article>`;
  }

  /** Рекомендации в истории: под цель программы клиента, без купленного/записанного,
      без чек-апов, программ и консультаций (замеры и сопровождение уже входят в программу). */
  const GOAL_SUB = { weight: 'Дополнит программу снижения веса' };
  function recommend(ctx) {
    const { demo } = ctx;
    const pr = prog(demo);
    const pp = RC.product(pr.productId);
    const goal = pp && (pp.goals || [])[0];
    const owned = new Set([
      ...(demo.orders || []).flatMap((o) => (o.items || []).map((it) => it.id)),
      ...(demo.bookings || []).map((b) => b.productId),
      pr.productId,
    ]);
    let recs = goal
      ? RC.productsBy({ goal }).filter((p) => !owned.has(p.id) && !['checkups', 'programs', 'consultations'].includes(p.category))
      : [];
    if (!recs.length) recs = [RC.product(CHECK_ID)].filter(Boolean);
    const sub = goal ? GOAL_SUB[goal] || `Под вашу цель — ${RC.goalTitle(goal).toLowerCase()}` : 'Подберём следующий шаг';
    return { recs: recs.slice(0, 2), sub };
  }

  RC.register({
    id: 'orders',
    title: 'Записи и заказы',
    short: 'Активные записи, статус заказа, история',
    note: 'Все записи и оплаченные заказы с понятным статусом: когда и куда прийти, на каком этапе чек-ап, что было куплено раньше. Клиент сам переносит визит и повторяет покупку в один тап — администратор разгружен, а повторные продажи растут.',
    points: [
      'Записи в клинику и онлайн — с датой, временем, местом и статусом',
      'Перенос и отмена — без звонка, с правилами из оферты',
      'Таймлайн заказа: оплата → анализы → результаты → разбор',
      'Из текущего шага — сразу в готовые результаты',
      '«Повторить» кладёт прошлую услугу в корзину',
      'Сбор отзывов после оказанной услуги',
    ],
    examples: [
      { label: 'Активные', state: { orders: { tab: 'active' } } },
      { label: 'История', state: { orders: { tab: 'history' } } },
      { label: 'Отмена записи', state: { orders: { tab: 'active', cancel: 'BK-2041' } }, sheet: 'cancel' },
    ],
    sheets: { cancel: cancelSheet },
    render(ctx) {
      const { demo, state, ui } = ctx;
      const tab = (state.orders && state.orders.tab) || 'active';
      const bookings = demo.bookings || [];
      const active = (demo.orders || []).filter((o) => o.status === 'active');
      const done = (demo.orders || []).filter((o) => o.status !== 'active');
      const actSub = [
        bookings.length ? `${bookings.length} ${RC.plural(bookings.length, 'запись', 'записи', 'записей')}` : '',
        active.length ? `${active.length} ${RC.plural(active.length, 'заказ', 'заказа', 'заказов')}` : '',
      ].filter(Boolean).join(' · ') || 'нет активных';

      let body;
      if (tab === 'history') {
        const { recs, sub: recSub } = recommend(ctx);
        body = `
          <section class="pad mt-24">
            <div class="stack">${done.map((o) => historyCard(o, ui)).join('') || ui.empty('calendar', 'История пуста', 'Здесь появятся оказанные услуги')}</div>
          </section>
          ${recs.length ? `<section class="pad sec">
            ${ui.sectionHead('К вашей программе', { sub: recSub })}
            <div class="cb-buys">${recs.map((p) => buyRow(p, ctx)).join('')}</div>
          </section>` : ''}`;
      } else {
        body = `
          <section class="pad mt-24">
            ${ui.sectionHead('Записи', { sub: `${bookings.length} ${RC.plural(bookings.length, 'предстоящий визит', 'предстоящих визита', 'предстоящих визитов')}` })}
            <div class="stack">${bookings.map((b) => bookingCard(b, ctx)).join('')}</div>
          </section>
          ${active.length ? `<section class="pad sec">
            ${ui.sectionHead('Заказы')}
            <div class="stack">${active.map((o) => activeOrderCard(o, ctx)).join('')}</div>
          </section>` : ''}`;
      }

      return `
        ${ui.appbar('Записи и заказы')}
        <div class="pad">${ui.seg([
          { value: 'active', label: 'Активные', sub: actSub },
          { value: 'history', label: 'История', sub: `${done.length} ${RC.plural(done.length, 'заказ', 'заказа', 'заказов')}` },
        ], tab, 'orders.tab')}</div>
        ${body}
        <div class="cb-bottom"></div>`;
    },
  });

  /* ------------------------------------------------------------ results */

  const MARKER = {
    low: { tone: 'warn', label: 'Ниже референса' },
    high: { tone: 'warn', label: 'Выше референса' },
    warn: { tone: 'warn', label: 'Обсудить со специалистом' },
    ok: { tone: 'ok', label: 'В норме' },
  };
  const MARKER_ORDER = { low: 0, high: 0, warn: 1, ok: 2 };

  function markerCard(m) {
    const st = MARKER[m.status] || MARKER.ok;
    const [a, b] = String(m.ref).split(/[–-]/).map(num);
    const v = num(m.value);
    let scale = '';
    if (isFinite(a) && isFinite(b) && isFinite(v) && b > a) {
      const span = b - a;
      const min = Math.min(a - span * 0.4, v - span * 0.08);
      const max = Math.max(b + span * 0.4, v + span * 0.08);
      const pos = (x) => Math.max(2, Math.min(98, ((x - min) / (max - min)) * 100));
      scale = `<div class="cb-scale cb-scale--${st.tone}" aria-hidden="true">
        <i class="cb-scale__ref" style="left:${pos(a).toFixed(1)}%;width:${(pos(b) - pos(a)).toFixed(1)}%"></i>
        <i class="cb-scale__dot" style="left:${pos(v).toFixed(1)}%"></i>
      </div>`;
    }
    return `<article class="cb-mk">
      <div class="cb-mk__top"><b>${esc(m.name)}</b>${RC.ui.badge(st.label, st.tone)}</div>
      <div class="cb-mk__val">
        <span class="cb-mk__num num">${esc(m.value)}<em>${esc(m.unit)}</em></span>
        <small class="num">референс ${esc(m.ref)}</small>
      </div>
      ${scale}
    </article>`;
  }

  /** Подпись документа: без повтора «готово 24 из 31» из карточки готовности, с датой из demo. */
  function docMeta(d, demo) {
    const parts = String(d.meta || '').split(' · ').filter(Boolean);
    const rest = parts.filter((s) => !/готово/i.test(s));
    if (d.date) {
      /* дата позже «сегодня» демо (анализы сданы сегодня) — не показываем обновление из будущего */
      const dt = parseRuDate(d.date, yearOf(demo));
      const date = dt && dt > todayDate(demo) ? 'сегодня' : d.date;
      rest.push(rest.length < parts.length ? `обновлён ${date}` : date);
    }
    return rest.join(' · ');
  }

  /** Карточка разбора: если клиент уже записан — показываем запись, иначе — запись без оплаты (входит в заказ). */
  function reviewCard(ctx, orderId) {
    const { demo, ui, params } = ctx;
    const consult = RC.product(REVIEW_ID);
    const b = params.review === 'new' ? null : reviewBooking(demo);
    /* формат разбора — свойство продукта-консультации */
    const fmt = b ? bookingPlace(b) : consult ? RC.formatLabel(consult).toLowerCase() : 'онлайн';
    // специалист с сайта (PNG-вырез) вместо иллюстрации — как в hero главной; нет фото — прежняя иллюстрация
    const photo = consult && RC.photoFor ? RC.photoFor(consult) : null;
    const illu = photo && /\.png$/i.test(photo)
      ? `<div class="cb-cta__photo" aria-hidden="true"><img src="${esc(photo)}" alt=""></div>`
      : `<div class="cb-cta__illu">${RC.illu('consult-online', { tone: { bg: 'transparent', accent: '#C8B78A', accent2: '#EFF1EC' } })}</div>`;
    if (b) {
      return `<article class="cb-cta cb-cta--booked">
        <span class="cb-kick">${I('check', 14)}Входит в чек-ап</span>
        <h3 class="cb-cta__title">Вы записаны на разбор</h3>
        <p class="cb-cta__text">Объясним каждый показатель и составим персональный план</p>
        ${illu}
        <div class="cb-cta__slot">
          ${dateTile(b.date)}
          <div class="cb-cta__slot-main">
            <b><span class="num">${esc(b.time)}</span> · ${esc(fmt)}${consult && consult.duration ? ' · ' + esc(consult.duration) : ''}</b>
            <small>${isOnline(b) ? 'Ссылка придёт в Telegram' : 'Адрес и маршрут — в Telegram'}</small>
          </div>
        </div>
        <div class="cb-cta__btns">
          ${ui.btn('Перенести', { variant: 'white', size: 'sm', icon: 'clock', attrs: toast('Перенос записи', 'Администратор предложит свободное время в Telegram', 'calendar') })}
          ${ui.btn('Все записи', { variant: 'glass', size: 'sm', attrs: RC.link('orders', null, { 'orders.tab': 'active' }) })}
        </div>
      </article>`;
    }
    return `<article class="cb-cta">
      <span class="cb-kick">${I('stetho', 14)}Входит в чек-ап</span>
      <h3 class="cb-cta__title">Разбор результатов со специалистом</h3>
      <p class="cb-cta__text">Объясним каждый показатель и составим персональный план</p>
      ${consult && consult.duration ? `<span class="cb-cta__meta">${I('clock', 15)}${esc(consult.duration)} · ${esc(fmt)}</span>` : ''}
      ${illu}
      ${ui.btn('Записаться на разбор', { variant: 'white', icon: 'telegram', attrs: toast('Администратор предложит время', `в Telegram · разбор входит в чек-ап${orderId ? ' ' + orderId : ''}`, 'telegram') })}
    </article>`;
  }

  RC.register({
    id: 'results',
    title: 'Результаты анализов',
    short: 'Готовность, документы, показатели с референсами',
    note: 'Результаты чек-апа приходят прямо в Telegram: видно, что уже готово, какие показатели в норме, а какие стоит обсудить. Сразу под ними — запись на разбор со специалистом, который входит в чек-ап: клиент не теряется между лабораторией и врачом.',
    points: [
      'Готовность анализов в реальном времени: 24 из 31',
      'PDF-бланки лаборатории — скачать или переслать',
      'Показатели со шкалой: где значение относительно референса',
      'Отклонения подняты наверх и отмечены статусом',
      'Разбор со специалистом: дата записи и перенос прямо здесь',
      'Дисклеймер: результаты не являются диагнозом',
    ],
    examples: [
      { label: 'Чек-ап «Снижение веса»' },
      { label: 'Разбор не назначен', params: { review: 'new' } },
    ],
    render(ctx) {
      const { demo, ui, data } = ctx;
      const r = demo.results || { docs: [], markers: [], ready: 0, total: 1 };
      const p = RC.product(r.productId);
      const order = (demo.orders || []).find((o) => o.id === r.orderId);
      const eta = order && (order.steps || []).find((s) => !s.done);
      const etaDate = eta && parseRuDate(eta.d, yearOf(demo));
      const disc = ((data.clinic && data.clinic.disclaimers) || []).find((d) => d.id === 'interpretation');
      const discText = disc ? disc.text : 'Интерпретация результатов не является диагнозом. Диагноз ставит врач.';
      const cut = discText.indexOf('. ');
      const discLead = cut > 0 ? discText.slice(0, cut + 1) : discText;
      const discMore = cut > 0 ? discText.slice(cut + 2) : '';
      const markers = (r.markers || []).slice().sort((x, y) => (MARKER_ORDER[x.status] ?? 2) - (MARKER_ORDER[y.status] ?? 2));
      const flagged = markers.filter((m) => m.status !== 'ok').length;

      return `
        ${ui.appbar('Результаты анализов', { sub: `Чек-ап «${p ? p.title : ''}» · ${r.orderId || ''}` })}

        <section class="pad">
          <div class="cb-ready">
            <div class="cb-ready__top">
              <div>
                <span class="cb-ready__label">Готово</span>
                <b class="cb-ready__num num">${r.ready}<em> из ${r.total}</em></b>
              </div>
              <span class="cb-ready__ico">${I('flask', 26)}</span>
            </div>
            ${ui.progress(r.ready / (r.total || 1))}
            <p class="cb-ready__eta">${I('clock', 16)}Остальные придут до ${etaDate ? etaDate.getDate() + ' ' + MONTH_GEN[etaDate.getMonth()] : '18 сентября'} — пришлём уведомление</p>
          </div>
        </section>

        <section class="pad sec">
          ${ui.sectionHead('Документы')}
          <div class="cb-docs">${(r.docs || []).map((d) => `<div class="cb-doc">
            <span class="cb-doc__ico">${I('file', 20)}</span>
            <span class="cb-doc__main"><b>${esc(d.title)}</b><small class="num">${esc(docMeta(d, demo))}</small></span>
            <button class="cb-doc__btn" ${toast('Файл сохранён', d.title + ' · PDF', 'file')}>Скачать</button>
          </div>`).join('')}</div>
        </section>

        <section class="pad sec">
          ${ui.sectionHead('Показатели', { sub: flagged ? `${flagged} ${RC.plural(flagged, 'показатель', 'показателя', 'показателей')} стоит обсудить на разборе` : 'Все показатели в пределах референса' })}
          <div class="stack cb-mks">${markers.map(markerCard).join('')}</div>
        </section>

        <section class="pad sec">${reviewCard(ctx, r.orderId)}</section>

        <section class="pad sec">
          <div class="cb-disc">
            <p class="cb-disc__lead">${I('info', 18)}<span>${esc(discLead)}</span></p>
            ${discMore ? `<details class="cb-disc__more"><summary>Подробнее${I('chevD', 16)}</summary><p>${esc(discMore)}</p></details>` : ''}
          </div>
        </section>
        <div class="cb-bottom"></div>`;
    },
  });

  /* ----------------------------------------------------------- progress */

  function weightChart(pr, demo) {
    const ws = pr.weights || [];
    if (ws.length < 2) return '';
    const id = 'cbArea' + ++svgSeq;
    const W = 318, H = 196, L = 30, R = 10, T = 20, B = 30;
    const vs = ws.map((w) => w.v);
    const goal = pr.goalWeight;
    const lo = Math.floor(Math.min(goal != null ? goal : Infinity, ...vs) - 0.6);
    const hi = Math.ceil(Math.max(...vs) + 0.4);
    /* ось X — по датам замеров: интервалы 3 и 4 дня не выглядят одинаковыми */
    const offs = dayOffsets(ws, demo);
    const span = offs[offs.length - 1] || 1;
    const x = (i) => L + (offs[i] * (W - L - R)) / span;
    const y = (v) => T + ((hi - v) / (hi - lo)) * (H - T - B);
    const pts = vs.map((v, i) => [x(i), y(v)]);
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const mx = (x0 + x1) / 2;
      d += ` C${mx.toFixed(1)},${y0.toFixed(1)} ${mx.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
    }
    const base = H - B;
    const area = `${d} L${x(ws.length - 1).toFixed(1)},${base} L${L},${base} Z`;
    const step = hi - lo > 6 ? 2 : 1;
    const grid = [];
    for (let v = lo; v <= hi; v += step) grid.push(v);
    const [lx, ly] = pts[pts.length - 1];
    const label = `${kg(vs[vs.length - 1])} кг`;
    const bw = 70, bh = 28;
    const bx = Math.min(W - bw, lx - bw / 2);
    const above = ly - bh - 14;
    const by = above >= 0 ? above : ly + 16; // нет места сверху — подпись под точкой
    const xl = ws.map((w, i) => (i % 2 === 0 || i === ws.length - 1 ? i : -1)).filter((i) => i >= 0);

    return `<svg class="cb-chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="График веса: с ${kg(vs[0])} до ${kg(vs[vs.length - 1])} кг">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style="stop-color:#497259;stop-opacity:.26"/><stop offset="1" style="stop-color:#497259;stop-opacity:0"/>
      </linearGradient></defs>
      ${grid.map((v) => `<line class="cb-chart__grid" x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>
        <text class="cb-chart__y" x="0" y="${(y(v) + 4).toFixed(1)}">${v}</text>`).join('')}
      <path d="${area}" fill="url(#${id})"/>
      ${goal != null ? `<line class="cb-chart__goal" x1="${L}" x2="${W - R}" y1="${y(goal).toFixed(1)}" y2="${y(goal).toFixed(1)}"/>
        <text class="cb-chart__goal-t" x="${L + 6}" y="${(y(goal) - 7).toFixed(1)}">цель ${kgShort(goal)} кг</text>` : ''}
      <path class="cb-chart__line" d="${d}"/>
      ${pts.slice(0, -1).map(([px, py]) => `<circle class="cb-chart__pt" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3"/>`).join('')}
      <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="13" class="cb-chart__halo"/>
      <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="6" class="cb-chart__last"/>
      <rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw}" height="${bh}" rx="14" class="cb-chart__bubble"/>
      <text x="${(bx + bw / 2).toFixed(1)}" y="${(by + 18.5).toFixed(1)}" class="cb-chart__bubble-t">${label}</text>
      ${xl.map((i) => `<text class="cb-chart__x" x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="${i === 0 ? 'start' : i === ws.length - 1 ? 'end' : 'middle'}">${esc(ws[i].d)}</text>`).join('')}
    </svg>`;
  }

  RC.register({
    id: 'progress',
    title: 'Моя программа',
    short: 'Неделя программы, график веса, задачи на день',
    note: 'Экран сопровождения программы: клиент видит свою динамику, задачи на сегодня и куратора на связи. Видимый результат и ежедневные отметки удерживают в программе до конца — а это продления, повторные курсы и рекомендации друзьям.',
    points: [
      'Прогресс по неделям программы',
      'График веса с целью и последним замером',
      'Старт, текущий вес и цель — крупными цифрами',
      'Чек-лист дня: отметки прямо в приложении',
      'Куратор программы — написать в Telegram одной кнопкой',
      'Запись на замер, который входит в программу',
    ],
    examples: [
      { label: 'Неделя 3' },
      { label: 'Задачи дня выполнены', state: { program: { done: [0, 1, 2, 3] } } },
    ],
    render(ctx) {
      const { demo, ui } = ctx;
      const pr = prog(demo);
      const p = RC.product(pr.productId);
      const ws = pr.weights || [];
      const start = ws.length ? ws[0].v : null;
      const now = ws.length ? ws[ws.length - 1].v : null;
      const done = doneList(ctx);
      const today = pr.today || [];
      const nDone = today.filter((t, i) => done.includes(i)).length;
      const cur = pr.curator || {};
      const initials = String(cur.name || '').split(' ').map((w) => w[0] || '').join('').slice(0, 2);
      const left = pr.goalWeight != null && now != null ? now - pr.goalWeight : null;
      const weeksLeft = (pr.weeks || 0) - (pr.week || 0);
      const surname = String(cur.name || '').split(' ').pop();
      const member = (ctx.data.team || []).find((t) => surname && String(t.name).includes(surname));
      /* роль — из data.team (факт сайта), сокращаем до последней части: «Интегративный нутрициолог»;
         demo.curator.role — только если специалист не найден */
      const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
      const role = member && member.role ? cap(String(member.role).split(/,\s*/).pop()) : cap(cur.role);
      const curSub = [role, member && member.experience ? 'Опыт ' + member.experience : ''].filter(Boolean);
      const checkDt = parseRuDate(pr.nextCheck, yearOf(demo));
      const check = checkDt ? dayLabel(checkDt) : null;
      /* что происходит на замере — из состава программы в data («Замеры результатов на профессиональном аппарате») */
      const measure = p && (p.includes || []).find((x) => /замер/i.test(`${x.title} ${x.text}`));
      const checkText = measure
        ? `${String(measure.text).replace(/^Замеры/, 'Замер')} в клинике`
        : 'Замер результатов программы в клинике';

      return `
        ${ui.appbar('Моя программа', { sub: p ? p.title : '' })}

        <section class="pad">
          <article class="cb-week">
            <span class="cb-kick">${I('calendar', 14)}Старт ${esc(pr.startedLabel)}</span>
            <div class="cb-week__head">
              <h2 class="cb-week__title">Неделя ${pr.week} <em>из ${pr.weeks}</em></h2>
              <p class="cb-week__sub">${weeksLeft > 0 ? `${weeksLeft === 1 ? 'Осталась' : 'Осталось'} ${weeksLeft} ${RC.plural(weeksLeft, 'неделя', 'недели', 'недель')} — держим темп` : 'Финальная неделя программы'}</p>
            </div>
            <div class="cb-week__bar">
              ${ui.progress(pr.week / pr.weeks)}
              <div class="cb-week__ticks">${Array.from({ length: pr.weeks }, (_, i) => `<span class="${i < pr.week ? 'on' : ''}">${i + 1}</span>`).join('')}</div>
            </div>
          </article>
        </section>

        <section class="pad sec">
          ${ui.sectionHead('Вес', { sub: left != null && left > 0 ? `До цели осталось ${kg(left)} кг` : 'Цель достигнута' })}
          <div class="cb-chartcard">
            ${start != null && now != null ? `<div class="cb-chartcard__head">
              <b class="num">−${kg(start - now)} кг</b><span>с ${esc(pr.startedLabel)}</span>
            </div>` : ''}
            ${weightChart(pr, demo)}
          </div>
          <div class="cb-tiles mt-12">
            <div class="cb-tile"><span>Старт</span><b class="num">${start != null ? kg(start) : '—'}</b><small>кг</small></div>
            <div class="cb-tile cb-tile--now"><span>Сейчас</span><b class="num">${now != null ? kg(now) : '—'}</b><small>кг</small></div>
            <div class="cb-tile"><span>Цель</span><b class="num">${pr.goalWeight != null ? kgShort(pr.goalWeight) : '—'}</b><small>кг</small></div>
          </div>
        </section>

        <section class="pad sec">
          ${ui.sectionHead('Сегодня', { sub: `${nDone} из ${today.length} выполнено` })}
          <div class="cb-tasks">${today.map((t, i) => {
            const on = done.includes(i);
            return `<button class="cb-task${on ? ' on' : ''}" ${RC.act('cb-task', { i })} aria-pressed="${on}">
              <span class="cb-task__box">${on ? I('check', 16) : ''}</span>
              <span class="cb-task__t">${esc(t.t)}</span>
            </button>`;
          }).join('')}</div>
        </section>

        <section class="pad sec">
          ${ui.sectionHead('Куратор программы')}
          <div class="cb-curator">
            <div class="cb-curator__who" ${member ? RC.link('team', null, { 'team.selected': member.id }) : ''}>
              ${ui.avatar(initials, { size: 56, photo: member && RC.teamPhoto ? RC.teamPhoto(member.id) : null, name: cur.name })}
              <div class="cb-curator__main"><b>${esc(cur.name)}</b><small>${curSub.map((x) => `<span>${esc(x)}</span>`).join('')}</small></div>
            </div>
            ${ui.btn('Написать', { variant: 'dark', size: 'sm', block: true, icon: 'telegram', attrs: toast('Откроется чат в Telegram', cur.name ? 'Куратор — ' + cur.name : 'Куратор программы', 'telegram') })}
          </div>
        </section>

        <section class="pad sec">
          <article class="cb-next">
            ${check ? dateTile(check.iso, 'cb-date--white') : `<span class="cb-next__ico">${I('body', 24)}</span>`}
            <div class="cb-next__main">
              <small>Следующий замер</small>
              <b>${esc(check ? check.text : pr.nextCheck || '')}</b>
              <p>${esc(checkText)}</p>
            </div>
            <span class="cb-next__incl">${I('check', 15)}Замеры входят в программу</span>
            ${ui.btn('Записаться на замер', { variant: 'dark', block: true, icon: 'telegram', attrs: toast('Администратор предложит время', 'в Telegram · замер входит в программу', 'telegram') })}
          </article>
        </section>

        <div class="cb-disc-wrap">${ui.disclaimer()}</div>
        <div class="cb-bottom"></div>`;
    },
  });
})();
