// Live native clubhouse observations and an accessible front end to the
// original pair chooser. All engine commands cross its existing input queue.
(function(){
  'use strict';
  if(!globalThis.HTMLDialogElement?.prototype.showModal)return;
  const root=document.createElement('dialog'),pair=document.createElement('dialog');
  root.id='clubhouse-management';pair.id='clubhouse-pair';
  root.setAttribute('aria-labelledby','clubhouse-title');pair.setAttribute('aria-labelledby','clubhouse-pair-title');
  root.innerHTML='<header><h2 id="clubhouse-title">Clubhouse &amp; Tee Times</h2><button type="button">Close</button></header><div class="clubhouse-body"></div><footer><p role="status"></p><button type="button" id="clubhouse-choose">Choose A Pair To Play</button></footer>';
  pair.innerHTML='<header><h2 id="clubhouse-pair-title">Choose The Next Pair</h2></header><div class="clubhouse-body"><p>Select two waiting golfers. The original game will pair them and begin their rounds.</p><div class="clubhouse-choices"></div><p class="clubhouse-selection" role="status"></p></div><footer><button type="button" id="clubhouse-pair-cancel">Cancel</button><button type="button" id="clubhouse-pair-send">Send Selected Pair</button></footer>';
  const style=document.createElement('style');style.textContent=`
    body.clubhouse-pair-open #canvas,body.clubhouse-pair-open #mobile-ui{visibility:hidden!important}
    #clubhouse-management,#clubhouse-pair{inset:max(10px,env(safe-area-inset-top)) max(10px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left));width:min(620px,calc(100% - max(10px,env(safe-area-inset-left)) - max(10px,env(safe-area-inset-right))));max-height:calc(100dvh - max(10px,env(safe-area-inset-top)) - max(10px,env(safe-area-inset-bottom)));box-sizing:border-box;padding:0;overflow:auto;overscroll-behavior:contain;border:1px solid var(--menu-border);border-radius:14px;background:var(--menu-bg);color:var(--menu-text);font:15px/1.4 system-ui,sans-serif}
    #clubhouse-management::backdrop,#clubhouse-pair::backdrop{background:#161c3770}
    #clubhouse-management header,#clubhouse-pair header{position:sticky;top:0;z-index:1;display:flex;gap:8px;align-items:center;justify-content:space-between;background:var(--menu-panel);padding:10px 12px;border-bottom:1px solid var(--menu-border)}
    #clubhouse-management h2,#clubhouse-pair h2{font-size:clamp(18px,4vw,23px);margin:0}
    #clubhouse-management h3{font-size:17px;margin:12px 0 5px}
    #clubhouse-management p,#clubhouse-pair p{margin:6px 0}
    #clubhouse-management .clubhouse-body,#clubhouse-pair .clubhouse-body{padding:4px 12px 10px}
    #clubhouse-management footer,#clubhouse-pair footer{position:sticky;bottom:0;padding:8px 12px;background:var(--menu-panel);border-top:1px solid var(--menu-border)}
    #clubhouse-pair footer{display:flex;gap:8px;flex-wrap:wrap}
    #clubhouse-management button,#clubhouse-pair button{min-height:44px;max-width:100%;padding:8px 12px;touch-action:manipulation;font:inherit;color:inherit;border:1px solid var(--menu-border);border-radius:9px;background:var(--menu-button)}
    #clubhouse-management button:disabled,#clubhouse-pair button:disabled{opacity:.55}
    #clubhouse-management details,#clubhouse-management article,#clubhouse-pair .clubhouse-choices button{display:block;padding:8px 10px;margin:6px 0;border:1px solid var(--menu-border);border-radius:10px;background:#fff9e8}
    #clubhouse-management summary{min-height:36px;padding-top:8px;cursor:pointer;font-weight:700}
    #clubhouse-pair .clubhouse-choices{display:grid;gap:7px;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr))}
    #clubhouse-pair .clubhouse-choices button{margin:0;min-height:64px;width:100%;text-align:left}
    #clubhouse-pair .clubhouse-choices button[aria-pressed=true]{background:#fff0ae;border:2px solid #665123;box-shadow:inset 0 0 0 2px #fff9e8}
    #clubhouse-pair .clubhouse-choices small{display:block}
    #clubhouse-management .clubhouse-counts{display:flex;gap:8px;flex-wrap:wrap;padding:8px 0;font-weight:700}
  `;
  document.head.append(style);document.body.append(root,pair);
  const body=root.querySelector('.clubhouse-body'),status=root.querySelector('[role=status]'),choose=root.querySelector('#clubhouse-choose');
  const choices=pair.querySelector('.clubhouse-choices'),selection=pair.querySelector('.clubhouse-selection'),send=pair.querySelector('#clubhouse-pair-send'),cancel=pair.querySelector('#clubhouse-pair-cancel');
  let focus,stamp='',pendingTicket=null,serial=0,mask=0,busy=false,cancelling=false,pairRows=[],pointer=false;
  Module.clubhousePairQueue=[];
  const enabled=()=>!!Module.hasGameFeature?.('clubhouseManagement');
  function available(){
    const s=Module.mobileState;
    return enabled()&&Module.mapCourseReady&&s?.course&&!Module.atTitle&&!s.photoActive&&!s.fundsCheck&&!s.tournamentActive&&!Module.shotPending&&
      !Module.loadState?.active&&!Module.courseLoading?.active&&!Module.saveFilesOpen&&!Module.backupHistoryOpen&&
      !Module.analyticsActive&&!Module.golferHistoriesOpen&&!Module.clubRecordsOpen&&!Module.designChallengesOpen&&!Module.courseDesignLabOpen&&
      !Module.mobileReportOpen&&!Module.mobilePreferencesOpen&&!Module.golferCard?.active&&!Module.profileState?.active&&!Module.progressScreen?.active;
  }
  function el(tag,text){const e=document.createElement(tag);if(text)e.textContent=text;return e;}
  function close(restore){
    if(root.open)root.close();Module.clubhouseManagementOpen=false;stamp='';pointer=false;
    if(restore!==false)Module.finishClubhouseNavigation?.();
    if(focus?.isConnected)focus.focus({preventScroll:true});
  }
  Module.canOpenClubhouseManagement=available;
  Module.openClubhouseManagement=function(){
    if(!available()||pair.open||pendingTicket!==null)return false;
    focus=document.activeElement;Module.cancelMapGesture?.();
    Module.clubhouseSnapshot=null;stamp='';status.textContent='Reading the original clubhouse queue…';choose.disabled=true;
    body.replaceChildren();root.showModal();Module.clubhouseManagementOpen=true;root.querySelector('header button').focus({preventScroll:true});return true;
  };
  function profile(row,kind){
    const button=el('button',kind==='history'?'Profiles & Histories':'Experiences');button.type='button';
    button.onclick=()=>{close();Module.openClubhouseGolferProfile?.(row,kind);};return button;
  }
  function render(snapshot){
    if(!root.open||!available()||snapshot.career!==Module.saveRules?.active?.game.id||snapshot.revision!==Module.saveRules?.active?.revision)return;
    const waiting=snapshot.rows.filter(g=>g.hole===-1),playing=snapshot.rows.filter(g=>g.hole>0&&g.hole<=18);
    const oldOpen=new Set(Array.from(body.querySelectorAll('details[open]')).map(e=>e.dataset.person));
    const scroll=root.scrollTop;
    body.replaceChildren();
    const counts=el('div');counts.className='clubhouse-counts';counts.append(el('span',waiting.length+' Waiting'),el('span',playing.length+' Playing'));body.append(counts);
    body.append(el('p','Live regular golfers on this course. Automatic starts and first-tee checks use the original game rules.'));
    body.append(el('h3','Waiting At The Clubhouse'));
    if(!waiting.length)body.append(el('p','No eligible regular golfers are waiting. Keep an open course running to welcome visitors.'));
    for(const row of waiting){
      const card=el('details');card.dataset.person=[row.actor,row.profile,row.visit].join(':');card.open=oldOpen.has(card.dataset.person);
      card.append(el('summary',row.name),el('p','Waiting · Eligible for the original pair selector'));
      if(row.traits.length)card.append(el('p','Original Traits · '+row.traits.join(', ')));
      if(row.interests)card.append(el('p',row.interests));
      for(const kind of ['history','experiences'])if(Module.hasClubhouseGolferProfile?.(row,kind))card.append(profile(row,kind));
      body.append(card);
    }
    body.append(el('h3','Groups On The Course'));
    const done=new Set();
    for(const row of playing){
      if(done.has(row.actor))continue;
      const partner=playing.find(g=>g.actor===row.partner&&g.partner===row.actor),members=partner?[row,partner]:[row],card=el('article');
      for(const g of members){done.add(g.actor);card.append(el('strong',g.name),el('p','Hole '+g.hole+' · '+g.stroke+' Current Strokes'+(g.hole===1&&g.stroke===0?' · Preparing At The First Tee':'')));}
      body.append(card);
    }
    if(!playing.length)body.append(el('p','No regular golfers are currently playing.'));
    const leaving=snapshot.rows.filter(g=>g.hole===19);
    if(leaving.length)body.append(el('p','Leaving The Course · '+leaving.map(g=>g.name).join(', ')));
    choose.disabled=!snapshot.canChoose;
    status.textContent=snapshot.canChoose?'Choose two waiting golfers to begin their rounds.':waiting.length<2?'Two eligible waiting golfers and an open first hole are needed.':'The original selector requires an available clubhouse, an open first hole, two eligible waiting golfers, and no competing native action.';
    root.scrollTop=scroll;
  }
  Module.receiveClubhouseSnapshot=function(snapshot){
    if(!enabled()||!root.open||snapshot.career!==Module.saveRules?.active?.game.id)return;
    Module.clubhouseSnapshot=snapshot;
    // Names/status only. Native ticket freshness is tracked separately so an
    // unchanged queue need not rebuild its scrollable presentation.
    if(pointer)return;
    const next=JSON.stringify([snapshot.rows,snapshot.canChoose]);
    if(next!==stamp){stamp=next;render(snapshot);}
  };
  choose.onclick=()=>{
    const s=Module.clubhouseSnapshot;if(!available()||!s?.canChoose||Module.menuQueue.length||pendingTicket!==null)return;
    pendingTicket=s.ticket;Module.menuResult=null;close(false);Module.menuQueue.push([19,pendingTicket]);
  };
  function updatePair(){
    const count=pairRows.filter((_,i)=>mask&(1<<i)).length;
    selection.textContent=cancelling?'Returning without changing pairs…':count+' Of 2 Selected';
    for(const [i,button]of Array.from(choices.children).entries()){
      button.setAttribute('aria-pressed',String(!!(mask&(1<<i))));
      button.disabled=busy||cancelling||(count>=2&&!(mask&(1<<i)));
    }
    send.disabled=busy||cancelling||count!==2;cancel.disabled=cancelling;
  }
  function command(row){
    if(!enabled()||!pair.open||busy||!Module.golferPairs?.active||Module.golferPairs.serial!==serial)return;
    busy=true;Module.clubhousePairQueue.push([serial,row]);updatePair();
  }
  function cancelStep(){
    if(busy)return;
    const row=pairRows.findIndex((_,i)=>mask&(1<<i));
    command(row);
  }
  function requestCancel(){cancelling=true;updatePair();cancelStep();}
  Module.clubhousePairStarted=function(id,actors){
    pendingTicket=null;serial=id;mask=0;busy=false;cancelling=false;
    const snapshot=Module.clubhouseSnapshot;
    pairRows=actors.map(actor=>snapshot?.rows.find(g=>g.actor===actor)).filter(Boolean);
    choices.replaceChildren();
    for(const [index,row]of pairRows.entries()){
      const button=el('button');button.type='button';button.dataset.actor=String(row.actor);
      button.append(el('strong',row.name),el('small',row.traits.join(', ')||'Waiting At The Clubhouse'));
      button.onclick=()=>command(index);choices.append(button);
    }
    pair.showModal();Module.clubhousePairOpen=true;document.body.classList.add('clubhouse-pair-open');updatePair();
  };
  Module.clubhousePairAcknowledged=function(id,selected){
    if(id!==serial||!pair.open)return;mask=selected;busy=false;updatePair();if(cancelling)cancelStep();
  };
  Module.clubhousePairError=function(message){busy=false;selection.textContent=message;};
  Module.clubhousePairFinished=function(id,selected){
    if(id!==serial)return;
    if(pair.open)pair.close();Module.clubhousePairOpen=false;document.body.classList.remove('clubhouse-pair-open');busy=false;cancelling=false;
    Module.clubhouseLastSelection={serial:id,selected};
    Module.finishClubhouseNavigation?.();
    if(focus?.isConnected)focus.focus({preventScroll:true});
  };
  root.querySelector('header button').onclick=close;
  root.addEventListener('cancel',e=>{e.preventDefault();close();});
  pair.addEventListener('cancel',e=>{e.preventDefault();requestCancel();});
  cancel.onclick=requestCancel;send.onclick=()=>command(-1);
  root.addEventListener('pointerdown',()=>{pointer=true;});
  for(const type of ['pointerup','pointercancel'])root.addEventListener(type,()=>{pointer=false;});
  for(const panel of [root,pair])for(const type of ['pointerdown','pointerup','pointermove','pointercancel','mousedown','mouseup','mousemove','click','touchstart','touchmove','touchend','wheel','keydown','keyup'])panel.addEventListener(type,e=>e.stopPropagation());
  setInterval(()=>{
    if(root.open&&!available())close();
    if(!enabled()||Module.atTitle||Module.loadState?.active||Module.courseLoading?.active){
      Module.clubhouseSnapshot=null;pendingTicket=null;
    }
    const result=Module.menuResult;
    if(pendingTicket!==null&&result?.kind===19&&result.item===pendingTicket&&result.status===-2){
      pendingTicket=null;Module.openClubhouseManagement();status.textContent='The waiting queue changed. Please choose again.';
    }
  },250);
})();
