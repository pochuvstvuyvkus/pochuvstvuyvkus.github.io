/* Каталог — единый прилавок клиники: поиск, категории, цели, сортировка.
   Онлайн- и очные услуги вместе; формат — свойство продукта (RC.formatLabel).
   Раскладка зависит от категории: сетка для капельниц и чек-апов, строки для
   консультаций, программ и косметологии (с группировкой по разделам). */
(function () {
  const { esc, icon: I } = RC;

  const SORTS = [
    { id: 'popular', title: 'Популярные', short: 'Популярные', sub: 'Сначала хиты клиники', icon: 'star' },
    { id: 'cheap', title: 'Сначала дешевле', short: 'Дешевле', sub: 'По возрастанию цены', icon: 'tag' },
    { id: 'expensive', title: 'Сначала дороже', short: 'Дороже', sub: 'По убыванию цены', icon: 'chart' },
  ];
  const GRID = { iv: true, checkups: true };
  /* Промо «диагностическая консультация бесплатно с курсом» — там, где продаются курсы.
     В консультациях не показываем: рядом стоит сама услуга с ценой. */
  const PROMO_CATS = { all: true, iv: true, programs: true };
  const PROMO_AFTER = 4;

  /* Короткие подписи категорий — одна строка, по фактам сайта (category.description). */
  const CAT_LEAD = {
    iv: 'Авторские капельницы: энергия, детокс, кожа, вес',
    checkups: 'Набор анализов + консультация с разбором',
    consultations: 'Онлайн со специалистом или очный приём врача',
    programs: 'Вес на пептидах, курсы капельниц, anti-age и привычки',
    cosmetology: 'Процедуры для тела, инъекции и уход',
  };

  /* Разделы, где формат различается от услуги к услуге, — показываем его в подписи строки. */
  const FORMAT_CATS = { consultations: true, programs: true };

  /* Уточнения к числовой цене — из priceNote в data.js, чтобы цена не читалась как «всё включено». */
  const PRICE_NOTE = {
    'checkup-individual': { unit: '+ анализы', sub: 'Консультация по подбору анализов по симптомам' },
    'cosmo-botulinum': { unit: 'за единицу', sub: '' },
    'peptide-box': { unit: 'за разработку' },
    'consult-offline-diagnostic': { pill: 'бесплатно с курсом' },
  };

  /* Короткие подписи строк — сжатые факты из short в data.js, чтобы фраза целиком
     помещалась в 2 строки и не повторяла название. */
  const SUB = {
    'program-peptide-weight-loss': 'Пептид, капельницы и ведение врача',
    'program-weight-loss-online': 'Пептиды, привычки и контроль динамики',
    'program-support': 'Цели и контрольные точки',
    'program-antiage': 'Пептиды и биохакинг',
    'consult-offline-primary': 'Приём специалиста + состав тела',
    'consult-offline-endo': 'Первичный приём + состав тела',
    'consult-offline-diagnostic': 'Приём врача + анализ состава тела',
    'consult-online-express': '30 минут: причины сбоев и план',
    'consult-online-60': 'Разбор чек-апа и персональная стратегия',
    'consult-online-repeat': 'Специалист по здоровью и нутрициолог',
    'peptide-box': 'Консультация врача + состав тела',
  };

  /** Итог зависит от объёма (цена за единицу или «от») — в корзину из списка не кладём,
      ведём в карточку: там запись на консультацию к косметологу. Правило действует на всю
      группу (p.group): если в разделе есть хоть одна такая процедура, у всех строк раздела
      одинаковая кнопка «Подробнее» — не вперемешку «+» и стрелки. */
  const volumePriced = (p) => !!(p.priceFrom || /единиц|шт/i.test(p.priceNote || ''));
  const needsConsult = (p) => p.category === 'cosmetology' && (volumePriced(p)
    || (!!p.group && RC.productsBy({ category: 'cosmetology' }).some((x) => x.group === p.group && volumePriced(x))));

  /* Тона миниатюр в строках: иллюстрации одной категории одинаковы, чередуем фон из палитры RC.TONES. */
  const ROW_TONES = {
    cosmetology: ['blush', 'sand', 'sage', 'stone'],
    consultations: ['stone', 'sage', 'sand'],
    programs: ['sand', 'sage', 'stone'],
  };

  /* ---------------------------------------------------------- состояние */

  const cfg = (s) => {
    const c = s.catalog || {};
    return {
      category: c.category || 'all',
      goal: c.goal || null,
      sort: c.sort || 'popular',
      query: String(c.query || '').trim(),
    };
  };

  const matchQuery = (p, q) => {
    if (!q) return true;
    const needle = q.toLowerCase();
    // формат тоже ищется: «онлайн» находит все онлайн-услуги
    return [p.title, p.code, p.short, RC.formatLabel(p)].some((x) => x && String(x).toLowerCase().includes(needle));
  };

  const sortList = (list, sort) => {
    const idx = new Map(list.map((p, i) => [p.id, i]));
    const byIdx = (a, b) => idx.get(a.id) - idx.get(b.id);
    const out = list.slice();
    if (sort === 'cheap' || sort === 'expensive') {
      const k = sort === 'cheap' ? 1 : -1;
      out.sort((a, b) => {
        if (a.price == null && b.price == null) return byIdx(a, b);
        if (a.price == null) return 1;
        if (b.price == null) return -1;
        return (a.price - b.price) * k || byIdx(a, b);
      });
    } else {
      out.sort((a, b) => (b.badge === 'Хит') - (a.badge === 'Хит') || byIdx(a, b));
    }
    return out;
  };

  /** Выборка до фильтра по цели — из неё берутся чипы целей. */
  const baseList = (c) => RC.productsBy({ category: c.category }).filter((p) => matchQuery(p, c.query));
  const resultList = (c) => sortList(baseList(c).filter((p) => !c.goal || (p.goals || []).includes(c.goal)), c.sort);

  const goalsIn = (list) => {
    const n = {};
    list.forEach((p) => (p.goals || []).forEach((g) => { n[g] = (n[g] || 0) + 1; }));
    const order = (RC.data().goals || []).map((g) => g.id);
    return Object.keys(n).sort((a, b) => n[b] - n[a] || order.indexOf(a) - order.indexOf(b));
  };

  const services = (n) => `${n} ${RC.plural(n, 'услуга', 'услуги', 'услуг')}`;

  /* ------------------------------------------------ подписи без повторов */

  const roots = (text) => (String(text).toLowerCase().match(/[a-zа-яё]+/g) || [])
    .filter((w) => w.length >= 4)
    .map((w) => w.slice(0, Math.min(5, w.length - 1)));

  /** Фраза повторяет название, если половина её значимых слов — из названия. Фразы с цифрами — характеристики, оставляем. */
  const repeats = (phrase, title) => {
    if (/\d/.test(phrase)) return false;
    const t = roots(title);
    const w = roots(phrase);
    if (!w.length) return true;
    const hit = w.filter((r) => t.some((x) => x.startsWith(r) || r.startsWith(x))).length;
    return hit / w.length >= 0.5;
  };
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  function rowSub(p) {
    const note = PRICE_NOTE[p.id];
    if (note && note.sub != null) return note.sub;
    if (SUB[p.id]) return SUB[p.id];
    // повтор названия или заголовка группы («Процедура для тела» под «Тело») не показываем
    const fresh = (x) => x && !repeats(x, p.title) && !(p.group && repeats(x, p.group));
    const kept = String(p.short || '').split(' · ').map((x) => x.trim()).filter(fresh);
    if (kept.length) return cap(kept.join(' · '));
    return fresh(p.subtitle) ? cap(p.subtitle) : '';
  }

  /* ------------------------------------------------------------ действия */

  const setCategory = (s, id) => {
    s.catalog = Object.assign({ sort: 'popular' }, s.catalog, { category: id });
    const c = cfg(s);
    if (c.goal && !goalsIn(baseList(c)).includes(c.goal)) s.catalog.goal = null;
  };

  RC.actions['ct-cat'] = ({ id }, ctx) => { setCategory(ctx.state, id); };
  /** «Все N» внизу секции: новая категория открывается с начала списка. */
  RC.actions['ct-cat-top'] = ({ id }, ctx) => {
    setCategory(ctx.state, id);
    RC.go('catalog');
    return false;
  };
  RC.actions['ct-sort'] = ({ sort }, ctx) => {
    ctx.state.catalog = Object.assign({}, ctx.state.catalog, { sort });
    RC.proto.sheet = null;
  };
  RC.actions['ct-reset'] = (_, ctx) => {
    ctx.state.catalog = Object.assign({}, ctx.state.catalog, { category: 'all', goal: null, query: '' });
  };

  /* ------------------------------------------------------------ разметка */

  /** Уточнение к цене: «+ анализы», «за единицу» или песочная плашка «бесплатно с курсом». */
  function withPriceNote(card, shown) {
    const note = PRICE_NOTE[shown.id];
    if (!note || (!note.unit && !note.pill)) return card;
    const label = RC.priceLabel(shown);
    const extra = note.pill ? `<span class="ct-pill">${esc(note.pill)}</span>` : `<small>${esc(note.unit)}</small>`;
    return card.replace(`<div class="pcard__price">${label}</div>`, `<div class="pcard__price ct-price"><span>${label}</span>${extra}</div>`);
  }

  /** Слова с дефисом («RSL-скульптурирование», «Экспресс-консультация») не рвём на дефисе:
      обрывок «RSL-» в конце строки выглядит небрежно. */
  function keepHyphens(card, title) {
    if (!/\S-\S/.test(title)) return card;
    const html = String(title).split(' ').map((w) => (/\S-\S/.test(w) ? `<span class="ct-nw">${esc(w)}</span>` : esc(w))).join(' ');
    return card.replace(`<div class="pcard__title">${esc(title)}</div>`, `<div class="pcard__title">${html}</div>`);
  }

  /** Формат в начале подписи строки: «Онлайн · …», «В клинике · …» — онлайн- и очные
      консультации в одном списке различаются с первого взгляда. */
  function withFormat(card, p, sub) {
    if (!FORMAT_CATS[p.category]) return card;
    const fmt = `<b class="ct-fmt">${esc(RC.formatLabel(p))}</b>`;
    return card.replace(`<div class="pcard__sub">${esc(sub)}</div>`,
      `<div class="pcard__sub">${fmt}${sub ? ` · ${esc(sub)}` : ''}</div>`);
  }

  /** Карточка-строка: ui.productCard(row) + своя кнопка справа (в корзину или подробнее).
      Бейдж «Хит» — штатный .pcard__badge внутри миниатюры (включён в .ct-row). */
  function rowCard(p, ctx, i) {
    const tones = ROW_TONES[p.category];
    const shown = Object.assign({}, p,
      p.price == null ? { priceNote: 'Цена после подбора' } : {},
      tones ? { tone: tones[i % tones.length] } : {});
    const sub = rowSub(p);
    let card = ctx.ui.productCard(shown, ctx, { variant: 'row', illuVariant: i % 4, sub });
    card = withFormat(card, p, sub);
    card = withPriceNote(card, shown);
    card = keepHyphens(card, p.title);
    const inCart = RC.inCart(ctx.state, p.id);
    const side = p.price && !needsConsult(p)
      ? `<button class="ct-row__add${inCart ? ' is-in' : ''}" ${RC.act(inCart ? 'go-cart' : 'add', { id: p.id })} aria-label="${inCart ? 'Уже в корзине' : 'В корзину'}">${I(inCart ? 'check' : 'plus', 20)}</button>`
      : `<button class="ct-row__more" ${RC.link(RC.productScreen(p), { id: p.id })} aria-label="Подробнее">${I('chevR', 18)}</button>`;
    return `<div class="ct-row">${card}${side}</div>`;
  }

  function gridCard(p, ctx, i) {
    const note = PRICE_NOTE[p.id];
    const o = { illuVariant: i % 4 };
    if (note && note.sub != null) o.sub = note.sub;
    return keepHyphens(withPriceNote(ctx.ui.productCard(p, ctx, o), p), p.title);
  }

  /** Карточки списка; promo (если передано) встаёт после PROMO_AFTER-й карточки, если под ним
      остаётся минимум две — иначе в конце, чтобы одна карточка не оторвалась от списка. */
  function cards(cat, list, ctx, promoHtml) {
    const grid = !!GRID[cat];
    const items = list.map((p, i) => (grid ? gridCard(p, ctx, i) : rowCard(p, ctx, i)));
    if (promoHtml) {
      const at = items.length - PROMO_AFTER >= 2 ? PROMO_AFTER : items.length;
      items.splice(at, 0, `<div class="ct-promo-slot${at === items.length ? ' is-end' : ''}">${promoHtml}</div>`);
    }
    return `<div class="${grid ? 'pgrid' : 'ct-rows'}">${items.join('')}</div>`;
  }

  function header() {
    return `<header class="ct-head">
      <h1 class="ct-head__title">Каталог</h1>
      <p class="ct-head__sub">Все услуги клиники — онлайн и в клинике</p>
    </header>`;
  }

  function search(ctx, c) {
    return `<div class="pad"><label class="ct-search">
      ${I('search', 20, 'ct-search__ico')}
      <input type="search" value="${esc(c.query)}" data-bind="catalog.query" placeholder="NAD+, чек-ап, консультация" aria-label="Поиск по каталогу" autocomplete="off">
      ${c.query ? `<button class="ct-search__clear" ${RC.act('set', { 'catalog.query': '' })} aria-label="Очистить">${I('x', 16)}</button>` : ''}
    </label></div>`;
  }

  function categoryChips(ctx, c) {
    const all = RC.productsBy({}).filter((p) => matchQuery(p, c.query));
    const count = (n) => (c.query && !n ? null : n); // при поиске нули не показываем
    let cats = RC.categoriesFor();
    /* На доске и в статичном кадре mount() не запускается и ряд не прокручивается к выбранному
       чипу — ставим его сразу после «Все», чтобы выбор был виден на первом экране.
       В прототипе порядок постоянный, к чипу прокручивает mountChips. */
    if (!ctx.interactive && c.category !== 'all') {
      cats = cats.filter((x) => x.id === c.category).concat(cats.filter((x) => x.id !== c.category));
    }
    const chips = [ctx.ui.chip('Все', { on: c.category === 'all', icon: 'grid', count: count(all.length), attrs: RC.act('ct-cat', { id: 'all' }) })]
      .concat(cats.map((cat) => {
        const n = all.filter((p) => p.category === cat.id).length;
        const on = c.category === cat.id;
        if (c.query && !n && !on) return ''; // пустые по запросу разделы скрываем, выбранный — оставляем
        return ctx.ui.chip(cat.title, { on, icon: RC.CAT_ICON[cat.id], count: count(n), attrs: RC.act('ct-cat', { id: cat.id }) });
      }));
    return `<div class="chips ct-cats mt-12">${chips.join('')}</div>`;
  }

  function goalChips(ctx, c) {
    let goals = goalsIn(baseList(c));
    if (c.goal) goals = [c.goal].concat(goals.filter((g) => g !== c.goal)); // выбранная цель всегда видна
    if (!goals.length) return '';
    const chip = (label, on, attrs) => `<button class="ct-goal${on ? ' on' : ''}" ${attrs}>${on ? I('check', 15) : ''}<span>${esc(label)}</span></button>`;
    return `<div class="chips ct-goals mt-8">
      ${chip('Любая цель', false, RC.act('set', { 'catalog.goal': null }))}
      ${goals.map((g) => chip(RC.goalTitle(g), c.goal === g, RC.act('set', { 'catalog.goal': g }))).join('')}
    </div>`;
  }

  function toolbar(ctx, c, n) {
    const s = SORTS.find((x) => x.id === c.sort) || SORTS[0];
    return `<div class="pad ct-bar">
      <p class="ct-bar__count num">${c.category !== 'all' ? `${esc(RC.category(c.category).title)} <span>·</span> ` : ''}${services(n)}</p>
      <button class="ct-sort" ${RC.act('sheet-open', { key: 'sort' })}>${I('sliders', 18)}<span>${esc(s.short || s.title)}</span></button>
    </div>`;
  }

  function promo(ctx, c) {
    if (!PROMO_CATS[c.category]) return '';
    const p = RC.product('consult-offline-diagnostic');
    if (!p) return '';
    return `<article class="ct-promo" ${RC.link('product', { id: p.id })}>
      <span class="ct-promo__ico">${I('gift', 22)}</span>
      <div class="ct-promo__main">
        <b>Диагностическая консультация бесплатно</b>
        <small>при покупке курса капельниц, программы или пептид-бокса</small>
      </div>
      <span class="ct-promo__price num"><s>${RC.fmt(p.price)}</s><em>0 ₽</em><small>с курсом</small></span>
    </article>`;
  }

  function quizCta() {
    return `<section class="pad sec"><article class="ct-quiz" ${RC.link('quiz')}>
      <div class="ct-quiz__main">
        <h3>Не знаете, что выбрать?</h3>
        <p>Короткий тест о цели и самочувствии — подскажем программу и анализы</p>
      </div>
      ${RC.ui.btn('Пройти тест', { variant: 'white', size: 'sm', iconRight: 'arrowR', attrs: RC.link('quiz') })}
    </article></section>`;
  }

  function sectionsAll(ctx, c, list) {
    const promoHtml = promo(ctx, c);
    return RC.categoriesFor().map((cat) => {
      const items = list.filter((p) => p.category === cat.id);
      if (!items.length) return '';
      const lead = c.query ? '' : CAT_LEAD[cat.id] || '';
      return `<section class="pad sec ct-sec">
        <div class="ct-sec__head">
          <span class="ct-sec__ico">${I(RC.CAT_ICON[cat.id] || 'grid', 20)}</span>
          <h3 class="ct-sec__title">${esc(cat.title)}</h3>
          ${items.length > 4 ? `<button class="sec__link ct-sec__all num" ${RC.act('ct-cat-top', { id: cat.id })}>Все ${items.length}</button>` : ''}
        </div>
        ${lead ? `<p class="ct-sec__lead">${esc(lead)}</p>` : ''}
        <div class="ct-sec__body">${cards(cat.id, items.slice(0, 4), ctx)}</div>
      </section>`;
    }).filter(Boolean).map((html, i) => (i === 0 && promoHtml ? `${html}<div class="pad ct-promo-wrap">${promoHtml}</div>` : html)).join('');
  }

  function sectionCategory(ctx, c, list) {
    if (c.category === 'cosmetology' && list.some((p) => p.group)) {
      const groups = [];
      list.forEach((p) => {
        const g = p.group || 'Другое';
        let item = groups.find((x) => x.title === g);
        if (!item) groups.push((item = { title: g, items: [] }));
        item.items.push(p);
      });
      let seq = 0; // сквозной индекс — миниатюры не повторяются на стыке групп
      return groups.map((g, gi) => `<section class="pad ct-group${gi ? ' sec' : ''}">
        <div class="ct-group__head"><h3>${esc(g.title)}</h3><span class="num">${services(g.items.length)}</span></div>
        <div class="ct-rows">${g.items.map((p) => rowCard(p, ctx, seq++)).join('')}</div>
      </section>`).join('');
    }
    return `<section class="pad ct-list">${cards(c.category, list, ctx, promo(ctx, c))}</section>`;
  }

  /** Пустая выдача: текст называет настоящую причину — цель, раздел или сам запрос. */
  function emptyState(ctx, c) {
    const reset = (variant) => ctx.ui.btn('Сбросить фильтры', { variant, attrs: RC.act('ct-reset') });
    const inAll = c.category !== 'all' && c.query
      ? RC.productsBy({}).filter((p) => matchQuery(p, c.query) && (!c.goal || (p.goals || []).includes(c.goal))).length
      : 0;
    let text;
    let cta;
    if (c.goal && baseList(c).length) {
      // запрос (и раздел) что-то находят — пусто только из-за выбранной цели
      text = `С целью «${RC.goalTitle(c.goal)}» ${c.query ? `по запросу «${c.query}» ` : ''}ничего нет — посмотрите все цели`;
      cta = ctx.ui.btn('Любая цель', { variant: 'dark', attrs: RC.act('set', { 'catalog.goal': null }) }) + reset('ghost');
    } else if (inAll) {
      text = `В разделе «${RC.category(c.category).title}» по запросу «${c.query}» ничего нет — в других разделах нашли ${services(inAll)}`;
      cta = ctx.ui.btn('Искать во всех разделах', { variant: 'dark', attrs: RC.act('ct-cat', { id: 'all' }) }) + reset('ghost');
    } else {
      text = c.query
        ? `По запросу «${c.query}» услуг нет. Попробуйте другое слово — или сбросьте фильтры и посмотрите весь каталог`
        : 'Попробуйте другую цель — или сбросьте фильтры и посмотрите весь каталог';
      cta = reset('dark') + ctx.ui.btn('Подобрать с тестом', { variant: 'ghost', attrs: RC.link('quiz') });
    }
    return `<div class="ct-empty">${ctx.ui.empty('consult-online', 'Ничего не нашли', text, `<div class="ct-empty__cta">${cta}</div>`)}</div>`;
  }

  /* -------------------------------------------------------------- шторки */

  function sortSheet(ctx) {
    const c = cfg(ctx.state);
    return ctx.ui.sheet(`<div class="stack">${SORTS.map((s) => ctx.ui.option({
      title: s.title, sub: s.sub, icon: s.icon, on: c.sort === s.id, attrs: RC.act('ct-sort', { sort: s.id }),
    })).join('')}</div>`, { title: 'Сортировка' });
  }

  /* ------------------------------------------------------ живой поиск */

  let searchTimer = null;
  let refocus = false;

  function mountSearch(host) {
    const input = host.querySelector('.ct-search input');
    if (!input) return;
    if (refocus) {
      refocus = false;
      input.focus();
      const len = input.value.length;
      try { input.setSelectionRange(len, len); } catch (e) { /* type=search */ }
    }
    input.dataset.applied = input.value;
    /** Перерисовать выдачу под текущий текст поля. applied ставится ДО refresh:
        change, который Chromium шлёт при удалении поля в фокусе, тогда ничего не делает. */
    const apply = (keepFocus) => {
      clearTimeout(searchTimer);
      searchTimer = null;
      if (!input.isConnected || input.dataset.applied === input.value) return;
      RC.setPath(RC.proto.state, 'catalog.query', input.value);
      input.dataset.applied = input.value;
      refocus = keepFocus;
      RC.refresh();
    };
    // запрос пишется в state на каждый input (data-bind), выдача — после паузы
    input.addEventListener('input', (e) => {
      if (e.isComposing) return;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => apply(document.activeElement === input), 250);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      input.dataset.applied = ''; // Enter перерисовывает всегда — и оставляет курсор в поле
      apply(true);
    });
    /* change приходит на потерю фокуса — в том числе в mousedown по чипу или карточке.
       Перерисовка здесь удалила бы цель ещё до click, поэтому DOM не трогаем: запрос уже
       в state, нажатое действие само перерисует экран. Если тап пришёлся мимо кнопок
       (click дошёл до document) — применяем запрос после него. */
    input.addEventListener('change', (e) => {
      e.stopPropagation();
      clearTimeout(searchTimer);
      searchTimer = null;
      if (input.dataset.applied === input.value) return;
      const late = () => {
        document.removeEventListener('click', late);
        clearTimeout(fallback);
        if (document.activeElement !== input) apply(false);
      };
      const fallback = setTimeout(late, 1500);
      document.addEventListener('click', late);
    });
  }

  /** Ряд категорий после перерисовки — к выбранному чипу, если он за краем экрана. */
  function mountChips(host) {
    const on = host.querySelector('.ct-cats .chip.on');
    if (!on) return;
    const row = on.parentElement;
    const r = row.getBoundingClientRect();
    const b = on.getBoundingClientRect();
    if (b.right > r.right - 12 || b.left < r.left) row.scrollLeft += b.left - r.left - 20;
  }

  /* ------------------------------------------------------------- экран */

  RC.register({
    id: 'catalog',
    title: 'Каталог',
    short: 'Все услуги клиники: поиск, категории, цели, сортировка',
    tabbar: 'catalog',
    note: 'Каталог — полный прилавок клиники: все капельницы, чек-апы, консультации, программы и косметология с ценами с сайта, онлайн и в клинике в одном списке. Клиент за пару тапов сужает выбор по категории и цели и кладёт услугу в корзину прямо из списка — без звонка администратору.',
    points: [
      'Единый каталог: формат «Онлайн» или «В клинике» виден в строке услуги',
      'Поиск по названию, коду капельницы и формату: NAD+, DETOX, онлайн',
      'Цели показываются только те, что есть в текущей выборке — пустых фильтров нет',
      'Сортировка: хиты, сначала дешевле или дороже',
      'Промо бесплатной диагностической консультации ведёт к покупке курса',
      '«+» на карточке — услуга сразу в корзине',
    ],
    examples: [
      { label: 'Все услуги', state: { catalog: { category: 'all', goal: null } } },
      { label: 'Капельницы · Энергия', state: { catalog: { category: 'iv', goal: 'energy' } } },
      { label: 'Косметология', state: { catalog: { category: 'cosmetology', goal: null } } },
      { label: 'Консультации', state: { catalog: { category: 'consultations', goal: null } } },
      { label: 'Сортировка', state: { catalog: { category: 'iv', goal: null } }, sheet: 'sort' },
    ],
    sheets: { sort: sortSheet },
    render(ctx) {
      const c = cfg(ctx.state);
      const list = resultList(c);
      let body;
      if (!list.length) body = emptyState(ctx, c);
      else if (c.category === 'all') body = sectionsAll(ctx, c, list) + quizCta();
      else body = sectionCategory(ctx, c, list) + (c.category === 'programs' || c.category === 'consultations' ? quizCta() : '');
      return `<div class="ct${c.category === 'all' ? ' ct--all' : ''}">
        ${header()}
        ${search(ctx, c)}
        ${categoryChips(ctx, c)}
        ${goalChips(ctx, c)}
        ${list.length ? toolbar(ctx, c, list.length) : ''}
        ${body}
        ${list.length ? ctx.ui.disclaimer() : ''}
      </div>`;
    },
    mount(host) { mountChips(host); mountSearch(host); },
  });
})();
