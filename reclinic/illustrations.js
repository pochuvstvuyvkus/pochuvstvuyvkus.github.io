/*!
 * Re:clinic Mini App — SVG illustration library
 * window.RCIllu = { kinds: [...], render(kind, opts) }
 * opts: { tone: {bg, accent, accent2}, label: "NAD+", variant: 0..3 }
 * Transparent background, viewBox 0 0 240 200, unique defs ids per call.
 */
(function (root) {
  'use strict';

  var COUNTER = 0;
  var FONT = "'Inter','SF Pro Display',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif";
  var BRAND = {
    green: '#497259', deep: '#2B4A34', mid: '#50745B', olive: '#545F4C',
    sand: '#C8B78A', sand2: '#C2BA9D', sage: '#EFF1EC', ink: '#111013', white: '#FFFFFF'
  };

  /* ---------- color utils ---------- */
  function clamp(v) { return Math.max(0, Math.min(255, Math.round(v))); }
  function hex2rgb(h) {
    h = String(h || '').replace('#', '').trim();
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    var n = parseInt(h, 16);
    if (h.length !== 6 || isNaN(n)) return [73, 114, 89];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgb2hex(r) {
    return '#' + r.map(function (v) { var s = clamp(v).toString(16); return s.length < 2 ? '0' + s : s; }).join('');
  }
  function mix(a, b, t) {
    var x = hex2rgb(a), y = hex2rgb(b);
    return rgb2hex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
  }
  function lt(c, t) { return mix(c, '#FFFFFF', t); }
  function dk(c, t) { return mix(c, '#141A15', t); }

  /* ---------- svg utils ---------- */
  function num(n) { return typeof n === 'number' ? Math.round(n * 100) / 100 : n; }
  function A(o) {
    var s = '';
    for (var k in o) {
      if (!Object.prototype.hasOwnProperty.call(o, k)) continue;
      if (o[k] === null || o[k] === undefined || o[k] === '') continue;
      s += ' ' + k + '="' + num(o[k]) + '"';
    }
    return s;
  }
  function ext(a, b) { var r = {}, k; for (k in a) r[k] = a[k]; for (k in b) r[k] = b[k]; return r; }
  function el(tag, o) { return '<' + tag + A(o || {}) + '/>'; }
  function path(d, o) { return '<path d="' + d + '"' + A(o || {}) + '/>'; }
  function rect(x, y, w, h, rx, o) { return el('rect', ext({ x: x, y: y, width: w, height: h, rx: rx || 0 }, o || {})); }
  function circ(cx, cy, r, o) { return el('circle', ext({ cx: cx, cy: cy, r: r }, o || {})); }
  function ell(cx, cy, rx, ry, o) { return el('ellipse', ext({ cx: cx, cy: cy, rx: rx, ry: ry }, o || {})); }
  function grp(inner, o) { return '<g' + A(o || {}) + '>' + (Array.isArray(inner) ? inner.join('') : inner) + '</g>'; }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function stopsStr(stops) {
    return stops.map(function (s) {
      return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : '') + '/>';
    }).join('');
  }
  var STK = { stroke: '#FFFFFF', 'stroke-width': 3, 'stroke-linejoin': 'round', 'paint-order': 'stroke' };

  /* ---------- per-render context ---------- */
  function Ctx(opts) {
    opts = opts || {};
    var tone = opts.tone || {};
    COUNTER += 1;
    this.k = 0;
    this.defs = [];
    this.prefix = 'rci' + COUNTER.toString(36) + Math.floor(Math.random() * 46656).toString(36);
    this.bg = tone.bg || '#E3EADF';
    this.a = tone.accent || BRAND.green;
    this.g = tone.accent2 || BRAND.sand;
    this.label = opts.label == null ? '' : String(opts.label);
    var v = parseInt(opts.variant, 10);
    this.v = isNaN(v) ? 0 : ((v % 4) + 4) % 4;
    // derived accent ramp
    this.a1 = lt(this.a, 0.34);
    this.a2 = dk(this.a, 0.26);
    this.a3 = lt(this.a, 0.74);
    this.a0 = dk(this.a, 0.55);
    // accent2 (sand/gold) ramp
    this.g1 = lt(this.g, 0.5);
    this.g2 = dk(this.g, 0.2);
    this.g3 = dk(this.g, 0.42);
    // soft whites tinted with accent
    this.w0 = '#FFFFFF';
    this.w1 = mix('#F4F6F1', this.a, 0.04);
    this.w2 = mix('#DFE5DB', this.a, 0.1);
    this.w3 = mix('#BCC5B6', this.a, 0.16);
    this.ink = mix(BRAND.deep, this.a, 0.22);
    this.blush = mix('#E28A73', this.a, 0.12);
  }
  Ctx.prototype.id = function (p) { this.k += 1; return this.prefix + '-' + (p || 'x') + this.k; };
  // objectBoundingBox linear gradient (fills only)
  Ctx.prototype.lin = function (stops, x1, y1, x2, y2) {
    var id = this.id('l');
    this.defs.push('<linearGradient id="' + id + '"' + A({ x1: x1 == null ? 0 : x1, y1: y1 == null ? 0 : y1, x2: x2 == null ? 0 : x2, y2: y2 == null ? 1 : y2 }) + '>' + stopsStr(stops) + '</linearGradient>');
    return 'url(#' + id + ')';
  };
  // userSpace linear gradient (safe for strokes)
  Ctx.prototype.linU = function (stops, x1, y1, x2, y2) {
    var id = this.id('u');
    this.defs.push('<linearGradient id="' + id + '" gradientUnits="userSpaceOnUse"' + A({ x1: x1, y1: y1, x2: x2, y2: y2 }) + '>' + stopsStr(stops) + '</linearGradient>');
    return 'url(#' + id + ')';
  };
  Ctx.prototype.rad = function (stops, cx, cy, r, fx, fy) {
    var id = this.id('r');
    this.defs.push('<radialGradient id="' + id + '"' + A({ cx: cx == null ? 0.5 : cx, cy: cy == null ? 0.5 : cy, r: r == null ? 0.5 : r, fx: fx, fy: fy }) + '>' + stopsStr(stops) + '</radialGradient>');
    return 'url(#' + id + ')';
  };
  Ctx.prototype.clip = function (inner) {
    var id = this.id('c');
    this.defs.push('<clipPath id="' + id + '">' + inner + '</clipPath>');
    return 'url(#' + id + ')';
  };
  Ctx.prototype.blur = function (std) {
    var id = this.id('f');
    this.defs.push('<filter id="' + id + '" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="' + std + '"/></filter>');
    return 'url(#' + id + ')';
  };

  /* soft elliptical ground shadow */
  Ctx.prototype.shadow = function (cx, cy, rx, ry, op) {
    var c = mix(this.a0, BRAND.ink, 0.35);
    op = op == null ? 0.3 : op;
    return ell(cx, cy, rx, ry, { fill: this.rad([[0, c, op], [0.5, c, op * 0.6], [1, c, 0]]) });
  };
  /* glossy white highlight */
  Ctx.prototype.gloss = function (d, op) { return path(d, { fill: '#FFFFFF', opacity: op == null ? 0.5 : op }); };
  Ctx.prototype.streak = function (d, w, op) {
    return path(d, { fill: 'none', stroke: '#FFFFFF', 'stroke-width': w || 3, 'stroke-linecap': 'round', opacity: op == null ? 0.7 : op });
  };

  /* ---------- floating sticker decor ---------- */
  function place(x, y, s, rot, inner) {
    return grp(inner, { transform: 'translate(' + num(x) + ' ' + num(y) + ') rotate(' + (rot || 0) + ') scale(' + (s || 1) + ')' });
  }
  Ctx.prototype.leaf = function (x, y, s, rot, color) {
    var c = color || this.a;
    return place(x, y, s, rot, [
      path('M0,-12 C9,-7 10,5 0,12 C-10,5 -9,-7 0,-12Z', ext(STK, { fill: this.lin([[0, lt(c, 0.38)], [1, dk(c, 0.1)]], 0, 0, 1, 1), 'stroke-width': 3.4 })),
      path('M0,-7 C0.8,-1 0.8,4 0,9', { fill: 'none', stroke: lt(c, 0.6), 'stroke-width': 1.3, 'stroke-linecap': 'round' })
    ]);
  };
  Ctx.prototype.sparkle = function (x, y, s, rot, color) {
    var c = color || this.g;
    return place(x, y, s, rot, [
      path('M0,-11 C1.4,-3.2 3.2,-1.4 11,0 C3.2,1.4 1.4,3.2 0,11 C-1.4,3.2 -3.2,1.4 -11,0 C-3.2,-1.4 -1.4,-3.2 0,-11Z',
        ext(STK, { fill: this.lin([[0, lt(c, 0.45)], [1, dk(c, 0.08)]], 0, 0, 1, 1), 'stroke-width': 3 }))
    ]);
  };
  Ctx.prototype.drop = function (x, y, s, rot, color) {
    var c = color || this.a;
    return place(x, y, s, rot, [
      path('M0,-12 C4,-6 8,-1 8,4 C8,8.8 4.4,12 0,12 C-4.4,12 -8,8.8 -8,4 C-8,-1 -4,-6 0,-12Z',
        ext(STK, { fill: this.lin([[0, lt(c, 0.4)], [1, dk(c, 0.12)]], 0, 0, 1, 1), 'stroke-width': 3.2 })),
      ell(-3, 4, 1.8, 3, { fill: '#FFFFFF', opacity: 0.75, transform: 'rotate(20 -3 4)' })
    ]);
  };
  Ctx.prototype.plus = function (x, y, s, rot, color) {
    var c = color || this.a;
    return place(x, y, s, rot, [
      path('M-3.4,-10 H3.4 V-3.4 H10 V3.4 H3.4 V10 H-3.4 V3.4 H-10 V-3.4 H-3.4Z',
        ext(STK, { fill: this.lin([[0, lt(c, 0.35)], [1, dk(c, 0.1)]], 0, 0, 1, 1), 'stroke-width': 3.2 }))
    ]);
  };
  Ctx.prototype.dot = function (x, y, r, color) {
    var c = color || this.a1;
    return circ(x, y, r, ext(STK, { fill: c, 'stroke-width': 2.4 }));
  };
  Ctx.prototype.molecule = function (x, y, s, rot, color) {
    var c = color || this.a, c2 = this.g;
    var line = { fill: 'none', 'stroke-linecap': 'round' };
    return place(x, y, s, rot, [
      path('M-8,5 L0,-5 L9,3', ext(line, { stroke: '#FFFFFF', 'stroke-width': 6 })),
      path('M-8,5 L0,-5 L9,3', ext(line, { stroke: dk(c, 0.1), 'stroke-width': 2.2 })),
      circ(-8, 5, 4.6, ext(STK, { fill: this.lin([[0, lt(c2, 0.4)], [1, c2]], 0, 0, 1, 1), 'stroke-width': 2.4 })),
      circ(0, -5, 5.6, ext(STK, { fill: this.lin([[0, lt(c, 0.4)], [1, dk(c, 0.08)]], 0, 0, 1, 1), 'stroke-width': 2.4 })),
      circ(9, 3, 4, ext(STK, { fill: this.lin([[0, lt(c, 0.55)], [1, lt(c, 0.1)]], 0, 0, 1, 1), 'stroke-width': 2.4 }))
    ]);
  };

  /* label text that fits the given box */
  Ctx.prototype.text = function (txt, cx, cy, maxW, maxH, color) {
    txt = String(txt || '').trim();
    if (!txt) return '';
    if (txt.length > 12) txt = txt.slice(0, 12);
    var len = txt.length;
    var fs = Math.min(maxH, maxW / (len * 0.64));
    fs = Math.max(6, Math.round(fs * 10) / 10);
    return '<text' + A({
      x: cx, y: cy + fs * 0.36, 'text-anchor': 'middle', 'font-family': FONT,
      'font-size': fs, 'font-weight': 800, fill: color || this.a2, 'letter-spacing': len > 5 ? 0 : 0.3
    }) + '>' + esc(txt) + '</text>';
  };

  var K = {};

  /* ===================== IV drip bag ===================== */
  K.iv = function (C) {
    var v = C.v, o = [];
    var bags = [
      'M88,40 H152 Q166,40 166,54 V112 Q166,130 148,131 H92 Q74,130 74,112 V54 Q74,40 88,40Z',
      'M86,40 H154 Q168,40 167,54 L162,110 Q160,124 146,129 L130,134 H110 L94,129 Q80,124 78,110 L73,54 Q72,40 86,40Z',
      'M96,40 H144 Q170,40 170,68 V102 Q170,131 140,132 H100 Q70,131 70,102 V68 Q70,40 96,40Z',
      'M102,40 H138 Q148,40 148,50 V54 Q166,60 166,78 V114 Q166,131 149,131 H91 Q74,131 74,114 V78 Q74,60 92,54 V50 Q92,40 102,40Z'
    ];
    var bag = bags[v];
    var portY = v === 1 ? 132 : 129;
    var metal = C.linU([[0, C.w0], [0.5, C.w2], [1, C.w3]], 0, 0, 0, 200);
    var metalH = C.linU([[0, C.w0], [0.55, C.w2], [1, C.w3]], 40, 0, 60, 0);

    o.push(C.shadow(118, 184, 92, 9, 0.26));
    // stand pole + base
    o.push(rect(43, 16, 7, 166, 3.5, { fill: metalH }));
    o.push(path('M24,184 L46.5,176 L69,184', { fill: 'none', stroke: C.w3, 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    o.push(circ(24, 185, 4, { fill: C.ink }), circ(69, 185, 4, { fill: C.ink }));
    // arm
    o.push(rect(40, 13, 92, 7, 3.5, { fill: C.lin([[0, C.w0], [1, C.w3]]) }));
    o.push(circ(46.5, 16.5, 5.5, { fill: C.lin([[0, C.g1], [1, C.g2]]) }));
    // hook + tab
    o.push(path('M120,19 V31', { stroke: C.w3, 'stroke-width': 3, 'stroke-linecap': 'round' }));
    o.push(rect(109, 28, 22, 16, 6, { fill: C.lin([[0, '#FFFFFF'], [1, C.w2]]) }));
    o.push(circ(120, 34, 3.4, { fill: 'none', stroke: C.w3, 'stroke-width': 2.4 }));

    // tube + drip chamber
    var cy0 = portY + 8, cy1 = portY + 30;
    var tubeD = 'M120,' + cy1 + ' C120,' + (cy1 + 22) + ' 150,' + (cy1 + 24) + ' 164,' + (cy1 + 12) + ' C172,' + (cy1 + 5) + ' 176,' + (cy1 - 6) + ' 178,' + (cy1 - 12);
    o.push(path(tubeD, { fill: 'none', stroke: C.w0, 'stroke-width': 6.5, 'stroke-linecap': 'round', opacity: 0.95 }));
    o.push(path(tubeD, { fill: 'none', stroke: C.a1, 'stroke-width': 2.4, 'stroke-linecap': 'round' }));
    o.push(rect(173.5, cy1 - 26, 9, 15, 3.5, { fill: C.lin([[0, C.g1], [1, C.g2]], 0, 0, 1, 0), transform: 'rotate(18 178 ' + (cy1 - 18) + ')' }));
    o.push(rect(114, portY - 4, 12, 13, 3, { fill: C.lin([[0, C.w0], [1, C.w2]], 0, 0, 1, 0) }));
    var chamber = rect(110, cy0, 20, cy1 - cy0, 7, {});
    var chClip = C.clip(chamber);
    o.push(rect(110, cy0, 20, cy1 - cy0, 7, { fill: '#FFFFFF', opacity: 0.6 }));
    o.push(grp([rect(106, cy1 - 9, 28, 12, 0, { fill: C.lin([[0, C.a1], [1, C.a]]) })], { 'clip-path': chClip }));
    o.push(path('M120,' + (cy0 + 5) + ' c2,3 3,4.4 3,5.6 a3,3 0 0 1 -6,0 c0,-1.2 1,-2.6 3,-5.6Z', { fill: C.a }));
    o.push(rect(110, cy0, 20, cy1 - cy0, 7, { fill: 'none', stroke: '#FFFFFF', 'stroke-width': 1.6 }));
    o.push(rect(114, cy0 + 4, 3, cy1 - cy0 - 8, 1.5, { fill: '#FFFFFF', opacity: 0.8 }));

    // bag back tint + liquid
    var bagClip = C.clip(path(bag));
    var lvl = [62, 58, 66, 74][v];
    o.push(path(bag, { fill: lt(C.a, 0.8) }));
    o.push(grp([
      path('M60,' + lvl + ' Q80,' + (lvl - 6) + ' 100,' + lvl + ' T140,' + lvl + ' T180,' + lvl + ' V150 H60Z', { fill: C.lin([[0, C.a1], [0.55, C.a], [1, C.a2]]) }),
      path('M60,' + lvl + ' Q80,' + (lvl - 6) + ' 100,' + lvl + ' T140,' + lvl + ' T180,' + lvl + ' V' + (lvl + 5) + ' Q160,' + (lvl + 1) + ' 140,' + (lvl + 5) + ' T100,' + (lvl + 5) + ' T60,' + (lvl + 5) + 'Z', { fill: '#FFFFFF', opacity: 0.28 }),
      rect(140, 30, 40, 110, 0, { fill: C.lin([[0, '#000', 0], [1, '#000', 0.16]], 0, 0, 1, 0) }),
      rect(60, 30, 26, 110, 0, { fill: C.lin([[0, '#FFFFFF', 0.45], [1, '#FFFFFF', 0]], 0, 0, 1, 0) }),
      rect(60, 38, 120, 9, 0, { fill: '#FFFFFF', opacity: 0.55 })
    ], { 'clip-path': bagClip }));
    o.push(path(bag, { fill: 'none', stroke: '#FFFFFF', 'stroke-width': 2.6, opacity: 0.95 }));
    o.push(C.streak('M82,58 Q80,84 82,112', 4, 0.75));
    // graduation ticks
    for (var i = 0; i < 4; i++) {
      o.push(path('M' + (v === 1 ? 152 : 155) + ',' + (72 + i * 12) + ' h7', { stroke: '#FFFFFF', 'stroke-width': 2, 'stroke-linecap': 'round', opacity: 0.85 }));
    }
    // label
    var lx = 92, ly = 78, lw = 56, lh = 34;
    o.push(rect(lx, ly + 2, lw, lh, 8, { fill: C.a0, opacity: 0.18 }));
    o.push(rect(lx, ly, lw, lh, 8, { fill: C.lin([[0, '#FFFFFF'], [1, C.w1]]) }));
    o.push(rect(lx + 6, ly + 5, 10, 3, 1.5, { fill: C.g }));
    if (C.label) {
      o.push(C.text(C.label, 120, ly + lh / 2 + 2, lw - 10, 15, C.a2));
    } else {
      o.push(rect(lx + 10, ly + 15, lw - 20, 5, 2.5, { fill: C.a1 }), rect(lx + 10, ly + 24, lw - 30, 4, 2, { fill: C.w2 }));
    }
    // decor
    var dec = [
      [C.drop(192, 110, 1.05, 0, C.a), C.sparkle(196, 46, 1, 0), C.leaf(214, 80, 0.8, 35, C.a1)],
      [C.drop(196, 102, 1.1, 0, C.a), C.sparkle(186, 44, 0.9, 0), C.dot(212, 70, 4, C.g)],
      [C.leaf(196, 58, 1, 28, C.a), C.sparkle(206, 100, 0.8, 0), C.dot(64, 64, 3.5, C.g)],
      [C.molecule(196, 60, 1.05, 0, C.a), C.drop(198, 108, 0.9, 0, C.a1), C.sparkle(74, 36, 0.7, 0)]
    ][v];
    o.push(dec.join(''));
    return o.join('');
  };

  /* ===================== Check-up: tubes + clipboard ===================== */
  K.checkup = function (C) {
    var o = [];
    o.push(C.shadow(122, 180, 96, 10, 0.28));
    // clipboard (behind, right)
    var cb = [];
    cb.push(rect(149, 55, 70, 114, 11, { fill: C.g3 }));
    cb.push(rect(146, 51, 70, 114, 11, { fill: C.lin([[0, C.g1], [0.5, C.g], [1, C.g2]], 0, 0, 1, 1) }));
    cb.push(rect(153, 64, 56, 94, 6, { fill: C.lin([[0, '#FFFFFF'], [1, C.w1]]) }));
    cb.push(rect(166, 44, 30, 15, 6, { fill: C.lin([[0, lt(C.ink, 0.25)], [1, C.ink]]) }));
    cb.push(circ(181, 49, 2.6, { fill: C.g1 }));
    for (var r = 0; r < 3; r++) {
      var y = 84 + r * 24;
      if (r < 2) {
        cb.push(circ(166, y, 7, { fill: C.lin([[0, C.a1], [1, C.a2]]) }));
        cb.push(path('M162.5,' + y + ' l2.6,2.8 l4.6,-5', { fill: 'none', stroke: '#FFFFFF', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      } else {
        cb.push(circ(166, y, 6, { fill: 'none', stroke: C.w3, 'stroke-width': 2 }));
      }
      cb.push(rect(177, y - 5, 26, 4, 2, { fill: C.w3, opacity: 0.8 }));
      cb.push(rect(177, y + 2, 16, 3.5, 1.75, { fill: C.w2 }));
    }
    o.push(grp(cb, { transform: 'rotate(9 182 110)' }));

    // rack back base
    o.push(rect(30, 150, 138, 24, 10, { fill: C.lin([[0, C.w1], [1, C.w3]]) }));
    o.push(rect(30, 150, 138, 7, 3.5, { fill: '#FFFFFF', opacity: 0.8 }));
    o.push(rect(38, 104, 8, 50, 3, { fill: C.w2 }), rect(152, 104, 8, 50, 3, { fill: C.w2 }));

    var xs = [58, 85, 112, 139];
    var liq = [mix('#C8594C', C.a, 0.1), mix(C.g, '#E3A33B', 0.45), C.a, mix('#C8594C', C.g, 0.35)];
    var caps = [C.a, C.g2, C.ink, C.blush];
    var lv = [70, 80, 66, 86];
    xs.forEach(function (x, i) {
      var tube = 'M' + (x - 10) + ',52 H' + (x + 10) + ' V146 A10,10 0 0 1 ' + (x - 10) + ',146Z';
      var tc = C.clip(path(tube));
      o.push(path(tube, { fill: C.lin([[0, '#FFFFFF', 0.85], [0.45, '#FFFFFF', 0.35], [1, '#FFFFFF', 0.7]], 0, 0, 1, 0) }));
      o.push(grp([
        rect(x - 12, lv[i], 24, 100, 0, { fill: C.lin([[0, lt(liq[i], 0.2)], [1, dk(liq[i], 0.15)]]) }),
        rect(x - 12, lv[i], 24, 100, 0, { fill: C.lin([[0, '#FFFFFF', 0.25], [0.5, '#FFFFFF', 0], [1, '#000', 0.12]], 0, 0, 1, 0) }),
        ell(x, lv[i], 10, 2.4, { fill: lt(liq[i], 0.35) })
      ], { 'clip-path': tc }));
      o.push(path(tube, { fill: 'none', stroke: '#FFFFFF', 'stroke-width': 1.6 }));
      o.push(rect(x - 6, 62, 3, 78, 1.5, { fill: '#FFFFFF', opacity: 0.85 }));
      // cap
      o.push(rect(x - 12, 38, 24, 18, 6, { fill: C.lin([[0, lt(caps[i], 0.3)], [0.5, caps[i]], [1, dk(caps[i], 0.25)]], 0, 0, 1, 0) }));
      o.push(rect(x - 9, 41, 18, 3.5, 1.75, { fill: '#FFFFFF', opacity: 0.4 }));
    });
    // front plate
    o.push(rect(28, 98, 142, 16, 8, { fill: C.lin([[0, '#FFFFFF'], [1, C.w2]]) }));
    o.push(rect(28, 108, 142, 6, 3, { fill: C.w3, opacity: 0.35 }));
    xs.forEach(function (x) { o.push(ell(x, 101.5, 11, 2, { fill: C.w3, opacity: 0.35 })); });

    o.push(C.sparkle(206, 30, 1, 0));
    o.push(C.drop(24, 70, 0.95, -10, mix('#C8594C', C.a, 0.1)));
    o.push(C.dot(214, 176, 3.6, C.a1));
    return o.join('');
  };

  /* ===================== Online consultation ===================== */
  K['consult-online'] = function (C) {
    var o = [];
    o.push(C.shadow(122, 184, 60, 8, 0.3));
    var ph = [];
    var bodyC = mix(C.a0, BRAND.ink, 0.35);
    ph.push(rect(80, 22, 84, 160, 21, { fill: dk(bodyC, 0.35) }));
    ph.push(rect(76, 18, 84, 160, 21, { fill: C.lin([[0, lt(bodyC, 0.28)], [1, bodyC]], 0, 0, 1, 1) }));
    ph.push(rect(82, 25, 72, 146, 15, { fill: C.lin([[0, C.a3], [1, lt(C.a, 0.5)]]) }));
    var tile = rect(88, 42, 60, 94, 11, {});
    var tc = C.clip(tile);
    ph.push(rect(88, 42, 60, 94, 11, { fill: C.lin([[0, lt(C.a, 0.58)], [1, lt(C.a, 0.3)]]) }));
    ph.push(grp([
      circ(118, 80, 15, { fill: C.lin([[0, C.g1], [1, C.g2]], 0, 0, 1, 1) }),
      path('M88,142 C90,114 104,101 118,101 C132,101 146,114 148,142Z', { fill: C.lin([[0, C.a1], [1, C.a2]]) }),
      ell(112, 74, 5, 4, { fill: '#FFFFFF', opacity: 0.45 })
    ], { 'clip-path': tc }));
    ph.push(rect(126, 112, 17, 20, 5, { fill: '#FFFFFF', stroke: '#FFFFFF', 'stroke-width': 1.5 }));
    ph.push(circ(134.5, 119, 3.5, { fill: C.w3 }), path('M129,132 C129,126 131.5,124.5 134.5,124.5 C137.5,124.5 140,126 140,132Z', { fill: C.w3 }));
    ph.push(rect(106, 29, 24, 6, 3, { fill: bodyC }));
    ph.push(circ(104, 154, 8.5, { fill: C.lin([[0, C.a1], [1, C.a2]]) }));
    ph.push(rect(101.8, 148.5, 4.4, 8, 2.2, { fill: '#FFFFFF' }), path('M99.5,154.5 a4.5,4.5 0 0 0 9,0', { fill: 'none', stroke: '#FFFFFF', 'stroke-width': 1.5, 'stroke-linecap': 'round' }));
    ph.push(circ(132, 154, 8.5, { fill: C.lin([[0, '#EE8C7C'], [1, '#C85A4C']]) }));
    ph.push(path('M126.5,155 q5.5,-4.5 11,0', { fill: 'none', stroke: '#FFFFFF', 'stroke-width': 2.6, 'stroke-linecap': 'round' }));
    ph.push(path('M86,32 Q86,22 96,21 L110,21 L84,120Z', { fill: '#FFFFFF', opacity: 0.12 }));
    o.push(grp(ph, { transform: 'rotate(-8 118 100)' }));

    // chat bubbles
    o.push(path('M36,46 H76 Q88,46 88,58 V70 Q88,82 76,82 H62 L52,92 L53,82 H36 Q24,82 24,70 V58 Q24,46 36,46Z', { fill: C.a0, opacity: 0.1, transform: 'translate(2 4)' }));
    o.push(path('M36,46 H76 Q88,46 88,58 V70 Q88,82 76,82 H62 L52,92 L53,82 H36 Q24,82 24,70 V58 Q24,46 36,46Z', { fill: C.lin([[0, '#FFFFFF'], [1, C.w1]]) }));
    o.push(circ(43, 64, 4, { fill: C.a1 }), circ(56, 64, 4, { fill: C.a }), circ(69, 64, 4, { fill: C.a2 }));
    o.push(path('M170,104 H208 Q220,104 220,116 V128 Q220,140 208,140 H196 L197,150 L186,140 H170 Q158,140 158,128 V116 Q158,104 170,104Z', { fill: C.a0, opacity: 0.12, transform: 'translate(2 4)' }));
    o.push(path('M170,104 H208 Q220,104 220,116 V128 Q220,140 208,140 H196 L197,150 L186,140 H170 Q158,140 158,128 V116 Q158,104 170,104Z', { fill: C.lin([[0, C.a1], [1, C.a2]], 0, 0, 1, 1) }));
    o.push(rect(169, 113, 40, 5, 2.5, { fill: '#FFFFFF', opacity: 0.95 }), rect(169, 124, 26, 5, 2.5, { fill: '#FFFFFF', opacity: 0.7 }));
    o.push(C.leaf(198, 50, 1.05, 32, C.a));
    o.push(C.sparkle(40, 136, 0.9, 0));
    o.push(C.dot(214, 80, 3.5, C.g));
    return o.join('');
  };

  /* ===================== Offline consultation: stethoscope + body-composition scale ===================== */
  K['consult-offline'] = function (C) {
    var o = [];
    o.push(C.shadow(120, 184, 102, 10, 0.28));
    // smart body-composition scale in perspective
    var top = 'M64,110 H176 Q189,110 193,121 L208,157 Q212,168 199,168 H41 Q28,168 32,157 L47,121 Q51,110 64,110Z';
    o.push(path(top, { fill: C.lin([[0, C.w2], [1, C.w3]]), transform: 'translate(0 10)' }));
    o.push(path('M32,160 Q28,168 41,168 H199 Q212,168 208,160 V168 Q212,178 199,178 H41 Q28,178 32,168Z', { fill: C.lin([[0, C.w2], [0.5, C.w1], [1, C.w3]], 0, 0, 1, 0) }));
    o.push(path(top, { fill: C.lin([[0, '#FFFFFF'], [1, C.w1]]) }));
    o.push(path(top, { fill: 'none', stroke: '#FFFFFF', 'stroke-width': 2, opacity: 0.9 }));
    var pad = C.lin([[0, C.g1], [0.55, C.g], [1, C.g2]], 0, 0, 1, 1);
    var padA = { fill: pad, stroke: C.g, 'stroke-width': 3, 'stroke-linejoin': 'round' };
    o.push(path('M62,124 H92 L89,136 H57Z', padA), path('M54,146 H87 L84,158 H49Z', padA));
    o.push(path('M148,124 H178 L183,136 H151Z', padA), path('M153,146 H186 L191,158 H156Z', padA));
    o.push(path('M63,125 H90', { stroke: '#FFFFFF', 'stroke-width': 1.4, opacity: 0.6, 'stroke-linecap': 'round' }), path('M56,147 H85', { stroke: '#FFFFFF', 'stroke-width': 1.4, opacity: 0.6, 'stroke-linecap': 'round' }));
    o.push(rect(101, 118, 38, 18, 6, { fill: C.lin([[0, lt(C.ink, 0.15)], [1, dk(C.ink, 0.3)]]) }));
    o.push(path('M112,131 A8,8 0 1 1 128,131', { fill: 'none', stroke: lt(C.a, 0.15), 'stroke-width': 2.6, 'stroke-linecap': 'round' }));
    o.push(path('M112,131 A8,8 0 0 1 124,124.2', { fill: 'none', stroke: C.g1, 'stroke-width': 2.6, 'stroke-linecap': 'round' }));

    // stethoscope
    var metal = C.linU([[0, C.g1], [1, C.g2]], 60, 20, 110, 100);
    o.push(path('M70,40 C66,66 76,84 92,94', { fill: 'none', stroke: metal, 'stroke-width': 4.5, 'stroke-linecap': 'round' }));
    o.push(path('M108,34 C114,62 106,84 92,94', { fill: 'none', stroke: metal, 'stroke-width': 4.5, 'stroke-linecap': 'round' }));
    o.push(ell(70, 36, 5.5, 6.5, { fill: C.lin([[0, lt(C.ink, 0.3)], [1, C.ink]]), transform: 'rotate(-12 70 36)' }));
    o.push(ell(108, 30, 5.5, 6.5, { fill: C.lin([[0, lt(C.ink, 0.3)], [1, C.ink]]), transform: 'rotate(14 108 30)' }));
    var tubeD = 'M92,94 C84,114 102,112 126,100 C152,87 194,88 193,118 C192,134 184,140 176,142';
    var tubeC = mix(C.a0, BRAND.ink, 0.25);
    o.push(path(tubeD, { fill: 'none', stroke: tubeC, 'stroke-width': 8, 'stroke-linecap': 'round' }));
    o.push(path(tubeD, { fill: 'none', stroke: lt(tubeC, 0.4), 'stroke-width': 2.2, 'stroke-linecap': 'round', opacity: 0.6, transform: 'translate(-1.2 -1.6)' }));
    o.push(circ(92, 94, 5.5, { fill: C.lin([[0, C.g1], [1, C.g2]]) }));
    // chest piece
    o.push(ell(168, 168, 22, 5, { fill: C.a0, opacity: 0.15 }));
    o.push(circ(168, 152, 20, { fill: C.lin([[0, '#FFFFFF'], [0.5, C.g1], [1, C.g2]], 0, 0, 1, 1) }));
    o.push(circ(168, 152, 14, { fill: C.lin([[0, C.a1], [1, C.a2]], 0, 0, 1, 1) }));
    o.push(circ(168, 152, 7, { fill: 'none', stroke: '#FFFFFF', 'stroke-width': 1.6, opacity: 0.5 }));
    o.push(path('M160,144 A11,11 0 0 1 170,140', { fill: 'none', stroke: '#FFFFFF', 'stroke-width': 2.4, 'stroke-linecap': 'round', opacity: 0.8 }));

    o.push(C.plus(204, 52, 1, 0, C.a));
    o.push(C.sparkle(34, 84, 0.85, 0));
    o.push(C.dot(150, 40, 3.6, C.g));
    return o.join('');
  };

  /* ===================== Cosmetology: serum + cream jar ===================== */
  K.cosmetology = function (C) {
    var o = [];
    o.push(C.shadow(122, 181, 84, 9, 0.28));
    var glass = C.lin([[0, dk(C.a, 0.12)], [0.3, lt(C.a, 0.28)], [0.65, C.a], [1, dk(C.a, 0.38)]], 0, 0, 1, 0);
    // bulb
    o.push(path('M80,60 V38 Q80,18 93,18 Q106,18 106,38 V60Z', { fill: C.lin([[0, lt(C.ink, 0.3)], [0.5, C.ink], [1, dk(C.ink, 0.35)]], 0, 0, 1, 0) }));
    o.push(rect(85, 26, 4, 22, 2, { fill: '#FFFFFF', opacity: 0.35 }));
    // collar
    o.push(rect(75, 56, 36, 22, 5, { fill: C.lin([[0, C.g1], [0.45, C.g], [1, C.g3]], 0, 0, 1, 0) }));
    for (var i = 0; i < 5; i++) o.push(rect(80 + i * 6.5, 59, 1.6, 16, 0.8, { fill: C.g3, opacity: 0.35 }));
    // bottle
    var body ='M84,76 H102 Q108,76 108,82 V86 Q126,90 126,108 V162 Q126,178 110,178 H76 Q60,178 60,162 V108 Q60,90 78,86 V82 Q78,76 84,76Z';
    o.push(path(body, { fill: glass }));
    o.push(path(body, { fill: C.lin([[0, '#FFFFFF', 0.22], [0.4, '#FFFFFF', 0], [1, '#000', 0.12]]) }));
    o.push(rect(65, 100, 6, 64, 3, { fill: '#FFFFFF', opacity: 0.55 }));
    o.push(circ(68, 94, 2.2, { fill: '#FFFFFF', opacity: 0.6 }));
    // label
    o.push(rect(70, 116, 48, 38, 7, { fill: C.lin([[0, '#FFFFFF'], [1, C.w1]]) }));
    if (C.label) {
      o.push(C.text(C.label, 94, 136, 40, 13, C.a2));
    } else {
      o.push(path('M94,124 C99,127 99.5,133 94,137 C88.5,133 89,127 94,124Z', { fill: C.a }));
      o.push(rect(80, 142, 28, 4, 2, { fill: C.w3 }));
    }
    // jar
    o.push(rect(126, 134, 76, 46, 13, { fill: C.lin([[0, C.w2], [0.3, '#FFFFFF'], [1, C.w3]], 0, 0, 1, 0) }));
    o.push(rect(126, 150, 76, 13, 0, { fill: C.lin([[0, C.a1], [1, C.a2]], 0, 0, 1, 0), opacity: 0.92 }));
    o.push(circ(164, 156.5, 3, { fill: '#FFFFFF', opacity: 0.85 }));
    o.push(rect(132, 139, 5, 36, 2.5, { fill: '#FFFFFF', opacity: 0.8 }));
    o.push(rect(122, 116, 84, 24, 9, { fill: C.lin([[0, C.g1], [0.4, C.g], [1, C.g3]], 0, 0, 1, 0) }));
    o.push(rect(126, 118, 76, 5, 2.5, { fill: '#FFFFFF', opacity: 0.45 }));
    o.push(rect(122, 132, 84, 4, 2, { fill: C.g3, opacity: 0.35 }));

    o.push(C.sparkle(42, 48, 1.1, 0));
    o.push(C.sparkle(150, 70, 0.8, 0, C.a1));
    o.push(C.sparkle(206, 88, 0.6, 0));
    o.push(C.drop(38, 134, 0.8, 0, C.a1));
    return o.join('');
  };

  /* ===================== Weight program: dress form + measuring tape ===================== */
  K['program-weight'] = function (C) {
    var o = [];
    o.push(C.shadow(120, 184, 58, 7, 0.3));
    var goldV = C.lin([[0, C.g1], [0.5, C.g], [1, C.g2]]);
    // stand
    o.push(ell(120, 178, 28, 7, { fill: C.g3 }));
    o.push(ell(120, 176, 28, 6.5, { fill: C.lin([[0, C.g1], [1, C.g2]], 0, 0, 1, 0) }));
    o.push(rect(116, 148, 8, 29, 3, { fill: C.lin([[0, C.g1], [1, C.g3]], 0, 0, 1, 0) }));
    o.push(rect(110, 20, 20, 14, 6, { fill: C.lin([[0, C.g1], [1, C.g2]], 0, 0, 1, 0) }));
    // back band of the tape (visible at sides)
    o.push(path('M90,97 C104,90 136,90 150,97 L150,108 C136,101 104,101 90,108Z', { fill: C.g3 }));
    // torso
    var torso = 'M120,30 C142,30 166,33 168,48 C170,63 158,76 150,88 C144,98 144,106 150,117 C159,132 168,142 160,151 C150,159 90,159 80,151 C72,142 81,132 90,117 C96,106 96,98 90,88 C82,76 70,63 72,48 C74,33 98,30 120,30Z';
    o.push(path(torso, { fill: C.lin([[0, C.a1], [0.5, C.a], [1, C.a2]], 0, 0, 1, 0) }));
    o.push(path(torso, { fill: C.rad([[0, '#FFFFFF', 0.45], [1, '#FFFFFF', 0]], 0.3, 0.2, 0.55) }));
    o.push(path('M104,36 C98,64 106,92 104,154', { fill: 'none', stroke: C.a2, 'stroke-width': 1.4, opacity: 0.35 }));
    o.push(path('M136,36 C142,64 134,92 136,154', { fill: 'none', stroke: C.a2, 'stroke-width': 1.4, opacity: 0.35 }));
    o.push(C.streak('M82,50 C80,62 86,74 92,82', 4, 0.55));
    // front band
    o.push(path('M86,96 C102,106 138,106 154,96 L154,109 C138,119 102,119 86,109Z', { fill: goldV }));
    for (var x = 92; x <= 148; x += 4) {
      var t = (x - 120) / 34, yt = 96 + 7.7 * (1 - t * t);
      o.push(path('M' + x + ',' + (yt + 1.2) + ' v' + ((x % 8 === 0) ? 5 : 3), { stroke: C.g3, 'stroke-width': 1.1, 'stroke-linecap': 'round', opacity: 0.75 }));
    }
    o.push(path('M88,98.5 C104,108 136,108 152,98.5', { fill: 'none', stroke: '#FFFFFF', 'stroke-width': 1.4, opacity: 0.55 }));
    // hanging tail
    var tail = 'M152,103 C170,106 186,122 180,142 C176,156 164,164 150,170';
    o.push(path(tail, { fill: 'none', stroke: C.g2, 'stroke-width': 12, 'stroke-linecap': 'butt', transform: 'translate(0 1.5)' }));
    o.push(path(tail, { fill: 'none', stroke: C.linU([[0, C.g1], [1, C.g]], 150, 100, 185, 170), 'stroke-width': 12, 'stroke-linecap': 'butt' }));
    o.push(path(tail, { fill: 'none', stroke: C.g3, 'stroke-width': 5, 'stroke-dasharray': '1.1 3.2', opacity: 0.55, transform: 'translate(-2.5 -1)' }));
    o.push(rect(143, 164, 9, 13, 2, { fill: C.lin([[0, '#FFFFFF'], [1, C.w3]]), transform: 'rotate(64 148 170)' }));
    o.push(C.leaf(46, 66, 1.15, -32, C.a));
    o.push(C.leaf(62, 44, 0.7, 20, C.a1));
    o.push(C.sparkle(196, 50, 0.95, 0));
    return o.join('');
  };

  /* ===================== Anti-age: DNA helix + hourglass ===================== */
  K['program-antiage'] = function (C) {
    var o = [];
    o.push(C.shadow(122, 184, 92, 8, 0.28));
    var cx = 78, A = 24, y0 = 26, y1 = 170, N = 64, items = [];
    var colA = C.a, colB = C.g;
    function X(th, s) { return cx + s * A * Math.sin(th); }
    function Z(th, s) { return s * Math.cos(th); }
    var turns = 2.3 * Math.PI;
    for (var s = -1; s <= 1; s += 2) {
      for (var i = 0; i < N; i++) {
        var ta = i / N * turns, tb = (i + 1) / N * turns;
        var ya = y0 + (y1 - y0) * i / N, yb = y0 + (y1 - y0) * (i + 1) / N;
        var z = (Z(ta, s) + Z(tb, s)) / 2;
        var col = s > 0 ? colA : colB;
        items.push({ z: z, s: path('M' + X(ta, s).toFixed(2) + ',' + ya.toFixed(2) + ' L' + X(tb, s).toFixed(2) + ',' + yb.toFixed(2),
          { stroke: z < 0 ? mix(col, C.bg, 0.35) : col, 'stroke-width': 6.5 + 2.5 * z, 'stroke-linecap': 'round' }) });
      }
    }
    var gA = C.lin([[0, lt(colA, 0.45)], [1, dk(colA, 0.15)]], 0.2, 0.1, 0.9, 0.9);
    var gB = C.lin([[0, lt(colB, 0.45)], [1, dk(colB, 0.2)]], 0.2, 0.1, 0.9, 0.9);
    for (var k = 0; k <= 9; k++) {
      var th = (k + 0.5) / 10.4 * turns;
      var y = y0 + (y1 - y0) * (k + 0.5) / 10.4;
      var xa = X(th, 1), xb = X(th, -1), za = Z(th, 1);
      if (Math.abs(xa - xb) > 6) {
        var mid = (xa + xb) / 2;
        items.push({ z: -0.001, s: path('M' + xa.toFixed(2) + ',' + y.toFixed(2) + ' H' + mid.toFixed(2), { stroke: lt(colA, 0.45), 'stroke-width': 3.2, 'stroke-linecap': 'round' }) });
        items.push({ z: -0.001, s: path('M' + mid.toFixed(2) + ',' + y.toFixed(2) + ' H' + xb.toFixed(2), { stroke: lt(colB, 0.35), 'stroke-width': 3.2, 'stroke-linecap': 'round' }) });
      }
      items.push({ z: za + 0.01, s: circ(xa, y, 5.2 + 1.6 * za, { fill: gA }) });
      items.push({ z: -za + 0.01, s: circ(xb, y, 5.2 - 1.6 * za, { fill: gB }) });
    }
    items.sort(function (p, q) { return p.z - q.z; });
    o.push(items.map(function (it) { return it.s; }).join(''));

    // hourglass
    var hx = 172;
    var capF = C.lin([[0, C.a1], [0.5, C.a], [1, C.a2]], 0, 0, 1, 0);
    o.push(rect(hx - 29, 74, 5, 92, 2.5, { fill: C.a2 }), rect(hx + 24, 74, 5, 92, 2.5, { fill: C.a2 }));
    var glassD = 'M' + (hx - 22) + ',76 H' + (hx + 22) + ' C' + (hx + 22) + ',102 ' + (hx + 4) + ',112 ' + (hx + 3) + ',121 C' + (hx + 4) + ',130 ' + (hx + 22) + ',140 ' + (hx + 22) + ',166 H' + (hx - 22) + ' C' + (hx - 22) + ',140 ' + (hx - 4) + ',130 ' + (hx - 3) + ',121 C' + (hx - 4) + ',112 ' + (hx - 22) + ',102 ' + (hx - 22) + ',76Z';
    var gc = C.clip(path(glassD));
    o.push(path(glassD, { fill: '#FFFFFF', opacity: 0.5 }));
    var sand = C.lin([[0, C.g1], [1, C.g2]]);
    o.push(grp([
      path('M' + (hx - 30) + ',100 H' + (hx + 30) + ' V130 H' + (hx - 30) + 'Z', { fill: sand }),
      path('M' + (hx - 30) + ',166 V156 C' + (hx - 18) + ',150 ' + (hx - 8) + ',140 ' + hx + ',140 C' + (hx + 8) + ',140 ' + (hx + 18) + ',150 ' + (hx + 30) + ',156 V166Z', { fill: sand }),
      rect(hx - 0.9, 118, 1.8, 26, 0.9, { fill: C.g2 })
    ], { 'clip-path': gc }));
    o.push(path(glassD, { fill: 'none', stroke: '#FFFFFF', 'stroke-width': 1.8 }));
    o.push(C.streak('M' + (hx - 16) + ',84 C' + (hx - 15) + ',98 ' + (hx - 9) + ',108 ' + (hx - 6) + ',113', 2.6, 0.9));
    o.push(rect(hx - 34, 64, 68, 13, 6, { fill: capF }), rect(hx - 34, 164, 68, 13, 6, { fill: capF }));
    o.push(rect(hx - 30, 66, 60, 3.5, 1.75, { fill: '#FFFFFF', opacity: 0.4 }), rect(hx - 30, 166, 60, 3.5, 1.75, { fill: '#FFFFFF', opacity: 0.4 }));

    o.push(C.sparkle(206, 38, 1.05, 0));
    o.push(C.sparkle(134, 34, 0.65, 0, C.a1));
    o.push(C.dot(214, 106, 3.4, C.a1));
    return o.join('');
  };

  /* ===================== Energy: battery + bolt ===================== */
  K['program-energy'] = function (C) {
    var o = [], b = [];
    o.push(C.shadow(122, 184, 56, 7.5, 0.3));
    b.push(rect(106, 22, 28, 16, 5, { fill: C.lin([[0, C.g1], [0.5, C.g], [1, C.g3]], 0, 0, 1, 0) }));
    b.push(rect(80, 36, 88, 146, 24, { fill: C.w3 }));
    b.push(rect(76, 32, 88, 146, 24, { fill: C.lin([[0, '#FFFFFF'], [0.55, C.w1], [1, C.w2]], 0, 0, 1, 0) }));
    b.push(rect(86, 44, 68, 122, 15, { fill: C.w2, opacity: 0.7 }));
    var seg = C.lin([[0, C.a1], [1, C.a2]], 0, 0, 1, 1);
    [[70, 28], [104, 28], [138, 28]].forEach(function (s) {
      b.push(rect(92, s[0], 56, s[1], 9, { fill: seg }));
      b.push(rect(96, s[0] + 3, 48, 5, 2.5, { fill: '#FFFFFF', opacity: 0.3 }));
    });
    b.push(rect(92, 50, 56, 14, 7, { fill: 'none', stroke: C.w3, 'stroke-width': 1.6, 'stroke-dasharray': '3 3', opacity: 0.8 }));
    b.push(rect(81, 44, 7, 120, 3.5, { fill: '#FFFFFF', opacity: 0.8 }));
    b.push(path('M131,56 L98,116 H119 L109,160 L148,94 H126 L140,56Z', ext(STK, { fill: C.lin([[0, C.g1], [0.6, C.g], [1, C.g2]], 0, 0, 1, 1), 'stroke-width': 5 })));
    b.push(path('M131,62 L106,110 H114', { fill: 'none', stroke: '#FFFFFF', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.6 }));
    o.push(grp(b, { transform: 'rotate(10 120 104)' }));
    o.push(C.drop(46, 124, 1.35, -12, C.a));
    o.push(C.sparkle(196, 44, 1.05, 0));
    o.push(C.sparkle(206, 146, 0.65, 0, C.a1));
    o.push(C.dot(52, 70, 3.6, C.g));
    return o.join('');
  };

  /* ===================== Peptide box with vials ===================== */
  K['peptide-box'] = function (C) {
    var o = [];
    o.push(C.shadow(120, 183, 96, 9, 0.28));
    // lid leaning behind
    o.push(grp([
      rect(112, 40, 104, 70, 10, { fill: C.lin([[0, C.a1], [1, C.a2]], 0, 0, 1, 1) }),
      rect(156, 40, 16, 70, 0, { fill: C.lin([[0, C.g1], [1, C.g2]], 0, 0, 1, 0) })
    ], { transform: 'rotate(14 164 75)' }));
    // box interior
    o.push(path('M48,96 Q48,88 56,88 H184 Q192,88 192,96 V120 H48Z', { fill: C.lin([[0, dk(C.a, 0.5)], [1, dk(C.a, 0.3)]]) }));
    var xs = [70, 100, 130, 160];
    var capC = [C.g, lt(C.a, 0.25), C.g, lt(C.ink, 0.2)];
    var liqC = [lt(C.a, 0.45), lt(C.g, 0.3), lt(C.a, 0.2), lt(C.g, 0.05)];
    xs.forEach(function (x, i) {
      var top = 44 + (i % 2) * 6;
      o.push(rect(x - 12, top + 20, 24, 70, 7, { fill: C.lin([[0, '#FFFFFF', 0.95], [0.5, '#FFFFFF', 0.6], [1, C.w2, 0.95]], 0, 0, 1, 0) }));
      o.push(rect(x - 10, top + 44, 20, 44, 5, { fill: C.lin([[0, liqC[i]], [1, dk(liqC[i], 0.15)]]) }));
      o.push(rect(x - 10, top + 30, 20, 14, 3, { fill: '#FFFFFF' }));
      o.push(rect(x - 10, top + 30, 20, 4, 2, { fill: C.a, opacity: 0.85 }));
      o.push(rect(x - 7, top + 12, 14, 10, 2, { fill: C.lin([[0, '#FFFFFF'], [1, C.w2]], 0, 0, 1, 0) }));
      o.push(rect(x - 11, top, 22, 15, 4, { fill: C.lin([[0, lt(capC[i], 0.35)], [0.5, capC[i]], [1, dk(capC[i], 0.3)]], 0, 0, 1, 0) }));
      o.push(rect(x - 8, top + 2.5, 16, 3, 1.5, { fill: '#FFFFFF', opacity: 0.45 }));
      o.push(rect(x - 8, top + 24, 3, 40, 1.5, { fill: '#FFFFFF', opacity: 0.9 }));
    });
    // front wall
    o.push(rect(40, 112, 160, 66, 12, { fill: C.lin([[0, C.a1], [0.5, C.a], [1, C.a2]], 0, 0, 1, 0) }));
    o.push(rect(40, 112, 160, 66, 12, { fill: C.lin([[0, '#FFFFFF', 0.22], [0.4, '#FFFFFF', 0], [1, '#000', 0.1]]) }));
    o.push(rect(44, 114, 152, 6, 3, { fill: '#FFFFFF', opacity: 0.35 }));
    o.push(rect(40, 136, 160, 16, 0, { fill: C.lin([[0, C.g1], [0.5, C.g], [1, C.g2]]) }));
    var lw = C.label ? 58 : 34;
    o.push(rect(120 - lw / 2, 129, lw, 30, 8, { fill: C.a0, opacity: 0.15, transform: 'translate(0 2)' }));
    o.push(rect(120 - lw / 2, 129, lw, 30, 8, { fill: C.lin([[0, '#FFFFFF'], [1, C.w1]]) }));
    if (C.label) o.push(C.text(C.label, 120, 144, lw - 10, 13, C.a2));
    else o.push(path('M120,134 C127,138 128,148 120,154 C112,148 113,138 120,134Z', { fill: C.a }), path('M120,139 V151', { stroke: '#FFFFFF', 'stroke-width': 1.2, 'stroke-linecap': 'round' }));
    o.push(C.sparkle(30, 62, 1.05, 0));
    o.push(C.sparkle(214, 150, 0.7, 0, C.a1));
    o.push(C.molecule(22, 98, 0.72, -10, C.a));
    return o.join('');
  };

  /* ===================== Telegram login: paper plane + shield ===================== */
  K['telegram-login'] = function (C) {
    var o = [];
    o.push(C.shadow(104, 184, 60, 8, 0.3));
    var sh = 'M104,34 C120,44 140,48 158,48 V98 C158,136 134,162 104,176 C74,162 50,136 50,98 V48 C68,48 88,44 104,34Z';
    o.push(path(sh, { fill: C.a2, transform: 'translate(4 5)' }));
    o.push(path(sh, { fill: C.lin([[0, C.a1], [0.55, C.a], [1, C.a2]], 0, 0, 1, 1) }));
    o.push(path(sh, { fill: 'none', stroke: '#FFFFFF', 'stroke-width': 3.5, opacity: 0.35, transform: 'translate(104 104) scale(0.8) translate(-104 -104)' }));
    o.push(path('M104,40 C88,49 72,53 56,53 V98 C56,124 66,142 84,156 C76,130 76,80 104,40Z', { fill: '#FFFFFF', opacity: 0.16 }));
    o.push(path('M80,104 L97,121 L130,86', { fill: 'none', stroke: C.a0, 'stroke-width': 13, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.22, transform: 'translate(0 3)' }));
    o.push(path('M80,104 L97,121 L130,86', { fill: 'none', stroke: '#FFFFFF', 'stroke-width': 13, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    // dashed trail
    o.push(path('M150,96 C136,108 150,126 170,122 C190,118 198,134 190,150', { fill: 'none', stroke: C.a2, 'stroke-width': 2.4, 'stroke-dasharray': '1 7', 'stroke-linecap': 'round', opacity: 0.55 }));
    // paper plane
    var pl = [];
    pl.push(path('M132,74 L218,30 L186,110 L162,92Z', { fill: '#FFFFFF', stroke: '#FFFFFF', 'stroke-width': 6, 'stroke-linejoin': 'round' }));
    pl.push(path('M132,74 L218,30 L162,90Z', { fill: C.lin([[0, '#FFFFFF'], [1, C.w1]], 0, 0, 1, 1) }));
    pl.push(path('M162,90 L218,30 L186,110Z', { fill: C.lin([[0, lt(C.a, 0.55)], [1, C.a1]], 0, 0, 1, 1) }));
    pl.push(path('M162,90 L170,114 L178,100Z', { fill: C.lin([[0, C.a], [1, C.a2]]) }));
    pl.push(path('M162,90 L218,30', { stroke: C.w3, 'stroke-width': 1.2, opacity: 0.6 }));
    o.push(grp(pl, { transform: 'translate(-6 4)' }));
    o.push(C.sparkle(40, 36, 1, 0));
    o.push(C.dot(200, 150, 3.8, C.g));
    o.push(C.sparkle(188, 170, 0.6, 0, C.a1));
    return o.join('');
  };

  /* ===================== Success badge + confetti ===================== */
  K.success = function (C) {
    var o = [];
    o.push(C.shadow(120, 180, 58, 8, 0.3));
    var pts = [], n = 120, cx = 120, cy = 96;
    for (var i = 0; i < n; i++) {
      var t = i / n * Math.PI * 2, r = 58 + 3.6 * Math.cos(t * 14);
      pts.push((cx + r * Math.sin(t)).toFixed(2) + ',' + (cy - r * Math.cos(t)).toFixed(2));
    }
    var ros = 'M' + pts.join(' L') + 'Z';
    o.push(path(ros, { fill: C.a2, transform: 'translate(0 5)' }));
    o.push(path(ros, { fill: C.lin([[0, C.a1], [0.5, C.a], [1, C.a2]], 0, 0, 1, 1) }));
    o.push(circ(cx, cy, 44, { fill: C.lin([[0, dk(C.a, 0.1)], [1, lt(C.a, 0.18)]], 0, 0, 1, 1), stroke: '#FFFFFF', 'stroke-width': 2.2, 'stroke-opacity': 0.4 }));
    o.push(path('M78,78 A48,48 0 0 1 128,46 A56,56 0 0 0 78,78Z', { fill: '#FFFFFF', opacity: 0.25 }));
    o.push(path('M98,98 L114,114 L144,82', { fill: 'none', stroke: C.a0, 'stroke-width': 13, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.25, transform: 'translate(0 3)' }));
    o.push(path('M98,98 L114,114 L144,82', { fill: 'none', stroke: '#FFFFFF', 'stroke-width': 13, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    // confetti
    var cf = function (x, y, w, h, rot, col) { return rect(x - w / 2, y - h / 2, w, h, 2, ext(STK, { fill: col, 'stroke-width': 2.4, transform: 'rotate(' + rot + ' ' + x + ' ' + y + ')' })); };
    o.push(cf(40, 50, 7, 14, 28, C.g), cf(194, 34, 6, 13, -24, C.blush), cf(208, 138, 7, 14, 50, C.a1), cf(56, 160, 6, 12, -40, C.blush));
    o.push(path('M20,104 q6,-8 12,0 t12,0', { fill: 'none', stroke: '#FFFFFF', 'stroke-width': 6.5, 'stroke-linecap': 'round' }));
    o.push(path('M20,104 q6,-8 12,0 t12,0', { fill: 'none', stroke: C.a1, 'stroke-width': 3, 'stroke-linecap': 'round' }));
    o.push(path('M196,86 q6,-8 12,0 t12,0', { fill: 'none', stroke: '#FFFFFF', 'stroke-width': 6.5, 'stroke-linecap': 'round' }));
    o.push(path('M196,86 q6,-8 12,0 t12,0', { fill: 'none', stroke: C.g, 'stroke-width': 3, 'stroke-linecap': 'round' }));
    o.push(C.sparkle(66, 24, 0.9, 0), C.sparkle(186, 168, 0.8, 0, C.a1));
    o.push(C.dot(160, 22, 4, C.a1), C.dot(30, 140, 3.4, C.g), C.dot(214, 60, 3, C.a));
    return o.join('');
  };

  /* ===================== Empty cart: shopping bag ===================== */
  K['empty-cart'] = function (C) {
    var o = [];
    o.push(C.shadow(122, 183, 74, 8, 0.28));
    var hC = dk(C.a, 0.35);
    o.push(path('M110,70 C110,34 152,34 152,70', { fill: 'none', stroke: hC, 'stroke-width': 5.5, 'stroke-linecap': 'round' }));
    o.push(path('M66,78 L90,66 H186 L162,78Z', { fill: dk(C.a, 0.52) }));
    o.push(path('M162,78 L186,66 L194,162 Q194.5,168 189,171 L170,180Z', { fill: C.lin([[0, C.a2], [1, dk(C.a, 0.42)]], 0, 0, 1, 0) }));
    var front = 'M66,78 H162 L170,172 Q170,180 162,180 H58 Q50,180 50.6,172Z';
    o.push(path(front, { fill: C.lin([[0, C.a1], [0.6, C.a], [1, dk(C.a, 0.12)]], 0, 0, 1, 1) }));
    o.push(path('M66,78 H162 L163,90 H65Z', { fill: '#FFFFFF', opacity: 0.22 }));
    o.push(C.streak('M68,96 L62,166', 4, 0.35));
    o.push(path('M88,88 C88,50 136,50 136,88', { fill: 'none', stroke: C.lin([[0, C.g1], [1, C.g2]], 0, 0, 1, 0), 'stroke-width': 6, 'stroke-linecap': 'round' }));
    o.push(circ(88, 90, 4.2, { fill: dk(C.a, 0.4) }), circ(136, 90, 4.2, { fill: dk(C.a, 0.4) }));
    o.push(circ(88, 90, 2, { fill: C.g1 }), circ(136, 90, 2, { fill: C.g1 }));
    o.push(circ(111, 134, 18, { fill: '#FFFFFF', opacity: 0.92 }));
    o.push(path('M111,122 C119,126 120,138 111,146 C102,138 103,126 111,122Z', { fill: C.a }));
    o.push(path('M111,127 V142', { stroke: '#FFFFFF', 'stroke-width': 1.3, 'stroke-linecap': 'round' }));
    o.push(C.leaf(208, 58, 0.95, 40, C.a1));
    o.push(C.sparkle(40, 52, 0.9, 0));
    o.push(C.dot(212, 110, 3.4, C.g));
    return o.join('');
  };

  /* ===================== Calendar ===================== */
  K.calendar = function (C) {
    var o = [];
    o.push(C.shadow(120, 182, 82, 8, 0.28));
    o.push(rect(48, 46, 146, 136, 19, { fill: C.w3 }));
    o.push(rect(44, 40, 146, 136, 19, { fill: C.lin([[0, '#FFFFFF'], [1, C.w1]]) }));
    o.push(path('M63,40 H171 Q190,40 190,59 V76 H44 V59 Q44,40 63,40Z', { fill: C.lin([[0, C.a1], [1, C.a2]], 0, 0, 1, 1) }));
    o.push(rect(52, 44, 130, 5, 2.5, { fill: '#FFFFFF', opacity: 0.25 }));
    [82, 152].forEach(function (x) {
      o.push(ell(x, 52, 5, 3.5, { fill: dk(C.a, 0.45) }));
      o.push(rect(x - 4, 26, 8, 28, 4, { fill: C.lin([[0, C.g1], [0.5, C.g], [1, C.g3]], 0, 0, 1, 0) }));
    });
    var mark = [[2, 1], [3, 2], [1, 2], [3, 1]][C.v];
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 5; c++) {
        var x = 53 + c * 27, y = 86 + r * 21;
        if (r === mark[1] && c === mark[0]) continue;
        var fill = (r === 0 && c < 2) ? C.w2 : ((r * 5 + c) % 7 === 3 ? lt(C.g, 0.35) : C.w2);
        o.push(rect(x, y, 18, 13, 4.5, { fill: fill, opacity: (r === 0 && c < 2) ? 0.5 : 1 }));
      }
    }
    var mx = 53 + mark[0] * 27 + 9, my = 86 + mark[1] * 21 + 6.5;
    o.push(circ(mx, my + 2, 14, { fill: C.a0, opacity: 0.18 }));
    o.push(circ(mx, my, 14, ext(STK, { fill: C.lin([[0, C.a1], [1, C.a2]], 0, 0, 1, 1), 'stroke-width': 3 })));
    o.push(path('M' + (mx - 6) + ',' + my + ' l4,4.2 l8,-8.4', { fill: 'none', stroke: '#FFFFFF', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    o.push(C.sparkle(210, 42, 1, 0));
    o.push(C.leaf(212, 150, 0.95, 30, C.a));
    o.push(C.dot(28, 110, 3.6, C.g));
    return o.join('');
  };

  /* ===================== Results: document with chart + magnifier ===================== */
  K.results = function (C) {
    var o = [], d = [];
    o.push(C.shadow(120, 184, 80, 8, 0.28));
    o.push(rect(62, 30, 110, 144, 13, { fill: C.w2, transform: 'rotate(5 117 102)' }));
    d.push(rect(54, 26, 112, 148, 13, { fill: C.lin([[0, '#FFFFFF'], [1, C.w1]]) }));
    d.push(rect(68, 42, 52, 7, 3.5, { fill: C.ink, opacity: 0.8 }));
    d.push(rect(68, 54, 34, 5, 2.5, { fill: C.w3 }));
    d.push(circ(146, 48, 8, { fill: lt(C.g, 0.35) }));
    d.push(path('M142.5,48 l2.4,2.6 l4.4,-4.8', { fill: 'none', stroke: C.g3, 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    var hs = [26, 40, 32, 56, 72], base = 156;
    var bf = [C.w2, lt(C.a, 0.55), lt(C.a, 0.4), C.a1, C.a];
    hs.forEach(function (h, i) {
      d.push(rect(68 + i * 18, base - h, 12, h, 4, { fill: i > 2 ? C.lin([[0, C.a1], [1, C.a2]]) : bf[i] }));
    });
    var pts = hs.map(function (h, i) { return [74 + i * 18, base - h - 12]; });
    d.push(path('M' + pts.map(function (p) { return p.join(','); }).join(' L'), { fill: 'none', stroke: C.g2, 'stroke-width': 2.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    pts.forEach(function (p) { d.push(circ(p[0], p[1], 3.2, { fill: '#FFFFFF', stroke: C.g2, 'stroke-width': 2 })); });
    d.push(rect(66, base + 3, 90, 2.5, 1.25, { fill: C.w3 }));
    o.push(grp(d, { transform: 'rotate(-6 110 100)' }));
    // magnifier
    o.push(path('M182,146 L204,170', { stroke: C.linU([[0, lt(C.ink, 0.35)], [1, C.ink]], 180, 140, 210, 170), 'stroke-width': 13, 'stroke-linecap': 'round' }));
    o.push(path('M178,141 L186,150', { stroke: C.g2, 'stroke-width': 15, 'stroke-linecap': 'round' }));
    o.push(circ(160, 120, 29, { fill: lt(C.a, 0.85), opacity: 0.72 }));
    o.push(path('M143,130 L155,118 L163,125 L177,108', { fill: 'none', stroke: C.a2, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    o.push(path('M169,107 H178 V116', { fill: 'none', stroke: C.a2, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    o.push(circ(160, 120, 29, { fill: 'none', stroke: C.linU([[0, C.g1], [0.5, C.g], [1, C.g3]], 130, 90, 190, 150), 'stroke-width': 8 }));
    o.push(path('M141,110 A21,21 0 0 1 156,99', { fill: 'none', stroke: '#FFFFFF', 'stroke-width': 3.2, 'stroke-linecap': 'round', opacity: 0.9 }));
    o.push(C.sparkle(206, 40, 1, 0));
    o.push(C.dot(36, 64, 3.8, C.a1));
    o.push(C.plus(34, 150, 0.75, 0, C.a));
    return o.join('');
  };

  /* ===================== Map with pin ===================== */
  K.map = function (C) {
    var o = [];
    o.push(C.shadow(120, 182, 98, 9, 0.28));
    var X = [30, 90, 150, 210], Y = [72, 58, 72, 58], H = 102;
    var water = mix('#9EC6D3', C.a, 0.25), park = lt(C.a, 0.5), paper = mix('#FBF9F2', C.g, 0.12);
    var content = [
      rect(20, -10, 200, 130, 0, { fill: paper }),
      ell(60, 30, 22, 15, { fill: park }), ell(184, 76, 26, 16, { fill: park }), ell(128, 18, 12, 9, { fill: park }),
      rect(150, 20, 16, 12, 3, { fill: lt(C.g, 0.4) }), rect(172, 26, 14, 10, 3, { fill: lt(C.g, 0.4) }), rect(44, 64, 18, 12, 3, { fill: lt(C.g, 0.4) }),
      path('M20,86 C60,72 88,100 128,88 C160,78 184,96 220,86', { fill: 'none', stroke: water, 'stroke-width': 10, 'stroke-linecap': 'round' }),
      path('M20,52 C70,44 120,64 220,40', { fill: 'none', stroke: C.w3, 'stroke-width': 8, opacity: 0.45 }),
      path('M20,52 C70,44 120,64 220,40', { fill: 'none', stroke: '#FFFFFF', 'stroke-width': 5 }),
      path('M112,-10 C104,40 126,70 118,120', { fill: 'none', stroke: C.w3, 'stroke-width': 7, opacity: 0.45 }),
      path('M112,-10 C104,40 126,70 118,120', { fill: 'none', stroke: '#FFFFFF', 'stroke-width': 4.5 })
    ].join('');
    // thickness under panels
    o.push(path('M30,' + (72 + H) + ' L90,' + (58 + H) + ' L150,' + (72 + H) + ' L210,' + (58 + H) + ' L210,' + (63 + H) + ' L150,' + (77 + H) + ' L90,' + (63 + H) + ' L30,' + (77 + H) + 'Z', { fill: C.w3 }));
    for (var i = 0; i < 3; i++) {
      var k = (Y[i + 1] - Y[i]) / 60, c = Y[i] - k * X[i];
      var cp = C.clip(rect(X[i], 0, 60, H, 0, {}));
      var shade = i === 1 ? '<rect x="' + X[i] + '" y="0" width="60" height="' + H + '" fill="#000" opacity="0.08"/>' :
        '<rect x="' + X[i] + '" y="0" width="60" height="' + H + '" fill="#FFFFFF" opacity="' + (i === 0 ? 0.12 : 0) + '"/>';
      var foldG = rect(X[i], 0, 60, H, 0, { fill: C.lin(i === 1 ? [[0, '#000', 0.1], [1, '#000', 0]] : [[0, '#000', 0], [1, '#000', 0.06]], 0, 0, 1, 0) });
      o.push('<g transform="matrix(1 ' + k.toFixed(4) + ' 0 1 0 ' + c.toFixed(3) + ')"><g clip-path="' + cp + '">' + content + shade + foldG + '</g></g>');
    }
    // pin
    o.push(ell(122, 110, 13, 4.5, { fill: C.a0, opacity: 0.28 }));
    var pin = 'M122,110 C114,96 97,84 97,62 A25,25 0 1 1 147,62 C147,84 130,96 122,110Z';
    o.push(path(pin, { fill: C.a2, transform: 'translate(3 2)' }));
    o.push(path(pin, { fill: C.lin([[0, C.a1], [0.6, C.a], [1, C.a2]], 0, 0, 1, 1) }));
    o.push(circ(122, 62, 10, { fill: '#FFFFFF' }));
    o.push(circ(122, 62, 4.5, { fill: C.g }));
    o.push(path('M104,56 A19,19 0 0 1 116,43', { fill: 'none', stroke: '#FFFFFF', 'stroke-width': 3.4, 'stroke-linecap': 'round', opacity: 0.55 }));
    o.push(C.sparkle(196, 30, 1, 0));
    o.push(C.leaf(44, 34, 0.9, -30, C.a));
    o.push(C.dot(170, 40, 3.4, C.g));
    return o.join('');
  };

  /* ===================== Gift ===================== */
  K.gift = function (C) {
    var o = [];
    o.push(C.shadow(120, 182, 76, 9, 0.3));
    o.push(rect(60, 98, 120, 80, 11, { fill: C.lin([[0, C.a1], [0.55, C.a], [1, C.a2]], 0, 0, 1, 0) }));
    if (C.v % 2 === 1) {
      [[76, 128], [150, 122], [84, 160], [160, 158], [70, 148], [146, 142]].forEach(function (p) { o.push(circ(p[0], p[1], 3.4, { fill: '#FFFFFF', opacity: 0.3 })); });
    }
    o.push(rect(60, 104, 120, 8, 0, { fill: C.a0, opacity: 0.22 }));
    o.push(rect(110, 98, 20, 80, 0, { fill: C.lin([[0, C.g1], [0.5, C.g], [1, C.g2]], 0, 0, 1, 0) }));
    o.push(rect(52, 78, 136, 30, 10, { fill: C.lin([[0, lt(C.a, 0.42)], [1, C.a]], 0, 0, 0, 1) }));
    o.push(rect(58, 81, 124, 5, 2.5, { fill: '#FFFFFF', opacity: 0.35 }));
    o.push(rect(110, 78, 20, 30, 0, { fill: C.lin([[0, C.g1], [0.5, C.g], [1, C.g2]], 0, 0, 1, 0) }));
    var bow = C.lin([[0, C.g1], [0.6, C.g], [1, C.g2]], 0, 0, 1, 1);
    // tails
    o.push(path('M116,82 C110,96 100,108 90,116 L101,119 L104,112 C112,104 118,94 121,84Z', { fill: C.lin([[0, C.g], [1, C.g3]]) }));
    o.push(path('M124,82 C130,96 140,108 150,116 L139,119 L136,112 C128,104 122,94 119,84Z', { fill: C.lin([[0, C.g2], [1, C.g3]]) }));
    // loops
    o.push(path('M120,80 C98,38 52,42 66,72 C74,88 102,88 120,80Z', { fill: bow }));
    o.push(path('M120,80 C142,38 188,42 174,72 C166,88 138,88 120,80Z', { fill: C.lin([[0, C.g1], [0.5, C.g], [1, C.g2]], 1, 0, 0, 1) }));
    o.push(path('M113,78 C100,58 78,54 78,64 C80,74 98,78 113,78Z', { fill: C.g3, opacity: 0.4 }));
    o.push(path('M127,78 C140,58 162,54 162,64 C160,74 142,78 127,78Z', { fill: C.g3, opacity: 0.4 }));
    o.push(C.streak('M72,66 C74,56 84,52 94,54', 2.6, 0.6));
    o.push(rect(109, 68, 22, 20, 8, { fill: C.lin([[0, C.g1], [1, C.g2]], 0, 0, 1, 1) }));
    o.push(rect(113, 71, 10, 4, 2, { fill: '#FFFFFF', opacity: 0.45 }));
    o.push(C.streak('M66,118 V166', 4, 0.45));
    o.push(C.sparkle(40, 56, 1.05, 0), C.sparkle(204, 52, 0.8, 0, C.a1));
    o.push(C.dot(210, 124, 4, C.g), C.dot(32, 132, 3.4, C.a1));
    return o.join('');
  };

  /* ===================== Doctor: coat on hanger + badge ===================== */
  K.doctor = function (C) {
    var o = [];
    o.push(C.shadow(120, 184, 70, 8, 0.28));
    o.push(path('M120,44 V32 C120,22 131,20 133,27 C134.5,32 129,34 127,31', { fill: 'none', stroke: C.g2, 'stroke-width': 3.6, 'stroke-linecap': 'round' }));
    o.push(path('M120,44 L70,62 H170Z', { fill: 'none', stroke: C.g2, 'stroke-width': 4, 'stroke-linejoin': 'round' }));
    var sleeveL = 'M60,80 C50,108 46,146 48,172 L68,174 L74,100Z', sleeveR = 'M180,80 C190,108 194,146 192,172 L172,174 L166,100Z';
    o.push(path(sleeveL, { fill: C.w2 }), path(sleeveR, { fill: C.w3 }));
    var coat = 'M92,52 L72,60 C62,64 58,72 58,84 L56,176 H184 L182,84 C182,72 178,64 168,60 L148,52 C142,60 132,64 120,64 C108,64 98,60 92,52Z';
    o.push(path(coat, { fill: C.lin([[0, C.w1], [0.35, '#FFFFFF'], [1, C.w2]], 0, 0, 1, 0) }));
    o.push(path('M104,62 L120,65 L136,62 L120,112Z', { fill: C.lin([[0, C.a1], [1, C.a2]]) }));
    o.push(path('M92,52 C100,62 110,66 120,66 L106,120 L84,74Z', { fill: C.lin([[0, '#FFFFFF'], [1, C.w2]], 0, 0, 1, 1), stroke: C.w3, 'stroke-width': 1, 'stroke-opacity': 0.5 }));
    o.push(path('M148,52 C140,62 130,66 120,66 L134,120 L156,74Z', { fill: C.lin([[0, C.w1], [1, C.w2]], 0, 0, 1, 1), stroke: C.w3, 'stroke-width': 1, 'stroke-opacity': 0.5 }));
    o.push(path('M120,114 V176', { stroke: C.w3, 'stroke-width': 1.6, opacity: 0.6 }));
    o.push(circ(126, 134, 3, { fill: C.w3 }), circ(126, 156, 3, { fill: C.w3 }));
    // pocket + pens
    o.push(rect(80, 120, 6, 22, 3, { fill: C.lin([[0, C.g1], [1, C.g2]], 0, 0, 1, 0) }));
    o.push(rect(89, 124, 6, 18, 3, { fill: C.lin([[0, lt(C.a, 0.2)], [1, C.a2]], 0, 0, 1, 0) }));
    o.push(path('M72,134 H106 V156 Q106,164 98,164 H80 Q72,164 72,156Z', { fill: C.lin([[0, '#FFFFFF'], [1, C.w2]]), stroke: C.w3, 'stroke-width': 1.2, 'stroke-opacity': 0.6 }));
    // badge
    o.push(rect(136, 88, 38, 24, 6, { fill: C.a0, opacity: 0.16, transform: 'translate(0 2)' }));
    o.push(rect(136, 88, 38, 24, 6, { fill: C.lin([[0, C.a1], [1, C.a2]], 0, 0, 1, 1) }));
    o.push(circ(147, 100, 7.5, { fill: '#FFFFFF' }));
    o.push(path('M145.6,95 H148.4 V98.6 H152 V101.4 H148.4 V105 H145.6 V101.4 H142 V98.6 H145.6Z', { fill: C.a }));
    o.push(rect(158, 95, 12, 3.4, 1.7, { fill: '#FFFFFF', opacity: 0.9 }), rect(158, 102, 8, 3, 1.5, { fill: '#FFFFFF', opacity: 0.6 }));
    o.push(C.streak('M64,92 L62,168', 3.5, 0.6));
    o.push(C.leaf(40, 60, 1.1, -28, C.a));
    o.push(C.plus(204, 58, 0.9, 0, C.a));
    o.push(C.sparkle(206, 146, 0.75, 0));
    return o.join('');
  };

  /* ===================== public API ===================== */
  var KINDS = ['iv', 'checkup', 'consult-online', 'consult-offline', 'cosmetology', 'program-weight', 'program-antiage',
    'program-energy', 'peptide-box', 'telegram-login', 'success', 'empty-cart', 'calendar', 'results', 'map', 'gift', 'doctor'];

  function render(kind, opts) {
    var C = new Ctx(opts);
    var fn = K[kind] || K.gift;
    var body = '';
    try { body = fn(C); } catch (e) { body = ''; if (root.console) root.console.error('RCIllu', kind, e); }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"' +
      ' role="img" aria-label="' + esc(kind) + '" focusable="false" style="display:block;overflow:visible">' +
      '<defs>' + C.defs.join('') + '</defs>' + body + '</svg>';
  }

  root.RCIllu = { kinds: KINDS.slice(), render: render, brand: BRAND };
})(typeof window !== 'undefined' ? window : this);
