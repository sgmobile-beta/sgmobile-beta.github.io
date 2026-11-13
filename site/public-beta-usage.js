// Community totals for the separate public Beta origin and launch epoch.
(() => {
  'use strict';
  const endpoint = document.currentScript?.dataset.endpoint;
  if (!Module.localFiles || location.origin !== 'https://sgmobile-beta.github.io' ||
      location.pathname !== '/golf.html' ||
      endpoint !== 'https://sgmobile-beta-usage.sgmobile-fourtempers.workers.dev' ||
      typeof crypto.randomUUID !== 'function') return;

  const epoch = 'beta-1.0-launch';
  const prefix = 'sgmobile-public-beta-usage:' + epoch + ':';
  const receiptPrefix = prefix + 'receipt:';
  const totalsKey = prefix + 'totals';
  const receiptLifetime = 7 * 86400000;
  const checkpointSeconds = 300;
  const maxSampleGapMs = 2500;
  const fallback = new Map();
  const integerBetween = (value, low, high) => Number.isSafeInteger(value) && value >= low && value <= high;
  const request = (path, options) => fetch(endpoint + path, {
    cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
    signal: AbortSignal.timeout?.(5000), ...options
  });
  let counted = false;
  let pagePresent = true;
  let previouslyActive = false;
  let previousSample = performance.now();
  let milliseconds = 0;
  let startedAt = null;
  let inFlight = null;
  let renderUsage = () => {};

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key)); }
    catch { return null; }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch { return false; }
  }

  function remove(key) {
    try { localStorage.removeItem(key); } catch {}
    fallback.delete(key);
  }

  function validTotals(value) {
    return value && integerBetween(value.sessions, 0, Number.MAX_SAFE_INTEGER) &&
      integerBetween(value.seconds, 0, Number.MAX_SAFE_INTEGER);
  }

  const saved = read(totalsKey);
  let totals = validTotals(saved) ? saved : null;
  let synced = false;

  function outbox() {
    const records = new Map(fallback);
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(receiptPrefix) && !records.has(key)) records.set(key, read(key));
      }
    } catch {}
    const cutoff = Date.now() - receiptLifetime;
    for (const [key, receipt] of records) {
      if (receipt?.epoch === epoch && key === receiptPrefix + receipt.id &&
          integerBetween(receipt.startedAt, cutoff, Number.MAX_SAFE_INTEGER)) continue;
      records.delete(key);
      remove(key);
    }
    return [...records].sort((a, b) => a[1].startedAt - b[1].startedAt);
  }

  function checkpoint(sessions = 0) {
    const seconds = Math.min(checkpointSeconds, Math.floor(milliseconds / 1000));
    if (!sessions && !seconds) return;
    const id = crypto.randomUUID();
    const data = { id, epoch, build: Module.buildInfo.id, startedAt: startedAt ?? Date.now(), sessions, seconds };
    const key = receiptPrefix + id;
    // An independent entry survives browser close and avoids rewriting a shared queue.
    if (!write(key, data)) fallback.set(key, data);
    milliseconds -= seconds * 1000;
    startedAt = milliseconds >= 1000 ? data.startedAt + seconds * 1000 : null;
  }

  async function upload() {
    try {
      for (const [key, receipt] of outbox().slice(0, 10)) {
        const response = await request('/collect', {
          method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(receipt)
        });
        if (response.status === 204 || response.status === 400) remove(key);
        else throw Error('Usage sync unavailable');
      }
      const response = await request('/totals');
      if (!response.ok) throw Error('Usage totals unavailable');
      const latest = await response.json();
      if (!validTotals(latest)) throw Error('Invalid usage totals');
      // An unavailable or prelaunch service cannot start measurement on a new install.
      if (!totals) previousSample = performance.now();
      totals = latest;
      write(totalsKey, totals);
      synced = true;
    } catch {
      synced = false;
    } finally {
      renderUsage();
    }
  }

  function sync() {
    if (inFlight || navigator.onLine === false) return;
    inFlight = (navigator.locks?.request
      ? navigator.locks.request(prefix + 'sync', { ifAvailable: true }, lock => lock && upload())
      : upload()).catch(() => {}).finally(() => { inFlight = null; });
  }

  function sample() {
    const now = performance.now(), elapsed = now - previousSample;
    previousSample = now;
    const state = Module.mobileState;
    const playable = !!(state?.course && Module.mapCourseReady && !Module.atTitle &&
      !Module.courseLoading?.active && !Module.rulesetBlocked);
    const visible = pagePresent && !document.hidden;
    const active = !!(totals && visible && playable && !state.paused && !Module.gameClock?.held);
    if (active && previouslyActive && elapsed > 0 && elapsed <= maxSampleGapMs) {
      startedAt ??= Date.now() - Math.ceil(elapsed);
      milliseconds += elapsed;
    }
    previouslyActive = active;
    if (totals && visible && playable && !counted) {
      counted = true;
      checkpoint(1);
      sync();
    } else if (milliseconds >= checkpointSeconds * 1000) {
      checkpoint();
      sync();
    }
  }

  function flush() {
    sample();
    previouslyActive = false;
    checkpoint();
    sync();
  }

  function node(tag, text, id) {
    const element = document.createElement(tag);
    element.textContent = text;
    if (id) element.id = id;
    return element;
  }

  Module.mountPublicBetaUsage = (version, privacy, footer) => {
    const style = node('style', `
      #public-usage-totals{margin:0 0 18px}
      #public-usage-totals dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0}
      #public-usage-totals dl>div{display:grid;grid-template-rows:1fr auto;gap:5px;padding:10px 6px;
        border:1px solid var(--menu-border);border-radius:14px;background:linear-gradient(#f4f5ff,#e0e5fa)}
      #public-usage-totals dl>div+div{background:linear-gradient(#fffaf0,#f7ebca)}
      #public-usage-totals dt{font-size:13px;font-weight:700;line-height:1.25}
      #public-usage-totals dd{margin:0;font-size:clamp(21px,5vw,29px);font-weight:800;
        font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
      #public-usage-totals #public-usage-status{margin:7px 0 0}
      #local-install .install-footer .install-privacy{max-width:440px;margin:14px auto 0}
    `);
    document.head.append(style);
    const totalsPanel = node('section', '', 'public-usage-totals');
    totalsPanel.setAttribute('aria-label', 'SGMobile Beta usage totals');
    const values = node('dl', '');
    const sessions = node('dd', '—', 'public-usage-sessions');
    const hours = node('dd', '—', 'public-usage-hours');
    for (const [label, value] of [['SG Mobile Sessions', sessions], ['Hours Played', hours]]) {
      const item = node('div', '');
      item.append(node('dt', label), value);
      values.append(item);
    }
    const status = node('p', '', 'public-usage-status');
    status.className = 'minor';
    status.setAttribute('role', 'status');
    totalsPanel.append(values, status);
    version.after(totalsPanel);
    privacy.textContent = 'Game files, saves and careers stay on this device. Public Beta reports playable-course sessions and active visible course time. Usage batches include a random receipt ID, build, launch stream and batch start time.';
    footer.append(privacy);

    const number = new Intl.NumberFormat();
    const hoursNumber = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
    function setText(element, text) {
      if (element.textContent !== text) element.textContent = text;
    }
    renderUsage = () => {
      setText(sessions, totals ? number.format(totals.sessions) : '—');
      setText(hours, totals ? hoursNumber.format(totals.seconds / 3600) : '—');
      setText(status, synced ? '' : totals ? 'Last synced totals' : 'Usage totals are not available yet.');
    };
    renderUsage();
    sync();
  };

  setInterval(sample, 1000);
  setInterval(() => { checkpoint(); sync(); }, 60000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flush();
    else { sample(); sync(); }
  });
  addEventListener('pagehide', () => { pagePresent = false; flush(); });
  addEventListener('pageshow', () => { pagePresent = true; previouslyActive = false; sample(); sync(); });
  addEventListener('online', sync);
  addEventListener('offline', () => { synced = false; renderUsage(); });
})();
