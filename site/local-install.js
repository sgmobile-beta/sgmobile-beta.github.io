// Current mobile shell + user's original files. No original files leave this
// browser; no installation/saves/log network endpoints are used in this mode.
(function () {
  'use strict';
  if (!Module.localFiles) return;
  var base = new URL('./', location.href), realFetch = window.fetch.bind(window);
  var storage = null, gameDirs = new Map(), selected = [], active = null, worker = null;
  var resolveReady, rejectReady, settled = false, starting = false;
  var ready = new Promise(function (resolve, reject) { resolveReady = resolve; rejectReady = reject; });
  // Catch immediately; the runtime attaches its preRun handler after loading.
  ready.catch(function () {});
  Module.localInstall = { phase: 'checking', generation: null, error: '' };
  var css = document.createElement('style');
  // The welcome screen uses local artwork and links directly to Ko-fi and Discord.
  css.textContent = `
    .install-page[hidden],.install-page [hidden]{display:none!important}
    .install-page{position:fixed;inset:0;z-index:1000;overflow:auto;box-sizing:border-box;
      padding:max(24px,env(safe-area-inset-top)) max(18px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(18px,env(safe-area-inset-left));
      isolation:isolate;background:radial-gradient(ellipse at 90% 0%,#58865880,transparent 65%),
        radial-gradient(ellipse at 0% 65%,#18574b66,transparent 70%),linear-gradient(157deg,#204c3a,#102c26 58%,#0d211e);
      color:var(--menu-text);font:16px/1.5 system-ui,-apple-system,sans-serif;display:flex;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
    .install-page::before{content:'';position:fixed;z-index:-1;pointer-events:none;inset:-36% -55% auto auto;width:190%;height:110%;
      transform:rotate(-29deg);border-radius:47%;background:repeating-radial-gradient(ellipse at 58% 50%,transparent 0 20px,#dbe9a020 21px 22px,transparent 23px 34px)}
    .install-page .install-backdrop{position:fixed;inset:auto 0 -75px;width:100%;height:75%;z-index:-1;opacity:.45;
      --startup-ridge:#a9bcb0;--startup-hills:#5d9063;--startup-fairway:#7aa46f}
    .install-page>div{width:100%;max-width:600px;margin:auto;text-align:center;flex-shrink:0}
    .install-page .install-brand{position:relative;isolation:isolate;overflow:hidden;display:grid;
      grid-template-columns:minmax(0,1fr) minmax(0,2.15fr);align-items:center;gap:clamp(4px,2vw,12px);
      margin:0 0 16px;padding:clamp(10px,3vw,18px);text-align:center;border-radius:23px;border:1px solid #c9e2ac5c;
      background:linear-gradient(130deg,#132832ed,#23474cec);box-shadow:0 10px 30px #021a125c;
      --startup-ridge:#87a999;--startup-hills:#63816b;--startup-fairway:#85aa61}
    .install-page .install-brand .startup-landscape{opacity:.32}
    .install-page .install-brand::before{content:'';position:absolute;inset:0;background:linear-gradient(90deg,#142c36cc,#142c3666 70%,transparent)}
    .install-page .install-brand img{position:relative;display:block;width:100%;height:auto}
    .install-page .install-brand .install-app-icon{max-width:116px;justify-self:end;border-radius:23%;box-shadow:0 4px 12px #03181280}
    .install-page .install-brand div{position:relative;min-width:0;max-width:340px}
    .install-page .install-brand span{display:block;margin:0 0 4px;color:#e0eee4;font-size:clamp(11px,3vw,15px);line-height:1.3}
    .install-page .install-card{border:2px solid #cad6c8;border-radius:27px;padding:clamp(20px,5vw,32px);
      background:linear-gradient(157deg,#f3f4edfa,#e6eee9f7);box-shadow:0 10px 35px #020e0d66}
    #local-install .eyebrow{display:inline-block;padding:4px 10px;border:1px solid #bcb8db;border-radius:999px;background:#f5f2fe;
      font-size:11px;letter-spacing:.13em;font-weight:850;color:#3e3672;margin:0 0 12px}
    #local-install h1{font-size:clamp(23px,5.6vw,32px);line-height:1.15;letter-spacing:-.04em;color:var(--menu-text);margin:0 0 12px}
    #local-install p{margin:12px 0}#local-install .install-lead{color:var(--menu-muted);margin:0 auto 20px;max-width:390px}
    #local-install button,#local-install input{font:inherit;max-width:100%;box-sizing:border-box}
    #local-install button{min-height:48px;padding:10px 16px;margin:10px 4px 0;background:var(--menu-button);color:var(--menu-text);border:1px solid var(--menu-border);border-radius:13px;cursor:pointer}
    #local-install button:disabled{opacity:.5;cursor:wait}
    #local-install .install-picker,#local-install #local-install-play{position:relative;display:block;width:100%;min-height:76px;padding:16px 18px;box-sizing:border-box;text-align:left;border:2px solid var(--menu-focus);border-radius:19px;background:linear-gradient(#e1e1f3,#c3cef6 47%,#a9b8e7);box-shadow:0 3px 0 #727094,inset 0 0 0 2px #ffffff8c;color:var(--menu-text);cursor:pointer}
    #local-install .install-picker:has(input[hidden]){display:none}
    #local-install .install-picker:has(input:disabled){opacity:.5;cursor:wait}
    #local-install .install-picker input{position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:inherit}
    #local-install .install-picker strong{display:block;font-size:20px;line-height:1.2;letter-spacing:-.02em}
    #local-install .install-picker span{display:block;font-size:12px;margin-top:5px;color:var(--menu-muted)}
    #local-install #local-install-play{text-align:center;font-size:22px;font-weight:800;margin-bottom:14px}
    #local-install .install-picker:focus-within,#local-install button:focus-visible,#local-install a:focus-visible{outline:3px solid var(--menu-focus);outline-offset:4px}
    #local-install progress{width:100%;height:16px;margin-top:14px;accent-color:var(--menu-accent)}
    #local-install #local-install-message{font-size:14px;font-weight:600;overflow-wrap:anywhere;color:var(--menu-muted)}
    #local-install #local-install-message.error{color:#9b241d;background:#ffece4;border:1px solid #cf8c7c;border-radius:12px;padding:10px}
    #local-install .minor{color:var(--menu-muted);font-size:12px}#local-install .install-privacy{color:var(--menu-muted);font-size:13px;margin:20px 0 0}
    #local-install .install-footer{font-size:12px;margin-top:22px;color:#deebe0}
    #local-install a{color:var(--menu-accent);text-underline-offset:3px}
    #local-install .install-footer a,#local-install .install-footer .install-privacy{color:#d9ece0}
    #local-install .install-donate,#local-install .install-community{display:grid;grid-template-columns:42px minmax(0,1fr) 26px;align-items:center;
      gap:10px 12px;width:100%;padding:14px;box-sizing:border-box;border-radius:17px;text-align:left;text-decoration:none;min-height:76px;line-height:1.25}
    #local-install .install-donate{margin:0 0 16px;border:1px solid #b58a38;background:linear-gradient(135deg,#fff6d8,#ffdc85);
      color:#432e0b;box-shadow:0 3px 0 #b58a38,inset 0 1px 0 #fff9df}
    #local-install .install-community{margin:0 0 20px;border:1px solid #3832a5;background:linear-gradient(130deg,#38319b,#4b48c7);
      color:#fff;box-shadow:0 3px 0 #30277f,inset 0 1px 0 #ffffff38}
    #local-install .install-link-copy strong{display:block;font-size:16px;font-weight:800;letter-spacing:-.02em}
    #local-install .install-link-copy small{display:block;margin-top:4px;font-size:12px;line-height:1.4;font-weight:500}
    #local-install .install-heart,#local-install .install-discord-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:12px}
    #local-install .install-heart{background:#fff9e6;color:#a93636;font-size:23px}
    #local-install .install-discord-icon{background:#ffffff26}
    #local-install .install-discord-icon img{display:block;width:27px;height:auto}
    #local-install .install-link-arrow{width:26px;height:26px;display:grid;place-items:center;border-radius:50%;background:#613b1717;font-size:17px}
    #local-install .install-community .install-link-arrow{background:#ffffff23}
    #local-install .install-donation-progress{grid-column:1/-1;display:grid;gap:5px;margin-top:1px;padding-top:9px;border-top:1px solid #8f6a3b40}
    #local-install .install-donation-summary{display:flex;flex-wrap:wrap;justify-content:space-between;gap:2px 8px;font-size:12px;line-height:1.35}
    #local-install .install-donation-track{display:block;height:6px;overflow:hidden;border-radius:999px;background:#64471b29}
    #local-install .install-donation-fill{display:block;height:100%;border-radius:inherit;background:#8c5320}
    #local-install .install-recent-donations{grid-column:1/-1;display:grid;gap:4px;padding-top:8px;border-top:1px solid #8f6a3b40;font-size:12px;line-height:1.35}
    #local-install .install-donation-rows{display:grid;gap:0}
    #local-install .install-donation-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:4px 0;overflow-wrap:anywhere}
    #local-install .install-donation-row+.install-donation-row{border-top:1px solid #8f6a3b24}
    #local-install .install-donation-row time{white-space:nowrap}
    #local-install .install-donation-row b{font-variant-numeric:tabular-nums}
    #local-install .install-donate:active,#local-install .install-community:active{transform:translateY(2px);box-shadow:none}
    @media(max-width:360px){#local-install .install-donate,#local-install .install-community{grid-template-columns:34px minmax(0,1fr);gap:8px;padding:11px}
      #local-install .install-heart,#local-install .install-discord-icon{width:34px;height:34px}#local-install .install-link-arrow{display:none}}
    #local-install .install-setup{margin:0 0 20px;padding:15px 16px;border:1px solid var(--menu-line);border-radius:15px;background:var(--menu-button);text-align:left;font-size:14px}
    #local-install .install-setup h2{margin:0 0 8px;font-size:17px;color:var(--menu-text)}
    #local-install .install-setup p{margin:8px 0}
    #local-install .install-setup ol{margin:10px 0;padding-left:22px}
    #local-install .install-setup li{margin:10px 0;overflow-wrap:anywhere}
    #local-install .install-setup a{font-weight:700}
    #local-install .install-version{font-size:12px;line-height:1.4;color:var(--menu-muted);margin:-6px 0 16px}
    #local-install .install-identity{overflow-wrap:anywhere;font-size:11px}
    @media(max-height:500px){.install-page .install-brand{margin-bottom:14px;padding:8px 14px;grid-template-columns:minmax(0,88px) minmax(0,220px);justify-content:center}.install-page .install-card{padding:20px}}
  `;
  document.head.append(css);
  function node(tag, value) { var e = document.createElement(tag); e.textContent = value; return e; }
  var root = node('section', ''); root.id = 'local-install'; root.className = 'install-page'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'local-install-heading');
  var box = node('div', ''), card = node('div', ''); card.className = 'install-card';
  var appIconURL = new URL('icons/simgolf-mobile.png', base).href;
  function startupBrand(page) {
    const brand = node('div', ''); brand.className = 'install-brand';
    const appIcon = node('img', ''); appIcon.className = 'install-app-icon';
    appIcon.src = appIconURL; appIcon.alt = ''; appIcon.width = 1254; appIcon.height = 1254;
    const wordmark = node('img', ''); wordmark.src = new URL('icons/simgolf-mobile-wordmark.png', base).href;
    wordmark.alt = 'SimGolf Mobile'; wordmark.width = 1774; wordmark.height = 887;
    const name = node('div', ''); name.append(wordmark, node('span', 'Your course. In your pocket.'));
    brand.append(Module.createStartupLandscape(page + '-landscape'), appIcon, name);
    return brand;
  }
  function startupBackdrop(page) {
    const backdrop = Module.createStartupLandscape(page + '-backdrop');
    backdrop.classList.add('install-backdrop');
    return backdrop;
  }
  const publicBeta = Module.buildInfo.channel === 'beta';
  const betaVersion = 'Beta ' + Module.buildInfo.version;
  var eyebrow = node('p', publicBeta ? betaVersion.toUpperCase() : Module.buildInfo.channel === 'development' ? 'PRIVATE DEVELOPMENT' : 'BETA 1.0 PREVIEW'); eyebrow.className = 'eyebrow';
  var releaseVersion = node('p', publicBeta ? 'SGMobile ' + betaVersion : Module.buildInfo.displayVersion || 'Developer build ' + Module.buildInfo.version.replace(/^alpha/i, '')); releaseVersion.id = 'local-install-version'; releaseVersion.className = 'install-version';
  var heading = node('h1', 'Ready to build your course?'); heading.id = 'local-install-heading';
  var intro = node('p', 'Select your original SimGolf files once to start playing.'); intro.className = 'install-lead';
  var info = node('p', 'Checking local storage…'); info.id = 'local-install-message'; info.setAttribute('role', 'status'); info.setAttribute('aria-live', 'polite');
  var identity = node('p', (Module.buildInfo.channel === 'development' ? Module.buildInfo.displayVersion : Module.buildInfo.version) + ' · ' + Module.buildInfo.id); identity.className = 'install-identity';
  var picker = document.createElement('input'); picker.id = 'local-install-files'; picker.type = 'file'; picker.multiple = true; picker.accept = '.iso,.bin,.img,.mdf,.exe,.zip,.7z,.rar'; picker.setAttribute('aria-label', 'Select your original game files');
  var pickLabel = node('label', ''); pickLabel.className = 'install-picker'; pickLabel.htmlFor = picker.id;
  pickLabel.append(node('strong', 'Choose Game Files'), node('span', 'Select your disc image and compatible game executable'), picker);
  var quickGuide = node('section', ''); quickGuide.className = 'install-setup'; quickGuide.setAttribute('aria-labelledby', 'local-install-setup-heading');
  var setupHeading = node('h2', 'Quick setup'); setupHeading.id = 'local-install-setup-heading';
  var setupFiles = node('ol', '');
  var discStep = node('li', ''); discStep.append(node('strong', 'Game disc or archive: '), document.createTextNode('a SimGolf .iso file, or a .zip / .7z archive containing the disc image. See '));
  var archiveLink = node('a', 'Internet Archive'); archiveLink.href = 'https://archive.org/details/sid-meiers-sim-golf-1641547'; archiveLink.target = '_blank'; archiveLink.rel = 'noopener noreferrer'; discStep.append(archiveLink, document.createTextNode('.'));
  var exeStep = node('li', ''); exeStep.append(node('strong', 'Compatible no-CD executable: '), document.createTextNode('the supported v1.02 .exe file. See '));
  var executableLink = node('a', 'Abandonware DOS'); executableLink.href = 'https://www.abandonwaredos.com/abandonware-game.php?abandonware=Sid+Meier%27s+SimGolf&gid=2317'; executableLink.target = '_blank'; executableLink.rel = 'noopener noreferrer'; exeStep.append(executableLink, document.createTextNode('.'));
  setupFiles.append(discStep, exeStep);
  quickGuide.append(setupHeading, node('p', 'Save both files in the Files app on your device.'), setupFiles, node('p', 'When both files are ready, tap Choose Game Files above and select them to begin.'));
  var help = node('p', 'The installer checks file compatibility before starting. Your game files are installed locally.'); help.className = 'minor';
  var bar = document.createElement('progress'); bar.max = 1; bar.value = 0; bar.hidden = true; bar.setAttribute('aria-label', 'Game file import progress');
  var play = node('button', 'Play'); play.id = 'local-install-play'; play.hidden = true;
  var replace = node('button', 'Import replacement files'); replace.hidden = true;
  var cancel = node('button', 'Cancel import'); cancel.hidden = true;
  var privacy = node('p', 'Your game files stay on this device.'); privacy.className = 'install-privacy';
  var note = node('p', 'Keep backups of your saves. Clearing this site’s browser data removes local files. The opening movie plays from your local game files.'); note.className = 'minor';
  var footer = node('div', ''); footer.className = 'install-footer';
  var donate = node('a', ''); donate.className = 'install-donate'; donate.setAttribute('aria-label', 'Donate to this project on Ko-fi');
  donate.href = 'https://ko-fi.com/sgmobile'; donate.target = '_blank'; donate.rel = 'noopener noreferrer';
  var heart = node('span', '♥'); heart.className = 'install-heart'; heart.setAttribute('aria-hidden', 'true');
  var donateCopy = node('span', ''); donateCopy.className = 'install-link-copy'; donateCopy.append(node('strong', 'Donate To This Project'), node('small', 'Support development on Ko-fi · optional'));
  var donateArrow = node('span', '↗'); donateArrow.className = 'install-link-arrow'; donateArrow.setAttribute('aria-hidden', 'true');
  const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const donationAmount = cents => dollars.format(cents / 100).replace(/\.00$/, '');
  const donationOrigin = publicBeta ? 'https://sgmobile-beta.github.io' : 'https://gatn01302601.tail3030bb.ts.net:8443';
  const donationPage = publicBeta ? '/golf.html' : '/private/golf.html';
  const donationSnapshotURL = location.origin === donationOrigin && location.pathname === donationPage
    ? 'https://sgmobile-donations.sgmobile-fourtempers.workers.dev/snapshot' : '';
  const donationCacheKey = publicBeta ? 'sgmobile-beta-kofi-snapshot-v1' : 'sgmobile-kofi-totals-v1';
  var donationProgress = node('span', ''); donationProgress.className = 'install-donation-progress';
  var donationSummary = node('span', ''); donationSummary.id = 'install-donation-summary'; donationSummary.className = 'install-donation-summary';
  const donatedLabel = node('strong', ''), projectCostLabel = node('span', '');
  donationSummary.append(donatedLabel, projectCostLabel);
  var donationTrack = node('span', ''); donationTrack.className = 'install-donation-track'; donationTrack.setAttribute('aria-hidden', 'true');
  var donationFill = node('span', ''); donationFill.className = 'install-donation-fill';
  donationTrack.append(donationFill); donationProgress.append(donationSummary, donationTrack);
  var recentDonations = node('span', ''); recentDonations.className = 'install-recent-donations';
  const donationRows = node('span', ''); donationRows.className = 'install-donation-rows';
  recentDonations.append(node('strong', 'Recent public donations'), donationRows);
  donate.append(heart, donateCopy, donateArrow, donationProgress, recentDonations);

  function validDonationDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  function publicDonationSnapshot(value) {
    if (value?.currency !== 'USD' ||
        !Number.isSafeInteger(value.donatedCents) || value.donatedCents < 0 ||
        !Number.isSafeInteger(value.projectCostCents) || value.projectCostCents <= 0 ||
        !Array.isArray(value.recent) || value.recent.length > 3) return null;

    const recent = [];
    for (const tip of value.recent) {
      if (typeof tip?.name !== 'string' || !tip.name.trim() || Array.from(tip.name).length > 80 ||
          /[\p{Cc}\p{Cf}@]|https?:\/\//iu.test(tip.name) ||
          !Number.isSafeInteger(tip.amountCents) || tip.amountCents <= 0) return null;
      const row = { name: tip.name.trim(), amountCents: tip.amountCents };
      if (validDonationDate(tip.date)) row.date = tip.date;
      recent.push(row);
    }
    return { currency: 'USD', donatedCents: value.donatedCents, projectCostCents: value.projectCostCents, recent };
  }
  function showDonationTotals(snapshot) {
    donatedLabel.textContent = donationAmount(snapshot.donatedCents) + ' donated';
    projectCostLabel.textContent = 'of ' + donationAmount(snapshot.projectCostCents) + ' in project costs';
    donationFill.style.width = Math.min(100, 100 * snapshot.donatedCents / snapshot.projectCostCents) + '%';
    donationProgress.hidden = false;
    donate.setAttribute('aria-describedby', donationSummary.id);
  }
  function showDonationSnapshot(snapshot) {
    showDonationTotals(snapshot);
    donationRows.replaceChildren(...(snapshot.recent.length ? snapshot.recent.map(tip => {
      const row = node('span', ''); row.className = 'install-donation-row';
      const donor = node('span', tip.name);
      if (tip.date) {
        const [year, month, day] = tip.date.split('-');
        const date = node('time', Number(month) + '/' + Number(day) + '/' + year.slice(-2));
        date.dateTime = tip.date;
        donor.append(' on ', date);
      }
      row.append(donor, node('b', donationAmount(tip.amountCents)));
      return row;
    }) : [node('span', 'No public donations yet.')]));
  }
  let confirmedDonations = null;
  let cachedDonations = null;
  if (donationSnapshotURL) {
    try {
      cachedDonations = JSON.parse(localStorage.getItem(donationCacheKey));
      confirmedDonations = publicDonationSnapshot(cachedDonations);
    } catch (error) {}
  }
  if (confirmedDonations) showDonationSnapshot(confirmedDonations);
  else {
    donationProgress.hidden = true;
    if (!publicBeta && cachedDonations?.currency === 'USD' &&
        Number.isSafeInteger(cachedDonations.donatedCents) && cachedDonations.donatedCents >= 0 &&
        Number.isSafeInteger(cachedDonations.projectCostCents) && cachedDonations.projectCostCents > 0) {
      showDonationTotals(cachedDonations);
    }
    donationRows.textContent = 'Donation totals are available after an online check.';
  }
  let donationRefreshPending = false;
  async function refreshDonations() {
    if (!donationSnapshotURL || donationRefreshPending || root.hidden || document.hidden || navigator.onLine === false) return;
    donationRefreshPending = true;
    try {
      const response = await realFetch(donationSnapshotURL, {
        method: 'GET', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout?.(5000),
      });
      if (!response.ok) throw Error('Donation snapshot unavailable');
      const snapshot = publicDonationSnapshot(await response.json());
      if (!snapshot) throw Error('Invalid donation snapshot');
      confirmedDonations = snapshot;
      showDonationSnapshot(snapshot);
      try { localStorage.setItem(donationCacheKey, JSON.stringify(snapshot)); } catch (error) {}
    } catch (error) {
      if (!confirmedDonations) donationRows.textContent = 'Donation totals are temporarily unavailable.';
    } finally {
      donationRefreshPending = false;
    }
  }
  var community = node('a', ''); community.className = 'install-community'; community.setAttribute('aria-label', 'Join SimGolf Mobile Discord');
  community.href = 'https://discord.gg/RDKJBWdGAg'; community.target = '_blank'; community.rel = 'noopener noreferrer';
  var discordIcon = node('img', ''); discordIcon.src = new URL('icons/discord-symbol.svg', base).href; discordIcon.alt = ''; discordIcon.width = 36; discordIcon.height = 27;
  var discordTile = node('span', ''); discordTile.className = 'install-discord-icon'; discordTile.append(discordIcon);
  var communityCopy = node('span', ''); communityCopy.className = 'install-link-copy'; communityCopy.append(node('strong', 'Join SimGolf Mobile Discord'), node('small', 'Share your course, feedback & ideas'));
  var communityArrow = node('span', '↗'); communityArrow.className = 'install-link-arrow'; communityArrow.setAttribute('aria-hidden', 'true'); community.append(discordTile, communityCopy, communityArrow);
  var guide = node('a', 'Setup & supported files'); guide.href = new URL('README.txt', base).href; guide.target = '_blank'; guide.rel = 'noopener';
  var notices = node('a', 'Third-party notices & source'); notices.href = new URL('THIRD_PARTY_NOTICES.txt', base).href; notices.target = '_blank'; notices.rel = 'noopener';
  var links = node('p', ''); links.append(guide, document.createTextNode(' · '), notices);
  card.append(eyebrow, releaseVersion, donate, community, heading, intro, pickLabel, info, bar, quickGuide, help, play, replace, cancel, privacy, note);
  footer.append(links, identity); box.append(startupBrand('welcome'), card, footer);
  root.append(startupBackdrop('welcome'), box); document.body.append(root);
  Module.mountUsageTotals?.(releaseVersion, privacy, footer, node);
  if (donationSnapshotURL) {
    void refreshDonations();
    addEventListener('online', refreshDonations);
    addEventListener('pageshow', refreshDonations);
    document.addEventListener('visibilitychange', refreshDonations);
    setInterval(refreshDonations, 60000);
  }
  for (var type of ['pointerdown','pointerup','pointermove','mousedown','mouseup','click','touchstart','touchmove','touchend','wheel','keydown','keyup','keypress']) root.addEventListener(type, function (e) { e.stopPropagation(); });

  function status(phase, message, error) {
    Module.localInstall.phase = phase; Module.localInstall.error = error ? message : '';
    info.textContent = message; info.className = error ? 'error' : '';
  }
  function messageError(e) { return e && e.message || String(e); }
  function validPath(path) {
    return typeof path === 'string' && path.length > 0 && path.split('/').every(function (p) { return p && p !== '.' && p !== '..' && !/[\\:\0]/.test(p); });
  }
  async function fileAt(top, path) {
    if (!validPath(path)) throw new Error('Invalid local game-file path.');
    var parts = path.split('/'), dir = top;
    for (var part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part);
    return (await dir.getFileHandle(parts[parts.length - 1])).getFile();
  }
  Module.readInstalledArtwork=async function(path){
    const actual=active?.meta.files.find(([name])=>name.toLowerCase()===path.toLowerCase())?.[0];
    if(!actual)throw Error('Original artwork is not installed.');
    return new Uint8Array(await (await fileAt(active.top,'game/'+actual)).arrayBuffer());
  };
  async function local(path) {
    try {
      var parts = path.split('/').map(decodeURIComponent), key = parts.slice(0, -1).join('/'), dir = gameDirs.get(key);
      if (!validPath(parts.join('/'))) throw new Error('Invalid path');
      if (!dir) { dir = storage; for (var part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part); gameDirs.set(key, dir); }
      return new Response(await (await dir.getFileHandle(parts[parts.length - 1])).getFile());
    } catch (e) { return new Response('', {status:404}); }
  }
  window.fetch = function (input, init) {
    var url = new URL(input instanceof Request ? input.url : String(input), location.href);
    if (url.origin === base.origin && url.pathname.startsWith(base.pathname)) {
      var path = url.pathname.slice(base.pathname.length);
      // The release shell never probes a remote save endpoint, even before import.
      if (path === 'saves/' || path.startsWith('saves/')) return Promise.resolve(new Response('', {status:404}));
      if (path.startsWith('game/') || path.startsWith('assets/')) {
        if (!storage) return Promise.resolve(new Response('', {status:404}));
        return local(path.startsWith('assets/') ? 'game/' + path.slice(7) : path);
      }
    }
    return realFetch(input, init);
  };
  window.simgolfStorage = async function () {
    if (!storage) throw new Error('Original game files are not installed.');
    return storage;
  };
  async function hash(bytes) {
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  var compatibility = realFetch(new URL('compatibility.json', base)).then(function (r) { if (!r.ok) throw new Error('App compatibility information could not be loaded.'); return r.json(); });
  compatibility.catch(function () {});
  async function inspect(opfs, name) {
    var top = await opfs.getDirectoryHandle(name), meta = JSON.parse(await (await fileAt(top, 'installed.json')).text());
    if (meta.version !== 1 || !Array.isArray(meta.files) || !meta.files.length) throw new Error('Unsupported or unfinished installation.');
    if (!meta.files.every(function (f) { return Array.isArray(f) && validPath(f[0]) && Number.isSafeInteger(f[1]) && f[1] >= 0; })) throw new Error('Invalid original-file inventory.');
    var images = {}, expected = (await compatibility).images;
    for (var n of ['golf.bin', 'jgld.bin']) {
      images[n] = new Uint8Array(await (await fileAt(top, 'image/' + n)).arrayBuffer());
      if (await hash(images[n]) !== expected[n]) throw new Error('The installed game files do not match this engine version.');
    }
    await fileAt(top, 'game/' + meta.files.find(function (f) { return f[0].toLowerCase() === 'jackal.pcx'; })?.[0]);
    return {name:name, top:top, meta:meta, images:images};
  }
  function installedView() {
    quickGuide.hidden = true; picker.hidden = true; play.hidden = false; replace.hidden = false; cancel.hidden = true; bar.hidden = true;
    status('installed', 'Your original game files are ready.');
  }
  async function discover() {
    var opfs = await navigator.storage.getDirectory(), candidates = [];
    for await (var entry of opfs.values()) {
      if (entry.kind === 'directory' && (entry.name === 'simgolf' || entry.name.startsWith('simgolf-install-'))) {
        try { candidates.push(await inspect(opfs, entry.name)); } catch (e) { console.warn('Local installation not selected:', entry.name, messageError(e)); }
      }
    }
    candidates.sort(function (a, b) { return (b.meta.created || 0) - (a.meta.created || 0); });
    return candidates[0] || null;
  }
  function claimSaveStorage() {
    if (!navigator.locks?.request) return Promise.resolve(function () {});
    return new Promise(function (resolve, reject) {
      navigator.locks.request('sgmobile-save-storage', {ifAvailable: true}, function (lock) {
        if (!lock) { resolve(null); return; }
        // Keep the lock for this document's lifetime. A hidden game still
        // flushes its in-memory IDBFS mount to the shared IndexedDB store.
        return new Promise(function (release) { resolve(release); });
      }).catch(reject);
    });
  }
  async function start(value = null) {
    if (!active || settled || starting) return false;
    starting = true;
    play.disabled = true; replace.disabled = true; picker.disabled = true;
    let release;
    try {
      if (!Module.noVideos) Module.prepareBinkAudio?.();
      release = await claimSaveStorage();
      if (!release) throw Error('SGMobile is open in another window. Close it, then tap Play again.');
      if (navigator.storage.persist) await navigator.storage.persist().catch(function () {});
      if (value !== null && !Module.selectGameEdition(value)) throw Error('Choose a game mode again.');
      storage = active.top; gameDirs.clear(); Module.localInstall.generation = active.name;
      settled = true; status('starting', 'Loading the game…'); resolveReady(active); return true;
    } catch (e) {
      release?.(); play.disabled = false; replace.disabled = false; picker.disabled = false;
      status('error', messageError(e), true); return false;
    } finally { starting = false; }
  }
  // A stopped Wasm game cannot be entered again. After durable native exit,
  // use the same page's ordinary startup gate to show Play with a fresh runtime.
  Module.returnToLaunch=function(){
    if(!Module.exitCredits?.stopped||!Module.exitCredits.saved||Module.returningToLaunch)return false;
    Module.returningToLaunch=true;location.reload();return true;
  };
  const changelog = node('section', ''); changelog.id = 'game-changelog'; changelog.className = 'install-page';
  changelog.hidden = true; changelog.setAttribute('role', 'dialog'); changelog.setAttribute('aria-modal', 'true');
  changelog.setAttribute('aria-labelledby', 'game-changelog-heading');
  const changelogBox = node('div', ''), changelogCard = node('div', '');
  changelogCard.className = 'install-card';
  const changelogHeading = node('h1', 'Changelog'); changelogHeading.id = 'game-changelog-heading'; changelogHeading.tabIndex = -1;
  const publicChangelog = {"release":"Beta 1.0.3","sections":[{"title":"Beta 1.0.3 update","blocks":[["ul",["Added separate Development Sessions and Hours Played at the bottom of Welcome. Development testing activity stays separate from public Beta totals.","The donation card shows the three most recent donations with dates, including anonymous donations."]]]},{"title":"Beta 1.0.1 fixes","blocks":[["ul",["Fixed editing player names and jobs in golfer profiles."]]]},{"title":"Classic and Enhanced play","blocks":[["p","One of the biggest changes is the distinction between two ways to play."],["heading","Classic Mode"],["ul",["Preserves the original SimGolf rules, mechanics, scoring, finances and gameplay.","Benefits from the same improved touchscreen controls, mobile menus and compatibility fixes.","Keeps additional Enhanced gameplay mechanics disabled.","Supports original saved games.","Allows players to create a separate Enhanced copy of a compatible Classic career."]],["heading","Enhanced Mode"],["ul",["Adds a collection of individually selectable gameplay improvements.","Lets players choose which features they want.","Stores those selections with each career rather than relying only on device-wide preferences.","Supports changing eligible features during an existing career.","Preserves recorded feature history when a feature is disabled and later re-enabled.","Allows related features to work together without automatically enabling unrelated options."]],["p","The original Classic career remains separate when creating an Enhanced copy. Enhanced saves are not silently converted backward into Classic."]]},{"title":"Optional Enhanced features","blocks":[["p","These are the major optional gameplay systems developed since the public Alpha."],["heading","Faster game speeds and Pause control"],["ul",["Additional simulation-speed selections, including high-speed options for advancing through longer periods of gameplay.","Dedicated Pause functionality.","Resume gameplay without losing the current game state.","More convenient speed controls within the mobile menu.","Improvements to year-end transitions at higher speeds.","Requested speed and actual performance remain dependent on device capabilities."]],["heading","Clubhouse relocation"],["ul",["Relocate the clubhouse during an existing career.","Use original construction and placement rules.","Retain original costs and eligibility restrictions.","Redesign your course around a different clubhouse position."]],["heading","Course Analytics & Heatmaps"],["ul",["Analyze the performance of individual holes.","View genuine recorded scoring information.","Compare average strokes and scores relative to par.","Inspect ball-finish activity across the course.","Display positive and negative golfer-reaction heatmaps.","Switch map layers or hide them.","Focus the camera on a selected hole.","Fit the tee, relevant routing bends and flag into view.","Return to the previous screen without losing context."]],["p","The information comes from the original game rather than invented statistics."],["heading","Golfer Profiles & Histories"],["ul",["Track individual golfers over time.","View completed rounds and retained scorecards.","Review previous hole scores.","Follow recurring golfers as they visit your course.","Preserve golfer records across saves.","Keep historical results tied to the correct career and saved revision."]],["heading","Golfer Experiences & Preferences"],["ul",["View actual golfer comments collected from the original game.","See verified positive and negative reactions.","Review golfer personality information and profile interests.","Inspect original current feeling meters.","View comments with their recorded in-game context.","Combine the feature with Golfer Histories for additional measured performance information."]],["p","These are original observations, not a replacement golfer AI system."],["heading","Club Records & Hall of Fame"],["ul",["Track notable achievements from actual golfer performances.","Retain course and hole scoring records.","Recognize exceptional rounds.","Record genuine holes-in-one and other milestones.","Preserve previous record holders and historical achievements.","Associate records with their relevant course layouts."]],["heading","Course Design Challenges"],["p","Six implemented challenges give players additional goals when designing and improving a course:"],["ol",["The Perfect Par 3 — Build a qualifying enjoyable par-3 hole.","Balanced Course — Maintain a course containing par-3, par-4 and par-5 holes.","Tough but Fair — Create a hole that challenges golfers while remaining playable.","The Course Turnaround — Improve a struggling hole through a real redesign.","Signature Par 5 — Develop a par-5 hole with varied genuine scoring outcomes.","The Nine-Hole Test — Build and validate a complete nine-hole course."]],["p","Challenges use original construction and observed golfer results. They aren't artificial bonuses that change the original scoring engine."],["heading","Course Design Lab"],["p","One of my favorite additions for players who enjoy designing courses."],["ul",["Start an experiment on a selected hole.","Record how golfers perform on its original layout.","Redesign the hole.","Collect new scoring observations.","Compare the baseline and revised designs.","Keep experiments associated with the actual hole layout.","View qualifying observation counts.","See when a comparison has enough evidence.","Archive incomplete experiments without inventing conclusions.","Save and restore active and historical experiments."]],["p","The Lab requires at least three qualifying finishes for each design before producing a supported comparison."],["heading","Clubhouse & Tee-Time Management"],["ul",["Inspect original clubhouse activity.","View golfers waiting, playing or leaving.","Access the original pairing and dispatch process.","Select genuinely eligible waiting golfers for a tee pairing.","Follow relevant golfer information through connected features."]],["heading","Creative Sandbox"],["ul",["Optional free-construction behavior in the appropriate Sandbox setup.","Experiment with course layouts without ordinary construction charges.","Retain original placement requirements and applicable operating rules.","Keep Sandbox choices specific to that career."]],["p","Creative Sandbox isn't a universal unlimited-money cheat for every game mode."],["heading","Business Management Challenges"],["p","The first implemented business challenge is Profitability Turnaround."],["ul",["Begin with a genuine operating-loss season.","Improve the club through original management decisions.","Compare complete financial periods.","Track real Greens Fees, Food/Drink, Salaries and Maintenance/Interest.","Review why a financial year did or didn't qualify.","Display the relevant March-to-March accounting window.","See when the next evaluation occurs.","Earn a medal only when the original financial records satisfy the conditions.","Open the original Financial Report and return directly to your challenge."]],["p","There are no invented financial rewards or artificial adjustments to the original economy."],["heading","Course Review"],["ul",["Review individual holes in one place.","See native Fun and Skill information.","Inspect yardage, par and available scoring information.","Review genuine golfer praise and complaints.","Expand individual hole cards.","Jump directly to Analytics or Design Lab when enabled.","Return to the same expanded hole and scroll position.","Review course information during original year-end reports."]],["heading","Keep Land Offers"],["ul",["Optionally retain an eligible original land-purchase offer.","Reopen it later from the Enhanced menu.","Review the original available tracts and prices.","Purchase when you have sufficient funds.","Retain the offer through supported saves.","Consume it after a successful native purchase."]],["p","This offers more flexibility without discounting or inventing new land."],["heading","Elevation Map"],["ul",["View the course's actual terrain elevations.","Use a fitted whole-course overview.","Inspect an elevation overlay on the active course.","Toggle transparent height colors.","Use the original height information when planning construction and routing.","Keep normal camera and construction controls available."]],["heading","Eyesore Demolition"],["p","Remember those water towers, radio antennas and oil pumps that everyone complains about?"],["p","Enhanced Mode now offers an optional way to remove them."],["ul",["Enable Eyesore Demolition for your career.","Select an eligible eyesore on land you own.","Review a confirmation showing its demolition cost.","Pay $10,000 to remove it.","Free the original tile for future construction.","Preserve the original financial transaction and save state.","Keep Classic Mode's original protected-landmark behavior."]],["p","The demolition expense is recorded under the original Build course accounting category."],["heading","Direct Building Upgrades"],["ul",["Optionally access supported building upgrades more directly.","See Upgrade Available when original requirements are satisfied.","Use the original building eligibility rules.","Show the real native construction quote.","Preserve original upgrade and replacement behavior."]]]},{"title":"Construction, property and routing","blocks":[["p","Construction has received extensive mobile improvements."],["ul",["Reorganized Build controls into more accessible categories.","Improved terrain-painting interactions.","Refined Remove / Undo controls.","Added or improved drag-to-remove behavior.","Improved active-tool visibility.","Prevented unintended map edits while using menus.","Preserved tools through modal transitions.","Improved construction previews."]],["heading","Course Tiles and variations"],["ul",["Reworked the original Course Tiles interface.","Added a contextual Next Variation control.","Made the selected artwork reflect the actual native variation.","Restored original tile and improvement artwork.","Improved Ballwasher, Pathway, Building Lot, Bench, Landmark, Flower Bed, Scenic Tree and Scenic Bridge cards.","Added clearer indicators for items with available variations.","Improved scrolling through construction selections.","Added clearer locked-building and landmark presentation.","Corrected building cards that were misleadingly marked locked when an existing facility could be upgraded."]],["heading","Building and landmark unlocks"],["p","Locked entries now provide additional information."],["ul",["Red lock indicators.","Grayed-out artwork.","Information buttons.","Original unlock requirements.","World Map property information specific to the current career.","Relevant Ivana Richman donation information.","Applicable golfer-story unlock routes.","Clear ALREADY BUILT and upgrade statuses."]],["p","The unlock system is still the original game system."],["heading","Land purchases"],["ul",["Rebuilt original land-purchase screens for mobile.","Display available property tracts over the course.","Select a tract directly on the map.","Synchronize map highlighting with the land list.","Display original acreage, terrain and price.","Preserve original purchase and cancellation behavior.","Apply actual original financial charges.","Save and reload purchased land correctly."]],["heading","Routing Map"],["ul",["Added a responsive Routing Map.","Pan and zoom around the course.","Fit the full course into view.","Inspect individual holes.","Access all four original map views.","Review course routing.","Use the original hole-order confirmation process."]],["heading","Tee ownership correction"],["p","Several native problems have also been corrected, including an issue where editing an obsolete tee location could accidentally remove the active tee and close a hole."],["p","The corrected behavior preserves actual tee ownership, valid hole routing, original removal rules, costs and refunds."]]},{"title":"Playing a round","blocks":[["p","Playing an actual round has received major attention."],["ul",["Refined touch-based aiming.","Kept aiming and shooting as separate actions.","Added clearer original shot-type selection.","Made selecting an available shot type activate Aim.","Preserved the existing target when changing shot type while aiming.","Simplified labels such as Straight, Fade and Draw.","Added selected-state highlighting for Aim.","Made Pan exit Aim without taking a shot.","Removed redundant round-toolbar controls.","Removed an unwanted original toolbar redraw when changing shots.","Improved handling of ready shots when menus open or close.","Preserved shot state across rotation and responsive-layout changes.","Improved automatic centering when the next golfer turn is ready."]]]},{"title":"Tournaments and Competition points","blocks":[["p","Much of the original tournament experience has been adapted for mobile."],["ul",["Responsive SGA Evaluation.","Proper original eligibility and rejection explanations.","Genuine tournament invitations.","Original event names and advertised prizes.","Mobile Tournament Preparation.","Original preparation checkboxes and recommendations.","Live tournament leaderboard.","Player highlighting and position.","Compact leaderboard visible during tournament play.","Full standings on demand.","Original SGA crest.","Final tournament standings.","Original player scores and prizes.","Responsive results screens.","Correct return to gameplay after tournament completion."]],["p","Full tournaments have also been completed during development testing in both Classic and Enhanced, including verification of actual prizes, financial ledger postings, Competition points and save/reload."],["p","The original trophy counter was previously mislabeled Tournament wins."],["p","It now accurately displays Competition points, reflecting how the original game actually awards them."]]},{"title":"Golfers, employees and homes","blocks":[["heading","Golfer cards and actions"],["ul",["Modernized the original golfer-card presentation.","Improved portrait and frame cropping.","Added translucent views that keep the course visible.","Added responsive Player Details.","Preserved the original skill editor.","Added access to golfer Experiences and History when enabled.","Restored Take Picture / Snapshot functionality.","Added an eligible Ask To Leave action with native confirmation.","Improved golfer selection and return navigation.","Preserved the original golfer's active visit and native state."]],["heading","Employees"],["ul",["Redesigned the employee roster for mobile.","Added an accessible fixed action footer.","Made the roster independently scrollable.","Exposed original Hire, Rename, Relocate and Fire actions.","Improved employee selection.","Made relocation use the original native placement process.","Added clear cancellation of relocation.","Preserved original hiring, firing, costs and confirmations."]],["heading","Home Sites"],["ul",["Improved the original Home Site demolition confirmation.","Added individual house resident sound mute/unmute controls on the current device.","Preserved original Home Site construction and financial behavior."]]]},{"title":"Original reports","blocks":[["p","Seven important original reports received dedicated mobile layouts:"],["heading","Course Report"],["ul",["Native hole details, par, yardage and available performance information.","Course totals and financial information where provided by the original report."]],["heading","Player Comments"],["ul",["Original golfer comments and their recorded frequencies.","Corrected misleading aggregate score labels.","Clearer explanations of feedback percentages."]],["heading","Histograph"],["ul",["Original Skill, Cash, Fun and Events chart.","Improved legends.","Zoom and Fit controls.","One-finger panning in both directions."]],["heading","Financial Report"],["ul",["Responsive original financial ledger.","Year selection.","Native accounting categories.","Contextual return from Business Challenges."]],["heading","SGA Evaluation"],["ul",["Original eligibility and committee recommendation.","Original grades, criteria, crest and rating information."]],["heading","Membership Roster"],["ul",["Original golfer/member information.","Relevant rounds, handicap and low-score data.","Expandable Hole Events.","Original roster paging."]],["heading","Best Scores"],["ul",["Native rankings, golfer names and scores."]],["heading","Original View and Hole Stats"],["p","The original reports retain access to Original View where supported."],["p","The original Hole Stats, Course Review and Analytics displays have also been refined to agree on their native score-average presentation when using the same underlying samples."],["p","Feedback explanations now distinguish completed scores, repeated golfer reactions, historical observations and spatial heatmap activity."]]},{"title":"Trophies and accomplishments","blocks":[["p","Two parts of the original game received substantial visual redesigns."],["heading","Top Ten Designers"],["ul",["Restored access after the appropriate original year-end report.","Preserved original ranking values and benchmark names.","Highlighted the current career.","Added a redesigned dark oak trophy cabinet.","Created three trophy size tiers.","Added gold trophy presentation.","Added rank inscriptions.","Displayed native Total Score, Fun, Skill and Cash values.","Improved shelf layout and readability.","Added a single explanation key for benchmark information.","Improved trophy presentation on narrow and unfolded screens."]],["heading","Professional Accomplishments"],["ul",["Reworked the original accomplishments presentation around an expanding trophy.","Preserved original Polaroids.","Preserved notes and descriptions.","Preserved the original skill allocation process.","Improved layout and transitions.","Applied matching trophy and typography styling."]]]},{"title":"Menus and navigation","blocks":[["p","A large amount of development went into making the original PC menus usable on mobile."],["p","Improvements include:"],["ul",["Modernized Classic/Enhanced edition selection.","Clear save-compatibility explanations.","Optional dismissal of previously acknowledged edition notices.","Redesigned difficulty selection and confirmation.","Improved original location and course selection.","Restored original globe, pins, badges and artwork.","Clearer original course offers.","Rebuilt World Map navigation.","Better main-menu Exit confirmation.","Improved New Game and Load flows.","Modernized Championship setup.","Improved Select a Theme.","Support for choosing compatible installed original theme packs.","Access to Save Championship Pro from System.","Improved Sandbox startup transitions.","Better navigation when opening saved-course previews.","Reduced flashing of old native-size screens during transitions.","Better modal Back, Close, Cancel and Apply behavior.","Improved Build, Manage and Play navigation.","Reorganized the course information header.","Improved zoom, version and playing-status placement.","Contextual construction actions.","More readable original artwork and labels.","Responsive Manage and System menus.","Corrected clipped labels and overflowing buttons.","Simplified System options.","Added repeat-last-message functionality.","Improved original Preferences.","Added Course Symbols when tapping the course dashboard.","Improved native dialog and confirmation presentation.","Corrected input ownership when switching between menus and gameplay."]]]},{"title":"Saves, backups and offline play","blocks":[["p","This is one of the largest behind-the-scenes improvements."],["ul",["Each Enhanced career remembers its own feature configuration.","Rules are restored when the correct save is loaded.","Multiple careers can use different Enhanced features.","Recorded histories remain tied to their matching revisions.","Disabled features can retain historical information.","Restoring an older revision restores its corresponding earlier state.","Original native .sve support.","Portable .sgsave backups for Enhanced metadata.","Manual saves.","Three-minute native autosaves.","Backup History.","Older revision restoration as separate copies.","Improved save conflict handling.","Backup duplicate detection.","Large save-list support.","Fixed the original 100-entry chooser limitation.","Hidden internal scratch files from user-facing transfer lists.","Improved backup and transfer explanations.","Improved import/export and browser file-action compatibility.","Direct Load Saved Game.","Saved Course Preview before the final native load.","Enhanced Settings accessible from a preview.","Staged feature changes before entering a course.","Back returning to the same save list and scroll position.","Last Manual Save shortcut with the course name, original emblem and local save time.","All 16 original course emblems supported.","Validation that a manual-save shortcut points to the correct saved bytes.","Safe fallback to the normal chooser if the target changes.","Preservation of locally installed original files.","Offline loading and saving.","Improved service-worker updates.","Save and backup preservation across validated updates.","Better recovery from interrupted operations.","Classic/Enhanced compatibility protections."]],["p","Beta 1.0 is available at a separate website with its own installed files and save storage. Install your original game files in Beta. To bring over a Classic career, import a copy of its .sve. For an Enhanced career, import a portable .sgsave copy with its feature settings and history. Keep important exports in Files and use Backup History for recent revisions."]]},{"title":"Responsive layouts and touch","blocks":[["p","SGMobile has moved much further away from the original fixed PC window."],["p","Improvements include:"],["ul",["Narrow portrait layouts.","Standard and large portrait layouts.","Landscape gameplay and menus.","Short-height landscape support.","Folded and unfolded device layouts.","Safe-area handling.","Improved touch-target sizing.","Better wrapping and scrolling.","Shared text sizing to prevent unintended enlargement after refolding.","Improved fixed headers and footers.","Better modal positioning.","Improved touch ownership.","Better handling of interrupted gestures.","Prevention of accidental shots and construction while navigating menus.","Preservation of camera and selected tools through supported transitions.","Refined zoom readout and course HUD positioning.","Improved native report presentation.","Smaller, more readable year-end report typography.","Reduced menu-to-course visual flashing.","Improved first fitted course frame.","More consistent loading and transition screens."]],["p","These changes benefit both Classic and Enhanced play."]]},{"title":"Visual design","blocks":[["p","Beta 1.0 brings a consistent look to Welcome, loading screens and mobile menus."],["ul",["New Midnight Fairway visual theme.","Supplied SGMobile wordmark.","Evergreen icon artwork.","Matching Home Screen icon.","Redesigned welcome hero.","Branded loading screen.","Matching startup and transition screens.","Original-art-inspired cream and gold controls.","Lavender and dark-color accents.","Improved visual hierarchy.","More consistent typography.","Clearer course and gameplay status displays."]],["p","I wanted the game to feel like SimGolf, rather than a generic modern mobile game."]]},{"title":"Support and Ko-fi","blocks":[["p","The welcome experience has been expanded."],["ul",["Ko-fi and Discord support cards remain prominently displayed.","New Donate To This Project presentation.","Live Ko-fi donation totals when the snapshot service is available.","Display of donations against project costs.","Display of the three most recent public donations.","New donations replace older entries in that list.","A confirmed donation snapshot can remain visible offline.","Updated support-card styling.","More cohesive branding."]],["p","Supporting the project remains optional."],["p","The donation card keeps the most recent confirmed snapshot for offline viewing."]]},{"title":"Changelog and updates","blocks":[["ul",["Added a dedicated Changelog during startup.","Players can review release notes before proceeding.","Added a single clear Proceed action.","Added an option to skip notes already seen.","The skip preference applies to the exact release-note revision.","Updated public release notes can cause the Changelog to appear again.","Improved update transitions and package validation.","Continued individual developer build versioning."]],["p","This should make larger releases easier to explain without forcing users to repeatedly read unchanged notes."]]},{"title":"Usage reporting","blocks":[["p","The project now has more detailed usage reporting."],["heading","Public usage"],["p","Public Beta measures:"],["ul",["SG Mobile Sessions.","Hours Played.","Active course time.","One session per opening that reaches a playable course."]],["p","Welcome, loading, paused, hidden and suspended time are excluded from active playtime."],["heading","Development testing statistics"],["p","Development Usage is available on the separate developer installation."],["ul",["Fresh visible app-page openings count as sessions.","Visible time is measured across menus, loading, Welcome and gameplay.","Hidden and suspended time is excluded.","Offline activity can queue for later synchronization.","Development totals remain independent of the public pilot.","Development Usage remains independent from public Beta statistics."]],["heading","Launch totals"],["p","Public Beta Sessions and Hours Played start at zero for Beta 1.0. Alpha usage history remains separate."],["p","The development timer starts a new measurement period at launch while preserving the development Sessions count."]]},{"title":"Engine corrections","blocks":[["p","A number of problems were identified through testing the translated original engine."],["p","Among the important corrections:"],["ul",["Original save chooser limitations with large save collections.","High-speed year-end freezing.","Interrupted touchscreen gestures leaving camera panning unresponsive.","Save preview and native load ownership.","Incorrect or duplicated save-history entries.","Incorrect native aggregate golf-achievement text.","Score-average formatting differences between original and Enhanced reports.","Stale tee ownership causing an active hole to close incorrectly.","Snack Bar facility-distance translation, restoring genuine visits and purchases.","Eyesore Demolition accounting-category correction.","Original course-export compatibility issues.","Responsive tournament invitation, preparation and results behavior.","Incorrect competition award labeling.","Incorrect building lock indications.","Missing original course emblems.","Refolding-related text enlargement.","Multiple native input and modal handoff issues."]],["p","Some fixes required tracing original x86 behavior and validating the WebAssembly translation against it."]]},{"title":"Development testing","blocks":[["p","Development has included extensive validation using authentic original-game files and copied saved careers."],["p","Tests have covered:"],["ul",["Classic gameplay fidelity.","Enhanced feature combinations.","Multi-year careers.","High-speed gameplay and year-end reports.","Native scoring and finances.","Actual Business Challenge achievements.","Real clubhouse relocation and tee pairing.","Construction and land purchases.","Full original tournaments.","Tournament prizes and financial accounting.","Save and Backup History restoration.","Portable transfers.","Offline play.","Responsive touch interfaces.","Installed-game update preservation.","Previously saved career compatibility."]]]}],"revision":"beta1.0.3:1cca55875a454b52e6750cbdfc0441ca078184e1b2f071a59abc3bdcb29d5aa4"};
  const changelogRevision = publicChangelog.revision;
  const changelogHeader = node('header', '');
  changelogHeader.className = 'changelog-header';
  changelogHeader.append(changelogHeading, node('p', publicChangelog.release));
  const changelogNotes = node('div', '');
  changelogNotes.className = 'changelog-notes';
  changelogNotes.setAttribute('role', 'region');
  changelogNotes.setAttribute('aria-label', 'Beta release notes');
  changelogNotes.tabIndex = 0;
  for (const [index, section] of publicChangelog.sections.entries()) {
    const details = node('details', '');
    details.open = index === 0;
    const summary = node('summary', section.title);
    const content = node('div', '');
    content.className = 'changelog-section';
    for (const [type, value] of section.blocks) {
      if (type === 'ul' || type === 'ol') {
        const list = node(type, '');
        for (const item of value) list.append(node('li', item));
        content.append(list);
      } else {
        content.append(node(type === 'heading' ? 'h2' : 'p', value));
      }
    }
    details.append(summary, content);
    changelogNotes.append(details);
  }
  const changelogBack = node('button', 'Back'); changelogBack.type = 'button'; changelogBack.id = 'game-changelog-back';
  changelogBack.onclick = returnToPlay;
  const changelogSkip = node('input', ''); changelogSkip.type = 'checkbox'; changelogSkip.id = 'game-changelog-skip';
  const skipLabel = node('label', ''); skipLabel.append(changelogSkip, node('span', 'Skip this changelog on future launches'));
  const skipChangelogKey = 'simgolf-skip-public-changelog';
  let skippedChangelog = null;
  try {
    skippedChangelog = localStorage.getItem(skipChangelogKey);
  } catch (error) {}
  const proceedChangelog = node('button', 'Proceed'); proceedChangelog.type = 'button';
  proceedChangelog.id = 'game-changelog-proceed-bottom'; proceedChangelog.className = 'changelog-proceed';
  proceedChangelog.onclick = function () {
    if (changelog.hidden) return;
    skippedChangelog = changelogSkip.checked ? changelogRevision : null;
    try {
      if (skippedChangelog === null) localStorage.removeItem(skipChangelogKey);
      else localStorage.setItem(skipChangelogKey, skippedChangelog);
    } catch (error) {}
    openEditionChoices();
  };
  const changelogFooter = node('footer', ''); changelogFooter.append(changelogBack, proceedChangelog);
  const changelogActions = node('div', ''); changelogActions.className = 'changelog-actions';
  changelogActions.append(skipLabel, changelogFooter);
  changelogCard.append(changelogHeader, changelogNotes, changelogActions);
  changelogBox.append(startupBrand('changelog'), changelogCard);
  changelog.append(startupBackdrop('changelog'), changelogBox); document.body.append(changelog);

  // The preRun gate opens after an edition choice or a request to browse
  // saves. A direct load selects its edition from the committed revision.
  var editions=node('section','');editions.id='game-edition';editions.className='install-page';editions.hidden=true;editions.setAttribute('role','dialog');editions.setAttribute('aria-modal','true');editions.setAttribute('aria-labelledby','game-edition-heading');
  var editionBox=node('div',''),editionCard=node('div','');editionCard.className='install-card';
  var editionHeading=node('h1','How would you like to play?');editionHeading.id='game-edition-heading';editionHeading.tabIndex=-1;
  var editionIntro=node('p','Start a game or pick up where you left off.');editionIntro.className='edition-lead';
  var editionOptions=node('div','');editionOptions.className='edition-options';
  function editionOption(value,title,description,action){
    var b=node('button','');b.type='button';b.id='game-edition-'+value;b.setAttribute('aria-label',title);
    b.append(node('strong',title),node('small',description));b.onclick=action;editionOptions.append(b);
    return b;
  }
  function chooseMode(value){
    return async function(){
      if(!active||starting||Module.directSavedGame||(settled&&Module.gameEdition!==null&&!Module.canChangeLoadingEdition()))return;
      if(await modeNotice(value))await launchEdition(value);else openEditionChoices(value);
    };
  }
  editionOption('classic','Classic','Play with the original rules.',chooseMode('classic'));
  editionOption('enhanced','Enhanced','Choose optional enhancements.',chooseMode('enhanced'));
  var directPreviousVideos=null;
  function restoreDirectVideoPolicy(){
    if(directPreviousVideos!==null){Module.noVideos=directPreviousVideos;directPreviousVideos=null;}
  }
  async function startDirectSavedGame(target=null){
    if(!active||starting||!Module.mobileUI||Module.gameEdition!==null||Module.directSavedGame||Module.editionModalOpen)return;
    Module.directSaveTarget=target;
    Module.directSavedGame='startup';
    document.body.classList.add('direct-saved-game');
    editions.hidden=true;Module.editionSelectionOpen=false;
    const transition=Module.beginMobileScreenTransition?.(target?'save-preview':'saves');
    if(settled)return;
    directPreviousVideos=Module.noVideos;
    Module.noVideos=true;
    if(await start()){root.inert=false;root.hidden=true;}
    else{
      Module.cancelMobileScreenTransition?.(transition);
      restoreDirectVideoPolicy();Module.directSavedGame=Module.directSaveTarget=null;document.body.classList.remove('direct-saved-game');returnToPlay();
    }
  }
  var directOption=editionOption('load','Load A Saved Game','Open the save picker directly.',()=>startDirectSavedGame());
  const recentOption=node('button',''),recentArt=node('span',''),recentText=node('span',''),
    recentLabel=node('small','Last manual save'),recentName=node('strong',''),recentTime=node('time','');
  recentOption.type='button';recentOption.id='game-edition-recent';recentOption.hidden=true;
  recentArt.className='recent-art';recentArt.setAttribute('aria-hidden','true');
  recentText.className='recent-text';recentText.append(recentLabel,recentName,recentTime);
  recentOption.append(recentArt,recentText);editionOptions.append(recentOption);
  const backupOption=editionOption('backups','Backup & Transfer Files','Download, import or restore your saved games.',startStartupBackups);
  async function startStartupBackups(){
    if(!active||starting||Module.directSavedGame||Module.editionModalOpen||Module.gameEdition!==null)return;
    Module.directSavedGame='backup-startup';
    document.body.classList.add('direct-saved-game');
    editions.hidden=true;Module.editionSelectionOpen=false;
    if(settled)return;
    directPreviousVideos=Module.noVideos;
    Module.noVideos=true;
    if(await start()){root.inert=false;root.hidden=true;}
    else{restoreDirectVideoPolicy();Module.directSavedGame=null;document.body.classList.remove('direct-saved-game');returnToPlay();}
  }
  Module.finishStartupBackups=function(){
    if(Module.directSavedGame!=='backup-startup')return;
    if(!Module.openLocalSaves(()=>openEditionChoices('backups')))return;
    restoreDirectVideoPolicy();
    Module.directSavedGame=null;
    document.body.classList.remove('direct-saved-game');
  };
  let recentRequest=0;
  async function recentSave(){
    const remote=await new Promise((resolve,reject)=>{
      IDBFS.getRemoteSet({mountpoint:'/persist'},(error,result)=>error?reject(error):resolve(result));
    });
    const readMany=paths=>{
      const files=remote.db.transaction(IDBFS.DB_STORE_NAME,'readonly').objectStore(IDBFS.DB_STORE_NAME);
      return Promise.all(paths.map(path=>new Promise((resolve,reject)=>{
        IDBFS.loadRemoteEntry(files,path,(error,entry)=>error?reject(error):resolve(entry?.contents));
      })));
    };
    return SGSaveRules.recentManualSave(remote.entries,readMany);
  }
  function savedCourseIdentity(bytes){
    // The original SVE stores a career-site index, the 46-byte site table,
    // and the optional course name in the string pool. The installed image's
    // course template table supplies the same name/emblem as the native HUD.
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),site=view.getInt32(0x9d,true);
    const template=site>=0&&site<16?bytes[0x4522d+site*46+0x1c]:-1;
    const image=active.images['golf.bin'];
    const entry=template>=0&&template<16?0xc1ea8+template*130:-1;
    const offset=view.getInt16(0x4698d,true);
    const text=source=>{
      const end=source.indexOf(0);
      return new TextDecoder('windows-1252').decode(end<0?source:source.subarray(0,end)).replace(/§/g,'$').trim();
    };
    const custom=offset>=0&&offset<0x1002?text(bytes.subarray(0x4598b+offset,Math.min(0x4698d,0x4598b+offset+129))):'';
    const header=text(bytes.subarray(0,100)).replace(/^-/,'').replace(/,\s*\d+\s+\S+\s+\d{4}$/,'');
    return {name:custom||(entry>=0?text(image.subarray(entry+1,entry+130)):'')||header,
      emblem:entry>=0?image[entry]:-1};
  }
  async function refreshRecentSave(){
    const request=++recentRequest;
    recentOption.hidden=true;
    if(directOption.hidden)return;
    try{
      const save=await recentSave();
      if(!save||request!==recentRequest||editions.hidden)return;
      const course=savedCourseIdentity(save.bytes),date=new Date(save.modified);
      recentName.textContent=course.name||save.name.replace(/\.sve$/i,'');
      recentTime.textContent='Last saved '+date.toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
      recentTime.dateTime=date.toISOString();
      recentArt.replaceChildren();
      recentOption.dataset.save=save.name;
      recentOption.onclick=()=>startDirectSavedGame({name:save.name,sha256:save.sha256,revision:save.revision});
      recentOption.hidden=false;
      if(course.emblem>=0&&course.emblem<16){
        const emblem=await Module.originalMenuArt.courseEmblem(course.emblem);
        if(request===recentRequest&&!editions.hidden)recentArt.replaceChildren(emblem);
      }
    }catch(e){console.warn('Last manual save preview unavailable:',messageError(e));}
  }
  function openEditionChoices(focus){
    changelog.hidden=true;
    directOption.hidden=!Module.mobileUI||Module.gameEdition!==null;
    backupOption.hidden=directOption.hidden;
    Module.editionSelectionOpen=true;root.inert=true;root.hidden=true;editions.hidden=false;editions.scrollTop=0;
    (focus?document.getElementById('game-edition-'+focus):editionHeading)?.focus({preventScroll:true});
    refreshRecentSave();
  }
  Module.finishDirectSavedGame=function(loaded){
    if(Module.directSavedGame!=='picker')return;
    restoreDirectVideoPolicy();
    Module.directSavedGame=Module.directSaveTarget=null;
    document.body.classList.remove('direct-saved-game');
    if(!loaded&&Module.gameEdition===null)openEditionChoices('load');
  };
  var editionBack=node('button','Back');editionBack.type='button';editionBack.id='game-edition-back';
  function returnToPlay(){
    changelog.hidden=true;editions.hidden=true;Module.editionSelectionOpen=false;root.inert=false;root.hidden=false;play.focus();
    void refreshDonations();
  }
  editionBack.onclick=function(){
    if(starting)return;
    if(settled&&Module.gameEdition===null){location.reload();return;}
    if(!settled){returnToPlay();return;}
    editions.hidden=true;Module.editionSelectionOpen=false;
    document.getElementById('initial-loading-switch')?.focus({preventScroll:true});
  };
  var editionVersion=node('small',Module.buildInfo.channel==='development'?Module.buildInfo.displayVersion:'Version '+Module.buildInfo.version.replace(/^alpha/i,''));editionVersion.className='edition-version';
  var editionFooter=node('footer','');editionFooter.append(editionBack,editionVersion);
  editionCard.append(editionHeading,editionIntro,editionOptions,editionFooter);
  editionBox.append(startupBrand('edition'),editionCard);
  editions.append(startupBackdrop('edition'),editionBox);document.body.append(editions);
  css.textContent+=`
    body.direct-saved-game :is(#canvas,#map-display,#mobile-startup,#local-title-actions){visibility:hidden!important}
    :is(#game-changelog,#game-edition){z-index:1001}
    :is(#game-changelog,#game-edition)>div{margin-block:0}
    :is(#game-changelog,#game-edition) .install-card{line-height:1.3}
    #game-changelog>div{display:grid;grid-template-rows:auto minmax(0,1fr);width:100%;max-width:680px;
      min-width:0;margin-inline:auto}
    #game-changelog .install-brand{grid-template-columns:minmax(0,68px) minmax(0,206px);
      justify-content:center;padding:8px 12px;margin-bottom:10px}
    #game-changelog .install-card{display:grid;grid-template-rows:auto minmax(0,1fr) auto;
      min-height:0;min-width:0;padding:clamp(10px,3vw,20px)}
    #game-changelog .changelog-header{display:flex;align-items:baseline;justify-content:space-between;
      gap:8px 12px;flex-wrap:wrap;padding:0 2px 8px;text-align:left}
    #game-changelog h1{margin:0;font-size:clamp(22px,5vw,32px);letter-spacing:-.035em}
    #game-changelog .changelog-header p{margin:0;color:#345247;font-size:14px;font-weight:700}
    #game-changelog .changelog-notes{min-height:0;min-width:0;overflow:auto;overscroll-behavior:contain;
      border:1px solid #a1afa4;border-radius:14px;background:#fffdf4;text-align:left;overflow-wrap:break-word}
    #game-changelog details+details{border-top:1px solid #d4ded3}
    #game-changelog summary{box-sizing:border-box;min-height:44px;padding:11px 12px;
      font-weight:750;color:#163d31;cursor:pointer}
    #game-changelog details[open]>summary{background:#edf3ea}
    #game-changelog .changelog-section{padding:2px 12px 12px;font-size:15px;line-height:1.48}
    #game-changelog h2{margin:14px 0 4px;font-size:16px}
    #game-changelog .changelog-section p{margin:10px 0}
    #game-changelog :is(ul,ol){margin:7px 0 11px;padding-inline-start:21px}
    #game-changelog li+li{margin-top:5px}
    #game-changelog :is(summary,.changelog-notes):focus-visible{outline:2px solid #244781;outline-offset:-2px}
    @media (orientation:landscape) and (max-height:480px) and (min-width:480px){
      #game-changelog{padding-block:max(8px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-bottom))}
      #game-changelog>div{grid-template: minmax(0,1fr) / minmax(0,156px) minmax(0,1fr);gap:10px;max-width:850px}
      #game-changelog .install-brand{grid-template-columns:minmax(0,1fr);align-self:start;margin:0}
      #game-changelog .install-app-icon{max-width:54px;justify-self:center}
      #game-changelog .install-card{padding:8px 10px}
    }
    #game-changelog label{display:flex;align-items:center;gap:9px;min-height:44px;margin-top:8px;text-align:left;font-size:14px;cursor:pointer}
    #game-changelog input{width:19px;height:19px;margin:0;flex:none;accent-color:#245946}
    #game-changelog footer{display:flex;justify-content:space-between;gap:12px}
    #game-changelog button{min-width:96px;min-height:46px;padding:8px 16px;border:1px solid #787c70;border-radius:999px;
      background:#e8ede7;color:var(--menu-text);font:inherit;font-weight:700;cursor:pointer;touch-action:manipulation}
    #game-changelog .changelog-proceed{border-color:#897235;background:linear-gradient(#fffef2,#f4d477);box-shadow:0 2px 0 #88724055}
    #game-changelog :is(button,input):focus-visible{outline:3px solid #244781;outline-offset:3px}
    #game-edition h1{font-size:clamp(22px,4vw,32px);line-height:1.15;margin:0 0 6px;letter-spacing:-.035em}
    #game-edition .edition-lead{margin:0 0 12px;color:var(--menu-muted)}
    #game-edition .edition-options{display:grid;grid-template-columns:1fr;gap:8px;text-align:left}
    #game-edition .edition-options button{display:flex;flex-direction:column;justify-content:center;gap:3px;min-height:72px;box-sizing:border-box;width:100%;min-width:0;border:2px solid #727094;border-radius:16px;padding:10px 14px;background:linear-gradient(155deg,#fffff5,#efeddf);color:#1c2541;box-shadow:0 3px 0 #39315d30,inset 0 1px #fff;text-align:left;font:inherit;touch-action:manipulation;cursor:pointer}
    #game-edition #game-edition-enhanced{background:linear-gradient(155deg,#f7f5ff,#c3cef6);border-color:#67679b}
    #game-edition #game-edition-load{background:linear-gradient(155deg,#fffef1,#f2e1a9);border-color:#756746}
    #game-edition #game-edition-backups{grid-column:1/-1;min-height:60px;background:linear-gradient(155deg,#f5fbf3,#d8e6da);border-color:#698775}
    #game-edition #game-edition-recent{display:grid;grid-column:1/-1;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:10px;background:linear-gradient(155deg,#f5f4ff,#d1d8f4)}
    #game-edition .recent-art:empty{display:none}
    #game-edition .recent-art canvas{display:block;width:50px;height:50px;image-rendering:pixelated}
    #game-edition .recent-text{display:grid;grid-column:-2/-1;min-width:0;gap:2px;overflow-wrap:anywhere}
    #game-edition .recent-text time{font-size:13px;color:#343456}
    #game-edition .edition-options strong{font-size:clamp(18px,3vw,25px);line-height:1.15;letter-spacing:-.025em}
    #game-edition .edition-options small{font-size:13px;line-height:1.3;color:#343456}
    #game-edition footer{display:flex;justify-content:center;align-items:center;gap:12px;margin-top:12px}
    #game-edition-back{min-height:44px;min-width:80px;padding:6px 16px;background:#e1e1f3;color:#1c2541;border:1px solid #727094;border-radius:99px;font:inherit;cursor:pointer;touch-action:manipulation}
    #game-edition button:focus-visible{outline:3px solid #244781;outline-offset:3px}
    #game-edition .edition-options button:active{transform:translateY(2px);box-shadow:none}
    #game-edition .edition-version{font-size:12px;color:#343456}
    @media(min-width:620px),(min-width:460px) and (orientation:landscape){
      #game-edition .edition-options{grid-template-columns:repeat(3,minmax(0,1fr))}
      #game-edition .edition-options button{min-height:94px}
    }
    @media(max-height:450px){
      #game-edition .edition-lead{margin-bottom:8px}
      #game-edition .edition-options button{min-height:60px;padding:7px 10px}
      #game-edition .recent-art canvas{width:40px;height:40px}
      #game-edition footer{margin-top:8px}
    }
  `;
  for(const page of [changelog,editions]){
    for(const type of ['pointerdown','pointerup','pointermove','mousedown','mouseup','click','touchstart','touchmove','touchend','wheel','keydown','keyup','keypress']){
      page.addEventListener(type,e=>e.stopPropagation());
    }
  }
  // The catalog is also the feature policy, so a future explicitly Enhanced
  // addition gets a preference here without forking the shared game/runtime.
  var enhancedSettings=node('section','');enhancedSettings.id='enhanced-settings';enhancedSettings.hidden=true;enhancedSettings.setAttribute('role','dialog');enhancedSettings.setAttribute('aria-modal','true');enhancedSettings.setAttribute('aria-labelledby','enhanced-settings-heading');
  var settingsCard=node('div','');settingsCard.className='enhanced-card';
  var settingsHeader=node('header',''),settingsBrand=node('img','');settingsBrand.src=appIconURL;settingsBrand.alt='';settingsBrand.width=60;settingsBrand.height=60;
  var settingsHeadingBox=node('div',''),settingsEyebrow=node('span','ENHANCED');settingsEyebrow.className='enhanced-eyebrow';
  var settingsHeading=node('h1','Your game. Your way.');settingsHeading.id='enhanced-settings-heading';settingsHeading.tabIndex=-1;settingsHeadingBox.append(settingsEyebrow,settingsHeading);settingsHeader.append(settingsBrand,settingsHeadingBox);
  var settingsIntro=node('p','Choose the extras you’d like to play with.');settingsIntro.className='enhanced-intro';
  var settingsCompactIntro=node('p','Choose the improvements you want to use.');settingsCompactIntro.className='enhanced-compact-intro';
  var settingsTools=node('div','');settingsTools.className='enhanced-tools';var settingsCount=node('span','');settingsCount.id='enhanced-settings-count';settingsCount.setAttribute('aria-live','polite');
  var enableAll=node('button','Enable all');enableAll.type='button';enableAll.id='enhanced-enable-all';var disableAll=node('button','Disable all');disableAll.type='button';disableAll.id='enhanced-disable-all';settingsTools.append(settingsCount,enableAll,disableAll);
  var settingsList=node('div','');settingsList.className='enhanced-list';settingsList.setAttribute('role','group');settingsList.setAttribute('aria-label','Enhanced features');
  var featureInputs=new Map();
  var featureIcons={history:'<path d="M12 7v5l3 2M4 5v5h5M4 10a8 8 0 1 1 0 5"/>',analytics:'<path d="M4 20h16M6 16V9M12 16V4M18 16v-5"/>',speed:'<path d="m5 5 8 7-8 7m9-14 8 7-8 7"/>',pause:'<path d="M8 5v14M16 5v14"/>',clubhouse:'<path d="m3 11 9-8 9 8M6 9v12h12V9M10 21v-7h4v7"/>'};
  var categoryViews=new Map(),settingsBusy=false;
  for(var category of Module.featureRegistry.categories){
    var features=Module.enhancedFeatureCatalog.filter(f=>f.available&&f.category===category.id);
    if(!features.length)continue;
    var group=node('details','');group.className='enhanced-category';group.dataset.category=category.id;group.open=true;
    var summary=node('summary',''),categoryTitle=node('span',category.name),categoryCount=node('span','');categoryCount.className='enhanced-category-count';summary.append(categoryTitle,categoryCount);
    var contents=node('div','');contents.className='enhanced-category-features';group.append(summary,contents);settingsList.append(group);categoryViews.set(category.id,{count:categoryCount,features:features});
    for(var feature of features){
      let f=feature;var row=node('label','');row.className='enhanced-feature';row.htmlFor='enhanced-feature-'+f.id;
      var image=node('span','');image.className='enhanced-feature-icon';image.setAttribute('aria-hidden','true');image.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+(featureIcons[f.icon]||featureIcons.speed)+'</svg>';
      var copy=node('span','');copy.className='enhanced-feature-copy';var title=node('strong',f.name);title.id='enhanced-label-'+f.id;var description=node('span',f.description);description.id='enhanced-description-'+f.id;copy.append(title,description);
      var integration=node('span','');integration.className='enhanced-integration';integration.hidden=true;copy.append(integration);
      var switchBox=node('span','');switchBox.className='enhanced-switch-box';var input=document.createElement('input');input.type='checkbox';input.id=row.htmlFor;input.setAttribute('role','switch');input.setAttribute('aria-labelledby',title.id);input.setAttribute('aria-describedby',description.id);var onOff=node('span','');onOff.className='enhanced-on-off';onOff.setAttribute('aria-hidden','true');switchBox.append(input,onOff);row.append(image,copy,switchBox);contents.append(row);featureInputs.set(f.id,{input:input,label:onOff,row:row,integration:integration,feature:f});
      input.onchange=function(){requestFeatureChange({[f.id]:this.checked});};
    }
  }
  var settingsStatus=node('p','');settingsStatus.id='enhanced-settings-status';settingsStatus.setAttribute('role','status');settingsStatus.setAttribute('aria-live','polite');settingsStatus.hidden=true;
  var settingsFooter=node('footer',''),settingsNote=node('p','Your choices are remembered on this device.');settingsNote.id='enhanced-settings-note';var settingsActions=node('div','');settingsActions.className='enhanced-actions';var settingsBack=node('button','Back');settingsBack.type='button';settingsBack.id='enhanced-settings-back';var settingsStart=node('button','Start Enhanced');settingsStart.type='button';settingsStart.id='enhanced-settings-start';settingsActions.append(settingsBack,settingsStart);settingsFooter.append(settingsNote,settingsActions);var settingsScroll=node('div','');settingsScroll.className='enhanced-scroll';settingsScroll.append(settingsHeader,settingsIntro,settingsCompactIntro,settingsTools,settingsList,settingsStatus);settingsCard.append(settingsScroll,settingsFooter);enhancedSettings.append(settingsCard);document.body.append(enhancedSettings);
  function showSettingsStatus(message){settingsStatus.textContent=message||'';settingsStatus.hidden=!message;}
  // Sandbox and championship setup choices are separate from device defaults.
  var settingsContext='career',draftPreferences=null,settingsOwner=null;
  function settingsPreferences(){return draftPreferences||Module.enhancedPreferences;}
  function settingVisible(feature){
    if(settingsOwner)return feature.mutableDuringPlay&&feature.playContexts.includes('career');
    return feature.playContexts.includes(settingsContext)||
      (settingsContext==='sandbox'&&feature.playContexts.includes('career'));
  }
  function planSettings(changes){return Module.featureRegistry.plan(settingsPreferences(),changes);}
  function applySettings(plan){
    if(!draftPreferences)return Module.applyEnhancedPlan(plan);
    if(!plan?.ok||JSON.stringify(plan.before)!==JSON.stringify(draftPreferences))return false;
    if(Object.keys(plan.changes).some(id=>!settingVisible(Module.featureRegistry.get(id))))return false;
    draftPreferences=Module.featureRegistry.validate(plan.configuration);return true;
  }
  function refreshEnhancedSettings(){
    var total=0,count=0,valid=true;
    try{Module.featureRegistry.validate(settingsPreferences());}catch(e){valid=false;showSettingsStatus(messageError(e));}
    for(var [id,item]of featureInputs){
      var visible=settingVisible(item.feature);item.row.hidden=!visible;item.input.disabled=settingsBusy||!visible;if(!visible)continue;total++;
      var enabled=settingsPreferences()[id];item.input.checked=enabled;item.input.disabled=settingsBusy;item.label.textContent=enabled?'On':'Off';item.row.dataset.enabled=String(enabled);if(enabled)count++;
      var integrations=item.feature.integrations.filter(other=>enabled&&settingsPreferences()[other]).map(id=>Module.featureRegistry.get(id).name);
      item.integration.hidden=!integrations.length;item.integration.textContent=integrations.length?'Works with '+integrations.join(', ')+'.':'';
    }
    for(var group of categoryViews.values()){var visible=group.features.filter(settingVisible);group.count.parentElement.parentElement.hidden=!visible.length;group.count.textContent=visible.filter(f=>settingsPreferences()[f.id]).length+' / '+visible.length+' on';}
    settingsCount.textContent=count+' of '+total+' enabled';enableAll.disabled=settingsBusy||count===total;disableAll.disabled=settingsBusy||(!count&&valid);
    settingsBack.disabled=settingsBusy;settingsStart.disabled=settingsBusy||!valid;
    settingsNote.textContent=settingsContext==='load'?'These choices take effect when you enter. Save your game to keep them.':settingsOwner?'Save your game to keep these choices. Earlier saves keep their own settings.':settingsContext==='championship'?'Applies to this championship. Your career defaults stay unchanged.':settingsContext==='sandbox'?'Applies to this Sandbox game. Your career defaults stay unchanged.':Module.enhancedPreferencesSaved===false?'These choices apply to this new game. Device defaults could not be stored.':'Defaults for new games. Existing saved games keep their own choices.';
  }
  var settingsResolve=null;
  function showEnhancedSettings(title,context='career',owner=null,preferences=null,focusId=null){
    if(settingsResolve)throw Error('Feature settings are already open.');
    settingsContext=context;settingsOwner=owner;
    draftPreferences=preferences?{...preferences}:owner?Object.fromEntries(Module.enhancedFeatureCatalog.map(f=>[f.id,owner.game.features[f.id]?.enabled===true])):
      context!=='career'?Object.fromEntries(Module.enhancedFeatureCatalog.map(f=>[f.id,
        f.playContexts.includes(context==='sandbox'?'career':context)&&Module.enhancedPreferences[f.id]===true])):null;
    settingsIntro.textContent=owner?'Enable or disable enhancements for this career. Recorded feature history is kept when you switch a feature off.':
      context==='championship'?'Choose controls for championship play. Course-building and club-management features apply to careers.':
      context==='sandbox'?'Choose optional free construction and other enhancements for this Sandbox game.':'Choose the extras you’d like to play with.';
    Module.featureSettingsOpen=true;editions.hidden=true;enhancedSettings.hidden=false;settingsScroll.scrollTop=0;
    settingsHeading.textContent=title||'Your game. Your way.';settingsStart.textContent=context==='load'?'Done':owner?'Apply Changes':'Continue';
    settingsBack.textContent=owner?'Cancel':'Back';settingsBusy=false;showSettingsStatus('');
    refreshEnhancedSettings();
    const focused=featureInputs.get(focusId);
    if(focused&&!focused.row.hidden){
      focused.row.closest('details').open=true;
      focused.row.scrollIntoView({block:'center'});
      focused.input.focus({preventScroll:true});
    }else settingsHeading.focus({preventScroll:true});
    return new Promise(function(resolve){settingsResolve=resolve;});
  }
  async function finishSettings(accept){
    if(!settingsResolve||settingsBusy)return;
    if(accept)try{Module.featureRegistry.validate(settingsPreferences());}catch(e){showSettingsStatus(messageError(e));refreshEnhancedSettings();return;}
    if(accept&&!settingsOwner&&settingsContext==='sandbox'&&settingsPreferences().creativeSandbox){
      settingsBusy=true;refreshEnhancedSettings();
      var decision;
      try{
        decision=await featureResolution.show({title:'Creative Sandbox: Free Construction',paragraphs:[
          'Creative Sandbox makes valid construction free while you play. Removing construction costs takes away the budgeting challenge and can make the game less challenging.',
          'Land purchases, wages and maintenance still cost money. Original placement rules and unlock requirements remain. The setting applies to future construction.'
        ],accept:'Keep Enabled & Continue',alternate:'Disable & Continue',back:'Back To Settings'});
        if(decision==='alternate'){
          var plan=planSettings({creativeSandbox:false});
          if(!plan.ok||plan.requiresConfirmation||!applySettings(plan))throw Error(plan.error||'Return to settings to resolve the selected feature requirements before continuing.');
        }
      }catch(e){decision=false;showSettingsStatus(messageError(e));}
      finally{settingsBusy=false;refreshEnhancedSettings();settingsStart.focus({preventScroll:true});}
      if(!decision)return;
    }
    const preferences=accept?Object.assign({},settingsPreferences()):null;
    if(preferences&&!settingsOwner&&settingsContext!=='sandbox')preferences.creativeSandbox=false;
    if(preferences&&settingsOwner&&settingsContext!=='load'){
      try{Module.saveRules.reconfigure(settingsOwner,preferences);}
      catch(e){showSettingsStatus(messageError(e));return;}
    }
    const resolve=settingsResolve,career=!!settingsOwner&&settingsContext!=='load';
    settingsResolve=null;settingsOwner=null;draftPreferences=null;
    Module.featureSettingsOpen=false;enhancedSettings.hidden=true;
    if(career)document.getElementById('mobile-menu')?.focus({preventScroll:true});
    resolve(preferences);
  }
  async function requestFeatureChange(changes){
    if(settingsBusy||!settingsResolve)return;
    var restoreFocus=document.activeElement;showSettingsStatus('');var plan=planSettings(changes);refreshEnhancedSettings();
    if(!plan.ok){showSettingsStatus(plan.error);return;}
    settingsBusy=true;refreshEnhancedSettings();
    try{
      var confirmed=!plan.requiresConfirmation||await featureResolution.show({title:'Update these enhancements?',paragraphs:plan.explanations,accept:'Apply changes',back:'Keep current choices'});
      if(confirmed&&!applySettings(plan))showSettingsStatus(Module.enhancedConfigurationError||'These choices changed while the question was open. Please try again.');
    }finally{settingsBusy=false;refreshEnhancedSettings();(restoreFocus?.isConnected&&!restoreFocus.disabled?restoreFocus:settingsHeading).focus({preventScroll:true});}
  }
  enableAll.onclick=function(){requestFeatureChange(Object.fromEntries(Module.enhancedFeatureCatalog.filter(f=>f.available&&settingVisible(f)).map(f=>[f.id,true])));};
  disableAll.onclick=function(){requestFeatureChange(Object.fromEntries(Module.enhancedFeatureCatalog.filter(settingVisible).map(f=>[f.id,false])));};
  settingsBack.onclick=function(){finishSettings(false);};settingsStart.onclick=function(){finishSettings(true);};
  enhancedSettings.addEventListener('keydown',function(e){if(e.key==='Escape'){e.preventDefault();finishSettings(false);}});
  async function launchEdition(value){
    if(!active)return;
    if(settled){
      const returning=Module.gameEdition===null&&Module.editionSelectionOpen&&Module.atTitle;
      if((returning&&Module.selectGameEdition(value))||Module.switchLoadingEdition(value)||value===Module.gameEdition){
        editions.hidden=true;Module.editionSelectionOpen=false;
        (returning?document.querySelector('#startup-options button'):document.getElementById('initial-loading-switch'))?.focus({preventScroll:true});
      }
      return;
    }
    if(starting)return;
    if(await start(value)){enhancedSettings.hidden=editions.hidden=true;Module.editionSelectionOpen=false;root.inert=false;root.hidden=true;}
    else returnToPlay();
  }
  Module.requestLoadingEditionSwitch=function(){
    if(Module.editionModalOpen||!Module.canChangeLoadingEdition())return false;
    openEditionChoices();
    document.getElementById('game-edition-'+(Module.gameEdition==='classic'?'enhanced':'classic')).click();return true;
  };
  // Native callers await these browser-only dialogs on their existing JSPI
  // stack. Button callbacks never invoke the native engine themselves.
  function dialog(id, canRemember=false){
    const root=node('section','');root.id=id;root.className='rules-dialog';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');
    const card=node('div','');card.className='rules-card';const title=node('h1','');title.tabIndex=-1;title.id=id+'-title';root.setAttribute('aria-labelledby',title.id);
    const description=node('p',''),heading=node('h2',''),body=node('div',''),actions=node('footer',''),back=node('button','Back'),alternate=node('button',''),accept=node('button','I Understand');back.id=id+'-back';alternate.id=id+'-alternate';alternate.hidden=true;accept.id=id+'-accept';actions.append(back,alternate,accept);card.append(title,description,heading,body);
    let remember=null;
    if(canRemember){
      const label=node('label','');
      label.className='rules-remember';
      remember=node('input','');
      remember.type='checkbox';
      remember.id=id+'-remember';
      label.append(remember,node('span','Don’t show this message again'));
      card.append(label);
    }
    card.append(actions);root.append(card);document.body.append(root);
    let resolve=null, rememberKey=null;
    function close(ok){
      if(!resolve)return;
      if(ok&&rememberKey&&remember?.checked){
        try{localStorage.setItem(rememberKey,'1');}catch(e){}
      }
      root.hidden=true;
      Module.editionModalOpen=false;
      const r=resolve;
      resolve=null;
      rememberKey=null;
      r(ok);
    }
    back.onclick=()=>close(false);alternate.onclick=()=>close('alternate');accept.onclick=()=>close(true);root.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close(false);}});
    for(const type of ['pointerdown','pointerup','pointermove','mousedown','mouseup','click','touchstart','touchmove','touchend','wheel','keydown','keyup','keypress'])root.addEventListener(type,e=>e.stopPropagation());
    return {show(data,key=null){if(resolve)throw Error('A save notification is already open.');rememberKey=key;if(remember)remember.checked=false;title.textContent=data.title;description.textContent=data.description||'';heading.textContent=data.heading||'';body.replaceChildren(...data.paragraphs.map(p=>node('p',p)));accept.textContent=data.accept||'I Understand';alternate.textContent=data.alternate||'';alternate.hidden=!data.alternate;root.classList.toggle('rules-has-alternate',!!data.alternate);back.textContent=data.back||'Back';accept.hidden=data.single===true;back.textContent=data.single?'Back':back.textContent;root.hidden=false;Module.editionModalOpen=true;root.scrollTop=0;title.focus({preventScroll:true});return new Promise(r=>{resolve=r;});}};
  }
  var disclaimer=dialog('edition-disclaimer',true),rulesMessage=dialog('rules-message'),featureResolution=dialog('enhanced-resolution');
  const titleExit=dialog('title-exit-confirmation');
  Module.confirmTitleExit=function(){
    return titleExit.show({title:'Are you sure?',paragraphs:['Do you want to exit the game?'],back:'Cancel',accept:'Exit Game'});
  };
  const difficultyConfirmation=dialog('difficulty-confirmation');
  Module.confirmDifficulty=function(name,synopsis){
    return difficultyConfirmation.show({title:name,paragraphs:[synopsis],back:'Choose Another Difficulty',accept:'Continue'});
  };
  const golferRemoval=dialog('golfer-remove-confirmation');
  Module.confirmGolferRemoval=function(name){
    return golferRemoval.show({title:'Ask golfer to leave?',paragraphs:['Ask '+(name||'this golfer')+' to leave the course.'],back:'Cancel',accept:'Ask To Leave'});
  };
  function modeNotice(value){
    editions.hidden=true;
    // Change this notice revision if its compatibility terms change.
    const key='simgolf-edition-notice-v1-'+value;
    try{if(localStorage.getItem(key)==='1')return true;}catch(e){}
    return disclaimer.show(value==='classic'?{title:'Classic Mode',description:'Play SimGolf as close to the original experience as possible, with mobile-friendly controls.',heading:'Save Compatibility',paragraphs:['Classic saved games can be converted to Enhanced Mode later if you decide to try additional gameplay features.','Your original Classic save will be preserved when you create an Enhanced copy.']}:{title:'Enhanced Mode',description:'Customize your SimGolf experience with additional gameplay features.',heading:'Important: Save Compatibility',paragraphs:['Games saved in Enhanced Mode can only be loaded in Enhanced Mode. They cannot be opened in Classic Mode.','Your selected enhancements are saved with your game and automatically restored when you load it.','You can also bring existing Classic saves into Enhanced Mode by creating an Enhanced copy.']},key);
  }
  Module.hasEnhancedCareer=function(){
    return Module.gameEdition==='enhanced'&&Module.saveRules?.active?.game.edition==='enhanced'&&
      !(HEAP32[0x59e7b8>>2]&0x4000000);
  };
  function careerPanelReady(readOnly,removing=false){
    const s=Module.mobileState,m=Module;
    return !!(m.hasEnhancedCareer()&&m.mapCourseReady&&s?.course&&!m.atTitle&&!m.rulesetBlocked&&
      (readOnly||(!s.roundActive&&(removing||!s.constructing)))&&!s.tournamentActive&&!s.elevation&&!s.rebuildClubhouse&&!s.staffOpen&&
      !s.photoActive&&!s.fundsCheck&&!s.textInput&&!m.fundsCheck&&!m.aimMode&&!m.shotPending&&
      !m.lotMode&&!m.lotPending&&!m.terrainMode&&(m.mapMode||0)===(removing?2:0)&&!m.menuQueue?.length&&
      !m.touchQueue?.some(event=>!readOnly||event[0]!==4)&&
      !m.loadState?.active&&!m.courseLoading?.active&&!m.saveFilesOpen&&!m.backupHistoryOpen&&
      !m.elevationOverviewOpen&&!m.analyticsSession?.active&&!m.analyticsRequest&&!m.clubhouseManagementOpen&&!m.clubhousePairOpen&&
      !m.golferPairs?.active&&!m.golferHistoriesOpen&&!m.clubRecordsOpen&&!m.designChallengesOpen&&
      !m.courseDesignLabOpen&&!m.businessChallengesOpen&&!m.courseReviewOpen&&!m.mobileReportOpen&&!m.mobilePreferencesOpen&&!m.holeStats?.active&&
      !m.golferCard?.active&&!m.profileState?.active&&!m.progressScreen?.active&&!m.featureSettingsOpen&&!m.editionModalOpen);
  }
  Module.canEditCareerEnhancements=()=>careerPanelReady(false);
  Module.canSelectEyesore=removing=>careerPanelReady(false,removing);
  Module.canInspectCareerCourse=()=>careerPanelReady(true)&&Module.lotCanStart();
  Module.editCareerEnhancements=async function(focusId){
    if(!Module.canEditCareerEnhancements())return false;
    const before=Module.saveRules.active;
    const result=await showEnhancedSettings('Enhanced Settings','career',before,null,focusId);
    if(result&&before!==Module.saveRules.active)
      Module.showEditionNotice?.('Enhancement settings updated. Save your game to keep these choices.');
    return !!result;
  };
  Module.prepareNewRules=async function(context='career'){
    try{
      if(Module.saveRules.draft)return true;
      const title=context==='championship'?'Championship Settings':context==='sandbox'?'Sandbox Mode':'New Enhanced Game';
      const enhanced=Module.gameEdition==='enhanced';
      const preferences=enhanced?await showEnhancedSettings(title,context):{};
      const ready=!!preferences&&Module.saveRules.beginNew(preferences,context);
      if(ready&&enhanced&&context==='championship')Module.beginMobileScreenTransition?.('difficulty');
      return ready;
    }
    catch(e){await rulesMessage.show({title:'New game unavailable',paragraphs:[messageError(e)],single:true});return false;}
  };
  Module.editSavedGameEnhancements=function(association,preferences){
    const features=association.revision.features||association.game.features;
    return showEnhancedSettings('Enhanced Settings','load',{game:{features}},preferences);
  };
  Module.prepareRulesetLoad=async function(name,preview,reviewPreferences){
    try{
      const automatic=Module.directSavedGame==='picker'&&Module.gameEdition===null;
      const source=await Module.saveRules.prepareLoad(name,automatic,preview,reviewPreferences);
      if(source.kind===Module.gameEdition||(automatic&&source.association))return name;
      const legacy=source.kind==='legacy';
      let target=Module.gameEdition;
      if(automatic){
        const choice=await rulesMessage.show({title:'Choose a mode for this save',description:name,
          paragraphs:['This older save has no recorded edition. Choose a mode to make a separate playable copy.'],
          accept:'Create Classic Copy',alternate:'Create Enhanced Copy',back:'Back'});
        if(!choice)return null;
        target=choice==='alternate'?'enhanced':'classic';
      }else{
        const ok=await rulesMessage.show({title:legacy?'Unclassified saved game':'Create an Enhanced copy',description:name,heading:'Keep the original',paragraphs:legacy?['Earlier SGMobile builds did not record an edition or its feature choices. We cannot determine how this save was played.','The three earlier enhancements used the original save format: speed is temporary, pause is an original game flag, and clubhouse movement uses original building data. Create a separate compatible copy; the original remains unchanged.','A standalone .sve does not include future Enhanced feature data. If this came from a newer Enhanced build, recover its complete backup instead.']:['This is a Classic save. Choose enhancements for a new, separate Enhanced copy. Your original Classic save will remain unchanged.'],accept:target==='enhanced'?'Create Enhanced copy':'Create Classic copy'});
        if(!ok)return null;
      }
      const preferences=target==='enhanced'?await showEnhancedSettings(legacy?'Configure Enhanced copy':'Upgrade Classic save'):{};if(!preferences)return null;
      const association=await Module.saveRules.copyAssociation(source,target,preferences),bytes=FS.readFile('/game/'+(FS.readdir('/game').find(n=>n.toLowerCase()==='saved games')||'Saved Games')+'/'+name).slice();
      const stem=(target==='enhanced'?'Enhanced ':'Classic ')+name.replace(/\.sve$/i,'').replace(/[^\x20-\x7e]/g,'_').slice(0,52);let copy=stem+'.sve',suffix=1;
      const dir='/game/'+(FS.readdir('/game').find(n=>n.toLowerCase()==='saved games')||'Saved Games');while(FS.readdir(dir).some(n=>n.toLowerCase()===copy.toLowerCase()))copy=stem+' ('+(suffix++)+').sve';
      await Module.saveImport(copy,bytes,association);
      if(!await Module.persistFlush())throw Error('The copy could not be stored. The source is unchanged. Keep this page open, export a backup and check available device storage.');
      await Module.saveRules.prepareLoad(copy,automatic);return copy;
    }catch(e){Module.saveRules.cancelLoad();await rulesMessage.show({title:'Saved game unavailable',paragraphs:[messageError(e),'Your original save has been kept. Preserve this browser data. Use Backup & Transfer Files to download a native backup; missing SGMobile metadata must be recovered before its associated game can load.'],single:true});return null;}
  };
  css.textContent+=`
    .rules-remember{display:flex;align-items:center;gap:10px;min-height:44px;margin:4px 0 8px;cursor:pointer}
    .rules-remember input{width:20px;height:20px;margin:0;flex:none;accent-color:var(--menu-focus)}
    .rules-dialog[hidden]{display:none!important}
    .rules-dialog{position:fixed;inset:0;z-index:1004;display:flex;overflow:auto;box-sizing:border-box;overscroll-behavior:contain;padding:max(20px,env(safe-area-inset-top)) max(18px,env(safe-area-inset-right)) max(20px,env(safe-area-inset-bottom)) max(18px,env(safe-area-inset-left));background:radial-gradient(ellipse at 25% 0%,#faf9ff,#ceceeb 55%,#9e9ec8);color:#1c2541;font:16px/1.5 system-ui,sans-serif}
    .rules-card{width:100%;max-width:650px;flex:none;margin:auto;padding:clamp(18px,4vw,30px);box-sizing:border-box;border:1px solid #79749c;border-radius:26px;background:linear-gradient(150deg,#fbfaff,#e0e3f6);box-shadow:0 6px 24px #39315d25}
    .rules-dialog h1{font-size:clamp(25px,5vw,34px);line-height:1.15;margin:0 0 12px}.rules-dialog h2{font-size:18px;margin:22px 0 10px}.rules-dialog p{margin:12px 0;overflow-wrap:break-word}.rules-dialog footer{display:flex;gap:12px;position:sticky;bottom:0;background:#e4e6f7;padding-top:14px}.rules-dialog button{flex:1;min-height:48px;border:1px solid #79749c;border-radius:99px;background:#efeff9;color:#1c2541;padding:10px 16px;font:inherit;touch-action:manipulation;cursor:pointer}.rules-dialog button:last-child{background:linear-gradient(#fffef2,#ffdf75);font-weight:700}.rules-dialog button:focus-visible{outline:3px solid #244781;outline-offset:3px}
    .rules-has-alternate footer{flex-wrap:wrap}.rules-has-alternate footer button{flex:1 1 180px}
  `;
  for(var type of ['pointerdown','pointerup','pointermove','mousedown','mouseup','click','touchstart','touchmove','touchend','wheel','keydown','keyup','keypress'])enhancedSettings.addEventListener(type,function(e){e.stopPropagation();});
  css.textContent+=`
    #enhanced-settings[hidden],#enhanced-settings [hidden]{display:none!important}
    #enhanced-settings{position:fixed;inset:0;z-index:1001;display:flex;overflow:hidden;box-sizing:border-box;overscroll-behavior:contain;padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));background:radial-gradient(ellipse at 12% 0%,#f8f7ff,#d0d0ed 50%,#9e9ec8);color:#1c2541;font:16px/1.5 system-ui,-apple-system,sans-serif}
    #enhanced-settings .enhanced-card{width:100%;max-width:760px;max-height:100%;min-height:0;display:flex;flex-direction:column;margin:auto}
    #enhanced-settings .enhanced-scroll{min-height:0;overflow:auto;overscroll-behavior:contain;touch-action:pan-y;padding:4px 4px 12px;scroll-padding:8px}
    #enhanced-settings header{display:flex;align-items:center;gap:12px;margin-bottom:8px}
    #enhanced-settings header img{width:48px;height:48px;border-radius:14px;box-shadow:0 4px 14px #39315d25;flex:none}
    #enhanced-settings .enhanced-eyebrow{font-size:11px;letter-spacing:.18em;font-weight:800;color:#514b7c}
    #enhanced-settings h1{font-size:clamp(23px,4vw,30px);line-height:1.15;letter-spacing:-.035em;margin:3px 0 0}
    #enhanced-settings .enhanced-intro{margin:0 0 12px;color:#343456}
    #enhanced-settings .enhanced-compact-intro{display:none;margin:0 0 6px;color:#343456}
    #enhanced-settings .enhanced-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}
    #enhanced-settings-count{margin-right:auto;font-size:13px;font-weight:650;color:#514b7c}
    #enhanced-settings button{min-height:48px;border:1px solid #79749c;border-radius:999px;padding:10px 16px;background:#efeff9;color:#1c2541;font:inherit;touch-action:manipulation;cursor:pointer}
    #enhanced-settings .enhanced-tools button{min-height:44px;font-size:13px;padding:8px 12px}
    #enhanced-settings button:disabled{opacity:.45;cursor:default}
    #enhanced-settings .enhanced-list{display:flex;flex-direction:column;gap:10px}
    #enhanced-settings .enhanced-category{border:1px solid #a19dc0;border-radius:18px;overflow:clip;background:#eeeeF8a8}
    #enhanced-settings summary{min-height:48px;box-sizing:border-box;cursor:pointer;padding:11px 12px;font-size:15px;line-height:24px;font-weight:700;touch-action:manipulation}
    #enhanced-settings .enhanced-category-count{float:right;font-size:12px;font-weight:500;margin-left:8px;color:#514b7c}
    #enhanced-settings .enhanced-category-features{display:flex;flex-direction:column;gap:6px;padding:0 6px 6px}
    #enhanced-settings .enhanced-feature{display:grid;grid-template-columns:32px minmax(0,1fr) 52px;align-items:center;gap:10px;padding:12px 10px;border:1px solid #b5b0ce;border-radius:13px;background:linear-gradient(130deg,#f9f8ffeb,#e4e6f7dc);cursor:pointer;touch-action:manipulation}
    #enhanced-settings .enhanced-feature[data-enabled=true]{border-color:#7777ad;background:linear-gradient(130deg,#fbfaff,#dbe1fa)}
    #enhanced-settings .enhanced-feature-icon{width:32px;height:36px;display:grid;place-items:center;border-radius:11px;background:#c4c9ef;color:#3e467c}
    #enhanced-settings .enhanced-feature-icon svg{width:23px;height:23px}
    #enhanced-settings .enhanced-feature-copy{min-width:0;overflow-wrap:anywhere}
    #enhanced-settings .enhanced-feature-copy strong{display:block;font-size:16px;line-height:1.3;margin-bottom:4px}
    #enhanced-settings .enhanced-feature-copy>span{display:block;font-size:13px;line-height:1.45;color:#454569}
    #enhanced-settings .enhanced-feature-copy>[hidden]{display:none}
    #enhanced-settings .enhanced-switch-box{display:flex;flex-direction:column;align-items:center;gap:4px;min-height:48px;justify-content:center}
    #enhanced-settings input{appearance:none;-webkit-appearance:none;position:relative;display:block;flex:none;box-sizing:border-box;width:52px;height:30px;margin:0;border:1px solid #8883a7;border-radius:99px;background:#b5b3cb;cursor:pointer;touch-action:manipulation;transition:background .18s ease}
    #enhanced-settings input::after{content:'';position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 4px #39315d44;transition:transform .18s ease}
    #enhanced-settings input:checked{background:#4d639f;border-color:#3f5289}#enhanced-settings input:checked::after{transform:translateX(22px)}
    #enhanced-settings .enhanced-on-off{font-size:11px;line-height:14px;font-weight:700;color:#514b7c}
    #enhanced-settings footer{flex:none;position:static;margin-top:6px;padding:8px 4px 2px;border-top:1px solid #a19dc0}
    #enhanced-settings-note{margin:0 0 6px;font-size:12px;line-height:1.35;color:#454569;text-align:center}
    #enhanced-settings-status{border:1px solid #9a8254;border-radius:12px;padding:10px;background:#fff2c9;color:#4c3a27;font-size:14px;overflow-wrap:anywhere}
    #enhanced-settings .enhanced-actions{display:flex;gap:10px}
    #enhanced-settings-back{flex:1}#enhanced-settings-start{flex:2;background:linear-gradient(#fffef2,#ffdf75)!important;border-color:#67628e!important;font-weight:750!important;box-shadow:inset 0 1px #fff,0 3px 0 #72709444}
    #enhanced-settings :is(input,button,summary):focus-visible{outline:3px solid #244781;outline-offset:2px}
    @media(max-width:360px){#enhanced-settings .enhanced-feature{grid-template-columns:24px minmax(0,1fr) 52px;gap:8px;padding:10px 8px}#enhanced-settings .enhanced-feature-icon{width:24px;background:none}#enhanced-settings summary{font-size:14px}#enhanced-settings-count{width:100%}#enhanced-settings .enhanced-tools button{flex:1}}
    @media(max-height:500px){
      #enhanced-settings header{gap:8px;margin-bottom:4px}
      #enhanced-settings header img{width:32px;height:32px;border-radius:10px}
      #enhanced-settings .enhanced-eyebrow,#enhanced-settings .enhanced-intro{display:none}
      #enhanced-settings h1{font-size:24px;margin:0}
      #enhanced-settings .enhanced-compact-intro{display:block}
      #enhanced-settings .enhanced-tools{margin-bottom:6px}
      #enhanced-settings summary{min-height:44px;padding-block:9px}
      #enhanced-settings .enhanced-feature{padding-block:8px}
    }
    @media(prefers-reduced-motion:reduce){#enhanced-settings input,#enhanced-settings input::after{transition:none}}

  `;

  // Own modal keyboard input at window capture, before SDL registers its
  // handlers. A bulk button can become disabled and drop focus to body;
  // Escape must still dismiss this dialog rather than queue a native key.
  var modalReleaseKey='';
  function currentEditionModal(){return Module.editionModalOpen?document.querySelector('.rules-dialog:not([hidden])'):Module.featureSettingsOpen?enhancedSettings:Module.editionSelectionOpen?editions:!changelog.hidden?changelog:null;}
  addEventListener('keyup',function(e){
    if(modalReleaseKey&&e.key===modalReleaseKey){modalReleaseKey='';e.preventDefault();e.stopImmediatePropagation();}
    // Other releases may clear keys held before this modal opened.
  },true);
  addEventListener('keydown',function(e){
    const modal=currentEditionModal();if(!modal){if(modalReleaseKey===e.key){e.preventDefault();e.stopImmediatePropagation();}return;}
    e.stopImmediatePropagation();
    const controls=Array.from(modal.querySelectorAll('button,input,summary,a[href]')).filter(b=>!b.disabled&&!b.hidden&&b.getClientRects().length);
    if(e.key==='Escape'){
      e.preventDefault();modalReleaseKey=e.key;
      if(!e.repeat){if(modal===enhancedSettings)finishSettings(false);else modal.querySelector('button[id$="-back"]:not(:disabled)')?.click();}
    }else if(e.key==='Tab'){
      e.preventDefault();modalReleaseKey=e.key;const i=controls.indexOf(document.activeElement);
      if(controls.length)controls[i<0?(e.shiftKey?controls.length-1:0):(i+(e.shiftKey?-1:1)+controls.length)%controls.length].focus();
    }else if(e.key==='Enter'||e.key===' '){
      e.preventDefault();modalReleaseKey=e.key;
      const control=e.target.closest?.('button,input[type="checkbox"],summary,a[href]');
      if(!e.repeat&&control&&!control.disabled&&modal.contains(control))control.click();
      else if(!modal.contains(document.activeElement))controls[0]?.focus();
    }
  },true);

  function chooseEdition(){
    if(!active||settled||worker)return;
    if(!Module.noVideos)Module.prepareBinkAudio?.();
    if(skippedChangelog===changelogRevision){openEditionChoices();return;}
    root.inert=true;root.hidden=true;changelogSkip.checked=false;changelog.hidden=false;changelog.scrollTop=0;changelogNotes.scrollTop=0;
    changelogHeading.focus({preventScroll:true});
  }
  Module.showEditionNotice=function(message){
    var notice=document.getElementById('game-edition-notice');
    if(!notice){notice=node('div','');notice.id='game-edition-notice';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');document.body.append(notice);}
    notice.textContent=message;notice.hidden=false;clearTimeout(Module.editionNoticeTimer);Module.editionNoticeTimer=setTimeout(function(){notice.hidden=true;},6000);
  };
  css.textContent+='#game-edition-notice[hidden]{display:none!important}#game-edition-notice{position:fixed;z-index:1002;bottom:calc(max(12px,env(safe-area-inset-bottom)) + 76px);left:max(16px,env(safe-area-inset-left));right:max(16px,env(safe-area-inset-right));max-width:540px;margin:auto;padding:16px 20px;box-sizing:border-box;border:1px solid #727094;border-radius:16px;background:#ededf8f5;color:#1c2541;box-shadow:0 4px 18px #1c254133;font:15px/1.5 system-ui,sans-serif;pointer-events:none}';
  play.onclick = chooseEdition;
  replace.onclick = function () { quickGuide.hidden = false; picker.hidden = false; selected = []; cancel.hidden = false; play.hidden = true; replace.hidden = true; status('selecting', 'Choose replacement files. Your current installation and saves will be preserved.'); };
  cancel.onclick = function () {
    if (worker) { worker.terminate(); worker = null; }
    selected = []; picker.disabled = false; picker.value = ''; bar.hidden = true;
    if (active) installedView(); else { cancel.hidden = true; status('selecting', 'Import cancelled. Choose your original files to try again.'); }
  };
  picker.onchange = function () {
    if (!picker.files.length || worker) return;
    if(!Module.noVideos)Module.prepareBinkAudio?.();
    for (var file of picker.files) if (!selected.some(function (old) { return old.name === file.name && old.size === file.size; })) selected.push(file);
    picker.value = ''; picker.disabled = true; cancel.hidden = false; bar.hidden = false; bar.value = 0;
    status('importing', 'Checking your files…');
    var job = worker = new Worker(new URL('install-worker.js', base));
    worker.onmessage = async function (event) {
      if (worker !== job) return;
      var m = event.data;
      if (m.progress !== undefined) { bar.value = m.progress; status('importing', m.text); }
      if (m.error) { worker.terminate(); worker = null; picker.disabled = false; status('error', m.error, true); }
      if (m.done) {
        worker.terminate(); worker = null;
        try { active = await discover(); if (!active) throw new Error('The completed installation could not be validated.'); picker.disabled = false; selected = []; installedView(); }
        catch (e) { picker.disabled = false; status('error', messageError(e), true); }
      }
    };
    worker.onerror = function () { if (worker !== job) return; if (worker) worker.terminate(); worker = null; picker.disabled = false; status('error', 'Import stopped. Your previous installation and saves are preserved. Choose files to retry.', true); };
    worker.postMessage({files:selected, options:{convertVideos:false}});
  };
  // File transfer and retained snapshots share the mobile Backup & Transfer Files page.
  var saveRoot = node('section', ''); saveRoot.id = 'local-save-files'; saveRoot.hidden = true;
  saveRoot.setAttribute('role', 'dialog'); saveRoot.setAttribute('aria-modal', 'true');
  var saveBox = node('div', ''), saveHeading = node('h1', 'Backup & Transfer Files'), saveInfo = node('p', 'Download a native save or restore a backup with its SGMobile rules.');
  var saveInput = document.createElement('input'); saveInput.type = 'file'; saveInput.accept = '.sve,.sgsave'; saveInput.multiple = true; saveInput.id = 'local-save-import'; saveInput.setAttribute('aria-label', 'Import saved games');
  saveInput.hidden = true;
  var saveChoose = node('button', 'Import from Files…'); saveChoose.id = 'local-save-choose';
  var saveHelp = node('p', '');
  var saveFormats = node('dl', ''); saveFormats.className = 'save-formats';
  var portableLabel = 'Portable Backup (.sgsave)';
  function addSaveFormat(name, description) {
    var format = node('div', '');
    format.append(node('dt', name), node('dd', description));
    saveFormats.append(format);
  }
  addSaveFormat('Original SimGolf Save (.sve)', 'Original SimGolf save. Enhanced feature data is not included.');
  addSaveFormat('Portable SGMobile Backup (.sgsave)', 'Includes your saved game and matching Enhanced settings and history.');
  var saveList = node('div', ''), saveClose = node('button', 'Back to game'); saveClose.id = 'local-save-close';
  var saveTabs=node('nav','');saveTabs.setAttribute('aria-label','Backup and transfer views');saveTabs.className='save-views';
  var filesTab=node('button','Saved games'),historyTab=node('button','Backup history');filesTab.id='local-saved-games';historyTab.id='local-backup-history';saveTabs.append(filesTab,historyTab);
  var historyView=false,historyRequest=0,saveReturnFocus=null,saveReturn=null;
  function closeSaves(){
    if(transferBusy)return;
    saveRoot.hidden=true;Module.saveFilesOpen=Module.backupHistoryOpen=false;historyRequest++;
    const onClose=saveReturn;saveReturn=null;
    if(onClose)onClose();else saveReturnFocus?.focus?.({preventScroll:true});
  }
  saveClose.onclick=closeSaves;
  saveRoot.addEventListener('keydown',function(e){if(e.key==='Escape'){e.preventDefault();closeSaves();}});
  saveInfo.id = 'local-save-status'; saveInfo.setAttribute('role', 'status'); saveInfo.setAttribute('aria-live', 'polite');
  var saveToolbar=node('header','');saveToolbar.className='save-toolbar';saveToolbar.append(saveHeading,saveClose);saveBox.append(saveToolbar, saveTabs, saveFormats, saveHelp, saveChoose, saveInput, saveInfo, saveList); saveRoot.append(saveBox); document.body.append(saveRoot);
  css.textContent += '#local-save-files[hidden],#local-title-actions[hidden],#local-title-saves[hidden]{display:none!important}#local-save-files{position:fixed;left:var(--screen-left,0px);top:var(--screen-top,0px);width:var(--screen-width,100%);height:var(--screen-height,100dvh);z-index:999;background:var(--menu-bg);color:var(--menu-text);overflow:auto;padding:max(24px,env(safe-area-inset-top)) max(18px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(18px,env(safe-area-inset-left));box-sizing:border-box;font:17px/1.5 system-ui,sans-serif}#local-save-files>div{max-width:650px;margin:auto}#local-save-files button,#local-title-saves{font:inherit;min-height:48px;padding:10px 14px;background:var(--menu-button);color:var(--menu-text);border:1px solid var(--menu-border);border-radius:8px;margin:6px 0}#local-save-files input{font:inherit;max-width:100%}#local-save-files .save-file{display:flex;justify-content:space-between;align-items:center;gap:10px;border-bottom:1px solid var(--menu-line)}#local-save-files .save-file span{overflow-wrap:anywhere}#local-title-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;position:fixed;left:calc(var(--screen-left,0px) + max(12px,env(safe-area-inset-left)));bottom:calc(var(--screen-bottom-gap,0px) + max(12px,env(safe-area-inset-bottom)));right:calc(var(--screen-right-gap,0px) + max(12px,env(safe-area-inset-right)));z-index:50}';
  for (var type of ['pointerdown','pointerup','pointermove','mousedown','mouseup','click','touchstart','touchmove','touchend','wheel','keydown','keyup','keypress']) saveRoot.addEventListener(type, function (e) { e.stopPropagation(); });
  var titleActions = node('div', ''); titleActions.id = 'local-title-actions'; titleActions.hidden = true;
  var titleSaves = node('button', 'Backup & Transfer Files'); titleSaves.id = 'local-title-saves'; titleSaves.hidden = true; titleActions.append(titleSaves); document.body.append(titleActions);
  function saveFolder() { return '/game/' + (FS.readdir('/game').find(function (d) { return d.toLowerCase() === 'saved games'; }) || 'Saved Games'); }
  var transferBusy = false;
  var previewScratchSave = /^while_browsing\.sve$/i;
  function transferStatus(phase, message, name, reveal = true) {
    saveInfo.textContent = message;Module.saveTransfer = {phase:phase,name:name||'',message:message};
    if (reveal) saveInfo.scrollIntoView?.({block:'nearest'});
  }
  function transferLock(busy) {
    transferBusy=busy;saveChoose.disabled=saveInput.disabled=filesTab.disabled=historyTab.disabled=busy;
    for(var b of saveList.querySelectorAll('button'))b.disabled=busy;
    saveClose.disabled=busy;saveRoot.setAttribute('aria-busy',String(busy));
  }
  function canShareFile(file) {
    try { return !!navigator.share && !!navigator.canShare?.({files:[file]}); } catch (_) { return false; }
  }
  function exportSave(name,choose){if(!confirm('Standalone .sve export contains only the original game. It does NOT preserve Enhanced features, golfer records or career metadata. Use Portable Backup (.sgsave) to transfer an Enhanced career. Download native file anyway?'))return;return exportBytes(name,FS.readFile(saveFolder()+'/'+name),choose);}
  async function exportBytes(name,bytes,choose) {
    if(transferBusy)return;transferLock(true);
    try {
      // Snapshot the current save synchronously. Invoke native pickers/sharing
      // inside the click's activation, before any persistence/network await.
      var file = new File([bytes],name,{type:'application/octet-stream'});
      if(choose && typeof window.showSaveFilePicker==='function') {
        transferStatus('choosing','Choose where to save '+name+'.',name);
        var handle=await window.showSaveFilePicker({suggestedName:name,id:'simgolf-save-backups',startIn:'documents',types:[{description:'SimGolf saved game',accept:{'application/octet-stream':['.sve','.sgsave']}}]});
        var writable=await handle.createWritable();
        try { await writable.write(file);await writable.close(); } catch(error) { try { await writable.abort(); } catch(_) {} throw error; }
        transferStatus('saved','Saved '+name+' to the location you chose.',name);
      } else if(choose && canShareFile(file)) {
        transferStatus('sharing','Choose Save to Files or another destination for '+name+'.',name);
        await navigator.share({files:[file],title:name});
        transferStatus('shared','Returned from sharing '+name+'. If you chose Save to Files, look in the folder you selected.',name);
      } else {
        var href=URL.createObjectURL(file),a=document.createElement('a');a.href=href;a.download=name;a.hidden=true;document.body.append(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(href);},60000);
        transferStatus('download-requested','Download requested: '+name+'. Check Downloads in your browser or the Files app. Your browser controls the download location; this app cannot confirm the file reached that folder.',name);
      }
    } catch(error) {
      transferStatus(error.name==='AbortError'?'cancelled':'error',error.name==='AbortError'?'Save cancelled. Your local saved game is unchanged.':'Could not export '+name+': '+messageError(error)+'. Your local saved game is unchanged; try Download instead.',name);
    } finally { transferLock(false); }
  }
  function listSaves() {
    saveList.replaceChildren();
    // Use the same persistent write/modified time as Continue. Lazy original
    // files have no saved timestamp; their fetch time must not make them new.
    var saves=FS.readdir(saveFolder()).filter(function(n){return /\.sve$/i.test(n)&&!previewScratchSave.test(n);}).map(function(name){
      return {name:name,modified:Module.gameFileModified?.('Saved Games/'+name)||null};
    }).sort(function(a,b){return (b.modified||0)-(a.modified||0)||a.name.localeCompare(b.name);});
    for (var saved of saves) {
      var name=saved.name,row=node('div','');row.className='save-file';row.dataset.save=name;
      var details=node('div','');details.className='save-file-details';details.append(node('span',name));
      var date=node('time',saved.modified?'Last saved '+new Date(saved.modified).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'Save time unavailable');
      if(saved.modified)date.dateTime=new Date(saved.modified).toISOString();details.append(date);row.append(details);
      (function (name) {
        var actions=node('div','');actions.className='save-file-actions';
        var example=new File([FS.readFile(saveFolder()+'/'+name)],name,{type:'application/octet-stream'});
        if(typeof window.showSaveFilePicker==='function'||canShareFile(example)) {
          var choose=node('button','Save to…');choose.setAttribute('aria-label','Save to '+name);choose.onclick=function(){exportSave(name,true);};actions.append(choose);
        }
        var download = node('button', 'Download .sve'); download.setAttribute('aria-label', 'Download native save ' + name);
        download.onclick = function () { exportSave(name,false); };actions.append(download);
        const portable=node('button',portableLabel);portable.setAttribute('aria-label','Portable backup '+name);portable.onclick=async function(){
          if(transferBusy)return;transferLock(true);try{const assessment=await Module.saveRules.assess(name);if(!assessment.association)throw Error('This is an unclassified native save. Use Download .sve for a standalone save.');const bytes=FS.readFile(saveFolder()+'/'+name).slice(),bundle=await SGSaveBundle.encode(name,bytes,assessment.association,Module.saveRules),out=name.replace(/\.sve$/i,'')+'.sgsave';portable.textContent='Download .sgsave';portable.onclick=()=>exportBytes(out,bundle,false);transferStatus('ready','Portable backup ready: '+out+'. Tap Download .sgsave to export this exact saved revision.',out);}catch(e){transferStatus('error',messageError(e));}finally{transferLock(false);}};actions.append(portable);row.append(actions);
      })(name);
      saveList.append(row);
    }
    if (!saveList.childNodes.length) saveList.append(node('p', 'No local saved games yet.'));
  }
  css.textContent+='#local-save-files .save-file-details{flex:1 1 220px;min-width:0}#local-save-files .save-file-details time{display:block;font-size:.85em;opacity:.8;margin-top:3px}#local-save-files .save-file-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;max-width:100%;min-width:0;margin-inline-start:auto}#local-save-files .save-file{flex-wrap:wrap;padding:10px 0}#local-save-status{position:sticky;top:max(8px,env(safe-area-inset-top));z-index:2;padding:10px;background:var(--menu-panel);border-radius:8px;overflow-wrap:break-word}';
  function snapshotFilename(snap){return 'Backup '+new Date(snap.time).toISOString().replace(/[:.]/g,'-')+' '+snap.id+'.sve';}
  async function snapshotAction(id,restore){
    if(transferBusy)return;transferLock(true);
    try{
      const snap=await Module.saveHistory.get(id);
      if(!snap)throw new Error('That backup is no longer available. Reopen Backup history to refresh the list.');
      if(!restore){
        if(snap.association){const bundle=await SGSaveBundle.encode(snapshotFilename(snap),new Uint8Array(snap.bytes),snap.association,Module.saveRules),b=node('button','Download .sgsave');b.id='snapshot-portable-download';b.onclick=()=>exportBytes(snapshotFilename(snap).replace(/\.sve$/i,'')+'.sgsave',bundle,false);saveInfo.replaceChildren(document.createTextNode('Portable backup ready for this exact saved revision. '),b);saveInfo.scrollIntoView?.({block:'nearest'});Module.saveTransfer={phase:'ready',name:snapshotFilename(snap)};}
        else {transferLock(false);if(confirm('This snapshot has no Enhanced metadata. Downloading .sve preserves native game data only. Continue?'))await exportBytes(snapshotFilename(snap),snap.bytes,false);}return;}
      let name='Restored '+new Date(snap.time).toISOString().replace(/[:.]/g,'-')+' '+snap.id+'.sve',suffix=1;
      const base=name.slice(0,-4);while(FS.readdir(saveFolder()).some(n=>n.toLowerCase()===name.toLowerCase()))name=base+' ('+(suffix++)+').sve';
      await Module.saveImport(name,new Uint8Array(snap.bytes),snap.association);
      if(!await Module.persistFlush())throw new Error('The restored copy could not be stored durably. Keep this page open and download the original backup.');
      transferStatus('restored','Restored a separate saved game: '+name+'. Back to game, then Continue or Load game to open it. Your current game and the original backup are unchanged.',name);
    }catch(error){transferStatus('error',messageError(error));}
    finally{transferLock(false);}
  }
  async function listHistory(){
    const request=++historyRequest;saveList.replaceChildren(node('p','Loading backup history…'));
    try{
      if(!Module.saveHistory)throw new Error('Backup history is not ready yet.');
      const snaps=await Module.saveHistory.list();if(request!==historyRequest||!historyView||saveRoot.hidden)return;
      saveList.replaceChildren();
      for(const snap of snaps){
        const row=node('div','');row.className='save-file';row.dataset.snapshot=String(snap.id);
        const details=node('div','');details.className='save-file-details';details.append(node('span',snap.name.replace(/^&/,'')),node('small',snap.edition?((snap.edition==='enhanced'?'Enhanced':'Classic')+' backup · rules included for local restore'):'Unclassified legacy backup'));
        const date=node('time',new Date(snap.time).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}));date.dateTime=new Date(snap.time).toISOString();details.append(date,node('small',Math.round(snap.size/1024)+' KB'));row.append(details);
        const actions=node('div','');actions.className='save-file-actions';
        const restore=node('button','Restore copy');restore.setAttribute('aria-label','Restore backup '+snap.id);restore.onclick=()=>snapshotAction(snap.id,true);
        const download=node('button',snap.edition?portableLabel:'Download .sve');download.setAttribute('aria-label','Download backup '+snap.id);download.onclick=()=>snapshotAction(snap.id,false);actions.append(restore,download);row.append(actions);saveList.append(row);
      }
      if(!snaps.length)saveList.append(node('p','No backup snapshots yet. Save a game, or play for three minutes to create an autosave.'));
      if(transferBusy)for(const b of saveList.querySelectorAll('button'))b.disabled=true;
    }catch(error){if(request===historyRequest){saveList.replaceChildren(node('p','Backup history unavailable: '+messageError(error)));}}
  }
  function selectSaveView(history){
    if(transferBusy)return;historyView=history;Module.backupHistoryOpen=history;historyRequest++;
    filesTab.setAttribute('aria-pressed',String(!history));historyTab.setAttribute('aria-pressed',String(history));
    saveChoose.hidden=history;saveInput.hidden=true;
    saveHelp.textContent=history?'Newest first · 20 recent backups, plus up to 20 older copies at 30-minute intervals. Restore copy keeps the backup’s data in a separate local save. Unclassified backups export as .sve.':'Save your game before exporting to include recent play. Save to… exports .sve. Import from Files… accepts both formats.';
    transferStatus('ready',history?'Backup history · saved games and autosaves':'Choose a save to export or import a file.',undefined,false);
    if(history)listHistory();else listSaves();
  }
  filesTab.onclick=()=>selectSaveView(false);historyTab.onclick=()=>selectSaveView(true);
  css.textContent+='#local-save-files .save-views{display:flex;gap:8px;flex-wrap:wrap}#local-save-files .save-views button[aria-pressed="true"]{background:var(--menu-selected,#fff3a0);box-shadow:inset 0 0 0 2px var(--menu-border)}#local-save-files small{display:block;opacity:.7}#local-save-files [hidden]{display:none!important}#local-save-files .save-toolbar{position:sticky;top:0;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--menu-bg);padding:4px 0 10px}#local-save-files .save-toolbar h1{font-size:27px;line-height:1.15;margin:4px 0}#local-save-close{flex-shrink:0}#local-save-status{position:static;font-size:15px;line-height:1.35;margin:8px 0}#local-save-files .save-formats+p{font-size:14px;line-height:1.4}#local-save-files .save-file-actions button{font-size:16px;max-width:100%;min-width:0;overflow-wrap:anywhere}';
  css.textContent+=`
    #local-save-files .save-formats{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:8px;margin:10px 0}
    #local-save-files .save-formats div{padding:8px 10px;border:1px solid var(--menu-border);border-radius:8px;background:var(--menu-panel);font-size:14px;line-height:1.35;overflow-wrap:anywhere}
    #local-save-files .save-formats dt{font-weight:700}
    #local-save-files .save-formats dd{margin:2px 0 0}
    @media(max-width:400px){
      #local-save-files .save-toolbar h1{font-size:20px}
      #local-save-files :is(.save-views button,#local-save-close){font-size:14px;line-height:1.2;padding-inline:10px}
    }
  `;
  Module.openLocalSaves = function (onClose) {
    if (!Module.saveImport || !Module.persistFlush || !saveRoot.hidden) return false;
    Module.cancelMapGesture(); if (Module.aimMode) Module.setAimMode(false);
    saveReturn=typeof onClose==='function'?onClose:null;
    saveClose.textContent=saveReturn?'Back':'Back to game';
    saveClose.setAttribute('aria-label',saveReturn?'Back to play options':'Back to game');
    saveReturnFocus=document.activeElement;saveRoot.hidden=false;Module.saveFilesOpen=true;selectSaveView(false);saveRoot.scrollTop=0;filesTab.focus({preventScroll:true});
    return true;
  };
  titleSaves.onclick = () => Module.openLocalSaves();
  new ResizeObserver(function(){Module.refreshCanvasPresentation?.();}).observe(titleActions);
  async function importSaves(files) {
    if(transferBusy||!files.length)return;transferLock(true);
    var imported=0,skipped=0;
    try {
      for (var file of files) {
        const portable=/\.sgsave$/i.test(file.name);if(!file.size||file.size>SGSaveBundle.MAX||(!portable&&!/\.sve$/i.test(file.name)))throw Error('Choose a .sve or complete .sgsave portable backup.');
        const incoming=portable?await SGSaveBundle.decode(new Uint8Array(await file.arrayBuffer()),Module.saveRules):{name:file.name,bytes:new Uint8Array(await file.arrayBuffer()),association:null};
        if(/[\\/:\0]/.test(incoming.name)||incoming.name.length>90||new TextEncoder().encode(incoming.name).length>=100||previewScratchSave.test(incoming.name))
          throw Error('This filename cannot be used by the original save loader. Rename a copy and import it again.');
        const folder=saveFolder(),matches=FS.readdir(folder).filter(n=>n.toLowerCase()===incoming.name.toLowerCase());
        if(matches.length>1)throw Error('Several local saves use this name with different capitalization. Choose a different filename for the import.');
        const name=matches[0]||incoming.name;
        if(matches.length){
          if(!FS.isFile(FS.stat(folder+'/'+name).mode))throw Error('A folder already uses this saved-game name.');
          if(!confirm('Replace the local save “'+name+'” with this exact saved revision?')) {skipped++;continue;}
        }
        transferStatus('importing','Importing '+name+'…',name);
        await Module.saveImport(name,incoming.bytes,incoming.association);
        if (!await Module.persistFlush()) throw new Error('The save could not be stored durably. Keep this page open and download a backup.');
        imported++;
      }
      listSaves();transferStatus('imported','Import stored on this device: '+imported+' saved game'+(imported===1?'':'s')+(skipped?' ('+skipped+' kept unchanged)':'')+'. Close this panel, then use Continue or Load game.');
    } catch (e) { transferStatus('error',messageError(e)+(imported?' '+imported+' earlier file(s) were imported.':''));listSaves(); }
    finally { transferLock(false);saveInput.value=''; }
  }
  saveInput.onchange=function(){importSaves(Array.from(saveInput.files));};
  saveChoose.onclick=async function(){
    if(transferBusy)return;
    if(typeof window.showOpenFilePicker!=='function'){saveInput.click();return;}
    transferLock(true);
    try {
      var handles=await window.showOpenFilePicker({multiple:true,id:'simgolf-save-imports',startIn:'documents',types:[{description:'SimGolf saved game',accept:{'application/octet-stream':['.sve','.sgsave']}}]});
      var files=await Promise.all(handles.map(function(h){return h.getFile();}));transferLock(false);await importSaves(files);
    } catch(error) {transferStatus(error.name==='AbortError'?'cancelled':'error',error.name==='AbortError'?'Import cancelled. Your local saved games are unchanged.':'Could not open the file chooser: '+messageError(error)+'. Try the basic file picker below.');}
    finally {transferLock(false);}
    // A browser can expose a picker API but deny it in the current context.
    // Keep a user-activated ordinary picker available after that failure.
    if(Module.saveTransfer?.phase==='error')saveInput.hidden=false;
  };
  setInterval(function () { titleSaves.hidden = titleActions.hidden = !(Module.localInstall.phase === 'ready' && Module.atTitle && Module.saveImport) || !saveRoot.hidden; }, 250);
  async function prepare() {
    if (!isSecureContext || typeof WebAssembly.Suspending !== 'function' || !navigator.storage?.getDirectory) {
      picker.hidden = true; throw new Error('This browser needs WebAssembly JSPI and private file storage. Try a supported Safari version over HTTPS.');
    }
    await compatibility;
    active = await discover();
    if (active) installedView(); else status('selecting', 'Select the disc image and the supported v1.02 game executable. ZIP and 7z archives can also be inspected locally.');
  }
  prepare().catch(function (e) { picker.hidden = true; status('error', messageError(e), true); rejectReady(e); });
  Module.preRun = Module.preRun || [];
  Module.preRun.push(function () {
    addRunDependency('simgolf-local-files');
    ready.then(function (installed) {
      FS.mkdirTree('/image'); FS.mkdirTree('/assets');
      for (var n of ['golf.bin','jgld.bin']) FS.writeFile('/image/' + n, installed.images[n]);
      var manifest = installed.meta.files.filter(function (f) { return !/^(docs|ereg)\//i.test(f[0]) && !/\.(exe|dll|lib)$/i.test(f[0]); });
      FS.writeFile('/game.manifest', manifest.map(function (f) { return f[0] + '\t' + f[1] + '\n'; }).join(''));
      FS.writeFile('/assets/sound-files.txt', manifest.filter(function (f) { return /\.wav$/i.test(f[0]); }).map(function (f) { return f[0]; }).join('\n'));
      root.hidden = true; status('ready', 'Ready'); removeRunDependency('simgolf-local-files');
    }).catch(function (e) { root.hidden = false; status('error', messageError(e), true); });
  });
})();
