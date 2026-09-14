/* Демо-данные пользователя для макетов: вымышленный клиент, записи, заказы,
   результаты и прогресс программы. Продукты — в data.js (с сайта клиники). */
window.RC_DEMO = {
  today: { iso: '2026-09-14', label: 'понедельник, 14 сентября' },

  user: {
    tgId: 482913377,
    firstName: 'Анна',
    lastName: 'Смирнова',
    username: 'anna_smirnova',
    initials: 'АС',
    phone: '+7 916 245-18-42',
    phoneShared: true,
    since: 'с сентября 2026',
  },

  days: [
    { iso: '2026-09-15', dow: 'вт', d: 15, month: 'сентября' },
    { iso: '2026-09-16', dow: 'ср', d: 16, month: 'сентября' },
    { iso: '2026-09-17', dow: 'чт', d: 17, month: 'сентября' },
    { iso: '2026-09-18', dow: 'пт', d: 18, month: 'сентября' },
    { iso: '2026-09-19', dow: 'сб', d: 19, month: 'сентября' },
    { iso: '2026-09-20', dow: 'вс', d: 20, month: 'сентября' },
    { iso: '2026-09-21', dow: 'пн', d: 21, month: 'сентября' },
    { iso: '2026-09-22', dow: 'вт', d: 22, month: 'сентября' },
    { iso: '2026-09-23', dow: 'ср', d: 23, month: 'сентября' },
    { iso: '2026-09-24', dow: 'чт', d: 24, month: 'сентября' },
    { iso: '2026-09-25', dow: 'пт', d: 25, month: 'сентября' },
    { iso: '2026-09-26', dow: 'сб', d: 26, month: 'сентября' },
  ],
  times: ['09:00', '10:30', '12:00', '12:30', '14:00', '15:30', '17:00', '18:30', '20:00'],
  busy: {
    '2026-09-15': ['09:00', '12:00', '17:00'],
    '2026-09-16': ['10:30', '14:00'],
    '2026-09-18': ['09:00', '10:30', '15:30'],
    '2026-09-19': ['12:00', '12:30', '14:00', '18:30'],
  },

  /* стартовое состояние прототипа */
  state: {
    direction: 'offline',
    cart: [
      { id: 'checkup-weight', qty: 1 },
      { id: 'iv-nad', qty: 1, slot: { branch: 'mosfilm', date: '2026-09-18', time: '12:30' } },
    ],
    favorites: ['iv-nad', 'checkup-beauty', 'iv-energy-boost'],
    catalog: { category: 'all', goal: null, sort: 'popular' },
    booking: { productId: 'iv-nad', branch: 'mosfilm', date: '2026-09-18', time: '12:30' },
    checkout: { pay: 'card', contact: 'telegram', consent: true, promo: '' },
    quiz: { step: 0, answers: {} },
    orders: { tab: 'active' },
  },

  bookings: [
    { id: 'BK-2041', productId: 'iv-nad', date: '2026-09-18', dateLabel: 'пт, 18 сентября', time: '12:30', branch: 'mosfilm', status: 'confirmed' },
    { id: 'BK-2046', productId: 'consult-online-60', date: '2026-09-22', dateLabel: 'вт, 22 сентября', time: '19:00', online: true, status: 'confirmed' },
  ],

  orders: [
    {
      id: 'RC-10427', dateLabel: '12 сентября 2026', status: 'active', statusLabel: 'Анализы сданы',
      items: [{ id: 'checkup-weight', qty: 1 }], total: 29990, pay: 'Карта •• 4421',
      steps: [
        { t: 'Оплачен', d: '12 сент', done: true },
        { t: 'Направление в лабораторию', d: '12 сент', done: true },
        { t: 'Анализы сданы', d: '15 сент', done: true },
        { t: 'Результаты готовы', d: '≈ 18 сент', done: false },
        { t: 'Консультация с разбором', d: 'после результатов', done: false },
      ],
    },
    {
      id: 'RC-10388', dateLabel: '2 сентября 2026', status: 'done', statusLabel: 'Оказана',
      items: [{ id: 'consult-online-express', qty: 1 }], total: 3990, pay: 'СБП',
    },
  ],

  results: {
    orderId: 'RC-10427', productId: 'checkup-weight', ready: 24, total: 31,
    docs: [
      { title: 'Результаты анализов', meta: 'PDF · готово 24 из 31', date: '16 сент' },
      { title: 'Направление в лабораторию', meta: 'PDF · 180 КБ', date: '12 сент' },
    ],
    markers: [
      { name: 'Витамин D (25-OH)', value: '21', unit: 'нг/мл', ref: '30–100', status: 'low' },
      { name: 'Ферритин', value: '38', unit: 'мкг/л', ref: '20–200', status: 'ok' },
      { name: 'Глюкоза', value: '5,1', unit: 'ммоль/л', ref: '3,9–5,5', status: 'ok' },
      { name: 'Инсулин', value: '14,8', unit: 'мкЕд/мл', ref: '2,6–24,9', status: 'warn' },
      { name: 'ТТГ', value: '2,9', unit: 'мЕд/л', ref: '0,4–4,0', status: 'ok' },
    ],
  },

  program: {
    productId: 'program-peptide-weight-loss',
    startedLabel: '25 августа',
    week: 3, weeks: 4,
    weights: [
      { d: '25 авг', v: 74.6 }, { d: '28 авг', v: 74.0 }, { d: '1 сент', v: 73.1 }, { d: '4 сент', v: 72.5 },
      { d: '8 сент', v: 71.6 }, { d: '11 сент', v: 71.2 }, { d: '14 сент', v: 70.9 },
    ],
    goalWeight: 69,
    today: [
      { t: 'Замер веса утром', done: true },
      { t: 'Протокол БАД — утро', done: true },
      { t: '8 000 шагов', done: false },
      { t: 'Фото ужина в чат куратору', done: false },
    ],
    curator: { name: 'Анастасия Нехорошкова', role: 'медицинский куратор' },
    nextCheck: 'пт, 19 сентября',
  },

  notifications: [
    { icon: 'flask', title: 'Анализы приняты лабораторией', text: 'Результаты придут в кабинет примерно 18 сентября', time: '15 сент' },
    { icon: 'calendar', title: 'Напоминание о записи', text: 'NAD+ в пятницу в 12:30, Мосфильмовская', time: 'сегодня' },
  ],
};
