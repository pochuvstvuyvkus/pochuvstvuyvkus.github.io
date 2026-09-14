/* Программы и подбор программы (квиз).
   program — продающая страница программы: как устроена, результаты, специалисты, честная стоимость.
   quiz — 3 вопроса → программа + первый шаг с ценой. */
(function () {
  const { esc, icon: I } = RC;

  /* ------------------------------------------------------------ общее */

  /* Каталог единый: формат — свойство продукта (RC.formatLabel), а не выбор клиента.
     Программа, которую можно пройти в клинике, стартует с очной диагностики; только онлайн — с экспресс-консультации. */
  const inClinic = (p) => !(p && p.directions && p.directions.length) || p.directions.includes('offline');
  const formatIcon = (p) => (inClinic(p) && !(p.directions || []).includes('online') ? 'pin' : 'globe');

  const consultFor = (p) => RC.product(inClinic(p) ? 'consult-offline-diagnostic' : 'consult-online-express');

  // Эмодзи из текстов отзывов не показываем; стрелки (→) в метриках сохраняются.
  const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu;
  const clean = (s) => String(s || '').replace(EMOJI, '').replace(/\s*\n+\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();

  const firstName = (full) => {
    const w = String(full || '').trim().split(/\s+/);
    return w.length >= 3 ? `${w[1]} ${w[0]}` : w.join(' ');
  };
  const initials = (name) => name.split(' ').map((x) => x[0] || '').join('').slice(0, 2).toUpperCase();
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');

  /** Иллюстрация программы: своя карта, т. к. RC.illuKind выбирает по первой совпавшей цели. */
  const PROGRAM_ILLU = {
    'program-antiage': 'program-antiage',
    'program-lifestyle': 'program-energy',
    'program-support': 'program-energy',
    'program-peptide-weight-loss': 'program-weight',
    'program-weight-loss-online': 'program-weight',
  };
  const programIllu = (p) => (PROGRAM_ILLU[p.id] ? RC.illu(PROGRAM_ILLU[p.id], { tone: RC.tone(p) }) : RC.productIllu(p));

  /** Дисклеймер со своим отступом: общее `.app p {margin:0}` перебивает margin-top у .disclaimer. */
  const disclaimer = (ui, text) => `<div class="pg-disc">${ui.disclaimer(text)}</div>`;

  /* ------------------------------------------------------ program: данные */

  /* Факты в hero — только конкретика из data.js, без обещаний результата
     (цифра «4–8 кг» живёт только в FAQ с оговоркой «Результат индивидуален»). */
  const FACTS = {
    // Длительность уже в kicker, команда — в шагах и «Кто ведёт»: в плитках только состав (2 плитки, иначе «4 капельницы» не влезает).
    'program-peptide-weight-loss': [['4 инъекции', 'пептида'], ['4 капельницы', 'бустера']],
    'program-antiage': [['Врач', 'антивозрастной медицины'], ['2 формата', 'онлайн и в клинике']],
    'program-lifestyle': [['Онлайн', 'из любой страны'], ['Звонок и видео', 'со специалистом']],
    'program-support': [['Команда', 'врач, нутрициолог и другие специалисты'], ['Цели и сроки', 'с контрольными точками']],
    'program-weight-loss-online': [['Онлайн', 'из любой страны'], ['Сопровождение', 'экспертов на каждом этапе']],
  };
  const factsFor = (p) => FACTS[p.id] || [
    [RC.formatLabel(p), inClinic(p) ? 'в Москве' : 'из любой страны'],
    [p.duration && p.duration.length <= 13 ? p.duration : 'Индивидуально', 'срок программы'],
  ];

  /* «Первая процедура в тот же день» — факт пептидной программы; обещаем его
     только программам, где в составе есть капельницы или пептиды-инъекции. */
  const hasProcedures = (p) => (p.includes || []).some((x) => /капельниц|инъекц/i.test(`${x.title} ${x.text}`));
  const startStep = (p) => (!inClinic(p)
    ? { title: 'Экспресс-консультация', text: 'Специалист разберёт запрос и симптомы, подскажет, какие анализы сдать, и соберёт план', start: true }
    : {
      title: 'Диагностическая консультация',
      text: `Врач разберёт запрос, сделает анализ состава тела и подберёт состав${hasProcedures(p) ? '. Первую процедуру можно сделать в тот же день' : ' программы'}`,
      start: true,
    });

  /** Тексты шагов, которые на сайте начинаются с повтора заголовка. */
  const STEP_REWRITE = {
    'Сопровождение врача-эндокринолога и нутрициолога 4 недели': 'Эндокринолог и нутрициолог ведут вас все 4 недели',
    'Замеры результатов на профессиональном аппарате': 'Контроль результатов на профессиональном аппарате',
    'Консультации по питанию, образу жизни, тренировкам и т. д.': 'Питание, образ жизни, тренировки и другие вопросы',
    'Консультация с врачом для подбора состава': 'Врач подбирает состав под вашу цель',
    'Необходимые БАДы для программы на 30 дней': 'Подберём БАДы на весь месяц',
    'Разработка рациона правильного питания': 'Рацион под ваши анализы',
    'Подбор персональной схемы БАДов и пептидов': 'Персональная схема БАДов и пептидов',
    'Разработка рекомендаций для здорового образа жизни, формирование привычек': 'Рекомендации по режиму и новые привычки',
    'Контроль динамики, поддержка и доведение до результата': 'Следим за динамикой и поддерживаем до результата',
    'Врач + нутрициолог / другие специалисты': 'Врач, нутрициолог и другие специалисты',
    'Специалисты смоделируют ваш возможный путь до достижения результата и вышлют презентацию с персонально прописанной программой под ваши цели и задачи': 'Смоделируем путь к результату и пришлём презентацию с программой под ваши цели',
    'Какие специалисты и в какой последовательности подключаются — фиксируется по итогам консультации': 'Решим после консультации, кто и когда подключается',
    'Понятные цели, сроки и контрольные точки': 'Понятные цели и сроки, проверяем результат по этапам',
  };
  const stem = (w) => String(w || '').toLowerCase().replace(/[^а-яёa-z]/g, '').slice(0, 6);
  function stepText(title, text) {
    const t = clean(text).replace(/\s*\(по оферте\)/g, '');
    if (STEP_REWRITE[t]) return STEP_REWRITE[t];
    const [tw] = String(title).split(/\s+/);
    const words = t.split(/\s+/);
    if (words.length > 2 && stem(words[0]) === stem(tw)) return cap(words.slice(1).join(' '));
    return t;
  }

  function stepsFor(p) {
    const inc = (p.includes || []).filter((x) => x && x.title).map((x) => ({ title: x.title, text: stepText(x.title, x.text) }));
    const body = inc.length ? inc : [
      { title: inClinic(p) ? 'Анализы по списку врача' : 'Анализы по списку специалиста', text: 'Чтобы протокол опирался на ваши показатели, а не на общие рекомендации' },
      // Не p.short: он уже стоит подзаголовком в hero.
      { title: 'Персональный протокол', text: 'Питание, БАДы и пептиды под ваши показатели' },
      { title: 'Сопровождение', text: 'Специалисты ведут программу, отслеживают динамику и корректируют план' },
    ];
    return [startStep(p)].concat(body);
  }

  /* Отзывы. Кг-метрики продают только программы с целью «снижение веса»;
     остальным — отзывы про кожу, энергию, сон, без цифр похудения. */
  const SON = '(?:^|[^а-яё])сон';
  const REVIEW_KEYS = {
    weight: /кг|вес|похуд|талия|объём|стройн/i,
    energy: new RegExp(`энерг|${SON}|устал|апат`, 'i'),
    stress: new RegExp(`стресс|${SON}|спокой`, 'i'),
    skin: /кож|экзем|дерматит|высыпан|прыщ/i,
    beauty: /кож|волос|экзем|дерматит|высыпан/i,
    hair: /волос/i,
    antiage: new RegExp(`молод|тонус|энерг|${SON}`, 'i'),
    immunity: /иммун|антибиот/i,
    women: /гормон|пмс|цикл/i,
    men: /энерг|либидо/i,
  };
  const KG = /кг|похуд|(?:^|[^а-яё])вес(?:[^а-яё]|$)|талия|стройн/i;
  const BIG = /(?:≈\s?)?[−-]\s?\d+(?:,\d+)?(?:–\d+)?\s?(?:кг|см)/;
  const revText = (r) => `${r.result || ''} ${r.metric || ''}`;

  /* Ручной отбор, где автоподбор по словам даёт нерелевантное: для anti-age —
     энергия, сон и тонус, без отзывов про ЖКТ, экзему и дерматит. */
  const REVIEW_IDS = {
    'program-antiage': ['rev-06', 'rev-23', 'rev-13', 'rev-35', 'rev-17'],
  };

  /** Отзыв с сайта из p.results: «Минус 8 кг за 30 дней без голода и срывов» (Мария Б., 12.05.2025). */
  function siteReviews(p) {
    return (p.results || []).map((s) => String(s).match(/Отзыв на сайте:\s*«([^»]+)»\s*\(([^,]+),\s*([\d.]+)\)/)).filter(Boolean)
      .map(([, q, author, date], i) => {
        const m = q.match(/^Минус\s+(\d+(?:,\d+)?)\s*кг\s+(за\s+\d+\s+[а-яё]+)\s*(.*)$/i);
        return {
          id: `site-${p.id}-${i}`, author, date, topic: 'program',
          metric: m ? `−${m[1]} кг ${m[2]}` : null, result: q, text: m && m[3] ? cap(m[3]) : q,
        };
      });
  }

  function reviewsFor(p, data) {
    const goals = p.goals || [];
    const all = (data.reviews || []).filter((r) => r.result || r.metric);
    if (REVIEW_IDS[p.id]) return REVIEW_IDS[p.id].map((id) => all.find((r) => r.id === id)).filter(Boolean);
    const soft = goals.filter((g) => g !== 'weight');
    // Отзывы про ЖКТ уместны в программах питания, но не в первых карточках anti-age.
    const hits = (r) => soft.filter((g) => REVIEW_KEYS[g] && REVIEW_KEYS[g].test(revText(r))).length - (/ЖКТ|живот|вздут/i.test(revText(r)) ? 1 : 0);
    const prog = (r) => (r.topic === 'program' ? 1 : 0);

    const kgList = siteReviews(p).concat(all.filter((r) => KG.test(revText(r)))
      .sort((a, b) => (BIG.test(b.metric || '') ? 1 : 0) - (BIG.test(a.metric || '') ? 1 : 0) || prog(b) - prog(a)));
    let softList = all.filter((r) => !KG.test(revText(r)) && hits(r) > 0).sort((a, b) => hits(b) - hits(a) || prog(b) - prog(a));
    if (softList.length < 3) softList = all.filter((r) => !KG.test(revText(r)) && r.topic === 'program');

    if (!goals.includes('weight')) return softList.slice(0, 6);
    if (!soft.length) return kgList.slice(0, 6);
    // Программа с несколькими целями, включая вес: чередуем цифры и «мягкие» результаты.
    const out = [];
    for (let i = 0; out.length < 6 && (i < kgList.length || i < softList.length); i++) {
      if (kgList[i]) out.push(kgList[i]);
      if (softList[i] && out.length < 6) out.push(softList[i]);
    }
    return out;
  }

  /* Цитаты, собранные вручную из фраз отзыва (правка только пунктуации и сокращение):
     автоматически из этих переписок берутся вступления без результата. */
  const QUOTES = {
    'rev-10': 'Радуюсь, видя регулярный уход веса. Нутрициолог и эндокринолог подмечают, когда порция мала, — это помогло осознать, сколько можно кушать.',
    'rev-16': 'Качество жизни поменялось кардинально. Раньше не было сил и энергии, а сейчас во мне она бурлит.',
  };
  // Фразы-вступления без содержания: самочувствие, воспоминания, «хочу сказать».
  const FILLER = /^(?:чутка|чуть|немного)?\s*приболела|^вспоминаю|^хочу (?:сказать|поделиться)|^вс[её] начиналось|^я не пришла на программу/i;

  /** Цитата из отзыва: без приветствий, 1–2 предложения, с заглавной буквы. */
  function quoteOf(text, o = {}) {
    let parts = String(text || '')
      // эмодзи между фразами («команду 👏 Мне было») — граница предложения
      .replace(/\s*[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]+\s+(?=[А-ЯЁA-Z])/gu, '\n')
      .replace(EMOJI, '')
      .replace(/\s+([,.!?;:)])/g, '$1')
      .split(/\n+|(?<=[.!?…])\s+/)
      .map((s) => s.replace(/\s{2,}/g, ' ').replace(/^[-–—•\s]+/, '').trim())
      .filter((s) => s.length >= 10
        && !FILLER.test(s)
        && !(/^(здравствуйте|добр(?:ое|ый)\s+(?:утро|день|вечер)|привет)/i.test(s) && s.length < 40)
        && !/^спасибо(?:\s+(?:большое|огромное))?[!.)\s]*$/i.test(s));
    // Над цитатой уже крупная цифра — берём фразы без цифр, чтобы не повторять её «сырой» из переписки.
    if (o.noDigits && parts.some((s) => !/\d/.test(s))) parts = parts.filter((s) => !/\d/.test(s));
    const out = [];
    let len = 0;
    for (const s of parts) {
      if (out.length >= 2 || len >= 80) break;
      // Строки из переписки без знака в конце — закрываем точкой, чтобы фразы не слипались.
      out.push(cap(s).replace(/([^.!?…)])$/, '$1.'));
      len += s.length;
    }
    let q = out.join(' ');
    if (q.length > 150) q = q.slice(0, 150).replace(/[\s,.;:!?—–-]+[^\s]*$/, '') + '…';
    return q ? `«${q}»` : '';
  }

  function teamFor(p, data) {
    const goals = p.goals || [];
    const years = (t) => parseInt(String(t.experience || '').replace(/\D+/g, ''), 10) || 0;
    // При равенстве целей выше профильный врач: для anti-age — «антивозраст» в образовании (основная специальность весомее).
    const focus = (t) => {
      if (!goals.includes('antiage')) return 0;
      const i = (t.education || []).findIndex((e) => /антивозраст/i.test(e));
      return i < 0 ? 0 : i === 0 ? 2 : 1;
    };
    const scored = (data.team || [])
      .map((t) => ({ t, n: (t.goals || []).filter((g) => goals.includes(g)).length }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n || focus(b.t) - focus(a.t) || years(b.t) - years(a.t));
    const doc = scored.find((x) => x.t.group === 'doctor');
    const other = scored.find((x) => x.t.group !== 'doctor');
    const out = [doc, other].filter(Boolean).map((x) => x.t);
    scored.forEach((x) => { if (out.length < 3 && !out.includes(x.t)) out.push(x.t); });
    return out.slice(0, 3);
  }

  /** Специализация без обрезки: врачам — 1–2 специальности, консультантам — роль до запятой. */
  function specOf(t, p) {
    const profile = (p && (p.goals || []).includes('antiage')) ? (t.education || []).find((e) => /антивозраст/i.test(e)) : null;
    if (profile) return profile;
    const goals = (p && p.goals) || [];
    // Андрология первой строкой уместна только там, где есть мужское здоровье;
    // «Диетология и коррекция состава тела» → «диетология», чтобы влезли две специальности.
    const ed = (t.education || []).flatMap((x) => String(x).split(/,\s*/)).filter(Boolean)
      .filter((x) => goals.includes('men') || !/андролог/i.test(x))
      .map((x) => x.replace(/\s+и\s+коррекция состава тела/i, '').trim());
    if (t.group === 'doctor' && ed.length) {
      const two = ed.slice(0, 2).map((x, i) => (i ? x.toLowerCase() : x)).join(', ');
      return two.length <= 26 ? two : ed[0];
    }
    const role = String(t.role || t.cardRole || '').split(/[,/]/)[0].trim();
    return cap(role.replace(/здоровому образу жизни/i, 'ЗОЖ'));
  }
  function expOf(t) {
    const n = parseInt(String(t.experience || '').replace(/\D+/g, ''), 10);
    if (!n) return '';
    const plus = /более|от/.test(t.experience) ? '+' : '';
    return `опыт ${n}${plus} ${RC.plural(n, 'год', 'года', 'лет')}`;
  }

  /** Вопросы клиента, а не юриста. Программа в клинике — первым (раскрытым) идёт ответ без упоминания онлайна. */
  function faqFor(p, data) {
    const clinic = inClinic(p);
    const skip = /Что входит|Лицензия|Сколько длится эффект/;
    const own = (p.faq || []).filter((f) => f.a && !skip.test(f.q));
    const general = ((data.faq || {}).general || []).filter((f) => f.a);
    const pick = clinic
      ? ['Что будет дальше после консультации?', 'Как оплатить программу?', 'Назначат ли препараты на первой консультации?', 'Можно ли перенести консультацию?']
      : ['Назначат ли препараты на первой консультации?', 'Что будет дальше после консультации?', 'Как оплатить программу?', 'Можно ли перенести консультацию?'];
    const dup = (q) => own.some((f) => /Что будет дальше/.test(f.q)) && /Что будет дальше/.test(q);
    let list = own.concat(pick.filter((q) => !dup(q)).map((q) => general.find((f) => f.q === q)).filter(Boolean)).slice(0, 4);
    if (clinic) list = list.filter((f) => !/онлайн/i.test(f.a)).concat(list.filter((f) => /онлайн/i.test(f.a)));
    return list;
  }

  /* ---------------------------------------------------- program: разметка */

  function hero(p) {
    const kicker = ['Программа', p.duration && p.duration.length <= 14 ? p.duration : null, RC.formatLabel(p)].filter(Boolean).join(' · ');
    const facts = factsFor(p);
    return `<article class="pg-hero">
      <div class="pg-hero__body">
        <span class="pg-kicker">${I(formatIcon(p), 14)}${esc(kicker)}</span>
        <h1 class="pg-hero__title">${esc(p.title)}</h1>
        <p class="pg-hero__short">${esc(p.short || p.subtitle || '')}</p>
      </div>
      <div class="pg-hero__illu" data-kind="${esc(PROGRAM_ILLU[p.id] || RC.illuKind(p))}">${programIllu(p)}</div>
      <div class="pg-facts pg-facts--${facts.length}">${facts.map(([v, l]) => `<div class="pg-fact"><b>${esc(v)}</b><small>${esc(l)}</small></div>`).join('')}</div>
    </article>`;
  }

  function howItWorks(p, ctx) {
    const steps = stepsFor(p);
    const who = inClinic(p) ? 'врач' : 'специалист';
    const sub = (p.includes || []).length ? `Примерный состав — ${who} уточнит его на консультации` : 'Состав и длительность подбираются индивидуально';
    return `<section class="pad sec">
      ${ctx.ui.sectionHead('Как устроена программа', { sub })}
      <ol class="pg-steps">${steps.map((s, i) => `<li class="pg-step${s.start ? ' is-start' : ''}">
        <span class="pg-step__n num">${String(i + 1).padStart(2, '0')}</span>
        <div class="pg-step__main">
          <b>${esc(s.title)}</b>
          <p>${esc(s.text)}</p>
        </div>
      </li>`).join('')}</ol>
    </section>`;
  }

  function reviewCard(r) {
    const m = String(r.metric || '');
    const big = r.metric && (m.match(/(?:≈\s?)?[−-]\s?\d+(?:,\d+)?(?:–\d+)?\s?кг/) || m.match(BIG) || [])[0];
    const when = r.metric && (String(r.metric).match(/за [^;,()]+/) || [])[0];
    const who = String(r.author || '').split(' ')[0];
    const year = r.date ? String(r.date).slice(-4) : '';
    const quote = QUOTES[r.id] ? `«${QUOTES[r.id]}»` : quoteOf(r.text, { noDigits: !!big });
    // Короткая цитата («Без голода и срывов») — крупной строкой, чтобы карточка не зияла пустотой.
    const lead = quote && quote.length <= 42;
    return `<article class="pg-rev" ${RC.link('beforeafter')}>
      ${big
        ? `<div class="pg-rev__big num">${esc(big.replace(/\s+/g, ' '))}${when ? `<small>${esc(when.trim())}</small>` : ''}</div>`
        : `<div class="pg-rev__res">${esc(r.result)}</div>`}
      ${quote ? `<p class="pg-rev__text${lead ? ' pg-rev__text--lead' : ''}">${esc(lead ? quote.replace(/\.»$/, '»') : quote)}</p>` : ''}
      <div class="pg-rev__who"><span class="pg-rev__ava">${esc((who[0] || 'К').toUpperCase())}</span><span>${esc(who)}${year ? ' · ' + esc(year) : ''}</span></div>
    </article>`;
  }

  function reviews(p, ctx) {
    const list = reviewsFor(p, ctx.data);
    if (!list.length) return '';
    return `<section class="pad sec">
      ${ctx.ui.sectionHead('Результаты клиентов', { sub: 'Клиенты программ Re:clinic', link: 'До/После', attrs: RC.link('beforeafter') })}
      <div class="rail pg-revs">${list.map(reviewCard).join('')}</div>
    </section>`;
  }

  function team(p, ctx) {
    const list = teamFor(p, ctx.data);
    if (!list.length) return '';
    return `<section class="pad sec">
      ${ctx.ui.sectionHead('Кто ведёт', { link: 'Команда', attrs: RC.link('team') })}
      <div class="pg-team">${list.map((t) => {
        const name = firstName(t.name);
        const exp = expOf(t);
        return `<button class="pg-doc" ${RC.link('team', null, { 'team.selected': t.id })}>
          ${ctx.ui.avatar(initials(name), { size: 50, photo: RC.teamPhoto && RC.teamPhoto(t.id) })}
          <span class="pg-doc__main"><b>${esc(name)}</b><small>${esc(specOf(t, p))}</small>${exp ? `<span class="pg-doc__exp">${esc(cap(exp))}</span>` : ''}</span>
          ${I('chevR', 18, 'pg-doc__chev')}
        </button>`;
      }).join('')}</div>
    </section>`;
  }

  function cost(p, ctx) {
    const c = consultFor(p);
    const online = !inClinic(p);
    const priced = p.price != null && p.price > 0;
    const lead = priced
      ? `<b class="num">${RC.priceLabel(p)}</b><p>${esc(p.priceNote || 'стоимость по прайсу клиники')}</p>`
      : `<b>Рассчитывается индивидуально</b><p>${online
        ? 'Специалист разберёт запрос на экспресс-консультации и соберёт состав программы.'
        : 'Врач оценит показатели на диагностической консультации и соберёт состав программы.'}</p>`;
    return `<section class="pad sec">
      ${ctx.ui.sectionHead('Стоимость')}
      <div class="pg-cost">
        <div class="pg-cost__lead"><span class="pg-cost__ico">${I('tag', 20)}</span><div>${lead}</div></div>
        ${c ? `<article class="pg-consult" ${RC.link('product', { id: c.id })}>
          <div class="pg-consult__top">
            <div class="pg-consult__illu" style="${RC.toneStyle(RC.tone(c))}">${RC.productIllu(c)}</div>
            <div class="pg-consult__main">
              <span class="pg-consult__label">С чего начать</span>
              <b>${esc(c.title)}</b>
              <small>${esc(c.short)}</small>
            </div>
          </div>
          ${online ? '' : `<p class="pg-consult__gift">${I('gift', 18)}Бесплатно при покупке программы в день приёма</p>`}
          <div class="pg-consult__foot">
            <div class="pg-consult__price num">${RC.priceLabel(c)}<small>${esc(c.duration ? (online ? 'онлайн, ' : 'приём ') + c.duration : 'по прайсу клиники')}</small></div>
            ${ctx.ui.btn('Записаться', { variant: 'dark', size: 'sm', attrs: RC.link('booking', { id: c.id }) })}
          </div>
        </article>` : ''}
      </div>
    </section>`;
  }

  function faq(p, ctx) {
    const list = faqFor(p, ctx.data);
    if (!list.length) return '';
    return `<section class="pad sec">
      ${ctx.ui.sectionHead('Частые вопросы')}
      ${list.map((f, i) => ctx.ui.acc(f.q, clean(f.a), i === 0)).join('')}
    </section>`;
  }

  function programBar(p, c, ui) {
    const price = c ? RC.priceLabel(c) : '';
    const note = !c ? '' : !inClinic(p)
      ? `Первый шаг — экспресс-консультация <b class="num">${price}</b>`
      : `Консультация <b class="num">${price}</b> — бесплатно с программой`;
    return ui.buybar(`<div class="pg-bar">
      ${note ? `<p class="pg-bar__note">${note}</p>` : ''}
      <div class="pg-bar__btns">
        ${ui.btn('Пройти тест', { variant: 'ghost', cls: 'pg-bar-side', attrs: RC.link('quiz') })}
        ${ui.btn('Записаться на подбор', { variant: 'primary', attrs: RC.link('booking', { id: c ? c.id : 'consult-offline-diagnostic' }) })}
      </div>
    </div>`);
  }

  RC.register({
    id: 'program',
    title: 'Программа',
    short: 'Как устроена, результаты, специалисты и первый шаг',
    note: 'Страница программы продаёт не «услугу за цену», а понятный путь: как устроена программа, кто её ведёт и каких результатов добились клиенты. Цена программы честно не указывается — клиента ведут на диагностическую консультацию, которая становится бесплатной при покупке программы.',
    points: [
      'Шаги программы на таймлайне — от консультации до сопровождения',
      'Отзывы подбираются под цель: цифры похудения — только у программ снижения веса',
      'Специалисты под профиль программы — переход к команде',
      'Честная стоимость: первый шаг с ценой и выгодой при покупке',
      'Формат — на обложке: онлайн, в клинике или оба варианта',
      'Внизу — запись на подбор с ценой первого шага и тест',
    ],
    examples: [
      { label: 'Снижение веса на пептидах', params: { id: 'program-peptide-weight-loss' } },
      { label: 'Anti-age', params: { id: 'program-antiage' } },
      { label: 'Образ жизни · онлайн', params: { id: 'program-lifestyle' } },
    ],
    render(ctx) {
      const { ui, params } = ctx;
      const p = RC.product(params.id) || RC.product('program-peptide-weight-loss');
      if (!p) return ui.empty('gift', 'Программа не найдена', 'Попробуйте подобрать программу по тесту', ui.btn('Пройти тест', { variant: 'dark', attrs: RC.link('quiz') }));
      const c = consultFor(p);
      return `
        <section class="pad mt-4">${hero(p)}</section>
        ${howItWorks(p, ctx)}
        ${reviews(p, ctx)}
        ${team(p, ctx)}
        ${cost(p, ctx)}
        ${faq(p, ctx)}
        ${disclaimer(ui, inClinic(p) ? undefined : 'Услуги онлайн-сервиса носят информационный характер и не являются медицинскими')}
        ${programBar(p, c, ui)}`;
    },
  });

  /* ================================================================ квиз */

  const GOALS = [
    { id: 'weight', title: 'Снижение веса', sub: 'Вес не уходит, отёки, живот и бока', icon: 'body' },
    { id: 'energy', title: 'Энергия и сон', sub: 'Усталость, апатия, сон не восстанавливает', icon: 'bolt' },
    { id: 'skin', title: 'Кожа и волосы', sub: 'Высыпания, тусклая кожа, волосы истончились', icon: 'sparkles' },
    { id: 'antiage', title: 'Anti-age', sub: 'Признаки раннего старения, тонус кожи', icon: 'leaf' },
    { id: 'women', title: 'Женское здоровье', sub: 'Гормональный фон, ПМС, либидо', icon: 'heart' },
    { id: 'men', title: 'Мужское здоровье', sub: 'Энергия, либидо, вес и концентрация', icon: 'shield' },
  ];
  const goalById = (id) => GOALS.find((g) => g.id === id) || null;
  const NONE = 'Ничего из этого — хочу профилактику';

  /* Программа по цели — из всего каталога, формат виден на карточке результата. */
  const PROGRAM_BY_GOAL = {
    weight: 'program-peptide-weight-loss',
    energy: 'program-lifestyle',
    skin: 'program-support',
    antiage: 'program-antiage',
    women: 'program-lifestyle',
    men: 'program-support',
  };
  const CHECKUP_BY_GOAL = {
    weight: 'checkup-weight', energy: 'checkup-healthy-body', skin: 'checkup-beauty',
    antiage: 'checkup-beauty', women: 'checkup-women', men: 'checkup-men',
  };
  const IV_BY_GOAL = {
    weight: 'iv-slim-body', energy: 'iv-energy-boost', skin: 'iv-brightening',
    antiage: 'iv-nad', women: 'iv-fe', men: 'iv-energy-boost',
  };

  /* Короткие подписи симптомов к пунктам «Женщинам / Мужчинам» из forWhomGroups консультаций.
     Один пункт сайта может дать несколько чипов; key — для склейки одинаковых смыслов,
     gender — пункты, которые показываем только в «Женском» или «Мужском здоровье». */
  const SYMPTOMS = {
    women: [
      [/^Вес не уходит/, [['weight', 'Вес не уходит даже при спорте', ['weight']]]],
      [/застряло/, [['belly', 'Отёки, живот и бока', ['weight']]]],
      [/^Волосы истончились/, [['hair', 'Волосы истончились, ногти ломкие', ['skin']], ['aging', 'Признаки раннего старения', ['antiage', 'skin']]]],
      [/беременности/, [['postpartum', 'Тело не восстановилось после родов', ['women'], 'w']]],
      [/^Сон не восстанавливает/, [['sleep', 'Сон не восстанавливает', ['energy']]]],
      [/^Лицо выглядит уставшим/, [['tone', 'Кожа теряет тонус', ['antiage', 'skin']], ['rash', 'Высыпания на лице', ['skin']]]],
      [/^Постоянная усталость/, [['fatigue', 'Постоянная усталость и апатия', ['energy']], ['mood', 'Перепады настроения', ['energy', 'women']], ['cravings', 'Тяга к сладкому и фастфуду', ['weight']]]],
      [/^Гормональный дисбаланс/, [['hormones', 'Гормональный дисбаланс', ['women', 'antiage']], ['libido', 'Снизилось либидо', ['women', 'men']], ['pms', 'Усилились ПМС-симптомы', ['women'], 'w']]],
    ],
    men: [
      [/^Вес не уходит/, [['weight', 'Вес растёт, хотя слежу за питанием', ['weight', 'men']]]],
      [/^Появился живот/, [['belly', 'Появился живот', ['weight', 'men']], ['slow', 'Организм будто «тормозит»', ['energy', 'men', 'antiage']]]],
      [/^Раньше хватало энергии/, [['drive', 'Нет прежней энергии и драйва', ['energy', 'men']]]],
      [/^Снижается либидо/, [['libido', 'Снизилось либидо', ['men', 'women']], ['greying', 'Редеют и седеют волосы', ['skin', 'antiage', 'men']], ['wake', 'Просыпаюсь уже уставшим', ['energy', 'men']]]],
      [/^Мозг не в тонусе/, [['focus', 'Хуже концентрация и память', ['energy', 'men', 'antiage']]]],
      [/^Работоспособность/, [['work', 'Упала работоспособность', ['energy', 'men']]]],
      [/Алкоголь и заедание/, [['alcohol', 'Заедаю стресс, тянет к алкоголю', ['weight', 'energy', 'men']]]],
      [/провалы в постели/, [['stress', 'Хуже переношу стресс', ['energy', 'men']], ['intimate', 'Сбои в интимной жизни', ['men'], 'm']]],
    ],
  };
  // Порядок добора общих пунктов, когда под цель подходит мало.
  const FILL_ORDER = ['fatigue', 'sleep', 'mood', 'hormones', 'focus', 'stress', 'tone', 'aging', 'hair', 'rash', 'cravings', 'belly', 'weight', 'drive', 'wake', 'slow', 'work', 'libido'];

  /** Короткая подпись для пункта без ручной: до тире, запятой или точки. */
  const shortSymptom = (s) => String(s).replace(/^(Женщинам|Мужчинам):\s*/, '').split(/\s—\s|,|\.\s/)[0].replace(/\.$/, '').trim();

  function symptomItems(key) {
    const src = RC.product('consult-offline-diagnostic') || RC.product('consult-online-express');
    if (!src) return [];
    let items = src.forWhomGroups && src.forWhomGroups[key] ? src.forWhomGroups[key].items : null;
    if (!items) {
      const prefix = key === 'men' ? 'Мужчинам:' : 'Женщинам:';
      items = (src.forWhom || []).filter((x) => x.startsWith(prefix)).map((x) => x.slice(prefix.length).trim());
    }
    const out = [];
    items.forEach((text, i) => {
      const def = SYMPTOMS[key].find(([re]) => re.test(text));
      if (def) def[1].forEach(([k, label, goals, gender]) => out.push({ key: k, label, goals, gender: gender || null }));
      else out.push({ key: `${key}-${i}`, label: shortSymptom(text), goals: [], gender: null });
    });
    return out;
  }

  function symptomsFor(goal) {
    if (goal === 'men' || goal === 'women') {
      const list = symptomItems(goal);
      const rel = list.filter((s) => s.goals.includes(goal));
      return rel.concat(list.filter((s) => !rel.includes(s))).slice(0, 12).map((s) => s.label);
    }
    // Остальные цели: общий список без гендерных пунктов, сначала — подходящие под цель.
    const seen = new Set();
    const pool = symptomItems('women').concat(symptomItems('men'))
      .filter((s) => !s.gender && !seen.has(s.key) && seen.add(s.key));
    const rel = pool.filter((s) => s.goals.includes(goal));
    const rank = (s) => { const i = FILL_ORDER.indexOf(s.key); return i < 0 ? 99 : i; };
    const rest = pool.filter((s) => !rel.includes(s)).sort((a, b) => rank(a) - rank(b));
    return rel.concat(rest).slice(0, Math.max(10, rel.length)).map((s) => s.label);
  }

  const quizState = (state) => {
    const q = state.quiz || {};
    const a = q.answers || {};
    return {
      step: Math.max(0, Math.min(3, +q.step || 0)),
      a: {
        goal: a.goal || null,
        hasTests: typeof a.hasTests === 'boolean' ? a.hasTests : null,
        symptoms: Array.isArray(a.symptoms) ? a.symptoms : [],
      },
    };
  };

  /* Первый шаг: без анализов — чек-ап по цели; с анализами — диагностика в клинике,
     а часовая онлайн-консультация — альтернатива для тех, кому неудобно приехать. */
  function firstStepFor(a) {
    if (a.hasTests === false) return { p: RC.product(CHECKUP_BY_GOAL[a.goal] || 'checkup-healthy-body'), why: 'Анализов нет — начните с чек-апа: анализы и консультация с разбором' };
    return {
      p: RC.product('consult-offline-diagnostic'),
      alt: RC.product('consult-online-60'),
      why: 'Анализы есть — возьмите их на приём, врач подберёт программу',
    };
  }

  // Вторая рекомендация: пептид-бокс там, где он по цели (вес, anti-age), иначе вторая капельница.
  const IV2_BY_GOAL = {
    weight: 'peptide-box', energy: 'iv-nad', skin: 'iv-long-hair',
    antiage: 'peptide-box', women: 'iv-stress-release', men: 'iv-metabol',
  };

  /* «Ещё рекомендуем» не спорит с первым шагом:
     — чек-апов тут нет вовсе: без анализов чек-ап уже первый шаг, с анализами он не нужен;
     — консультаций тоже нет: консультация уже внутри чек-апа или сама первый шаг;
     — остаются процедуры под цель: капельница и пептид-бокс (или вторая капельница). */
  function recsFor(a, first) {
    const firstId = first && first.id;
    const ids = [IV_BY_GOAL[a.goal] || 'iv-energy-boost', IV2_BY_GOAL[a.goal] || 'iv-nad'];
    return ids.filter((id) => id && id !== firstId).map(RC.product).filter(Boolean).slice(0, 2);
  }

  RC.actions['pg-step'] = ({ step, reset }, ctx) => {
    const s = ctx.state;
    if (!s.quiz || typeof s.quiz !== 'object') s.quiz = { step: 0, answers: {} };
    if (reset) s.quiz.answers = { goal: null, hasTests: null, symptoms: [] };
    s.quiz.step = step;
    RC.refresh();
    const app = document.querySelector('[data-proto-phone] [data-app]');
    if (app) app.scrollTop = 0;
    return false;
  };
  RC.actions['pg-symptom'] = ({ label }, ctx) => {
    const s = ctx.state;
    if (!s.quiz || typeof s.quiz !== 'object') s.quiz = { step: 2, answers: {} };
    if (!s.quiz.answers || typeof s.quiz.answers !== 'object') s.quiz.answers = {};
    const cur = Array.isArray(s.quiz.answers.symptoms) ? s.quiz.answers.symptoms : [];
    // «Ничего из этого» — отдельный ответ: взаимоисключается с симптомами.
    if (label === NONE) { s.quiz.answers.symptoms = cur.includes(NONE) ? [] : [NONE]; return; }
    const rest = cur.filter((x) => x !== NONE);
    s.quiz.answers.symptoms = rest.includes(label) ? rest.filter((x) => x !== label) : rest.concat(label);
  };
  // Смена цели сбрасывает симптомы: у разных целей разные списки.
  RC.actions['pg-goal'] = ({ goal }, ctx) => {
    const s = ctx.state;
    if (!s.quiz || typeof s.quiz !== 'object') s.quiz = { step: 0, answers: {} };
    if (!s.quiz.answers || typeof s.quiz.answers !== 'object') s.quiz.answers = {};
    if (s.quiz.answers.goal !== goal) s.quiz.answers.symptoms = [];
    s.quiz.answers.goal = goal;
  };

  function qhead(step, title, sub, count) {
    const done = step >= 3;
    return `<header class="pg-qhead pad">
      <div class="pg-qhead__row">
        <span class="pg-qhead__label">Подбор программы</span>
        <span class="pg-qhead__step num">${done ? `${I('check', 16)}Готово` : `${count ? `<em class="pg-qhead__count">${esc(count)}</em>` : ''}Шаг ${step + 1} из 3`}</span>
      </div>
      ${RC.ui.progress(done ? 1 : (step + 1) / 4, { cls: 'pg-qhead__bar' })}
      <h1 class="pg-qhead__title">${esc(title)}</h1>
      ${sub ? `<p class="pg-qhead__sub">${esc(sub)}</p>` : ''}
    </header>`;
  }

  function stepGoal(a, ui) {
    return `${qhead(0, 'Какая у вас главная цель?', '3 коротких вопроса — подберём программу и первый шаг к ней')}
      <div class="pad pg-opts">${GOALS.map((g) => ui.option({
        title: g.title, sub: g.sub, icon: g.icon, on: a.goal === g.id,
        attrs: RC.act('pg-goal', { goal: g.id }),
      })).join('')}</div>`;
  }

  function stepTests(a, ui) {
    return `${qhead(1, 'Есть анализы за последние 3 месяца?', 'Свежие результаты сделают план точнее')}
      <div class="pad pg-opts">
        ${ui.option({ title: 'Да, есть', sub: 'Возьмёте на приём или загрузите в чат — специалист учтёт их в плане', icon: 'file', on: a.hasTests === true, attrs: RC.act('set', { 'quiz.answers.hasTests': true }) })}
        ${ui.option({ title: 'Нет или устарели', sub: 'Подберём чек-ап под вашу цель: анализы и разбор результатов', icon: 'flask', on: a.hasTests === false, attrs: RC.act('set', { 'quiz.answers.hasTests': false }) })}
      </div>
      <div class="pad"><p class="pg-hint">${I('info', 16)}<span>Не страшно, если сданы не все — специалист подскажет, чего не хватает</span></p></div>`;
  }

  function stepSymptoms(a, ui) {
    const list = symptomsFor(a.goal || 'weight');
    const n = a.symptoms.length;
    const none = a.symptoms.includes(NONE);
    // Чек-лист на всю ширину: подписи длинные, в облаке чипов получалась «лесенка».
    const item = (label, extra = '') => {
      const on = a.symptoms.includes(label);
      return `<button class="chip pg-sym${extra}${on ? ' on' : ''}" ${RC.act('pg-symptom', { label })}><span>${esc(label)}</span><span class="pg-sym__box">${on ? I('check', 14) : ''}</span></button>`;
    };
    // Требование «хотя бы один» — в подзаголовке, счётчик — в шапке рядом с шагом: под длинным списком их не видно.
    return `${qhead(2, 'Что беспокоит?', 'Отметьте хотя бы один пункт — ответы увидит специалист, не придётся рассказывать заново', n && !none ? `Выбрано: ${n}` : '')}
      <div class="pad">
        <div class="pg-chips">${list.map((s) => item(s)).join('')}${item(NONE, ' pg-sym--none')}</div>
        ${n ? `<p class="pg-count on">${none ? 'Подберём программу для профилактики' : `Выбрано: ${n}`}</p>` : ''}
      </div>`;
  }

  function resultModel(a) {
    const goal = goalById(a.goal) || GOALS[0];
    const ans = Object.assign({}, a, { goal: goal.id });
    const prog = RC.product(PROGRAM_BY_GOAL[goal.id]) || RC.product(PROGRAM_BY_GOAL.weight);
    const first = firstStepFor(ans);
    return { goal, prog, first, recs: recsFor(ans, first.p) };
  }

  function stepResult(a, ctx) {
    const { ui, state } = ctx;
    const { goal, prog, first, recs } = resultModel(a);
    const fp = first.p;
    const alt = first.alt;
    const inCart = fp && RC.inCart(state, fp.id);
    const tags = [goal.title, a.hasTests ? 'Анализы есть' : 'Без анализов']
      .concat(a.symptoms.includes(NONE) ? ['Профилактика']
        : a.symptoms.length ? [`${a.symptoms.length} ${RC.plural(a.symptoms.length, 'симптом', 'симптома', 'симптомов')}`] : []);

    const fits = prog && (prog.goals || []).includes(goal.id);
    const progCard = prog ? `<article class="pg-match" ${RC.link('program', { id: prog.id })}>
        <div class="pg-match__body">
          <span class="pg-kicker">${I(fits ? 'check' : 'sparkles', 14)}${fits ? 'Подходит под вашу цель' : 'Рекомендуем для старта'}</span>
          <h3 class="pg-match__title">${esc(prog.title)}</h3>
          <p class="pg-match__short">${esc(prog.short || '')}</p>
          <span class="pg-match__fmt">${I(formatIcon(prog), 14)}${esc(RC.formatLabel(prog))}</span>
        </div>
        <div class="pg-match__illu">${programIllu(prog)}</div>
        <div class="pg-match__foot">
          <span class="pg-match__price">${esc(prog.price == null ? 'Цена после подбора' : RC.priceLabel(prog))}</span>
          ${ui.btn('О программе', { variant: 'white', size: 'sm', iconRight: 'arrowR' })}
        </div>
      </article>` : '';

    // Подпись над названием: «В клинике · 30 мин» / «Чек-ап + консультация», а не название категории во множественном числе.
    // У консультаций формат — из RC.formatLabel, длительность — из карточки (хвост «+ анализ состава тела» дублирует описание).
    const kicker = fp && (fp.category === 'consultations' ? [RC.formatLabel(fp), fp.duration].filter(Boolean).join(' · ')
      : fp.category === 'checkups' && fp.subtitle ? fp.subtitle : RC.kicker(fp));
    const altRow = alt ? `<button class="pg-first__alt" ${RC.link('product', { id: alt.id })}>
          <span class="pg-first__alt-ico">${I(formatIcon(alt), 18)}</span>
          <span class="pg-first__alt-main"><b>Удобнее онлайн?</b><small>Консультация ${esc(alt.duration ? alt.duration.replace(/мин$/, 'минут') : '')} · <span class="num">${RC.priceLabel(alt)}</span></small></span>
          ${I('chevR', 18, 'pg-first__alt-chev')}
        </button>` : '';
    const firstCard = fp ? `<article class="pg-first">
        <p class="pg-first__why">${I('info', 16)}<span>${esc(first.why)}</span></p>
        <div class="pg-first__row" ${RC.link('product', { id: fp.id })}>
          <div class="pg-first__illu" style="${RC.toneStyle(RC.tone(fp))}">${RC.productIllu(fp)}</div>
          <div class="pg-first__main">
            <span class="pg-first__kicker">${esc(kicker || '')}</span>
            <b>${esc(fp.title)}</b>
            <small>${esc(fp.short || fp.subtitle || '')}</small>
          </div>
        </div>
        <div class="pg-first__foot">
          <div class="pg-first__price num">${RC.priceLabel(fp)}${fp.id === 'consult-offline-diagnostic' ? '<small>бесплатно при покупке программы</small>' : ''}</div>
        </div>
        <div class="pg-first__btns">
          ${ui.btn('Записаться', { variant: 'ghost', icon: 'calendar', attrs: RC.link('booking', { id: fp.id }) })}
          ${inCart
            ? ui.btn('В корзине', { variant: 'soft', icon: 'check', attrs: RC.act('go-cart') })
            : ui.btn('В корзину', { variant: 'dark', icon: 'plus', attrs: RC.act('add', { id: fp.id }) })}
        </div>
        ${altRow}
      </article>` : '';

    // Подпись под «Ещё рекомендуем» — из формата самих продуктов, а не из ответа клиента.
    const recLabels = [...new Set(recs.map(RC.formatLabel))];
    const recSub = recLabels.length === 1 && recLabels[0] === 'В клинике' ? 'Процедуры под цель — в клинике в Москве' : 'Под вашу цель';

    return `${qhead(3, 'Ваш подбор готов', 'Мы учли цель, анализы и то, что вас беспокоит')}
      <div class="pad"><div class="tags pg-answers">${tags.map((t) => ui.tag(t, { tone: 'sage' })).join('')}</div></div>
      <section class="pad sec pg-sec-tight">
        ${ui.sectionHead('Вам подойдёт')}
        ${progCard}
      </section>
      <section class="pad sec">
        ${ui.sectionHead('Первый шаг')}
        ${firstCard}
      </section>
      ${recs.length ? `<section class="pad sec">
        ${ui.sectionHead('Ещё рекомендуем', { sub: recSub })}
        <div class="pgrid">${recs.map((p, i) => ui.productCard(p, ctx, { illuVariant: i % 4 })).join('')}</div>
      </section>` : ''}
      ${disclaimer(ui)}`;
  }

  const EX_SYMPTOMS = ['Вес не уходит даже при спорте', 'Тяга к сладкому и фастфуду'];
  const EX_CART = [{ id: 'iv-nad', qty: 1, slot: { branch: 'mosfilm', date: '2026-09-18', time: '12:30' } }];

  RC.register({
    id: 'quiz',
    title: 'Подбор программы',
    short: '3 вопроса → программа, первый шаг и рекомендации',
    note: 'Короткий тест снимает главный барьер «не понимаю, с чего начать»: за минуту клиент получает подходящую программу и конкретный первый шаг с ценой — чек-ап или консультацию, которые можно сразу положить в корзину. Ответы теста видит специалист, поэтому клиника получает тёплого лида с целью и симптомами.',
    points: [
      'Три шага с прогрессом — тест проходится за минуту',
      'Цель, наличие анализов и симптомы с сайта клиники',
      'Программа под цель — из всего каталога, формат виден на карточке',
      'Первый шаг с ценой: без анализов — чек-ап, с анализами — приём врача или онлайн-консультация',
      'Покупка прямо из результата: «В корзину» и запись',
      'Ответы передаются специалисту — не нужно рассказывать заново',
    ],
    examples: [
      { label: 'Цель', state: { quiz: { step: 0, answers: { goal: null, hasTests: null, symptoms: [] } } } },
      { label: 'Анализы', state: { quiz: { step: 1, answers: { goal: 'weight', hasTests: null, symptoms: [] } } } },
      { label: 'Что беспокоит', state: { cart: EX_CART, quiz: { step: 2, answers: { goal: 'weight', hasTests: false, symptoms: EX_SYMPTOMS } } } },
      { label: 'Результат', state: { cart: EX_CART, quiz: { step: 3, answers: { goal: 'weight', hasTests: false, symptoms: EX_SYMPTOMS } } } },
      { label: 'Результат · анализы есть', state: { cart: EX_CART, quiz: { step: 3, answers: { goal: 'antiage', hasTests: true, symptoms: ['Кожа теряет тонус', 'Признаки раннего старения'] } } } },
    ],
    render(ctx) {
      const { ui, state } = ctx;
      const { step, a } = quizState(state);
      const next = (ok) => ui.btn('Далее', { variant: 'primary', iconRight: 'arrowR', disabled: !ok, attrs: RC.act('pg-step', { step: step + 1 }) });
      const back = ui.btn('Назад', { variant: 'ghost', cls: 'pg-bar-side', attrs: RC.act('pg-step', { step: step - 1 }) });
      const wrap = (body, bar) => `<div class="pg-quiz"><div class="pg-quiz__body">${body}</div>${ui.buybar(bar)}</div>`;
      if (step === 0) return wrap(stepGoal(a, ui), next(!!a.goal));
      if (step === 1) return wrap(stepTests(a, ui), back + next(a.hasTests !== null));
      if (step === 2) return wrap(stepSymptoms(a, ui), back + next(a.symptoms.length > 0));
      const fp = resultModel(a).first.p;
      // «Приём» — только для очной консультации; видеозвонок — «Записаться онлайн»
      // («на консультацию» не помещается рядом с «Пройти заново» в 358px панели).
      const online = fp && (fp.directions || []).length === 1 && fp.directions[0] === 'online';
      const bookLabel = !fp ? 'Записаться' : fp.category === 'checkups' ? 'Записаться на чек-ап'
        : fp.category === 'consultations' && online ? 'Записаться онлайн' : 'Записаться на приём';
      return wrap(stepResult(a, ctx),
        ui.btn('Пройти заново', { variant: 'ghost', cls: 'pg-bar-side', attrs: RC.act('pg-step', { step: 0, reset: true }) }) +
        ui.btn(bookLabel, { variant: 'primary', attrs: RC.link('booking', { id: fp ? fp.id : 'consult-offline-diagnostic' }) }));
    },
  });
})();
