/* О клинике: результаты клиентов (до/после + отзывы), команда специалистов, филиалы.
   Экраны доверия и навигации — каждый заканчивается продающим действием. */
(function () {
  const { esc, icon: I } = RC;

  /* ---------------------------------------------------------------- утилиты */

  const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{200D}]/gu;
  const clean = (s) => String(s || '').replace(EMOJI, '').replace(/[ \t]+\n/g, '\n').replace(/\n{2,}/g, '\n').trim();
  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const dateLabel = (s) => {
    const m = String(s || '').match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    return m ? `${+m[1]} ${MONTHS[+m[2] - 1]} ${m[3]}` : String(s || '');
  };
  const initials = (name) => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const lowerFirst = (s) => String(s || '').replace(/^./, (c) => c.toLowerCase());
  const upperFirst = (s) => String(s || '').replace(/^./, (c) => c.toUpperCase());
  /** Дисклеймер с собственным отступом (общий .disclaimer теряет margin-top из-за .app p). */
  const disc = (ui, t) => `<div class="cl-disc">${ui.disclaimer(t)}</div>`;
  /** Затухание низа у прокручиваемой области: липкий слой в конце контента. */
  const fade = (hidden) => `<span class="cl-fade" aria-hidden="true"${hidden ? ' hidden' : ''}></span>`;
  /** Подбор программы: количество вопросов теста (экран quiz). */
  const QUIZ_Q = 3;
  /** Неразрывный пробел после сокращения «г.» — «г. Москва» не рвётся на две строки. */
  const nb = (s) => String(s || '').replace(/(^|[\s(])г\. /g, '$1г. ');
  /** Прайсовая запись «приём врача + анализ» → фраза «приём врача и анализ». */
  const plusToAnd = (s) => String(s || '').replace(/\s+\+\s+/g, ' и ');
  /**
   * Плашка с цифрами нужна, только если добавляет данные к заголовку:
   * скрываем, когда все числа metric уже есть в result («49 кг за 3 месяца» при «Цель 49 кг … за 3 месяца»).
   */
  const NUM = /[−-]?\d+(?:,\d+)?/g;
  const nums = (s) => (String(s || '').match(NUM) || []).map((x) => x.replace('-', '−'));
  const extraMetric = (result, metric) => {
    if (!metric || metric === result) return '';
    const m = nums(metric);
    if (!m.length) return metric;
    const r = nums(result);
    return m.every((x) => r.includes(x)) ? '' : metric;
  };

  /* ============================================================ До / После */

  const TOPIC = { consultation: 'Консультация', checkup: 'Чек-ап' };
  /* strict — совпадение только в result/metric; иначе добираем отзывы с частыми упоминаниями в тексте. */
  const BA_FILTERS = [
    { id: 'all', label: 'Все' },
    { id: 'weight', label: 'Вес', strict: true, re: /кг|похуд|(^|[^а-яё])(вес|веса|весе|весу|весом)([^а-яё]|$)|тали[яи]|объём|объем|стройн/ },
    { id: 'skin', label: 'Кожа', strict: true, re: /кож|акне|высып|экзем|дерматит|прыщ/ },
    { id: 'gut', label: 'ЖКТ', re: /жкт|живот|вздут|(^|[^а-яё])стул|пищеварен|кишечн|гастр/ },
    { id: 'energy', label: 'Энергия', re: /энерги|бодрост|усталост|апати|(^|[^а-яё])сон([^а-яё]|$)|(^|[^а-яё])сна([^а-яё]|$)/ },
  ];
  const WEAK_HITS = 3;
  const headOf = (r) => `${r.result || ''} ${r.metric || ''}`.toLowerCase();

  /**
   * Релевантность: 3 — главная тема отзыва, 2 — тема упомянута в результате или цифрах,
   * 1 — тема часто упоминается в тексте, 0 — не подходит.
   */
  function score(r, fid) {
    const f = BA_FILTERS.find((x) => x.id === fid);
    if (!f || !f.re) return 2;
    const theme = themeOf(r);
    if (theme && theme.id === f.id) return 3;
    if (f.re.test(headOf(r))) return 2;
    if (f.strict) return 0;
    const hits = String(r.text || '').toLowerCase().match(new RegExp(f.re.source, 'g')) || [];
    return hits.length >= WEAK_HITS ? 1 : 0;
  }
  /** Фильтр с сортировкой по релевантности (внутри группы — исходный порядок). */
  const byFilter = (list, fid, get = (x) => x) => list
    .map((x, i) => ({ x, i, s: score(get(x), fid) }))
    .filter((o) => o.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((o) => o.x);
  /** Главная тема отзыва — та, что раньше всех упомянута в результате и цифрах. */
  const themeOf = (r) => {
    if (!r) return null;
    const h = headOf(r);
    return BA_FILTERS.filter((f) => f.re).map((f) => ({ f, at: h.search(f.re) })).filter((o) => o.at >= 0)
      .sort((a, b) => a.at - b.at)[0]?.f || null;
  };
  const activeFilter = (fid) => (fid && fid !== 'all' ? BA_FILTERS.find((f) => f.id === fid) || null : null);
  /** Тема карточки: при активном фильтре — сам фильтр, иначе главная тема отзыва. */
  const topicOf = (r, fid) => activeFilter(fid) || themeOf(r);

  const baState = (s) => Object.assign({ filter: 'all', open: [], limit: 6, photo: null }, s.ba || {});
  const reviewById = (ctx, id) => (ctx.data.reviews || []).find((r) => r.id === id) || null;

  /** Автор в едином формате «Имя Ф.». Имена берём из самих отзывов, фамилию-первым распознаём по окончанию. */
  let knownNames = null;
  function authorShort(name, ctx) {
    if (!knownNames) {
      knownNames = new Set();
      (ctx.data.reviews || []).forEach((r) => {
        const w = String(r.author || '').trim().split(/\s+/);
        if (w.length === 1 || (w[1] && w[1].replace('.', '').length <= 1)) knownNames.add(w[0]);
      });
    }
    const w = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (w.length < 2) return w[0] || '';
    let [a, b] = w;
    if (!knownNames.has(a) && (knownNames.has(b) || (/(ова|ева|ина|ская|цкая)$/.test(a) && a.length >= 9))) [a, b] = [b, a];
    return `${a} ${b.charAt(0).toUpperCase()}.`;
  }

  /* ---------------------------------------------------------- фото с сайта */

  const IMGS = () => window.RC_IMAGES || {};
  /** Имя без учёта регистра, «ё» и порядка слов: «Губайдуллина Лияна» = «Лияна Губайдуллина». */
  const normName = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').split(/\s+/).filter(Boolean).sort().join(' ');
  let slideByName = null;
  /** Фото отзыва из слайдера сайта: подпись «Имя Фамилия, дата» → автор отзыва (все слова имени совпадают). */
  function reviewPhoto(author) {
    if (!slideByName) {
      const list = IMGS().reviewSlides || [];
      if (!list.length) return null;
      slideByName = {};
      list.forEach((x) => {
        const key = normName(String(x.caption || '').replace(/,[^,]*$/, ''));
        if (key && !slideByName[key]) slideByName[key] = x.src;
      });
    }
    return slideByName[normName(author)] || null;
  }
  /** Общая галерея «до/после» с сайта; подписи и сроки уже вшиты в коллажи. */
  const galleryPhotos = () => (IMGS().beforeAfter || []).filter((x) => x && x.src);
  /** Плитки мозаики «Галерея»: разные истории, которых нет в ленте (номера коллажей сайта). */
  const MOSAIC = [13, 2, 16, 10];

  /** Коллаж «до/после». o.big — в шторке, o.mini — плитка галереи. Своих лейблов не кладём: они есть на фото. */
  function baMedia(src, o = {}) {
    const cls = ['cl-ba__media', o.big ? 'cl-ba__media--big' : '', o.mini ? 'cl-ba__media--mini' : ''].filter(Boolean).join(' ');
    return `<div class="${cls}">${src
      ? `<img src="${esc(src)}" alt="${esc(o.alt || 'Фото до и после')}">`
      : `<span class="cl-ba__empty">${I('sparkles', 24)}</span>`}</div>`;
  }
  const moreBtn = (id, open) =>
    `<button class="cl-rv__more" ${RC.act('cl-read', { id })}><span>${open ? 'Свернуть' : 'Читать полностью'}</span>${I('chevD', 16, open ? 'is-up' : '')}</button>`;

  function reviewCard(r, ctx) {
    const { ui } = ctx;
    const st = baState(ctx.state);
    const open = st.open.includes(r.id);
    const text = clean(r.text);
    const long = text.length > 230;
    const metric = extraMetric(r.result, r.metric);
    const flt = activeFilter(st.filter);
    const theme = themeOf(r);
    const topic = flt ? flt.label : TOPIC[r.topic] || (theme && theme.label) || '';
    /* отзыв со снимком из слайдера сайта — тег открывает шторку с фото */
    const photo = reviewPhoto(r.author);
    const tags = [
      topic ? ui.tag(topic, { tone: 'sage' }) : '',
      photo
        ? `<button class="cl-rv__ph" ${RC.act('cl-photo', { id: r.id })}><span class="cl-rv__thumb" style="background-image:url('${esc(photo)}')"></span>Фото до/после${I('chevR', 14)}</button>`
        : r.hasPhoto ? ui.tag('Фото до/после', { tone: 'sand', icon: 'sparkles' }) : '',
    ].filter(Boolean);
    const who = authorShort(r.author, ctx);
    return `<article class="cl-rv${open || !long ? ' is-open' : ''}">
      ${tags.length ? `<div class="cl-rv__top">${tags.join('')}</div>` : ''}
      <h3 class="cl-rv__res">${esc(r.result || r.metric || 'Отзыв клиента')}</h3>
      ${metric ? `<p class="cl-rv__metric">${I('chart', 16)}<span>${esc(metric)}</span></p>` : ''}
      <p class="cl-rv__text">${esc(text)}</p>
      ${long ? moreBtn(r.id, open) : ''}
      <footer class="cl-rv__who">
        <span class="cl-ava cl-ava--sm">${esc(initials(who))}</span>
        <span><b>${esc(who)}</b><small>${esc(dateLabel(r.date))}</small></span>
        ${I('quote', 22, 'cl-rv__q')}
      </footer>
    </article>`;
  }

  /**
   * «Читать полностью / Свернуть» — меняем DOM на месте, без перерисовки:
   * иначе шторка вставляется заново и проигрывает анимацию появления.
   */
  RC.actions['cl-read'] = ({ id }, ctx, el) => {
    const st = (ctx.state.ba = baState(ctx.state));
    const open = !st.open.includes(id);
    st.open = open ? st.open.concat(id) : st.open.filter((x) => x !== id);
    const box = el && el.closest && el.closest('.cl-ph, .cl-rv');
    if (!box) return undefined;
    box.classList.toggle('is-open', open);
    const lbl = el.querySelector('span');
    if (lbl) lbl.textContent = open ? 'Свернуть' : 'Читать полностью';
    const chev = el.querySelector('svg');
    if (chev) chev.classList.toggle('is-up', open);
    const body = box.querySelector('.cl-ph__body');
    if (body) {
      body.scrollTop = 0;
      const f = body.querySelector('.cl-fade');
      if (f) {
        f.hidden = true;
        f.hidden = !(open && body.scrollHeight > body.clientHeight + 2);
      }
    }
    return false;
  };
  RC.actions['cl-ba-more'] = (p, ctx) => {
    const st = (ctx.state.ba = baState(ctx.state));
    st.limit += 6;
  };
  RC.actions['cl-ba-filter'] = ({ id }, ctx) => {
    const st = (ctx.state.ba = baState(ctx.state));
    st.filter = id;
    st.limit = 6;
  };
  RC.actions['cl-photo'] = ({ id }, ctx) => {
    const st = (ctx.state.ba = baState(ctx.state));
    st.photo = id;
    RC.proto.sheet = 'photo';
  };

  const quizBtn = (ui, label, variant) => ui.btn(label, { variant, block: true, iconRight: 'arrowR', attrs: RC.link('quiz') });

  RC.register({
    id: 'beforeafter',
    title: 'Результаты клиентов',
    short: 'Фото до/после и отзывы с фильтром по цели',
    note: 'Социальное доказательство в одном месте: сравнения «до / после» и живые отзывы с конкретными цифрами. Клиент фильтрует истории по своей цели и сразу переходит в подбор программы — экран работает как прогрев перед покупкой.',
    points: [
      'Реальные фото до/после с сайта клиники — публикуются с согласия клиентов',
      'Галерея всех коллажей до/после в отдельной шторке, у отзывов с фото — переход к снимку',
      'Фильтр по цели: вес, кожа, ЖКТ, энергия — самые точные истории сверху',
      'Крупный результат и цифры в каждом отзыве',
      'Подбор программы — в середине ленты и в финале экрана',
    ],
    examples: [
      { label: 'Все результаты', state: { ba: { filter: 'all', open: [], limit: 6 } } },
      { label: 'Фильтр «Кожа», отзыв раскрыт', state: { ba: { filter: 'skin', open: ['rev-33'], limit: 6 } } },
      { label: 'Шторка фото', sheet: 'photo', state: { ba: { photo: 'rev-08' } } },
      { label: 'Галерея фото', sheet: 'gallery' },
    ],
    sheets: {
      photo(ctx) {
        const st = baState(ctx.state);
        const slides = (ctx.data.beforeAfter && ctx.data.beforeAfter.photoReviewSlides) || [];
        const fromSlide = (sl) => sl && { id: sl.reviewId, result: sl.result, metric: sl.metric, text: '', author: sl.author, date: sl.date };
        /* отзыв по id; без фото или без id — первый отзыв, для которого на сайте есть снимок */
        let r = reviewById(ctx, st.photo) || fromSlide(slides.find((x) => x.reviewId === st.photo));
        if (!r || !reviewPhoto(r.author)) {
          r = (ctx.data.reviews || []).find((x) => reviewPhoto(x.author)) || r || fromSlide(slides[0]);
        }
        if (!r) return '';
        const sl = slides.find((x) => x.reviewId === r.id) || {};
        const who = authorShort(r.author || sl.author, ctx);
        const result = r.result || sl.result || r.metric || 'Отзыв клиента';
        const text = clean(r.text);
        const long = text.length > 200;
        const open = long && st.open.includes(r.id);
        const metric = extraMetric(result, r.metric || sl.metric);
        return ctx.ui.sheet(`<div class="cl-ph${open ? ' is-open' : ''}">
          <div class="cl-ph__head">
            <span class="cl-ava cl-ava--sm">${esc(initials(who))}</span>
            <span class="cl-ph__who"><b>${esc(who)}</b><small>${esc(dateLabel(r.date || sl.date))}</small></span>
            <button class="cl-x" ${RC.act('sheet-close')} aria-label="Закрыть">${I('x', 18)}</button>
          </div>
          ${baMedia(reviewPhoto(r.author), { big: true, alt: `Фото до и после: ${who}` })}
          <h3 class="cl-ph__res">${esc(result)}</h3>
          ${metric ? `<p class="cl-rv__metric">${I('chart', 16)}<span>${esc(metric)}</span></p>` : ''}
          ${text ? `<div class="cl-ph__body"><p class="cl-ph__text">${esc(text)}</p>${long ? fade(!(open && text.length > 420)) : ''}</div>` : ''}
          ${long ? moreBtn(r.id, open) : ''}
          <div class="cl-ph__foot">${quizBtn(ctx.ui, 'Хочу такой же результат', 'dark')}</div>
        </div>`);
      },
      gallery(ctx) {
        const list = galleryPhotos();
        const n = list.length;
        if (!n) return '';
        const tiles = list.map((x, i) => baMedia(x.src, { mini: true, alt: `Фото до и после, история ${i + 1}` })).join('');
        return ctx.ui.sheet(`<div class="cl-gal">
          <div class="cl-gal__head">
            <span class="cl-gal__who"><b>Фото до и после</b><small class="num">${n} ${RC.plural(n, 'история', 'истории', 'историй')} · публикуются с согласия клиентов</small></span>
            <button class="cl-x" ${RC.act('sheet-close')} aria-label="Закрыть">${I('x', 18)}</button>
          </div>
          <div class="cl-gal__scroll"><div class="cl-gal__grid">${tiles}</div>${fade()}</div>
          <div class="cl-ph__foot">${quizBtn(ctx.ui, 'Хочу такой же результат', 'dark')}</div>
        </div>`);
      },
    },
    render(ctx) {
      const { ui, data } = ctx;
      const st = baState(ctx.state);
      const reviews = data.reviews || [];
      const ba = data.beforeAfter || {};
      /* лента — только истории, к которым нашёлся снимок из слайдера сайта */
      const allSlides = (ba.photoReviewSlides || []).map((sl) => Object.assign({}, sl, { src: reviewPhoto(sl.author) })).filter((sl) => sl.src);
      const slideReview = (sl) => reviewById(ctx, sl.reviewId) || { result: sl.result, metric: sl.metric, text: '' };
      const slides = byFilter(allSlides, st.filter, slideReview);
      const list = byFilter(reviews, st.filter);
      const shown = list.slice(0, st.limit);
      const gallery = galleryPhotos();
      const photoCount = gallery.length || ba.count || allSlides.length;
      const openGallery = RC.act('sheet-open', { key: 'gallery' });
      const mosaic = MOSAIC.map((n) => gallery[n - 1]).filter(Boolean);
      const tiles = (mosaic.length === 4 ? mosaic : gallery.slice(0, 4));

      /* плитка галереи при любом фильтре — лента не обрывается на одной карточке */
      const galleryTile = gallery.length ? `<button class="cl-ba cl-ba--all" ${openGallery}>
          <div class="cl-ba__media cl-ba__all">
            <div class="cl-ba__mosaic">${tiles.map((x) => `<span><img src="${esc(x.src)}" alt=""></span>`).join('')}</div>
            <span class="cl-ba__allbtn"><b class="num">Все ${photoCount}</b>${I('arrowR', 16)}</span>
          </div>
          <div class="cl-ba__body"><b>Галерея</b><small class="num">${photoCount} ${RC.plural(photoCount, 'история', 'истории', 'историй')} до и после</small></div>
        </button>` : '';

      const photos = slides.length ? `<section class="sec">
        <div class="pad">${ui.sectionHead('Фото до и после', { sub: 'Публикуются с согласия клиентов', link: `Все ${photoCount}`, attrs: openGallery })}</div>
        <div class="pad"><div class="rail cl-ba-rail">${slides.map((sl) => `<article class="cl-ba" ${RC.act('cl-photo', { id: sl.reviewId })}>
            ${baMedia(sl.src, { alt: `Фото до и после: ${authorShort(sl.author, ctx)}` })}
            <div class="cl-ba__body">
              <b>${esc(sl.result)}</b>
              <small>${esc(authorShort(sl.author, ctx))} · ${esc(dateLabel(sl.date))}</small>
            </div>
          </article>`).join('')}${galleryTile}</div></div>
      </section>` : '';

      const inlineCta = `<button class="cl-inl" ${RC.link('quiz')}>
          <span class="cl-inl__ico">${I('target', 20)}</span>
          <span class="cl-inl__main"><b>Хочу такой же результат</b><small>Короткий тест из ${QUIZ_Q} ${RC.plural(QUIZ_Q, 'вопроса', 'вопросов', 'вопросов')}</small></span>
          <span class="cl-inl__go">${I('arrowR', 18)}</span>
        </button>`;
      const cards = shown.map((r, i) => reviewCard(r, ctx) + (i === 2 && shown.length > 3 ? inlineCta : '')).join('');

      return `
        ${ui.appbar('Результаты клиентов', { sub: `${photoCount} фото до/после · ${reviews.length} ${RC.plural(reviews.length, 'отзыв', 'отзыва', 'отзывов')}` })}
        <div class="chips cl-chips">${BA_FILTERS.map((f) => ui.chip(f.label, {
          on: st.filter === f.id,
          count: byFilter(reviews, f.id).length,
          attrs: RC.act('cl-ba-filter', { id: f.id }),
        })).join('')}</div>
        ${photos}
        <section class="pad sec">
          ${ui.sectionHead('Отзывы', { sub: `${list.length} ${RC.plural(list.length, 'история', 'истории', 'историй')} клиентов` })}
          <div class="cl-rv-list">${cards}</div>
          ${list.length > shown.length ? `<div class="mt-12">${ui.btn(`Показать ещё ${Math.min(6, list.length - shown.length)}`, { variant: 'ghost', block: true, attrs: RC.act('cl-ba-more') })}</div>` : ''}
        </section>
        <section class="pad sec">
          <div class="cl-cta">
            <span class="cl-cta__kick">${I('target', 14)}Подбор за ${QUIZ_Q} ${RC.plural(QUIZ_Q, 'вопрос', 'вопроса', 'вопросов')}</span>
            <h3 class="cl-cta__title">Хотите такой же результат?</h3>
            <p class="cl-cta__text">Ответьте на короткий тест — подберём программу под вашу цель и анализы</p>
            ${quizBtn(ui, 'Подобрать программу', 'white')}
          </div>
        </section>
        ${disc(ui, 'Результаты индивидуальны. Имеются противопоказания, необходима консультация специалиста')}
        <div class="cl-bottom"></div>`;
    },
  });

  /* ============================================================ Команда */

  const GROUPS = [
    { id: 'founder', title: 'Основатели' },
    { id: 'doctor', title: 'Врачи', sub: 'Эндокринологи, диетологи, терапевты' },
    { id: 'consultant', title: 'Консультанты', sub: 'Нутрициологи: питание и образ жизни' },
  ];

  /** Корень строго с начала слова (whole — только слово целиком): «сна» не найдётся в «Комплексная». */
  const W = (alts, whole) => new RegExp(`(?:^|[^а-яё])(?:${alts})${whole ? '(?![а-яё])' : ''}`);
  /**
   * Теги направлений. core — ядро бизнеса, порядок массива = приоритет показа.
   * dup — тег не показываем, если он уже сказан в подписи карточки (профессии).
   */
  const TAG_RULES = [
    { t: 'Снижение веса', core: true, re: [W('вес|веса|весе|весу|весом', true), W('похуд|фигур|рекомпоз|жиров')] },
    { t: 'Эндокринология', core: true, re: [W('эндокрин|щитовидн')], dup: /эндокринолог/ },
    { t: 'Пептиды', core: true, re: [W('пептид')] },
    { t: 'Гормоны', core: true, re: [W('гормон')] },
    { t: 'Anti-age', core: true, re: [W('долголет|старени|молодост|антивозраст|возраст')], dup: /антивозраст/ },
    { t: 'ЖКТ', core: true, re: [W('жкт|пищеварит')] },
    { t: 'Кожа', core: true, re: [W('кож')] },
    { t: 'Энергия', core: true, re: [W('энерги')] },
    { t: 'Капельницы', re: [W('внутривен|капельниц|инфузи')] },
    { t: 'Сон', re: [W('сон|сна|сну|сном', true), W('циркад|сомнолог')], dup: /сомнолог/ },
    { t: 'Менопауза', re: [W('менопауз|перименопауз')] },
    { t: 'Пищевое поведение', re: [W('пищев[а-яё]* поведен'), W('аппетит')] },
    { t: 'Стресс', re: [W('стресс|усталост')] },
    { t: 'Иммунитет', re: [W('иммун')] },
    { t: 'Дети', re: [W('детск')] },
    { t: 'Сердце', re: [W('сердеч')] },
    { t: 'Беременность', re: [W('беремен')] },
    { t: 'Спорт', re: [W('спорт')], dup: /спорт/ },
    { t: 'Дефициты', re: [W('дефицит')] },
    { t: 'Детокс', re: [W('детокс')] },
    { t: 'Биохакинг', re: [W('биохак')] },
    { t: 'Метаболизм', re: [W('метабол|обмен[а-яё]* веществ')] },
    { t: 'Профилактика', re: [W('профилакт|превентив')], dup: /превентив/ },
  ];
  /** Все совпадения в порядке приоритета: { rule, phrase } — phrase = пункт areas, из которого взят тег. */
  const matchTags = (m) => TAG_RULES.map((rule) => {
    const phrase = (m.areas || []).find((a) => rule.re.some((re) => re.test(String(a).toLowerCase())));
    return phrase ? { rule, phrase } : null;
  }).filter(Boolean);

  /* Ширина ряда тегов на карточке: 350 − поля 28 − шеврон 18 − зазор 8. Ширина тега (12px, поля 10px) — по замерам Rubik. */
  const TAGS_W = 296, TAG_GAP = 5;
  const charW = (c) => (/[A-Za-z-]/.test(c) ? 6.2 : /[А-ЯЁ]/.test(c) ? 9 : c === ' ' ? 3.2 : 7);
  const tagW = (t) => 20 + [...t].reduce((a, c) => a + charW(c), 0);
  /** Отличительный тег — встречается не более чем у стольких специалистов. */
  const RARE_MAX = 3;

  /* Профессия из строки образования: «Эндокринология» → «эндокринолог». */
  const FIELD_PRO = { 'эндокринология': 'эндокринолог', 'андрология': 'андролог', 'диетология': 'диетолог', 'сомнология': 'сомнолог', 'гастроэнтерология': 'гастроэнтеролог', 'кардиология': 'кардиолог', 'превентивная медицина': 'врач превентивной медицины' };
  const proOf = (s) => {
    const low = String(s || '').toLowerCase().replace(/\s+(первой|второй|высшей)\s+категории/, '').trim();
    if (FIELD_PRO[low]) return FIELD_PRO[low];
    const head = low.split(/\s+/)[0];
    if (FIELD_PRO[head]) return FIELD_PRO[head];
    if (/^врач/.test(low) || /(лог|евт)$/.test(low)) return low;
    return null;
  };
  const SUB_MAX = 46;
  /** Подпись на карточке: врач — профессии из образования (до 3, коротко), консультант — квалификация из роли. */
  const cardSub = (m) => {
    if (m.group === 'doctor' && m.education && m.education.length) {
      const pros = [];
      /* «Гастроэнтеролог-нутрициолог» → две профессии, «Врач-терапевт» → «терапевт»: без переносов по дефису в узкой подписи */
      m.education.flatMap((e) => String(e).replace(/(^|[,;]\s*)врач-/gi, '$1').split(/\s*[,;]\s*|(?<=лог)-/i)).map(proOf).filter(Boolean).some((p) => {
        if (pros.includes(p)) return false;
        if (pros.length && (pros.length >= 3 || pros.concat(p).join(', ').length > SUB_MAX)) return true;
        pros.push(p);
        return false;
      });
      if (pros.length) return upperFirst(pros.join(', '));
    }
    if (m.group === 'consultant') {
      const tail = String(m.role || '').split(',').slice(1).join(',').trim();
      if (tail) return upperFirst(tail);
    }
    return upperFirst(m.cardRole || m.role || '');
  };

  let tagFreq = null;
  /**
   * Теги карточки: два главных направления по бизнес-приоритету + одно отличительное (редкое),
   * без повторов подписи; сколько помещается в одну строку, но не больше трёх.
   */
  function cardTagHits(m, team) {
    if (!tagFreq) {
      tagFreq = {};
      team.forEach((x) => matchTags(x).forEach(({ rule }) => { tagFreq[rule.t] = (tagFreq[rule.t] || 0) + 1; }));
    }
    const sub = cardSub(m).toLowerCase();
    const hits = matchTags(m).filter(({ rule }) => !(rule.dup && rule.dup.test(sub)));
    const core = hits.filter((h) => h.rule.core);
    const rare = hits.filter((h) => !h.rule.core).sort((a, b) => (tagFreq[a.rule.t] || 0) - (tagFreq[b.rule.t] || 0));
    const distinct = rare.filter((h) => (tagFreq[h.rule.t] || 0) <= RARE_MAX);
    const order = [...core.slice(0, 2), ...distinct, ...core.slice(2), ...rare.filter((h) => !distinct.includes(h))];
    const out = [];
    let w = 0;
    let rareUsed = 0;
    order.forEach((h) => {
      if (out.length >= 3) return;
      const isRare = !h.rule.core;
      /* отличительный тег — максимум один, пока в запасе есть главные */
      if (isRare && rareUsed >= 1 && out.length + core.filter((c) => !out.includes(c)).length >= 3) return;
      const add = tagW(h.rule.t) + (out.length ? TAG_GAP : 0);
      if (w + add > TAGS_W) return;
      out.push(h); w += add;
      if (isRare) rareUsed++;
    });
    return out;
  }
  /** Самопроверка для node: тег → фраза-источник (карточка и все совпадения). */
  RC.clTeamTagTrace = (m) => ({
    sub: cardSub(m),
    card: cardTagHits(m, RC.data().team || []).map((h) => `${h.rule.t} ← ${h.phrase}`),
    all: matchTags(m).map((h) => `${h.rule.t} ← ${h.phrase}`),
  });

  /** «Кулакова Екатерина Геннадьевна» → «Екатерина Кулакова». */
  const shortName = (m) => {
    const w = String(m.name || '').split(/\s+/);
    return w.length >= 3 ? `${w[1]} ${w[0]}` : m.name;
  };
  const expParts = (e) => {
    const n = parseInt(String(e || '').replace(/\D+/g, ' ').trim(), 10);
    if (!n) return null;
    const more = /более|больше/.test(e || '');
    return { n: more ? n + '+' : String(n), unit: RC.plural(n, 'год', 'года', 'лет') };
  };
  const minutes = (p) => String(p.duration || '').replace(/\s*мин.*$/, ' мин');

  /**
   * Запись из шторки специалиста — консультация по его профилю (каталог единый, формат — свойство продукта):
   * врач — очный приём (эндокринолога, если есть профиль);
   * консультант — онлайн-консультация: по данным сайта онлайн ведут специалисты по здоровью и нутрициологи;
   * основатель — лично не записываем, ведём на диагностическую консультацию с подбором специалиста.
   * Если у специалиста в данных указаны форматы (m.directions), они важнее группы.
   */
  const DIAG_ID = 'consult-offline-diagnostic';
  function memberOffer(m) {
    if (m.group === 'founder') {
      const p = RC.product(DIAG_ID);
      return p && { p, label: `Подобрать специалиста · ${RC.priceLabel(p)}`, specialist: null };
    }
    const ds = m.directions || [];
    const online = ds.length ? !ds.includes('offline') : m.group !== 'doctor';
    let p;
    if (online) {
      p = RC.product('consult-online-60') || RC.product('consult-online-express');
    } else {
      const endo = (m.education || []).some((x) => /эндокрин/i.test(x));
      p = (endo && RC.product('consult-offline-endo')) || RC.product('consult-offline-primary') || RC.product(DIAG_ID);
    }
    return p && { p, label: `Записаться · ${RC.priceLabel(p)}`, specialist: m.id };
  }

  /** Текст карточки «Не знаете, к кому записаться?» — своё предложение, без склейки title + short. */
  const DIAG_TEAM = 'Врач проведёт приём и анализ состава тела и подберёт специалиста под вашу цель';

  const ava = (m, cls = '') => `<span class="cl-ava cl-ava--${esc(m.group)}${cls ? ' ' + cls : ''}">${esc(initials(shortName(m)))}</span>`;

  RC.actions['cl-member'] = ({ id }, ctx) => {
    ctx.state.team = Object.assign({}, ctx.state.team || {}, { selected: id });
    RC.proto.sheet = 'member';
  };

  function memberCard(m, ctx) {
    const e = expParts(m.experience);
    return `<article class="cl-mc" role="button" tabindex="0" ${RC.act('cl-member', { id: m.id })}>
      <div class="cl-mc__top">
        ${ava(m)}
        <div class="cl-mc__main">
          <b>${esc(shortName(m))}</b>
          <small>${esc(cardSub(m))}</small>
        </div>
        ${e ? `<div class="cl-mc__exp"><b class="num">${esc(e.n)}</b><small>${esc(e.unit)} опыта</small></div>` : ''}
      </div>
      <div class="cl-mc__foot"><div class="cl-mc__tags">${cardTagHits(m, ctx.data.team || []).map((h) => ctx.ui.tag(h.rule.t)).join('')}</div>${I('chevR', 18, 'cl-mc__chev')}</div>
    </article>`;
  }

  function founders(list, ctx) {
    if (!list.length) return '';
    const withFact = (ctx.data.founders || []).map((f) => ({ f, fact: (f.facts || []).find((x) => /клиник/.test(x)) })).find((o) => o.fact);
    const text = 'Авторы системы превентивной медицины Re:clinic.' +
      (withFact ? ` ${String(withFact.f.name).split(' ')[0]} ${lowerFirst(withFact.fact)}` : '');
    return `<section class="pad sec">
      <div class="cl-fd">
        <span class="cl-fd__kick">${I('leaf', 14)}Основатели Re:clinic</span>
        <p class="cl-fd__text">${esc(text)}</p>
        <div class="cl-fd__grid">${list.map((m) => {
          const e = expParts(m.experience);
          return `<article class="cl-fd__card" role="button" tabindex="0" ${RC.act('cl-member', { id: m.id })}>
            ${ava(m, 'cl-ava--lg')}
            <b>${esc(shortName(m))}</b>
            <small>Со-основатель · ${esc(m.cardRole || '')}</small>
            ${e ? `<span class="cl-fd__exp num">${esc(e.n)} ${esc(e.unit)} опыта</span>` : ''}
          </article>`;
        }).join('')}</div>
      </div>
    </section>`;
  }

  /** Пункт экспертизы повторяет роль («…, интегративный нутрициолог» / «Интегративный нутрициолог»). */
  const repeatsRole = (m, x) => {
    const role = String(m.role || '').toLowerCase();
    const item = String(x || '').toLowerCase().trim();
    return !!item && role.split(/\s*,\s*/).some((part) => part === item);
  };

  RC.register({
    id: 'team',
    title: 'Специалисты',
    short: 'Команда: основатели, врачи, консультанты',
    note: 'Команда — главный аргумент доверия для превентивной медицины. Клиент видит опыт и направления каждого специалиста, открывает карточку с образованием и подходом и записывается на консультацию прямо из неё.',
    points: [
      'Разделы: основатели, врачи, консультанты',
      'На карточке — профессия, опыт и главные направления работы',
      'Шторка специалиста: образование, стажировки, подход',
      'Запись из карточки по профилю: врач — в клинике, нутрициолог — онлайн; специалист сохраняется в записи',
      'Фото добавляются из админ-панели, пока — инициалы',
    ],
    examples: [
      { label: 'Список' },
      { label: 'Карточка специалиста', sheet: 'member', state: { team: { selected: 'kulakovaekaterina' } } },
    ],
    sheets: {
      member(ctx) {
        const team = ctx.data.team || [];
        const sel = ctx.state.team && ctx.state.team.selected;
        const m = RC.teamMember(sel) || team.find((x) => x.group === 'doctor') || team[0];
        if (!m) return '';
        const e = expParts(m.experience);
        const offer = memberOffer(m);
        const sub = m.group === 'founder' ? upperFirst(m.role || m.cardRole || '') : cardSub(m);
        const creds = (m.credentials || []).filter((x) => !repeatsRole(m, x));
        const block = (title, items, icon) => items && items.length ? `<div class="cl-ms__block">
          <h4 class="cl-ms__h">${esc(title)}</h4>
          <ul class="cl-ms__list">${items.map((x) => `<li>${I(icon, 18)}<span>${esc(nb(x))}</span></li>`).join('')}</ul>
        </div>` : '';
        let foot = '';
        if (offer) {
          const { p } = offer;
          const set = { 'booking.productId': p.id, 'booking.specialist': offer.specialist };
          foot = `<div class="cl-ms__foot">
            ${ctx.ui.btn(offer.label, { variant: 'dark', block: true, icon: 'calendar', attrs: RC.link('booking', { id: p.id }, set) })}
            <p class="cl-ms__offer">${esc(p.title)} · ${esc(lowerFirst(RC.formatLabel(p)))}${p.duration ? ', ' + esc(minutes(p)) : ''}</p>
          </div>`;
        }
        return ctx.ui.sheet(`<div class="cl-ms">
          <button class="cl-x cl-ms__close" ${RC.act('sheet-close')} aria-label="Закрыть">${I('x', 18)}</button>
          <div class="cl-ms__head">
            ${ava(m, 'cl-ava--xl')}
            <div class="cl-ms__who">
              <h3>${esc(shortName(m))}</h3>
              <p>${esc(sub)}</p>
              ${e ? `<div class="tags">${ctx.ui.tag(`Опыт ${m.experience}`, { tone: 'sage', icon: 'clock' })}</div>` : ''}
            </div>
          </div>
          <div class="cl-ms__scroll">
            ${block('Образование', m.education, 'file')}
            ${block(m.group === 'doctor' ? 'Стажировки и преподавание' : 'Экспертиза', creds, 'star')}
            ${block('Направления работы', m.areas, 'check')}
            ${m.approach ? `<div class="cl-ms__approach">${I('quote', 20)}<div><h4 class="cl-ms__h">Подход</h4><p>${esc(nb(m.approach))}</p></div></div>` : ''}
            ${fade()}
          </div>
          ${foot}
        </div>`);
      },
    },
    render(ctx) {
      const { ui } = ctx;
      const team = ctx.data.team || [];
      const by = (g) => team.filter((m) => m.group === g);
      const doctors = by('doctor');
      const consultants = by('consultant');
      const maxExp = Math.max(0, ...team.map((m) => parseInt(String(m.experience || '').replace(/\D+/g, ' ').trim(), 10) || 0));
      const diag = RC.product(DIAG_ID);
      return `
        ${ui.appbar('Специалисты', { sub: `${team.length} ${RC.plural(team.length, 'специалист', 'специалиста', 'специалистов')} Re:clinic` })}
        <div class="pad">
          <div class="cl-stats">
            <div><b class="num">${doctors.length}</b><small>${RC.plural(doctors.length, 'врач', 'врача', 'врачей')}</small></div>
            <div><b class="num">до&nbsp;${maxExp}</b><small>${RC.plural(maxExp, 'года', 'лет', 'лет')} опыта</small></div>
            <div><b class="num">${consultants.length}</b><small>${RC.plural(consultants.length, 'консультант', 'консультанта', 'консультантов')} по&nbsp;питанию</small></div>
          </div>
        </div>
        ${founders(by('founder'), ctx)}
        ${GROUPS.filter((g) => g.id !== 'founder').map((g) => {
          const list = by(g.id);
          if (!list.length) return '';
          return `<section class="pad sec">
            ${ui.sectionHead(g.title, { sub: g.sub })}
            <div class="cl-mc-list">${list.map((m) => memberCard(m, ctx)).join('')}</div>
          </section>`;
        }).join('')}
        ${diag ? `<section class="pad sec">
          <div class="cl-help">
            <div class="cl-help__illu">${RC.illu('doctor', { tone: RC.TONES.sage })}</div>
            <h3 class="cl-help__title">Не знаете, к&nbsp;кому записаться?</h3>
            <p class="cl-help__text">${esc(DIAG_TEAM)}</p>
            ${ui.btn(`Подобрать специалиста · ${RC.priceLabel(diag)}`, { variant: 'dark', block: true, attrs: RC.link('booking', { id: diag.id }, { 'booking.productId': diag.id, 'booking.specialist': null }) })}
          </div>
        </section>` : ''}
        ${disc(ui)}
        <div class="cl-bottom"></div>`;
    },
  });

  /* ============================================================ Клиники */

  /* Точки карты (в координатах viewBox 350×230): метро и пин стоят на перекрёстках улиц. */
  const MAP_W = 350, MAP_H = 230;
  const MAPS = {
    mosfilm: { pin: [232, 92], metro: [46, 190], route: 'M46,190 L46,158 L112,158 L112,124 L186,124 L186,92 L232,92' },
    kosmo: { pin: [236, 150], metro: [46, 206], route: 'M46,206 L46,176 L152,176 L152,150 L236,150' },
  };

  /** Стилизованная карта квартала: сетка домов, улицы, пешеходный маршрут от метро. */
  function mapSVG(branchId) {
    const W = MAP_W, H = MAP_H;
    const kosmo = branchId === 'kosmo';
    const cfg = MAPS[kosmo ? 'kosmo' : 'mosfilm'];
    const cols = [0, 46, 112, 152, 186, 250, 300];
    const rows = kosmo ? [0, 150, 176, 206] : [0, 48, 92, 124, 158, 190];
    let blocks = '';
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < cols.length; c++) {
        const x = cols[c] + 5, y = rows[r] + 5;
        const w = (cols[c + 1] || W + 20) - cols[c] - 10;
        const h = (rows[r + 1] || H + 20) - rows[r] - 10;
        if (w < 8 || h < 8) continue;
        const park = !kosmo && ((r === 0 && c === 1) || (r === 1 && c === 1) || (r === 4 && c === 5) || (r === 5 && c === 5));
        const tone = park ? '#D9E4D5' : ((r + c) % 3 === 0 ? '#E6E8E1' : '#EDEEE8');
        blocks += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="${tone}"/>`;
        if (!park && w > 30 && h > 22 && (r * 7 + c) % 4 === 1) blocks += `<rect x="${x + 7}" y="${y + 7}" width="${Math.min(20, w - 14)}" height="${Math.min(14, h - 14)}" rx="4" fill="#F7F7F3"/>`;
        if (park && w > 30 && h > 22) blocks += `<circle cx="${x + w * 0.35}" cy="${y + h * 0.5}" r="5" fill="#C9D9C4"/><circle cx="${x + w * 0.65}" cy="${y + h * 0.42}" r="4" fill="#C9D9C4"/>`;
      }
    }
    const river = kosmo
      ? `<path d="M-20,58 C60,96 120,40 200,74 S320,120 380,96 L380,146 C320,160 270,122 200,120 S70,138 -20,106Z" fill="#D6E1E3"/>
         <path d="M-20,106 C70,138 130,116 200,120 S320,160 380,146" stroke="#fff" stroke-width="5" fill="none"/>
         <path d="M-20,58 C60,96 120,40 200,74 S320,120 380,96" stroke="#fff" stroke-width="5" fill="none"/>
         <path d="M20,88 C80,108 140,70 210,96" stroke="#fff" stroke-width="1.5" fill="none" opacity=".7" stroke-dasharray="2 7" stroke-linecap="round"/>`
      : '';
    const [px, py] = cfg.pin, [mx, my] = cfg.metro;
    return `<svg class="cl-map__svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" aria-hidden="true">
      <rect width="${W}" height="${H}" fill="#F7F7F3"/>
      ${blocks}${river}
      <path d="${cfg.route}" stroke="rgba(73,114,89,.22)" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${cfg.route}" stroke="#497259" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1 7"/>
      <circle cx="${mx}" cy="${my}" r="12" fill="#fff"/><circle cx="${mx}" cy="${my}" r="9" fill="#111013"/>
      <path d="M${mx - 4.5},${my + 3.5} V${my - 3.5} L${mx},${my + 1} L${mx + 4.5},${my - 3.5} V${my + 3.5}" stroke="#fff" stroke-width="1.6" fill="none" stroke-linejoin="round"/>
      <circle cx="${px}" cy="${py}" r="30" fill="rgba(73,114,89,.14)"/>
      <circle cx="${px}" cy="${py}" r="17" fill="rgba(73,114,89,.2)"/>
      <path d="M${px},${py + 2} c-4,-7 -14,-12 -14,-23 a14,14 0 0 1 28,0 c0,11 -10,16 -14,23z" fill="#111013"/>
      <circle cx="${px}" cy="${py - 21}" r="6" fill="#fff"/><circle cx="${px}" cy="${py - 21}" r="2.8" fill="#497259"/>
    </svg>`;
  }
  const pct = (v, total) => `${((v / total) * 100).toFixed(1)}%`;

  /** «бесплатно при покупке программы / пептид-бокса / курса капельниц (прайс); …» → аккуратная фраза. */
  const freeNote = (p) => {
    const raw = String((p && p.priceNote) || '').split(/\s*[(;]/)[0].trim();
    if (!raw) return '';
    const parts = raw.split(/\s*\/\s*/);
    const phrase = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} или ${parts[parts.length - 1]}` : raw;
    return upperFirst(phrase);
  };

  RC.register({
    id: 'contacts',
    title: 'Клиники',
    short: 'Филиалы: карта, маршрут, запись, связь',
    note: 'Всё, чтобы клиент дошёл до клиники без звонка администратору: карта с маршрутом от метро, режим работы, парковка и подсказка на ресепшене. Записаться в выбранный филиал можно прямо отсюда. Связь — в один тап: телефон, Telegram-бот, Max или WhatsApp. Юридическая информация и документы — внизу, для прозрачности.',
    points: [
      'Переключатель филиалов: Мосфильмовская и Космодамианская',
      'Маршрут и такси — сразу в Яндекс Картах и Яндекс Go',
      'Как дойти от метро, парковка, ориентиры',
      'Запись на диагностическую консультацию в этот филиал, рядом — переход к онлайн-консультациям',
      'Звонок и мессенджеры в один тап',
      'Реквизиты, лицензия партнёра и документы',
    ],
    examples: [
      { label: 'Мосфильмовская', state: { contacts: { branch: 'mosfilm' } } },
      { label: 'Космодамианская', state: { contacts: { branch: 'kosmo' } } },
    ],
    render(ctx) {
      const { ui, data, state } = ctx;
      const branches = data.branches || [];
      const cur = (state.contacts && state.contacts.branch) || (branches[0] && branches[0].id) || 'mosfilm';
      const b = RC.branch(cur);
      const clinic = data.clinic || {};
      if (!b) return ui.appbar('Клиники') + ui.empty('map', 'Филиалы скоро появятся', 'Мы обновляем информацию о клиниках');
      const map = MAPS[b.id] || MAPS.mosfilm;
      const walk = b.walk || {};
      const hoursTime = (String(b.hours || '').match(/\d{1,2}:\d{2}\s*[–-]\s*(\d{1,2}:\d{2})/) || [])[1] || '21:00';
      const walkMeta = [walk.time ? walk.time + ' пешком' : '', walk.distance].filter(Boolean).join(' · ');
      const notInText = (x) => x && !String(walk.text || '').includes(x);
      const landmarkTag = notInText(walk.landmark);
      const entranceTag = notInText(walk.entrance);
      const ms = b.messengers || {};
      const phoneSubs = ['Основной номер', 'Также в WhatsApp', 'Менеджер'];
      const doc = (title, sub) => ui.row({ icon: 'file', title, sub, attrs: RC.act('toast', { text: 'Документ откроется в Telegram', sub: title, icon: 'file' }) });
      const offer = (clinic.documents || []).find((d) => /офлайн/.test(d.title)) || { title: 'Публичная оферта' };
      const shortTitle = (t) => String(t).replace(/\s*\(.*\)\s*$/, '');
      const partner = clinic.partnerClinic && clinic.partnerClinic.branchId === b.id ? clinic.partnerClinic : null;
      const partnerBrands = (clinic.partners || []).filter((x) => x.license).map((x) => (String(x.name).match(/\(([^)]+)\)/) || [])[1]).filter(Boolean);
      const licenseRow = partner
        ? doc(`Лицензия партнёра ${String(partner.legalName).replace(/ «/g, ' «')}`, `№ ${partner.license}`)
        : doc('Лицензии медицинских партнёров', partnerBrands.join(', '));
      const diag = RC.product('consult-offline-diagnostic');
      const branchShort = b.shortName || b.name;

      const tiles = [
        ms.telegram && { cls: 'tg', mark: I('telegram', 20), t: 'Telegram', s: 'бот записи', toast: { text: 'Откроется бот Re:clinic', sub: '@Resource_clinicBot', icon: 'telegram' } },
        ms.max && { cls: 'max', mark: '<i>max</i>', t: 'Max', s: 'бот записи', toast: { text: 'Откроется бот в Max', sub: 'мессенджер Max', icon: 'chat' } },
        ms.whatsapp && { cls: 'wa', mark: I('chat', 20), t: 'WhatsApp', s: 'чат клиники', toast: { text: 'Откроется чат WhatsApp', sub: (clinic.whatsapp && clinic.whatsapp.display) || '', icon: 'chat' } },
      ].filter(Boolean);

      return `
        ${ui.appbar('Клиники', { sub: `${branches.length} ${RC.plural(branches.length, 'филиал', 'филиала', 'филиалов')} в Москве · без выходных` })}
        <div class="pad">${ui.seg(branches.map((x) => ({ value: x.id, label: x.shortName || x.name, sub: x.metro ? 'м. ' + x.metro : '' })), b.id, 'contacts.branch')}</div>

        <section class="pad mt-16">
          <div class="cl-map">
            ${mapSVG(b.id)}
            <span class="cl-map__open"><i></i>Открыто до ${esc(hoursTime)}</span>
            <span class="cl-map__metro" style="left:${pct(map.metro[0], MAP_W)};top:${pct(map.metro[1], MAP_H)}">м. ${esc(b.metro || '')}</span>
            <span class="cl-map__pin" style="left:${pct(map.pin[0], MAP_W)};top:${pct(map.pin[1], MAP_H)}">Re:clinic</span>
          </div>
        </section>

        <section class="pad mt-20">
          <h2 class="cl-br__name">${esc(b.name)}</h2>
          <p class="cl-br__addr">${esc(b.address)}</p>
          <div class="cl-br__facts"><span>${I('clock', 16)}${esc(b.hours || '')}</span></div>
          <div class="cl-br__cta">
            ${ui.btn('Построить маршрут', { icon: 'route', attrs: RC.act('toast', { text: 'Маршрут в Яндекс Картах', sub: b.address, icon: 'route' }) })}
            ${ui.btn('Такси', { variant: 'soft', attrs: RC.act('toast', { text: 'Такси до клиники в Яндекс Go', sub: b.address, icon: 'route' }) })}
          </div>
          ${b.arrivalNote ? `<div class="cl-note">${I('info', 20)}<p>${esc(b.arrivalNote)}</p></div>` : ''}
        </section>

        <section class="pad sec">
          ${ui.sectionHead('Как добраться')}
          <div class="cl-way">
            <div class="cl-way__metro">
              <span class="cl-m">М</span>
              <div><b>${esc(b.metro || '')}</b>${walkMeta ? `<small>${esc(walkMeta)}</small>` : ''}</div>
            </div>
            ${walk.text ? `<p class="cl-way__text">${esc(walk.text)}</p>` : ''}
            ${landmarkTag || entranceTag ? `<div class="tags">
              ${landmarkTag ? ui.tag(walk.landmark, { tone: 'sand', icon: 'pin' }) : ''}
              ${entranceTag ? ui.tag(walk.entrance, { tone: 'sand', icon: 'arrowR' }) : ''}
            </div>` : ''}
          </div>
          ${b.parking ? `<div class="mt-12">${ui.list([ui.row({
            lead: '<span class="lrow__ico cl-p">P</span>',
            title: `Парковка: ${String(b.parking.cityParking || '').toLowerCase()}`,
            sub: b.parking.text,
          })])}</div>` : ''}
        </section>

        ${diag ? `<section class="pad sec">
          <div class="cl-help cl-help--book">
            <div class="cl-help__illu">${RC.illu('consult-offline', { tone: RC.TONES.sage })}</div>
            <span class="cl-help__kick">${I('pin', 14)}${esc(branchShort)}</span>
            <h3 class="cl-help__title">Запишитесь на&nbsp;приём</h3>
            <p class="cl-help__text">${esc(diag.id === 'consult-offline-diagnostic'
              ? 'Врач проведёт приём и аппаратный анализ состава тела, а затем подберёт программу, пептиды или курс капельниц'
              : `${diag.title}: ${lowerFirst(plusToAnd(diag.short))}. Врач подберёт программу, пептиды или курс капельниц`)}</p>
            ${freeNote(diag) ? `<p class="cl-help__note">${I('gift', 18)}<span>${esc(freeNote(diag))}</span></p>` : ''}
            ${ui.btn(`Записаться в филиал · ${RC.priceLabel(diag)}`, { variant: 'dark', block: true, attrs: RC.link('booking', { id: diag.id }, { 'booking.productId': diag.id, 'booking.branch': b.id, 'booking.specialist': null }) })}
            <button class="cl-help__alt" ${RC.link('catalog', null, { 'catalog.category': 'consultations', 'catalog.goal': null })}>${I('globe', 16)}<span>Консультации также проходят онлайн — ссылка приходит в&nbsp;чат с&nbsp;ботом</span>${I('chevR', 16, 'cl-help__alt-go')}</button>
          </div>
        </section>` : ''}

        <section class="pad sec">
          ${ui.sectionHead('Связаться')}
          <div class="cl-msg">${tiles.map((x) => `<button class="cl-msg__t" ${RC.act('toast', x.toast)}>
            <span class="cl-msg__ico cl-msg__ico--${x.cls}">${x.mark}</span><b>${esc(x.t)}</b><small>${esc(x.s)}</small>
          </button>`).join('')}</div>
          <div class="mt-12">${ui.list((b.phones || []).map((p, i) => ui.row({
            icon: 'phone', title: p.display, sub: phoneSubs[i] || '',
            attrs: RC.act('toast', { text: 'Звонок в Re:clinic', sub: p.display, icon: 'phone' }),
          })).concat(ms.email ? [ui.row({
            lead: '<span class="lrow__ico cl-at">@</span>', title: ms.email, sub: 'Почта для документов и вопросов',
            attrs: RC.act('toast', { text: 'Откроется почта', sub: ms.email, icon: 'chat' }),
          })] : []))}</div>
        </section>

        <section class="pad sec">
          ${ui.sectionHead('Документы')}
          ${ui.list([
            doc(shortTitle(offer.title), offer.edition ? `редакция от ${offer.edition}` : ''),
            doc('Политика обработки персональных данных', 'по 152-ФЗ'),
            licenseRow,
          ])}
        </section>

        <section class="pad sec">
          <div class="cl-legal">
            <b>${esc(clinic.legalName || 'ООО «Пульс Жизни»')}</b>
            <p class="num">ИНН ${esc(clinic.inn || '')} · ОГРН ${esc(clinic.ogrn || '')}</p>
            <p>${esc(clinic.legalAddress || '')}</p>
            ${partner ? `<p>Медицинские услуги на площадке оказывает партнёр — ${esc(String(partner.legalName).replace(/ «/g, ' «'))}</p>` : ''}
          </div>
        </section>
        ${disc(ui)}
        <div class="cl-bottom"></div>`;
    },
  });
})();
