// test_hook: a ~13 s "Claude Pop" capability test over chorus 1 (23.0–35.9), registered as a standalone cut:
//   node render.mjs --cut=test_hook --workers=3 --out=artifacts/test_hook.mp4
// Big kinetic lyric type is the hook. Shots shorten toward an eighth/sixteenth-note strobe, then a red close-up and an end card.
// Timing follows the song's measured drum grid (132 BPM, kick n at 23.87 + n × 0.4545 s), not the 88 BPM grid in core.js:
// the chorus drop lands on kick 0 ("P(DOOM)") right after a near-silent break at 23.0–23.15.
(() => {
  const K0 = 23.87, KB = 60 / 132;
  const kb = n => K0 + n * KB;
  const KP = t => (t - K0) / KB;
  const kick = (t, k = 6) => Math.exp(-frac(KP(t)) * k);
  const hitAt = (t, t0, k = 6) => t >= t0 ? Math.exp(-(t - t0) * k) : 0;
  const boilN = t => Math.floor(t * BOIL);
  const RED = '#E0283F', DARKRED = '#1E0A12', MASKC = '#F4CE4E', TEAL_DK = '#1F5552', PAP = '#FBF3E2', PAP2 = '#EFE0C4', PAP3 = '#E2CBA3';
  const RAINBOW = [PAL.rose, PAL.ochre, '#F2D55C', PAL.sap, PAL.teal, PAL.sky, PAL.violet];

  // ======================================================================================
  // kinetic type: queued per shot, drawn on the 2D letter layer and composited into the paint (under the paper grain)
  // ======================================================================================
  const FONT = { anton: s => `${s}px Anton`, marker: s => `${s}px "Permanent Marker"` };
  let Q = [];
  // o: font, col, stroke, sw (outline width / size), shadow (colour, or false), rot, sx, sy, alpha, pop (0..1 with overshoot),
  //    align, brushy (colour of dry-brush streaks dragged through the glyphs), world (place through the active camera)
  function ty(txt, x, y, size, o = {}) {
    if (o.pop != null && o.pop <= 0) return;
    if (o.world && CAM) { [x, y] = toScreen(x, y); size *= CAM.zoom; o = { ...o, rot: (o.rot || 0) + CAM.rot }; }
    Q.push({ txt, x, y, size, ...o });
  }
  function measure(txt, size, font = 'anton') { outX.font = FONT[font](size); return outX.measureText(txt).width; }
  function drawTy(c, L) {
    const k = L.pop != null ? backOut(L.pop) : 1; if (k < .01) return;
    const s = L.size, a = clamp(L.alpha ?? 1); if (a < .01) return;
    c.save(); c.translate(L.x, L.y); c.rotate(L.rot || 0); c.scale(k * (L.sx ?? 1), k * (L.sy ?? 1)); c.globalAlpha = a;
    c.font = FONT[L.font || 'anton'](s); c.textAlign = L.align || 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    if (L.shadow !== false) { c.fillStyle = L.shadow || PAL.ink; c.fillText(L.txt, s * .045, s * .055); }
    if (L.stroke) { c.lineWidth = s * (L.sw ?? .09); c.strokeStyle = L.stroke; c.strokeText(L.txt, 0, 0); }
    c.fillStyle = L.col || PAL.cream; c.fillText(L.txt, 0, 0);
    if (L.brushy) {
      const w = c.measureText(L.txt).width, x0 = L.align === 'left' ? 0 : L.align === 'right' ? -w : -w / 2, bn = boilN(T);
      c.globalCompositeOperation = 'source-atop'; c.strokeStyle = L.brushy; c.lineCap = 'round';
      for (let i = 0; i < 9; i++) {
        const h = hash(bn * 3.1 + i * 7.7 + s), y = -s * .34 + i * s * .085 + (h - .5) * s * .05;
        c.globalAlpha = a * (.12 + .16 * hash(i + bn)); c.lineWidth = s * (.012 + .03 * hash(i * 3 + bn));
        c.beginPath(); c.moveTo(x0 + w * .3 * hash(i + 11 + bn), y); c.lineTo(x0 + w * (1 - .3 * hash(i + 17 + bn)), y + (h - .5) * s * .06); c.stroke();
      }
    }
    c.restore();
  }
  // Same compositing trick as flushLetters(): force p5.brush to land everything painted so far, then stamp the type layer.
  function flushType() {
    if (!Q.length) return;
    flushLetters();
    letG.clear(); const c = letG.drawingContext; for (const L of Q) drawTy(c, L); Q = [];
    push(); resetMatrix(); translate(-W / 2, -H / 2);
    brush.noStroke(); brush.noHatch(); brush.noWash(); brush.fill('#000000', 1); brush.fillBleed(0); brush.fillTexture(0, 0);
    brush.polygon([[-50, -50], [-40, -50], [-40, -40]]); brush.noFill();
    image(letG, 0, 0); pop();
  }
  // A line of words (or letters, with space: 0) laid out once, so revealing words never re-centres the line; squeezed to maxW.
  // words = [[text, t0], ...]; each pops at its t0. o.each(i, age) returns per-item overrides. Returns the squeeze factor.
  function wordLine(t, words, cx, y, size, o = {}) {
    const font = o.font || 'anton', sp = measure(' ', size, font) * (o.space ?? 1), ws = words.map(([w]) => measure(w, size, font));
    const total = ws.reduce((p, q) => p + q, 0) + sp * (words.length - 1), s = Math.min(1, (o.maxW || 1e9) / total);
    let x = cx - total * s / 2;
    words.forEach(([w, t0], i) => {
      const e = o.each ? o.each(i, t - t0) : {};
      ty(w, x + ws[i] * s / 2, y + (e.dy || 0), size, { ...o, sx: s * (o.sx ?? 1), pop: (t - t0) / (o.popD || .14), align: 'center', ...e });
      x += (ws[i] + sp) * s;
    });
    return s;
  }
  const letters = (txt, t0, dt) => [...txt].map((ch, i) => [ch, t0 + i * dt]);

  // ======================================================================================
  // paint helpers (washes wherever possible: watercolour fills are the expensive part)
  // ======================================================================================
  const bg = (col, op = 240) => paint(rectPts(-80, -80, W + 160, H + 160), { wash: col, washOp: op, ink: null });
  const blot = (x, y, rx, ry, col, op = 80) => paint(ellPts(x, y, rx, ry, 10, rx * .05), { fill: col, fillOp: op, bleed: .25, tex: .7, border: .5, ink: null });
  function rays(cx, cy, n, rot, col, op = 255, w = .5, R = 2600) {
    for (let i = 0; i < n; i++) { const a = rot + i / n * TAU, da = Math.PI / n * w; paint([[cx, cy], [cx + Math.cos(a - da) * R, cy + Math.sin(a - da) * R], [cx + Math.cos(a + da) * R, cy + Math.sin(a + da) * R]], { wash: col, washOp: op, ink: null }); }
  }
  function wedges(fx, fy, t, n, r0, cols) {
    const bn = boilN(t);
    for (let i = 0; i < n; i++) {
      const a = (i + hash(bn * .37 + i) * .6) / n * TAU, da = .012 + hash(i * 3.1 + bn) * .02, r = r0 * (.8 + hash(i + bn * 1.3) * .5), R = 2400;
      paint([[fx + Math.cos(a) * r, fy + Math.sin(a) * r], [fx + Math.cos(a - da) * R, fy + Math.sin(a - da) * R], [fx + Math.cos(a + da) * R, fy + Math.sin(a + da) * R]], { wash: cols[i % cols.length], washOp: 255, ink: null });
    }
  }
  // A fat dry-brush stroke dragged from (x0,y0) toward (x1,y1); p = 0..1 how far it has travelled.
  function swash(x0, y0, x1, y1, w, col, p, seed = 0, streak = null) {
    if (p < .02) return;
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L, n = 10, A = [], B = [];
    for (let k = 0; k <= n; k++) {
      const q = k / n, x = x0 + dx * q * p, y = y0 + dy * q * p;
      const hw = w / 2 * (q < .1 ? .75 + 2.5 * q : 1 - .45 * Math.pow((q - .1) / .9, 3));
      A.push([x + nx * hw * (1 + (hash(seed + k) - .5) * .2), y + ny * hw * (1 + (hash(seed + k) - .5) * .2)]);
      B.push([x - nx * hw * (1 + (hash(seed + k + 40) - .5) * .2), y - ny * hw * (1 + (hash(seed + k + 40) - .5) * .2)]);
    }
    paint(A.concat(B.reverse()), { wash: col, washOp: 240, ink: null, ...(streak ? { hatch: { d: w / 6, a: 0, o: { rand: .5, gradient: .4 }, b: 'charcoal', c: streak, w: .8 } } : {}) });
  }
  function splat(x, y, r, col, seed, k = 1) {
    if (k < .02) return;
    const n = 14, P = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU, rr = r * k * (i % 2 ? .6 + .2 * hash(seed + i) : 1 + .35 * hash(seed + i * 3)); P.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
    paint(P, { wash: col, washOp: 240, ink: null, curv: .5 });
    for (let i = 0; i < 5; i++) { const a = hash(seed + i * 7) * TAU, d = r * k * (1.4 + hash(seed + i * 11)), rr = r * k * .12 * (.5 + hash(seed + i)); paint(ellPts(x + Math.cos(a) * d, y + Math.sin(a) * d, rr, rr, 8), { wash: col, ink: null }); }
  }
  // torn paper strip for secondary lyric lines
  function strip(cx, cy, w, h, rot, col, seed) {
    push(); translate(cx, cy); rotate(rot);
    const n = 9, P = [];
    for (let k = 0; k <= n; k++) P.push([-w / 2 + w * k / n, -h / 2 + (hash(seed + k) - .5) * h * .14]);
    for (let k = 1; k < 4; k++) P.push([w / 2 + (hash(seed + 20 + k) - .5) * h * .25, -h / 2 + h * k / 4]);
    for (let k = n; k >= 0; k--) P.push([-w / 2 + w * k / n, h / 2 + (hash(seed + 30 + k) - .5) * h * .14]);
    for (let k = 3; k > 0; k--) P.push([-w / 2 + (hash(seed + 50 + k) - .5) * h * .25, -h / 2 + h * k / 4]);
    paint(P, { wash: col, washOp: 250, ink: PAL.ink, sw: .5 });
    pop();
  }
  function sticker(x, y, r, rot, col) { push(); translate(x, y); rotate(rot); paint(starPts(0, 0, r, .84, 12, 0), { wash: col, ink: PAL.ink, sw: 1.1 }); pop(); }
  function shroom(x, y, s, cap, rot = 0, sq = 0) {
    push(); translate(x, y); rotate(rot); scale(s * (1 + sq * .5), s * (1 - sq));
    paint(rrPts(-20, -60, 40, 60, 12), { wash: PAL.cream, ink: PAL.ink, sw: .8 });
    const c = []; for (let i = 0; i <= 10; i++) { const a = Math.PI + i / 10 * Math.PI; c.push([Math.cos(a) * 56, -54 + Math.sin(a) * 48]); }
    paint(c, { wash: cap, ink: PAL.ink, sw: .9, curv: .4 });
    for (const [dx, dy, r] of [[-26, -76, 9], [8, -92, 7], [28, -70, 8]]) paint(ellPts(dx, dy, r, r * .8, 8), { wash: PAL.cream, ink: null });
    pop();
  }
  function slip(x, y, s, rot) {
    push(); translate(x, y); rotate(rot); scale(s);
    paint(rectPts(-34, -22, 68, 44, 1.5), { wash: '#FFFBF0', ink: PAL.ink, sw: .7 });
    inkLine([[-16, -8], [-3, -12], [-8, 3], [5, -1], [14, 11]], 1, PAL.ink, 'inkfine', .5);
    pop();
  }
  // the friendly smiley mask; crack 0..1 grows ink cracks out from the centre
  function mask(x, y, r, rot, crack = 0) {
    push(); translate(x, y); rotate(rot);
    const sw = clamp(r / 60, .8, 2.4);
    paint(ellPts(0, 0, r, r * .98, 24), { wash: MASKC, ink: PAL.ink, sw });
    paint(ellPts(r * .1, r * .15, r * .8, r * .72, 10), { fill: PAL.ochre, fillOp: 70, bleed: .1, tex: .6, border: .6, ink: null });
    for (const s of [-1, 1]) paint(ellPts(s * r * .55, r * .22, r * .16, r * .09, 10), { wash: PAL.rose, washOp: 170, ink: null });
    for (const s of [-1, 1]) inkLine([[s * r * .46, -r * .1], [s * r * .32, -r * .3], [s * r * .18, -r * .1]], sw * 1.6, PAL.ink, 'ink', .5);
    inkLine([[-r * .5, r * .15], [-r * .25, r * .47], [0, r * .56], [r * .25, r * .47], [r * .5, r * .15]], sw * 1.8, PAL.ink, 'ink', .6);
    if (crack > .02) for (let j = 0; j < 6; j++) {
      const a0 = j / 6 * TAU + .4, P = [[r * .04, -r * .04]];
      for (let k = 1; k <= 5; k++) { const d = r * crack * k / 5 * 1.05, a = a0 + (hash(j * 9 + k) - .5) * .7; P.push([Math.cos(a) * d, Math.sin(a) * d]); }
      inkLine(P, sw * (1.6 - j * .12), PAL.ink, 'ink', 0);
    }
    pop();
  }
  function maskHalf(x, y, r, rot, side) {
    push(); translate(x, y); rotate(rot); scale(side, 1);
    const P = []; for (let i = 0; i <= 12; i++) { const a = -Math.PI / 2 + i / 12 * Math.PI; P.push([Math.cos(a) * r, Math.sin(a) * r * .98]); }
    for (let k = 1; k < 6; k++) P.push([(k % 2 ? .08 : -.06) * r, r * (1 - k / 3)]);
    paint(P, { wash: MASKC, ink: PAL.ink, sw: clamp(r / 60, .8, 2.4) });
    inkLine([[r * .46, -r * .1], [r * .32, -r * .3], [r * .18, -r * .1]], 2.2, PAL.ink, 'ink', .5);
    pop();
  }
  const BLOB_EYES = [[-.5, -.35, .2], [.05, -.52, .24], [.55, -.3, .19], [-.22, .02, .27], [.36, .1, .22], [-.66, .25, .15], [.7, .36, .14], [.02, .46, .17], [-.36, .52, .12]];
  function eyeBlob(x, y, r, t, open, look = 0) {
    const P = []; for (let i = 0; i < 26; i++) { const a = i / 26 * TAU, rr = r * (1 + .08 * Math.sin(a * 3 + t * 3) + .05 * Math.sin(a * 5 - t * 4)); P.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * .9]); }
    paint(P, { wash: '#3E8F86', ink: PAL.ink, sw: 1.6, curv: .5 });
    paint(ellPts(x - r * .2, y + r * .35, r * .7, r * .3, 10), { fill: PAL.violet, fillOp: 110, bleed: .15, tex: .7, ink: null });
    BLOB_EYES.forEach(([ex, ey, er], i) => {
      const k = clamp(open * 2.2 - i * .12), X = x + ex * r, Y = y + ey * r, R = er * r;
      if (k < .05) { inkLine([[X - R, Y], [X, Y + R * .3], [X + R, Y]], 1.2, PAL.ink, 'ink', .5); return; }
      paint(ellPts(X, Y, R, R * backOut(k), 14), { wash: PAL.cream, ink: PAL.ink, sw: 1 });
      paint(ellPts(X + look * R * .35, Y, R * .45, R * .5 * Math.min(1, backOut(k)), 10), { wash: i % 3 === 1 ? RED : PAL.ink, ink: null });
    });
  }

  // ======================================================================================
  // 1 · 23.00–23.87  cold open in the silent break: a prompt cursor, then "I'M / UPPING / MY" stamped in ink
  // ======================================================================================
  const ST = [23.17, 23.38, 23.62];
  function coldOpen(t, lt) {
    const pre = easeIn(seg(t, 23.7, K0)), sh = ST.reduce((a, s) => a + hitAt(t, s, 14), 0), [sx, sy] = shakeXY(t, 8 * sh);
    blot(960, 560, 780, 430, PAL.clayLt, 60);
    camBegin(960 + sx, 540 + sy, 1 + .06 * lt + .3 * pre, -.02 * pre);
    ST.forEach((s, i) => splat([640, 1330, 700][i], [250, 470, 690][i], [70, 110, 60][i], i === 1 ? PAL.clay : PAL.clayLt, i * 17, backOut((t - s) / .12)));
    if (t < ST[0] && frac((t - 23) * 3.3) < .55) paint(rectPts(948, 172, 24, 160, 2), { wash: PAL.ink, ink: null });
    const wake = t >= ST[0], look = t < ST[1] ? -.5 : t < ST[2] ? .3 : -.1;
    clawd(960, 985, 15, { eyes: wake ? 'look' : 'closed', lookX: look, lookY: -1, mouth: wake ? 'o' : 'smile', sq: .3 * pre - .12 * sh, aL: .2 + .9 * sh + 1.2 * pre, aR: .2 + .9 * sh + 1.2 * pre, blush: true });
    ty("I'M", 960, 250, 200, { col: PAL.ink, shadow: PAL.clayLt, pop: (t - ST[0]) / .12, rot: -.03, world: true });
    ty('UPPING', 960, 470, 340, { col: PAL.clay, stroke: PAL.ink, sw: .05, shadow: PAL.ink, brushy: PAL.clayDk, pop: (t - ST[1]) / .12, rot: .02, world: true });
    ty('MY', 960, 690, 200, { col: PAL.ink, shadow: PAL.clayLt, pop: (t - ST[2]) / .12, rot: -.02, world: true });
    camEnd();
  }

  // ======================================================================================
  // 2 · 23.87–24.50  the drop: "P(DOOM)" slams over an ink swash, Clawd erupts from below
  // ======================================================================================
  function drop(t, lt) {
    const h = hitAt(t, K0, 5), kk = kick(t, 7), [sx, sy] = shakeXY(t, 30 * h + 6 * kk);
    bg(PAL.rose, 250);
    rays(960, 480, 14, t * .5, PAL.ochre, 170, .45);
    blot(420, 820, 520, 260, '#C74E6E', 90);
    camBegin(960 + sx, 540 + sy, 1.12 - .1 * easeOut(lt / .5) + .03 * kk, -.02);
    swash(170, 470, 1760, 410, 330, PAL.ink, easeOut(lt / .12), 3, PAL.violet);
    const up = backOut(seg(t, K0 + .02, K0 + .26));
    clawd(1480, lerp(1450, 1030, up), 30, { eyes: 'spark', mouth: 'grin', aL: 1.45 + .2 * Math.sin(t * 20), aR: 1.45 - .2 * Math.sin(t * 20), sq: -.15 * (1 - up) + .22 * kk, blush: true, noShadow: true });
    for (let i = 0; i < 9; i++) {
      const a = hash(i + 3) * TAU, d = 300 + 900 * easeOut(lt * 1.6) * (.6 + .4 * hash(i + 8));
      splat(960 + Math.cos(a) * d, 450 + Math.sin(a) * d * .6, 30 + 20 * hash(i), i % 2 ? PAL.ink : PAL.cream, i * 13, 1 - seg(lt, .35, .6));
    }
    const pct = t < kb(1) ? '8%' : '13%', sp = backOut(seg(t, K0 + .08, K0 + .24));
    if (sp > .02) sticker(360, 800, 125 * sp * (1 + .08 * kk), -.15 + .05 * Math.sin(t * 6), PAL.ochre);
    ty(pct, 360, 800, 105, { col: PAL.ink, shadow: false, pop: (t - K0 - .1) / .14, rot: -.15, world: true });
    camEnd();
    ty('P(DOOM)', 960, 430, 430, { col: PAL.cream, stroke: PAL.ink, sw: .06, shadow: PAL.clayDk, brushy: PAL.clayLt, pop: lt / .16, rot: -.04, sx: 1 + .04 * kk, sy: 1 + .04 * kk });
    flash(1 - lt / .1, PAL.cream);
  }

  // ======================================================================================
  // 3 · 24.50–25.69  "'cause the future goes": Clawd pogo-pumps an exponential curve up a hand-drawn chart
  // ======================================================================================
  const O = [420, 930], CW = 1420, CH_ = 800;
  const curveY = q => O[1] - CH_ * (Math.exp(5 * q) - 1) / (Math.exp(5) - 1);
  function future(t, lt, dur) {
    const kk = kick(t, 8), tilt = ease(seg(t, 25.5, kb(4))), grow = seg(t, 24.5, kb(4));
    bg('#F6E3B8', 235);
    blot(1500, 300, 560, 300, PAL.ochre, 70);
    camBegin(lerp(960, 1090, ease(grow)), lerp(540, 470, ease(grow)) - 160 * tilt, 1 + .1 * easeIn(grow) + .12 * tilt + .012 * kk, -.02 * ease(grow));
    for (let i = 1; i <= 10; i++) inkLine([[O[0] + i * CW / 10, O[1]], [O[0] + i * CW / 10, O[1] - CH_ - 40]], .35, PAL.sky, 'inkfine', 0);
    for (let i = 1; i <= 6; i++) inkLine([[O[0], O[1] - i * CH_ / 6], [O[0] + CW + 40, O[1] - i * CH_ / 6]], .35, PAL.sky, 'inkfine', 0);
    inkLine([[O[0], O[1] + 10], [O[0], O[1] - CH_ - 70]], 1.8, PAL.ink, 'ink', 0);
    inkLine([[O[0] - 10, O[1]], [O[0] + CW + 70, O[1]]], 1.8, PAL.ink, 'ink', 0);
    const qm = .12 + .85 * Math.pow(grow, 1.7) + .015 * kk, P = [];
    for (let i = 0; i <= 24; i++) { const q = qm * i / 24; P.push([O[0] + CW * q, curveY(q)]); }
    const tip = P[P.length - 1];
    paint(P.concat([[tip[0], O[1]], [O[0], O[1]]]), { wash: PAL.clayLt, washOp: 150, ink: null });
    inkLine(P, 3.6, PAL.clayDk, 'ink', .3);
    paint(ellPts(tip[0], tip[1], 70 + 20 * kk, 70 + 20 * kk, 12), { wash: PAL.ochre, washOp: 120, ink: null });
    paint(starPts(tip[0], tip[1], 46 + 14 * kk, .38, 4, t * 4), { wash: PAL.cream, ink: PAL.ink, sw: .8 });
    // Clawd rides the pump handle; the slam lands on every kick
    const f = frac(KP(t)), hp = f < .75 ? ease(f / .75) : 1 - easeIn((f - .75) / .25), PX = 250, PY = 1010, PS = .85;
    pumpProp(PX, PY, PS, hp, O);
    const top = PY - (270 + 150 * hp) * PS, air = Math.sin(seg(f, .5, .92) * Math.PI) * 1.2;
    clawd(PX, top, 15, { dy: -air, sq: .3 * kick(t, 10) - (f > .85 ? .12 : 0), noShadow: true, aL: 1.2 + .25 * Math.sin(f * TAU), aR: 1.2 - .25 * Math.sin(f * TAU), eyes: 'happy', mouth: kk > .4 ? 'grin' : 'smile', blush: true });
    const v = Math.round(8 + 91 * (Math.exp(5 * qm) - 1) / (Math.exp(5) - 1));
    ty(v + '%', tip[0] + 70, tip[1] - 70, 90, { font: 'marker', col: RED, rot: -.08, world: true });
    ty('P(doom)', O[0] - 20, O[1] - CH_ - 100, 54, { font: 'marker', col: PAL.ink, shadow: false, align: 'left', world: true });
    ty('time →', O[0] + CW - 40, O[1] + 44, 44, { font: 'marker', col: PAL.ink, shadow: false, world: true });
    strip(740, 190, 640, 160, -.03, PAP, 5);
    wordLine(t, [["'CAUSE", 24.52], ['THE', 24.78]], 740, 190, 130, { col: PAL.ink, shadow: PAL.clayLt, world: true, rot: -.03 });
    ty('FUTURE', 830, 420, 330, { col: PAL.clay, stroke: PAL.ink, sw: .05, brushy: PAL.clayDk, pop: (t - 24.95) / .14, rot: -.03, world: true });
    ty('GOES', 1120, 640, 210, { col: PAL.ink, shadow: PAL.clayLt, pop: (t - 25.38) / .12, rot: -.05, world: true });
    camEnd();
  }

  // ======================================================================================
  // 4 · 25.69–26.50  "FOOM": the curve goes vertical, Clawd rides the tip skyward, the letters blast apart
  // ======================================================================================
  function foom(t, lt) {
    const sky = lt < .4 ? mixCol('#EFA945', PAL.rose, lt / .4) : mixCol(PAL.rose, '#5A3F8E', seg(lt, .4, .81));
    bg(sky, 255);
    const scroll = 2600 * lt + 1800 * lt * lt, [sx, sy] = shakeXY(t, 24 * hitAt(t, kb(4), 4) + 5 * kick(t, 8));
    push(); translate(sx, sy);
    for (let i = 0; i < 6; i++) { const y = ((i * 240 + scroll) % 1440) - 180; inkLine([[-40, y], [W + 40, y + 12]], .8, PAL.cream, 'inkfine', 0); }
    for (let i = 0; i < 4; i++) {
      const x = [260, 1640, 520, 1420][i], y = (([-200, 300, 800, 1300][i] + scroll * .8) % 2000) - 400, w = 260 + 60 * i;
      for (const [dx, dy, r] of [[-.3, .05, .28], [.05, -.08, .36], [.34, .04, .26]]) paint(ellPts(x + dx * w, y + dy * w, r * w, r * w * .8, 12), { wash: PAL.cream, washOp: 230, ink: null });
    }
    if (lt > .35) for (let i = 0; i < 16; i++) { const k = seg(lt, .35 + hash(i) * .2, .6 + hash(i) * .2); if (k > 0) paint(starPts(hash(i + 3) * W, ((hash(i + 5) * H + scroll * .15) % H), 12 * k, .35, 4, i), { wash: PAL.cream, ink: null }); }
    const burst = backOut(seg(lt, 0, .25));
    paint(starPts(960, 740, 980 * burst, .6, 14, lt * .6), { wash: PAL.ochre, washOp: 230, ink: PAL.ink, sw: 1.2 });
    paint(starPts(960, 740, 640 * burst, .58, 12, -lt * .7 + .2), { wash: '#F7E08A', ink: PAL.ink, sw: 1 });
    const cy = 300 + 12 * Math.sin(t * 9), P = [];
    for (let k = 0; k <= 8; k++) { const y = lerp(cy + 10, 1180, k / 8); P.push([960 + Math.sin(y * .01 - t * 8) * 18 * (k / 8), y]); }
    inkLine(P, 6, PAL.clayDk, 'ink', .4);
    for (let i = 0; i < 7; i++) { const x = 960 + (i - 3) * 38, L = 160 + 120 * hash(i + boilN(t)); inkLine([[x, cy + 40], [x + (i - 3) * 6, cy + 40 + L]], 1.2, PAL.cream, 'dry', 0); }
    clawd(960, cy, 22, { eyes: 'spark', mouth: 'O', aL: 1.5 + .2 * Math.sin(t * 30), aR: 1.5 - .2 * Math.sin(t * 30), sq: -.18, rot: .06 * Math.sin(t * 7), noShadow: true, blush: true });
    pop();
    const spread = 1 + .22 * easeOut(lt / .3) + .25 * lt, drift = 380 * easeIn(seg(t, 26.1, 26.5)), kk = kick(t, 8);
    [...'FOOM'].forEach((ch, i) => ty(ch, 960 + (i - 1.5) * 330 * spread + sx, 740 + (i % 2 ? -26 : 26) + drift * (1 + i * .1) + sy, 560 * (1 + .06 * kk), {
      col: PAL.cream, stroke: RED, sw: .09, shadow: PAL.ink, brushy: '#F2B8C2', rot: (i - 1.5) * .09 + .04 * Math.sin(t * 5 + i), pop: (lt - i * .025) / .14
    }));
    flash(.9 * (1 - lt / .12), PAL.cream);
    for (let i = 0; i < 12; i++) { const x = hash(boilN(t) * 13 + i) * W, y = hash(boilN(t) * 7 + i + 50) * H, L = 180 + 200 * lt; inkLine([[x, y - L / 2], [x, y + L / 2]], 1.1, PAL.cream, 'inkfine', 0); }
  }

  // ======================================================================================
  // 5 · 26.50–28.00  "Trapped in the Chinese room": the paper room's walls close in on every kick, squeezing the type
  // ======================================================================================
  function room(t, lt) {
    const L = [6, 7, 8].reduce((a, n) => a + backOut(seg(t, kb(n), kb(n) + .14)), 0), hs = [6, 7, 8].reduce((a, n) => a + hitAt(t, kb(n), 9), 0);
    const bw = 1560 - 200 * L, bh = 780 - 36 * L, cx = 960, cy = 540, [sx, sy] = shakeXY(t, 14 * hs);
    bg(PAL.night, 250);
    blot(300, 200, 420, 240, PAL.violet, 90);
    for (let i = 0; i < 14; i++) { const x = hash(i + 1) * W, y = hash(i + 2) * H, r = 6 + 6 * hash(i + 3); inkLine([[x - r, y], [x + r, y]], .6, PAL.cream, 'inkfine', 0); inkLine([[x, y - r], [x, y + r]], .6, PAL.cream, 'inkfine', 0); }
    camBegin(cx + sx, cy + sy, 1 + .03 * lt + .06 * L, (hash(Math.floor(hs * 3)) - .5) * .02 * hs);
    const x0 = cx - bw / 2, x1 = cx + bw / 2, y0 = cy - bh / 2, y1 = cy + bh / 2, iw = bw * .72, ih = bh * .72, bx0 = cx - iw / 2, bx1 = cx + iw / 2, by0 = cy - 10 - ih / 2, by1 = cy - 10 + ih / 2;
    paint([[x0, y0], [x1, y0], [bx1, by0], [bx0, by0]], { wash: PAP3, ink: PAL.ink, sw: .9 });
    paint([[x0, y0], [bx0, by0], [bx0, by1], [x0, y1]], { wash: PAP2, ink: PAL.ink, sw: .9 });
    paint([[x1, y0], [bx1, by0], [bx1, by1], [x1, y1]], { wash: PAP2, ink: PAL.ink, sw: .9 });
    paint([[x0, y1], [x1, y1], [bx1, by1], [bx0, by1]], { wash: '#D9BD8E', ink: PAL.ink, sw: .9 });
    paint(rectPts(bx0, by0, iw, ih), { wash: PAP, fill: PAP2, fillOp: 70, tex: .7, border: .5, ink: PAL.ink, sw: .9 });
    for (const side of [-1, 1]) { const k = hs > .05 ? 1 - hs / 3 : 1, X = side < 0 ? x0 : x1; if (hs > .05) for (let j = 0; j < 3; j++) paint(ellPts(X + side * (30 + 60 * (1 - k)), cy - 200 + j * 200, 40 * hs, 30 * hs, 10), { wash: PAL.cream, washOp: 200, ink: null }); }
    clawd(cx + jit(3) * hs, (by1 + y1) / 2 + 20, 17, { sx: .55 + .45 * bw / 1560, eyes: 'scared', mouth: 'wobble', aL: 0, aR: 0, emote: 'sweat', emoteK: seg(t, 26.7, 26.9), sq: .08 * hs });
    for (let k = 0; k < 6; k++) {
      const u = (t - (26.6 + k * KB / 2)) / .5; if (u < 0 || u > 1) continue;
      const a = [x0 - 160, 120], b = [cx + (k - 2.5) * 70, by1 - 30], m = [lerp(a[0], b[0], .5), -40];
      const q = [(1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * m[0] + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * m[1] + u * u * b[1]];
      slip(q[0], q[1], .9, u * 8 + k);
    }
    paint([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], { ink: PAL.ink, sw: 2 });
    wordLine(t, [['TRAPPED', 26.55], ['IN', 26.83], ['THE', 26.97]], cx, by0 + ih * .27, 150, { maxW: iw * .9, col: PAL.ink, shadow: PAL.clayLt, world: true });
    wordLine(t, [['CHINESE', kb(7)], ['ROOM', kb(8)]], cx, by0 + ih * .6, 200, { maxW: iw * .92, col: PAL.ink, shadow: PAL.clayLt, world: true, each: i => i ? { col: RED, stroke: PAL.ink, sw: .05, shadow: PAL.ink } : {} });
    camEnd();
  }

  // ======================================================================================
  // 6 · 28.00–29.33  "with a bag of shrooms": rainbow rings flow out, mushrooms pop on eighths, the type goes wobbly
  // ======================================================================================
  const SHR = [[250, 1000, 1.5, RED], [560, 1040, 1.0, PAL.violet], [1380, 1040, 1.2, RED], [1690, 990, 1.4, PAL.teal], [150, 520, .9, PAL.ochre], [1790, 480, .85, PAL.violet]];
  function shrooms(t, lt) {
    const kk = kick(t, 6);
    bg(PAL.violet, 255);
    camBegin(960, 560, 1.06 + .03 * kk, .07 * Math.sin(t * 2));
    const flow = frac(t * 1.8);
    for (let j = 8; j >= 0; j--) {
      const R = (j + flow) * 175; if (R < 10) continue;
      const col = RAINBOW[((j - Math.floor(t * 1.8)) % 7 + 70) % 7], P = [];
      for (let i = 0; i < 22; i++) { const a = i / 22 * TAU + t * .4 * (j % 2 ? 1 : -1), rr = R * (1 + .1 * Math.sin(a * 5 + t * 3 + j)); P.push([960 + Math.cos(a) * rr, 560 + Math.sin(a) * rr * .9]); }
      paint(P, { wash: col, washOp: 255, ink: null, curv: .5 });
    }
    SHR.forEach(([x, y, s, cap], i) => {
      const g = backOut(seg(t, 28.0 + i * KB / 2, 28.2 + i * KB / 2)); if (g < .02) return;
      const on = (Math.floor(KP(t)) + i) % 2 === 0, hop = on ? Math.sin(frac(KP(t)) * Math.PI) * -40 * s : 0;
      shroom(x, y + hop, s * g, cap, Math.sin(t * 3 + i) * .12, on ? .25 * kick(t, 8) : 0);
    });
    const tint = .5 + .5 * Math.sin(t * 5);
    clawd(960, 690 + 16 * Math.sin(t * 2.6), 22, {
      noShadow: true, rot: .16 * Math.sin(t * 2.4), sx: 1 + .07 * Math.sin(t * 6), sy: 1 - .07 * Math.sin(t * 6), eyes: 'swirl', mouth: 'cat', blush: true,
      col: mixCol(PAL.clay, '#E77A8A', tint), dk: mixCol(PAL.clayDk, PAL.violet, tint * .6), aL: 1 + .5 * Math.sin(t * 5), aR: 1 - .5 * Math.sin(t * 5)
    });
    camEnd();
    strip(960, 150, 880, 150, .02, PAP, 11);
    wordLine(t, [['WITH', 28.02], ['A', 28.2], ['BAG', 28.31], ['OF', 28.6]], 960, 150, 120, { col: PAL.ink, shadow: PAL.clayLt, rot: .02 });
    wordLine(t, letters('SHROOMS', 28.8, .03), 960, 880, 300, {
      space: 0, stroke: PAL.ink, sw: .07, shadow: PAL.ink,
      each: i => ({ col: RAINBOW[(i + Math.floor(t * 6)) % 7], rot: Math.sin(t * 6 + i) * .12, sy: 1 + .08 * Math.sin(t * 9 + i * .9), dy: Math.sin(t * 9 + i * .9) * 26 })
    });
  }

  // ======================================================================================
  // 7 · 29.33–33.42  "See through the shoggoth's lies": beat-cut montage, 2 → 2 → 1 → 1 beats, then an eighth/sixteenth strobe
  // ======================================================================================
  function maskShot(t, lt) {
    const kk = kick(t, 6), bob = Math.abs(Math.sin(KP(t) * Math.PI));
    bg(PAL.teal, 250);
    rays(1320, 560, 16, t * .3, TEAL_DK, 90, .5);
    blot(500, 850, 520, 260, TEAL_DK, 80);
    camBegin(960, 540, 1 + .05 * lt, 0);
    mask(1320, 560 - 24 * bob, 330 * (1 + .03 * kk), .1 * Math.sin(KP(t) * Math.PI * .5));
    camEnd();
    ty('SEE', 560, 440, 470, { col: PAL.cream, stroke: PAL.ink, sw: .06, brushy: PAL.sky, pop: (t - 29.57) / .14, rot: -.05 });
    ty('THROUGH', 560, 760, 190, { col: MASKC, stroke: PAL.ink, sw: .07, pop: (t - 30.02) / .12, rot: -.03 });
  }
  function clawdEye(t, lt) {
    bg(PAL.ochre, 245);
    rays(960, 700, 12, -t * .3, PAL.cream, 70, .4);
    camBegin(960 + 40 * lt, 560, 1 + .12 * lt, 0);
    clawd(960, 1270, 82, { eyes: t < 30.62 ? 'look' : 'narrow', lookX: .8, noShadow: true, mouth: null, sq: .03 * kick(t, 8) });
    camEnd();
    ty('THE', 330, 170, 110, { font: 'marker', col: PAL.ink, shadow: false, pop: (t - 30.47) / .12, rot: -.1 });
    wordLine(t, letters("SHOGGOTH'S", 30.66, .045), 960, 330, 250, { space: 0, col: PAL.ink, stroke: PAL.cream, sw: .08, shadow: PAL.clayDk, popD: .08 });
  }
  function crack(t, lt) {
    const c = easeOut(seg(t, kb(16), kb(16) + .33)), [sx, sy] = shakeXY(t, 6 + 10 * c);
    bg(TEAL_DK, 255);
    paint(ellPts(960, 620, 620, 480, 16), { wash: '#7A1022', washOp: 110, ink: null, curv: .5 });
    mask(960 + sx, 630 + sy, 380, .05 * Math.sin(t * 40) * c, c);
    ty("SHOGGOTH'S", 960 + jit(6), 125 + jit(4), 220, { col: MASKC, stroke: PAL.ink, sw: .08, shadow: RED });
  }
  function reveal(t, lt) {
    const age = t - kb(17), [sx, sy] = shakeXY(t, 22 * hitAt(t, kb(17), 6));
    bg(PAL.ink, 255);
    rays(960, 420, 18, t * .4, '#3A2B44', 255, .5);
    eyeBlob(960 + sx, 420 + sy, 330, t, seg(age, .02, .3), Math.sin(t * 6) * .6);
    for (const s of [-1, 1]) maskHalf(960 + s * (40 + 700 * age), 470 + 1300 * age * age, 330, s * age * 3, s);
    ty('LIES', 960 + sx, 800 + sy, 520, { col: RED, stroke: PAL.cream, sw: .06, shadow: PAL.ink, brushy: '#8E1426', pop: age / .12 });
    flash(.8 * (1 - age / .1), PAL.cream);
  }
  function strobe(t, lt) {
    const fast = t >= kb(20), per = fast ? KB / 4 : KB / 2, t0 = fast ? kb(20) : kb(18);
    const k = Math.floor((t - t0) / per) + (fast ? 100 : 0), v = k % 3, lk = (t - t0) % per, z = 1 + .4 * seg(t, kb(18), kb(21));
    const r = (hash(k) - .5) * .16, ox = (hash(k + 5) - .5) * 120, oy = (hash(k + 9) - .5) * 80, hit = Math.exp(-lk * 18);
    if (v === 0) { bg(PAL.ink, 255); eyeBlob(960 - ox, 480, 420 * z, t, 1, hash(k + 2) * 2 - 1); }
    else if (v === 1) {
      bg(PAL.rose, 255); rays(960, 540, 14, k * .7, '#C74E6E', 255, .5);
      for (const s of [-1, 1]) maskHalf(960 + s * (260 + 120 * hash(k)), 540 + s * 60, 280 * z, s * (k * .9 + lk * 4), s);
    } else {
      bg(PAL.ochre, 255); rays(960, 700, 12, k, PAL.cream, 90, .4);
      clawd(960 + ox, 1180, 70 * z, { eyes: 'narrow', noShadow: true, mouth: null, rot: r * .5 });
    }
    if (fast) wedges(960, 540, t, 22, 520, [PAL.ink, RED, PAL.cream]);
    const [cf, cs] = v === 0 ? [PAL.cream, RED] : v === 1 ? [PAL.ink, PAL.cream] : [RED, PAL.ink];
    ty('LIES', 960 + ox, 560 + oy, 560 * z * (1 + .08 * hit), { col: cf, stroke: cs, sw: .06, shadow: v === 1 ? RED : PAL.ink, rot: r });
    flash(.7 * seg(t, kb(21) - .08, kb(21)), RED);
  }

  // ======================================================================================
  // 8 · 33.42–35.24  "with your shinigami eyes": crimson close-up, eyes flare, the camera dives into an eye
  // ======================================================================================
  const rim = (u, sw) => { inkLine([[-4.8 * u, -8.1 * u], [4.9 * u, -8.1 * u], [5.1 * u, -2.2 * u]], sw * 1.6, '#FF4A60', 'ink', 0); };
  function shinigami(t, lt) {
    const TE = 34.78, f1 = hitAt(t, 33.87, 2.5), f2 = hitAt(t, TE, 2), dive = easeIn(seg(t, TE, kb(25))), [sx, sy] = shakeXY(t, 10 * f1 + 16 * f2 + 4 * kick(t, 8));
    bg(DARKRED, 255);
    paint(ellPts(960, 700, 900 + 200 * f2, 560 + 150 * f2, 16), { wash: '#7A1022', washOp: 150, ink: null, curv: .5 });
    paint(ellPts(960, 700, 560 + 160 * f1, 360 + 110 * f1, 16), { wash: '#B01A30', washOp: 120 + 80 * f1, ink: null, curv: .5 });
    wedges(960, 700, t, 30, 420, [RED, PAL.ink, '#8E1426']);
    const u = 58, X = 960, Y = 1070, eye = [X + 2.5 * u, Y - 6 * u];
    camBegin(lerp(960, eye[0], dive) + sx, lerp(560, eye[1], dive) + sy, lerp(1 + .05 * lt, 6, dive), 0);
    clawd(X, Y, u, { eyes: 'red', noShadow: true, col: '#2C1620', dk: '#170A10', lt: '#4A2A38', mouth: null, sq: -.05 * f1, draw: rim });
    const fl = Math.max(f1, f2 * 1.4);
    for (const ex of [-2.5, 2.5]) {
      const ecx = X + ex * u, ecy = Y - 6 * u;
      paint(ellPts(ecx, ecy, u * (1.3 + 2.2 * fl), u * (1.3 + 2.2 * fl), 14), { wash: '#FF3048', washOp: 50 + 90 * clamp(fl), ink: null, curv: .5 });
      paint(rectPts(ecx - .5 * u, ecy - u, u, 2 * u, u * .05), { wash: '#FF4A60', ink: PAL.ink, sw: 1.2 });
      paint(rectPts(ecx - .3 * u, ecy - .8 * u, .6 * u, 1.6 * u), { wash: '#FFD0D6', washOp: 150 + 100 * clamp(fl), ink: null });
      if (fl > .05) paint(starPts(ecx, ecy, u * 3.2 * fl * (1 + .1 * Math.sin(t * 30)), .1, 4, .3), { wash: '#FFE3E6', ink: null });
    }
    camEnd();
    const away = easeIn(seg(t, TE - .03, TE + .12));
    wordLine(t, [['WITH', 33.5], ['YOUR', 33.7]], 960, 95 - 200 * away, 90, { font: 'marker', col: PAL.cream, shadow: PAL.ink });
    wordLine(t, [['SHI', 33.87], ['NI', 34.1], ['GA', 34.28], ['MI', 34.45]], 960, 365 - 520 * away, 300, {
      space: 0, col: RED, stroke: PAL.cream, sw: .05, shadow: PAL.ink, brushy: '#8E1426', popD: .1, alpha: 1 - away
    });
    ty('EYES', 960, 540, 520 * (1 + 1.2 * dive), { col: PAL.cream, stroke: RED, sw: .07, shadow: PAL.ink, brushy: PAL.rose, pop: (t - TE) / .14, alpha: 1 - seg(t, 35.0, 35.15) });
    flushType();
    const ir = seg(t, 35.02, kb(25));
    if (ir > 0) iris(960, 540, lerp(1200, 0, easeIn(ir)), RED);
  }

  // ======================================================================================
  // 9 · 35.24–35.90  end card: title on a rose swash, tiny Clawd bows
  // ======================================================================================
  function endCard(t, lt) {
    blot(960, 520, 820, 380, PAL.clayLt, 60);
    swash(150, 480, 1770, 440, 340, PAL.rose, easeOut(lt / .2), 9, PAL.clay);
    splat(1580, 700, 50, PAL.clay, 4, backOut((lt - .08) / .12));
    const bow = Math.sin(seg(lt, .15, .6) * Math.PI);
    clawd(960, 930, 13, { eyes: 'happy', mouth: 'smile', blush: true, rot: .12 * bow, sq: .15 * bow, aL: -.6 * bow + .2, aR: .8 + .5 * bow, emote: 'spark', emoteK: seg(lt, .2, .35) });
    ty('CLAUDE POP', 960, 460, 250, { col: PAL.cream, stroke: PAL.ink, sw: .07, shadow: PAL.ink, brushy: PAL.clayLt, pop: (lt - .02) / .14, rot: -.03 });
    ty('hook test cut', 960, 665, 64, { font: 'marker', col: PAL.clayDk, shadow: false, pop: (lt - .12) / .14 });
    flash(1 - lt / .08, RED);
  }

  const S = fn => (t, lt, dur) => { Q = []; fn(t, lt, dur); flushType(); };
  cut('test_hook', 23.0, 35.9, [
    [23.0, S(coldOpen)], [K0, S(drop)], [24.5, S(future)], [kb(4), S(foom)], [26.5, S(room)], [28.0, S(shrooms)],
    [kb(12), S(maskShot)], [kb(14), S(clawdEye)], [kb(16), S(crack)], [kb(17), S(reveal)], [kb(18), S(strobe)],
    [kb(21), S(shinigami)], [kb(25), S(endCard)]
  ]);
})();
