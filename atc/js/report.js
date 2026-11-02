/* Learning analytics, performance data sheet and performance analysis. */
window.ATC = window.ATC || {};
ATC.report = (function () {
  const S = ATC.store;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  const r0 = n => Math.round(n), r1 = n => Math.round(n * 10) / 10;
  const fmtT = s => s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor(s % 3600 / 60)}m` : s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
  const fmtD = ts => ts ? new Date(ts).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '';
  const MODE = { arcade: 'Arcade', radar: 'Surveillance' };
  const ERR = {
    arcade: { wake: 'Wake-turbulence violations', incursion: 'Runway-occupied clearances', delay: 'Delayed aircraft', overflow: 'Holding-area overflow', prioMiss: 'Medevac flights delayed' },
    radar: { los: 'Loss of separation', airspace: 'Restricted-zone entries', weather: 'Storm-cell penetrations', wrongExit: 'Wrong exit fix', wrongAlt: 'Wrong exit level', timeout: 'Flights never handed off' }
  };
  const SKILLS = { safety: 'Safety (separation)', compliance: 'Procedure compliance', throughput: 'Throughput / efficiency', workload: 'Workload management' };
  const ADVICE = {
    safety: 'Replay levels where you had violations and slow down: check runway status and wake gaps (arcade) or project each velocity vector 4 minutes ahead (surveillance).',
    compliance: 'Re-read each level briefing. Check the exit fix/level on each data block and keep clear of restricted areas.',
    throughput: 'Plan ahead: line up the next aircraft while the previous one rolls (arcade); issue one clear, early instruction per flight (surveillance).',
    workload: 'Reduce clutter: prioritise urgent traffic first, avoid issuing many tiny corrections, and use all available runways.'
  };
  const ERRADV = {
    wake: 'Wake spacing: HEAVY→LIGHT needs the longest gap, HEAVY→MEDIUM next. Group heavies together or release lights first.',
    incursion: 'Do not clear a takeoff while the runway or a crossing runway is occupied.',
    delay: 'Aircraft are waiting too long – keep the runway busy and use every runway.',
    overflow: 'The holding area filled up – clear traffic faster or balance runway use.',
    prioMiss: 'Medevac traffic has priority – line it up immediately.',
    los: 'Look ahead for conflicts and fix them early with small heading or level changes.',
    airspace: 'Plan around restricted zones early and then re-aim at the exit fix.',
    weather: 'Avoid storm cells with an early, small deviation.',
    wrongExit: 'Verify bearing/distance to the exit fix before the aircraft reaches the boundary.',
    wrongAlt: 'Start climbs/descents early – they are slow.',
    timeout: 'Every flight must be handed off; do not leave aircraft circling.'
  };
  const COLORS = { arcade: 'var(--amber)', radar: 'var(--green)' };

  /* ---------- computations ---------- */
  function slope(ys) {
    const n = ys.length; if (n < 3) return 0;
    const mx = (n - 1) / 2, my = mean(ys); let nu = 0, de = 0;
    ys.forEach((y, x) => { nu += (x - mx) * (y - my); de += (x - mx) ** 2; });
    return de ? nu / de : 0;
  }
  function summary(att) {
    const out = { n: att.length, passes: att.filter(a => a.passed).length, avgPct: mean(att.map(a => a.pct)), time: att.reduce((s, a) => s + (a.duration || 0), 0), skills: {}, errors: { arcade: {}, radar: {} }, modes: {} };
    Object.keys(SKILLS).forEach(k => { const v = att.filter(a => a.skills && isFinite(a.skills[k])).map(a => a.skills[k]); out.skills[k] = v.length ? mean(v) : null; });
    att.forEach(a => Object.keys(a.errors || {}).forEach(k => { out.errors[a.mode][k] = (out.errors[a.mode][k] || 0) + (+a.errors[k] || 0); }));
    ['arcade', 'radar'].forEach(m => {
      const am = att.filter(a => a.mode === m), lv = {};
      am.forEach(a => { const l = lv[a.level] || (lv[a.level] = { passed: false, stars: 0 }); l.passed = l.passed || a.passed; l.stars = Math.max(l.stars, a.stars); });
      out.modes[m] = { n: am.length, passedLevels: Object.values(lv).filter(l => l.passed).length, stars: Object.values(lv).reduce((s, l) => s + l.stars, 0), avgPct: mean(am.map(a => a.pct)) };
    });
    out.stars = out.modes.arcade.stars + out.modes.radar.stars;
    return out;
  }
  function rank(stars) {
    const t = [[0, 'Ground Trainee'], [8, 'Apron Controller'], [20, 'Tower Assistant'], [40, 'Tower Controller'], [65, 'Approach Controller'], [90, 'Area Controller'], [115, 'Chief Controller']];
    let r = t[0][1]; t.forEach(x => { if (stars >= x[0]) r = x[1]; }); return r;
  }
  function levelRows(att, mode, names) {
    return Array.from({ length: 20 }, (_, i) => {
      const lv = i + 1, a = att.filter(x => x.mode === mode && x.level === lv);
      const best = a.reduce((b, x) => (!b || x.score > b.score ? x : b), null);
      const errs = {}; a.forEach(x => Object.keys(x.errors || {}).forEach(k => { errs[k] = (errs[k] || 0) + (+x.errors[k] || 0); }));
      const top = Object.entries(errs).filter(e => e[1] > 0).sort((p, q) => q[1] - p[1])[0];
      return { level: lv, name: names[i], attempts: a.length, passes: a.filter(x => x.passed).length, best: best ? best.score : null, bestPct: best ? best.pct : null,
        stars: a.length ? Math.max(...a.map(x => x.stars)) : 0, avgPct: a.length ? mean(a.map(x => x.pct)) : null, avgDur: a.length ? mean(a.map(x => x.duration)) : null,
        topErr: top ? (ERR[mode][top[0]] || top[0]) + ' ×' + top[1] : '', last: a.length ? a[a.length - 1].ts : 0 };
    });
  }

  /* ---------- charts (inline SVG) ---------- */
  function lineChart(att) {
    const w = 560, h = 230, l = 36, r = 10, t = 12, b = 26, n = att.length;
    if (!n) return '<p class="muted">No attempts yet – play a level to see your learning curve.</p>';
    const X = i => l + (n === 1 ? (w - l - r) / 2 : i * (w - l - r) / (n - 1)), Y = v => t + (100 - Math.max(0, Math.min(100, v))) * (h - t - b) / 100;
    let g = '';
    [0, 25, 50, 75, 100].forEach(v => { g += `<line x1="${l}" x2="${w - r}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${l - 6}" y="${Y(v) + 4}" text-anchor="end" class="ax">${v}</text>`; });
    const ma = att.map((_, i) => mean(att.slice(Math.max(0, i - 2), i + 1).map(a => a.pct)));
    g += `<polyline fill="none" class="ma" points="${ma.map((v, i) => X(i) + ',' + Y(v)).join(' ')}"/>`;
    att.forEach((a, i) => { g += `<circle cx="${X(i)}" cy="${Y(a.pct)}" r="4.5" style="fill:${COLORS[a.mode]}" ${a.passed ? '' : 'class="fail"'}><title>#${i + 1} ${MODE[a.mode]} L${a.level}: ${r0(a.pct)}% ${a.passed ? 'passed' : 'not passed'}</title></circle>`; });
    g += `<text x="${(l + w - r) / 2}" y="${h - 4}" text-anchor="middle" class="ax">Attempt number (chronological)</text>`;
    return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="Score percentage per attempt">${g}</svg>
      <div class="legend"><span><i style="background:var(--amber)"></i>Arcade</span><span><i style="background:var(--green)"></i>Surveillance</span><span><i class="ln"></i>3-attempt average</span><span>hollow = not passed</span></div>`;
  }
  function skillChart(sk) {
    const keys = Object.keys(SKILLS), c = 110, R = 80;
    if (keys.every(k => sk[k] == null)) return '<p class="muted">No skill data yet.</p>';
    const pt = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / keys.length; return [c + Math.cos(a) * R * v / 100, c + Math.sin(a) * R * v / 100]; };
    let g = [25, 50, 75, 100].map(v => `<polygon class="grid" fill="none" points="${keys.map((_, i) => pt(i, v).join(',')).join(' ')}"/>`).join('');
    g += `<polygon class="area" points="${keys.map((k, i) => pt(i, sk[k] || 0).join(',')).join(' ')}"/>`;
    keys.forEach((k, i) => { const p = pt(i, 118); g += `<text x="${p[0]}" y="${p[1] + 4}" text-anchor="middle" class="ax">${SKILLS[k].split(' ')[0]} ${sk[k] == null ? '–' : r0(sk[k])}</text>`; });
    return `<svg viewBox="-40 0 300 220" class="chart radar-c" role="img" aria-label="Skill profile">${g}</svg>`;
  }
  function bars(map, labels) {
    const e = Object.entries(map).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]); if (!e.length) return '<p class="muted">No errors recorded – great!</p>';
    const mx = e[0][1];
    return e.map(([k, v]) => `<div class="barrow"><span>${esc(labels[k] || k)}</span><div><i style="width:${v / mx * 100}%"></i></div><b>${v}</b></div>`).join('');
  }
  function heat(att, student) {
    const cell = (m, lv) => { const a = att.filter(x => x.mode === m && x.level === lv); const s = a.length ? Math.max(...a.map(x => x.stars)) : -1; const p = a.some(x => x.passed);
      return `<span class="hc s${s}" title="${MODE[m]} ${lv}: ${a.length ? a.length + ' attempts, ' + (p ? s + '★' : 'not passed') : 'not played'}">${lv}</span>`; };
    return ['arcade', 'radar'].map(m => `<div class="heatrow"><b>${MODE[m]}</b>${Array.from({ length: 20 }, (_, i) => cell(m, i + 1)).join('')}</div>`).join('');
  }

  /* ---------- narrative analysis ---------- */
  function analyse(att, all) {
    const out = [], sm = summary(att);
    if (!att.length) return [{ tone: 'info', title: 'No data yet', text: 'Complete at least one level to generate an analysis.' }];
    const ys = att.map(a => a.pct), last = ys.slice(-20), sl = slope(last);
    const f3 = mean(ys.slice(0, 3)), l3 = mean(ys.slice(-3));
    let trend = 'stable', tone = 'info';
    if (att.length >= 4) { if (sl > 1 || l3 - f3 > 8) { trend = 'improving'; tone = 'good'; } else if (sl < -1 && l3 < f3) { trend = 'declining'; tone = 'warn'; } }
    out.push({ tone, title: 'Learning trend: ' + trend,
      text: att.length < 4 ? `Only ${att.length} attempt(s) recorded – play a few more levels for a reliable trend.` :
        `Across ${att.length} attempts the average score is ${r0(sm.avgPct)}%. The first three attempts averaged ${r0(f3)}% and the latest three ${r0(l3)}% (trend ${sl >= 0 ? '+' : ''}${r1(sl)} points per attempt over the last ${last.length}). ` +
        (trend === 'improving' ? 'Practice is paying off – keep progressing to harder levels.' : trend === 'declining' ? 'Scores are falling, which often means the level difficulty outpaced skills. Replay an earlier level to consolidate before moving on.' : 'Performance is steady; push for 3 stars on completed levels or attempt the next level.') });
    out.push({ tone: 'info', title: 'Progress', text: `Arcade: ${sm.modes.arcade.passedLevels}/20 levels passed (${sm.modes.arcade.stars}★). Surveillance: ${sm.modes.radar.passedLevels}/20 levels passed (${sm.modes.radar.stars}★). Overall pass rate ${r0(100 * sm.passes / sm.n)}% of attempts. Rank: ${rank(sm.stars)}. Total practice time ${fmtT(sm.time)}.` });
    const sk = Object.entries(sm.skills).filter(e => e[1] != null).sort((a, b) => a[1] - b[1]);
    if (sk.length) {
      const wk = sk[0], st = sk[sk.length - 1];
      out.push({ tone: 'good', title: 'Strength: ' + SKILLS[st[0]], text: `Average ${r0(st[1])}/100 in ${SKILLS[st[0]].toLowerCase()}.` });
      out.push({ tone: wk[1] < 70 ? 'warn' : 'info', title: 'Development area: ' + SKILLS[wk[0]], text: `Average ${r0(wk[1])}/100. ${ADVICE[wk[0]]}` });
    }
    ['arcade', 'radar'].forEach(m => {
      const e = Object.entries(sm.errors[m]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1])[0];
      if (e) out.push({ tone: 'warn', title: `Most frequent ${MODE[m].toLowerCase()} error: ${ERR[m][e[0]]}`, text: `${e[1]} occurrence(s) in ${sm.modes[m].n} attempts (${r1(e[1] / sm.modes[m].n)} per attempt). ${ERRADV[e[0]]}` });
    });
    // persistence
    const stuck = [];
    ['arcade', 'radar'].forEach(m => { for (let lv = 1; lv <= 20; lv++) { const a = att.filter(x => x.mode === m && x.level === lv); if (a.length >= 3 && !a.some(x => x.passed)) stuck.push(`${MODE[m]} ${lv}`); } });
    if (stuck.length) out.push({ tone: 'warn', title: 'Stumbling blocks', text: `Three or more attempts without passing: ${stuck.join(', ')}. Consider an instructor debrief or repeating the previous level.` });
    const days = new Set(att.map(a => new Date(a.ts).toDateString())).size;
    out.push({ tone: 'info', title: 'Engagement', text: `${att.length} attempts over ${days} day(s), average ${fmtT(r0(sm.time / att.length))} per attempt.` });
    // next step
    const nx = [];
    ['arcade', 'radar'].forEach(m => { for (let lv = 1; lv <= 20; lv++) if (!att.some(x => x.mode === m && x.level === lv && x.passed)) { nx.push(`${MODE[m]} level ${lv}`); break; } });
    out.push({ tone: 'good', title: 'Recommended next steps', text: nx.length ? `Next unpassed: ${nx.join(' and ')}. Alternate modes: the arcade builds sequencing speed, the surveillance mode builds separation judgement.` : 'All 40 levels passed – replay for 3 stars.' });
    // cohort comparison
    if (all && all.students && all.students > 1 && att[0]) {
      out.push({ tone: 'info', title: 'Cohort comparison', text: `Class average score is ${r0(all.avgPct)}% across ${all.students} students.` + (all.mine != null ? ` This student is at ${r0(all.mine)}% (${all.mine >= all.avgPct ? 'above' : 'below'} class average).` : '') });
    }
    return out;
  }

  /* ---------- rendering ---------- */
  const state = { student: null, tab: 'overview' };
  function render(host, opts) {
    const cur = S.current(); if (state.student === null) state.student = cur ? cur.id : 'ALL';
    const studs = S.students(), isAll = state.student === 'ALL', sid = isAll ? null : state.student;
    const att = S.attempts(isAll ? {} : { student: sid }), sm = summary(att);
    const name = isAll ? 'Whole class (all students on this device)' : (S.student(sid) || { name: sid }).name;
    const tabs = [['overview', 'Learning analytics'], ['sheet', 'Performance data sheet'], ['analysis', 'Performance analysis'], ['data', 'Data & settings']];
    let h = `<div class="rep-head no-print"><label>Student <select id="rep-student"><option value="ALL"${isAll ? ' selected' : ''}>Whole class</option>${studs.map(s => `<option value="${esc(s.id)}"${s.id === sid ? ' selected' : ''}>${esc(s.name)} (${esc(s.id)})</option>`).join('')}</select></label>
      <div class="tabs">${tabs.map(t => `<button class="tab${state.tab === t[0] ? ' on' : ''}" data-tab="${t[0]}">${t[1]}</button>`).join('')}</div></div>`;
    h += `<div class="rep-title"><h2>${esc(name)}</h2><span class="muted">Report generated ${fmtD(Date.now())}</span></div>`;
    if (state.tab === 'overview') h += overview(att, sm, isAll);
    else if (state.tab === 'sheet') h += sheet(att, sm, isAll, sid);
    else if (state.tab === 'analysis') h += analysisView(att, isAll, sid);
    else h += dataView();
    host.innerHTML = h;
    host.querySelector('#rep-student').onchange = e => { state.student = e.target.value; render(host, opts); };
    host.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { state.tab = b.dataset.tab; render(host, opts); });
    host.querySelectorAll('[data-act]').forEach(b => b.onclick = () => action(b.dataset.act, host, opts, att, sid));
    const fi = host.querySelector('#imp'); if (fi) fi.onchange = e => {
      const f = e.target.files[0]; if (!f) return; const rd = new FileReader();
      rd.onload = () => { try { const r = S.importJSON(rd.result); alert(`Imported ${r.added} attempts and ${r.students} new students.`); render(host, opts); opts && opts.refresh && opts.refresh(); } catch (err) { alert('Import failed: ' + err.message); } };
      rd.readAsText(f);
    };
    const oa = host.querySelector('#openall'); if (oa) oa.onchange = e => { S.setSetting('openAll', e.target.checked); opts && opts.refresh && opts.refresh(); };
  }
  const kpi = (v, l) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`;
  function overview(att, sm, isAll) {
    let h = `<div class="kpis">${kpi(sm.n, 'attempts')}${kpi(sm.modes.arcade.passedLevels + '/20', 'arcade levels passed')}${kpi(sm.modes.radar.passedLevels + '/20', 'surveillance levels passed')}${kpi(sm.stars + '★', 'stars of 120')}${kpi(r0(sm.avgPct) + '%', 'average score')}${kpi(sm.n ? r0(100 * sm.passes / sm.n) + '%' : '–', 'pass rate')}${kpi(fmtT(sm.time), 'practice time')}${isAll ? kpi(new Set(att.map(a => a.student)).size, 'active students') : kpi(rank(sm.stars), 'rank')}</div>`;
    h += `<div class="cols"><section class="card"><h3>Learning curve</h3>${lineChart(att)}</section><section class="card"><h3>Skill profile (0–100)</h3>${skillChart(sm.skills)}</section></div>`;
    h += `<div class="cols"><section class="card"><h3>Arcade – error hot-spots</h3>${bars(sm.errors.arcade, ERR.arcade)}</section><section class="card"><h3>Surveillance – error hot-spots</h3>${bars(sm.errors.radar, ERR.radar)}</section></div>`;
    h += `<section class="card"><h3>Level map <span class="muted">(stars earned: 0–3, grey = not passed / not played)</span></h3>${heat(att)}</section>`;
    if (isAll) h += classTables();
    return h;
  }
  function classTables() {
    const studs = S.students(); if (!studs.length) return '';
    const rows = studs.map(s => { const a = S.attempts({ student: s.id }), m = summary(a); return { s, a, m }; }).sort((x, y) => y.m.stars - x.m.stars || y.m.avgPct - x.m.avgPct);
    let h = `<section class="card"><h3>Leaderboard</h3><div class="tw"><table><thead><tr><th>#</th><th>Student</th><th>Rank</th><th>★</th><th>Arcade</th><th>Surv.</th><th>Avg %</th><th>Attempts</th><th>Time</th></tr></thead><tbody>`;
    rows.forEach((r, i) => { h += `<tr><td>${i + 1}</td><td>${esc(r.s.name)}</td><td>${rank(r.m.stars)}</td><td>${r.m.stars}</td><td>${r.m.modes.arcade.passedLevels}/20</td><td>${r.m.modes.radar.passedLevels}/20</td><td>${r0(r.m.avgPct)}</td><td>${r.m.n}</td><td>${fmtT(r.m.time)}</td></tr>`; });
    h += '</tbody></table></div></section>';
    const all = S.attempts();
    ['arcade', 'radar'].forEach(m => {
      const names = ATC[m].names, rowsL = levelRows(all, m, names).filter(r => r.attempts);
      if (!rowsL.length) return;
      h += `<section class="card"><h3>Item analysis – ${MODE[m]} levels <span class="muted">(which levels are hardest for the class)</span></h3><div class="tw"><table><thead><tr><th>Lvl</th><th>Name</th><th>Attempts</th><th>Pass rate</th><th>Avg %</th><th>Typical error</th></tr></thead><tbody>`;
      rowsL.forEach(r => { const pr = r.passes / r.attempts; h += `<tr class="${pr < .4 ? 'hard' : ''}"><td>${r.level}</td><td>${esc(r.name)}</td><td>${r.attempts}</td><td>${r0(pr * 100)}%</td><td>${r0(r.avgPct)}</td><td>${esc(r.topErr)}</td></tr>`; });
      h += '</tbody></table></div></section>';
    });
    return h;
  }
  function sheet(att, sm, isAll, sid) {
    let h = `<div class="no-print btnrow"><button class="btn" data-act="print">Print / save as PDF</button><button class="btn" data-act="csv-levels">Download level summary (CSV)</button><button class="btn" data-act="csv-attempts">Download attempt log (CSV)</button></div>`;
    h += `<section class="card"><h3>Summary</h3><div class="tw"><table class="kv"><tbody>
      <tr><th>Student</th><td>${isAll ? 'All students' : esc((S.student(sid) || {}).name || sid) + ' (' + esc(sid) + ')'}</td><th>Attempts</th><td>${sm.n}</td></tr>
      <tr><th>Average score</th><td>${r0(sm.avgPct)}%</td><th>Pass rate</th><td>${sm.n ? r0(100 * sm.passes / sm.n) : 0}%</td></tr>
      <tr><th>Arcade levels passed</th><td>${sm.modes.arcade.passedLevels}/20</td><th>Surveillance levels passed</th><td>${sm.modes.radar.passedLevels}/20</td></tr>
      <tr><th>Stars</th><td>${sm.stars}/120</td><th>Practice time</th><td>${fmtT(sm.time)}</td></tr>
      ${Object.keys(SKILLS).map(k => `<tr><th>${SKILLS[k]}</th><td colspan="3">${sm.skills[k] == null ? '–' : r0(sm.skills[k]) + ' / 100'}</td></tr>`).join('')}</tbody></table></div></section>`;
    ['arcade', 'radar'].forEach(m => {
      h += `<section class="card"><h3>${MODE[m]} – level results</h3><div class="tw"><table><thead><tr><th>Lvl</th><th>Name</th><th>Tries</th><th>Passed</th><th>Best score</th><th>Best %</th><th>★</th><th>Avg %</th><th>Avg time</th><th>Main error</th><th>Last played</th></tr></thead><tbody>`;
      levelRows(att, m, ATC[m].names).forEach(r => { h += `<tr class="${r.attempts ? '' : 'dim'}"><td>${r.level}</td><td>${esc(r.name)}</td><td>${r.attempts}</td><td>${r.passes}</td><td>${r.best == null ? '' : r.best}</td><td>${r.bestPct == null ? '' : r0(r.bestPct)}</td><td>${r.stars ? '★'.repeat(r.stars) : ''}</td><td>${r.avgPct == null ? '' : r0(r.avgPct)}</td><td>${r.avgDur == null ? '' : fmtT(r0(r.avgDur))}</td><td>${esc(r.topErr)}</td><td>${fmtD(r.last)}</td></tr>`; });
      h += '</tbody></table></div></section>';
    });
    h += `<section class="card"><h3>Attempt log</h3><div class="tw"><table><thead><tr><th>#</th><th>Date</th>${isAll ? '<th>Student</th>' : ''}<th>Mode</th><th>Lvl</th><th>Score</th><th>%</th><th>Result</th><th>★</th><th>Time</th></tr></thead><tbody>`;
    att.slice().reverse().slice(0, 300).forEach((a, i) => { h += `<tr><td>${att.length - i}</td><td>${fmtD(a.ts)}</td>${isAll ? `<td>${esc(a.name)}</td>` : ''}<td>${MODE[a.mode]}</td><td>${a.level}</td><td>${a.score}/${a.maxScore}</td><td>${r0(a.pct)}</td><td>${a.passed ? 'Pass' : 'Not passed'}</td><td>${'★'.repeat(a.stars)}</td><td>${fmtT(a.duration)}</td></tr>`; });
    return h + '</tbody></table></div></section>';
  }
  function analysisView(att, isAll, sid) {
    let all = null;
    const studs = S.students();
    if (!isAll && studs.length > 1) { const per = studs.map(s => summary(S.attempts({ student: s.id })).avgPct); const mine = summary(att).avgPct; all = { students: studs.length, avgPct: mean(per), mine }; }
    else if (isAll) all = { students: studs.length, avgPct: summary(att).avgPct, mine: null };
    const items = analyse(att, all);
    return `<div class="no-print btnrow"><button class="btn" data-act="print">Print / save as PDF</button></div>` +
      items.map(i => `<section class="card note ${i.tone}"><h3>${esc(i.title)}</h3><p>${esc(i.text)}</p></section>`).join('');
  }
  function dataView() {
    return `<section class="card"><h3>Back-up, share &amp; merge</h3>
      <p>Records live in this browser only. To collect a whole class: each student clicks <b>Export</b>, the instructor opens the tool on one device and clicks <b>Import</b> for each file – the Whole-class report then merges everybody.</p>
      <div class="btnrow"><button class="btn" data-act="export">Export all data (JSON)</button><label class="btn ghost">Import JSON…<input id="imp" type="file" accept="application/json,.json" hidden></label><button class="btn" data-act="csv-attempts-all">Export all attempts (CSV)</button></div></section>
      <section class="card"><h3>Instructor settings</h3><label class="chk"><input type="checkbox" id="openall" ${S.settings().openAll ? 'checked' : ''}> Open all 40 levels (skip the sequential unlock)</label>
      <div class="btnrow"><button class="btn danger" data-act="clear">Delete all data on this device</button></div></section>`;
  }
  function download(name, text, type) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/csv' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const csvCell = v => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const csv = rows => rows.map(r => r.map(csvCell).join(',')).join('\n');
  function attemptsCSV(att) {
    return csv([['attempt_id', 'timestamp', 'student_id', 'student_name', 'mode', 'level', 'score', 'max_score', 'percent', 'passed', 'stars', 'duration_s', 'safety', 'compliance', 'throughput', 'workload', 'errors_json', 'stats_json']]
      .concat(att.map(a => [a.id, new Date(a.ts).toISOString(), a.student, a.name, a.mode, a.level, a.score, a.maxScore, r1(a.pct), a.passed ? 1 : 0, a.stars, a.duration,
        (a.skills || {}).safety, (a.skills || {}).compliance, (a.skills || {}).throughput, (a.skills || {}).workload, JSON.stringify(a.errors || {}), JSON.stringify(a.stats || {})])));
  }
  function action(act, host, opts, att, sid) {
    const tag = sid || 'class';
    if (act === 'print') window.print();
    else if (act === 'csv-attempts') download(`atc-attempts-${tag}.csv`, attemptsCSV(att));
    else if (act === 'csv-attempts-all') download('atc-attempts-all.csv', attemptsCSV(S.attempts()));
    else if (act === 'csv-levels') { const rows = [['mode', 'level', 'name', 'attempts', 'passes', 'best_score', 'best_pct', 'stars', 'avg_pct', 'avg_duration_s', 'main_error']];
      ['arcade', 'radar'].forEach(m => levelRows(att, m, ATC[m].names).forEach(r => rows.push([m, r.level, r.name, r.attempts, r.passes, r.best, r.bestPct == null ? '' : r1(r.bestPct), r.stars, r.avgPct == null ? '' : r1(r.avgPct), r.avgDur == null ? '' : r0(r.avgDur), r.topErr])));
      download(`atc-levels-${tag}.csv`, csv(rows)); }
    else if (act === 'export') download('atc-trainer-backup.json', S.exportJSON(), 'application/json');
    else if (act === 'clear') { if (confirm('Delete ALL students and scores on this device? Export a backup first.') && confirm('Really delete everything?')) { S.clearAll(); state.student = null; opts && opts.refresh && opts.refresh(); render(host, opts); } }
  }
  return { render, summary, analyse, rank, levelRows, slope, state };
})();
