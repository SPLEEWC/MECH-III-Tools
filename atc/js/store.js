/* Student profiles + attempt records. Persisted in the browser (localStorage). */
window.ATC = window.ATC || {};
ATC.store = (function () {
  const KEY = 'atc_trainer_v1';
  const blank = () => ({ students: {}, attempts: [], current: null, settings: { openAll: false } });
  function load() {
    try {
      const s = localStorage.getItem(KEY);
      if (s) { const d = JSON.parse(s); if (d && d.students && d.attempts) return Object.assign(blank(), d); }
    } catch (e) {}
    return blank();
  }
  let db = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };
  const slug = s => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  function clean(a) { // validate imported attempt
    if (!a || (a.mode !== 'arcade' && a.mode !== 'radar')) return null;
    const num = v => (isFinite(+v) ? +v : 0);
    return {
      id: String(a.id || ''), ts: num(a.ts), student: String(a.student || ''), name: String(a.name || a.student || ''),
      mode: a.mode, level: Math.max(1, Math.min(20, num(a.level))), score: num(a.score), maxScore: num(a.maxScore),
      pct: num(a.pct), stars: Math.max(0, Math.min(3, num(a.stars))), passed: !!a.passed, duration: num(a.duration),
      errors: a.errors && typeof a.errors === 'object' ? a.errors : {},
      skills: a.skills && typeof a.skills === 'object' ? a.skills : {},
      stats: a.stats && typeof a.stats === 'object' ? a.stats : {}
    };
  }

  const api = {
    students: () => Object.values(db.students).sort((a, b) => a.name.localeCompare(b.name)),
    student: id => db.students[id],
    current: () => db.students[db.current] || null,
    login(name, id) {
      name = (name || '').trim(); if (!name) return null;
      id = ((id || '').trim()) || slug(name) || ('s' + Date.now());
      if (!db.students[id]) db.students[id] = { id, name, created: Date.now() };
      db.current = id; save(); return db.students[id];
    },
    select(id) { if (db.students[id]) { db.current = id; save(); } },
    logout() { db.current = null; save(); },
    addAttempt(a) {
      a.id = a.id || ('a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
      db.attempts.push(a); save(); return a;
    },
    attempts(f) {
      f = f || {};
      return db.attempts.filter(a => (!f.student || a.student === f.student) && (!f.mode || a.mode === f.mode) &&
        (!f.level || a.level === f.level)).sort((x, y) => x.ts - y.ts);
    },
    best(student, mode, level) {
      return api.attempts({ student, mode, level }).reduce((b, a) => (!b || a.score > b.score ? a : b), null);
    },
    passed: (student, mode, level) => api.attempts({ student, mode, level }).some(a => a.passed),
    stars(student, mode, level) { return Math.max(0, ...api.attempts({ student, mode, level }).map(a => a.stars)); },
    unlocked(student, mode, level) {
      return db.settings.openAll || level === 1 || api.passed(student, mode, level - 1);
    },
    settings: () => db.settings,
    setSetting(k, v) { db.settings[k] = v; save(); },
    exportJSON: () => JSON.stringify(db, null, 1),
    importJSON(text) {
      const d = JSON.parse(text); let added = 0, students = 0;
      if (!d || typeof d !== 'object' || !Array.isArray(d.attempts)) throw new Error('Not a trainer backup file');
      Object.values(d.students || {}).forEach(s => {
        if (s && s.id && s.name && !db.students[s.id]) { db.students[s.id] = { id: String(s.id), name: String(s.name), created: +s.created || Date.now() }; students++; }
      });
      const have = new Set(db.attempts.map(a => a.id));
      d.attempts.forEach(raw => {
        const a = clean(raw);
        if (!a || !a.id || !a.student || have.has(a.id)) return;
        if (!db.students[a.student]) db.students[a.student] = { id: a.student, name: a.name, created: Date.now() };
        db.attempts.push(a); have.add(a.id); added++;
      });
      save(); return { added, students };
    },
    clearAll() { db = blank(); save(); }
  };
  return api;
})();
