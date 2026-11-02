/* SURVEILLANCE MODE – "Radar Sector". Vector aircraft (heading / altitude / speed) so each one leaves the
   sector at its assigned exit fix and altitude while keeping 5 NM / 1000 ft separation and avoiding zones. */
window.ATC = window.ATC || {};
ATC.radar = (function () {
  const SZ = 100, PX = 7, OFF = 46, W = SZ * PX + OFF * 2, K = 15; // K = simulated seconds per real second
  const SEP_H = 5, SEP_V = 10, TURN = 3, CLIMB = 0.25, ACCEL = 2;
  const NAMES = ['Hello Sector', 'Pair Crossing', 'Double Cross', 'Five Flights', 'Rising & Falling',
    'Level Changes', 'Busy Afternoon', 'Restricted Zone', 'Dodge the Zone', 'Zone Squeeze',
    'Stormfront', 'Safety Net Off', 'Weather Wall', 'Triple Zones', 'Rush Hour',
    'Speed Mix', 'Pressure Cooker', 'Dense Core', 'Near Capacity', 'Radar Master'];
  // aircraft, conflict pairs, restricted zones, weather cells, altitude-change prob, mixed speeds
  const CFG = [
    [3, 1, 0, 0, 0, 0], [4, 1, 0, 0, 0, 0], [4, 2, 0, 0, 0, 0], [5, 2, 0, 0, 0, 0], [6, 2, 0, 0, .3, 0],
    [6, 3, 0, 0, .5, 0], [7, 3, 0, 0, .5, 0], [7, 3, 1, 0, .5, 0], [8, 4, 1, 0, .5, 0], [8, 4, 2, 0, .5, 0],
    [9, 4, 2, 1, .5, 0], [9, 5, 2, 1, .5, 0], [10, 5, 2, 2, .5, 0], [10, 5, 3, 2, .5, 0], [11, 6, 3, 2, .5, 0],
    [12, 6, 3, 3, .5, 1], [12, 7, 3, 3, .5, 1], [13, 7, 3, 3, .5, 1], [14, 8, 3, 3, .5, 1], [15, 8, 4, 3, .6, 1]
  ].map((c, i) => ({ n: i + 1, name: NAMES[i], ac: c[0], pairs: c[1], zones: c[2], wx: c[3], alt: c[4], mix: c[5],
    alert: i < 10, direct: i < 10, los: i < 10 ? 1 : 2 }));

  const FIXES = [['ALFA', 25, 100], ['BRVO', 50, 100], ['CHRL', 75, 100], ['DELT', 100, 75], ['ECHO', 100, 50], ['FOXT', 100, 25],
    ['GOLF', 75, 0], ['HOTL', 50, 0], ['INDI', 25, 0], ['JULT', 0, 25], ['KILO', 0, 50], ['LIMA', 0, 75]].map(f => ({ name: f[0], x: f[1], y: f[2] }));
  const side = f => (f.y === 100 ? 0 : f.x === 100 ? 1 : f.y === 0 ? 2 : 3);

  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const brg = (x0, y0, x1, y1) => ((Math.atan2(x1 - x0, y1 - y0) * 180 / Math.PI) + 360) % 360;
  const norm = h => ((h % 360) + 360) % 360;
  const pad3 = n => String(Math.round(n)).padStart(3, '0');

  function ray(px, py, dx, dy) { // distance from (px,py) along (dx,dy) to the square boundary
    const tx = dx > 0 ? (SZ - px) / dx : dx < 0 ? -px / dx : Infinity, ty = dy > 0 ? (SZ - py) / dy : dy < 0 ? -py / dy : Infinity;
    return Math.min(tx, ty);
  }

  function makeScenario(cfg) {
    const r = mulberry(cfg.n * 1337 + 11), list = [], pre = ['SIA', 'TGW', 'MAS', 'CPA', 'JST', 'UAE', 'QFA', 'THA', 'AXM', 'VJC'];
    const speeds = cfg.mix ? [170, 200, 240, 280, 320, 350] : [220, 240, 260, 280];
    const pick = a => a[Math.floor(r() * a.length)];
    const alts = [100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300];
    const used = new Set();
    function mk(entry, fix, spd, alt, spawn) {
      let cs; do { cs = pick(pre) + (100 + Math.floor(r() * 899)); } while (used.has(cs)); used.add(cs);
      let req = alt;
      if (r() < cfg.alt) { const d = (2 + Math.floor(r() * 4)) * 10 * (r() < 0.5 ? -1 : 1); req = Math.max(60, Math.min(340, alt + d)); if (req === alt) req = alt + 20; }
      return { cs, x: entry.x, y: entry.y, fix, spd, alt, req, spawn };
    }
    const Δ = 120;
    for (let p = 0; p < cfg.pairs && list.length + 2 <= cfg.ac; p++) {
      const P = { x: 32 + r() * 36, y: 32 + r() * 36 };
      const alt = pick(alts), f1 = pick(FIXES);
      let f2, tries = 0;
      do { f2 = pick(FIXES); tries++; const a1 = brg(P.x, P.y, f1.x, f1.y), a2 = brg(P.x, P.y, f2.x, f2.y), d = Math.abs(((a1 - a2 + 540) % 360) - 180); if (f2 !== f1 && d >= 45 && d <= 150) break; } while (tries < 60);
      const ents = [f1, f2].map(f => {
        const hd = brg(P.x, P.y, f.x, f.y), ux = Math.sin(hd * Math.PI / 180), uy = Math.cos(hd * Math.PI / 180);
        const t = ray(P.x, P.y, -ux, -uy); return { fix: f, ex: P.x - ux * t, ey: P.y - uy * t, dist: t };
      });
      const sp = [pick(speeds), pick(speeds)], T = 0;
      const ts = ents.map((e, i) => T - e.dist / (sp[i] / 3600));
      const shift = -Math.min(ts[0], ts[1]) + p * Δ + Math.floor(r() * 20);
      ents.forEach((e, i) => { const a = mk({ x: e.ex, y: e.ey }, e.fix, sp[i], i ? alt + (r() < 0.3 ? 5 : 0) : alt, ts[i] + shift); a.pair = p; list.push(a); });
    }
    const win = Math.max(300, cfg.pairs * Δ);
    while (list.length < cfg.ac) {
      const s = Math.floor(r() * 4), v = 10 + r() * 80;
      const entry = [{ x: v, y: SZ }, { x: SZ, y: v }, { x: v, y: 0 }, { x: 0, y: v }][s];
      const cands = FIXES.filter(f => { const d = (side(f) - s + 4) % 4; return d !== 0; });
      const fix = pick(cands);
      list.push(mk(entry, fix, pick(speeds), pick(alts), r() * win));
    }
    list.forEach(a => { a.x = Math.max(0.2, Math.min(SZ - 0.2, a.x)); a.y = Math.max(0.2, Math.min(SZ - 0.2, a.y)); });
    list.sort((a, b) => a.spawn - b.spawn);
    // zones & weather placed on the straight tracks of random aircraft so they have to be avoided
    const hazards = [];
    const cand = list.filter(a => a.pair === undefined || r() < 0.5);
    const add = (kind, rad) => {
      for (let tries = 0; tries < 600; tries++) {
        const a = tries < 200 ? pick(cand) : pick(list), f = 0.3 + r() * 0.4, cx = a.x + (a.fix.x - a.x) * f, cy = a.y + (a.fix.y - a.y) * f;
        const lim = tries < 200 ? 20 : 14, gap = tries < 100 ? 6 : tries < 300 ? 2 : -10;
        if (cx < lim || cx > SZ - lim || cy < lim || cy > SZ - lim) continue;
        if (hazards.some(h => Math.hypot(h.x - cx, h.y - cy) < h.r + rad + gap)) continue;
        hazards.push({ kind, x: cx, y: cy, r: rad }); return;
      }
    };
    for (let i = 0; i < cfg.zones; i++) add('zone', 7 + r() * 2);
    for (let i = 0; i < cfg.wx; i++) add('wx', 9 + r() * 3);
    return { list, hazards };
  }

  function describe(cfg) {
    const bits = [`${cfg.ac} flights to hand off`, `${cfg.pairs} crossing conflict${cfg.pairs > 1 ? 's' : ''} built in`, `max ${cfg.los} loss${cfg.los > 1 ? 'es' : ''} of separation`];
    if (cfg.alt) bits.push('some flights must change level before exit');
    if (cfg.zones) bits.push(`${cfg.zones} restricted zone${cfg.zones > 1 ? 's' : ''} (red)`);
    if (cfg.wx) bits.push(`${cfg.wx} storm cell${cfg.wx > 1 ? 's' : ''} (blue) – avoid`);
    bits.push(cfg.alert ? 'conflict alerts ON' : 'conflict alerts OFF – scan for yourself');
    if (!cfg.direct) bits.push('"Direct to exit" disabled');
    return bits;
  }

  function start(host, level, hooks) {
    const cfg = CFG[level - 1], sc = makeScenario(cfg);
    const maxScore = cfg.ac * 150;
    const S = {
      t: 0, rt: 0, ac: [], idx: 0, score: 0, over: false, paused: false, fast: 1, sel: null, toasts: [], los: new Set(), zoneIn: new Set(),
      err: { los: 0, airspace: 0, weather: 0, wrongExit: 0, wrongAlt: 0, timeout: 0 }, ok: 0, gone: 0, cmds: 0, losSecs: 0, started: Date.now(), alerts: []
    };
    const lastSpawn = sc.list[sc.list.length - 1].spawn, limit = lastSpawn + 3200; // simulated seconds
    host.innerHTML = `
      <div class="hud">
        <div class="hud-title">Surveillance ${level} · ${cfg.name}</div>
        <div class="hud-stats"><span>Handed off <b data-h="ok">0</b></span><span>Loss of sep. <b data-h="los">0</b></span><span>Score <b data-h="score">0</b></span><span>Clock <b data-h="time">0</b></span></div>
        <div class="hud-btns"><button class="btn small ghost" data-h="speed">×1</button><button class="btn small" data-h="pause">Pause</button><button class="btn small ghost" data-h="quit">Quit</button></div>
      </div>
      <div class="game-split radar-split">
        <div class="cv-wrap radar"><canvas width="${W}" height="${W}"></canvas></div>
        <aside class="ctl" aria-label="Aircraft controls"></aside>
      </div>
      <p class="hint">Click an aircraft (or its chip), then vector it. Each flight must leave at its <b>exit fix</b> at its <b>required level</b> (data-block line 3). Keep ≥ 5 NM <i>or</i> ≥ 1000 ft apart. Keys: ←/→ heading ±10, ↑/↓ level ±10, [ / ] speed ±10, Tab = next, Space = pause.</p>`;
    const cv = host.querySelector('canvas'), ctx = cv.getContext('2d'), ctl = host.querySelector('.ctl');
    const $h = k => host.querySelector(`[data-h="${k}"]`);
    let raf = 0, last = 0, uiTimer = 0, uiSig = '';
    const toast = (txt, col) => S.toasts.push({ txt, col: col || '#fff', t: S.rt });
    const px = x => OFF + x * PX, py = y => OFF + (SZ - y) * PX;

    function spawn(d) {
      const a = { cs: d.cs, x: d.x, y: d.y, hdg: brg(d.x, d.y, d.fix.x, d.fix.y), spd: d.spd, alt: d.alt, fix: d.fix, req: d.req, cmds: 0, last: {}, trail: [], tT: 0, inside: false, done: false };
      a.hdgT = a.hdg; a.spdT = a.spd; a.altT = a.alt; S.ac.push(a);
      if (!S.sel) S.sel = a;
    }
    function command(a, axis, fn) {
      if (S.over || S.paused || !a || a.done) return;
      fn(a); if (S.rt - (a.last[axis] || -99) > 1.5) { a.cmds++; S.cmds++; } a.last[axis] = S.rt;
    }
    const setHdg = (a, h) => command(a, 'h', x => { x.hdgT = norm(h); });
    const addHdg = (a, d) => command(a, 'h', x => { x.hdgT = norm(x.hdgT + d); });
    const setAlt = (a, v) => command(a, 'a', x => { x.altT = Math.max(30, Math.min(400, Math.round(v))); });
    const addAlt = (a, d) => command(a, 'a', x => { x.altT = Math.max(30, Math.min(400, Math.round(x.altT + d))); });
    const setSpd = (a, v) => command(a, 's', x => { x.spdT = Math.max(160, Math.min(350, Math.round(v))); });
    const addSpd = (a, d) => command(a, 's', x => { x.spdT = Math.max(160, Math.min(350, x.spdT + d)); });
    const direct = a => { if (cfg.direct) command(a, 'h', x => { x.hdgT = Math.round(brg(x.x, x.y, x.fix.x, x.fix.y)); }); };

    function advance(dt) { // dt simulated seconds, <= 1
      S.t += dt;
      while (S.idx < sc.list.length && sc.list[S.idx].spawn <= S.t) spawn(sc.list[S.idx++]);
      for (const a of S.ac) {
        if (a.done) continue;
        let dh = ((a.hdgT - a.hdg + 540) % 360) - 180; const m = TURN * dt; a.hdg = norm(Math.abs(dh) <= m ? a.hdgT : a.hdg + Math.sign(dh) * m);
        const da = a.altT - a.alt; a.alt += Math.abs(da) <= CLIMB * dt ? da : Math.sign(da) * CLIMB * dt;
        const ds = a.spdT - a.spd; a.spd += Math.abs(ds) <= ACCEL * dt ? ds : Math.sign(ds) * ACCEL * dt;
        const d = a.spd / 3600 * dt, r = a.hdg * Math.PI / 180; a.x += Math.sin(r) * d; a.y += Math.cos(r) * d;
        a.tT += dt; if (a.tT >= 6) { a.tT = 0; a.trail.push([a.x, a.y]); if (a.trail.length > 6) a.trail.shift(); }
        const inside = a.x >= 0 && a.x <= SZ && a.y >= 0 && a.y <= SZ;
        if (inside) a.inside = true;
        else if (a.inside) exit(a);
      }
      // separation + hazards
      const act = S.ac.filter(a => !a.done);
      const now = new Set();
      for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) {
        const a = act[i], b = act[j];
        if (Math.hypot(a.x - b.x, a.y - b.y) < SEP_H && Math.abs(a.alt - b.alt) < SEP_V) {
          const k = a.cs + '|' + b.cs; now.add(k); S.losSecs += dt;
          if (!S.los.has(k)) { S.los.add(k); S.err.los++; S.score -= 200; toast(`LOSS OF SEPARATION ${a.cs} / ${b.cs} (-200)`, '#ff5c5c'); }
        }
      }
      S.los.forEach(k => { if (!now.has(k)) S.los.delete(k); });
      for (const a of act) sc.hazards.forEach((h, hi) => {
        const k = a.cs + '#' + hi, inn = Math.hypot(a.x - h.x, a.y - h.y) < h.r;
        if (inn && !S.zoneIn.has(k)) {
          S.zoneIn.add(k);
          if (h.kind === 'zone') { S.err.airspace++; S.score -= 150; toast(`${a.cs} entered RESTRICTED AREA (-150)`, '#ff5c5c'); }
          else { S.err.weather++; S.score -= 75; toast(`${a.cs} flew into STORM CELL (-75)`, '#ffd166'); }
        } else if (!inn) S.zoneIn.delete(k);
      });
      // predicted conflicts (assist)
      S.alerts = [];
      if (cfg.alert) for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) {
        const a = act[i], b = act[j]; if (Math.abs(a.alt - b.alt) >= SEP_V) continue;
        for (let t = 0; t <= 240; t += 15) {
          const ax = a.x + Math.sin(a.hdg * Math.PI / 180) * a.spd / 3600 * t, ay = a.y + Math.cos(a.hdg * Math.PI / 180) * a.spd / 3600 * t;
          const bx = b.x + Math.sin(b.hdg * Math.PI / 180) * b.spd / 3600 * t, by = b.y + Math.cos(b.hdg * Math.PI / 180) * b.spd / 3600 * t;
          if (Math.hypot(ax - bx, ay - by) < SEP_H) { S.alerts.push([a, b]); break; }
        }
      }
      if (S.idx >= sc.list.length && S.ac.every(a => a.done)) finish();
      else if (S.t >= limit) { S.ac.filter(a => !a.done).forEach(a => { S.err.timeout++; S.score -= 100; }); finish(); }
    }
    function exit(a) {
      a.done = true; S.gone++;
      if (S.sel === a) S.sel = S.ac.find(x => !x.done) || null;
      const ex = Math.max(0, Math.min(SZ, a.x)), ey = Math.max(0, Math.min(SZ, a.y));
      const fixOK = Math.hypot(ex - a.fix.x, ey - a.fix.y) <= 6, altOK = Math.abs(a.alt - a.req) <= 5;
      if (fixOK && altOK) {
        const bonus = Math.max(0, 50 - 10 * Math.max(0, a.cmds - 4)); S.ok++; S.score += 100 + bonus; toast(`${a.cs} handed off +${100 + bonus}`, '#4be0a0');
      } else if (!fixOK) { S.err.wrongExit++; S.score -= 100; toast(`${a.cs} left via wrong exit (-100)`, '#ff5c5c'); }
      else { S.err.wrongAlt++; S.score -= 75; toast(`${a.cs} left at FL${pad3(a.alt)}, required FL${pad3(a.req)} (-75)`, '#ffd166'); }
    }
    function step(dtReal) {
      if (S.over || S.paused) return;
      S.rt += dtReal; let ds = dtReal * K * S.fast;
      while (ds > 0 && !S.over) { const d = Math.min(1, ds); advance(d); ds -= d; }
    }
    function finish() {
      if (S.over) return; S.over = true; stop();
      const e = S.err, n = cfg.ac, clamp = v => Math.max(0, Math.min(100, Math.round(v)));
      const avg = S.cmds / n;
      const res = {
        mode: 'radar', level, score: Math.round(S.score), maxScore, passed: S.ok >= Math.ceil(n * 0.8) && e.los <= cfg.los && e.airspace === 0,
        duration: Math.round((Date.now() - S.started) / 1000), simTime: Math.round(S.t), errors: Object.assign({}, e),
        skills: { safety: clamp(100 - 35 * e.los), compliance: clamp(100 - 25 * e.airspace - 12 * e.weather - 20 * (e.wrongExit + e.wrongAlt + e.timeout)),
          throughput: clamp(100 * S.ok / n), workload: clamp(100 - 12 * Math.max(0, avg - 4)) },
        stats: { handoffs: S.ok, total: n, commands: S.cmds, avgCmds: +avg.toFixed(1), losSecs: Math.round(S.losSecs), allowedLos: cfg.los }
      };
      res.pct = Math.max(0, Math.min(1, res.score / maxScore)) * 100;
      res.tip = tip(res); ctrl.result = res; hooks && hooks.onEnd && hooks.onEnd(res);
    }
    function tip(r) {
      const e = r.errors;
      if (e.los) return 'Loss of separation: look ahead along each velocity vector. Fix it early with a small heading change (10–20°) or a level change of at least 1000 ft – early, small instructions beat late, large ones.';
      if (e.airspace) return 'A flight entered a restricted zone. Turn early, then use the bearing shown in the control panel to rejoin the exit fix.';
      if (e.wrongExit) return 'Some flights missed their exit fix. Check bearing & distance to the fix in the panel and re-aim before the boundary.';
      if (e.wrongAlt) return 'Check the required exit level (data-block line 3) and start the climb/descent early – aircraft change level at only ~1500 ft/min.';
      if (e.weather) return 'Storm cells are best avoided: a small early turn costs less than a large late one.';
      if (r.stats.avgCmds > 5) return 'You issued many instructions per aircraft. Plan the whole manoeuvre first (turn, then resume) to keep workload low.';
      return 'Smooth, safe sector control. Try for fewer instructions per flight to earn the efficiency bonus.';
    }

    /* ---------- rendering ---------- */
    function draw() {
      ctx.fillStyle = '#04120d'; ctx.fillRect(0, 0, W, W);
      ctx.strokeStyle = 'rgba(80,220,140,.16)'; ctx.lineWidth = 1;
      for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(px(50), py(50), k * 20 * PX, 0, 7); ctx.stroke(); }
      for (let k = 1; k < 10; k++) { ctx.beginPath(); ctx.moveTo(px(k * 10), py(0)); ctx.lineTo(px(k * 10), py(100)); ctx.moveTo(px(0), py(k * 10)); ctx.lineTo(px(100), py(k * 10)); ctx.strokeStyle = 'rgba(80,220,140,.05)'; ctx.stroke(); }
      ctx.strokeStyle = 'rgba(120,255,180,.6)'; ctx.lineWidth = 2; ctx.strokeRect(px(0), py(100), SZ * PX, SZ * PX);
      // hazards
      sc.hazards.forEach(h => {
        ctx.beginPath(); ctx.arc(px(h.x), py(h.y), h.r * PX, 0, 7);
        if (h.kind === 'zone') { ctx.fillStyle = 'rgba(255,70,70,.18)'; ctx.fill(); ctx.setLineDash([6, 5]); ctx.strokeStyle = '#ff5c5c'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#ff9a9a'; ctx.font = '11px ui-monospace,monospace'; ctx.textAlign = 'center'; ctx.fillText('RESTRICTED', px(h.x), py(h.y) + 4); }
        else { ctx.fillStyle = 'rgba(80,140,255,.22)'; ctx.fill(); ctx.strokeStyle = '#6fa0ff'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = '#9dbcff'; ctx.font = '11px ui-monospace,monospace'; ctx.textAlign = 'center'; ctx.fillText('STORM', px(h.x), py(h.y) + 4); }
      });
      // fixes
      ctx.font = '11px ui-monospace,monospace'; ctx.textAlign = 'center';
      FIXES.forEach(f => {
        ctx.fillStyle = '#ffd166'; ctx.beginPath(); const x = px(f.x), y = py(f.y); ctx.moveTo(x, y - 6); ctx.lineTo(x + 6, y + 5); ctx.lineTo(x - 6, y + 5); ctx.closePath(); ctx.fill();
        const ox = f.x === 0 ? -22 : f.x === 100 ? 22 : 0, oy = f.y === 100 ? -12 : f.y === 0 ? 20 : 0; ctx.fillText(f.name, x + ox, y + oy + 4);
      });
      // aircraft
      const conflict = new Set(); S.alerts.forEach(p => { conflict.add(p[0]); conflict.add(p[1]); });
      const los = new Set(); S.los.forEach(k => k.split('|').forEach(c => los.add(c)));
      S.alerts.forEach(p => { ctx.strokeStyle = 'rgba(255,200,0,.7)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px(p[0].x), py(p[0].y)); ctx.lineTo(px(p[1].x), py(p[1].y)); ctx.stroke(); ctx.setLineDash([]); });
      S.ac.forEach(a => {
        if (a.done) return;
        const x = px(a.x), y = py(a.y), isSel = a === S.sel, bad = los.has(a.cs), warn = conflict.has(a);
        const col = bad ? '#ff4d4d' : isSel ? '#5fe3ff' : warn ? '#ffd166' : '#6dff9c';
        a.trail.forEach((t, i) => { ctx.fillStyle = col; ctx.globalAlpha = 0.15 + i * 0.1; ctx.fillRect(px(t[0]) - 1.5, py(t[1]) - 1.5, 3, 3); }); ctx.globalAlpha = 1;
        const vr = a.hdg * Math.PI / 180, vl = a.spd / 3600 * 60 * PX; // 1-minute vector
        ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(vr) * vl, y - Math.cos(vr) * vl); ctx.stroke();
        if (isSel) { // target heading bar + separation ring
          const tr = a.hdgT * Math.PI / 180; ctx.strokeStyle = 'rgba(95,227,255,.5)'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(tr) * 90, y - Math.cos(tr) * 90); ctx.stroke();
          ctx.beginPath(); ctx.arc(x, y, SEP_H * PX, 0, 7); ctx.stroke(); ctx.setLineDash([]);
          const fx = px(a.fix.x), fy = py(a.fix.y); ctx.strokeStyle = 'rgba(255,209,102,.35)'; ctx.setLineDash([2, 6]); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(fx, fy); ctx.stroke(); ctx.setLineDash([]);
        }
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(x - 4, y - 4, 8, 8);
        const arrow = Math.abs(a.altT - a.alt) < 0.5 ? '' : a.altT > a.alt ? '↑' : '↓';
        const okAlt = Math.abs(a.alt - a.req) <= 5;
        ctx.textAlign = 'left'; ctx.font = '11px ui-monospace,monospace'; ctx.fillStyle = col;
        ctx.fillText(a.cs, x + 9, y - 12); ctx.fillText(`${pad3(a.alt)}${arrow} ${Math.round(a.spd)}`, x + 9, y); 
        ctx.fillStyle = okAlt ? '#8de3b5' : '#ffd166'; ctx.fillText(`${a.fix.name} ${pad3(a.req)}`, x + 9, y + 12);
      });
      S.toasts = S.toasts.filter(t => S.rt - t.t < 4); ctx.textAlign = 'center'; ctx.font = 'bold 14px system-ui';
      S.toasts.slice(-4).forEach((t, i) => { ctx.globalAlpha = Math.max(0, 1 - (S.rt - t.t) / 4); ctx.fillStyle = t.col; ctx.fillText(t.txt, W / 2, OFF + 18 + i * 20); }); ctx.globalAlpha = 1;
      if (S.paused) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, W); ctx.fillStyle = '#fff'; ctx.font = 'bold 40px system-ui'; ctx.fillText('PAUSED', W / 2, W / 2); }
    }
    function hud() {
      $h('ok').textContent = `${S.ok}/${cfg.ac}`; $h('score').textContent = Math.round(S.score);
      const l = $h('los'); l.textContent = `${S.err.los}/${cfg.los}`; l.className = S.err.los > cfg.los ? 'bad' : '';
      const m = Math.floor(S.t / 60), s = Math.floor(S.t % 60); $h('time').textContent = `${m}:${String(s).padStart(2, '0')}`;
    }
    function renderCtl(force) {
      const a = S.sel, act = S.ac.filter(x => !x.done);
      const sig = act.map(x => x.cs).join() + '|' + (a ? a.cs : '') + '|' + (S.paused ? 1 : 0) + (a ? [Math.round(a.hdg), Math.round(a.alt), Math.round(a.spd), a.hdgT, a.altT, a.spdT].join() : '');
      if (!force && sig === uiSig) return; uiSig = sig;
      let h = `<div class="chips">${act.map(x => `<button class="chip${x === a ? ' on' : ''}" data-sel="${x.cs}">${x.cs}</button>`).join('') || '<em>No traffic yet…</em>'}</div>`;
      if (a) {
        const b = brg(a.x, a.y, a.fix.x, a.fix.y), d = Math.hypot(a.fix.x - a.x, a.fix.y - a.y);
        h += `<div class="acinfo"><h3>${a.cs}</h3>
          <div class="grid2"><span>Heading</span><b>${pad3(a.hdg)}° → ${pad3(a.hdgT)}°</b>
          <span>Level</span><b>FL${pad3(a.alt)} → FL${pad3(a.altT)}</b><span>Speed</span><b>${Math.round(a.spd)} kt → ${a.spdT}</b>
          <span>Exit</span><b>${a.fix.name} at FL${pad3(a.req)}</b><span>To exit fix</span><b>${pad3(b)}° · ${d.toFixed(0)} NM</b></div>
          <div class="ctlrow"><label>Heading</label>${[-30, -10, -5, 5, 10, 30].map(v => `<button class="btn tiny" data-cmd="h" data-v="${v}">${v > 0 ? '+' : ''}${v}</button>`).join('')}
            <input id="in-h" type="number" min="0" max="359" placeholder="hdg"><button class="btn tiny" data-cmd="hset">Set</button></div>
          <div class="ctlrow"><label>Level</label>${[-50, -10, 10, 50].map(v => `<button class="btn tiny" data-cmd="a" data-v="${v}">${v > 0 ? '+' : ''}${v}</button>`).join('')}
            <input id="in-a" type="number" min="30" max="400" step="10" placeholder="FL"><button class="btn tiny" data-cmd="aset">Set</button></div>
          <div class="ctlrow"><label>Speed</label>${[-20, -10, 10, 20].map(v => `<button class="btn tiny" data-cmd="s" data-v="${v}">${v > 0 ? '+' : ''}${v}</button>`).join('')}</div>
          ${cfg.direct ? '<button class="btn" data-cmd="direct">Direct to exit fix</button>' : '<p class="hint">Direct-to is disabled at this level – use the bearing above.</p>'}</div>`;
      }
      ctl.innerHTML = h;
    }

    /* ---------- wiring ---------- */
    ctl.addEventListener('pointerdown', e => {
      const sel = e.target.closest('[data-sel]'); if (sel) { S.sel = S.ac.find(x => x.cs === sel.dataset.sel); renderCtl(true); return; }
      const b = e.target.closest('[data-cmd]'); if (!b || !S.sel) return; const a = S.sel, v = +b.dataset.v;
      switch (b.dataset.cmd) {
        case 'h': addHdg(a, v); break; case 'a': addAlt(a, v); break; case 's': addSpd(a, v); break; case 'direct': direct(a); break;
        case 'hset': { const n = parseFloat(ctl.querySelector('#in-h').value); if (isFinite(n)) setHdg(a, n); break; }
        case 'aset': { const n = parseFloat(ctl.querySelector('#in-a').value); if (isFinite(n)) setAlt(a, n); break; }
      }
      renderCtl(true); e.preventDefault();
    });
    ctl.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { const n = parseFloat(e.target.value), a = S.sel; if (a && isFinite(n)) { e.target.id === 'in-h' ? setHdg(a, n) : setAlt(a, n); renderCtl(true); } } e.stopPropagation(); });
    cv.addEventListener('pointerdown', e => {
      const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * W / r.height;
      let best = null, bd = 30; S.ac.forEach(a => { if (a.done) return; const d = Math.hypot(px(a.x) - x, py(a.y) - y); if (d < bd) { bd = d; best = a; } });
      if (best) { S.sel = best; renderCtl(true); }
    });
    function onKey(e) {
      if (S.over || (e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) return; const a = S.sel;
      const map = { ArrowLeft: () => addHdg(a, -10), ArrowRight: () => addHdg(a, 10), ArrowUp: () => addAlt(a, 10), ArrowDown: () => addAlt(a, -10), '[': () => addSpd(a, -10), ']': () => addSpd(a, 10),
        ' ': () => $h('pause').click(), Tab: () => { const l = S.ac.filter(x => !x.done); if (l.length) S.sel = l[(l.indexOf(a) + 1) % l.length]; } };
      if (map[e.key]) { map[e.key](); e.preventDefault(); renderCtl(true); }
    }
    document.addEventListener('keydown', onKey);
    $h('pause').addEventListener('click', () => { S.paused = !S.paused; $h('pause').textContent = S.paused ? 'Resume' : 'Pause'; });
    $h('speed').addEventListener('click', () => { S.fast = S.fast === 1 ? 2 : 1; $h('speed').textContent = '×' + S.fast; });
    $h('quit').addEventListener('click', () => { if (confirm('Quit this level? This attempt will not be recorded.')) { S.over = true; stop(); hooks && hooks.onQuit && hooks.onQuit(); } });
    function frame(ts) { const dt = last ? Math.min(0.1, (ts - last) / 1000) : 0; last = ts; step(dt); draw(); hud(); renderCtl(); if (!S.over) raf = requestAnimationFrame(frame); }
    function stop() { cancelAnimationFrame(raf); clearInterval(uiTimer); document.removeEventListener('keydown', onKey); }
    renderCtl(true); raf = requestAnimationFrame(frame);
    const ctrl = { S, cfg, sc, step, advance, setHdg, setAlt, setSpd, direct, stop, result: null, brg };
    ATC.radar.current = ctrl;
    return ctrl;
  }

  return { levels: CFG, names: NAMES, start, describe, maxLevel: 20, makeScenario };
})();
