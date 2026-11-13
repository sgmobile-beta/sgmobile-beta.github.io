// Read-only interpretation of bounded, native-boundary observations. No native
// calls, random samples, gameplay writes or independent world projection.
(function(global){
  'use strict';
  function summarize(rows){
    const result={holes:rows.length,par:0,yards:0,samples:0,strokes:0,birdie:0,pars:0,bogeys:0,worse:0,assigned:0,valid:true,belowHoleStats:0};
    for(const h of rows){result.par+=h.par;result.yards+=h.yards;result.assigned+=h.assigned;if(!h.valid){result.valid=false;continue;}
      // The original Hole Stats display starts at max(1, par - 2). Keep all
      // recorded finishes in Enhanced totals and identify any difference.
      const firstHoleStatsScore=Math.max(1,h.par-2);
      for(let n=1;n<=9;n++){
        const count=h.scores[n];result.samples+=count;result.strokes+=count*n;
        if(n<firstHoleStatsScore)result.belowHoleStats+=count;
        if(n<h.par)result.birdie+=count;else if(n===h.par)result.pars+=count;else if(n===h.par+1)result.bogeys+=count;else result.worse+=count;
      }
    }
    result.average=result.valid&&result.samples?result.strokes/result.samples:null;
    // FUN_00453330 formats integer hundredths from the weighted score bins.
    result.averageText=result.average===null?null:(Math.trunc(100*result.strokes/result.samples)/100).toFixed(2);
    result.vsPar=result.valid&&result.samples?rows.reduce((sum,h)=>sum+h.scores.slice(1).reduce((s,n)=>s+n,0)*h.par,0):null;
    result.vsPar=result.average===null?null:(result.strokes-result.vsPar)/result.samples;
    return result;
  }
  function holeStatsSampleNote(count){
    return count===1?'Includes 1 finish with fewer strokes than the original Hole Stats table shows.':
      'Includes '+count.toLocaleString()+' finishes with fewer strokes than the original Hole Stats table shows.';
  }
  // These reaction IDs have a stable sign in FUN_00467a00 and a matching
  // meaning in the original Player Comments formatter, FUN_00469b00.
  const reviewReasons=[
    [6,1,'Using a slope on a shot'],[7,1,'Scenic bridges'],
    [11,1,'Attractive scenery'],[18,1,'Enjoying a snack'],
    [25,1,'Enjoying a drink'],[27,1,'Comfortable benches'],
    [28,1,'Attractive course features'],[29,1,'Course variety'],
    [32,1,'A risky shot or a safer route'],[33,1,'Left-or-right route choices'],
    [46,1,'Downhill shots'],
    [9,-1,'Nearly hit by another ball'],[10,-1,'Difficult terrain to walk across'],
    [12,-1,'Ball hit an obstacle'],[13,-1,'Ball went into water'],
    [14,-1,'Thirst'],[15,-1,'Hunger'],[20,-1,'Unattractive course features'],
    [21,-1,'Waiting for other golfers'],[23,-1,'Hole felt too easy or too hard'],
    [24,-1,'Weeds'],[26,-1,'Fatigue'],[30,-1,'Repetitive holes'],
    [43,-1,'Steep uphill walk']
  ];
  function review(heap){
    const base=0x575ab0,stride=520,holes=[];
    if(!heap||heap.byteLength<base+19*stride)return null;
    const data=new DataView(heap.buffer,heap.byteOffset,heap.byteLength);
    for(let hole=1;hole<=18;hole++){
      const at=base+hole*stride,par=data.getInt8(at);
      if(par<1||par>9)continue;
      const yards=data.getInt16(at+4,true),starts=data.getInt32(at+32,true),funCounter=data.getInt32(at+36,true);
      const scores=Array(10).fill(0),averages=[];
      let valid=true;
      for(let group=0;group<8;group++){
        // Native Skill (FUN_0042dea0) gives each skill group eight prior pars.
        let samples=8,strokes=8*par;
        for(let score=1;score<=9;score++){
          const count=data.getInt16(at+40+group*22+score*2,true);
          if(count<0)valid=false;
          scores[score]+=count;
          samples+=count;
          strokes+=count*score;
        }
        averages.push(Math.trunc(100*strokes/samples));
      }
      const scoring=summarize([{par,yards,scores,valid,assigned:0}]);
      const skillParts=scoring.average===null?null:[6,5,3].map(group=>averages[group]-averages[7]);
      const fun=funCounter>0&&starts>=0?Math.trunc(data.getInt16(at+344,true)*100/(Math.trunc(funCounter/2)+4+starts)):null;
      const comments=[];
      for(const [id,sign,text] of reviewReasons){
        const count=data.getInt16(at+216+2*id,true);
        if(count>0)comments.push({text,count,sign});
      }
      holes.push({hole,par,yards,fun,skill:skillParts?skillParts.reduce((total,value)=>total+value,0)/100:null,
        length:skillParts?skillParts[0]/100:null,accuracy:skillParts?skillParts[1]/100:null,
        imagination:skillParts?skillParts[2]/100:null,average:scoring.average,averageText:scoring.averageText,
        finishes:valid?scoring.samples:null,belowHoleStats:valid?scoring.belowHoleStats:0,comments});
    }
    return {holes};
  }
  function gridSummary(values){let max=0,active=0;for(const n of values){if(!Number.isInteger(n)||n<0||n>255)throw Error('Invalid native tile field');if(n)active++;max=Math.max(max,n);}return {max,active};}
  function markers(points,values,frame,rect,bounds){
    if(points.length!==5000||values.length!==2500||frame.width<1||frame.height<1)return [];
    const out=[];for(let i=0;i<2500;i++){const x=points[i*2],y=points[i*2+1],value=values[i];if(!value||x===0||x===-99||x<0||y<0||x>=frame.width||y>=frame.height)continue;
      out.push({tile:i,x:rect.left-bounds.left+x*rect.width/frame.width,y:rect.top-bounds.top+y*rect.height/frame.height,value});}
    return out;
  }
  global.SGCourseAnalytics=Object.freeze({summarize,gridSummary,markers,review,holeStatsSampleNote});
  if(typeof Module==='undefined'||!Module.mobileMap)return;
  Module.captureCourseReview=()=>Module.hasGameFeature?.('courseReview')?review(Module.HEAPU8):null;
  let snapshot=null,selected=0,layer='traffic',serial=0,savedZoom=1,previousFocus=null,lastRender='',lastUI=0,keyRelease='';
  let context=null;
  const names={traffic:'Ball finishes',positive:'Positive reactions',negative:'Negative reactions'},indices={traffic:0,positive:1,negative:2},colors={traffic:'#327dd2',positive:'#00b883',negative:'#f36c39'};
  const root=document.createElement('section');root.id='course-analytics';root.hidden=true;root.setAttribute('aria-label','Course Analytics');root.setAttribute('role','region');
  const style=document.createElement('style');style.textContent=`
    #course-analytics[hidden]{display:none!important}
    #course-analytics{position:fixed;z-index:95;box-sizing:border-box;right:max(8px,env(safe-area-inset-right));bottom:max(8px,env(safe-area-inset-bottom));width:min(370px,calc(100vw - env(safe-area-inset-left) - env(safe-area-inset-right) - 16px));max-height:46dvh;overflow:auto;overscroll-behavior:contain;padding:10px;border:1px solid var(--menu-border);border-radius:14px;background:var(--menu-overlay);color:var(--menu-text);font:14px/1.4 system-ui,sans-serif;box-shadow:0 3px 14px #1b244333}
    #course-analytics header{position:sticky;top:0;z-index:1;background:var(--menu-overlay);border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:8px}#course-analytics h2{font-size:17px;margin:0}#course-analytics p{margin:6px 0}#course-analytics small{font-size:12px}
    #course-analytics button,#course-analytics select{font:inherit;min-height:44px;box-sizing:border-box;padding:6px 9px;border:1px solid var(--menu-border);border-radius:7px;background:var(--menu-button);color:var(--menu-text);touch-action:manipulation}
    #course-analytics header button{min-width:44px;font-size:22px}#course-analytics select{width:100%;min-width:0}#course-analytics label{display:block;margin-top:7px}
    #course-analytics :is(button,select):focus-visible{outline:2px solid var(--menu-focus);outline-offset:2px}
    #analytics-camera{display:flex;gap:4px;flex-wrap:wrap;margin-top:8px}#analytics-camera button{flex:1 0 44px;min-width:44px;white-space:nowrap}#analytics-camera #analytics-focus{flex-basis:auto}
    #analytics-legend[hidden]{display:none}
    #analytics-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin:8px 0}#analytics-summary div{border-radius:6px;background:var(--menu-button);padding:6px}#analytics-summary dt{font-size:11px}#analytics-summary dd{font-size:17px;font-weight:650;margin:0;overflow-wrap:anywhere}
    #analytics-legend{display:flex;align-items:center;gap:6px;font-size:12px;margin-top:8px}#analytics-gradient{height:12px;flex:1;min-width:40px;border-radius:9px}#analytics-counts{font-size:12px}#analytics-context{font-size:12px}
    body.course-analytics-open #mobile-ui,body.course-analytics-open #mobile-mode-rail,body.course-analytics-open #mobile-cancel,body.course-analytics-open #mobile-open-hole,body.course-analytics-open #map-aim-reticle,body.course-analytics-open #map-terrain-reticle,body.course-analytics-open #map-lot-reticle{visibility:hidden!important}
    @media(min-aspect-ratio:1/1){#course-analytics{top:max(44px,calc(env(safe-area-inset-top) + 8px));bottom:auto;max-height:calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 60px);width:min(330px,max(260px,38vw),calc(100vw - env(safe-area-inset-left) - env(safe-area-inset-right) - 16px))}}
    @media(max-width:899px),(max-height:599px){
      #course-analytics .analytics-field{display:grid;grid-template-columns:4.5em minmax(0,1fr);align-items:center;gap:8px}
    }
    @media(min-width:900px){#course-analytics{width:340px}}
    @media(min-width:900px) and (min-height:600px){
      #course-analytics{display:flex;flex-direction:column}#course-analytics > *{flex:none}
      #course-analytics header{order:-3}#analytics-hole-label{order:-2}#analytics-stats{order:-1}
      #analytics-camera{order:1}#analytics-hint{order:2}
    }
    @media(prefers-reduced-transparency:reduce){#course-analytics{background:#d4d4ed}}
  `;document.head.append(style);
  const el=(tag,text,id)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(id)e.id=id;return e;};
  const heading=el('header'),title=el('h2','Course Analytics'),close=el('button','×','analytics-close');close.type='button';close.setAttribute('aria-label','Close Course Analytics');heading.append(title,close);
  const holeLabel=el('label',null,'analytics-hole-label'),holes=el('select',null,'analytics-hole');
  holeLabel.className='analytics-field';holes.setAttribute('aria-label','Analytics hole');holeLabel.append(el('span','Hole'),holes);
  const summary=el('dl',null,'analytics-summary'),counts=el('p',null,'analytics-counts'),contextNote=el('p',null,'analytics-context');
  const viewLabel=el('label'),views=el('select',null,'analytics-layer');
  viewLabel.className='analytics-field';views.setAttribute('aria-label','Analytics map layer');for(const [id,label]of Object.entries({...names,none:'Hide overlay'})){const o=el('option',label);o.value=id;views.append(o);}viewLabel.append(el('span','Map layer'),views);
  const legend=el('div',null,'analytics-legend'),low=el('span','Low'),gradient=el('span',null,'analytics-gradient'),high=el('span','High');legend.append(low,gradient,high);const meaning=el('p',null,'analytics-meaning');
  const camera=el('div',null,'analytics-camera');function button(label,fn,id){const b=el('button',label,id);b.type='button';b.onclick=fn;camera.append(b);return b;}
  const focus=button('Focus hole',focusHole,'analytics-focus');button('−',()=>zoom(.8),'analytics-zoom-out').setAttribute('aria-label','Zoom out');button('+',()=>zoom(1.25),'analytics-zoom-in').setAttribute('aria-label','Zoom in');button('↶',()=>request(4,36),'analytics-rotate-left').setAttribute('aria-label','Rotate map left');button('↷',()=>request(4,33),'analytics-rotate-right').setAttribute('aria-label','Rotate map right');
  const stats=el('div',null,'analytics-stats');stats.append(summary,counts,contextNote);
  const hint=el('p','Drag the map to pan; pinch to zoom. Map layers cover the whole course. Select a hole to see its statistics. Use Focus hole to frame the tee and green.','analytics-hint');hint.style.fontSize='12px';
  root.append(heading,holeLabel,viewLabel,camera,stats,legend,meaning,hint);document.body.append(root);
  function allowed(){return !!Module.hasGameFeature?.('courseAnalytics');}
  function same(){return allowed()&&Module.analyticsSession?.career===Module.saveRules?.active?.game.id;}
  function request(kind,value=0){if(!Module.analyticsActive||!same()||Module.analyticsSession.closing)return;Module.cancelMapGesture?.();Module.analyticsRequest={kind,value};}
  function focusHole(){
    if(!Module.analyticsActive||!same()||Module.analyticsSession.closing||Module.analyticsRequest)return;
    const row=snapshot?.rows.find(h=>h.id===selected);
    if(!row)return;
    const [teeX,teeY,bendX,bendY,greenX,greenY]=row.route;
    const valid=(x,y)=>x>=0&&x<50&&y>=0&&y<50;
    if(!valid(teeX,teeY)||!valid(greenX,greenY))return;

    const b=Module.getScreenBounds(),panel=root.getBoundingClientRect();
    const left=b.left+b.safe.left,right=b.left+b.width-b.safe.right;
    const top=Math.max(b.top+b.safe.top,Module.headerHeight()),bottom=b.top+b.height-b.safe.bottom;
    const above=Math.max(0,Math.min(bottom,panel.top)-top);
    const beside=Math.max(0,Math.min(right,panel.left)-left);
    const useAbove=above*(right-left)>=beside*(bottom-top);
    const width=useAbove?right-left:beside,height=useAbove?above:bottom-top;
    if(width<=0||height<=0)return;

    // Fit the original route in the part of the viewport outside the panel.
    // Use the same tile offsets as map panning and leave space for the markers.
    const origin={x:teeX,y:teeY,rotation:Module.mobileState.rotation};
    const {project,cameraFor}=Module.mapCameraGeometry;
    const points=[{x:0,y:0},project(teeX-greenX,teeY-greenY,origin,1)];
    if((bendX||bendY)&&valid(bendX,bendY))points.push(project(teeX-bendX,teeY-bendY,origin,1));
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const view=Module.mapPresentation,minimum=Module.mobileState.constructing?1:.25;
    const fit=Math.min(Math.max(1,width-64)/Math.max(1,maxX-minX),Math.max(1,height-64)/Math.max(1,maxY-minY));
    const preserveZoom=Module.aimMode||Module.lotMode||Module.terrainMode;
    const targetZoom=preserveZoom?view.zoom:Math.max(minimum,Math.min(view.zoom,fit/view.baseScale));
    const scale=targetZoom*view.baseScale;
    const dx=left+width/2-(b.left+b.width/2)-(minX+maxX)*scale/2;
    const dy=top+height/2-(b.top+b.height/2)-(minY+maxY)*scale/2;
    const camera=cameraFor(dx,dy,origin,scale);
    Module.cancelMapGesture?.();
    if(targetZoom!==view.zoom)Module.setMapZoom(targetZoom);
    Module.analyticsRequest={kind:3,hole:selected,x:Math.round(camera.x),y:Math.round(camera.y),rotation:origin.rotation};
  }
  function zoom(factor){if(Module.analyticsActive&&same()&&!Module.analyticsSession.closing){Module.cancelMapGesture?.();Module.setMapZoom(Module.mapPresentation.zoom*factor);}}
  Module.openCourseAnalytics=function(hole=0,from=null){
    if(!allowed()||!Module.mobileState?.course||Module.shotPending||Module.analyticsSession?.active||Module.analyticsRequest)return false;
    context=from;
    previousFocus=document.activeElement;savedZoom=Module.mapPresentation.zoom;
    if(!context)Module.cancelMapGesture?.();
    Module.analyticsRequest={kind:1,hole,career:Module.saveRules.active.game.id};return true;
  };
  Module.cancelPendingCourseAnalytics=from=>{
    if(context!==from||Module.analyticsSession||Module.analyticsRequest?.kind!==1)return;
    context=null;previousFocus=null;Module.analyticsRequest=null;
  };
  Module.beginCourseAnalytics=function(id,hole){
    if(!allowed())return;
    serial=id;selected=Number(hole)||0;snapshot=null;lastRender='';
    Module.analyticsSession={active:true,serial:id,career:Module.saveRules.active.game.id,closing:false};
    if(context&&!context.leave()){
      context=null;dismiss();return;
    }
    close.textContent=context?'Back':'×';
    close.setAttribute('aria-label',context?'Back':'Close Course Analytics');
    Module.analyticsActive=true;root.hidden=false;document.body.classList.add('course-analytics-open');
    close.disabled=false;render();root.scrollTop=0;close.focus({preventScroll:true});
  };
  Module.finishCourseAnalytics=function(id){
    if(Module.analyticsSession?.serial!==id)return;
    const from=context,opener=previousFocus;
    context=null;previousFocus=null;Module.analyticsSession=null;Module.analyticsActive=false;Module.analyticsRequest=null;
    snapshot=null;Module.analyticsPresentation=null;Module.analyticsDiagnostics=null;Module.analyticsDrawn=null;
    root.hidden=true;document.body.classList.remove('course-analytics-open');
    Module.analyticsPaintRevision=(Module.analyticsPaintRevision||0)+1;Module.applySmoothPan?.();
    queueMicrotask(()=>{
      if(from?.back())return;
      if(opener?.isConnected&&opener.getClientRects().length)opener.focus({preventScroll:true});
    });
  };
  Module.suspendCourseAnalytics=function(value){
    if(!Module.analyticsSession)return;
    Module.analyticsActive=!value&&same()&&(!Module.analyticsSession.closing||!root.hidden);
    root.hidden=!Module.analyticsActive;document.body.classList.toggle('course-analytics-open',Module.analyticsActive);
  };
  addEventListener('simgolf-ruleset-change',()=>{
    if(!context)return;
    if(Module.analyticsSession)Module.analyticsSession.career=null;
    else {context=null;Module.analyticsRequest=null;previousFocus=null;}
  });
  function dismiss(){
    const s=Module.analyticsSession;
    if(!s?.active||s.closing)return;
    // A contextual Back may follow a map gesture, but its native inputs
    // must drain while Analytics still owns them.
    if(context&&(!Module.lotCanStart()||Module.touchQueue?.length))return;
    if(!context&&Module.analyticsActive)Module.cancelMapGesture?.();
    s.closing=true;close.disabled=true;
    if(Module.mapPresentation.zoom!==savedZoom)Module.setMapZoom(savedZoom);
    Module.analyticsRequest={kind:2};
  }
  close.onclick=dismiss;
  holes.onchange=()=>{selected=Number(holes.value);lastRender='';render();Module.analyticsPaintRevision=(Module.analyticsPaintRevision||0)+1;Module.applySmoothPan?.();};
  views.onchange=()=>{layer=views.value;lastRender='';render();Module.analyticsPaintRevision=(Module.analyticsPaintRevision||0)+1;Module.applySmoothPan?.();};
  Module.publishCourseAnalytics=function(id,holePtr,gridPtr,frame){
    if(!same()||id!==serial)return;const started=performance.now(),h=new Int32Array(Module.HEAPU8.buffer),rows=[];for(let i=0;i<18;i++){const a=(holePtr>>2)+i*24,v=Array.from(h.subarray(a,a+24));if(v[1]>0&&v[1]<=9)rows.push({id:v[0],par:v[1],yards:v[2],starts:v[3],nativeFactor:v[4]?Math.trunc(v[5]*100/(Math.trunc(v[4]/2)+4+v[3])):null,valid:!!v[6],scores:v.slice(7,17),assigned:v[17],route:v.slice(18,24)});}
    const grids=[0,1,2].map(i=>Module.HEAPU8.slice(gridPtr+i*2500,gridPtr+(i+1)*2500));snapshot={serial:id,frame,rows,grids,summaries:grids.map(gridSummary),time:performance.now(),career:Module.analyticsSession.career};Module.analyticsDiagnostics={serial:id,frame,holes:rows.length,grids:grids.map(gridSummary),sampleMs:0};render();Module.analyticsDiagnostics.sampleMs=performance.now()-started;
  };
  function render(){
    if(root.hidden)return;const rows=snapshot?.rows||[],stamp=JSON.stringify([selected,layer,rows,snapshot?.frame]);if(stamp===lastRender)return;lastRender=stamp;lastUI=performance.now();
    const values=['0',...rows.map(h=>String(h.id))];if(holes.options.length!==values.length||Array.from(holes.options).some((o,i)=>o.value!==values[i])){holes.replaceChildren();for(const id of values){const o=el('option',id==='0'?'All holes':'Hole '+id);o.value=id;holes.append(o);}}if(snapshot&&selected&&!rows.some(h=>h.id===selected))selected=0;holes.value=String(selected);views.value=layer;
    const chosen=selected?rows.filter(h=>h.id===selected):rows,s=summarize(chosen);summary.replaceChildren();function metric(label,value){const pair=el('div');pair.append(el('dt',label),el('dd',String(value)));summary.append(pair);}
    metric(selected?'Hole':'Open holes',selected||s.holes);metric('Par',s.par);metric('Yards',s.yards);metric('Score average',s.averageText??'—');metric('Score vs par',s.vsPar===null?'—':(s.vsPar>0?'+':'')+s.vsPar.toFixed(2));metric('Assigned golfers',s.assigned);
    if(selected&&chosen[0]?.nativeFactor!==null)metric('Native fun factor',chosen[0]?.nativeFactor??'—');
    counts.textContent=!snapshot||!rows.length?'':!s.valid?'Completed score counts are unavailable.':
      s.samples?`${s.samples.toLocaleString()} recorded finishes · ${s.birdie} birdie or better · ${s.pars} par · ${s.bogeys} bogey · ${s.worse} worse`:
      'No completed scores recorded yet.';
    contextNote.textContent=!snapshot?'Waiting for course data.':!rows.length?'Open a hole to see its performance.':
      !s.valid||!s.samples?'':(s.samples<10?'Small sample. ':'')+'Scores of 9 or more count as 9.'+
      (s.belowHoleStats?' '+holeStatsSampleNote(s.belowHoleStats):'');
    focus.disabled=!selected;legend.hidden=layer==='none';meaning.hidden=layer==='none';if(layer!=='none'){const g=snapshot?snapshot.summaries[indices[layer]]:{max:0,active:0};gradient.style.background=`linear-gradient(90deg,${colors[layer]}33,${colors[layer]})`;high.textContent='High · '+g.max;low.textContent=g.max?'1':'0';const activity=layer==='traffic'?'Shows accumulated activity where balls stopped.':'Shows where golfers reacted, including repeat reactions.';
      meaning.textContent=g.max?`${activity} ${g.active} tiles with activity. Darker markers show more activity within this layer. Activity fades as play advances, and small traces can remain.`:
        `No activity recorded for this layer. ${activity}`;}
    Module.analyticsPresentation={selected,layer,summary:s,frame:snapshot?.frame,career:snapshot?.career};
  }
  Module.captureCourseAnalyticsFrame=function(ptr){if(!ptr||!same()||!Module.analyticsActive||!snapshot)return null;return {serial,career:snapshot.career,points:new Int16Array(Module.HEAPU8.buffer,ptr,5000).slice(),snapshot};};
  Module.paintCourseAnalytics=function(g,frame,b,r){
    const start=performance.now(),a=frame.analytics;if(!Module.analyticsActive||!same()||!a||a.serial!==serial||a.career!==Module.analyticsSession.career||a.snapshot.career!==a.career)return;
    const data=a.snapshot;if(layer!=='none'){const values=data.grids[indices[layer]],max=data.summaries[indices[layer]].max;if(max){const marks=markers(a.points,values,frame,r,b),sx=r.width/frame.width,sy=r.height/frame.height;g.save();g.fillStyle=colors[layer];for(const m of marks){g.globalAlpha=.12+.4*m.value/max;g.beginPath();g.ellipse(m.x,m.y,Math.max(2,26*frame.zoom/4*sx),Math.max(1.5,16*frame.zoom/4*sy),0,0,Math.PI*2);g.fill();}g.restore();Module.analyticsDrawn={serial,frame:data.frame,rotation:frame.rotation,zoom:frame.zoom,camera:[frame.x,frame.y],markers:marks.length,layer,first:marks[0]||null};}}
    if(selected){const h=data.rows.find(h=>h.id===selected);if(h){g.save();g.font='bold 13px system-ui';g.textAlign='center';for(const [offset,label]of [[0,'Tee'],[4,'Green']]){const [x,y]=h.route.slice(offset,offset+2),index=x*50+y,px=a.points[index*2],py=a.points[index*2+1];if(x>=0&&x<50&&y>=0&&y<50&&px!==0&&px!==-99&&px>=0&&py>=0){const cx=r.left-b.left+px*r.width/frame.width,cy=r.top-b.top+py*r.height/frame.height;g.strokeStyle='#fff';g.lineWidth=2;g.beginPath();g.arc(cx,cy,10,0,Math.PI*2);g.stroke();g.fillStyle='#17294b';g.fillText('H'+selected+' '+label,cx,cy-14);}}g.restore();}}
    if(Module.analyticsDiagnostics){Module.analyticsDiagnostics.paintMs=performance.now()-start;Module.analyticsDiagnostics.uiAgeMs=performance.now()-lastUI;}
  };
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel','mousedown','mousemove','mouseup','click','dblclick','touchstart','touchmove','touchend','touchcancel','wheel','keydown','keyup','keypress'])root.addEventListener(type,e=>e.stopPropagation());
  // Registered before SDL and the shared map keys. Only browser UI and safe
  // camera requests own keys while the panel is live; releases are contained.
  addEventListener('keydown',e=>{if(!Module.analyticsActive){if(keyRelease===e.key){e.preventDefault();e.stopImmediatePropagation();}return;}e.stopImmediatePropagation();if(e.key==='Escape'){e.preventDefault();keyRelease=e.key;dismiss();return;}const field=e.target.closest?.('select');if(field)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();keyRelease=e.key;if(!e.repeat)e.target.closest?.('button')?.click();}else if(e.key==='Tab'){e.preventDefault();const items=Array.from(root.querySelectorAll('button,select')).filter(e=>!e.disabled),i=items.indexOf(document.activeElement);items[(i+(e.shiftKey?-1:1)+items.length)%items.length]?.focus();}else{e.preventDefault();const d={ArrowUp:1,ArrowRight:2,ArrowDown:4,ArrowLeft:8}[e.key];if(d)request(5,d);}},true);
  addEventListener('keypress',e=>{if(Module.analyticsActive){e.preventDefault();e.stopImmediatePropagation();}},true);
  addEventListener('keyup',e=>{if(Module.analyticsActive||keyRelease===e.key){e.preventDefault();e.stopImmediatePropagation();if(keyRelease===e.key)keyRelease='';}},true);
})(globalThis);
