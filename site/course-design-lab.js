(function() {
  'use strict';
  if(!Module.saveRules||!globalThis.HTMLDialogElement?.prototype.showModal)return;
  const model=SGCourseDesignLabModel, observations=Module.originalCourseObservations;
  let ledger, root, body, closeButton, opener, interval, pending, context, previousChoice, pointer=false;
  let intent=1, choice=0, comparison='', confirming=false, message='', dirty=false;

  function allowed(){
    return !!(ledger&&Module.hasGameFeature('courseDesignLab')&&Module.mapCourseReady&&
      !Module.atTitle&&!Module.rulesetBlocked&&!Module.loadState?.active&&!Module.courseLoading?.active);
  }
  function available(){
    const s=Module.mobileState;
    return allowed()&&s?.course&&!s.photoActive&&!s.fundsCheck&&!s.tournamentActive&&
      !Module.aimMode&&!Module.shotPending&&!Module.lotPending&&!Module.analyticsSession?.active&&!Module.analyticsRequest&&
      !Module.saveFilesOpen&&!Module.backupHistoryOpen&&!Module.golferHistoriesOpen&&!Module.clubRecordsOpen&&
      !Module.designChallengesOpen&&!Module.clubhouseManagementOpen&&!Module.clubhousePairOpen&&
      !Module.mobileReportOpen&&!Module.mobilePreferencesOpen&&!Module.golferCard?.active&&
      !Module.profileState?.active&&!Module.progressScreen?.active&&!Module.holeStats?.active;
  }
  function nextIntent(){intent=intent===0x3ffffff?1:intent+1;}
  Module.courseDesignLabRequestedHole=()=>{
    const hole=allowed()&&(pending?.hole||ledger.selected());
    return hole?intent*32+hole:0;
  };
  Module.receiveCourseDesignLabLayout=layout=>{
    if(!ledger)return;
    if(pending){
      const {course}=pending;
      pending=null;
      if(!ledger.start(course,layout)){
        message='This hole is unavailable for reliable testing. Check that it is open and try again.';
        nextIntent();
      }
    }else ledger.observe(layout);
    dirty=true;
  };
  Module.receiveCourseDesignLabScore=row=>{
    if(ledger?.score(row))dirty=true;
  };
  Module.saveRules.register('courseDesignLab',{
    validate(data,game){model.create(data,game.id);return true;},
    prepare(data,game){return model.create(data,game.id);},
    activate(prepared){ledger=prepared;nextIntent();choice=0;comparison='';message='';dirty=true;},
    capture:()=>ledger.capture(),
    dispose(){close(false);ledger=null;pending=null;nextIntent();}
  });

  function element(tag,text){
    const e=document.createElement(tag);
    if(text!==undefined)e.textContent=text;
    return e;
  }
  function button(label,action){
    const b=element('button',label);
    b.type='button';b.onclick=action;return b;
  }
  function select(label,rows,value,onChange){
    const field=element('label',label),input=element('select');
    for(const [id,text] of rows){
      const option=element('option',text);option.value=id;input.append(option);
    }
    input.value=value;input.onchange=()=>onChange(input.value);
    field.append(input);return field;
  }
  function build(){
    root=element('dialog');
    root.id='course-design-lab';
    root.setAttribute('aria-labelledby','course-design-lab-title');
    const header=element('header'),title=element('h2','Course Design Lab');
    title.id='course-design-lab-title';
    closeButton=button('Close',()=>close());closeButton.autofocus=true;
    body=element('div');body.className='lab-body';
    header.append(title,closeButton);root.append(header,body);
    const style=element('style');
    style.textContent=`
      #course-design-lab{box-sizing:border-box;inset:max(10px,env(safe-area-inset-top)) max(10px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left));width:min(630px,calc(100% - max(10px,env(safe-area-inset-left)) - max(10px,env(safe-area-inset-right))));max-height:calc(100dvh - max(10px,env(safe-area-inset-top)) - max(10px,env(safe-area-inset-bottom)));padding:0;overflow:auto;overscroll-behavior:contain;border:1px solid var(--menu-border);border-radius:14px;background:var(--menu-bg);color:var(--menu-text);font:15px/1.4 system-ui,sans-serif}
      #course-design-lab::backdrop{background:#161c3780}
      #course-design-lab header{position:sticky;top:0;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;background:var(--menu-panel);border-bottom:1px solid var(--menu-border)}
      #course-design-lab h2{font-size:clamp(18px,4vw,24px);margin:0}
      #course-design-lab h3,#course-design-lab h4,#course-design-lab p{margin:6px 0}
      #course-design-lab .lab-body{padding:8px 12px 12px;overflow-wrap:anywhere}
      #course-design-lab .lab-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:8px;margin:8px 0}
      #course-design-lab article{padding:6px 10px;border:1px solid var(--menu-border);border-radius:9px;background:var(--menu-button)}
      #course-design-lab label{display:block;margin:8px 0}
      #course-design-lab button,#course-design-lab select{box-sizing:border-box;min-height:44px;max-width:100%;padding:6px 10px;border:1px solid var(--menu-border);border-radius:8px;background:var(--menu-button);color:inherit;font:inherit;touch-action:manipulation}
      #course-design-lab select{display:block;width:100%;margin-top:4px}
      #course-design-lab .lab-readiness{margin:8px 0;padding:8px 10px;border:1px solid var(--menu-border);border-radius:9px;background:#fff9e8}
      #course-design-lab .lab-readiness h4{margin-top:0}
      #course-design-lab .lab-finish-counts{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,138px),1fr));gap:6px;margin:6px 0}
      #course-design-lab .lab-finish-counts>div{padding:4px 7px;border-radius:6px;background:var(--menu-button)}
      #course-design-lab .lab-finish-counts dd{margin:0;font-weight:650;font-variant-numeric:tabular-nums}
      #course-design-lab .lab-actions{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}
      #course-design-lab summary{box-sizing:border-box;min-height:44px;padding:10px 0;cursor:pointer}
    `;
    document.head.append(style);document.body.append(root);
    root.addEventListener('cancel',event=>{event.preventDefault();close();});
    root.addEventListener('close',()=>{if(!root.open)close(false);});
    root.addEventListener('pointerdown',()=>{pointer=true;},true);
    for(const type of ['pointerup','pointercancel'])root.addEventListener(type,()=>{pointer=false;});
    for(const type of ['pointerdown','pointerup','pointermove','pointercancel','mousedown','mouseup',
      'mousemove','click','dblclick','touchstart','touchmove','touchend','touchcancel','wheel','keydown','keyup','keypress'])
      root.addEventListener(type,event=>event.stopPropagation());
  }
  function close(restore=true){
    if(!Module.courseDesignLabOpen)return;
    const from=context;
    context=null;
    if(from)choice=previousChoice;
    Module.courseDesignLabOpen=false;
    if(root.open)root.close();
    clearInterval(interval);interval=null;confirming=false;pointer=false;
    if(restore&&from?.back())return;
    if(opener?.isConnected&&opener.getClientRects().length)opener.focus({preventScroll:true});
    else document.getElementById('mobile-menu')?.focus({preventScroll:true});
  }
  Module.canOpenCourseDesignLab=available;
  Module.courseDesignLabHoleIssue=hole=>{
    if(!allowed()||!holes().some(([id])=>id===hole))return 'Design Lab requires a playable open hole.';
    const selected=pending?.hole||ledger.selected();
    return selected&&selected!==hole?'Design Lab is working on Hole '+selected+'.':'';
  };
  Module.openCourseDesignLab=(hole=0,from=null)=>{
    if(root?.open||!available()||(hole&&Module.courseDesignLabHoleIssue(hole)))return false;
    if(!root)build();
    opener=document.activeElement;message='';dirty=true;context=from;
    if(hole){previousChoice=choice;choice=hole;}
    else Module.cancelMapGesture?.();
    closeButton.textContent=context?'Back':'Close';
    Module.courseDesignLabOpen=true;root.showModal();root.scrollTop=0;
    render();
    interval=setInterval(()=>{
      if(!available()||(context&&!context.valid())){close(false);return;}
      if(pending&&performance.now()-pending.started>5000){
        pending=null;nextIntent();message='The course is busy. Return to play and try again.';dirty=true;
      }
      if(dirty&&!pointer&&document.activeElement?.tagName!=='SELECT')render();
    },250);
    return true;
  };

  function holes(){
    const heap=Module.HEAPU8, shorts=new Int16Array(heap.buffer), ints=new Int32Array(heap.buffer);
    const rows=[];
    for(let hole=1;hole<=18;hole++){
      const at=0x575ab0+hole*520,par=heap[at],yards=shorts[(at+4)>>1];
      if(par<2||par>6||yards<1)continue;
      const teeX=ints[(at+8)>>2],teeY=ints[(at+12)>>2],greenX=ints[(at+24)>>2],greenY=ints[(at+28)>>2];
      if(teeX<=0||teeX>=50||teeY<0||teeY>=50||greenX<=0||greenX>=50||greenY<0||greenY>=50||
          heap[0x5722e8+teeX*50+teeY]!==0||heap[0x5722e8+greenX*50+greenY]!==1)continue;
      rows.push([hole,'Hole '+hole+' · Par '+par+' · '+yards+' yd']);
    }
    return rows;
  }
  function frame(){return new Int32Array(Module.HEAPU8.buffer)[0x834170>>2];}
  function start(){
    if(!available()||pending||!holes().some(([id])=>id===choice))return;
    const course=observations.course();
    if(!course.name)course.name='Property '+(course.property+1);
    pending={course,hole:choice,started:performance.now()};
    nextIntent();message='';comparison='';render();
  }
  function recordCard(label,v,means){
    const card=element('article'),s=v.scores;
    card.append(element('h4',label),element('p',observations.date(v.frame)),
      element('p','Par '+v.par+' · '+v.yards+' yd · Native Fun '+(v.fun??'unavailable')));
    if(s.count)card.append(element('p','Stroke range '+s.low+'–'+s.high));
    if(means){
      const average=s.total/s.count,relative=average-v.par;
      card.append(element('p',average.toFixed(1)+' average strokes · '+(relative>0?'+':'')+relative.toFixed(1)+' to par'));
    }
    if(s.count===model.MAX_SAMPLES)card.append(element('p','This design reached the observation limit.'));
    return card;
  }
  function comparisonState(experiment,revised,live=null){
    const base=experiment.versions[0],minimum=model.MIN_COMPARISON;
    const baselineCount=base.scores.count,revisedCount=revised?.scores.count??0;
    // Saved cohorts already passed the native observation gates. An active
    // experiment must also have a currently verified layout before it is ready.
    const ready=!!revised&&baselineCount>=minimum&&revisedCount>=minimum&&
      (!live||(live.status==='observing'&&!!live.current));
    return {base,revised,baselineCount,revisedCount,ready};
  }
  function readiness(state,live){
    const {baselineCount,revisedCount,revised,ready}=state,minimum=model.MIN_COMPARISON;
    const panel=element('section'),counts=element('dl');
    panel.className='lab-readiness';panel.dataset.labReadiness=ready?'ready':'incomplete';
    panel.append(element('h4',ready?(live?'Comparison Ready':'Recorded comparison'):'Incomplete'));
    counts.className='lab-finish-counts';
    for(const [label,count] of [['Baseline design',baselineCount],['Revised design',revisedCount]]){
      const item=element('div');
      item.append(element('dt',label),element('dd',count.toLocaleString()+' / '+minimum+' qualifying finishes'));
      counts.append(item);
    }
    panel.append(counts);
    if(!live){
      if(!ready)panel.append(element('p','There are too few qualifying finishes for a supported comparison. At least '+minimum+' are needed for each design.'));
      return panel;
    }
    if(ready){
      panel.append(element('p','Both verified designs have at least '+minimum+' qualifying finishes.'));
      return panel;
    }
    panel.append(element('p','A comparison needs at least '+minimum+' qualifying finishes on each verified design.'));
    const missing=[];
    if(baselineCount<minimum)missing.push((minimum-baselineCount)+' on the baseline');
    if(revised&&revisedCount<minimum)missing.push((minimum-revisedCount)+' on the revised design');
    if(missing.length)panel.append(element('p','Still needed: '+missing.join(' and ')+'.'));
    if(!revised)panel.append(element('p','Use the original Build tools to create a revised design after observing the baseline.'));
    if(revised&&baselineCount>=minimum&&revisedCount>=minimum){
      panel.append(element('p','The current layout must be verified before this experiment is ready. Archiving now keeps the observations, including any supported comparison of past layouts.'));
    }else{
      panel.append(element('p','Archiving now keeps the recorded observations. A complete comparison requires more evidence.'));
    }
    return panel;
  }
  function cards(experiment,state){
    const {base,revised,ready}=state;
    const grid=element('div'),wrapper=element('div');
    grid.className='lab-grid';grid.append(recordCard('Baseline',base,ready));
    if(revised)grid.append(recordCard('Revised design '+experiment.versions.indexOf(revised),revised,ready));
    wrapper.append(grid);
    if(revised&&base.par!==revised.par)
      wrapper.append(element('p','Par changed. Relative scores use the par recorded for each design.'));
    if(revised&&base.yards!==revised.yards)
      wrapper.append(element('p','Yardage changed between these designs.'));
    return wrapper;
  }
  function archiveEntry(previous,index,priorSelection){
    const details=element('details'),summary=element('summary'),results=element('div');
    const revisions=previous.versions.slice(1);
    const selected=revisions.find(v=>v.design===priorSelection)||revisions.at(-1);
    function show(revised){
      const state=comparisonState(previous,revised);
      const label=state.ready?'Recorded comparison':'Incomplete';
      summary.textContent=previous.course.name+' · Hole '+previous.hole+' · '+observations.date(previous.ended)+' · '+label;
      results.replaceChildren(readiness(state,false),cards(previous,state));
    }
    details.dataset.labArchive=index;
    details.append(summary,element('p','Historical layout. The course may have changed.'));
    if(revisions.length>1)details.append(select('Compare with',revisions.map((v,i)=>[v.design,'Revised design '+(i+1)]),
      selected.design,value=>show(revisions.find(v=>v.design===value))));
    details.append(results);
    show(selected);
    return details;
  }
  function render(){
    if(!root?.open||!ledger)return;
    dirty=false;
    const view=ledger.view(),e=view.active,rows=[];
    if(e){
      rows.push(element('h3',e.course.name+' · Hole '+e.hole));
      const revisions=e.versions.slice(1);
      const revised=revisions.find(v=>v.design===comparison)||revisions.at(-1);
      const current=e.versions.findIndex(v=>v.design===view.current);
      const status={waiting:'Waiting for the selected hole to be open and verifiable on this course.',
        conditions:'Collection paused. The native conditions differ from the baseline.',
        limit:'Collection paused for this design. This experiment has reached the design limit.',
        observing:current===0?'Collecting baseline finishes.':'Collecting finishes on revised design '+current+'.'};
      rows.push(element('p',status[view.status]));
      if(revisions.length>1)rows.push(select('Compare with',revisions.map((v,i)=>[v.design,'Revised design '+(i+1)]),
        revised.design,value=>{comparison=value;render();}));
      const state=comparisonState(e,revised,view);
      rows.push(readiness(state,view));
      const actions=element('div');actions.className='lab-actions';
      if(confirming){
        rows.push(element('p','Abandon this experiment and clear its observations? Your construction stays in place.'));
        actions.append(button('Keep Experiment',()=>{confirming=false;render();}),
          button('Confirm Abandon',()=>{if(available()){ledger.abandon();nextIntent();confirming=false;render();}}));
      }else{
        actions.append(button(state.ready?'Complete Experiment':'Archive Incomplete',()=>{
          if(available()&&ledger.complete(frame())){nextIntent();render();}
        }),button('Abandon Experiment',()=>{confirming=true;render();}));
        if(view.current&&Module.hasGameFeature('courseAnalytics'))actions.append(button('Open Course Analytics',()=>{
          if(!available())return;
          const from=context;
          close(false);
          const returning=from&&{leave:from.valid,back:from.back};
          if(!Module.openCourseAnalytics?.(e.hole,returning))from?.back();
        }));
      }
      rows.push(actions,cards(e,state));
    }else{
      rows.push(element('p','Choose an open hole and start collecting real golfer finishes. Return to the course to build and play.'));
      const options=holes();
      if(options.length){
        if(!options.some(([id])=>id===choice))choice=options[0][0];
        const field=select('Open hole',options,String(choice),value=>{choice=Number(value);});
        field.querySelector('select').disabled=!!pending;
        const begin=button(pending?'Reading layout…':'Start Experiment',start);begin.disabled=!!pending;
        rows.push(field,begin);
      }else rows.push(element('p','Open a hole in the original game to start an experiment.'));
    }
    if(message)rows.push(element('p',message));
    rows.push(element('p','Each sample is a native hole finish observed on one stable course layout. Native Fun is the original aggregate at design capture and can include earlier play.'));
    rows.push(element('p','Golfer skill, game conditions and small samples influence results. A difference in scoring alone cannot establish a design effect.'));
    rows.push(element('h3','Archived Experiments'));
    const scroll=root.scrollTop,previousEntries=new Map(Array.from(body.querySelectorAll('details[data-lab-archive]'),
      entry=>[entry.dataset.labArchive,{open:entry.open,design:entry.querySelector('select')?.value}]));
    for(let i=view.history.length-1;i>=0;i--){
      const prior=previousEntries.get(String(i));
      const entry=archiveEntry(view.history[i],i,prior?.design);
      entry.open=!!prior?.open;
      rows.push(entry);
    }
    if(!view.history.length)rows.push(element('p','Archived experiments appear here.'));
    body.replaceChildren(...rows);
    root.scrollTop=scroll;
  }
})();
