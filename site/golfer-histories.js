// UI uses native-boundary copies only. Opening/closing never invokes Wasm.
(function(){
'use strict';if(typeof Module==='undefined'||!Module.saveRules)return;
Module.reconfigureGolferStates=SGGolferHistoryModel.reconfigure;
let model=null,career='',live=new Map(),batch=null,selected='',focus=null,returnCard=null,optionsStamp='',contentStamp='',interacting=false,batchStarted=0,sampleMs=0,maxSampleMs=0;
const allowed = () => !!Module.hasGameFeature?.('golferHistories');
const experiencesAllowed = () => !!Module.hasGameFeature?.('golferExperiences');
const recordsAllowed = () => !!Module.hasGameFeature?.('clubRecords');
let records = null;
let experiences = null;
let view = 'history';
Module.golferHistoryReady=()=>!!(model&&(allowed()||experiencesAllowed()||recordsAllowed())&&career===Module.saveRules.active?.game.id&&!Module.mobileState?.tournamentActive&&Module.mapCourseReady&&!Module.atTitle&&!Module.loadState?.active&&!Module.courseLoading?.active&&!Module.saveFilesOpen);
Module.golferHistoryEligible = actor => {
  const row = live.get(actor);
  const card = Module.golferCard;
  return Module.golferHistoryReady() && row && card?.actor === actor && card.profile === row.slot;
};
Module.saveRules.register('golferHistories',{validate:(data,game)=>{SGGolferHistoryModel.create(data,game.id);return true;},prepare:(data,game)=>({model:SGGolferHistoryModel.create(data,game.id),career:game.id}),activate:p=>{model=p.model;career=p.career;live.clear();sampleMs=maxSampleMs=0;},capture:()=>model.capture(),dispose:()=>{close();model=null;career='';live.clear();Module.golferHistoriesDiagnostics=null;}});
function historyState(game, states) {
  return game.features.golferHistories?.enabled ? states.golferHistories?.data || {} : undefined;
}
Module.saveRules.register('clubRecords', {
  validate(data, game, states) {
    return SGClubRecordsModel.validateCareer(data, game.id, historyState(game, states));
  },
  prepare(data, game, states) {
    return {records:SGClubRecordsModel.create(data, game.id, historyState(game, states)), career:game.id};
  },
  activate(prepared) {
    records = prepared.records;
    if (!model) { model = records.identity; career = prepared.career; }
  },
  capture: () => records.capture(model),
  dispose() {
    Module.closeClubRecords?.();
    Module.clearClubRecordNotice?.();
    records = null;
    model = null;
    career = '';
    live.clear();
    Module.golferHistoriesDiagnostics = null;
  }
});
function experienceIdentity(game, states) {
  return historyState(game, states) ??
    (game.features.clubRecords?.enabled ? states.clubRecords?.data?.identities || {} : undefined);
}
Module.saveRules.register('golferExperiences', {
  validate(data, game, states) {
    return SGGolferExperienceModel.validateCareer(data, game.id, experienceIdentity(game, states));
  },
  prepare(data, game, states) {
    return {model: SGGolferExperienceModel.prepare(data, game.id, experienceIdentity(game, states)), career: game.id};
  },
  activate(prepared) {
    experiences = prepared.model;
    if (!model) {
      model = experiences.identity;
      career = prepared.career;
      live.clear();
      sampleMs = maxSampleMs = 0;
    }
  },
  capture() { return experiences.capture(model); },
  dispose() {
    close();
    experiences = null;
    model = null;
    career = '';
    live.clear();
    Module.golferHistoriesDiagnostics = null;
  }
});
const text = (address, length) => Module.readGameText(address, length).trim();
function courseIdentity() {
  const heap=Module.HEAPU8, ints=new Int32Array(heap.buffer), shorts=new Int16Array(heap.buffer);
  const property=ints[0x59bf90>>2],template=property>=0&&property<16?heap[0x571ff4+property*46]:-1;
  const offset=shorts[0x59d81c>>1];
  return {property,template,name:template>=0&&template<16?text(offset>=0&&offset<0x2324?0x56fcb0+offset:0x4c1ea8+template*130+1,129):''};
}
Module.clubRecordsView = () => {
  if (!recordsAllowed() || !records) return null;
  const data=records.view(courseIdentity());
  data.limited ||= model.info().limited;
  return data;
};
// Capture authored terrain, elevation, lie and routing at committed holes.
function recordedLayout() {
  const heap=Module.HEAPU8;
  let lo=0x811c9dc5,hi=0x85ebca6b;
  function add(start,count){
    for(let i=start;i<start+count;i++){
      lo=Math.imul(lo^heap[i],0x01000193);
      hi=Math.imul(hi^heap[i],0x9e3779b1);
    }
  }
  add(0x5722e8,2500);add(0x56988c,2500);add(0x53bbac,2500);add(0x5a4998,2601);
  for(let hole=1;hole<=18;hole++){
    const at=0x575ab0+hole*520;
    add(at,1);
    if(heap[at])add(at+4,28);
  }
  return [lo,hi].map(n=>(n>>>0).toString(16).padStart(8,'0')).join('');
}
function completedRecord(person,name,round,layout) {
  const event=records?.complete(person,name,{...round,date:gameDate(round.frame,true)},layout);
  if(event)Module.queueClubRecordNotice?.(event);
}
function read(actor){const h=Module.HEAPU8,s=new Int16Array(h.buffer),i=new Int32Array(h.buffer),a=0x5794b8+actor*256,slot=s[(a+0xb6)>>1];if(actor<0||actor>=152||slot<1||slot>75||h[a+24]!==0)return null;const p=0x4d6088+slot*560;
 const fingerprint=Array.from(h.subarray(p,p+34),b=>b.toString(16).padStart(2,'0')).join(''),name=[text(p,16),text(p+16,16)].filter(Boolean).join(' '),traits=[];
 for(let bit=0;bit<5;bit++)if(h[p+32]&(1<<bit)){const ptr=i[(0x4c2864>>2)+bit]>>>0;if(ptr>=0x400000&&ptr<0x4f0000)traits.push(text(ptr,80));}
 const pars=[];for(let hole=1;hole<=18;hole++){const par=h[0x575ab0+hole*520];if(!par)break;if(par>9)return null;pars.push(par);}
 const course=courseIdentity();
 const row = {course,actor,slot,birth:i[(a+192)>>2],fingerprint,name,traits,
   hole:(h[a+33]<<24)>>24,stroke:h[a+34],card:Array.from(h.subarray(a+36,a+54)),pars,frame:i[0x834170>>2]};
 if (experiencesAllowed()) {
   row.interests = text(p + 48, 512);
   row.feelings = SGGolferExperienceModel.meters(s[(a+0xa4)>>1],
     s.subarray((a+0x88)>>1, ((a+0x88)>>1)+5),
     s[(a+0xaa)>>1], s[(a+0xa6)>>1], s[(a+0xa8)>>1]);
 }
 return row;
}
function gameDate(frame, full=false) {
  const month = Math.trunc(frame / 1024) & 7;
  const year = 2001 + Math.trunc(frame / 8192);
  const pointer = new Uint32Array(Module.HEAPU8.buffer)[(0x4c2908 >> 2) + month];
  const day=Math.trunc((frame&1023)*30/1024)+1;
  return text(pointer,32)+' '+(full?day+', ':'')+year;
}
Module.originalCourseObservations=Object.freeze({course:courseIdentity,layout:recordedLayout,date:frame=>gameDate(frame,true)});
Module.recordGolferExperience = (actor, hole, stroke, frame, sign, address) => {
  if (!experiences || !experiencesAllowed() || !Module.golferHistoryReady()) return;
  const row = read(actor);
  const person = model.observe(row);
  if (!person) return;
  experiences.record(person.id, {hole, stroke, frame, sign, date:gameDate(frame),
    course:row.course.name, text:text(address, 512)});
};

Module.beginGolferObservation=()=>{batchStarted=performance.now();batch=new Map();};
Module.receiveGolferObservation=(actor,hole,score,before,ended)=>{if(!Module.golferHistoryReady())return;const row=read(actor);if(!row)return;const person=model.observe(row);if(!person)return;row.person=person.id;if(allowed()||experiencesAllowed())(batch||live).set(actor,row);
 if(hole && (allowed()||recordsAllowed())){
   model.hole({...row,hole,score,before:Array.from(Module.HEAPU8.subarray(before,before+18)),
     ended:!!ended,date:gameDate(row.frame),layout:records?recordedLayout():undefined},records?completedRecord:undefined,allowed());
 }
 diagnostics();};
Module.endGolferObservation=()=>{if(batch){live=batch;batch=null;sampleMs=performance.now()-batchStarted;maxSampleMs=Math.max(maxSampleMs,sampleMs);}diagnostics();if(!root.hidden&&!interacting&&document.activeElement!==select)render();};
Module.golferHistoryDepart=actor=>{if(Module.golferHistoryReady()){model.depart(actor);live.delete(actor);}};
Module.golferHistoryInvalidate = slot => {
  if (!Module.golferHistoryReady()) return;
  model.invalidate(slot);
  for (const [actor, row] of live) if (row.slot === slot) live.delete(actor);
};
function diagnostics(){if(model){const info=model.info();Module.golferHistoriesDiagnostics={career,people:info.people,rounds:info.rounds,live:live.size,limit:info.limited,sampleMs,maxSampleMs};}}
const root=document.createElement('section');root.id='golfer-histories';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Golfer Profiles & Histories');
const style=document.createElement('style');style.textContent=`#golfer-profile-views{display:flex;gap:8px;margin:8px 0}#golfer-profile-views[hidden]{display:none}#golfer-profile-views [aria-pressed=true]{outline:2px solid currentColor}#experience-meters{display:grid;grid-template-columns:repeat(auto-fit,minmax(105px,1fr));gap:8px}#experience-meters>div{display:grid;gap:4px}#experience-meters [role=meter]{display:block;height:8px;border-radius:4px;background:linear-gradient(to right,var(--feeling-full) var(--feeling-fill),var(--feeling-rest) var(--feeling-fill));--feeling-full:#42ff42;--feeling-rest:#21a521}
#experience-meters [data-low]{--feeling-full:#ff4242;--feeling-rest:#c50000}.experience-comment{background:var(--menu-button);border:1px solid var(--menu-border);border-radius:9px;padding:4px 10px;margin:8px 0;overflow-wrap:anywhere}.experience-comment p{white-space:pre-wrap}
.experience-comment[data-reaction=positive]{background:#e5f3e7;border-color:#85ab8d}
.experience-comment[data-reaction=negative]{background:#fae7e7;border-color:#c59191}
.experience-reaction-positive{color:var(--menu-good)}
.experience-reaction-negative{color:var(--menu-danger)}#golfer-histories[hidden]{display:none!important}#golfer-histories{position:fixed;inset:calc(var(--screen-top,0px) + env(safe-area-inset-top,0px) + 22px) 0 0;z-index:110;overflow:auto;overscroll-behavior:contain;box-sizing:border-box;padding:12px max(12px,env(safe-area-inset-right)) calc(60px + env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));background:var(--golfer-profile-scrim);color:var(--menu-text);font:15px/1.45 system-ui,sans-serif}#golfer-histories>div{max-width:750px;margin:auto}#golfer-histories header{position:sticky;top:0;background:var(--menu-bg);display:flex;align-items:center;justify-content:space-between;gap:8px;z-index:1}#golfer-histories h2{font-size:21px;margin:8px 0}
#golfer-histories[data-view=experiences] header{display:grid;grid-template-columns:60px minmax(0,1fr) 60px;gap:4px}
#golfer-histories[data-view=experiences] h2{grid-column:2;text-align:center;text-wrap:balance;font-size:clamp(18px,4.8vw,21px);line-height:1.2}
#golfer-histories[data-view=experiences] header button{justify-self:end}
#golfer-histories h3{font-size:17px;margin:12px 0 6px}#golfer-histories p{margin:8px 0}#golfer-histories small{display:block;font-size:12px;margin:8px 0}#golfer-histories button,#golfer-histories select{min-height:44px;font:inherit;padding:8px;border:1px solid var(--menu-border);border-radius:9px;background:var(--menu-button);color:var(--menu-text)}#golfer-histories select{width:100%}#golfer-histories table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}#golfer-histories td,#golfer-histories th{padding:7px 4px;text-align:left;border-bottom:1px solid var(--menu-border)}#golfer-histories details{padding:8px 0;border-bottom:1px solid var(--menu-border)}#golfer-histories summary{min-height:44px;cursor:pointer}#history-metrics{display:flex;gap:8px;flex-wrap:wrap}#history-metrics p{flex:1;min-width:85px;background:var(--menu-button);padding:9px;border-radius:9px}`;document.head.append(style);
const el=(tag,value,id)=>{const e=document.createElement(tag);if(value)e.textContent=value;if(id)e.id=id;return e;},container=el('div'),header=el('header'),heading=el('h2','Golfer Profiles & Histories'),back=el('button','Close','golfer-histories-close'),select=el('select',null,'golfer-histories-select'),body=el('div',null,'golfer-histories-content');back.type='button';select.setAttribute('aria-label','Tracked golfer');header.append(heading,back);const views=el('nav',null,'golfer-profile-views');const historyView=el('button','History');const experienceView=el('button','Experiences');views.append(historyView,experienceView);container.append(header,select,views,body);root.append(container);document.body.append(root);
function close(){if(root.hidden)return;root.hidden=true;Module.golferHistoriesOpen=false;document.body.classList.remove('golfer-histories-open');Module.cancelMapGesture?.();returnCard=null;selected='';contentStamp='';if(focus?.isConnected)focus.focus({preventScroll:true});}
Module.closeGolferHistories = close;
function profileOwnerAvailable() {
  return !Module.mobileState?.photoActive && !Module.profileState?.active &&
    !Module.progressScreen?.active;
}
function openProfile(actor, requestedView, person) {
  if (!Module.golferHistoryReady() || !profileOwnerAvailable() || Module.shotPending || Module.analyticsActive || Module.clubRecordsOpen ||
      (requestedView === 'history' ? !allowed() : !experiencesAllowed())) return false;
  const row = live.get(actor);
  if (actor !== undefined && !Module.golferHistoryEligible(actor)) return false;
  view = requestedView;
  selected = person || row?.person || '';
  returnCard = Module.golferCard?.active ? {actor:Module.golferCard.actor,serial:Module.golferCard.serial,profile:Module.golferCard.profile} : null;
  focus = document.activeElement;
  contentStamp = '';
  Module.cancelMapGesture?.();
  Module.golferHistoriesOpen = true;
  root.hidden = false;
  document.body.classList.add('golfer-histories-open');
  render();
  back.focus({preventScroll:true});
  return true;
}
function clubhousePerson(expected,kind){
  if(!Module.hasGameFeature('clubhouseManagement')||!Module.golferHistoryReady()||
     (kind==='history'?!allowed():!experiencesAllowed()))return null;
  const row=live.get(expected.actor);
  return row&&row.slot===expected.profile&&row.birth===expected.visit&&row.hole===-1?row.person:null;
}
Module.hasClubhouseGolferProfile=(row,kind)=>!!clubhousePerson(row,kind);
Module.openClubhouseGolferProfile=(row,kind)=>{
  const person=clubhousePerson(row,kind);
  return !!person&&openProfile(undefined,kind,person);
};
Module.openGolferHistories = actor => openProfile(actor, 'history');
Module.openGolferExperiences = actor => openProfile(actor, 'experiences');
Module.hasClubRecordProfile = person => allowed() && !!model?.person(person);
Module.openClubRecordProfile = person => Module.hasClubRecordProfile(person) && openProfile(undefined,'history',person);
historyView.onclick = () => {view = 'history'; render();};
experienceView.onclick = () => {view = 'experiences'; render();};
back.onclick=close;select.onchange=()=>{selected=select.value;render();};
function render(){if(!model||!(allowed()||experiencesAllowed())){close();return;}views.hidden=!(allowed()&&experiencesAllowed());historyView.setAttribute('aria-pressed',String(view==='history'));experienceView.setAttribute('aria-pressed',String(view==='experiences'));root.dataset.view=view;heading.textContent=view==='history'?'Golfer Profiles & Histories':'Golfer Experiences & Preferences';root.setAttribute('aria-label',heading.textContent);
 const people=model.roster();if(!people.some(p=>p.id===selected))selected=people[0]?.id||'';const nextOptions=JSON.stringify(people.map(p=>[p.id,p.name]));if(nextOptions!==optionsStamp){optionsStamp=nextOptions;select.replaceChildren();for(const p of people){const o=el('option',p.name);o.value=p.id;select.append(o);}}for(const o of select.options){const p=people.find(p=>p.id===o.value),row=Array.from(live.values()).find(r=>r.person===p.id);o.textContent=p.name+(row?' · '+(row.hole===-1?'Clubhouse':row.hole===19?'Leaving':'Hole '+row.hole):' · Away');}select.value=selected;const nextContent=JSON.stringify([view,selected,model.person(selected),view==='experiences'?experiences?.recent(selected):null,Array.from(live.values()).map(r=>[r.person,r.hole,r.stroke,r.traits,r.feelings,r.interests])]);if(contentStamp===nextContent)return;contentStamp=nextContent;const scroll=root.scrollTop,expanded=new Set(Array.from(body.querySelectorAll('details[open]')).map(d=>d.dataset.round));body.replaceChildren();const p=model.person(selected);if(!p){body.append(el('p','No eligible golfers observed yet. Let regular golfers arrive and play. Tournament substitutes and the playable character retain their original cards.'));return;}
 const row=Array.from(live.values()).find(r=>r.person===selected);body.append(el('h3',p.name),el('p',row?(row.hole===-1?'Waiting in the clubhouse.':row.hole===19?'Finished this visit; leaving the course.':'Playing hole '+row.hole+' · '+row.stroke+' current strokes.'):'Currently away from the course. Recorded history is retained.'));
 if(row?.traits.length)body.append(el('p','Original traits: '+row.traits.join(', ')));
 if (view === 'experiences') {
   renderExperiences(p, row);
   if (model.info().limited) body.append(el('p', 'The tracked golfer roster is full. Existing records are kept.'));
   root.scrollTop = scroll;
   return;
 }
 if(records){
   const honors=records.honorsFor(courseIdentity(),p.id);
   if(honors.length){const list=el('ul');for(const honor of honors)list.append(el('li',honor));body.append(el('h3','Club Accomplishments'),list);}
 }
 body.append(el('p','Skills, feelings and original actions remain in the original golfer card.'));
 const metrics=el('div',null,'history-metrics'),s=model.summary(selected);for(const [label,value]of [['Recorded rounds',s.count],['Best score',s.best??'—'],['Average score',s.average===null?'—':s.average.toFixed(1)]])metrics.append(el('p',label+': '+value));body.append(metrics);const pending=model.pending(selected);if(pending?.last)body.append(el('p','Round in progress: '+pending.last+' / '+pending.pars.length+' holes recorded · '+pending.scores.reduce((a,b)=>a+b,0)+' strokes. This is not included in completed-round averages.'));
 body.append(el('small','History starts here; earlier rounds are not included. Latest 32 completed rounds. Course lengths and pars may differ—compare individual scorecards.'));
 if(!p.rounds.length)body.append(el('p','No complete round recorded yet. Let this golfer finish a fresh round; partial rounds are not counted.'));
 for(const r of p.rounds.slice().reverse()){const details=el('details');details.dataset.round=r.id;details.open=expanded.has(r.id);const total=r.holes.reduce((n,h)=>n+h.score,0),par=r.holes.reduce((n,h)=>n+h.par,0),relative=total-par;details.append(el('summary',r.date+' · '+r.course.name+' · '+r.holes.length+' holes · '+total+' ('+(relative>0?'+':'')+relative+')'));const table=el('table'),head=el('tr');for(const v of ['Hole','Par','Score'])head.append(el('th',v));table.append(head);for(const h of r.holes){const tr=el('tr');for(const v of [h.hole,h.par,h.score])tr.append(el('td',String(v)));table.append(tr);}details.append(table);body.append(details);}
 root.scrollTop=scroll;if(model.info().limited)body.append(el('p','Identity storage is full. Existing histories are preserved; new identities are not attached to old golfers.'));
}
function renderExperiences(person, row) {
  if (row?.feelings) {
    body.append(el('h3', 'Current feelings'));
    const meters = el('div', null, 'experience-meters');
    ['Fun', 'Attitude', 'Energy', 'Hunger', 'Thirst'].forEach((name, index) => {
      const label = el('div', name);
      const meter = el('span');
      const fill = row.feelings[index];
      meter.setAttribute('role', 'meter');
      meter.setAttribute('aria-label', name);
      meter.setAttribute('aria-valuemin', '0');
      meter.setAttribute('aria-valuemax', '80');
      meter.setAttribute('aria-valuenow', fill);
      meter.toggleAttribute('data-low', fill < 40);
      meter.style.setProperty('--feeling-fill', fill / 80 * 100 + '%');
      label.append(meter);
      meters.append(label);
    });
    body.append(meters);
  } else {
    body.append(el('p', 'Current feelings are available while this golfer is on the course.'));
  }
  if (row?.interests) {
    body.append(el('h3', 'Original profile interests'), el('p', row.interests));
  }
  if (allowed()) {
    const performance = SGGolferExperienceModel.performance(person.rounds);
    if (performance) {
      const signed = value => (value > 0 ? '+' : '') + value.toFixed(1);
      body.append(el('h3', 'Measured performance'));
      body.append(el('p', performance.course + ' · ' + performance.count + ' recorded rounds with matching pars. ' +
        'Lowest average vs par on hole ' + performance.best.hole + ' (' + signed(performance.best.average) +
        '). Highest on hole ' + performance.worst.hole + ' (' + signed(performance.worst.average) + ').'));
    }
  }
  body.append(el('h3', 'Recent original comments'));
  const recent = experiences.recent(person.id);
  if (!recent.length) {
    body.append(el('p', 'No individual comments recorded yet. Let this golfer play to collect original course and shot feedback.'));
    return;
  }
  body.append(el('small', 'Latest 24 comments. Reaction labels come from the original reaction record.'));
  for (const event of recent.slice().reverse()) {
    const item = el('article');
    item.className = 'experience-comment';
    const details = el('small', event.course + ' · ' + event.date + ' · Hole ' + event.hole);
    if (event.sign) {
      const positive = event.sign === 1;
      item.dataset.reaction = positive ? 'positive' : 'negative';
      const label = el('strong', positive ? 'POSITIVE' : 'NEGATIVE');
      label.className = positive ? 'experience-reaction-positive' : 'experience-reaction-negative';
      details.append(' · ', label);
    }
    item.append(details, el('p', event.text));
    body.append(item);
  }
}
for(const type of ['pointerdown','pointermove','pointerup','pointercancel','mousedown','mousemove','mouseup','click','dblclick','touchstart','touchmove','touchend','touchcancel','wheel','keydown','keyup','keypress'])root.addEventListener(type,e=>e.stopPropagation());
root.addEventListener('pointerdown',()=>{interacting=true;},true);for(const type of ['pointerup','pointercancel'])addEventListener(type,()=>{interacting=false;});
let released='';addEventListener('keydown',e=>{if(!Module.golferHistoriesOpen)return;e.stopImmediatePropagation();if(e.key==='Escape'){e.preventDefault();released=e.key;close();}else if(e.key==='Tab'){e.preventDefault();const items=Array.from(root.querySelectorAll('button,select,summary')).filter(el=>el.getClientRects().length),i=items.indexOf(document.activeElement);items[(i+(e.shiftKey?-1:1)+items.length)%items.length]?.focus();}else if((e.key==='Enter'||e.key===' ')&&!e.target.closest('select')){e.preventDefault();released=e.key;if(!e.repeat)e.target.click();}},true);
for(const type of ['keyup','keypress'])addEventListener(type,e=>{if(Module.golferHistoriesOpen||released===e.key){e.preventDefault();e.stopImmediatePropagation();if(type==='keyup')released='';}},true);
setInterval(() => {
  if (root.hidden) return;
  const card = Module.golferCard;
  const cardChanged = returnCard && (!card?.active || returnCard.actor !== card.actor ||
    returnCard.serial !== card.serial || returnCard.profile !== card.profile);
  if (!Module.golferHistoryReady() || !profileOwnerAvailable() || cardChanged) close();
}, 100);
})();
