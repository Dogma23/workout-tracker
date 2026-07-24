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
};

const load = (k, fallback) => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
};
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

/* ------------------------------------------------------------------ *
 * App state
 * ------------------------------------------------------------------ */
const DEFAULT_SETTINGS = { rest: 90, sound: true, vibrate: true, unit: 'kg' };

let settings = Object.assign({}, DEFAULT_SETTINGS, load(KEY.settings, {}));
let history = load(KEY.history, []);
let last = load(KEY.last, {});
let active = load(KEY.active, null);   // in-progress session or null

const REST_PRESETS = [30, 45, 60, 90, 120, 180];

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

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

let toastTimer;
function toast(msg) {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
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

  // Streak = consecutive calendar days (counting back from today/yesterday) with a workout.
  const days = new Set(history.map((h) => new Date(h.date).toDateString()));
  let streak = 0;
  const cur = new Date();
  // allow today OR yesterday to seed the streak
  if (!days.has(cur.toDateString())) cur.setDate(cur.getDate() - 1);
  while (days.has(cur.toDateString())) { streak++; cur.setDate(cur.getDate() - 1); }

  return { total, thisWeek, totalVol, streak };
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

/* ================================================================== *
 * VIEW: Home / Dashboard
 * ================================================================== */
function renderHome() {
  const s = stats();
  const bests = personalBests();
  const bestNames = Object.keys(bests);

  const resumeHtml = active ? `
    <div class="resume">
      <div>
        <div class="r-title">Workout in progress</div>
        <div class="r-sub">${escapeHtml(PLAN[active.dayId].name)} · started ${fmtDate(active.startedAt)}</div>
      </div>
      <button class="btn" data-resume>Resume</button>
    </div>` : '';

  const dayCards = PLAN_ORDER.map((id) => {
    const d = PLAN[id];
    return `
      <button class="day-card" data-start="${id}">
        <span class="badge">${escapeHtml(d.name[0])}</span>
        <span>
          <div class="dc-name">${escapeHtml(d.name)}</div>
          <div class="dc-sub">${escapeHtml(d.subtitle)}</div>
          <div class="dc-meta">${d.day} · ${d.exercises.length} exercises</div>
        </span>
        <span class="chev">›</span>
      </button>`;
  }).join('');

  const recent = history.slice(0, 5).map((h) => `
    <div class="hist-item">
      <div>
        <div class="h-day">${escapeHtml(PLAN[h.dayId] ? PLAN[h.dayId].name : h.dayName || 'Workout')}</div>
        <div class="h-date">${fmtDate(h.date)}${h.durationSec ? ' · ' + Math.round(h.durationSec / 60) + ' min' : ''}</div>
      </div>
      <div class="h-vol">
        <div class="v">${fmtVol(h.volume != null ? h.volume : sessionVolume(h))} ${settings.unit}</div>
        <div class="l">volume</div>
      </div>
    </div>`).join('');

  const bestsHtml = bestNames.length ? bestNames.map((n) => `
      <div class="pb-row">
        <span class="pb-name">${escapeHtml(n)}</span>
        <span class="pb-val">${bests[n].weight} <small>${settings.unit} × ${escapeHtml(String(bests[n].reps || '—'))}</small></span>
      </div>`).join('') : '';

  document.getElementById('app').innerHTML = `
    <header class="app-header">
      <h1><span class="logo">${LOGO_SVG}</span> Lift Tracker</h1>
      <div class="header-actions">
        <button class="icon-btn" data-settings aria-label="Settings">⚙</button>
      </div>
    </header>

    ${resumeHtml}

    <div class="stat-grid">
      <div class="stat accent"><div class="num">${s.total}</div><div class="lbl">Workouts</div></div>
      <div class="stat"><div class="num">${s.thisWeek}</div><div class="lbl">This week</div></div>
      <div class="stat blue"><div class="num">${s.streak}</div><div class="lbl">Day streak</div></div>
      <div class="stat"><div class="num">${fmtVol(s.totalVol)}</div><div class="lbl">Total ${settings.unit} lifted</div></div>
    </div>

    <div class="section-title">Start a workout</div>
    ${dayCards}

    <div class="section-title">Recent sessions</div>
    ${recent || '<div class="empty">No workouts logged yet. Pick a day above to start.</div>'}

    ${bestNames.length ? `<div class="section-title">Personal bests</div><div class="stat" style="padding:6px 16px">${bestsHtml}</div>` : ''}

    <p class="center muted mt16" style="font-size:12px">Data is saved on this device only.</p>
  `;

  // wire up
  $('[data-settings]').addEventListener('click', openSettings);
  document.querySelectorAll('[data-start]').forEach((b) =>
    b.addEventListener('click', () => startWorkout(b.dataset.start)));
  const resumeBtn = $('[data-resume]');
  if (resumeBtn) resumeBtn.addEventListener('click', () => renderWorkout());
}

/* ================================================================== *
 * Start / build a workout session
 * ================================================================== */
function startWorkout(dayId) {
  if (active && active.dayId !== dayId) {
    if (!confirm('You have an unfinished workout. Discard it and start a new one?')) return;
  }
  const day = PLAN[dayId];
  active = {
    id: uid(),
    dayId,
    dayName: day.name,
    startedAt: Date.now(),
    rest: settings.rest,
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

  const day = PLAN[active.dayId];

  const restChips = [60, 90, 120, 180].map((n) =>
    `<button class="chip ${active.rest === n ? 'active' : ''}" data-rest="${n}">${n}s</button>`
  ).join('') + `<button class="chip ${!REST_PRESETS.includes(active.rest) && active.rest ? 'active' : ''}" data-rest-custom>${!REST_PRESETS.includes(active.rest) ? active.rest + 's' : '···'}</button>`;

  const warmup = `
    <details class="warmup">
      <summary><span class="wu-i">▲</span> Warm-up · 5 min <span style="margin-left:auto;color:var(--text-faint);font-size:12px;font-weight:500">tap to expand</span></summary>
      <ol>${WARMUP.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ol>
    </details>`;

  const exBlocks = active.exercises.map((ex, ei) => {
    const allDone = ex.sets.every((s) => s.done);
    const isTime = ex.tracks === 'time';
    const hideWeight = ex.tracks === 'bodyweight';
    const repsLabel = isTime ? 'Secs/Reps' : 'Reps';
    const prev = last[ex.name];

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
        <div class="set-head"><span>#</span><span>${hideWeight ? 'Load' : 'Weight'}</span><span>${repsLabel}</span><span>✓</span></div>
        <div class="sets" data-sets="${ei}">
          ${rows}
          <button class="add-set" data-addset="${ei}">+ Add set</button>
        </div>
        ${prev ? `<div class="last-hint">Last time: <b>${prev.weight || 'BW'} ${prev.weight ? settings.unit : ''}</b>${prev.reps ? ' × ' + escapeHtml(String(prev.reps)) : ''}</div>` : ''}
      </div>`;
  }).join('');

  document.getElementById('app').innerHTML = `
    <header class="app-header">
      <button class="icon-btn" data-back aria-label="Back">‹</button>
      <div class="wk-head" style="flex:1;flex-direction:column;align-items:flex-start;gap:0">
        <div class="wk-title">${escapeHtml(day.name)}</div>
        <div class="wk-sub">${day.day} · ${escapeHtml(day.subtitle)}</div>
      </div>
    </header>

    <div class="wk-timerbar">
      <div class="tb-label">Rest timer<br><b>${active.rest}s</b> between sets</div>
      <div class="rest-chips">${restChips}</div>
    </div>

    ${warmup}
    ${exBlocks}

    <div class="finish-bar">
      <button class="btn btn-ghost" data-discard style="flex:0 0 auto">Discard</button>
      <button class="btn btn-block btn-lg" data-finish>Finish workout</button>
    </div>
  `;

  wireWorkout();
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
  toast(`Saved · ${fmtVol(session.volume)} ${settings.unit} lifted 💪`);
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
 * REST TIMER
 * ================================================================== */
const timerSheet = document.getElementById('timer-sheet');
const timerCount = document.getElementById('timer-count');
const ringProgress = document.getElementById('ring-progress');
const RING_LEN = 2 * Math.PI * 54; // circumference

let timer = { endAt: 0, total: 0, remaining: 0, interval: 0, paused: false, done: false, wakeLock: null };

function startTimer(seconds) {
  timer.total = seconds;
  timer.remaining = seconds;
  timer.endAt = Date.now() + seconds * 1000;
  timer.paused = false;
  timer.done = false;
  buildTimerPresets();
  timerSheet.hidden = false;
  timerCount.classList.remove('done');
  const pb = $('#timer-pause');
  pb.textContent = 'Pause';
  pb.classList.remove('paused');
  requestWakeLock();
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

  if (remain <= 0) onTimerDone();
}

function onTimerDone() {
  if (timer.done) return;      // guard: interval keeps firing, only finish once
  timer.done = true;
  clearInterval(timer.interval);
  timerCount.textContent = 'Go!';
  timerCount.classList.add('done');
  ringProgress.style.strokeDashoffset = RING_LEN;
  beep(3);
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
      active.rest = n; save(KEY.active, active);
      startTimer(n);
    }));
}

// timer controls (bound once)
document.getElementById('timer-minus').addEventListener('click', () => adjustTimer(-15));
document.getElementById('timer-plus').addEventListener('click', () => adjustTimer(15));
document.getElementById('timer-pause').addEventListener('click', togglePause);
document.getElementById('timer-skip').addEventListener('click', closeTimer);
document.querySelector('[data-close-timer]').addEventListener('click', closeTimer);

/* ---- Sound (Web Audio, generated — no files, works offline) ---- */
let audioCtx = null;
function unlockAudio() {
  if (!settings.sound) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { /* no audio available */ }
}
function beep(times = 3) {
  if (!settings.sound || !audioCtx) return;
  try {
    let t = audioCtx.currentTime;
    for (let i = 0; i < times; i++) {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.value = i === times - 1 ? 1175 : 880; // last beep higher
      o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.start(t); o.stop(t + 0.24);
      t += 0.3;
    }
  } catch { /* ignore */ }
}
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
        <div><div class="sr-label">Beep when rest ends</div><div class="sr-sub">Generated tone, no download</div></div>
        <button class="toggle ${settings.sound ? 'on' : ''}" id="set-sound" role="switch" aria-checked="${settings.sound}"></button>
      </div>
      <div class="settings-row">
        <div><div class="sr-label">Vibrate when rest ends</div><div class="sr-sub">Android / supported devices</div></div>
        <button class="toggle ${settings.vibrate ? 'on' : ''}" id="set-vibe" role="switch" aria-checked="${settings.vibrate}"></button>
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

    <p class="center muted mt16" style="font-size:12px">Lift Tracker · v1 · data stored on this device</p>
  `;

  $('[data-back]').addEventListener('click', () => { renderHome(); window.scrollTo(0, prevScroll); });

  $('#set-rest').addEventListener('change', (e) => {
    settings.rest = Math.max(5, Math.min(900, Math.round(num(e.target.value)) || 90));
    e.target.value = settings.rest;
    save(KEY.settings, settings);
  });
  $('#set-sound').addEventListener('click', (e) => {
    settings.sound = !settings.sound; e.target.classList.toggle('on', settings.sound);
    save(KEY.settings, settings); if (settings.sound) { unlockAudio(); setTimeout(() => beep(1), 60); }
  });
  $('#set-vibe').addEventListener('click', (e) => {
    settings.vibrate = !settings.vibrate; e.target.classList.toggle('on', settings.vibrate);
    save(KEY.settings, settings); if (settings.vibrate) vibrate(80);
  });
  document.querySelectorAll('[data-unit]').forEach((b) =>
    b.addEventListener('click', () => {
      settings.unit = b.dataset.unit; save(KEY.settings, settings); openSettings();
    }));
  $('#set-export').addEventListener('click', exportData);
  $('#set-reset').addEventListener('click', () => {
    if (!confirm('Delete ALL workout history and settings? This cannot be undone.')) return;
    if (!confirm('Really reset everything?')) return;
    [KEY.history, KEY.active, KEY.last, KEY.settings].forEach((k) => localStorage.removeItem(k));
    settings = Object.assign({}, DEFAULT_SETTINGS);
    history = []; last = {}; active = null;
    toast('All data cleared');
    renderHome();
  });
}

function exportData() {
  const blob = new Blob([JSON.stringify({ history, last, settings, exportedAt: new Date().toISOString() }, null, 2)],
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

// When the user returns to the app during a rest, refresh the count instantly
// (in case throttling let it drift) and re-acquire the wake lock.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !timerSheet.hidden && !timer.paused && !timer.done) {
    requestWakeLock();
    tick();
  }
});

// Register service worker for offline use (ignored on file://).
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
