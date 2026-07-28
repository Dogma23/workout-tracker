/* =========================================================================
   app.js — Lift Tracker
   Vanilla JS, no build step, no backend. All data lives in localStorage on
   your phone. Three concerns: (1) state + storage, (2) rendering the two
   screens (home dashboard / active workout), (3) the rest timer.
   ========================================================================= */

'use strict';

/* ------------------------------------------------------------------ *
 * Storage helpers
 * ------------------------------------------------------------------ */
const KEY = {
  settings: 'wt_settings_v1',
  history: 'wt_history_v1',
  active: 'wt_active_v1',
  last: 'wt_last_v1',            // last weight/reps used per exercise, for prefill
  plan: 'wt_plan_v1',           // user-editable copy of the program (days + exercises)
  warmup: 'wt_warmup_v1',       // warm-up rotation pointer { weekKey, count }
};

const load = (k, fallback) => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
};
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

/* ------------------------------------------------------------------ *
 * App state
 * ------------------------------------------------------------------ */
const DEFAULT_SETTINGS = { rest: 90, sound: true, vibrate: true, unit: 'kg', hydration: true, hydrationMin: 15 };

let settings = Object.assign({}, DEFAULT_SETTINGS, load(KEY.settings, {}));
let history = load(KEY.history, []);
let last = load(KEY.last, {});
let active = load(KEY.active, null);   // in-progress session or null
let chartEx = null;                    // exercise selected in the progress line chart

// User-editable program, seeded from the built-in default (plan.js) on first run.
// Shape: { order: [dayId...], days: { dayId: {id,name,day,subtitle,exercises:[...]} } }
const seedPlan = () => ({ order: PLAN_ORDER.slice(), days: JSON.parse(JSON.stringify(PLAN)) });
let userPlan = load(KEY.plan, null) || seedPlan();
const savePlan = () => save(KEY.plan, userPlan);

const REST_PRESETS = [30, 45, 60, 90, 120, 180];
const TRACK_LABELS = { weight: 'Weighted', bodyweight: 'Bodyweight', time: 'Time / hold' };

/* ------------------------------------------------------------------ *
 * Small utilities
 * ------------------------------------------------------------------ */
const $ = (sel, root = document) => root.querySelector(sel);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

function fmtClock(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (sameDay) return 'Today, ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}

function sessionVolume(session) {
  let vol = 0;
  session.exercises.forEach((ex) => ex.sets.forEach((s) => {
    if (s.done) vol += num(s.weight) * num(s.reps);
  }));
  return vol;
}

function fmtVol(v) {
  if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(Math.round(v));
}

// Live elapsed time (mm:ss, or h:mm:ss past an hour) for the active workout.
function fmtElapsed(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Coarse duration for totals (e.g. "3h 42m", "45m").
function fmtDuration(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

let toastTimer;
function toast(msg, ms = 1800) {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

/* ------------------------------------------------------------------ *
 * Dashboard stat calculations
 * ------------------------------------------------------------------ */
function stats() {
  const total = history.length;

  const weekAgo = Date.now() - 7 * 864e5;
  const thisWeek = history.filter((h) => h.date >= weekAgo).length;

  let totalVol = 0;
  history.forEach((h) => { totalVol += (h.volume != null ? h.volume : sessionVolume(h)); });

  let totalTime = 0;
  history.forEach((h) => { totalTime += (h.durationSec || 0); });

  // Streak = consecutive calendar days (counting back from today/yesterday) with a workout.
  const days = new Set(history.map((h) => new Date(h.date).toDateString()));
  let streak = 0;
  const cur = new Date();
  // allow today OR yesterday to seed the streak
  if (!days.has(cur.toDateString())) cur.setDate(cur.getDate() - 1);
  while (days.has(cur.toDateString())) { streak++; cur.setDate(cur.getDate() - 1); }

  return { total, thisWeek, totalVol, streak, totalTime };
}

// Best (heaviest single logged set) per exercise across all history.
function personalBests() {
  const best = {};
  history.forEach((h) => h.exercises.forEach((ex) => {
    ex.sets.forEach((s) => {
      if (!s.done) return;
      const w = num(s.weight);
      if (w <= 0) return;
      if (!best[ex.name] || w > best[ex.name].weight) {
        best[ex.name] = { weight: w, reps: s.reps };
      }
    });
  }));
  return best;
}

/* ------------------------------------------------------------------ *
 * Progression — the plan's rule: every ~2 weeks, if a movement is
 * pain-free and you're hitting the top of the rep range, nudge it up
 * (a small weight bump, or +1 rep / +5s for bodyweight moves & holds).
 * ------------------------------------------------------------------ */

// Look up an exercise's current definition by name (searches the user's plan).
function exDef(name) {
  for (const id of userPlan.order) {
    const d = userPlan.days[id];
    const e = d && d.exercises.find((x) => x.name === name);
    if (e) return e;
  }
  return null;
}
// All unique exercise names across the plan, in order.
function allExNames() {
  const names = [];
  userPlan.order.forEach((id) => userPlan.days[id].exercises.forEach((e) => {
    if (!names.includes(e.name)) names.push(e.name);
  }));
  return names;
}

// Top of a target range, e.g. "10–12" -> 12, "20 sec each side" -> 20.
function targetTop(repsStr) {
  const nums = String(repsStr).match(/\d+/g);
  return nums ? Math.max(...nums.map(Number)) : 0;
}

// Progression metric for one session's exercise entry:
//  weight-tracked  -> heaviest completed set's weight
//  bodyweight/time -> best completed reps / seconds
function exLoad(exEntry, track) {
  const vals = exEntry.sets.filter((s) => s.done)
    .map((s) => (track === 'weight' ? num(s.weight) : num(s.reps)));
  return vals.length ? Math.max(...vals) : 0;
}
function exBestReps(exEntry) {
  const vals = exEntry.sets.filter((s) => s.done).map((s) => num(s.reps));
  return vals.length ? Math.max(...vals) : 0;
}

// Smallest sensible jump for the current unit.
const weightStep = () => (settings.unit === 'kg' ? 2.5 : 5);

// Is this exercise ready to progress? Returns a suggestion object, or null.
function progressionFor(name) {
  const plan = exDef(name);
  if (!plan) return null;
  const track = plan.tracks;
  if (/min/i.test(plan.reps)) return null;   // skip steady cardio (e.g. "10 min")

  // Sessions containing this exercise, newest first.
  const sessions = history
    .map((h) => ({ date: h.date, ex: h.exercises.find((e) => e.name === name) }))
    .filter((r) => r.ex);
  if (sessions.length < 2) return null;

  const top = targetTop(plan.reps);
  const metTarget = (r) => (track === 'weight'
    ? exBestReps(r.ex) >= top && exLoad(r.ex, 'weight') > 0
    : exLoad(r.ex, track) >= top);

  const newest = sessions[0];
  if (!metTarget(newest)) return null;
  const current = exLoad(newest.ex, track);
  if (current <= 0) return null;

  // Count consecutive recent sessions at >= current load that hit target.
  let streak = 0, oldestDate = newest.date;
  for (const r of sessions) {
    if (exLoad(r.ex, track) >= current - 1e-9 && metTarget(r)) { streak++; oldestDate = r.date; }
    else break;
  }
  const daysHeld = Math.round((Date.now() - oldestDate) / 864e5);

  // Ready when it's been ~2 weeks, or 2+ solid sessions at this load.
  if (!(streak >= 2 || daysHeld >= 14)) return null;

  if (track === 'weight') {
    const next = +(current + weightStep()).toFixed(2);
    return { name, track, current, next,
      label: `Try ${next} ${settings.unit}`,
      detail: `Held ${current} ${settings.unit} for ${streak} session${streak > 1 ? 's' : ''} — add ${weightStep()} ${settings.unit} or a rep.` };
  }
  const isTime = track === 'time';
  const next = current + (isTime ? 5 : 1);
  return { name, track, current, next,
    label: `Try ${next}${isTime ? 's' : ' reps'}`,
    detail: `Hit ${current}${isTime ? 's' : ' reps'} for ${streak} session${streak > 1 ? 's' : ''} — add ${isTime ? '5 seconds' : 'a rep'}.` };
}

function allProgressions() {
  return allExNames().map(progressionFor).filter(Boolean);
}

/* ------------------------------------------------------------------ *
 * Tiny inline-SVG charts (no libraries — keeps the app offline).
 * ------------------------------------------------------------------ */
const shortDate = (ts) => new Date(ts).toLocaleDateString([], { day: 'numeric', month: 'numeric' });

function volumeSeries(limit = 10) {
  return history.slice(0, limit).reverse().map((h) => ({
    label: shortDate(h.date),
    value: h.volume != null ? h.volume : sessionVolume(h),
  }));
}

function exerciseSeries(name) {
  const plan = exDef(name);
  const track = plan ? plan.tracks : 'weight';
  return history.slice().reverse()
    .map((h) => ({ date: h.date, ex: h.exercises.find((e) => e.name === name) }))
    .filter((r) => r.ex)
    .map((r) => ({ label: shortDate(r.date), value: exLoad(r.ex, track) }))
    .filter((p) => p.value > 0);
}

function chartableExercises() {
  return allExNames().filter((n) => exerciseSeries(n).length >= 2);
}

function metricLabel(name) {
  const d = exDef(name);
  const t = d && d.tracks;
  return t === 'time' ? 'Hold time (s)' : t === 'bodyweight' ? 'Best reps' : `Weight (${settings.unit})`;
}

function svgBarChart(data) {
  if (!data.length) return '';
  const W = 320, H = 150, padL = 8, padR = 8, padT = 12, padB = 22;
  const max = Math.max(...data.map((d) => d.value), 1);
  const n = data.length, gap = 6;
  const bw = (W - padL - padR - gap * (n - 1)) / n;
  let out = '';
  data.forEach((d, i) => {
    const h = Math.max(2, (d.value / max) * (H - padT - padB));
    const x = padL + i * (bw + gap), y = H - padB - h;
    out += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="var(--accent)" opacity="${(0.5 + 0.5 * (d.value / max)).toFixed(2)}"/>`;
    out += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - padB + 14}" text-anchor="middle" font-size="9" fill="var(--text-faint)">${escapeHtml(d.label)}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Volume per session">${out}</svg>`;
}

function svgLineChart(points) {
  if (points.length < 2) return '<div class="empty">Log this exercise twice to see a trend.</div>';
  const W = 320, H = 160, padL = 30, padR = 12, padT = 14, padB = 22;
  const vals = points.map((p) => p.value);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.15; min -= pad; max += pad;
  const n = points.length;
  const px = (i) => padL + (i / (n - 1)) * (W - padL - padR);
  const py = (v) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);

  let grid = '';
  [max - pad, (min + max) / 2, min + pad].forEach((v) => {
    const y = py(v);
    grid += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="var(--line)"/>`;
    grid += `<text x="${padL - 5}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--text-faint)">${Math.round(v)}</text>`;
  });

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)} ${py(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${px(n - 1).toFixed(1)} ${H - padB} L${px(0).toFixed(1)} ${H - padB} Z`;
  let dots = '';
  points.forEach((p, i) => {
    dots += `<circle cx="${px(i).toFixed(1)}" cy="${py(p.value).toFixed(1)}" r="3" fill="var(--accent)"/>`;
    // label every point when few, else every other to avoid crowding
    if (n <= 7 || i % 2 === 0) dots += `<text x="${px(i).toFixed(1)}" y="${H - padB + 14}" text-anchor="middle" font-size="9" fill="var(--text-faint)">${escapeHtml(p.label)}</text>`;
  });

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Progress over time">
    ${grid}
    <path d="${area}" fill="var(--accent)" opacity="0.1"/>
    <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
  </svg>`;
}

/* ================================================================== *
 * VIEW: Home / Dashboard
 * ================================================================== */
function renderHome() {
  const s = stats();
  const bests = personalBests();
  const bestNames = Object.keys(bests);

  const activeDay = active && userPlan.days[active.dayId];
  const resumeHtml = active ? `
    <div class="resume">
      <div>
        <div class="r-title">Workout in progress</div>
        <div class="r-sub">${escapeHtml(activeDay ? activeDay.name : active.dayName)} · started ${fmtDate(active.startedAt)}</div>
      </div>
      <button class="btn" data-resume>Resume</button>
    </div>` : '';

  const dayCards = userPlan.order.map((id) => {
    const d = userPlan.days[id];
    return `
      <div class="day-card">
        <button class="dc-hit" data-start="${id}">
          <span class="badge">${escapeHtml(d.name[0])}</span>
          <span class="dc-text">
            <div class="dc-name">${escapeHtml(d.name)}</div>
            <div class="dc-sub">${escapeHtml(d.subtitle)}</div>
            <div class="dc-meta">${escapeHtml(d.day)} · ${d.exercises.length} exercises</div>
          </span>
        </button>
        <button class="dc-edit" data-editday="${id}" aria-label="Edit ${escapeHtml(d.name)}">✎</button>
      </div>`;
  }).join('');

  const recent = history.slice(0, 5).map((h) => `
    <button class="hist-item" data-editsession="${h.id}">
      <div>
        <div class="h-day">${escapeHtml(userPlan.days[h.dayId] ? userPlan.days[h.dayId].name : h.dayName || 'Workout')}</div>
        <div class="h-date">${fmtDate(h.date)}${h.durationSec ? ' · ' + Math.round(h.durationSec / 60) + ' min' : ''}</div>
      </div>
      <div class="h-vol">
        <div class="v">${fmtVol(h.volume != null ? h.volume : sessionVolume(h))} ${settings.unit}</div>
        <div class="l">volume ›</div>
      </div>
    </button>`).join('');

  const bestsHtml = bestNames.length ? bestNames.map((n) => `
      <div class="pb-row">
        <span class="pb-name">${escapeHtml(n)}</span>
        <span class="pb-val">${bests[n].weight} <small>${settings.unit} × ${escapeHtml(String(bests[n].reps || '—'))}</small></span>
      </div>`).join('') : '';

  // Ready-to-progress cards
  const progs = allProgressions();
  const progHtml = progs.length ? `
    <div class="section-title">Ready to progress</div>
    ${progs.map((p) => `
      <div class="prog-card">
        <div class="prog-i">⬆</div>
        <div class="prog-main">
          <div class="prog-name">${escapeHtml(p.name)}</div>
          <div class="prog-detail">${escapeHtml(p.detail)}</div>
        </div>
        <div class="prog-next">${escapeHtml(p.label)}</div>
      </div>`).join('')}` : '';

  // Progress charts
  const chartable = chartableExercises();
  if (chartEx == null || !chartable.includes(chartEx)) chartEx = chartable[0] || null;
  const volSeries = volumeSeries(10);
  const chartsHtml = history.length ? `
    <div class="section-title">Progress</div>
    <div class="stat" style="padding:14px 14px 6px">
      <div class="chart-cap">Workout volume <span class="muted">· last ${volSeries.length} session${volSeries.length > 1 ? 's' : ''}</span></div>
      ${svgBarChart(volSeries)}
    </div>
    ${chartEx ? `
    <div class="stat" style="padding:14px 14px 6px;margin-top:10px">
      <div class="chart-cap" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <span id="chart-ex-label">${escapeHtml(metricLabel(chartEx))}</span>
        <select id="chart-ex" class="mini-select" aria-label="Choose exercise">
          ${chartable.map((n) => `<option value="${escapeHtml(n)}" ${n === chartEx ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('')}
        </select>
      </div>
      <div id="chart-ex-body">${svgLineChart(exerciseSeries(chartEx))}</div>
    </div>` : ''}` : '';

  document.getElementById('app').innerHTML = `
    <header class="app-header">
      <h1><span class="logo">${LOGO_SVG}</span> Lift Tracker</h1>
      <div class="header-actions">
        <button class="icon-btn" data-timer aria-label="Rest timer">⏱</button>
        <button class="icon-btn" data-settings aria-label="Settings">⚙</button>
      </div>
    </header>

    ${resumeHtml}

    <div class="stat-grid">
      <div class="stat accent"><div class="num">${s.total}</div><div class="lbl">Workouts</div></div>
      <div class="stat"><div class="num">${s.thisWeek}</div><div class="lbl">This week</div></div>
      <div class="stat blue"><div class="num">${s.streak}</div><div class="lbl">Day streak</div></div>
      <div class="stat"><div class="num">${fmtVol(s.totalVol)}</div><div class="lbl">Total ${settings.unit} lifted</div></div>
      <div class="stat wide"><div class="num">${fmtDuration(s.totalTime)}</div><div class="lbl">Total time trained</div></div>
    </div>

    ${progHtml}

    <div class="section-title">Start a workout</div>
    ${dayCards}
    <button class="btn btn-ghost btn-block mt8" data-customize>✎ Customize exercises</button>

    ${chartsHtml}

    <div class="section-title">Recent sessions</div>
    ${recent || '<div class="empty">No workouts logged yet. Pick a day above to start.</div>'}

    ${bestNames.length ? `<div class="section-title">Personal bests</div><div class="stat" style="padding:6px 16px">${bestsHtml}</div>` : ''}

    <p class="center muted mt16" style="font-size:12px">Data is saved on this device only.</p>
  `;

  // wire up
  $('[data-settings]').addEventListener('click', openSettings);
  $('[data-timer]').addEventListener('click', startStandaloneTimer);
  document.querySelectorAll('[data-start]').forEach((b) =>
    b.addEventListener('click', () => startWorkout(b.dataset.start)));
  document.querySelectorAll('[data-editday]').forEach((b) =>
    b.addEventListener('click', () => renderDayEditor(b.dataset.editday)));
  document.querySelectorAll('[data-editsession]').forEach((b) =>
    b.addEventListener('click', () => renderSessionEditor(b.dataset.editsession)));
  $('[data-customize]').addEventListener('click', renderPlanPicker);
  const resumeBtn = $('[data-resume]');
  if (resumeBtn) resumeBtn.addEventListener('click', () => renderWorkout());

  // progress line-chart exercise selector — swap just the chart body
  const sel = $('#chart-ex');
  if (sel) sel.addEventListener('change', () => {
    chartEx = sel.value;
    $('#chart-ex-body').innerHTML = svgLineChart(exerciseSeries(chartEx));
    $('#chart-ex-label').textContent = metricLabel(chartEx);
  });
}

/* ================================================================== *
 * Warm-up rotation — a different warm-up each session, cycling back to
 * the first at the start of each new week ("repeats once the week is over").
 * ================================================================== */
function weekKey(d = new Date()) {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7;   // Monday = 0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - dow);       // back to this week's Monday
  return x.toISOString().slice(0, 10);
}
function nextWarmupIndex() {
  const wk = weekKey();
  const st = load(KEY.warmup, { weekKey: wk, count: 0 });
  if (st.weekKey !== wk) { st.weekKey = wk; st.count = 0; }   // new week -> restart
  const idx = st.count % WARMUPS.length;
  st.count += 1;
  save(KEY.warmup, st);
  return idx;
}

/* ================================================================== *
 * Start / build a workout session
 * ================================================================== */
function startWorkout(dayId) {
  if (active && active.dayId !== dayId) {
    if (!confirm('You have an unfinished workout. Discard it and start a new one?')) return;
  }
  unlockAudio();   // this tap lets the timer/hydration sounds play later
  const day = userPlan.days[dayId];
  active = {
    id: uid(),
    dayId,
    dayName: day.name,
    startedAt: Date.now(),
    rest: settings.rest,
    warmupIndex: nextWarmupIndex(),
    exercises: day.exercises.map((ex) => ({
      name: ex.name,
      target: `${ex.sets} × ${ex.reps}`,
      reps: ex.reps,
      notes: ex.notes,
      tracks: ex.tracks,
      sets: Array.from({ length: ex.sets }, () => {
        const prev = last[ex.name];
        return {
          weight: prev ? prev.weight : '',
          reps: '',
          done: false,
        };
      }),
    })),
  };
  save(KEY.active, active);
  renderWorkout();
}

/* ================================================================== *
 * VIEW: Active workout
 * ================================================================== */
function renderWorkout() {
  if (!active) return renderHome();

  const day = userPlan.days[active.dayId] || { name: active.dayName, day: '', subtitle: '' };

  const restChips = [60, 90, 120, 180].map((n) =>
    `<button class="chip ${active.rest === n ? 'active' : ''}" data-rest="${n}">${n}s</button>`
  ).join('') + `<button class="chip ${!REST_PRESETS.includes(active.rest) && active.rest ? 'active' : ''}" data-rest-custom>${!REST_PRESETS.includes(active.rest) ? active.rest + 's' : '···'}</button>`;

  const wu = WARMUPS[active.warmupIndex] || WARMUPS[0];
  const warmup = `
    <details class="warmup">
      <summary><span class="wu-i">▲</span> Warm-up · ${escapeHtml(wu.name)} · 5 min <span style="margin-left:auto;color:var(--text-faint);font-size:12px;font-weight:500">tap to expand</span></summary>
      <ol>${wu.steps.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ol>
    </details>`;

  const exBlocks = active.exercises.map((ex, ei) => {
    const allDone = ex.sets.every((s) => s.done);
    const isTime = ex.tracks === 'time';
    const hideWeight = ex.tracks === 'bodyweight';
    const repsLabel = isTime ? 'Secs/Reps' : 'Reps';
    const prev = last[ex.name];

    const prog = progressionFor(ex.name);
    const progHint = prog ? (prog.track === 'weight'
      ? `<button class="prog-hint" data-applyprog="${ei}" data-progval="${prog.next}">⬆ Ready to progress — tap to load <b>${prog.next} ${settings.unit}</b></button>`
      : `<div class="prog-hint static">⬆ Ready to progress — aim for <b>${escapeHtml(prog.label.replace('Try ', ''))}</b></div>`) : '';

    const rows = ex.sets.map((set, si) => `
      <div class="set-row ${set.done ? 'done' : ''}" data-ex="${ei}" data-set="${si}">
        <div class="set-n">${si + 1}</div>
        <div class="field ${hideWeight ? 'hide-weight' : ''}">
          <input type="number" inputmode="decimal" step="0.5" placeholder="${hideWeight ? 'BW' : '0'}"
                 value="${set.weight}" data-field="weight" aria-label="Weight set ${si + 1}" />
          <span class="unit">${settings.unit}</span>
        </div>
        <div class="field">
          <input type="number" inputmode="numeric" placeholder="0"
                 value="${set.reps}" data-field="reps" aria-label="Reps set ${si + 1}" />
          <span class="unit">${isTime ? 'sec' : 'reps'}</span>
        </div>
        <button class="set-check ${set.done ? 'on' : ''}" data-check aria-label="Complete set ${si + 1}">✓</button>
        <button class="set-del" data-delset aria-label="Delete set ${si + 1}">✕</button>
      </div>`).join('');

    return `
      <div class="exercise ${allDone ? 'done-all' : ''}">
        <div class="ex-head">
          <div class="ex-title-row">
            <span class="ex-name">${escapeHtml(ex.name)}</span>
            <span class="ex-target">${escapeHtml(ex.target)}</span>
          </div>
          ${ex.notes ? `<div class="ex-note">${escapeHtml(ex.notes)}</div>` : ''}
        </div>
        ${progHint}
        <div class="set-head"><span>#</span><span>${hideWeight ? 'Load' : 'Weight'}</span><span>${repsLabel}</span><span>✓</span><span></span></div>
        <div class="sets" data-sets="${ei}">
          ${rows}
          <button class="add-set" data-addset="${ei}">+ Add set</button>
        </div>
        ${prev ? `<div class="last-hint">Last time: <b>${prev.weight || 'BW'} ${prev.weight ? settings.unit : ''}</b>${prev.reps ? ' × ' + escapeHtml(String(prev.reps)) : ''}</div>` : ''}
        <div class="ex-actions">
          <button class="ex-action" data-swapex="${ei}">⇄ Swap</button>
          <button class="ex-action danger" data-removeex="${ei}">✕ Remove</button>
        </div>
      </div>`;
  }).join('');

  document.getElementById('app').innerHTML = `
    <header class="app-header">
      <button class="icon-btn" data-back aria-label="Back">‹</button>
      <div class="wk-head" style="flex:1;flex-direction:column;align-items:flex-start;gap:0">
        <div class="wk-title">${escapeHtml(day.name)}</div>
        <div class="wk-sub">${day.day} · ${escapeHtml(day.subtitle)}</div>
      </div>
      <div class="wk-elapsed" id="wk-elapsed" aria-label="Elapsed workout time">0:00</div>
    </header>

    <div class="wk-timerbar">
      <div class="tb-label">Rest timer<br><b>${active.rest}s</b> between sets</div>
      <div class="rest-chips">${restChips}</div>
    </div>

    ${warmup}
    ${exBlocks}

    <button class="btn btn-ghost btn-block" data-addexercise>+ Add exercise (machine taken?)</button>

    <div class="finish-bar">
      <button class="btn btn-ghost" data-discard style="flex:0 0 auto">Discard</button>
      <button class="btn btn-block btn-lg" data-finish>Finish workout</button>
    </div>
  `;

  wireWorkout();
  startWorkoutClock();
}

/* ------------------------------------------------------------------ *
 * Workout clock — ticks once a second while the workout view is open.
 * Updates the elapsed display and drives hydration reminders. It stops
 * itself when the workout view is gone (element missing / no active).
 * ------------------------------------------------------------------ */
let workoutClock = 0;
function startWorkoutClock() {
  clearInterval(workoutClock);
  const tickClock = () => {
    const el = document.getElementById('wk-elapsed');
    if (!el || !active) { clearInterval(workoutClock); return; }
    el.textContent = fmtElapsed((Date.now() - active.startedAt) / 1000);
    maybeHydrate();
  };
  tickClock();
  workoutClock = setInterval(tickClock, 1000);
}

/* ------------------------------------------------------------------ *
 * Hydration reminders — nudge to drink water every N minutes during a
 * workout. Scheduled off `active.hydrationNext` so it survives reloads.
 * ------------------------------------------------------------------ */
function maybeHydrate() {
  if (!active) return;
  if (!settings.hydration) { active.hydrationNext = null; return; }
  const intervalMs = (settings.hydrationMin || 15) * 60000;
  if (!active.hydrationNext) {          // (re)start the schedule from now
    active.hydrationNext = Date.now() + intervalMs;
    save(KEY.active, active);
    return;
  }
  if (Date.now() >= active.hydrationNext) {
    active.hydrationNext = Date.now() + intervalMs;
    save(KEY.active, active);
    hydrationNudge();
  }
}

function hydrationNudge() {
  toast('💧 Time to drink some water', 3200);
  soundHydration();
  vibrate([120, 80, 120]);
}

function wireWorkout() {
  $('[data-back]').addEventListener('click', () => { save(KEY.active, active); renderHome(); });

  // rest presets
  document.querySelectorAll('[data-rest]').forEach((b) =>
    b.addEventListener('click', () => { setRest(num(b.dataset.rest)); }));
  const customBtn = $('[data-rest-custom]');
  if (customBtn) customBtn.addEventListener('click', () => {
    const v = prompt('Rest interval in seconds:', active.rest);
    if (v == null) return;
    const n = Math.max(5, Math.min(900, Math.round(num(v))));
    if (n) setRest(n);
  });

  // inputs
  document.querySelectorAll('.set-row input').forEach((inp) => {
    inp.addEventListener('input', onFieldInput);
    inp.addEventListener('blur', () => save(KEY.active, active));
  });

  // check buttons
  document.querySelectorAll('[data-check]').forEach((b) =>
    b.addEventListener('click', onCheck));

  // add set
  document.querySelectorAll('[data-addset]').forEach((b) =>
    b.addEventListener('click', () => addSet(num(b.dataset.addset))));

  // delete a set
  document.querySelectorAll('[data-delset]').forEach((b) =>
    b.addEventListener('click', (e) => {
      const row = e.target.closest('.set-row');
      delSet(num(row.dataset.ex), num(row.dataset.set));
    }));

  // swap / remove an exercise (this session only)
  document.querySelectorAll('[data-swapex]').forEach((b) =>
    b.addEventListener('click', () => renderSessionPicker('swap', num(b.dataset.swapex))));
  document.querySelectorAll('[data-removeex]').forEach((b) =>
    b.addEventListener('click', (e) => armThen(e.target, '✕ Remove?', () => {
      active.exercises.splice(num(e.target.dataset.removeex), 1);
      save(KEY.active, active);
      renderWorkout();
      toast('Exercise removed');
    })));
  $('[data-addexercise]').addEventListener('click', () => renderSessionPicker('add'));

  // apply a progression suggestion — load the new weight into unfinished sets
  document.querySelectorAll('[data-applyprog]').forEach((b) =>
    b.addEventListener('click', () => {
      const ei = num(b.dataset.applyprog);
      const val = b.dataset.progval;
      active.exercises[ei].sets.forEach((s) => { if (!s.done) s.weight = val; });
      save(KEY.active, active);
      renderWorkout();
      toast(`Loaded ${val} ${settings.unit}`);
    }));

  $('[data-finish]').addEventListener('click', finishWorkout);
  $('[data-discard]').addEventListener('click', discardWorkout);
}

function setRest(n) {
  active.rest = n;
  save(KEY.active, active);
  // update just the bar + chips without full re-render if timer not open
  renderWorkout();
}

function onFieldInput(e) {
  const row = e.target.closest('.set-row');
  const ei = num(row.dataset.ex), si = num(row.dataset.set);
  const field = e.target.dataset.field;
  active.exercises[ei].sets[si][field] = e.target.value;
  // debounce-ish save
  save(KEY.active, active);
}

function onCheck(e) {
  const row = e.target.closest('.set-row');
  const ei = num(row.dataset.ex), si = num(row.dataset.set);
  const set = active.exercises[ei].sets[si];
  set.done = !set.done;

  if (set.done) {
    // if reps empty, seed from target number if it starts with a digit
    if (!set.reps) {
      const ex = active.exercises[ei];
      const m = String(ex.reps).match(/\d+/);
      if (m) set.reps = m[0];
    }
    row.classList.add('done');
    e.target.classList.add('on');
    // update the inputs' displayed values if we seeded reps
    const repsInput = row.querySelector('[data-field="reps"]');
    if (repsInput && !repsInput.value) repsInput.value = set.reps;
    save(KEY.active, active);
    unlockAudio();
    startTimer(active.rest);
  } else {
    row.classList.remove('done');
    e.target.classList.remove('on');
    save(KEY.active, active);
  }

  // mark exercise done-all styling
  const exEl = row.closest('.exercise');
  const allDone = active.exercises[ei].sets.every((s) => s.done);
  exEl.classList.toggle('done-all', allDone);
}

function addSet(ei) {
  const ex = active.exercises[ei];
  const prevSet = ex.sets[ex.sets.length - 1];
  ex.sets.push({ weight: prevSet ? prevSet.weight : '', reps: '', done: false });
  save(KEY.active, active);
  renderWorkout();
}

function delSet(ei, si) {
  active.exercises[ei].sets.splice(si, 1);
  save(KEY.active, active);
  renderWorkout();
}

// Build an active-session exercise entry from a plan/library definition.
function buildActiveEx(def) {
  return {
    name: def.name,
    target: `${def.sets} × ${def.reps}`,
    reps: def.reps,
    notes: def.notes || '',
    tracks: def.tracks || 'weight',
    sets: Array.from({ length: def.sets || 3 }, () => {
      const prev = last[def.name];
      return { weight: prev ? prev.weight : '', reps: '', done: false };
    }),
  };
}

// Library picker used mid-workout to add or swap an exercise for THIS session
// only (the saved plan is untouched).
function renderSessionPicker(mode, ei) {
  const title = mode === 'swap' ? 'Swap exercise' : 'Add exercise';
  const onPick = (e) => {
    const built = buildActiveEx(e);
    if (mode === 'swap') active.exercises[ei] = built;
    else active.exercises.push(built);
    save(KEY.active, active);
    renderWorkout();
    toast(mode === 'swap' ? 'Swapped' : 'Added');
  };
  document.getElementById('app').innerHTML = `
    <header class="app-header">
      <button class="icon-btn" data-back aria-label="Back">‹</button>
      <div class="wk-head" style="flex:1"><div class="wk-title">${title}</div></div>
    </header>
    <input id="lib-search" class="lib-search" type="search" autocomplete="off"
           placeholder="Search ${EXERCISE_LIBRARY.length} exercises…" />
    <p class="muted" style="font-size:12px;margin:0 2px 12px">${mode === 'swap' ? 'Pick a replacement' : 'Pick something to add'} for today only — your saved plan isn’t changed. ⚠ marks knee/shoulder-loading moves.</p>
    <div id="lib-list">${libraryListHtml('')}</div>
  `;
  $('[data-back]').addEventListener('click', renderWorkout);
  const search = $('#lib-search');
  search.addEventListener('input', () => {
    $('#lib-list').innerHTML = libraryListHtml(search.value);
    bindLibraryPicks(onPick);
  });
  bindLibraryPicks(onPick);
}

function finishWorkout() {
  const doneSets = active.exercises.reduce((n, ex) => n + ex.sets.filter((s) => s.done).length, 0);
  if (doneSets === 0) {
    if (!confirm('No sets marked complete. Finish anyway?')) return;
  }
  const session = {
    id: active.id,
    dayId: active.dayId,
    dayName: active.dayName,
    date: Date.now(),
    durationSec: Math.round((Date.now() - active.startedAt) / 1000),
    exercises: active.exercises,
  };
  session.volume = sessionVolume(session);

  // update "last used" prefill map from the last completed set of each exercise
  active.exercises.forEach((ex) => {
    const doneSetsForEx = ex.sets.filter((s) => s.done && (s.weight !== '' || s.reps !== ''));
    const src = doneSetsForEx.length ? doneSetsForEx[doneSetsForEx.length - 1] : null;
    if (src) last[ex.name] = { weight: src.weight, reps: src.reps };
  });
  save(KEY.last, last);

  history.unshift(session);
  save(KEY.history, history);

  active = null;
  localStorage.removeItem(KEY.active);
  stopTimer(true);
  toast(`Saved · ${fmtDuration(session.durationSec)} · ${fmtVol(session.volume)} ${settings.unit} 💪`);
  renderHome();
}

function discardWorkout() {
  if (!confirm('Discard this workout? Nothing will be saved.')) return;
  active = null;
  localStorage.removeItem(KEY.active);
  stopTimer(true);
  renderHome();
}

/* ================================================================== *
 * PLAN EDITOR — custom exercises + reordering (persists to the plan)
 * ================================================================== */
function renderPlanPicker() {
  const cards = userPlan.order.map((id) => {
    const d = userPlan.days[id];
    return `
      <div class="day-card">
        <button class="dc-hit" data-editday="${id}">
          <span class="badge">${escapeHtml(d.name[0])}</span>
          <span class="dc-text">
            <div class="dc-name">${escapeHtml(d.name)}</div>
            <div class="dc-meta">${d.exercises.length} exercises</div>
          </span>
        </button>
        <span class="chev">›</span>
      </div>`;
  }).join('');
  document.getElementById('app').innerHTML = `
    <header class="app-header">
      <button class="icon-btn" data-back aria-label="Back">‹</button>
      <div class="wk-head" style="flex:1"><div class="wk-title">Customize exercises</div></div>
    </header>
    <p class="muted" style="font-size:13px;margin:0 2px 14px">Pick a day to add, edit, reorder or remove exercises. Changes apply to your next workout.</p>
    ${cards}
  `;
  $('[data-back]').addEventListener('click', renderHome);
  document.querySelectorAll('[data-editday]').forEach((b) =>
    b.addEventListener('click', () => renderDayEditor(b.dataset.editday)));
}

function renderDayEditor(dayId) {
  const d = userPlan.days[dayId];
  const rows = d.exercises.map((ex, i) => `
    <div class="edit-row">
      <div class="edit-main">
        <div class="edit-name">${escapeHtml(ex.name)}</div>
        <div class="edit-meta">${ex.sets} × ${escapeHtml(ex.reps)} · ${TRACK_LABELS[ex.tracks] || ex.tracks}</div>
      </div>
      <div class="edit-actions">
        <button class="mini-btn" data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
        <button class="mini-btn" data-down="${i}" ${i === d.exercises.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
        <button class="mini-btn" data-editex="${i}" aria-label="Edit">✎</button>
        <button class="mini-btn danger" data-delex="${i}" aria-label="Delete">✕</button>
      </div>
    </div>`).join('');

  document.getElementById('app').innerHTML = `
    <header class="app-header">
      <button class="icon-btn" data-back aria-label="Back">‹</button>
      <div class="wk-head" style="flex:1;flex-direction:column;align-items:flex-start;gap:0">
        <div class="wk-title">${escapeHtml(d.name)}</div>
        <div class="wk-sub">Edit exercises</div>
      </div>
    </header>
    ${rows || '<div class="empty">No exercises yet. Add one below.</div>'}
    <button class="btn btn-block mt16" data-addlib>+ Add from library</button>
    <button class="btn btn-ghost btn-block mt8" data-addex>+ Add custom exercise</button>
    <button class="btn btn-ghost btn-block mt8" data-resetday>Reset this day to default</button>
    <p class="center muted mt16" style="font-size:12px">Changes apply to your next workout, not one in progress.</p>
  `;
  $('[data-back]').addEventListener('click', renderPlanPicker);
  $('[data-addlib]').addEventListener('click', () => renderLibraryPicker(dayId));
  document.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => moveEx(dayId, +b.dataset.up, -1)));
  document.querySelectorAll('[data-down]').forEach((b) => b.addEventListener('click', () => moveEx(dayId, +b.dataset.down, +1)));
  document.querySelectorAll('[data-editex]').forEach((b) => b.addEventListener('click', () => renderExerciseForm(dayId, +b.dataset.editex)));
  document.querySelectorAll('[data-delex]').forEach((b) => b.addEventListener('click', () => delEx(dayId, +b.dataset.delex)));
  $('[data-addex]').addEventListener('click', () => renderExerciseForm(dayId, null));
  $('[data-resetday]').addEventListener('click', (e) => armThen(e.target, 'Tap again to reset', () => {
    if (PLAN[dayId]) userPlan.days[dayId] = JSON.parse(JSON.stringify(PLAN[dayId]));
    savePlan(); renderDayEditor(dayId); toast('Reset to default');
  }));
}

function moveEx(dayId, i, dir) {
  const arr = userPlan.days[dayId].exercises;
  const j = i + dir;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  savePlan();
  renderDayEditor(dayId);
}

function delEx(dayId, i) {
  const btn = document.querySelector(`[data-delex="${i}"]`);
  armThen(btn, '✓?', () => {
    userPlan.days[dayId].exercises.splice(i, 1);
    savePlan(); renderDayEditor(dayId); toast('Exercise removed');
  });
}

function renderExerciseForm(dayId, idx, prefill) {
  const editing = idx != null;
  const ex = editing ? userPlan.days[dayId].exercises[idx]
    : (prefill || { name: '', sets: 3, reps: '12', tracks: 'weight', notes: '' });
  const cautionBanner = (prefill && prefill.caution)
    ? `<div class="caution-banner">⚠ ${escapeHtml(prefill.caution)}</div>` : '';
  document.getElementById('app').innerHTML = `
    <header class="app-header">
      <button class="icon-btn" data-back aria-label="Back">‹</button>
      <div class="wk-head" style="flex:1"><div class="wk-title">${editing ? 'Edit exercise' : 'Add exercise'}</div></div>
    </header>
    ${cautionBanner}
    <div class="form">
      <label class="fld"><span>Name</span>
        <input id="f-name" type="text" value="${escapeHtml(ex.name)}" placeholder="e.g. Seated Cable Row" /></label>
      <div class="fld-row">
        <label class="fld"><span>Sets</span>
          <input id="f-sets" type="number" inputmode="numeric" min="1" max="10" value="${ex.sets}" /></label>
        <label class="fld"><span>Reps / target</span>
          <input id="f-reps" type="text" value="${escapeHtml(ex.reps)}" placeholder="e.g. 10–12" /></label>
      </div>
      <label class="fld"><span>Type</span>
        <select id="f-tracks">
          <option value="weight" ${ex.tracks === 'weight' ? 'selected' : ''}>Weighted (weight + reps)</option>
          <option value="bodyweight" ${ex.tracks === 'bodyweight' ? 'selected' : ''}>Bodyweight (reps)</option>
          <option value="time" ${ex.tracks === 'time' ? 'selected' : ''}>Time / hold (seconds)</option>
        </select></label>
      <label class="fld"><span>Notes (optional)</span>
        <input id="f-notes" type="text" value="${escapeHtml(ex.notes || '')}" placeholder="Coaching cue / injury note" /></label>
      <button class="btn btn-block btn-lg mt16" data-save>${editing ? 'Save changes' : 'Add exercise'}</button>
    </div>
  `;
  $('[data-back]').addEventListener('click', () => prefill ? renderLibraryPicker(dayId) : renderDayEditor(dayId));
  $('[data-save]').addEventListener('click', () => {
    const name = $('#f-name').value.trim();
    if (!name) { toast('Give it a name'); $('#f-name').focus(); return; }
    const rec = {
      name,
      sets: Math.max(1, Math.min(10, Math.round(num($('#f-sets').value)) || 1)),
      reps: $('#f-reps').value.trim() || '10',
      tracks: $('#f-tracks').value,
      notes: $('#f-notes').value.trim(),
    };
    if (editing) userPlan.days[dayId].exercises[idx] = rec;
    else userPlan.days[dayId].exercises.push(rec);
    savePlan();
    renderDayEditor(dayId);
    toast(editing ? 'Saved' : 'Added');
  });
}

/* ================================================================== *
 * EXERCISE LIBRARY PICKER — search a preloaded list, tap to pre-fill
 * ================================================================== */
function libraryListHtml(q) {
  const query = q.trim().toLowerCase();
  const match = (e) => !query || e.name.toLowerCase().includes(query)
    || e.group.toLowerCase().includes(query) || (e.notes && e.notes.toLowerCase().includes(query));
  let html = '';
  LIBRARY_GROUPS.forEach((g) => {
    const items = EXERCISE_LIBRARY.filter((e) => e.group === g && match(e));
    if (!items.length) return;
    html += `<div class="lib-group">${escapeHtml(g)}</div>`;
    items.forEach((e) => {
      const i = EXERCISE_LIBRARY.indexOf(e);
      html += `
        <button class="lib-row" data-pick="${i}">
          <div class="lib-main">
            <div class="lib-name">${escapeHtml(e.name)}${e.caution ? ' <span class="lib-warn">⚠</span>' : ''}</div>
            <div class="lib-meta">${e.sets} × ${escapeHtml(e.reps)} · ${TRACK_LABELS[e.tracks]}${e.caution ? ' · <span class="lib-caution">' + escapeHtml(e.caution) + '</span>' : ''}</div>
          </div>
          <span class="chev">›</span>
        </button>`;
    });
  });
  return html || '<div class="empty">No matches. Use “Add custom exercise” instead.</div>';
}

// Bind [data-pick] rows to a callback that receives a *copy* of the library entry.
function bindLibraryPicks(onPick) {
  document.querySelectorAll('[data-pick]').forEach((b) =>
    b.addEventListener('click', () => onPick(Object.assign({}, EXERCISE_LIBRARY[+b.dataset.pick]))));
}

function renderLibraryPicker(dayId, query = '') {
  const onPick = (e) => renderExerciseForm(dayId, null, e);
  document.getElementById('app').innerHTML = `
    <header class="app-header">
      <button class="icon-btn" data-back aria-label="Back">‹</button>
      <div class="wk-head" style="flex:1"><div class="wk-title">Exercise library</div></div>
    </header>
    <input id="lib-search" class="lib-search" type="search" autocomplete="off"
           placeholder="Search ${EXERCISE_LIBRARY.length} exercises…" value="${escapeHtml(query)}" />
    <p class="muted" style="font-size:12px;margin:0 2px 12px">Tap one to add it to <b>${escapeHtml(userPlan.days[dayId].name)}</b>. ⚠ marks moves that load the knee or shoulder.</p>
    <div id="lib-list">${libraryListHtml(query)}</div>
  `;
  $('[data-back]').addEventListener('click', () => renderDayEditor(dayId));
  const search = $('#lib-search');
  search.addEventListener('input', () => {
    $('#lib-list').innerHTML = libraryListHtml(search.value);
    bindLibraryPicks(onPick);
  });
  bindLibraryPicks(onPick);
}

/* ================================================================== *
 * SESSION EDITOR — edit or delete a past workout
 * ================================================================== */
function renderSessionEditor(id) {
  const idx = history.findIndex((h) => h.id === id);
  if (idx < 0) return renderHome();
  const h = history[idx];
  const dayName = userPlan.days[h.dayId] ? userPlan.days[h.dayId].name : (h.dayName || 'Workout');

  const exBlocks = h.exercises.map((ex, ei) => {
    const rows = ex.sets.map((set, si) => `
      <div class="set-row ${set.done ? 'done' : ''}" data-ex="${ei}" data-set="${si}">
        <div class="set-n">${si + 1}</div>
        <div class="field"><input type="number" inputmode="decimal" step="0.5" value="${set.weight}" data-field="weight" placeholder="0" aria-label="Weight" /><span class="unit">${settings.unit}</span></div>
        <div class="field"><input type="number" inputmode="numeric" value="${set.reps}" data-field="reps" placeholder="0" aria-label="Reps" /><span class="unit">reps</span></div>
        <button class="set-check ${set.done ? 'on' : ''}" data-check aria-label="Toggle counted">✓</button>
        <button class="set-del" data-delset aria-label="Delete set ${si + 1}">✕</button>
      </div>`).join('');
    return `
      <div class="exercise">
        <div class="ex-head"><div class="ex-title-row"><span class="ex-name">${escapeHtml(ex.name)}</span></div></div>
        <div class="set-head"><span>#</span><span>Weight</span><span>Reps</span><span>✓</span><span></span></div>
        <div class="sets">${rows}</div>
      </div>`;
  }).join('');

  document.getElementById('app').innerHTML = `
    <header class="app-header">
      <button class="icon-btn" data-back aria-label="Back">‹</button>
      <div class="wk-head" style="flex:1;flex-direction:column;align-items:flex-start;gap:0">
        <div class="wk-title">${escapeHtml(dayName)}</div>
        <div class="wk-sub">${fmtDate(h.date)}</div>
      </div>
    </header>
    <p class="muted" style="font-size:13px;margin:0 2px 12px">Edit logged weights and reps, or toggle whether a set counts. Volume updates automatically.</p>
    ${exBlocks}
    <div class="finish-bar">
      <button class="btn btn-danger" data-delsession style="flex:0 0 auto">Delete</button>
      <button class="btn btn-block btn-lg" data-donesession>Done</button>
    </div>
  `;

  const persist = () => { h.volume = sessionVolume(h); save(KEY.history, history); };
  $('[data-back]').addEventListener('click', () => { persist(); renderHome(); });
  $('[data-donesession]').addEventListener('click', () => { persist(); toast('Saved'); renderHome(); });
  document.querySelectorAll('.set-row input').forEach((inp) => inp.addEventListener('input', (e) => {
    const row = e.target.closest('.set-row');
    h.exercises[+row.dataset.ex].sets[+row.dataset.set][e.target.dataset.field] = e.target.value;
    persist();
  }));
  document.querySelectorAll('[data-check]').forEach((b) => b.addEventListener('click', (e) => {
    const row = e.target.closest('.set-row');
    const s = h.exercises[+row.dataset.ex].sets[+row.dataset.set];
    s.done = !s.done;
    e.target.classList.toggle('on', s.done);
    row.classList.toggle('done', s.done);
    persist();
  }));
  document.querySelectorAll('[data-delset]').forEach((b) => b.addEventListener('click', (e) => {
    const row = e.target.closest('.set-row');
    h.exercises[+row.dataset.ex].sets.splice(+row.dataset.set, 1);
    persist();
    renderSessionEditor(id);
  }));
  $('[data-delsession]').addEventListener('click', (e) => armThen(e.target, 'Confirm delete', () => {
    history.splice(idx, 1);
    save(KEY.history, history);
    toast('Session deleted');
    renderHome();
  }));
}

// Two-tap confirm for a destructive button: first tap arms it (label changes),
// a second tap within 3s runs the action. Avoids native confirm() dialogs.
function armThen(btn, armedLabel, action) {
  if (!btn) return;
  if (btn.dataset.armed) { action(); return; }
  const original = btn.textContent;
  btn.dataset.armed = '1';
  btn.textContent = armedLabel;
  btn.classList.add('armed');
  setTimeout(() => {
    if (btn && btn.dataset.armed) { btn.dataset.armed = ''; btn.textContent = original; btn.classList.remove('armed'); }
  }, 3000);
}

/* ================================================================== *
 * REST TIMER
 * ================================================================== */
const timerSheet = document.getElementById('timer-sheet');
const timerCount = document.getElementById('timer-count');
const ringProgress = document.getElementById('ring-progress');
const RING_LEN = 2 * Math.PI * 54; // circumference

let timer = { endAt: 0, total: 0, remaining: 0, interval: 0, paused: false, done: false, wakeLock: null };

// Standalone rest timer — use the countdown without tracking a workout.
function startStandaloneTimer() {
  unlockAudio();
  startTimer(settings.rest);
}

function startTimer(seconds) {
  timer.total = seconds;
  timer.remaining = seconds;
  timer.endAt = Date.now() + seconds * 1000;
  timer.paused = false;
  timer.done = false;
  timer.lastTick = null;
  buildTimerPresets();
  timerSheet.hidden = false;
  timerCount.classList.remove('done');
  const pb = $('#timer-pause');
  pb.textContent = 'Pause';
  pb.classList.remove('paused');
  requestWakeLock();
  soundStart();
  runInterval();
  tick();
}

// setInterval keeps ticking in a backgrounded / locked-phone tab (throttled to
// ~1s, which is plenty for a seconds countdown). requestAnimationFrame does not
// fire at all in the background, which would freeze the rest timer.
function runInterval() {
  clearInterval(timer.interval);
  timer.interval = setInterval(tick, 250);
}

function tick() {
  if (timer.paused || timer.done) return;
  const remain = (timer.endAt - Date.now()) / 1000;
  timer.remaining = remain;
  const shown = Math.max(0, remain);
  timerCount.textContent = fmtClock(shown);

  const frac = timer.total > 0 ? Math.max(0, Math.min(1, shown / timer.total)) : 0;
  ringProgress.style.strokeDasharray = RING_LEN;
  ringProgress.style.strokeDashoffset = RING_LEN * (1 - frac);

  // Final 3-2-1 countdown blips (once per whole second).
  const whole = Math.ceil(shown);
  if (whole !== timer.lastTick) {
    if (remain > 0 && whole >= 1 && whole <= 3) soundTick();
    timer.lastTick = whole;
  }

  if (remain <= 0) onTimerDone();
}

function onTimerDone() {
  if (timer.done) return;      // guard: interval keeps firing, only finish once
  timer.done = true;
  clearInterval(timer.interval);
  timerCount.textContent = 'Go!';
  timerCount.classList.add('done');
  ringProgress.style.strokeDashoffset = RING_LEN;
  soundFinish();
  vibrate([200, 100, 200]);
  releaseWakeLock();
  // auto-close shortly after
  clearTimeout(timer.closeTO);
  timer.closeTO = setTimeout(() => { if (!timer.paused) closeTimer(); }, 1400);
}

function adjustTimer(delta) {
  if (timer.remaining <= 0 && delta < 0) return;
  // Adding time after "Go!" revives the countdown.
  if (delta > 0 && timer.done) {
    timer.done = false;
    timerCount.classList.remove('done');
    if (!timer.paused) runInterval();
  }
  timer.endAt += delta * 1000;
  timer.total = Math.max(timer.total + delta, Math.max(0, (timer.endAt - Date.now()) / 1000));
  if (timer.paused) {
    timer.remaining = Math.max(0, timer.remaining + delta);
    timerCount.textContent = fmtClock(timer.remaining);
  } else {
    tick(); // repaint immediately
  }
}

function togglePause() {
  if (timer.done) return;
  const btn = $('#timer-pause');
  if (timer.paused) {
    timer.paused = false;
    timer.endAt = Date.now() + timer.remaining * 1000;
    btn.textContent = 'Pause'; btn.classList.remove('paused');
    runInterval();
    tick();
  } else {
    timer.paused = true;
    timer.remaining = Math.max(0, (timer.endAt - Date.now()) / 1000);
    clearInterval(timer.interval);
    btn.textContent = 'Resume'; btn.classList.add('paused');
  }
}

function closeTimer() {
  timerSheet.hidden = true;
  clearInterval(timer.interval);
  clearTimeout(timer.closeTO);
  releaseWakeLock();
}
function stopTimer() { timer.paused = true; closeTimer(); }

function buildTimerPresets() {
  const wrap = document.getElementById('timer-presets');
  wrap.innerHTML = REST_PRESETS.map((n) =>
    `<button class="chip ${n === timer.total ? 'active' : ''}" data-tpreset="${n}">${n}s</button>`
  ).join('');
  wrap.querySelectorAll('[data-tpreset]').forEach((b) =>
    b.addEventListener('click', () => {
      const n = num(b.dataset.tpreset);
      // In a workout, change this session's rest; standalone, update the default.
      if (active) { active.rest = n; save(KEY.active, active); }
      else { settings.rest = n; save(KEY.settings, settings); }
      startTimer(n);
    }));
}

// timer controls (bound once)
document.getElementById('timer-minus').addEventListener('click', () => adjustTimer(-15));
document.getElementById('timer-plus').addEventListener('click', () => adjustTimer(15));
document.getElementById('timer-pause').addEventListener('click', togglePause);
document.getElementById('timer-skip').addEventListener('click', closeTimer);
document.querySelector('[data-close-timer]').addEventListener('click', closeTimer);

/* ---- Sound (Web Audio, generated on the fly — no files, works offline) ---- */
let audioCtx = null;
function unlockAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { /* no audio available */ }
}
// One shaped tone. `type` 'sine' is smooth; 'square' is a sharper tick.
function tone(freq, start, dur, peak = 0.3, type = 'sine') {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  o.connect(g); g.connect(audioCtx.destination);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.start(start); o.stop(start + dur + 0.03);
}
// Run an audio routine, resuming the context first. Playing music in another
// app can leave the page's AudioContext suspended/interrupted, so we always
// resume and only schedule the tones once it's actually running.
function withAudio(cb) {
  if (!settings.sound) return;
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch { return; }
  }
  const run = () => { try { cb(audioCtx.currentTime); } catch { /* ignore */ } };
  if (audioCtx.state === 'suspended') audioCtx.resume().then(run).catch(run);
  else run();
}
// Soft cue when a rest begins.
function soundStart() { withAudio((t) => tone(523, t, 0.14, 0.18)); }
// Short blip for the final 3-2-1 countdown seconds.
function soundTick() { withAudio((t) => tone(760, t, 0.07, 0.26, 'square')); }
// Ascending 3-note chime when the rest ends (a bit louder to cut through music).
function soundFinish() {
  withAudio((t) => {
    tone(659, t, 0.18, 0.5);
    tone(880, t + 0.19, 0.18, 0.55);
    tone(1175, t + 0.38, 0.42, 0.6);
  });
}
// Two-note preview used when toggling sound on in settings.
function soundPreview() { withAudio((t) => { tone(660, t, 0.12, 0.34); tone(990, t + 0.15, 0.16, 0.36); }); }
// Gentle descending two-note cue for hydration reminders (distinct from rest).
function soundHydration() { withAudio((t) => { tone(988, t, 0.16, 0.34); tone(659, t + 0.18, 0.24, 0.34); }); }
function vibrate(pattern) {
  if (settings.vibrate && navigator.vibrate) { try { navigator.vibrate(pattern); } catch {} }
}

/* ---- Screen wake lock (best effort — keeps screen on during rest) ---- */
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) timer.wakeLock = await navigator.wakeLock.request('screen');
  } catch { /* not supported / denied */ }
}
function releaseWakeLock() {
  try { if (timer.wakeLock) { timer.wakeLock.release(); timer.wakeLock = null; } } catch {}
}

/* ================================================================== *
 * SETTINGS
 * ================================================================== */
function openSettings() {
  const app = document.getElementById('app');
  const prevScroll = window.scrollY;
  app.innerHTML = `
    <header class="app-header">
      <button class="icon-btn" data-back aria-label="Back">‹</button>
      <div class="wk-head" style="flex:1"><div class="wk-title">Settings</div></div>
    </header>

    <div class="section-title">Rest timer</div>
    <div class="stat" style="padding:4px 16px">
      <div class="settings-row">
        <div><div class="sr-label">Default rest</div><div class="sr-sub">Auto-starts when you complete a set</div></div>
        <input class="mini-input" id="set-rest" type="number" inputmode="numeric" value="${settings.rest}" />
      </div>
      <div class="settings-row">
        <div><div class="sr-label">Timer sounds</div><div class="sr-sub">Start cue, 3·2·1 countdown &amp; finish chime</div></div>
        <button class="toggle ${settings.sound ? 'on' : ''}" id="set-sound" role="switch" aria-checked="${settings.sound}"></button>
      </div>
      <div class="settings-row">
        <div><div class="sr-label">Vibrate when rest ends</div><div class="sr-sub">Android / supported devices</div></div>
        <button class="toggle ${settings.vibrate ? 'on' : ''}" id="set-vibe" role="switch" aria-checked="${settings.vibrate}"></button>
      </div>
    </div>

    <div class="section-title">Hydration</div>
    <div class="stat" style="padding:4px 16px">
      <div class="settings-row">
        <div><div class="sr-label">Water reminders</div><div class="sr-sub">Nudge you to drink during a workout</div></div>
        <button class="toggle ${settings.hydration ? 'on' : ''}" id="set-hydration" role="switch" aria-checked="${settings.hydration}"></button>
      </div>
      <div class="settings-row">
        <div><div class="sr-label">Remind every</div><div class="sr-sub">Minutes between reminders</div></div>
        <input class="mini-input" id="set-hydration-min" type="number" inputmode="numeric" value="${settings.hydrationMin}" />
      </div>
    </div>

    <div class="section-title">Units</div>
    <div class="stat" style="padding:4px 16px">
      <div class="settings-row">
        <div><div class="sr-label">Weight unit</div></div>
        <div class="rest-chips">
          <button class="chip ${settings.unit === 'kg' ? 'active' : ''}" data-unit="kg">kg</button>
          <button class="chip ${settings.unit === 'lb' ? 'active' : ''}" data-unit="lb">lb</button>
        </div>
      </div>
    </div>

    <div class="section-title">Data</div>
    <div class="stat" style="padding:4px 16px">
      <div class="settings-row">
        <div><div class="sr-label">Export data</div><div class="sr-sub">Download your history as JSON</div></div>
        <button class="btn btn-ghost" id="set-export">Export</button>
      </div>
      <div class="settings-row">
        <div><div class="sr-label">Reset everything</div><div class="sr-sub">Clears all logged workouts</div></div>
        <button class="btn btn-danger" id="set-reset">Reset</button>
      </div>
    </div>

    <p class="center muted mt16" style="font-size:12px">Lift Tracker · v7 · data stored on this device</p>
  `;

  $('[data-back]').addEventListener('click', () => { renderHome(); window.scrollTo(0, prevScroll); });

  $('#set-rest').addEventListener('change', (e) => {
    settings.rest = Math.max(5, Math.min(900, Math.round(num(e.target.value)) || 90));
    e.target.value = settings.rest;
    save(KEY.settings, settings);
  });
  $('#set-sound').addEventListener('click', (e) => {
    settings.sound = !settings.sound; e.target.classList.toggle('on', settings.sound);
    save(KEY.settings, settings); if (settings.sound) soundPreview();
  });
  $('#set-vibe').addEventListener('click', (e) => {
    settings.vibrate = !settings.vibrate; e.target.classList.toggle('on', settings.vibrate);
    save(KEY.settings, settings); if (settings.vibrate) vibrate(80);
  });
  $('#set-hydration').addEventListener('click', (e) => {
    settings.hydration = !settings.hydration; e.target.classList.toggle('on', settings.hydration);
    save(KEY.settings, settings); if (settings.hydration) unlockAudio();
  });
  $('#set-hydration-min').addEventListener('change', (e) => {
    settings.hydrationMin = Math.max(1, Math.min(120, Math.round(num(e.target.value)) || 15));
    e.target.value = settings.hydrationMin;
    save(KEY.settings, settings);
  });
  document.querySelectorAll('[data-unit]').forEach((b) =>
    b.addEventListener('click', () => {
      settings.unit = b.dataset.unit; save(KEY.settings, settings); openSettings();
    }));
  $('#set-export').addEventListener('click', exportData);
  $('#set-reset').addEventListener('click', () => {
    if (!confirm('Delete ALL workout history and settings? This cannot be undone.')) return;
    if (!confirm('Really reset everything?')) return;
    [KEY.history, KEY.active, KEY.last, KEY.settings, KEY.plan, KEY.warmup].forEach((k) => localStorage.removeItem(k));
    settings = Object.assign({}, DEFAULT_SETTINGS);
    history = []; last = {}; active = null; userPlan = seedPlan();
    toast('All data cleared');
    renderHome();
  });
}

function exportData() {
  const blob = new Blob([JSON.stringify({ history, last, settings, plan: userPlan, exportedAt: new Date().toISOString() }, null, 2)],
    { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lift-tracker-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Exported');
}

/* ================================================================== *
 * Boot
 * ================================================================== */
const LOGO_SVG = `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="1" y="9" width="3" height="6" rx="1" fill="#2dd4a7"/>
  <rect x="20" y="9" width="3" height="6" rx="1" fill="#2dd4a7"/>
  <rect x="4" y="7" width="3" height="10" rx="1" fill="#2dd4a7"/>
  <rect x="17" y="7" width="3" height="10" rx="1" fill="#2dd4a7"/>
  <rect x="7" y="11" width="10" height="2" rx="1" fill="#2dd4a7"/>
</svg>`;

// Restore mid-workout on reload if the user was in one.
if (active) renderWorkout(); else renderHome();

// Unlock the audio context on the first tap so the timer can make sound later
// (iOS Safari blocks audio that didn't originate from a user gesture).
window.addEventListener('pointerdown', () => unlockAudio(), { once: true });

// When the user returns to the app during a rest, refresh the count instantly
// (in case throttling let it drift) and re-acquire the wake lock.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    unlockAudio();   // recover audio if a music app suspended our context
    if (!timerSheet.hidden && !timer.paused && !timer.done) {
      requestWakeLock();
      tick();
    }
  }
});

// Register service worker for offline use (ignored on file://).
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
