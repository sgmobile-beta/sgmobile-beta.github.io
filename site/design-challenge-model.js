// Voluntary design objectives evaluated against committed original-engine observations.
(function(global) {
  'use strict';
  const MAX_SCORES=6, MAX_SEEN=48;
  const copy=value=>JSON.parse(JSON.stringify(value));
  const obj=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
  const int=(value,min,max)=>Number.isInteger(value)&&value>=min&&value<=max;
  const text=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max;
  const layoutOK=value=>typeof value==='string'&&/^[0-9a-f]{16}$/.test(value);
  const courseOK=c=>obj(c)&&int(c.property,0,15)&&int(c.template,0,15)&&text(c.name,129);
  const sameSite=(a,b)=>a.property===b.property&&a.template===b.template;
  const routeOK=value=>typeof value==='string'&&/^\d+(?::\d+){7}$/.test(value)&&value.length<=36;
  const holeOK=h=>obj(h)&&int(h.id,1,18)&&int(h.par,1,9)&&int(h.yards,1,32767)&&routeOK(h.route)&&
    (h.fun===null||int(h.fun,-3276800,3276700));
  const scoresOK=s=>Array.isArray(s)&&s.length<=MAX_SCORES&&s.every(n=>int(n,1,127));
  const step=(label,done,detail='')=>({label,done,detail});
  const holeName=h=>h?'Hole '+h.id:'';
  const scoreLabel=(n,min)=>n+' / '+min+' finishes';
  function result(steps,holes=[]){return {steps,holes,complete:steps.every(s=>s.done)};}
  function best(rows, describe){
    const candidates=rows.map(describe).sort((a,b)=>b.steps.filter(s=>s.done).length-a.steps.filter(s=>s.done).length||b.count-a.count);
    return candidates[0]||describe(null);
  }
  const MIN_FINISHES=3;
  const advanced=(id,name,medal,description,policy,preview,selectHole=false)=>Object.freeze({
    id,version:1,name,medal,description,policy,preview:Object.freeze(preview),selectHole
  });
  const definitions=Object.freeze([
    Object.freeze({
      id:'perfect-par-3',version:1,name:'The Perfect Par 3',medal:'Par 3 Design Medal',
      description:'Design a short hole that regular golfers enjoy playing.',
      policy:'Open a new hole or reroute a hole after starting. Only finishes on the current observed layout count.',
      dependencies:['open holes','routing','native fun factor','committed golfer scores'],
      usesScores:true,
      evaluate(snapshot,active){
        const rows=snapshot.holes.filter(h=>h.par===3&&h.yards>=100&&h.yards<=300&&
          (active.routes[h.id]!==h.route||active.closed.includes(h.id)));
        return best(rows,h=>{
          const count=h?active.scores[h.id]?.length||0:0,fun=h?.fun;
          return {...result([
            step('Open a new or rerouted par 3 of 100–300 yards',!!h,h?holeName(h)+' · '+h.yards+' yards':''),
            step('Reach a native Fun factor above 0',fun>0,fun!=null?'Native Fun '+fun:'Awaiting native rating'),
            step('Observe a regular golfer finish',count>=1,scoreLabel(count,1))
          ],h?[h]:[]),count};
        });
      }
    }),
    Object.freeze({
      id:'balanced-course',version:1,name:'Balanced Course',medal:'Balanced Design Medal',
      description:'Give golfers a varied course with short, medium, and long holes.',
      policy:'Existing open holes count. Each of the three pars must be available on a different hole at the same time. Available land varies by map.',
      dependencies:['open holes','native pars'],
      usesScores:false,
      evaluate(snapshot){
        const chosen=[3,4,5].map(par=>snapshot.holes.find(h=>h.par===par));
        return result(chosen.map((h,i)=>step('Have an open par '+(i+3),!!h,h?holeName(h)+' · '+h.yards+' yards':'')),chosen.filter(Boolean));
      }
    }),
    Object.freeze({
      id:'tough-but-fair',version:1,name:'Tough but Fair',medal:'Playtested Design Medal',
      description:'Playtest a hole that challenges regular golfers and still gives them a chance to make par.',
      policy:'An existing open hole can qualify. Only new finishes count. Compare up to the latest six finishes on the same observed layout.',
      dependencies:['open holes','native pars','committed golfer scores'],
      usesScores:true,
      evaluate(snapshot,active){
        return best(snapshot.holes,h=>{
          const scores=h?active.scores[h.id]||[]:[], count=scores.length;
          const over=scores.reduce((sum,score)=>sum+score-h.par,0);
          const avg=count?over/count:null;
          return {...result([
            step('Observe at least three finishes on one open hole',count>=3,(h?holeName(h)+' · ':'')+scoreLabel(count,3)),
            step('Average from ⅓ to 2 strokes over par',count>=3&&3*over>=count&&over<=2*count,avg!==null?'Average '+(avg>0?'+':'')+avg.toFixed(2):''),
            step('At least one golfer makes par or better',scores.some(score=>score<=h.par))
          ],h?[h]:[]),count};
        });
      }
    }),
    advanced('course-turnaround','The Course Turnaround','Course Turnaround Medal',
      'Improve a difficult hole and compare real golfer finishes before and after construction.',
      'Collect the baseline first. Then change the selected hole or its routing area. Compare layouts with the same par and yardage. Small samples can reflect golfer skill and changing conditions.',
      ['Establish a baseline at least ⅓ stroke over par','Revise the hole while keeping its par and yardage',
        'Collect at least three finishes on the revision','Improve the observed average by at least ⅓ stroke',
        'Keep Native Fun positive and at least as high as the baseline'],true),
    advanced('signature-par-5','Signature Par 5','Signature Par 5 Medal',
      'Refine a playable par 5 that produces a variety of real scores.',
      'Select an open par 5 and change its design or routing area. Finishes count on the current verified revision.',
      ['Refine an open par 5','Reach a positive Native Fun rating','Collect at least three finishes',
        'Observe a par or better and an above-par finish'],5),
    advanced('nine-hole-test','The Nine-Hole Test','Nine-Hole Playtest Medal',
      'Playtest a varied course across its first nine holes.',
      'Existing holes count. Observe a new finish on every hole on one verified course design. A committed redesign restarts the playtest.',
      ['Open holes 1 through 9','Include a par 3, par 4, and par 5','Observe a finish on each of the nine holes'])
  ]);
  const byId=new Map(definitions.map(d=>[d.id,d]));
  const isAdvanced=id=>!!byId.get(id)?.preview;
  const funOK=value=>value===null||int(value,-819200,819175);
  const routeMatches=h=>h.route.split(':').map(Number).every((n,i)=>
    i===0?n===h.par:i===1?n===h.yards:int(n,0,49));
  const measuredHole=h=>holeOK(h)&&h.par>=2&&h.par<=6&&funOK(h.fun)&&routeMatches(h);
  const cohortOK=c=>measuredHole(c)&&layoutOK(c.local)&&layoutOK(c.design)&&scoresOK(c.scores);
  const count=scores=>scores.length;
  const sum=scores=>scores.reduce((total,score)=>total+score,0);
  const enough=c=>count(c.scores)>=MIN_FINISHES;
  const overPar=c=>sum(c.scores)-c.par*count(c.scores);
  const difficultAverage=c=>3*overPar(c)>=count(c.scores);
  const difficult=c=>enough(c)&&c.fun!==null&&difficultAverage(c);
  const improves=(base,revised)=>3*(sum(base.scores)*count(revised.scores)-sum(revised.scores)*count(base.scores))>=
    count(base.scores)*count(revised.scores);
  const keepsFun=(base,revised)=>revised.fun>0&&revised.fun>=base.fun;
  function revisionIssue(base,revised,design){
    if(design===base.design)return 'Redesign the selected hole or its routing area using the original Build tools.';
    if(base.par!==revised.par||base.yards!==revised.yards)
      return 'Keep the baseline par and yardage on the revised hole.';
    if(base.local===revised.local)return 'The change did not affect the selected hole or its routing area.';
    return '';
  }
  const variety=scores=>scores.some(score=>score<=5)&&scores.some(score=>score>5);
  const hasMix=holes=>[3,4,5].every(par=>holes.some(h=>h.par===par));
  const validNine=holes=>holes.length===9&&holes.every((h,i)=>h.id===i+1);
  const frameOK=value=>int(value,0,0x7fffffff);
  const criterion=(label,status,detail='',reason='')=>({...step(label,status==='complete',detail),status,reason});

  function scoreSummary(h){
    if(!h)return null;
    const n=count(h.scores);
    return {fun:h.fun,mean:n?sum(h.scores)/n:null,relative:n?overPar(h)/n:null};
  }
  function finishCriterion(h,label){
    const n=h?.scores.length||0;
    return criterion(label,h?(enough(h)?'complete':'in-progress'):'unavailable',n+' / '+MIN_FINISHES,
      h&&!enough(h)?'Allow more regular golfers to complete this hole on the same layout.':'');
  }
  function turnaroundProgress(base,h,design,unavailable=''){
    const locked=!!base&&difficult(base);
    const issue=!h?unavailable:locked?revisionIssue(base,h,design):design!==base.design?
      'The course layout changed before the baseline locked. Restore the original layout and collect fresh finishes, or restart the challenge on this layout.':'';
    const cohort=issue?null:h, enoughFinishes=cohort&&enough(cohort);
    const layoutStatus=!h?'unavailable':!issue?'complete':locked&&design===base.design?'in-progress':'not-met';
    const steps=[criterion(locked?'Eligible revised layout':'Eligible baseline layout',layoutStatus,
      locked?'Change the routing area and keep Par '+base.par+' and '+base.yards+' yd.':'Keep the original layout until the baseline locks.',issue),
      finishCriterion(cohort,locked?'Eligible revised finishes':'Qualifying fresh finishes')];
    if(locked){
      const improvement=enoughFinishes&&improves(base,cohort), maintained=cohort&&keepsFun(base,cohort);
      steps.push(
        criterion('Improve the observed average',!cohort?'unavailable':!enoughFinishes?'in-progress':
          improvement?'complete':'not-met','At least ⅓ stroke better than the baseline.',
          enoughFinishes&&!improvement?'The revised average has not improved by at least ⅓ stroke.':''),
        criterion('Revised Native Fun',cohort?.fun==null?'unavailable':maintained?'complete':'not-met',
          'Required '+Math.max(1,base.fun)+' or higher.',
          !cohort?'':cohort.fun===null?'Waiting for a valid original Fun rating.':
            maintained?'':'Revised Native Fun is below the required value.'));
    }else{
      const difficultEnough=enoughFinishes&&difficultAverage(cohort);
      steps.push(
        criterion('Scoring threshold',!cohort?'unavailable':!enoughFinishes?'in-progress':
          difficultEnough?'complete':'not-met','Required at least +⅓ over par.',
          enoughFinishes&&!difficultEnough?
            'Enough golfers have finished, but the average is too close to par or below it. Keep observing on the same layout.':''),
        criterion('Native Fun',cohort?.fun==null?'unavailable':'complete',cohort?.fun==null?'':String(cohort.fun),
          cohort?.fun===null?'Waiting for the original game to establish a valid Fun rating.':''));
    }
    const progress=result(steps,h?[h]:[]);
    const awaitingFinish=!locked&&progress.complete;
    progress.complete=locked&&progress.complete;
    progress.turnaround={phase:locked?'revision':'baseline',current:h?{par:h.par,yards:h.yards}:null,baseline:locked?scoreSummary(base):null,
      observed:scoreSummary(cohort),layoutStatus,awaitingFinish};
    return progress;
  }

  function validAward(entry){
    const {id,holes}=entry;
    if(!isAdvanced(id)){
      if(holes.length!==(id==='balanced-course'?3:1))return false;
      const scores=Object.fromEntries(holes.map(h=>[h.id,h.scores]));
      return byId.get(id).evaluate({holes},{routes:{},closed:[],scores}).complete;
    }
    if(!holes.every(measuredHole))return false;
    if(id==='nine-hole-test')return validNine(holes)&&hasMix(holes)&&holes.every(h=>h.scores.length===1);
    if(holes.length!==1)return false;
    const [hole]=holes;
    if(id==='signature-par-5')return layoutOK(entry.origin)&&layoutOK(hole.local)&&entry.origin!==hole.local&&
      hole.par===5&&hole.fun>0&&hole.scores.length>=MIN_FINISHES&&variety(hole.scores);
    const base=entry.comparison?.baseline,revised=entry.comparison?.revised;
    return cohortOK(base)&&cohortOK(revised)&&revised.id===hole.id&&base.id===hole.id&&
      revised.design===entry.layout&&!revisionIssue(base,revised,revised.design)&&
      revised.route===hole.route&&revised.fun===hole.fun&&
      revised.scores.join(',')===hole.scores.join(',')&&difficult(base)&&
      enough(revised)&&improves(base,revised)&&keepsFun(base,revised);
  }
  function validActive(a){
    if(!obj(a)||!byId.has(a.id)||byId.get(a.id).version!==a.schema||!courseOK(a.course)||
       !frameOK(a.started)||!layoutOK(a.layout)||!obj(a.routes)||Object.keys(a.routes).length>18||
       !Object.entries(a.routes).every(([id,route])=>int(+id,1,18)&&routeOK(route))||
       !Array.isArray(a.closed)||a.closed.length>18||new Set(a.closed).size!==a.closed.length||
       !a.closed.every(id=>int(id,1,18))||!obj(a.scores)||Object.keys(a.scores).length>18||
       !Object.entries(a.scores).every(([id,s])=>int(+id,1,18)&&scoresOK(s))||
       !Array.isArray(a.seen)||a.seen.length>MAX_SEEN||new Set(a.seen).size!==a.seen.length||
       !a.seen.every(id=>text(id,80)))return false;
    if(!isAdvanced(a.id))return !Object.hasOwn(a,'measurement');
    const m=a.measurement;
    if(!obj(m)||!(m.context===null||layoutOK(m.context)))return false;
    if(a.id==='nine-hole-test')return m.hole===19&&m.baseline===null&&
      Object.entries(a.scores).every(([id,s])=>int(+id,1,9)&&s.length===1);
    return int(m.hole,1,18)&&Object.keys(a.scores).every(id=>+id===m.hole)&&
      (m.baseline===null||(cohortOK(m.baseline)&&m.baseline.id===m.hole&&m.context!==null&&
        (a.id!=='signature-par-5'||(m.baseline.par===5&&!m.baseline.scores.length))));
  }
  function valid(data){
    if(!obj(data)||JSON.stringify(data).length>48000)return false;
    if(!Object.keys(data).length)return true;
    if(data.version!==1||!text(data.career,80)||!Array.isArray(data.completed)||data.completed.length>definitions.length)return false;
    const ids=new Set();
    for(const entry of data.completed){
      if(!obj(entry)||byId.get(entry.id)?.version!==entry.schema||!byId.has(entry.id)||ids.has(entry.id)||!courseOK(entry.course)||
         !frameOK(entry.frame)||!int(entry.difficulty,0,3)||!layoutOK(entry.layout)||!Array.isArray(entry.holes)||
         entry.holes.length>9||!entry.holes.every(h=>holeOK(h)&&scoresOK(h.scores))||
         new Set(entry.holes.map(h=>h.id)).size!==entry.holes.length||!validAward(entry))return false;
      ids.add(entry.id);
    }
    return data.active===null||(validActive(data.active)&&!ids.has(data.active.id));
  }
  function create(data,career){
    if(!valid(data)||(data.career&&data.career!==career))throw Error('Invalid design challenges for this career');
    const state=copy(data.version?data:{version:1,career,active:null,completed:[]});
    let snapshot=null, progress=null, live=null, seen=new Set(), entryFloor=0;
    function record(award){
      state.completed.push(award);state.active=null;progress=null;live=null;
      return copy(award);
    }
    function evaluate(){
      const a=state.active;
      progress=null;
      if(!a||!snapshot||!sameSite(a.course,snapshot.course))return null;
      const definition=byId.get(a.id);
      progress=definition.evaluate(snapshot,a);
      if(!progress.complete)return null;
      const award={id:a.id,schema:a.schema,course:snapshot.course,frame:snapshot.frame,difficulty:snapshot.difficulty,
        layout:snapshot.layout,holes:progress.holes.map(h=>({...h,scores:a.scores[h.id]||[]}))};
      return record(award);
    }
    function sample(next){
      snapshot=next;
      const a=state.active;
      if(a&&isAdvanced(a.id))return null;
      if(a&&sameSite(a.course,next.course)){
        if(a.layout!==next.layout){a.layout=next.layout;a.scores={};}
        const present=new Set(next.holes.map(h=>h.id));
        for(const id of Object.keys(a.routes).map(Number)){
          if(!present.has(id)&&!a.closed.includes(id))a.closed.push(id);
        }
        for(const id of Object.keys(a.scores))if(!present.has(+id))delete a.scores[id];
      }
      return evaluate();
    }
    function start(id,hole){
      const definition=byId.get(id);
      if(!snapshot||!definition||state.active||state.completed.some(a=>a.id===id))return null;
      const advanced=isAdvanced(id);
      if(advanced&&definition.selectHole&&!snapshot.holes.some(h=>h.id===hole&&
          (definition.selectHole===true||h.par===definition.selectHole)))return null;
      state.active={id,schema:definition.version,course:snapshot.course,started:snapshot.frame,layout:snapshot.layout,
        routes:advanced?{}:Object.fromEntries(snapshot.holes.map(h=>[h.id,h.route])),closed:[],scores:{},seen:[]};
      if(advanced){
        state.active.measurement={hole:definition.selectHole?hole:19,context:null,baseline:null};
        return waiting('Waiting for a verified open-hole layout.');
      }
      return evaluate();
    }
    function score(next,event){
      const a=state.active;
      if(!a||!byId.get(a.id).usesScores||!sameSite(a.course,next.course)||next.frame<a.started||
         !int(event.strokes,1,127)||!text(event.id,80)||a.seen.includes(event.id)||
         !next.holes.some(h=>h.id===event.hole))return null;
      const earlier=sample(next);
      if(earlier)return earlier;
      a.seen.push(event.id);if(a.seen.length>MAX_SEEN)a.seen.shift();
      const scores=a.scores[event.hole]||=[];
      scores.push(event.strokes);if(scores.length>MAX_SCORES)scores.shift();
      return evaluate();
    }
    function waiting(message){
      live=null;
      const a=state.active;
      progress=a?.id==='course-turnaround'?turnaroundProgress(a.measurement.baseline,null,a.layout,message):result([step(message,false)]);
      return null;
    }
    function observeLayout(layout){
      const a=state.active,m=a?.measurement;
      if(!m)return null;
      if(!layout||!sameSite(a.course,layout)||!frameOK(layout.frame)||layout.frame<a.started||
         !int(layout.epoch,1,0xffffffff)||!layoutOK(layout.design)||!layoutOK(layout.context)||
         !int(layout.difficulty,0,3)||!Array.isArray(layout.holes))
        return waiting('Waiting for a verified open-hole layout.');
      const nine=m.hole===19,holes=layout.holes;
      if(holes.length>(nine?9:1)||!holes.every(h=>measuredHole(h)&&
          (nine?h.id<=9:h.id===m.hole&&layoutOK(h.local)))||
          new Set(holes.map(h=>h.id)).size!==holes.length)
        return waiting('Waiting for a verified open-hole layout.');
      if(!nine&&!holes.length)return waiting('Reopen the selected hole to resume the challenge.');
      if(m.context!==null&&m.context!==layout.context)
        return waiting('Collection paused. The original course conditions have changed.');
      m.context=layout.context;
      if(a.layout!==layout.design){a.layout=layout.design;a.scores={};}
      if(live?.epoch!==layout.epoch){seen.clear();entryFloor=0;}
      live={epoch:layout.epoch,frame:layout.frame,difficulty:layout.difficulty,holes:copy(holes)};
      if(!nine&&!m.baseline){
        if(a.id==='signature-par-5'&&holes[0].par!==5)return waiting('Reopen the selected hole as a par 5.');
        m.baseline={...holes[0],design:layout.design,scores:[]};
      }
      return evaluateAdvanced();
    }
    function evaluateAdvanced(){
      const a=state.active,m=a.measurement;
      if(!live)return null;
      const {holes}=live,def=byId.get(a.id),evidence={};
      const rows=holes.map(h=>({...h,scores:a.scores[h.id]||[]}));
      if(m.hole===19){
        const finishes=rows.filter(h=>h.scores.length);
        const missingOpen=Array.from({length:9},(_,i)=>i+1).filter(id=>!rows.some(h=>h.id===id));
        const needsFinish=rows.filter(h=>!h.scores.length).map(h=>h.id);
        progress=result([
          step(def.preview[0],validNine(rows),rows.length+' / 9 valid open holes'+(missingOpen.length?' · Still need '+missingOpen.join(', '):'')),
          step(def.preview[1],hasMix(rows),'Pars present · '+([...new Set(rows.map(h=>h.par))].sort().join(', ')||'None')),
          step(def.preview[2],finishes.length===9,finishes.length+' / 9 holes'+(needsFinish.length?' · Open holes needing a finish '+needsFinish.join(', '):''))
        ],rows);
      }else{
        const [h]=rows,base=m.baseline,hasEdit=h.local!==base.local;
        const samples=scoreLabel(h.scores.length,MIN_FINISHES);
        const description=holeName(h)+' · Par '+h.par+' · '+h.yards+' yd';
        if(a.id==='signature-par-5'){
          progress=result([
            step(def.preview[0],hasEdit&&h.par===5,description),
            step(def.preview[1],h.fun>0,h.fun===null?'Awaiting native rating':'Native Fun '+h.fun),
            step(def.preview[2],h.scores.length>=MIN_FINISHES,samples),
            step(def.preview[3],variety(h.scores),'5 or fewer · '+(h.scores.some(n=>n<=5)?'Observed':'Pending')+
              ' / 6 or more · '+(h.scores.some(n=>n>5)?'Observed':'Pending'))
          ],rows);
          evidence.origin=base.local;
        }else{
          progress=turnaroundProgress(base,h,a.layout);
          evidence.comparison={baseline:base,revised:{...h,design:a.layout}};
        }
      }
      if(!progress.complete)return null;
      return record({id:a.id,schema:a.schema,course:a.course,frame:live.frame,difficulty:live.difficulty,
        layout:a.layout,holes:progress.holes,...evidence});
    }
    function finish(row){
      const a=state.active,m=a?.measurement;
      if(!m||!live||row.epoch!==live.epoch||!frameOK(row.frame)||row.frame<live.frame||
         !int(row.entry,1,0xffffffff)||row.entry<=entryFloor||seen.has(row.entry)||
         !int(row.strokes,1,127)||!funOK(row.fun))return null;
      const hole=live.holes.find(h=>h.id===row.hole),base=m.baseline;
      if(!hole)return null;
      if(m.hole===19){
        if(!validNine(live.holes)||!hasMix(live.holes)||a.scores[hole.id]?.length)return null;
      }else if(a.id==='signature-par-5'){
        if(hole.par!==5||hole.local===base.local)return null;
      }else if(difficult(base)){
        if(revisionIssue(base,hole,a.layout))return null;
      }else if(a.layout!==base.design)return null;
      seen.add(row.entry);
      if(seen.size>256){entryFloor=Math.min(...seen);seen.delete(entryFloor);}
      hole.fun=row.fun;live.frame=row.frame;
      const scores=a.scores[hole.id]||=[];
      scores.push(row.strokes);
      if(scores.length>MAX_SCORES)scores.shift();
      if(a.id==='course-turnaround'&&!difficult(base)){
        const candidate={...hole,design:a.layout,scores:[...scores]};
        if(difficult(candidate)){
          m.baseline=candidate;
          a.scores={};
        }
      }
      return evaluateAdvanced();
    }
    return {
      sample,start,score,observeLayout,finish,
      requestedHole:()=>state.active?.measurement?.hole||0,
      abandon(){state.active=null;progress=null;live=null;},
      active:()=>state.active?.id||null,
      usesScores:()=>!!(state.active&&byId.get(state.active.id).usesScores),
      view:()=>copy({active:state.active&&{id:state.active.id,course:state.active.course,started:state.active.started,
        hole:state.active.measurement?.hole||0},
        progress,course:snapshot?.course||null,holes:snapshot?.holes||[],completed:state.completed}),
      capture:()=>copy(state)
    };
  }
  global.SGDesignChallengeModel=Object.freeze({definitions,valid,create,MAX_SCORES,MAX_SEEN});
})(globalThis);
