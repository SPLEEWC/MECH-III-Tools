/* ARCADE MODE – "Departure Rush" (tower departure sequencing, inspired by Lektor-style takeoff games).
   Line aircraft up, clear them for takeoff, respect runway occupancy + wake-turbulence spacing. */
window.ATC = window.ATC || {};
ATC.arcade = (function () {
  const W = 900, H = 600, ROLL = 5, LINEUP = 2, QCAP = 6;
  const NAMES = ['First Departure', 'Light Traffic', 'Wake Awareness', 'Heavy Mix', 'Peak Hour',
    'Parallel Ops', 'Two Lines', 'Balancing Act', 'Crossing Paths', 'Intersection Dance',
    'Medevac Call', 'Rush & Priority', 'Crosswind Rush', 'Heavy Metal', 'Triple Threat',
    'Hub Bank', 'Night Rush', 'Gridlock Risk', 'Airshow Exodus', 'Master Tower'];
  // kind, aircraft, spawn interval(s), heavy p, light p, priority p, patience(s), allowed safety violations
  const CFG = [
    ['S', 5, 12, 0, 0, 0, 70, 3], ['S', 6, 10, 0, .3, 0, 60, 3], ['S', 8, 9, .2, .3, 0, 55, 3],
    ['S', 10, 9, .3, .3, 0, 52, 3], ['S', 12, 8, .3, .3, 0, 48, 3], ['P', 12, 6.5, .2, .3, 0, 45, 2],
    ['P', 14, 6, .3, .3, 0, 42, 2], ['P', 16, 5.5, .3, .3, 0, 40, 2], ['X', 12, 7, .2, .3, 0, 45, 2],
    ['X', 14, 6.5, .3, .3, 0, 42, 2], ['X', 14, 6.5, .25, .3, .15, 42, 2], ['X', 16, 6, .3, .3, .15, 40, 2],
    ['X', 18, 5.5, .3, .3, .15, 38, 1], ['P', 20, 4.8, .4, .2, .1, 36, 1], ['T', 20, 5, .3, .3, .15, 38, 1],
    ['T', 24, 4.6, .3, .3, .15, 36, 1], ['T', 26, 4.4, .35, .3, .15, 35, 1], ['T', 28, 4.2, .35, .3, .15, 34, 1],
    ['T', 30, 4, .35, .3, .15, 33, 1], ['T', 34, 3.8, .35, .3, .15, 32, 1]
  ].map((c, i) => ({ n: i + 1, name: NAMES[i], kind: c[0], count: c[1], every: c[2], h: c[3], l: c[4], pr: c[5], pat: c[6], viol: c[7], assist: i < 8 }));

  const WAKE = { H: { H: 3, M: 6, L: 9 }, M: { L: 5 }, L: {} };
  const extra = (a, b) => (a && WAKE[a] && WAKE[a][b]) || 0;
  const CATN = { H: 'HEAVY', M: 'MEDIUM', L: 'LIGHT' };
  const COL = { H: '#ff9f43', M: '#4da3ff', L: '#4be0a0' };

  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function makeRunways(kind) {
    const defs = {
      S: [[240, 300, 860, 300, '09']],
      P: [[240, 160, 860, 160, '09L'], [240, 400, 860, 400, '09R']],
      X: [[240, 190, 860, 190, '09'], [640, 555, 640, 40, '36']],
      T: [[240, 100, 860, 100, '09L'], [240, 300, 860, 300, '09R'], [700, 560, 700, 30, '36']]
    }[kind];
    const cross = { S: [[]], P: [[], []], X: [[1], [0]], T: [[2], [2], [0, 1]] }[kind];
    return defs.map((d, i) => {
      const dx = d[2] - d[0], dy = d[3] - d[1], len = Math.hypot(dx, dy);
      return { i, x0: d[0], y0: d[1], x1: d[2], y1: d[3], label: d[4], len, ux: dx / len, uy: dy / len, cross: cross[i], lastStart: -999, lastCat: null, lined: null };
    });
  }

  function makePlan(cfg, nrw) {
    const r = mulberry(cfg.n * 7919 + 3), pre = ['SIA', 'TGW', 'MAS', 'CPA', 'JST', 'UAE', 'QFA', 'THA'];
    const types = { H: ['B77W', 'A388', 'B748'], M: ['A320', 'B738', 'A21N', 'E190'], L: ['C208', 'AT76', 'DH8D', 'C172'] };
    const plan = []; let t = 2;
    for (let i = 0; i < cfg.count; i++) {
      const x = r(), cat = x < cfg.h ? 'H' : x < cfg.h + cfg.l ? 'L' : 'M';
      const prio = i >= 3 && cat !== 'H' && r() < cfg.pr;
      const num = 100 + Math.floor(r() * 899), ty = types[cat][Math.floor(r() * types[cat].length)];
      plan.push({ i, t, cat, rw: Math.floor(r() * nrw), prio, type: ty, cs: prio ? 'LIFE' + num : pre[Math.floor(r() * pre.length)] + num });
      t += cfg.every * (0.7 + 0.6 * r());
    }
    return plan;
  }

  function describe(cfg) {
    const nrw = { S: 1, P: 2, X: 2, T: 3 }[cfg.kind];
    const bits = [`${nrw} runway${nrw > 1 ? 's' : ''}${cfg.kind === 'X' ? ' (crossing)' : cfg.kind === 'T' ? ' (two parallel + one crossing)' : cfg.kind === 'P' ? ' (parallel)' : ''}`,
      `${cfg.count} departures`, `depart at least ${Math.ceil(cfg.count * 0.8)}`, `max ${cfg.viol} safety violation${cfg.viol > 1 ? 's' : ''}`];
    if (cfg.h) bits.push('heavy aircraft need wake spacing behind them');
    if (cfg.pr) bits.push('medevac flights must leave within 25 s');
    return bits;
  }

  function start(host, level, hooks) {
    const cfg = CFG[level - 1];
    const rws = makeRunways(cfg.kind), plan = makePlan(cfg, rws.length);
    const limit = plan[plan.length - 1].t + 50;
    const maxScore = plan.reduce((s, p) => s + (p.prio ? 280 : 130), 0);
    const S = {
      now: 0, nextI: 0, ac: [], score: 0, over: false, paused: false, toasts: [], sel: null,
      err: { wake: 0, incursion: 0, delay: 0, overflow: 0, prioMiss: 0 }, departed: 0, rwDeparts: 0, started: Date.now()
    };
    host.innerHTML = `
      <div class="hud">
        <div class="hud-title">Arcade ${level} · ${cfg.name}</div>
        <div class="hud-stats">
          <span>Time <b data-h="time">0</b></span><span>Departed <b data-h="dep">0</b></span>
          <span>Score <b data-h="score">0</b></span><span>Safety viol. <b data-h="viol">0</b></span>
        </div>
        <div class="hud-btns"><button class="btn small" data-h="pause">Pause</button><button class="btn small ghost" data-h="quit">Quit</button></div>
      </div>
      <div class="game-split">
        <div class="cv-wrap"><canvas width="${W}" height="${H}"></canvas></div>
        <aside class="strips" aria-label="Departure strips"></aside>
      </div>
      <p class="hint">Tap a strip button (or the aircraft): <b>LINE UP</b> → wait for the runway → <b>CLEAR T/O</b>. Heavy aircraft need extra gap before the next departure.</p>`;
    const cv = host.querySelector('canvas'), ctx = cv.getContext('2d'), strips = host.querySelector('.strips');
    const $h = k => host.querySelector(`[data-h="${k}"]`);
    let raf = 0, last = 0, uiTimer = 0;

    const toast = (txt, col) => S.toasts.push({ txt, col: col || '#fff', t: S.now });
    const occupied = rw => [rw.i].concat(rw.cross).some(j => S.now - rws[j].lastStart < ROLL);
    const holding = rw => S.ac.filter(a => a.rw === rw.i && a.state === 'hold').sort((a, b) => a.spawnAt - b.spawnAt);

    function spawn(p) {
      const rw = rws[p.rw];
      if (holding(rw).length >= QCAP) { S.err.overflow++; S.score -= 100; toast(`${p.cs} diverted – holding area full (-100)`, '#ff5c5c'); return; }
      S.ac.push({ id: p.i, cs: p.cs, type: p.type, cat: p.cat, rw: p.rw, prio: p.prio, state: 'hold', spawnAt: S.now, lineT: 0, rollT: 0, airT: 0, delayed: false, prioFail: false });
      if (p.prio) toast(`MEDEVAC ${p.cs} – priority departure!`, '#ff7a7a');
    }
    function lineUp(a) {
      if (S.over || S.paused || !a || a.state !== 'hold') return;
      const rw = rws[a.rw];
      if (rw.lined) { toast(`RWY ${rw.label}: ${rw.lined.cs} already lined up`, '#ffd166'); return; }
      a.state = 'lineup'; a.lineT = 0; rw.lined = a; S.cmds = (S.cmds || 0) + 1;
    }
    function clearTO(a) {
      if (S.over || S.paused || !a || a.state !== 'lineup' || a.lineT < LINEUP) return;
      const rw = rws[a.rw];
      if (occupied(rw)) { S.err.incursion++; S.score -= 50; toast(`RUNWAY NOT CLEAR – clearance refused (-50)`, '#ff5c5c'); return; }
      const need = ROLL + extra(rw.lastCat, a.cat);
      if (S.now - rw.lastStart < need) { S.err.wake++; S.score -= 100; toast(`WAKE TURBULENCE VIOLATION (-100)`, '#ff5c5c'); }
      a.state = 'roll'; a.rollT = 0; rw.lined = null; rw.lastStart = S.now; rw.lastCat = a.cat; S.cmds = (S.cmds || 0) + 1;
    }
    function act(a) { if (!a) return; if (a.state === 'hold') lineUp(a); else if (a.state === 'lineup') clearTO(a); }

    function step(dt) {
      if (S.over || S.paused) return;
      S.now += dt;
      while (S.nextI < plan.length && plan[S.nextI].t <= S.now) spawn(plan[S.nextI++]);
      for (const a of S.ac) {
        if (a.state === 'hold' || a.state === 'lineup') {
          const wait = S.now - a.spawnAt;
          if (wait > cfg.pat && !a.delayed) { a.delayed = true; S.err.delay++; S.score -= 30; toast(`${a.cs} delayed (-30)`, '#ffd166'); }
          if (a.prio && wait > 25 && !a.prioFail) { a.prioFail = true; S.err.prioMiss++; S.score -= 50; toast(`MEDEVAC ${a.cs} delayed (-50)`, '#ff5c5c'); }
          if (a.state === 'lineup') a.lineT += dt;
        } else if (a.state === 'roll') {
          a.rollT += dt;
          if (a.rollT >= ROLL) {
            a.state = 'air'; a.airT = 0; S.departed++;
            let pts = (a.prio && !a.prioFail ? 200 : 100) + (a.delayed ? 0 : 30) + (a.prio && !a.prioFail ? 50 : 0);
            S.score += pts; toast(`${a.cs} airborne +${pts}`, '#4be0a0');
          }
        } else if (a.state === 'air') { a.airT += dt; if (a.airT > 2.5) a.state = 'gone'; }
      }
      const busy = S.ac.some(a => a.state === 'hold' || a.state === 'lineup' || a.state === 'roll');
      if (S.now >= limit || (S.nextI >= plan.length && !busy)) finish();
    }

    function finish() {
      if (S.over) return; S.over = true; cancelAnimationFrame(raf); clearInterval(uiTimer);
      const e = S.err, violations = e.wake + e.incursion, target = Math.ceil(cfg.count * 0.8);
      const clamp = v => Math.max(0, Math.min(100, Math.round(v)));
      const res = {
        mode: 'arcade', level, score: Math.round(S.score), maxScore, passed: S.departed >= target && violations <= cfg.viol,
        duration: Math.round((Date.now() - S.started) / 1000), simTime: Math.round(S.now),
        errors: Object.assign({}, e),
        skills: { safety: clamp(100 - 25 * e.wake - 20 * e.incursion), compliance: clamp(100 - 35 * e.prioMiss - 10 * e.incursion),
          throughput: clamp(100 * S.departed / cfg.count), workload: clamp(100 - 8 * e.delay - 25 * e.overflow) },
        stats: { departed: S.departed, total: cfg.count, target, violations, allowed: cfg.viol }
      };
      res.pct = Math.max(0, Math.min(1, res.score / maxScore)) * 100;
      res.tip = tip(res);
      ctrl.result = res; hooks && hooks.onEnd && hooks.onEnd(res);
    }
    function tip(r) {
      const e = r.errors;
      if (e.wake) return 'Wake turbulence: a HEAVY needs ~6 s extra before a medium and ~9 s before a light. Release lights/mediums first when the gap is short, or line up heavies back-to-back (only 3 s extra).';
      if (e.incursion) return 'You asked for takeoff while the runway (or a crossing runway) was still occupied. Watch the runway colour: it turns red while an aircraft is rolling.';
      if (e.prioMiss) return 'Medevac flights must leave within 25 s of appearing – line them up as soon as they appear.';
      if (e.overflow) return 'Holding area overflowed. Line up the next aircraft while the previous one is still rolling to keep the runway busy.';
      if (e.delay) return 'Some aircraft waited too long. Use every runway and line up early to cut runway idle time.';
      if (r.stats.departed < r.stats.target) return 'Not enough departures. Keep the runway utilised: line up the next aircraft as the previous one starts to roll.';
      return 'Clean sequencing! Try for a higher score by minimising delays.';
    }

    /* ---------- rendering ---------- */
    function pos(a) {
      const rw = rws[a.rw], px = -rw.uy, py = rw.ux; // perpendicular (rotate 90° cw)
      const slot = Math.max(0, holding(rw).indexOf(a));
      const hold = { x: rw.x0 + px * (30 + slot * 24) - rw.ux * 24, y: rw.y0 + py * (30 + slot * 24) - rw.uy * 24 };
      const at = d => ({ x: rw.x0 + rw.ux * d, y: rw.y0 + rw.uy * d });
      if (a.state === 'hold') return Object.assign(hold, { s: 1, al: 1 });
      if (a.state === 'lineup') { const f = Math.min(1, a.lineT / LINEUP), p = at(16); return { x: hold.x + (p.x - hold.x) * f, y: hold.y + (p.y - hold.y) * f, s: 1, al: 1 }; }
      if (a.state === 'roll') { const f = a.rollT / ROLL, p = at(16 + (rw.len - 120) * f * f); return Object.assign(p, { s: 1, al: 1 }); }
      const f = Math.min(1, a.airT / 2.5), p = at(rw.len - 104 + 150 * f); return Object.assign(p, { s: 1 + 0.6 * f, al: 1 - f });
    }
    const PL = [[14, 0], [5, -3], [-1, -14], [-5, -14], [-3, -3], [-10, -2], [-12, -6], [-14, -6], [-12, 0]];
    function plane(x, y, ang, sc, col, al) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(sc, sc); ctx.globalAlpha = al; ctx.fillStyle = col; ctx.beginPath();
      PL.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
      for (let i = PL.length - 1; i >= 0; i--) ctx.lineTo(PL[i][0], -PL[i][1]);
      ctx.closePath(); ctx.fill(); ctx.restore();
    }
    function draw() {
      ctx.fillStyle = '#10261c'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      rws.forEach(rw => {
        const occ = occupied(rw), ang = Math.atan2(rw.uy, rw.ux), px = -rw.uy, py = rw.ux;
        ctx.save(); ctx.translate(rw.x0, rw.y0); ctx.rotate(ang);
        ctx.fillStyle = occ ? '#5a2a2a' : '#2b3138'; ctx.fillRect(0, -14, rw.len, 28);
        ctx.strokeStyle = '#e8edf2'; ctx.setLineDash([16, 14]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(40, 0); ctx.lineTo(rw.len - 40, 0); ctx.stroke(); ctx.setLineDash([]);
        for (let k = -3; k <= 3; k++) { ctx.fillStyle = '#e8edf2'; ctx.fillRect(6, k * 3.6 - 1, 22, 2); }
        ctx.restore();
        // taxiway stub + label
        ctx.strokeStyle = '#3a424b'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(rw.x0 - rw.ux * 24, rw.y0 - rw.uy * 24);
        ctx.lineTo(rw.x0 - rw.ux * 24 + px * 170, rw.y0 - rw.uy * 24 + py * 170); ctx.stroke();
        ctx.fillStyle = '#e8edf2'; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center';
        ctx.fillText('RWY ' + rw.label, rw.x0 + rw.ux * 60 + px * -26, rw.y0 + rw.uy * 60 + py * -26 + 5);
        // status chip(s)
        const cx = rw.x0 + rw.ux * 120 - px * 30, cy = rw.y0 + rw.uy * 120 - py * 30;
        let line = occ ? 'OCCUPIED' : 'CLEAR';
        if (cfg.assist && rw.lastCat && !occ) {
          const g = c => Math.max(0, ROLL + extra(rw.lastCat, c) - (S.now - rw.lastStart));
          const gs = ['L', 'M', 'H'].map(c => c + ' ' + g(c).toFixed(0) + 's').join('  ');
          line = 'CLEAR · wake wait ' + gs;
        }
        ctx.font = '12px ui-monospace,monospace'; ctx.fillStyle = occ ? '#ff8a8a' : '#8de3b5'; ctx.fillText(line, cx + (rw.ux < 0.5 ? 0 : 0), cy);
      });
      // aircraft
      S.ac.forEach(a => {
        if (a.state === 'gone') return;
        const rw = rws[a.rw], p = pos(a), ang = Math.atan2(rw.uy, rw.ux), sc = a.cat === 'H' ? 1.35 : a.cat === 'L' ? 0.75 : 1;
        if (a.prio) { ctx.strokeStyle = '#ff5c5c'; ctx.lineWidth = 2; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(S.now * 8); ctx.beginPath(); ctx.arc(p.x, p.y, 20, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
        plane(p.x, p.y, ang, sc * p.s, COL[a.cat], p.al);
        ctx.globalAlpha = p.al; ctx.fillStyle = '#fff'; ctx.font = '11px ui-monospace,monospace'; ctx.textAlign = 'left';
        ctx.fillText(a.cs, p.x + 14, p.y - 10); ctx.globalAlpha = 1;
        if ((a.state === 'hold' || a.state === 'lineup') && S.now - a.spawnAt > cfg.pat * 0.75) { ctx.fillStyle = '#ffd166'; ctx.fillText('⏱', p.x - 26, p.y + 4); }
      });
      // toasts
      S.toasts = S.toasts.filter(t => S.now - t.t < 3.5);
      ctx.textAlign = 'center'; ctx.font = 'bold 15px system-ui';
      S.toasts.slice(-4).forEach((t, i) => { ctx.globalAlpha = Math.max(0, 1 - (S.now - t.t) / 3.5); ctx.fillStyle = t.col; ctx.fillText(t.txt, W / 2, 28 + i * 22); });
      ctx.globalAlpha = 1;
      if (S.paused) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.font = 'bold 40px system-ui'; ctx.fillText('PAUSED', W / 2, H / 2); }
    }

    function hud() {
      const left = Math.max(0, limit - S.now), e = S.err;
      $h('time').textContent = Math.ceil(left) + 's';
      $h('dep').textContent = `${S.departed}/${cfg.count} (need ${Math.ceil(cfg.count * 0.8)})`;
      $h('score').textContent = Math.round(S.score);
      const v = e.wake + e.incursion; const el = $h('viol'); el.textContent = `${v}/${cfg.viol}`; el.className = v > cfg.viol ? 'bad' : '';
    }
    function renderStrips() {
      let html = '';
      rws.forEach(rw => {
        const list = S.ac.filter(a => a.rw === rw.i && (a.state === 'hold' || a.state === 'lineup'))
          .sort((a, b) => (a.state === 'lineup' ? -1 : 0) - (b.state === 'lineup' ? -1 : 0) || a.spawnAt - b.spawnAt);
        html += `<div class="rwy-head">RWY ${rw.label}<span>${occupied(rw) ? 'OCCUPIED' : 'clear'}</span></div>`;
        if (!list.length) html += '<div class="strip empty">no aircraft</div>';
        list.forEach(a => {
          const wait = S.now - a.spawnAt, frac = Math.min(1, wait / cfg.pat);
          let btn = '';
          if (a.state === 'hold') btn = `<button class="btn act" data-id="${a.id}">LINE UP</button>`;
          else if (a.lineT < LINEUP) btn = `<button class="btn act" disabled>lining up…</button>`;
          else btn = `<button class="btn act go" data-id="${a.id}">CLEAR T/O</button>`;
          html += `<div class="strip cat-${a.cat}${a.prio ? ' prio' : ''}${a.state === 'lineup' ? ' lined' : ''}" style="--p:${frac}">
            <div class="s-main"><b>${a.cs}</b><span>${a.type} · ${CATN[a.cat]}${a.prio ? ' · MEDEVAC' : ''}</span></div>
            <div class="s-wait">${Math.floor(wait)}s</div>${btn}<i class="bar"></i></div>`;
        });
      });
      strips.innerHTML = html;
    }

    /* ---------- wiring ---------- */
    strips.addEventListener('pointerdown', e => {
      const b = e.target.closest('button[data-id]'); if (!b) return;
      act(S.ac.find(a => a.id === +b.dataset.id)); e.preventDefault();
    });
    cv.addEventListener('pointerdown', e => {
      const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height;
      let best = null, bd = 28;
      S.ac.forEach(a => { if (a.state === 'hold' || a.state === 'lineup') { const p = pos(a), d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = a; } } });
      act(best);
    });
    $h('pause').addEventListener('click', () => { S.paused = !S.paused; $h('pause').textContent = S.paused ? 'Resume' : 'Pause'; });
    $h('quit').addEventListener('click', () => { if (confirm('Quit this level? This attempt will not be recorded.')) { S.over = true; stop(); hooks && hooks.onQuit && hooks.onQuit(); } });
    function frame(ts) {
      const dt = last ? Math.min(0.1, (ts - last) / 1000) : 0; last = ts;
      step(dt); draw(); hud(); if (!S.over) raf = requestAnimationFrame(frame);
    }
    function stop() { cancelAnimationFrame(raf); clearInterval(uiTimer); }
    uiTimer = setInterval(renderStrips, 200);
    renderStrips(); raf = requestAnimationFrame(frame);
    const ctrl = { S, cfg, rws, plan, step, act, lineUp, clearTO, stop, result: null, occupied, extra };
    ATC.arcade.current = ctrl;
    return ctrl;
  }

  return { levels: CFG, names: NAMES, start, describe, maxLevel: 20 };
})();
