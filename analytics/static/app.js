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
const PAGE_SIZES = [50, 100, 200];
const PAGE_SIZE_KEY = "mark_page_size";

const state = { source: "all", from: null, to: null, preset: "30d", category: "new", search: "", page: 1, pageSize: savedPageSize() };
let meta = null;
let dashboard = null;
let people = [];
let hideTooltip = () => {};

const $ = (id) => document.getElementById(id);
const fmt = (n) => (n === null || n === undefined ? "—" : n.toLocaleString("ru-RU"));

function token() { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } }
function dropToken() { try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* storage blocked */ } }
function savedPageSize() {
  try {
    const size = Number(localStorage.getItem(PAGE_SIZE_KEY));
    return PAGE_SIZES.includes(size) ? size : PAGE_SIZES[0];
  } catch (e) { return PAGE_SIZES[0]; }
}
function authHeaders() { const t = token(); return t ? { Authorization: `Bearer ${t}` } : {}; }

async function api(path) {
  const response = await fetch(API_BASE + path, { headers: authHeaders(), credentials: API_BASE ? "omit" : "same-origin" });
  if (response.status === 401) {
    dropToken();
    location.href = "login.html";
    return new Promise(() => {});  // the page is leaving: nothing waits for this answer
  }
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
  const network = dashboards.get(viewKey("all"))?.data;
  if (network) {
    counts.all = network.total.leads;
    network.sources.forEach((s) => { counts[s.key] = s.leads; });
  } else if (dashboard) {
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

const KPI_TILES = [
  ["Новые лиды", "var(--brand)", (t) => fmt(t.new), () => "впервые написали"],
  ["Лиды из базы", "var(--base)", (t) => fmt(t.base), () => "уже писали раньше"],
  ["Всего лидов", null, (t) => fmt(t.leads), () => "написали в сообщения"],
  ["Записи", "var(--green)", (t) => fmt(t.records),
    (t) => (t.records === null ? "нет данных YCLIENTS" : `с новых ${fmt(t.records_new)} · из базы ${fmt(t.records_base)}`)],
  ["Конверсия", null, (t) => (t.conversion === null ? "—" : `${t.conversion}%`), () => "лидов записались"],
  ["Без записи", null, (t) => fmt(t.without_record), () => "лиды, не записавшиеся"],
  ["Не лиды", "var(--amber)", (t) => fmt(t.non_leads), () => "перенос или отмена записи"],
];

// total = null: the names stay, the numbers are placeholders until the period arrives
function renderKpis(total) {
  $("kpis").innerHTML = KPI_TILES.map(([label, color, value, cap]) => `
    <div class="card kpi">
      <div class="kpi-label">${color ? `<i class="swatch" style="background:${color}"></i>` : ""}${label}</div>
      <div class="kpi-value">${total ? value(total) : '<span class="skeleton"></span>'}</div>
      <div class="kpi-cap">${total ? cap(total) : '<span class="skeleton-line" style="width:70%"></span>'}</div>
    </div>`).join("");
}

// ---- chart ---------------------------------------------------------------

// Lines, not bars: base leads at the back, new leads, records on top.
const SERIES = [
  { key: "new", label: "Новые лиды", color: "#3d5a80", fill: 0.16 },
  { key: "base", label: "Лиды из базы", color: "#8ea8ca", fill: 0.2 },
  { key: "records", label: "Записи", color: "#0d9f6e", fill: 0.14 },
];
const DRAW_ORDER = ["base", "new", "records"];
const HIDDEN_KEY = "mark_chart_hidden";
const SHORT_MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const hiddenSeries = new Set(savedHidden());
let lastChartKey = "";

function savedHidden() {
  try { return JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]").filter((k) => SERIES.some((s) => s.key === k)); } catch (e) { return []; }
}

function chartHeight(width) { return width < 520 ? 220 : width < 900 ? 250 : 290; }

// Whole-number axis steps: 1, 2, 5, 10, 20, 25, 50…
function axisStep(max) {
  const raw = Math.max(1, max / 4);
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const k of [1, 2, 2.5, 5, 10]) {
    const step = k * power;
    if (step >= raw && Number.isInteger(step)) return step;
  }
  return 10 * power;
}

// Smooth curve that never swings past its points (monotone cubic, like d3.curveMonotoneX): no dips below zero.
function curveSegments(pts) {
  const n = pts.length;
  if (n < 2) return [];
  const slope = [];
  for (let i = 0; i < n - 1; i++) slope.push((pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0]));
  const tangent = [slope[0]];
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) { tangent.push(0); continue; }
    const h0 = pts[i][0] - pts[i - 1][0];
    const h1 = pts[i + 1][0] - pts[i][0];
    const w1 = 2 * h1 + h0;
    const w2 = h1 + 2 * h0;
    tangent.push((w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]));
  }
  tangent.push(slope[n - 2]);
  const r = (v) => Math.round(v * 10) / 10;
  return pts.slice(0, -1).map((p, i) => {
    const q = pts[i + 1];
    const h = (q[0] - p[0]) / 3;
    return `C${r(p[0] + h)},${r(p[1] + h * tangent[i])} ${r(q[0] - h)},${r(q[1] - h * tangent[i + 1])} ${r(q[0])},${r(q[1])}`;
  });
}

function pointTitle(series, period, i) {
  const p = series.points[i];
  if (series.unit === "hour") {
    const d = parse(period.from);
    return `${d.getDate()} ${MONTHS_GENITIVE[d.getMonth()]}, ${p.label}–${p.label.slice(0, 2)}:59`;
  }
  const text = parse(p.label).toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "long" });
  return text.charAt(0).toUpperCase() + text.slice(1);
}
const MONTHS_GENITIVE = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

function xLabel(series, i) {
  const p = series.points[i];
  if (series.unit === "hour") return p.label;
  const d = parse(p.label);
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}

function renderLegend(total) {
  $("legend").innerHTML = SERIES.map((s) => {
    const value = !total ? "" : total[s.key] === null || total[s.key] === undefined ? "—" : fmt(total[s.key]);
    const off = hiddenSeries.has(s.key);
    return `<button type="button" class="legend-item${off ? " off" : ""}" data-series="${s.key}" aria-pressed="${!off}">
      <i class="legend-dot" style="background:${s.color};color:${s.color}"></i>${s.label}${value ? `<b>${value}</b>` : ""}</button>`;
  }).join("");
}

function renderChart(data) {
  const { series, period } = data;
  renderLegend(data.total);
  const box = $("chart");
  const width = Math.max(box.clientWidth, 260);
  const height = chartHeight(width);
  const visible = DRAW_ORDER.map((key) => SERIES.find((s) => s.key === key)).filter((s) => !hiddenSeries.has(s.key));
  const points = series.points;
  const count = Math.max(1, Math.min(series.until ?? points.length, points.length));  // later hours of today have not happened
  const shown = points.slice(0, count);

  const top = Math.max(0, ...shown.flatMap((p) => visible.map((s) => p[s.key])));
  const step = top ? axisStep(top * 1.08) : 1;
  const yMax = top ? Math.ceil((top * 1.08) / step) * step : 4;
  const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, k) => k * step);
  const labelWidth = Math.max(...ticks.map((v) => fmt(v).length)) * 6.6 + 14;
  const pad = { l: Math.round(labelWidth), r: 14, t: 14, b: 30 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const inset = Math.min(16, innerW / Math.max(points.length, 2) / 2);
  const x = (i) => pad.l + inset + (points.length === 1 ? (innerW - 2 * inset) / 2 : ((innerW - 2 * inset) * i) / (points.length - 1));
  const y = (v) => pad.t + innerH - (v / yMax) * innerH;
  const r = (v) => Math.round(v * 10) / 10;

  let svg = `<svg viewBox="0 0 ${width} ${height}" style="height:${height}px" role="img" aria-label="График: новые лиды ${data.total.new}, из базы ${data.total.base}, записи ${data.total.records ?? "—"}"><defs>`;
  for (const s of SERIES) {
    svg += `<linearGradient id="fill-${s.key}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${s.color}" stop-opacity="${s.fill}"/><stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient>`;
  }
  svg += `<clipPath id="chart-reveal"><rect id="chart-reveal-rect" x="0" y="0" width="${width}" height="${height}"/></clipPath></defs>`;

  ticks.forEach((v, k) => {
    svg += `<line class="${k ? "grid-line" : "base-line"}" x1="${pad.l}" x2="${width - pad.r}" y1="${r(y(v))}" y2="${r(y(v))}"/>`;
    svg += `<text class="axis" x="${pad.l - 10}" y="${r(y(v)) + 4}" text-anchor="end">${fmt(v)}</text>`;
  });

  // x labels: as many as fit, counted back from the latest point so it always has one
  const labelW = series.unit === "hour" ? 40 : 48;
  const room = Math.max(1, Math.floor((innerW - 2 * inset) / labelW));
  const every = series.unit === "hour"
    ? [1, 2, 3, 4, 6, 8, 12].find((k) => points.length / k <= room) || 12
    : [1, 2, 3, 5, 7, 10, 14, 15, 30].find((k) => points.length / k <= room) || 30;
  points.forEach((p, i) => {
    const marked = series.unit === "hour" ? i % every === 0 : (points.length - 1 - i) % every === 0;
    if (!marked) return;
    const cx = Math.min(Math.max(x(i), pad.l + 18), width - pad.r - 18);
    svg += `<text class="axis${i >= count ? " future" : ""}" x="${r(cx)}" y="${height - 9}" text-anchor="middle">${xLabel(series, i)}</text>`;
  });

  // areas, then lines; the part of today that is still going is dashed
  svg += `<g clip-path="url(#chart-reveal)">`;
  const live = series.live && count >= 2;
  for (const s of visible) {
    const pts = shown.map((p, i) => [x(i), y(p[s.key])]);
    const segments = curveSegments(pts);
    if (!segments.length) continue;
    const start = `M${r(pts[0][0])},${r(pts[0][1])}`;
    const base = r(y(0));
    svg += `<path d="${start}${segments.join("")}L${r(pts[pts.length - 1][0])},${base}L${r(pts[0][0])},${base}Z" fill="url(#fill-${s.key})"/>`;
    const solid = live ? segments.slice(0, -1) : segments;
    if (solid.length) svg += `<path class="series-line" d="${start}${solid.join("")}" stroke="${s.color}"/>`;
    if (live) {
      const from = pts[pts.length - 2];
      svg += `<path class="series-line live" d="M${r(from[0])},${r(from[1])}${segments[segments.length - 1]}" stroke="${s.color}"/>`;
    }
  }
  for (const s of visible) {
    if (count === 1) {
      svg += `<circle cx="${r(x(0))}" cy="${r(y(shown[0][s.key]))}" r="4" fill="${s.color}" stroke="#fff" stroke-width="2"/>`;
    } else if (series.live) {
      const last = count - 1;
      svg += `<circle class="end-dot" cx="${r(x(last))}" cy="${r(y(shown[last][s.key]))}" r="3.5" fill="${s.color}" stroke="#fff" stroke-width="2"/>`;
    }
  }
  svg += `</g>`;

  // hover: one guide line and a dot per series, moved, never rebuilt
  svg += `<g class="cross" opacity="0"><line class="cross-line" x1="0" x2="0" y1="${pad.t}" y2="${r(y(0))}"/>`;
  for (const s of visible) svg += `<circle class="cross-dot" data-series="${s.key}" r="4.5" fill="#fff" stroke="${s.color}" stroke-width="2.5"/>`;
  svg += `</g><rect class="chart-hit" x="${pad.l}" y="0" width="${innerW}" height="${height}" fill="transparent"/></svg>`;
  box.innerHTML = `${svg}<div class="chart-tip" id="chart-tip" aria-hidden="true"></div>`;

  // draw in from the left when the numbers are new, not on resize or a legend click
  const key = `${viewKey()}|${JSON.stringify(points)}`;
  const reveal = $("chart-reveal-rect");
  if (key !== lastChartKey && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const started = performance.now();
    const frame = (now) => {
      const t = Math.min(1, Math.max(0, (now - started) / 700));  // a frame can be stamped a little before `started`
      reveal.setAttribute("width", String(width * (1 - Math.pow(1 - t, 3))));
      if (t < 1 && reveal.isConnected) requestAnimationFrame(frame);
    };
    reveal.setAttribute("width", "0");
    requestAnimationFrame(frame);
  }
  lastChartKey = key;

  const cross = box.querySelector(".cross");
  const crossLine = box.querySelector(".cross-line");
  const tip = $("chart-tip");
  const hit = box.querySelector(".chart-hit");
  let current = -1;
  const show = (clientX) => {
    const rect = hit.getBoundingClientRect();
    const local = ((clientX - rect.left) / rect.width) * innerW + pad.l;
    let i = 0;
    for (let k = 1; k < count; k++) if (Math.abs(x(k) - local) < Math.abs(x(i) - local)) i = k;
    if (i === current) return;
    current = i;
    const cx = r(x(i));
    crossLine.setAttribute("x1", cx);
    crossLine.setAttribute("x2", cx);
    cross.querySelectorAll(".cross-dot").forEach((dot) => {
      dot.setAttribute("cx", cx);
      dot.setAttribute("cy", r(y(shown[i][dot.dataset.series])));
    });
    cross.setAttribute("opacity", "1");
    const p = shown[i];
    tip.innerHTML = `<div class="tip-title">${pointTitle(series, period, i)}${series.live && i === count - 1 ? ' <em>идёт сейчас</em>' : ""}</div>` +
      SERIES.map((s) => `<div class="tip-row${hiddenSeries.has(s.key) ? " off" : ""}"><i style="background:${s.color}"></i><span>${s.label}</span><b>${fmt(p[s.key])}</b></div>`).join("");
    const boxW = box.clientWidth;
    const scale = boxW / width;
    const tipW = tip.offsetWidth;
    let left = cx * scale + 14;
    if (left + tipW > boxW - 4) left = cx * scale - tipW - 14;
    tip.style.transform = `translate(${Math.max(4, left)}px, ${pad.t * scale}px)`;
    tip.classList.add("visible");
  };
  const hide = () => {
    current = -1;
    cross.setAttribute("opacity", "0");
    tip.classList.remove("visible");
  };
  hit.addEventListener("pointermove", (event) => show(event.clientX));
  hit.addEventListener("pointerdown", (event) => show(event.clientX));
  hit.addEventListener("pointerleave", (event) => { if (event.pointerType === "mouse") hide(); });
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
    <button class="tab${key === state.category ? " active" : ""}" data-category="${key}">${label}<em>${!total ? "" : total[field] === null ? "—" : fmt(total[field])}</em></button>`).join("");
}

function renderPeople() {
  const query = state.search.trim().toLowerCase();
  const list = query ? people.filter((p) => p.name.toLowerCase().includes(query)) : people;
  if (!list.length) {
    $("people").innerHTML = `<li class="empty">${people.length ? "Никого не нашлось" : "Пусто за этот период"}</li>`;
    renderPager(0);
    return;
  }
  const isRecord = state.category.startsWith("rec");
  const pages = Math.ceil(list.length / state.pageSize);
  state.page = Math.min(Math.max(1, state.page), pages);
  const first = (state.page - 1) * state.pageSize;
  const shown = list.slice(first, first + state.pageSize);
  $("people").innerHTML = shown.map((p) => {
    // the name opens the person's dialog in the group's messages (for the group's admins), at their message when known
    const link = p.dialog || p.vk;
    const name = link
      ? `<a class="person-name" href="${escapeHtml(link)}" target="_blank" rel="noopener">${escapeHtml(p.name)}${p.dialog ? CHAT_ICON : ""}</a>`
      : `<span class="person-name">${escapeHtml(p.name)}</span>`;
    const chips = [];
    if (state.source === "all") chips.push(`<span class="chip" style="background:${sourceColor(meta.sources.find((s) => s.title === p.source)?.key)}1a;color:${sourceColor(meta.sources.find((s) => s.title === p.source)?.key)}">${p.source}</span>`);
    let sub = chips.join("");
    if (isRecord) sub += `салон ${p.salon}${p.visit ? ` · визит ${dateTime(p.visit)}` : ""}${p.vk ? "" : p.no_client ? " · запись без клиента" : " · переписка не найдена"}`;
    else if (!p.dialog) sub += p.vk.replace("https://", "");
    return `<li class="person">${name}<div class="person-when">${isRecord ? "создана " : ""}${dateTime(p.at)}</div><div class="person-sub">${sub}</div></li>`;
  }).join("");
  renderPager(list.length);
}

// 1 … 4 5 6 … 11: the first and last page, the current one and its neighbours
function pageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const wanted = new Set([1, total, current - 1, current, current + 1]);
  if (current <= 4) [2, 3, 4, 5].forEach((n) => wanted.add(n));
  if (current >= total - 3) [total - 4, total - 3, total - 2, total - 1].forEach((n) => wanted.add(n));
  const sorted = [...wanted].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const result = [];
  sorted.forEach((n, i) => {
    if (i && n - sorted[i - 1] > 1) result.push(null);
    result.push(n);
  });
  return result;
}

const CHAT_ICON = '<svg class="chat-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>';
const ARROW_LEFT = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
const ARROW_RIGHT = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>';

function renderPager(count) {
  const pager = $("pager");
  if (count <= PAGE_SIZES[0]) { pager.hidden = true; return; }  // fits on one page at any size
  pager.hidden = false;
  const pages = Math.ceil(count / state.pageSize);
  const first = (state.page - 1) * state.pageSize + 1;
  const last = Math.min(count, state.page * state.pageSize);
  const numbers = pages > 1 ? pageNumbers(state.page, pages).map((n) => (n === null
    ? '<span class="page-gap">…</span>'
    : `<button class="page-btn page-num${n === state.page ? " active" : ""}" data-page="${n}"${n === state.page ? ' aria-current="page"' : ""}>${n}</button>`)).join("") : "";
  pager.innerHTML = `
    <div class="pager-info">${fmt(first)}–${fmt(last)} из ${fmt(count)}</div>
    <div class="pager-pages"${pages > 1 ? "" : " hidden"}>
      <button class="page-btn page-arrow" data-page="${state.page - 1}" aria-label="Предыдущая страница"${state.page === 1 ? " disabled" : ""}>${ARROW_LEFT}</button>
      ${numbers}
      <span class="page-compact">${state.page} из ${pages}</span>
      <button class="page-btn page-arrow" data-page="${state.page + 1}" aria-label="Следующая страница"${state.page === pages ? " disabled" : ""}>${ARROW_RIGHT}</button>
    </div>
    <div class="pager-size">
      <span>По</span>
      <div class="size-switch">${PAGE_SIZES.map((size) => `<button data-size="${size}"${size === state.pageSize ? ' class="active" aria-pressed="true"' : ' aria-pressed="false"'}>${size}</button>`).join("")}</div>
    </div>`;
}

function goToPage(page) {
  state.page = page;
  renderPeople();
  const card = $("people-card");
  if (card.getBoundingClientRect().top < 0) card.scrollIntoView({ block: "start", behavior: "smooth" });
}

function bindPager() {
  $("pager").addEventListener("click", (event) => {
    const page = event.target.closest("[data-page]");
    if (page && !page.disabled) { goToPage(Number(page.dataset.page)); return; }
    const size = event.target.closest("[data-size]");
    if (!size || Number(size.dataset.size) === state.pageSize) return;
    const firstShown = (state.page - 1) * state.pageSize;  // keep the first visible person on screen
    state.pageSize = Number(size.dataset.size);
    try { localStorage.setItem(PAGE_SIZE_KEY, String(state.pageSize)); } catch (e) { /* storage blocked */ }
    goToPage(Math.floor(firstShown / state.pageSize) + 1);
  });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---- main load -----------------------------------------------------------

function rangeText(from, to) {
  const a = parse(from);
  const b = parse(to);
  const full = (d) => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  if (from === to) return full(a);
  return `${shortDate(from)}${a.getFullYear() !== b.getFullYear() ? `.${a.getFullYear()}` : ""} – ${full(b)}`;
}

const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

// The same name the server gives the period, so the label does not change when the numbers arrive.
function periodLabel(from, to) {
  const a = parse(from);
  const b = parse(to);
  const wholeMonth = a.getDate() === 1 && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
    && addDays(b, 1).getDate() === 1;
  return wholeMonth ? `${MONTHS[a.getMonth()]} ${a.getFullYear()}` : rangeText(from, to);
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
  state.page = 1;
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

// ---- data ------------------------------------------------------------------
// Every period the page has opened stays in memory: going back to it is instant, and a copy older than
// a minute is shown at once and quietly refreshed. The usual periods are fetched in advance.

const FRESH_MS = 60 * 1000;
const PRESETS = ["today", "yesterday", "7d", "30d", "month", "prev"];
const dashboards = new Map();   // "source|from|to" → { data, at }
const peopleLists = new Map();  // "source|from|to|category" → { items, at }
const inflight = new Map();
let busyCount = 0;

function viewKey(source = state.source, from = state.from, to = state.to) { return `${source}|${from}|${to}`; }
function peopleKey(source = state.source, from = state.from, to = state.to, category = state.category) {
  return `${viewKey(source, from, to)}|${category}`;
}
function once(key, run) {  // one request per key at a time: a click joins a prefetch already on its way
  if (!inflight.has(key)) inflight.set(key, run().finally(() => inflight.delete(key)));
  return inflight.get(key);
}
function fetchDashboard(source, from, to) {
  return once(`d|${viewKey(source, from, to)}`, async () => {
    const data = await api(`/api/dashboard?${new URLSearchParams({ source, from, to })}`);
    dashboards.set(viewKey(source, from, to), { data, at: Date.now() });
    return data;
  });
}
function fetchPeople(source, from, to, category) {
  return once(`p|${peopleKey(source, from, to, category)}`, async () => {
    const data = await api(`/api/people?${new URLSearchParams({ source, from, to, category })}`);
    peopleLists.set(peopleKey(source, from, to, category), { items: data.items, at: Date.now() });
    return data.items;
  });
}
function busy(step) {
  busyCount += step;
  $("progress").classList.toggle("active", busyCount > 0);
}

function setStatus(text, working) {
  $("updated").textContent = text;
  $("updated").classList.toggle("working", working);
}

function showDashboard(data) {
  dashboard = data;
  $("period-label").textContent = `Период: ${data.period.label}`;
  setStatus(data.updated ? `Данные на ${dateTime(data.updated)}` : "", false);
  $("warnings").innerHTML = data.warnings.length ? `<div class="warning">${data.warnings.map(escapeHtml).join("<br>")}</div>` : "";
  $("chart-title").textContent = data.series.unit === "hour" ? "Лиды и записи по часам" : "Лиды и записи по дням";
  renderSources();
  renderKpis(data.total);
  renderChart(data);
  renderTable(data);
  renderTabs(data.total);
}

// A period the page has not seen yet: placeholders, never the numbers of the previous period.
function showLoading() {
  dashboard = null;
  hideTooltip();
  $("period-label").textContent = `Период: ${periodLabel(state.from, state.to)}`;
  setStatus("Загружаю данные…", true);
  $("warnings").innerHTML = "";
  $("chart-title").textContent = state.from === state.to ? "Лиды и записи по часам" : "Лиды и записи по дням";
  renderSources();
  renderKpis(null);
  renderLegend(null);
  $("chart").innerHTML = `<div class="skeleton-block" style="height:${chartHeight(Math.max($("chart").clientWidth, 260))}px"></div>`;
  const card = $("sources-card");
  card.style.display = state.source === "all" ? "" : "none";
  $("sources-body").innerHTML = Array.from({ length: meta.sources.length }, () =>
    `<tr class="skeleton-row"><td colspan="8"><span class="skeleton-line"></span></td></tr>`).join("");
  $("sources-foot").innerHTML = "";
  renderTabs(null);
}

function showPeopleLoading() {
  $("people").innerHTML = Array.from({ length: 6 }, (_, i) => `
    <li class="person skeleton-person"><span class="skeleton-line" style="width:${[46, 38, 52, 34, 44, 40][i]}%"></span>
      <span class="skeleton-line short"></span><span class="skeleton-line" style="width:24%"></span></li>`).join("");
  $("pager").hidden = true;
}

function showPeople(items) {
  people = items;
  renderPeople();
}

async function loadDashboard({ quiet = false } = {}) {
  const key = viewKey();
  const { source, from, to } = state;
  const cached = dashboards.get(key);
  if (cached) showDashboard(cached.data);
  else showLoading();
  if (cached && !quiet && Date.now() - cached.at < FRESH_MS) return;
  if (cached) setStatus("Обновляю…", true);
  busy(1);
  try {
    const data = await fetchDashboard(source, from, to);
    if (key === viewKey()) showDashboard(data);
  } catch (error) {
    if (key === viewKey()) setStatus("Не удалось загрузить данные, попробуйте обновить страницу", false);
    console.error(error);
  } finally {
    busy(-1);
  }
}

async function loadPeople({ quiet = false } = {}) {
  const key = peopleKey();
  const { source, from, to, category } = state;
  const cached = peopleLists.get(key);
  if (cached) showPeople(cached.items);
  else showPeopleLoading();
  if (cached && !quiet && Date.now() - cached.at < FRESH_MS) return;
  busy(1);
  try {
    const items = await fetchPeople(source, from, to, category);
    if (key === peopleKey()) showPeople(items);
  } catch (error) {
    if (key === peopleKey()) $("people").innerHTML = `<li class="empty">Не удалось загрузить список</li>`;
    console.error(error);
  } finally {
    busy(-1);
  }
}

async function load(options = {}) {
  writeHash();
  renderHeader();
  await Promise.all([loadDashboard(options), loadPeople(options)]);
  prefetchSoon();
}

// In the background: the six usual periods of this source, every source for this period, and the lists.
let prefetchTimer = 0;
function prefetchSoon() {
  clearTimeout(prefetchTimer);
  prefetchTimer = setTimeout(prefetch, 300);
}
async function prefetch() {
  const jobs = [];
  const ranges = PRESETS.map((preset) => presetRange(preset).map(iso));
  const dash = (source, from, to) => { if (!dashboards.has(viewKey(source, from, to))) jobs.push(() => fetchDashboard(source, from, to)); };
  const list = (source, from, to) => { if (!peopleLists.has(peopleKey(source, from, to))) jobs.push(() => fetchPeople(source, from, to, state.category)); };
  ranges.forEach(([from, to]) => dash(state.source, from, to));
  ["all", ...meta.sources.map((s) => s.key)].forEach((source) => dash(source, state.from, state.to));
  ranges.forEach(([from, to]) => list(state.source, from, to));
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      try { await job(); } catch (e) { /* only a head start: the click will ask again */ }
    }
  };
  await Promise.all([worker(), worker()]);
  renderSources();  // counts for every source once the whole-network report is here
}

// ---- events --------------------------------------------------------------

function bind() {
  $("sources").addEventListener("click", (event) => {
    const item = event.target.closest("[data-source]");
    if (!item) return;
    state.source = item.dataset.source;
    state.page = 1;
    load();
  });
  $("sources-body").addEventListener("click", (event) => {
    const item = event.target.closest("[data-source]");
    if (!item) return;
    state.source = item.dataset.source;
    state.page = 1;
    window.scrollTo({ top: 0, behavior: "smooth" });
    load();
  });
  $("presets").addEventListener("click", (event) => {
    const button = event.target.closest("[data-preset]");
    if (!button) return;
    state.preset = button.dataset.preset;
    [state.from, state.to] = presetRange(state.preset).map(iso);
    state.page = 1;
    load();
  });
  bindPicker();
  bindPager();
  $("legend").addEventListener("click", (event) => {
    const item = event.target.closest("[data-series]");
    if (!item) return;
    const key = item.dataset.series;
    if (hiddenSeries.has(key)) hiddenSeries.delete(key);
    else if (hiddenSeries.size < SERIES.length - 1) hiddenSeries.add(key);  // one line always stays
    else return;
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hiddenSeries])); } catch (e) { /* storage blocked */ }
    if (dashboard) renderChart(dashboard);
  });
  $("tabs").addEventListener("click", (event) => {
    const tab = event.target.closest("[data-category]");
    if (!tab) return;
    state.category = tab.dataset.category;
    state.page = 1;
    renderTabs(dashboard?.total);
    loadPeople().then(prefetchSoon);
  });
  $("search").addEventListener("input", (event) => {
    state.search = event.target.value;
    state.page = 1;
    $("search-clear").hidden = !state.search;
    renderPeople();
  });
  $("search-clear").addEventListener("click", () => {
    $("search").value = "";
    state.search = "";
    state.page = 1;
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
    if (`${state.source}|${state.from}|${state.to}` !== before) { state.page = 1; load(); }
  });
  let resize;
  window.addEventListener("resize", () => {
    clearTimeout(resize);
    resize = setTimeout(() => dashboard && renderChart(dashboard), 150);
  });
}

(async function start() {
  if (API_BASE && !token()) { location.replace("login.html"); return; }  // on another site only the token signs in
  meta = await api("/api/meta");
  readHash();
  if (!state.from) [state.from, state.to] = presetRange(state.preset).map(iso);
  bind();
  await load();
  setInterval(() => { if (!document.hidden) load({ quiet: true }); }, 5 * 60 * 1000);
})();
