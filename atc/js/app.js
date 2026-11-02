/* App shell: login, level select, briefing/result dialogs, navigation. */
(function () {
  const S = ATC.store, R = ATC.report;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ENG = { arcade: ATC.arcade, radar: ATC.radar };
  const MODE = { arcade: 'Arcade – Departure Rush', radar: 'Surveillance – Radar Sector' };
  let game = null, tab = 'arcade';

  function show(v) {
    ['login', 'play', 'game', 'reports'].forEach(n => { $('#v-' + n).hidden = n !== v; });
    $('#nav').hidden = v === 'login' || !S.current();
    document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.view === (v === 'game' ? 'play' : v)));
    window.scrollTo(0, 0);
  }
  function header() {
    const c = S.current(), el = $('#who'); el.hidden = !c; if (!c) return;
    const sm = R.summary(S.attempts({ student: c.id }));
    el.innerHTML = `<span><b>${esc(c.name)}</b><small>${R.rank(sm.stars)} · ${sm.stars}★</small></span><button class="btn small ghost" id="switch">Switch</button>`;
    $('#switch').onclick = () => { stopGame(); S.logout(); renderLogin(); show('login'); header(); };
  }
  function renderLogin() {
    const st = S.students();
    $('#v-login').innerHTML = `<div class="card login"><h1>Welcome, trainee controller</h1>
      <p class="muted">Enter your name (and student ID) so your scores are recorded. 40 levels: 20 tower arcade + 20 radar surveillance. Pass a level to unlock the next.</p>
      <form id="lf"><label>Name<input id="ln" required maxlength="40" autocomplete="name" placeholder="e.g. Tan Wei Ming"></label>
      <label>Student ID <small>(optional – use it to keep records unique)</small><input id="li" maxlength="20" placeholder="e.g. 2400123"></label>
      <button class="btn big" type="submit">Start training</button></form>
      ${st.length ? `<h3>Returning student</h3><div class="chips">${st.map(s => `<button class="chip" data-id="${esc(s.id)}">${esc(s.name)}</button>`).join('')}</div>` : ''}</div>`;
    $('#lf').onsubmit = e => { e.preventDefault(); if (S.login($('#ln').value, $('#li').value)) enter(); };
    document.querySelectorAll('#v-login [data-id]').forEach(b => b.onclick = () => { S.select(b.dataset.id); enter(); });
  }
  function enter() { header(); renderPlay(); show('play'); }

  function renderPlay() {
    const c = S.current(); if (!c) return;
    const sm = R.summary(S.attempts({ student: c.id }));
    const eng = ENG[tab];
    let h = `<div class="tabs big"><button class="tab${tab === 'arcade' ? ' on' : ''}" data-tab="arcade">🛫 Arcade <small>${sm.modes.arcade.passedLevels}/20</small></button>
      <button class="tab${tab === 'radar' ? ' on' : ''}" data-tab="radar">📡 Surveillance <small>${sm.modes.radar.passedLevels}/20</small></button></div>
      <p class="muted">${tab === 'arcade' ? 'Sequence departures on the runway: line up, check wake spacing, clear for takeoff.' : 'Vector aircraft through your sector: keep them apart and send each out of its exit fix at the right level.'}</p><div class="tiles">`;
    eng.levels.forEach(cfg => {
      const open = S.unlocked(c.id, tab, cfg.n), stars = S.stars(c.id, tab, cfg.n), best = S.best(c.id, tab, cfg.n);
      h += `<button class="tile${open ? '' : ' locked'}" data-lv="${cfg.n}" ${open ? '' : 'disabled'}><b>${cfg.n}</b><span>${esc(cfg.name)}</span>
        <i class="st">${open ? [1, 2, 3].map(k => k <= stars ? '★' : '☆').join('') : '🔒'}</i>${best ? `<em>best ${best.score}</em>` : ''}</button>`;
    });
    $('#v-play').innerHTML = h + '</div>';
    document.querySelectorAll('#v-play [data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; renderPlay(); });
    document.querySelectorAll('#v-play [data-lv]').forEach(b => b.onclick = () => briefing(tab, +b.dataset.lv));
  }

  function modal(html, wire) {
    const m = $('#modal'); m.querySelector('.dlg').innerHTML = html; m.hidden = false; if (wire) wire(m);
  }
  const closeModal = () => { $('#modal').hidden = true; };

  function briefing(mode, lv) {
    const eng = ENG[mode], cfg = eng.levels[lv - 1];
    modal(`<h2>${mode === 'arcade' ? 'Arcade' : 'Surveillance'} ${lv}: ${esc(cfg.name)}</h2><ul class="brief">${eng.describe(cfg).map(b => `<li>${esc(b)}</li>`).join('')}</ul>
      <p class="muted">${mode === 'arcade' ? 'Scoring: +100 per departure (+30 if not delayed). −100 wake violation, −50 refused clearance (runway occupied), −30 delay, −100 diverted aircraft.' : 'Scoring: +100 per correct handoff (+ up to 50 for few instructions). −200 loss of separation, −150 restricted zone, −75 storm cell, −100 wrong exit, −75 wrong level.'}</p>
      <div class="btnrow"><button class="btn big" id="go">Start</button><button class="btn ghost" id="cancel">Cancel</button></div>`, m => {
      m.querySelector('#go').onclick = () => { closeModal(); play(mode, lv); };
      m.querySelector('#cancel').onclick = closeModal;
    });
  }
  function stopGame() { if (game && game.stop) game.stop(); game = null; }
  function play(mode, lv) {
    stopGame(); show('game');
    game = ENG[mode].start($('#v-game'), lv, {
      onEnd: res => finish(res), onQuit: () => { stopGame(); renderPlay(); show('play'); }
    });
  }
  function finish(res) {
    const c = S.current();
    res.stars = res.passed ? (res.pct >= 85 && (res.errors.los || 0) + (res.errors.wake || 0) + (res.errors.incursion || 0) === 0 ? 3 : res.pct >= 65 ? 2 : 1) : 0;
    const rec = { ts: Date.now(), student: c.id, name: c.name, mode: res.mode, level: res.level, score: res.score, maxScore: res.maxScore,
      pct: Math.round(res.pct * 10) / 10, stars: res.stars, passed: res.passed, duration: res.duration, errors: res.errors, skills: res.skills, stats: res.stats };
    S.addAttempt(rec); header();
    const eng = ENG[res.mode], next = res.level < 20 && res.passed;
    const errs = Object.entries(res.errors).filter(e => e[1] > 0);
    modal(`<h2>${res.passed ? 'Level complete!' : 'Level not passed'}</h2>
      <div class="stars">${[1, 2, 3].map(k => k <= res.stars ? '★' : '☆').join('')}</div>
      <div class="kpis small"><div class="kpi"><b>${res.score}</b><span>score / ${res.maxScore}</span></div><div class="kpi"><b>${Math.round(res.pct)}%</b><span>of max</span></div>
      <div class="kpi"><b>${res.mode === 'arcade' ? res.stats.departed + '/' + res.stats.total : res.stats.handoffs + '/' + res.stats.total}</b><span>${res.mode === 'arcade' ? 'departed' : 'handed off'}</span></div></div>
      <p>${errs.length ? 'Issues: ' + errs.map(e => `${esc(e[0])} ×${e[1]}`).join(', ') : 'No errors.'}</p>
      <p class="tipbox"><b>Coach:</b> ${esc(res.tip)}</p><p class="muted">Pass: ${res.mode === 'arcade' ? `≥${res.stats.target} departures and ≤${res.stats.allowed} safety violations` : `≥80% handoffs, ≤${res.stats.allowedLos} loss(es) of separation, no restricted-zone entry`}. ★★ = 65%+, ★★★ = 85%+ with no safety errors. Score saved.</p>
      <div class="btnrow"><button class="btn" id="retry">Retry</button>${next ? '<button class="btn big" id="next">Next level ▶</button>' : ''}<button class="btn ghost" id="menu">Levels</button><button class="btn ghost" id="rep">My report</button></div>`, m => {
      m.querySelector('#retry').onclick = () => { closeModal(); play(res.mode, res.level); };
      if (next) m.querySelector('#next').onclick = () => { closeModal(); play(res.mode, res.level + 1); };
      m.querySelector('#menu').onclick = () => { closeModal(); stopGame(); tab = res.mode; renderPlay(); show('play'); };
      m.querySelector('#rep').onclick = () => { closeModal(); stopGame(); openReports(); };
    });
  }
  function openReports() {
    R.state.student = S.current() ? S.current().id : 'ALL';
    R.render($('#v-reports'), { refresh: () => { header(); renderPlay(); } }); show('reports');
  }
  document.querySelectorAll('#nav button').forEach(b => b.onclick = () => {
    if (b.dataset.view === 'reports') { stopGame(); openReports(); } else { stopGame(); renderPlay(); show('play'); }
  });

  if (S.current()) enter(); else { renderLogin(); show('login'); }
  window.ATC.app = { play, finish, show };
})();
