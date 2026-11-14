// Reflow the native routing screen around its original map and commands.
(function(){
  if(!Module.mobileUI)return;

  const modes=[
    ['routing','Routing'],
    ['staff','Staff'],
    ['aura','Course Aura'],
    ['values','Home Site Value']
  ];
  const style=document.createElement('style');
  style.textContent=`
    body.mobile-routing-open :is(#canvas,#map-display,#mobile-ui,#mobile-mode-rail,#mobile-cancel,#mobile-open-hole,#local-title-actions){visibility:hidden!important}
    #mobile-routing-map{
      --routing-ink:#252342;--routing-muted:#56536e;--routing-line:#a4a0bf;
      --routing-cream:#fcf5e3;--routing-accent:#5a5686;
      position:fixed;inset:auto;margin:0;padding:0;box-sizing:border-box;border:0;
      max-width:none;max-height:none;overflow:hidden;color:var(--routing-ink);
      background:#b0accb;font:16px/1.25 system-ui,sans-serif
    }
    #mobile-routing-map::backdrop{background:#b0accb}
    #mobile-routing-map [hidden]{display:none!important}
    #routing-map-frame{
      box-sizing:border-box;width:100%;height:100%;display:flex;flex-direction:column;min-height:0;
      padding:var(--routing-safe,0);background:linear-gradient(155deg,#e9e5f3,#cbc7e1 62%,#c2bcda)
    }
    #mobile-routing-map :where(button,select){
      box-sizing:border-box;font:inherit;color:inherit;min-height:44px;border:1px solid #8581a5;
      border-radius:9px;touch-action:manipulation
    }
    #mobile-routing-map :where(button){cursor:pointer;background:#f9f5ed}
    #mobile-routing-map button:disabled{opacity:.55;cursor:default}
    #mobile-routing-map :focus-visible{outline:3px solid #6e58ad;outline-offset:-3px}
    #routing-map-header{
      display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;
      padding:8px clamp(8px,2.2vw,16px) 7px;
      background:linear-gradient(#fbf6e9,#ece4d6);border-bottom:1px solid var(--routing-line)
    }
    #routing-map-identity{min-width:0}
    #routing-map-title{margin:0;font-size:clamp(20px,4vw,26px);line-height:1.05;letter-spacing:-.02em}
    #routing-map-course{margin:4px 0 0;font-size:13px;color:var(--routing-muted);overflow-wrap:anywhere}
    #routing-map-done{min-width:64px;padding:5px 10px;font-weight:700;background:linear-gradient(#fffbed,#f5d881)}
    #routing-map-views{
      display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;flex:none;
      padding:6px clamp(6px,2vw,14px) 7px;background:#ded9ec
    }
    #routing-map-views button{padding:4px 2px;font-size:clamp(11px,2.8vw,14px);line-height:1.1;font-weight:650}
    #routing-map-views button[aria-pressed="true"]{color:#fff;background:#524c77;border-color:#524c77;opacity:1}
    #routing-map-status{flex:1;display:grid;place-items:center;margin:0;padding:12px;text-align:center;font-weight:650}
    #routing-map-content{
      flex:1;min-height:0;display:grid;grid-template-rows:minmax(0,1fr) auto;
      grid-template-columns:minmax(0,1fr);overflow:hidden
    }
    #routing-map-viewport{
      position:relative;isolation:isolate;min-width:0;min-height:0;overflow:hidden;touch-action:none;
      background:radial-gradient(ellipse at 49% 40%,#3a4263,#252c48 70%,#1e263e)
    }
    #routing-map-viewport[data-zoomed="true"]{cursor:grab}
    #routing-map-viewport[data-dragging="true"]{cursor:grabbing}
    #routing-map-picture,#routing-map-markers{position:absolute;inset:0;pointer-events:none}
    #routing-map-image{display:block;transform-origin:0 0;image-rendering:pixelated;pointer-events:none}
    #mobile-routing-map .routing-map-marker{
      position:absolute;left:0;top:0;z-index:1;width:42px;height:42px;min-height:0;
      display:grid;place-items:center;padding:0;border:0;background:transparent;pointer-events:auto;touch-action:none
    }
    .routing-map-marker span{
      display:grid;place-items:center;min-width:24px;height:24px;padding:0 2px;
      box-sizing:border-box;border:1px solid #fff6df;border-radius:50%;
      color:#fff;background:#2f3351;box-shadow:0 2px 3px #141a25ba;font-size:12px;font-weight:750;pointer-events:none
    }
    .routing-map-marker-leader{
      position:absolute;left:0;top:0;height:1px;background:#fff1b6;transform-origin:0 50%;
      box-shadow:0 1px #29233c;pointer-events:none
    }
    .routing-map-marker[aria-pressed="true"]{z-index:2}
    .routing-map-marker[aria-pressed="true"] span{background:#f6d671;color:#282138;border-color:#fff0b6}
    #routing-map-compass{position:absolute;left:8px;bottom:7px;width:45px;height:auto;pointer-events:none}
    #routing-map-fit{
      position:absolute;right:8px;bottom:8px;z-index:3;padding:4px 10px;
      font-size:13px;font-weight:650;box-shadow:0 2px 4px #141a256b
    }
    #routing-map-side{
      display:flex;flex-direction:column;min-height:0;min-width:0;
      background:var(--routing-cream);border-top:1px solid var(--routing-line)
    }
    #routing-map-summary{
      display:flex;align-items:center;justify-content:space-between;gap:7px;width:100%;
      min-height:50px;border:0;border-radius:0;text-align:left;background:transparent;
      padding:7px clamp(8px,2.2vw,14px);font-size:14px;touch-action:none
    }
    #routing-map-summary-text{min-width:0}
    #routing-map-summary-text strong,#routing-map-summary-text small{display:block}
    #routing-map-summary-text small{color:var(--routing-muted);font-size:12px;margin-top:2px}
    #routing-map-summary-action{flex:none;color:#4b4471;font-size:12px;font-weight:700}
    #routing-map-details{
      box-sizing:border-box;display:flex;flex-direction:column;gap:7px;min-height:0;
      max-height:min(40dvh,250px);padding:5px 8px 8px;border-top:1px solid #c6bdd5
    }
    #routing-map-pane{
      min-height:0;overflow:auto;overscroll-behavior:contain;touch-action:pan-y;
      padding-inline-end:6px;scrollbar-color:#8d87ae #eee7dc
    }
    #routing-map-holes,#routing-map-staff-list{margin:0;padding:0;list-style:none}
    #routing-map-holes{display:grid;gap:3px}
    #mobile-routing-map .routing-map-row{
      width:100%;display:grid;align-items:center;grid-template-columns:minmax(0,1.45fr) repeat(3,minmax(0,1fr));
      gap:2px;padding:5px 6px;text-align:left;font-size:13px;font-variant-numeric:tabular-nums;
      background:#fffdf7;border-color:#c8bfd6
    }
    #mobile-routing-map .routing-map-row[aria-pressed="true"]{background:#eee6fa;border-color:#7a6ea1}
    #mobile-routing-map .routing-map-row[data-empty="true"]{color:var(--routing-muted)}
    #mobile-routing-map .routing-map-row[data-empty="true"] span{grid-column:2/-1}
    #routing-map-move{width:100%;flex:none;background:linear-gradient(#fff9e5,#f7df96);font-weight:700}
    #routing-map-move-panel{
      padding:8px;background:#f5edfa;border:1px solid #c6bad9;border-radius:8px;margin:0 0 6px
    }
    #routing-map-move-panel h2{margin:0 0 6px;font-size:16px}
    #routing-map-move-panel label{display:block;margin-bottom:4px;font-size:13px;font-weight:650}
    #routing-map-destination{width:100%;padding:4px 6px;background:#fffdf9}
    #routing-map-move-preview{margin:6px 0;color:var(--routing-muted);font-size:13px;overflow-wrap:anywhere}
    .routing-map-actions{display:flex;gap:6px;align-items:center;justify-content:flex-end}
    .routing-map-actions button{min-width:48px;padding:4px 8px;font-size:13px}
    #routing-map-move-confirm{background:linear-gradient(#fff9e9,#f6dd90);font-weight:750}
    #routing-map-staff-list{display:grid;gap:5px}
    #routing-map-staff-list li{padding:6px 7px;border:1px solid #c8bfd6;border-radius:7px;background:#fffdf7}
    #routing-map-staff-list small{display:block;margin-top:3px;color:var(--routing-muted);line-height:1.3}
    #routing-map-staff-controls{display:flex;flex:none;justify-content:space-between;gap:6px}
    #routing-map-staff-controls button{padding:4px 8px;font-size:13px}
    #routing-map-legend p{margin:4px 0 8px;font-size:14px}
    #routing-map-legend ul{margin:4px 0 8px;padding-left:20px;font-size:13px}
    #routing-map-legend h2{margin:4px 0;font-size:14px}
    #routing-map-legend-ramp{width:100%;height:12px;border-radius:6px}
    #routing-map-legend-scale{display:flex;justify-content:space-between;color:var(--routing-muted);font-size:12px}
    #mobile-routing-map.routing-wide #routing-map-content{
      grid-template-columns:minmax(0,1fr) minmax(228px,31%);grid-template-rows:minmax(0,1fr)
    }
    #mobile-routing-map.routing-wide #routing-map-side{border-top:0;border-left:1px solid var(--routing-line)}
    #mobile-routing-map.routing-wide #routing-map-summary{
      min-height:43px;pointer-events:none;border-bottom:1px solid #d2c9d9
    }
    #mobile-routing-map.routing-wide #routing-map-summary-action{display:none}
    #mobile-routing-map.routing-wide #routing-map-details{max-height:none;flex:1;border-top:0}
    #mobile-routing-map.routing-wide #routing-map-pane{flex:1}
  `;
  document.head.append(style);

  function element(tag,id,text){
    const node=document.createElement(tag);
    if(id)node.id=id;
    if(text)node.textContent=text;
    return node;
  }
  function button(id,text,action){
    const node=element('button',id,text);
    node.type='button';
    if(action)node.onclick=action;
    return node;
  }
  const root=element('dialog','mobile-routing-map');
  root.hidden=true;
  root.setAttribute('aria-labelledby','routing-map-title');
  const frame=element('div','routing-map-frame'),header=element('header','routing-map-header');
  const identity=element('div','routing-map-identity'),title=element('h1','routing-map-title','Routing Map');
  const course=element('p','routing-map-course');
  const done=button('routing-map-done','Done',dismiss);
  done.autofocus=true;
  identity.append(title,course);
  header.append(identity,done);
  const views=element('nav','routing-map-views');
  views.setAttribute('aria-label','Routing map view');
  const viewButtons=new Map(modes.map(([mode,label])=>[mode,button('routing-map-view-'+mode,label,()=>send('mode',mode))]));
  views.append(...viewButtons.values());
  const status=element('p','routing-map-status','Opening Routing Map…');
  status.setAttribute('role','status');
  const content=element('div','routing-map-content');
  const viewport=element('div','routing-map-viewport');
  viewport.setAttribute('role','group');
  viewport.setAttribute('aria-label','Course map. Pinch to zoom and drag to pan');
  const picture=element('div','routing-map-picture');
  const canvas=element('canvas','routing-map-image');
  canvas.setAttribute('aria-hidden','true');
  const markerLayer=element('div','routing-map-markers');
  const compass=element('canvas','routing-map-compass');
  compass.setAttribute('aria-hidden','true');
  const fit=button('routing-map-fit','Fit Course',resetFit);
  picture.append(canvas);
  viewport.append(picture,markerLayer,compass,fit);

  const side=element('aside','routing-map-side'),summary=button('routing-map-summary','',toggleDetails);
  const summaryText=element('span','routing-map-summary-text'),summaryTitle=element('strong');
  const summaryValue=element('small'),summaryAction=element('span','routing-map-summary-action');
  summary.setAttribute('aria-controls','routing-map-details');
  summaryText.append(summaryTitle,summaryValue);
  summary.append(summaryText,summaryAction);
  const details=element('div','routing-map-details'),pane=element('div','routing-map-pane');
  const holes=element('ol','routing-map-holes');
  holes.setAttribute('aria-label','Hole positions');
  const move=button('routing-map-move','Move Hole',beginMove);
  const movePanel=element('section','routing-map-move-panel');
  const moveTitle=element('h2','routing-map-move-title');
  const destination=element('select','routing-map-destination');
  const destinationLabel=element('label','','New position');
  destinationLabel.htmlFor=destination.id;
  const orderPreview=element('p','routing-map-move-preview');
  orderPreview.setAttribute('aria-live','polite');
  const moveActions=element('div');
  moveActions.className='routing-map-actions';
  const cancelMove=button('routing-map-move-cancel','Cancel',()=>endMove(true));
  const confirmMove=button('routing-map-move-confirm','Confirm Move',applyMove);
  moveActions.append(cancelMove,confirmMove);
  movePanel.append(moveTitle,destinationLabel,destination,orderPreview,moveActions);
  destination.onchange=updateMovePreview;
  const staffList=element('ul','routing-map-staff-list');
  staffList.setAttribute('aria-label','Employees on this page');
  const staffControls=element('div','routing-map-staff-controls');
  const staffPrev=button('routing-map-staff-prev','Previous',()=>send('page',-1));
  const staffNext=button('routing-map-staff-next','Next',()=>send('page',1));
  staffControls.append(staffPrev,staffNext);
  const legend=element('section','routing-map-legend');
  pane.append(movePanel,holes,staffList,legend);
  details.append(pane,move,staffControls);
  side.append(summary,details);
  content.append(viewport,side);
  frame.append(header,views,status,content);
  root.append(frame);
  document.body.append(root);

  const slots=Array.from({length:18},(_,index)=>index+1);
  const markers=new Map();
  const rowButtons=new Map();
  let state=null,returnFocus=null,detailsOpen=false,wide=false,moveFrom=0;
  let rowStamp='',staffStamp='',legendMode='';
  let crop=null,zoom=1,cameraX=0,cameraY=0,fitScale=1;
  let screenX=0,screenY=0,scale=1;
  let savedCompass=false;
  const pointers=new Map();
  let gesture=null;

  function bounds(){
    if(!root.open)return;
    const b=Module.getScreenBounds();
    const {left,top,right,bottom}=b.safe;
    Object.assign(root.style,{left:b.left+'px',top:b.top+'px',width:b.width+'px',height:b.height+'px'});
    root.style.setProperty('--routing-safe',[top,right,bottom,left].map(value=>value+'px').join(' '));
    const width=b.width-left-right,height=b.height-top-bottom;
    wide=width>=600&&width>=height*.95;
    root.classList.toggle('routing-wide',wide);
    syncDetails();
    positionMap();
  }
  function syncDetails(){
    details.hidden=!(wide||detailsOpen);
    summary.tabIndex=wide?-1:0;
    summary.setAttribute('aria-expanded',String(wide||detailsOpen));
    const routing=state?.data?.mode==='routing';
    summaryAction.textContent=detailsOpen?(routing?'Hide holes ▾':'Hide details ▾'):(routing?'All holes ▴':'Show details ▴');
  }
  function toggleDetails(){
    if(wide||performance.now()<traySwipeUntil)return;
    detailsOpen=!detailsOpen;
    syncDetails();
  }
  function clamp(value,min,max){
    return Math.max(min,Math.min(max,value));
  }
  function positionMap(){
    if(!crop)return;
    const width=viewport.clientWidth,height=viewport.clientHeight;
    if(!width||!height)return;
    fitScale=Math.min(Math.max(1,width-18)/crop.width,Math.max(1,height-16)/crop.height);
    scale=fitScale*zoom;
    const edgeX=Math.min(crop.width/2,width/(2*scale)),edgeY=Math.min(crop.height/2,height/(2*scale));
    cameraX=clamp(cameraX,edgeX,crop.width-edgeX);
    cameraY=clamp(cameraY,edgeY,crop.height-edgeY);
    screenX=width/2-cameraX*scale;
    screenY=height/2-cameraY*scale;
    canvas.style.transform='translate('+screenX+'px,'+screenY+'px) scale('+scale+')';
    viewport.dataset.zoomed=String(zoom>1.01);
    positionMarkers(width,height);
    state.zoom=zoom;
    state.camera={x:cameraX,y:cameraY};
  }
  const markerOffsets=[[0,0]];
  for(const distance of [18,28,39,52]){
    for(const [x,y] of [[0,-1],[1,0],[-1,0],[0,1],[.7,-.7],[-.7,-.7],[.7,.7],[-.7,.7]])
      markerOffsets.push([distance*x,distance*y]);
  }
  function positionMarkers(width,height){
    const placed=[];
    const fitX=width-fit.offsetWidth-8,fitY=height-fit.offsetHeight-8;
    for(const marker of markers.values()){
      const anchorX=screenX+marker.x*scale,anchorY=screenY+marker.y*scale;
      marker.node.hidden=marker.leader.hidden=true;
      if(anchorX<-8||anchorY<-8||anchorX>width+8||anchorY>height+8)continue;
      for(const [dx,dy] of markerOffsets){
        const x=clamp(anchorX+dx,13,width-13),y=clamp(anchorY+dy,13,height-13);
        if((x+12>=fitX&&y+12>=fitY)||(x<62&&y>height-56))continue;
        if(placed.some(point=>Math.hypot(point.x-x,point.y-y)<26))continue;
        placed.push({x,y});
        marker.screenX=x;
        marker.screenY=y;
        marker.node.hidden=false;
        marker.node.style.transform='translate('+(x-21)+'px,'+(y-21)+'px)';
        const distance=Math.hypot(x-anchorX,y-anchorY);
        if(distance>=2){
          const angle=Math.atan2(y-anchorY,x-anchorX);
          marker.leader.hidden=false;
          marker.leader.style.width=distance+'px';
          marker.leader.style.transform='translate('+anchorX+'px,'+anchorY+'px) rotate('+angle+'rad)';
        }
        break;
      }
    }
  }
  function nearestMarker({x,y}){
    if(markerLayer.hidden)return 0;
    let closest=0,best=21;
    for(const [hole,marker] of markers){
      if(marker.node.hidden)continue;
      const distance=Math.hypot(x-marker.screenX,y-marker.screenY);
      if(distance<=best){closest=hole;best=distance;}
    }
    return closest;
  }
  function resetFit(){
    if(!crop)return;
    zoom=1;
    cameraX=crop.width/2;
    cameraY=crop.height/2;
    positionMap();
  }
  function adjustZoom(next,x,y){
    if(!crop)return;
    const previous=scale;
    const newZoom=clamp(next,1,4);
    if(newZoom===zoom)return;
    const width=viewport.clientWidth,height=viewport.clientHeight;
    const pointX=(x-screenX)/previous,pointY=(y-screenY)/previous;
    zoom=newZoom;
    cameraX=pointX-(x-width/2)/(fitScale*zoom);
    cameraY=pointY-(y-height/2)/(fitScale*zoom);
    positionMap();
  }

  function pointerPosition(event){
    const r=viewport.getBoundingClientRect();
    return {x:event.clientX-r.left,y:event.clientY-r.top};
  }
  function rebaseGesture(){
    const [first,second]=pointers.values();
    if(!first){gesture=null;viewport.dataset.dragging='false';return;}
    gesture={
      x:second?(first.x+second.x)/2:first.x,
      y:second?(first.y+second.y)/2:first.y,
      distance:second?Math.hypot(second.x-first.x,second.y-first.y):0,
      zoom,cameraX,cameraY,moved:!!second||!!gesture?.moved,
      marker:second?0:(gesture?.marker||first.marker)
    };
  }
  viewport.addEventListener('pointerdown',event=>{
    if(!crop||event.target.closest('#routing-map-fit')||event.button!==0)return;
    if(pointers.size===2)return;
    const point=pointerPosition(event);
    point.marker=nearestMarker(point);
    pointers.set(event.pointerId,point);
    viewport.setPointerCapture(event.pointerId);
    rebaseGesture();
    event.preventDefault();
  });
  viewport.addEventListener('pointermove',event=>{
    if(!gesture||!pointers.has(event.pointerId))return;
    pointers.set(event.pointerId,pointerPosition(event));
    const [first,second]=pointers.values();
    const x=second?(first.x+second.x)/2:first.x,y=second?(first.y+second.y)/2:first.y;
    if(!gesture.moved&&Math.hypot(x-gesture.x,y-gesture.y)<5)return;
    gesture.moved=true;
    viewport.dataset.dragging='true';
    const factor=second&&gesture.distance>0?Math.hypot(second.x-first.x,second.y-first.y)/gesture.distance:1;
    zoom=clamp(gesture.zoom*factor,1,4);
    const base=fitScale*gesture.zoom,next=fitScale*zoom;
    const halfWidth=viewport.clientWidth/2,halfHeight=viewport.clientHeight/2;
    cameraX=gesture.cameraX+(gesture.x-halfWidth)/base-(x-halfWidth)/next;
    cameraY=gesture.cameraY+(gesture.y-halfHeight)/base-(y-halfHeight)/next;
    positionMap();
    event.preventDefault();
  });
  function releasePointer(event){
    if(!pointers.has(event.pointerId))return;
    const marker=event.type==='pointerup'&&pointers.size===1&&!gesture?.moved?gesture?.marker:0;
    pointers.delete(event.pointerId);
    rebaseGesture();
    if(marker)selectHole(marker);
    event.preventDefault();
  }
  for(const type of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(type,releasePointer);
  viewport.addEventListener('wheel',event=>{
    if(!crop)return;
    const {x,y}=pointerPosition(event);
    const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?viewport.clientHeight:1);
    adjustZoom(zoom*Math.pow(1.24,-delta/100),x,y);
    event.preventDefault();
  },{passive:false});
  let trayPress=null,traySwipeUntil=0;
  summary.addEventListener('pointerdown',event=>{
    if(event.pointerType!=='touch'||wide)return;
    trayPress={id:event.pointerId,y:event.clientY};
    summary.setPointerCapture(event.pointerId);
  });
  summary.addEventListener('pointerup',event=>{
    if(trayPress?.id===event.pointerId&&Math.abs(event.clientY-trayPress.y)>=18&&!wide){
      detailsOpen=event.clientY<trayPress.y;
      traySwipeUntil=performance.now()+350;
      syncDetails();
      event.preventDefault();
    }
    trayPress=null;
  });
  summary.addEventListener('pointercancel',()=>{trayPress=null;});
  new ResizeObserver(positionMap).observe(viewport);


  function selectedRow(){
    return state.data.rows.find(row=>row.hole===state.data.selected);
  }
  function holeStats(row){
    const number=new Intl.NumberFormat();
    return ['Par '+row.par,number.format(row.yards)+' yds',row.minutes===null?'—':row.minutes+' min'];
  }
  function selectHole(hole){
    if(state?.data?.mode!=='routing'||hole===state.data.selected)return;
    endMove(false);
    send('select',hole);
  }
  function renderRows(data){
    const stamp=JSON.stringify(data.rows);
    if(stamp!==rowStamp){
      rowStamp=stamp;
      rowButtons.clear();
      const rows=new Map(data.rows.map(row=>[row.hole,row]));
      holes.replaceChildren(...slots.map(hole=>{
        const item=element('li'),row=rows.get(hole);
        const control=button(null,'',()=>selectHole(hole));
        control.className='routing-map-row';
        control.dataset.hole=String(hole);
        control.dataset.empty=String(!row);
        control.append(element('strong','', 'Hole '+hole),...(row?holeStats(row):['Empty slot']).map(text=>element('span','',text)));
        rowButtons.set(hole,control);
        item.append(control);
        return item;
      }));
    }
    for(const [hole,control] of rowButtons)
      control.setAttribute('aria-pressed',String(hole===data.selected));
  }
  function renderMarkers(data){
    if(data.mode!=='routing'){
      markerLayer.hidden=true;
      return;
    }
    markerLayer.hidden=false;
    const active=new Set();
    for(const row of data.rows){
      const {hole,points}=row;
      const tee=points[0],flag=points[points.length-1];
      const point=points.length>2?points[1]:{x:(tee.x+flag.x)/2,y:(tee.y+flag.y)/2};
      const x=point.x-crop.x,y=point.y-crop.y;
      if(x<0||x>crop.width||y<0||y>crop.height)continue;
      active.add(hole);
      let marker=markers.get(hole);
      if(!marker){
        const node=button(null,'',()=>selectHole(hole));
        node.className='routing-map-marker';
        node.dataset.hole=String(hole);
        node.setAttribute('aria-label','Select Hole '+hole);
        node.append(element('span','',String(hole)));
        const leader=element('span');
        leader.className='routing-map-marker-leader';
        leader.setAttribute('aria-hidden','true');
        markerLayer.append(leader,node);
        marker={node,leader};
        markers.set(hole,marker);
      }
      marker.x=x;
      marker.y=y;
      marker.node.setAttribute('aria-pressed',String(hole===data.selected));
    }
    for(const [hole,marker] of markers){
      if(active.has(hole))continue;
      marker.node.remove();
      marker.leader.remove();
      markers.delete(hole);
    }
  }
  function renderStaff(data){
    const stamp=JSON.stringify(data.staff);
    if(stamp===staffStamp)return;
    staffStamp=stamp;
    const number=new Intl.NumberFormat();
    const currency=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
    const heap=new Uint32Array(Module.HEAPU8.buffer);
    const entries=data.staff.map(employee=>{
      const item=element('li');
      const month=Module.readGameText(heap[(0x4c2908>>>2)+(employee.hired&7)],32);
      const hired=month+' '+(2001+Math.trunc(employee.hired/8));
      item.append(
        element('strong','',employee.index+'. '+employee.name+' · '+employee.role),
        element('small','','Hired '+hired+' · '+currency.format(employee.paid)+' paid'),
        element('small','',employee.activityLabel+' · '+number.format(employee.activity))
      );
      return item;
    });
    if(!entries.length)entries.push(element('li','','No employees on this course.'));
    staffList.replaceChildren(...entries);
  }
  function renderLegend(mode){
    if(mode===legendMode)return;
    legendMode=mode;
    const aura=mode==='aura';
    const ramp=element('canvas','routing-map-legend-ramp');
    ramp.setAttribute('aria-hidden','true');
    const scale=element('div','routing-map-legend-scale');
    scale.append(element('span','',aura?'Unhappy':'Low'),element('span','',aura?'Happy':'High'));
    const explanation=element('p','',aura?'Course Aura shows where golfers made mostly happy or unhappy comments.':'The map shows where home sites are likely to be worth more or less.');
    legend.replaceChildren(ramp,scale,explanation);
    if(!aura){
      for(const [label,factors] of [
        ['Increases value',['Near water and trees','Near a fun golf hole','Near a Top 100 or Top 18 hole','Building a marina']],
        ['Decreases value',['Near an unfun hole','Near another building','Too close to a green, fairway or out-of-bounds','Far from the golf course']]
      ]){
        const list=element('ul');
        list.append(...factors.map(factor=>element('li','',factor)));
        legend.append(element('h2','',label),list);
      }
    }
  }
  function renderPanels(data){
    const routing=data.mode==='routing',staff=data.mode==='staff';
    const row=routing&&selectedRow();
    summaryTitle.textContent=routing?(row?'Hole '+row.hole:data.rows.length?'Hole '+data.selected:'Course routing'):
      modes.find(([mode])=>mode===data.mode)[1];
    summaryValue.textContent=routing?(row?holeStats(row).join(' · '):data.rows.length?'Empty slot':'No holes routed'):
      staff?(data.staffCount===1?'1 employee':data.staffCount+' employees'):'Map key';
    syncDetails();
    holes.hidden=!routing||!!moveFrom;
    move.hidden=!routing||!data.canMove||!!moveFrom;
    staffList.hidden=!staff;
    staffControls.hidden=!staff||!(data.canPageUp||data.canPageDown);
    legend.hidden=routing||staff;
    if(routing)renderRows(data);
    if(staff)renderStaff(data);
    if(!routing&&!staff)renderLegend(data.mode);
    for(const [mode,control] of viewButtons)
      control.setAttribute('aria-pressed',String(mode===data.mode));
  }

  function beginMove(){
    if(!state?.ready||state.busy||!state.data.canMove||!selectedRow())return;
    moveFrom=state.data.selected;
    moveTitle.textContent='Move Hole '+moveFrom;
    const occupied=new Set(state.data.rows.map(row=>row.hole));
    destination.replaceChildren(element('option','','Choose a hole position'));
    destination.options[0].value='';
    for(const slot of slots){
      if(slot===moveFrom)continue;
      const option=element('option','','Position '+slot+(occupied.has(slot)?'':' · Empty'));
      option.value=String(slot);
      destination.append(option);
    }
    detailsOpen=true;
    movePanel.hidden=false;
    syncDetails();
    renderPanels(state.data);
    updateMovePreview();
    pane.scrollTop=0;
    destination.focus({preventScroll:true});
  }
  function updateMovePreview(){
    const target=Number(destination.value);
    confirmMove.disabled=!target;
    if(!target){
      orderPreview.textContent='Choose where this hole should appear in the course order.';
      return;
    }
    const before=slots.map(slot=>state.data.rows.some(row=>row.hole===slot)?String(slot):'—');
    const after=before.slice();
    after.splice(target-1,0,after.splice(moveFrom-1,1)[0]);
    const first=Math.min(moveFrom,target)-1,last=Math.max(moveFrom,target);
    orderPreview.textContent='Move Hole '+moveFrom+' to position '+target+'. Current holes at positions '+
      (first+1)+'–'+last+' are '+before.slice(first,last).join(' · ')+
      '. New order '+after.slice(first,last).join(' · ')+'.';
  }
  function endMove(focus){
    if(!moveFrom)return;
    moveFrom=0;
    movePanel.hidden=true;
    if(state?.data)renderPanels(state.data);
    if(focus&&!move.hidden)move.focus({preventScroll:true});
  }
  function applyMove(){
    if(!moveFrom||state.data.selected!==moveFrom||!state.data.canMove)return;
    const target=Number(destination.value),from=moveFrom;
    if(!slots.includes(target)||target===from)return;
    const source=selectedRow();
    endMove(false);
    if(send('move',target,from))state.pending.route=JSON.stringify(source.points);
  }

  function drawNativeRegion(target,heap,address,stride,region,mask){
    const {x,y,width,height}=region;
    if(target.width!==width)target.width=width;
    if(target.height!==height)target.height=height;
    const context=target.getContext('2d');
    const pixels=context.createImageData(width,height);
    const rgba=pixels.data;
    let offset=0;
    for(let row=0;row<height;row++){
      const native=(address>>1)+(y+row)*stride+x;
      const dy=(row+.5)*2/height-1;
      for(let col=0;col<width;col++){
        const dx=(col+.5)*2/width-1;
        const visible=mask==='diamond'?Math.abs(dx)+Math.abs(dy)<=1:mask!=='circle'||dx*dx+dy*dy<=1;
        if(!visible){offset+=4;continue;}
        const value=heap[native+col];
        rgba[offset++]=((value>>10)&31)*255/31;
        rgba[offset++]=((value>>5)&31)*255/31;
        rgba[offset++]=(value&31)*255/31;
        rgba[offset++]=255;
      }
    }
    context.putImageData(pixels,0,0);
    return context;
  }
  function drawSelectedRoute(context,row){
    if(!row)return;
    const points=row.points.map(({x,y})=>[x-crop.x,y-crop.y]);
    context.lineCap=context.lineJoin='round';
    context.beginPath();
    context.moveTo(...points[0]);
    for(const point of points.slice(1))context.lineTo(...point);
    context.lineWidth=8;
    context.strokeStyle='#29233c';
    context.stroke();
    context.lineWidth=4;
    context.strokeStyle='#ffe079';
    context.stroke();
    for(const [x,y] of [points[0],points[points.length-1]]){
      context.beginPath();
      context.arc(x,y,5,0,Math.PI*2);
      context.fillStyle='#fff2bc';
      context.fill();
    }
  }

  Module.routingMapQueue=[];
  function syncControls(){
    const blocked=!state.ready||state.busy||state.closing;
    done.disabled=blocked;
    for(const [mode,control] of viewButtons)
      control.disabled=blocked||mode===state.data?.mode;
    for(const control of rowButtons.values())control.disabled=blocked;
    for(const {node} of markers.values())node.disabled=blocked;
    move.disabled=blocked||!state.data?.canMove;
    staffPrev.disabled=blocked||!state.data?.canPageUp;
    staffNext.disabled=blocked||!state.data?.canPageDown;
  }
  function send(op,value=0,source=0){
    if(!state?.ready||state.busy||state.closing||Module.routingMapQueue.length)return false;
    const pending={op,value,source};
    state.pending=pending;
    state.busy=true;
    syncControls();
    Module.routingMapQueue.push([state.serial,op,value,source]);
    const serial=state.serial;
    setTimeout(()=>{
      if(state?.serial!==serial||state.pending!==pending||state.closing)return;
      Module.routingMapQueue.length=0;
      state.pending=null;
      state.busy=false;
      syncControls();
    },1400);
    return true;
  }
  function dismiss(){
    endMove(false);
    if(send('done'))Module.guardLoadingExit?.();
  }
  function closeNow(){
    if(root.open)root.close();
    root.hidden=true;
    document.body.classList.remove('mobile-routing-open');
    Module.routingMapQueue.length=0;
    Module.routingMap=state=null;
    crop=null;
    pointers.clear();
    rebaseGesture();
    Module.refreshCanvasPresentation?.();
    if(returnFocus?.getClientRects().length&&getComputedStyle(returnFocus).visibility==='visible')
      returnFocus.focus({preventScroll:true});
    returnFocus=null;
  }

  Module.beginRoutingMap=function(serial){
    if(root.open||state)return false;
    Module.cancelMapGesture?.();
    returnFocus=document.activeElement;
    state={serial,active:true,ready:false,busy:false,closing:false,data:null,zoom:1};
    Module.routingMap=state;
    Module.routingMapQueue.length=0;
    detailsOpen=false;
    moveFrom=0;
    traySwipeUntil=0;
    movePanel.hidden=true;
    content.hidden=true;
    views.hidden=true;
    status.hidden=false;
    status.textContent='Opening Routing Map…';
    course.textContent='';
    rowStamp=staffStamp=legendMode='';
    crop=null;
    savedCompass=false;
    pointers.clear();
    rebaseGesture();
    pane.scrollTop=0;
    // Show the browser modal synchronously, before the engine presents 800×600.
    root.hidden=false;
    try{root.showModal();}
    catch{root.hidden=true;Module.routingMap=state=null;return false;}
    document.body.classList.add('mobile-routing-open');
    syncControls();
    bounds();
    return true;
  };
  Module.renderRoutingMap=function(serial,address,byteStride,data){
    if(state?.serial!==serial||state.closing)return false;
    const region=data.crop;
    if(!region||address<=0||address%2||byteStride%2||byteStride<1600||
       region.x<0||region.y<0||region.width<=0||region.height<=0||
       region.x+region.width>800||region.y+region.height>600||
       address+599*byteStride+1600>Module.HEAPU8.byteLength)return false;
    const previousMode=state.data?.mode;
    try{
      const heap=new Uint16Array(Module.HEAPU8.buffer);
      const context=drawNativeRegion(canvas,heap,address,byteStride/2,region,'diamond');
      if(!savedCompass){
        drawNativeRegion(compass,heap,address,byteStride/2,{x:71,y:533,width:72,height:65},'circle');
        savedCompass=true;
      }
      const first=!state.ready;
      state.data=data;
      crop=region;
      if(data.mode==='routing')drawSelectedRoute(context,selectedRow());
      const pending=Module.routingMapQueue.length?null:state.pending;
      if(pending){state.pending=null;state.busy=false;}
      state.ready=true;
      if(previousMode!==data.mode){
        endMove(false);
        pane.scrollTop=0;
      }
      renderPanels(data);
      if(data.mode==='aura'||data.mode==='values'){
        const ramp=legend.querySelector('#routing-map-legend-ramp');
        drawNativeRegion(ramp,heap,address,byteStride/2,{x:198,y:219,width:404,height:5});
      }
      renderMarkers(data);
      syncControls();
      course.textContent=data.title;
      status.hidden=true;
      views.hidden=false;
      content.hidden=false;
      if(first){resetFit();done.focus({preventScroll:true});}
      else positionMap();
      if(pending?.op==='move'&&data.rows.some(row=>row.hole===pending.value&&JSON.stringify(row.points)===pending.route))
        send('select',pending.value);
      return true;
    }catch(error){
      state.error=String(error);
      Module.routingMapError=state.error;
      return false;
    }
  };
  Module.suspendRoutingMap=function(serial){
    if(state?.serial===serial)closeNow();
  };
  Module.endRoutingMap=function(serial){
    if(state?.serial!==serial)return;
    const beforePresent=Module.panVisual?.presentSerial||0;
    const started=performance.now();
    state.closing=true;
    syncControls();
    function waitForCourse(now){
      if(state?.serial!==serial)return;
      if(now-started<300||(!Module.mobileCourseFrameReady?.(beforePresent)&&now-started<1200)){
        requestAnimationFrame(waitForCourse);
        return;
      }
      closeNow();
    }
    requestAnimationFrame(waitForCourse);
  };
  root.addEventListener('cancel',event=>{
    event.preventDefault();
    if(moveFrom)endMove(true);
    else dismiss();
  });
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel','mousedown','mousemove',
    'mouseup','click','dblclick','touchstart','touchmove','touchend','touchcancel','wheel','keydown','keyup','keypress'])
    root.addEventListener(type,event=>event.stopPropagation());
  for(const event of ['resize','simgolf-screen-resize','simgolf-header-resize'])addEventListener(event,bounds);
  window.visualViewport?.addEventListener('resize',bounds);
  window.visualViewport?.addEventListener('scroll',bounds);
})();
