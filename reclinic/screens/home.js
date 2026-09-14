/* Главная — витрина продаж. Эталон для остальных экранов:
   компоненты из RC.ui, данные через RC.product/RC.productsBy, навигация RC.link, действия RC.act.
   Каталог единый: онлайн- и очные услуги вместе, формат — свойство продукта (RC.formatLabel). */
(function () {
  const { esc, icon: I } = RC;

  const HERO = {
    id: 'consult-offline-diagnostic',
    kicker: 'С чего начать',
    kickerIcon: 'stetho',
    title: 'Диагностическая консультация с анализом состава тела',
    meta: 'Врач подберёт программу, пептид или курс капельниц',
    priceNote: 'бесплатно при покупке курса или программы',
    illu: 'consult-offline',
  };

  function pickHits() {
    const all = RC.productsBy({});
    const hits = all.filter((p) => p.badge === 'Хит');
    const rest = all.filter((p) => p.badge !== 'Хит' && p.price != null && p.price > 0 && p.category !== 'consultations');
    return hits.concat(rest).slice(0, 4);
  }

  function hero(ctx) {
    const p = RC.product(HERO.id);
    if (!p) return '';
    const photo = RC.photoFor && RC.photoFor(p);
    return `<article class="hero${photo ? ' hero--photo' : ''}" ${RC.link('product', { id: p.id })}>
      <span class="hero__kicker">${I(HERO.kickerIcon, 14)}${esc(HERO.kicker)}</span>
      <h2 class="hero__title">${esc(HERO.title)}</h2>
      <p class="hero__meta">${esc(HERO.meta)}</p>
      ${photo
        ? `<div class="hero__photo"><img src="${esc(photo)}" alt="" decoding="async"></div>`
        : `<div class="hero__illu">${RC.illu(HERO.illu, { tone: { bg: 'transparent', accent: '#C8B78A', accent2: '#EFF1EC' } })}</div>`}
      <div class="hero__foot">
        <div class="hero__price num">${RC.priceLabel(p)}<small>${esc(HERO.priceNote)}</small></div>
        ${ctx.ui.btn('Записаться', { variant: 'white', attrs: RC.link('booking', { id: p.id }) })}
      </div>
    </article>`;
  }

  function personal(ctx) {
    const { demo, ui } = ctx;
    const b = (demo.bookings || [])[0];
    const bp = b && RC.product(b.productId);
    const br = b && !b.online ? RC.branch(b.branch) : null;
    const day = b && RC.day(b.date);
    const o = (demo.orders || []).find((x) => x.status === 'active');
    const op = o && RC.product(o.items[0].id);
    if (!bp && !op) return '';
    const visit = bp ? `<article class="visit" ${RC.link('orders')}>
        <div class="visit__date"><b class="num">${day ? day.d : ''}</b><span>${day ? esc(day.dow) : ''}</span></div>
        <div class="visit__main">
          <b>${esc(bp.title)}</b>
          <small>${esc(b.time)} · ${esc(br ? br.name.replace('Re:clinic ', '') : 'онлайн')}</small>
        </div>
        ${br ? ui.iconBtn('route', RC.act('toast', { text: 'Маршрут в Яндекс Картах', sub: br.address, icon: 'route' }), { variant: 'white', label: 'Маршрут' }) : ''}
      </article>` : '';
    const done = o ? o.steps.filter((s) => s.done).length : 0;
    const status = op ? `<article class="status${visit ? ' mt-12' : ''}" ${RC.link('results')}>
        <div class="status__top"><b>Чек-ап «${esc(op.title)}»</b>${ui.badge(o.statusLabel, 'ok')}</div>
        ${ui.progress(done / o.steps.length)}
        <small>Шаг ${done} из ${o.steps.length} · результаты придут в кабинет</small>
      </article>` : '';
    return `<section class="pad sec">${ui.sectionHead('Мои записи', { link: 'Все', attrs: RC.link('orders') })}${visit}${status}</section>`;
  }

  function programs(ctx) {
    const { ui } = ctx;
    const list = RC.productsBy({ category: 'programs' }).filter((p) => p.id !== 'peptide-box' && p.price !== 0);
    if (!list.length) return '';
    return `<section class="pad sec">
      <div class="promo">
        <div class="promo__head">
          <h3 class="promo__title">Программы Re:clinic</h3>
          <p class="promo__text">Персональный план по вашим анализам: питание, БАДы, пептиды и сопровождение специалиста</p>
        </div>
        <div class="promo__rail">
          ${list.slice(0, 5).map((p) => `<article class="promo__card" ${RC.link('program', { id: p.id })}>
            <div class="promo__card-top">
              <span class="promo__who">${ui.avatar('Re', { size: 30 })}<b>Re:clinic</b></span>
              <span class="promo__meta">${p.duration ? esc(p.duration) + ' · ' : ''}<em>${esc(RC.formatLabel(p))}</em></span>
            </div>
            <h4>${esc(p.title)}</h4>
            <div class="tags">${(p.goals || []).slice(0, 3).map((g) => ui.tag(RC.goalTitle(g))).join('')}</div>
          </article>`).join('')}
        </div>
        <div class="promo__cta">${ui.btn('Подобрать программу', { variant: 'dark', attrs: RC.link('quiz') })}</div>
      </div>
    </section>`;
  }

  function rail(ctx, category, title) {
    const list = RC.productsBy({ category }).filter((p) => p.price != null).slice(0, 8);
    if (!list.length) return '';
    return `<section class="pad sec">
      ${ctx.ui.sectionHead(title, { link: 'Все', attrs: RC.link('catalog', null, { 'catalog.category': category, 'catalog.goal': null }) })}
      <div class="rail">${list.map((p, i) => ctx.ui.productCard(p, ctx, { variant: 'rail', illuVariant: i % 4 })).join('')}</div>
    </section>`;
  }

  function reviews(ctx) {
    const list = (ctx.data.reviews || []).filter((r) => r.metric || r.result).slice(0, 5);
    if (!list.length) return '';
    return `<section class="pad sec">
      ${ctx.ui.sectionHead('Результаты клиентов', { link: 'До/После', attrs: RC.link('beforeafter') })}
      <div class="rail">${list.map((r) => {
        const head = r.metric && String(r.metric).length <= 12 ? r.metric : (r.result || r.metric);
        const big = String(head).length <= 12;
        return `<article class="review" ${RC.link('beforeafter')}>
        <div class="${big ? 'review__metric num' : 'review__result'}">${esc(head)}</div>
        <p class="review__text">${esc(r.text)}</p>
        <p class="review__who">${esc(String(r.author || '').split(' ')[0])}${r.date ? ' · ' + esc(String(r.date).slice(-4)) : ''}</p>
      </article>`;
      }).join('')}</div>
    </section>`;
  }

  function clinic(ctx) {
    const { ui, data } = ctx;
    const rows = (data.branches || []).slice(0, 2).map((b) => ui.row({
      icon: 'pin', title: b.name, sub: [b.metro ? 'м. ' + b.metro : '', b.hours].filter(Boolean).join(' · '), attrs: RC.link('contacts'),
    }));
    rows.push(ui.row({ icon: 'telegram', tone: 'tg', title: 'Канал @resourceclinic', sub: 'Польза о здоровье и акции клиники', attrs: RC.act('toast', { text: 'Откроется канал в Telegram', icon: 'telegram' }) }));
    return `<section class="pad sec">${ui.sectionHead('Клиники и связь', { sub: 'Москва · консультации онлайн из любой страны' })}${ui.list(rows)}</section>`;
  }

  RC.register({
    id: 'home',
    title: 'Главная',
    short: 'Витрина: оффер, категории, хиты, программы',
    tabbar: 'home',
    note: 'Главная работает как магазин: сверху главный оффер с ценой и записью, ниже категории, хиты с покупкой в один тап, программы, персональные виджеты и результаты клиентов. Все услуги — в одном каталоге, формат (онлайн или в клинике) виден на карточке.',
    points: [
      'Имя и аватар — из Telegram, без регистрации',
      'Единый каталог: капельницы, чек-апы, консультации, программы, косметология',
      'Кнопка «+» на карточке сразу кладёт услугу в корзину',
      'Блок программ ведёт в подбор программы',
      'Ближайшая запись и статус чек-апа — прямо на главной',
    ],
    render(ctx) {
      const { ui, demo } = ctx;
      const cats = RC.categoriesFor();
      const hits = pickHits();
      return `
        <header class="hello">
          <div>
            <h1 class="hello__t">Привет, <span>${esc(demo.user.firstName)}</span></h1>
            <p class="hello__sub">Клиника превентивной медицины и биохакинга</p>
          </div>
          <button class="hello__avatar" ${RC.link('profile')} aria-label="Личный кабинет">${ui.avatar(demo.user.initials, { tg: true })}</button>
        </header>
        <section class="pad">${hero(ctx)}</section>
        <div class="pad mt-16">
          <button class="search" ${RC.link('catalog', null, { 'catalog.goal': null })}>${I('search', 20)}<span>Капельницы, чек-апы, консультации</span></button>
        </div>
        <div class="chips mt-12">${cats.map((c) => ui.chip(c.title, {
          icon: RC.CAT_ICON[c.id], attrs: RC.link('catalog', null, { 'catalog.category': c.id, 'catalog.goal': null }),
        })).join('')}</div>
        ${personal(ctx)}
        <section class="pad sec">
          ${ui.sectionHead('Хиты', { link: 'Каталог', attrs: RC.link('catalog', null, { 'catalog.category': 'all', 'catalog.goal': null }) })}
          <div class="pgrid">${hits.map((p, i) => ui.productCard(p, ctx, { illuVariant: i % 4 })).join('')}</div>
        </section>
        ${programs(ctx)}
        ${rail(ctx, 'iv', 'Капельницы под вашу цель')}
        ${rail(ctx, 'checkups', 'Чек-апы с консультацией')}
        ${reviews(ctx)}
        ${clinic(ctx)}
        ${ui.disclaimer()}`;
    },
  });
})();
