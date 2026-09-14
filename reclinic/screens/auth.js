/* Вход через Telegram: splash (первый кадр) и welcome (узнали по Telegram, телефон, обзор услуг, согласие). */
(function () {
  const { esc, icon: I } = RC;

  const authOf = (state) => state.auth || {};
  const userOf = (ctx) => Object.assign({ firstName: 'Анна', lastName: 'Смирнова', username: 'anna_smirnova', initials: 'АС', phone: '+7 916 245-18-42' }, ctx.demo.user || {});
  const botHandle = (ctx) => {
    const url = ((ctx.data.clinic || {}).bots || {}).telegram || '';
    const m = String(url).match(/t\.me\/([\w]+)/);
    return m ? '@' + m[1] : '';
  };
  const policyDoc = (ctx) => ((ctx.data.clinic || {}).documents || []).find((d) => /Политика/.test(d.title)) || null;

  /* Системный запрос номера: ставим флаг, закрываем шторку, подтверждаем тостом. */
  RC.actions['au-share'] = (payload, ctx) => {
    RC.setPath(ctx.state, 'auth.phoneShared', true);
    RC.proto.sheet = null;
    RC.toast('Номер получен из Telegram', { sub: userOf(ctx).phone, icon: 'phone' });
  };

  /* ------------------------------------------------------------ splash */

  RC.register({
    id: 'splash',
    title: 'Запуск через Telegram',
    short: 'Первый кадр: бренд и автоматический вход',
    root: true,
    dark: true,
    bg: '#2B4A34',
    note: 'Первое, что видит клиент после нажатия «Открыть» в боте. Mini App сам получает подтверждённый аккаунт Telegram — ни логина, ни пароля, ни формы регистрации. Бизнес не теряет клиентов на входе, а клиент сразу видит премиальный бренд клиники.',
    points: [
      'Вход без паролей и SMS — аккаунт уже подтверждён Telegram',
      'Фирменный вордмарк и цвета клиники с первого кадра',
      'Понятный статус загрузки вместо пустого экрана',
      'Длится доли секунды, затем открывается приветствие',
      'В прототипе — тап по экрану ведёт дальше',
    ],
    examples: [{ label: 'Открытие бота' }],
    render(ctx) {
      const { data } = ctx;
      const clinic = data.clinic || {};
      const since = clinic.foundedYear ? `с ${clinic.foundedYear} года` : '';
      return `<div class="au-splash" ${RC.linkRoot('welcome')}>
        <div class="au-splash__glow" aria-hidden="true"></div>
        <div class="au-splash__center">
          <div class="au-halo">
            <span class="au-halo__ring au-halo__ring--2"></span>
            <span class="au-halo__ring"></span>
            <div class="au-halo__disc">
              <div class="au-halo__illu">${RC.illu('telegram-login', { tone: RC.TONES.sage })}</div>
            </div>
          </div>
          <h1 class="au-mark">Re<i>:</i>clinic</h1>
          <p class="au-tagline">клиника превентивной медицины и&nbsp;биохакинга</p>
          ${since ? `<div class="au-splash__meta"><span>${esc(since)}</span><i></i><span>Москва и онлайн</span></div>` : ''}
        </div>
        <div class="au-status">
          <span class="au-spin" aria-hidden="true">
            <svg class="au-spin__ring" viewBox="0 0 48 48" width="48" height="48"><circle cx="24" cy="24" r="21" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="3"/><circle class="au-spin__arc" cx="24" cy="24" r="21" fill="none" stroke="var(--sand)" stroke-width="3" stroke-linecap="round" stroke-dasharray="38 132"/></svg>
            ${I('telegram', 20)}
          </span>
          <span class="au-status__txt">
            <b>Входим через Telegram…</b>
            <small>Без паролей и регистрации — аккаунт Telegram уже подтверждён</small>
          </span>
        </div>
      </div>`;
    },
  });

  /* ----------------------------------------------------------- welcome */

  function account(ctx) {
    const u = userOf(ctx);
    const shared = authOf(ctx.state).phoneShared === true;
    const phone = shared
      ? `<div class="au-phone">
          <span class="au-phone__ico">${I('phone', 20)}</span>
          <span class="au-phone__main"><b class="num">${esc(u.phone)}</b><small>Для записи и напоминаний</small></span>
          <span class="au-phone__done" aria-label="Номер получен">${I('check', 16)}</span>
        </div>`
      : `<div class="au-phone">
          <span class="au-phone__ico">${I('phone', 20)}</span>
          <span class="au-phone__main"><b>Номер телефона</b><small>Для записи на приём</small></span>
          ${ctx.ui.btn('Поделиться', { variant: 'white', size: 'sm', cls: 'au-phone__btn', attrs: RC.act('sheet-open', { key: 'contact' }) })}
        </div>`;
    return `<article class="au-acc">
      <div class="au-acc__head">
        ${ctx.ui.avatar(u.initials, { size: 56, tg: true })}
        <div class="au-acc__who">
          <b>${esc(u.firstName)} ${esc(u.lastName)}</b>
          <span>@${esc(u.username)}</span>
          <em class="badge badge--ok au-acc__badge">${I('check', 13)}Аккаунт подключён</em>
        </div>
      </div>
      ${phone}
    </article>`;
  }

  const services = (n) => `${n} ${RC.plural(n, 'услуга', 'услуги', 'услуг')}`;

  /* Что есть в клинике: разделы единого каталога с числом услуг + итоговая плитка. */
  function overview() {
    const cats = RC.categoriesFor();
    const total = RC.productsBy({}).length;
    const tile = (ico, title, n, cls = '') => `<div class="au-cat${cls}">
        <span class="au-cat__top">
          <span class="au-cat__ico">${I(ico, 20)}</span>
          <span class="au-cat__n num">${services(n)}</span>
        </span>
        <b class="au-cat__title">${esc(title)}</b>
      </div>`;
    const tiles = cats.map((c) => tile(RC.CAT_ICON[c.id] || 'grid', c.title, RC.productsBy({ category: c.id }).length));
    if (cats.length % 2) tiles.push(tile('grid', 'Весь каталог', total, ' au-cat--all'));
    return `<div class="au-cats">${tiles.join('')}</div>`;
  }

  const PERKS = [
    { icon: 'calendar', t: 'Запись без&nbsp;звонков' },
    { icon: 'file', t: 'Анализы в&nbsp;кабинете' },
    { icon: 'bell', t: 'Напоминания в&nbsp;чат' },
  ];

  function consentRow(ctx, consent) {
    const doc = policyDoc(ctx);
    const docSub = doc && doc.url ? String(doc.url).replace(/^https?:\/\//, '') : '';
    return `<div class="check au-consent${consent ? ' on' : ''}" role="checkbox" aria-checked="${consent}" tabindex="0" ${RC.act('set', { 'auth.consent': '$toggle' })}>
      <span class="check__box">${consent ? I('check', 14) : ''}</span>
      <span>Соглашаюсь с <span class="au-doc" role="link" tabindex="0" ${RC.act('toast', { text: 'Откроется политика обработки ПДн', sub: docSub, icon: 'file' })}>политикой обработки персональных данных</span></span>
    </div>`;
  }

  RC.register({
    id: 'welcome',
    title: 'Приветствие',
    short: 'Узнали по Telegram: телефон, обзор услуг, согласие',
    root: true,
    note: 'Клиент уже вошёл: имя, фото и @username пришли из Telegram. Здесь он одной кнопкой делится номером, коротко видит, что есть в клинике, и сразу переходит к услугам. Бизнес получает контакт для записи и согласие на обработку данных — без анкет и звонков администратора.',
    points: [
      'Профиль из Telegram — без форм регистрации',
      'Номер телефона одной кнопкой через системный запрос Telegram',
      'Обзор разделов с числом услуг — ценность клиники видна до первого клика',
      'Согласие на обработку ПДн фиксируется до первой покупки',
      'Кнопка «Перейти к услугам» активна только с согласием',
    ],
    examples: [
      { label: 'Номер не передан', state: { auth: { phoneShared: false, consent: true } } },
      { label: 'Запрос номера', state: { auth: { phoneShared: false, consent: true } }, sheet: 'contact' },
      { label: 'Номер получен', state: { auth: { phoneShared: true, consent: true } } },
    ],
    sheets: {
      contact: (ctx) => {
        const u = userOf(ctx);
        const bot = botHandle(ctx);
        return ctx.ui.sheet(`<div class="au-req">
          <div class="au-req__src">${I('telegram', 16)}<span>Telegram${bot ? ` · запрос бота ${esc(bot)}` : ''}</span></div>
          <div class="au-req__icons" aria-hidden="true">
            ${ctx.ui.avatar('Re', { size: 60 })}
            <span class="au-req__dots"><i></i><i></i><i></i></span>
            <span class="au-req__ph">${I('phone', 24)}</span>
          </div>
          <h3 class="au-req__title">Re:clinic запрашивает ваш номер телефона</h3>
          <p class="au-req__text">Номер нужен для записи на&nbsp;приём и&nbsp;напоминаний о&nbsp;визитах.</p>
          <div class="au-req__card">
            ${ctx.ui.avatar(u.initials, { size: 44 })}
            <span class="au-req__who"><b>${esc(u.firstName)} ${esc(u.lastName)}</b><span class="num">${esc(u.phone)}</span></span>
          </div>
          <div class="au-req__btns">
            ${ctx.ui.btn('Отмена', { variant: 'soft', attrs: RC.act('sheet-close') })}
            ${ctx.ui.btn('Поделиться', { variant: 'dark', attrs: RC.act('au-share') })}
          </div>
        </div>`);
      },
    },
    render(ctx) {
      const { ui, state } = ctx;
      const consent = authOf(state).consent === true;
      return `<div class="au-wel">
        <header class="au-wel__head">
          <h1 class="au-wel__title">Мы узнали вас по&nbsp;Telegram</h1>
          <p class="au-wel__sub">Проверьте данные — и можно выбирать услуги</p>
        </header>
        <section class="pad">${account(ctx)}</section>
        <section class="pad sec">
          ${ui.sectionHead('Что есть в Re:clinic', { sub: 'Онлайн и в клинике в Москве — в одном каталоге' })}
          ${overview()}
          <ul class="au-perks">${PERKS.map((p) => `<li>${I(p.icon, 20)}<span>${p.t}</span></li>`).join('')}</ul>
        </section>
        ${ui.buybar(`<div class="au-cta">
          ${consentRow(ctx, consent)}
          ${ui.btn('Перейти к услугам', { variant: 'dark', size: 'lg', block: true, iconRight: 'arrowR', disabled: !consent, attrs: RC.linkRoot('home') })}
          ${consent ? '' : '<p class="au-cta__hint">Отметьте согласие, чтобы продолжить</p>'}
        </div>`)}
      </div>`;
    },
  });
})();
