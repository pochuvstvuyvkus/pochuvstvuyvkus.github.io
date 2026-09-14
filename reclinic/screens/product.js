/* Карточка продукта — единый продающий шаблон.
   Разделы собираются по p.category: iv · checkups · consultations · cosmetology · programs.
   Все тексты — из data.js (факты сайта), без выдуманных цен и обещаний. */
(function () {
  const { esc, icon: I } = RC;
  const NB = ' ';

  /* ------------------------------------------------------------ утилиты */

  const cap = (s) => { s = String(s || '').trim(); return s ? s[0].toUpperCase() + s.slice(1) : ''; };
  const low = (s) => { s = String(s || '').trim(); return s ? s[0].toLowerCase() + s.slice(1) : ''; };
  const clean = (s) => String(s || '').replace(/\s*\([^)]*\)/g, '').replace(/^\*+\s*/, '').replace(/\s+/g, ' ').trim();
  const stripNum = (s) => String(s || '').replace(/^\s*\/?\d+[.)]?\s*/, '').trim();
  /** Предложения: точка/!/? и дальше заглавная буква («мед. образование», «т. к.» не режутся). */
  const sentences = (s) => String(s || '').trim().split(/(?<=[.!?])\s+(?=[А-ЯЁA-Z«])/).map((x) => x.trim()).filter(Boolean);
  const firstSentence = (s) => sentences(s)[0] || '';
  const noDot = (s) => String(s || '').replace(/(?<!т\. [дп])\.$/, '');
  const shortDur = (s) => String(s || '').replace(/\s*минут[аы]?$/i, ' мин').trim();
  const nbDur = (s) => String(s || '').replace(/(\d+)\s+(мин)/g, `$1${NB}$2`);
  const years = (s) => parseInt(String(s || '').replace(/\D+/g, ' ').trim(), 10) || 0;
  const digits = (s) => String(s || '').replace(/\D+/g, '');
  const sameDigits = (a, b) => !!digits(a) && digits(a) === digits(b);
  const listOr = (parts) => (parts.length > 1 ? parts.slice(0, -1).join(', ') + ' или ' + parts[parts.length - 1] : parts[0] || '');
  const isOnline = (p) => (p.directions || []).includes('online') && !(p.directions || []).includes('offline');
  /** Каталог единый: текст сайта «Онлайн: … Офлайн: …» описывает оба формата сразу —
      показываем одну подпись на оба (короткий пересказ тех же фактов), а не половину под выбранный режим. */
  const BOTH_SHORT = [
    [/анкет/i, 'Анкета о самочувствии и симптомах по всем системам организма'],
    [/нутрициолог[\s\S]*врач/i, `Онлайн${NB}— нутрициолог с${NB}мед. образованием, в${NB}клинике${NB}— терапевт, эндокринолог или гастроэнтеролог`],
  ];
  const bothFormats = (t) => {
    const m = clean(t).match(/^Онлайн:\s*(.+?)\s*Офлайн:\s*(.+)$/);
    if (!m) return brief(t);
    const hit = BOTH_SHORT.find(([re]) => re.test(t));
    return hit ? hit[1] : `Онлайн${NB}— ${low(noDot(m[1]))}; в${NB}клинике${NB}— ${low(noDot(m[2]))}`;
  };
  /** Минуты, названные в тексте: «60 минут» → [60], «от 30 до 60 минут» → [30, 60]. */
  const minutes = (s) => {
    const out = [];
    String(s || '').replace(/(\d+)(?:\s*(?:до|–|-)\s*(\d+))?\s*мин/gi, (m, a, b) => { out.push(+a); if (b) out.push(+b); return m; });
    return out;
  };

  /** Подпись шага — одна мысль до ~76 знаков: первое предложение; длиннее — до двоеточия, тире или последней запятой.
      Онлайн-формат информационный — «врач» в нём становится «специалистом». */
  function brief(s, o = {}) {
    const max = o.max || 76;
    let t = noDot(firstSentence(clean(s)));
    t = t.replace(/^Если (?:тело|диагностика) показывает необходимость,\s*/i, 'Если это нужно, ').replace(/\s+подробно\s+/g, ' ');
    if (o.online) t = t.replace(/(^|\s)врач(?=\s)/g, '$1специалист');
    if (t.length <= max) return cap(t);
    const cut = (i) => cap(t.slice(0, i).trim());
    const colon = t.indexOf(':');
    if (colon >= 24 && colon <= max) return cut(colon);
    const dash = t.lastIndexOf(' — ', max);
    if (dash >= 24) return cut(dash);
    const comma = t.lastIndexOf(', ', max);
    if (comma >= 24) return cut(comma);
    const and = t.lastIndexOf(' и ', max);
    return and >= 30 ? cut(and) : cap(t);
  }

  /** Тексты сайта для тарифа «Экспресс» называют его «ознакомительной консультацией»,
      а в приложении «Ознакомительная консультация» — отдельный товар на 60 минут. */
  const ownName = (p, s) => (/экспресс/i.test(p.title || '')
    ? String(s || '').replace(/(^|[^А-ЯЁа-яё])([Оо])знакомительн[а-яё]+\s+консультаци([а-яё])/g,
      (m, pre, o, end) => `${pre}${o === 'О' ? 'Э' : 'э'}кспресс-консультаци${end}`)
    : String(s || ''));

  /** Группы косметологии во множественном числе («Инъекционные методики») — под одной процедурой в единственном. */
  const GROUP_ONE = { 'Инъекционные методики': 'Инъекционная методика', 'Тело': 'Процедура для тела', 'Уход': 'Уход за лицом' };
  const cosmoSub = (x) => {
    if (x.subtitle) return x.subtitle;
    const short = String(x.short || '');
    return short && !short.toLowerCase().includes(String(x.title).toLowerCase()) ? short : (GROUP_ONE[x.group] || x.group || '');
  };

  /* цена */
  const isRange = (p) => p.price != null && !p.priceFrom && p.priceNote && /\d\s*\/\s*\d/.test(p.priceNote) && /₽/.test(p.priceNote);
  const priceText = (p) => (p.price == null ? 'Цена после подбора' : isRange(p) ? 'от ' + RC.fmt(p.price) : RC.priceLabel(p));
  const perUnit = (p) => /единиц|шт/i.test(p.priceNote || '');

  /** «…бесплатно при покупке программы / пептид-бокса / курса капельниц» → «при покупке программы, пептид-бокса или курса капельниц». */
  function freeWhat(raw) {
    let t = clean(String(raw || '').split(';')[0]);
    const sameDay = /в день консультации/i.test(t);
    t = t.replace(/\s+в день консультации/i, '');
    const m = t.match(/бесплатно при покупке\s+(.+)$/i) || t.match(/при покупке\s+(.+?)\s+(?:диагностическая\s+)?консультац/i);
    if (!m) return '';
    const what = m[1].replace(/\s+—.*$/, '').trim();
    return 'при покупке ' + listOr(what.split(/\s*\/\s*/)) + (sameDay ? ' в день консультации' : '');
  }

  function personName(t) {
    const w = String(t.name || '').trim().split(/\s+/);
    const display = w.length >= 3 ? `${w[1]} ${w[0]}` : w.join(' ');
    const initials = display.split(' ').map((x) => x[0] || '').join('').slice(0, 2).toUpperCase();
    return { display, initials, surname: w.length >= 3 ? w[0] : w[w.length - 1] };
  }

  /** Плашка «где» — формат самого продукта (p.directions), без режима приложения:
      только в клинике → «2 клиники в Москве» (или метро, если филиал один), только онлайн → «Онлайн», оба → «Онлайн или в клинике». */
  function where(p) {
    const dirs = p.directions || [];
    const online = dirs.includes('online');
    const offline = dirs.includes('offline') || !online;
    if (online && offline) return { icon: 'globe', v: 'Онлайн', s: 'или в клинике' };
    if (online) return { icon: 'globe', v: 'Онлайн', s: 'из любой страны' };
    if (p.branchIds && p.branchIds.length === 1) {
      const b = RC.branch(p.branchIds[0]);
      return { icon: 'pin', v: 'В клинике', s: b && b.metro ? b.metro : 'в Москве' };
    }
    const n = (RC.data().branches || []).length || 2;
    return { icon: 'pin', v: `${n} ${RC.plural(n, 'клиника', 'клиники', 'клиник')}`, s: 'в Москве' };
  }

  /* ---------------------------------------------------------- факты */

  function facts(p) {
    const out = [];
    const cat = p.category;
    if (cat === 'iv') {
      out.push({ icon: 'clock', v: shortDur(p.duration || '30–60 минут'), s: 'процедура', dur: true });
      out.push(where(p));
      out.push({ icon: 'stetho', v: 'Состав', s: 'подбирает врач' });
    } else if (cat === 'checkups') {
      const markers = (p.analyses || []).reduce((a, g) => a + (g.items || []).length, 0);
      const an = (String(p.composition || p.short || '').match(/(\d+)\s*анализ/) || [])[1];
      if (an && markers) out.push({ icon: 'flask', v: `${an} ${RC.plural(+an, 'анализ', 'анализа', 'анализов')}`, s: `${markers} ${RC.plural(markers, 'показатель', 'показателя', 'показателей')}` });
      else if (markers) out.push({ icon: 'flask', v: `${markers} ${RC.plural(markers, 'показатель', 'показателя', 'показателей')}`, s: 'в анализах' });
      const dm = String(p.duration || '').match(/(\d+)\s*минут/);
      if (dm) out.push({ icon: 'stetho', v: `${dm[1]}${NB}минут`, s: 'консультация', dur: true });
      else out.push({ icon: 'stetho', v: 'Консультация', s: 'по подбору анализов' });
      out.push(where(p));
    } else if (cat === 'consultations') {
      const online = isOnline(p);
      if (p.duration) out.push({ icon: 'clock', v: shortDur(p.duration), s: online ? 'по видеосвязи' : (/врач/i.test(p.specialist || '') ? 'приём врача' : 'очный приём'), dur: true });
      out.push(where(p));
      const txt = [p.subtitle, p.short, p.siteSubtitle].join(' ');
      const gift = (p.notes || []).some((n) => /состав[а-я]* тела.*в подарок/i.test(n));
      const noTests = (p.notes || []).some((n) => /без анализов/i.test(n));
      if (/состав[а-я]* тела/i.test(txt)) out.push({ icon: 'body', v: 'Состав тела', s: gift ? 'в подарок' : 'входит в цену' });
      else if (noTests) out.push({ icon: 'file', v: 'Анализы', s: 'не обязательны', key: 'tests' });
    } else if (cat === 'cosmetology') {
      out.push(where(p));
      out.push({ icon: 'stetho', v: 'Консультация', s: 'перед процедурой' });
    } else {
      if (p.duration) {
        const d = String(p.duration).split(/[,:]/);
        const rest = d[1] ? d[1].trim() : '';
        out.push({ icon: 'calendar', v: d[0].trim(), s: rest && rest.length <= 18 ? rest : (/процедур/.test(d[0]) ? 'в курсе' : 'длительность'), dur: true });
      }
      out.push(where(p));
      const doc = /врач/i.test((p.includes || []).map((x) => `${x.title} ${x.text}`).join(' '));
      out.push({ icon: 'stetho', v: 'Подбор', s: doc ? 'с врачом' : 'со специалистом' });
    }
    return out.filter(Boolean).slice(0, 3);
  }

  /* -------------------------------------------------------- секции */

  const sec = (ctx, title, inner, o = {}) =>
    `<section class="pad sec${o.cls ? ' ' + o.cls : ''}">${ctx.ui.sectionHead(title, o)}${inner}</section>`;

  /** Раскрытые аккордеоны живут в state.pd.open — перерисовка экрана их не закрывает. */
  const accOpen = (ctx, key, def) => {
    const o = (ctx.state.pd && ctx.state.pd.open) || {};
    return o[key] === undefined ? def : !!o[key];
  };
  const withKey = (html, key) => html.replace('<details class="acc"', `<details data-pd-acc="${esc(key)}" class="acc"`);

  function steps(list) {
    return `<ol class="pd-steps">${list.map((s, i) => `<li class="pd-step">
      <span class="pd-step__n num">${i + 1}</span>
      <div class="pd-step__main"><b>${esc(s.t)}</b>${s.d ? `<p>${esc(s.d)}</p>` : ''}</div>
    </li>`).join('')}</ol>`;
  }

  function checks(items) {
    return `<ul class="pd-checks">${items.map((t) => `<li><span class="pd-checks__i">${I('check', 15)}</span><span>${esc(t)}</span></li>`).join('')}</ul>`;
  }

  function faqSec(ctx, p, list, title) {
    if (!list.length) return '';
    return sec(ctx, title || 'Частые вопросы', `<div class="pd-faq">${list.map((f, i) => {
      const key = `${p.id}:faq:${i}`;
      return withKey(ctx.ui.acc(f.q, f.a, accOpen(ctx, key, i === 0)), key);
    }).join('')}</div>`);
  }

  function pickFaq(pool, patterns, n) {
    const out = [];
    patterns.forEach((re) => { const f = pool.find((x) => x && x.a && re.test(x.q) && !out.includes(x)); if (f) out.push(f); });
    pool.forEach((x) => { if (out.length < n && x && x.a && !out.includes(x)) out.push(x); });
    return out.slice(0, n);
  }

  function railSec(ctx, title, list, link, sub) {
    if (!list.length) return '';
    return sec(ctx, title, `<div class="rail">${list.map((x, i) => ctx.ui.productCard(softTitle(x), ctx, { variant: 'rail', illuVariant: i % 4, sub: sub ? sub(x) : undefined })).join('')}</div>`, link || {});
  }

  /** Длинные слова не влезают в карточку ленты (158px): мягкий перенос по границе основы, без автопереносов браузера. */
  const SOFT = [[/Коллагеностимуляц/g, 'Коллагено­стимуляц'], [/Биоревитализац/g, 'Био­ревитализац'], [/Мезотерапи/g, 'Мезо­терапи']];
  const softTitle = (x) => {
    const t = SOFT.reduce((s, [re, r]) => s.replace(re, r), String(x.title || ''));
    return t === x.title ? x : Object.assign({}, x, { title: t });
  };

  function related(p, category, n) {
    const goals = p.goals || [];
    const seen = new Set([String(p.title).toLowerCase()]);
    return RC.productsBy({ category })
      .filter((x) => x.id !== p.id)
      .map((x) => ({ x, score: (x.goals || []).filter((g) => goals.includes(g)).length + (p.group && x.group === p.group ? 2 : 0) }))
      .filter((o) => o.score > 0)
      .sort((a, b) => b.score - a.score)
      .filter((o) => { const k = String(o.x.title).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, n)
      .map((o) => o.x);
  }

  function perks(p, o = {}) {
    const src = [];
    if (p.priceNote && /бесплатно/i.test(p.priceNote)) src.push(p.priceNote);
    (p.notes || []).forEach((n) => { if (/бесплатно|без анализов|в подарок|сразу в день/i.test(n)) src.push(n); });
    const seen = {};
    const out = [];
    src.forEach((raw) => {
      const t = clean(raw);
      let icon = 'info';
      let key = '';
      if (/бесплатно/i.test(t)) { icon = 'gift'; key = 'free'; }
      else if (/без анализов/i.test(t)) { icon = 'file'; key = 'tests'; }
      else if (/в подарок/i.test(t)) { icon = 'body'; key = 'gift-body'; }
      else if (/сразу в день/i.test(t)) { icon = 'calendar'; key = 'start'; }
      if (seen[key] || (o.only && !o.only.includes(key))) return;
      seen[key] = true;
      let title = t;
      let sub = '';
      const free = key === 'free' ? freeWhat(raw) : '';
      if (free) {
        title = 'Консультация врача бесплатно';
        sub = free;
      } else {
        const parts = t.split(/\s*;\s*|\s+—\s+/);
        if (parts.length > 1) { title = parts[0]; sub = parts.slice(1).join(', '); }
      }
      out.push({ icon, title: cap(title), sub: low(sub) });
    });
    return out.slice(0, o.max || 3);
  }

  function perksHTML(list) {
    if (!list.length) return '';
    return `<div class="pd-perks">${list.map((x) => `<div class="pd-perk">
      <span class="pd-perk__i">${I(x.icon, 20)}</span>
      <span class="pd-perk__main"><b>${esc(x.title)}</b>${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</span>
    </div>`).join('')}</div>`;
  }

  /* --------------------------------------------------------- IV */

  /** Шаг из ivIntro.procedure.steps → единая пара «заголовок + подпись» из тех же фактов. */
  function ivStep(raw) {
    const s = String(raw || '').trim();
    let m;
    if (/^Консультация с врачом/i.test(s)) return { t: 'Консультация врача', d: 'Подбор состава с учётом анализов и целей' };
    if ((m = s.match(/^(.+?),\s*установка катетера$/i))) return { t: 'Установка катетера', d: /кресл/i.test(m[1]) ? 'Вы удобно располагаетесь в кресле' : cap(m[1]) };
    if ((m = s.match(/^Введение раствора\s*\(([^)]+)\),?\s*во время которого\s+(.+)$/i))) return { t: 'Введение раствора', d: nbDur(`${m[1]} — ${m[2]}`) };
    if ((m = s.match(/^Завершение:\s*(.+?),\s*пациент отдыхает\s+(.+)$/i))) return { t: 'Отдых', d: `${cap(m[1])}, ${m[2]} на${NB}отдых` };
    if ((m = s.match(/^([^:]{3,40}):\s*(.+)$/))) return { t: m[1], d: cap(m[2]) };
    return { t: s, d: '' };
  }

  function ivSections(p, ctx) {
    const { ui, data } = ctx;
    const iv = data.ivIntro || {};
    const proc = iv.procedure || {};
    let html = '';

    if ((p.benefits || []).length) {
      html += sec(ctx, 'Эффекты', `<div class="pd-card pd-card--sage">${checks(p.benefits)}</div>`);
    }

    const procSteps = (p.includes && p.includes.length)
      ? p.includes.map((x) => ({ t: stripNum(x.title), d: brief(x.text) }))
      : (proc.steps || []).map(ivStep);
    if (procSteps.length) html += sec(ctx, 'Как проходит процедура', steps(procSteps));

    const course = RC.product('program-iv-course');
    if (course) {
      const free = (course.notes || []).find((n) => /бесплатно/i.test(n));
      // частота — из course.duration («3–10 процедур, от 1 раза в неделю до 1 раза в месяц»): число процедур уже в заголовке
      const freq = cap(String(course.duration || '').split(',').slice(1).join(',').trim());
      const courseText = freq
        ? `${freq}${NB}— схему подберёт врач`
        : firstSentence(String(iv.course || course.description || '').replace(/^Всё зависит от целей\.\s*/, ''));
      html += `<section class="pad sec">
        <article class="pd-course" ${RC.link('product', { id: course.id })}>
          <div class="pd-course__top">
            <span class="pd-course__kicker">${I('leaf', 14)}Курс капельниц</span>
            <span class="pd-course__price num">${esc(course.price == null ? 'Цена после подбора' : RC.priceLabel(course))}</span>
          </div>
          <h3 class="pd-course__title">${esc(`Курсом эффективнее${NB}— 3–10${NB}процедур`)}</h3>
          <p class="pd-course__text">${esc(courseText)}</p>
          ${free ? `<p class="pd-course__perk">${I('gift', 18)}<span>${esc(cap(clean(free)))}</span></p>` : ''}
          ${ui.btn('Подробнее о курсе', { variant: 'white', block: true, iconRight: 'arrowR', attrs: RC.link('product', { id: course.id }) })}
        </article>
      </section>`;
    }

    html += railSec(ctx, 'С этим берут', related(p, 'iv', 6), { link: 'Все', attrs: RC.link('catalog', null, { 'catalog.category': 'iv', 'catalog.goal': null }) });

    // «Сколько длится курс» не берём — это уже сказано в апселле курса
    const faq = pickFaq(((data.faq || {}).iv || []).filter((f) => !/длится курс/i.test(f.q)), [/быстро ощущается/i, /противопоказания/i, /сдавать анализы/i, /побочные эффекты/i], 4);
    html += faqSec(ctx, p, faq);
    return html;
  }

  /* ------------------------------------------------------ чек-апы */

  const GET_ICON = [[/анализ/i, 'flask'], [/консультац/i, 'stetho'], [/рекомендац/i, 'file'], [/программ/i, 'route'], [/анкет/i, 'file'], [/подбор|расч/i, 'percent'], [/процедур|катетер|капельниц/i, 'drop'], [/отдых/i, 'clock']];
  const getIcon = (t) => (GET_ICON.find(([re]) => re.test(t)) || [0, 'check'])[1];
  /** Короткие подписи для типовых карточек чек-апа — пересказ текстов data.js в одну-две строки. */
  const GET_SHORT = [
    [/^Результаты анализов/i, 'Комплексная оценка здоровья под ваш запрос'],
    [/^Итоговые рекомендации/i, `Разбор показателей и${NB}рекомендации по${NB}профилактике в${NB}чат`],
    [/программа сопровождения/i, 'Презентация с программой под ваши цели и задачи'],
  ];
  const getText = (x) => (GET_SHORT.find(([re]) => re.test(x.title)) || [0, brief(x.text)])[1];

  function checkupSections(p, ctx) {
    const { data } = ctx;
    const numbered = (p.includes || []).length && /^\s*\d/.test(p.includes[0].title);
    const groups = p.analyses || [];
    let html = '';

    if ((p.includes || []).length && !numbered) {
      html += sec(ctx, 'Что вы получите', `<div class="pd-gets">${p.includes.map((x) => `<article class="pd-get">
        <span class="pd-get__i">${I(getIcon(x.title), 22)}</span>
        <div class="pd-get__main"><b>${esc(x.title)}</b><p>${esc(getText(x))}</p></div>
      </article>`).join('')}</div>`);
    }

    if (groups.length) {
      const total = groups.reduce((a, g) => a + (g.items || []).length, 0);
      html += sec(ctx, 'Список анализов', `<div class="pd-an-list">${groups.map((g, gi) => {
        const items = (g.items || []).map((it) => String(it).replace(/\*$/, ''));
        const key = `${p.id}:an:${gi}`;
        return `<details data-pd-acc="${esc(key)}" class="acc pd-an"${accOpen(ctx, key, false) ? ' open' : ''}>
          <summary><span class="pd-an__t">${esc(g.group)}</span><span class="pd-an__n num">${items.length}</span>${I('chevD', 18)}</summary>
          <div class="pd-an__items">${items.map((it) => `<span>${esc(it)}</span>`).join('')}</div>
        </details>`;
      }).join('')}</div>`, { sub: `${total} ${RC.plural(total, 'показатель', 'показателя', 'показателей')} в ${groups.length} ${RC.plural(groups.length, 'группе', 'группах', 'группах')}` });
    }

    if ((p.notIncluded || []).length) html += sec(ctx, 'Не входит', notIncluded(p.notIncluded, p));

    // шаги — по purchaseTerms (delivery / results) и FAQ чек-апов; лаборатории — из p.format
    const labs = (String(p.format || '').match(/\(([^)]*(?:Инвитро|Хеликс)[^)]*)\)/) || [])[1];
    const how = numbered
      ? p.includes.map((x) => ({ t: stripNum(x.title), d: bothFormats(x.text) }))
      : [
        { t: 'Оплачиваете и получаете направление', d: labs ? `Подберём ближайшую лабораторию: ${listOr(labs.split(/\s*,\s*/))}` : 'Подберём ближайшую лабораторию-партнёра' },
        { t: `Сдаёте анализы в${NB}течение 30${NB}дней`, d: 'Утром натощак — в лаборатории только показываете бланк' },
        { t: 'Консультация с разбором', d: `${RC.formatLabel(p)}. Дату согласуем в${NB}течение 3–7${NB}дней после готовности результатов` },
        { t: 'Рекомендации в чат', d: 'Письменный разбор показателей и программа сопровождения' },
      ];
    html += sec(ctx, 'Как это работает', steps(how));

    const own = p.faq || [];
    const general = ((data.faq || {}).checkups || []).filter((f) => !own.some((x) => x.q === f.q));
    let faq;
    if (groups.length) {
      // общие ответы не должны называть другую длительность консультации, чем в карточке
      const dur = minutes(p.duration);
      const fits = (f) => { const m = minutes(f.a); return !m.length || !dur.length || m.every((x) => dur.includes(x)); };
      // «Где проходит консультация» отвечает «только онлайн» — это спорит с форматом карточки (RC.formatLabel), не берём
      const excluded = /почему я не худею|оплатить сейчас|Как проходит процесс|Где проходит консультация/i;
      const pool = own.concat(general.filter((f) => fits(f) && !excluded.test(f.q)));
      faq = pickFaq(pool, own.map((f) => new RegExp('^' + f.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'))
        .concat([/Входит ли в стоимость/i, /Где я могу сдать/i, /выбрать свою лабораторию/i, /ограничения перед/i]), 5);
    } else {
      // подбор чек-апа: анализы оплачиваются отдельно — берём только общие ответы про сдачу анализов
      const allow = [/Где я могу сдать/i, /ограничения перед/i, /выбрать свою лабораторию/i];
      faq = pickFaq(own.concat(general.filter((f) => allow.some((re) => re.test(f.q)))), allow, 4);
    }
    html += faqSec(ctx, p, faq);
    return html;
  }

  function notIncluded(list, p) {
    const up = RC.product('consult-online-60');
    return `<ul class="pd-no">${list.map((t) => {
      if (up && p.id !== up.id && /разбор показателей/i.test(t) && /60 минут/.test(t)) {
        return `<li><span class="pd-no__i">${I('x', 14)}</span><span class="pd-no__main"><span>Разбор анализов</span>
          <button class="pd-no__link" ${RC.link('product', { id: up.id })}><span>${esc(`есть в консультации 60${NB}минут`)}</span>${I('chevR', 16)}</button></span></li>`;
      }
      // «УЗИ …, биоимпедансный анализ — могут быть рекомендованы дополнительно, в чек-ап не входят» → коротко, без тавтологии с заголовком
      if (/рекомендованы дополнительно/i.test(t) && (p.recommendedExtra || []).length) {
        const uzi = p.recommendedExtra.filter((x) => /^УЗИ/i.test(x)).map((x) => x.replace(/^УЗИ\s+(?:органов\s+)?/i, ''));
        const rest = p.recommendedExtra.filter((x) => !/^УЗИ/i.test(x)).map((x) => low(x.replace(/^Биоимпедансный анализ$/i, 'биоимпеданс')));
        const what = [uzi.length ? 'УЗИ ' + uzi.join(' и ') : ''].concat(rest).filter(Boolean).join(', ');
        return `<li><span class="pd-no__i">${I('x', 14)}</span><span>${esc(`${what} — по${NB}рекомендации, отдельно`)}</span></li>`;
      }
      return `<li><span class="pd-no__i">${I('x', 14)}</span><span>${esc(cap(clean(t)))}</span></li>`;
    }).join('')}</ul>`;
  }

  /* -------------------------------------------------- консультации */

  function consultSections(p, ctx) {
    const { ui, state } = ctx;
    let html = '';

    const noReview = (p.notIncluded || []).some((t) => /разбор показателей/i.test(t));
    const inc = (p.includes || []).filter((x) => !(noReview && /разбор данных/i.test(x.title)));
    if (inc.length) {
      html += sec(ctx, 'Как проходит', steps(inc.map((x) => ({ t: stripNum(x.title), d: brief(ownName(p, x.text), { online: isOnline(p) }) }))));
    }

    // «бесплатно при покупке» — у цены, состав тела — в фактах; здесь остаётся только «без анализов»
    const factTests = facts(p).some((f) => f.key === 'tests');
    const pk = factTests ? [] : perks(p, { only: ['tests'], max: 1 });
    if (pk.length) html += `<section class="pad mt-16">${perksHTML(pk)}</section>`;

    const groups = p.forWhomGroups;
    if (groups && (groups.women || groups.men)) {
      const pdState = state.pd || {};
      const who = groups[pdState.whom] ? pdState.whom : (groups.women ? 'women' : 'men');
      const g = groups[who];
      const tabs = [['women', 'Женщинам'], ['men', 'Мужчинам']].filter(([k]) => groups[k]);
      html += sec(ctx, 'Кому подходит', `
        <div class="pd-whom-tabs">${tabs.map(([k, l]) => ui.chip(l, { on: k === who, attrs: RC.act('set', { 'pd.whom': k }) })).join('')}</div>
        <div class="pd-card pd-card--sage mt-12">
          <p class="pd-whom__lead">${esc(g.heading)}</p>
          ${checks((g.items || []).slice(0, 4))}
          ${g.outro ? `<p class="pd-whom__outro">${esc(ownName(p, g.outro))}</p>` : ''}
        </div>`);
    } else if ((p.forWhom || []).length) {
      html += sec(ctx, 'Кому подходит', `<div class="pd-card pd-card--sage">${checks(p.forWhom.slice(0, 4).map((t) => t.replace(/^(Женщинам|Мужчинам):\s*/, '')))}</div>`);
    }

    if ((p.notIncluded || []).length) html += sec(ctx, 'Не входит', notIncluded(p.notIncluded, p));

    const team = pickTeam(p, ctx);
    if (team.length) {
      html += sec(ctx, 'Специалисты', `<div class="pd-team">${ui.list(team.map((t) => {
        const n = personName(t);
        return ui.row({
          lead: ui.avatar(n.initials, { size: 46, photo: RC.teamPhoto && RC.teamPhoto(t.id) }),
          title: n.display,
          sub: teamSub(t),
          attrs: RC.link('team', null, { 'team.selected': t.id }),
        });
      }))}</div>`, { link: 'Вся команда', attrs: RC.link('team') });
    }

    // весь каталог консультаций, без фильтра формата: одна того же формата и одна другого (онлайн ↔ в клинике);
    // повторный приём новому клиенту не предлагаем
    const fmt = RC.formatLabel(p);
    const pool = RC.productsBy({ category: 'consultations' })
      .filter((x) => x.id !== p.id && x.price != null && !/repeat/i.test(x.id) && !/^Повторн/i.test(x.title)
        && (x.description || (x.includes || []).length));
    const same = pool.filter((x) => RC.formatLabel(x) === fmt);
    const other = pool.filter((x) => RC.formatLabel(x) !== fmt);
    const others = [same[0], other[0]].concat(same.slice(1), other.slice(1)).filter(Boolean).slice(0, 2);
    if (others.length) {
      html += sec(ctx, 'Другие форматы', ui.list(others.map((x) => {
        const d = shortDur(x.duration || '');
        const n = (d.match(/\d+/) || [])[0];
        const xf = RC.formatLabel(x);
        return ui.row({
          icon: xf === 'В клинике' ? 'stetho' : 'globe',
          title: nbDur(String(x.title).replace(/(\d+)\s+(минут)/g, `$1${NB}$2`)),
          sub: [n && String(x.title).includes(n) ? '' : nbDur(d), low(xf)].filter(Boolean).join(' · '),
          right: `<b class="pd-row-price num">${RC.priceLabel(x)}</b>`,
          attrs: RC.link('product', { id: x.id }),
        });
      })));
    }

    // ответы не должны называть другую длительность, чем в плашке и buybar («30 мин» ≠ «обычно 30–60 минут»)
    const dur = minutes(p.duration);
    const fits = (f) => { const m = minutes(f.a); return !m.length || !dur.length || m.every((x) => dur.includes(x)); };
    const faq = pickFaq((p.faq || []).filter(fits), [/Что я получу/i, /анализы\/обследования нужны/i, /лечение или препараты/i, /Как подготовиться/i, /Сколько длится/i, /уже наблюдаюсь/i], 5)
      .map((f) => ({ q: ownName(p, f.q), a: ownName(p, f.a) }));
    html += faqSec(ctx, p, faq);
    return html;
  }

  /** Подпись специалиста в одну строку: профиль из образования («Эндокринолог, диетолог») или «Консультант по ЗОЖ» · стаж «5+ лет». */
  function teamSub(t) {
    const specs = [];
    (t.education || []).join(', ').split(/\s*[,;]\s*/).forEach((x) => {
      const w = x.trim().replace(/логия$/i, 'лог');
      if (/^[А-ЯЁа-яё-]+(?:лог|терапевт)$/i.test(w) && !specs.some((y) => y === low(w))) specs.push(low(w));
    });
    let role = specs.length ? cap(specs.slice(0, 2).join(', ')) : cap(String(t.cardRole || '').split(/\s*\/\s*/)[0]);
    if (role.length > 22 && specs.length > 1) role = cap(specs[0]);
    if (role.length > 22 && role.includes('-')) role = role.split('-')[0];
    role = role.replace(/здоровому образу жизни/i, 'ЗОЖ');
    const exp = String(t.experience || '').trim().replace(/^более\s+(\d+)\s*/i, '$1+ ').replace(/(\d+\+?)\s+/, `$1${NB}`);
    return [role, exp].filter(Boolean).join(' · ');
  }

  /** 3 специалиста: группа по p.specialist (биохакинг-специалист → консультанты, иначе врачи),
      названный в notes врач — в приоритете, затем совпадение целей; итог — по стажу. */
  function pickTeam(p, ctx) {
    const all = ctx.data.team || [];
    const goals = p.goals || [];
    const group = /биохакинг|консультант/i.test(p.specialist || '') ? 'consultant' : 'doctor';
    const notes = (p.notes || []).join(' ');
    const out = [];
    if (p.doctorId) { const d = all.find((t) => t.id === p.doctorId); if (d) out.push(d); }
    all.filter((t) => t.group === group && !out.includes(t))
      .map((t) => ({ t, score: (notes.includes(personName(t).surname) ? 1000 : 0) + (t.goals || []).filter((g) => goals.includes(g)).length * 10 + years(t.experience) }))
      .sort((a, b) => b.score - a.score)
      .forEach((o) => { if (out.length < 3) out.push(o.t); });
    return out.slice(0, 3).sort((a, b) => years(b.experience) - years(a.experience));
  }

  /* -------------------------------------------------- косметология */

  function cosmoSections(p, ctx) {
    let html = '';
    html += sec(ctx, 'Как записаться', steps([
      { t: 'Выберите дату и время', d: 'В клиниках Re:clinic в Москве' },
      { t: 'Подтверждение записи', d: 'Администратор свяжется и подтвердит запись' },
      { t: 'Консультация косметолога', d: 'Специалист оценит показания и противопоказания перед процедурой' },
    ]));
    html += railSec(ctx, 'Похожие процедуры', related(p, 'cosmetology', 6), { link: 'Все', attrs: RC.link('catalog', null, { 'catalog.category': 'cosmetology', 'catalog.goal': null }) }, cosmoSub);
    return html;
  }

  /* ---------------------------------------------------- программы */

  function programSections(p, ctx) {
    const { ui } = ctx;
    let html = '';
    const inc = p.includes || [];
    html += `<section class="pad sec"><article class="pd-prog">
      <h3 class="pd-prog__title">${inc.length ? 'Что входит' : 'О программе'}</h3>
      ${inc.length
        ? `<ul class="pd-prog__list">${inc.map((x) => {
          const own = getIcon(x.title);
          const ic = own !== 'check' ? own : getIcon(`${x.title} ${x.text}`);
          return `<li><span class="pd-prog__i">${I(ic === 'check' ? 'leaf' : ic, 18)}</span><span><b>${esc(stripNum(x.title))}</b>${x.text && x.text !== x.title ? `<small>${esc(firstSentence(x.text))}</small>` : ''}</span></li>`;
        }).join('')}</ul>`
        : `<p class="pd-prog__text">${esc(p.short || p.subtitle || '')}</p>`}
      ${ui.btn('Подробнее о программе', { variant: 'dark', block: true, iconRight: 'arrowR', attrs: RC.link('program', { id: p.id }) })}
    </article></section>`;

    const pk = perks(p);
    if (pk.length) html += `<section class="pad mt-16">${perksHTML(pk)}</section>`;

    if ((p.forWhom || []).length) {
      html += sec(ctx, 'Кому подходит', `<div class="pd-card pd-card--sage">${checks(p.forWhom.slice(0, 4))}</div>`);
    }
    html += faqSec(ctx, p, (p.faq || []).filter((f) => f.a).slice(0, 4));
    return html;
  }

  /* ------------------------------------------------------ шапка */

  /** Подпись под крупной ценой: { text, gift } */
  function priceSub(p) {
    switch (p.category) {
      case 'iv':
        if (isRange(p)) return { text: `${p.priceNote.replace(/\s*\/\s*/g, ' или ')} за процедуру` };
        return { text: p.priceNote || 'за процедуру' };
      case 'checkups': return { text: p.priceNote || 'анализы и консультация включены' };
      case 'consultations': {
        if (p.priceNote && /бесплатно/i.test(p.priceNote)) {
          const w = freeWhat(p.priceNote);
          if (w) return { text: 'бесплатно ' + w, gift: true };
        }
        if (p.priceNote) return { text: p.priceNote };
        return { text: 'за консультацию' };
      }
      case 'cosmetology': return { text: p.priceNote || 'за процедуру' };
      default: return { text: p.price == null ? 'состав подбирается индивидуально' : (p.priceNote || '') };
    }
  }

  function subtitle(p) {
    const raw = String(p.siteSubtitle || '');
    if (p.category === 'consultations' && raw) {
      if (/^\s*\+/.test(raw)) return '+ ' + raw.replace(/^\s*\+\s*/, '').replace(/^аппаратный\s+/i, '');
      const head = raw.split(/\s+\+\s+/)[0].split(/\s*\/\s*/);
      return cap(listOr(head));
    }
    if (p.category === 'cosmetology') {
      const s = p.subtitle || '';
      const dup = !s || (p.priceNote && (s.toLowerCase().includes(p.priceNote.toLowerCase()) || sameDigits(s, p.priceNote)));
      return dup ? cosmoSub(Object.assign({}, p, { subtitle: null })) : s;
    }
    return p.subtitle || p.group || '';
  }

  function description(p) {
    if (!p.description) return '';
    if (p.category === 'cosmetology') {
      // убираем служебные фразы сайта: форма заявки, противопоказания (они в дисклеймере), повтор цены/количества
      return sentences(p.description).filter((s) =>
        !/противопоказан|оставьте заявку|администратор свяжется|цена указана/i.test(s) &&
        !sameDigits(s, p.priceNote) && !sameDigits(s, p.subtitle)).join(' ');
    }
    if (p.category === 'consultations' && (p.includes || []).length) {
      // шаги приёма ниже — в описании оставляем только позиционирование (до двоеточия) и короткие уточнения
      const ss = sentences(p.description);
      const first = ss[0] || '';
      const ci = first.indexOf(':');
      let lead = ci > 0 ? first.slice(0, ci).trim() + '.' : first;
      if (noDot(lead).length < 40) lead = '';
      return [lead].concat(ss.slice(1).filter((s) => s.length <= 60)).filter(Boolean).join(' ');
    }
    return p.description;
  }

  function head(p, ctx) {
    const { ui, state } = ctx;
    const fav = RC.isFav(state, p.id);
    const tone = RC.tone(p);
    const showCode = p.category === 'iv' && p.code && p.code.toLowerCase() !== String(p.title).toLowerCase();
    const sub = subtitle(p);
    const fs = facts(p);
    const dur = String(p.duration || '').split(/[,:]/)[0].trim();
    const kicker = [RC.category(p.category).title, fs.some((f) => f.dur) ? '' : dur].filter(Boolean).join(' · ');
    const hasLabs = (p.analyses || []).length > 0;
    const title = String(p.title).toLowerCase();
    const goals = (p.goals || []).filter((g) => g !== 'diagnostics')
      .filter((g) => { const t = RC.goalTitle(g).toLowerCase(); return !title.includes(t) && !t.includes(title); })
      .slice(0, 3);
    // «оплатить сейчас — сдать позже» снимает возражение рядом с ценой, а не в конце страницы
    const later = p.category === 'checkups' && p.price && hasLabs;
    const ps = priceSub(p);
    const desc = description(p);
    // фото с сайта: пакет капельницы (квадратный кроп), вырез врача (прозрачный PNG), обложка — у каждого своя посадка
    const media = RC.productIllu(p);
    const fit = (String(media).match(/rc-photo--(\w+)/) || [])[1];
    const mediaCls = !fit ? '' : ` pd-media--photo pd-media--${p.category === 'iv' && fit === 'cover' ? 'pack' : fit}`;

    return `
      <section class="pad pd-top">
        <div class="pd-media${mediaCls}" style="${RC.toneStyle(tone)}">
          <div class="pd-media__illu">${media}</div>
          <div class="pd-media__bar">
            <span>${p.badge ? ui.badge(p.badge) : ''}</span>
            <span class="pd-media__acts">
              ${ui.iconBtn(fav ? 'heartF' : 'heart', RC.act('fav', { id: p.id }), { variant: 'glass', label: fav ? 'Убрать из избранного' : 'В избранное', on: fav })}
              ${ui.iconBtn('share', RC.act('toast', { text: 'Ссылка скопирована', sub: 'Отправьте её в любой чат Telegram', icon: 'share' }), { variant: 'glass', label: 'Поделиться' })}
            </span>
          </div>
          ${goals.length ? `<div class="pd-media__tags">${goals.map((g) => `<span>${esc(RC.goalTitle(g))}</span>`).join('')}</div>` : ''}
        </div>
      </section>
      <section class="pad pd-head">
        <p class="pd-kicker">${I(RC.CAT_ICON[p.category] || 'sparkles', 16)}<span>${esc(kicker)}</span></p>
        ${showCode ? `<p class="pd-code">${esc(p.code)}</p>` : ''}
        <h1 class="pd-title">${esc(p.title)}</h1>
        ${sub ? `<p class="pd-sub">${esc(sub)}</p>` : ''}
        <div class="pd-price">
          <div class="pd-price__main">
            <b class="num${p.price == null ? ' is-text' : ''}">${esc(priceText(p))}</b>
            ${ps.text ? `<small class="${ps.gift ? 'pd-price__gift' : ''}">${ps.gift ? I('gift', 16) : ''}<span>${esc(ps.text).replace(/([А-ЯЁа-яё]+-[А-ЯЁа-яё]+)/g, '<span class="pd-nw">$1</span>')}</span></small>` : ''}
          </div>
        </div>
        ${fs.length ? `<div class="pd-facts pd-facts--${fs.length}">${fs.map((f) => `<div class="pd-fact">${I(f.icon, 20)}<b>${esc(f.v)}</b><small>${esc(f.s)}</small></div>`).join('')}</div>` : ''}
        ${later ? `<div class="pd-later">
          <span class="pd-later__i">${I('card', 22)}</span>
          <span class="pd-later__main"><b>Оплатить сейчас, а${NB}сдать анализы позже</b><small>Сразу или в${NB}рассрочку от${NB}банка-партнёра</small></span>
        </div>` : ''}
        ${desc ? `<p class="pd-desc">${esc(desc)}</p>` : ''}
      </section>`;
  }

  function buybar(p, ctx) {
    const { ui, state } = ctx;
    const inCart = RC.inCart(state, p.id);
    if (p.price == null) {
      return ui.buybar(ui.btn('Подобрать программу', { variant: 'primary', block: true, iconRight: 'arrowR', attrs: RC.link('quiz') }));
    }
    const small = p.category === 'iv' ? 'за процедуру'
      : p.category === 'checkups' ? ((p.analyses || []).length ? 'анализы + консультация' : 'консультация по подбору')
        : p.category === 'consultations' ? nbDur(shortDur(p.duration || '')) || 'консультация'
          : (p.priceNote || 'за процедуру');
    const priceHTML = `<div class="buybar__price"><b>${esc(priceText(p))}</b><small>${esc(small)}</small></div>`;
    // «уже в корзине» одинаково для всех категорий: тёмная кнопка с корзиной и зелёной галочкой, как бейдж таббара
    const bagOk = (size) => `<span class="pd-incart">${I('bag', size)}<span class="pd-incart__ok">${I('check', 11)}</span></span>`;
    if (p.category === 'checkups') {
      const buy = (p.analyses || []).length ? 'Купить чек-ап' : 'Купить консультацию';
      return ui.buybar(`${priceHTML}${inCart
        ? `<button class="btn btn--dark pd-buybar-cta pd-incart-btn" ${RC.act('go-cart')} aria-label="Открыть корзину">${bagOk(20)}<span>В корзине</span>${I('chevR', 18)}</button>`
        : ui.btn(buy, { variant: 'primary', cls: 'pd-buybar-cta', attrs: RC.act('add', { id: p.id }) })}`);
    }
    // цена за единицу / штуку — в корзину не кладём (сумма «200 ₽» за процедуру бессмысленна), только запись
    if (p.category === 'cosmetology' && perUnit(p)) {
      return ui.buybar(`${priceHTML}<div class="pd-buy">${ui.btn('Записаться', { variant: 'primary', attrs: RC.link('booking', { id: p.id }) })}</div>`);
    }
    const cartBtn = inCart
      ? `<button class="ibtn pd-incart-ibtn" ${RC.act('go-cart')} aria-label="Уже в корзине — открыть корзину">${bagOk(22)}</button>`
      : ui.iconBtn('bag', RC.act('add', { id: p.id }), { label: 'В корзину', badge: '+' });
    return ui.buybar(`${priceHTML}<div class="pd-buy">${cartBtn}${ui.btn('Записаться', { variant: 'primary', attrs: RC.link('booking', { id: p.id }) })}</div>`);
  }

  /* ----------------------------------------------------- экран */

  RC.register({
    id: 'product',
    title: 'Карточка продукта',
    short: 'Продающая страница услуги: цена, состав, запись',
    note: 'Каждая услуга продаётся как товар: крупная цена, ключевые факты, эффекты и понятный порядок действий, а внизу всегда закреплены «Записаться» и «В корзину». Шаблон один, но разделы подстраиваются под тип услуги, а формат — онлайн, в клинике или оба — виден сразу в фактах. Клиенту не нужно искать ответы на сайте, а клинике — объяснять одно и то же в переписке.',
    points: [
      'Цена и две кнопки покупки всегда на виду внизу экрана',
      'Капельницы: эффекты, ход процедуры и апселл на курс 3–10 процедур',
      'Чек-апы: полный список анализов по группам и «оплатить сейчас — сдать позже»',
      'Консультации: шаги приёма, специалисты по стажу, другие форматы — онлайн и в клинике',
      '«С этим берут» и похожие процедуры увеличивают средний чек',
      'Ответы на частые вопросы снимают возражения до записи',
    ],
    examples: [
      { label: 'NAD+', params: { id: 'iv-nad' }, state: { cart: [{ id: 'checkup-weight', qty: 1 }] } },
      { label: 'Чек-ап Снижение веса', params: { id: 'checkup-weight' }, state: { cart: [{ id: 'iv-nad', qty: 1, slot: { branch: 'mosfilm', date: '2026-09-18', time: '12:30' } }] } },
      { label: 'Диагностическая консультация', params: { id: 'consult-offline-diagnostic' } },
      { label: 'Онлайн-консультация', params: { id: 'consult-online-express' } },
      { label: 'Подбор чек-апа', params: { id: 'checkup-individual' } },
      { label: 'Биоревитализация', params: { id: 'cosmo-biorevitalization' } },
    ],
    render(ctx) {
      const { ui } = ctx;
      const p = RC.product(ctx.params.id) || RC.product('iv-nad');
      if (!p) return ui.empty('gift', 'Услуга не найдена', 'Возможно, она больше не продаётся', ui.btn('В каталог', { variant: 'dark', attrs: RC.link('catalog') }));

      let body = '';
      if (p.category === 'iv') body = ivSections(p, ctx);
      else if (p.category === 'checkups') body = checkupSections(p, ctx);
      else if (p.category === 'consultations') body = consultSections(p, ctx);
      else if (p.category === 'cosmetology') body = cosmoSections(p, ctx);
      else body = programSections(p, ctx);

      return `<div class="pd" lang="ru">${head(p, ctx)}${body}${ui.disclaimer()}</div>${buybar(p, ctx)}`;
    },
    /** Запоминаем раскрытые аккордеоны (FAQ, группы анализов) — действия на экране их не схлопывают. */
    mount(host) {
      if (host.__pdAcc) return;
      host.__pdAcc = true;
      host.addEventListener('toggle', (e) => {
        const d = e.target;
        if (!d || !d.matches || !d.matches('details[data-pd-acc]')) return;
        const s = RC.proto.state;
        if (!s) return;
        s.pd = s.pd || {};
        s.pd.open = s.pd.open || {};
        s.pd.open[d.dataset.pdAcc] = d.open;
      }, true);
    },
  });
})();
