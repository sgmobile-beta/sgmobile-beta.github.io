// Hold the mobile viewport while the original engine changes screens. Each
// destination acknowledges its responsive presentation before the cover lifts.
(function(){
  const shown=id=>{
    const el=document.getElementById(id);
    return !!el&&!el.hidden&&el.getClientRects().length>0;
  };
  Module.mobileCourseFrameReady=before=>{
    const request=Module.viewportRequest,resize=Module.viewportResize;
    return !!(Module.mobileState?.course&&Module.mapPresentation?.course&&!Module.uiPresentation&&
      !Module.loadState?.active&&(Module.panVisual?.pixelSerial||0)>before&&shown('map-display')&&
      (!request||(resize?.seq===request.seq&&resize.status===1)));
  };
  if(!Module.mobileUI)return;
  const root=document.createElement('div');
  root.id='mobile-screen-transition';
  root.hidden=true;
  const content=document.createElement('div');
  content.className='transition-content';
  const brand=document.createElement('div');
  brand.className='transition-brand';
  const icon=new Image(1254,1254);
  icon.src='icons/simgolf-mobile.png';
  icon.alt='';
  const wordmark=new Image(1774,887);
  wordmark.src='icons/simgolf-mobile-wordmark.png';
  wordmark.alt='SimGolf Mobile';
  const status=document.createElement('p');
  status.setAttribute('role','status');
  brand.append(icon,wordmark);
  content.append(brand,status);
  root.append(content);
  const style=document.createElement('style');
  style.textContent=`
    #mobile-screen-transition[hidden]{display:none}
    #mobile-screen-transition{position:fixed;inset:0;z-index:130;box-sizing:border-box;
      display:grid;place-items:center;text-align:center;touch-action:none;
      padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right))
              max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));
      background:radial-gradient(ellipse at 38% 10%,#fff9e8,#e3e2f8 38%,#a8a9d1);
      color:var(--menu-text);font:600 17px/1.35 system-ui,sans-serif}
    #mobile-screen-transition .transition-content{width:min(100%,420px)}
    #mobile-screen-transition .transition-brand{display:grid;align-items:center;
      grid-template-columns:clamp(44px,16vw,92px) minmax(0,1fr);gap:clamp(8px,3vw,16px)}
    #mobile-screen-transition .transition-brand img{display:block;width:100%;height:auto}
    #mobile-screen-transition .transition-brand img:first-child{border-radius:23%}
    #mobile-screen-transition p{margin:8px 0 0}
    @media(max-height:380px){#mobile-screen-transition .transition-content{max-width:320px}}
    body.mobile-screen-changing :is(#canvas,#map-display,#local-title-actions){visibility:hidden!important}
  `;
  document.head.append(style);
  document.body.append(root);
  const captions={title:'Opening main menu…',difficulty:'Opening difficulty choices…',themes:'Opening themes…',locations:'Opening locations…',
    saves:'Opening saved games…','save-preview':'Opening saved course preview…',championship:'Opening championship courses…',pros:'Opening pro selection…',
    course:'Opening course…',back:'Going back…'};
  let transition=null,frame=0;
  function finish(reason){
    if(!transition)return;
    const state=transition;
    transition=null;
    cancelAnimationFrame(frame);
    state.active=false;
    state.handoff=reason;
    state.duration=performance.now()-state.started;
    root.hidden=true;
    document.body.classList.remove('mobile-screen-changing');
  }
  Module.cancelMobileScreenTransition=state=>{if(transition===state)finish('cancelled');};
  function check(){
    const t=transition;
    if(!t)return;
    const menu=Module.startupMenu,load=Module.loadState,location=Module.locationState,theme=Module.themePicker;
    const title=menu?.kind==='title'&&shown('mobile-startup')&&document.getElementById('mobile-startup').classList.contains('title');
    const difficulty=menu?.kind==='difficulty'&&shown('mobile-startup')&&document.getElementById('mobile-startup').classList.contains('difficulty');
    const locations=location?.active&&location.frame>0&&!location.suspended&&shown('mobile-locations')&&
      document.getElementById('mobile-locations').dataset.serial===String(location.serial);
    const picker=load?.active&&!load.suspended&&shown('mobile-load')&&
      document.getElementById('mobile-load').dataset.serial===String(load.serial);
    const themes=theme?.active&&shown('mobile-theme-picker')&&
      document.getElementById('mobile-theme-picker').dataset.serial===String(theme.serial);
    const course=Module.mobileCourseFrameReady(t.pixels);
    const saves=picker&&!load.championship&&!load.proSelection;
    const savePreview=Module.courseLoading?.active&&Module.courseLoading?.reviewing&&shown('course-loading');
    const ready={title,difficulty,locations,themes,course,
      saves,'save-preview':savePreview,
      championship:picker&&load.championship,pros:picker&&load.proSelection,
      back:!load?.active&&(title||locations||course||shown('game-edition'))};
    if(ready[t.target]){finish('destination-ready');return;}
    // The shortcut needs the native picker to validate the exact save before
    // showing its preview. Reveal the picker only if that shortcut could not open it.
    if(t.target==='save-preview'&&saves&&!Module.directSaveTarget){finish('save-picker-fallback');return;}
    if(menu?.fallback||load?.fallback||location?.fallback){finish('original-view');return;}
    // Intentional dialogs have their own presentation and ownership.
    if(Module.editionModalOpen||Module.featureSettingsOpen||Module.rulesetBlocked||
       Module.binkVideoActive||Module.gameExiting||shown('mobile-profile')||
       shown('mobile-progress-screen')||shown('course-loading')||(themes&&t.source!=='themes')){
      finish('intervening-screen');return;
    }
    const elapsed=performance.now()-t.started;
    const source=t.source;
    const current=source==='startup'?menu:source==='locations'?location:source==='load'?load:source==='themes'?theme:null;
    const queue=source==='startup'?Module.startupQueue:source==='locations'?Module.locationQueue:source==='themes'?Module.themeQueue:Module.loadQueue;
    // A rejected selection leaves its original chooser and serial in place.
    // Wait for the command to settle; briefly idle native frames can precede
    // the engine leaving its chooser after a successful click.
    if(elapsed>550&&current?.serial===t.serial&&!current.busy&&!current.suspended&&!queue?.length&&
       (source==='startup'&&(title||difficulty)||source==='locations'&&locations||source==='load'&&picker||source==='themes'&&themes)){
      finish('selection-not-taken');return;
    }
    if(elapsed>20000){finish('recovery');return;}
    frame=requestAnimationFrame(check);
  }
  Module.beginMobileScreenTransition=(target,source=null,serial=null)=>{
    if(!captions[target])return;
    if(transition)finish('replaced');
    const state={active:true,target,source,serial,pixels:Module.panVisual?.pixelSerial||0,started:performance.now()};
    Module.mobileScreenTransition=transition=state;
    status.textContent=captions[target];
    root.hidden=false;
    document.body.classList.add('mobile-screen-changing');
    frame=requestAnimationFrame(check);
    return state;
  };
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel','click','touchstart','touchmove','touchend','wheel'])
    root.addEventListener(type,e=>{e.preventDefault();e.stopPropagation();},{passive:false});
  for(const type of ['keydown','keyup','keypress'])
    addEventListener(type,e=>{if(transition&&!Module.editionModalOpen){e.preventDefault();e.stopImmediatePropagation();}},true);
})();

// Basic mobile action menu. Original game commands/rules stay in the engine.
(function () {
  if (!Module.mobileMap) return;
  Module.menuQueue = [];
  var page='', open=false, last='', s={}, seenCourse=false, building=false, pendingHole=null, holeToOpen=null, wasRound=false, lastTurn=0, lastReady=false, shotChoicesOpen=false, shotFingerprint='', infoOpen=false, scoreOpen=false, scoreFingerprint='', buildPage='', stripStamp='';
  var leaderboardOpen=false,leaderboardStamp='',leaderboardRevealPlayer=false;
  var courseBadgeStamp='';
  var activeImprovement=-1,buildingChoices=false,panBuildTool=null,lastBuildTool=null,clubhousePlacement=false;
  var contextGroup='',pendingSection=null,pendingModalKey='',pendingBackOnly=false,selectedSection='';
  let catalogueInfoId=null;
  var landmarkBenefits=['Boosts nearby golfers’ happiness.','Prevents dandelions nearby.','Helps your golfer improve skills nearby.','Encourages happy outcomes in nearby golfer stories.'];
  function landmarkName(l){var n=l?.name.trim();return n?n.charAt(0).toUpperCase()+n.slice(1):'Landmark';}
  function creative(){return Module.hasGameFeature('creativeSandbox');}
  function creativeRules(){return 'Creative Sandbox: construction charges and construction refunds are zero. Original home-site sale income and property buybacks remain. Land purchases, salaries, maintenance and all other normal operations retain their original rules. Placement, unlocks, capacity limits, scoring and golfer behavior are unchanged.';}
  function landmarkPrice(l){return l.free?'Free · donated landmark':creative()?'Free · original value $'+l.price.toLocaleString():'$'+l.price.toLocaleString();}
  // The original World Map purchase unlocks the landmark by property record
  // index. The location ID stored in that record varies between careers.
  function landmarkUnlockProperty(id){
    const record=0x571ff4+id*46, location=HEAPU8[record];
    if(location>=16||HEAPU8[record+6]!==255)return '';
    return Module.readGameText(0x4c1e90+location*130,24).trim();
  }
  // Match the original happy-ending award's first-letter switch against
  // the active theme's story filenames. Other initials draw from IDs 0–9.
  function landmarkStoryRewards(){
    const namedRewards={A:2,C:0,F:8,G:7,H:5,L:4,M:3,P:1,R:8,S:11,X:9};
    const rewards=new Set();
    for(let i=0;i<100;i++){
      const code=HEAPU8[0x53a454+i*50];
      if(!code)continue;
      const id=namedRewards[String.fromCharCode(code)];
      if(id!==undefined)rewards.add(id);
      else for(let n=0;n<10;n++)rewards.add(n);
    }
    return rewards;
  }
  function landmarkUnlockDetails(landmark,storyReward){
    const property=landmarkUnlockProperty(landmark.id);
    return [
      property?'Buy the '+property+' course property from Manage → World map.':'',
      'Ivana Richman may donate this landmark after enjoying a completed visit. The game chooses which landmark she gives.',
      storyReward?'A happy ending in a golfer story can also award it in this theme.':''
    ];
  }
  // The native hole-opening routine unlocks one building at a time and
  // skips the announcements at holes 6 and 10 for other course milestones.
  const buildingUnlockHoles=[2,3,4,5,7,8,9,11,12];
  function catalogueCardWithInfo(card,id,title,instructions){
    const row=document.createElement('div'),help=document.createElement('div');
    row.className='catalogue-card-with-info';
    help.className='catalogue-unlock-help';
    help.id=id;
    const heading=document.createElement('strong');
    heading.textContent=title;
    help.append(heading);
    for(const line of instructions.filter(Boolean)){
      const detail=document.createElement('p');
      detail.textContent=line;
      help.append(detail);
    }
    function update(expanded){
      info.setAttribute('aria-expanded',String(expanded));
      help.hidden=!expanded;
    }
    // Overlay the accessible control on the disabled placement card.
    // A separate DOM button keeps the two actions independent.
    const info=button('',()=>{
      if(catalogueInfoId===id){
        catalogueInfoId=null;
        update(false);
        return;
      }
      const previous=items.querySelector('.catalogue-info[aria-expanded="true"]');
      if(previous){
        previous.setAttribute('aria-expanded','false');
        document.getElementById(previous.getAttribute('aria-controls')).hidden=true;
      }
      catalogueInfoId=id;
      update(true);
      help.scrollIntoView({block:'nearest',inline:'nearest'});
    });
    const glyph=document.createElement('span');
    glyph.textContent='i';glyph.setAttribute('aria-hidden','true');
    info.append(glyph);
    info.className='catalogue-info';
    info.setAttribute('aria-label',heading.textContent);
    info.setAttribute('aria-controls',help.id);
    update(catalogueInfoId===id);
    row.append(card,info,help);
    return row;
  }
  function openLandmarks(){openCatalogue('landmarks');}
  function openCatalogue(name){
    if(page!==name)catalogueInfoId=null;
    Module.cancelMapGesture();open=true;page=name;render();
  }
  var buildingBenefits=['Helps imaginative golfers.','Feeds hungry golfers.','Improves accurate golfers.','Encourages golfers to become members.','Helps long hitters.','Helps golfers play faster.','Increases property values.','Helps golfers stay happier.','Supports higher greens fees.'];
  var improvements=[['Ballwasher',0,3],['Pathway',1,0],['Building lot',2,5],['Bench',3,1],['Landmark',4,4],['Flower bed',5,2],['Scenic tree',6,16],['Scenic bridge',9,19]];
  var root=document.createElement('div');root.id='mobile-ui';
  var rail=document.createElement('nav');rail.id='mobile-mode-rail';rail.hidden=true;rail.setAttribute('aria-label','Game sections');
  var style=document.createElement('style');style.textContent=`
    #mobile-ui{position:fixed;inset:22px 0 0;z-index:30;pointer-events:none;color:var(--menu-text);font:15px system-ui,sans-serif}
    #sv-btn{display:none!important}
    #mobile-ui [hidden]{display:none!important}
    #mobile-ui button,#mobile-ui input,#mobile-mode-rail button,#mobile-cancel,#mobile-open-hole{font:inherit;min-height:44px;box-sizing:border-box}
    #mobile-ui button,#mobile-mode-rail button,#mobile-cancel,#mobile-open-hole{padding:9px 12px;border:1px solid var(--menu-border);border-radius:5px;background:var(--menu-button);color:var(--menu-text);cursor:pointer;touch-action:manipulation;pointer-events:auto}
    #mobile-ui button[aria-pressed=true],#mobile-mode-rail button[aria-pressed=true]{background:var(--menu-selected);border-color:var(--menu-focus)}
    #mobile-ui .icon,#mobile-cancel,#mobile-open-hole{width:48px;height:48px;padding:10px}#mobile-ui .icon svg,#mobile-cancel svg,#mobile-open-hole svg{width:26px;height:26px;display:block;pointer-events:none}
    #mobile-build-actions{position:absolute;right:calc(max(8px,env(safe-area-inset-right)) + 168px);bottom:calc(max(8px,env(safe-area-inset-bottom)) + var(--strip-space,0px));display:flex;gap:6px}
    #mobile-cancel{position:fixed;z-index:90;left:max(8px,env(safe-area-inset-left));bottom:calc(var(--mobile-bottom-offset,0px) + max(8px,env(safe-area-inset-bottom)) + var(--strip-space,0px))}#mobile-cancel[hidden]{display:none!important}
    #mobile-build-strip{position:absolute;left:max(8px,env(safe-area-inset-left));right:max(8px,env(safe-area-inset-right));bottom:max(8px,env(safe-area-inset-bottom));padding:6px;background:var(--menu-overlay);border:1px solid var(--menu-border);border-radius:6px;pointer-events:auto;box-sizing:border-box}
    #mobile-build-strip .strip-header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px}
    #mobile-build-strip .strip-title{font-size:13px;margin:0}
    #mobile-build-strip .strip-header.course-tiles{display:grid;grid-template-columns:minmax(0,1fr);justify-items:center;gap:4px;text-align:center}

    #mobile-build-strip #mobile-next-variation{flex:none;min-height:44px;padding:5px 12px;font-size:13px;font-weight:700;white-space:nowrap;touch-action:manipulation;border-color:#80601c;background:linear-gradient(#fff7d6,#efcd72);color:#382908}
    #mobile-build-strip .strip-items{display:flex;gap:6px;overflow-x:auto;overscroll-behavior:contain;touch-action:pan-x;padding-bottom:3px}
    #mobile-build-strip button{flex:0 0 88px;min-height:72px;padding:5px;font-size:12px;touch-action:pan-x}
    #mobile-build-strip canvas{width:64px;height:42px;object-fit:contain;display:block;margin:auto;image-rendering:pixelated;pointer-events:none}
    #mobile-build-strip .category-icon{display:block;width:44px;height:44px;margin:0 auto 3px;image-rendering:auto;pointer-events:none}
    #mobile-build-strip .category-icon.tile-symbol{width:58px}
    #mobile-build-strip .category-icon.round-badge{clip-path:circle(50%)}
    #mobile-build-strip .category-icon.buildings-symbol{box-sizing:border-box;padding:7px;border:1px solid #293860;border-radius:50%;background:radial-gradient(circle at 34% 18%,#acb9ef,#7888d8 32%,#6878c0 58%,#606fa9 82%,#4f5b98);color:#293860}

    #mobile-build-strip span{display:block}#mobile-build-strip .variations{margin-top:6px}#mobile-build-strip .variations button{min-height:44px;flex-basis:108px}#mobile-build-strip .landmark-choice{flex-basis:auto;min-height:44px;white-space:nowrap}#mobile-build-strip svg{width:36px;height:42px;display:block;margin:auto;pointer-events:none}
    #mobile-panel.landmarks{left:max(8px,env(safe-area-inset-left));right:var(--mobile-rail-space);top:max(8px,env(safe-area-inset-top));bottom:max(8px,env(safe-area-inset-bottom));width:auto;max-height:none!important;z-index:2;background:var(--menu-overlay)}
    #mobile-ui.landmarks-open > :not(#mobile-panel){visibility:hidden}#mobile-panel.landmarks{padding-bottom:64px}
    #mobile-panel.landmarks{container-type:inline-size}
    #mobile-panel.landmarks .items{grid-template-columns:minmax(0,1fr);align-items:stretch}
    #mobile-panel.landmarks .landmark-card{display:flex;flex-direction:row;align-items:center;gap:12px;min-width:0;min-height:112px;text-align:left;overflow-wrap:anywhere}
    #mobile-panel.landmarks .landmark-card strong{font-size:17px}
    #mobile-panel.landmarks .landmark-card .card-details span{font-size:14px;line-height:1.35}
    #mobile-panel.landmarks .landmark-card:disabled{opacity:.7}
    #mobile-panel.landmarks .landmark-card canvas{width:clamp(42px,20cqi,88px);height:auto;aspect-ratio:1;object-fit:contain;flex:none;image-rendering:pixelated}
    #mobile-panel.landmarks .card-details{display:flex;flex-direction:column;gap:5px;min-width:0}
    #mobile-panel .catalogue-card-with-info{position:relative;display:grid;min-width:0;gap:6px}
    #mobile-panel .catalogue-card-with-info .landmark-card:disabled,#mobile-panel .landmark-card[data-built]:disabled{opacity:1}
    #mobile-panel .catalogue-card-with-info .landmark-card:disabled{padding-inline-end:46px}
    #mobile-panel .landmark-card[data-locked]:disabled{background:#c4c3cc;color:#4b4a58;border-color:#8c8a9a}
    #mobile-panel .landmark-card[data-locked] canvas{filter:grayscale(1);opacity:.56}
    #mobile-panel.landmarks .landmark-card .card-details .catalogue-built-status{font-size:17px;color:#25613b;font-weight:700}
    #mobile-panel.landmarks .landmark-card[data-upgrade-available] .catalogue-built-status{color:#764d12}
    #mobile-panel .building-upgrade-group{display:grid;min-width:0;gap:4px}
    #mobile-panel button[data-building-upgrade]{min-height:44px;background:linear-gradient(#fffde8,#e9cf80);font-weight:700}
    #mobile-panel .catalogue-art{position:relative;display:grid;place-items:center;flex:none;width:clamp(42px,20cqi,88px);aspect-ratio:1}
    #mobile-panel .catalogue-lock{position:absolute;right:0;bottom:0;width:23px;height:23px;box-sizing:border-box;border:1px solid #a42831;border-radius:50%;background:#fff1ef;color:#a42831;pointer-events:none}
    #mobile-panel .catalogue-lock::before,#mobile-panel .catalogue-lock::after{content:'';position:absolute;left:50%;transform:translateX(-50%);box-sizing:border-box}
    #mobile-panel .catalogue-lock::before{top:4px;width:8px;height:8px;border:2px solid currentColor;border-radius:6px 6px 0 0}
    #mobile-panel .catalogue-lock::after{bottom:4px;width:12px;height:8px;border-radius:2px;background:currentColor}
    #mobile-panel .catalogue-info{position:absolute;z-index:1;inset:2px 2px auto auto;display:grid;place-items:center;width:44px;height:44px;padding:0;border:0;background:transparent;text-transform:none}
    #mobile-panel .catalogue-info span{display:grid;place-items:center;width:18px;height:18px;box-sizing:border-box;border:1px solid var(--menu-border);border-radius:50%;background:var(--menu-preview);font:700 12px/1 system-ui,sans-serif;pointer-events:none}
    #mobile-panel .catalogue-info[aria-expanded=true] span{background:var(--menu-selected);border-color:var(--menu-focus)}
    #mobile-panel .catalogue-unlock-help{min-width:0;scroll-margin-bottom:54px;padding:10px 12px;border:1px solid var(--menu-border);border-radius:8px;background:var(--menu-preview);overflow-wrap:anywhere}
    #mobile-panel .catalogue-unlock-help p:last-child{margin-bottom:0}
    @container (max-width:275px){
      #mobile-panel .catalogue-card-with-info .landmark-card:disabled{display:grid;grid-template-columns:minmax(0,1fr) 44px;gap:4px;padding:8px}
      #mobile-panel .catalogue-card-with-info .catalogue-art{grid-column:1;justify-self:start}
      #mobile-panel .catalogue-card-with-info .card-details{grid-column:1/-1}
    }
    #mobile-ui button:disabled{opacity:.45;cursor:default}
    :root{--mobile-surface:var(--menu-overlay);--mobile-rail-space:calc(max(8px,env(safe-area-inset-right)) + 60px)}
    /* Only map overlays are translucent; keep labels/icons fully opaque. */
    #mobile-ui{--menu-overlay:rgba(199,199,231,.72);--menu-button:rgba(225,225,243,.42);--menu-selected:rgba(195,206,246,.78);--mobile-surface:rgba(225,225,243,.68)}
    #mobile-mode-rail,#mobile-cancel,#mobile-open-hole{--mobile-surface:rgba(225,225,243,.68);--menu-selected:rgba(195,206,246,.78)}

    #mobile-mode-rail[hidden],#mobile-mode-rail button[hidden]{display:none!important}
    #mobile-mode-rail{position:fixed;right:max(8px,env(safe-area-inset-right));top:calc(22px + max(8px,env(safe-area-inset-top)));z-index:90;display:flex;flex-direction:column;gap:6px;pointer-events:none;overflow-y:auto;overscroll-behavior:contain;font:15px system-ui,sans-serif}
    #mobile-mode-rail button.icon{width:48px;height:48px;min-height:48px;flex:none;padding:10px;border-radius:5px}
    #mobile-mode-rail .speed-control{width:48px;height:48px;min-height:48px;flex:none;padding:4px;font-size:16px;font-weight:600}#mobile-mode-rail .speed-control[data-speed="0"]{color:var(--menu-warning)}
    @media(max-height:500px){#mobile-mode-rail{gap:4px}#mobile-mode-rail button.icon,#mobile-mode-rail .speed-control{width:44px;height:44px;min-height:44px;padding:8px}#mobile-mode-rail .speed-control{padding:2px}}
    #mobile-mode-rail svg{display:block;width:26px;height:26px;pointer-events:none}
    #mobile-mode-rail button[aria-pressed=true]{box-shadow:inset 3px 0 var(--menu-focus)}
    body.mobile-rail-visible #mobile-profile,body.mobile-rail-visible #mobile-staff,body.mobile-rail-visible #mobile-match,body.mobile-rail-visible #mobile-load{padding-right:var(--mobile-rail-space)}
    body.mobile-rail-visible #mobile-profile-return,body.mobile-rail-visible #mobile-staff-return,body.mobile-rail-visible #mobile-load-return{right:var(--mobile-rail-space)}
    #mobile-panel{position:absolute;left:max(8px,env(safe-area-inset-left));top:calc(max(8px,env(safe-area-inset-top)) + 50px);width:min(330px,calc(100% - max(8px,env(safe-area-inset-left)) - var(--mobile-rail-space) - 8px));max-height:calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 94px);overflow:auto;background:var(--menu-overlay);border:1px solid var(--menu-border);border-radius:6px;padding:8px;box-sizing:border-box;pointer-events:auto;overscroll-behavior:contain}
    #mobile-ui.speed-picker-open{z-index:95}
    #mobile-speed-picker[hidden]{display:none!important}
    #mobile-speed-picker{position:fixed;z-index:96;pointer-events:auto;box-sizing:border-box;padding:8px;border:1px solid var(--menu-border);border-radius:14px;background:var(--menu-overlay);box-shadow:0 4px 16px #1c254133;max-height:calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 16px);overflow:auto}
    #mobile-speed-picker .speed-header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-left:4px}
    #mobile-speed-picker .speed-header button{width:44px;height:44px;padding:4px;font-size:25px}
    #mobile-speed-picker .speed-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:6px}
    #mobile-speed-picker .speed-options button{min-height:48px;padding:8px 5px;font-weight:650}
    #mobile-speed-picker .speed-testing-label{grid-column:1/-1;font-size:12px;font-weight:650;margin-top:2px}
    #mobile-speed-picker button[aria-pressed=true]{background:var(--menu-selected);outline:2px solid var(--menu-focus);outline-offset:-2px}
    #mobile-panel h2{font-size:17px;margin:8px 0}#mobile-panel p{margin:8px 0;font-size:13px}
    #mobile-panel .items{display:grid;grid-template-columns:1fr 1fr;gap:6px}#mobile-panel .wide{grid-column:1/-1}
    #mobile-panel:is([data-page="manage"],[data-page="system"]) .items{grid-template-columns:repeat(2,minmax(0,1fr))}
    #mobile-panel:is([data-page="manage"],[data-page="system"]) .items button{min-width:0;overflow-wrap:anywhere}
    #mobile-panel[data-page="manage"] .items{container-type:inline-size}
    #mobile-panel[data-page="manage"] .items .manage-accomplishments{
      padding-inline:5px;font-size:14px;overflow-wrap:normal
    }
    @container (max-width:254px){
      #mobile-panel[data-page="manage"] .items .manage-accomplishments{
        grid-column:1/-1;font-size:clamp(12px,10cqi,14px)
      }
    }
    #mobile-dialog-actions{position:absolute;right:max(8px,env(safe-area-inset-right));bottom:max(8px,env(safe-area-inset-bottom));display:flex;gap:6px}
    #mobile-panel input{width:100%;color:#111;background:white;border:1px solid var(--menu-border);padding:6px}
    #mobile-round-controls{position:absolute;left:max(8px,env(safe-area-inset-left));right:80px;bottom:calc(max(8px,env(safe-area-inset-bottom)) + var(--strip-space,0px) + 54px);display:flex;gap:6px;flex-wrap:wrap}
    #mobile-shot-choices{position:absolute;left:max(8px,env(safe-area-inset-left));right:max(8px,env(safe-area-inset-right));bottom:calc(max(8px,env(safe-area-inset-bottom)) + var(--strip-space,0px) + 162px);display:flex;gap:6px;overflow:auto;padding:4px;background:var(--menu-overlay);border-radius:6px;pointer-events:auto;overscroll-behavior:contain}
    #mobile-shot-choices button{flex:0 0 auto}#mobile-shot-choices button[aria-pressed=true]{background:var(--menu-selected);border-color:var(--menu-focus)}
    #mobile-terrain-controls{position:absolute;left:16px;right:16px;max-width:420px;margin:0 auto;bottom:calc(max(8px,env(safe-area-inset-bottom)) + var(--strip-space,0px) + 64px);display:grid;grid-template-columns:48px minmax(96px,120px) 48px;justify-content:space-between;align-items:center;row-gap:8px;pointer-events:none}
    #mobile-terrain-up{grid-column:1}#mobile-terrain-precision{grid-column:2;min-width:96px}#mobile-terrain-down{grid-column:3}
    #mobile-terrain-controls button{background:var(--mobile-surface)}#mobile-terrain-controls button[aria-pressed=true]{background:var(--menu-selected)}
    #mobile-terrain-elevation-map{grid-column:1/-1;justify-self:center;min-height:44px}
    #mobile-terrain-status{grid-column:1/-1;grid-row:1;justify-self:center;text-align:center;font-size:12px;max-width:100%;padding:4px 8px;border-radius:5px;background:var(--mobile-surface);pointer-events:none}
    #mobile-lot-controls{position:absolute;left:max(8px,env(safe-area-inset-left));right:max(8px,env(safe-area-inset-right));bottom:calc(max(8px,env(safe-area-inset-bottom)) + var(--strip-space,0px) + 58px);display:flex;gap:10px;align-items:center;padding:8px;background:var(--menu-overlay);border-radius:6px;pointer-events:auto}#mobile-lot-controls div{flex:1;font-size:13px;line-height:1.4;text-align:center}#mobile-place-lot{flex:none;min-width:70px}
    #mobile-round-info{position:absolute;left:max(8px,env(safe-area-inset-left));right:max(8px,env(safe-area-inset-right));bottom:calc(max(8px,env(safe-area-inset-bottom)) + var(--strip-space,0px) + 220px);max-height:24vh;overflow:auto;padding:6px;background:var(--menu-overlay);border-radius:6px;font-size:13px;text-align:center;pointer-events:auto}
    @media(min-width:720px){#mobile-round-controls{left:calc(max(8px,env(safe-area-inset-left)) + 54px);bottom:calc(max(8px,env(safe-area-inset-bottom)) + var(--strip-space,0px) + 54px);right:180px}#mobile-shot-choices{bottom:calc(max(8px,env(safe-area-inset-bottom)) + var(--strip-space,0px) + 108px)}#mobile-round-info{bottom:calc(max(8px,env(safe-area-inset-bottom)) + var(--strip-space,0px) + 166px)}}
    #mobile-course-hud{position:absolute;left:max(8px,env(safe-area-inset-left));top:calc(max(8px,env(safe-area-inset-top)) - 22px);width:calc(100% - max(8px,env(safe-area-inset-left)) - max(8px,env(safe-area-inset-right)) - 64px);pointer-events:none}
    #mobile-course-badge{position:relative;display:flex;align-items:center;gap:0;padding:5px 8px 5px 0;box-sizing:border-box;min-height:78px;isolation:isolate}
    #mobile-course-hud{container:course-hud / inline-size}
    #mobile-ui{--course-status-indent:28px}
    #mobile-course-status{display:grid;grid-template-columns:fit-content(34%) minmax(0,1fr) fit-content(34%);align-items:center;gap:4px 6px;margin:4px 0 0 var(--course-status-indent);font:11px/18px system-ui,sans-serif}
    #mobile-course-status #build-label{grid-area:1/1;justify-self:start;min-width:0}
    #mobile-course-status #mobile-status{grid-area:1/3;justify-self:end;margin-left:0;max-width:100%}
    #mobile-closeup,#mobile-zoom-notice{justify-self:center;padding:0 4px;border-radius:3px;background:rgba(199,199,231,.68);white-space:nowrap}
    #mobile-closeup{grid-area:1/2;font-variant-numeric:tabular-nums}
    #mobile-zoom-notice{grid-column:1/-1}
    @container course-hud (max-width:286px){
      #mobile-course-status{grid-template-columns:fit-content(calc(50% - 6px)) minmax(0,1fr) fit-content(calc(50% - 6px))}
      #mobile-closeup{grid-area:2/2}
    }
    body.mobile-course-hud-visible{--mobile-course-lift:22px}
    #mobile-course-badge:before{content:"";position:absolute;inset:0 0 0 28px;background:var(--mobile-surface);border-radius:6px;z-index:-1}
    #mobile-ui #mobile-course-legend-toggle{position:absolute;inset:0;width:100%;height:100%;border:0;background:transparent}
    #mobile-course-legend-toggle:focus-visible{outline:2px solid var(--menu-focus);outline-offset:2px}
    #mobile-course-legend{position:absolute;z-index:2;left:var(--course-status-indent);top:calc(100% + 8px);box-sizing:border-box;width:min(300px,calc(100% - var(--course-status-indent)));max-height:min(44dvh,220px);overflow:auto;overscroll-behavior:contain;touch-action:pan-y;pointer-events:auto;padding:8px 10px;border:1px solid var(--menu-border);border-radius:6px;background:var(--menu-preview)}
    #mobile-course-legend header{display:flex;align-items:center;justify-content:space-between;gap:4px;flex-wrap:wrap}
    #mobile-course-legend h2{margin:0;font-size:15px}
    #mobile-ui #mobile-course-legend-close{padding:6px 9px;font-size:13px}
    #mobile-course-legend ul{list-style:none;margin:4px 0 0;padding:0}
    #mobile-course-legend li{display:flex;align-items:center;gap:8px;padding:5px 0;font-size:13px;overflow-wrap:anywhere}
    #mobile-course-legend li svg{width:17px;height:17px;flex:none}
    #mobile-course-legend p{margin:6px 0;font-size:13px}
    #mobile-course-badge canvas{width:72px;height:72px;object-fit:contain;flex:none;margin-right:4px;image-rendering:pixelated}
    #mobile-course-details{min-width:0;flex:1;display:grid;grid-template-columns:minmax(0,1fr) max-content;grid-template-rows:26px 20px 20px;column-gap:8px;align-items:center}
    #mobile-course-heading{grid-area:1/1;display:flex;align-items:baseline;gap:5px;min-width:0;white-space:nowrap}
    #mobile-course-name{font-size:17px;line-height:24px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
    #mobile-course-meta{font-size:11px;line-height:18px;font-weight:400;margin:0;white-space:nowrap;flex:none}
    #mobile-course-date{grid-area:2/1;font-size:12px;line-height:20px;white-space:nowrap}
    #mobile-course-row{grid-area:3/1;min-width:0}
    #mobile-course-indicators{font-size:11px;line-height:20px;display:flex;gap:4px;align-items:center;flex-wrap:nowrap;min-width:0}
    #mobile-course-indicators p{display:contents}#mobile-course-indicators p[hidden]{display:none!important}#mobile-course-indicators .course-counter{display:inline-flex;align-items:center;gap:2px;flex:none;white-space:nowrap}#mobile-course-indicators .course-counter svg{width:13px;height:13px;flex:none}
    #mobile-course-stats{display:contents}#mobile-course-stats span{grid-column:2;text-align:right;white-space:nowrap;font-size:12px;line-height:20px}
    #mobile-course-stats #mobile-course-money{grid-row:1;font-size:17px;line-height:24px;font-weight:600;color:var(--menu-accent)}
    #mobile-course-stats #mobile-course-money[data-negative=true]{color:var(--menu-danger)}
    /* Original HUD404bc0: Fun RGB5557ff0, Skill03ff; GDI expands5-bit channels. */
    #mobile-course-fun{grid-row:2;color:var(--menu-warning)}#mobile-course-skill{grid-row:3;color:var(--menu-accent)}
    @media(max-width:500px){#mobile-course-badge{max-width:none}#mobile-course-badge canvas{width:64px;height:72px}#mobile-course-details{column-gap:5px}#mobile-course-name,#mobile-course-stats #mobile-course-money{font-size:16px}#mobile-course-meta{font-size:10px}#mobile-course-indicators{gap:3px;font-size:10px}#mobile-course-indicators .course-counter svg{width:12px;height:12px}}
    @media(max-width:360px){#mobile-course-details{column-gap:3px}#mobile-course-heading{gap:3px}#mobile-course-indicators{gap:2px;font-size:9px}#mobile-course-indicators .course-counter{gap:1px}#mobile-course-indicators .course-counter svg{width:10px;height:10px}#mobile-course-stats span{font-size:10px}}
    #mobile-ui #mobile-leaderboard-toggle{--leaderboard-left:calc(env(safe-area-inset-left,0px) + 6px);position:absolute;left:var(--leaderboard-left);top:calc(max(8px,env(safe-area-inset-top)) + var(--course-badge-space,0px));max-width:calc(100% - var(--leaderboard-left) - max(8px,env(safe-area-inset-right)) - 64px);display:grid;padding:0;overflow:hidden;text-align:left;font-size:13px;white-space:nowrap}
    body.mobile-course-hud-visible #mobile-ui #mobile-leaderboard-toggle{--leaderboard-left:calc(max(8px,env(safe-area-inset-left)) + var(--course-status-indent))}
    #mobile-leaderboard-title{display:flex;align-items:center;padding:2px 10px;background:#293e65;color:#fff;font:700 10px/14px system-ui,sans-serif;letter-spacing:.055em}
    #mobile-leaderboard-summary{display:flex;align-items:center;gap:5px;min-width:0;padding:3px 10px;line-height:18px}
    #mobile-leaderboard-name{min-width:0;overflow:hidden;text-overflow:ellipsis}
    #mobile-leaderboard-position,#mobile-leaderboard-score{flex:none;font-variant-numeric:tabular-nums}
    :is(#mobile-leaderboard,#mobile-leaderboard-crest){position:absolute;left:max(8px,env(safe-area-inset-left));top:calc(max(8px,env(safe-area-inset-top)) + var(--course-badge-space,0px) + 52px);width:min(330px,calc(100% - max(8px,env(safe-area-inset-left)) - var(--mobile-rail-space) - 8px))}
    #mobile-leaderboard{max-height:min(55dvh,calc(100% - max(8px,env(safe-area-inset-top)) - var(--course-badge-space,0px) - max(8px,env(safe-area-inset-bottom)) - 120px));overflow:auto;overscroll-behavior:contain;touch-action:pan-y;box-sizing:border-box;background:var(--menu-overlay);border:1px solid var(--menu-border);border-radius:6px;padding:10px;pointer-events:auto}
    #mobile-leaderboard-crest{height:0;z-index:1;pointer-events:none}
    #mobile-leaderboard-crest canvas{position:absolute;top:-9px;right:-7px;width:52px;height:52px;border-radius:50%;box-shadow:0 2px 5px #24234455;image-rendering:pixelated}
    #mobile-leaderboard.has-crest :is(h2,p){padding-right:40px}
    #mobile-leaderboard h2{font-size:16px;margin:0 0 6px}#mobile-leaderboard p{font-size:13px;margin:3px 0;overflow-wrap:anywhere}#mobile-leaderboard ol{list-style:none;margin:8px 0 0;padding:0}#mobile-leaderboard li{padding:6px 0;border-top:1px solid var(--menu-line);font-size:14px;overflow-wrap:anywhere}
    #mobile-leaderboard li.leaderboard-player{display:flex;justify-content:space-between;align-items:baseline;gap:6px;padding:6px 8px;border:1px solid #92702b;border-radius:6px;background:#f9e7a8;color:#32240f;font-weight:700}
    #mobile-leaderboard .leaderboard-you{flex:none;padding:1px 6px;border-radius:9px;background:#4d3b1b;color:#fff5d2;font-size:12px}
    #mobile-ui #mobile-pan[aria-pressed=true]{background:var(--mobile-surface)}
    #mobile-camera{position:absolute;right:max(8px,env(safe-area-inset-right));bottom:calc(max(8px,env(safe-area-inset-bottom)) + var(--strip-space,0px));display:flex;gap:6px}
    #mobile-round-toggles{position:absolute;left:calc(max(8px,env(safe-area-inset-left)) + 54px);bottom:calc(max(8px,env(safe-area-inset-bottom)) + var(--strip-space,0px));display:flex;gap:6px}#mobile-round-toggles button{padding:9px 8px}
    #mobile-scorecard{position:absolute;left:max(8px,env(safe-area-inset-left));right:max(8px,env(safe-area-inset-right));bottom:calc(max(8px,env(safe-area-inset-bottom)) + var(--strip-space,0px) + 220px);max-height:32vh;overflow:auto;background:var(--menu-overlay);padding:8px;border-radius:6px;pointer-events:auto;text-align:center}
    #mobile-scorecard table{border-collapse:collapse;width:100%;font-size:13px}#mobile-scorecard th,#mobile-scorecard td{padding:4px;border-bottom:1px solid var(--menu-line)}#mobile-scorecard caption{padding:4px}#mobile-scorecard tr.current{background:var(--menu-selected)}
    @media(min-width:720px){#mobile-scorecard{bottom:calc(max(8px,env(safe-area-inset-bottom)) + var(--strip-space,0px) + 166px)}}
    #mobile-close-photo{position:absolute;left:max(8px,env(safe-area-inset-left));top:max(8px,env(safe-area-inset-top))}
    #mobile-open-hole{position:fixed;z-index:90;left:calc(max(8px,env(safe-area-inset-left)) + 54px);bottom:calc(var(--mobile-bottom-offset,0px) + max(8px,env(safe-area-inset-bottom)) + var(--strip-space,0px));width:48px;height:48px}#mobile-open-hole[hidden]{display:none!important}
    #mobile-message{position:absolute;top:calc(max(8px,env(safe-area-inset-top)) + 50px);left:max(8px,env(safe-area-inset-left));right:calc(max(8px,env(safe-area-inset-right)) + 64px);margin:0 auto;max-width:none;max-height:calc(100% - 160px);display:flex;flex-direction:column;overflow:hidden;overscroll-behavior:contain;touch-action:pan-y;white-space:pre-line;overflow-wrap:break-word;word-break:normal;line-height:1.4;text-align:center;padding:12px 42px;box-sizing:border-box;border-radius:5px;background:var(--menu-overlay);text-shadow:none;pointer-events:auto}
    #mobile-mode-rail button,#mobile-cancel,#mobile-open-hole,#mobile-ui > button,#mobile-camera button,#mobile-build-actions button,#mobile-round-controls button,#mobile-round-toggles button{background:var(--mobile-surface)}
    #mobile-mode-rail button[aria-pressed=true],#mobile-ui > button[aria-pressed=true],#mobile-build-actions button[aria-pressed=true],#mobile-round-controls button[aria-pressed=true],#mobile-round-toggles button[aria-pressed=true]{background:var(--menu-selected)}
    body.mobile-rail-visible #mobile-profile,body.mobile-rail-visible #mobile-staff,body.mobile-rail-visible #mobile-match,body.mobile-rail-visible #mobile-load{padding-bottom:calc(max(8px,env(safe-area-inset-bottom)) + 60px)}
  `;document.head.appendChild(style);
  var menu=icon('Menu','M3 6h18M3 12h18M3 18h18',function(){sectionButton('system');});menu.id='mobile-menu';
  var buildShortcut=artIcon("Build","<g transform=\"rotate(-40 32 32)\"><path d=\"M16 7h27v14H16z\"/><rect x=\"28\" y=\"20\" width=\"7\" height=\"38\" rx=\"2\"/></g><g transform=\"rotate(40 32 32)\"><path d=\"M24 5h16v8a8 8 0 0 1-16 0z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"5\"/><rect x=\"29\" y=\"20\" width=\"6\" height=\"26\"/><path d=\"M21 42h22v9a11 11 0 0 1-22 0z\"/></g>",function(){sectionButton('build');});buildShortcut.id='mobile-build';
  var playShortcut=artIcon("Play","<ellipse cx=\"32\" cy=\"51\" rx=\"24\" ry=\"7\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4\"/><path d=\"M29 8v42\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"5\" stroke-linecap=\"round\"/><path d=\"M31 8l23 10-23 10z\"/><circle cx=\"15\" cy=\"43\" r=\"4\"/>",function(){sectionButton('play');});playShortcut.id='mobile-play';
  var manageShortcut=artIcon("Manage","<circle cx=\"32\" cy=\"17\" r=\"8\"/><circle cx=\"15\" cy=\"25\" r=\"6\"/><circle cx=\"49\" cy=\"25\" r=\"6\"/><path d=\"M19 55V43a13 13 0 0 1 26 0v12zM3 51V41a11 11 0 0 1 14-10l4 3a17 17 0 0 0-7 17zM50 51a17 17 0 0 0-7-17l4-3a11 11 0 0 1 14 10v10z\"/>",function(){sectionButton('manage');});manageShortcut.id='mobile-manage';
  var enhancedShortcut=artIcon('Enhanced','<path d="M29 9l6 16 16 6-16 6-6 16-6-16-16-6 16-6zM50 4l3 8 8 3-8 3-3 8-3-8-8-3 8-3zM12 41l3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/>',function(){sectionButton('enhanced');});enhancedShortcut.id='mobile-enhanced';
  var pendingSpeed=null,speedPickerOpen=false,speedOptions=[],speedKey='',speedDismissUntil=0;
  var speedControl=button('1×',function(){
    if(speedControl.hidden||!s.course)return;
    if(speedPickerOpen)closeSpeedPicker();else{speedPickerOpen=true;syncSpeed();speedOptions.find(b=>b.getAttribute('aria-pressed')==='true')?.focus({preventScroll:true});}
  });speedControl.id='mobile-speed';speedControl.className='speed-control';speedControl.hidden=true;speedControl.setAttribute('aria-controls','mobile-speed-picker');speedControl.setAttribute('aria-expanded','false');
  var speedPicker=document.createElement('section');speedPicker.id='mobile-speed-picker';speedPicker.hidden=true;speedPicker.setAttribute('aria-label','Choose game speed');
  var speedHeading=document.createElement('strong');speedHeading.textContent='Game speed';
  var speedClose=button('×',()=>closeSpeedPicker(true));speedClose.setAttribute('aria-label','Close speed choices');
  var speedHeader=document.createElement('div');speedHeader.className='speed-header';speedHeader.append(speedHeading,speedClose);
  var speedGrid=document.createElement('div');speedGrid.className='speed-options';speedGrid.setAttribute('role','group');speedGrid.setAttribute('aria-label','Game speed choices');speedPicker.append(speedHeader,speedGrid);root.append(speedPicker);
  var speedTestingLabel=document.createElement('span');speedTestingLabel.className='speed-testing-label';speedTestingLabel.textContent='Testing Speeds · Device-Limited';speedTestingLabel.hidden=true;
  for(const rate of [0,1,2,3,5,10,20,50,100]){if(rate===20)speedGrid.append(speedTestingLabel);const option=button(rate?rate+'×':'Pause',()=>{
    if(!s.course||(rate===0&&!Module.hasGameFeature('pauseControl'))||(rate>1&&!Module.hasGameFeature('gameSpeed')))return;
    pendingSpeed=rate;Module.menuQueue=Module.menuQueue.filter(c=>c[0]!==17);command(17,rate,true);closeSpeedPicker(true);syncSpeed();
  });option.dataset.speed=rate;option.setAttribute('aria-pressed','false');speedOptions.push(option);speedGrid.append(option);}
  function closeSpeedPicker(focus){speedPickerOpen=false;root.classList.remove('speed-picker-open');speedPicker.hidden=true;speedControl.setAttribute('aria-expanded','false');if(focus&&!speedControl.hidden)speedControl.focus({preventScroll:true});}
  function syncSpeed(){
    var actual=s.paused?0:s.speed||1;
    const faster=Module.hasGameFeature('gameSpeed'),pause=Module.hasGameFeature('pauseControl');
    if(pendingSpeed!==null&&(pendingSpeed===actual||(pendingSpeed>1&&!faster)||(pendingSpeed===0&&!pause)))pendingSpeed=null;
    var value=pendingSpeed===null?actual:pendingSpeed;
    speedControl.textContent=value?value+'×':'Ⅱ';speedControl.dataset.speed=String(value);
    speedControl.setAttribute('aria-label','Game speed: '+(value?value+'×':'Paused')+'. Choose speed');speedControl.title='Choose game speed';speedControl.setAttribute('aria-busy',String(pendingSpeed!==null));
    if(speedControl.hidden||!s.course||Module.atTitle)closeSpeedPicker();
    for(const option of speedOptions){const rate=Number(option.dataset.speed);option.hidden=rate===0?!pause:rate>1&&!faster;if(rate===1)option.textContent=s.paused&&!faster&&!pause?'Resume at 1×':'1×';option.setAttribute('aria-pressed',String(rate===value));}
    speedTestingLabel.hidden=!faster;
    speedGrid.style.gridTemplateColumns='repeat('+Math.min(3,speedOptions.filter(b=>!b.hidden).length)+',minmax(0,1fr))';
    root.classList.toggle('speed-picker-open',speedPickerOpen);speedPicker.hidden=!speedPickerOpen;speedControl.setAttribute('aria-expanded',String(speedPickerOpen));
    if(speedPickerOpen){const b=Module.getScreenBounds(),r=speedControl.getBoundingClientRect(),width=Math.min(286,b.width-b.safe.left-b.safe.right-16);speedPicker.style.width=width+'px';speedPicker.style.left=Math.max(b.left+b.safe.left+8,Math.min(r.left-width-8,b.left+b.width-b.safe.right-width-8))+'px';speedPicker.style.top=Math.max(b.top+b.safe.top+8,Math.min(r.top,b.top+b.height-b.safe.bottom-speedPicker.offsetHeight-8))+'px';}
  }
  // Popover input stays browser-owned; callbacks only queue the existing
  // native command. Consume an outside dismissal before it can hit the map.
  for(const type of ['pointerdown','pointerup','mousedown','mouseup','click','touchstart','touchend'])addEventListener(type,e=>{
    if(performance.now()<speedDismissUntil){e.preventDefault();e.stopImmediatePropagation();return;}
    if((type==='pointerdown'||type==='touchstart')&&speedPickerOpen&&!speedPicker.contains(e.target)&&!speedControl.contains(e.target)){closeSpeedPicker();speedDismissUntil=performance.now()+350;e.preventDefault();e.stopImmediatePropagation();}
  },{capture:true,passive:false});
  addEventListener('keydown',e=>{
    const own=speedPickerOpen||e.target.closest?.('#mobile-speed');
    if(!own){if(speedKey===e.key){e.preventDefault();e.stopImmediatePropagation();}return;}
    e.stopImmediatePropagation();
    const options=speedOptions.filter(b=>!b.hidden),controls=[speedClose,...options];
    if(e.key==='Escape'){e.preventDefault();speedKey=e.key;closeSpeedPicker(true);}
    else if(e.key==='Enter'||e.key===' '){e.preventDefault();speedKey=e.key;if(!e.repeat)e.target.closest?.('button')?.click();}
    else if(speedPickerOpen&&(e.key==='Tab'||e.key.startsWith('Arrow'))){e.preventDefault();speedKey=e.key;const i=controls.indexOf(document.activeElement),step=e.shiftKey||e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:1;controls[(i+step+controls.length)%controls.length].focus();}
  },true);
  addEventListener('keyup',e=>{if(speedKey===e.key){speedKey='';e.preventDefault();e.stopImmediatePropagation();}},true);
  addEventListener('simgolf-screen-resize',()=>{if(speedPickerOpen)syncSpeed();});
  var muteAudio=Module.createAudioMuteButton('mobile-mute');muteAudio.className='icon';muteAudio.hidden=true;
  var sectionButtons={system:menu,build:buildShortcut,play:playShortcut,manage:manageShortcut,enhanced:enhancedShortcut};
  for(var name of Object.keys(sectionButtons)){sectionButtons[name].dataset.section=name;sectionButtons[name].setAttribute('aria-controls','mobile-panel');rail.appendChild(sectionButtons[name]);if(name==='system'){rail.appendChild(speedControl);rail.appendChild(muteAudio);}}
  document.body.appendChild(rail);
  var openHole=icon('Open hole','M4 3h4v7h8V3h4v18h-4v-7H8v7H4z',function(){if(!s.canOpenHole||holeToOpen!==null||pendingHole)return;holeToOpen=s.openableHole;if(s.photoActive)Module.keyboardInput(27,27);requestSection('');});openHole.querySelector('svg').setAttribute('fill','currentColor');openHole.querySelector('svg').setAttribute('stroke','none');openHole.id='mobile-open-hole';openHole.setAttribute('aria-label','Open hole');openHole.title='Open hole';openHole.hidden=true;document.body.appendChild(openHole);
  var closePhoto=button('Close photo',function(){Module.setAimMode(false);Module.keyboardInput(27,27);});closePhoto.id='mobile-close-photo';root.appendChild(closePhoto);
  var camera=document.createElement('div');camera.id='mobile-camera';
  var pan=icon('Pan map','M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4',function(){
    if(s.rebuildClubhouse&&s.object===15){panBuildTool=panBuildTool?.clubhouse?null:{clubhouse:true,object:15};Module.setMapMode(panBuildTool?6:0);render();return;}
    if(building){
      if(panBuildTool!==null){
        var tool=panBuildTool;panBuildTool=null;command(tool.kind,tool.item,true);
        if(tool.variation!==undefined)command(14,tool.variation,true);
      }else{
        if(s.constructing&&lastBuildTool){panBuildTool=Object.assign({},lastBuildTool,{object:s.object,variationState:s.variation?Object.assign({},s.variation):null});if(s.variation)panBuildTool.variation=s.variation.selected;}
        Module.setMapMode(0);
      }
      render();
    }else {endBuild();open=false;render();}
  });pan.id='mobile-pan';
  camera.append(pan,icon('Rotate left','M3 10a9 9 0 1 1 2 8M3 4v6h6',function(){command(1,36);}),icon('Rotate right','M21 10a9 9 0 1 0-2 8M21 4v6h-6',function(){command(1,33);}));root.appendChild(camera);
  var buildActions=document.createElement('div');buildActions.id='mobile-build-actions';
  var remove=icon('Remove / Undo','M4 14l9-11 8 7-9 11H7l-3-3zM7 21h15M9 8l8 7',function(){Module.setMapMode(Module.mapMode===2?0:2);syncControls();});remove.id='mobile-remove';
  var cancel=icon('Cancel','M5 5l14 14M19 5L5 19',cancelSection);cancel.id='mobile-cancel';cancel.hidden=true;buildActions.append(remove);root.append(buildActions);document.body.appendChild(cancel);
  var strip=document.createElement('section');strip.id='mobile-build-strip';strip.setAttribute('aria-label','Construction choices');root.appendChild(strip);
  var stripHeader=document.createElement('div');stripHeader.className='strip-header';
  var stripTitle=document.createElement('div');stripTitle.className='strip-title';
  var nextVariation=button('Next Variation',function(){
    if(strip.hidden||!canCycleVariation())return;
    if(buildPage==='course'&&hasCourseVariation())command(0,9,true); // Original Tab shortcut.
    else if(buildPage==='improvements'){
      const next=nextImprovementVariation();
      if(next>=0)command(14,next,true);
    }
  });nextVariation.id='mobile-next-variation';nextVariation.hidden=true;
  stripHeader.append(stripTitle,nextVariation);strip.appendChild(stripHeader);
  var lotControls=document.createElement('section');lotControls.id='mobile-lot-controls';lotControls.hidden=true;lotControls.setAttribute('aria-label','Building lot placement');var lotDetails=document.createElement('div');lotDetails.setAttribute('role','status');var placeLot=button('Place',function(){Module.requestLot();syncControls();});placeLot.id='mobile-place-lot';lotControls.append(lotDetails,placeLot);root.appendChild(lotControls);
  var terrainControls=document.createElement('section');terrainControls.id='mobile-terrain-controls';terrainControls.hidden=true;terrainControls.setAttribute('aria-label','Terrain adjustment');
  var terrainStatus=document.createElement('div');terrainStatus.id='mobile-terrain-status';terrainStatus.setAttribute('role','status');
  var terrainUp=icon('Raise selected terrain','M12 20V4M5 11l7-7 7 7',function(){Module.requestTerrainStep(1);});terrainUp.id='mobile-terrain-up';terrainUp.hidden=true;
  var terrainPrecision=button('Precision',function(){Module.setTerrainMode(!Module.terrainMode);syncControls();});terrainPrecision.id='mobile-terrain-precision';terrainPrecision.setAttribute('aria-label','Precision terrain control');terrainPrecision.setAttribute('aria-pressed','false');
  var terrainDown=icon('Lower selected terrain','M12 4v16M5 13l7 7 7-7',function(){Module.requestTerrainStep(-1);});terrainDown.id='mobile-terrain-down';terrainDown.hidden=true;
  var terrainElevationMap=button('Elevation Map',()=>openElevation('terrain'));terrainElevationMap.id='mobile-terrain-elevation-map';terrainElevationMap.hidden=true;
  terrainControls.append(terrainStatus,terrainUp,terrainPrecision,terrainDown,terrainElevationMap);root.appendChild(terrainControls);
  var roundControls=document.createElement('div');roundControls.id='mobile-round-controls';root.appendChild(roundControls);
  var resumeShots=button('Resume shots',function(){command(13,0,true);});resumeShots.id='mobile-resume-shots';
  function setRoundAim(enabled){
    Module.setAimMode(enabled);
    if(Module.aimMode)shotChoicesOpen=true;
  }
  var aim=button('Aim',function(){setRoundAim(!Module.aimMode);syncControls();});aim.id='mobile-aim';
  var shoot=button('Shoot',function(){Module.requestShot();syncControls();});shoot.id='mobile-shoot';
  roundControls.append(resumeShots,aim,shoot);
  var choices=document.createElement('div');choices.id='mobile-shot-choices';choices.setAttribute('aria-label','Available shot types');root.appendChild(choices);
  var roundInfo=document.createElement('div');roundInfo.id='mobile-round-info';roundInfo.setAttribute('role','status');root.appendChild(roundInfo);
  var shotNames=['Straight','Fade','Draw','High backspin','Low punch'],shotValues=[0,-1,1,3,4];

  var toggles=document.createElement('div');toggles.id='mobile-round-toggles';
  var infoToggle=button('Info',function(){infoOpen=!infoOpen;if(infoOpen)scoreOpen=false;syncControls();});
  var scoreToggle=button('Score',function(){scoreOpen=!scoreOpen;if(scoreOpen)infoOpen=false;syncControls();});
  scoreToggle.setAttribute('aria-label','Scorecard');toggles.append(scoreToggle,infoToggle);root.appendChild(toggles);
  var scorecard=document.createElement('section');scorecard.id='mobile-scorecard';scorecard.setAttribute('aria-label','Round scorecard');root.appendChild(scorecard);
  var leaderboardToggle=button('',function(){showCourseLegend(false);leaderboardOpen=!leaderboardOpen;leaderboardRevealPlayer=leaderboardOpen;syncControls();});leaderboardToggle.id='mobile-leaderboard-toggle';leaderboardToggle.setAttribute('aria-controls','mobile-leaderboard');
  const leaderboardTitle=document.createElement('span'),leaderboardSummary=document.createElement('span'),
    leaderboardPosition=document.createElement('span'),leaderboardName=document.createElement('strong'),
    leaderboardScore=document.createElement('span');
  leaderboardTitle.id='mobile-leaderboard-title';
  leaderboardTitle.textContent='LEADERBOARD';
  leaderboardSummary.id='mobile-leaderboard-summary';
  leaderboardSummary.hidden=true;
  leaderboardPosition.id='mobile-leaderboard-position';
  leaderboardName.id='mobile-leaderboard-name';
  leaderboardScore.id='mobile-leaderboard-score';
  leaderboardSummary.append(leaderboardPosition,leaderboardName,leaderboardScore);
  leaderboardToggle.append(leaderboardTitle,leaderboardSummary);
  var leaderboard=document.createElement('section');leaderboard.id='mobile-leaderboard';leaderboard.setAttribute('aria-label','Live tournament leaderboard');const leaderboardCrest=document.createElement('div');leaderboardCrest.id='mobile-leaderboard-crest';leaderboardCrest.hidden=true;
  let leaderboardCrestRequested=false;
  root.append(leaderboardToggle,leaderboard,leaderboardCrest);
  var status=document.getElementById('mobile-status'),buildLabel=document.getElementById('build-label'),header=buildLabel.parentElement;
  var courseHud=document.createElement('div');courseHud.id='mobile-course-hud';courseHud.hidden=true;
  var courseStatus=document.createElement('div');courseStatus.id='mobile-course-status';
  var courseBadge=document.createElement('div');courseBadge.id='mobile-course-badge';courseBadge.setAttribute('aria-label','Current course');courseBadge.hidden=true;
  var courseDetails=document.createElement('div');courseDetails.id='mobile-course-details';
  var courseName=document.createElement('span');courseName.id='mobile-course-name';var courseHeading=document.createElement('div');courseHeading.id='mobile-course-heading';var courseDate=document.createElement('span');courseDate.id='mobile-course-date';courseDetails.appendChild(courseHeading);
  var courseMeta=document.createElement('span');courseMeta.id='mobile-course-meta';courseHeading.append(courseName,courseMeta);
  var courseLots=document.createElement('p');courseLots.id='mobile-course-lots';
  var courseAwards=document.createElement('p');courseAwards.id='mobile-course-awards';
  var coursePro=document.createElement('p');coursePro.id='mobile-course-pro';
  var courseIndicators=document.createElement('div');courseIndicators.id='mobile-course-indicators';courseIndicators.append(courseLots,courseAwards,coursePro);var courseRow=document.createElement('div');courseRow.id='mobile-course-row';courseRow.append(courseIndicators);var courseStats=document.createElement('div');courseStats.id='mobile-course-stats';courseDetails.append(courseDate,courseRow,courseStats);courseBadge.append(courseDetails);courseHud.append(courseBadge,courseStatus);root.appendChild(courseHud);
  const courseLegend=document.createElement('section'),legendHeader=document.createElement('header'),
    legendTitle=document.createElement('h2'),legendList=document.createElement('ul'),legendEmpty=document.createElement('p');
  courseLegend.id='mobile-course-legend';courseLegend.hidden=true;
  legendTitle.id='mobile-course-legend-title';legendTitle.textContent='Course symbols';
  courseLegend.setAttribute('aria-labelledby',legendTitle.id);
  legendEmpty.textContent='There are no course symbols to explain right now.';
  const legendToggle=button('',()=>showCourseLegend(courseLegend.hidden));
  legendToggle.id='mobile-course-legend-toggle';legendToggle.title='Course symbols';
  legendToggle.setAttribute('aria-label','Course symbols');
  legendToggle.setAttribute('aria-controls',courseLegend.id);
  legendToggle.setAttribute('aria-expanded','false');
  const legendClose=button('Close',()=>{showCourseLegend(false);legendToggle.focus({preventScroll:true});});
  legendClose.id='mobile-course-legend-close';
  courseBadge.append(legendToggle);
  legendHeader.append(legendTitle,legendClose);
  courseLegend.append(legendHeader,legendList,legendEmpty);
  courseHud.append(courseLegend);
  var courseMoney=document.createElement('span');courseMoney.id='mobile-course-money';var courseFun=document.createElement('span');courseFun.id='mobile-course-fun';var courseSkill=document.createElement('span');courseSkill.id='mobile-course-skill';courseStats.append(courseMoney,courseFun,courseSkill);

  var message=document.createElement('div');message.id='mobile-message';message.setAttribute('role','status');root.appendChild(message);
  var messageBody=document.createElement('div');messageBody.id='mobile-message-text';message.appendChild(messageBody);
  var messageText=document.createTextNode('');messageBody.appendChild(messageText);
  var dismissedMessage=null,repeatedMessage='',clubNoticeText='',challengeNoticeText='',businessNoticeText='';
  var viewRecord=button('View Record',function(){if(businessNoticeText)openBusinessChallenges();else if(challengeNoticeText)Module.openDesignChallenges?.();else Module.openClubRecords?.('recent');});
  viewRecord.hidden=true;viewRecord.className='club-record-action';messageBody.appendChild(viewRecord);
  function lastCourseMessage(){
    const note=Module.mobileNotification;
    return ((!note?.photoSerial&&note?.snapshotOwner===undefined&&note?.text)||Module.readGameText(0x5a6d40,4096)).trim();
  }

  var messageClose=icon('Close message','M8 8l8 8M16 8l-8 8',function(){
    if(businessNoticeText){Module.clearBusinessChallengeNotice?.();businessNoticeText='';message.hidden=true;return;}
    if(challengeNoticeText){Module.clearDesignChallengeNotice?.();challengeNoticeText='';message.hidden=true;return;}
    if(clubNoticeText){Module.clearClubRecordNotice?.();clubNoticeText='';message.hidden=true;return;}
    const replay=!!repeatedMessage;repeatedMessage='';dismissedMessage=s.message||'';message.hidden=true;
    if(replay)return;
    // Only blocking dialogs receive a native acknowledgement. Ordinary
    // messages close locally, so dismissing one cannot commit a pending shot.
    if(s.photoActive)Module.keyboardInput(27,27);
    else if(s.fundsCheck)Module.keyboardInput(13,13);
  });messageClose.id='mobile-message-close';messageClose.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 8l8 8M16 8l-8 8"/></svg>';message.appendChild(messageClose);
  var messageStyle=document.createElement('style');messageStyle.textContent='#mobile-message .club-record-action:not([hidden]){display:block;min-height:44px;margin-top:5px}#mobile-message-text{min-height:0;overflow:auto;overscroll-behavior:contain;touch-action:pan-y}#mobile-ui #mobile-message-close{position:absolute;top:2px;right:2px;width:38px;height:38px;min-width:38px;min-height:38px;padding:7px;margin:0;border:0;border-radius:50%;background:transparent;box-shadow:none;color:inherit}#mobile-ui #mobile-message-close svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:2}#mobile-worker-placement{position:absolute;left:64px;right:8px;bottom:calc(max(8px,env(safe-area-inset-bottom)) + var(--strip-space,0px) + 116px);width:fit-content;max-width:calc(100% - 80px);margin:0 auto;padding:8px 12px;box-sizing:border-box;border-radius:6px;background:var(--menu-overlay);text-align:center;pointer-events:none}';document.head.appendChild(messageStyle);
  var workerHint=document.createElement('div');workerHint.id='mobile-worker-placement';workerHint.setAttribute('role','status');workerHint.hidden=true;root.appendChild(workerHint);
  function reflowMessage(value){
    // Original single newlines are fixed-width wrapping. Keep paragraphs and
    // explicit list items while allowing prose to wrap to the current screen.
    return value.replace(/\r\n?/g,'\n').split(/\n[ \t]*\n/).map(function(paragraph){
      return paragraph.trim().replace(/[ \t]*\n[ \t]*/g,'\n').split('\n').reduce(function(lines,line){
        line=line.replace(/[ \t]+/g,' ').trim();
        if(!lines.length||/^(?:[•*−-] |\d+[.)] )/.test(line))lines.push(line);else lines[lines.length-1]+=' '+line;
        return lines;
      },[]).join('\n');
    }).join('\n\n');
  }
  var acknowledge=button('Continue',function(){Module.keyboardInput(13,13);});
  var zoomValue=document.createElement('span');zoomValue.id='mobile-closeup';
  var zoomNotice=document.createElement('span');zoomNotice.id='mobile-zoom-notice';zoomNotice.hidden=true;zoomNotice.setAttribute('role','status');
  courseStatus.append(zoomValue,zoomNotice);
  var panel=document.createElement('section');panel.id='mobile-panel';panel.setAttribute('aria-label','Game menu');root.appendChild(panel);
  var dialog=document.createElement('div');dialog.id='mobile-dialog-actions';
  dialog.append(button('Keyboard',function(){open=true;page='keyboard';render();}),button('Enter',function(){Module.keyboardInput(13,13);}),button('Back',function(){Module.keyboardInput(27,27);}));root.appendChild(dialog);
  ['mousedown','mousemove','mouseup','click','pointerdown','pointerup','pointermove','touchstart','touchmove','touchend','wheel','keydown','keyup','keypress','beforeinput','input','compositionstart','compositionupdate','compositionend'].forEach(function(t){root.addEventListener(t,function(e){e.stopPropagation();});});
  document.body.appendChild(root);
  for(var type of ['mousedown','mousemove','mouseup','click','dblclick','pointerdown','pointerup','pointermove','touchstart','touchmove','touchend','wheel','keydown','keyup','keypress'])for(var control of [rail,cancel])control.addEventListener(type,function(e){e.stopPropagation();});
  // Keep the pressed button alive while original status/rosters update. A
  // rebuilt panel between touch-down and release would lose the click.
  var menuPointers=new Set();
  for(var region of [root,rail,cancel,openHole])region.addEventListener('pointerdown',function(e){menuPointers.add(e.pointerId);},true);
  ['pointerup','pointercancel'].forEach(function(type){addEventListener(type,function(e){menuPointers.delete(e.pointerId);},true);});
  addEventListener('blur',function(){menuPointers.clear();});

  function button(text,action){var b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',action);return b;}
  function icon(label,path,action){var b=button('',action);b.className='icon';b.setAttribute('aria-label',label);b.title=label;var svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','2');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');var p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',path);svg.appendChild(p);b.appendChild(svg);return b;}
  // These SVG strings are app-authored constants, never imported game/user data.
  function artIcon(label,art,action){var b=icon(label,'',action),svg=b.querySelector('svg');svg.setAttribute('viewBox','0 0 64 64');svg.setAttribute('fill','currentColor');svg.setAttribute('stroke','none');svg.setAttribute('stroke-linecap','butt');svg.setAttribute('stroke-linejoin','miter');svg.innerHTML=art;return b;}
  var borrowedBuildNavigation=false;
  function endBuild(){borrowedBuildNavigation=false;panBuildTool=null;lastBuildTool=null;building=false;buildPage='';pendingHole=null;Module.setMapMode(0);}
  function restoreBorrowedBuild(){
    if(!borrowedBuildNavigation)return false;
    borrowedBuildNavigation=false;
    if(!building)return false;
    selectedSection='build';contextGroup='build';page=buildPage;open=false;render();
    return true;
  }
  Module.finishClubhouseNavigation=restoreBorrowedBuild;
  function navigate(name){
    if(Module.terrainMode)Module.setTerrainMode(false);
    contextGroup=groupForPage(name);
    if(['build','course','terrain','buildings','improvements'].includes(name)){
      borrowedBuildNavigation=false;building=true;buildPage=name;stripStamp='';
      if(name==='improvements'){activeImprovement=-1;buildingChoices=false;}
    }else if(building){
      const clubhouse=Module.hasGameFeature('clubhouseManagement')&&['system','manage','enhanced'].includes(name);
      const elevation=Module.hasGameFeature('elevationMap')&&['system','enhanced'].includes(name);
      const review=Module.hasGameFeature('courseReview')&&['system','enhanced'].includes(name)&&
        s.tool>=0&&s.object<0&&!s.elevation&&!Module.mapMode;
      if(clubhouse||review||elevation)borrowedBuildNavigation=true;
      else endBuild();
    }
    page=name;open=name!=='course'&&name!=='improvements';render();
  }
  function groupForPage(name){
    if(['build','course','terrain','improvements','buildings','landmarks'].includes(name))return 'build';
    if(['play','shots','golfers'].includes(name))return 'play';
    if(['manage','staff'].includes(name))return 'manage';
    if(name==='enhanced')return 'enhanced';
    return name==='system'||name==='keyboard'?'system':'';
  }
  function modalSection(){
    for(var entry of [['elevation-overview',Module.elevationMapSource==='terrain'?'build':'enhanced','elevation-overview-close'],['local-save-files','system','local-save-close'],['course-review','enhanced','course-review-close'],['business-challenges','enhanced','business-challenges-close'],['mobile-report',Module.profileState?.confirmation==='tournament-offer'?'play':'manage','mobile-report-close'],['mobile-locations','manage','mobile-location-close'],['mobile-golfer-card','play','mobile-golfer-card-done'],['mobile-profile',['land-offer','home-demolition','building-demolition'].includes(Module.profileState?.confirmation)?'build':Module.loadDeleteConfirm||Module.profileState?.confirmation?'system':Module.profileState?.clubhouseDemolition?'build':'play','mobile-profile-done'],['mobile-staff','manage','mobile-staff-done'],['mobile-load','system','mobile-load-cancel'],['mobile-match','play','mobile-match-back']]){
      var element=document.getElementById(entry[0]);
      if(element&&!element.hidden&&element.getClientRects().length)return {id:entry[0],group:entry[1],close:document.getElementById(entry[2]),key:entry[0]+':'+(entry[0]==='mobile-profile'?Module.profileState?.kind+':'+Module.profileState?.serial:entry[0]==='mobile-staff'?(Module.staffHire?'hire:'+Module.staffHire.serial:Module.staffRenaming>=0?'rename':'roster'):'screen')};
    }
    return null;
  }
  function dismissSectionDialog(modal){
    if(modal.id==='mobile-profile'&&Module.profileState?.confirmation==='tournament-preparation')return false;
    if(modal.id==='mobile-profile'&&(Module.profileState?.clubhouseDemolition||Module.profileState?.confirmation)){
      if(Module.profileQueue.length>=32)return false;
      Module.cancelMapGesture();Module.profileQueue.push([Module.profileState.serial,5,Module.profileState.cancelChoice??1]);return true;
    }
    if(modal.id==='mobile-report'&&Module.dismissMobileReport?.())return true;
    var close=modal.close;
    if(close&&!close.disabled&&close.getClientRects().length){close.click();return true;}
    if(modal.id==='mobile-profile'&&Module.profileState?.kind>=4){leaveKeyboard();Module.keyboardInput(27,27);return true;}
    return false;
  }
  function closeSection(){if(restoreBorrowedBuild())return;pendingBackOnly=false;selectedSection='';if(page==='keyboard')leaveKeyboard();if(building)endBuild();open=false;page='';contextGroup='';render();}
  function hasEnhancedSection(){return !!Module.hasEnhancedCareer?.();}
  function showSection(name){
    if(!name||(name==='enhanced'&&!hasEnhancedSection())){closeSection();return;}
    selectedSection=name==='system'?'':name;
    navigate(name);
  }
  // The section icon is a back button inside its own hierarchy. The map
  // after a terrain/catalogue choice is one level below that choice screen.
  function sectionButton(name){
    if(name==='enhanced'&&!hasEnhancedSection())return;
    holeToOpen=null;
    var modal=modalSection(),active=modal?modal.group:open?groupForPage(page):building?'build':selectedSection||(!s.course?contextGroup:'');
    if(active!==name){requestSection(name);return;}
    if(modal||(!s.course&&seenCourse)){requestSection(name,true);return;}
    if(Module.terrainMode)Module.setTerrainMode(false);if(Module.lotMode)Module.setLotMode(false);if(Module.aimMode)Module.setAimMode(false);Module.cancelMapGesture();
    if(open&&page===name){closeSection();return;}
    if(name==='build'){
      panBuildTool=null;lastBuildTool=null;pendingHole=null;Module.setMapMode(0);
      if(page==='terrain'&&!open){navigate('terrain');return;}
      if(page==='landmarks'||page==='buildings'){
        if(!open){openCatalogue(page);return;}
        navigate('improvements');return;
      }
      if(page==='improvements'&&(activeImprovement>=0||buildingChoices)){navigate('improvements');return;}
    }
    var parent={course:'build',terrain:'build',improvements:'build',buildings:'improvements',landmarks:'improvements',shots:'play',golfers:'play',staff:'manage',keyboard:'system'}[page];
    if(!open&&!['course','improvements'].includes(page)&&page!==name){open=true;render();return;}
    if(page==='keyboard')leaveKeyboard();
    navigate(parent||name);
  }
  function requestSection(name,backOnly){
    if(Module.terrainMode)Module.setTerrainMode(false);if(Module.aimMode)Module.setAimMode(false);Module.cancelMapGesture();
    var modal=modalSection();
    if(modal||(!s.course&&seenCourse)){
      pendingSection=name;pendingBackOnly=!!backOnly;
      // Use each screen's ordinary Back/Done action; never bypass its native
      // confirmation or abandon edits by forcing game state.
      if(modal){pendingModalKey=modal.key;dismissSectionDialog(modal);}
      else {leaveKeyboard();Module.keyboardInput(27,27);}
      return;
    }
    pendingSection=null;pendingBackOnly=false;showSection(name);
  }
  function cancelSection(){
    if(Module.golferHistoriesOpen){Module.closeGolferHistories?.();return;}
    const card=document.getElementById('mobile-golfer-card');
    if(card&&!card.hidden){document.getElementById('mobile-golfer-card-done').click();return;}
    if(s.rebuildClubhouse&&s.object===15&&s.course&&!open&&!modalSection()){panBuildTool={clubhouse:true,object:15};Module.setMapMode(6);render();return;}
    holeToOpen=null;
    pendingBackOnly=false;
    if(Module.terrainMode)Module.setTerrainMode(false);if(Module.aimMode)Module.setAimMode(false);Module.cancelMapGesture();
    if(modalSection()||(!s.course&&seenCourse)){requestSection('');return;}
    pendingSection=null;
    if(Module.staffPlacement&&s.movingWorker){closeSection();command(13,0);return;}
    // Closing a web panel must not also cancel an unrelated native selection.
    if(open||selectedSection){closeSection();return;}
    closeSection();Module.keyboardInput(27,27);
  }
  function syncRail(){
    rail.hidden=!seenCourse||!!Module.atTitle;document.body.classList.toggle('mobile-rail-visible',!rail.hidden);
    var modal=modalSection(),active=modal?modal.group:open?groupForPage(page):building?'build':selectedSection||(!s.course?contextGroup:'');
    // The main chooser exists only while its System panel is visible. Native
    // dialogs and map actions must not retain a dismissed chooser's buttons.
    var choosing=open&&page==='system'&&!!s.course&&!modal;
    const resume=Module.gameEdition==='enhanced'&&s.paused;
    muteAudio.hidden=!choosing;speedControl.hidden=!choosing||(!resume&&!Module.hasGameFeature('gameSpeed')&&!Module.hasGameFeature('pauseControl'));syncSpeed();
    var selected=modal?modal.group:selectedSection;
    for(var name of Object.keys(sectionButtons)){
      var button=sectionButtons[name];button.hidden=(name==='enhanced'&&!hasEnhancedSection())||(name!=='system'&&!choosing&&name!==selected);
      button.setAttribute('aria-pressed',String(!rail.hidden&&!button.hidden&&active===name));
      button.setAttribute('aria-expanded',String(name==='system'?choosing:open&&groupForPage(page)===name));
    }
  }
  // Read the actual loaded indexed artwork/palette. No original art is bundled
  // in this UI or exported to a public package. Unsupported layouts retain text.
  function tileArt(t){
    var u=function(a){return HEAPU32[a>>>2];},wrap=t.art,bm=u(wrap+4);if(!bm||u(wrap+8))return null;
    var bits=u(bm+20),stride=u(bm+44),w=u(bm+48),h=u(bm+52),pal=t.palette||u(bm+16)||u(u(0x1012873c)+4);
    if(u(bm+32)!==8||!bits||!pal||!w||!h||w>(t.large?1024:256)||h>(t.large?1024:256)||stride<w||bits+stride*h>HEAPU8.length||pal+1036>HEAPU8.length)return null;
    var mask=t.mask?u(t.mask+4):0,maskBits=mask?u(mask+20):0,maskStride=mask?u(mask+44):0;
    if(t.mask&&(!maskBits||u(mask+32)!==8||u(mask+48)!==w||u(mask+52)!==h||maskStride<w||maskBits+maskStride*h>HEAPU8.length))return null;
    var canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.setAttribute('aria-hidden','true');
    var ctx=canvas.getContext('2d'),im=ctx.createImageData(w,h);
    for(var y=0;y<h;y++)for(var x=0;x<w;x++){var c=HEAPU8[bits+y*stride+x],p=(y*w+x)*4,q=pal+12+c*4,m=maskBits?HEAPU8[maskBits+y*maskStride+x]:0,a=c===255||(t.withoutShadow&&c>=248)?0:255-m;
      // Original10025dd0 adds premultiplied source to mask*background.
      // Convert only an explicitly masked UI preview to canvas straight alpha.
      var factor=a&&maskBits?255/a:1;im.data[p]=HEAPU8[q]*factor;im.data[p+1]=HEAPU8[q+1]*factor;im.data[p+2]=HEAPU8[q+2]*factor;im.data[p+3]=a;}
    ctx.putImageData(im,0,0);return canvas;
  }
  Module.originalIndexedArt=tileArt;
  // Read-only equivalent of43d6f0: already loaded bank wrappers, last frame,
  // original toolbar palette. No animation advance, asset exports or RNG.
  function bankArt(bank,palette,frame,rotation=0){
    var start=HEAP32[(0x5a9370+bank*4)>>>2],n=HEAP32[(0x53f3e8+bank*4)>>>2];
    if(start<0||n<1)return null;
    var index=start+n*rotation+(frame===undefined?n-1:Math.max(0,Math.min(n-1,frame)));
    return tileArt({art:0x5aaa30+index*44,palette:HEAPU32[(0x81ca14+palette*88)>>>2],large:true,withoutShadow:true});
  }
  function improvementArt(kind,id){
    if(kind===4)return bankArt(0x168+id,100+id);
    if(kind===1)return bankArt(0x208+id,170+id);
    if(kind===2)return bankArt(0x1a3+Math.trunc(id/5)*6,45+id%5);
    if(kind===16)return bankArt(0x12f+id,180+id);
    if(kind===19)return bankArt(0x226+id,169);
    var b=s.buildingDetails?.[kind-6],level=b?.level||0;
    var banks=[0x17c,0x1ec,0x1e0,0x1d4,0x17e,0x1c2,0x1ce,0x1e6,0x1da];
    var palettes=[20,16,14,28,20,23,27,17,18];
    return kind>=6&&kind<=14?bankArt(banks[kind-6]+(kind===7?0:level),level&&![6,10].includes(kind)?kind+144:palettes[kind-6],[6,10].includes(kind)?HEAPU8[0x5a34e0]:0):null;
  }
  function variantLabel(kind,id){return ({1:'Bench',2:'Flower bed',16:'Scenic tree',19:'Scenic bridge'})[kind]+' '+(id+1);}

  var courseBadgeCounters='';
  function counter(parent,key,value,label,path,detail){
    if(!value)return;
    var item=document.createElement('span');item.className='course-counter';item.dataset.counter=key;item.dataset.legendLabel=detail?label+' · '+detail:label;item.title=label+': '+value;item.setAttribute('role','img');item.setAttribute('aria-label',item.title);
    var svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','2');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');var p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',path);svg.appendChild(p);item.append(svg,document.createTextNode(String(value)));parent.appendChild(item);
  }
  function refreshCourseLegend(){
    legendList.replaceChildren();
    for(const counter of courseIndicators.querySelectorAll('.course-counter')){
      const row=document.createElement('li');
      row.append(counter.querySelector('svg').cloneNode(true),counter.dataset.legendLabel);
      legendList.append(row);
    }
    legendEmpty.hidden=!!legendList.childElementCount;
  }
  function showCourseLegend(show){
    if(show){
      leaderboardOpen=leaderboardRevealPlayer=false;
      refreshCourseLegend();
      courseLegend.scrollTop=0;
    }
    courseLegend.hidden=!show;
    legendToggle.setAttribute('aria-expanded',String(show));
    if(show)syncControls();
  }
  function syncCourseHeader(){
    courseHud.hidden=courseBadge.hidden;
    var docked=!root.hidden&&!courseHud.hidden&&getComputedStyle(courseHud).visibility==='visible';
    if(!courseLegend.hidden&&(!docked||open))showCourseLegend(false);
    var host=docked?courseStatus:header;
    if(buildLabel.parentElement!==host)host.append(buildLabel,status);
    document.body.classList.toggle('mobile-course-hud-visible',docked);
    var space=docked?Math.max(0,courseHud.getBoundingClientRect().height-22)+8:0;
    root.style.setProperty('--course-badge-space',space+'px');
    return space;
  }
  function syncCourseBadge(course){
    // No course exists while the asynchronous WASM module is loading. Do not
    // inspect its heap until the native publisher actually enters a course.
    if(!course){courseBadge.hidden=true;courseBadgeStamp='';Module.courseSummary=null;return syncCourseHeader();}
    // Original40daa0/45b9f0: custom name, or the active property's template.
    // Original40f5c0 draws the emblem selected by that same template byte.
    // Read only; never copy the shared formatting scratch buffer51a068.
    var index=HEAP32[0x59bf90>>>2],type=index>=0&&index<16?HEAP8[0x571ff4+index*46]:-1;
    var valid=course&&!s.photoActive&&type>=0&&type<16,template=0x4c1ea8+type*130;
    var offset=HEAP16[0x59d81c>>>1],name=valid?Module.readGameText(offset>=0&&offset<0x2324?0x56fcb0+offset:template+1,129):'';
    courseBadge.hidden=!valid||!name;
    if(!courseBadge.hidden){
      var emblem=HEAPU8[template],art=0x541710+emblem*44,mask=0x5791f8+emblem*44,bm=emblem<16?HEAPU32[(art+4)>>>2]:0;
      var stamp=JSON.stringify([name,art,bm,bm?HEAPU32[(bm+20)>>>2]:0,emblem<16?HEAPU32[(mask+4)>>>2]:0]);
      if(stamp!==courseBadgeStamp){
        courseName.textContent=name;courseBadge.title=name;
        courseBadge.querySelector('canvas')?.remove();
        var image=emblem<16?tileArt({art:art,mask:mask}):null;
        if(image){courseBadge.prepend(image);courseBadgeStamp=stamp;}else courseBadgeStamp='';
      }
      // Read original counters; hide zero values in the compact mobile HUD.
      // No lot, award, membership or difficulty writes occur here.
      var tick=HEAP32[0x834170>>>2],difficulty=HEAP32[0x822c88>>>2];
      var month=(Math.trunc(tick/1024)&7),year=2001+Math.trunc(tick/8192);
      var date=Module.readGameText(HEAPU32[(0x4c2908>>>2)+month],32)+' '+year;
      var difficultyText=difficulty>=0&&difficulty<4?Module.readGameText([0x4c6210,0x4c6204,0x4c61f8,0x4c61e8][difficulty],24).trim().replace(/,\s*$/,''):'';
      var flags=HEAPU32[0x59e7b8>>>2],pro=HEAP32[0x4c2e14>>>2];
      // Original436060 case2: the original selector remains authoritative.
      var proAvailable=!!(flags&0x2000)&&HEAPU32[0x5685f0>>>2]>1&&pro!==-1&&HEAP32[0x5a59f8>>>2]===-1&&!(flags&0x4200000);
      var proName=pro>=0&&pro<100?Module.readGameText(0x58dd50+pro*56,32):'';
      var summary={date:date,difficulty:difficultyText,lots:HEAP32[0x56d1b0>>>2],holeAwards:HEAP32[0x5a9cac>>>2],soldLots:HEAP32[0x5a9cb0>>>2],tournaments:HEAP32[0x5787cc>>>2],proWins:HEAP32[0x561258>>>2],proAvailable:proAvailable,proName:proName};
      Module.courseSummary=summary;
      courseDate.textContent=date;courseMeta.textContent=difficultyText;
      var cash=s.cash||0;courseMoney.textContent=(cash<0?'−$':'$')+Math.abs(cash).toLocaleString();courseMoney.dataset.negative=String(cash<0);
      courseFun.textContent='Fun '+s.funRating;courseSkill.textContent='Skill '+(s.skillRating/100).toFixed(2);
      var counters=JSON.stringify(summary);
      if(counters!==courseBadgeCounters){courseBadgeCounters=counters;
        courseLots.replaceChildren();courseAwards.replaceChildren();coursePro.replaceChildren();
        counter(courseLots,'lots',summary.lots,'Building lots available','M3 3h18v18H3z M3 9h18 M9 3v18');
        counter(courseAwards,'holeAwards',summary.holeAwards,'Hole awards','m12 3 3 6 6 1-4 5 1 6-6-3-6 3 1-6-4-5 6-1z');
        counter(courseAwards,'soldLots',summary.soldLots,'Sold lots','m3 11 9-8 9 8 M5 10v11h14V10 M10 21v-7h4v7');
        counter(courseAwards,'tournaments',summary.tournaments,'Competition points','M7 3h10v7a5 5 0 0 1-10 0z M7 5H3v3a4 4 0 0 0 4 4 M17 5h4v3a4 4 0 0 1-4 4 M12 15v6 M8 21h8','First place in an SGA tournament earns 3 points.');
        counter(courseAwards,'proWins',summary.proWins,'Pro wins','M5 21V3 M5 3h13l-3 5 3 5H5');
        counter(coursePro,'proAvailable',proAvailable?1:0,'Pro match available'+(proName?': '+proName:''),'m5 3 14 18 M19 3 5 21 M3 3h4 M17 3h4');
        for(var line of [courseLots,courseAwards,coursePro])line.hidden=!line.childElementCount;
        if(!courseLegend.hidden)refreshCourseLegend();
      }
    }else {courseBadgeStamp='';Module.courseSummary=null;}
    return syncCourseHeader();
  }
  function improvementCategoryArt(item){
    const source=tileArt({art:0x59ba68+item*132});
    if(!source||source.width<42||source.height<42)return source;
    const badge=document.createElement('canvas');
    badge.setAttribute('aria-hidden','true');
    const ctx=badge.getContext('2d');
    if(item<3){
      // Trace the original tile and object silhouettes to drop the menu plate.
      const masks=[
        [4,2,51,44,'M4 28 Q9 22 20 16 L25 12 L26 9 L29 8 L28 4 L31 2 L34 6 L34 9 L38 10 L39 14 L42 16 L44 19 Q54 24 55 28 Q53 34 35 44 Q31 47 26 45 L8 33 Z'],
        [7,6,51,36,'M7 24 Q8 21 13 17 L28 8 Q31 6 35 7 L55 20 Q58 22 57 25 L36 40 Q32 42 27 39 L10 28 Z'],
        [7,0,50,45,'M7 27 Q11 21 23 13 L26 10 L26 3 L28 1 L31 0 L34 3 L34 4 L37 2 L40 3 L41 8 L43 11 L45 15 Q53 20 56 24 L56 28 Q52 34 36 42 Q31 45 26 42 L10 31 Z']
      ];
      const [x,y,w,h,outline]=masks[item];
      badge.width=w;badge.height=h;badge.className='category-icon tile-symbol';
      ctx.translate(-x,-y);
      ctx.clip(new Path2D(outline));
      ctx.drawImage(source,0,0);
    }else{
      // The dark rim occupies columns 4–39 and rows 5–40 on all five plates.
      badge.width=badge.height=36;badge.className='category-icon round-badge';
      ctx.drawImage(source,4,5,36,36,0,0,36,36);
    }
    return badge;
  }
  function hasCourseVariation(tool=s.tool){
    // The original Tab action changes green type, bunker orientation and
    // the theme-specific landscaping sprites in terrain group 13.
    return tool===1||tool===7||(tool>=13&&tool<=15&&HEAPU8[0x578376+tool*48]===13);
  }
  const trickyGreenThumbnails=new Map();
  function trickyGreenArt(theme){
    if(!trickyGreenThumbnails.has(theme)){
      let thumbnail=null;
      try{
        const pack=['Parkland','Desert','Tropical','Links'][theme];
        const bytes=Module.originalMenuArt.file('Data/Textures/'+pack+'/TrickyGreenA0001.bmp');
        const bmp=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
        const w=bmp.getInt32(18,true),height=bmp.getInt32(22,true),h=Math.abs(height);
        const step=bmp.getUint16(28,true)/8,offset=bmp.getUint32(10,true),stride=(w*step+3)&~3;
        if(bmp.getUint16(0,true)===0x4d42&&w>0&&h>0&&w<=256&&h<=256&&[3,4].includes(step)&&bmp.getUint32(30,true)===0&&offset>=54&&offset+stride*h<=bytes.length){
          const texture=document.createElement('canvas');texture.width=w;texture.height=h;
          const ctx=texture.getContext('2d'),pixels=ctx.createImageData(w,h);
          for(let y=0;y<h;y++)for(let x=0;x<w;x++){
            const i=offset+(height<0?y:h-y-1)*stride+x*step,p=(y*w+x)*4;
            pixels.data[p]=bytes[i+2];pixels.data[p+1]=bytes[i+1];pixels.data[p+2]=bytes[i];pixels.data[p+3]=255;
          }
          ctx.putImageData(pixels,0,0);
          thumbnail=document.createElement('canvas');thumbnail.width=64;thumbnail.height=42;thumbnail.setAttribute('aria-hidden','true');
          const preview=thumbnail.getContext('2d');
          preview.setTransform(31/w,20/w,-31/h,20/h,32,1);
          preview.drawImage(texture,0,0);
        }
      }catch(e){}
      trickyGreenThumbnails.set(theme,thumbnail);
    }
    const thumbnail=trickyGreenThumbnails.get(theme);
    if(!thumbnail)return null;
    const copy=thumbnail.cloneNode();
    copy.getContext('2d').drawImage(thumbnail,0,0);
    return copy;
  }
  function courseVariantArt(id,variation,theme,rotation){
    if(id===1)return variation&1?trickyGreenArt(theme):null;
    if(id===7){
      // Original bunker hover uses the base preview and three rotated sprites.
      const facing=(variation-rotation)&3;
      const art=facing?0x59cd18+(theme*20+[0,3,1,2][facing])*44:0x59cab0+theme*0x370;
      return tileArt({art});
    }
    // Use the original brush sprite banks with a fixed preview tile so the
    // thumbnail follows the variation and camera, rather than the cursor.
    const alternate=id===14&&Math.floor(variation/3)%2&&theme!==0;
    const bank=(id===13?0x19b:id===15?0x195:alternate?0x198:0x192)+variation%3;
    return bankArt(bank,id===13?0x25:id===15?0x32:alternate?0x2a:0x29,undefined,rotation);
  }
  function canCycleVariation(){
    return s.constructing&&!panBuildTool&&!Module.lotPending&&
      (Module.mapMode===0||(buildPage==='improvements'&&Module.lotMode));
  }
  function nextImprovementVariation(){
    const variation=s.variation;
    if(buildingChoices||!variation)return -1;
    for(let offset=1;offset<=variation.count;offset++){
      const item=(variation.selected+offset)%variation.count;
      if(item!==variation.selected&&(s.object!==4||(variation.mask&(1<<item))))return item;
    }
    return -1;
  }
  function syncBuildStrip(){
    strip.hidden=!s.course||!Module.mobileUI||!building||open||s.photoActive||!['course','improvements'].includes(buildPage);
    if(strip.hidden)return;
    var tiles=s.terrain||[],v=panBuildTool?.variationState||s.variation,selected=improvements.find(function(t){return activeImprovement<0?s.object===t[2]:activeImprovement===t[1];});
    const courseTiles=buildPage==='course';
    const hasVariation=courseTiles?hasCourseVariation():nextImprovementVariation()>=0;
    nextVariation.hidden=!hasVariation;
    nextVariation.disabled=!hasVariation||!canCycleVariation();
    const variant=courseTiles&&hasVariation?HEAPU32[0x5a34f0>>2]:null;
    const theme=variant===null?0:HEAPU8[0x5a34e0],rotation=variant===null?0:(s.rotation>>1)&3;
    var stamp=JSON.stringify([s.availableLots,s.landmarks,s.buildingDetails,buildPage,tiles,s.tool,s.object,v,Module.mapMode,buildingChoices,activeImprovement,s.buildings,panBuildTool,variant,theme,rotation]);
    if(stamp===stripStamp||menuPointers.size)return;stripStamp=stamp;
    var scroll=strip.querySelector('.strip-items')?.scrollLeft||0,subScroll=strip.querySelector('.variations')?.scrollLeft||0;
    for(const row of strip.querySelectorAll('.strip-items'))row.remove();
    stripHeader.classList.toggle('course-tiles',courseTiles);
    stripTitle.textContent=courseTiles?'Course Tiles - Swipe For More · * = Has Variations':(buildingChoices?'Improvements / Buildings':selected?'Improvements / '+selected[0]:'Improvements')+' · swipe for more';
    var row=document.createElement('div');row.className='strip-items';row.setAttribute('aria-label',buildPage==='course'?'Course tiles':'Improvement categories');strip.appendChild(row);
    function card(label,image,action){var b=button(label,action);b.setAttribute('aria-label',label);if(image){var text=document.createElement('span');text.textContent=label;b.replaceChildren(image,text);}return b;}
    function toolMode(){panBuildTool=null;if(Module.mapMode!==0)Module.setMapMode(0);}
    if(courseTiles)tiles.forEach(function(t){
      const active=s.tool===t.id&&Module.mapMode!==2&&panBuildTool===null;
      const variable=hasCourseVariation(t.id);
      const preview=active&&variable&&variant!==null?courseVariantArt(t.id,variant,theme,rotation):null;
      const label=active&&t.id===1&&(variant&1)?'Tricky Green':t.name;
      const b=card(variable?label+'*':label,preview||tileArt(t),function(){toolMode();command(2,t.id);});
      b.setAttribute('aria-label',t.name);
      b.setAttribute('aria-pressed',String(active));
      if(variable)b.setAttribute('aria-description',label===t.name?'Has variations':label+' · Has variations');
      b.dataset.terrain=t.id;row.appendChild(b);
    });
    else {
      improvements.forEach(function(t){var b=card(t[0],improvementCategoryArt(t[1]),function(){buildingChoices=false;activeImprovement=t[1];toolMode();command(4,t[1]);if(t[1]===4)openLandmarks();});b.dataset.improvement=t[1];if(t[1]===2){b.disabled=s.availableLots<1;b.title=b.disabled?'No building lots available':'Drag a preview, then Place';}b.setAttribute('aria-pressed',String(!buildingChoices&&s.object===t[2]&&Module.mapMode!==2));row.appendChild(b);});
      var buildings=icon('Buildings','M3 21V8h8v13M11 21V3h10v18M6 11h2M6 15h2M14 7h4M14 11h4M14 15h4M1 21h22',function(){buildingChoices=true;activeImprovement=-1;stripStamp='';openCatalogue('buildings');});buildings.className='';buildings.querySelector('svg').classList.add('category-icon','buildings-symbol');var text=document.createElement('span');text.textContent='Buildings';buildings.appendChild(text);buildings.setAttribute('aria-pressed',String(buildingChoices));row.appendChild(buildings);
      if(buildingChoices||(v&&selected&&(s.object===selected[2]||panBuildTool?.object===selected[2]))){
        var sub=document.createElement('div');sub.className='strip-items variations';sub.setAttribute('aria-label',buildingChoices?'Building choices':'Improvement variations');strip.appendChild(sub);
        if(buildingChoices){var selectedBuilding=s.buildingDetails?.find(b=>b.kind===(panBuildTool?.object??s.object));var b=button(selectedBuilding?selectedBuilding.name+' · Change':'Choose building',function(){openCatalogue('buildings');});b.className='landmark-choice';sub.appendChild(b);}
        else if(s.object===4||panBuildTool?.object===4){var l=s.landmarks?.find(l=>l.id===v.selected),b=button(l?landmarkName(l)+' · '+(l.free?'Free':'$'+l.price.toLocaleString())+' · Change':'Choose landmark',openLandmarks);b.className='landmark-choice';b.dataset.landmarkChooser='true';sub.appendChild(b);}
        else for(let i=0;i<v.count;i++){let kind=panBuildTool?.object??s.object;var label=variantLabel(kind,i),b=button('',function(){toolMode();command(14,i);});b.setAttribute('aria-label',label);var image=improvementArt(kind,i);if(image)b.appendChild(image);var name=document.createElement('span');name.textContent=label;b.appendChild(name);b.setAttribute('aria-pressed',String(v.selected===i));b.dataset.variation=i;sub.appendChild(b);}
        sub.scrollLeft=subScroll;
      }
    }
    row.scrollLeft=scroll;
  }
  function command(kind,item,keep){
    const shotChoice=kind===5&&item>=4&&item<=8;
    if(shotChoice&&(!s.course||!s.shotTurn||s.photoActive||Module.shotPending||
      !(s.shotMask&(1<<(item-4)))||Module.menuQueue.length>=16))return;
    // Read-only panels can borrow a selected tool while browsing.
    // Ordinary commands still leave Build through its original cancellation.
    if(borrowedBuildNavigation)endBuild();
    const startAim=shotChoice&&!Module.aimMode;
    if(startAim)setRoundAim(true);
    else{
      if(Module.terrainMode)Module.setTerrainMode(false);
      Module.cancelMapGesture();
    }
    if(building&&[2,3,4,7].includes(kind)){lastBuildTool={kind:kind,item:item};}
    if(building&&kind===14&&lastBuildTool)lastBuildTool.variation=item;
    // Original construction requires native full detail. Reach that through
    // the normal zoom command before selecting a brush, preserving its rules.
    if([2,3,4,7,14].includes(kind)&&Module.mapPresentation.zoom<1)Module.setMapZoom(1);
    if(Module.menuQueue.length<16){
      if(kind===0&&item===76)Module.beginMobileScreenTransition?.('saves');
      if(kind===1&&item===117)Module.beginMobileScreenTransition?.('locations');
      Module.menuQueue.push([kind,item]);
    }
    if(startAim)syncControls();
    else if(shotChoice)Module.refreshAimTarget();
    if(!keep){open=false;render();}
  }
  function mode(value){if(value===0){building=false;buildPage='';pendingHole=null;}Module.setMapMode(value);open=false;render();}
  function add(text,action,enabled,wide){var b=button(text,action);b.disabled=enabled===false;if(wide)b.className='wide';items.appendChild(b);return b;}
  function key(text,character){add(text,function(){command(0,character.charCodeAt(0));},s.course);}
  function vk(text,code){var b=add(text,function(){command(1,code);},s.course);return b;}
  function action(text,kind,item,enabled,keep){add(text,function(){command(kind,item,keep);},s.course&&enabled!==false);}
  function openBusinessChallenges(){
    if(!Module.canOpenBusinessChallenges?.())return;
    open=false;render();Module.openBusinessChallenges?.(Module.requestBusinessFinancialReport);
  }
  function openElevation(source){
    if(!Module.canOpenElevationMap?.())return;
    if(open){open=false;render();}
    Module.openElevationMap(source,toCourse=>{
      if(restoreBorrowedBuild())return;
      if(source==='terrain'&&!toCourse&&!s.elevation){page='terrain';open=true;render();}
    });
  }
  function openEnhancedSettings(focus){
    if(!Module.canEditCareerEnhancements?.())return;
    open=false;render();Module.menuQueue.push([20,focus]);
  }
  var items,careerSettingsButton,eyesoreSettingsButton,landOfferButton;
  function render(){
    if(Module.atTitle){borrowedBuildNavigation=false;repeatedMessage='';selectedSection='';contextGroup='';pendingSection=null;pendingBackOnly=false;leaderboardOpen=false;leaderboardRevealPlayer=false;leaderboardStamp='';seenCourse=false;open=false;page='';building=false;buildPage='';panBuildTool=null;lastBuildTool=null;clubhousePlacement=false;pendingHole=null;holeToOpen=null;pendingSpeed=null;shotChoicesOpen=false;lastReady=false;wasRound=false;}
    else seenCourse=seenCourse||!!s.wasCourse;
    root.hidden=!seenCourse;root.classList.toggle('landmarks-open',open&&['landmarks','buildings'].includes(page));panel.classList.toggle('landmarks',open&&['landmarks','buildings'].includes(page));panel.hidden=!open;dialog.hidden=!seenCourse||s.course||Module.mobileSaveNameActive;
    panel.dataset.page=page;
    syncControls();message.hidden=(!businessNoticeText&&!challengeNoticeText&&!clubNoticeText&&!repeatedMessage&&(!s.message||dismissedMessage===s.message))||open||!Module.mobileUI;
    if(!open||!['landmarks','buildings'].includes(page))catalogueInfoId=null;
    if(!open)return;
    panel.replaceChildren();careerSettingsButton=eyesoreSettingsButton=landOfferButton=null;
    var parentPage={terrain:'build',shots:'play',golfers:'play',keyboard:'system'}[page];
    if(parentPage)panel.appendChild(button('Back to '+parentPage.charAt(0).toUpperCase()+parentPage.slice(1),function(){if(page==='keyboard')leaveKeyboard();navigate(parentPage);}));
    var title=document.createElement('h2');title.textContent=page?({build:'Build',course:'Course',terrain:'Terrain',buildings:'Buildings',improvements:'Improvements',landmarks:'Landmarks',play:'Play',shots:'Shot types',manage:'Manage',enhanced:'Enhanced',system:'System',staff:'Employees',golfers:'Golfers',keyboard:'Keyboard'}[page]||page):'Menu';panel.appendChild(title);
    items=document.createElement('div');items.className='items';panel.appendChild(items);
    if(['landmarks','buildings'].includes(page)){
      const isLandmark=page==='landmarks',note=document.createElement('p');
      const choices=(isLandmark?s.landmarks:s.buildingDetails)||[];
      const locked=item=>!item.unlocked&&(isLandmark||item.level===0);
      note.textContent=creative()?'Creative Sandbox: valid construction is free. Original values are shown for reference.':
        isLandmark?'Choose a landmark, drag its preview to compare locations, then Place. The circle shows its influence.':
          'Choose a building, move its preview, then Place. Prices exclude site clearing; the location quote shows the total.';
      if(choices.some(locked))note.textContent+=' Tap the info icon for unlock details.';
      panel.insertBefore(note,items);
      const storyRewards=isLandmark?landmarkStoryRewards():null;
      for(const item of choices){
        const name=isLandmark?landmarkName(item):item.name,lockedItem=locked(item);
        const built=!isLandmark&&item.level>0;
        const maxUpgrade=built&&item.level>=2;
        const upgradeAvailable=built&&item.upgradeAvailable;
        const upgradeNeedsHoles=built&&!maxUpgrade&&item.unlocked&&!upgradeAvailable;
        const canSelect=built?upgradeAvailable:item.unlocked;
        const directUpgrade=upgradeAvailable&&Module.hasGameFeature('buildingUpgrades');
        const card=button('',()=>{
          panBuildTool=null;
          if(isLandmark){
            if(s.object!==4)command(4,4,true);
            command(14,item.id);
          }else{
            buildingChoices=true;activeImprovement=-1;command(3,item.id);
          }
        });
        card.className='landmark-card';
        card.setAttribute('aria-label',name+(lockedItem?', locked':upgradeAvailable?', upgrade available':built?', already built':''));
        card.dataset[isLandmark?'landmark':'building']=item.id;
        card.toggleAttribute('data-locked',lockedItem);
        card.toggleAttribute('data-built',built);
        card.toggleAttribute('data-upgrade-available',upgradeAvailable);
        card.disabled=!canSelect;
        card.setAttribute('aria-pressed',String(isLandmark?s.variation?.selected===item.id:s.object===item.kind));
        const art=improvementArt(isLandmark?4:item.kind,item.id);
        if(lockedItem){
          const artGroup=document.createElement('span'),lock=document.createElement('span');
          artGroup.className='catalogue-art';
          if(art)artGroup.append(art);
          lock.className='catalogue-lock';lock.setAttribute('aria-hidden','true');
          artGroup.append(lock);card.append(artGroup);
        }else if(art)card.append(art);

        const details=document.createElement('div'),heading=document.createElement('strong');
        details.className='card-details';heading.textContent=name;details.append(heading);
        if(built){
          const status=document.createElement('span');
          status.className='catalogue-built-status';
          status.textContent=upgradeAvailable?'UPGRADE AVAILABLE':'ALREADY BUILT';
          details.append(status);
        }
        const lines=isLandmark?[landmarkPrice(item),landmarkBenefits[item.group],item.radius+' yd influence radius']:
          [buildingBenefits[item.id]];
        if(!isLandmark&&(!built||canSelect)){
          lines.push((creative()?'Free · original value $':'$')+item.price.toLocaleString()+(creative()?'':' + site clearing'),
            item.side+' × '+item.side+' tiles · '+(built?'Upgrade':'New building'));
        }
        if(canSelect)lines.push(built?(directUpgrade?'Select to preview at another site':'Select to preview upgrade'):'Select to preview');
        if(maxUpgrade)lines.push('Maximum upgrade reached');
        for(const text of lines){
          const line=document.createElement('span');
          line.textContent=text;details.append(line);
        }
        card.append(details);
        const id=(isLandmark?'landmark':'building')+'-unlock-'+item.id;
        if(lockedItem){
          const instructions=isLandmark?landmarkUnlockDetails(item,storyRewards.has(item.id)):
            ['Normally unlocks when hole '+buildingUnlockHoles[item.id]+' opens for play.'];
          items.append(catalogueCardWithInfo(card,id,'How to unlock '+name,instructions));
        }else if(upgradeNeedsHoles){
          items.append(catalogueCardWithInfo(card,id,'How to upgrade '+name,
            ['Open holes 1–10 for play to upgrade this building.']));
        }else if(directUpgrade){
          const group=document.createElement('div'),upgrade=button('Upgrade in place',()=>Module.requestBuildingUpgrade?.(item.kind));
          group.className='building-upgrade-group';
          upgrade.dataset.buildingUpgrade=item.kind;
          upgrade.setAttribute('aria-label','Upgrade '+name+' in place');
          group.append(card,upgrade);items.append(group);
        }else items.append(card);
      }
    }else if(page==='build'){
      ['Course','Terrain','Improvements'].forEach(function(n){add(n,function(){navigate(n.toLowerCase());},true,true);});
    }else if(page==='terrain'){
      if(Module.hasGameFeature('elevationMap'))add('Elevation Map',()=>openElevation('terrain'),!!Module.canOpenElevationMap?.(),true);
      ['Vertex','Square','Area'].forEach(function(n,i){add('Raise/lower '+n.toLowerCase(),()=>command(7,i),s.course,true);});
    }else if(page==='play'){
      action('Golfer skills / profile',5,0);action('Practice round',5,1);
      add('Play a professional',function(){open=false;render();Module.openMatchPlayers(true);},s.course&&!s.roundActive);
      if(s.roundActive)add('Match players',function(){open=false;render();Module.openMatchPlayers(false);});
      action('Begin tournament',5,3);
      add('Shot types',function(){if(s.roundActive){shotChoicesOpen=true;open=false;render();}else navigate('shots');});add('Golfers',function(){command(5,9,true);navigate('golfers');});
      key('Place your golfer','p');key('End match / tournament','n');
    }else if(page==='shots'){
      shotNames.forEach(function(n,i){action(n,5,i+4,!!(s.shotMask&(1<<i)),true);});
      if(!s.shotMask){var p=document.createElement('p');p.textContent=s.roundActive?'Shot choices become available when your golfer is ready.':'Shot choices become available during your round.';panel.appendChild(p);}
    }else if(page==='golfers'){
      (s.golfers||[]).forEach(function(g){action(g.name,9,g.item);});
    }else if(page==='enhanced'){
      if(hasEnhancedSection()){
        eyesoreSettingsButton=add('Eyesore Demolition',()=>openEnhancedSettings(1),!!Module.canEditCareerEnhancements?.(),true);
        eyesoreSettingsButton.title='Find the Eyesore Demolition switch in Enhanced Settings.';
      }
      if(creative()){var note=document.createElement('p');note.id='creative-sandbox-rules';note.textContent=creativeRules();panel.appendChild(note);}
      if(Module.hasGameFeature('clubhouseManagement'))add('Clubhouse & Tee Times',function(){open=false;render();Module.openClubhouseManagement?.();},s.course&&!!Module.canOpenClubhouseManagement?.());
      if(Module.hasGameFeature('courseDesignLab'))add('Course Design Lab',function(){open=false;render();Module.openCourseDesignLab?.();},!!Module.canOpenCourseDesignLab?.());
      if(Module.hasGameFeature('designChallenges'))add('Design Challenges',function(){open=false;render();Module.openDesignChallenges?.();},s.course);
      if(Module.hasGameFeature('clubRecords'))add('Club Records & Hall of Fame',function(){open=false;render();Module.openClubRecords?.();},s.course);
      if(Module.hasGameFeature('golferHistories'))add('Golfer Histories',function(){open=false;render();Module.openGolferHistories?.();},s.course);
      if(Module.hasGameFeature('golferExperiences'))add('Golfer Experiences',function(){open=false;render();Module.openGolferExperiences?.();},s.course);
      if(Module.hasGameFeature('courseReview'))add('Course Review',function(){
        if(!Module.canOpenCourseReview?.())return;
        open=false;render();
        if(Module.openCourseReview?.())restoreBorrowedBuild();
      },!!Module.canOpenCourseReview?.());
      if(Module.hasGameFeature('buildingUpgrades'))add('Building Upgrades',()=>navigate('buildings'),s.course);
      if(Module.hasGameFeature('elevationMap'))add('Elevation Map',()=>openElevation('enhanced'),!!Module.canOpenElevationMap?.());
      if(Module.hasGameFeature('courseAnalytics'))add('Course Analytics',function(){open=false;render();Module.openCourseAnalytics?.();},s.course);
      if(Module.hasGameFeature('businessChallenges'))add('Business Challenges',openBusinessChallenges,!!Module.canOpenBusinessChallenges?.());
      if(Module.hasDeferredLandOffer?.()){
        landOfferButton=add('Purchase Land',function(){
          if(!Module.hasDeferredLandOffer()||!Module.canEditCareerEnhancements?.())return;
          command(21,0);
        },!!Module.canEditCareerEnhancements?.());
        landOfferButton.title='Reopen your unused land offer from the commissioner.';
      }
      if(hasEnhancedSection()){
        careerSettingsButton=add('Enhanced Settings',()=>openEnhancedSettings(0),!!Module.canEditCareerEnhancements?.(),true);
        careerSettingsButton.title='Finish the current action to change enhancements.';
      }
    }else if(page==='manage'){
      add('Hire employee',function(){open=false;render();Module.openStaffPanel('hire');},s.course);add('View employees',function(){open=false;render();Module.openStaffPanel('roster');},s.course);
      action('Course report',8,5);action('Player comments',8,6);action('Histograph',8,7);action('Financial report',8,8);vk('Routing map',116);vk('World map',117);action('SGA evaluation',8,9);action('Membership roster',8,10);vk('Professional accomplishments',121).classList.add('manage-accomplishments');action('Best scores',8,0);action('Top designers',8,2);
      add('Repeat last message',function(){
        const text=lastCourseMessage();
        if(!text)return;
        repeatedMessage=text;dismissedMessage=null;open=false;render();
      },s.course&&!!lastCourseMessage());key('Clubhouse view','0');
    }else if(page==='staff'){
      (s.employees||[]).forEach(function(name,i){action(name||'Applicant '+(i+1),6,i+8,true,true);});
      action('Hire another employee',8,3);action('Move selected',6,4,s.employeeSelected>=0);action('Rename selected',6,6,s.employeeSelected>=0);
    }else if(page==='system'){
      if(Module.rulesetBlocked&&Module.saveRules?.draft)add('Retry starting game',function(){Module.rulesetBlocked=false;open=false;render();});
      if(Module.localFiles)add('Backup & Transfer Files',function(){open=false;render();Module.openLocalSaves();});
      add('Save game',function(){
        if(Module.menuQueue.length<16&&(!Module.prepareMobileSaveName||Module.prepareMobileSaveName()))command(0,83);
      },s.course);
      key('Load game','L');action('Exit game',8,4);
      add('Measure yardage',function(){mode(1);});
      key('Save championship course','C');action('Save championship pro',8,11);action('Preferences',8,1);
      if(Module.saveHistoryUIEnabled)add('Save history / export',function(){Module.cancelMapGesture();open=false;render();if(Module.toggleSaveHistory)Module.toggleSaveHistory();});
    }else if(page==='keyboard'){
      var p=document.createElement('p');p.textContent='Type a name in an open game dialog. Text is sent to that dialog.';panel.appendChild(p);
      var input=document.createElement('input');input.type='text';input.autocomplete='off';input.setAttribute('aria-label','Game text');panel.appendChild(input);
      add('Send text',function(){if(Module.sendGameText(input.value))input.value='';else p.textContent=Module.gameTextError;},s.textInput);
      add('Backspace',function(){Module.keyboardInput(8,8);});add('Enter',function(){leaveKeyboard();Module.keyboardInput(13,13);open=false;render();});add('Escape',function(){leaveKeyboard();Module.keyboardInput(27,27);open=false;render();});
    }
  }
  function syncControls(){
    var course=!!s.course&&!!Module.mobileUI;
    syncRail();
    if(open&&page==='enhanced'){
      if(careerSettingsButton)careerSettingsButton.disabled=!Module.canEditCareerEnhancements?.();
      if(eyesoreSettingsButton)eyesoreSettingsButton.disabled=!Module.canEditCareerEnhancements?.();
      if(landOfferButton)landOfferButton.disabled=!Module.hasDeferredLandOffer?.()||!Module.canEditCareerEnhancements?.();
    }
    var badgeSpace=syncCourseBadge(course);
    var holeVisible=seenCourse&&!!Module.mobileUI&&!Module.atTitle&&!!s.canOpenHole;
    openHole.hidden=!holeVisible;openHole.disabled=!!pendingHole||holeToOpen!==null;
    var terrainAvailable=course&&building&&buildPage==='terrain'&&!open&&!panBuildTool&&!s.photoActive&&s.elevation&&s.terrainShape>=0&&s.terrainShape<3&&Module.mapMode!==2;
    if(Module.terrainMode&&!terrainAvailable)Module.setTerrainMode(false);
    terrainControls.hidden=!terrainAvailable;
    terrainElevationMap.hidden=!terrainAvailable||!Module.hasGameFeature('elevationMap')||Module.elevationMapLive;
    terrainElevationMap.disabled=!Module.canOpenElevationMap?.();
    terrainUp.hidden=terrainDown.hidden=!Module.terrainMode;terrainPrecision.setAttribute('aria-pressed',String(!!Module.terrainMode));
    if(terrainAvailable){
      Module.refreshTerrainTarget();var preview=Module.terrainPreview,ready=!!Module.terrainMode&&preview?.serial===Module.terrainSerial&&preview.valid;
      terrainUp.disabled=terrainDown.disabled=!ready||preview.pending>=32;
      terrainStatus.textContent=['Vertex','Square','Area'][s.terrainShape]+' · '+(!Module.terrainMode?'Tap the map to raise':!ready?'Drag to choose a spot':'Drag to select · arrows adjust');
    }
    Module.refreshTerrainReticle();
    var rebuilding=!!s.rebuildClubhouse&&s.object===15;
    var previewLot=course&&(building||rebuilding)&&!open&&!panBuildTool&&!s.photoActive&&((s.object===5&&s.availableLots>0)||(s.object===4&&s.variation?.selected>=0&&(s.variation.mask&(1<<s.variation.selected)))||([1,2,16,19].includes(s.object)&&s.variation?.selected>=0)||(s.object>=6&&s.object<=14)||rebuilding)&&Module.mapMode!==2;
    if(previewLot&&!Module.lotMode&&Module.lotCanStart())Module.setLotMode(true);
    else if(!previewLot&&Module.lotMode)Module.setLotMode(false);
    var openingLot=lotControls.hidden&&previewLot&&Module.lotMode;
    lotControls.hidden=!previewLot||!Module.lotMode;
    if(!lotControls.hidden){Module.refreshLotTarget();var p=Module.lotPreview,ready=p&&p.serial===Module.lotSerial;placeLot.disabled=!ready||!p.valid||!!Module.lotPending;var money=v=>'$'+v.toLocaleString();lotDetails.textContent=Module.lotPending?'Placing…':!ready?'Drag to preview a location; Place confirms.':creative()?(p.reason||((p.kind===5?'Home Site · Income '+money(p.value):p.kind===4?landmarkName(s.landmarks?.[p.variant]):p.kind===15?'Clubhouse':s.object>=6&&s.object<=14?s.buildings[s.object-6]:variantLabel(p.kind,p.variant))+' · Construction Free'+(p.kind===5?'':' · Original Value '+money(p.price)))):p.kind===4?landmarkName(s.landmarks?.[p.variant])+' · '+(p.free?'Free':money(p.price))+' · '+p.radius+' yd influence'+(p.reason?' · '+p.reason:''):p.kind!==5?((p.kind===15?'Clubhouse':s.object>=6&&s.object<=14?s.buildings[s.object-6]:variantLabel(p.kind,p.variant))+' · '+money(p.price)+(p.reason?' · '+p.reason:'')):p.reason||('Lot value '+money(p.value)+' · Preparation '+money(p.preparation)+' · Profit '+money(p.profit));if(openingLot)Module.centreLotTarget();}

    camera.hidden=!course;buildActions.hidden=!course||s.photoActive;cancel.hidden=!seenCourse||!Module.mobileUI;remove.hidden=!building;remove.setAttribute('aria-pressed',String(Module.mapMode===2));pan.setAttribute('aria-pressed',String(panBuildTool!==null||(Module.mapMode===0&&!s.constructing)));syncBuildStrip();var stripSpace=(strip.hidden?0:strip.getBoundingClientRect().height+8)+'px';root.style.setProperty('--strip-space',stripSpace);cancel.style.setProperty('--strip-space',modalSection()?'0px':stripSpace);openHole.style.setProperty('--strip-space',modalSection()?'0px':stripSpace);roundControls.hidden=!course||!s.roundActive;
    toggles.hidden=!course||!s.roundActive;
    var raisedRound=building||holeVisible||(!toggles.hidden&&toggles.getBoundingClientRect().right+6>camera.getBoundingClientRect().left);
    var roundBottom=raisedRound?108:54;
    toggles.style.bottom='calc(max(8px,env(safe-area-inset-bottom)) + var(--strip-space,0px) + '+(roundBottom-54)+'px)';
    roundControls.style.bottom='calc(max(8px,env(safe-area-inset-bottom)) + var(--strip-space,0px) + '+roundBottom+'px)';
    resumeShots.hidden=!s.staffRound;aim.disabled=!s.shotTurn||s.photoActive||!!Module.shotPending;shoot.disabled=!s.shotReady||!Module.aimMode||!Module.aimCanShoot()||!!Module.shotPending;
    aim.setAttribute('aria-pressed',String(!!Module.aimMode));
    closePhoto.hidden=!course||!s.photoActive;
    choices.hidden=!course||s.photoActive||!s.shotTurn||!shotChoicesOpen;
    var stamp=JSON.stringify([s.shotMask,s.shot,s.shotTurn]);
    if(stamp!==shotFingerprint){shotFingerprint=stamp;choices.replaceChildren();shotNames.forEach(function(name,i){var b=button(name,function(){command(5,i+4,true);});b.disabled=!s.shotTurn||!(s.shotMask&(1<<i));b.setAttribute('aria-pressed',String(s.shot===shotValues[i]));choices.appendChild(b);});}
    choices.style.bottom='calc(max(8px,env(safe-area-inset-bottom)) + var(--strip-space,0px) + '+(roundBottom+roundControls.getBoundingClientRect().height+6)+'px)';
    var info=Module.roundHUD;roundInfo.textContent=(info?info.lines.filter(Boolean).join(' · '):'')+(Module.aimMode?' · Drag to aim; Shoot confirms.':'');
    roundInfo.hidden=!course||!s.roundActive||!infoOpen||!roundInfo.textContent;
    infoToggle.setAttribute('aria-pressed',String(infoOpen));scoreToggle.setAttribute('aria-pressed',String(scoreOpen));
    scorecard.hidden=!course||!s.roundActive||!scoreOpen;
    var cards=s.scorecard||[],scoreStamp=JSON.stringify(cards);
    if(scoreOpen&&scoreStamp!==scoreFingerprint){
      scoreFingerprint=scoreStamp;scorecard.replaceChildren();
      var table=document.createElement('table'),caption=document.createElement('caption');caption.textContent='Round scorecard · current hole marked *';table.appendChild(caption);
      function row(values,heading,current){var tr=document.createElement('tr');if(current)tr.className='current';values.forEach(function(value){var cell=document.createElement(heading?'th':'td');cell.textContent=value;tr.appendChild(cell);});table.appendChild(tr);}
      row(['Hole','Par'].concat(cards.map(function(c){return c.name;})),true);
      (cards[0]?.holes||[]).forEach(function(h){row([String(h.hole)+(h.hole===cards[0].hole?' *':''),h.par].concat(cards.map(function(c){var entry=c.holes.find(function(n){return n.hole===h.hole;});return entry?.score>0?entry.score:(c.hole===h.hole?c.current+' (playing)':'—');})),false,h.hole===cards[0].hole);});
      row(['Finished total','—'].concat(cards.map(function(c){return c.holes.reduce(function(total,h){return total+(h.score>0?h.score:0);},0);})),true);scorecard.appendChild(table);
    }
    var tournament=!!s.tournamentActive,board=Module.tournamentBoard;
    if(!tournament)leaderboardOpen=leaderboardRevealPlayer=false;
    leaderboardToggle.hidden=!course||!tournament||s.photoActive;
    if(!leaderboardToggle.hidden){
      // The native row already identifies the player, rank and score to par.
      const player=board?.rows[board.playerRow]?.match(/^(\d+)\.\s+(.+)\s+\((E|[+-]\d+)\)$/);
      leaderboardSummary.hidden=!player;
      let label=leaderboardOpen?'Hide tournament leaderboard':'Show tournament leaderboard';
      if(player){
        const [,rank,name,nativeScore]=player;
        const position='#'+rank+' ·',score='· '+nativeScore;
        if(leaderboardPosition.textContent!==position)leaderboardPosition.textContent=position;
        if(leaderboardName.textContent!==name)leaderboardName.textContent=name;
        if(leaderboardScore.textContent!==score)leaderboardScore.textContent=score;
        label+='. Position '+rank+', '+name+', '+(nativeScore==='E'?'even par':nativeScore+' to par');
      }
      leaderboardToggle.setAttribute('aria-label',label);
    }
    leaderboardToggle.setAttribute('aria-expanded',String(leaderboardOpen));leaderboardToggle.setAttribute('aria-pressed',String(leaderboardOpen));
    leaderboard.hidden=leaderboardToggle.hidden||!leaderboardOpen||open||!board||!!(s.fundsCheck&&s.message);
    leaderboardCrest.hidden=leaderboard.hidden||!leaderboardCrest.childElementCount;
    if(!leaderboard.hidden&&!leaderboardCrestRequested){
      leaderboardCrestRequested=true;
      Module.originalMenuArt.sgaCrest().then(crest=>{
        crest.setAttribute('role','img');crest.setAttribute('aria-label','Sim Golf Association crest');
        leaderboardCrest.append(crest);leaderboard.classList.add('has-crest');
        leaderboardCrest.hidden=leaderboard.hidden;
      }).catch(()=>{});
    }
    var boardStamp=JSON.stringify(board);
    if(!leaderboard.hidden&&boardStamp!==leaderboardStamp){
      leaderboardStamp=boardStamp;var scroll=leaderboard.scrollTop;leaderboard.replaceChildren();
      const heading=document.createElement('h2');heading.textContent='Tournament Leaderboard';leaderboard.append(heading);
      const [,details,event]=board.headings;
      const prize=details?.match(/\$[\d,]+/)?.[0];
      const caption=prize?[prize,event].filter(Boolean).join(' '):details;
      if(caption){const line=document.createElement('p');line.textContent=caption.replace(/\bMtns\.(?=\s|$)/g,'Mountains');leaderboard.append(line);}
      const list=document.createElement('ol');
      board.rows.forEach((text,index)=>{
        const li=document.createElement('li');
        if(index===board.playerRow){
          const line=document.createElement('span'),you=document.createElement('span');
          li.className='leaderboard-player';
          line.textContent=text;
          you.className='leaderboard-you';
          you.textContent='You';
          li.append(line,you);
        }else li.textContent=text;
        list.appendChild(li);
      });
      leaderboard.appendChild(list);
      leaderboard.scrollTop=scroll;
    }
    if(!leaderboard.hidden&&leaderboardRevealPlayer){
      const player=leaderboard.querySelector('.leaderboard-player');
      if(player){
        const panelTop=leaderboard.getBoundingClientRect().top+leaderboard.clientTop;
        const panelBottom=panelTop+leaderboard.clientHeight,row=player.getBoundingClientRect();
        if(row.top<panelTop)leaderboard.scrollTop+=row.top-panelTop;
        else if(row.bottom>panelBottom)leaderboard.scrollTop+=row.bottom-panelBottom;
        leaderboardRevealPlayer=false;
      }
    }
    Module.refreshAimReticle();
    if(!panel.classList.contains('landmarks')){
      var bottomClearance=page==='manage'||page==='system'
        ? 'calc(56px + var(--strip-space,0px))'
        : (holeVisible?64:8)+'px';
      panel.style.top='calc(max(8px,env(safe-area-inset-top)) + '+badgeSpace+'px)';
      panel.style.maxHeight='calc(100% - max(8px,env(safe-area-inset-top)) - '+badgeSpace+'px - max(8px,env(safe-area-inset-bottom)) - '+bottomClearance+')';
    }else{panel.style.top='';panel.style.maxHeight='';}
    message.style.top='calc(max(8px,env(safe-area-inset-top)) + '+Math.max(50,badgeSpace)+'px)';
    var bounds=Module.getScreenBounds(),messageTop=Math.max(8,bounds.safe.top)+Math.max(50,badgeSpace);
    var reserve=(strip.hidden?0:strip.getBoundingClientRect().height+8)+72;
    message.style.maxHeight=Math.max(0,root.getBoundingClientRect().height-messageTop-Math.max(8,bounds.safe.bottom)-reserve)+'px';
  }
  function leaveKeyboard(){
    if(root.contains(document.activeElement)&&document.activeElement.tagName==='INPUT')document.activeElement.blur();
    setTimeout(function(){window.scrollTo(0,0);syncVisibleArea();},80);
  }
  // Safari can retain a visual-viewport offset after focusing a name field.
  // Keep controls inside that viewport, then restore the page after dismissal.
  function syncVisibleArea(){
    var bounds=Module.getScreenBounds(),layout=Module.getLayoutViewport(),v={offsetLeft:bounds.left,offsetTop:bounds.top,width:bounds.width,height:bounds.height};
    var header=document.getElementById('build-header').getBoundingClientRect().height;root.style.top=((v?v.offsetTop:0)+header)+'px';root.style.left=(v?v.offsetLeft:0)+'px';
    root.style.right='auto';root.style.bottom='auto';root.style.width=(v?v.width:innerWidth)+'px';root.style.height=Math.max(0,(v?v.height:innerHeight)-header)+'px';
    rail.style.top='calc('+((v?v.offsetTop:0)+header)+'px + max(8px,env(safe-area-inset-top)) - var(--mobile-course-lift,0px))';
    rail.style.right='calc('+Math.max(0,layout.width-(v?v.offsetLeft+v.width:layout.width))+'px + max(8px,env(safe-area-inset-right)))';
    cancel.style.left='calc('+(v?v.offsetLeft:0)+'px + max(8px,env(safe-area-inset-left)))';
    openHole.style.left='calc('+(v?v.offsetLeft:0)+'px + max(8px,env(safe-area-inset-left)) + 54px)';
    openHole.style.setProperty('--mobile-bottom-offset',Math.max(0,layout.height-(v?v.offsetTop+v.height:layout.height))+'px');
    cancel.style.setProperty('--mobile-bottom-offset',Math.max(0,layout.height-(v?v.offsetTop+v.height:layout.height))+'px');
    rail.style.maxHeight='calc('+Math.max(0,(v?v.height:innerHeight)-header)+'px - max(8px,env(safe-area-inset-top)) - max(8px,env(safe-area-inset-bottom)))';
  }
  if(window.visualViewport){visualViewport.addEventListener('resize',syncVisibleArea);visualViewport.addEventListener('scroll',syncVisibleArea);}
  addEventListener('simgolf-screen-resize',syncVisibleArea);addEventListener('simgolf-header-resize',syncVisibleArea);addEventListener('resize',syncVisibleArea);addEventListener('pageshow',syncVisibleArea);syncVisibleArea();
  setInterval(function(){
    s=Module.mobileState||{};
    if(s.course&&s.rebuildClubhouse&&s.object===15&&!clubhousePlacement){
      // The original engine requires a replacement after demolition. Leave
      // Erase once, then use the same deliberate preview/Place ownership.
      clubhousePlacement=true;panBuildTool=null;lastBuildTool=null;building=true;buildPage='buildings';selectedSection='build';open=false;page='';Module.setMapMode(0);
    }else if(clubhousePlacement&&!s.rebuildClubhouse){clubhousePlacement=false;if(panBuildTool?.clubhouse)panBuildTool=null;}
    const reportReturn=Module.businessFinancialReportReturn;
    if(reportReturn){
      if(!reportReturn.isCurrent()||pendingSection!==null||modalSection())Module.businessFinancialReportReturn=null;
      else if(s.course&&Module.mapCourseReady&&!Module.menuQueue.length){
        Module.businessFinancialReportReturn=null;
        reportReturn.restore();
      }
    }
    var waitingModal=pendingSection!==null?modalSection():null;
    if(pendingBackOnly&&waitingModal&&waitingModal.key!==pendingModalKey){
      // Keep original confirmation decisions on screen. Otherwise one native
      // Back/Done that reaches a parent screen completes this icon press.
      if(waitingModal.id==='mobile-profile'&&!Module.profileState?.active){/* Wait for its DOM to finish closing. */}
      else if(waitingModal.id==='mobile-profile'&&Module.profileState.kind===3)pendingModalKey=waitingModal.key;
      else {pendingSection=null;pendingBackOnly=false;waitingModal=null;}
    }
    if(!pendingBackOnly&&waitingModal&&waitingModal.key!==pendingModalKey&&dismissSectionDialog(waitingModal))pendingModalKey=waitingModal.key;
    if(pendingSection!==null&&s.course&&!s.staffOpen&&!Module.staffHire&&!Module.profileState?.active&&!Module.loadState?.active&&!modalSection()&&!Module.menuQueue.length&&!Module.profileQueue?.length&&!Module.staffHireQueue?.length&&!Module.loadQueue?.length){var requested=pendingSection;pendingSection=null;pendingBackOnly=false;showSection(requested);}
    if(holeToOpen!==null&&Module.atTitle)holeToOpen=null;
    if(holeToOpen!==null&&pendingSection===null&&s.course&&!s.photoActive&&!s.staffOpen&&!Module.staffHire&&!Module.profileState?.active&&!Module.loadState?.active&&!modalSection()&&!Module.menuQueue.length&&!Module.profileQueue?.length&&!Module.staffHireQueue?.length&&!Module.loadQueue?.length){
      var target=holeToOpen;holeToOpen=null;
      if(s.canOpenHole&&s.openableHole===target){pendingHole={hole:target,count:s.openHoles,time:performance.now()};command(16,target);}
    }
    Module.updateMapPresentation(!!s.course);
    if(s.course&&Module.mobileUI){
      if(s.photoActive&&(Module.aimMode||Module.shotPending))Module.setAimMode(false);
      if(s.shotTurn&&(!lastReady||s.turnSerial!==lastTurn)){buildPage='';lastTurn=s.turnSerial;shotChoicesOpen=true;building=false;Module.setAimMode(false);}
      if(lastReady&&!s.shotTurn){shotChoicesOpen=false;if(open&&page==='shots'){open=false;render();}Module.setAimMode(false);}
      lastReady=!!s.shotTurn;wasRound=!!s.roundActive;
    }
    var zoomText='Zoom '+Module.mapPresentation.zoom.toFixed(2)+'×';
    if(zoomValue.textContent!==zoomText)zoomValue.textContent=zoomText;
    var notice=Module.mapZoomNotice?.until>Date.now()?Module.mapZoomNotice.text:'';
    if(zoomNotice.textContent!==notice)zoomNotice.textContent=notice;
    zoomNotice.hidden=!notice;
    if(pendingHole&&s.course){if(s.openHoles>pendingHole.count||(!s.canOpenHole||s.openableHole!==pendingHole.hole)){building=false;buildPage='';open=false;page='';pendingHole=null;render();}else if(performance.now()-pendingHole.time>1200&&Module.menuResult?.kind===16&&Module.menuResult.item===pendingHole.hole){pendingHole=null;}}
    syncControls();
    if(s.fundsCheck||s.photoActive||!s.course)repeatedMessage='';
    const nativeMessage=repeatedMessage||(s.message!==dismissedMessage?s.message:'');
    businessNoticeText=!open&&!nativeMessage ? Module.businessChallengeNotice?.()||'' : '';
    challengeNoticeText=!businessNoticeText&&!open&&!nativeMessage ? Module.designChallengeNotice?.()||'' : '';
    clubNoticeText=!businessNoticeText&&!challengeNoticeText&&!open&&!nativeMessage ? Module.clubRecordNotice?.()||'' : '';
    viewRecord.hidden=!businessNoticeText&&!challengeNoticeText&&!clubNoticeText;
    if(!viewRecord.hidden)viewRecord.textContent=businessNoticeText||challengeNoticeText?'View Challenge':'View Record';
    var text=businessNoticeText||challengeNoticeText||clubNoticeText||repeatedMessage||s.message||'';
    if(!text)dismissedMessage=null;
    text=reflowMessage(text);
    workerHint.hidden=!s.course||!s.movingWorker||!Module.staffPlacement||!Module.mobileUI||open;
    workerHint.textContent='Tap the map to place '+(Module.staffPlacement?.name||'the employee')+'. X cancels placement.';
    if(messageText.data!==text){messageText.data=text;messageBody.scrollTop=0;}
    if(s.fundsCheck&&s.message){if(!message.contains(acknowledge))message.appendChild(acknowledge);}else if(message.contains(acknowledge))acknowledge.remove();
    message.hidden=(!businessNoticeText&&!challengeNoticeText&&!clubNoticeText&&!repeatedMessage&&(!s.message||dismissedMessage===s.message))||open||!Module.mobileUI;
    var tool=(s.terrain||[]).find(function(t){return t.id===s.tool;});
    status.hidden=!s.wasCourse||!Module.mobileUI;status.textContent=s.wasCourse?(s.paused?'Paused':'Playing · '+(s.speed||1)+'×')+(tool?' · '+tool.name:'')+(Module.mapMode===1?' · Measure':Module.mapMode===2?' · Remove / Undo':''):'';
    var fingerprint=JSON.stringify([s.wasCourse,s.course,s.textInput,s.terrain,s.buildings,s.golfers,s.employees,s.employeeSelected,s.tab,s.paused,s.roundActive,s.shotMask,Module.mobileUI,open&&page==='landmarks'&&s.landmarks,open&&page==='buildings'&&[s.hole,s.buildingDetails],open&&page==='enhanced'&&Module.canOpenBusinessChallenges?.(),open&&page==='enhanced'&&Module.canOpenCourseReview?.()]);
    if(last!==fingerprint&&!menuPointers.size){last=fingerprint;render();}
  },200);
})();

// Mobile presentation for the original golfer/profile allocation loops.
// All actions are queued for their actual native dialog; no skill writes here.
(function(){
  if(!Module.mobileMap)return;
  Module.profileQueue=[];
  var root=document.createElement('section');root.id='mobile-profile';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Golfer profile');
  var style=document.createElement('style');style.textContent=`
    #mobile-profile[hidden],#mobile-profile-return[hidden]{display:none!important}
    #mobile-profile-text{position:fixed;inset:auto;margin:0;transform:translate(-50%,-50%);box-sizing:border-box;overflow:auto;overscroll-behavior:contain;padding:16px;border:1px solid var(--menu-border);border-radius:16px;background:linear-gradient(#fffef0,#ece7d4);color:var(--menu-text);font:16px/1.4 system-ui,sans-serif}
    #mobile-profile-text::backdrop{background:#161c3780}
    #mobile-profile-text h2{margin:0 0 12px;font-size:21px}
    #mobile-profile-text input{display:block;box-sizing:border-box;width:100%;min-height:44px;margin:5px 0 10px;padding:8px 10px;border:1px solid var(--menu-border);border-radius:7px;background:var(--menu-preview);color:inherit;font:inherit}
    #mobile-profile-text .editor-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;margin-top:12px}
    #mobile-profile-text button{min-height:44px;padding:7px 12px;border:1px solid var(--menu-border);border-radius:8px;background:var(--menu-button);color:inherit;font:inherit;touch-action:manipulation}
    #mobile-profile-text button[type="submit"]{background:linear-gradient(#fffde6,#f4db90)}
    #mobile-profile-text-error{margin:0;color:var(--menu-danger)}
    #mobile-profile-text-error:empty{display:none}
    #mobile-profile [hidden]{display:none!important}
    body.mobile-profile-open #mobile-ui{visibility:hidden}body.mobile-profile-open #canvas{visibility:hidden}
    #mobile-profile{position:fixed;left:0;right:0;top:var(--profile-header,22px);bottom:0;z-index:65;display:flex;flex-direction:column;box-sizing:border-box;background:var(--menu-bg);color:var(--menu-text);font:16px system-ui,sans-serif;padding:max(10px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));gap:10px}
    #mobile-profile button,#mobile-profile-return{font:inherit;min-width:48px;min-height:48px;padding:10px 14px;border:1px solid var(--menu-border);border-radius:7px;background:var(--menu-button);color:var(--menu-text);touch-action:manipulation;box-sizing:border-box}
    #mobile-profile button:disabled{opacity:.4}#mobile-profile button[aria-selected=true]{background:var(--menu-selected);border-color:var(--menu-focus)}
    #mobile-profile h1{font-size:22px;line-height:1.2;margin:0}#mobile-profile h2{font-size:18px;margin:0 0 10px}#mobile-profile p{margin:6px 0;line-height:1.4}
    #mobile-profile[data-kind="6"]{font-family:OriginalWorldMenu,system-ui,sans-serif;background:#adaed7}
    body.mobile-visitor-details-open #mobile-mode-rail{visibility:hidden!important}
    body.mobile-rail-visible #mobile-profile[data-kind="6"]{padding-right:max(10px,env(safe-area-inset-right));padding-bottom:max(10px,env(safe-area-inset-bottom))}
    #mobile-profile[data-kind="6"] .profile-content{padding:0 2px 10px}
    #mobile-profile .visitor-panels{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,.95fr);gap:10px;align-items:start;justify-items:center;max-width:660px;margin:0 auto 12px}
    #mobile-profile canvas.visitor-original{display:block;width:100%;height:auto;max-width:none;image-rendering:auto;border:1px solid #726d99;box-sizing:border-box;touch-action:pan-y}
    #mobile-profile .visitor-info{background:linear-gradient(135deg,#fffef1,#f0e4bd);border:1px solid #65658d;border-radius:14px;padding:14px 16px;color:#22223a;box-shadow:inset 0 1px #fff,0 2px 5px #37375b26}
    #mobile-profile .visitor-info h2{color:#343454;margin-bottom:8px}
    #mobile-profile .visitor-status{display:inline-block;margin:0 0 8px;padding:5px 12px;border-radius:18px;background:#555780;color:#fff;font-weight:700}
    #mobile-profile .visitor-stats{display:flex;gap:8px 18px;flex-wrap:wrap;padding-bottom:8px;border-bottom:1px solid #b8ad8b}
    #mobile-profile .visitor-stats p{font-size:17px;margin:2px 0}
    #mobile-profile .visitor-bio{font:17px/1.5 system-ui,sans-serif;overflow-wrap:anywhere}
    #mobile-profile .visitor-sayings{margin-top:14px}
    #mobile-profile .visitor-sayings>p{font:14px/1.4 system-ui,sans-serif;color:#33334b}
    #mobile-profile .visitor-saying{border:1px solid #77749c;border-radius:9px;overflow:hidden;margin:8px 0;background:#fffbed;color:#26263d}
    #mobile-profile .visitor-saying h3{margin:0;padding:7px 12px;font-size:16px;line-height:1.3;background:#555580;color:#fff}
    #mobile-profile .visitor-saying[data-tone="positive"] h3{background:#d6ecda;color:#15562d}
    #mobile-profile .visitor-saying[data-tone="negative"] h3{background:#f7dadd;color:#8e2330}
    #mobile-profile .visitor-saying p{margin:0;padding:9px 12px;font:16px/1.45 system-ui,sans-serif;overflow-wrap:anywhere}
    #mobile-profile[data-kind="6"] footer{display:grid;grid-template-columns:48px minmax(0,1fr) auto;align-items:center;gap:8px;padding-top:7px}
    #mobile-profile[data-kind="6"] footer button{min-height:48px;padding:8px 12px;white-space:nowrap}
    #mobile-profile[data-kind="6"] footer #mobile-profile-original{justify-self:start}
    #mobile-profile[data-kind="6"] footer #mobile-cancel{position:static;z-index:auto;width:48px;height:48px;padding:10px;margin:0}
    @media(min-width:760px){#mobile-profile .visitor-panels{float:left;width:53%;margin:0 14px 10px 0}#mobile-profile .visitor-info{margin-left:calc(53% + 14px)}#mobile-profile .visitor-sayings{clear:both}}
    @media(max-width:380px){#mobile-profile .visitor-panels{grid-template-columns:minmax(0,1fr);max-width:290px}#mobile-profile .visitor-panels canvas:nth-child(2){max-width:210px}}
    @media(max-width:360px){#mobile-profile[data-kind="6"] footer{gap:5px}#mobile-profile[data-kind="6"] footer button{font-size:15px;padding:8px}#mobile-profile .visitor-panels{gap:6px}}
    #mobile-profile .profile-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}#mobile-profile .profile-tabs{display:flex;gap:8px}#mobile-profile .profile-tabs button{flex:1}
    #mobile-profile .profile-points{padding:8px 10px;background:var(--menu-panel);border-radius:6px;margin:0;font-weight:600}
    #mobile-profile .profile-content{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:2px 2px 10px}
    #mobile-profile .editor-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}#mobile-profile .profile-face-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px}#mobile-profile .profile-face-grid canvas{width:auto;max-width:100%;height:100px;object-fit:contain}#mobile-profile input{font:inherit;width:100%;padding:12px;box-sizing:border-box;margin:12px 0}
    #mobile-profile .profile-summary{display:grid;grid-template-columns:auto 1fr;gap:18px;align-items:start}#mobile-profile canvas{width:110px;height:215px;image-rendering:pixelated;border-radius:8px;background:var(--menu-preview)}
    #mobile-profile .profile-traits{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}#mobile-profile .profile-traits span{padding:5px 8px;background:var(--menu-selected);border-radius:6px}
    #mobile-profile .skill-list{display:grid;grid-template-columns:1fr;gap:8px}#mobile-profile .skill-row{display:grid;grid-template-columns:minmax(0,1fr) 48px 52px 48px;gap:6px;align-items:center;padding:9px;background:var(--menu-preview);border-radius:8px;border:1px solid var(--menu-line)}
    #mobile-profile .skill-row.readonly{grid-template-columns:minmax(0,1fr) 70px}#mobile-profile .skill-label{font-weight:600;line-height:1.3}#mobile-profile .skill-rating{text-align:center;white-space:nowrap}#mobile-profile .skill-change{display:block;font-size:13px;color:var(--menu-accent);font-weight:400}#mobile-profile .skill-meter{height:5px;margin-top:7px;border-radius:3px;background:var(--menu-panel);overflow:hidden}#mobile-profile .skill-meter span{display:block;height:100%;background:var(--menu-accent)}
    #mobile-profile footer{display:flex;gap:10px;justify-content:space-between;border-top:1px solid var(--menu-line);padding-top:10px}#mobile-profile .profile-confirm{max-width:560px;margin:auto;text-align:center}#mobile-profile .profile-confirm button{display:block;width:100%;margin-top:12px}#mobile-profile .profile-note{font-size:14px;color:var(--menu-muted)}
    #mobile-profile:is([data-confirmation="overwrite"],[data-confirmation="exit"]){align-items:center;justify-content:center;padding-bottom:calc(max(10px,env(safe-area-inset-bottom)) + 58px);background:radial-gradient(ellipse at 20% 10%,#f4f0df88,transparent 65%),linear-gradient(135deg,#c9c9e6,#9e9ec8);font-family:OriginalWorldMenu,system-ui,sans-serif}
    #mobile-profile:is([data-confirmation="overwrite"],[data-confirmation="exit"]) .profile-heading{width:min(480px,100%);justify-content:center;text-align:center;flex:none}
    #mobile-profile:is([data-confirmation="overwrite"],[data-confirmation="exit"]) .profile-content{width:min(480px,100%);flex:0 1 auto;box-sizing:border-box;padding:2px}
    body.mobile-course-confirm-open #mobile-profile[data-course-confirmation]{inset:0;z-index:115;align-items:center;justify-content:center;overflow:hidden;isolation:isolate;background:#242336;padding:calc(10px + env(safe-area-inset-top)) calc(10px + env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom)) calc(10px + env(safe-area-inset-left))}
    #mobile-profile #mobile-course-confirm-map{display:none}
    #mobile-profile[data-course-confirmation] #mobile-course-confirm-map:not([hidden]){display:block;position:absolute;inset:0;z-index:-1;width:100%;height:100%;object-fit:cover;border-radius:0;filter:brightness(.72);pointer-events:none}
    #mobile-profile[data-course-confirmation] .profile-heading{display:none}
    #mobile-profile[data-course-confirmation] .profile-content{width:min(400px,100%);flex:0 1 auto;box-sizing:border-box;padding:2px}
    #mobile-profile[data-course-confirmation] .file-confirm h2{margin:-16px -16px 14px;padding:12px 16px;border-radius:15px 15px 0 0;border-bottom:1px solid var(--menu-border);background:#c9c9e6;font:clamp(19px,4vw,24px)/1.2 OriginalWorldMenu,system-ui,sans-serif}
    #mobile-profile .file-confirm{padding:16px;border:1px solid var(--menu-border);border-radius:16px;background:linear-gradient(#fffef0,#ece7d4);box-shadow:0 4px 12px #30304b22;color:#1c2541}
    #mobile-profile .file-confirm .file-name{font:15px/1.45 system-ui,sans-serif;overflow-wrap:anywhere;background:#ddddef;border-radius:8px;padding:10px;margin:12px 0}
    #mobile-profile .file-confirm .confirm-actions{display:flex;flex-direction:column;gap:8px;margin-top:14px}
    #mobile-profile .file-confirm button{margin:0;min-height:48px;border-radius:24px;font-size:18px}
    #mobile-profile .file-confirm button.confirm-primary{background:linear-gradient(#fffde6,#f4db90)}
    #mobile-profile[data-confirmation="tournament-preparation"] .profile-content{width:min(440px,100%);touch-action:pan-y}
    #mobile-profile .tournament-preparation-options{display:grid;gap:7px;margin:12px 0}
    #mobile-profile .tournament-preparation-options label{display:grid;grid-template-columns:22px minmax(0,1fr);align-items:center;gap:10px;min-height:48px;box-sizing:border-box;padding:8px 11px;border:1px solid var(--menu-border);border-radius:9px;background:#e7e6f5;line-height:1.35;overflow-wrap:anywhere;cursor:pointer}
    #mobile-profile .tournament-preparation-options input{width:20px;height:20px;margin:0;accent-color:#465e97}
    #mobile-profile-return{position:fixed;right:max(8px,env(safe-area-inset-right));top:calc(var(--profile-header,22px) + 8px);z-index:66;background:var(--menu-button);color:var(--menu-text)}
    @media(min-width:720px){#mobile-profile .skill-list{grid-template-columns:1fr 1fr}#mobile-profile .profile-summary{max-width:650px;margin:0 auto}#mobile-profile h1{font-size:20px}#mobile-profile{gap:6px}#mobile-profile .profile-tabs{max-width:400px}#mobile-profile .profile-heading{align-items:flex-start}}
  `;document.head.appendChild(style);
  const courseConfirmationMap=document.createElement('canvas');
  courseConfirmationMap.id='mobile-course-confirm-map';courseConfirmationMap.hidden=true;courseConfirmationMap.setAttribute('aria-hidden','true');root.append(courseConfirmationMap);
  Module.captureCourseConfirmationBackdrop=()=>{
    courseConfirmationMap.hidden=true;
    const display=document.getElementById('map-display');
    const source=display&&!display.hidden&&display.width?display:Module.canvas;
    const bounds=Module.getScreenBounds(),rect=source.getBoundingClientRect();
    if(!source.width||!rect.width||!bounds.width||!bounds.height)return;
    try{
      courseConfirmationMap.width=Math.ceil(bounds.width*2);courseConfirmationMap.height=Math.ceil(bounds.height*2);
      const ctx=courseConfirmationMap.getContext('2d',{alpha:false});
      ctx.imageSmoothingEnabled=false;
      ctx.drawImage(source,(rect.left-bounds.left)*2,(rect.top-bounds.top)*2,rect.width*2,rect.height*2);
      courseConfirmationMap.hidden=false;
    }catch{courseConfirmationMap.hidden=true;}
  };
  var header=document.createElement('header');header.className='profile-heading';var title=document.createElement('h1');header.appendChild(title);root.appendChild(header);
  var points=document.createElement('p');points.className='profile-points';points.setAttribute('role','status');root.appendChild(points);
  var tabs=document.createElement('nav');tabs.className='profile-tabs';tabs.setAttribute('aria-label','Profile sections');root.appendChild(tabs);
  var profileTab=button('Profile',function(){tab='profile';fingerprint='';refresh();}),skillTab=button('Skills',function(){tab='skills';fingerprint='';refresh();});tabs.append(profileTab,skillTab);
  var content=document.createElement('div');content.className='profile-content';root.appendChild(content);
  var footer=document.createElement('footer');var original=button('Original Editor',function(){send(3,0);}),done=button('Done',function(){send(2,0);});original.id='mobile-profile-original';done.id='mobile-profile-done';footer.append(original,done);root.appendChild(footer);
  var returnButton=button('Mobile profile',function(){send(3,0);});returnButton.id='mobile-profile-return';returnButton.hidden=true;
  document.body.append(root,returnButton);
  var tab='profile',serial=0,fingerprint='',avatar=null,state=null,confirmationFocus=0,pressed=new Set();
  var visitorPanels=document.createElement('div');visitorPanels.className='visitor-panels';
  var visitorSources=[[20,3,258,254,'Original golfer identity and traits'],[285,3,195,254,'Original golfer portrait and appearance']];
  var visitorFrame=document.createElement('canvas');visitorFrame.width=800;visitorFrame.height=600;
  var visitorContext=visitorFrame.getContext('2d'),visitorPixels=visitorContext.createImageData(800,600);
  var visitorCompact=true,visitorSerial=0,visitorPaintAt=0;
  function visitorCanvas(label,point){
    var canvas=document.createElement('canvas');canvas.className='visitor-original';canvas.setAttribute('role','img');canvas.setAttribute('aria-label',label);
    var start=null;
    canvas.addEventListener('pointerdown',e=>{start={id:e.pointerId,x:e.clientX,y:e.clientY};});
    canvas.addEventListener('pointercancel',()=>{start=null;});
    canvas.addEventListener('pointerup',e=>{
      const down=start;start=null;
      if(!down||down.id!==e.pointerId||Math.hypot(e.clientX-down.x,e.clientY-down.y)>=7||Module.profileState?.busy)return;
      const r=canvas.getBoundingClientRect(),[x,y]=point(Math.floor((e.clientX-r.left)*canvas.width/r.width),Math.floor((e.clientY-r.top)*canvas.height/r.height));
      send(8,y*1024+x);
    });
    return canvas;
  }
  var visitorParts=visitorSources.map(([x,y,w,h,label])=>{
    var c=visitorCanvas(label,(px,py)=>[x+px,y+py]);c.width=w;c.height=h;visitorPanels.append(c);return c;
  });
  var visitorInfo=document.createElement('section');visitorInfo.className='visitor-info';visitorInfo.setAttribute('aria-label','Original Membership Statistics And Biography');
  var visitorSayings=document.createElement('section');visitorSayings.className='visitor-sayings';
  var visitorTextSerial=0,visitorTextStamp='',visitorTextLines=[];
  Module.presentVisitorText=function(serial,lines){
    visitorTextSerial=serial;visitorTextLines=lines;
  };
  function renderVisitorText(s){
    if(visitorTextSerial!==s.serial)return;
    const stamp=JSON.stringify([s.serial,visitorTextLines]);if(stamp===visitorTextStamp)return;visitorTextStamp=stamp;
    // Coordinates identify sections in the original display, not world space.
    const info=visitorTextLines.filter(l=>l.y<264&&l.x>=480);
    const byY=new Map();for(const l of info){if(!byY.has(l.y))byY.set(l.y,[]);byY.get(l.y).push(l);}
    const rows=Array.from(byY).sort((a,b)=>a[0]-b[0]).map(([y,ls])=>({y,text:ls.sort((a,b)=>a.x-b.x).map(l=>l.text).join(' ')}));
    visitorInfo.replaceChildren(text('h2','Membership & Performance'));
    const status=rows.find(l=>l.y<45);if(status){const e=text('p',status.text);e.className='visitor-status';visitorInfo.append(e);}
    const stats=document.createElement('div');stats.className='visitor-stats';rows.filter(l=>l.y>=45&&l.y<95).forEach(l=>stats.append(text('p',l.text)));visitorInfo.append(stats);
    const bio=rows.filter(l=>l.y>=105).map(l=>l.text).join(' ');visitorInfo.append(text('h2','Biography'));
    const p=text('p',bio||'No biography is displayed by the original game.');p.className='visitor-bio';visitorInfo.append(p);
    const sayings=new Map();for(const l of visitorTextLines.filter(l=>l.y>=264&&l.y<590)){
      const key=Math.round((l.y-271)/16);if(key<0||key>=20)continue;
      if(!sayings.has(key))sayings.set(key,{labels:[],values:[],color:l.color});
      const row=sayings.get(key);if(l.x<400){row.labels.push(l.text);row.color=l.color;}else row.values.push(l.text);
    }
    visitorSayings.replaceChildren(text('h2','Original Sayings & Comment Templates'),text('p','Original character dialogue for these situations. These are templates, not a history of recent experiences.'));
    for(const [,row]of Array.from(sayings).sort((a,b)=>a[0]-b[0])){
      if(!row.labels.length&&!row.values.length)continue;
      const box=document.createElement('article');box.className='visitor-saying';
      const c=row.color&32767,r=(c>>10)&31,g=(c>>5)&31;
      box.dataset.tone=g>r+5?'positive':r>g+5?'negative':'neutral';
      box.append(text('h3',row.labels.join(' ')||'Original Saying'),text('p',row.values.join(' ')||'No saying displayed.'));visitorSayings.append(box);
    }
  }
  Module.drawVisitorDetails=function(address,stride,frameSerial){
    const now=performance.now();
    if(visitorSerial===frameSerial&&now-visitorPaintAt<60)return;
    visitorSerial=frameSerial;visitorPaintAt=now;
    const heap=new Uint16Array(Module.HEAPU8.buffer),rgba=visitorPixels.data;
    let k=0;
    for(let y=0;y<600;y++){
      let at=(address>>1)+y*stride;
      for(let x=0;x<800;x++){
        const c=heap[at++];rgba[k++]=((c>>10)&31)*255/31;rgba[k++]=((c>>5)&31)*255/31;rgba[k++]=(c&31)*255/31;rgba[k++]=255;
      }
    }
    visitorContext.putImageData(visitorPixels,0,0);
    visitorParts.forEach((canvas,i)=>{
      const [x,y,w,h]=visitorSources[i];canvas.getContext('2d').drawImage(visitorFrame,x,y,w,h,0,0,w,h);
    });

  };

  for(const type of ['pointerdown','pointerup','pointermove','pointercancel','mousedown','mouseup','mousemove','click','touchstart','touchmove','touchend','wheel','keydown','keyup','keypress','beforeinput','input','compositionstart','compositionupdate','compositionend']){root.addEventListener(type,e=>e.stopPropagation());returnButton.addEventListener(type,e=>e.stopPropagation());}
  root.addEventListener('pointerdown',e=>pressed.add(e.pointerId),true);for(const type of ['pointerup','pointercancel'])addEventListener(type,e=>pressed.delete(e.pointerId),true);addEventListener('blur',()=>pressed.clear());
  function button(text,action){var b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',action);return b;}
  function send(op,index){var s=Module.profileState;if(!s?.active||Module.profileQueue.length>=32)return;Module.cancelMapGesture();Module.profileQueue.push([s.serial,op,index]);}
  function text(tag,value){var e=document.createElement(tag);e.textContent=value;return e;}
  root.addEventListener('keydown',e=>{const s=Module.profileState;if(e.key==='Escape'&&s?.confirmation){e.preventDefault();if(!s.busy&&s.cancelChoice!==null)send(5,s.cancelChoice);}});
  let preparationView=null;
  function showTournamentPreparation(s){
    if(preparationView?.serial!==s.serial){
      const box=text('div',''),options=text('div',''),actions=text('div','');
      box.className='profile-confirm file-confirm';
      options.className='tournament-preparation-options';
      actions.className='confirm-actions';
      const choices=s.title.split('\n').filter(line=>line.startsWith(' ')&&line.trim()).slice(0,s.preparation.choices);
      const sendChoice=index=>{
        const current=Module.profileState;
        if(current?.serial===s.serial&&!current.busy&&!Module.profileQueue.length)send(5,index);
      };
      const inputs=choices.map((choice,index)=>{
        const label=text('label',''),input=document.createElement('input');
        input.type='checkbox';
        input.addEventListener('click',event=>{event.preventDefault();sendChoice(index);});
        label.append(input,text('span',choice.trim()));
        options.append(label);
        return input;
      });
      const next=button('Continue',()=>sendChoice(s.preparation.choices));
      next.id='mobile-tournament-preparation-continue';
      next.className='confirm-primary';
      actions.append(next);
      box.append(text('h2','Tournament Preparation'),text('p','Choose which recommended course changes to apply.'),options,actions);
      content.replaceChildren(box);
      content.scrollTop=0;
      preparationView={serial:s.serial,inputs,next};
      next.focus({preventScroll:true});
    }
    const {inputs,next}=preparationView;
    inputs.forEach((input,index)=>{input.checked=!!(s.preparation.checked&(1<<index));});
    next.setAttribute('aria-disabled',String(s.busy));
  }
  function showConfirmation(s){
    const overwrite=s.confirmation==='overwrite',land=s.confirmation==='land-offer',home=s.confirmation==='home-demolition',building=s.confirmation==='building-demolition',box=text('div','');box.className='profile-confirm file-confirm';
    box.append(text('h2',land?'Expand Your Course':home?'Demolish Home Site?':building?'Demolish Building?':overwrite?'Replace The Existing File?':'Leave This Course?'));
    if(overwrite){
      const file=(s.title||'').split('\nalready exists!')[0].replace(/\\/g,' / ');
      box.append(text('p','A file with this name already exists.'),text('p',file));
      box.lastChild.className='file-name';
      const replacement=/\.pro\s*$/i.test(file)?'your current golfer':'the current course';
      box.append(text('p','Overwrite replaces that file with '+replacement+'. Cancel keeps the existing file.'));
    }else if(land){
      box.append(text('p','Would you like to browse land to expand your course?'));
      if(Module.hasDeferredLandOffer?.()){
        const note=text('p','You can use this offer later from Enhanced → Purchase Land.');
        note.className='profile-note';
        box.append(note);
      }
    }else if(home)box.append(text('p','Remove this home site from your course?'));
    else if(building)box.append(text('p',s.title.split('\n',2).join(' ')));
    else box.append(text('p','Choose whether to save before leaving this course.'));
    const actions=text('div','');actions.className='confirm-actions';
    const options=overwrite?[[1,'Cancel','mobile-overwrite-cancel'],[0,'Overwrite File','mobile-overwrite-confirm']]:land?[[1,'Not Now','mobile-land-offer-cancel'],[0,'Browse Land','mobile-land-offer-browse']]:home?[[1,'Cancel','mobile-home-demolish-cancel'],[0,'Demolish','mobile-home-demolish-confirm']]:building?[[1,'Cancel','mobile-building-demolish-cancel'],[0,'Demolish','mobile-building-demolish-confirm']]:[[0,'Keep Playing','mobile-exit-cancel'],[1,'Save Then Exit','mobile-exit-save'],[2,'Exit Without Saving','mobile-exit-confirm']];
    for(const [index,label,id]of options){const b=button(label,()=>send(5,index));b.id=id;b.disabled=!!s.busy||!s.frame;if(index!==s.cancelChoice)b.className='confirm-primary';actions.append(b);}
    box.append(actions);content.append(box);
    if(confirmationFocus!==s.serial&&s.frame&&!s.busy){confirmationFocus=s.serial;actions.firstChild.focus({preventScroll:true});}
  }
  function showProfile(s){
    var summary=document.createElement('div');summary.className='profile-summary';avatar=null;
    if(s.artParts){avatar=document.createElement('canvas');avatar.width=110;avatar.height=215;avatar.setAttribute('role','img');avatar.setAttribute('aria-label','Original golfer portrait');summary.appendChild(avatar);}
    var detail=document.createElement('div');detail.append(text('h2',s.name||'Your golfer'));if(s.profession)detail.append(text('p',s.profession));
    var flags=s.appearance[1];var age=flags&4?'Mature':flags&2?'Middle-aged':flags&1?'Young':'';var relationship=flags&64?'Widowed':flags&32?'Divorced':flags&16?'Married':flags&8?'Single':'';detail.append(text('p',[age,relationship,s.appearance[12]&8?'Child':'Adult'].filter(Boolean).join(' · ')));
    var traits=document.createElement('div');traits.className='profile-traits';(s.traits||[]).filter(t=>t.active).forEach(t=>traits.append(text('span',t.name)));detail.appendChild(traits);
    detail.append(text('p',s.kind===2?'Assign the available points under Skills.':'View your current ratings under Skills.'));
    if(s.kind===1){
      var actions=document.createElement('div');actions.className='editor-actions';
      for(const [label,item]of [['Edit name',100],['Edit job title',101],['Change age',103],['Change relationship',102],['Body style',10],['Adult / child',11],['Choose face',12],['Shirt colour',13],['Trousers colour',14],['Skin tone',16],['Change gender',17]])actions.append(button(label,()=>send(6,item)));
      if(s.appearance[1]&128)actions.append(button('Hair colour',()=>send(6,15)));
      (s.traits||[]).forEach((t,i)=>{var b=button(t.name,()=>send(6,i+3));b.setAttribute('aria-pressed',String(t.active));actions.append(b);});
      for(const b of actions.querySelectorAll('button'))b.disabled=!!s.busy;detail.appendChild(actions);
      detail.append(text('p','Custom dialogue and advanced original options remain in Original editor.'));
    }
    summary.appendChild(detail);content.appendChild(summary);
  }
  function showSkills(s){
    var editable=s.kind===2&&s.total>0,list=document.createElement('div');list.className='skill-list';
    for(let i=0;i<10;i++){
      var row=document.createElement('div');row.className='skill-row'+(editable?'':' readonly');row.dataset.skill=i;
      var label=text('div',s.names[i]);label.className='skill-label';var change=s.skills[i]-s.base[i];if(editable&&change>0){var delta=text('span','+'+change+' assigned');delta.className='skill-change';label.appendChild(delta);}
      var meter=document.createElement('div');meter.className='skill-meter';var fill=document.createElement('span');fill.style.width=Math.min(100,s.skills[i]*10)+'%';meter.appendChild(fill);label.appendChild(meter);row.appendChild(label);
      if(editable){var minus=button('−',function(){send(1,i);});minus.setAttribute('aria-label','Decrease '+s.names[i]);minus.dataset.minus=i;minus.disabled=s.busy||s.skills[i]<=s.base[i]||s.skills[i]<=0;row.appendChild(minus);}
      var value=text('output',s.skills[i]+'/10');value.className='skill-rating';value.setAttribute('aria-label',s.names[i]+' rating');row.appendChild(value);
      if(editable){var plus=button('+',function(){send(0,i);});plus.setAttribute('aria-label','Increase '+s.names[i]);plus.dataset.plus=i;plus.disabled=s.busy||s.remaining<=0||s.skills[i]>=10;row.appendChild(plus);}
      list.appendChild(row);
    }
    content.appendChild(list);if(!editable){var note=text('p','These are your current skills. Allocation controls appear when the original game grants points to assign.');note.className='profile-note';content.appendChild(note);}
  }
  function drawAvatar(s){
    if(!avatar||!s.artParts||!Module.originalIndexedArt)return;
    var parts=s.artParts.map(p=>({...p,image:Module.originalIndexedArt(p)})).filter(p=>p.image);if(!parts.length)return;
    var left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
    for(const p of parts){p.dx=p.x+HEAP32[(p.art+32)>>2];p.dy=p.y+HEAP32[(p.art+36)>>2];left=Math.min(left,p.dx);top=Math.min(top,p.dy);right=Math.max(right,p.dx+p.image.width);bottom=Math.max(bottom,p.dy+p.image.height);}
    var ctx=avatar.getContext('2d'),scale=Math.min(avatar.width/(right-left),avatar.height/(bottom-top));ctx.clearRect(0,0,avatar.width,avatar.height);ctx.imageSmoothingEnabled=false;
    for(const p of parts)ctx.drawImage(p.image,(avatar.width-(right-left)*scale)/2+(p.dx-left)*scale,(avatar.height-(bottom-top)*scale)/2+(p.dy-top)*scale,p.image.width*scale,p.image.height*scale);
    avatar.dataset.parts=parts.length;
  }
  function showFaces(s){
    content.append(text('p','Choose a face · '+s.faceCount+' original choices'));
    var grid=document.createElement('div');grid.className='profile-face-grid';
    for(const f of s.faces){var b=button('Face '+(f.index+1),()=>send(7,f.item)),im=Module.originalIndexedArt({art:f.art});if(im)b.prepend(im);b.disabled=!!s.busy;grid.appendChild(b);}content.appendChild(grid);
    var controls=document.createElement('div');controls.className='editor-actions';
    if(s.facePage>0)controls.append(button('Previous faces',()=>send(7,11)));
    if(s.facePage+10<s.faceCount)controls.append(button('Next faces',()=>send(7,10)));
    controls.append(button('Cancel face selection',()=>send(7,12)));for(const b of controls.querySelectorAll('button'))b.disabled=!!s.busy;content.appendChild(controls);
  }
  const editDialog=document.createElement('dialog');
  editDialog.id='mobile-profile-text';
  editDialog.setAttribute('aria-labelledby','mobile-profile-text-title');
  editDialog.innerHTML=`
    <form novalidate>
      <h2 id="mobile-profile-text-title"></h2>
      <label for="mobile-profile-text-input"></label>
      <input id="mobile-profile-text-input" type="text" autocomplete="off" autocapitalize="off"
             spellcheck="false" enterkeyhint="done" aria-describedby="mobile-profile-text-error">
      <p id="mobile-profile-text-error" aria-live="polite"></p>
      <div class="editor-actions">
        <button type="button">Cancel changes</button>
        <button type="submit">Save changes</button>
      </div>
    </form>
  `;
  if(typeof editDialog.showModal==='function'){
    const form=editDialog.querySelector('form'),heading=form.querySelector('h2'),label=form.querySelector('label');
    const input=form.querySelector('input'),error=form.querySelector('p');
    let answer=null;
    function fitEditor(){
      if(!editDialog.open)return;
      const {left,top,width,height,safe}=Module.getScreenBounds();
      const x=left+Math.max(8,safe.left),y=top+Math.max(8,safe.top);
      const availableWidth=Math.max(1,left+width-Math.max(8,safe.right)-x);
      const availableHeight=Math.max(1,top+height-Math.max(8,safe.bottom)-y);
      Object.assign(editDialog.style,{left:(x+availableWidth/2)+'px',top:(y+availableHeight/2)+'px',
        width:Math.min(420,availableWidth)+'px',maxHeight:availableHeight+'px'});
    }
    function finishEdit(value){
      if(!answer)return;
      const resolve=answer;answer=null;
      editDialog.close();resolve(value);
    }
    Module.requestMobileProfileText=(field,limit)=>{
      if(answer||!Module.mobileUI)return Promise.resolve(null);
      const isName=field===100;
      heading.textContent=isName?'Edit player name':'Edit job title';
      label.textContent=isName?'Player name':'Job title';
      input.maxLength=limit;
      input.value=isName?Module.profileState.name:Module.profileState.profession;
      error.textContent='';input.removeAttribute('aria-invalid');
      editDialog.showModal();fitEditor();
      input.focus({preventScroll:true});input.select();
      return new Promise(resolve=>{answer=resolve;});
    };
    form.addEventListener('submit',event=>{
      event.preventDefault();
      const value=input.value;
      if(!value.trim()||value.length>input.maxLength||/[^\x20-\x7e]/.test(value)){
        error.textContent=!value.trim()?'Enter '+(label.textContent==='Player name'?'a player name.':'a job title.'):
          'Use up to '+input.maxLength+' letters, numbers or standard punctuation.';
        input.setAttribute('aria-invalid','true');
        input.focus({preventScroll:true});
        return;
      }
      finishEdit(value);
    });
    input.addEventListener('input',()=>{error.textContent='';input.removeAttribute('aria-invalid');});
    form.querySelector('button[type="button"]').onclick=()=>finishEdit(null);
    editDialog.addEventListener('cancel',event=>{event.preventDefault();finishEdit(null);});
    editDialog.addEventListener('close',()=>{if(!editDialog.open)finishEdit(null);});
    editDialog.addEventListener('keydown',event=>{
      if(event.isComposing||event.keyCode===229)return;
      if(event.key==='Escape'){event.preventDefault();finishEdit(null);}
      if(event.key==='Enter'&&event.target===input){
        event.preventDefault();if(!event.repeat)form.requestSubmit();
      }
    });
    for(const type of ['pointerdown','pointerup','pointermove','pointercancel','mousedown','mouseup',
      'mousemove','click','dblclick','touchstart','touchmove','touchend','touchcancel','wheel','keydown','keyup','keypress'])
      editDialog.addEventListener(type,event=>event.stopPropagation());
    addEventListener('pagehide',()=>finishEdit(null));
    addEventListener('simgolf-screen-resize',fitEditor);
    document.body.append(editDialog);
  }

  function showTextEditor(s){
    content.append(text('label',s.profile===100?'Player name':'Job title'));var input=document.createElement('input');input.type='text';input.maxLength=s.total-1;input.autocomplete='off';input.setAttribute('aria-label',s.profile===100?'Player name':'Job title');input.value=s.profile===100?s.name:s.profession;content.appendChild(input);
    var error=text('p',''),save=button('Save changes',()=>{if(Module.sendGameText(input.value)){save.disabled=true;Module.keyboardInput(13,13);}else error.textContent=Module.gameTextError;});content.append(save,button('Cancel changes',()=>Module.keyboardInput(27,27)),error);
  }
  function refresh(){
    var s=Module.profileState,visible=!!(Module.mobileUI&&s?.active&&!s.fallback);
    const tournamentOffer=visible&&s.confirmation==='tournament-offer';
    if(tournamentOffer)visible=false;
    root.hidden=!visible;returnButton.hidden=!(Module.mobileUI&&s?.active&&s.fallback);document.body.classList.toggle('mobile-profile-open',visible);document.body.classList.toggle('mobile-visitor-details-open',visible&&s.kind===6);
    var top=document.getElementById('build-header')?.getBoundingClientRect().bottom||22;document.documentElement.style.setProperty('--profile-header',top+'px');
    const cancel=document.getElementById('mobile-cancel');
    if(cancel){if(visible&&s.kind===6&&cancel.parentNode!==footer)footer.prepend(cancel);else if((!visible||s.kind!==6)&&cancel.parentNode===footer)document.body.append(cancel);}
    const courseConfirmation=visible&&['land-offer','home-demolition','building-demolition','tournament-preparation'].includes(s.confirmation);
    document.body.classList.toggle('mobile-course-confirm-open',courseConfirmation);
    if(!courseConfirmation&&root.hasAttribute('data-course-confirmation')){
      courseConfirmationMap.hidden=true;courseConfirmationMap.width=courseConfirmationMap.height=0;
    }
    root.toggleAttribute('data-course-confirmation',courseConfirmation);
    if(tournamentOffer)Module.showTournamentOffer?.(s);
    else Module.hideTournamentOffer?.();
    if(!visible){state=null;return;}
    if(serial!==s.serial){serial=s.serial;tab=s.kind===2?'skills':'profile';fingerprint='';if(s.kind===6){visitorTextStamp='';visitorInfo.replaceChildren(text('p','Reading Original Player Details…'));visitorSayings.replaceChildren();content.scrollTop=0;}Module.cancelMapGesture();if(Module.aimMode)Module.setAimMode(false);}
    root.dataset.kind=s.kind;root.dataset.confirmation=s.confirmation||'';
    if(s.confirmation==='tournament-preparation'){
      root.setAttribute('aria-label','Tournament Preparation');
      points.hidden=tabs.hidden=footer.hidden=true;
      if(s.frame&&s.preparation?.choices)showTournamentPreparation(s);
      else if(!preparationView||preparationView.serial!==s.serial)content.replaceChildren();
      return;
    }
    preparationView=null;
    if(s.kind===6){
      root.setAttribute('aria-label','Player Details');
      title.textContent=s.name?s.name+' · Player Details':'Player Details';
      points.hidden=tabs.hidden=true;footer.hidden=false;
      if(content.firstChild!==visitorPanels){content.replaceChildren(visitorPanels,visitorInfo,visitorSayings);content.scrollTop=0;visitorTextStamp='';}
      renderVisitorText(s);
      done.disabled=original.disabled=!!s.busy;
      return;
    }
    state=s;var next=JSON.stringify([s.kind,s.serial,s.name,s.profession,s.skills,s.base,s.remaining,s.spent,s.busy,s.total,s.traits,s.appearance,s.facePage,s.clubhouseDemolition,s.confirmation,!!s.frame,tab]);
    if(next!==fingerprint&&!pressed.size){
      fingerprint=next;var scroll=content.scrollTop;content.replaceChildren();avatar=null;
      root.setAttribute('aria-label',s.confirmation==='overwrite'?'Overwrite File':s.confirmation==='exit'?'Exit Game':s.confirmation==='land-offer'?'Expand Your Course':s.confirmation==='home-demolition'?'Demolish Home Site':s.confirmation==='building-demolition'?'Demolish Building':s.clubhouseDemolition?'Clubhouse demolition':s.kind===3&&Module.loadDeleteConfirm?'Delete saved game':'Golfer profile');
      title.textContent=s.kind===3?(s.confirmation==='overwrite'?'Overwrite File':s.confirmation==='exit'?'Exit Game':s.confirmation==='land-offer'?'Expand Your Course':s.confirmation==='home-demolition'?'Demolish Home Site':s.confirmation==='building-demolition'?'Demolish Building':s.clubhouseDemolition?'Relocate clubhouse':Module.loadDeleteConfirm?'Delete saved game':'Unused skill points'):s.kind===4?'Choose golfer face':s.kind===5?(s.profile===100?'Edit player name':'Edit job title'):s.kind===2?'Assign golfer skills':'Golfer profile';
      points.hidden=s.kind!==2;points.textContent=s.remaining+' points remaining · '+s.spent+' assigned';
      tabs.hidden=s.kind>=3;footer.hidden=s.kind>=3;profileTab.setAttribute('aria-selected',String(tab==='profile'));skillTab.setAttribute('aria-selected',String(tab==='skills'));
      done.disabled=!!s.busy;history.hidden=!Module.hasGameFeature?.('golferHistories')||!Module.golferHistoryEligible?.(s.actor);history.disabled=!!s.busy;original.disabled=!!s.busy;
      if(s.kind===3&&s.confirmation)showConfirmation(s);
      else if(s.kind===3){var deleting=!!Module.loadDeleteConfirm,relocating=!!s.clubhouseDemolition,box=document.createElement('div');box.className='profile-confirm';box.append(text('h2',relocating?'Demolish your clubhouse?':deleting?'Delete this saved game?':'You have unused skill points'),text('p',deleting?Module.loadDeleteName:(s.title||'').split('\n').filter(t=>t&&!/^ /.test(t)).join(' ')));if(relocating)box.appendChild(text('p','After demolition, choose a new location and press Place.'));if(deleting)box.appendChild(text('p','This removes the selected save. Your other saves are kept.'));var keep=button(relocating?'No, keep clubhouse':deleting?'Keep saved game':'Keep allocating',function(){send(5,1);}),leave=button(relocating?'Demolish and relocate':deleting?'Delete saved game':'Continue without remaining points',function(){send(5,0);});if(relocating){keep.id='mobile-clubhouse-keep';leave.id='mobile-clubhouse-demolish';}keep.disabled=leave.disabled=!!s.busy||!s.frame;box.append(keep,leave);content.appendChild(box);}
      else if(s.kind===4)showFaces(s);else if(s.kind===5)showTextEditor(s);else if(tab==='profile')showProfile(s);else showSkills(s);
      content.scrollTop=scroll;
    }
    drawAvatar(s);
  }
  setInterval(refresh,100);addEventListener('resize',refresh);addEventListener('simgolf-header-resize',refresh);
})();


// The original tract chooser owns price calculation, selection and payment.
(function(){
  const feature='deferredLandOffers';
  let landOffer=null,requestedOffer=null;
  Module.saveRules.register(feature,{
    prepare:data=>Number.isInteger(data.property)?data:null,
    activate:data=>{landOffer=data;},
    dispose:()=>{landOffer=requestedOffer=null;},
    capture:()=>landOffer||{}
  });
  Module.recordLandOffer=(property,stage)=>{
    if(Module.hasGameFeature(feature)&&property>=0&&property<16)landOffer={property,stage};
  };
  Module.clearLandOffer=()=>{landOffer=null;};
  Module.hasDeferredLandOffer=(property=HEAP32[0x59bf90>>2],stage=HEAP32[0x53a450>>2]&0x7f)=>
    !!landOffer&&landOffer.property===property&&landOffer.stage===stage&&Module.hasGameFeature(feature);
  Module.queueLandOfferRequest=(property,stage)=>{
    requestedOffer=Module.hasDeferredLandOffer(property,stage)?landOffer:null;
    return !!requestedOffer;
  };
  Module.takeLandOfferRequest=(property,stage)=>{
    const offer=requestedOffer;
    requestedOffer=null;
    return offer===landOffer&&Module.hasDeferredLandOffer(property,stage);
  };

  const root=document.createElement('section');
  root.id='mobile-land-purchase';root.hidden=true;
  root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','mobile-land-title');
  root.innerHTML='<div class="land-card"><header><h2 id="mobile-land-title">Purchase Land</h2><button type="button" id="mobile-land-back">Back</button></header><div class="land-body"><p id="mobile-land-cash"></p><div class="land-content"><div><div class="land-grid" role="group" aria-label="Land tracts"></div><p id="mobile-land-details" aria-live="polite"></p></div><div class="land-map-preview" hidden><canvas class="land-map" width="590" height="304" role="img" aria-label="Original course map with numbered tracts"></canvas><svg class="land-map-tracts" viewBox="0 0 590 304" aria-hidden="true" focusable="false"></svg></div></div></div><p id="mobile-land-warning" role="alert" hidden></p><footer><button type="button" id="mobile-land-buy" disabled>Buy Selected Tract</button><button type="button" id="mobile-land-warning-done" hidden>Done</button></footer></div>';
  const style=document.createElement('style');
  style.textContent=`
    #mobile-land-purchase[hidden],#mobile-land-purchase [hidden]{display:none!important}
    body:is(.mobile-course-confirm-open,.mobile-land-purchase-open) :is(#mobile-ui,#mobile-mode-rail,#mobile-cancel,#mobile-open-hole,#canvas,#map-display){visibility:hidden!important;pointer-events:none!important}
    #mobile-land-purchase{position:fixed;inset:0;z-index:115;display:flex;box-sizing:border-box;padding:calc(8px + env(safe-area-inset-top)) calc(10px + env(safe-area-inset-right)) calc(8px + env(safe-area-inset-bottom)) calc(10px + env(safe-area-inset-left));background:radial-gradient(ellipse at 30% 8%,#e7e4f3,#a3a0c9);color:var(--menu-text);font:15px/1.35 system-ui,sans-serif}
    #mobile-land-purchase .land-card{display:flex;flex-direction:column;gap:8px;box-sizing:border-box;width:min(100%,520px);max-height:100%;margin:auto;padding:10px;border:1px solid var(--menu-border);border-radius:16px;background:#fff9e8}
    #mobile-land-purchase header,#mobile-land-purchase footer{display:flex;align-items:center;gap:8px;flex:none}
    #mobile-land-purchase h2{flex:1;min-width:0;margin:0;font:clamp(18px,4vw,24px)/1.1 OriginalWorldMenu,system-ui,sans-serif}
    #mobile-land-purchase p{margin:0 0 8px}
    #mobile-land-cash{font-weight:700}
    #mobile-land-purchase .land-body{min-height:0;overflow:auto;overscroll-behavior:contain;touch-action:pan-y}
    #mobile-land-purchase .land-content{display:grid;gap:8px;align-items:center}
    #mobile-land-purchase .land-map-preview{position:relative;width:100%;max-width:400px;margin:auto;clip-path:polygon(50% 1%,100% 50%,50% 99%,0 50%)}
    #mobile-land-purchase .land-map{display:block;width:100%;height:auto}
    #mobile-land-purchase .land-map-tracts{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
    #mobile-land-purchase .land-map-tracts polygon{fill:transparent}
    #mobile-land-purchase .land-map-tracts polygon[data-map-tract]{pointer-events:fill;cursor:pointer}
    #mobile-land-purchase .land-map-tracts polygon.selected{fill:rgba(113,101,174,.26);stroke:var(--menu-focus);stroke-width:2;vector-effect:non-scaling-stroke;stroke-linejoin:round}
    #mobile-land-details{min-height:2.7em;margin:8px 0 0!important}
    @media(min-width:720px){
      #mobile-land-purchase .land-card{width:min(100%,740px)}
      #mobile-land-purchase .land-content{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
    }
    #mobile-land-purchase .land-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
    #mobile-land-purchase button{min-width:0;min-height:44px;padding:6px;border:1px solid var(--menu-border);border-radius:8px;background:var(--menu-preview);color:inherit;font:inherit;overflow-wrap:anywhere;touch-action:manipulation;cursor:pointer}
    #mobile-land-purchase button:disabled{opacity:.65;cursor:default}
    #mobile-land-purchase button[aria-pressed=true]{outline:2px solid var(--menu-focus);outline-offset:-2px;background:var(--menu-selected)}
    #mobile-land-purchase .land-grid button{display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:13px}
    #mobile-land-purchase .land-grid strong{font-size:14px}
    #mobile-land-purchase footer button{flex:1;background:linear-gradient(#fffde6,#f4db90);font-weight:700}
    #mobile-land-warning{overflow:auto}
  `;
  document.head.append(style);document.body.append(root);
  const back=root.querySelector('#mobile-land-back'),buy=root.querySelector('#mobile-land-buy');
  const body=root.querySelector('.land-body'),grid=root.querySelector('.land-grid'),cash=root.querySelector('#mobile-land-cash');
  const warning=root.querySelector('#mobile-land-warning'),done=root.querySelector('#mobile-land-warning-done');
  const details=root.querySelector('#mobile-land-details'),map=root.querySelector('.land-map');
  const mapPreview=root.querySelector('.land-map-preview'),mapTracts=root.querySelector('.land-map-tracts');
  const tractEdges=[0,16.5,32.5,49];
  // Original tile projection relative to the cropped bitmap below.
  const project=(x,y)=>[1+(x+y)*6,151+(y-x)*3].join(',');
  let serial=0,selected=null,buttons=[],busy=false,funds=false,timer=0;
  const dollars=n=>'$'+n.toLocaleString();
  function selectTract(row){
    if(root.hidden||busy||funds||row.owned||row.price<=0)return;
    mapTracts.querySelector('.selected')?.classList.remove('selected');
    mapTracts.querySelector('[data-map-tract="'+row.id+'"]')?.classList.add('selected');
    selected=row;refresh();
  }
  function refresh(){
    const checking=!!Module.fundsCheck;
    if(funds&&!checking)busy=false;
    funds=checking;
    const message=Module.mobileNotification;
    warning.hidden=done.hidden=!funds;body.hidden=buy.hidden=funds;
    if(funds)warning.textContent=message?.blocking?message.text.replace(/§/g,'$'):'Checking available cash…';
    done.disabled=!message?.blocking;
    back.disabled=busy||funds;
    details.textContent=selected?selected.description.replace(/^Buy tract #\d+,\s*/i,'').trim():'Choose a tract on the map or in the list to review its price and terrain.';
    for(const b of buttons)b.setAttribute('aria-pressed',String(Number(b.dataset.tract)===selected?.id));
    buy.disabled=busy||!selected;
    buy.textContent=selected?'Buy Tract '+(selected.id+1)+' · '+dollars(selected.price):'Buy Selected Tract';
  }
  function submit(id,price=0){
    if(root.hidden||busy||funds)return;
    busy=true;Module.landPurchaseAction={serial,id,price};refresh();
  }
  back.onclick=()=>submit(-2);
  buy.onclick=()=>{if(selected)submit(selected.id,selected.price);};
  done.onclick=()=>{if(funds&&!done.disabled)Module.keyboardInput(13,13);};
  root.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();if(funds)done.click();else back.click();}
  });
  for(const type of ['pointerdown','pointerup','pointermove','pointercancel','mousedown','mouseup','click','touchstart','touchmove','touchend','touchcancel','wheel','keydown','keyup','keypress'])
    root.addEventListener(type,e=>e.stopPropagation());
  function drawMap(address,stride){
    mapPreview.hidden=!address;
    if(!address)return;
    const ctx=map.getContext('2d'),frame=ctx.createImageData(map.width,map.height);
    let at=0;
    // Crop the numbered isometric map from the original chooser bitmap.
    for(let y=0;y<map.height;y++){
      let src=(address>>1)+(y+288)*stride+105;
      for(let x=0;x<map.width;x++){
        const color=HEAPU16[src++];
        frame.data[at++]=((color>>10)&31)*255/31;frame.data[at++]=((color>>5)&31)*255/31;
        frame.data[at++]=(color&31)*255/31;frame.data[at++]=255;
      }
    }
    ctx.putImageData(frame,0,0);
  }
  Module.showLandPurchase=(id,rows,reserve,address,stride)=>{
    if(id===serial)return;
    serial=id;selected=null;busy=funds=false;Module.landPurchaseAction=null;
    cash.textContent='Cash reserve '+dollars(reserve);
    drawMap(address,stride);
    // The native picker numbers its tracts down each column.
    buttons=Array.from({length:9},(_,i)=>{
      const row=rows[(i%3)*3+Math.floor(i/3)],b=document.createElement('button');
      b.type='button';b.dataset.tract=row.id;b.disabled=row.owned||row.price<=0;
      const title=document.createElement('strong'),detail=document.createElement('span');
      title.textContent='Tract '+(row.id+1);
      detail.textContent=row.owned?'Owned':row.acres+' acres · '+dollars(row.price);
      b.append(title,detail);b.onclick=()=>selectTract(row);
      return b;
    });
    grid.replaceChildren(...buttons);
    mapTracts.replaceChildren(...rows.filter(row=>!row.owned&&row.price>0).map(row=>{
      const x=row.id%3,y=Math.floor(row.id/3);
      const [left,right]=tractEdges.slice(x,x+2),[top,bottom]=tractEdges.slice(y,y+2);
      const tract=document.createElementNS('http://www.w3.org/2000/svg','polygon');
      tract.dataset.mapTract=row.id;
      tract.setAttribute('points',[
        project(left,top),project(right,top),project(right,bottom),project(left,bottom)
      ].join(' '));
      tract.addEventListener('click',()=>selectTract(row));
      return tract;
    }));
    root.hidden=false;body.scrollTop=0;document.body.classList.add('mobile-land-purchase-open');
    refresh();back.focus({preventScroll:true});timer=setInterval(refresh,100);
  };
  Module.closeLandPurchase=()=>{
    clearInterval(timer);root.hidden=true;serial=0;selected=null;Module.landPurchaseAction=null;
    document.body.classList.remove('mobile-land-purchase-open');
  };
})();


// Readable hiring and staff management over the original dialogs/selectors.
(function(){
  if(!Module.mobileMap)return;
  Module.staffHireQueue=[];
  var visible=false,state='',selected=null,confirm=null,pressed=new Set(),renameShown=false,warningText='',warningUntil=0,lastMessage='';
  var root=document.createElement('section');root.id='mobile-staff';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Employee management');
  var style=document.createElement('style');style.textContent=`
    #mobile-staff[hidden],#mobile-staff-return[hidden]{display:none!important}
    body.mobile-staff-open #mobile-ui,body.mobile-staff-open #canvas{visibility:hidden}
    #mobile-staff{position:fixed;inset:var(--staff-header,22px) 0 0;z-index:65;display:flex;flex-direction:column;gap:10px;box-sizing:border-box;padding:max(10px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));color:var(--menu-text);background:var(--menu-bg);font:16px system-ui,sans-serif}
    #mobile-staff h1{margin:0;font-size:22px}#mobile-staff h2{margin:0;font-size:18px}#mobile-staff p{margin:4px 0;line-height:1.4}
    #mobile-staff header,#mobile-staff footer{display:flex;flex:none;gap:8px;align-items:center;flex-wrap:wrap}#mobile-staff header{justify-content:space-between}#mobile-staff footer{border-top:1px solid var(--menu-line);padding-top:10px}
    #mobile-staff .staff-actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;width:100%}
    #mobile-staff .staff-actions button{font-size:14px;padding:6px 4px;overflow-wrap:anywhere}
    @media(max-width:380px){#mobile-staff .staff-actions{grid-template-columns:repeat(2,minmax(0,1fr))}}
    #mobile-staff button,#mobile-staff-return{font:inherit;min-height:48px;padding:10px 14px;border:1px solid var(--menu-border);border-radius:7px;background:var(--menu-button);color:var(--menu-text);touch-action:manipulation;box-sizing:border-box}#mobile-staff button:disabled{opacity:.4}#mobile-staff button[aria-selected=true]{background:var(--menu-selected);border-color:var(--menu-focus)}
    #mobile-staff .staff-content{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain}#mobile-staff .staff-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(270px,100%),1fr));gap:8px}
    #mobile-staff .staff-card{display:grid;grid-template-columns:70px minmax(0,1fr);gap:12px;text-align:left;align-items:center;min-height:100px;width:100%}#mobile-staff .staff-card span{display:block;overflow-wrap:anywhere}#mobile-staff .staff-card strong{display:block;font-size:18px}#mobile-staff .staff-card canvas{width:70px;height:80px;object-fit:contain;image-rendering:pixelated}
    #mobile-staff .staff-note{padding:8px;background:var(--menu-panel);border-radius:6px}#mobile-staff input{font:inherit;width:100%;padding:12px;box-sizing:border-box;margin:12px 0}#mobile-staff .staff-confirm{max-width:560px;margin:auto;padding:12px;background:var(--menu-panel);border-radius:8px}
    #mobile-staff-return{position:fixed;right:max(8px,env(safe-area-inset-right));top:calc(var(--staff-header,22px) + 8px);z-index:66}
    @media(max-height:500px){#mobile-staff{gap:6px}#mobile-staff header h1{font-size:19px}#mobile-staff .staff-card{min-height:84px}#mobile-staff .staff-card canvas{height:64px}}
  `;document.head.appendChild(style);
  var header=document.createElement('header'),title=text('h1','Employees'),done=button('Back to course',close);done.id='mobile-staff-done';header.append(title,done);root.appendChild(header);
  var note=text('p','');note.className='staff-note';note.setAttribute('role','status');root.appendChild(note);
  var warning=text('p','');warning.className='staff-note';warning.setAttribute('role','alert');warning.hidden=true;root.appendChild(warning);
  var content=document.createElement('div');content.className='staff-content';root.appendChild(content);
  var footer=document.createElement('footer');root.appendChild(footer);
  var original=button('Mobile employees',()=>hireCommand(-2));original.id='mobile-staff-return';original.hidden=true;document.body.append(root,original);
  for(const type of ['pointerdown','pointerup','pointermove','pointercancel','mousedown','mouseup','mousemove','click','touchstart','touchmove','touchend','wheel','keydown','keyup','keypress','beforeinput','input','compositionstart','compositionupdate','compositionend']){root.addEventListener(type,e=>e.stopPropagation());original.addEventListener(type,e=>e.stopPropagation());}
  root.addEventListener('pointerdown',e=>pressed.add(e.pointerId),true);for(const type of ['pointerup','pointercancel'])addEventListener(type,e=>pressed.delete(e.pointerId),true);addEventListener('blur',()=>pressed.clear());
  function text(tag,value){var e=document.createElement(tag);e.textContent=value;return e;}
  function button(label,fn){var b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',fn);return b;}
  function command(kind,item){warningText='';Module.cancelMapGesture();if(Module.menuQueue.length<16)Module.menuQueue.push([kind,item]);state='';}
  function hireCommand(item){var h=Module.staffHire;if(h&&!h.busy&&Module.staffHireQueue.length<8){Module.cancelMapGesture();Module.staffHireQueue.push([h.serial,item]);state='';}}
  function close(){if(Module.staffHire){Module.keyboardInput(27,27);return;}if(Module.staffRenaming>=0){cancelRename();return;}visible=false;confirm=null;command(13,0);refresh();}
  Module.openStaffPanel=function(mode){visible=true;selected=null;confirm=null;state='';Module.setAimMode(false);command(mode==='hire'?8:5,mode==='hire'?3:10);refresh();};
  function portrait(art,role){if(!Module.originalIndexedArt||!art)return null;var image=Module.originalIndexedArt({art:art,palette:Module.staffOptions?.[role]?.palette,withoutShadow:true});if(image)image.setAttribute('aria-hidden','true');return image;}
  function card(row,art,choose,active,busy){var b=button('',choose);b.className='staff-card';b.dataset.employee=row.id===undefined?'':row.id;b.dataset.choice=row.item;b.setAttribute('aria-label',row.name+' · '+row.role);b.setAttribute('aria-selected',String(active));b.disabled=busy;var im=portrait(art,row.roleIndex===undefined?row.item:row.roleIndex);if(im)b.appendChild(im);else b.appendChild(text('span',''));var detail=document.createElement('span');detail.append(text('strong',row.name),text('span',row.role),text('span','$'+row.weekly.toLocaleString()+' / week'));b.appendChild(detail);return b;}
  function selectedAction(op,row){command(15,(row.id<<6)|(row.roleIndex<<3)|op);}
  function renameText(value){
    if(/[^\x20-\x7e]/.test(value)){Module.gameTextError='Use letters, numbers and standard punctuation.';return false;}
    if(!Module.mobileState?.textInput||Module.gameTextQueue.length){Module.gameTextError='Please wait and try again.';return false;}
    // Original text entry begins at the end of the existing name. Clear it
    // with acknowledged characters in the same FIFO, then type/confirm.
    for(var i=0;i<31;i++)Module.gameTextQueue.push(8);
    if(!Module.sendGameText(value))return false;Module.keyboardInput(13,13);return true;
  }
  function cancelRename(){renameText(Module.staffRenameOriginal||'');}

  function refresh(){
    var s=Module.mobileState||{},h=Module.staffHire,rename=Module.staffRenaming>=0;
    if(s.message&&s.message!==lastMessage){warningText=s.message;warningUntil=Date.now()+8000;}lastMessage=s.message||'';warning.textContent=warningText;warning.hidden=!warningText||Date.now()>warningUntil;
    if(Module.atTitle){visible=false;confirm=null;selected=null;}
    var showing=Module.mobileUI&&(h&&!h.fallback||visible&&(rename||s.course&&s.staffOpen));
    root.hidden=!showing;original.hidden=!(Module.mobileUI&&h?.fallback);document.body.classList.toggle('mobile-staff-open',!!showing);
    document.documentElement.style.setProperty('--staff-header',(document.getElementById('build-header')?.getBoundingClientRect().bottom||22)+'px');
    if(!showing){state='';return;}
    var rows=s.staff||[],row=rows.find(r=>r.id===selected);if(!row)confirm=null;
    var nativeSelected=rows.find(r=>r.item===s.employeeSelected+8),busy=!!(h?.busy||Module.menuQueue.length||Module.staffHireQueue.length);
    var next=JSON.stringify([h?.serial,h?.busy,h?.fallback,rename,s.staffOffset,s.staffTotal,s.employeeSelected,rows,selected,confirm,busy]);
    if(state===next||pressed.size)return;state=next;
    // Keep an active text field intact as the original dialog ticks.
    if(rename&&renameShown)return;renameShown=rename;
    var scroll=content.scrollTop;content.replaceChildren();footer.replaceChildren();done.textContent=h?'Cancel hiring':rename?'Cancel rename':'Back to course';
    if(rename){
      title.textContent='Rename employee';var name=(rows.find(r=>r.id===Module.staffRenaming)||{}).name||'';note.textContent='Enter a name for this employee.';
      var label=text('label','Employee name'),input=document.createElement('input');input.maxLength=30;input.autocomplete='off';input.setAttribute('aria-label','Employee name');input.value=name;label.appendChild(input);content.appendChild(label);
      var error=text('p','');content.appendChild(error);footer.append(button('Save employee name',()=>{if(!renameText(input.value))error.textContent=Module.gameTextError;}),button('Cancel rename',cancelRename));return;
    }
    if(h){
      title.textContent='Hire an employee';note.textContent='Choose an employee. Weekly wages and hiring requirements follow the original game.';var list=document.createElement('div');list.className='staff-list';
      for(const o of h.options)list.appendChild(card(o,o.art,()=>hireCommand(o.item),false,busy));content.appendChild(list);footer.appendChild(button('Original hiring screen',()=>hireCommand(-2)));
    }else if(confirm&&row&&nativeSelected?.id===row.id){
      title.textContent='Fire employee';note.textContent=row.name+' · '+row.role;var box=document.createElement('div');box.className='staff-confirm';box.append(text('h2','Fire '+row.name+'?'),text('p','The game charges a $2,500 dismissal fee.'));var keep=button('Keep employee',()=>{confirm=null;state='';refresh();}),fire=button('Confirm fire',()=>{confirm=null;selectedAction(1,row);selected=null;});keep.disabled=fire.disabled=busy;box.append(keep,fire);content.appendChild(box);
    }else{
      title.textContent='Employees';note.textContent=s.staffTotal+' employed · '+(row?row.name+' · '+row.role:s.staffTotal?'Select someone to manage.':'Hire your first employee.');
      var list=document.createElement('div');list.className='staff-list';for(const r of rows){var art=Module.staffOptions?.[r.roleIndex]?.art;list.appendChild(card(r,art,()=>{selected=r.id;confirm=null;command(6,r.item);},nativeSelected?.id===r.id,busy));}content.appendChild(list);
      var hire=button(row?'Hire':'Hire employee',()=>{selected=null;command(8,3);});hire.disabled=busy;
      if(row){
        var actions=document.createElement('div');actions.className='staff-actions';
        actions.setAttribute('role','group');actions.setAttribute('aria-label','Employee actions');
        actions.appendChild(hire);
        var enabled=nativeSelected?.id===row.id&&!busy;
        for(const [label,fn]of [
          ['Relocate',()=>{selectedAction(2,row);visible=false;refresh();}],
          ['Rename',()=>selectedAction(3,row)],
          ['Fire',()=>{confirm=row.id;state='';refresh();}]
        ]){var b=button(label,fn);b.disabled=!enabled;actions.appendChild(b);}
        footer.appendChild(actions);
      }else footer.appendChild(hire);
      if(s.staffOffset>0){var prev=button('Previous employees',()=>{selected=null;command(6,2);});prev.disabled=busy;footer.appendChild(prev);}
      if(s.staffTotal-s.staffOffset>8){var more=button('More employees',()=>{selected=null;command(6,3);});more.disabled=busy;footer.appendChild(more);}
    }
    content.scrollTop=scroll;
  }
  setInterval(refresh,100);addEventListener('resize',refresh);addEventListener('simgolf-header-resize',refresh);
})();

// Continue/Load: sort presentation by real file timestamps. Original43b610
// still enumerates, previews, loads and cancels through its own input loop.
(function(){
  if(!Module.mobileMap)return;
  var style=document.createElement('style');style.textContent=`
    #mobile-load[hidden],#mobile-load-return[hidden],#mobile-load [hidden]{display:none!important}
    body.mobile-load-open #canvas,body.mobile-load-open #mobile-ui,body.mobile-load-open #mobile-status{visibility:hidden}
    #mobile-load{position:fixed;z-index:60;box-sizing:border-box;display:flex;flex-direction:column;background:#9e9ec8;color:#1c2541;font:15px system-ui,sans-serif;padding:10px max(12px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));overflow:hidden}
    #mobile-load h1{font-size:21px;margin:0 0 5px}#mobile-load h2{font-size:18px;margin:0 0 8px;overflow-wrap:anywhere}#mobile-load p{line-height:1.4;margin:5px 0 10px}#mobile-load .note{font-size:13px;color:#343456}
    #mobile-load-content{min-height:0;flex:1;overflow:hidden;display:flex;flex-direction:column;gap:12px}
    #mobile-load-list{flex:0 0 36%;min-height:72px;min-width:0;overflow:auto;overscroll-behavior:contain;touch-action:pan-y;display:flex;flex-direction:column;gap:6px;padding:2px;box-sizing:border-box}
    #mobile-load button,#mobile-load-return{font:inherit;min-height:44px;border:1px solid #727094;border-radius:6px;color:#1c2541;background:#e1e1f3;padding:10px 12px;touch-action:manipulation;cursor:pointer}
    #mobile-load-titlebar{display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none}
    #mobile-load-titlebar h1{min-width:0}
    #mobile-load-refresh{flex:none}
    #mobile-load button:disabled{opacity:.65;cursor:default}#mobile-load button[aria-pressed=true]{border-color:#39315d;background:#c3cef6}
    #mobile-load-list button{flex:none;min-height:66px;text-align:left;overflow-wrap:anywhere}#mobile-load-list strong,#mobile-load-list time,#mobile-load-list small{display:block}#mobile-load-list time,#mobile-load-list small{font-size:13px;color:#343456;margin-top:4px}
    #mobile-load-preview{background:#ededf8;flex:1;min-height:0;min-width:0;overflow:auto;overscroll-behavior:contain;padding:12px;border:1px solid #79749c;border-radius:6px;box-sizing:border-box;overflow-wrap:anywhere}
    #mobile-load-preview .course-heading{display:flex;align-items:center;gap:10px}#mobile-load-preview canvas{width:48px;height:48px;object-fit:contain;image-rendering:pixelated;flex:none}#mobile-load-preview dl{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin:12px 0}#mobile-load-preview dt{color:#343456}#mobile-load-preview dd{margin:0;text-align:right}
    #mobile-load[data-kind=pro] #mobile-load-list{flex:0 0 auto;max-height:28%;min-height:72px}#mobile-load[data-kind=pro] #mobile-load-preview canvas{width:76px;height:76px;image-rendering:auto}#mobile-load[data-kind=pro] #mobile-load-preview dd{font-weight:700}
    #mobile-load-preview table{width:100%;border-collapse:collapse;font-size:14px}#mobile-load-preview th,#mobile-load-preview td{padding:7px 4px;border-bottom:1px solid #79749c;text-align:center}#mobile-load-preview caption{font-weight:600;margin:8px 0}
    #mobile-load footer{display:flex;flex-wrap:wrap;gap:6px;padding-top:10px;flex:none}#mobile-load footer button:first-child{flex:1;background:#c3cef6}#mobile-load-status{min-height:20px;font-size:13px;margin:4px 0}
    #mobile-load-return{position:fixed;z-index:61;left:max(8px,env(safe-area-inset-left));bottom:max(8px,env(safe-area-inset-bottom));background:#9e9ec8}
    #mobile-load button:focus-visible,#mobile-load-return:focus-visible{outline:3px solid #39315d;outline-offset:2px}
    @media(hover:hover){#mobile-load button:not(:disabled):hover,#mobile-load-return:hover{background:#f9f9e7}}
    @media(min-width:700px) and (min-aspect-ratio:1/1){#mobile-load[data-kind=pro] #mobile-load-list{flex:1;max-height:none;min-height:0}#mobile-load-content{flex-direction:row}#mobile-load-list{flex:1;min-height:0}}
  `;document.head.appendChild(style);
  var root=document.createElement('section');root.id='mobile-load';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Continue saved game');
  function text(tag,value){var e=document.createElement(tag);e.textContent=value;return e;}
  function button(label,action){var b=text('button',label);b.type='button';b.addEventListener('click',action);return b;}
  var heading=text('h1','Continue saved game'),note=text('p','Newest files first, using actual save/modified times. Older imports may show when copied.');note.className='note';
  const titleBar=document.createElement('div');titleBar.id='mobile-load-titlebar';
  const refreshFiles=button('Refresh',()=>send(5,0));refreshFiles.id='mobile-load-refresh';
  titleBar.append(heading,refreshFiles);
  var content=document.createElement('div');content.id='mobile-load-content';var list=document.createElement('div');list.id='mobile-load-list';list.setAttribute('aria-label','Saved games, newest first');var preview=document.createElement('section');preview.id='mobile-load-preview';preview.setAttribute('aria-label','Selected course preview');content.append(list,preview);
  var status=text('div','');status.id='mobile-load-status';status.setAttribute('role','status');
  var footer=document.createElement('footer'),load=button('Load selected game',reviewSelected),cancel=button('Cancel',()=>send(2,0)),original=button('Original load screen',()=>send(3,0)),remove=button('Delete selected save',()=>send(4,state.selected));load.id='mobile-load-commit';remove.id='mobile-load-delete';cancel.id='mobile-load-cancel';footer.append(load,remove,cancel,original);root.append(titleBar,note,content,status,footer);
  var back=button('Mobile saved games',()=>send(3,0));back.id='mobile-load-return';back.hidden=true;document.body.append(root,back);
  var state={},serial=0,stamp='',previewStamp='',pending=null,autoSelected=false,pointers=new Set(),ruleInfo=new Map(),ruleSerial=0;
  let catalog='',rows=[],recentSaveNotice='';
  function selectedPolicy(){
    const row=state.rows?.find(r=>r.index===state.selected),info=Module.loadPreviewInfo;
    if(row&&info?.serial===state.serial&&info.name===row.name)
      return info.error?{kind:'blocked',reason:info.error}:info.policy;
    return row?ruleInfo.get(row.name):null;
  }
  async function inspectRules(rows,generation){
    for(const row of rows){
      let info;
      try{info=Module.saveRules?await Module.saveRules.assess(row.name):{kind:'classic'};}
      catch(e){info={kind:'blocked',reason:String(e.message||e)};}
      if(ruleSerial!==generation)return;
      ruleInfo.set(row.name,{kind:info.kind,reason:info.reason});
    }
    stamp=previewStamp='';refresh();
  }
  function reviewSelected(){
    if(!state.active||load.disabled||Module.courseLoading?.active)return;
    const info=Module.loadPreviewInfo,row=state.rows?.find(r=>r.index===state.selected);
    if(!Module.localFiles||state.championship||state.proSelection){send(1,state.selected);return;}
    if(!row||info?.name!==row.name||info.serial!==state.serial||info.error||!info.policy?.sha256)return;
    const chooser=state.serial,scroll=list.scrollTop;
    Module.beginCourseLoading?.(state,{
      policy:info.policy,
      enter:()=>{
        if(state.serial===chooser&&state.selected===row.index&&state.rows.find(r=>r.index===row.index)?.name===row.name)send(1,row.index);
        else Module.cancelCourseLoading?.();
      },
      back:()=>{list.scrollTop=scroll;load.focus({preventScroll:true});}
    });
  }
  function send(op,index){
    if(!state.active)return;
    const target=op===2?'back':op===1?(state.proSelection?'course':state.championship?'pros':null):null;
    if(target)Module.beginMobileScreenTransition?.(target,'load',state.serial);
    Module.cancelMapGesture();
    pending={op,index,sent:performance.now()};
    (Module.loadQueue||(Module.loadQueue=[])).push([state.serial,op,index,state.rows?.find(r=>r.index===index)?.name]);
    refresh();
  }
  ['mousedown','mousemove','mouseup','click','pointerdown','pointermove','pointerup','touchstart','touchmove','touchend','wheel','keydown','keyup','keypress','beforeinput','input','compositionstart','compositionupdate','compositionend'].forEach(t=>root.addEventListener(t,e=>e.stopPropagation()));
  ['mousedown','mouseup','click','pointerdown','pointerup','touchstart','touchend'].forEach(t=>back.addEventListener(t,e=>e.stopPropagation()));
  root.addEventListener('pointerdown',e=>pointers.add(e.pointerId),true);['pointerup','pointercancel'].forEach(t=>addEventListener(t,e=>pointers.delete(e.pointerId),true));addEventListener('blur',()=>pointers.clear());
  function bounds(){var b=Module.getScreenBounds(),top=Math.max(b.top,document.getElementById('build-header').getBoundingClientRect().bottom);root.style.top=top+'px';root.style.left=b.left+'px';root.style.width=b.width+'px';root.style.height=Math.max(0,b.top+b.height-top)+'px';}
  function showPreview(s){
    var p=s.preview,policy=selectedPolicy(),key=JSON.stringify([s.championship,s.proSelection,s.selected,p,policy?.kind,policy?.reason]);if(key===previewStamp)return;previewStamp=key;preview.replaceChildren();
    if(!p){preview.appendChild(text('p',policy?.kind==='blocked'?policy.reason:s.proSelection?'Select a pro to see their original skills.':s.championship?'Select a championship course to see its hole details.':'Select a save to see its course and hole details.'));return;}
    if(s.proSelection){
      var proHeading=text('div','');proHeading.className='course-heading';
      var portrait=p.art?Module.originalIndexedArt?.({art:p.art}):null;if(portrait)proHeading.appendChild(portrait);
      var identity=text('div','');identity.append(text('h2',p.name||'Selected Pro'),text('p',p.job));proHeading.appendChild(identity);preview.appendChild(proHeading);
      var skills=document.createElement('dl');for(var skill of p.skills)skills.append(text('dt',skill.name),text('dd',(skill.value>=0?'+':'')+skill.value+'%'));preview.appendChild(skills);
      preview.appendChild(text('p','Original skill bonuses. Choose this golfer to continue the championship setup.'));return;
    }
    var title=document.createElement('div');title.className='course-heading';var art=p.art?Module.originalIndexedArt?.({art:p.art,mask:p.mask}):null;if(art)title.appendChild(art);title.appendChild(text('h2',p.name||'Selected course'));preview.appendChild(title);
    preview.appendChild(text('p',(s.rows.find(r=>r.index===s.selected)?.name||'').replace(/\.(sve|cse|pro)$/i,'')));
    if(policy&&!s.championship){const message=policy.kind==='legacy'?(Module.directSavedGame==='picker'?'Choose Classic or Enhanced to make a separate playable copy.':'Unclassified legacy save — loading creates a separate '+(Module.gameEdition==='enhanced'?'Enhanced':'Classic')+' copy.'):policy.kind==='blocked'?policy.reason:policy.kind==='enhanced'&&Module.gameEdition==='classic'?'Enhanced only — restart in Enhanced Mode to load this save.':policy.kind==='classic'&&Module.gameEdition==='enhanced'?'Classic save — loading offers a separate Enhanced copy.':(policy.kind==='classic'?'Classic':'Enhanced')+' save — its own rules will be restored.';const info=text('p',message);info.className='note';info.id='mobile-load-rules';preview.appendChild(info);}
    var dl=document.createElement('dl');for(var row of [['Holes',p.holes.length],['Total par',p.par],['Total yards',p.yards],...(s.championship?[]:[['Money','$'+p.cash.toLocaleString()]]),['Fun rating',p.fun],['Length skill',p.length.toFixed(2)],['Accuracy skill',p.accuracy.toFixed(2)],['Imagination',p.imagination.toFixed(2)],['Designer',p.designer],['Theme',p.theme]]){dl.append(text('dt',row[0]),text('dd',String(row[1])));}preview.appendChild(dl);
    if(p.holes.length){var table=document.createElement('table');table.appendChild(text('caption','Course holes'));var tr=document.createElement('tr');for(var label of ['Hole','Par','Yards'])tr.appendChild(text('th',label));table.appendChild(tr);for(var h of p.holes){var tr=document.createElement('tr');for(var value of [h.hole,h.par,h.yards])tr.appendChild(text('td',String(value)));table.appendChild(tr);}preview.appendChild(table);}
  }
  function refresh(){
    const direct=Module.directSavedGame==='picker';
    state=Module.loadState||{};var visible=!!state.active&&!state.suspended&&!state.fallback;root.hidden=!visible;back.hidden=!state.active||!!state.suspended||!state.fallback;document.body.classList.toggle('mobile-load-open',visible);if(!state.active){if(serial)++ruleSerial;pending=null;serial=0;return;}
    if(serial!==state.serial){
      serial=state.serial;catalog=recentSaveNotice='';stamp=previewStamp='';pending=null;autoSelected=false;
      list.scrollTop=content.scrollTop=0;if(visible)cancel.focus({preventScroll:true});
    }
    const revision=serial+':'+(state.catalogRevision??0);
    if(catalog!==revision){
      catalog=revision;stamp=previewStamp='';ruleInfo.clear();pending=null;
      const blocked=(state.unavailableNames||[]).map(name=>({name,index:null,unavailable:'Unavailable for safe loading'}));
      rows=[...state.rows,...blocked].sort((a,b)=>(state.championship||state.proSelection?0:(b.modified||0)-(a.modified||0))||a.name.localeCompare(b.name));
      ++ruleSerial;
      if(!state.championship&&!state.proSelection)inspectRules(rows.filter(row=>!row.unavailable),ruleSerial);
    }
    if(pending&&(!(Module.loadQueue?.length))&&!state.busy&&(pending.op!==0||state.selected===pending.index||performance.now()-pending.sent>1000))pending=null;
    // The original chooser can report idle between consuming Load and
    // entering its reader. Cancel only if the reviewed selection goes away.
    const review=Module.courseLoading;
    if(review?.active&&review.reviewing&&
       (review.chooser!==state.serial||state.rows.find(r=>r.index===state.selected)?.name!==review.file))
      Module.cancelCourseLoading?.();
    if(!visible)return;
    heading.textContent=direct?'Load A Saved Game':state.proSelection?'Pick A Pro':state.championship?'Play A Championship':'Continue Saved Game';root.setAttribute('aria-label',heading.textContent);list.setAttribute('aria-label',state.proSelection?'Championship pros':state.championship?'Championship courses':'Saved games, newest first');note.textContent=state.proSelection?'Choose an installed original pro. Review their skills, then continue to the championship.':state.championship?'Choose an installed original championship course. Preview its holes, then play through the original championship setup.':direct?'Choose a saved game. Its recorded edition and settings will be restored.':'Newest files first, using actual save/modified times. Older imports may show when copied.';load.textContent=state.proSelection?'Choose Pro':state.championship?'Play Selected Course':'Load Selected Game';back.textContent=state.proSelection?'Pick A Pro':state.championship?'Championship Courses':'Mobile Saved Games';cancel.textContent=direct?'Back':'Cancel';remove.hidden=original.hidden=!!(direct||state.championship||state.proSelection);
    root.dataset.kind=state.proSelection?'pro':state.championship?'championship':'save';refreshFiles.hidden=!!(state.championship||state.proSelection);preview.setAttribute('aria-label',state.proSelection?'Selected pro skills':'Selected course preview');
    bounds();var busy=!!state.busy||!!pending;const policy=selectedPolicy();const unavailable=policy?.kind==='blocked'||(policy?.kind==='enhanced'&&Module.gameEdition==='classic');load.disabled=busy||(!state.championship&&!state.proSelection&&(!policy||unavailable))||state.selected<0||!state.preview;remove.disabled=busy||state.selected<0||!state.preview;cancel.disabled=!!pending;original.disabled=refreshFiles.disabled=busy;
    status.textContent=Module.loadCatalogError||recentSaveNotice||(busy?(state.proSelection?'Updating pro preview…':'Updating course preview…'):state.rows.length?(state.rows.length+(state.proSelection?' pro':state.championship?' championship course':' saved game')+(state.rows.length===1?'':'s')+(state.championship||state.proSelection?'':' · newest first')):state.proSelection?'No pro files found in your installed championship files.':state.championship?'No championship courses found in your installed files.':'No saved games found.');
    var key=JSON.stringify([catalog,state.selected,busy]);
    if(key!==stamp&&!pointers.size){stamp=key;var scroll=list.scrollTop;const focused=list.contains(document.activeElement)?document.activeElement.dataset.save:null;list.replaceChildren();
      for(var row of rows){let index=row.index;var b=button('',()=>send(0,index));b.dataset.save=row.name;b.setAttribute('aria-label',row.name);b.setAttribute('aria-pressed',String(row.index===state.selected));b.disabled=busy||!!row.unavailable;var label=row.name.replace(/\.(sve|cse|pro)$/i,'');if(/^&autosave/i.test(label))label=label.replace(/^&/,'');else if(/^&quitsave$/i.test(label))label='Last exit';b.appendChild(text('strong',label));var date=text('time',row.modified?'Last saved '+new Date(row.modified).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'Save time unavailable');if(row.modified)date.dateTime=new Date(row.modified).toISOString();if(!state.championship&&!state.proSelection)b.appendChild(date);const rule=ruleInfo.get(row.name),autosave=/^&autosave([123])\.sve$/i.exec(row.name);const kind=autosave?'Autosave slot '+autosave[1]+' · ':'';
      b.appendChild(text('small',state.proSelection?'Original Championship Pro':state.championship?'Original Championship Course':kind+(row.unavailable||(!rule?'Checking save edition…':rule.kind==='legacy'?'Unclassified legacy save':rule.kind==='blocked'?'Unavailable · metadata check required':rule.kind==='enhanced'?'Enhanced only':'Classic save'))));
      list.appendChild(b);if(row.name===focused&&!b.disabled)b.focus({preventScroll:true});}
      list.scrollTop=scroll;
    }
    showPreview(state);
    root.dataset.serial=String(serial);
    const target=direct&&Module.directSaveTarget;
    if(target&&!busy&&!pointers.size){
      const row=state.rows.find(item=>item.name===target.name),info=Module.loadPreviewInfo;
      if(row&&state.selected!==row.index){send(0,row.index);return;}
      if(row&&(info?.serial!==state.serial||info.name!==row.name))return;
      Module.directSaveTarget=null;autoSelected=true;
      if(row&&!load.disabled&&info.policy?.sha256===target.sha256&&info.policy?.association?.revision.id===target.revision){
        reviewSelected();return;
      }
      recentSaveNotice='The last manual save is unavailable or has changed. Choose a save to continue.';
    }
    if(!autoSelected&&!busy&&rows.length){autoSelected=true;const first=rows.find(r=>!r.unavailable);if(state.selected<0&&first)send(0,first.index);}
  }
  root.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();if(!pending)send(2,0);}});
  setInterval(refresh,100);addEventListener('resize',bounds);addEventListener('simgolf-header-resize',bounds);if(visualViewport){visualViewport.addEventListener('resize',bounds);visualViewport.addEventListener('scroll',bounds);}
})();

// Read-only matchup presentation. Starting still goes through the original
// Play a professional selector; no player, offer, skill or reward writes.
(function(){
  if(!Module.mobileMap)return;
  var shown=false,preview=false,offered=-1,introSerial=0,stamp='',pressed=new Set(),portraits=new Map(),manifest=null;
  function text(tag,value){var e=document.createElement(tag);e.textContent=value;return e;}
  function button(label,fn){var b=text('button',label);b.type='button';b.addEventListener('click',fn);return b;}
  var style=document.createElement('style');style.textContent=`
    #mobile-match[hidden]{display:none!important}#mobile-match [hidden]{display:none!important}
    body.mobile-match-open #mobile-ui,body.mobile-match-open #canvas{visibility:hidden}
    #mobile-match{position:fixed;inset:var(--match-header,22px) 0 0;z-index:64;display:flex;flex-direction:column;gap:8px;box-sizing:border-box;padding:max(8px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));background:var(--menu-bg);color:var(--menu-text);font:16px system-ui,sans-serif}
    #mobile-match h1{font-size:18px;text-align:center;margin:0}#mobile-match h2{font-size:16px;line-height:1.25;margin:5px 0 0;min-height:2.5em;overflow-wrap:anywhere;font-weight:600}#mobile-match p{margin:0;line-height:1.3}
    #mobile-match-content{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;touch-action:pan-y;padding:0 2px}
    #mobile-match-comparison{width:100%;table-layout:fixed;border-collapse:separate;border-spacing:0;font-variant-numeric:tabular-nums}#mobile-match-comparison col:first-child,#mobile-match-comparison col:last-child{width:24%}
    #mobile-match-comparison th,#mobile-match-comparison td{text-align:center;vertical-align:middle;padding:9px 4px;border-bottom:1px solid var(--menu-line);overflow-wrap:anywhere}
    #mobile-match-comparison thead th{position:sticky;top:0;z-index:1;background:var(--menu-bg);padding:6px 2px 10px;vertical-align:top}#mobile-match-comparison thead th:nth-child(2){font-size:14px;color:var(--menu-muted);vertical-align:bottom}
    #mobile-match-comparison tbody th{font-size:15px;font-weight:400;line-height:1.3}#mobile-match-comparison td{font-size:20px;font-weight:600;white-space:nowrap}
    #mobile-match .match-person{display:flex;flex-direction:column;align-items:center;min-width:0}#mobile-match .match-person p{font-size:12px;color:var(--menu-muted);margin-top:4px}#mobile-match canvas{width:72px;height:72px;max-width:100%;object-fit:contain;image-rendering:pixelated;border-radius:8px;background:var(--menu-preview)}#mobile-match .portrait-pending{display:flex;width:72px;height:72px;align-items:center;justify-content:center;font-size:12px;font-weight:400;color:var(--menu-muted)}
    #mobile-match .higher{color:var(--menu-good)}#mobile-match .lower{color:var(--menu-warning)}#mobile-match .tie,#mobile-match .uncompared{color:var(--menu-text)}
    #mobile-match footer{display:flex;gap:10px;flex:none}#mobile-match button{font:inherit;min-height:48px;padding:10px 14px;border:1px solid var(--menu-border);border-radius:7px;background:var(--menu-button);color:var(--menu-text);touch-action:manipulation}#mobile-match button:disabled{opacity:.4}#mobile-match-start{margin-left:auto;background:var(--menu-selected)!important}#mobile-match-status{font-size:13px;margin:0}
    @media(max-width:350px){#mobile-match-comparison tbody th{font-size:13px}#mobile-match-comparison td{font-size:17px}#mobile-match h2{font-size:14px}#mobile-match canvas{width:58px;height:58px}}
    @media(max-height:500px){#mobile-match{gap:5px}#mobile-match canvas,#mobile-match .portrait-pending{width:48px;height:48px}#mobile-match-comparison thead th{padding-top:0;padding-bottom:6px}#mobile-match h2{font-size:14px}#mobile-match-comparison th,#mobile-match-comparison td{padding-top:7px;padding-bottom:7px}}
  `;document.head.append(style);
  var root=document.createElement('section');root.id='mobile-match';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Match players');
  var heading=text('h1','Play a Pro'),status=text('p','');status.id='mobile-match-status';status.setAttribute('role','status');var content=document.createElement('div');content.id='mobile-match-content';
  var footer=document.createElement('footer'),back=button('Back to course',()=>{shown=false;refresh();}),start=button('Start pro match',()=>{
    var m=Module.readMatchPlayers();
    if(!m?.available||m.offer!==offered){offered=m?.offer??-1;stamp='';refresh();status.textContent='The available match changed. Review the current players before starting.';return;}
    if(Module.menuQueue.length>=16)return;
    Module.cancelMapGesture();Module.menuQueue.push([5,2]);shown=false;refresh();
  });start.id='mobile-match-start';back.id='mobile-match-back';var proceed=button('Continue to match',()=>{if(Module.proIntro)Module.keyboardInput(13,13);});proceed.id='mobile-match-continue';footer.append(back,start,proceed);root.append(heading,content,status,footer);document.body.append(root);
  for(const type of ['pointerdown','pointerup','pointermove','pointercancel','mousedown','mouseup','mousemove','click','touchstart','touchmove','touchend','wheel','keydown','keyup','keypress'])root.addEventListener(type,e=>e.stopPropagation());
  root.addEventListener('pointerdown',e=>pressed.add(e.pointerId),true);for(const type of ['pointerup','pointercancel'])addEventListener(type,e=>pressed.delete(e.pointerId),true);addEventListener('blur',()=>pressed.clear());
  function player(profile,id,label,values){
    var p=0x4d6088+profile*560;
    return {id:id,profile:profile,label:label,name:Module.readGameText(p+16,16),profession:Module.readGameText(p,16),appearance:Array.from(HEAPU8.subarray(p+32,p+48)),skills:Array.from(values)};
  }
  function embeddedHead(bytes){
    // Original golfer-file format: PCX at0x72a, three140px expressions.
    var p=0x72a;if(bytes.length<p+128+769)return null;var d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    if(bytes[p]!==10||bytes[p+2]!==1||bytes[p+3]!==8||bytes[p+65]!==1)return null;
    var w=d.getUint16(p+8,true)-d.getUint16(p+4,true)+1,h=d.getUint16(p+10,true)-d.getUint16(p+6,true)+1,stride=d.getUint16(p+66,true),pal=bytes.length-768;
    if(w!==140||h!==420||stride<w||stride>4096||bytes[pal-1]!==12)return null;
    var pixels=new Uint8ClampedArray(140*140*4),pos=p+128,total=0,limit=stride*140;
    while(total<limit){if(pos>=pal-1)return null;var code=bytes[pos++],n=(code&192)===192?code&63:1,value=code;if((code&192)===192){if(pos>=pal-1)return null;value=bytes[pos++];}if(!n||total+n>stride*h)return null;
      for(var i=0;i<n&&total<limit;i++,total++){var x=total%stride,y=Math.floor(total/stride);if(x<w){var q=(y*w+x)*4,c=pal+value*3;pixels[q]=bytes[c];pixels[q+1]=bytes[c+1];pixels[q+2]=bytes[c+2];pixels[q+3]=value===255?0:255;}}}
    var canvas=document.createElement('canvas');canvas.width=canvas.height=140;canvas.getContext('2d').putImageData(new ImageData(pixels,140,140),0,0);return canvas;
  }
  function previewPortrait(card,offer){
    var theme=Module.readGameText(0x567328,100),key='Themes/'+theme+'/'+card.name+'.glf',entry=portraits.get(key);
    if(!entry){
      var base=Array.from(HEAPU8.subarray(0x4e06e8,0x4e06e8+16)),t=0x58dd50+offer*56;
      base[1]=HEAPU8[t+32]&4?137:9;base[3]=((HEAPU8[t+32]&3)<<4)|HEAPU8[t+34];base[4]=HEAPU8[t+35];base[5]=HEAPU8[t+36];base[7]=HEAPU8[t+33];
      entry={appearance:base,ready:false,source:'original-fallback',head:null};portraits.set(key,entry);
      var file=null,canonical=null;
      try{file=FS.readFile('/game/'+key);}catch(e){}
      if(!file){
        if(!manifest){manifest=new Map();try{for(var line of FS.readFile('/game.manifest',{encoding:'utf8'}).split('\n')){var name=line.split('\t')[0];if(name)manifest.set(name.toLowerCase(),name);}}catch(e){}}
        canonical=manifest.get(key.toLowerCase());if(canonical)try{file=FS.readFile('/game/'+canonical);}catch(e){}
      }
      function finish(bytes){if(bytes?.length>=0x230){entry.appearance=Array.from(bytes.subarray(32,48));entry.head=entry.appearance[2]>=20?embeddedHead(bytes):null;entry.source='original-file';}entry.ready=true;stamp='';setTimeout(refresh,0);}
      if(file)finish(file);
      else if(canonical)fetch('game/'+canonical.split('/').map(encodeURIComponent).join('/')).then(r=>r.ok?r.arrayBuffer():null).then(b=>finish(b?new Uint8Array(b):null)).catch(()=>finish(null));
      else entry.ready=true;
    }
    card.previewKey=key;card.portraitSource=entry.source;card.appearance=entry.ready?entry.appearance:null;card.portraitReady=entry.ready;
  }
  Module.readMatchPlayers=function(){
    // The native publisher is the startup/course gate. Never inspect an
    // uninitialized heap or stale course records at the title screen.
    var s=Module.mobileState;if(!(s?.course||Module.proIntro)||!Module.mapCourseReady)return null;
    var names=Array.from({length:10},(_,i)=>Module.readGameText(HEAPU32[(0x4c2c3c>>2)+i],100)),cards=[],offer=HEAP32[0x4c2e14>>2],flags=HEAPU32[0x59e7b8>>2];
    var available=!!(flags&0x2000)&&HEAP32[0x5685f0>>2]>1&&offer>=0&&offer<100&&!s.roundActive&&!(flags&0x4200000);
    if(s.roundActive){
      var ids=[s.roundGolfer],other=HEAP16[(0x57955a+s.roundGolfer*256)>>1];if(other>=0&&other<152&&other!==s.roundGolfer&&HEAP8[0x5794d9+other*256]>0)ids.push(other);
      for(var id of ids){var profile=HEAP16[(0x57956e+id*256)>>1];if(profile<0||profile>=152)continue;cards.push(player(profile,id,id===s.roundGolfer?'You':'Opponent',HEAPU8.subarray(0x5795a8+id*256,0x5795a8+id*256+10)));}
    }else{
      cards.push(player(0,-1,'You',HEAPU8.subarray(0x5a5a04,0x5a5a04+10)));
      if(available){var p=0x58dd50+offer*56,pro={id:-1,profile:null,label:'Opponent',name:Module.readGameText(p,32),profession:Module.readGameText(0x4c593c,32),skills:Array.from(HEAPU8.subarray(p+37,p+47))};previewPortrait(pro,offer);cards.push(pro);}
    }
    return {available:available,offer:offer,round:s.roundActive,names:names,players:cards};
  };
  function portrait(card){
    if(!card?.appearance||!Module.originalIndexedArt)return null;
    var a=card.appearance,gender=a[1]&128?0:1,face=a[2],source;
    if(card.previewKey&&face>=20)source=portraits.get(card.previewKey)?.head;
    else source=Module.originalIndexedArt({art:face<20?0x59e7c0+(face+gender*20)*132:0x5628e8+(face+gender*72)*132});
    if(!source)return null;var canvas=document.createElement('canvas');canvas.width=canvas.height=140;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',card.name+' portrait');canvas.dataset.source=card.portraitSource||'loaded-profile';
    var scale=Math.min(140/source.width,140/source.height),ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(source,(140-source.width*scale)/2,(140-source.height*scale)/2,source.width*scale,source.height*scale);return canvas;
  }
  function person(card){
    var h=document.createElement('th');h.scope='col';if(!card){h.textContent='No opponent';return h;}var box=document.createElement('div');box.className='match-person';box.dataset.player=card.label;var pic=portrait(card);
    if(pic)box.append(pic);else {var pending=text('span',card.portraitReady===false?'Loading portrait…':'Portrait unavailable');pending.className='portrait-pending';box.append(pending);}
    box.append(text('h2',card.name),text('p',card.label));h.append(box);return h;
  }
  function comparison(m){
    var table=document.createElement('table');table.id='mobile-match-comparison';table.setAttribute('aria-label','Golfer skill comparison');var cols=document.createElement('colgroup');for(var i=0;i<3;i++)cols.append(document.createElement('col'));table.append(cols);
    var head=document.createElement('thead'),names=document.createElement('tr'),skill=text('th','Skill');skill.scope='col';names.append(person(m.players[0]),skill,person(m.players[1]));head.append(names);table.append(head);var body=document.createElement('tbody');
    for(var i=0;i<10;i++){var row=document.createElement('tr');row.dataset.skill=i;var label=text('th',m.names[i]);label.scope='row';var left=m.players[0]?.skills[i],right=m.players[1]?.skills[i];
      function value(n,other,card){var cell=text('td',n===undefined?'—':n*10+'%'),rank=n===undefined||other===undefined?'uncompared':n>other?'higher':n<other?'lower':'tie';cell.className=rank;cell.dataset.relation=rank;cell.setAttribute('aria-label',(card?.name||'No opponent')+' · '+m.names[i]+': '+(n===undefined?'unavailable':n*10+'%')+(rank==='tie'?' · equal':rank==='uncompared'?'':' · '+rank));return cell;}
      row.append(value(left,right,m.players[0]),label,value(right,left,m.players[1]));body.append(row);}
    table.append(body);content.append(table);
  }
  Module.openMatchPlayers=function(before){shown=true;preview=!!before;offered=Module.readMatchPlayers()?.offer??-1;stamp='';Module.cancelMapGesture();if(Module.aimMode)Module.setAimMode(false);refresh();};
  function refresh(){
    if(Module.atTitle||!Module.mobileUI)shown=false;
    var intro=Module.proIntro;if(intro&&Module.mobileUI&&intro.serial!==introSerial){introSerial=intro.serial;shown=true;preview=false;stamp='';Module.cancelMapGesture();if(Module.aimMode)Module.setAimMode(false);}
    if(!intro&&introSerial){introSerial=0;shown=false;}
    var m=shown?Module.readMatchPlayers():null,visible=shown&&!!m&&!Module.mobileState.photoActive;
    root.hidden=!visible;document.body.classList.toggle('mobile-match-open',visible);document.documentElement.style.setProperty('--match-header',(document.getElementById('build-header')?.getBoundingClientRect().bottom||22)+'px');if(!visible)return;
    heading.textContent=intro?'Play a Pro':m.round?'Match players':'Play a Pro';back.hidden=!!intro;proceed.hidden=!intro;start.hidden=!!intro||m.round||!preview;start.disabled=!m.available;
    var next=JSON.stringify([m,!!intro]);if(next===stamp||pressed.size)return;stamp=next;var scroll=content.scrollTop;content.replaceChildren();
    status.textContent=intro?'Review both golfers, then Continue to match.':m.round?'Current original-game skill ratings. Close this view to return to the same match.':m.available?'Review both golfers, then start the available professional match.':'No professional match is currently available. Continue developing the course to receive an original-game offer.';
    comparison(m);content.scrollTop=scroll;
  }
  setInterval(refresh,150);addEventListener('resize',refresh);addEventListener('simgolf-header-resize',refresh);
})();

// Full-screen mobile panels use the same visible horizontal bounds as the HUD.
(function(){
  if(!Module.mobileUI)return;
  var style=document.createElement('style');style.textContent=`
    #mobile-profile,#mobile-staff,#mobile-match{left:var(--screen-left,0px);right:auto;width:var(--screen-width,100%);bottom:var(--screen-bottom-gap,0px);padding-top:10px}
    #mobile-profile-return,#mobile-staff-return{right:calc(var(--screen-right-gap,0px) + max(8px,env(safe-area-inset-right)))}
    body.mobile-rail-visible #mobile-profile-return,body.mobile-rail-visible #mobile-staff-return,body.mobile-rail-visible #mobile-load-return{right:calc(var(--screen-right-gap,0px) + var(--mobile-rail-space))}
    #mobile-load-return{left:calc(var(--screen-left,0px) + max(8px,env(safe-area-inset-left)));bottom:calc(var(--screen-bottom-gap,0px) + max(8px,env(safe-area-inset-bottom)))}
  `;document.head.appendChild(style);
})();

// Reuse the original world's separate elements in a responsive composition.
// Its original native loop still owns offers, eligibility and payment.
(function(){
  if(!Module.mobileMap)return;
  var style=document.createElement('style');style.textContent=`
    #mobile-locations[hidden]{display:none!important}
    body.mobile-locations-open #canvas,body.mobile-locations-open #mobile-ui,body.mobile-locations-open #mobile-status,body.mobile-locations-open #mobile-open-hole,body.mobile-locations-open #local-title-actions{visibility:hidden}
    #mobile-locations{--menu-size:1;position:fixed;z-index:65;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;background:#67679b;color:#111;padding:0 env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);font:18px/1.2 OriginalWorldMenu,"Comic Neue",sans-serif}
    #mobile-location-view{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;touch-action:pan-y;background:linear-gradient(105deg,#67679b 15%,#aaaad2 65%,#e1e2f5);padding:12px;box-sizing:border-box}
    #mobile-location-scene{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;min-width:0}
    #mobile-location-header{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
    #mobile-location-heading{flex:1;min-width:min(230px,100%);max-width:420px;min-height:44px;box-sizing:border-box;display:grid;place-items:center;padding:4px 8px;text-align:center;font-size:clamp(20px,3vw,25px);line-height:1.08;margin:0;color:#171738;background:#c3c6f4;border:1px solid #46496c;border-radius:10px;box-shadow:inset 0 1px #fff8,0 1px 2px #25244466}
    #mobile-locations-funds{width:185px;max-width:100%;aspect-ratio:140/46;display:flex;align-items:center;justify-content:center;flex:none;box-sizing:border-box;padding:0 12px;border-radius:60% 44% 44% 60% / 55% 46% 46% 45%;background:linear-gradient(150deg,#b6b8e5 7%,#8586b7 33%,#65689a 57%,#4c507c);box-shadow:inset 2px 2px 3px #eeefff91,0 1px 2px #34345466;font-size:25px;white-space:nowrap}
    #mobile-locations-funds span{width:100%;box-sizing:border-box;padding:2px 4px;border:1px solid #313652;border-radius:2px;background:#fffde6;color:#14162b;text-align:center;line-height:1.05}
    #mobile-location-content{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;align-items:start;min-width:0}
    #mobile-location-world{min-width:0;display:flex;flex-direction:column;align-items:center;gap:12px}
    #mobile-location-globe{display:block;width:min(100%,290px);height:auto;touch-action:pan-y;cursor:pointer;image-rendering:auto}
    #mobile-location-legend{border:1px solid #49496f;border-radius:12px;background:#ffffee;color:#111;display:flex;flex-wrap:wrap;justify-content:center;gap:8px 14px;max-width:100%;box-sizing:border-box;padding:8px;font-size:14px}
    #mobile-location-legend span{display:flex;align-items:center;gap:4px}#mobile-location-legend canvas{width:14px;height:17px}
    #mobile-location-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 8px;min-width:0;align-items:start;justify-items:center}
    #mobile-location-list .location-card{position:relative;display:block;aspect-ratio:175/49;width:100%;max-width:295px;min-height:44px;padding:0;border:0;background:none;border-radius:0;color:#111;font:inherit;cursor:pointer;touch-action:pan-y;min-width:0;box-sizing:border-box;container-type:inline-size}
    #mobile-location-list .location-card>canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;image-rendering:auto}
    #mobile-location-list .location-card[aria-pressed=true]{filter:drop-shadow(0 0 3px #fff1a2)}#mobile-location-list .location-card:focus-visible{outline:3px solid #ffe552;outline-offset:2px}
    #mobile-location-list .location-label{position:absolute;left:30%;right:13%;top:0;height:100%;display:flex;flex-direction:column;align-items:center;overflow:hidden;pointer-events:none;text-align:center}
    #mobile-location-list strong{position:absolute;top:9%;font-size:clamp(11px,6.8cqi,20px);line-height:1;font-weight:400;white-space:nowrap;max-width:100%}
    #mobile-location-list .location-bonus{position:absolute;top:37%;font-size:clamp(9px,5.7cqi,15px);line-height:1;white-space:nowrap;max-width:100%}
    #mobile-location-list .location-details{position:absolute;top:67%;font-size:clamp(8px,5cqi,13px);line-height:1.15;white-space:nowrap;max-width:100%}
    #mobile-location-tools{flex:none;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 14px;padding:6px 10px;box-sizing:border-box;background:#67679b;border-top:1px solid #45456e}
    #mobile-location-close{order:-1;min-width:44px;min-height:44px;border:1px solid var(--menu-border);border-radius:8px;background:var(--menu-button);color:var(--menu-text);font:26px/1 system-ui;cursor:pointer}
    #mobile-location-secondary,#mobile-location-size{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    #mobile-location-tools button{font:18px/22px OriginalWorldMenu,"Comic Neue",sans-serif;min-height:44px;border:1px solid #45456e;border-radius:22px;color:#171738;background:linear-gradient(#f3f3ff,#b1b1e2);padding:7px 12px;touch-action:manipulation;cursor:pointer}
    #mobile-location-tools .location-native-action{display:flex;align-items:center;gap:4px;border:0;border-radius:0;background:none;padding:0;color:#fff;font-size:17px}
    #mobile-location-tools .location-native-action canvas{width:40px;height:40px;object-fit:contain;pointer-events:none;image-rendering:auto}
    #mobile-location-tools button:disabled{opacity:.5;cursor:default}#mobile-location-size button{min-width:44px;font-family:system-ui,sans-serif;font-size:16px}#mobile-location-scale{font:13px system-ui,sans-serif;color:#fff;min-width:38px;text-align:center}
    #mobile-location-confirm{display:flex;gap:10px;align-items:center;flex-basis:100%;min-width:0}#mobile-location-summary{font:16px/1.3 OriginalWorldMenu,"Comic Neue",sans-serif;color:#fff;margin:0;flex:1;min-width:0;max-height:64px;overflow:auto}#mobile-location-build{flex:none;background:linear-gradient(#fffaca,#e7cf52)!important}
    @media(min-width:800px) and (min-aspect-ratio:1/1){#mobile-location-content{grid-template-columns:minmax(190px,28%) minmax(0,1fr)}#mobile-location-globe{width:100%}#mobile-location-world{position:sticky;top:0}#mobile-location-legend{font-size:14px}}
    @media(max-width:550px){#mobile-location-header{gap:6px}#mobile-location-heading{min-width:0;font-size:18px;line-height:1.05}#mobile-locations-funds{width:125px;font-size:19px}#mobile-location-world{display:grid;grid-template-columns:130px minmax(0,1fr);gap:8px;align-items:center}#mobile-location-globe{width:130px}#mobile-location-legend{font-size:13px;gap:5px;padding:6px;justify-content:flex-start}#mobile-location-list{gap:8px}#mobile-location-tools{padding:5px 7px;gap:4px}#mobile-location-summary{font-size:14px}#mobile-location-tools .location-native-action{font-size:15px}#mobile-location-tools .location-native-action canvas{width:38px;height:38px}}
  `;document.head.appendChild(style);
  function text(tag,value,cls){var e=document.createElement(tag);e.textContent=value;if(cls)e.className=cls;return e;}
  function tap(element,action){var down=null,last=-Infinity;element.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')down={id:e.pointerId,x:e.clientX,y:e.clientY};});element.addEventListener('pointercancel',()=>{down=null;});element.addEventListener('pointerup',e=>{if(e.pointerType!=='touch'||!down||down.id!==e.pointerId)return;var hit=Math.hypot(e.clientX-down.x,e.clientY-down.y)<6;down=null;if(hit&&!element.disabled){last=performance.now();e.preventDefault();action(e);}});element.addEventListener('click',e=>{if(performance.now()-last<600){e.preventDefault();return;}action(e);});}
  function button(label,action,id){var b=text('button',label);b.type='button';if(id)b.id=id;tap(b,action);return b;}
  function surface(w,h){var c=document.createElement('canvas');c.width=w;c.height=h;return c;}
  var root=document.createElement('section');root.id='mobile-locations';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Choose course location');var view=document.createElement('div');view.id='mobile-location-view';var scene=document.createElement('div');scene.id='mobile-location-scene';var header=document.createElement('header');header.id='mobile-location-header';var heading=document.createElement('h1');heading.id='mobile-location-heading';heading.append(text('span','Where will you build\nyour golf course?'));heading.lastChild.style.whiteSpace='pre-line';var funds=document.createElement('div');funds.id='mobile-locations-funds';var fundsText=text('span','');funds.append(fundsText);header.append(heading,funds);
  var content=document.createElement('div');content.id='mobile-location-content';var world=document.createElement('div');world.id='mobile-location-world';var globe=surface(420,430);globe.id='mobile-location-globe';globe.setAttribute('aria-label','Original world map; select a location using a marker or the location buttons');var legend=document.createElement('div');legend.id='mobile-location-legend';world.append(globe,legend);var list=document.createElement('div');list.id='mobile-location-list';list.setAttribute('aria-label','Course locations');content.append(world,list);scene.append(header,content);view.append(scene);
  var tools=document.createElement('footer');tools.id='mobile-location-tools';var secondary=document.createElement('div');secondary.id='mobile-location-secondary';var confirm=document.createElement('div');confirm.id='mobile-location-confirm';var summary=text('p','Choose a location.');summary.id='mobile-location-summary';summary.setAttribute('role','status');var build=button('Build here',()=>{var row=state.rows?.find(r=>r.id===selected);if(row?.available)send(0,row);},'mobile-location-build');build.disabled=true;confirm.append(summary,build);tools.append(secondary,confirm);root.append(view,tools);document.body.append(root);
  var state={},serial=0,selected=null,stamp='',art=null,artFailed=false,size=1,pressed=new Set();
  // Decode only the user's imported original 8-bit PCX artwork. No game art
  // is shipped with this layer or fetched from an external service.
  function originalFile(name){
    try{return FS.readFile('/game/'+name);}catch(e){}
    var path='/game';
    for(const part of name.split('/')){var actual=FS.readdir(path).find(n=>n.toLowerCase()===part.toLowerCase());if(!actual)throw Error('Original menu asset missing: '+name);path+='/'+actual;}
    return FS.readFile(path);
  }
  function originalPCX(name,transparent=false,providedBytes=null){
    var bytes=providedBytes||originalFile('Interface/'+name+'.pcx'),d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    if(bytes.length<897||bytes[0]!==10||bytes[2]!==1||bytes[3]!==8||bytes[65]!==1||bytes[bytes.length-769]!==12)throw Error('Unsupported original menu artwork: '+name);
    var w=d.getUint16(8,true)-d.getUint16(4,true)+1,h=d.getUint16(10,true)-d.getUint16(6,true)+1,stride=d.getUint16(66,true);
    if(w<1||h<1||w>2048||h>2048||stride<w||stride>4096)throw Error('Invalid original menu artwork dimensions');
    var image=new ImageData(w,h),pos=128,total=0,limit=stride*h,pal=bytes.length-768;
    while(total<limit){if(pos>=pal-1)throw Error('Truncated original menu artwork');var code=bytes[pos++],count=(code&192)===192?code&63:1,value=code;if((code&192)===192){if(pos>=pal-1)throw Error('Truncated original menu run');value=bytes[pos++];}if(!count||total+count>limit)throw Error('Invalid original menu run');
      for(var i=0;i<count;i++,total++){var x=total%stride,y=Math.floor(total/stride);if(x<w){var q=(y*w+x)*4,c=pal+value*3;image.data[q]=bytes[c];image.data[q+1]=bytes[c+1];image.data[q+2]=bytes[c+2];image.data[q+3]=transparent&&value===255?0:255;}}}
    var canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d').putImageData(image,0,0);return canvas;
  }

  function maskedArt(name,mask){var image=originalPCX(name,true),alpha=originalPCX(mask),g=image.getContext('2d'),pixels=g.getImageData(0,0,image.width,image.height),m=alpha.getContext('2d').getImageData(0,0,alpha.width,alpha.height);if(image.width!==alpha.width||image.height!==alpha.height)throw Error('Original artwork mask mismatch');for(var i=0;i<pixels.data.length;i+=4)pixels.data[i+3]=Math.round(pixels.data[i+3]*m.data[i]/255);g.putImageData(pixels,0,0);return image;}

  function titleLogo(base,selected){
    const c=surface(640,216),g=c.getContext('2d');g.drawImage(base,80,170,640,216,0,0,640,216);g.save();g.globalCompositeOperation='destination-in';g.beginPath();g.ellipse(320,108,319,107,0,0,Math.PI*2);g.fill();g.restore();g.drawImage(selected,168,198,472,176,84,20,472,176);return c;
  }
  async function installedPCX(name){
    const bytes=Module.readInstalledArtwork?await Module.readInstalledArtwork('Interface/'+name+'.pcx'):null;
    return originalPCX(name,false,bytes);
  }
  async function sgaCrest(){
    const sheet=await installedPCX('infoscreens/SGA'),crest=surface(123,123);
    crest.getContext('2d').drawImage(sheet,58,278,123,123,0,0,123,123);
    return crest;
  }
  async function courseEmblem(id){
    // The native game crops the 80-pixel emblems and masks from these sheets.
    const parkland=id>=8, sheetName=parkland?'parklink':'tropdesert';
    const [sheet,mask]=await Promise.all([installedPCX(sheetName),installedPCX(sheetName+'_A')]);
    const logo=surface(80,80),ctx=logo.getContext('2d');
    const x=3+(id%8)*88, y=parkland?395:480+(id<4?1:0);
    const art=sheet.getContext('2d').getImageData(x,y,80,80);
    const alpha=mask.getContext('2d').getImageData(x,y,80,80);
    for(let i=0;i<art.data.length;i+=4){
      const opacity=alpha.data[i];
      if(opacity)for(let channel=0;channel<3;channel++)art.data[i+channel]*=255/opacity;
      art.data[i+3]=opacity;
    }
    ctx.putImageData(art,0,0);return logo;
  }
  Module.originalMenuArt={file:originalFile,pcx:originalPCX,masked:maskedArt,titleLogo,sgaCrest,courseEmblem};
  // Redraw the original cream and gold offer plate at twice its native scale.
  // The icon and pin are still the imported artwork composited over it.
  function locationPlate(){
    var c=surface(350,98),g=c.getContext('2d');
    g.scale(2,2);
    var outline=new Path2D('M 23 2 H 160 Q 166 2 169 8 L 173 19 Q 175 24 172 31 L 168 41 Q 166 45 161 45 H 23 Z');
    g.save();g.translate(1,1);g.fillStyle='#29274555';g.fill(outline);g.restore();
    g.save();g.clip(outline);
    var cream=g.createLinearGradient(0,1,0,30);cream.addColorStop(0,'#fffff4');cream.addColorStop(1,'#f6f2d9');g.fillStyle=cream;g.fillRect(22,1,154,30);
    var gold=g.createLinearGradient(0,29,0,46);gold.addColorStop(0,'#dcc49c');gold.addColorStop(1,'#c9ac81');g.fillStyle=gold;g.fillRect(22,29,154,18);
    g.strokeStyle='#49435f';g.lineWidth=.85;g.beginPath();g.moveTo(23,29);g.lineTo(174,29);g.stroke();
    g.restore();g.strokeStyle='#49435f';g.lineWidth=1;g.stroke(outline);
    return c;
  }
  function loadArt(){
    if(art||artFailed)return;
    try{art={base:originalPCX('WorldBase'),buttons:originalPCX('WorldButton',true),pins:maskedArt('TacksandArrow','TacksandArrow_A'),icons:['ChooseParklandButtons','ChooseDesertButtons','ChooseTropicalButtons','ChooseLinksButtons'].map(n=>maskedArt(n,'ChooseAlphaButtons_A'))};Module.locationArtwork={ready:true,source:'user-imported-originals',layout:'responsive-clean-original-elements',font:'loading'};var face=new FontFace('OriginalWorldMenu',originalFile('manu3_.TTF'));face.load().then(f=>{document.fonts.add(f);Module.locationArtwork.font='original-ttf';stamp='';}).catch(()=>{Module.locationArtwork.font='fallback';});art.plate=locationPlate();
      for(const [label,y]of [['Available',50],['Insufficient funds',0],['Already purchased',100]]){var c=surface(20,24);c.getContext('2d').drawImage(art.pins,0,y,20,24,0,0,20,24);var item=text('span',label);item.prepend(c);legend.append(item);}
    }catch(e){artFailed=true;Module.locationArtwork={ready:false,error:String(e)};}
  }
  function busy(){return !!(state.busy||Module.locationQueue?.length||!state.frame);}
  function send(op,row){
    if(!state.active||state.suspended||busy())return;
    const target=op===0?'course':op===1?(state.newGame?'title':'course'):op===4?'saves':null;
    if(target)Module.beginMobileScreenTransition?.(target,'locations',state.serial);
    Module.cancelMapGesture();
    (Module.locationQueue||(Module.locationQueue=[])).push([state.serial,op,row?.id??-1,row?.index??-1,row?.price??-1]);
    if(op===2)selected=null;
    stamp='';refresh();
  }
  function money(value){return '$'+value.toLocaleString();}
  function bounds(){var b=Module.getScreenBounds(),top=Math.max(b.top,document.getElementById('build-header').getBoundingClientRect().bottom);root.style.left=b.left+'px';root.style.top=top+'px';root.style.width=b.width+'px';root.style.height=Math.max(0,b.top+b.height-top)+'px';Module.locationPresentation={scale:size,fit:1,layout:'responsive-clean-original-elements',width:view.clientWidth,height:view.clientHeight};}
  function drawGlobe(){var g=globe.getContext('2d');g.clearRect(0,0,420,430);g.save();g.beginPath();g.ellipse(210,215,210,215,0,0,Math.PI*2);g.clip();g.drawImage(art.base,0,108,420,430,0,0,420,430);for(const row of state.rows||[]){var y=row.purchased?100:row.available?50:0,x=HEAP16[(0x4c1eca+row.id*130)>>1],gy=HEAP16[(0x4c1ecc+row.id*130)>>1]-108;g.drawImage(art.pins,0,y,20,24,x-10,gy-14,20,24);if(row.id===selected){g.strokeStyle='#ffe654';g.lineWidth=2;g.beginPath();g.arc(x,gy-4,13,0,Math.PI*2);g.stroke();}}g.restore();}
  tap(globe,e=>{if(busy())return;var r=globe.getBoundingClientRect(),x=(e.clientX-r.x)*420/r.width,y=(e.clientY-r.y)*430/r.height+108,near=null,distance=18;for(const row of state.rows||[]){var d=Math.hypot(x-HEAP16[(0x4c1eca+row.id*130)>>1],y-HEAP16[(0x4c1ecc+row.id*130)>>1]);if(d<distance){near=row;distance=d;}}if(near){selected=near.id;stamp='';refresh();}});
  function refresh(){
    state=Module.locationState||{};if(state.active&&state.frame>0)loadArt();var showing=!!(Module.mobileUI&&state.active&&!state.suspended&&art&&!state.fallback);root.hidden=!showing;document.body.classList.toggle('mobile-locations-open',showing);if(state.active&&artFailed&&!state.fallback&&!busy())(Module.locationQueue||(Module.locationQueue=[])).push([state.serial,5,-1,-1,-1]);if(!showing){stamp='';return;}bounds();if(state.serial!==serial){serial=state.serial;selected=null;view.scrollTop=0;stamp='';}
    var key=JSON.stringify([state.rows,state.cash,state.unlimited,state.newGame,state.busy,!!state.frame,Module.locationQueue?.length,selected]);if(key===stamp||pressed.size)return;stamp=key;var scroll=view.scrollTop;list.replaceChildren();secondary.replaceChildren();fundsText.textContent=state.unlimited?'Unlimited':money(state.cash||0);drawGlobe();var unavailable=busy();
    for(const row of state.rows||[]){var card=button('',()=>{if(busy())return;selected=row.id;stamp='';refresh();});card.className='location-card';card.dataset.location=String(row.id);card.setAttribute('aria-pressed',String(row.id===selected));card.setAttribute('aria-label',[row.name,row.bonus,row.acres+' acres',money(row.price),row.purchased?'Already purchased':row.available?'Available':'Insufficient funds'].join(', '));card.disabled=unavailable;var c=surface(350,98),g=c.getContext('2d');g.scale(2,2);g.imageSmoothingQuality='high';g.drawImage(art.plate,0,0,175,49);g.save();g.beginPath();g.ellipse(25,24.5,25,24.5,0,0,Math.PI*2);g.clip();g.drawImage(art.icons[row.environment]||art.icons[0],2+(row.available?200:0),0,59,49,0,0,59,49);g.restore();g.drawImage(art.pins,0,row.purchased?100:row.available?50:0,20,24,155,6,20,24);if(row.id===selected){g.strokeStyle='#f7d345';g.lineWidth=2;g.beginPath();g.roundRect(1,1,173,46,12);g.stroke();}var label=document.createElement('span');label.className='location-label';label.append(text('strong',row.name),text('span',row.bonus,'location-bonus'),text('span',row.acres+' ac · '+money(row.price),'location-details'));card.append(c,label);list.append(card);}
    function control(label,op,id,source,x,y,w,h){var b=button('',()=>send(op),id);b.className='location-native-action';b.setAttribute('aria-label',label);var c=surface(w,h);c.getContext('2d').drawImage(source,x,y,w,h,0,0,w,h);b.append(c,text('span',label));b.disabled=unavailable;secondary.append(b);}
    control('Back',1,'mobile-location-back',art.base,730,522,70,75);if(state.newGame)control('Refresh offers',2,'mobile-location-refresh',art.buttons,250,440,76,74);else{const close=button('×',()=>send(1),'mobile-location-close');close.setAttribute('aria-label','Close World Map');close.disabled=unavailable;secondary.append(close);control('Save game',3,'mobile-location-save',art.buttons,548,458,52,64);control('Load game',4,'mobile-location-load',art.buttons,570,408,56,50);}
    var row=state.rows?.find(r=>r.id===selected);build.disabled=unavailable||!row?.available;summary.textContent=state.busy?'Opening location…':row?(row.name+' · '+row.acres+' acres · '+money(row.price)+' · '+(row.purchased?'Already purchased':row.available?row.bonus:'Insufficient funds')):'Choose a location. Browsing does not spend money.';view.scrollTop=scroll;bounds();root.dataset.serial=String(serial);
  }
  root.addEventListener('keydown',e=>{if(e.key==='Escape'&&!state.newGame){e.preventDefault();send(1);}});
  root.addEventListener('pointerdown',e=>pressed.add(e.pointerId),true);['pointerup','pointercancel'].forEach(t=>addEventListener(t,e=>pressed.delete(e.pointerId),true));addEventListener('blur',()=>pressed.clear());
  ['mousedown','mousemove','mouseup','click','pointerdown','pointermove','pointerup','pointercancel','touchstart','touchmove','touchend','touchcancel','wheel','keydown','keyup','keypress'].forEach(t=>root.addEventListener(t,e=>e.stopPropagation()));
  setInterval(refresh,100);addEventListener('resize',refresh);addEventListener('simgolf-screen-resize',refresh);addEventListener('simgolf-header-resize',refresh);
})();

// Original golfer score/feelings card: live native artwork, fitted independently
// of map magnification/overscan. Input returns through the native event pump.
(function(){
  const root=document.createElement('section');root.id='mobile-golfer-card';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Golfer information');
  const style=document.createElement('style');style.textContent=`
    #mobile-golfer-card[hidden]{display:none!important}
    #mobile-golfer-card{position:fixed;inset:var(--golfer-card-header,22px) 0 0;z-index:94;box-sizing:border-box;padding:8px max(8px,env(safe-area-inset-right)) calc(56px + env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left));display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:var(--golfer-card-scrim);overflow:auto;overscroll-behavior:contain;color:var(--menu-text);font:16px system-ui,sans-serif}
    #mobile-golfer-card canvas{display:block;max-width:100%;flex:none;touch-action:none;image-rendering:auto}
    #mobile-golfer-card .golfer-card-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:7px;max-width:520px;flex:none}
    #mobile-golfer-card button{font:inherit;min-width:62px;min-height:44px;padding:7px 11px;border:1px solid var(--menu-border);border-radius:7px;background:var(--menu-button);color:var(--menu-text);touch-action:manipulation}
    body:is(.mobile-golfer-card-open,.golfer-histories-open) :is(#mobile-ui,#mobile-mode-rail,#mobile-open-hole){visibility:hidden!important;pointer-events:none!important}
    body:is(.mobile-golfer-card-open,.golfer-histories-open) #mobile-cancel{z-index:115;bottom:calc(var(--mobile-bottom-offset,0px) + max(8px,env(safe-area-inset-bottom)))}
    body.golfer-histories-open #mobile-golfer-card{visibility:hidden}
  `;document.head.appendChild(style);
  const card=document.createElement('canvas');card.width=468;card.height=332;card.setAttribute('role','img');card.setAttribute('aria-label','Original golfer portrait, scorecard and feelings');root.appendChild(card);
  const actions=document.createElement('div');actions.className='golfer-card-actions';root.append(actions);document.body.appendChild(root);
  function cardButton(id,label,action){
    const b=document.createElement('button');b.type='button';b.id=id;b.textContent=label;b.onclick=action;actions.append(b);return b;
  }
  const details=cardButton('mobile-golfer-details','Player Details',()=>cardAction(318,294));
  const photo=cardButton('mobile-golfer-photo','Take Picture',()=>{
    const s=Module.golferCard;
    if(s?.active&&!s.busy&&!root.hidden&&!Module.golferCardQueue.length)Module.golferCardQueue.push([s.serial,-2,s.profile]);
  });
  const remove=cardButton('mobile-golfer-remove','Ask To Leave',askToLeave);
  const history=cardButton('mobile-golfer-history','Profiles & Histories',()=>{
    const actor = Module.golferCard?.actor;
    if (Module.hasGameFeature('golferHistories')) Module.openGolferHistories?.(actor);
    else Module.openGolferExperiences?.(actor);
  });
  history.hidden=true;
  const done=cardButton('mobile-golfer-card-done','Done',()=>cardAction(595,545));
  function cardAction(normal,expanded){
    const s=Module.golferCard;if(s)send(s.expanded?expanded:normal,s.expanded?287:262);
  }
  async function askToLeave(){
    const s=Module.golferCard;
    if(!s?.active||!s.canRemove||s.busy||root.inert||Module.golferCardQueue.length)return;
    root.inert=true;
    try{
      const name=Module.readGameText(0x4d6098+s.profile*560,16).trim();
      const accepted=Module.confirmGolferRemoval?await Module.confirmGolferRemoval(name):window.confirm('Ask '+name+' to leave the course?');
      const current=Module.golferCard;
      if(accepted&&current?.active&&current.serial===s.serial&&current.profile===s.profile&&current.canRemove&&!Module.golferCardQueue.length)
        Module.golferCardQueue.push([s.serial,-1,s.profile]);
    }finally{root.inert=false;}
  }
  Module.golferCardQueue=[];const ctx=card.getContext('2d');const pixels=ctx.createImageData(card.width,card.height);let serial=0,press=null;
  function send(x,y){const s=Module.golferCard;if(root.hidden||!s?.active||s.busy||Module.golferCardQueue.length)return;Module.golferCardQueue.push([s.serial,Math.round(x),Math.round(y)]);}
  for(const type of ['pointerdown','pointerup','pointermove','pointercancel','mousedown','mouseup','mousemove','click','dblclick','touchstart','touchmove','touchend','wheel','keydown','keyup'])root.addEventListener(type,e=>e.stopPropagation());
  card.addEventListener('pointerdown',e=>{e.preventDefault();if(press){press=null;return;}press={id:e.pointerId,x:e.clientX,y:e.clientY,serial:Module.golferCard?.serial};card.setPointerCapture(e.pointerId);});
  card.addEventListener('pointermove',e=>{if(press&&Math.hypot(e.clientX-press.x,e.clientY-press.y)>=8)press=null;});
  card.addEventListener('pointercancel',()=>{press=null;});
  card.addEventListener('pointerup',e=>{e.preventDefault();const p=press;press=null;const s=Module.golferCard;if(!p||p.id!==e.pointerId||p.serial!==s?.serial||Math.hypot(e.clientX-p.x,e.clientY-p.y)>=8)return;const r=card.getBoundingClientRect();const x=s.left+(e.clientX-r.left)*s.width/r.width,y=s.top+(e.clientY-r.top)*s.height/r.height;if(Math.hypot(x-(s.expanded?424:448),y-(s.expanded?287:262))<25)photo.click();else if(!s.expanded&&Math.hypot(x-383,y-262)<25)askToLeave();else send(x,y);});
  Module.drawGolferCard=function(address,stride,s,backdrop){
    const heap=new Uint16Array(Module.HEAPU8.buffer),data=pixels.data;
    const map=backdrop>>1;
    let i=0;
    for(let y=0;y<s.height;y++){
      let p=(address>>1)+(s.top+y)*stride+s.left;
      for(let x=0;x<s.width;x++,i++,p++){
        const c=heap[p], k=i*4;
        // Preserve the native art and show the live course through its outline.
        const painted=c!==heap[map+i];
        const inside=!painted&&x>0&&x+1<s.width&&heap[p-1]!==heap[map+i-1]&&heap[p+1]!==heap[map+i+1];
        data[k]=((c>>10)&31)*255/31;
        data[k+1]=((c>>5)&31)*255/31;
        data[k+2]=(c&31)*255/31;
        data[k+3]=painted||inside?255:0;
      }
    }
    ctx.putImageData(pixels,0,0);
  };
  function refresh(){
    const s=Module.golferCard,visible=!!(Module.mobileUI&&s?.active&&Module.mobileState?.course&&!Module.mobileState.photoActive&&!Module.profileState?.active&&!Module.loadState?.active&&!Module.staffHire);
    root.hidden=!visible;document.body.classList.toggle('mobile-golfer-card-open',visible);if(!visible){press=null;return;}
    if(serial!==s.serial){serial=s.serial;press=null;Module.cancelMapGesture();if(Module.aimMode)Module.setAimMode(false);}
    const top=document.getElementById('build-header')?.getBoundingClientRect().bottom||22;document.documentElement.style.setProperty('--golfer-card-header',top+'px');
    const histories = Module.hasGameFeature('golferHistories');
    const experiences = Module.hasGameFeature('golferExperiences');
    history.hidden = !(histories || experiences) || !Module.golferHistoryEligible?.(s.actor);
    history.textContent = histories ? 'Profiles & Histories' : 'Experiences';
    const css = getComputedStyle(root);
    const reserved = actions.getBoundingClientRect().height + parseFloat(css.gap);
    const width = root.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
    const height = root.clientHeight - parseFloat(css.paddingTop) - parseFloat(css.paddingBottom) - reserved;
    const scale = Math.min(2, width / s.width, Math.max(1, height) / s.height);
    card.style.width = s.width * scale + 'px';
    card.style.height = s.height * scale + 'px';
    done.disabled = history.disabled = details.disabled = photo.disabled = !!s.busy;
    remove.disabled=!!s.busy||!s.canRemove;
  }
  setInterval(refresh,50);
})();

// The original next-pair screen, including its own selected portraits. Keep
// its artwork and native selection/dispatch logic; make released touch reliable.
(function(){
  const root=document.createElement('section');root.id='mobile-golfer-pairs';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Select the next pair of golfers');
  const style=document.createElement('style');style.textContent=`body.mobile-golfer-pairs-open #canvas{visibility:hidden}#mobile-golfer-pairs[hidden]{display:none!important}#mobile-golfer-pairs{position:fixed;inset:var(--pairs-header,22px) 0 0;z-index:67;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;box-sizing:border-box;background:var(--menu-bg);padding:8px max(8px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left));overflow:auto;overscroll-behavior:contain}#mobile-golfer-pairs canvas{display:block;max-width:100%;touch-action:none;flex:none}#mobile-golfer-pairs footer{display:flex;gap:10px}#mobile-golfer-pairs button{font:16px system-ui,sans-serif;color:var(--menu-text);min-height:48px;padding:10px 16px;border:1px solid var(--menu-border);border-radius:7px;background:var(--menu-button);touch-action:manipulation}`;document.head.appendChild(style);
  const canvas=document.createElement('canvas');canvas.width=800;canvas.height=600;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Original clubhouse golfer selection');root.appendChild(canvas);const footer=document.createElement('footer');root.appendChild(footer);const play=document.createElement('button');play.textContent='Done';play.setAttribute('aria-label','Confirm golfer selection');play.onclick=()=>send(740,560);footer.append(play);document.body.appendChild(root);
  Module.golferPairsQueue=[];const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(800,600);let press=null,serial=0;
  function send(x,y){const s=Module.golferPairs;if(!s?.active||s.busy||Module.golferPairsQueue.length)return;Module.golferPairsQueue.push([s.serial,Math.round(x),Math.round(y)]);}
  for(const type of ['pointerdown','pointerup','pointermove','pointercancel','mousedown','mouseup','mousemove','click','touchstart','touchmove','touchend','wheel','keydown','keyup'])root.addEventListener(type,e=>e.stopPropagation());
  canvas.addEventListener('pointerdown',e=>{e.preventDefault();if(press){press=null;return;}press={id:e.pointerId,x:e.clientX,y:e.clientY,serial:Module.golferPairs?.serial};canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(press&&Math.hypot(e.clientX-press.x,e.clientY-press.y)>=8)press=null;});canvas.addEventListener('pointercancel',()=>{press=null;});canvas.addEventListener('pointerup',e=>{e.preventDefault();const p=press;press=null;if(!p||p.id!==e.pointerId||p.serial!==Module.golferPairs?.serial||Math.hypot(e.clientX-p.x,e.clientY-p.y)>=8)return;const r=canvas.getBoundingClientRect();send((e.clientX-r.x)*800/r.width,(e.clientY-r.y)*600/r.height);});
  Module.drawGolferPairs=function(address,stride){let k=0;const h=new Uint16Array(Module.HEAPU8.buffer);for(let y=0;y<600;y++){let p=(address>>1)+y*stride;for(let x=0;x<800;x++){const c=h[p++];pixels.data[k++]=((c>>10)&31)*255/31;pixels.data[k++]=((c>>5)&31)*255/31;pixels.data[k++]=(c&31)*255/31;pixels.data[k++]=255;}}ctx.putImageData(pixels,0,0);};
  setInterval(()=>{const s=Module.golferPairs;root.hidden=!(Module.mobileUI&&s?.active&&!s.enhanced);document.body.classList.toggle('mobile-golfer-pairs-open',!root.hidden);if(root.hidden){press=null;return;}if(serial!==s.serial){serial=s.serial;Module.cancelMapGesture();}const top=document.getElementById('build-header')?.getBoundingClientRect().bottom||22;document.documentElement.style.setProperty('--pairs-header',top+'px');const css=getComputedStyle(root),w=root.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight),h=root.clientHeight-parseFloat(css.paddingTop)-parseFloat(css.paddingBottom)-60,scale=Math.min(2,w/800,Math.max(1,h)/600);canvas.style.width=800*scale+'px';canvas.style.height=600*scale+'px';play.disabled=!!s.busy;},50);
})();

// Read-only golfer/clubhouse state for phone reports. No diagnostic writes to
// actors, pairing, readiness, time, money or saved-course records.
Module.getGolferDiagnostics=function(){
  if(!Module.HEAPU8||Module.HEAPU8.length<0x5a5a28)return null;
  const h=new DataView(Module.HEAPU8.buffer),actors=[];
  for(let id=0;id<152;id++){
    const p=0x5794b8+id*256,hole=h.getInt8(p+33),profile=h.getInt16(p+182,true),flags=h.getUint32(p+16,true);
    if(!hole&&!flags)continue;
    actors.push({id,name:profile>=0&&profile<512?Module.readGameText(0x4d6098+profile*560,32):'',profile,hole,stroke:h.getInt8(p+34),flags,partner:h.getInt16(p+162,true),screen:[h.getInt32(p+8,true),h.getInt32(p+12,true)],world:[h.getInt32(p,true),h.getInt32(p+4,true)]});
  }
  return {selected:h.getInt32(0x53df54,true)-1,builderHole:h.getInt32(0x5685f0,true),roundGolfer:h.getInt32(0x5a59f8,true),waiting:actors.filter(g=>g.hole===-1).map(g=>g.id),actors,card:Module.golferCard||null,pairChooser:Module.golferPairs||null};
};

// Clean scalable title artwork. Ovals and conventional option icons are drawn
// here; the brand's actual letter contours are read from local imported art.
(function(){
  const ns='http://www.w3.org/2000/svg';
  function svg(markup){const e=document.createElementNS(ns,'svg');e.setAttribute('viewBox','0 0 440 150');e.setAttribute('aria-hidden','true');e.setAttribute('focusable','false');e.innerHTML=markup;return e;}
  function defs(id){return `<defs>
    <linearGradient id="${id}-rim" x2=".2" y2="1"><stop stop-color="#d3d4f2"/><stop offset=".28" stop-color="#9293bf"/><stop offset=".65" stop-color="#65658e"/><stop offset="1" stop-color="#464468"/></linearGradient>
    <linearGradient id="${id}-base" x2=".1" y2="1"><stop stop-color="#77769f"/><stop offset="1" stop-color="#393555"/></linearGradient>
    <radialGradient id="${id}-cream" cx=".42" cy=".27" r=".85"><stop stop-color="#fffff5"/><stop offset=".7" stop-color="#faf9e8"/><stop offset="1" stop-color="#e5e3bd"/></radialGradient>
    <radialGradient id="${id}-gold" cx=".4" cy=".25" r=".85"><stop stop-color="#fff27d"/><stop offset=".6" stop-color="#ffdf21"/><stop offset="1" stop-color="#e7bb05"/></radialGradient>
    <radialGradient id="${id}-badge" cx=".32" cy=".25" r=".85"><stop stop-color="#f1fbff"/><stop offset=".35" stop-color="#d0eafa"/><stop offset=".72" stop-color="#9baee4"/><stop offset="1" stop-color="#5f659e"/></radialGradient>
    <filter id="${id}-shadow" x="-20%" y="-30%" width="140%" height="170%"><feDropShadow dx="1" dy="3" stdDeviation="2.1" flood-color="#24213f" flood-opacity=".35"/></filter>
  </defs>`;}
  const ink='#202652';
  function icon(item){
    if(item===0)return `<path d="M12 25h15l6-6h19v26H12z"/><path d="M8 30h48l-8 19H8z" stroke="#b7cbef" stroke-width="1.3"/><path d="M19 19C25 9 36 8 45 12V6l12 11-14 8 1-7c-10-4-18-3-25 1z"/>`;
    if(item===1){let dots='';for(const [x,y]of [[25,7],[33,6],[40,10],[18,13],[27,14],[36,15],[45,17],[17,22],[25,23],[34,24],[43,26],[21,31],[31,32],[38,33],[30,40]])dots+=`<circle cx="${x}" cy="${y}" r="1.7" fill="#d6e8f7"/>`;return `<circle cx="31" cy="22" r="19"/>${dots}<path d="m20 43 8 4-2 8h12l-3-8 7-4-12 2zM18 57c-1-6-3-9-6-12 6 1 8 5 10 9-1-8-1-11-4-15 7 2 10 8 10 15h8c2-7 6-11 12-13-3 5-5 8-5 13 3-4 5-5 9-6-4 4-6 7-6 10z"/>`;}
    if(item===4)return `<path d="M8 38h23l-4 16H12z"/><path d="M11 38v-6a8 8 0 0 1 16 0v6" fill="none" stroke="${ink}" stroke-width="3"/><path d="m34 8 17 30" fill="none" stroke="${ink}" stroke-width="4"/><path d="m27 7 11-4 5 11-10 5z" fill="none" stroke="${ink}" stroke-width="3"/><path d="M30 52c-1-7 0-13 8-14 4-10 14-8 16 0 6 1 8 7 7 14zM7 55h52v3H7z"/>`;
    if(item===2)return `<g fill="#d5e5f5" stroke="${ink}" stroke-width="3.8" stroke-linejoin="round"><rect x="9" y="8" width="19" height="19" rx="1"/><rect x="22" y="21" width="19" height="19" rx="1"/><rect x="35" y="34" width="19" height="19" rx="1"/></g>`;
    return `<path d="M19 18h26c1 13-4 21-13 24-9-3-14-11-13-24zM29 40h6v10h-6zM24 49h16l5 7H19zM17 57h30v3H17zM27 12l5-8 5 8-5 4z"/><path d="M19 22H10c0 11 4 16 14 16m21-16h9c0 11-4 16-14 16" fill="none" stroke="${ink}" stroke-width="4"/>`;
  }
  function button(item,selected){const id='sg-title-'+item+'-'+(selected?'selected':'normal');return svg(`${defs(id)}
    <ellipse cx="215" cy="94" rx="202" ry="48" fill="#2c2643" opacity=".17"/>
    <ellipse cx="211" cy="88" rx="201" ry="49" fill="url(#${id}-base)" filter="url(#${id}-shadow)"/>
    <ellipse cx="207" cy="77" rx="199" ry="50" fill="url(#${id}-rim)" stroke="#9c9bc4" stroke-width="1.2"/>
    <ellipse cx="207" cy="77" rx="174" ry="39" fill="url(#${id}-${selected?'gold':'cream'})" stroke="#777349" stroke-opacity=".32" stroke-width="1.2"/>
    <path d="M18 66C42 36 173 27 270 38" fill="none" stroke="#eeeeff" stroke-width="2.2" opacity=".55"/>
    <circle cx="365" cy="47" r="40" fill="url(#${id}-${selected?'gold':'badge'})" stroke="#343359" stroke-width="2.2" filter="url(#${id}-shadow)"/>
    <path d="M335 30a34 34 0 0 1 42-13" fill="none" stroke="#fff" stroke-width="2" opacity=".65"/>
    <g transform="translate(334 15)" fill="${ink}">${icon(item)}</g>`);}
  // Trace bounded local pixel-color regions, simplify their stair-step edges,
  // and render rounded vector contours. No imported logo paths are shipped.
  function simplify(points,epsilon){if(points.length<5)return points;const keep=new Uint8Array(points.length),stack=[[0,points.length-1]];keep[0]=keep[points.length-1]=1;while(stack.length){const [a,b]=stack.pop(),p=points[a],q=points[b],dx=q[0]-p[0],dy=q[1]-p[1],length=dx*dx+dy*dy;let best=epsilon*epsilon,index=-1;for(let i=a+1;i<b;i++){const v=points[i],t=length?Math.max(0,Math.min(1,((v[0]-p[0])*dx+(v[1]-p[1])*dy)/length)):0,d=(v[0]-p[0]-t*dx)**2+(v[1]-p[1]-t*dy)**2;if(d>best){best=d;index=i;}}if(index>=0){keep[index]=1;stack.push([a,index],[index,b]);}}return points.filter((_,i)=>keep[i]);}
  function pathFor(points){let area=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];area+=a[0]*b[1]-b[0]*a[1];}if(Math.abs(area)<3)return '';
    let far=1,distance=0;for(let i=1;i<points.length;i++){const d=(points[i][0]-points[0][0])**2+(points[i][1]-points[0][1])**2;if(d>distance){distance=d;far=i;}}
    points=simplify(points.slice(0,far+1),.65).slice(0,-1).concat(simplify(points.slice(far).concat([points[0]]),.65).slice(0,-1));if(points.length<3)return '';
    const fmt=p=>p.map(v=>Math.round(v*100)/100).join(' ');let path='';
    for(let i=0;i<points.length;i++){const a=points[(i+points.length-1)%points.length],p=points[i],b=points[(i+1)%points.length],da=Math.hypot(a[0]-p[0],a[1]-p[1]),db=Math.hypot(b[0]-p[0],b[1]-p[1]),ra=Math.min(.22,.65/(da||1)),rb=Math.min(.22,.65/(db||1)),before=[p[0]+(a[0]-p[0])*ra,p[1]+(a[1]-p[1])*ra],after=[p[0]+(b[0]-p[0])*rb,p[1]+(b[1]-p[1])*rb];path+=(i?'L':'M')+fmt(before)+'Q'+fmt(p)+' '+fmt(after);}
    return path+'Z';
  }
  function contours(labels,w,h,color){const stride=w+1,edges=[],from=new Map(),add=(x,y,xx,yy,d)=>{const a=y*stride+x,b=yy*stride+xx,index=edges.length;edges.push({a,b,d,used:false});if(!from.has(a))from.set(a,[]);from.get(a).push(index);};
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(labels[i]!==color)continue;if(!y||labels[i-w]!==color)add(x,y,x+1,y,0);if(x===w-1||labels[i+1]!==color)add(x+1,y,x+1,y+1,1);if(y===h-1||labels[i+w]!==color)add(x+1,y+1,x,y+1,2);if(!x||labels[i-1]!==color)add(x,y+1,x,y,3);}
    let path='',loops=0;for(let i=0;i<edges.length;i++){if(edges[i].used)continue;let edge=edges[i],start=edge.a,points=[];for(let n=0;n<=edges.length;n++){if(edge.used)break;edge.used=true;points.push([edge.a%stride,Math.floor(edge.a/stride)]);if(edge.b===start)break;const choices=(from.get(edge.b)||[]).map(k=>edges[k]).filter(e=>!e.used);if(!choices.length)break;const rank=d=>({1:0,0:1,3:2,2:3})[d];choices.sort((a,b)=>rank((a.d-edge.d+4)%4)-rank((b.d-edge.d+4)%4));edge=choices[0];}const d=pathFor(points);if(d){path+=d;loops++;}}
    return {path,loops};
  }
  function logo(selected){const w=472,h=176,c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(selected,168,198,w,h,0,0,w,h);const pixels=c.getContext('2d').getImageData(0,0,w,h).data,n=w*h,ink=new Uint8Array(n),outside=new Uint8Array(n),queue=new Int32Array(n);let head=0,tail=0;
    for(let i=0;i<n;i++){const p=i*4,r=pixels[p],g=pixels[p+1],b=pixels[p+2];ink[i]=pixels[p+3]&&((g>r+18&&g>b+14)||(g<110&&g>r+6&&g>b+5))?1:0;}
    const push=i=>{if(!ink[i]&&!outside[i]){outside[i]=1;queue[tail++]=i;}};for(let x=0;x<w;x++){push(x);push((h-1)*w+x);}for(let y=0;y<h;y++){push(y*w);push(y*w+w-1);}while(head<tail){const i=queue[head++],x=i%w,y=Math.floor(i/w);if(x)push(i-1);if(x<w-1)push(i+1);if(y)push(i-w);if(y<h-1)push(i+w);}
    // A solid silhouette underneath the lettering prevents the original
    // bitmap's dither from becoming cracks between adjacent vector colors.
    const solid=new Uint8Array(n),white=new Uint8Array(n);solid.fill(255);white.fill(255);let retained=0;
    for(let i=0;i<n;i++){const x=i%w,y=Math.floor(i/w);if(!pixels[i*4+3]||(!ink[i]&&(outside[i]||(x>=235&&y>=35))))continue;solid[i]=0;retained++;if((x<225||y<35)&&pixels[i*4]>165&&pixels[i*4+1]>175&&pixels[i*4+2]>150)white[i]=0;}
    // Close only subpixel-sized gaps in the silhouette, preserving counters
    // and the actual original letter spacing instead of retyping the brand.
    const expanded=new Uint8Array(n),closed=new Uint8Array(n);closed.fill(255);
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){let hit=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(solid[(y+dy)*w+x+dx]===0)hit=1;expanded[y*w+x]=hit;}
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){let hit=1;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(!expanded[(y+dy)*w+x+dx])hit=0;if(hit||solid[y*w+x]===0)closed[y*w+x]=0;}
    const outline=contours(closed,w,h,0),letters=contours(white,w,h,0),loops=outline.loops+letters.loops;
    if(retained<10000||loops<10)throw Error('Original wordmark contours unavailable');
    const e=svg(`<defs><radialGradient id="sg-title-logo-paper" cx=".45" cy=".25" r=".9"><stop stop-color="#fffff5"/><stop offset="1" stop-color="#f3f2db"/></radialGradient><linearGradient id="sg-title-logo-green" x2=".2" y2="1"><stop stop-color="#238b45"/><stop offset=".45" stop-color="#00813c"/><stop offset="1" stop-color="#00542e"/></linearGradient><linearGradient id="sg-title-logo-white" x2=".1" y2="1"><stop stop-color="#fffffa"/><stop offset="1" stop-color="#e0ebdd"/></linearGradient><filter id="sg-title-logo-shadow" x="-10%" y="-20%" width="120%" height="150%"><feDropShadow dx="0" dy="3" stdDeviation="2" flood-color="#282140" flood-opacity=".3"/></filter></defs><ellipse cx="320" cy="105" rx="314" ry="98" fill="url(#sg-title-logo-paper)" stroke="#555078" stroke-width="1.8" filter="url(#sg-title-logo-shadow)"/><g transform="translate(84 20)" fill-rule="evenodd"><path d="${outline.path}" transform="translate(1.2 1.8)" fill="#264c36" opacity=".3"/><path d="${outline.path}" fill="url(#sg-title-logo-green)" stroke="#14552f" stroke-width=".6"/><path d="${letters.path}" fill="url(#sg-title-logo-white)" stroke="#075b30" stroke-width=".6" paint-order="stroke fill"/></g>`);e.setAttribute('viewBox','0 0 640 216');e.setAttribute('role','img');e.setAttribute('aria-label',"Sid Meier’s SimGolf");e.removeAttribute('aria-hidden');
    Module.cleanTitleLogo={source:'local-imported-wordmark-contours',width:w,height:h,colors:'continuous-green-and-cream-gradients',retainedPixels:retained,contours:loops,pathCharacters:outline.path.length+letters.path.length};return e;
  }
  function exit(){const id='sg-title-exit';const e=svg(`${defs(id)}<circle cx="32" cy="32" r="28" fill="url(#${id}-badge)" stroke="#48436d" stroke-width="1.6"/><path d="M34 13h15v38H34z" fill="${ink}"/><path d="M10 29h21v-8l13 11-13 11v-8H10z" fill="${ink}" stroke="#bfd2ed" stroke-width="1.5" paint-order="stroke fill"/>`);e.setAttribute('viewBox','0 0 64 64');return e;}
  function difficultyButton(item,selected){const id='sg-difficulty-'+item+'-'+(selected?'selected':'normal');
    const eyes=item===0?'<path d="M39 59q5-9 13-13m29 0q9 5 13 13" fill="none" stroke-width="5"/>':'<ellipse cx="47" cy="60" rx="5" ry="10"/><ellipse cx="84" cy="60" rx="5" ry="10"/>';
    const eyebrows=item===2?'<path d="m35 43 19 12m44-12L79 55" fill="none" stroke-width="6"/>':'';
    const mouth=item===3?'<ellipse cx="66" cy="96" rx="17" ry="20"/><ellipse cx="61" cy="92" rx="6" ry="8" fill="#b9d6f5"/>':'<path d="M35 80q31 51 62 0M30 81l12-4m48 0 12 4" fill="none" stroke-width="4.5"/>';
    return svg(`${defs(id)}<ellipse cx="265" cy="104" rx="161" ry="37" fill="#24213f" opacity=".16"/><ellipse cx="264" cy="91" rx="165" ry="45" fill="url(#${id}-base)" filter="url(#${id}-shadow)"/><ellipse cx="262" cy="80" rx="164" ry="45" fill="url(#${id}-rim)" stroke="#9798bf" stroke-width="1.4"/><ellipse cx="263" cy="80" rx="139" ry="33" fill="url(#${id}-${selected?'gold':'cream'})" stroke="#777349" stroke-opacity=".25"/><path d="M121 66c36-25 163-33 244-11" fill="none" stroke="#eeeeff" stroke-width="2" opacity=".6"/><circle cx="66" cy="72" r="54" fill="url(#${id}-${selected?'gold':'badge'})" stroke="#343359" stroke-width="2.5" filter="url(#${id}-shadow)"/><path d="M25 48a47 47 0 0 1 59-20" fill="none" stroke="#fff" stroke-width="2" opacity=".7"/><g fill="${ink}" stroke="${ink}" stroke-linecap="round" stroke-linejoin="round">${eyes}${eyebrows}<path d="M62 73h7" fill="none" stroke-width="2.4"/>${mouth}</g>`);
  }
  function back(){const id='sg-difficulty-back',e=svg(`${defs(id)}<circle cx="32" cy="32" r="28" fill="url(#${id}-badge)" stroke="#48436d" stroke-width="1.8"/><path d="m35 16-20 16 20 16V38h15V26H35z" fill="${ink}"/><path d="M13 22a24 24 0 0 1 27-13" fill="none" stroke="#fff" stroke-width="1.5" opacity=".6"/>`);e.setAttribute('viewBox','0 0 64 64');return e;}
  Module.cleanStartupArt={button,logo,exit,difficultyButton,back};
})();

// Responsive startup screens assembled from the user's original button/logo
// art. Text stays separate and crisp; all choices go back to native selectors.
(function(){
  if(!Module.mobileMap)return;
  const style=document.createElement('style');style.textContent=`
    #mobile-startup[hidden]{display:none!important}
    body.mobile-startup-open #canvas,body.mobile-startup-open #local-title-actions,body.mobile-startup-open #mobile-ui{visibility:hidden}
    #mobile-startup{position:fixed;z-index:65;display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;color:#1c2541;font:20px/1.15 OriginalWorldMenu,"Comic Neue",sans-serif;padding:0 env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);container-type:inline-size}
    #mobile-startup.difficulty{background:radial-gradient(ellipse at 64% 10%,#fff5da 0%,#e2ddf3 40%,#9d9dc7 100%);--startup-ridge:#a4a1bf;--startup-hills:#807fa0;--startup-fairway:#aebf9a}
    #startup-scroll{position:relative;flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;touch-action:pan-y;padding:14px;box-sizing:border-box}
    #startup-scene{max-width:1060px;margin:auto;display:grid;gap:14px;align-content:center;align-items:center;min-height:100%}
    #startup-hero{display:flex;flex-direction:column;gap:6px;align-items:center;justify-content:center;min-width:0}#startup-hero :is(canvas,svg){display:block;width:100%;max-width:390px;height:auto}
    #startup-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px 14px;align-items:center;justify-items:center;min-width:0}
    #mobile-startup button{font:inherit;cursor:pointer;touch-action:pan-y;color:inherit;box-sizing:border-box}
    #mobile-startup .startup-choice{position:relative;display:block;border:0;padding:0;background:transparent;max-width:310px;width:100%;min-height:60px;isolation:isolate;container-type:inline-size;aspect-ratio:440/150}
    #mobile-startup .startup-choice :is(canvas,svg){display:block;width:100%;height:auto;pointer-events:none}
    #mobile-startup .startup-choice .startup-hover{position:absolute;inset:0;opacity:0}
    #mobile-startup .startup-choice:active .startup-hover{opacity:1}
    @media(hover:hover){#mobile-startup .startup-choice:hover .startup-hover{opacity:1}}
    #mobile-startup .startup-choice:focus-visible{outline:3px solid #39315d;outline-offset:0;border-radius:50%}
    #mobile-startup .startup-choice:disabled{opacity:.65;cursor:wait}
    #mobile-startup .startup-label{position:absolute;left:15%;right:28%;top:51.33%;transform:translateY(-50%);display:flex;flex-direction:column;justify-content:center;text-align:center;font-size:clamp(15px,7.2cqi,22px);line-height:1.02;pointer-events:none;text-shadow:0 1px #fff}
    #mobile-startup.title .startup-hover{transition:opacity .14s ease}
    @media(prefers-reduced-motion:reduce){#mobile-startup.title .startup-hover{transition:none}}
    #mobile-startup .startup-label small{font-size:.78em;margin-top:2px}
    #mobile-startup.difficulty .startup-label{left:33%;right:13.5%;top:53.33%;font-size:clamp(16px,8.6cqi,26px)}
    body.game-exiting :is(#mobile-startup,#mobile-ui,#mobile-mode-rail,#mobile-cancel,#mobile-open-hole,#local-title-actions,#map-display){visibility:hidden!important;pointer-events:none!important}
    body.game-exiting #canvas{visibility:visible!important}
    #startup-heading{margin:0;text-align:center;font-weight:600;font-size:clamp(24px,6cqw,37px);line-height:1.12;color:#24234d;text-shadow:0 1px #fff8}
    #startup-heading::after{content:"";display:block;width:70%;height:2px;margin:8px auto 0;background:linear-gradient(90deg,transparent,#716b9e,transparent)}
    #startup-mute[hidden]{display:none!important}
    #startup-tools{position:relative;flex:none;display:flex;justify-content:center;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 10px;border-top:1px solid #faf9ffb0;background:#d5d7edea}
    #startup-tools button{display:flex;align-items:center;justify-content:center;gap:6px;min-height:44px;padding:5px 11px;border:1px solid #727094;border-radius:22px;background:#f9f9e7;font-size:16px;touch-action:manipulation}
    #startup-tools :is(canvas,svg){width:32px;height:32px;display:block;pointer-events:none}#startup-tools .startup-native{padding:0 6px 0 0;background:transparent;border:0}
    @container(min-width:720px){#mobile-startup #startup-scene{grid-template-columns:minmax(200px,.75fr) minmax(0,1.3fr);gap:24px}}
    @container(max-width:550px){#startup-scroll{padding:9px 10px}#startup-scene{gap:8px}#startup-options{grid-template-columns:minmax(0,1fr);gap:3px}#startup-hero :is(canvas,svg){max-width:320px}#mobile-startup .startup-choice{max-width:278px}}
    @container(max-width:550px){
      #mobile-startup.title #startup-tools{display:grid;grid-template-columns:1fr 1fr .72fr;gap:6px;padding-inline:8px}
      #startup-tools button{font-size:15px;line-height:1.05;padding:4px;min-width:0}
      #startup-tools :is(canvas,svg){width:26px;height:26px;flex:none}
      #startup-tools .startup-native{padding-inline:0 4px}
    }
    @media(max-height:570px){@container(min-width:570px){#mobile-startup #startup-scene{grid-template-columns:minmax(165px,.7fr) minmax(0,1.3fr)}}}
    @media(max-height:740px){@container(max-width:550px){#startup-hero :is(canvas,svg){max-width:270px}#mobile-startup.title .startup-choice{max-width:224px}#mobile-startup.difficulty .startup-choice{max-width:250px}}}
  `;document.head.appendChild(style);
  const root=document.createElement('section');root.id='mobile-startup';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');
  const landscape=Module.createStartupLandscape('startup-landscape');
  const scroll=document.createElement('div');scroll.id='startup-scroll';const scene=document.createElement('div');scene.id='startup-scene';const hero=document.createElement('header');hero.id='startup-hero';const options=document.createElement('nav');options.id='startup-options';scene.append(hero,options);scroll.append(scene);const tools=document.createElement('footer');tools.id='startup-tools';
  const badge=document.createElement('span');badge.id='startup-edition';badge.className='menu-edition-medallion';badge.hidden=true;
  const mute=Module.createAudioMuteButton('startup-mute');mute.hidden=true;
  root.append(landscape,mute,scroll,tools);document.body.appendChild(root);
  let serial=0,screen='',titleArt=null,difficultyArt=null,failed=new Set(),fontStarted=false,touchGeneration=0;const touches=new Set();
  root.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'){touches.add(e.pointerId);if(touches.size>1)touchGeneration++;}},true);
  for(const type of ['pointerup','pointercancel'])root.addEventListener(type,e=>touches.delete(e.pointerId),true);
  Module.startupQueue=[];
  function font(){if(fontStarted)return;fontStarted=true;try{const f=new FontFace('OriginalWorldMenu',Module.originalMenuArt.file('manu3_.TTF'));f.load().then(face=>{document.fonts.add(face);Module.startupArtwork.font='original-ttf';}).catch(()=>{Module.startupArtwork.font='fallback';});}catch(e){Module.startupArtwork.font='fallback';}}
  function artwork(kind){
    if(kind==='title'&&titleArt)return titleArt;if(kind==='difficulty'&&difficultyArt)return difficultyArt;if(failed.has(kind))return null;
    try{
      const pcx=Module.originalMenuArt.pcx;let result;
      if(kind==='title'){
        const base=pcx('TitleBase'),selected=pcx('TitleMO',true),clean=Module.cleanStartupArt;
        const buttons=Array.from({length:5},(_,item)=>({normal:clean.button(item,false),selected:clean.button(item,true)}));
        let logo;try{logo=clean.logo(selected);}catch(e){logo=Module.originalMenuArt.titleLogo(base,selected);Module.cleanTitleLogo={source:'original-canvas-fallback',error:String(e)};}
        result={buttons,logo,exit:clean.exit(),clean:true};titleArt=result;
      }else{
        const clean=Module.cleanStartupArt;
        result={buttons:Array.from({length:4},(_,i)=>({normal:clean.difficultyButton(i,false),selected:clean.difficultyButton(i,true)})),back:clean.back(),clean:true};difficultyArt=result;
      }
      Module.startupArtwork=Module.startupArtwork||{source:'user-imported-originals',layout:'responsive-original-elements',font:'loading'};Module.startupArtwork[kind]=true;Module.startupArtwork[kind+'Renderer']='clean-svg';if(kind==='title')Module.startupArtwork.titleLogo=Module.cleanTitleLogo;font();return result;
    }catch(e){failed.add(kind);Module.startupArtwork=Module.startupArtwork||{};Module.startupArtwork[kind+'Error']=String(e);return null;}
  }
  function send(item){
    const s=Module.startupMenu;
    if(!s?.active||s.busy||Module.startupQueue.length)return;
    const nextPicker=Module.saveRules?.draft?.context==='championship'?'championship':'locations';
    const target=s.kind==='difficulty'?(item===4?'title':nextPicker):{0:'saves',1:'difficulty',2:'themes',3:'difficulty',4:'locations'}[item];
    // Direct startup load already owns the cover before queuing this native choice.
    const directLoadCover=s.kind==='title'&&item===0&&Module.directSavedGame==='queued'&&Module.mobileScreenTransition?.active;
    if(target&&!directLoadCover)Module.beginMobileScreenTransition?.(target,'startup',s.serial);
    Module.cancelMapGesture();
    Module.startupQueue.push([s.serial,s.kind==='difficulty'?1:0,item]);
  }
  function tap(e,fn,activateOnRelease){let down=null,last=-Infinity,blocked=false;
    e.addEventListener('pointerdown',v=>{if(down||v.pointerType==='touch'&&touches.size>1){blocked=true;down=null;return;}blocked=false;down={id:v.pointerId,x:v.clientX,y:v.clientY,top:scroll.scrollTop,generation:touchGeneration};});
    e.addEventListener('pointercancel',()=>{down=null;blocked=true;});
    e.addEventListener('pointerup',v=>{if(!down||blocked||down.id!==v.pointerId)return;const p=down;down=null;if(p.generation!==touchGeneration||Math.hypot(v.clientX-p.x,v.clientY-p.y)>=8||Math.abs(scroll.scrollTop-p.top)>=3){blocked=true;return;}if(activateOnRelease&&v.pointerType==='touch'&&!e.disabled){last=performance.now();v.preventDefault();fn();}});
    e.addEventListener('click',v=>{if(performance.now()-last<650||blocked){v.preventDefault();return;}if(!e.disabled)fn();});
  }
  function button(label,fn,id,activateOnRelease=true){const b=document.createElement('button');b.type='button';if(id)b.id=id;b.setAttribute('aria-label',label);tap(b,fn,activateOnRelease);return b;}
  function copyArt(source){if(source instanceof SVGElement)return source.cloneNode(true);const c=source.cloneNode();c.getContext('2d').drawImage(source,0,0);return c;}
  async function confirmExit(){
    if(Module.editionModalOpen||root.inert)return;
    root.inert=true;
    try{
      const confirmed=Module.confirmTitleExit?await Module.confirmTitleExit():window.confirm('Are you sure you want to exit the game?');
      if(confirmed&&Module.startupMenu?.kind==='title')send(5);
    }finally{
      root.inert=false;
      document.getElementById('startup-exit')?.focus({preventScroll:true});
    }
  }
  // The index is the original engine's difficulty command.
  const difficulties=[
    ['Easy','Learn to build and run your first golf course. Golfers stay happy more easily, and facilities like the driving range and putting green give them an extra lift. Fun holes also have an easier time earning awards, so you have room to experiment with your designs.'],
    ['Moderate','Build a course that’s fun to play and rewards good shots. Golfers lose enjoyment faster than on Easy, so pay attention to holes that consistently frustrate them. A high Fun rating can still help a hole earn an award while you refine its design.'],
    ['Difficult','Keep golfers happy through a demanding round. They lose enjoyment faster between holes, and even a good shot can frustrate them if they can’t see where it lands. To earn top hole awards, design holes that reward skills like distance, accuracy, and creative shotmaking.'],
    ['Impossible','Take on the toughest club management challenge. Golfers lose enjoyment fastest, so a round that starts well can still end in frustration. Make every hole enjoyable to play, keep landing areas visible, and give golfers chances to recover between demanding holes. Your club pro starts with lower skills and takes longer to develop.']
  ];
  async function confirmDifficulty(item){
    const current=Module.startupMenu;
    if(root.inert||Module.editionModalOpen||current?.kind!=='difficulty'||!current.active||current.busy||Module.startupQueue.length)return;
    const choice=options.querySelector('[data-startup-item="'+item+'"]');
    root.inert=true;
    try{
      const confirmed=await Module.confirmDifficulty(...difficulties[item]);
      const next=Module.startupMenu;
      if(confirmed&&next?.kind==='difficulty'&&next.serial===current.serial)send(item);
    }finally{
      root.inert=false;
      if(!Module.startupQueue.length)choice?.focus({preventScroll:true});
    }
  }
  function render(s,art){
    mute.hidden=s.kind!=='title';root.className=s.kind;root.setAttribute('aria-label',s.kind==='title'?'Main menu':'Select difficulty');options.setAttribute('aria-label',s.kind==='title'?'Main menu options':'Difficulty options');hero.replaceChildren();options.replaceChildren();tools.replaceChildren();scroll.scrollTop=0;
    if(s.kind==='title'){const logo=copyArt(art.logo);logo.setAttribute('role','img');logo.setAttribute('aria-label',"Sid Meier’s SimGolf");hero.append(badge,logo);}
    else{const h=document.createElement('h1');h.id='startup-heading';h.textContent='Select Difficulty';hero.append(h);}
    const order=s.kind==='title'?[0,1,4,2,3]:[0,1,2,3],labels=s.kind==='title'?['Continue Saved Game','Start New Game','Select A Theme','Play a Championship','Sandbox Mode']:difficulties.map(([name])=>name);
    // Open the difficulty dialog on click so the tap cannot click through into it.
    const difficulty=s.kind==='difficulty';
    for(const item of order){const b=button(labels[item],()=>difficulty?confirmDifficulty(item):send(item),undefined,!difficulty);b.className='startup-choice';b.dataset.startupItem=String(item);const a=art.buttons[item];for(const [source,cls]of [[a.normal,'startup-normal'],[a.selected,'startup-hover']]){const c=copyArt(source);c.setAttribute('class',cls);b.append(c);}const label=document.createElement('span');label.className='startup-label';label.textContent=labels[item];if(s.kind==='title'&&(item===0||item===3)){label.replaceChildren();for(const line of item===0?['Continue','Saved Game']:['Play a','Championship']){const t=document.createElement('span');t.textContent=line;t.style.whiteSpace='nowrap';label.append(t);}}if(s.kind==='title'&&item===1){const sub=document.createElement('small');sub.textContent='('+(s.theme||'Standard')+')';label.append(sub);}b.append(label);options.append(b);}
    function control(label,fn,artwork,id){const b=button(label,fn,id);if(artwork){b.className='startup-native';const c=copyArt(artwork);b.append(c);}const span=document.createElement('span');span.textContent=label;b.append(span);tools.append(b);}
    if(s.kind==='difficulty')control('Back',()=>send(4),art.back,'startup-back');
    else{control('Backup & Transfer Files',()=>document.getElementById('local-title-saves')?.click(),null,'startup-saves');control('Check for updates',()=>document.getElementById('local-title-updates')?.click(),null,'startup-updates');control('Exit Game',confirmExit,art.exit,'startup-exit');}
  }
  const creditsSkip=document.createElement('button');creditsSkip.id='exit-credits-skip';creditsSkip.type='button';creditsSkip.textContent='Skip credits';creditsSkip.hidden=true;
  creditsSkip.style.cssText='position:fixed;z-index:80;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));min-width:110px;min-height:48px;padding:8px 15px;border:1px solid var(--menu-border);border-radius:22px;background:var(--menu-button);color:var(--menu-text);font:16px system-ui;touch-action:manipulation';
  creditsSkip.onclick=()=>{if(Module.exitCredits?.phase==='playing')Module.exitCredits.skipRequested=true;};
  for(const type of ['pointerdown','pointerup','click','mousedown','mouseup','touchstart','touchend','keydown','keyup','keypress'])creditsSkip.addEventListener(type,e=>e.stopPropagation());document.body.append(creditsSkip);
  Module.hideStartupForExit=function(){root.hidden=true;document.body.classList.remove('mobile-startup-open');document.body.classList.add('game-exiting');};
  function refresh(){
    creditsSkip.hidden=!Module.gameExiting||Module.exitCredits?.phase!=='playing';
    const s=Module.startupMenu;
    if(Module.directSavedGame||(Module.editionSelectionOpen&&Module.gameEdition===null)){
      if(Module.directSavedGame==='backup-startup'&&Module.localInstall?.phase==='ready'&&Module.atTitle&&
          s?.kind==='title'&&(s.frame>0||s.fallback)&&!s.busy&&!Module.initialLoading?.active&&!Module.startupQueue.length){
        Module.finishStartupBackups?.();
      }
      if(Module.directSavedGame==='startup'&&Module.localInstall?.phase==='ready'&&
          s?.active&&s.kind==='title'&&s.frame>0&&!s.busy&&!s.fallback&&!Module.initialLoading?.active&&!Module.startupQueue.length){
        Module.directSavedGame='queued';
        send(0);
      }
      root.hidden=true;document.body.classList.remove('mobile-startup-open');return;
    }
    if(Module.gameExiting||!s?.active||!Module.mobileUI||s.fallback||!s.frame||Module.localInstall?.phase!=='ready'||!document.getElementById('local-save-files')?.hidden){root.hidden=true;document.body.classList.remove('mobile-startup-open');return;}
    const art=artwork(s.kind);if(!art){root.hidden=true;document.body.classList.remove('mobile-startup-open');if(!s.fallback&&!s.busy&&!Module.startupQueue.length)Module.startupQueue.push([s.serial,s.kind==='difficulty'?1:0,99]);return;}
    root.hidden=false;document.body.classList.add('mobile-startup-open');
    if(serial!==s.serial||screen!==s.kind){serial=s.serial;screen=s.kind;Module.cancelMapGesture();render(s,art);}
    const edition=Module.gameEdition;
    badge.hidden=!edition;
    const mode=edition==='enhanced'?'Enhanced':'Classic';
    if(edition&&badge.textContent!==mode)badge.textContent=mode;
    const bounds=Module.getScreenBounds(),top=Math.max(bounds.top,document.getElementById('build-header').getBoundingClientRect().bottom);Object.assign(root.style,{left:bounds.left+'px',top:top+'px',width:bounds.width+'px',height:Math.max(0,bounds.top+bounds.height-top)+'px'});
    for(const b of options.querySelectorAll('button'))b.disabled=!!(s.busy||Module.startupQueue.length);const back=document.getElementById('startup-back');if(back)back.disabled=!!(s.busy||Module.startupQueue.length);
    Module.startupPresentation={kind:s.kind,layout:'responsive-clean-vectors',width:root.clientWidth,height:root.clientHeight};
  }
  for(const type of ['mousedown','mousemove','mouseup','click','dblclick','pointerdown','pointermove','pointerup','pointercancel','touchstart','touchmove','touchend','touchcancel','wheel','keydown','keyup','keypress'])root.addEventListener(type,e=>e.stopPropagation());
  setInterval(refresh,50);
})();


// Show the original theme catalogue with touch-sized controls.
(function(){
  if(!Module.mobileUI)return;
  const root=document.createElement('section');
  root.id='mobile-theme-picker';
  root.hidden=true;
  root.setAttribute('role','dialog');
  root.setAttribute('aria-modal','true');
  root.setAttribute('aria-labelledby','mobile-theme-title');
  root.innerHTML='<header><h1 id="mobile-theme-title" tabindex="-1">Select A Theme</h1></header><div class="theme-list" role="group" aria-label="Installed theme packs"></div><footer><button id="mobile-theme-back" type="button">Back</button><button id="mobile-theme-apply" type="button">Use Theme</button></footer>';
  const style=document.createElement('style');
  style.textContent=`
    #mobile-theme-picker[hidden]{display:none}
    #mobile-theme-picker{position:fixed;inset:0;z-index:115;box-sizing:border-box;
      display:flex;flex-direction:column;gap:12px;color:var(--menu-text);
      padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right))
              max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));
      background:radial-gradient(ellipse at 38% 10%,#fff9e8,#e3e2f8 38%,#a8a9d1);
      font:15px/1.35 system-ui,sans-serif}
    #mobile-theme-picker>header,#mobile-theme-picker>footer,#mobile-theme-picker>.theme-list{width:min(100%,580px);margin-inline:auto}
    #mobile-theme-picker h1{font-size:clamp(22px,5vw,30px);line-height:1.12;margin:0}
    #mobile-theme-picker .theme-list{flex:1;min-height:0;display:grid;align-content:start;gap:8px;overflow:auto;overscroll-behavior:contain;touch-action:pan-y}
    #mobile-theme-picker footer{display:flex;justify-content:flex-end;gap:8px;flex:none}
    #mobile-theme-picker button{min-height:44px;min-width:44px;padding:8px 14px;border:1px solid var(--menu-border);
      border-radius:10px;background:var(--menu-button);color:inherit;font:inherit;cursor:pointer}
    #mobile-theme-picker button:focus-visible{outline:3px solid var(--menu-focus);outline-offset:-3px}
    #mobile-theme-picker button:disabled{opacity:.55;cursor:default}
    #mobile-theme-picker .theme-card{display:grid;gap:3px;text-align:left;touch-action:pan-y}
    #mobile-theme-picker .theme-card[aria-pressed=true],#mobile-theme-apply{background:linear-gradient(#fffde8,#f1dc98)}
    #mobile-theme-picker .theme-card strong{font-size:16px;overflow-wrap:anywhere}
    #mobile-theme-picker .theme-card small{font-size:13px}
    body.mobile-theme-open :is(#canvas,#map-display,#local-title-actions){visibility:hidden!important}
    @media(max-height:380px){#mobile-theme-picker{gap:8px}#mobile-theme-picker .theme-card{padding-block:5px}}
  `;
  document.head.append(style);
  document.body.append(root);
  const heading=root.querySelector('h1'),list=root.querySelector('.theme-list');
  const back=root.querySelector('#mobile-theme-back'),apply=root.querySelector('#mobile-theme-apply');
  const contents=[[0,'Stories'],[1,'Characters'],[2,'Celebrities'],[3,'Pro Golfers'],[5,'Courses'],[6,'Landmarks']];
  let serial=null,selection=-1,selectedCard=null,destination='back';
  function choose(card){
    selectedCard?.setAttribute('aria-pressed','false');
    selectedCard=card;
    selection=Number(card.dataset.theme);
    card.setAttribute('aria-pressed','true');
    apply.disabled=false;
  }
  function render(state){
    selectedCard=null;
    selection=-1;
    list.replaceChildren();
    for(const row of state.rows){
      const card=document.createElement('button');
      card.type='button';
      card.className='theme-card';
      card.dataset.theme=String(row.id);
      card.setAttribute('aria-pressed','false');
      const title=document.createElement('strong');
      title.textContent=row.name;
      const detail=document.createElement('small');
      const included=contents.filter(([bit])=>row.flags&(1<<bit)).map(([,label])=>label);
      if(row.id===state.selected)included.unshift('Current theme');
      detail.textContent=included.join(' · ');
      card.append(title);
      if(detail.textContent)card.append(detail);
      card.onclick=()=>choose(card);
      list.append(card);
      if(row.id===state.selected)choose(card);
    }
    if(!state.rows.length)list.textContent='No theme packs found in your installed game files.';
    list.scrollTop=0;
  }
  function send(op){
    const state=Module.themePicker;
    if(!state?.active||state.serial!==serial||Module.themeQueue?.length||back.disabled)return;
    if(op===1&&!state.rows.some(row=>row.id===selection))return;
    Module.cancelMapGesture();
    Module.beginMobileScreenTransition?.(destination,'themes',state.serial);
    Module.themeQueue.push([state.serial,op,op===1?selection:-1]);
    back.disabled=apply.disabled=true;
  }
  back.onclick=()=>send(2);
  apply.onclick=()=>send(1);
  root.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();send(2);}});
  for(const type of ['mousedown','mouseup','click','pointerdown','pointermove','pointerup','pointercancel','touchstart','touchmove','touchend','wheel','keydown','keyup','keypress'])
    root.addEventListener(type,e=>e.stopPropagation());
  setInterval(()=>{
    const state=Module.themePicker;
    const visible=!!state?.active;
    root.hidden=!visible;
    document.body.classList.toggle('mobile-theme-open',visible);
    if(!visible){serial=null;return;}
    if(serial!==state.serial){
      serial=state.serial;
      const opening=Module.mobileScreenTransition;
      destination=opening?.active&&opening.target==='themes'?'title':'back';
      render(state);
      root.dataset.serial=String(serial);
      heading.focus({preventScroll:true});
    }
    const busy=!!Module.themeQueue?.length||
      (Module.mobileScreenTransition?.active&&Module.mobileScreenTransition.source==='themes');
    back.disabled=busy;
    apply.disabled=busy||selection<0;
  },50);
})();

// Reflow the native report draws; keep its charts, badges and report loop.
(function(){
  const names=['','Course Report','Player Comments','Histograph','Financial Report','SGA Evaluation','Membership Roster','Best Scores','Tournament Results'];
  const root=document.createElement('section');
  root.id='mobile-report';root.hidden=true;root.setAttribute('role','dialog');
  root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','mobile-report-title');
  root.innerHTML='<header><h2 id="mobile-report-title"></h2><button type="button" id="mobile-report-original" aria-pressed="false">Original View</button><button type="button" id="mobile-report-close" aria-label="Close Report">×</button></header><div class="report-view" tabindex="0"></div><footer class="report-pages" hidden><button type="button" id="mobile-report-prev">Previous</button><button type="button" id="mobile-report-next">Next</button></footer><footer class="report-offer-actions" hidden><button type="button" id="mobile-tournament-decline">Not Now</button><button type="button" id="mobile-tournament-accept">Begin Tournament</button></footer><footer class="report-tournament-done" hidden><button type="button" id="mobile-tournament-done">Done</button></footer>';
  const style=document.createElement('style');
  style.textContent=`
    #mobile-report[hidden],#mobile-report [hidden]{display:none!important}
    #mobile-report{position:fixed;inset:0;z-index:115;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;padding:max(8px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left));background:radial-gradient(ellipse at 45% 5%,#e5e5f6,var(--menu-bg) 80%);color:var(--menu-text);font:15px/1.35 system-ui,sans-serif}
    #mobile-report header,#mobile-report footer{display:flex;align-items:center;gap:6px;flex:none;width:100%;max-width:960px;margin-inline:auto}
    #mobile-report header{box-sizing:border-box;padding:4px 5px 4px 12px;border:1px solid var(--menu-border);border-radius:18px;background:#fff9e8;box-shadow:0 2px 0 #69648355}
    #mobile-report h2{flex:1;min-width:0;margin:0;font:clamp(19px,4vw,26px)/1.1 OriginalWorldMenu,system-ui,sans-serif}
    #mobile-report :is(button,select){min-height:44px;padding:5px 10px;border:1px solid var(--menu-border);border-radius:10px;background:var(--menu-preview);color:inherit;font:inherit;cursor:pointer;touch-action:manipulation}
    #mobile-report :is(button,select,summary):focus-visible{outline:2px solid var(--menu-focus);outline-offset:2px}
    #mobile-report button[aria-pressed=true]{background:var(--menu-selected)}
    #mobile-report-close{min-width:44px;border-radius:50%!important;font-size:24px!important}
    #mobile-report[data-business-return] #mobile-report-close{border-radius:10px!important;font-size:inherit!important}
    #mobile-report .report-pages{justify-content:center}
    #mobile-report .report-offer-actions{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:8px}
    #mobile-report .report-offer-actions button{min-height:48px;font-weight:650}
    #mobile-report .report-offer-actions button:disabled{opacity:.5}
    #mobile-report #mobile-tournament-accept{background:linear-gradient(#fff8d9,#f0d37f)}
    #mobile-report .report-view{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain}
    #mobile-report .report-content{box-sizing:border-box;max-width:960px;margin:auto;padding:4px 1px 8px;display:grid;gap:8px}
    #mobile-report .report-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:8px;align-items:start}
    #mobile-report .report-card{min-width:0;box-sizing:border-box;padding:9px 10px;border:1px solid var(--menu-border);border-radius:12px;background:#fff9e8;box-shadow:0 2px 0 #69648338;overflow-wrap:anywhere}
    #mobile-report .report-card-head{display:flex;align-items:center;gap:6px 8px;flex-wrap:wrap}
    #mobile-report .report-card-head>:first-child{flex:1}
    #mobile-report h3{font-size:17px;margin:0}
    #mobile-report p{margin:6px 0}
    #mobile-report .report-tag{border:1px solid #8582ab;border-radius:20px;background:#d6d6f1;padding:2px 8px;font-size:13px;font-weight:650}
    #mobile-report .report-note{margin:0;padding:8px 10px;border-radius:8px;background:var(--menu-panel)}
    #mobile-report .report-fields{margin:7px 0 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,112px),1fr));gap:5px 9px}
    #mobile-report .report-fields dt{font-size:12px}
    #mobile-report dd{margin:0;font-weight:650;font-variant-numeric:tabular-nums}
    #mobile-report .report-card.positive{background:#e8f2dc}
    #mobile-report .report-card.negative{background:#f9e6df}
    #mobile-report .report-card.positive .report-tag{color:#245535;background:#e8f2dc;border-color:#7a9b71}
    #mobile-report .report-card.negative .report-tag,#mobile-report .report-ledger .negative{color:#9a272a}
    #mobile-report .report-card.negative .report-tag{background:#f9e6df;border-color:#ba8585}
    #mobile-report .report-year{display:flex;align-items:center;gap:10px;font-weight:650}
    #mobile-report .report-year select{min-width:110px}
    #mobile-report .report-ledger{margin:7px 0 0}
    #mobile-report .report-ledger-row{display:flex;justify-content:space-between;gap:8px;padding:7px 2px;border-top:1px solid #7d789b4d}
    #mobile-report .report-ledger-row:last-child{font-weight:700}
    #mobile-report .report-course .report-fields{grid-template-columns:repeat(auto-fit,minmax(min(100%,82px),1fr))}
    #mobile-report .report-sga-summary{display:flex;align-items:center;gap:8px;margin-top:5px}
    #mobile-report .report-crest{width:68px;height:auto;border-radius:50%;flex:none}
    #mobile-report .report-stars{display:block;max-width:100%;height:auto;margin-top:6px}
    #mobile-report .report-events{margin-top:8px}
    #mobile-report .report-events summary{box-sizing:border-box;min-height:44px;padding:12px 0;font-weight:650;cursor:pointer}
    #mobile-report .report-events canvas{display:block;width:100%;height:auto}
    #mobile-report .report-key{display:flex;align-items:center;gap:8px;margin-bottom:4px}
    #mobile-report .report-key canvas{width:23px;height:21px}
    #mobile-report .report-rankings{margin:0;padding:0 0 0 30px}
    #mobile-report .report-rankings li{display:list-item;margin-bottom:6px}
    #mobile-report .report-rankings li .report-tag{float:right;margin-left:6px}
    #mobile-report .report-chart-tools{display:flex;align-items:center;justify-content:space-between;gap:8px}
    #mobile-report .report-chart-key{display:flex;flex-wrap:wrap;gap:4px 12px;padding:0;margin:0;list-style:none}
    #mobile-report .report-chart-key li::before{content:'';display:inline-block;width:.7em;height:.7em;border-radius:50%;background:#981c99;margin-right:.4em}
    #mobile-report .report-chart-key li:nth-child(2)::before{background:linear-gradient(#202020 50%,#e14746 50%)}
    #mobile-report .report-chart-key li:nth-child(3)::before{background:#5fce25}
    #mobile-report .report-chart-key li:nth-child(4)::before{background:#45929a}
    #mobile-report .report-chart{overflow:auto;overscroll-behavior:contain;border:1px solid var(--menu-border);border-radius:9px;background:#fff9e8}
    #mobile-report .report-chart .report-plot{display:block;width:min(100%,730px);height:auto;margin:auto}
    #mobile-report .report-content.chart-zoomed{height:100%;grid-template-rows:auto auto minmax(0,1fr)}
    #mobile-report .report-chart.zoomed .report-plot{width:1095px;max-width:none;touch-action:pan-x pan-y}
    #mobile-report .report-tournament{border:1px solid var(--menu-border);border-radius:12px;overflow:auto;overscroll-behavior-inline:contain;background:#fff9e8}
    #mobile-report .report-tournament table{width:100%;border-collapse:separate;border-spacing:0;font-variant-numeric:tabular-nums;white-space:nowrap}
    #mobile-report .report-tournament :is(th,td){padding:8px;text-align:right;border-bottom:1px solid var(--menu-border)}
    #mobile-report .report-tournament thead th{background:#d6d6f1}
    #mobile-report .report-tournament tr>:first-child{position:sticky;left:0;text-align:left;background:#fff9e8}
    #mobile-report .report-tournament thead tr>:first-child{background:#d6d6f1}
    #mobile-report .report-tournament tbody tr:first-child>*{background:#fff0c0;font-weight:700}
    #mobile-report .report-tournament tbody tr:last-child>*{border-bottom:0}
    #mobile-report .report-tournament .under{color:#245535;font-weight:650}
    #mobile-report .report-tournament .over{color:#922a2a}
    #mobile-report .report-tournament-done{justify-content:flex-end}
    #mobile-report .report-tournament-done button{min-width:96px;background:linear-gradient(#fff8d9,#f0d37f);font-weight:650}
    #mobile-report[data-report="8"] .report-original-frame canvas{width:min(100%,800px)}
    #mobile-report .report-original-frame{padding:4px 0}
    #mobile-report .report-original-frame canvas{display:block;margin:auto;width:800px;height:auto}
    body.mobile-report-open :is(#canvas,#map-display,#mobile-ui,#mobile-mode-rail,#mobile-cancel,#mobile-open-hole){visibility:hidden!important;pointer-events:none!important}
  `;
  document.head.append(style);document.body.append(root);
  const title=root.querySelector('h2'),close=root.querySelector('#mobile-report-close');
  const original=root.querySelector('#mobile-report-original'),view=root.querySelector('.report-view'),pages=root.querySelector('.report-pages');
  const offerActions=root.querySelector('.report-offer-actions');
  const decline=offerActions.querySelector('#mobile-tournament-decline'),accept=offerActions.querySelector('#mobile-tournament-accept');
  const done=root.querySelector('#mobile-tournament-done');
  const frame=document.createElement('canvas');
  frame.width=800;frame.height=600;
  const ctx=frame.getContext('2d'),pixels=ctx.createImageData(800,600);
  let current=0,reportLines=[],signature='',financialYear='',originalView=false;
  let pendingOfferLines=null,offerSerial=0,offerText='',offerSubmitted=false;
  let businessRequest=null,businessReturn=null,returnOnClose=false;
  Module.requestBusinessFinancialReport=context=>{
    if(!root.hidden||Module.menuQueue.length||!context.isCurrent())return false;
    const command=[8,8];
    businessRequest={command,previousResult:Module.menuResult,context};
    Module.menuQueue.push(command);
    return true;
  };
  function takeBusinessReturn(kind){
    const request=businessRequest;
    businessRequest=null;
    // The menu result is published after the native report returns. Only
    // the report opened while this command is executing owns its Back route.
    if(kind===4&&request&&Module.menuResult===request.previousResult&&
       !Module.menuQueue.includes(request.command)&&request.context.isCurrent())return request.context;
    return null;
  }
  function element(tag,value,cls){
    const e=document.createElement(tag);
    if(value)e.textContent=value;
    if(cls)e.className=cls;
    return e;
  }
  function fields(values){
    const list=element('dl','','report-fields');
    for(const [name,value] of values){
      if(!value)continue;
      const field=element('div');
      field.append(element('dt',name),element('dd',value));
      list.append(field);
    }
    return list;
  }
  function card(parent,name,tag,cls=''){
    const panel=element('article','','report-card '+cls);
    const header=element('div','','report-card-head');
    header.append(element('h3',name));
    if(tag)header.append(element('span',tag,'report-tag'));
    panel.append(header);parent.append(panel);
    return panel;
  }
  function art(x,y,w,h,label,cls){
    const canvas=element('canvas','',cls);
    canvas.width=w;canvas.height=h;
    canvas.getContext('2d').drawImage(frame,x,y,w,h,0,0,w,h);
    if(label){canvas.setAttribute('role','img');canvas.setAttribute('aria-label',label);}
    else canvas.setAttribute('aria-hidden','true');
    return canvas;
  }
  function rows(){
    const grouped=new Map();
    for(const {x,y,text,color} of reportLines){
      if(!grouped.has(y))grouped.set(y,new Map());
      grouped.get(y).set(x,{text,color});
    }
    return [...grouped].sort((a,b)=>a[0]-b[0]);
  }
  const value=(row,x)=>row?.get(x)?.text||'';
  function courseReport(body,data){
    const entries=data.filter(([y,row])=>y>76&&row.has(15));
    const columns=[[151,'Yardage'],[172,'Par'],[227,'Average Score'],[278,'Time'],[324,'Fun'],[369,'+ Length'],[415,'+ Accuracy'],[462,'+ Imagination'],[635,'Average Fee'],[709,'Revenue'],[786,'Profit']];
    const grid=element('div','','report-grid');body.append(grid);
    for(const [,row] of entries){
      const panel=card(grid,value(row,15),value(row,471),'report-course');
      panel.append(fields(columns.map(([x,label])=>[label,value(row,x)])));
    }
    if(!grid.childElementCount)body.append(element('p','The game has no hole statistics to report yet.','report-note'));
  }
  function comments(body,data){
    const grid=element('div','','report-grid');body.append(grid);
    for(const [y,row] of data){
      if(y<=96||!row.has(182))continue;
      const color=row.get(182).color&0x7fff;
      const sign=color===0x1284?'positive':color===0x7d08?'negative':'';
      const detail=element('article','','report-card '+sign);
      const line=element('div','','report-card-head');
      line.append(element('strong',value(row,504)?'Hole '+value(row,504):'Player Comment'));
      if(sign)line.append(element('span',sign.toUpperCase(),'report-tag'));
      detail.append(line,element('p',value(row,182)),fields([['Frequency',value(row,598)]]));
      grid.append(detail);
    }
    if(!grid.childElementCount)body.append(element('p','No player comments have been reported yet.','report-note'));
  }
  function financial(body,data){
    const heading=data.find(([y])=>y===60)?.[1];
    if(!heading?.size){body.append(element('p','No financial years are available yet.','report-note'));return;}
    const years=[...heading].sort((a,b)=>b[0]-a[0]);
    const picker=element('label','Year','report-year'),select=element('select'),detail=element('div');
    for(const [,year] of years){
      const option=element('option',year.text);option.value=year.text;select.append(option);
    }
    if(years.some(([,year])=>year.text===financialYear))select.value=financialYear;
    function showYear(){
      financialYear=select.value;
      const [x]=years.find(([,year])=>year.text===financialYear);
      const rows=data.filter(([,row])=>row.has(98));
      const panel=element('article','','report-card');
      panel.append(element('h3',financialYear));
      const list=element('dl','','report-ledger');
      for(const [y,row] of rows){
        const amount=value(data.find(([line])=>line===y-1)?.[1],x+34);
        const entry=element('div','','report-ledger-row');
        entry.append(element('dt',value(row,98)),element('dd',amount||'—',amount.startsWith('-')?'negative':''));
        list.append(entry);
      }
      panel.append(list);detail.replaceChildren(panel);
    }
    picker.append(select);body.append(picker,detail);
    select.onchange=showYear;showYear();
  }
  function evaluation(body,data){
    const heading=data.find(([y])=>y===77)?.[1];
    const grade=value(heading,396);
    const summary=card(body,value(heading,75)||'Sim Golf Association',grade?'Grade '+grade:'');
    const recommendation=data.filter(([y,row])=>y>=288&&row.has(400));
    if(recommendation.length){
      const section=element('div','','report-sga-summary');
      const copy=element('div');
      copy.append(element('strong','Committee Recommendation'));
      for(const [,row] of recommendation)copy.append(element('p',value(row,400)));
      section.append(art(58,278,123,123,'Sim Golf Association crest','report-crest'),copy);
      summary.append(section);
    }
    const grid=element('div','','report-grid');body.append(grid);
    for(const [y,row] of data){
      if(!row.has(119)||!row.has(238))continue;
      const panel=card(grid,value(row,119),value(row,238));
      panel.append(fields([['Ideal (Minimum)',value(row,490)]]));
      panel.append(art(299,y-1,169,14,'Original SGA star rating','report-stars'));
    }
  }
  function roster(body,data){
    const grid=element('div','','report-grid');body.append(grid);
    for(const [y,row] of data){
      if(!row.has(28))continue;
      const panel=card(grid,value(row,28),value(row,320));
      panel.append(fields([['Low Score',value(row,170)],['Handicap',value(row,209)],['Rounds',value(row,249)]]));
      const details=element('details','','report-events');
      details.append(element('summary','Hole Events'));
      details.append(art(378,54,380,24,'Hole numbers 1–18'),art(378,y-5,380,20,'Original event markers for this member'));
      details.append(element('p','Markers show membership changes, photo opportunities, and happy endings. The key is at the bottom of this page.'));
      panel.append(details);
    }
    if(!grid.childElementCount){body.append(element('p','No golfers appear on this roster page yet.','report-note'));return;}
    const key=element('details','','report-events report-card');
    key.append(element('summary','Hole Event Key'));
    for(const [x,label] of [[19,'Member'],[139,'Silver Member'],[260,'Gold Member'],[381,'Resigned'],[504,'Photo Opportunity'],[624,'Happy Ending']]){
      const item=element('div','','report-key');
      item.append(art(x,529,23,21,''),element('span',label));key.append(item);
    }
    body.append(key);
  }
  function bestScores(body,data){
    const heading=data.find(([y])=>y===59)?.[1];
    if(heading?.size)body.append(element('p',value(heading,413),'report-note'));
    const list=element('ol','','report-rankings');
    for(const [y,row] of data){
      if(y<=96||!row.has(246))continue;
      const item=element('li','','report-card report-card-head');
      item.append(element('span',value(row,246).replace(/^\d+\.\s*/,'')),element('strong',value(row,551),'report-tag'));
      list.append(item);
    }
    body.append(list.childElementCount?list:element('p','No qualifying scores yet.','report-note'));
  }
  function chart(body){
    const chartView=element('div','','report-chart'),zoom=element('button','Zoom Chart');
    const controls=element('div','','report-chart-tools');
    zoom.type='button';zoom.setAttribute('aria-pressed','false');
    const hint=element('p','Skill, cash, fun, and course events');
    controls.append(hint,zoom);
    chartView.tabIndex=0;chartView.setAttribute('aria-label','Histograph chart');
    chartView.append(art(34,54,730,476,'Original chart of course skill, cash, fun, and events','report-plot'));
    zoom.onclick=()=>{
      const on=chartView.classList.toggle('zoomed');
      body.classList.toggle('chart-zoomed',on);
      hint.textContent=on?'Swipe to move around the chart.':'Skill, cash, fun, and course events';
      zoom.textContent=on?'Fit Chart':'Zoom Chart';zoom.setAttribute('aria-pressed',String(on));
      if(!on)chartView.scrollLeft=chartView.scrollTop=0;
    };
    const key=element('ul','','report-chart-key');
    for(const label of ['Skill','Cash','Fun','Event'])key.append(element('li',label));
    body.append(controls,key,chartView);
  }
  function tournamentResults(body,data){
    // The original report prints the rankings and total at fixed columns,
    // with blank columns for unused holes and prizes only for paid places.
    const headings=data.find(([y])=>y===50)?.[1];
    const holes=[...(headings||[])].filter(([x,cell])=>x>=175&&x<=634&&/^\d+$/.test(cell.text));
    const results=data.filter(([y,row])=>y>=77&&value(row,25)&&value(row,669));
    if(!holes.length||!results.length){
      const box=element('div','','report-original-frame');
      box.append(art(0,0,800,600,'Original Tournament Results'));
      body.append(box);
      return;
    }

    const wrapper=element('div','','report-tournament');
    wrapper.tabIndex=0;
    wrapper.setAttribute('role','region');
    wrapper.setAttribute('aria-label','Tournament standings and hole scores');
    const table=element('table'),head=table.createTHead().insertRow(),scores=table.createTBody();
    for(const label of ['Ranking','Total','Prize',...holes.map(([,cell])=>cell.text)]){
      const th=element('th',label);th.scope='col';head.append(th);
    }
    const mark=(cell,score)=>{
      if(!score)return;
      if(score.color===0x80006000)cell.classList.add('under');
      if(score.color===0x80000018)cell.classList.add('over');
    };
    for(const [,source] of results){
      const row=scores.insertRow(),name=element('th',value(source,25));
      name.scope='row';row.append(name);
      row.insertCell().textContent=value(source,669);
      row.insertCell().textContent=value(source,780)||'—';
      for(const [x] of holes){
        const cell=row.insertCell();
        cell.textContent=value(source,x)||'—';
        mark(cell,source.get(x));
      }
    }
    wrapper.append(table);body.append(wrapper);
  }
  const renderers=[null,courseReport,comments,chart,financial,evaluation,roster,bestScores,tournamentResults];
  function render(){
    const body=element('div','','report-content');
    if(offerSerial){
      const offer=card(body,'Your Invitation');
      offer.append(element('p',offerText));
    }
    if(originalView){
      const box=element('div','','report-original-frame');
      box.append(art(0,0,800,600,'Original '+names[current]));
      if(!offerSerial){view.replaceChildren(box);return;}
      body.append(box);
    }else if(!offerSerial||reportLines.length){
      renderers[current](body,rows());
    }
    view.replaceChildren(body);
  }
  function answerOffer(index){
    const s=Module.profileState;
    if(s?.serial!==offerSerial||!s.frame||s.busy||offerSubmitted)return;
    offerSubmitted=true;
    accept.disabled=decline.disabled=close.disabled=true;
    Module.profileQueue.push([offerSerial,5,index]);
  }
  function send(op,back=false){
    if(offerSerial){if(op===1)answerOffer(1);return true;}
    if(root.hidden||Module.mobileReportAction||close.disabled)return false;
    if(op===1){
      close.disabled=done.disabled=true;
      returnOnClose=back;
    }
    Module.mobileReportAction=op;
    return true;
  }
  Module.dismissMobileReport=()=>!close.disabled&&send(1);
  close.onclick=()=>send(1,true);
  done.onclick=()=>send(1);
  decline.onclick=()=>answerOffer(1);
  accept.onclick=()=>answerOffer(0);
  original.onclick=()=>{
    originalView=!originalView;
    original.textContent=originalView?'Mobile View':'Original View';
    original.setAttribute('aria-pressed',String(originalView));
    view.scrollTop=view.scrollLeft=0;render();
  };
  pages.querySelector('#mobile-report-prev').onclick=()=>send(2);
  pages.querySelector('#mobile-report-next').onclick=()=>send(3);
  root.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();send(1,true);}
  });
  for(const type of ['pointerdown','pointerup','pointermove','pointercancel','mousedown','mouseup','click','touchstart','touchmove','touchend','touchcancel','wheel','keydown','keyup','keypress']){
    root.addEventListener(type,e=>e.stopPropagation());
  }
  function captureFrame(address,stride){
    const heap=HEAPU16,rgba=pixels.data;
    let dst=0;
    for(let y=0;y<600;y++){
      let src=(address>>1)+y*stride;
      for(let x=0;x<800;x++){
        const c=heap[src++];rgba[dst++]=((c>>10)&31)*255/31;rgba[dst++]=((c>>5)&31)*255/31;rgba[dst++]=(c&31)*255/31;rgba[dst++]=255;
      }
    }
    ctx.putImageData(pixels,0,0);
  }
  function openReport(kind,heading,hasOriginal=true){
    businessReturn=takeBusinessReturn(kind);returnOnClose=false;
    root.toggleAttribute('data-business-return',!!businessReturn);
    current=kind;title.textContent=heading;root.dataset.report=String(kind);
    originalView=false;financialYear='';original.textContent='Original View';original.setAttribute('aria-pressed','false');
    original.hidden=!hasOriginal;pages.hidden=kind!==6;offerActions.hidden=!offerSerial;
    close.textContent=businessReturn?'Back':'×';
    close.setAttribute('aria-label',businessReturn?'Back to Business Challenges':offerSerial?'Decline Tournament':'Close Report');
    done.parentElement.hidden=kind!==8;
    close.disabled=done.disabled=false;root.hidden=false;
    document.body.classList.add('mobile-report-open');Module.mobileReportOpen=true;
    view.scrollTop=view.scrollLeft=0;
    (offerSerial?view:close).focus({preventScroll:true});
  }
  Module.drawMobileReport=function(kind,address,stride,lines){
    const first=root.hidden;
    if(offerSerial||(!first&&!lines?.length))return;
    const next=JSON.stringify(lines||[]);
    if(!first&&next===signature)return;
    signature=next;reportLines=lines||[];
    captureFrame(address,stride);
    if(first){
      if(kind===8)Module.cancelMapGesture();
      openReport(kind,names[kind]);
    }
    view.scrollTop=view.scrollLeft=0;
    render();
  };
  Module.captureTournamentReport=function(address,stride,lines){
    pendingOfferLines=address?lines||[]:null;
    if(address)captureFrame(address,stride);
  };
  Module.showTournamentOffer=function(s){
    if(offerSerial!==s.serial){
      offerSerial=s.serial;offerSubmitted=false;
      offerText=s.title.split('\n ').at(0).trim().replace(/\s+/g,' ');
      const hasOriginal=pendingOfferLines!==null;
      reportLines=pendingOfferLines||[];pendingOfferLines=null;
      root.dataset.tournamentOffer='';
      Module.cancelMapGesture();
      openReport(5,'Tournament Invitation',hasOriginal);
      render();
    }
    decline.disabled=accept.disabled=close.disabled=!s.frame||s.busy||offerSubmitted;
  };
  Module.hideTournamentOffer=function(){
    if(offerSerial)Module.closeMobileReport();
  };
  Module.closeMobileReport=function(){
    const destination=returnOnClose?businessReturn:null;
    businessRequest=businessReturn=null;returnOnClose=false;
    root.hidden=true;current=0;signature='';reportLines=[];view.replaceChildren();
    offerSerial=0;offerText='';offerSubmitted=false;delete root.dataset.tournamentOffer;
    document.body.classList.remove('mobile-report-open');Module.mobileReportOpen=false;Module.mobileReportAction=0;
    Module.businessFinancialReportReturn=destination?.isCurrent()?destination:null;
    document.getElementById('mobile-menu')?.focus({preventScroll:true});
  };
})();


// The native Preferences command supplies the original labels and bitmask.
(function(){
  if(!globalThis.HTMLDialogElement?.prototype.showModal)return;
  const dialog=document.createElement('dialog');
  dialog.id='mobile-preferences';
  dialog.setAttribute('aria-labelledby','mobile-preferences-title');
  dialog.innerHTML='<form method="dialog"><h2 id="mobile-preferences-title">Preferences</h2><div class="preferences-options"></div><footer><button type="button" id="mobile-preferences-cancel">Cancel</button><button type="submit" value="apply" id="mobile-preferences-done">Done</button></footer></form>';
  const style=document.createElement('style');
  style.textContent=`
    #mobile-preferences{box-sizing:border-box;inset:max(12px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));width:min(480px,calc(100% - max(16px,env(safe-area-inset-left)) - max(16px,env(safe-area-inset-right))));max-height:calc(100dvh - max(12px,env(safe-area-inset-top)) - max(12px,env(safe-area-inset-bottom)));padding:0;overflow:auto;overscroll-behavior:contain;border:1px solid var(--menu-border);border-radius:14px;background:var(--menu-panel);color:var(--menu-text);font:15px/1.4 system-ui,sans-serif}
    #mobile-preferences::backdrop{background:#161c37a6}
    #mobile-preferences h2{margin:0;padding:14px 16px 10px;font-size:21px}
    #mobile-preferences .preferences-options{display:grid;gap:6px;padding:0 12px 12px}
    #mobile-preferences label{display:flex;align-items:center;gap:10px;min-height:44px;padding:4px 10px;box-sizing:border-box;border:1px solid var(--menu-border);border-radius:7px;background:var(--menu-button);cursor:pointer}
    #mobile-preferences input{width:20px;height:20px;flex:none;margin:0;accent-color:var(--menu-focus)}
    #mobile-preferences footer{position:sticky;bottom:0;display:flex;justify-content:flex-end;gap:8px;padding:10px 12px;background:var(--menu-panel);border-top:1px solid var(--menu-line)}
    #mobile-preferences button{min-height:44px;padding:6px 16px;border:1px solid var(--menu-border);border-radius:7px;background:var(--menu-button);color:inherit;font:inherit;cursor:pointer}
    #mobile-preferences button#mobile-preferences-done{font-weight:700;background:var(--menu-selected)}
    #mobile-preferences :is(button,input):focus-visible{outline:3px solid var(--menu-focus);outline-offset:2px}
  `;
  document.head.append(style);
  document.body.append(dialog);
  const options=dialog.querySelector('.preferences-options');
  dialog.querySelector('#mobile-preferences-cancel').onclick=()=>dialog.close();
  for(const type of ['pointerdown','pointerup','pointermove','mousedown','mouseup','click','touchstart','touchmove','touchend','wheel','keydown','keyup','keypress']){
    dialog.addEventListener(type,e=>e.stopPropagation());
  }
  Module.showMobilePreferences=function(flags,labels){
    if(dialog.open)return -1;
    const inputs=labels.map((text,i)=>{
      const label=document.createElement('label'),input=document.createElement('input');
      input.type='checkbox';input.checked=!!(flags&(1<<i));label.append(input,text.trim());
      return input;
    });
    options.replaceChildren(...inputs.map(input=>input.parentElement));
    dialog.returnValue='';
    Module.cancelMapGesture();
    dialog.showModal();
    Module.mobilePreferencesOpen=true;
    dialog.scrollTop=0;
    return new Promise(resolve=>dialog.addEventListener('close',()=>{
      Module.mobilePreferencesOpen=false;
      const selected=dialog.returnValue==='apply'?inputs.reduce((mask,input,i)=>mask|(input.checked?1<<i:0),0):-1;
      resolve(selected);
      document.getElementById('mobile-menu')?.focus({preventScroll:true});
    },{once:true}));
  };
})();


// Native selection and payment run at the normal course-input boundary.
(function(){
  if(!globalThis.HTMLDialogElement?.prototype.showModal)return;
  const dialog=document.createElement('dialog');
  dialog.id='eyesore-demolition';
  dialog.setAttribute('aria-labelledby','eyesore-demolition-title');
  dialog.innerHTML='<h2 id="eyesore-demolition-title"></h2><p class="demolition-detail"></p><p class="demolition-status" role="status" hidden></p><footer><button type="button" id="eyesore-demolition-cancel" autofocus>Cancel</button><button type="button" id="eyesore-demolition-confirm"></button></footer>';
  const style=document.createElement('style');
  style.textContent=`
    #eyesore-demolition{box-sizing:border-box;width:min(390px,100%);max-width:none;max-height:var(--demolition-height);inset:0;padding:16px;overflow:auto;overscroll-behavior:contain;border:1px solid var(--menu-border);border-radius:14px;background:var(--menu-panel);color:var(--menu-text);font:15px/1.4 system-ui,sans-serif}
    #eyesore-demolition::backdrop{background:#161c375c}
    #eyesore-demolition h2{margin:0;font-size:20px;line-height:1.2}
    #eyesore-demolition p{margin:9px 0 0}
    #eyesore-demolition .demolition-status{color:#812622}
    #eyesore-demolition footer{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;margin-top:14px}
    #eyesore-demolition button{min-height:44px;min-width:44px;padding:6px 12px;border:1px solid var(--menu-border);border-radius:8px;background:var(--menu-button);color:inherit;font:inherit;touch-action:manipulation;cursor:pointer}
    #eyesore-demolition #eyesore-demolition-confirm{background:linear-gradient(#fffde6,#f4db90);font-weight:700}
    #eyesore-demolition button:disabled{opacity:.55;cursor:default}
    #eyesore-demolition button:focus-visible{outline:3px solid var(--menu-focus);outline-offset:2px}
  `;
  document.head.append(style);document.body.append(dialog);
  const title=dialog.querySelector('h2'),detail=dialog.querySelector('.demolition-detail');
  const status=dialog.querySelector('.demolition-status');
  const cancel=dialog.querySelector('#eyesore-demolition-cancel'),confirm=dialog.querySelector('#eyesore-demolition-confirm');
  const names=['water tower','radio antenna','oil pump'];
  let selection=null;
  function size(){
    if(!dialog.open)return;
    const b=Module.getScreenBounds();
    const left=b.left+b.safe.left+12,top=b.top+b.safe.top+12;
    const width=b.width-b.safe.left-b.safe.right-24,height=b.height-b.safe.top-b.safe.bottom-24;
    dialog.style.width=Math.min(390,width)+'px';
    dialog.style.setProperty('--demolition-height',height+'px');
    dialog.style.left=left+(width-dialog.offsetWidth)/2+'px';
    dialog.style.top=top+(height-dialog.offsetHeight)/2+'px';
    dialog.style.margin='0';
  }
  function update(affordable,hasCash){
    confirm.disabled=!affordable||!!selection.decision;
    cancel.disabled=!!selection.decision;
    const message=!selection.enabled||affordable?'':hasCash?'The construction ledger cannot accept this charge.':'You need more cash to demolish this landmark.';
    if(status.textContent!==message){status.textContent=message;status.hidden=!message;size();}
  }
  function choose(decision){
    if(selection&&!selection.decision&&(decision<0||!confirm.disabled)){
      selection.decision=decision;
      confirm.disabled=cancel.disabled=true;
    }
  }
  cancel.onclick=()=>choose(-1);
  confirm.onclick=()=>choose(1);
  dialog.addEventListener('cancel',e=>{e.preventDefault();choose(-1);});
  for(const type of ['pointerdown','pointerup','pointermove','pointercancel','mousedown','mouseup','click','touchstart','touchmove','touchend','wheel','keydown','keyup','keypress'])
    dialog.addEventListener(type,e=>e.stopPropagation());
  addEventListener('simgolf-screen-resize',size);
  addEventListener('simgolf-ruleset-change',()=>{if(selection)dialog.close();});
  Module.openEyesoreDemolition=(serial,subtype,fee,enabled,affordable,hasCash)=>{
    const name=names[subtype-16],rules=Module.saveRules?.active;
    if(dialog.open||!rules||!name)return false;
    selection={serial,rules,enabled,decision:0};
    title.textContent=enabled?'Demolish this '+name+'?':name[0].toUpperCase()+name.slice(1);
    detail.textContent=enabled?'Clear this site for construction. Demolition cannot be undone.':'To remove this landmark, exit Remove and go to Menu → Enhanced → Eyesore Demolition.';
    cancel.textContent=enabled?'Cancel':'Close';
    confirm.hidden=!enabled;
    confirm.textContent='Demolish for '+new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(fee);
    update(affordable,hasCash);
    dialog.showModal();size();
    return true;
  };
  Module.pollEyesoreDemolition=(serial,affordable,hasCash)=>{
    if(!dialog.open||selection?.serial!==serial||selection.rules!==Module.saveRules?.active)return -1;
    if(selection.decision===1&&!affordable)selection.decision=0;
    update(affordable,hasCash);
    return selection.decision;
  };
  Module.closeEyesoreDemolition=serial=>{
    if(selection?.serial!==serial)return;
    selection=null;
    if(dialog.open)dialog.close();
  };
})();


// The existing course input queue is the only path into native construction.
(function(){
  if(!globalThis.HTMLDialogElement?.prototype.showModal)return;
  const dialog=document.createElement('dialog');
  dialog.id='building-upgrade';
  dialog.setAttribute('aria-labelledby','building-upgrade-title');
  dialog.innerHTML='<h2 id="building-upgrade-title"></h2><p class="upgrade-detail"></p><p class="upgrade-status" role="status" hidden></p><footer><button type="button" id="building-upgrade-cancel" autofocus>Cancel</button><button type="button" id="building-upgrade-confirm">Upgrade</button></footer>';
  const style=document.createElement('style');
  style.textContent=`
    #building-upgrade{box-sizing:border-box;max-width:none;inset:0;margin:0;padding:16px;overflow:auto;overscroll-behavior:contain;border:1px solid var(--menu-border);border-radius:14px;background:var(--menu-panel);color:var(--menu-text);font:15px/1.4 system-ui,sans-serif}
    #building-upgrade::backdrop{background:#161c375c}
    #building-upgrade h2{margin:0;font-size:20px;line-height:1.2}
    #building-upgrade p{margin:9px 0 0}
    #building-upgrade .upgrade-status{color:#812622}
    #building-upgrade footer{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;margin-top:14px}
    #building-upgrade button{min-height:44px;min-width:44px;padding:6px 12px;border:1px solid var(--menu-border);border-radius:8px;background:var(--menu-button);color:inherit;font:inherit;touch-action:manipulation;cursor:pointer}
    #building-upgrade-confirm{background:linear-gradient(#fffde6,#f4db90)!important;font-weight:700!important}
    #building-upgrade button:disabled{opacity:.55;cursor:default}
    #building-upgrade button:focus-visible{outline:3px solid var(--menu-focus);outline-offset:2px}
  `;
  document.head.append(style);document.body.append(dialog);
  const title=dialog.querySelector('h2'),detail=dialog.querySelector('.upgrade-detail'),status=dialog.querySelector('.upgrade-status');
  const cancel=dialog.querySelector('#building-upgrade-cancel'),confirm=dialog.querySelector('#building-upgrade-confirm');
  const dollars=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
  const reasons={
    space:'The larger building needs more clear space on this site. You can choose another location in Buildings.',
    funds:'You need more cash to upgrade this building.',
    changed:'The site or price changed. Open Upgrade in place again for a new quote.',
    unavailable:'This building cannot be upgraded right now.',
  };
  let selection=null;
  function size(){
    if(!dialog.open)return;
    const b=Module.getScreenBounds();
    const left=b.left+b.safe.left+12,top=b.top+b.safe.top+12;
    const width=Math.max(0,b.width-b.safe.left-b.safe.right-24),height=Math.max(0,b.height-b.safe.top-b.safe.bottom-24);
    dialog.style.width=Math.min(390,width)+'px';dialog.style.maxHeight=height+'px';
    dialog.style.left=left+(width-dialog.offsetWidth)/2+'px';dialog.style.top=top+(height-dialog.offsetHeight)/2+'px';
  }
  function warning(reason){
    status.textContent=reason?(reasons[reason]||reasons.unavailable):'';
    status.hidden=!status.textContent;size();
  }
  function dismiss(){
    selection=null;
    if(dialog.open)dialog.close();
  }
  cancel.onclick=dismiss;
  confirm.onclick=()=>{
    if(!selection||confirm.disabled||Module.menuQueue.length>=16)return;
    confirm.disabled=cancel.disabled=true;
    Module.menuQueue.push([23,selection.serial]);
  };
  dialog.addEventListener('cancel',event=>{event.preventDefault();if(!cancel.disabled)dismiss();});
  for(const type of ['pointerdown','pointerup','pointermove','pointercancel','mousedown','mouseup','click','touchstart','touchmove','touchend','wheel','keydown','keyup','keypress'])
    dialog.addEventListener(type,event=>event.stopPropagation());
  addEventListener('simgolf-screen-resize',size);
  addEventListener('simgolf-ruleset-change',dismiss);
  Module.requestBuildingUpgrade=kind=>{
    if(dialog.open||!Module.hasGameFeature('buildingUpgrades')||Module.menuQueue.length>=16||
        Module.menuQueue.some(([command])=>command===22||command===23))return false;
    Module.cancelMapGesture();
    Module.menuQueue.push([22,kind]);return true;
  };
  Module.openBuildingUpgrade=quote=>{
    const building=Module.mobileState?.buildingDetails?.find(item=>item.kind===quote.kind);
    if(dialog.open||!building||!Module.hasGameFeature('buildingUpgrades'))return false;
    selection=quote;
    title.textContent='Upgrade '+building.name+'?';
    detail.textContent=quote.side>0?'The upgraded building needs '+quote.side+' × '+quote.side+' tiles at this site.':'';
    confirm.textContent=quote.price>0?'Upgrade for '+dollars.format(quote.price):'Upgrade';
    confirm.disabled=!quote.affordable||!!quote.reason;cancel.disabled=false;
    warning(quote.reason);
    dialog.showModal();size();
    return true;
  };
  Module.finishBuildingUpgrade=result=>{
    if(result.status==='success'){
      dismiss();
      Module.showEditionNotice?.('Building upgraded.');
    }else if(dialog.open){
      confirm.disabled=true;cancel.disabled=false;warning(result.reason||'unavailable');
    }else Module.showEditionNotice?.(reasons[result.reason]||reasons.unavailable);
  };
})();


// The native hole-stat modal still computes/formats every displayed value.
// Reflow its text over a retained full-size map, independent of800x600 UI fit.
(function(){
  const root=document.createElement('section');root.id='mobile-hole-stats';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-label','Hole statistics');root.setAttribute('aria-modal','true');
  const style=document.createElement('style');style.textContent=`
    #mobile-hole-stats[hidden]{display:none!important}
    body.mobile-hole-stats-open :is(#canvas,#map-display,#mobile-ui,#mobile-mode-rail,#mobile-cancel,#mobile-open-hole,#local-title-actions){visibility:hidden!important}
    #mobile-hole-stats{position:fixed;z-index:80;overflow:hidden;isolation:isolate;color:var(--menu-text);font:18px/1.2 OriginalWorldMenu,system-ui,sans-serif}
    #hole-stats-map{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:auto}
    #hole-stats-sheet{position:absolute;right:max(8px,env(safe-area-inset-right));left:max(8px,env(safe-area-inset-left));bottom:max(8px,env(safe-area-inset-bottom));max-height:58%;display:flex;flex-direction:column;box-sizing:border-box;border:2px solid #67628e;border-radius:20px 10px 26px 10px;padding:10px;background:#9e9ec8f5;box-shadow:inset 0 2px 3px #f1f1ff,0 3px 12px #1c254144;container-type:inline-size}
    #hole-stats-sheet header{display:flex;align-items:center;gap:8px;flex:none}
    #hole-stats-title{flex:1;min-width:0;margin:0;padding:8px 12px;border:1px solid #67628e;border-radius:22px;background:#fff9e8;font-size:clamp(21px,4cqw,27px);font-weight:normal;overflow-wrap:break-word}
    #mobile-hole-stats button{font:inherit;color:var(--menu-text);background:var(--menu-button);border:1px solid var(--menu-border);min-height:44px;padding:7px 14px;border-radius:24px;touch-action:manipulation}
    #mobile-hole-stats button:focus-visible{outline:3px solid var(--menu-focus);outline-offset:2px}
    #mobile-hole-stats button:disabled{opacity:.6}
    #hole-stats-close{width:44px;flex:none;padding:0!important;font:28px system-ui!important;border-radius:50%!important}
    #hole-stats-content{overflow-anchor:none;overflow:auto;overscroll-behavior:contain;touch-action:pan-y;min-height:0;margin-top:10px;padding:2px}
    #hole-stats-fields{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}
    #hole-stats-fields dl{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:7px 4px;margin:0;align-items:stretch;font-size:17px}
    #hole-stats-fields dt,#hole-stats-fields dd{display:flex;align-items:center;justify-content:center;min-width:0;min-height:46px;padding:3px 7px;box-sizing:border-box;border:1px solid #67628e;border-radius:22px;background:#c8cdf9;text-align:center;overflow-wrap:break-word;line-height:1.12}
    #hole-stats-fields dd{margin:0;background:#fff9e8}
    #hole-stats-fields dt{background-image:var(--hole-label-art,none);background-size:100% 100%}
    #hole-stats-fields dd{background-image:var(--hole-value-art,none);background-size:100% 100%}
    #hole-stats-shots{margin:12px 0;border-collapse:separate;border-spacing:3px;width:100%;table-layout:fixed;text-align:center;font-size:17px}
    #hole-stats-shots caption{text-align:left;margin:0 0 6px;padding:5px 10px;background:#c8cdf9;border:1px solid #67628e;border-radius:20px;font-size:18px}
    #hole-stats-shots th,#hole-stats-shots td{padding:5px 2px;border:1px solid #67628e;border-radius:50%;background:#c8cdf9;font-weight:normal}#hole-stats-shots td{background:#fff9e8}
    #hole-stats-comments-title{font-size:18px;font-weight:normal;margin:10px 0 0;padding:4px 12px;width:fit-content;border:1px solid #67628e;border-radius:22px;background:#c8cdf9;position:relative;z-index:1}
    #hole-stats-comments{background:#fff9e8;box-shadow:inset 0 0 0 3px #d6d6f3;margin:-4px 0 0;padding:12px 14px 10px;list-style:none;font-size:18px;line-height:1.25;text-align:center}
    #hole-stats-feedback-note{margin:6px 10px 0;font:14px/1.35 system-ui,sans-serif}
    #hole-stats-comments li+li{margin-top:8px}#hole-stats-comments .good{color:#155239}#hole-stats-comments .poor{color:#9b241d}
    #hole-stats-sheet footer{display:flex;justify-content:flex-end;flex:none;padding-top:8px}
    @media(min-width:700px) and (min-aspect-ratio:1/1){#hole-stats-sheet{left:auto;top:var(--hole-header-space,30px);bottom:auto;width:min(480px,48%);max-height:calc(100% - var(--hole-header-space,30px) - max(8px,env(safe-area-inset-bottom)))}}
    @container(max-width:400px){#hole-stats-fields dl{font-size:15px;gap:5px 3px}#hole-stats-fields dt,#hole-stats-fields dd{padding:3px 4px}#hole-stats-comments{font-size:17px}}
  `;document.head.append(style);
  const map=document.createElement('canvas');map.id='hole-stats-map';map.setAttribute('aria-hidden','true');
  const sheet=document.createElement('div');sheet.id='hole-stats-sheet';const head=document.createElement('header'),title=document.createElement('h1');title.id='hole-stats-title';const close=document.createElement('button');close.id='hole-stats-close';close.textContent='×';close.setAttribute('aria-label','Close hole statistics');head.append(title,close);
  const content=document.createElement('div');content.id='hole-stats-content';const fields=document.createElement('div');fields.id='hole-stats-fields';const shots=document.createElement('table');shots.id='hole-stats-shots';const commentsTitle=document.createElement('h2');commentsTitle.id='hole-stats-comments-title';commentsTitle.textContent='Comments';const comments=document.createElement('ul');comments.id='hole-stats-comments';  const feedbackNote=document.createElement('p');feedbackNote.id='hole-stats-feedback-note';feedbackNote.hidden=true;
  feedbackNote.textContent='The score table counts completed holes. Comment percentages use the game’s tee-shot count. Reactions can include repeat visits, earlier seasons, and earlier layouts.';
  content.append(fields,shots,commentsTitle,comments,feedbackNote);
  const footer=document.createElement('footer'),done=document.createElement('button');done.id='hole-stats-done';done.textContent='✓ Done';footer.append(done);sheet.append(head,content,footer);root.append(map,sheet);document.body.append(root);
  let artwork=false,last='',endAt=0,beforePixels=0,background=null;
  Module.holeStatsQueue=[];
  function bounds(){if(root.hidden)return;const b=Module.getScreenBounds(),header=document.getElementById('build-header').getBoundingClientRect().bottom;root.style.left=b.left+'px';root.style.top=b.top+'px';root.style.width=b.width+'px';root.style.height=b.height+'px';root.style.setProperty('--hole-header-space',Math.max(8,header-b.top+8)+'px');}
  function cropArt(source,x,y,w,h){const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(source,x,y,w,h,0,0,w,h);return 'url('+c.toDataURL()+')';}
  function art(){if(artwork)return;try{const source=Module.originalMenuArt.pcx('infoscreens/HoleSTAT');sheet.style.setProperty('--hole-label-art',cropArt(source,180,78,105,20));sheet.style.setProperty('--hole-value-art',cropArt(source,295,78,120,20));artwork=true;Module.holeStatsArtwork={ready:true,source:'user-imported-originals',font:document.fonts.check('18px OriginalWorldMenu')?'original-ttf':'fallback'};}catch(e){Module.holeStatsArtwork={ready:false,error:String(e),source:'css-fallback'};}}
  Module.beginHoleStats=function(hole,serial){
    const source=document.getElementById('map-display'),b=Module.getScreenBounds();
    try{
      const visible=source&&!source.hidden&&source.width>0?source:Module.canvas,r=visible.getBoundingClientRect();if(!visible.width||!r.width||!b.width)return false;
      background={bounds:b,rect:r.toJSON(),source:visible.id,width:visible.width,height:visible.height};
      // Copy before the native modal can switch the source canvas to UI fit.
      map.width=Math.max(1,Math.round(b.width*2));map.height=Math.max(1,Math.round(b.height*2));const g=map.getContext('2d',{alpha:false});g.fillStyle='#000';g.fillRect(0,0,map.width,map.height);g.drawImage(visible,(r.left-b.left)*2,(r.top-b.top)*2,r.width*2,r.height*2);
      beforePixels=Module.panVisual?.pixelSerial||0;Module.cancelMapGesture();Module.holeStatsQueue=[];Module.holeStatsDraft=[];Module.holeStats={active:true,hole,serial,frame:0,lines:[],background};endAt=0;last='';title.textContent='HOLE STATS for Hole '+hole;close.disabled=done.disabled=false;fields.replaceChildren();shots.hidden=true;comments.replaceChildren();feedbackNote.hidden=true;root.hidden=false;document.body.classList.add('mobile-hole-stats-open');bounds();content.scrollTop=0;art();analytics.hidden=!Module.hasGameFeature?.('courseAnalytics');return true;
    }catch(e){Module.holeStatsError=String(e);return false;}
  };
  function dismiss(){const s=Module.holeStats;if(!s?.active||s.busy||Module.holeStatsQueue.length)return;s.busy=true;close.disabled=done.disabled=true;Module.holeStatsQueue.push([s.serial,1]);}
  close.onclick=done.onclick=dismiss;
  let press=null,multi=false;
  root.addEventListener('pointerdown',e=>{if(press){multi=true;return;}multi=false;press={id:e.pointerId,x:e.clientX,y:e.clientY,background:e.target===map};});
  root.addEventListener('pointerup',e=>{const p=press;press=null;if(p&&!multi&&p.id===e.pointerId&&p.background&&e.target===map&&Math.hypot(p.x-e.clientX,p.y-e.clientY)<8)dismiss();});root.addEventListener('pointercancel',()=>{press=null;multi=false;});
  root.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();dismiss();}});
  for(const type of ['pointerdown','pointerup','pointermove','pointercancel','mousedown','mouseup','mousemove','click','touchstart','touchmove','touchend','touchcancel','wheel','keydown','keyup','keypress'])root.addEventListener(type,e=>e.stopPropagation());
  const text=(tag,value)=>{const e=document.createElement(tag);e.textContent=value;return e;};
  Module.renderHoleStats=function(s){
    if(root.hidden||!s.active)return;const scrollTop=content.scrollTop,rows=s.lines||[],stamp=JSON.stringify(rows);if(stamp===last)return;last=stamp;const heading=rows.find(r=>r.y===48);if(heading)title.textContent=heading.text;
    fields.replaceChildren();const summary=[];
    for(const x of [190,441]){const dl=document.createElement('dl');for(const label of rows.filter(r=>r.x===x&&!r.centered&&r.y<160).sort((a,b)=>a.y-b.y)){const value=rows.find(r=>r.centered&&r.y===label.y&&r.x>(x===190?300:500)&&r.x<(x===190?400:650));dl.append(text('dt',label.text),text('dd',value?.text||'—'));summary.push({label:label.text,value:value?.text||'—'});}fields.append(dl);}
    const shotRows=rows.filter(r=>r.centered&&r.y>=160&&r.y<202).sort((a,b)=>a.x-b.x||a.y-b.y),xs=[...new Set(shotRows.map(r=>r.x))];shots.replaceChildren();shots.append(text('caption','Completed-hole scores'));const labels=document.createElement('tr'),counts=document.createElement('tr');for(const x of xs){const pair=shotRows.filter(r=>r.x===x).sort((a,b)=>a.y-b.y);labels.append(text('th',pair[0]?.text||'—'));counts.append(text('td',pair[1]?.text||'—'));}const thead=document.createElement('thead'),tbody=document.createElement('tbody');thead.append(labels);tbody.append(counts);shots.append(thead,tbody);shots.hidden=!xs.length;
    comments.replaceChildren();const originalComments=rows.filter(r=>r.centered&&r.x===400&&r.y>=220);for(const row of originalComments){const li=text('li',row.text),c=row.color&32767,red=(c>>10)&31,green=(c>>5)&31;li.className=green>red+5?'good':red>green+5?'poor':'';comments.append(li);}if(!originalComments.length)comments.append(text('li','No golfer comments recorded yet.'));
    feedbackNote.hidden=!originalComments.length;
    s.presentation={layout:'responsive-original-elements',summary,comments:originalComments.map(r=>r.text),shotColumns:xs.length};bounds();content.scrollTop=scrollTop;
  };
  const analytics=document.createElement('button');analytics.id='hole-stats-analytics';analytics.textContent='Analytics';analytics.type='button';
  root.querySelector('footer').append(analytics);analytics.onclick=()=>{if(!Module.hasGameFeature?.('courseAnalytics'))return;Module.pendingHoleAnalytics=Module.holeStats?.hole;dismiss();};
  Module.endHoleStats=function(serial){const s=Module.holeStats;if(s?.serial!==serial)return;s.active=false;s.closing=true;endAt=performance.now();Module.holeStatsQueue=[];};
  function refresh(){if(root.hidden)return;bounds();const s=Module.holeStats;if(!s?.active&&Module.mobileState?.course&&Module.mapPresentation?.course&&!Module.uiPresentation&&!document.getElementById('map-display')?.hidden&&((Module.panVisual?.pixelSerial||0)>beforePixels||performance.now()-endAt>1200)){root.hidden=true;document.body.classList.remove('mobile-hole-stats-open');Module.holeStats=null;Module.refreshCanvasPresentation();if(Module.pendingHoleAnalytics){const hole=Module.pendingHoleAnalytics;Module.pendingHoleAnalytics=null;Module.openCourseAnalytics?.(hole);}}}
  setInterval(refresh,60);for(const event of ['resize','simgolf-screen-resize','simgolf-header-resize'])addEventListener(event,refresh);
})();

// Course Review uses a single read-only snapshot per opening.
(function(){
  if(!Module.mobileMap||!globalThis.HTMLDialogElement?.prototype.showModal)return;
  const root=document.createElement('dialog');root.id='course-review';root.setAttribute('aria-labelledby','course-review-title');
  root.innerHTML='<header><h2 id="course-review-title">Course Review</h2><button type="button" id="course-review-close" autofocus>Close</button></header><div class="course-review-body"></div>';
  const close=root.querySelector('button'),body=root.querySelector('.course-review-body');
  const style=document.createElement('style');style.textContent=`
    #course-review{box-sizing:border-box;inset:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));width:min(680px,calc(100% - max(12px,env(safe-area-inset-left)) - max(12px,env(safe-area-inset-right))));max-height:calc(100dvh - max(12px,env(safe-area-inset-top)) - max(12px,env(safe-area-inset-bottom)));padding:0;overflow:auto;overscroll-behavior:contain;border:1px solid var(--menu-border);border-radius:14px;background:var(--menu-bg);color:var(--menu-text);font:15px/1.4 system-ui,sans-serif}
    #course-review::backdrop{background:#161c3780}
    #course-review header{position:sticky;top:0;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;background:var(--menu-panel);border-bottom:1px solid var(--menu-border)}
    #course-review h2{margin:0;font-size:clamp(18px,4vw,24px)}
    #course-review button{min-height:44px;padding:6px 10px;border:1px solid var(--menu-border);border-radius:8px;background:var(--menu-button);color:inherit;font:inherit;touch-action:manipulation;cursor:pointer}
    #course-review .course-review-body{padding:8px 12px 12px}
  `;
  document.head.append(style);document.body.append(root);
  let view=null;
  Module.canOpenCourseReview=()=>!!(Module.hasGameFeature?.('courseReview')&&Module.canInspectCareerCourse?.());
  function hide(){
    Module.courseReviewOpen=false;
    root.close();
  }
  Module.closeCourseReview=()=>{
    if(!view)return;
    if(view.analytics)Module.cancelPendingCourseAnalytics(view.analytics);
    view=null;
    if(root.open){
      hide();
      document.getElementById('mobile-menu')?.focus({preventScroll:true});
    }
    body.replaceChildren();
  };
  function openHole(feature,hole,button){
    const source=view;
    if(!source||!root.open||source.analytics)return;
    let scroll=0;
    const context=Module.courseHoleContext(hole,'courseReview',feature,()=>{
      if(view!==source||!Module.canOpenCourseReview())return false;
      Module.refreshCourseReviewActions(body);
      root.showModal();Module.courseReviewOpen=true;
      (button.disabled?button.closest('details').querySelector('summary'):button).focus({preventScroll:true});
      root.scrollTop=scroll;return true;
    });
    context.leave=()=>{
      source.analytics=null;
      if(view!==source||!root.open||!context.valid())return false;
      scroll=root.scrollTop;hide();return true;
    };
    if(feature==='courseAnalytics'){
      if(Module.openCourseAnalytics(hole,context))source.analytics=context;
    }else if(!Module.courseDesignLabHoleIssue(hole)&&context.leave()&&!Module.openCourseDesignLab(hole,context))
      context.back();
  }
  Module.openCourseReview=()=>{
    if(root.open||!Module.canOpenCourseReview()||!Module.renderCourseReview)return false;
    view={};
    Module.renderCourseReview(body,Module.captureCourseReview?.(),{action:openHole});
    root.showModal();Module.courseReviewOpen=true;root.scrollTop=0;return true;
  };
  close.onclick=Module.closeCourseReview;
  root.addEventListener('cancel',event=>{event.preventDefault();Module.closeCourseReview();});
  root.addEventListener('close',()=>{if(!root.open&&Module.courseReviewOpen)Module.closeCourseReview();});
  addEventListener('simgolf-ruleset-change',Module.closeCourseReview);
  for(const type of ['pointerdown','pointerup','pointermove','pointercancel','mousedown','mouseup','mousemove',
    'click','dblclick','touchstart','touchmove','touchend','touchcancel','wheel','keydown','keyup','keypress'])
    root.addEventListener(type,event=>event.stopPropagation());
})();

// Year-end: reflow only text already formatted by the original annual loop.
// The trophy room reflows the original achievements and saved photos.
(function(){
  const root=document.createElement('section');root.id='mobile-progress-screen';root.hidden=true;root.tabIndex=-1;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');
  const style=document.createElement('style');style.textContent=`
    @font-face{
      font-family:'Barlow Condensed';src:url('icons/barlow-condensed-bold.woff2') format('woff2');
      font-style:normal;font-weight:700;font-display:swap
    }
    /* Keep the lip and pedestal proportional while the inscription surface grows. */
    .career-trophy{
      box-sizing:border-box;min-height:94.27cqi;padding:14cqi 9% 44cqi;
      border:0 solid transparent;
      border-image:url('icons/top-designers-trophy.png') 100 0 408 0 fill;
      border-image-width:13.02cqi 0 53.125cqi 0
    }
    #mobile-progress-screen[hidden],#mobile-progress-screen [hidden]{display:none!important}
    body.mobile-progress-open :is(#canvas,#map-display,#mobile-ui,#mobile-mode-rail,#mobile-cancel,#mobile-open-hole,#local-title-actions){visibility:hidden!important}
    #mobile-progress-screen{position:fixed;z-index:80;overflow:hidden;isolation:isolate;color:var(--menu-text);font:18px/1.25 OriginalWorldMenu,system-ui,sans-serif}
    #progress-map{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
    #year-report-area{
      --year-logo-size:clamp(44px,11vw,64px);--year-corner-space:0px;
      position:absolute;inset:var(--progress-top,22px) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
      box-sizing:border-box;display:flex;align-items:center;justify-content:center;
      padding:calc(8px + var(--year-corner-space));pointer-events:none
    }
    #year-report-area.has-emblem{--year-corner-space:calc(var(--year-logo-size)/2)}
    #year-report-frame{position:relative;display:flex;flex-direction:column;width:min(590px,100%);max-height:100%;min-height:0}
    #year-report-logo{
      position:absolute;z-index:1;top:0;left:0;width:var(--year-logo-size);height:var(--year-logo-size);
      transform:translate(-50%,-50%);object-fit:contain;pointer-events:none;image-rendering:pixelated
    }
    #year-report{
      font-size:15px;
      box-sizing:border-box;display:flex;flex:1 1 auto;flex-direction:column;min-height:0;overflow:hidden;color:var(--menu-text);pointer-events:auto;
      border:1px solid var(--menu-border);border-radius:18px;background:linear-gradient(#fffef0,#ece7d4);box-shadow:0 6px 28px #30304b55
    }
    #year-report header{display:flex;align-items:center;gap:10px;flex:none;padding:12px 14px;color:var(--menu-text);background:linear-gradient(115deg,var(--menu-button),var(--menu-panel));border-bottom:3px solid var(--menu-line)}
    #year-report header>div{min-width:0;flex:1}
    #year-report .year-kicker{margin:0 0 3px;color:var(--menu-muted);font:700 10px/1.25 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase}
    #year-report h1{margin:0;font-size:clamp(18px,4vw,23px);line-height:1.1;font-weight:normal;overflow-wrap:break-word}
    #year-report button{box-sizing:border-box;flex:none;min-height:44px;min-width:44px;cursor:pointer;font:inherit;touch-action:manipulation}
    #year-report button:disabled{opacity:.65;cursor:wait}
    #year-report-close{border:1px solid var(--menu-border);border-radius:50%;padding:0;color:var(--menu-text);background:var(--menu-button);font:26px/1 system-ui,sans-serif!important}
    #year-report-content{overflow-anchor:none;overflow:auto;overscroll-behavior:contain;touch-action:pan-y;min-height:0;padding:9px 12px 12px;scrollbar-color:var(--menu-border) transparent}
    #year-report table{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;text-align:center;font-variant-numeric:tabular-nums}
    #year-report thead th{padding:6px 3px;color:var(--menu-muted);font:700 10px/1.2 system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase}
    #year-report thead th:first-child{width:48%;padding-left:7px;text-align:left}
    #year-report thead th:nth-child(2){color:var(--menu-accent)}
    #year-report tbody :is(th,td){padding:8px 4px;border-top:1px solid #ded9e7;background:#fffef0;overflow-wrap:anywhere;font-weight:normal}
    #year-report tbody th{padding-left:7px;text-align:left;font-size:clamp(12px,3.25vw,14px);line-height:1.2}
    #year-report .year-metric{display:flex;align-items:center;gap:8px}
    #year-report .year-metric svg{box-sizing:border-box;flex:none;width:32px;height:32px;padding:6px;border:1px solid #c2bddb;border-radius:50%;color:var(--menu-accent);background:var(--menu-button)}
    #year-report tbody td{font-size:clamp(13px,3.5vw,17px);line-height:1.05}
    #year-report .year-current{color:var(--menu-text);background:var(--menu-preview)}
    #year-report .year-previous{color:var(--menu-muted)}
    #year-report .improved{color:#155239}
    #year-report .declined{color:#9b241d}
    #year-report :is(.improved,.declined) span::before{
      display:inline-block;width:0;height:0;margin:0 4px .14em 0;content:"";
      border-left:4px solid transparent;border-right:4px solid transparent;border-bottom:6px solid currentColor
    }
    #year-report .declined span::before{border-bottom:0;border-top:6px solid currentColor}
    #year-report .year-highlights{margin-top:12px;padding:10px 12px;border:1px solid #ded9e7;border-radius:12px;background:#fffef0}
    #year-report h2{margin:0;color:var(--menu-text);font-size:16px;font-weight:normal}
    #year-highlights{margin:5px 0 0;padding-left:19px;font-size:14px;line-height:1.35}
    #year-highlights li+li{margin-top:7px}
    #year-report #year-course-review .course-review-results{font-size:13px}
    #year-report #year-course-review h3,#year-report #year-course-review .course-review-metrics dd{font-size:14px}
    #year-report #year-course-review h4,#year-report #year-course-review .course-review-note{font-size:12px}
    #year-report footer{
      display:flex;justify-content:flex-end;flex:none;padding:7px 12px 8px;border-top:1px solid #ded9e7;
      background:linear-gradient(#fffef0e8,#ece7d4f7),var(--year-label-art,none) center/auto 100% #ece7d4
    }
    #year-report-done{min-width:118px;border:1px solid var(--menu-border);border-radius:10px;padding:6px 15px;color:var(--menu-text);background:linear-gradient(#fffde6,#f4db90)}
    #year-report button:focus-visible{outline:3px solid var(--menu-focus);outline-offset:2px}
    #trophy-room-done:focus-visible{outline:3px solid #fff4ad;outline-offset:2px}
    #mobile-progress-screen.trophy{background:var(--trophy-wood,#402014);background-size:cover;background-position:center}
    #trophy-room{position:absolute;display:block;image-rendering:auto;touch-action:none}
    #trophy-room-done{position:absolute;min-width:44px;min-height:44px;padding:0;border:0;background:transparent;box-shadow:none;touch-action:manipulation;cursor:pointer}
    #mobile-progress-screen.trophy-responsive{background:#2b1f16;color:#f7e4b9}
    body:has(#trophy-room-responsive:not([hidden])) #build-header{visibility:hidden}
    #trophy-room-responsive{
      --room-oak:url('icons/top-designers-oak.png');
      --room-brass:linear-gradient(115deg,#c39854,#f5d994 53%,#c99d53);
      position:absolute;inset:var(--room-safe);display:flex;flex-direction:column;overflow:hidden;
      font:700 16px/1.15 'Barlow Condensed','Arial Narrow',system-ui,sans-serif;
      background:linear-gradient(90deg,#27190e55,transparent 13%,transparent 87%,#27190e55),
        var(--room-oak) center/270px #493426
    }
    #trophy-room-responsive header,#trophy-room-responsive footer{
      flex:none;display:flex;justify-content:center;padding:7px clamp(8px,2vw,16px);
      background:linear-gradient(#63463160,#37271dc0),var(--room-oak) center/240px;
      box-shadow:0 2px 6px #261a1070;z-index:1
    }
    #trophy-room-responsive header{container-type:inline-size}
    #trophy-room-responsive h1{
      margin:0;padding:5px clamp(5px,3cqi,14px);border:1px solid #bd9658;border-radius:7px;text-align:center;
      background:var(--room-brass);color:#2b1c0e;box-shadow:inset 0 0 0 1px #fff2bb60,0 2px 3px #24180e;
      font:inherit;font-size:clamp(14px,min(5vw,5.85cqi),30px);line-height:1.02;letter-spacing:.035em;overflow-wrap:normal;text-transform:uppercase
    }
    #trophy-room-content{
      container-type:inline-size;min-height:0;flex:1;overflow:auto;padding:10px clamp(7px,2vw,18px) 14px;
      overscroll-behavior:contain;touch-action:pan-y;scrollbar-color:#9e7d57 #36261a
    }
    .trophy-room-cabinet{
      display:grid;grid-template-areas:'cup' 'photos' 'notes';align-items:start;gap:11px;
      max-width:1100px;margin:auto
    }
    .trophy-room-display{
      grid-area:cup;display:grid;justify-items:center;padding:0 3px 8px;
      border-bottom:6px solid #5d402d;box-shadow:0 3px 4px #26190e65
    }
    .trophy-room-cup-frame{container-type:inline-size;width:min(78%,285px);min-width:0}
    #trophy-room-cup{
      display:grid;place-items:center;margin-bottom:-4cqi;
      min-height:calc(82cqi + var(--trophy-growth-rows,0) * clamp(11px,5.3cqi,16px))
    }
    #trophy-room-achievements{
      list-style:none;margin:0;padding:0;width:100%;text-align:center;color:#291c0e;
      font-size:clamp(15px,7.1cqi,22px);line-height:1.03;overflow-wrap:anywhere;
      text-shadow:0 1px #ffe59c88
    }
    #trophy-room-achievements li{padding:.14em 0}
    #trophy-room-achievements .newest{text-decoration:underline;text-underline-offset:.16em}
    #trophy-room-photos{
      grid-area:photos;min-width:0;display:grid;grid-auto-flow:column;grid-auto-columns:calc((100% - 9px)/2);gap:9px;
      padding:5px 0;overflow:auto;overscroll-behavior-inline:contain;scroll-snap-type:inline proximity;
      touch-action:pan-x pan-y;scrollbar-color:#9e7d57 #36261a
    }
    #trophy-room-photos:focus-visible{outline:2px solid #fbe4a6;outline-offset:2px}
    .trophy-room-photo{
      position:relative;min-width:0;margin:0;padding:6px 5px 5px;scroll-snap-align:start;border:1px solid #c4bda6;border-radius:2px;
      background:#fcf5df;color:#2e2a20;box-shadow:1px 3px 5px #23170dcc;text-align:center
    }
    .trophy-room-photo::before,.trophy-room-note::before{
      content:'';position:absolute;z-index:1;top:-4px;left:50%;width:9px;height:9px;border-radius:50%;
      background:radial-gradient(circle at 34% 30%,#fff2a5,#d7a820 65%,#916a18);box-shadow:1px 1px 2px #21160d9c
    }
    .trophy-room-photo:nth-child(2n)::before{
      background:radial-gradient(circle at 34% 30%,#f3a2ab,#bc3155 65%,#75243c)
    }
    .trophy-room-photo canvas,.trophy-room-photo-missing{
      display:block;width:100%;height:auto;aspect-ratio:5/4;object-fit:contain;background:#dbd0b3
    }
    #trophy-room-photos canvas{touch-action:auto}
    .trophy-room-photo-missing{display:grid;place-items:center;padding:3px;box-sizing:border-box;font-size:13px}
    .trophy-room-photo figcaption{margin-top:3px;font:600 clamp(10px,2.8cqi,13px)/1.2 system-ui,sans-serif;overflow-wrap:anywhere}
    .trophy-room-side{grid-area:notes;display:flex;gap:8px;align-items:end;min-width:0}
    .trophy-room-props{display:block;width:min(46%,146px);height:auto;object-fit:contain}
    .trophy-room-note{
      position:relative;min-width:0;flex:1;padding:9px 8px;background:#f1e184;color:#68331d;
      border-radius:2px;box-shadow:1px 3px 5px #24180e99;overflow-wrap:anywhere
    }
    .trophy-room-note h2{margin:0;color:#2b4b2c;font:inherit;font-size:18px}
    .trophy-room-note ul{margin:4px 0 0;padding-left:15px;font:700 14px/1.2 'Chalkboard SE','Segoe Print',cursive}
    #trophy-room-responsive footer{border-top:1px solid #76553a}
    #trophy-room-continue{
      box-sizing:border-box;min-height:44px;width:min(100%,280px);padding:5px 15px;
      border:1px solid #c59d5b;border-radius:8px;background:var(--room-brass);color:#2b1c0e;
      box-shadow:inset 0 1px #fff2bd;font:inherit;font-size:21px;touch-action:manipulation;cursor:pointer
    }
    #trophy-room-continue:disabled{opacity:.65}
    #trophy-room-continue:focus-visible{outline:2px solid #fbe4a6;outline-offset:2px}
    @container (min-width:530px){
      .trophy-room-cabinet{grid-template-columns:minmax(0,1fr) minmax(0,1.15fr) minmax(0,.72fr);grid-template-areas:'photos cup notes';gap:12px}
      .trophy-room-cup-frame{width:min(100%,310px)}
      #trophy-room-photos{
        grid-auto-flow:row;grid-auto-columns:auto;grid-template-columns:repeat(2,minmax(0,1fr));
        overflow:visible;scroll-snap-type:none
      }
      .trophy-room-side{flex-direction:column-reverse;align-items:stretch}
      .trophy-room-props{width:100%;max-width:168px;align-self:center}
      .trophy-room-display{padding-inline:0}
    }
    @media(min-width:570px) and (min-aspect-ratio:1/1){
      #trophy-room-responsive footer{justify-content:flex-end}
    }
    @media(max-height:460px){
      #year-report header{padding-block:7px}
      #year-report-content{padding-block:5px}
      #year-report tbody :is(th,td){padding-block:5px}
      #year-report .year-metric svg{width:27px;height:27px;padding:5px}
      #year-report footer{padding-block:5px}
    }
    @media(max-width:400px){
      #year-report header{padding-inline:10px}
      #year-report-content{padding-inline:7px}
      #year-report .year-metric{gap:5px}
      #year-report .year-metric svg{width:26px;height:26px;padding:4px}
    }
    #year-report-area.has-emblem #year-report header{padding-left:calc(10px + var(--year-corner-space))}
  `;document.head.append(style);
  const map=document.createElement('canvas');map.id='progress-map';map.setAttribute('aria-hidden','true');
  const text=(tag,value)=>{const element=document.createElement(tag);element.textContent=value;return element;};
  const reportArea=document.createElement('div');reportArea.id='year-report-area';reportArea.hidden=true;
  const reportFrame=document.createElement('div');reportFrame.id='year-report-frame';
  const emblem=document.createElement('canvas');emblem.id='year-report-logo';emblem.hidden=true;emblem.setAttribute('aria-hidden','true');
  const report=document.createElement('section');report.id='year-report';
  const header=document.createElement('header'),headingGroup=document.createElement('div'),kicker=text('p','Club statement'),title=text('h1','End of year');
  kicker.className='year-kicker';headingGroup.append(kicker,title);
  const close=text('button','×');close.id='year-report-close';close.type='button';close.setAttribute('aria-label','Close end-of-year report');header.append(headingGroup,close);
  const content=document.createElement('div');content.id='year-report-content';
  const table=document.createElement('table');table.setAttribute('aria-label','This year and last year');
  const notes=document.createElement('section');notes.className='year-highlights';notes.hidden=true;
  const courseReview=document.createElement('div');courseReview.id='year-course-review';
  const heading=text('h2','Highlights'),highlights=document.createElement('ul');highlights.id='year-highlights';notes.append(heading,highlights);content.append(table,notes,courseReview);
  const footer=document.createElement('footer'),done=text('button','✓ Done');done.id='year-report-done';done.type='button';footer.append(done);report.append(header,content,footer);
  reportFrame.append(report,emblem);reportArea.append(reportFrame);
  const trophy=document.createElement('canvas');trophy.id='trophy-room';trophy.width=800;trophy.height=600;trophy.setAttribute('role','img');trophy.setAttribute('aria-label','Original trophy room, trophies, photographs and clubhouse notes');const trophyDone=document.createElement('button');trophyDone.id='trophy-room-done';trophyDone.setAttribute('aria-label','Close trophy room');root.append(map,reportArea,trophy,trophyDone);document.body.append(root);
  const room=document.createElement('section');room.id='trophy-room-responsive';room.hidden=true;
  const roomHeader=document.createElement('header');roomHeader.append(text('h1','Professional Accomplishments'));
  const roomContent=document.createElement('div');roomContent.id='trophy-room-content';
  const cabinet=document.createElement('div');cabinet.className='trophy-room-cabinet';
  const trophyDisplay=document.createElement('div');trophyDisplay.className='trophy-room-display';
  const trophyFrame=document.createElement('div');trophyFrame.className='trophy-room-cup-frame';
  const roomCup=document.createElement('div');roomCup.id='trophy-room-cup';roomCup.className='career-trophy';
  const achievements=document.createElement('ul');achievements.id='trophy-room-achievements';achievements.setAttribute('aria-label','Earned accomplishments');
  roomCup.append(achievements);trophyFrame.append(roomCup);trophyDisplay.append(trophyFrame);
  const photoGallery=document.createElement('div');photoGallery.id='trophy-room-photos';
  photoGallery.tabIndex=0;photoGallery.setAttribute('role','region');photoGallery.setAttribute('aria-label','Accomplishment photographs');
  const roomSide=document.createElement('div');roomSide.className='trophy-room-side';
  const props=document.createElement('img');props.className='trophy-room-props';props.alt='';props.src='icons/professional-accomplishments-props.png';
  const clubhouseNote=document.createElement('aside');clubhouseNote.className='trophy-room-note';
  const roomNotes=document.createElement('ul');roomNotes.id='trophy-room-notes';
  clubhouseNote.append(text('h2','Clubhouse Notes'),roomNotes);roomSide.append(props,clubhouseNote);
  cabinet.append(trophyDisplay,photoGallery,roomSide);roomContent.append(cabinet);
  const roomFooter=document.createElement('footer'),roomContinue=text('button','Done');
  roomContinue.id='trophy-room-continue';roomContinue.type='button';
  roomFooter.append(roomContinue);room.append(roomHeader,roomContent,roomFooter);root.append(room);

  function readSnapshotDirectory(){
    try{
      const folder=FS.readdir('/game').find(name=>name.toLowerCase()==='snapshots');
      if(folder){
        const directory='/game/'+folder;
        return new Map(FS.readdir(directory).filter(name=>/^accomp[0-9]+[.]bmp$/i.test(name))
          .map(name=>[name.toLowerCase(),directory+'/'+name]));
      }
    }catch{}
    return new Map();
  }

  // The original accomplishment snapshot format is an uncompressed 24-bit BMP.
  function savedPhoto(path){
    if(!path)return null;
    try{
      const bytes=FS.readFile(path);
      if(bytes.length<54||bytes[0]!==66||bytes[1]!==77)return null;
      const bmp=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
      const offset=bmp.getUint32(10,true),width=bmp.getInt32(18,true),rows=bmp.getInt32(22,true),height=Math.abs(rows);
      const stride=(width*3+3)&~3;
      if(bmp.getUint32(14,true)<40||bmp.getUint16(26,true)!==1||bmp.getUint16(28,true)!==24||bmp.getUint32(30,true)!==0||
          width<1||width>1024||height<1||height>1024||offset<54||offset+stride*height>bytes.length)return null;
      const photo=document.createElement('canvas');photo.width=width;photo.height=height;
      const context=photo.getContext('2d',{alpha:false}),pixels=context.createImageData(width,height);
      let i=0;
      for(let y=0;y<height;y++){
        let pixel=offset+(rows>0?height-y-1:y)*stride;
        for(let x=0;x<width;x++,pixel+=3){
          pixels.data[i++]=bytes[pixel+2];pixels.data[i++]=bytes[pixel+1];pixels.data[i++]=bytes[pixel];pixels.data[i++]=255;
        }
      }
      context.putImageData(pixels,0,0);
      return photo;
    }catch{return null;}
  }

  function showTrophyRoom(data,s){
    const snapshotPaths=readSnapshotDirectory(),earned=data.earned,loadedPhotos=[];
    roomCup.style.setProperty('--trophy-growth-rows',String(data.growthRows));
    achievements.replaceChildren();
    photoGallery.replaceChildren();
    for(const entry of earned){
      const line=text('li',entry.label);
      line.classList.toggle('newest',entry.highlighted);
      achievements.append(line);
      const frame=document.createElement('figure');frame.className='trophy-room-photo';frame.dataset.accomplishment=entry.id;
      const photo=savedPhoto(snapshotPaths.get(entry.file.toLowerCase()));
      if(photo){
        photo.setAttribute('role','img');photo.setAttribute('aria-label','Saved course photograph');
        frame.append(photo);loadedPhotos.push(entry.id);
      }else{
        const placeholder=text('span','Photo unavailable');placeholder.className='trophy-room-photo-missing';
        frame.append(placeholder);
      }
      frame.append(text('figcaption',entry.caption||entry.label));
      photoGallery.append(frame);
    }
    photoGallery.hidden=!earned.length;photoGallery.scrollLeft=0;
    roomNotes.replaceChildren(...data.notes.map(entry=>text('li',entry.label)));
    clubhouseNote.hidden=!data.notes.length;
    roomContinue.textContent=data.canAllocateSkills?'Continue to skills':'Done';
    roomContent.scrollTop=0;
    room.hidden=false;
    root.classList.add('trophy-responsive');
    s.room=data;
    s.presentation={layout:'responsive-trophy-room',loadedPhotos};
  }
  Module.progressScreenQueue=[];let beforePixels=0,endAt=0,press=null,multi=false,wood=false;
  function bounds(){
    if(root.hidden)return;const b=Module.getScreenBounds(),top=Math.max(b.top,document.getElementById('build-header').getBoundingClientRect().bottom);root.style.left=b.left+'px';root.style.top=b.top+'px';root.style.width=b.width+'px';root.style.height=b.height+'px';root.style.setProperty('--progress-top',top-b.top+'px');
    if(!room.hidden){
      room.style.setProperty('--room-safe',[b.safe.top,b.safe.right,b.safe.bottom,b.safe.left].map(value=>value+'px').join(' '));
    }else if(Module.progressScreen?.kind===2){
      const left=b.safe.left,right=b.width-b.safe.right,upper=Math.max(top-b.top,b.safe.top),bottom=b.height-b.safe.bottom,scale=Math.min((right-left)/800,(bottom-upper)/600),x=left+(right-left-800*scale)/2,y=upper+(bottom-upper-600*scale)/2;
      Object.assign(trophy.style,{left:x+'px',top:y+'px',width:800*scale+'px',height:600*scale+'px'});
      const size=Math.max(44,64*scale);Object.assign(trophyDone.style,{left:Math.max(left,Math.min(right-size,x+764*scale-size/2))+'px',top:Math.max(upper,Math.min(bottom-size,y+535*scale-size/2))+'px',width:size+'px',height:size+'px'});
      Module.progressScreen.presentation={layout:'original-scene-fit',scale,rect:{x,y,width:800*scale,height:600*scale},original:[800,600],palette:'original-unchanged'};
    }
  }
  function showReport(show){reportArea.hidden=report.hidden=!show;}
  function captureEmblem(kind){
    emblem.hidden=true;emblem.width=emblem.height=0;reportArea.classList.remove('has-emblem');
    if(kind!==1)return;
    const source=document.querySelector('#mobile-course-badge > canvas');
    if(!source?.width||!source.height||!source.getClientRects().length||getComputedStyle(source).visibility!=='visible')return;
    try{
      const context=emblem.getContext('2d');
      if(!context)return;
      emblem.width=source.width;emblem.height=source.height;context.drawImage(source,0,0);
      emblem.hidden=false;reportArea.classList.add('has-emblem');
    }catch{emblem.width=emblem.height=0;}
  }
  function dismiss(){const s=Module.progressScreen;if(!s?.active||!s.ready||s.busy||s.suspended||Module.progressScreenQueue.length)return;s.busy=true;close.disabled=done.disabled=trophyDone.disabled=roomContinue.disabled=true;Module.progressScreenQueue.push([s.serial,1]);}
  close.onclick=done.onclick=trophyDone.onclick=roomContinue.onclick=dismiss;
  root.addEventListener('pointerdown',e=>{if(press){multi=true;return;}multi=false;press={id:e.pointerId,x:e.clientX,y:e.clientY,background:e.target===map||e.target===trophy};});
  root.addEventListener('pointerup',e=>{const p=press;press=null;if(p&&!multi&&p.id===e.pointerId&&p.background&&(e.target===map||e.target===trophy)&&Math.hypot(p.x-e.clientX,p.y-e.clientY)<8)dismiss();});root.addEventListener('pointercancel',()=>{press=null;multi=false;});
  root.addEventListener('keydown',e=>{if(e.key==='Escape'||(e.key==='Enter'&&e.target===root)){e.preventDefault();dismiss();}});
  for(const type of ['pointerdown','pointerup','pointermove','pointercancel','mousedown','mouseup','mousemove','click','dblclick','touchstart','touchmove','touchend','touchcancel','wheel','keydown','keyup','keypress'])root.addEventListener(type,e=>e.stopPropagation());
  Module.beginProgressScreen=function(kind,serial){
    Module.closeCourseReview?.();
    courseReview.replaceChildren();
    const source=document.getElementById('map-display'),b=Module.getScreenBounds();
    try{
      const visible=source&&!source.hidden&&source.width>0?source:Module.canvas,r=visible.getBoundingClientRect();if(!visible.width||!r.width||!b.width)return false;
      map.width=Math.max(1,Math.round(b.width*2));map.height=Math.max(1,Math.round(b.height*2));const g=map.getContext('2d',{alpha:false});g.fillStyle='#000';g.fillRect(0,0,map.width,map.height);g.drawImage(visible,(r.left-b.left)*2,(r.top-b.top)*2,r.width*2,r.height*2);
      beforePixels=Module.panVisual?.pixelSerial||0;Module.cancelMapGesture();Module.progressScreenQueue=[];Module.progressScreen={active:true,ready:false,kind,serial,lines:[],native:[Module.canvas.width,Module.canvas.height]};endAt=0;press=null;showReport(false);captureEmblem(kind);trophy.hidden=trophyDone.hidden=room.hidden=true;map.hidden=false;table.replaceChildren();notes.hidden=true;highlights.replaceChildren();root.classList.remove('trophy','trophy-responsive');root.setAttribute('aria-label',kind===1?'End-of-year report':'Trophy room');root.hidden=false;document.body.classList.add('mobile-progress-open');bounds();content.scrollTop=0;return true;
    }catch(e){Module.progressScreenError=String(e);return false;}
  };
  const yearMetrics=[
    [115,'M20 6c0 1.7-3.6 3-8 3S4 7.7 4 6s3.6-3 8-3 8 1.3 8 3ZM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6'],
    [135,'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM8 14c1 2 2.5 3 4 3s3-1 4-3M9 9h.01M15 9h.01'],
    [155,'M10 19V3l10 4-10 4m-4 6c-2 .4-3 1-3 2 0 1.1 3 2 7 2s7-.9 7-2c0-1-1-1.6-3-2'],
    [175,'M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm-9 4a2.5 2.5 0 1 1 0-5m12 5a2.5 2.5 0 1 0 0-5M7 20v-2a5 5 0 0 1 10 0v2M2 19v-1a4 4 0 0 1 4-4m16 5v-1a4 4 0 0 0-4-4']
  ];
  function yearMetricLabel(value,path){
    const namespace='http://www.w3.org/2000/svg',icon=document.createElementNS(namespace,'svg'),glyph=document.createElementNS(namespace,'path');
    icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');icon.setAttribute('fill','none');
    icon.setAttribute('stroke','currentColor');icon.setAttribute('stroke-width','1.7');icon.setAttribute('stroke-linecap','round');icon.setAttribute('stroke-linejoin','round');
    glyph.setAttribute('d',path);icon.append(glyph);
    const label=document.createElement('th'),layout=document.createElement('span');label.scope='row';layout.className='year-metric';
    layout.append(icon,text('span',value));label.append(layout);return label;
  }
  Module.renderProgressScreen=function(serial,address,stride,roomData){
    const s=Module.progressScreen;if(!s?.active||s.serial!==serial)return;
    if(s.kind===2&&roomData){
      showTrophyRoom(roomData,s);map.hidden=trophy.hidden=trophyDone.hidden=true;showReport(false);
    }else if(s.kind===2){
      const pixels=new ImageData(800,600),heap=new Uint16Array(Module.HEAPU8.buffer);let k=0;for(let y=0;y<600;y++){let p=(address>>1)+y*stride;for(let x=0;x<800;x++){const c=heap[p++];pixels.data[k++]=((c>>10)&31)*255/31;pixels.data[k++]=((c>>5)&31)*255/31;pixels.data[k++]=(c&31)*255/31;pixels.data[k++]=255;}}trophy.getContext('2d').putImageData(pixels,0,0);
      if(!wood)try{const original=Module.originalMenuArt.pcx('bulletinboard&mantlewood'),wall=document.createElement('canvas');wall.width=original.width;wall.height=Math.min(120,original.height);wall.getContext('2d').drawImage(original,0,0,wall.width,wall.height,0,0,wall.width,wall.height);root.style.setProperty('--trophy-wood','url('+wall.toDataURL()+')');wood=true;}catch(e){Module.trophyArtworkError=String(e);}
      root.classList.add('trophy');map.hidden=true;trophy.hidden=trophyDone.hidden=false;showReport(false);
    }else{
      const rows=s.lines,thead=document.createElement('thead'),body=document.createElement('tbody'),periods=document.createElement('tr');
      title.textContent=rows.find(r=>r.y===55)?.text||'End of year';s.summary=[];
      for(const name of ['Metric',rows.find(r=>r.x===465&&r.y===93)?.text||'This Year',rows.find(r=>r.x===566&&r.y===93)?.text||'Last Year']){
        const period=text('th',name);period.scope='col';periods.append(period);
      }
      thead.append(periods);
      for(const [y,path] of yearMetrics){
        const label=rows.find(r=>r.x===301&&r.y===y);
        if(!label)continue;
        const current=rows.find(r=>r.x===500&&r.y===y),previous=rows.find(r=>r.x===601&&r.y===y);
        const row=document.createElement('tr'),now=document.createElement('td'),last=text('td',previous?.text||'—');
        const color=current?.color&32767,red=(color>>10)&31,green=(color>>5)&31;
        now.classList.add('year-current');
        if(green>red+5)now.classList.add('improved');
        if(red>green+5)now.classList.add('declined');
        now.append(text('span',current?.text||'—'));last.className='year-previous';
        row.append(yearMetricLabel(label.text,path),now,last);body.append(row);
        s.summary.push({label:label.text,current:now.textContent,previous:last.textContent});
      }
      table.replaceChildren(thead,body);
      heading.textContent=rows.find(r=>r.y===200)?.text||'Highlights';highlights.replaceChildren();
      s.highlights=rows.filter(r=>r.y>200).map(r=>r.text);
      for(const value of s.highlights)highlights.append(text('li',value));
      notes.hidden=!s.highlights.length;
      try{const source=Module.originalMenuArt.pcx('infoscreens/endoyear'),c=document.createElement('canvas');c.width=220;c.height=20;c.getContext('2d').drawImage(source,190,110,220,20,0,0,220,20);report.style.setProperty('--year-label-art','url('+c.toDataURL()+')');s.artwork='user-imported-originals';}catch(e){s.artwork='css-fallback';}
      if(Module.hasGameFeature?.('courseReview'))try{
        Module.renderCourseReview?.(courseReview,Module.captureCourseReview?.(),{annual:true});
      }catch(e){s.courseReviewError=String(e);}
      s.presentation={layout:'responsive-original-elements',summary:s.summary,highlights:s.highlights};
      showReport(true);
    }
    s.ready=true;s.busy=false;close.disabled=done.disabled=trophyDone.disabled=roomContinue.disabled=false;bounds();
    (room.hidden?root:roomContinue).focus({preventScroll:true});
  };
  Module.suspendProgressScreen=function(serial){const s=Module.progressScreen;if(s?.serial!==serial)return;s.suspended=true;root.hidden=true;document.body.classList.remove('mobile-progress-open');};
  Module.endProgressScreen=function(serial){const s=Module.progressScreen;if(s?.serial!==serial)return;s.active=false;s.closing=true;endAt=performance.now();Module.progressScreenQueue=[];if(!s.suspended){showReport(false);trophy.hidden=trophyDone.hidden=room.hidden=true;map.hidden=false;root.classList.remove('trophy','trophy-responsive');}};
  function refresh(){const s=Module.progressScreen;if(!s)return;if(s.suspended&&s.active)return;if(root.hidden&&!s.active){Module.progressScreen=null;return;}if(!s.active&&Module.mobileState?.course&&Module.mapPresentation?.course&&!Module.uiPresentation&&!document.getElementById('map-display')?.hidden&&((Module.panVisual?.pixelSerial||0)>beforePixels||performance.now()-endAt>1200)){root.hidden=true;document.body.classList.remove('mobile-progress-open');Module.progressScreen=null;Module.refreshCanvasPresentation();return;}bounds();}
  setInterval(refresh,60);for(const event of ['resize','simgolf-screen-resize','simgolf-header-resize'])addEventListener(event,refresh);
})();

// Render the native standings as inscriptions on a brass trophy cabinet.
(function(){
  const root=document.createElement('dialog');
  root.id='mobile-top-designers';
  root.hidden=true;
  root.setAttribute('aria-labelledby','top-designers-title');

  const style=document.createElement('style');
  style.textContent=`
    #mobile-top-designers{
      --cabinet-ink:#24190e;--cabinet-light:#f7e4b9;--cabinet-oak:url("icons/top-designers-oak.png");
      --cabinet-brass:linear-gradient(108deg,#b48c43,#e8c878 43%,#f6dfa1 55%,#bb944c);
      position:fixed;inset:auto;box-sizing:border-box;margin:0;padding:0;border:0;
      max-width:none;max-height:none;overflow:hidden;background:#2b2017;color:var(--cabinet-light);
      font:700 16px/1.2 'Barlow Condensed','Arial Narrow',system-ui,sans-serif
    }
    #mobile-top-designers::backdrop{background:#2b2017}
    #top-designers-frame{
      box-sizing:border-box;width:100%;height:100%;display:flex;flex-direction:column;
      padding:var(--designer-safe);overflow:hidden
    }
    #top-designers-header{
      display:flex;flex:none;align-items:center;justify-content:space-between;gap:7px;
      padding:7px clamp(6px,2vw,16px);border-bottom:2px solid #37261a;
      background:linear-gradient(#654a32a0,#37271bd0),var(--cabinet-oak) center/240px;
      box-shadow:0 2px 5px #1b130f80;z-index:1
    }
    #top-designers-title{
      margin:0;padding:5px 8px;border:1px solid #d1ac64;border-radius:6px;color:var(--cabinet-ink);
      background:var(--cabinet-brass);box-shadow:inset 0 0 0 1px #f9e1aa60,0 1px 2px #1e160d;
      font:700 clamp(13px,3.85vw,25px)/1.15 'Barlow Condensed','Arial Narrow',system-ui,sans-serif;
      letter-spacing:.035em;text-transform:uppercase;overflow-wrap:anywhere
    }
    #mobile-top-designers-done{
      flex:none;min-width:54px;min-height:44px;padding:5px 9px;border:1px solid #b99761;border-radius:7px;
      background:linear-gradient(#f1d9a5,#d6b47b);color:var(--cabinet-ink);font:700 16px 'Barlow Condensed','Arial Narrow',system-ui,sans-serif;
      touch-action:manipulation;cursor:pointer;box-shadow:inset 0 1px #fff3d2
    }
    #top-designers-content{
      flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;touch-action:pan-y;
      padding:0 clamp(4px,2vw,16px) 12px;scrollbar-color:#967858 #2b2017
    }
    .top-designers-cabinet{
      container-type:inline-size;max-width:790px;margin:auto;overflow:hidden;
      border-inline:clamp(3px,1vw,9px) solid #59402b;border-radius:10px 10px 2px 2px;
      background-image:linear-gradient(90deg,#21160e42,transparent 12%,transparent 88%,#21160e42),var(--cabinet-oak);
      background-size:auto,280px auto;background-color:#493526;
      box-shadow:inset 0 3px 7px #1f160d80,0 1px 9px #1f160d80
    }
    #top-designers-benchmark-key:not([hidden]){
      display:flex;align-items:center;justify-content:center;gap:6px;margin:0;padding:6px 8px 2px;
      font-size:11px;line-height:1.15;color:var(--cabinet-light)
    }
    .top-designers-benchmark-mark{
      display:inline-block;box-sizing:border-box;width:6px;height:6px;border:1px solid currentColor;
      transform:rotate(45deg)
    }
    #top-designers-podium,#top-designers-ranks{
      display:grid;grid-template-columns:repeat(2,minmax(0,1fr));list-style:none;margin:0;padding:0
    }
    .top-designers-entry{
      min-width:0;position:relative;display:flex;align-items:flex-end;justify-content:center;
      padding:14px 3px 12px
    }
    #top-designers-podium .top-designers-entry:first-child{grid-column:1/-1}
    .top-designers-entry::after{
      content:'';position:absolute;pointer-events:none;inset:auto 0 0;height:12px;
      background:linear-gradient(180deg,#7d6047 0 1px,#674c35 1px 3px,#58402d 3px 9px,#38291f 9px);
      box-shadow:0 4px 5px #21170f65
    }
    .top-designers-details{width:min(86%,150px);min-width:0;color:var(--cabinet-ink)}
    #top-designers-podium .top-designers-details{width:min(96%,194px)}
    #top-designers-podium .top-designers-entry:first-child .top-designers-details{width:min(62%,254px)}
    .top-designers-details summary{
      display:block;position:relative;list-style:none;cursor:pointer;text-align:center;touch-action:manipulation;
      -webkit-tap-highlight-color:transparent
    }
    .top-designers-details summary::-webkit-details-marker{display:none}
    .top-designers-art-frame{
      position:relative;display:block;container-type:inline-size
    }
    .top-designers-cup{
      display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.15em;
      margin-bottom:-4cqi;font-size:clamp(10px,10cqi,19px);font-weight:700;line-height:1.05;
      white-space:nowrap;font-variant-numeric:tabular-nums
    }
    .top-designers-score{display:grid;gap:.04em;font-size:clamp(16px,17cqi,42px);line-height:1}
    .top-designers-score-label{font-size:.57em}
    #top-designers-podium .top-designers-entry:not(:first-child) .top-designers-cup{font-size:clamp(10px,9.5cqi,17px)}
    #top-designers-podium .top-designers-entry:not(:first-child) .top-designers-score{font-size:clamp(15px,16cqi,36px)}
    #top-designers-ranks .top-designers-cup{font-size:clamp(9px,9cqi,16px);gap:.13em}
    #top-designers-ranks .top-designers-score{font-size:clamp(15px,15.5cqi,32px)}
    #top-designers-ranks .top-designers-score-label{font-size:max(9px,.57em)}
    .top-designers-rank{
      position:absolute;bottom:8cqi;left:31%;right:31%;height:9.5cqi;display:grid;place-items:center;
      border-radius:2px;background:var(--cabinet-brass);box-shadow:inset 0 0 0 1px #edd39788;
      font-size:clamp(9px,8.6cqi,22px);line-height:1
    }
    .top-designers-plaque{
      position:relative;box-sizing:border-box;display:grid;gap:1px;min-height:22px;width:97%;margin:0 auto;
      padding:3px 8px;border:1px solid #a68146;border-radius:4px;background:var(--cabinet-brass);
      box-shadow:inset 0 1px #fff1bc99,0 1px 2px #241910;overflow-wrap:anywhere
    }
    .top-designers-benchmark .top-designers-plaque{padding-inline:14px}
    .top-designers-plaque .top-designers-benchmark-mark{
      position:absolute;left:5px;top:50%;transform:translateY(-50%) rotate(45deg)
    }
    .top-designers-designer{font-size:clamp(11px,3.2cqi,20px);font-weight:760;line-height:1.1}
    .top-designers-badge{font-size:clamp(8px,2.5cqi,11px);line-height:1.08;font-weight:670}
    .top-designers-current .top-designers-plaque{
      border-color:#b49252;color:#fff4d1;background:linear-gradient(110deg,#224632,#376047 55%,#224431);
      box-shadow:inset 0 0 0 1px #b9965b80,0 2px 3px #21160e
    }
    .top-designers-facts{
      display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px;margin:0;padding:6px 5px;
      background:#2f2218;color:#f7e4b9;border:1px solid #8f6b42;border-top:0;
      border-radius:0 0 4px 4px;font-size:11px;overflow-wrap:anywhere
    }
    .top-designers-facts dd{margin:0;text-align:right;font-variant-numeric:tabular-nums}
    #mobile-top-designers :focus-visible{outline:2px solid #f2d49b;outline-offset:3px}
    @container (min-width:570px){
      #top-designers-podium{grid-template-columns:repeat(3,minmax(0,1fr))}
      #top-designers-ranks{grid-template-columns:repeat(12,minmax(0,1fr))}
      #top-designers-ranks .top-designers-entry{grid-column:span 3}
      #top-designers-ranks .top-designers-entry:nth-child(-n+3){grid-column:span 4}
      #top-designers-ranks .top-designers-details{width:min(calc((100cqi / 4 - 6px) * .86),150px)}
      #top-designers-podium .top-designers-entry:first-child{grid-column:2;grid-row:1}
      #top-designers-podium .top-designers-entry:nth-child(2){grid-column:1;grid-row:1}
      #top-designers-podium .top-designers-entry:nth-child(3){grid-column:3;grid-row:1}
      #top-designers-podium .top-designers-details{width:min(76%,194px)}
      #top-designers-podium .top-designers-entry:first-child .top-designers-details{width:min(94%,254px)}
    }
    @media (max-height:420px){
      .top-designers-entry{padding-top:9px}
      #top-designers-podium .top-designers-details{max-width:144px}
      #top-designers-podium .top-designers-entry:first-child .top-designers-details{max-width:173px}
      #top-designers-ranks .top-designers-details{max-width:128px}
    }
  `;
  document.head.append(style);

  function element(tag,value,className){
    const node=document.createElement(tag);
    if(value!==undefined)node.textContent=value;
    if(className)node.className=className;
    return node;
  }
  const frame=element('div'),header=element('header'),title=element('h1','Top Ten Designers'),done=element('button','Done');
  frame.id='top-designers-frame';
  header.id='top-designers-header';
  title.id='top-designers-title';
  done.id='mobile-top-designers-done';
  done.type='button';
  done.autofocus=true;
  const content=element('div'),podium=element('ol'),ranks=element('ol');
  content.id='top-designers-content';
  podium.id='top-designers-podium';
  podium.setAttribute('aria-label','Top three designers');
  ranks.id='top-designers-ranks';
  ranks.start=4;
  ranks.setAttribute('aria-label','Ranks four through ten');
  header.append(title,done);
  const cabinet=element('div',undefined,'top-designers-cabinet');
  const benchmarkKey=element('p');
  benchmarkKey.id='top-designers-benchmark-key';
  benchmarkKey.hidden=true;
  function benchmarkMark(){
    const mark=element('span',undefined,'top-designers-benchmark-mark');
    mark.setAttribute('aria-hidden','true');
    return mark;
  }
  benchmarkKey.append(benchmarkMark(),'Original Benchmark');
  cabinet.append(benchmarkKey,podium,ranks);
  content.append(cabinet);
  frame.append(header,content);
  root.append(frame);
  document.body.append(root);

  const difficulties=['Easy','Moderate','Difficult','Impossible'];
  const number=new Intl.NumberFormat();
  const currency=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
  let resolveDismissal=null,returnFocus=null;
  function bounds(){
    if(!root.open)return;
    const b=Module.getScreenBounds();
    const {left,top,right,bottom}=b.safe;
    Object.assign(root.style,{left:b.left+'px',top:b.top+'px',width:b.width+'px',height:b.height+'px'});
    root.style.setProperty('--designer-safe',[top,right,bottom,left].map(value=>value+'px').join(' '));
  }
  function trophy(row,currentCareerId){
    const entry=element('li',undefined,'top-designers-entry');
    entry.value=row.rank;
    const benchmark=row.careerId===-1,current=!benchmark&&row.careerId===currentCareerId;
    entry.classList.toggle('top-designers-benchmark',benchmark);
    entry.classList.toggle('top-designers-current',current);
    const picture=element('span',undefined,'top-designers-art-frame');
    const cup=element('span',undefined,'top-designers-cup career-trophy');
    const score=element('span',undefined,'top-designers-score');
    score.append(element('span','Total Score','top-designers-score-label'),number.format(row.score));
    cup.append(score);
    for(const [key,label,value] of [
      ['fun','Fun',number.format(row.fun)],
      ['skill','Skill',(row.skill/100).toFixed(2)],
      ['cash','Cash',number.format(Math.trunc(row.cash/10))]
    ])cup.append(element('span',label+' '+value,'top-designers-'+key));
    const suffix=['th','st','nd','rd'][row.rank]??'th';
    picture.append(cup,element('span',row.rank+suffix,'top-designers-rank'));
    const plaque=element('span',undefined,'top-designers-plaque');
    plaque.append(element('strong',row.designer,'top-designers-designer'));
    if(benchmark)plaque.prepend(benchmarkMark());
    if(current)plaque.append(element('span','Your Course','top-designers-badge'));
    const details=element('details',undefined,'top-designers-details'),summary=element('summary');
    if(benchmark)summary.setAttribute('aria-describedby',benchmarkKey.id);
    summary.append(picture,plaque);
    const values=element('dl',undefined,'top-designers-facts');
    values.append(
      element('dt','Course'),element('dd',row.course,'top-designers-course'),
      element('dt','Cash balance'),element('dd',currency.format(row.cash*100)),
      element('dt','Difficulty'),element('dd',difficulties[row.difficulty]??'—')
    );
    details.append(summary,values);
    entry.append(details);
    return entry;
  }
  function dismiss(){
    if(!resolveDismissal)return;
    const resolve=resolveDismissal;
    resolveDismissal=null;
    done.disabled=true;
    const opened=performance.now(),pixelSerial=Module.panVisual?.pixelSerial||0;
    Module.guardLoadingExit?.();
    resolve();
    function reveal(now){
      const elapsed=now-opened;
      const fresh=Module.mobileState?.course&&Module.mapPresentation?.course&&
        !Module.uiPresentation&&(Module.panVisual?.pixelSerial||0)>pixelSerial;
      if(elapsed<300||(!fresh&&elapsed<1200)){
        requestAnimationFrame(reveal);
        return;
      }
      root.close();
      root.hidden=true;
      Module.topDesigners.active=false;
      if(returnFocus?.getClientRects().length)returnFocus.focus({preventScroll:true});
      returnFocus=null;
    }
    requestAnimationFrame(reveal);
  }
  done.onclick=dismiss;
  root.addEventListener('cancel',event=>{event.preventDefault();dismiss();});
  for(const type of ['pointerdown','pointerup','pointermove','pointercancel','mousedown','mouseup','mousemove',
    'click','dblclick','touchstart','touchmove','touchend','touchcancel','wheel','keydown','keyup','keypress'])
    root.addEventListener(type,event=>event.stopPropagation());
  for(const event of ['resize','simgolf-screen-resize','simgolf-header-resize'])addEventListener(event,bounds);
  Module.openTopDesigners=function({source,entries,currentCareerId,qualifiedRank},annualSerial){
    if(root.open)return false;
    podium.replaceChildren();
    ranks.replaceChildren();
    benchmarkKey.hidden=!entries.some(row=>row.careerId===-1);
    for(const row of entries)(row.rank<=3?podium:ranks).append(trophy(row,currentCareerId));
    Module.cancelMapGesture();
    returnFocus=document.activeElement;
    done.disabled=false;
    root.hidden=false;
    root.showModal();
    bounds();
    if(annualSerial)Module.suspendProgressScreen(annualSerial);
    content.scrollTop=0;
    done.focus({preventScroll:true});
    Module.topDesigners={source,entries,currentCareerId,qualifiedRank,active:true};
    return new Promise(resolve=>{resolveDismissal=resolve;});
  };
})();

// A loading acknowledgement belongs only to that screen. Suppress the tail
// of a double tap/key press before the next menu or map can receive it.
(function(){
  let until=0,releaseKey='';Module.guardLoadingExit=()=>{until=performance.now()+300;};
  for(const type of ['pointerdown','pointerup','mousedown','mouseup','click','dblclick','touchstart','touchend','keydown','keyup','keypress'])addEventListener(type,e=>{
    if(type.startsWith('key')&&releaseKey&&e.key===releaseKey){if(type==='keyup')releaseKey='';e.preventDefault();e.stopImmediatePropagation();return;}
    if(performance.now()<until){e.preventDefault();e.stopImmediatePropagation();return;}
    const own=e.target.closest?.('#initial-loading,#course-loading');
    if(type.startsWith('key')&&own){
      const button=e.key==='Escape'?own.querySelector('#course-loading-back:not([hidden])'):e.target.closest?.('button');
      if(button&&(e.key==='Enter'||e.key===' '||e.key==='Escape')){
        e.preventDefault();if(type==='keydown'&&!e.repeat&&!button.disabled){releaseKey=e.key;button.click();}
      }
      e.stopImmediatePropagation();return;
    }
    if(type.startsWith('key')&&(Module.featureSettingsOpen||Module.editionModalOpen||Module.editionSelectionOpen)&&e.target.closest?.('#enhanced-settings,#edition-disclaimer,#rules-message,#enhanced-resolution,#title-exit-confirmation,#difficulty-confirmation,#golfer-remove-confirmation,#game-edition'))return;
    if(type.startsWith('key')&&(Module.initialLoading?.active||Module.courseLoading?.active)&&!e.target.closest?.('#opening-video,video')&&!Module.binkVideoActive&&!document.querySelector('video')){e.preventDefault();e.stopImmediatePropagation();}
  },{capture:true,passive:false});
  const style=document.createElement('style');style.textContent=`
    :is(#initial-loading-continue,#course-loading-continue){box-sizing:border-box;min-height:48px;width:min(320px,100%);padding:10px 20px;border:1px solid #67628e;border-radius:999px;color:#1c2541;background:linear-gradient(#fffde9,#f3d985);box-shadow:inset 0 1px #fff,0 3px 6px #39315d30;font:18px/24px OriginalWorldMenu,"Comic Neue",system-ui,sans-serif;touch-action:manipulation;cursor:pointer;flex:none}
    :is(#initial-loading-continue,#course-loading-continue):disabled{opacity:.5;cursor:wait;background:#d7d7e9;box-shadow:none}
    :is(#initial-loading-continue,#course-loading-continue):focus-visible{outline:3px solid #39315d;outline-offset:3px}
    /* Enabled means the existing native-ready handshake has completed.
       Pulse briefly, then leave a steady halo; never animate layout or text. */
    :is(#initial-loading-continue,#course-loading-continue):enabled{border-color:#51476e;background:linear-gradient(#fffef2,#ffdf75);box-shadow:inset 0 1px #fff,0 0 0 3px #fff3ad,0 0 20px #ffda55c7,0 4px 8px #39315d44;animation:loading-ready-pulse 1.8s ease-in-out 3}
    @keyframes loading-ready-pulse{0%,100%{box-shadow:inset 0 1px #fff,0 0 0 3px #fff3ad,0 0 20px #ffda55c7,0 4px 8px #39315d44}50%{box-shadow:inset 0 1px #fff,0 0 0 7px #fff3ad66,0 0 30px #ffda55ed,0 4px 8px #39315d44}}
    @media(prefers-reduced-motion:reduce){:is(#initial-loading-continue,#course-loading-continue):enabled{animation:none}}
  `;document.head.append(style);
})();

// A phone-sized presentation of the original initial loading artwork/progress.
// Original logo, selected oval and real progress fit the current phone. The
// opening movie stays above this surface; the ready custom menu owns handoff.
(function(){
  if(!Module.mobileMap)return;
  const root=document.createElement('section');root.id='initial-loading';root.hidden=true;root.setAttribute('role','status');root.setAttribute('aria-label','Loading SimGolf');
  const style=document.createElement('style');style.textContent=`
    #initial-loading[hidden]{display:none!important}
    body.initial-loading-open :is(#canvas,#map-display,#build-header,#mobile-ui,#mobile-mode-rail,#mobile-cancel,#mobile-open-hole,#local-title-actions,#mobile-startup){visibility:hidden!important}
    #initial-loading{position:fixed;z-index:9;box-sizing:border-box;display:flex;align-items:center;justify-content:center;overflow:hidden;background:radial-gradient(ellipse at 50% 42%,#eeedff 0%,#c9c9eb 44%,#9291bd 100%);padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left))}
    #initial-loading-content{display:flex;flex-direction:column;align-items:center;flex:none;margin:auto}
    #initial-loading-switch{flex:none;box-sizing:border-box;min-height:48px;width:min(320px,100%);padding:10px 18px;border:1px solid #79749c;border-radius:999px;background:#e7e7f3cc;color:#39315d;font:17px/24px OriginalWorldMenu,"Comic Neue",system-ui,sans-serif;touch-action:manipulation;cursor:pointer}
    #initial-loading-switch:disabled{opacity:.5;cursor:wait}#initial-loading-switch:focus-visible{outline:3px solid #39315d;outline-offset:3px}
    #initial-loading-logo{display:block;image-rendering:auto;flex:none;filter:drop-shadow(0 5px 5px #39315d30)}
    #initial-loading-picture{display:block;image-rendering:auto;flex:none;filter:drop-shadow(0 7px 8px #39315d26)}
    #initial-loading-label{margin:0;color:#39315d;font:22px/28px OriginalWorldMenu,"Comic Neue",system-ui,sans-serif;letter-spacing:.18em;text-indent:.18em;text-shadow:0 1px #ffffffb3;white-space:nowrap}
    #initial-loading-progress{height:24px;flex:none;box-sizing:border-box;border:2px solid #67628e;border-radius:999px;padding:2px;background:#f7ce00;overflow:hidden;box-shadow:0 2px 5px #39315d26,inset 0 1px 2px #39315d55}
    #initial-loading-fill{height:100%;background:linear-gradient(#fff,#fff9df);border-radius:999px;width:0;transition:width .16s ease-out}
    @media(prefers-reduced-motion:reduce){#initial-loading-fill{transition:none}}
  `;document.head.append(style);
  const content=document.createElement('div');content.id='initial-loading-content';const edition=document.createElement('p');edition.id='initial-loading-edition';edition.className='menu-edition-medallion';edition.setAttribute('aria-live','polite');const logo=document.createElement('canvas');logo.id='initial-loading-logo';logo.width=640;logo.height=216;logo.style.visibility='hidden';logo.setAttribute('role','img');logo.setAttribute('aria-label',"Sid Meier’s SimGolf");const label=document.createElement('p');label.id='initial-loading-label';label.textContent='LOADING …';const picture=document.createElement('canvas');picture.id='initial-loading-picture';picture.width=620;picture.height=202;picture.setAttribute('aria-label','Original SimGolf oval loading picture');picture.setAttribute('role','img');
  const bar=document.createElement('div');bar.id='initial-loading-progress';bar.setAttribute('role','progressbar');bar.setAttribute('aria-label','Loading game resources');bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax','100');const fill=document.createElement('div');fill.id='initial-loading-fill';bar.append(fill);const next=document.createElement('button');next.id='initial-loading-continue';next.type='button';next.textContent='Continue to main menu';next.disabled=true;const change=document.createElement('button');change.id='initial-loading-switch';change.type='button';change.disabled=true;change.onclick=()=>Module.requestLoadingEditionSwitch?.();content.append(edition,logo,picture,label,bar,next,change);const mute=Module.createAudioMuteButton('initial-loading-mute');root.append(mute,content);document.body.append(root);
  let currentImage='',presented=false,logoJob=null;
  function layout(){
    if(root.hidden)return;const b=Module.getScreenBounds(),w=Math.max(1,b.width-Math.max(16,b.safe.left)-Math.max(16,b.safe.right)),h=Math.max(1,b.height-Math.max(16,b.safe.top)-Math.max(16,b.safe.bottom)),gap=Math.max(8,Math.min(24,h*.025)),ideal=Math.min(960,w),brand=Math.min(520,ideal*.82),fit=Math.min(1,Math.max(1,h-edition.offsetHeight-28-24-48-48-gap*6)/(ideal*202/620+brand*216/640)),width=ideal*fit,logoWidth=brand*fit;
    Object.assign(root.style,{left:b.left+'px',top:b.top+'px',width:b.width+'px',height:b.height+'px'});Object.assign(logo.style,{width:logoWidth+'px',height:logoWidth*216/640+'px'});picture.style.width=width+'px';picture.style.height=width*202/620+'px';bar.style.width=Math.min(420,width*.68)+'px';content.style.gap=gap+'px';content.style.width=w+'px';Module.initialLoading.presentation={layout:'responsive-original-logo-oval-and-bar',picture:[width,width*202/620],logo:[logoWidth,logoWidth*216/640],barWidth:Math.min(420,width*.68),bounds:b};
  }
  function prepareLogo(){
    if(logoJob)return;logoJob=(async()=>{
      // Read the two logo layers from the user's local imported inventory.
      // The existing local fetch handler serves these from OPFS, including
      // offline. No native game-file writes or remote artwork requests.
      const entries=FS.readFile('/game.manifest',{encoding:'utf8'}).split('\n').map(line=>line.split('\t')[0]);
      const names=['TitleBase','TitleMO'],images=await Promise.all(names.map(async name=>{const path=entries.find(p=>p.toLowerCase()==='interface/'+name.toLowerCase()+'.pcx');if(!path)throw Error('Original logo asset missing: '+name);const response=await fetch('game/'+path.split('/').map(encodeURIComponent).join('/'));if(!response.ok)throw Error('Original logo could not be read: '+name);return Module.originalMenuArt.pcx(name,name==='TitleMO',new Uint8Array(await response.arrayBuffer()));}));
      const original=Module.originalMenuArt.titleLogo(...images);logo.getContext('2d').drawImage(original,0,0);logo.style.visibility='visible';Module.initialLoading.logoReady=true;Module.initialLoading.logoArtwork='user-imported-originals';layout();
    })().catch(e=>{Module.initialLoading.logoError=String(e);});
  }
  function progress(value){const s=Module.initialLoading;if(!s)return;s.progress=Math.max(0,Math.min(100,Number(value)||0));fill.style.width=s.progress+'%';bar.setAttribute('aria-valuenow',String(s.progress));}
  Module.beginInitialLoading=function(value){
    if(!Module.initialLoading)Module.initialLoading={active:true,complete:false,ready:false,progress:0,history:[],source:'native-startup-loader'};
    const s=Module.initialLoading;if(s.complete)return;prepareLogo();s.nativeProgress=value;progress(value);s.history.push({progress:s.progress,time:performance.now()});if(s.history.length>32)s.history.shift();
  };
  Module.setInitialLoadingImage=function(path){
    const s=Module.initialLoading;if(!s||s.complete)return;
    try{
      if(path!==currentImage){const name=path.replace(/\\/g,'/').replace(/^.*?interface\//i,'').replace(/\.pcx$/i,''),original=Module.originalMenuArt.pcx(name,true);picture.getContext('2d').clearRect(0,0,620,202);picture.getContext('2d').drawImage(original,90,175,620,202,0,0,620,202);currentImage=path;s.picture=path;s.artwork='user-imported-originals';s.imageChanges=(s.imageChanges||0)+1;}
      s.ready=true;root.hidden=false;document.body.classList.add('initial-loading-open');presented=true;layout();
    }catch(e){s.error=String(e);/* Retain the original native screen if art is unavailable. */}
  };
  function movieActive(){return !!Module.binkVideoActive||Array.from(document.querySelectorAll('video')).some(v=>v.isConnected&&!v.ended&&getComputedStyle(v).display!=='none');}
  function acknowledge(){
    const s=Module.initialLoading,menu=Module.startupMenu;if(Module.editionModalOpen||Module.editionSelectionOpen||!s?.active||!s.readyToContinue||movieActive()||menu?.kind!=='title'||menu.frame<1)return;
    next.disabled=true;s.acknowledged=true;s.active=false;s.complete=true;s.handoff='custom-title-ready';s.finished=performance.now();root.hidden=true;document.body.classList.remove('initial-loading-open');currentImage='';Module.guardLoadingExit();
  }
  next.onclick=acknowledge;
  function refresh(){
    const s=Module.initialLoading;if(!s||s.complete)return;
    const direct=Module.directSavedGame==='startup'||Module.directSavedGame==='backup-startup',mode=direct?'Saved Games':Module.gameEdition==='enhanced'?'Enhanced':'Classic';
    next.hidden=change.hidden=direct;
    if(edition.dataset.edition!==mode){edition.textContent=mode;edition.dataset.edition=mode;change.textContent='Play '+(mode==='Classic'?'Enhanced':'Classic')+' instead';s.edition=Module.gameEdition;}change.disabled=!!Module.editionModalOpen||!!Module.editionSelectionOpen||!Module.canChangeLoadingEdition?.();if(s.readyToContinue)next.disabled=!!Module.editionModalOpen||!!Module.editionSelectionOpen;
    if(Module.atTitle){
      progress(100);const menu=Module.startupMenu,element=document.getElementById('mobile-startup');
      if(menu?.kind==='title'&&menu.frame>0&&(direct||(element&&!element.hidden))){
        s.loaded=true;const ready=!movieActive();if(ready&&!s.readyToContinue){s.readyToContinue=true;s.readyAt=performance.now();label.textContent='READY';next.disabled=false;root.setAttribute('aria-busy','false');if(!direct&&document.activeElement!==mute)next.focus({preventScroll:true});}
        if(direct&&s.readyToContinue){acknowledge();return;}
      }
      // Missing custom artwork can still fall back to the original title.
      if(menu?.fallback){s.active=false;s.complete=true;s.handoff='native-title-fallback';root.hidden=true;document.body.classList.remove('initial-loading-open');return;}
    }
    if(presented)layout();
  }
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel','mousedown','mousemove','mouseup','click','dblclick','touchstart','touchmove','touchend','touchcancel','wheel','keydown','keyup','keypress'])root.addEventListener(type,e=>e.stopPropagation());
  setInterval(refresh,40);for(const event of ['resize','orientationchange','simgolf-screen-resize'])addEventListener(event,layout);
})();

// Review the original chooser's preview before committing a mobile load, then
// keep the overview visible until the newly loaded map is ready.
(function(){
  if(!Module.mobileMap)return;
  const root=document.createElement('section');root.id='course-loading';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Saved course');root.setAttribute('aria-busy','true');
  const style=document.createElement('style');style.textContent=`
    #course-loading[hidden],#course-loading [hidden]{display:none!important}
    body.course-loading-open :is(#canvas,#map-display,#mobile-ui,#mobile-mode-rail,#mobile-cancel,#mobile-open-hole,#build-header,#mobile-load,#mobile-load-return,#mobile-startup,#local-title-actions){visibility:hidden!important}
    #course-loading{position:fixed;z-index:66;box-sizing:border-box;display:flex;flex-direction:column;gap:12px;overflow:hidden;padding:max(14px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(14px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));background:radial-gradient(ellipse at 35% 30%,#efeeff,#c1c1e4 65%,#9291bd);color:#1c2541;font:16px/1.3 system-ui,sans-serif}
    #course-loading header{display:flex;align-items:center;gap:12px;flex:none;min-width:0}#course-loading-emblem:empty{display:none}#course-loading-emblem canvas{display:block;width:64px;height:64px;object-fit:contain;filter:drop-shadow(0 3px 3px #39315d40)}
    #course-loading header>div:last-child{min-width:0}#course-loading h1{font:normal clamp(24px,4vw,34px)/1.05 OriginalWorldMenu,"Comic Neue",system-ui,sans-serif;margin:3px 0;overflow-wrap:break-word}#course-loading .eyebrow{font-size:11px;font-weight:600;letter-spacing:.16em;color:#49496f}#course-loading-save{font-size:13px;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#49496f}
    #course-loading-body{display:flex;flex-direction:column;gap:12px;flex:1;min-height:0;min-width:0}
    #course-loading-map-card{display:flex;flex-direction:column;flex:0 0 38%;min-height:110px;min-width:0;overflow:hidden;margin:0;border:1px solid #77759b;border-radius:22px;background:linear-gradient(#fbfbeddd,#d9daec99);box-shadow:inset 0 1px #fff,0 4px 14px #39315d20}
    #course-loading-map{display:block;width:100%;height:100%;min-height:0;flex:1;object-fit:contain;filter:drop-shadow(0 5px 4px #39315d30)}
    #course-loading-map-card figcaption{text-align:center;flex:none;font-size:12px;color:#49496f;padding:5px 8px 8px}
    #course-loading-details{flex:1;min-height:0;min-width:0;overflow:auto;overscroll-behavior:contain;touch-action:pan-y;padding:2px 3px 4px;scrollbar-color:#79749c transparent}
    #course-loading-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:0 0 10px}#course-loading-summary>div{border:1px solid #8582a9;border-radius:18px;padding:8px 4px;text-align:center;background:#fffcedbf;box-shadow:inset 0 1px #fff}#course-loading-summary dt{font-size:11px;color:#49496f}#course-loading-summary dd{font-size:19px;margin:3px 0 0;font-weight:600}
    #course-loading-extra{display:flex;gap:6px 18px;flex-wrap:wrap;font-size:13px;color:#343456;margin:8px 3px 14px}#course-loading-extra span{overflow-wrap:anywhere}
    #course-loading h2{font-size:17px;font-weight:500;margin:0 0 8px}#course-loading-holes{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:7px;padding:0;margin:0;list-style:none}#course-loading-holes li{display:flex;align-items:center;gap:8px;padding:8px;border:1px solid #8582a9;border-radius:16px;background:#e9e9f8c9}#course-loading-holes b{display:flex;align-items:center;justify-content:center;border:1px solid #79749c;border-radius:50%;width:28px;height:28px;flex:none;background:#fff5c5;font-size:14px}#course-loading-holes span{font-size:13px}#course-loading-holes small{display:block;font-size:12px;color:#49496f}#course-loading-empty{font-size:14px;color:#49496f}
    #course-loading footer{flex:none;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:10px;border-top:1px solid #8582a977;padding-top:12px;font-size:14px;color:#39315d}
    #course-loading-status{flex:1 0 100%;display:flex;align-items:center;gap:10px}#course-loading-spinner{width:18px;height:18px;flex:none;border:2px solid #79749c55;border-top-color:#585280;border-radius:50%;animation:course-load-spin 1s linear infinite}#course-loading-stage{margin:0}
    #course-loading-back{box-sizing:border-box;min-height:48px;padding:8px 16px;border:1px solid #79749c;border-radius:999px;background:#efeff9;color:#1c2541;font:inherit;cursor:pointer;touch-action:manipulation}
    #course-loading-settings{display:flex;flex:none;align-items:center;gap:10px;width:100%;min-height:48px;box-sizing:border-box;padding:6px 12px;border:1px solid #283262;border-radius:14px;background:linear-gradient(#455593,#334174);color:#fff;box-shadow:inset 0 1px #ffffff38,0 2px 5px #39315d3d;font:15px/1.2 system-ui,sans-serif;text-align:left;touch-action:manipulation;cursor:pointer}
    #course-loading-settings svg{width:22px;height:22px;flex:none}
    #course-loading-settings .settings-copy{flex:1;min-width:0;overflow-wrap:anywhere}
    #course-loading-settings strong,#course-loading-settings small{display:block}
    #course-loading-settings small{color:#e4e9ff;font-size:12px;margin-top:2px}
    #course-loading-settings .settings-arrow{font-size:25px;line-height:1}
    #course-loading-back:focus-visible,#course-loading-settings:focus-visible{outline:3px solid #39315d;outline-offset:3px}
    #course-loading-continue{flex:0 1 320px;min-width:0}
    #course-loading[data-review=true] #course-loading-continue{flex:1 1 130px}
    #course-loading[data-ready=true] #course-loading-spinner{animation:none;border-color:transparent;font-size:20px;line-height:18px}
    @keyframes course-load-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){#course-loading-spinner{animation:none}}
    @media(min-width:740px) and (min-aspect-ratio:1/1){#course-loading-body{flex-direction:row;gap:20px}#course-loading-status{flex:1 1 120px}#course-loading-map-card{flex:1.35}#course-loading-details{flex:1}#course-loading-summary dd{font-size:22px}}
    @media(max-height:470px){#course-loading{gap:8px}#course-loading-emblem canvas{width:44px;height:44px}#course-loading h1{font-size:24px}#course-loading footer{padding-top:8px}#course-loading-status{flex:1 1 120px}#course-loading-continue{width:auto;font-size:16px;min-width:130px}#course-loading-body{flex-direction:row}#course-loading-map-card{flex:1}#course-loading-details{flex:1}#course-loading-summary dd{font-size:16px}}
  `;document.head.append(style);
  const text=(tag,value,id)=>{const e=document.createElement(tag);e.textContent=value;if(id)e.id=id;return e;};
  const header=document.createElement('header'),emblem=document.createElement('div');emblem.id='course-loading-emblem';const heading=document.createElement('div'),eyebrow=text('div','LOADING SAVED GAME');eyebrow.className='eyebrow';const title=text('h1',''),filename=text('p','','course-loading-save');heading.append(eyebrow,title,filename);header.append(emblem,heading);
  const body=document.createElement('div');body.id='course-loading-body';const figure=document.createElement('figure');figure.id='course-loading-map-card';const map=document.createElement('canvas');map.id='course-loading-map';map.width=1000;map.height=660;map.setAttribute('role','img');figure.append(map,text('figcaption','Course layout · numbered tees and hole routes'));
  const details=document.createElement('section');details.id='course-loading-details';details.setAttribute('aria-label','Saved course information');
  const settings=text('button','','course-loading-settings');settings.type='button';settings.hidden=true;settings.setAttribute('aria-haspopup','dialog');
  settings.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h3m4 0h9M4 12h9m4 0h3M4 18h5m4 0h7"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="11" cy="18" r="2"/></svg>';
  const settingsCopy=text('span',''),settingsCount=text('small',''),settingsArrow=text('span','›');
  settingsCopy.className='settings-copy';settingsCopy.append(text('strong','Enhanced Settings'),settingsCount);
  settingsArrow.className='settings-arrow';settingsArrow.setAttribute('aria-hidden','true');
  settings.append(settingsCopy,settingsArrow);
  const summary=document.createElement('dl');summary.id='course-loading-summary';const extra=document.createElement('div');extra.id='course-loading-extra';const holes=document.createElement('ol');holes.id='course-loading-holes';const empty=text('p','No open holes in this save.','course-loading-empty');details.append(summary,extra,text('h2','Course holes'),holes,empty);body.append(figure,details);
  const footer=document.createElement('footer'),status=text('div','','course-loading-status'),spinner=text('span','','course-loading-spinner');spinner.setAttribute('aria-hidden','true');
  const stage=text('p','','course-loading-stage');stage.setAttribute('role','status');status.append(spinner,stage);
  const back=text('button','Back','course-loading-back'),enter=text('button','Enter course','course-loading-continue');back.type=enter.type='button';back.hidden=true;enter.disabled=true;
  footer.append(status,back,enter);root.append(header,settings,body,footer);document.body.append(root);
  let serial=0,beforePixels=0,review=null;
  const stages={accepted:'Opening your saved course…',save:'Reading the saved game…',artwork:'Loading course artwork…',terrain:'Preparing the course terrain…',map:'Preparing the full-size map…'};
  function layout(){if(root.hidden)return;const b=Module.getScreenBounds();Object.assign(root.style,{left:b.left+'px',top:b.top+'px',width:b.width+'px',height:b.height+'px'});if(Module.courseLoading)Module.courseLoading.presentation={layout:'responsive-saved-course-overview',bounds:b};}
  function close(reason){
    const s=Module.courseLoading;if(!s?.active)return;
    s.active=false;s.complete=reason==='fresh-map-ready';s.handoff=reason;s.finished=performance.now();delete s.preferences;review=null;
    root.hidden=true;document.body.classList.remove('course-loading-open');
    if(s.complete||reason==='back-to-saves')Module.guardLoadingExit();
  }
  function showReviewSettings(){
    const association=review?.policy.kind==='enhanced'?review.policy.association:null;
    settings.hidden=!association;
    if(!association)return;
    const features=association.revision.features||association.game.features;
    const editable=Module.enhancedFeatureCatalog.filter(f=>f.available&&f.mutableDuringPlay&&f.playContexts.includes('career'));
    const preferences=Module.courseLoading.preferences;
    const enabled=editable.filter(f=>preferences?preferences[f.id]:features[f.id]?.enabled).length;
    settingsCount.textContent=enabled+' of '+editable.length+' enabled';
  }
  settings.onclick=async()=>{
    const s=Module.courseLoading,association=review?.policy.association;
    if(!s?.active||!association||s.enterRequested||Module.featureSettingsOpen)return;
    root.inert=true;
    try{
      const choices=await Module.editSavedGameEnhancements(association,s.preferences);
      if(Module.courseLoading===s&&s.active&&choices){s.preferences=choices;showReviewSettings();}
    }finally{
      root.inert=false;
      if(Module.courseLoading===s&&s.active)settings.focus({preventScroll:true});
    }
  };
  back.onclick=()=>{
    if(!review||Module.courseLoading?.enterRequested||root.inert)return;
    const focus=review.back;
    close('back-to-saves');focus();
  };
  enter.onclick=()=>{
    const s=Module.courseLoading;if(!s?.active||!s.readyToContinue||s.enterRequested||root.inert)return;
    s.enterRequested=true;back.disabled=settings.disabled=enter.disabled=true;
    root.dataset.ready='false';root.setAttribute('aria-busy','true');spinner.textContent='';stage.textContent='Opening course…';
    review?.enter();
  };
  function drawOverview(data){
    const g=map.getContext('2d');g.clearRect(0,0,1000,660);const palette=['#86bd67','#91cb55','#79b04d','#9ebd6d','#5e9347','#4a773a','#d7c8a9','#edddb6','#c5b48d','#d3bf9a','#65b8c0','#4b793d','#9a9c8b','#4a813f','#356d3a','#3e864e','#497c44','#67b6c1','#699650','#779b59'];
    const cells=[];for(let x=0;x<50;x++)for(let y=0;y<50;y++){const i=x*50+y,type=data.tiles[i];if(type>=0&&type<20)cells.push({x,y,i,type});}
    if(!cells.length){map.setAttribute('aria-label','Course layout unavailable');return;}
    const raw=(x,y)=>[(x-y)*10,(x+y)*6],points=cells.map(c=>raw(c.x,c.y));const minX=Math.min(...points.map(p=>p[0]))-10,maxX=Math.max(...points.map(p=>p[0]))+10,minY=Math.min(...points.map(p=>p[1]))-6,maxY=Math.max(...points.map(p=>p[1]))+6;map.height=Math.max(260,Math.min(660,Math.ceil(910*(maxY-minY)/(maxX-minX)+90)));const scale=Math.min(910/(maxX-minX),(map.height-90)/(maxY-minY)),project=(x,y)=>{const p=raw(x,y);return [500+(p[0]-(minX+maxX)/2)*scale,map.height/2+(p[1]-(minY+maxY)/2)*scale];};
    function diamond(x,y,fill){const p=project(x,y);g.fillStyle=fill;g.beginPath();g.moveTo(p[0],p[1]-6*scale);g.lineTo(p[0]+10*scale,p[1]);g.lineTo(p[0],p[1]+6*scale);g.lineTo(p[0]-10*scale,p[1]);g.closePath();g.fill();return p;}
    cells.sort((a,b)=>a.x+a.y-b.x-b.y||a.x-b.x);for(const c of cells){const p=diamond(c.x,c.y,palette[c.type]);if(c.type===2&&(c.x+c.y)%2===0)diamond(c.x,c.y,'#83b653');if(c.type>=13&&c.type<=16){g.fillStyle='#285e3b';g.beginPath();g.ellipse(p[0],p[1]-3*scale,3.8*scale,5*scale,0,0,Math.PI*2);g.fill();}if(data.flags[c.i]&0x400){g.fillStyle='#fff0c5';g.fillRect(p[0]-4*scale,p[1]-4*scale,8*scale,6*scale);g.fillStyle='#8d6f65';g.beginPath();g.moveTo(p[0]-5*scale,p[1]-4*scale);g.lineTo(p[0],p[1]-8*scale);g.lineTo(p[0]+5*scale,p[1]-4*scale);g.fill();}}
    for(const h of data.routes){const pts=h.points.map(p=>project(...p));g.lineJoin='round';g.lineCap='round';g.beginPath();pts.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.strokeStyle='#26354999';g.lineWidth=5;g.stroke();g.strokeStyle='#fff2ba';g.lineWidth=2.5;g.stroke();const end=pts.at(-1);g.fillStyle='#fff';g.beginPath();g.arc(...end,4,0,Math.PI*2);g.fill();g.strokeStyle='#343456';g.lineWidth=2;g.beginPath();g.moveTo(end[0],end[1]);g.lineTo(end[0],end[1]-14);g.stroke();g.fillStyle='#dc714a';g.beginPath();g.moveTo(end[0],end[1]-14);g.lineTo(end[0]+10,end[1]-10);g.lineTo(end[0],end[1]-7);g.fill();}
    const placed=[];for(const h of data.routes){const tee=project(...h.points[0]);let x=tee[0],y=tee[1]-15;for(let n=0;n<8&&placed.some(p=>Math.hypot(x-p[0],y-p[1])<29);n++)y-=26;placed.push([x,y]);g.strokeStyle='#39315d';g.lineWidth=1.5;g.beginPath();g.moveTo(x,y);g.lineTo(...tee);g.stroke();g.fillStyle='#fff2bd';g.beginPath();g.arc(x,y,14,0,Math.PI*2);g.fill();g.stroke();g.fillStyle='#1c2541';g.textAlign='center';g.textBaseline='middle';g.font='bold 16px system-ui';g.fillText(String(h.hole),x,y+.5);}
    map.setAttribute('aria-label','Saved layout of '+data.name+' with '+data.routes.length+' numbered holes');
  }
  Module.courseLoadingStage=function(value){const s=Module.courseLoading;if(!s?.active||!stages[value])return;s.phase=value;stage.textContent=stages[value];s.history.push({phase:value,time:performance.now()});if(s.history.length>24)s.history.shift();};
  Module.beginCourseLoading=function(state,selection=null,entered=false){
    try{
      const row=state?.rows?.find(r=>r.index===state.selected),p=state?.preview;if(!row||!p)return false;
      const data={...JSON.parse(JSON.stringify(p)),skill:HEAP32[0x541cd8>>2]/100,tiles:Array.from(HEAP8.subarray(0x5722e8,0x5722e8+2500)),flags:Array.from(HEAPU16.subarray(0x53caf0>>1,(0x53caf0>>1)+2500)),routes:[]};
      for(const h of p.holes){const a=0x575ab0+h.hole*520,points=[];for(const offset of [8,16,24]){const x=HEAP32[(a+offset)>>2],y=HEAP32[(a+offset+4)>>2];if(x>0&&x<50&&y>=0&&y<50)points.push([x,y]);}if(h.par>0&&points.length>=2)data.routes.push({hole:h.hole,points});}
      review=selection;
      beforePixels=Module.panVisual?.pixelSerial||0;
      back.hidden=!selection;back.disabled=settings.disabled=enter.disabled=!selection;
      root.dataset.review=String(!!selection);root.dataset.ready=String(!!selection);
      root.setAttribute('aria-busy',String(!selection));spinner.textContent=selection?'✓':'';
      Module.courseLoading={active:true,complete:false,serial:++serial,file:row.name,modified:row.modified,course:data,nativeReads:0,nativeFinished:false,history:[],source:'native-selected-save-preview',started:performance.now(),enterRequested:entered};
      if(selection)Object.assign(Module.courseLoading,{reviewing:true,readyToContinue:true,chooser:state.serial,identity:{sha256:selection.policy.sha256,revision:selection.policy.association?.revision.id??null}});
      eyebrow.textContent=selection?'SAVED COURSE PREVIEW':'LOADING SAVED GAME';
      showReviewSettings();
      title.textContent=p.name||'Saved course';filename.textContent=row.name.replace(/\.sve$/i,'');emblem.replaceChildren();const art=p.art?Module.originalIndexedArt?.({art:p.art,mask:p.mask}):null;if(art)emblem.append(art);summary.replaceChildren();
      for(const [label,value]of [['Open holes',p.holes.filter(h=>h.par>0).length],['Total par',p.par],['Yards',p.yards.toLocaleString()],['Money','$'+p.cash.toLocaleString()],['Fun rating',p.fun],['Skill',data.skill.toFixed(2)]]){const box=document.createElement('div');box.append(text('dt',label),text('dd',String(value)));summary.append(box);}
      extra.replaceChildren();for(const [label,value]of [['Designer',p.designer],['Theme',p.theme],['Last saved',row.modified?new Date(row.modified).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):null]])if(value)extra.append(text('span',label+': '+value));holes.replaceChildren();for(const h of p.holes){const li=document.createElement('li'),info=text('span','Par '+h.par);info.append(text('small',h.yards+' yards'));li.append(text('b',String(h.hole)),info);holes.append(li);}empty.hidden=!!p.holes.length;
      drawOverview(data);root.hidden=false;document.body.classList.add('course-loading-open');details.scrollTop=0;
      if(selection){stage.textContent='Ready to load';enter.focus({preventScroll:true});}
      else Module.courseLoadingStage('accepted');
      layout();return true;
    }catch(e){Module.courseLoadingError=String(e);if(Module.courseLoading)Module.courseLoading.active=false;root.hidden=true;document.body.classList.remove('course-loading-open');return false;}
  };
  Module.cancelCourseLoading=function(){close('native-load-cancelled');};
  Module.courseLoadingFinished=function(){const s=Module.courseLoading;if(!s?.active)return;if(!s.nativeReads){close('native-load-cancelled');return;}s.nativeFinished=true;Module.courseLoadingStage('map');};
  function refresh(){const s=Module.courseLoading;if(!s?.active)return;if(s.nativeFinished&&Module.mobileCourseFrameReady(beforePixels)){if(s.enterRequested){s.acknowledged=true;close('fresh-map-ready');return;}if(!s.readyToContinue){s.readyToContinue=true;s.readyAt=performance.now();enter.disabled=false;root.dataset.ready='true';root.setAttribute('aria-busy','false');spinner.textContent='✓';stage.textContent='Course ready';enter.focus({preventScroll:true});}}layout();}
  setInterval(refresh,40);for(const name of ['resize','orientationchange','simgolf-screen-resize'])addEventListener(name,layout);
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel','mousedown','mousemove','mouseup','click','dblclick','touchstart','touchmove','touchend','touchcancel','wheel','keydown','keyup','keypress'])root.addEventListener(type,e=>e.stopPropagation());
})();

// Resident labels use the existing native home record; no purchase or save
// fields are changed. Hover previews; a released tap keeps the card readable.
(function(){
  const root=document.createElement('section');root.id='mobile-home-info';root.hidden=true;root.setAttribute('aria-label','Home resident');
  const caption=document.createElement('p'),name=document.createElement('h2'),status=document.createElement('p');
  const close=document.createElement('button'),mute=document.createElement('button');
  close.id='mobile-home-close';close.textContent='×';close.setAttribute('aria-label','Close home information');
  close.onclick=()=>{Module.homeInfo=null;root.hidden=true;};
  mute.id='mobile-home-mute';mute.hidden=true;
  root.append(caption,name,status,mute,close);

  const houseMutes=new Map();
  Module.houseSoundKey=(property,x,y,owner)=>{
    const career=Module.saveRules?.active?.game.id;
    return career&&property>=0&&property<16&&owner>0?career+'/'+[property,x,y,owner].join('/'):null;
  };
  Module.isHouseSoundMuted=key=>{
    if(!key)return false;
    if(!houseMutes.has(key)){
      let muted=false;
      try{muted=localStorage.getItem('simgolf-house-muted/'+key)==='1';}catch{}
      houseMutes.set(key,muted);
    }
    return houseMutes.get(key);
  };
  mute.onclick=()=>{
    const s=Module.homeInfo,key=s?.soundKey;
    if(root.hidden||s?.mode!=='tap'||!key)return;
    const muted=!Module.isHouseSoundMuted(key);
    houseMutes.set(key,muted);
    try{
      if(muted)localStorage.setItem('simgolf-house-muted/'+key,'1');
      else localStorage.removeItem('simgolf-house-muted/'+key);
    }catch{}
    if(muted)Module.soundDebug?.stopHouse(key);
    render();
  };
  const css=document.createElement('style');css.textContent=`#mobile-home-info[hidden]{display:none!important}#mobile-home-info{position:absolute;left:max(8px,env(safe-area-inset-left));top:calc(max(8px,env(safe-area-inset-top)) + var(--course-badge-space,0px) + 8px);width:min(320px,calc(100% - max(8px,env(safe-area-inset-left)) - max(8px,env(safe-area-inset-right)) - 72px));box-sizing:border-box;border:1px solid var(--menu-border);border-radius:12px;padding:14px 42px 14px 16px;background:var(--mobile-surface,var(--menu-overlay));color:var(--menu-text);box-shadow:0 4px 18px #0003;pointer-events:auto;max-height:calc(100% - var(--course-badge-space,0px) - 120px);overflow:auto}#mobile-home-info h2{font-size:20px;line-height:1.25;margin:4px 0 6px;overflow-wrap:anywhere}#mobile-home-info p{font:13px/1.4 system-ui,sans-serif;margin:0}#mobile-home-info #mobile-home-close{position:absolute;right:4px;top:4px;min-width:36px;min-height:36px;padding:0;border-radius:50%;font-size:25px;line-height:1;background:var(--menu-button);color:var(--menu-text)}#mobile-home-mute{min-height:44px;margin-top:9px;padding:7px 10px;border:1px solid var(--menu-border);border-radius:8px;background:var(--menu-button);color:inherit;font:inherit;touch-action:manipulation}#mobile-home-info[data-mode=hover]{pointer-events:none}#mobile-home-info[data-mode=hover] button{display:none}`;document.head.append(css);
  function mount(){const ui=document.getElementById('mobile-ui');if(!ui)return false;ui.append(root);return true;}
  let previousHomeText='';
  function render(){
    if(!root.isConnected&&!mount())return;
    const s=Module.homeInfo,m=Module.mobileState;root.hidden=!s||!m?.course||!Module.mobileUI||Module.atTitle||!document.getElementById('local-save-files')?.hidden||!!Module.profileState||!!Module.loadState||!!m.photoActive||!document.getElementById('mobile-panel')?.hidden;
    if(root.hidden)return;
    const muted=Module.isHouseSoundMuted(s.soundKey);
    const stamp=[s.slot,s.owner,s.name,s.mode,s.soundKey,muted].join('|');if(stamp===previousHomeText)return;previousHomeText=stamp;
    root.dataset.mode=s.mode;caption.textContent=s.occupied?'Celebrity home':'Home site';name.textContent=s.occupied?(s.name||'Resident name unavailable'):'Waiting for a buyer';status.textContent=muted?'House sound muted':s.occupied?'Lives here':'No one has moved in yet.';close.hidden=s.mode!=='tap';
    mute.hidden=s.mode!=='tap'||!s.soundKey;mute.textContent=muted?'Unmute This House':'Mute This House';
  }
  for(const t of ['pointerdown','pointerup','pointermove','pointercancel','mousedown','mouseup','click','dblclick','touchstart','touchmove','touchend','wheel','keydown','keyup','keypress'])root.addEventListener(t,e=>e.stopPropagation());
  Module.canvas.addEventListener('pointerleave',()=>{if(Module.homeInfo?.mode==='hover')Module.homeInfo=null;});
  setInterval(render,100);
})();
