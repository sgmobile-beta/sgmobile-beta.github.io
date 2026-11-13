// Read-only records dialog. It never dispatches an original gameplay command.
(function(){
  'use strict';
  if (!Module.saveRules || !globalThis.HTMLDialogElement?.prototype.showModal) return;
  const model=SGClubRecordsModel;
  const root=document.createElement('dialog');
  root.id='club-records';
  root.setAttribute('aria-labelledby','club-records-title');
  root.innerHTML='<header><h2 id="club-records-title">Club Records &amp; Hall of Fame</h2><button type="button" autofocus>Close</button></header><div class="club-records-body"></div>';
  const style=document.createElement('style');
  style.textContent=`
    #club-records{inset:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));width:min(640px,calc(100% - max(12px,env(safe-area-inset-right)) - max(12px,env(safe-area-inset-left))));max-height:calc(100dvh - max(12px,env(safe-area-inset-top)) - max(12px,env(safe-area-inset-bottom)));box-sizing:border-box;overflow:auto;overscroll-behavior:contain;padding:0;border:1px solid var(--menu-border);border-radius:14px;background:var(--menu-bg);color:var(--menu-text);font:15px/1.4 system-ui,sans-serif}
    #club-records::backdrop{background:#161c37a6}
    #club-records header{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border-bottom:1px solid var(--menu-border);background:var(--menu-panel);z-index:1}
    #club-records h2{font-size:clamp(18px,4vw,24px);margin:0}
    #club-records h3,#club-records h4{margin:8px 0 4px}
    #club-records .club-records-body{padding:8px 12px 12px}
    #club-records nav{display:flex;flex-wrap:wrap;gap:5px}
    #club-records button,#club-records select{min-height:44px;border:1px solid var(--menu-border);border-radius:8px;background:var(--menu-button);color:inherit;font:inherit;padding:6px 9px;max-width:100%;touch-action:manipulation}
    #club-records button[aria-pressed=true]{background:var(--menu-selected)}
    #club-records article{margin:7px 0;padding:7px 10px;border-radius:8px;border:1px solid var(--menu-border);background:#fff9e8;overflow-wrap:anywhere}
    #club-records .club-holder{display:flex;align-items:center;flex-wrap:wrap;gap:3px 10px;padding:3px 0}
    #club-records summary{box-sizing:border-box;min-height:44px;padding:11px 0;cursor:pointer}
    #club-records label{display:flex;align-items:center;flex-wrap:wrap;gap:6px}
  `;
  document.head.append(style);document.body.append(root);
  const closeButton=root.querySelector('button'), body=root.querySelector('.club-records-body');
  let focus, pending=null, showing=null, until=0;

  function element(tag,text){
    const item=document.createElement(tag);
    if(text)item.textContent=text;
    return item;
  }
  function close(){
    if(!root.open)return;
    root.close();Module.clubRecordsOpen=false;
    if(focus?.isConnected)focus.focus({preventScroll:true});
    else document.getElementById('mobile-menu')?.focus({preventScroll:true});
  }
  function available(){
    const s=Module.mobileState;
    return !!(Module.hasGameFeature('clubRecords') && Module.mapCourseReady && s?.course &&
      !Module.atTitle && !Module.loadState?.active && !Module.courseLoading?.active &&
      !Module.saveFilesOpen && !Module.backupHistoryOpen && !Module.mobileReportOpen &&
      !Module.mobilePreferencesOpen && !Module.analyticsActive && !Module.golferHistoriesOpen &&
      !Module.golferCard?.active && !Module.profileState?.active && !Module.progressScreen?.active &&
      !s.photoActive && !s.fundsCheck && !s.tournamentActive && !Module.shotPending);
  }
  function holder(mark, value){
    const row=element('div');
    row.className='club-holder';
    row.append(element('strong',mark.name),element('span',value+' · '+mark.date));
    if(Module.hasClubRecordProfile?.(mark.person)){
      const profile=element('button','Golfer Profile');
      profile.type='button';
      profile.onclick=()=>{close();Module.openClubRecordProfile?.(mark.person);};
      row.append(profile);
    }
    return row;
  }
  function records(data){
    const section=element('section'), list=element('div');
    section.append(element('h3','Course Records'));
    if(!data.boards.length){
      section.append(element('p','No records yet. Let a regular golfer complete an observed round on this course.'));
      return section;
    }
    const leader=Object.values(data.club?.people||{}).sort((a,b)=>b.count-a.count||a.frame-b.frame)[0];
    if(leader){
      const card=element('article');
      card.append(element('h4','Most Recorded Rounds'),holder(leader,String(leader.count)));
      section.append(card);
    }
    const label=element('label','Recorded layout '), select=element('select');
    for(const [index,board] of data.boards.entries()){
      const option=element('option','Layout '+(index+1)+' · '+board.length+' holes · '+board.started);
      option.value=String(index);select.append(option);
    }
    select.value=String(data.boards.length-1);
    function show(){
      const board=data.boards[Number(select.value)];
      list.replaceChildren();
      for(const [kind,holders] of Object.entries(board.records)){
        const current=holders.at(-1), card=element('article');
        card.append(element('h4',model.title(kind)),holder(current,model.score(kind,current.value)));
        if(holders.length>1){
          const history=element('details');
          history.append(element('summary','Previous Holders'));
          for(const mark of holders.slice(0,-1).reverse())history.append(holder(mark,model.score(kind,mark.value)));
          card.append(history);
        }
        list.append(card);
      }
    }
    select.onchange=show;label.append(select);section.append(label,list);show();
    return section;
  }
  function hall(data){
    const section=element('section');
    section.append(element('h3','Hall of Fame'),element('p','Current and retained former holders, plus up to '+model.MAX_HONORS+' recent club honors.'));
    if(!data.club){section.append(element('p','Verified accomplishments will appear here as golfers complete rounds.'));return section;}
    const people=new Map();
    function honor(mark,label){
      if(!people.has(mark.person))people.set(mark.person,{mark,labels:new Set()});
      people.get(mark.person).labels.add(label);
    }
    for(const board of data.boards){
      for(const [kind,holders] of Object.entries(board.records)){
        for(const [index,mark] of holders.entries())
          honor(mark,(index===holders.length-1?'Current Holder · ':'Former Holder · ')+model.title(kind)+' · '+mark.date);
      }
    }
    for(const mark of data.club.honors)honor(mark,model.title(mark.kind)+' · '+mark.date);
    for(const {mark,labels} of people.values()){
      const card=element('article'), list=element('ul');
      card.append(holder(mark,data.club.people[mark.person].count+' recorded rounds'));
      for(const label of labels)list.append(element('li',label));
      card.append(list);section.append(card);
    }
    return section;
  }
  function milestones(data){
    const section=element('section');section.append(element('h3','Recent Milestones'));
    if(!data.recent.length)section.append(element('p','No significant milestones have been observed on this course yet.'));
    for(const event of data.recent.slice().reverse()){
      const card=element('article');
      card.append(element('h4',model.title(event.kind)),holder(event,model.score(event.kind,event.value)));
      if(event.previous)card.append(element('p','Previous: '+event.previous.name+' · '+model.score(event.kind,event.previous.value)));
      section.append(card);
    }
    return section;
  }
  function open(view='records'){
    if(root.open || !available())return false;
    const data=Module.clubRecordsView?.();
    if(!data)return false;
    const tabs=element('nav'), panel=element('div');
    tabs.setAttribute('aria-label','Club Records sections');
    const sections={records:['Course Records',records],hall:['Hall of Fame',hall],recent:['Recent Milestones',milestones]};
    for(const [id,[label,render]] of Object.entries(sections)){
      const button=element('button',label);
      button.type='button';
      button.onclick=()=>{
        for(const other of tabs.children)other.setAttribute('aria-pressed',String(other===button));
        panel.replaceChildren(render(data));
      };
      tabs.append(button);
      if(view===id)button.click();
    }
    const info=element('p','Recorded since tracking began. Scores compare matching observed layouts. Each record keeps up to '+model.MAX_FORMER+' previous holders.');
    if(data.limited)info.append(' The tracking limit was reached. Existing records are retained.');
    body.replaceChildren(element('p',data.course.name),info,tabs,panel);
    focus=document.activeElement;
    Module.cancelMapGesture?.();
    root.showModal();root.scrollTop=0;Module.clubRecordsOpen=true;
    Module.clearClubRecordNotice();
    return true;
  }
  closeButton.onclick=close;
  root.addEventListener('cancel',event=>{event.preventDefault();close();});
  for(const type of ['pointerdown','pointerup','pointermove','pointercancel','mousedown','mouseup','click',
    'touchstart','touchmove','touchend','touchcancel','wheel','keydown','keyup','keypress'])
    root.addEventListener(type,event=>event.stopPropagation());
  Module.openClubRecords=open;
  Module.closeClubRecords=close;

  Module.queueClubRecordNotice=event=>{pending=event;};
  Module.clearClubRecordNotice=()=>{pending=showing=null;until=0;};
  Module.clubRecordNotice=()=>{
    if(!available() || Module.mobileState.roundActive || Module.aimMode || Module.mobileState.constructing)return null;
    const now=performance.now();
    if(pending && (!showing || until<=now)){
      showing=pending;pending=null;until=now+7500;
    }
    if(until<=now || !showing)return null;
    const event=showing;
    return event.name+' · '+model.title(event.kind)+': '+model.score(event.kind,event.value)+
      (event.previous?' (previously '+model.score(event.kind,event.previous.value)+' by '+event.previous.name+')':'');
  };
  setInterval(()=>{if(root.open&&!available())close();},100);
})();
