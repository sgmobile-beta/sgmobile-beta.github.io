// Player presentation for the original-ledger Profitability Turnaround.
(function(){
  'use strict';
  const runtime=Module.businessTurnaround;
  if(!runtime||!globalThis.HTMLDialogElement?.prototype.showModal)return;

  const goal='Profitability Turnaround';
  const changeEvent='simgolf-business-turnaround-change';
  const labels=['Greens fees','Food and drink','Salaries','Maintenance and interest'];
  const currency=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
  const {seasonLength}=globalThis.SGBusinessTurnaroundModel;
  const reasons={
    'ledger-interrupted':'The recorded operating ledger was interrupted or became inconsistent.',
    'incomplete-window':'The tracked season did not span a full accounting period.',
    'open-holes-changed':'The number of open holes differed between the opening and closing boundaries.',
    'ledger-unverified':'The recorded operating ledger could not be reconciled with the original accounts.',
    'no-positive-greens-fees':'The season ended without positive greens fees.',
    'different-baseline-holes':'This season had a different number of open holes from the loss baseline.',
    'opening-unavailable':'Tracking could not begin from the opening accounting records.'
  };
  const unavailable={
    'course-unavailable':'Return to your course to start.',
    'ordinary-career-required':'This challenge is available in an ordinary Enhanced career.',
    'open-hole-required':'Open at least one hole to start.',
    'calendar-unavailable':'The native accounting calendar is unavailable for a new attempt.'
  };
  let dialog,content,status,opener,openReport,timer,notice=null,pointer=false,confirming=false,message='',stamp='';

  function available(){
    const m=Module,s=m.mobileState;
    return !!(m.mobileUI&&m.hasGameFeature?.('businessChallenges')&&m.mapCourseReady&&s?.course&&
      !m.atTitle&&!m.saveRules.draft&&!m.rulesetBlocked&&!m.loadState?.active&&!m.courseLoading?.active&&
      !s.roundActive&&!s.tournamentActive&&!s.staffOpen&&!s.constructing&&!s.elevation&&!s.rebuildClubhouse&&
      !s.photoActive&&!s.fundsCheck&&!s.textInput&&!m.fundsCheck&&!m.aimMode&&!m.shotPending&&
      !m.lotMode&&!m.lotPending&&!m.terrainMode&&!(m.mapMode||0)&&!(m.terrainPreview?.pending>0)&&
      !m.menuQueue?.length&&!m.touchQueue?.length&&!m.saveFilesOpen&&!m.backupHistoryOpen&&
      !m.analyticsActive&&!m.analyticsSession?.active&&!m.analyticsRequest&&!m.golferHistoriesOpen&&
      !m.clubRecordsOpen&&!m.designChallengesOpen&&!m.courseDesignLabOpen&&!m.clubhouseManagementOpen&&
      !m.clubhousePairOpen&&!m.golferPairs?.active&&!m.mobileReportOpen&&!m.mobilePreferencesOpen&&
      !m.golferCard?.active&&!m.profileState?.active&&!m.progressScreen?.active&&!m.holeStats?.active&&
      !m.featureSettingsOpen&&!m.editionModalOpen);
  }
  function element(tag,text){
    const node=document.createElement(tag);
    if(text!==undefined)node.textContent=text;
    return node;
  }
  function button(label,action){
    const node=element('button',label);
    node.type='button';node.addEventListener('click',action);
    return node;
  }
  function close(){
    if(!dialog?.open)return;
    dialog.close();Module.businessChallengesOpen=false;
    clearInterval(timer);timer=null;pointer=false;confirming=false;openReport=null;
    if(opener?.isConnected&&opener.getClientRects().length)opener.focus({preventScroll:true});
    else document.getElementById('mobile-menu')?.focus({preventScroll:true});
  }
  function build(){
    dialog=element('dialog');dialog.id='business-challenges';
    dialog.setAttribute('aria-labelledby','business-challenges-title');
    const header=element('header'),title=element('h2','Business Challenges');
    title.id='business-challenges-title';
    const done=button('Close',close);done.id='business-challenges-close';done.autofocus=true;
    header.append(title,done);
    const body=element('div');body.className='business-body';
    const name=element('h3',goal);
    status=element('p');status.className='business-status';status.setAttribute('role','status');
    content=element('div');
    body.append(name,status,content);dialog.append(header,body);
    const style=element('style');
    style.textContent=`
      #business-challenges{box-sizing:border-box;inset:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));width:min(640px,calc(100% - max(12px,env(safe-area-inset-left)) - max(12px,env(safe-area-inset-right))));max-height:calc(100dvh - max(12px,env(safe-area-inset-top)) - max(12px,env(safe-area-inset-bottom)));padding:0;overflow:auto;overscroll-behavior:contain;border:1px solid var(--menu-border);border-radius:14px;background:var(--menu-bg);color:var(--menu-text);font:15px/1.4 system-ui,sans-serif}
      #business-challenges::backdrop{background:#161c3780}
      #business-challenges header{position:sticky;top:0;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;background:var(--menu-panel);border-bottom:1px solid var(--menu-border)}
      #business-challenges h2{font-size:clamp(18px,4vw,24px);margin:0}
      #business-challenges h3,#business-challenges h4,#business-challenges p{margin:6px 0}
      #business-challenges .business-body{padding:8px 12px 12px;overflow-wrap:anywhere}
      #business-challenges .business-status{font-weight:650}
      #business-challenges .business-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:8px;margin:8px 0}
      #business-challenges article{padding:6px 10px;border:1px solid var(--menu-border);border-radius:9px;background:var(--menu-button)}
      #business-challenges dl{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 8px;margin:8px 0}
      #business-challenges dd{margin:0;text-align:right;font-variant-numeric:tabular-nums}
      #business-challenges .business-total{font-weight:700;border-top:1px solid var(--menu-line);padding-top:4px}
      #business-challenges .business-actions{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 0}
      #business-challenges button{box-sizing:border-box;min-height:44px;max-width:100%;padding:6px 10px;border:1px solid var(--menu-border);border-radius:8px;background:var(--menu-button);color:inherit;font:inherit;touch-action:manipulation}
      #business-challenges button:disabled{opacity:.6}
      #business-challenges .business-medal{width:fit-content;border:1px solid #80601c;border-radius:8px;background:linear-gradient(#fff7d6,#efcd72);color:#382908;font-weight:700;padding:4px 9px}
    `;
    document.head.append(style);document.body.append(dialog);
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    dialog.addEventListener('pointerdown',()=>{pointer=true;},true);
    for(const type of ['pointerup','pointercancel'])dialog.addEventListener(type,()=>{pointer=false;});
    for(const type of ['pointerdown','pointerup','pointermove','pointercancel','mousedown','mouseup',
      'mousemove','click','dblclick','touchstart','touchmove','touchend','touchcancel','wheel','keydown','keyup','keypress'])
      dialog.addEventListener(type,event=>event.stopPropagation());
  }
  function march(year){return 'March '+(2001+year);}
  function accountingWindow(year){return march(year)+' – '+march(year+1);}
  function total(record){return record.rows.reduce((a,b)=>a+b,0);}
  function card(label,record){
    const panel=element('article'),heading=element('h4',label);
    const season=element('p',accountingWindow(record.year)+' · '+record.holes+' open '+(record.holes===1?'hole':'holes'));
    const rows=element('dl');
    for(const [index,value] of record.rows.entries())
      rows.append(element('dt',labels[index]),element('dd',currency.format(value*100)));
    const key=element('dt','Selected operating result'),value=element('dd',currency.format(total(record)*100));
    key.className=value.className='business-total';rows.append(key,value);
    panel.append(heading,season,rows);return panel;
  }
  function progressText(state,readiness,progress){
    const {active,medal}=state;
    if(medal)return ['Completed','A later comparable season reached break-even or better. The qualifying period is complete and the medal has been earned.'];
    if(!active){
      const block=unavailable[readiness?.startUnavailable];
      if(state.status==='property-changed')
        return ['Period Ineligible','The property changed. '+(block||'Start a new attempt to record a loss baseline on this property.')];
      return readiness?.canStart?['Waiting for Loss Baseline','Start tracking to record a complete eligible loss season.'] :
        ['Challenge Unavailable',block||'The challenge is unavailable right now.'];
    }

    const baseline=active.baseline;
    const stage=state.status==='invalid-period'?'Period Ineligible':
      baseline?'Observing Improvement':'Waiting for Loss Baseline';
    const lines=[stage,baseline?
      'Loss baseline recorded. Break even or make a profit in a later complete season at the same property with '+baseline.holes+' open '+(baseline.holes===1?'hole.':'holes.'):
      'Record a complete season with positive greens fees and an operating loss to establish the baseline.'];
    if(state.status==='invalid-period'){
      const last=progress?.rejection;
      lines.push(last?accountingWindow(last.year)+'. '+reasons[last.reason]:
        'The attempt records an ineligible period. Its reason is unavailable.');
    }else if(state.status==='interrupted'){
      lines.push('Tracking was interrupted. The next full accounting window is needed.');
    }else if(state.status==='baseline-profitable'){
      lines.push('The last eligible season broke even or made a profit.');
    }else if(state.status==='follow-up-loss'){
      lines.push('The last comparable season still had a loss. Your baseline stays in place.');
    }

    if(progress?.start==null){
      lines.push('The next native accounting boundary is unavailable.');
      return lines;
    }
    const year=progress.start/seasonLength, nextMarch=march(progress.end/seasonLength), window=active.window;
    if(window?.start===progress.start&&!window.tainted){
      lines.push('Tracking '+accountingWindow(year)+'. This season is in progress. Next evaluation at the '+nextMarch+' accounting boundary.');
    }else if(window?.tainted&&window.start===progress.start){
      lines.push('Tracking for '+accountingWindow(year)+' has been interrupted. The next accounting boundary is '+nextMarch+'.');
    }else{
      lines.push('Current season '+accountingWindow(year)+' is in progress and excluded from evaluation. Tracking can start at the '+nextMarch+' accounting boundary.');
    }
    return lines;
  }
  function changeAttempt(operation){
    if(!available())return;
    if(runtime[operation]()){message='';notice=null;}
    else message=operation==='start'?'The attempt could not start. Return to the course and try again.':'The attempt could not be abandoned.';
    confirming=false;render();
  }
  function render(){
    const state=runtime.capture();
    if(!state){close();return;}
    const {active,medal}=state,baseline=medal?.baseline||active?.baseline;
    const candidate=medal?.result||active?.latest;
    const latest=candidate&&candidate.year!==baseline?.year?candidate:null;
    const readiness=active||medal?null:runtime.diagnostic();
    const [stage,...explanation]=progressText(state,readiness,active?runtime.progress():null);
    const next=JSON.stringify([stage,explanation,baseline,latest,confirming,message]);
    if(next===stamp)return;
    stamp=next;
    const focused=dialog.contains(document.activeElement)?document.activeElement.id:'';
    const scroll=dialog.scrollTop;
    if(status.textContent!==stage)status.textContent=stage;
    const items=explanation.map(line=>element('p',line));
    if(medal){
      const badge=element('p','Profitability Turnaround medal earned');badge.className='business-medal';
      items.push(badge);
    }else{
      items.push(element('p','Record a full March-to-March operating loss, then reach break-even or better in a later full season. Both seasons must have positive greens fees and the same number of open holes at the same property.'));
    }
    if(baseline||latest){
      const grid=element('div');grid.className='business-grid';
      if(baseline)grid.append(card('Baseline',baseline));
      if(latest)grid.append(card(medal?'Qualifying season':'Latest verified season',latest));
      items.push(grid);
      if(baseline&&latest&&baseline.holes===latest.holes){
        const difference=(total(latest)-total(baseline))*100;
        items.push(element('p','Change from baseline '+(difference>0?'+':'')+currency.format(difference)));
      }
    }
    items.push(element('p','The result excludes property sales, building and course construction, prizes, and other entries outside the four operating categories.'));
    if(message)items.push(element('p',message));

    const actions=element('div');actions.className='business-actions';
    if(confirming&&active){
      items.push(element('p','Abandon this attempt and discard its current baseline?'));
      const keep=button('Keep attempt',()=>{confirming=false;render();});
      keep.id='business-challenge-abandon';
      actions.append(keep,button('Confirm abandonment',()=>changeAttempt('abandon')));
    }else if(active){
      const abandon=button('Abandon attempt',()=>{confirming=true;render();});
      abandon.id='business-challenge-abandon';actions.append(abandon);
    }else if(!medal){
      const start=button('Start challenge',()=>changeAttempt('start'));
      start.id='business-challenge-start';start.disabled=!readiness?.canStart;actions.append(start);
    }
    if(openReport&&!confirming){
      const report=button('Financial report',()=>{
        if(!available())return;
        const show=openReport,identity=Module.saveRules.active;
        const scroll=dialog.scrollTop, focus=opener;
        const isCurrent=()=>!!identity&&Module.saveRules.active===identity&&
          Module.hasGameFeature?.('businessChallenges')&&!Module.atTitle&&!Module.rulesetBlocked&&
          !Module.saveRules.draft&&!Module.loadState?.active&&!Module.courseLoading?.active;
        if(show({
          isCurrent,
          restore(){
            if(!isCurrent()||!showChallenge(show,focus))return false;
            dialog.scrollTop=scroll;
            document.getElementById('business-challenge-report')?.focus({preventScroll:true});
            return true;
          }
        }))close();
      });
      report.id='business-challenge-report';actions.append(report);
    }
    items.push(actions);
    content.replaceChildren(...items);
    if(focused&&focused!=='business-challenges-close'){
      const target=document.getElementById(focused);
      (target&&!target.disabled?target:dialog.querySelector('header button')).focus({preventScroll:true});
    }
    dialog.scrollTop=scroll;
  }
  Module.canOpenBusinessChallenges=available;
  function showChallenge(showReport,focus=document.activeElement){
    if(dialog?.open||!available())return false;
    if(!dialog)build();
    opener=focus;openReport=showReport;stamp='';message='';notice=null;
    Module.cancelMapGesture?.();
    dialog.showModal();Module.businessChallengesOpen=true;dialog.scrollTop=0;
    render();
    if(dialog.open)timer=setInterval(()=>{
      if(!available())close();
      else if(!pointer)render();
    },350);
    return dialog.open;
  }
  Module.openBusinessChallenges=showChallenge;
  Module.clearBusinessChallengeNotice=()=>{notice=null;};
  Module.businessChallengeNotice=()=>{
    if(!notice||dialog?.open||!available())return '';
    if(runtime.capture()?.status!==notice.status){notice=null;return '';}
    const now=performance.now();
    if(!notice.until)notice.until=now+7500;
    if(now>=notice.until){notice=null;return '';}
    return notice.status==='completed'?'Challenge complete! '+goal+' medal earned.':goal+' baseline recorded.';
  };
  addEventListener(changeEvent,event=>{
    if(dialog?.open){if(!pointer)render();return;}
    if(event.detail?.status==='baseline-locked'||event.detail?.status==='completed')
      notice={status:event.detail.status,until:0};
  });
  addEventListener('simgolf-ruleset-change',()=>{
    notice=null;
    if(dialog?.open&&!available())close();
  });
})();
