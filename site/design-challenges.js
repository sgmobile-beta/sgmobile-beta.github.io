// Presentation and revision lifecycle for the optional design objectives.
(function(){
  'use strict';
  if(!Module.saveRules||!globalThis.HTMLDialogElement?.prototype.showModal)return;
  const model=SGDesignChallengeModel, observations=Module.originalCourseObservations;
  const definitions=new Map(model.definitions.map(d=>[d.id,d]));
  const root=document.createElement('dialog');
  root.id='design-challenges';
  root.setAttribute('aria-labelledby','design-challenges-title');
  root.innerHTML='<header><h2 id="design-challenges-title">Course Design Challenges</h2><button type="button" autofocus>Close</button></header><div class="design-body"></div>';
  const style=document.createElement('style');
  style.textContent=`
    #design-challenges{inset:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));width:min(640px,calc(100% - max(12px,env(safe-area-inset-right)) - max(12px,env(safe-area-inset-left))));max-height:calc(100dvh - max(12px,env(safe-area-inset-top)) - max(12px,env(safe-area-inset-bottom)));box-sizing:border-box;overflow:auto;overscroll-behavior:contain;padding:0;border:1px solid var(--menu-border);border-radius:14px;background:var(--menu-bg);color:var(--menu-text);font:15px/1.4 system-ui,sans-serif}
    #design-challenges::backdrop{background:#161c37a6}
    #design-challenges header{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border-bottom:1px solid var(--menu-border);background:var(--menu-panel);z-index:1}
    #design-challenges h2{font-size:clamp(18px,4vw,24px);margin:0}
    #design-challenges h3,#design-challenges h4{margin:8px 0 4px}
    #design-challenges .design-body{padding:8px 12px 12px}
    #design-challenges nav{display:flex;flex-wrap:wrap;gap:5px}
    #design-challenges button,#design-challenges select{min-height:44px;border:1px solid var(--menu-border);border-radius:8px;background:var(--menu-button);color:inherit;font:inherit;padding:6px 9px;max-width:100%;touch-action:manipulation}
    #design-challenges button[aria-pressed=true]{background:var(--menu-selected)}
    #design-challenges article{margin:7px 0;padding:7px 10px;border-radius:8px;border:1px solid var(--menu-border);background:#fff9e8;overflow-wrap:anywhere}
    #design-challenges article p,#design-challenges article ul{margin:5px 0}
    #design-challenges article button{margin:4px 6px 2px 0}
    #design-challenges .design-hole-choice{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:6px 0}
    #design-challenges .design-comparison{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));gap:8px}
    #design-challenges .design-comparison section{border:1px solid var(--menu-border);border-radius:8px;padding:6px 8px}
    #design-challenges .design-steps{list-style:none;padding:0}
    #design-challenges .design-steps li{margin:6px 0}
    #design-challenges small{display:block;padding-left:1em}
    #design-challenges .design-stage{font-weight:700}
    #design-challenges .design-measures{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 8px;margin:8px 0;padding:8px;background:var(--menu-button);border-radius:8px}
    #design-challenges .design-measures dd{margin:0;font-weight:700;text-align:right;font-variant-numeric:tabular-nums}
    #design-challenges .design-requirements .design-steps li{padding:6px 0;border-top:1px solid var(--menu-line)}
    #design-challenges .design-criterion{display:flex;align-items:baseline;justify-content:space-between;gap:4px 8px;flex-wrap:wrap;font-weight:600}
    #design-challenges .design-status{padding:1px 6px;border-radius:5px;background:var(--menu-panel);font-size:.85em;white-space:nowrap}
    #design-challenges .design-status[data-status=complete]{background:#e1eddc;color:#254831}
    #design-challenges .design-status[data-status=in-progress]{background:var(--menu-selected)}
    #design-challenges .design-status[data-status=not-met]{background:#f4e0cf;color:#763814}
    #design-challenges .design-requirements small{padding-left:0}
    #design-challenges summary{box-sizing:border-box;min-height:44px;padding:11px 0;cursor:pointer}
  `;
  document.head.append(style);document.body.append(root);
  const body=root.querySelector('.design-body'), closeButton=root.querySelector('button');
  let ledger=null, focus=null, confirming=false, stamp='', nextSample=0, notice=null, until=0, pointer=false, intent=1;
  const holeChoices=new Map();
  let viewOwner=null;

  function allowed(){
    return !!(ledger&&Module.hasGameFeature('designChallenges')&&Module.mapCourseReady&&!Module.atTitle&&
      !Module.saveRules.draft&&!Module.rulesetBlocked&&!Module.loadState?.active&&!Module.courseLoading?.active&&
      !Module.saveFilesOpen&&!Module.backupHistoryOpen);
  }
  function available(){
    const s=Module.mobileState;
    return allowed()&&s?.course&&!s.photoActive&&!s.fundsCheck&&!s.tournamentActive&&
      !Module.aimMode&&!Module.shotPending&&!Module.lotPending&&!(Module.terrainPreview?.pending>0)&&
      !Module.analyticsActive&&!Module.analyticsSession?.active&&!Module.analyticsRequest&&!Module.courseDesignLabOpen&&
      !Module.golferHistoriesOpen&&!Module.clubRecordsOpen&&!Module.clubhouseManagementOpen&&
      !Module.clubhousePairOpen&&!Module.golferPairs?.active&&!Module.mobileReportOpen&&
      !Module.mobilePreferencesOpen&&!Module.golferCard?.active&&!Module.profileState?.active&&
      !Module.progressScreen?.active&&!Module.holeStats?.active&&!Module.featureSettingsOpen&&!Module.editionModalOpen;
  }
  function nextIntent(){intent=intent===0x3ffffff?1:intent+1;}
  function requestedHole(){return allowed()?ledger.requestedHole?.()||0:0;}
  Module.designChallengeRequestedHole=()=>{
    const hole=requestedHole();
    return Number.isInteger(hole)&&hole>=1&&hole<=19?intent*32+hole:0;
  };
  function close(){
    viewOwner=null;
    if(!Module.designChallengesOpen)return;
    Module.designChallengesOpen=false;confirming=false;pointer=false;
    if(root.open)root.close();
    if(focus?.isConnected)focus.focus({preventScroll:true});
    else document.getElementById('mobile-menu')?.focus({preventScroll:true});
  }
  Module.saveRules.register('designChallenges',{
    validate(data,game){model.create(data,game.id);return true;},
    prepare(data,game){return model.create(data,game.id);},
    activate(prepared){ledger=prepared;nextSample=0;holeChoices.clear();nextIntent();},
    capture:()=>ledger.capture(),
    dispose(){close();ledger=null;Module.clearDesignChallengeNotice();nextSample=0;stamp='';}
  });
  function readCourse(){
    const course=observations.course(),heap=Module.HEAPU8,ints=new Int32Array(heap.buffer),shorts=new Int16Array(heap.buffer);
    if(course.property<0||course.property>15||course.template<0||course.template>15||!course.name)return null;
    const holes=[];
    for(let id=1;id<=18;id++){
      const at=0x575ab0+id*520,par=heap[at],yards=shorts[(at+4)>>1];
      if(!par||par>9||yards<=0)continue;
      const points=Array.from(ints.subarray((at+8)>>2,(at+32)>>2));
      if(points.some(n=>n<0||n>=50)||(points[0]===points[4]&&points[1]===points[5]))continue;
      const count=ints[(at+36)>>2],starts=ints[(at+32)>>2],divisor=Math.trunc(count/2)+4+starts;
      const fun=count>0&&starts>=0&&divisor>0?Math.trunc(shorts[(at+344)>>1]*100/divisor):null;
      holes.push({id,par,yards,route:[par,yards,...points].join(':'),fun});
    }
    const frame=ints[0x834170>>2],difficulty=ints[0x822c88>>2];
    if(frame<0||difficulty<0||difficulty>3)return null;
    return {course,frame,difficulty,holes,layout:observations.layout()};
  }
  function completed(award){
    if(!award)return;
    notice=award;until=0;
  }
  Module.sampleDesignChallenges=()=>{
    if(!allowed()||(!root.open&&(!ledger.active()||ledger.requestedHole())))return;
    const now=performance.now();
    if(now<nextSample)return;
    nextSample=now+750;
    const course=readCourse();
    if(course)completed(ledger.sample(course));
    render();
  };
  Module.receiveDesignChallengeLayout=layout=>{
    if(requestedHole())completed(ledger.observeLayout(layout));
  };
  Module.receiveDesignChallengeFinish=row=>{
    if(requestedHole())completed(ledger.finish(row));
  };
  Module.designChallengeScoresWanted=()=>allowed()&&!ledger.requestedHole?.()&&ledger.usesScores();
  Module.receiveDesignChallengeScore=(actor,hole,strokes,profile,visit)=>{
    if(!Module.designChallengeScoresWanted())return;
    const course=readCourse();
    if(!course)return;
    completed(ledger.score(course,{hole,strokes,id:[actor,profile,visit,hole].join(':')}));
  };
  Module.clearDesignChallengeNotice=()=>{notice=null;until=0;};
  Module.designChallengeNotice=()=>{
    if(!notice||!available()||root.open||Module.mobileState.roundActive||Module.aimMode||Module.mobileState.constructing)return '';
    const course=observations.course();
    if(course.property!==notice.course.property||course.template!==notice.course.template)return '';
    const now=performance.now();
    if(!until)until=now+7500;
    if(now>=until){Module.clearDesignChallengeNotice();return '';}
    const definition=definitions.get(notice.id);
    return 'Challenge complete! '+definition.name+' · '+definition.medal;
  };
  function element(tag,text){
    const e=document.createElement(tag);
    if(text)e.textContent=text;
    return e;
  }
  function button(label,fn){
    const b=element('button',label);
    b.type='button';b.onclick=fn;return b;
  }
  const statusNames={'complete':'Complete','in-progress':'In Progress','not-met':'Not Met','unavailable':'Unavailable'};
  const strokes=n=>n==null?'—':n.toFixed(2);
  const relative=n=>n==null?'—':n===0?'Even':(n>0?'+':'')+n.toFixed(2);
  function turnaroundDetails(progress,hole){
    const {phase,current,baseline,observed,layoutStatus,awaitingFinish}=progress.turnaround;
    const revised=phase==='revision',section=element('section');
    section.className='design-requirements';
    section.append(element('h4','Requirements & Progress · Hole '+hole));
    const paused=layoutStatus==='unavailable'||layoutStatus==='not-met';
    const stage=element('p',revised?
      (layoutStatus==='complete'?'Revised design · Collecting results':'Baseline established · Waiting for an eligible revision'):
      'Baseline status · '+(paused?'Collection paused':'Waiting for qualification'));
    stage.className='design-stage';
    section.append(stage);
    if(current)section.append(element('p','Par '+current.par+' · '+current.yards+' yards'));
    const measures=element('dl');measures.className='design-measures';
    const measure=(label,value)=>measures.append(element('dt',label),element('dd',value));
    if(revised){
      measure('Baseline average',strokes(baseline.mean));
      measure('Revised average',strokes(observed?.mean));
      const difference=observed?.mean==null?null:baseline.mean-observed.mean;
      measure('Observed difference',difference==null?'—':difference===0?'Even':
        strokes(Math.abs(difference))+(difference>0?' fewer strokes':' more strokes'));
      measure('Baseline Native Fun',String(baseline.fun));
      measure('Revised Native Fun',String(observed?.fun??'Unavailable'));
    }else{
      measure('Average score',strokes(observed?.mean));
      measure('Average vs. par',relative(observed?.relative));
    }
    section.append(measures);
    const list=element('ul');list.className='design-steps';
    for(const item of progress.steps){
      const li=element('li'),label=element('div'),badge=element('span',statusNames[item.status]);
      label.className='design-criterion';
      badge.className='design-status';badge.dataset.status=item.status;
      label.append(element('span',item.label),badge);li.append(label);
      if(item.detail)li.append(element('small',item.detail));
      if(item.reason)li.append(element('small',item.reason));
      list.append(li);
    }
    section.append(list);
    if(awaitingFinish)section.append(element('p','The current window qualifies. Wait for the next qualifying finish to verify the baseline.'));
    if(revised)section.append(element('small','Different golfers and playing conditions can affect the observed difference.'));
    else section.append(element('small','Uses the latest six qualifying finishes at most. Only regular golfers who play the hole on one verified layout count.'));
    return section;
  }
  function comparisonDetails(comparison){
    const group=element('div');group.className='design-comparison';
    for(const [label,cohort] of [['Baseline',comparison.baseline],['Revised design',comparison.revised]]){
      const card=element('section'),count=cohort.scores.length;
      const average=count?cohort.scores.reduce((total,score)=>total+score,0)/count:null;
      const relative=average===null?null:average-cohort.par;
      card.append(element('h4',label),
        element('p','Par '+cohort.par+' · '+cohort.yards+' yards · Native Fun '+(cohort.fun??'unavailable')),
        element('p',count+' verified finishes'+(count?' · Scores '+cohort.scores.join(', '):'')));
      if(average!==null)card.append(element('p',average.toFixed(1)+' average strokes · '+
        (relative>0?'+':'')+relative.toFixed(1)+' to par'));
      group.append(card);
    }
    return group;
  }
  function details(award){
    const definition=definitions.get(award.id), article=element('article'), summary=element('details');
    summary.append(element('summary',definition.name+' · '+definition.medal));
    summary.append(element('p',award.course.name+' · '+observations.date(award.frame)+' · '+['Easy','Moderate','Difficult','Impossible'][award.difficulty]));
    for(const h of award.holes){
      const fun=h.fun===null?'':' · Native Fun '+h.fun;
      const scores=!award.comparison&&h.scores.length?' · Verified scores '+h.scores.join(', '):'';
      summary.append(element('p','Hole '+h.id+' · Par '+h.par+' · '+h.yards+' yards'+fun+scores));
    }
    if(award.comparison)summary.append(comparisonDetails(award.comparison));
    article.append(summary);
    return article;
  }
  function eligibleHoles(definition,view){
    return (view.holes||[]).filter(hole=>definition.selectHole===true||hole.par===definition.selectHole);
  }
  function openLab(hole,id,button){
    const active=ledger?.view().active;
    if(!available()||!root.open||active?.id!==id||active.hole!==hole||
        Module.courseDesignLabHoleIssue(hole))return;
    const owner=viewOwner,scroll=root.scrollTop;
    const context=Module.courseHoleContext(hole,'designChallenges','courseDesignLab',()=>{
      if(viewOwner!==owner||!available())return false;
      root.showModal();Module.designChallengesOpen=true;
      button.focus({preventScroll:true});root.scrollTop=scroll;render();return true;
    });
    if(!context.valid())return;
    Module.designChallengesOpen=false;root.close();
    if(!Module.openCourseDesignLab(hole,context))context.back();
  }
  function render(){
    if(!root.open||pointer||!ledger||
        (root.contains(document.activeElement)&&document.activeElement?.tagName==='SELECT'))return;
    const view=ledger.view(),signature=JSON.stringify([view,confirming]);
    if(signature===stamp)return;
    stamp=signature;
    const content=[],active=view.active;
    if(active){
      const definition=definitions.get(active.id), article=element('article');
      content.push(element('h3','Active Challenge'));
      article.append(element('h4',definition.name));
      if(!view.progress?.turnaround)article.append(element('p',definition.policy));
      if(active.hole>=1&&active.hole<=18&&!view.progress?.turnaround)article.append(element('p','Selected hole '+active.hole));
      if(!view.progress){
        const current=view.course?.property===active.course.property&&view.course.template===active.course.template;
        article.append(element('p',current?'Waiting for verified course observations.':
          'Return to '+active.course.name+' to continue this challenge.'));
      }
      else if(view.progress.turnaround)article.append(turnaroundDetails(view.progress,active.hole));
      else{
        const list=element('ul');list.className='design-steps';
        for(const item of view.progress.steps){
          const li=element('li',(item.done?'✓ ':'○ ')+item.label);
          if(item.detail)li.append(element('small',item.detail));
          list.append(li);
        }
        article.append(list);
      }
      if(confirming)article.append(element('p','Abandon this challenge and clear its progress? Your course edits stay in place.'),
        button('Keep Playing',()=>{confirming=false;render();}),
        button('Confirm Abandon',()=>{ledger.abandon();nextIntent();confirming=false;render();}));
      else {
        const sameCourse=view.course?.property===active.course.property&&view.course.template===active.course.template;
        if(sameCourse&&view.holes.some(row=>row.id===active.hole)&&Module.hasGameFeature('courseDesignLab')){
          const issue=Module.courseDesignLabHoleIssue(active.hole);
          const link=button('Open Design Lab',()=>openLab(active.hole,active.id,link));
          link.disabled=!!issue;
          article.append(link);
          if(issue)article.append(element('p',issue));
        }
        article.append(button('Abandon Challenge',()=>{confirming=true;render();}));
      }
      content.push(article);
    }else{
      content.push(element('h3','Available Challenges'));
      if(!view.course)content.push(element('p','Reading the current course…'));
      for(const definition of model.definitions){
        if(view.completed.some(a=>a.id===definition.id))continue;
        const article=element('article'), objectives=element('ul');
        article.append(element('h4',definition.name),element('p',definition.description),element('p',definition.policy));
        // Phase-one definitions retain their original objective previews.
        const preview=definition.preview||
          definition.evaluate({holes:[]},{routes:{},closed:[],scores:{}}).steps.map(item=>item.label);
        for(const label of preview)objectives.append(element('li',label));
        const choices=definition.selectHole?eligibleHoles(definition,view):[];
        const selected=holeChoices.get(definition.id)||0;
        const start=button('Start Challenge',()=>{
          if(!available()||ledger.active())return;
          const hole=holeChoices.get(definition.id)||0;
          if(definition.selectHole&&!eligibleHoles(definition,ledger.view()).some(row=>row.id===hole))return;
          const award=ledger.start(definition.id,hole);
          if(award||ledger.active()){
            nextIntent();
            if(document.activeElement?.tagName==='SELECT')document.activeElement.blur();
          }
          completed(award);render();
        });
        start.disabled=!view.course||(!!definition.selectHole&&!choices.some(hole=>hole.id===selected));
        start.setAttribute('aria-label','Start '+definition.name);
        article.append(objectives,element('p','Recognition · '+definition.medal));
        if(definition.selectHole){
          const label=element('label',definition.selectHole===5?'Par 5 to test':'Hole to test');
          label.className='design-hole-choice';
          const select=element('select'),placeholder=element('option',
            definition.selectHole===5?'Choose an open par 5':'Choose an open hole');
          placeholder.value='';placeholder.disabled=true;
          select.append(placeholder);
          for(const hole of choices){
            const option=element('option','Hole '+hole.id+' · Par '+hole.par+' · '+hole.yards+' yards');
            option.value=String(hole.id);select.append(option);
          }
          select.value=start.disabled?'':String(selected);
          select.disabled=!choices.length;
          select.onchange=()=>{
            holeChoices.set(definition.id,Number(select.value));
            start.disabled=!select.value;
          };
          label.append(select);article.append(label);
          if(view.course&&!choices.length)article.append(element('p',definition.selectHole===5?
            'Open a par 5 in the original game to start.':'Open a hole in the original game to start.'));
        }
        article.append(start);content.push(article);
      }
      if(view.completed.length===model.definitions.length)content.push(element('p','You have earned all current design medals.'));
    }
    content.push(element('h3','Completed Challenges'));
    for(const award of view.completed.slice().reverse())content.push(details(award));
    if(!view.completed.length)content.push(element('p','Completed design medals will appear here.'));
    const scroll=root.scrollTop, expanded=[...body.querySelectorAll('details')].map(e=>e.open);
    body.replaceChildren(...content);
    body.querySelectorAll('details').forEach((e,i)=>{e.open=!!expanded[i];});
    root.scrollTop=scroll;
  }
  Module.openDesignChallenges=()=>{
    if(root.open||!available())return false;
    focus=document.activeElement;stamp='';nextSample=0;viewOwner={};
    Module.cancelMapGesture?.();
    root.showModal();root.scrollTop=0;Module.designChallengesOpen=true;
    Module.clearDesignChallengeNotice();render();return true;
  };
  closeButton.onclick=close;
  root.addEventListener('cancel',event=>{event.preventDefault();close();});
  root.addEventListener('close',()=>{if(!root.open&&Module.designChallengesOpen)close();});
  root.addEventListener('pointerdown',()=>{pointer=true;},true);
  for(const type of ['pointerup','pointercancel'])root.addEventListener(type,()=>{pointer=false;});
  for(const type of ['pointerdown','pointerup','pointermove','pointercancel','mousedown','mouseup','click',
    'touchstart','touchmove','touchend','touchcancel','wheel','keydown','keyup','keypress'])
    root.addEventListener(type,event=>event.stopPropagation());
  setInterval(()=>{
    if(!root.open)return;
    if(!available())close();
    else render();
  },250);
})();
