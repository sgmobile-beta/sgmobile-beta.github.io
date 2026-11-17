(function(){
  'use strict';
  if(!Module.mobileMap)return;
  const feature='holeBoundaries',side=50,total=side*side,bytes=Math.ceil(total/8),terrain=0x5722e8;
  const empty=()=>new Uint8Array(bytes);
  const tile=(x,y)=>x*side+y;
  const owned=index=>HEAPU8[terrain+index]!==20;
  const has=(mask,index)=>!!(mask[index>>3]&(1<<(index&7)));
  const encode=mask=>btoa(String.fromCharCode(...mask));
  const decode=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
  const blank=()=>({holes:{}});
  const eligibleHole=n=>Number.isInteger(n)&&n>=1&&n<=18;
  const allowed=()=>Module.hasGameFeature(feature);
  const coords=n=>Number.isInteger(n)&&n>=0&&n<side;
  const readAnchors=hole=>{
    const a=0x575ab0+hole*520;
    const par=HEAPU8[a], [tx,ty,mx,my,gx,gy]=HEAP32.subarray((a+8)>>2,(a+32)>>2);
    if(par<2||par>6||!tx||!gx||![tx,ty,mx,my,gx,gy].every(coords))return null;
    return [par,tx,ty,mx,my,gx,gy];
  };
  // Native events can change par without moving the boundary's layout.
  const sameLayout=(a,b)=>!!a&&a.slice(1).every((n,i)=>n===b[i+1]);
  const anchors=(route)=>{
    const [,tx,ty,mx,my,gx,gy]=route;
    return [tile(tx,ty),tile(gx,gy),...(mx||my?[tile(mx,my)]:[])];
  };
  function validate(data){
    if(Object.keys(data).length===0)return true;
    if(Object.keys(data).length!==1||!data.holes||typeof data.holes!=='object'||Array.isArray(data.holes))return false;
    return Object.entries(data.holes).every(([key,row])=>{
      if(!eligibleHole(Number(key))||String(Number(key))!==key||!row||Object.keys(row).length!==2||
          !Array.isArray(row.route)||row.route.length!==7||!Number.isInteger(row.route[0])||row.route[0]<2||
          row.route[0]>6||!row.route.slice(1).every(coords)||!row.route[1]||!row.route[5]||
          typeof row.mask!=='string'||row.mask.length!==Math.ceil(bytes/3)*4)return false;
      try{
        const mask=decode(row.mask);
        return mask.length===bytes&&encode(mask)===row.mask&&mask[bytes-1]<16&&anchors(row.route).every(i=>has(mask,i));
      }catch{return false;}
    });
  }
  let state=blank(),published=new Map(),editor=null,returnView=null,restoreFrame=0,redrawFrame=0,draftRevision=0,applyTimer=0,routeTimer=0,routeSerial=0;
  const readTiles=mask=>{
    const selected=[];
    for(let i=0;i<total;i++)if(has(mask,i))selected.push(i);
    return selected;
  };
  const neighbors=[[-1,0],[1,0],[0,-1],[0,1]];
  function validateDraft(route,mask){
    const required=anchors(route),selected=readTiles(mask);
    if(!required.every(i=>has(mask,i)))return 'Include the tee, any alternate tee, and the green and flag.';
    if(selected.some(i=>!owned(i)))return 'Remove tiles outside your property.';
    if(!selected.some(i=>!required.includes(i)&&![10,17].includes(HEAPU8[terrain+i])))
      return 'Paint some playable ground between the tee and green.';
    const pending=[required[0]],seen=new Set(pending);
    for(let i=0;i<pending.length;i++){
      const n=pending[i],x=Math.floor(n/side),y=n%side;
      for(const [dx,dy] of neighbors){
        const a=x+dx,b=y+dy,k=tile(a,b);
        if(coords(a)&&coords(b)&&has(mask,k)&&!seen.has(k)){seen.add(k);pending.push(k);}
      }
    }
    return seen.size===selected.length?'':'Connect the painted tiles so they form one playing area.';
  }
  function publish(hole,row){
    if(row){
      const ptr=Module._port_golf_boundary_staging();
      HEAPU8.set(decode(row.mask),ptr);
      Module._port_golf_boundary_publish(hole,1);
      published.set(hole,row);
    }else{
      Module._port_golf_boundary_publish(hole,0);
      published.delete(hole);
    }
  }
  function reset(){
    if(Module._port_golf_boundary_publish)Module._port_golf_boundary_publish(0,0);
    published.clear();
  }
  // At an exact native load, restore masks that were already active in that
  // save before its actors resume. A mask newly enabled in preview is applied
  // once the hole is idle. Purchased tiles start outside the saved mask.
  function reconcile(resume=false){
    if(!allowed()||!Module._port_golf_boundary_busy||
        (!resume&&(!Module.mapCourseReady||Module.courseLoading?.active||Module.atTitle)))return;
    for(const [key,row] of Object.entries(state.holes)){
      const hole=Number(key);
      if(published.get(hole)===row||!sameLayout(readAnchors(hole),row.route)||(!resume&&Module._port_golf_boundary_busy(hole)))continue;
      if(!validateDraft(row.route,decode(row.mask)))publish(hole,row);
    }
  }
  Module.holeBoundarySettingsBusy=()=>[...published.keys()].some(hole=>Module._port_golf_boundary_busy(hole));
  Module.saveRules.register(feature,{
    validate,
    prepare:data=>data.holes?data:blank(),
    activate(data,context){
      state=data;
      if(context?.savedFeatures[feature]?.enabled)reconcile(true);
    },
    capture:()=>state,
    dispose:()=>{close(false);reset();state=blank();}
  });

  const node=(tag,text='')=>{const e=document.createElement(tag);e.textContent=text;return e;};
  const button=(label,run)=>{
    const control=node('button',label);control.type='button';control.onclick=run;return control;
  };
  const panel=node('section');panel.id='hole-boundaries-editor';panel.hidden=true;
  panel.setAttribute('aria-label','Hole Boundaries');
  const title=node('h2','Hole Boundaries'),status=node('p'),message=node('p');
  message.setAttribute('role','status');
  const list=node('select'),label=node('label','Choose hole');list.id='boundary-hole';label.htmlFor=list.id;
  const heading=node('header'),selection=node('div'),modes=node('div');
  modes.className='boundary-buttons';
  modes.setAttribute('aria-label','Boundary tools');
  const clearConfirm=node('dialog');clearConfirm.id='hole-boundaries-confirm';
  const confirmation=node('h2');confirmation.id='hole-boundaries-confirm-title';
  clearConfirm.setAttribute('aria-labelledby',confirmation.id);
  const cancelClear=button('Keep boundary',()=>clearConfirm.close());
  const clearYes=button('Reset',()=>{clearConfirm.close();apply(true);});
  clearConfirm.append(confirmation,cancelClear,clearYes);
  const paint=button('Paint Boundary',()=>setTool('paint')),
    erase=button('Remove Boundary',()=>setTool('erase')),
    toggle=button('Hide Boundary',()=>{
      editor.view=editor.view==='hidden'?'selected':'hidden';refresh();redraw();
    }),
    showAll=button('Show All Boundaries',()=>{
      editor.view=editor.view==='all'?'selected':'all';refresh();redraw();
    }),
    save=button('Save',()=>apply(false)),
    clear=button('Reset',()=>{
      confirmation.textContent='Reset the boundary for Hole '+editor.hole+'?';
      clearConfirm.showModal();
    });
  heading.append(title,save);
  selection.append(label,list,status);
  modes.append(paint,erase,showAll,toggle,clear);
  panel.append(heading,selection,modes,message);
  document.body.append(panel,clearConfirm);
  const style=node('style');
  style.textContent=`
    #hole-boundaries-editor[hidden]{display:none!important}
    .hole-boundaries-open :is(#mobile-ui > :not(#mobile-course-dock),#mobile-mode-rail,#mobile-open-hole,#map-aim-reticle){visibility:hidden}
    .hole-boundaries-open :is(#mobile-camera button,#mobile-cancel){background:var(--menu-button)}
    .hole-boundaries-open #mobile-camera{--menu-button:#e1e1f3;--menu-selected:#c3cef6;--mobile-surface:var(--menu-button)}
    .hole-boundaries-open #mobile-ui #mobile-pan[aria-pressed="true"]{background:var(--menu-selected)}
    #hole-boundaries-editor,#hole-boundaries-confirm{box-sizing:border-box;padding:10px;border:1px solid var(--menu-border);border-radius:10px;background:var(--menu-panel);color:var(--menu-text);font:14px/1.3 system-ui,sans-serif}
    #hole-boundaries-editor{position:fixed;z-index:90;width:min(480px,100%);background:rgba(199,199,231,.4);overscroll-behavior:contain;overflow:auto}
    #hole-boundaries-editor header,#hole-boundaries-editor header + div{display:flex;align-items:center;gap:6px}
    #hole-boundaries-editor header{justify-content:space-between;margin-bottom:4px}
    #hole-boundaries-editor header + div{flex-wrap:wrap}
    #hole-boundaries-editor :is(h2,label,p){width:fit-content;padding:2px 5px;border-radius:4px;background:var(--menu-button)}
    #hole-boundaries-editor header h2{margin:0}
    #hole-boundaries-editor header button{flex:none}
    #hole-boundaries-editor h2,#hole-boundaries-confirm h2{font-size:17px;margin:0 0 4px}
    #hole-boundaries-editor p{margin:4px 0}
    #hole-boundaries-editor p:empty{display:none}
    .boundary-buttons{display:flex;gap:6px;margin-top:6px;overflow-x:auto;overscroll-behavior-x:contain;touch-action:pan-x;padding-bottom:3px}
    #hole-boundaries-editor :is(button,select),#hole-boundaries-confirm button{min-height:44px;padding:5px 9px;font:inherit;border:1px solid var(--menu-border);border-radius:7px;background:var(--menu-button);color:inherit;touch-action:manipulation}
    .boundary-buttons button{flex:none;white-space:nowrap}
    #hole-boundaries-editor .boundary-buttons button{touch-action:pan-x}
    #hole-boundaries-editor :is(button,select):focus-visible{outline:2px solid var(--menu-focus);outline-offset:-3px}
    #hole-boundaries-editor button[aria-pressed="true"]{background:var(--menu-selected);font-weight:650}
    #hole-boundaries-editor button:disabled{opacity:.5}
    #hole-boundaries-confirm{max-width:calc(100% - 2rem)}
    #hole-boundaries-confirm::backdrop{background:#161c375c}
  `;
  document.head.append(style);
  for(const root of [panel,clearConfirm])for(const type of ['pointerdown','pointermove','pointerup','mousedown','mouseup','click','touchstart','touchmove','touchend','keydown','keyup','keypress'])
    root.addEventListener(type,e=>e.stopPropagation());
  const quiet=()=>!!(allowed()&&Module.mobileUI&&Module.mapCourseReady&&Module.mobileState?.course&&
    !Module.mobileState.photoActive&&
    !Module.mobileState.fundsCheck&&!Module.mobileState.textInput&&!Module.loadState?.active&&!Module.atTitle&&
    !Module.courseLoading?.active&&!Module.holeStats?.active&&!Module.progressScreen?.active&&!Module.profileState?.active&&
    !Module.elevationOverviewOpen&&!Module.analyticsActive);
  function layout(){
    if(!editor)return;
    const b=Module.getScreenBounds();
    panel.style.left=b.left+b.safe.left+8+'px';
    panel.style.bottom=innerHeight-b.top-b.height+Math.max(8,b.safe.bottom)+56+'px';
    panel.style.maxWidth=b.width-b.safe.left-b.safe.right-16+'px';
    panel.style.maxHeight=Math.max(105,(b.height-b.safe.top-b.safe.bottom)*.55)+'px';
  }
  function redraw(){
    Module.boundaryPaintRevision=++draftRevision;
    if(!redrawFrame)redrawFrame=requestAnimationFrame(()=>{
      redrawFrame=0;Module.applySmoothPan?.();
    });
  }
  function finishClose(aim){
    cancelAnimationFrame(restoreFrame);restoreFrame=0;returnView=null;
    Module.boundaryCameraRequest=null;Module.holeBoundariesEditorOpen=false;
    document.body.classList.remove('hole-boundaries-open');
    if(aim)Module.setAimTarget(aim.x,aim.y);
    Module.refreshAimReticle?.();Module.refreshBoundaryControls?.();
  }
  function restoreRoundView(){
    const saved=returnView,frame=Module.panVisual?.frame;
    if(!quiet()||!Module.mobileState.shotTurn||saved.turn!==Module.mobileState.turnSerial){
      finishClose();return;
    }
    if(performance.now()>saved.deadline){finishClose();if(saved.aim)Module.setAimMode(true);return;}
    if(frame?.valid){
      if(frame.rotation!==saved.rotation){
        if(saved.lastRotation!==frame.rotation){
          saved.lastRotation=frame.rotation;
          Module.boundaryCameraRequest={rotate:36};
        }
      }else if(!Module.mapPresentation.zooming){
        if(frame.x!==saved.x||frame.y!==saved.y){
          Module.boundaryCameraRequest={x:saved.x,y:saved.y,rotation:saved.rotation};
        }else{
          const ratio=frame.zoom/saved.nativeZoom,aim=saved.aim;
          finishClose(aim&&Module.aimMode?{
            x:frame.width/2+(aim.x-saved.width/2)*ratio,
            y:frame.height/2+(aim.y-saved.height/2)*ratio
          }:null);
          return;
        }
      }
    }
    restoreFrame=requestAnimationFrame(restoreRoundView);
  }
  function close(restore=true){
    if(!editor){if(!restore&&returnView)finishClose();return;}
    const saved=editor.shotView;
    editor=null;clearTimeout(applyTimer);applyTimer=0;
    if(clearConfirm.open)clearConfirm.close();
    panel.hidden=true;Module.boundaryCameraRequest=null;
    clearTimeout(routeTimer);Module.boundaryRouteRequest=null;Module.boundaryRoutePreview=null;
    Module.cancelMapGesture();redraw();
    if(!restore||!saved||!quiet()||saved.turn!==Module.mobileState.turnSerial){finishClose();return;}
    returnView={...saved,deadline:performance.now()+5000};
    if(Module.mapPresentation.zoom!==saved.zoom)Module.setMapZoom(saved.zoom);
    restoreRoundView();
  }
  function refresh(){
    const {hole,tool,view}=editor,row=state.holes[hole];
    title.textContent='Hole '+hole+' Boundaries';
    status.textContent=row?(sameLayout(readAnchors(hole),row.route)?'Saved boundary':'Layout changed. Repaint the boundary.'):'No saved boundary';
    paint.setAttribute('aria-pressed',String(tool==='paint'));
    erase.setAttribute('aria-pressed',String(tool==='erase'));
    showAll.setAttribute('aria-pressed',String(view==='all'));
    toggle.textContent=view==='hidden'?'Show Boundary':'Hide Boundary';
    const waiting=editor.pending!==null;
    clear.disabled=waiting||!row&&!editor.mask.some(Boolean);
    list.disabled=paint.disabled=erase.disabled=save.disabled=waiting;
    layout();Module.refreshBoundaryControls?.();
  }
  function focusHole(){
    const frame=Module.panVisual?.frame||Module.panVisual?.pixelFrame;
    if(!frame?.valid)return;
    const [,tx,ty,,,gx,gy]=editor.route,rect=panel.getBoundingClientRect(),b=Module.getScreenBounds();
    const left=b.left+b.safe.left,right=b.left+b.width-b.safe.right;
    const top=Math.max(b.top+b.safe.top,Module.headerHeight());
    const scale=(Module.canvasScale||1)*frame.zoom/4;
    const origin={x:(tx+gx)/2,y:(ty+gy)/2,rotation:frame.rotation};
    const camera=Module.mapCameraGeometry.cameraFor(
      (left+right)/2-(b.left+b.width/2),
      (top+rect.top)/2-(b.top+b.height/2),origin,scale);
    Module.boundaryCameraRequest={x:Math.round(camera.x),y:Math.round(camera.y),rotation:frame.rotation};
  }
  function select(hole,focus=true){
    const route=readAnchors(hole);
    if(!route)return;
    const row=state.holes[hole];
    Object.assign(editor,{hole,route,mask:row&&sameLayout(route,row.route)?decode(row.mask):empty(),pending:null});
    list.value=String(hole);message.textContent='';
    Module.boundaryRoutePreview=null;
    Module.cancelMapGesture();refresh();redraw();requestRoute();if(focus)focusHole();
  }
  function setTool(tool){
    if(!editor)return;
    Module.cancelMapGesture();editor.tool=tool;
    if(tool!=='pan'){
      editor.brush=tool;
      if(editor.view==='hidden'){editor.view='selected';redraw();}
    }
    refresh();
  }
  function requestRoute(delay=0){
    clearTimeout(routeTimer);
    const serial=++routeSerial,hole=editor.hole;
    Module.boundaryRouteRequest=null;
    const queue=()=>{
      if(editor?.hole!==hole||serial!==routeSerial)return;
      const hasDraft=editor.mask.some(Boolean);
      const mask=hasDraft&&!validateDraft(editor.route,editor.mask)?editor.mask.slice():null;
      Module.boundaryRouteRequest={hole,serial,mask};
    };
    if(delay)routeTimer=setTimeout(queue,delay);
    else queue();
  }
  Module.receiveBoundaryRoute=(hole,serial,originalPtr,originalCount,adjustedPtr,adjustedCount)=>{
    if(editor?.hole!==hole||serial!==routeSerial)return;
    const read=(ptr,count)=>Array.from({length:count},(_,i)=>tile(HEAP32[(ptr>>2)+i*2],HEAP32[(ptr>>2)+i*2+1]));
    const original=read(originalPtr,originalCount),adjusted=read(adjustedPtr,adjustedCount);
    Module.boundaryRoutePreview={hole,original,adjusted};
    redraw();
  };
  function apply(removing){
    if(!editor||!quiet())return;
    const {hole,route,mask}=editor;
    editor.pending=null;
    if(!sameLayout(readAnchors(hole),route)){
      message.textContent='The hole layout changed. Select the hole again.';refresh();return;
    }
    const error=removing?'':validateDraft(route,mask);
    if(error){message.textContent=error;refresh();return;}
    if(Module._port_golf_boundary_busy(hole)){
      editor.pending=removing;
      message.textContent='Waiting for shots to finish. This boundary will update automatically.';
      refresh();
      applyTimer=setTimeout(finishPending,50);
      return;
    }
    if(removing){delete state.holes[hole];publish(hole,null);select(hole,false);}
    else{
      const row={route,mask:encode(mask)};
      state.holes[hole]=row;publish(hole,row);
    }
    message.textContent=removing?'Boundary reset. Save your game to keep this change.':'Boundary saved. Save your game to keep it.';
    refresh();
  }
  function finishPending(){
    applyTimer=0;
    if(!editor||editor.pending===null)return;
    if(!quiet()){close();return;}
    if(Module._port_golf_boundary_busy(editor.hole)){
      applyTimer=setTimeout(finishPending,50);
      return;
    }
    apply(editor.pending);
  }
  list.onchange=()=>select(Number(list.value));
  Module.canOpenHoleBoundaries=()=>quiet()&&!Module.holeBoundariesEditorOpen&&!Module.shotPending;
  Module.openHoleBoundaries=()=>{
    if(!Module.canOpenHoleBoundaries())return false;
    const holes=Array.from({length:18},(_,i)=>i+1).filter(h=>readAnchors(h));
    if(!holes.length)return false;
    const f=Module.panVisual?.frame,s=Module.mobileState;
    const shotView=s.shotTurn&&f?.valid?{x:f.x,y:f.y,rotation:f.rotation,
      width:f.width,height:f.height,zoom:Module.mapPresentation.zoom,nativeZoom:f.zoom,
      turn:s.turnSerial,aim:Module.aimMode&&Module.aimTarget?{...Module.aimTarget}:null}:null;
    editor={tool:'paint',brush:'paint',view:'selected',shotView};
    list.replaceChildren(...holes.map(h=>{const option=node('option','Hole '+h);option.value=h;return option;}));
    panel.hidden=false;Module.holeBoundariesEditorOpen=true;document.body.classList.add('hole-boundaries-open');
    const current=Module.isPracticingHole?.()?Module.practiceHole?.hole:null;
    select(holes.includes(current)?current:holes[0]);return true;
  };
  Module.closeHoleBoundaries=()=>close();
  Module.toggleHoleBoundaryPan=()=>{if(editor)setTool(editor.tool==='pan'?editor.brush:'pan');};
  Module.holeBoundaryTool=()=>editor&&quiet()&&!clearConfirm.open?editor.tool:null;
  let drawn=null;
  Module.captureBoundaryFrame=frame=>editor&&quiet()&&frame.valid?Module.getProjectedCourseGrid?.(frame):null;
  const colors=['#57dfaa','#f6c85c','#82b7ff','#f588aa','#c7a5fa','#ff9c65','#a9d854','#56d4e7','#f8df94'];
  Module.paintBoundaryFrame=(g,frame,b,r)=>{
    if(!editor||!frame.boundary||!quiet())return;

    // Share the Elevation Map projection. Cache overlay paths per draft and camera.
    if(drawn?.grid!==frame.boundary||drawn.revision!==draftRevision){
      const all=editor.view==='all',outside=new Path2D();
      const masks=all?Object.entries(state.holes).flatMap(([key,row])=>{
        const hole=Number(key);
        return hole!==editor.hole&&sameLayout(readAnchors(hole),row.route)?[{hole,mask:decode(row.mask)}]:[];
      }):[];
      masks.push({hole:editor.hole,mask:editor.mask});
      const layers=masks.map(({hole,mask})=>({mask,path:new Path2D(),color:all?colors[(hole-1)%colors.length]:'#71f0bf'}));
      function add(path,points){
        path.moveTo(...points[0]);
        for(let j=1;j<points.length;j++)path.lineTo(...points[j]);
        path.closePath();
      }
      const preview=Module.boundaryRoutePreview;
      const changed=preview?.adjusted.length&&preview.adjusted.join(',')!==preview.original.join(',');
      const guide=changed?preview.adjusted:preview?.original||[];
      const flag=anchors(editor.route)[1],complete=guide.at(-1)===flag;
      const centers=new Map(),waypoints=new Set(guide);
      for(const {x,y,points,cy} of frame.boundary.tiles){
        const i=tile(x,y);
        if(waypoints.has(i))centers.set(i,[points.reduce((sum,p)=>sum+p[0],0)/points.length,cy]);
        for(const layer of layers)if(has(layer.mask,i))add(layer.path,points);
        if(!all&&!has(editor.mask,i))add(outside,points);
      }
      const line=new Path2D(),points=guide.map(i=>centers.get(i));
      if(points.length>=2&&points.every(Boolean)){
        line.moveTo(...points[0]);
        for(const point of points.slice(1))line.lineTo(...point);
      }
      drawn={grid:frame.boundary,revision:draftRevision,layers,outside,all,line,changed,complete};
    }
    g.save();g.translate(r.left-b.left,r.top-b.top);g.scale(r.width/frame.width,r.height/frame.height);
    if(editor.view!=='hidden'){
      if(!drawn.all){g.fillStyle='#dc6b552b';g.fill(drawn.outside);}
      g.lineWidth=1.3;
      for(const {path,color} of drawn.layers){
        g.fillStyle=color+'47';g.fill(path);g.strokeStyle=color+'cc';g.stroke(path);
      }
    }
    g.lineJoin='round';g.lineCap='round';g.setLineDash(drawn.changed&&!drawn.complete?[5,5]:[]);
    g.lineWidth=4;g.strokeStyle='#272929bc';g.stroke(drawn.line);
    g.lineWidth=2;g.strokeStyle=drawn.changed?'#fff278':'#fff';g.stroke(drawn.line);
    g.restore();
  };
  function contains(points,x,y){
    let result=false;
    for(let i=0,j=3;i<4;j=i++){
      const [a,b]=points[i],[c,d]=points[j];
      if((b>y)!==(d>y)&&x<a+(c-a)*(y-b)/(d-b))result=!result;
    }
    return result;
  }
  Module.paintHoleBoundary=(x,y,frame,visited)=>{
    if(!editor||editor.pending!==null||editor.tool==='pan'||!quiet()||!frame?.boundary)return;
    const cells=frame.boundary.tiles;
    for(let n=cells.length-1;n>=0;n--){
      const cell=cells[n],i=tile(cell.x,cell.y);
      if(!owned(i)||Math.abs(x-cell.cx)>frame.zoom*15||!contains(cell.points,x,y))continue;
      if(!visited.has(i)){
        visited.add(i);
        const painting=editor.tool==='paint';
        if(has(editor.mask,i)===painting)break;
        const bit=1<<(i&7);
        if(painting)editor.mask[i>>3]|=bit;
        else editor.mask[i>>3]&=~bit;
        if(message.textContent)message.textContent='';
        if(Module.boundaryRoutePreview)Module.boundaryRoutePreview.adjusted=[];
        clear.disabled=!state.holes[editor.hole]&&!editor.mask.some(Boolean);
        redraw();requestRoute(220);
      }
      break;
    }
  };
  addEventListener('simgolf-screen-resize',layout);
  addEventListener('simgolf-ruleset-change',()=>{
    if(!allowed())close(false);
  });
  addEventListener('keydown',e=>{
    if(!editor||e.target.closest?.('#hole-boundaries-confirm'))return;
    if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}
    else if(!e.target.closest?.('#hole-boundaries-editor,#mobile-course-dock,#mobile-cancel'))e.stopImmediatePropagation();
  },true);
  setInterval(()=>{if(editor&&!quiet())close(false);reconcile();},250);
})();
