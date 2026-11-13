// The welcome page displays both aggregates. Each channel has its own writer.
(() => {
  'use strict';
  if (!Module.localFiles) return;
  const beta = {
    origin: 'https://sgmobile-beta.github.io',
    path: '/golf.html',
    url: 'https://sgmobile-beta-usage.sgmobile-fourtempers.workers.dev/totals',
    cacheKey: 'sgmobile-public-beta-usage:beta-1.0-launch:totals',
    field: 'sessions', label: 'SG Mobile Sessions', description: 'Public Beta usage totals'
  };
  const development = {
    origin: 'https://gatn01302601.tail3030bb.ts.net:8443',
    path: '/private/golf.html',
    url: 'https://sgmobile-dev-usage.sgmobile-fourtempers.workers.dev/totals',
    cacheKey: 'sgmobile-dev-usage-v2:totals',
    field: 'opens', label: 'Development Sessions', description: 'Development usage totals'
  };
  const channel = Module.buildInfo.channel;
  const own = { beta, development }[channel];
  if (!own || location.origin !== own.origin || location.pathname !== own.path) return;
  const other = own === beta ? development : beta;
  const number = new Intl.NumberFormat();
  const hoursNumber = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
  let refreshPending = false;
  let otherTotals = cached(other);
  let ownSnapshot = null;

  function valid(value, config) {
    return value && [value[config.field], value.seconds].every(count =>
      Number.isSafeInteger(count) && count >= 0);
  }

  function cached(config) {
    try {
      const value = JSON.parse(localStorage.getItem(config.cacheKey));
      return valid(value, config) ? value : null;
    } catch { return null; }
  }

  function setText(node, value) {
    if (node.textContent !== value) node.textContent = value;
  }

  function update(config, value, current) {
    if (!config.view) return;
    const { sessions, hours, status } = config.view;
    setText(sessions, value ? number.format(value[config.field]) : '—');
    setText(hours, value ? hoursNumber.format(value.seconds / 3600) : '—');
    setText(status, current ? '' : value ? 'Last synced totals' : 'Totals unavailable');
    status.hidden = !status.textContent;
  }

  async function refreshOther() {
    if (refreshPending || document.hidden || navigator.onLine === false) return;
    refreshPending = true;
    try {
      const response = await fetch(other.url, {
        method: 'GET', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
        signal: AbortSignal.timeout?.(5000)
      });
      if (!response.ok) throw Error('Usage totals unavailable');
      const value = await response.json();
      if (!valid(value, other)) throw Error('Invalid usage totals');
      otherTotals = { [other.field]: value[other.field], seconds: value.seconds };
      try { localStorage.setItem(other.cacheKey, JSON.stringify(otherTotals)); } catch {}
      update(other, otherTotals, navigator.onLine !== false);
    } catch {
      update(other, otherTotals, false);
    } finally {
      refreshPending = false;
    }
  }

  Module.updateOwnUsageTotals = (value, current) => {
    ownSnapshot = { value, current };
    update(own, value, current);
  };
  Module.mountUsageTotals = (version, privacy, footer, node) => {
    const style = node('style', `
      #local-install .usage-totals{margin:0 0 18px;color:var(--menu-text)}
      #local-install .usage-totals dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0}
      #local-install .usage-totals dl>div{display:grid;grid-template-rows:1fr auto;gap:5px;padding:10px 6px;
        border:1px solid var(--menu-border);border-radius:14px;background:linear-gradient(#f4f5ff,#e0e5fa)}
      #local-install #public-usage-totals dl>div+div{background:linear-gradient(#fffaf0,#f7ebca)}
      #local-install .usage-totals dt{font-size:13px;font-weight:700;line-height:1.25}
      #local-install .usage-totals dd{margin:0;font-size:clamp(21px,5vw,29px);font-weight:800;
        font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
      #local-install .usage-totals p{margin:7px 0 0}
      #local-install .install-footer .install-privacy{max-width:440px;margin:14px auto 0}
      #local-install #development-usage-totals{max-width:360px;margin:16px auto 0;color:#deebe0}
      #development-usage-totals.usage-totals dl>div{padding:8px 6px;border-color:#d9ece047;
        border-radius:11px;background:#233b31}
      #development-usage-totals.usage-totals dd{font-size:clamp(16px,4vw,22px)}
    `);
    document.head.append(style);

    function panel(config, id) {
      const section = node('section', '');
      section.id = id + '-totals';
      section.className = 'usage-totals';
      section.setAttribute('aria-label', config.description);
      const values = node('dl', '');
      const sessions = node('dd', '—');
      sessions.id = id + '-sessions';
      const hours = node('dd', '—');
      hours.id = id + '-hours';
      for (const [label, value] of [[config.label, sessions], ['Hours Played', hours]]) {
        const item = node('div', '');
        item.append(node('dt', label), value);
        values.append(item);
      }
      const status = node('p', '');
      status.id = id + '-status';
      if (config === beta) status.className = 'minor';
      status.setAttribute('role', 'status');
      section.append(values, status);
      config.view = { sessions, hours, status };
      update(config, cached(config), false);
      return section;
    }

    version.after(panel(beta, 'public-usage'));
    privacy.textContent = 'Game files, saves and careers stay on this device. ' + (own === beta
      ? 'Public Beta reports playable-course sessions and active visible course time. Usage batches include a random receipt ID, build, launch stream and batch start time.'
      : 'Development reports app opens and visible testing and play time. Usage batches include a random receipt ID and build.');
    footer.append(privacy, panel(development, 'development-usage'));
    if (ownSnapshot) update(own, ownSnapshot.value, ownSnapshot.current);

    void refreshOther();
    addEventListener('online', refreshOther);
    addEventListener('pageshow', refreshOther);
    addEventListener('offline', () => update(other, otherTotals, false));
    document.addEventListener('visibilitychange', refreshOther);
    setInterval(refreshOther, 60000);
  };
})();
