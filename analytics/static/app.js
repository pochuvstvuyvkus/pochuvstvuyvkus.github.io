"use strict";

// On GitHub Pages the pages talk to the bot's server; on the server itself the API is the same origin.
const API_BASE = location.hostname.endsWith("github.io") ? "https://analytics.138-124-231-240.nip.io" : "";
const TOKEN_KEY = "mark_token";

const COLORS = ["#3d5a80", "#0d9f6e", "#d97706", "#7c3aed", "#db2777"];
const CATEGORIES = [
  ["new", "Новые лиды", "new"],
  ["base", "Из базы", "base"],
  ["rec_new", "Записи с новых", "records_new"],
  ["rec_base", "Записи из базы", "records_base"],
  ["norec", "Без записи", "without_record"],
  ["non", "Не лиды", "non_leads"],
];
const PAGE = 100;

const state = { source: "all", from: null, to: null, preset: "30d", category: "new", search: "", shown: PAGE };
let meta = null;
let dashboard = null;
let people = [];
let loadToken = 0;
let hideTooltip = () => {};

const $ = (id) => document.getElementById(id);
const fmt = (n) => (n === null || n === undefined ? "—" : n.toLocaleString("ru-RU"));

function token() { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } }
function dropToken() { try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* storage blocked */ } }
function authHeaders() { const t = token(); return t ? { Authorization: `Bearer ${t}` } : {}; }

async function api(path) {
  const response = await fetch(API_BASE + path, { headers: authHeaders(), credentials: API_BASE ? "omit" : "same-origin" });
  if (response.status === 401) { dropToken(); location.href = "login.html"; throw new Error("unauthorized"); }
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

// ---- dates ---------------------------------------------------------------

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parse(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function addDays(d, n) { const c = new Date(d); c.setDate(c.getDate() + n); return c; }

function presetRange(preset) {
  const today = parse(meta.today);
  switch (preset) {
    case "today": return [today, today];
    case "yesterday": return [addDays(today, -1), addDays(today, -1)];
    case "7d": return [addDays(today, -6), today];
    case "30d": return [addDays(today, -29), today];
    case "month": return [new Date(today.getFullYear(), today.getMonth(), 1), today];
    case "prev": return [new Date(today.getFullYear(), today.getMonth() - 1, 1), new Date(today.getFullYear(), today.getMonth(), 0)];
  }
  return [today, today];
}

function shortDate(s) { const d = parse(s); return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`; }
function dateTime(s) {
  if (!s) return "";
  const d = new Date(s);
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });
}

// ---- url state -----------------------------------------------------------

function readHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  if (params.get("source")) state.source = params.get("source");
  if (params.get("from") && params.get("to")) { state.from = params.get("from"); state.to = params.get("to"); state.preset = params.get("preset") || null; }
}
function writeHash() {
  const params = new URLSearchParams({ source: state.source, from: state.from, to: state.to });
  if (state.preset) params.set("preset", state.preset);
  history.replaceState(null, "", `#${params}`);
}

// ---- sidebar -------------------------------------------------------------

function sourceColor(key) {
  const index = meta.sources.findIndex((s) => s.key === key);
  return index < 0 ? "#94a3b8" : COLORS[index % COLORS.length];
}

function renderSources() {
  const counts = {};
  if (dashboard) {
    counts.all = dashboard.total.leads;
    if (dashboard.source === "all") dashboard.sources.forEach((s) => { counts[s.key] = s.leads; });
    else counts[dashboard.source] = dashboard.total.leads;
  }
  const items = [{ key: "all", title: "Все источники" }, ...meta.sources];
  $("sources").innerHTML = items.map((s) => `
    <button class="nav-item${s.key === state.source ? " active" : ""}" data-source="${s.key}">
      <span class="nav-dot" style="background:${s.key === "all" ? "#cbd5e1" : sourceColor(s.key)}"></span>
      <span>${s.title}</span>
      <span class="nav-count">${counts[s.key] !== undefined ? fmt(counts[s.key]) : ""}</span>
    </button>`).join("");
  const nav = $("sources");
  const active = nav.querySelector(".active");
  if (active && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = active.offsetLeft - nav.offsetLeft - 24;
}

// ---- KPI tiles -----------------------------------------------------------

function renderKpis(total) {
  const noRecords = total.records === null;
  const tiles = [
    ["Новые лиды", fmt(total.new), "впервые написали", "var(--brand)"],
    ["Лиды из базы", fmt(total.base), "уже писали раньше", "var(--base)"],
    ["Всего лидов", fmt(total.leads), "написали в сообщения", null],
    ["Записи", fmt(total.records), noRecords ? "нет данных YCLIENTS" : `с новых ${fmt(total.records_new)} · из базы ${fmt(total.records_base)}`, "var(--green)"],
    ["Конверсия", total.conversion === null ? "—" : `${total.conversion}%`, "лидов записались", null],
    ["Без записи", fmt(total.without_record), "лиды, не записавшиеся", null],
    ["Не лиды", fmt(total.non_leads), "перенос или отмена записи", "var(--amber)"],
  ];
  $("kpis").innerHTML = tiles.map(([label, value, cap, color]) => `
    <div class="card kpi">
      <div class="kpi-label">${color ? `<i class="swatch" style="background:${color}"></i>` : ""}${label}</div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-cap">${cap}</div>
    </div>`).join("");
}

function renderSkeleton() {
  $("kpis").innerHTML = Array.from({ length: 7 }, () => `
    <div class="card kpi"><div class="kpi-label">&nbsp;</div><div class="kpi-value"><span class="skeleton"></span></div><div class="kpi-cap"></div></div>`).join("");
}

// ---- chart ---------------------------------------------------------------

function niceMax(value) {
  if (value <= 4) return 4;
  const step = Math.pow(10, Math.floor(Math.log10(value)));
  for (const k of [1, 2, 2.5, 5, 10]) if (k * step >= value) return k * step;
  return 10 * step;
}

function renderChart(series) {
  const box = $("chart");
  const width = Math.max(box.clientWidth, 260);
  const height = width < 520 ? 210 : width < 900 ? 240 : 280;
  const pad = { l: 32, r: 8, t: 12, b: 28 };
  const points = series.points;
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const max = niceMax(Math.max(1, ...points.map((p) => Math.max(p.new + p.base, p.records))));
  const slot = innerW / points.length;
  const barW = Math.max(2, Math.min(28, slot * 0.62));
  const y = (v) => pad.t + innerH - (v / max) * innerH;
  const x = (i) => pad.l + slot * i + slot / 2;

  let svg = `<svg viewBox="0 0 ${width} ${height}" style="height:${height}px" preserveAspectRatio="none" role="img" aria-label="График лидов и записей">`;
  for (let k = 0; k <= 4; k++) {
    const v = (max / 4) * k;
    svg += `<line class="grid-line" x1="${pad.l}" x2="${width - pad.r}" y1="${y(v)}" y2="${y(v)}"/>`;
    svg += `<text class="axis" x="${pad.l - 8}" y="${y(v) + 4}" text-anchor="end">${Math.round(v)}</text>`;
  }
  const every = Math.ceil(points.length / Math.max(1, Math.floor(innerW / 48)));
  points.forEach((p, i) => {
    const cx = x(i);
    const hNew = innerH * (p.new / max);
    const hBase = innerH * (p.base / max);
    const r = Math.min(4, barW / 2);
    if (p.base) svg += `<rect x="${cx - barW / 2}" y="${y(p.new + p.base)}" width="${barW}" height="${hBase}" rx="${r}" fill="var(--base)"/>`;
    if (p.new) svg += `<rect x="${cx - barW / 2}" y="${y(p.new)}" width="${barW}" height="${hNew}" rx="${r}" fill="var(--brand)"/>`;
    if (i % every === 0) {
      const label = series.unit === "hour" ? p.label.slice(0, 2) : shortDate(p.label);
      svg += `<text class="axis" x="${cx}" y="${height - 8}" text-anchor="middle">${label}</text>`;
    }
  });
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.records)}`).join(" ");
  svg += `<path d="${line}" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
  points.forEach((p, i) => { if (p.records) svg += `<circle cx="${x(i)}" cy="${y(p.records)}" r="3.5" fill="#fff" stroke="var(--green)" stroke-width="2"/>`; });
  points.forEach((p, i) => {
    svg += `<rect class="hit" data-i="${i}" x="${pad.l + slot * i}" y="${pad.t}" width="${slot}" height="${innerH}" fill="transparent"/>`;
  });
  svg += "</svg>";
  box.innerHTML = svg;

  const tip = $("tooltip");
  const show = (hit, pageX, pageY) => {
    const p = points[Number(hit.dataset.i)];
    const title = series.unit === "hour" ? `${p.label}–${p.label.slice(0, 2)}:59` : parse(p.label).toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" });
    tip.innerHTML = `<b>${title}</b><br>Новые: ${p.new} · из базы: ${p.base}<br>Записи: ${p.records}`;
    tip.style.opacity = 1;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const left = Math.min(Math.max(pageX - w / 2, window.scrollX + 8), window.scrollX + document.documentElement.clientWidth - w - 8);
    tip.style.transform = `translate(${left}px, ${pageY - h - 14}px)`;
    box.querySelectorAll(".hit").forEach((other) => other.setAttribute("fill", other === hit ? "rgba(61,90,128,.06)" : "transparent"));
  };
  const hide = () => {
    tip.style.opacity = 0;
    box.querySelectorAll(".hit").forEach((other) => other.setAttribute("fill", "transparent"));
  };
  box.querySelectorAll(".hit").forEach((hit) => {
    hit.addEventListener("mousemove", (event) => show(hit, event.pageX, event.pageY));
    hit.addEventListener("mouseleave", hide);
    hit.addEventListener("touchstart", (event) => {
      const touch = event.touches[0];
      show(hit, touch.pageX, touch.pageY);
    }, { passive: true });
  });
  hideTooltip = hide;
}

// ---- sources table -------------------------------------------------------

const COLUMNS = ["Источник", "Новые", "Из базы", "Всего лидов", "Записи", "Конверсия", "Без записи", "Не лиды"];
function row(cells, key) {
  return `<tr${key ? ` data-source="${key}"` : ""}>${cells.map((c, i) => `<td data-label="${COLUMNS[i]}">${c}</td>`).join("")}</tr>`;
}
function conversionCell(value) {
  if (value === null) return "—";
  return `${value}%<span class="bar"><i style="width:${Math.min(100, value)}%"></i></span>`;
}
function renderTable(data) {
  const card = $("sources-card");
  if (data.source !== "all") { card.style.display = "none"; return; }
  card.style.display = "";
  $("sources-body").innerHTML = data.sources.map((s) => row([
    `<span class="source-name"><span class="nav-dot" style="background:${sourceColor(s.key)}"></span>${s.title}</span>`,
    fmt(s.new), fmt(s.base), fmt(s.leads), fmt(s.records), conversionCell(s.conversion), fmt(s.without_record), fmt(s.non_leads),
  ], s.key)).join("");
  const t = data.total;
  $("sources-foot").innerHTML = row(["Итого", fmt(t.new), fmt(t.base), fmt(t.leads), fmt(t.records), conversionCell(t.conversion), fmt(t.without_record), fmt(t.non_leads)]);
}

// ---- people --------------------------------------------------------------

function renderTabs(total) {
  $("tabs").innerHTML = CATEGORIES.map(([key, label, field]) => `
    <button class="tab${key === state.category ? " active" : ""}" data-category="${key}">${label}<em>${total[field] === null ? "—" : fmt(total[field])}</em></button>`).join("");
}

function renderPeople() {
  const query = state.search.trim().toLowerCase();
  const list = query ? people.filter((p) => p.name.toLowerCase().includes(query)) : people;
  if (!list.length) {
    $("people").innerHTML = `<li class="empty">${people.length ? "Никого не нашлось" : "Пусто за этот период"}</li>`;
    return;
  }
  const isRecord = state.category.startsWith("rec");
  const shown = list.slice(0, state.shown);
  $("people").innerHTML = shown.map((p) => {
    const name = p.vk ? `<a class="person-name" href="${p.vk}" target="_blank" rel="noopener">${escapeHtml(p.name)}</a>` : `<span class="person-name">${escapeHtml(p.name)}</span>`;
    const chips = [];
    if (state.source === "all") chips.push(`<span class="chip" style="background:${sourceColor(meta.sources.find((s) => s.title === p.source)?.key)}1a;color:${sourceColor(meta.sources.find((s) => s.title === p.source)?.key)}">${p.source}</span>`);
    let sub = chips.join("");
    if (isRecord) sub += `салон ${p.salon}${p.visit ? ` · визит ${dateTime(p.visit)}` : ""}${p.vk ? "" : " · переписка не найдена"}`;
    else sub += p.vk.replace("https://", "");
    return `<li class="person">${name}<div class="person-when">${isRecord ? "создана " : ""}${dateTime(p.at)}</div><div class="person-sub">${sub}</div></li>`;
  }).join("") + (list.length > shown.length ? `<li><button class="more" id="more">Показать ещё (${list.length - shown.length})</button></li>` : "");
  const more = $("more");
  if (more) more.addEventListener("click", () => { state.shown += PAGE; renderPeople(); });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function loadPeople() {
  const token = loadToken;
  $("people").parentElement.classList.add("loading");
  try {
    const data = await api(`/api/people?${new URLSearchParams({ source: state.source, from: state.from, to: state.to, category: state.category })}`);
    if (token !== loadToken) return;
    people = data.items;
    state.shown = PAGE;
    renderPeople();
  } finally {
    $("people").parentElement.classList.remove("loading");
  }
}

// ---- main load -----------------------------------------------------------

function rangeText(from, to) {
  const a = parse(from);
  const b = parse(to);
  const full = (d) => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  if (from === to) return full(a);
  return `${shortDate(from)}${a.getFullYear() !== b.getFullYear() ? `.${a.getFullYear()}` : ""} – ${full(b)}`;
}

function renderHeader() {
  const source = meta.sources.find((s) => s.key === state.source);
  $("title").textContent = source ? source.title : "Все источники";
  $("subtitle").textContent = source ? `Группа vk.com/${source.group} и её записи в YCLIENTS` : "Сообщения в ВКонтакте и записи в YCLIENTS";
  document.querySelectorAll("#presets button").forEach((b) => b.classList.toggle("active", b.dataset.preset === state.preset));
  $("range-label").textContent = rangeText(state.from, state.to);
  $("range-button").classList.toggle("custom", !state.preset);
}

// ---- our own date range picker -------------------------------------------

const MAX_DAYS = 120;
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const picker = { open: false, view: null, start: null, end: null, hover: null };

function monthsShown() { return window.innerWidth > 640 ? 2 : 1; }
function firstOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function sameDay(a, b) { return a && b && a.getTime() === b.getTime(); }
function daysBetween(a, b) { return Math.round((b - a) / 86400000); }

function openPicker() {
  picker.start = parse(state.from);
  picker.end = parse(state.to);
  picker.hover = null;
  picker.view = addMonths(firstOfMonth(picker.end), 1 - monthsShown());
  picker.open = true;
  $("picker").hidden = false;
  $("backdrop").hidden = false;
  $("range-button").classList.add("open");
  $("range-button").setAttribute("aria-expanded", "true");
  renderPicker();
}

function closePicker() {
  if (!picker.open) return;
  picker.open = false;
  $("picker").hidden = true;
  $("backdrop").hidden = true;
  $("range-button").classList.remove("open");
  $("range-button").setAttribute("aria-expanded", "false");
}

function monthHtml(first) {
  const today = parse(meta.today);
  const lead = (first.getDay() + 6) % 7;  // Monday first
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const end = picker.end || (picker.hover && picker.hover >= picker.start ? picker.hover : null);
  let cells = "";
  for (let i = 0; i < lead; i++) cells += `<span class="day blank"></span>`;
  for (let n = 1; n <= count; n++) {
    const d = new Date(first.getFullYear(), first.getMonth(), n);
    const classes = ["day"];
    if (sameDay(d, today)) classes.push("today");
    if (sameDay(d, picker.start)) classes.push("start");
    if (end && sameDay(d, end)) classes.push("end");
    if (picker.start && end && d > picker.start && d < end) classes.push("in-range");
    if (picker.start && !end && sameDay(d, picker.start)) classes.push("end");
    cells += `<button type="button" class="${classes.join(" ")}" data-date="${iso(d)}"${d > today ? " disabled" : ""}>${n}</button>`;
  }
  const title = first.toLocaleDateString("ru-RU", { month: "long", year: "numeric" }).replace(" г.", "");
  return `<div class="month"><div class="month-title">${title}</div>
    <div class="weekdays">${WEEKDAYS.map((w) => `<span>${w}</span>`).join("")}</div>
    <div class="days">${cells}</div></div>`;
}

function renderPicker() {
  const today = parse(meta.today);
  const shown = monthsShown();
  const months = Array.from({ length: shown }, (_, i) => monthHtml(addMonths(picker.view, i)));
  const lastShown = addMonths(picker.view, shown - 1);
  const atEnd = lastShown >= firstOfMonth(today);
  let label = "Выберите конец периода";
  let error = false;
  if (picker.start && picker.end) {
    const days = daysBetween(picker.start, picker.end) + 1;
    error = days > MAX_DAYS;
    label = error ? `Не больше ${MAX_DAYS} дней` : `${rangeText(iso(picker.start), iso(picker.end))} · ${days} дн.`;
  }
  $("picker").innerHTML = `
    <div class="picker-body">
      <button type="button" class="picker-nav prev" data-step="-1" aria-label="Предыдущий месяц">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
      <button type="button" class="picker-nav next" data-step="1" aria-label="Следующий месяц"${atEnd ? " disabled" : ""}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>
      <div class="picker-months">${months.join("")}</div>
    </div>
    <div class="picker-foot">
      <span class="picker-range${error ? " error" : ""}">${label}</span>
      <div class="picker-actions">
        <button type="button" class="btn" data-action="cancel">Отмена</button>
        <button type="button" class="btn primary" data-action="apply"${!picker.end || error ? " disabled" : ""}>Применить</button>
      </div>
    </div>`;
}

function paintRange() {
  const end = picker.end || (picker.hover && picker.hover >= picker.start ? picker.hover : null);
  $("picker").querySelectorAll("[data-date]").forEach((button) => {
    const d = parse(button.dataset.date);
    button.classList.toggle("start", sameDay(d, picker.start));
    button.classList.toggle("end", Boolean((end && sameDay(d, end)) || (!end && sameDay(d, picker.start))));
    button.classList.toggle("in-range", Boolean(picker.start && end && d > picker.start && d < end));
  });
}

function pickDay(d) {
  if (!picker.start || picker.end) {
    picker.start = d;
    picker.end = null;
  } else if (d < picker.start) {
    picker.start = d;
  } else {
    picker.end = d;
  }
  renderPicker();
}

function applyPicker() {
  if (!picker.start || !picker.end) return;
  state.preset = null;
  state.from = iso(picker.start);
  state.to = iso(picker.end);
  closePicker();
  load();
}

function bindPicker() {
  $("range-button").addEventListener("click", () => (picker.open ? closePicker() : openPicker()));
  $("picker").addEventListener("click", (event) => {
    const day = event.target.closest("[data-date]");
    if (day && !day.disabled) { pickDay(parse(day.dataset.date)); return; }
    const nav = event.target.closest("[data-step]");
    if (nav && !nav.disabled) { picker.view = addMonths(picker.view, Number(nav.dataset.step)); renderPicker(); return; }
    const action = event.target.closest("[data-action]");
    if (action?.dataset.action === "cancel") closePicker();
    if (action?.dataset.action === "apply" && !action.disabled) applyPicker();
  });
  // Hover only repaints the highlight: rebuilding the buttons under the pointer would swallow the click.
  $("picker").addEventListener("mouseover", (event) => {
    const day = event.target.closest("[data-date]");
    if (!day || !picker.start || picker.end) return;
    const d = parse(day.dataset.date);
    if (sameDay(d, picker.hover)) return;
    picker.hover = d;
    paintRange();
  });
  $("backdrop").addEventListener("click", closePicker);
  document.addEventListener("mousedown", (event) => {
    if (picker.open && !event.target.closest(".range") && window.innerWidth > 640) closePicker();
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closePicker(); });
  window.addEventListener("resize", () => { if (picker.open) renderPicker(); });
}

async function load() {
  const token = ++loadToken;
  writeHash();
  renderHeader();
  renderSources();
  $("main").classList.add("loading");
  if (!dashboard) renderSkeleton();
  $("updated").textContent = "Считаю…";
  try {
    const data = await api(`/api/dashboard?${new URLSearchParams({ source: state.source, from: state.from, to: state.to })}`);
    if (token !== loadToken) return;
    dashboard = data;
    $("period-label").textContent = `Период: ${data.period.label}`;
    $("updated").textContent = data.updated ? `Данные на ${dateTime(data.updated)}` : "";
    $("warnings").innerHTML = data.warnings.length ? `<div class="warning">${data.warnings.map(escapeHtml).join("<br>")}</div>` : "";
    $("chart-title").textContent = data.series.unit === "hour" ? "Лиды и записи по часам" : "Лиды и записи по дням";
    renderSources();
    renderKpis(data.total);
    renderChart(data.series);
    renderTable(data);
    renderTabs(data.total);
    await loadPeople();
  } catch (error) {
    if (token === loadToken) $("updated").textContent = "Не удалось загрузить данные, попробуйте обновить страницу";
    console.error(error);
  } finally {
    if (token === loadToken) $("main").classList.remove("loading");
  }
}

// ---- events --------------------------------------------------------------

function bind() {
  $("sources").addEventListener("click", (event) => {
    const item = event.target.closest("[data-source]");
    if (!item) return;
    state.source = item.dataset.source;
    load();
  });
  $("sources-body").addEventListener("click", (event) => {
    const item = event.target.closest("[data-source]");
    if (!item) return;
    state.source = item.dataset.source;
    window.scrollTo({ top: 0, behavior: "smooth" });
    load();
  });
  $("presets").addEventListener("click", (event) => {
    const button = event.target.closest("[data-preset]");
    if (!button) return;
    state.preset = button.dataset.preset;
    [state.from, state.to] = presetRange(state.preset).map(iso);
    load();
  });
  bindPicker();
  $("tabs").addEventListener("click", (event) => {
    const tab = event.target.closest("[data-category]");
    if (!tab) return;
    state.category = tab.dataset.category;
    renderTabs(dashboard.total);
    loadPeople();
  });
  $("search").addEventListener("input", (event) => {
    state.search = event.target.value;
    state.shown = PAGE;
    $("search-clear").hidden = !state.search;
    renderPeople();
  });
  $("search-clear").addEventListener("click", () => {
    $("search").value = "";
    state.search = "";
    $("search-clear").hidden = true;
    renderPeople();
    $("search").focus();
  });
  $("logout").addEventListener("click", async () => {
    try { await fetch(API_BASE + "/api/logout", { method: "POST", headers: authHeaders(), credentials: API_BASE ? "omit" : "same-origin" }); } catch (e) { /* offline */ }
    dropToken();
    location.href = "login.html";
  });
  document.addEventListener("touchstart", (event) => { if (!$("chart").contains(event.target)) hideTooltip(); }, { passive: true });
  window.addEventListener("hashchange", () => {
    const before = `${state.source}|${state.from}|${state.to}`;
    readHash();
    if (`${state.source}|${state.from}|${state.to}` !== before) load();
  });
  let resize;
  window.addEventListener("resize", () => {
    clearTimeout(resize);
    resize = setTimeout(() => dashboard && renderChart(dashboard.series), 150);
  });
}

(async function start() {
  meta = await api("/api/meta");
  readHash();
  if (!state.from) [state.from, state.to] = presetRange(state.preset).map(iso);
  bind();
  await load();
  setInterval(() => { if (!document.hidden) load(); }, 5 * 60 * 1000);
})();
