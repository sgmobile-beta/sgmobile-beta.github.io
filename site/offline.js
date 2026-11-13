// Register only in the local-files release shell. An update never reloads a
// running game or changes its private original files/saves.
(function () {
  if (!Module.localFiles) return;
  Module.offlineState = {phase:'checking', build:null};
  var notice = document.createElement('div'); notice.id = 'offline-notice'; notice.hidden = true;
  notice.style.cssText = 'position:fixed;left:12px;right:12px;bottom:max(12px,env(safe-area-inset-bottom));z-index:1001;background:var(--menu-bg);color:var(--menu-text);border:1px solid var(--menu-border);border-radius:8px;padding:12px;font:14px system-ui';
  var text = document.createElement('span'), close = document.createElement('button'); close.textContent = 'Dismiss'; close.style.cssText = 'margin-left:12px;min-height:44px'; close.onclick = function () { notice.hidden = true; };
  notice.append(text, close); document.body.append(notice);
  function state(phase, message, build) {
    Module.offlineState = {phase:phase, build:build || null, message:message};
    dispatchEvent(new Event('simgolf-offline-state'));
    if (phase === 'error' || phase === 'update-ready') { text.textContent = message; notice.hidden = false; }
  }
  // A requested check reports its own outcome; cache readiness alone does not
  // prove that the server has no newer worker. Never reload or skip waiting.
  var registrationPromise = null, pendingCheck = null, buttons = [];
  notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
  function result(phase,message) {
    Module.updateCheckState = {phase:phase,message:message};
    text.textContent=message;notice.hidden=false;
    for(var b of buttons){b.disabled=phase==='checking';b.textContent=phase==='checking'?'Checking…':'Check for updates';}
    dispatchEvent(new Event('simgolf-update-check'));
  }
  function limited(promise,ms) {
    return new Promise(function(resolve,reject){
      var timer=setTimeout(function(){reject(Error('Update check timed out'));},ms);
      Promise.resolve(promise).then(function(value){clearTimeout(timer);resolve(value);},function(error){clearTimeout(timer);reject(error);});
    });
  }
  function installed(worker) {
    return new Promise(function(resolve,reject){
      function changed(){
        if(worker.state==='installed'||worker.state==='activated'){worker.removeEventListener('statechange',changed);resolve();}
        else if(worker.state==='redundant'){worker.removeEventListener('statechange',changed);reject(Error('Update download did not complete'));}
      }
      worker.addEventListener('statechange',changed);changed();
    });
  }
  Module.checkForUpdates=function(){
    if(pendingCheck)return pendingCheck;
    result('checking','Checking for updates…');
    pendingCheck=(async function(){
      if(!navigator.serviceWorker){result('unsupported','Update checks are unavailable in this browser.');return;}
      var registration=await limited(registrationPromise,20000);
      if(!registration)throw Error('App registration is unavailable');
      function waiting(){return registration.waiting&&registration.active&&navigator.serviceWorker.controller;}
      if(waiting()){result('update-ready','An update is downloaded. Save your game, then close all SimGolf windows and reopen to install it.');return;}
      if(navigator.onLine===false){result('offline','You’re offline. Reconnect to check for updates. You can keep playing the installed version.');return;}
      await limited(registration.update(),20000);
      if(registration.installing)await limited(installed(registration.installing),90000);
      if(waiting())result('update-ready','An update is downloaded. Save your game, then close all SimGolf windows and reopen to install it.');
      else if(registration.active)result('up-to-date','You’re up to date. No new update is available.');
      else throw Error('App installation is not ready');
    })().catch(function(){
      result(navigator.onLine===false?'offline':'error',navigator.onLine===false?'You’re offline. Reconnect to check for updates. You can keep playing the installed version.':'Could not complete the update check. Check your connection and try again; the installed game is unchanged.');
    }).finally(function(){pendingCheck=null;for(var b of buttons){b.disabled=false;b.textContent='Check for updates';}});
    return pendingCheck;
  };
  function addButton(parent,id,before){
    if(!parent)return;var button=document.createElement('button');button.id=id;button.textContent='Check for updates';button.type='button';
    button.style.cssText='font:inherit;min-height:48px;padding:10px 14px;background:var(--menu-button);color:var(--menu-text);border:1px solid var(--menu-border);border-radius:8px;margin:6px 0';
    button.onclick=Module.checkForUpdates;
    for(var type of ['pointerdown','pointerup','mousedown','mouseup','click','touchstart','touchmove','touchend','keydown','keyup','keypress'])button.addEventListener(type,function(e){e.stopPropagation();});
    parent.insertBefore(button,before||null);buttons.push(button);
  }
  var play=document.getElementById('local-install-play');
  addButton(play?.parentNode,'local-install-updates',play?.nextSibling);
  addButton(document.getElementById('local-title-actions'),'local-title-updates');
  if (!navigator.serviceWorker) { state('error','Offline app storage is unavailable in this browser.'); return; }
  var updateWaiting = false;
  navigator.serviceWorker.addEventListener('message', function (event) {
    if (event.data?.type !== 'APP_STATUS') return;
    if (updateWaiting) return;
    state(event.data.complete ? 'ready' : 'error', event.data.complete ? 'App resources are stored for offline use.' : 'Offline app files are incomplete. Keep a backup of saves and reconnect before restarting.', event.data.build);
  });
  registrationPromise = navigator.serviceWorker.register(new URL('service-worker.js', document.currentScript.src), {scope:'./', updateViaCache:'none'}).then(function (registration) {
    function status() { registration.active?.postMessage({type:'APP_STATUS'}); }
    function waiting() { if (registration.waiting && registration.active && navigator.serviceWorker.controller) { updateWaiting = true; state('update-ready','An update is downloaded. Save your game, then close all SimGolf windows and reopen to install it.'); } }
    waiting(); status();
    registration.addEventListener('updatefound', function () {
      var worker = registration.installing;
      if (!worker) return;
      state('installing','Storing app resources for offline use…');
      worker.addEventListener('statechange', function () {
        if (worker.state === 'installed') { waiting(); if (!registration.waiting) status(); }
        if (worker.state === 'redundant' && !registration.active) state('error','App files could not be stored for offline use. Stay online and try again.');
      });
    });
    navigator.serviceWorker.addEventListener('controllerchange', status);
    navigator.serviceWorker.ready.then(function () { status(); waiting(); });
    return registration;
  }).catch(function () { state('error','App resources could not be stored for offline use. Keep the device online while playing.'); });
})();
