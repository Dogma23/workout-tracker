/* =========================================================================
   sync.js — optional cloud backup & sync (Supabase), local-first.

   The app keeps reading/writing localStorage exactly as before (instant and
   offline). When the user is signed in, this module quietly:
     1. PUSHES records that changed since the last sync, then
     2. PULLS anything changed on the server since the last pull,
   merging per record: the newer edit wins (a server-side guard also stops an
   older copy overwriting a newer one). Deletions travel as tombstones.

   Synced per profile: the profile itself (+ settings), the plan, finished
   workout sessions, and last-used weights. The in-progress workout stays local.

   Talks to Supabase's standard REST endpoints with fetch — no SDK needed.
   Loaded BEFORE app.js; it only touches app state inside functions that run
   later, so the load order is safe.
   ========================================================================= */

// Fill these in from Supabase → Project Settings → API. Both are public by
// design (row-level security protects the data). NEVER put the service_role
// key here.
const SUPABASE_URL = 'https://ylbowvhgtzzyrudwmeby.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsYm93dmhndHp6eXJ1ZHdtZWJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0MDk0NjgsImV4cCI6MjEwNTk4NTQ2OH0.2RPLTC6dfxgxXvTpvhXBMrqAljoAguIaTdWrhn34Yvw';

const Cloud = (() => {
  const AUTH_KEY = 'wt_cloud_auth';     // { access_token, refresh_token, expires_at, user:{id,email} }
  const STATE_KEY = 'wt_cloud_state';   // { userId, cursor:{table:iso}, shadow:{recKey:hash}, touched:{pid:{kind:ms}}, lastSync, firstSyncDone }
  const TABLES = ['profiles', 'plans', 'sessions', 'last_used'];
  const PAGE = 1000;
  const CHUNK = 100;

  const configured = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);
  const read = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const auth = () => read(AUTH_KEY, null);
  const state = () => Object.assign({ userId: null, cursor: {}, shadow: {}, touched: {}, lastSync: 0, firstSyncDone: false }, read(STATE_KEY, {}));
  const setState = (s) => write(STATE_KEY, s);

  let status = 'idle';           // idle | syncing | error | offline
  let lastError = '';
  let running = null;            // in-flight sync promise
  let timer = 0;
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } });

  // Cheap stable hash of a JSON value (change detection only).
  function hash(v) {
    const s = JSON.stringify(v === undefined ? null : v);
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36) + ':' + s.length;
  }

  // ---------------------------------------------------------------- HTTP --
  async function http(path, { method = 'GET', body, token, prefer, query = '' } = {}) {
    const headers = { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (prefer) headers.Prefer = prefer;
    const res = await fetch(`${SUPABASE_URL}${path}${query}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    if (!res.ok) {
      const msg = (json && (json.error_description || json.msg || json.message || json.error)) || `Request failed (${res.status})`;
      const err = new Error(msg); err.status = res.status; err.code = json && (json.error_code || json.code); throw err;
    }
    return json;
  }

  // ---------------------------------------------------------------- AUTH --
  const siteUrl = () => location.origin + location.pathname.replace(/[^/]*$/, '');

  function saveSession(j) {
    if (!j || !j.access_token) return null;
    const a = {
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600),
      user: { id: j.user && j.user.id, email: j.user && j.user.email },
    };
    write(AUTH_KEY, a);
    return a;
  }

  async function token() {
    const a = auth();
    if (!a) return null;
    if (a.expires_at - 60 > Date.now() / 1000) return a.access_token;
    const j = await http('/auth/v1/token', { method: 'POST', query: '?grant_type=refresh_token', body: { refresh_token: a.refresh_token } });
    return saveSession(j).access_token;
  }

  async function signUp(email, password) {
    const j = await http('/auth/v1/signup', { method: 'POST', query: `?redirect_to=${encodeURIComponent(siteUrl())}`, body: { email, password } });
    // If email confirmation is on (recommended), there's no session yet.
    if (j && j.access_token) { saveSession(j); onSignedIn(); return { signedIn: true }; }
    return { signedIn: false, needsConfirm: true };
  }

  async function signIn(email, password) {
    const j = await http('/auth/v1/token', { method: 'POST', query: '?grant_type=password', body: { email, password } });
    saveSession(j);
    onSignedIn();
    return true;
  }

  async function resetPassword(email) {
    await http('/auth/v1/recover', { method: 'POST', query: `?redirect_to=${encodeURIComponent(siteUrl())}`, body: { email } });
  }

  // Used by the password-reset page (opened from the email link, in Safari).
  async function setNewPassword(accessToken, password) {
    await http('/auth/v1/user', { method: 'PUT', token: accessToken, body: { password } });
  }

  async function signOut() {
    const a = auth();
    try { if (a) await http('/auth/v1/logout', { method: 'POST', token: a.access_token }); } catch (e) { /* ignore */ }
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(STATE_KEY);   // local data stays; next sign-in re-merges
    status = 'idle'; emit();
  }

  async function deleteAccount() {
    const t = await token();
    await http('/rest/v1/rpc/delete_my_account', { method: 'POST', token: t, body: {} });
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(STATE_KEY);
    status = 'idle'; emit();
  }

  function onSignedIn() {
    const a = auth();
    const s = state();
    if (s.userId !== (a && a.user.id)) setState({ userId: a && a.user.id, cursor: {}, shadow: {}, touched: {}, lastSync: 0, firstSyncDone: false });
    emit();
    syncNow();
  }

  // ----------------------------------------------------- LOCAL ADAPTER ----
  // Snapshot of every local record we sync, keyed "table:id".
  function localRecords() {
    const out = {};
    profiles.list.forEach((p) => {
      const k = keysFor(p.id);
      out[`profiles:${p.id}`] = { table: 'profiles', id: p.id, pid: p.id, kind: 'profile', data: Object.assign({}, p, { settings: load(k.settings, {}) }) };
      const plan = load(k.plan, null);
      if (plan) out[`plans:${p.id}`] = { table: 'plans', id: p.id, pid: p.id, kind: 'plan', data: plan };
      const lu = load(k.last, null);
      if (lu) out[`last_used:${p.id}`] = { table: 'last_used', id: p.id, pid: p.id, kind: 'last', data: lu };
      load(k.history, []).forEach((h) => {
        if (h && h.id) out[`sessions:${h.id}`] = { table: 'sessions', id: h.id, pid: p.id, kind: 'history', data: h };
      });
    });
    return out;
  }

  // Called by the app's save() so we know WHEN something was edited.
  function touched(key) {
    if (!auth()) return;
    const m = /^wt_(.+)_(settings|history|last|plan)$/.exec(key || '');
    if (!m) {
      // The in-progress workout / warm-up rotation aren't synced — don't
      // trigger network traffic on every set tick.
      if (key === 'wt_profiles') { markAll('profile'); schedule(); }
      return;
    }
    const s = state();
    (s.touched[m[1]] = s.touched[m[1]] || {})[m[2] === 'settings' ? 'profile' : m[2]] = Date.now();
    setState(s);
    schedule();
  }
  function markAll(kind) {
    const s = state();
    profiles.list.forEach((p) => { (s.touched[p.id] = s.touched[p.id] || {})[kind] = Date.now(); });
    setState(s);
  }
  const editTime = (s, pid, kind) => (s.touched[pid] && s.touched[pid][kind]) || 0;

  // --------------------------------------------------------------- PUSH ---
  async function push(t, s) {
    const uid = auth().user.id;
    const recs = localRecords();
    const rows = { profiles: [], plans: [], sessions: [], last_used: [] };
    const now = Date.now();

    Object.entries(recs).forEach(([key, r]) => {
      const h = hash(r.data);
      if (s.shadow[key] === h) return;                         // unchanged since last sync
      const ms = editTime(s, r.pid, r.kind) || now;
      const base = { user_id: uid, data: r.data, updated_ms: ms, deleted: false };
      if (r.table === 'profiles') rows.profiles.push(Object.assign({ id: r.id }, base));
      else if (r.table === 'sessions') rows.sessions.push(Object.assign({ id: r.id, profile_id: r.pid }, base));
      else rows[r.table].push(Object.assign({ profile_id: r.id }, base));
      s.shadow[key] = h;
    });

    // Tombstones: records we synced before that no longer exist locally.
    Object.keys(s.shadow).forEach((key) => {
      if (recs[key]) return;
      const [table, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
      const tomb = { user_id: uid, data: {}, updated_ms: now, deleted: true };
      if (table === 'profiles') rows.profiles.push(Object.assign({ id }, tomb));
      else if (table === 'sessions') rows.sessions.push(Object.assign({ id, profile_id: '' }, tomb));
      else rows[table].push(Object.assign({ profile_id: id }, tomb));
      delete s.shadow[key];
    });

    const conflict = { profiles: 'user_id,id', sessions: 'user_id,id', plans: 'user_id,profile_id', last_used: 'user_id,profile_id' };
    for (const table of TABLES) {
      const list = rows[table];
      for (let i = 0; i < list.length; i += CHUNK) {
        await http(`/rest/v1/${table}`, {
          method: 'POST', token: t, query: `?on_conflict=${conflict[table]}`,
          prefer: 'resolution=merge-duplicates,return=minimal', body: list.slice(i, i + CHUNK),
        });
      }
    }
  }

  // --------------------------------------------------------------- PULL ---
  async function pullTable(t, s, table) {
    const all = [];
    let cursor = s.cursor[table] || '1970-01-01T00:00:00Z';
    for (;;) {
      const page = await http(`/rest/v1/${table}`, {
        token: t,
        query: `?select=*&server_updated_at=gte.${encodeURIComponent(cursor)}&order=server_updated_at.asc&limit=${PAGE}`,
      });
      all.push(...page);
      if (page.length < PAGE) break;
      const next = page[page.length - 1].server_updated_at;
      if (next === cursor) break;
      cursor = next;
    }
    if (all.length) s.cursor[table] = all[all.length - 1].server_updated_at;
    return all;
  }

  // Should a remote copy replace the local one?
  function remoteWins(s, key, localData, pid, kind, remote, firstSync) {
    if (localData === undefined) return true;                  // don't have it locally
    if (firstSync) return true;                                // first sync on this device: the cloud copy is the established one
    if (s.shadow[key] === hash(localData)) return true;        // local unchanged since sync
    return remote.updated_ms >= editTime(s, pid, kind);        // both changed: newer wins
  }

  function applyPulled(s, pulled, firstSync) {
    let changed = false;
    const recs = localRecords();

    // Profiles first (plans/sessions may belong to a profile new to this device).
    pulled.profiles.forEach((r) => {
      const key = `profiles:${r.id}`;
      const idx = profiles.list.findIndex((p) => p.id === r.id);
      if (r.deleted) {
        if (idx >= 0 && profiles.list.length > 1) {
          const k = keysFor(r.id);
          Object.values(k).forEach((kk) => localStorage.removeItem(kk));
          profiles.list.splice(idx, 1);
          if (profiles.currentId === r.id) profiles.currentId = profiles.list[0].id;
          changed = true;
        }
        delete s.shadow[key];
        return;
      }
      if (!remoteWins(s, key, recs[key] && recs[key].data, r.id, 'profile', r, firstSync)) return;
      const { settings, ...profile } = r.data || {};
      if (idx >= 0) profiles.list[idx] = Object.assign({}, profiles.list[idx], profile, { id: r.id });
      else profiles.list.push(Object.assign({}, profile, { id: r.id }));
      if (settings) localStorage.setItem(keysFor(r.id).settings, JSON.stringify(settings));
      s.shadow[key] = hash(Object.assign({}, profiles.list[idx >= 0 ? idx : profiles.list.length - 1], { settings: settings || {} }));
      changed = true;
    });
    if (pulled.profiles.length) localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));

    [['plans', 'plan', 'plan'], ['last_used', 'last', 'last']].forEach(([table, keyName, kind]) => {
      pulled[table].forEach((r) => {
        const key = `${table}:${r.profile_id}`;
        if (!profiles.list.some((p) => p.id === r.profile_id)) return;
        if (r.deleted) { delete s.shadow[key]; return; }
        if (!remoteWins(s, key, recs[key] && recs[key].data, r.profile_id, kind, r, firstSync)) return;
        localStorage.setItem(keysFor(r.profile_id)[keyName], JSON.stringify(r.data));
        s.shadow[key] = hash(r.data);
        changed = true;
      });
    });

    // Sessions: group by profile, then merge into each history list.
    const byProfile = {};
    pulled.sessions.forEach((r) => { (byProfile[r.profile_id || '?'] = byProfile[r.profile_id || '?'] || []).push(r); });
    // Tombstones may carry an empty profile id: look the session up locally.
    Object.entries(recs).forEach(([key, rec]) => {
      if (rec.table !== 'sessions') return;
      const t = (byProfile['?'] || []).find((r) => r.id === rec.id);
      if (t) (byProfile[rec.pid] = byProfile[rec.pid] || []).push(t);
    });
    delete byProfile['?'];
    Object.entries(byProfile).forEach(([pid, rows]) => {
      if (!profiles.list.some((p) => p.id === pid)) return;
      const k = keysFor(pid);
      let hist = load(k.history, []);
      let dirty = false;
      rows.forEach((r) => {
        const key = `sessions:${r.id}`;
        const i = hist.findIndex((h) => h.id === r.id);
        if (r.deleted) {
          if (i >= 0 && (s.shadow[key] === hash(hist[i]) || r.updated_ms >= editTime(s, pid, 'history'))) { hist.splice(i, 1); dirty = true; }
          delete s.shadow[key];
          return;
        }
        if (!remoteWins(s, key, i >= 0 ? hist[i] : undefined, pid, 'history', r, firstSync)) return;
        if (i >= 0) hist[i] = r.data; else hist.push(r.data);
        s.shadow[key] = hash(r.data);
        dirty = true;
      });
      if (dirty) {
        hist.sort((a, b) => (b.date || 0) - (a.date || 0));
        localStorage.setItem(k.history, JSON.stringify(hist));
        changed = true;
      }
    });
    return changed;
  }

  // First sync on a device that already has ONE local profile, while the
  // account already has profiles (e.g. a new phone / reinstalled icon):
  // fold the local profile into the account's first profile instead of
  // creating a duplicate "Me". Workouts from both sides are kept.
  function adoptRemoteProfile(remoteProfiles) {
    const live = remoteProfiles.filter((r) => !r.deleted);
    if (profiles.list.length !== 1 || !live.length) return;
    const local = profiles.list[0];
    const target = live[0];
    if (local.id === target.id) return;
    const from = keysFor(local.id), to = keysFor(target.id);
    ['history', 'last', 'plan', 'settings', 'active', 'warmup'].forEach((kk) => {
      const v = localStorage.getItem(from[kk]);
      if (v != null && localStorage.getItem(to[kk]) == null) localStorage.setItem(to[kk], v);
      localStorage.removeItem(from[kk]);
    });
    local.id = target.id;
    profiles.currentId = target.id;
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  }

  // --------------------------------------------------------------- SYNC ---
  async function doSync() {
    if (!configured() || !auth()) return;
    if (!navigator.onLine) { status = 'offline'; emit(); return; }
    status = 'syncing'; lastError = ''; emit();
    try {
      const t = await token();
      let s = state();

      let changed = false;
      const pullAll = async () => {
        const pulled = {};
        for (const table of TABLES) pulled[table] = await pullTable(t, s, table);
        return pulled;
      };

      if (!s.firstSyncDone) {
        // FIRST sync on this device: bring the cloud copy down first so a fresh
        // phone's default plan/settings can't overwrite the real ones; then
        // upload only what's new here (e.g. workouts logged before signing in).
        const remoteProfiles = await pullTable(t, { cursor: {} }, 'profiles');
        adoptRemoteProfile(remoteProfiles);
        changed = applyPulled(s, await pullAll(), true) || remoteProfiles.length > 0;
        setState(s);
        await push(t, s);
        setState(s);
      } else {
        // Normal sync: push local edits (the server rejects anything older
        // than its copy), then pull everything changed elsewhere.
        await push(t, s);
        setState(s);
        changed = applyPulled(s, await pullAll(), false);
      }

      s.lastSync = Date.now();
      s.firstSyncDone = true;
      setState(s);
      status = 'idle';
      if (changed && typeof onRemoteChange === 'function') onRemoteChange();
    } catch (e) {
      status = navigator.onLine ? 'error' : 'offline';
      lastError = e && e.message ? e.message : 'Sync failed';
      if (e && e.status === 401) { localStorage.removeItem(AUTH_KEY); lastError = 'Signed out — please sign in again'; }
    }
    emit();
  }

  function syncNow() {
    if (running) return running;
    running = doSync().finally(() => { running = null; });
    return running;
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(syncNow, 3000);
  }

  // App hook: set by app.js to refresh state + screen after a pull changed data.
  let onRemoteChange = null;

  function init(onChange) {
    onRemoteChange = onChange;
    if (!configured()) return;
    window.addEventListener('online', syncNow);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
    if (auth()) syncNow();
  }

  return {
    configured, init, touched, syncNow, signUp, signIn, signOut, resetPassword, setNewPassword, deleteAccount,
    user: () => (auth() ? auth().user : null),
    status: () => status, lastError: () => lastError, lastSync: () => state().lastSync,
    onStatus: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
  };
})();
