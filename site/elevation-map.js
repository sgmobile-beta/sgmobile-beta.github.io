(function(){
  'use strict';
  if(!Module.mobileMap)return;

  const feature='elevationMap',side=50,voidTile=20;
  const palette=['#86bd67','#91cb55','#79b04d','#9ebd6d','#5e9347','#4a773a','#d7c8a9','#edddb6','#c5b48d','#d3bf9a','#65b8c0','#4b793d','#9a9c8b','#4a813f','#356d3a','#3e864e','#497c44','#67b6c1','#699650','#779b59','#ddd8e6','#786f5a','#aca18a'];
  const colours=['#285ec3','#559fdf','#72c9ca','#edca67','#e89436','#b45456'];
  const element=(tag,id,text)=>{
    const node=document.createElement(tag);
    if(id)node.id=id;
    if(text)node.textContent=text;
    return node;
  };
  const button=(id,text,action)=>{
    const node=element('button',id,text);
    node.type='button';
    node.onclick=action;
    return node;
  };
  const allowed=()=>!!Module.hasGameFeature(feature);
  const courseVisible=()=>!!(Module.mobileUI&&Module.mobileState?.course&&Module.mapCourseReady&&
    !Module.atTitle&&!Module.uiPresentation&&!Module.mobileState.photoActive&&!Module.courseLoading?.active&&
    !Module.rulesetBlocked&&!Module.holeStats?.active&&!Module.analyticsSession?.active);
  const int=address=>HEAP32[address>>2];
  const u8=address=>HEAPU8[address];
  const terrainSample=new Uint8Array(side*side*5);
  let snapshot=null,sampledAt=0,mesh=null,overviewTiles=[],selected=null,returnToCourse=null;
  let live=false,tinted=false,timer=0,escaped=false;

  // Terrain.dll's rendered tile mirror stores four original corner heights.
  // Golf's logical grid has a datum of 3. These counters are already relative
  // to that datum and include the original edge and special-terrain rules.
  function observeTerrain(force=false){
    const terrain=int(0x820ed0),heightScale=int(0x4c2e00);
    if(!terrain||terrain+0x164ad0>HEAPU8.length||int(terrain+0x14)!==side||int(terrain+0x18)!==side||heightScale<1||heightScale>32)return null;
    const first=terrain+0x3a4,previous=snapshot?.terrain===terrain?snapshot:null;
    const now=performance.now(),data=terrainSample;
    if(!force&&previous?.heightScale===heightScale&&now-sampledAt<80)return previous;
    sampledAt=now;
    let changed=!previous||previous.heightScale!==heightScale,min=Infinity,max=-Infinity,owned=0;
    for(let y=0;y<side;y++)for(let x=0;x<side;x++){
      const i=y*side+x,tile=first+i*0x248,at=i*5;
      const type=int(tile+0x24);
      if(type<0||type>=palette.length)return null;
      data[at]=type;
      for(let c=0;c<4;c++){
        // Native corner order (0,0), (1,0), (1,1), (0,1) = 7,1,3,5.
        const height=int(tile+4+((c+3)%4)*8);
        if(height<0||height>12)return null;
        data[at+c+1]=height;
        if(type!==voidTile){min=Math.min(min,height);max=Math.max(max,height);}
      }
      if(type!==voidTile)owned++;
      if(!changed)for(let c=0;c<5;c++)if(data[at+c]!==previous.data[at+c]){changed=true;break;}
    }
    if(!owned)return null;
    if(changed)snapshot={terrain,heightScale,min,max,data:data.slice(),owned};
    return snapshot;
  }

  // Same corner projection as original FUN_0042fb90. Use the camera and zoom
  // belonging to the presented pixels, including a held or scaled map frame.
  function project(frame,x,y,height,heightScale){
    const {width,height:screenHeight,zoom,rotation}=frame;
    let a=((x-frame.x)*8-4)*zoom,b=((y-frame.y)*8-4)*zoom;
    if(width===1024){a=Math.trunc(a*80/64);b=Math.trunc(b*52/40);}
    if(width===1280){a=Math.trunc(a*104/64);b=Math.trunc(b*68/40);}
    const ax=Math.trunc(a*20/32),by=Math.trunc(b*20/32);
    const ox=Math.trunc(width/2),oy=Math.trunc(screenHeight/2)-Math.trunc(heightScale*zoom*height/4);
    switch(rotation){
      case 2:return [ox-a+b,oy-ax-by-zoom*5];
      case 4:return [ox-zoom*8-b-a,oy+ax-by];
      case 6:return [ox-b+a,oy+ax+by+zoom*5];
      default:return [ox+zoom*8+b+a,oy+by-ax];
    }
  }
  function tilesFor(data,frame,includeVoid){
    const tiles=[];
    for(let y=0;y<side;y++)for(let x=0;x<side;x++){
      const at=(y*side+x)*5,type=data.data[at];
      if(!includeVoid&&type===voidTile)continue;
      const heights=Array.from(data.data.subarray(at+1,at+5));
      const points=heights.map((h,c)=>project(frame,x+(c===1||c===2?1:0),y+(c>=2?1:0),h,data.heightScale));
      const [cx,depth]=project(frame,x+.5,y+.5,0,data.heightScale);
      const cy=points.reduce((sum,p)=>sum+p[1],0)/4;
      const mean=heights.reduce((sum,h)=>sum+h,0)/4;
      tiles.push({x,y,type,points,heights,cx,cy,depth,mean});
    }
    return tiles.sort((a,b)=>a.depth-b.depth||a.cx-b.cx);
  }
  function trace(g,points){
    g.beginPath();
    g.moveTo(...points[0]);
    for(let i=1;i<points.length;i++)g.lineTo(...points[i]);
    g.closePath();
  }
  function tint(g,tile,data){
    const fraction=data.max===data.min ? .5 : (tile.mean-data.min)/(data.max-data.min);
    const index=Math.round(Math.max(0,Math.min(1,fraction))*(colours.length-1));
    g.fillStyle=colours[index];
    g.globalAlpha=.48;
    g.fill();
    g.globalAlpha=1;
  }
  function level(n){return n>0?'+'+n:String(n);}
  function fillLegend(legend,data){
    const [low,high]=legend.children;
    low.textContent=data.min===data.max?'Flat · '+level(data.min):'Low '+level(data.min);
    high.textContent=data.min===data.max?'':'High '+level(data.max);
    legend.dataset.flat=String(data.min===data.max);
    legend.setAttribute('aria-label','Original height steps from '+level(data.min)+' to '+level(data.max));
  }

  const css=element('style');
  css.textContent=`
    #elevation-overview,#elevation-live{box-sizing:border-box;color:var(--menu-text);font:14px/1.35 system-ui,sans-serif;border:1px solid var(--menu-border);border-radius:14px;background:var(--menu-bg)}
    #elevation-overview:not([open]),#elevation-live[hidden],#elevation-overview [hidden],#elevation-live [hidden]{display:none!important}
    #elevation-overview{position:fixed;inset:var(--elevation-top,8px) var(--elevation-right,8px) var(--elevation-bottom,8px) var(--elevation-left,8px);margin:auto;width:min(760px,calc(100% - var(--elevation-left,8px) - var(--elevation-right,8px)));height:min(690px,calc(100% - var(--elevation-top,8px) - var(--elevation-bottom,8px)),calc((100vw - var(--elevation-left,8px) - var(--elevation-right,8px)) * .66 + 154px));padding:10px;display:flex;flex-direction:column;gap:6px;overflow:auto}
    #elevation-overview::backdrop{background:#1015279e}
    #elevation-overview header,#elevation-live header,#elevation-overview footer,#elevation-live footer{display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap}
    #elevation-overview h2,#elevation-live h2{font-size:18px;margin:0}
    #elevation-overview footer,#elevation-live footer{justify-content:flex-start}
    #elevation-overview button,#elevation-live button{min-height:44px;min-width:44px;box-sizing:border-box;border:1px solid var(--menu-border);border-radius:8px;padding:5px 9px;color:inherit;background:var(--menu-button);font:inherit;cursor:pointer;touch-action:manipulation}
    #elevation-overview button[aria-pressed=true],#elevation-live button[aria-pressed=true]{background:#f7e5aa;border-color:#785921}
    #elevation-overview button:focus-visible,#elevation-live button:focus-visible{outline:2px solid var(--menu-focus);outline-offset:2px}
    #elevation-overview-close,#elevation-live-close{font-size:19px!important}
    #elevation-overview-canvas{width:100%;height:100%;min-height:100px;flex:1 1 100px;display:block;background:#fff9e8;border:1px solid var(--menu-border);border-radius:9px;box-sizing:border-box;touch-action:manipulation}
    #elevation-overview-detail{font-size:13px;margin:0;min-height:1.35em}
    .elevation-legend{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:2px 0;font-size:12px;font-variant-numeric:tabular-nums}
    .elevation-legend[data-tinted=true]:not([data-flat=true])::before{content:'';order:1;height:8px;flex:1;border-radius:9px;background:linear-gradient(90deg,${colours.join(',')})}
    .elevation-legend span:last-child{order:2}
    #elevation-live{position:fixed;z-index:60;left:var(--elevation-left,8px);bottom:calc(var(--elevation-bottom,8px) + var(--elevation-tools,58px));max-width:calc(100% - var(--elevation-left,8px) - var(--elevation-right,8px));padding:6px 8px;background:var(--menu-overlay);box-shadow:0 2px 9px #10152733}
    #elevation-live h2{font-size:14px}#elevation-live header{flex-wrap:nowrap}#elevation-live footer{gap:4px}
    #elevation-live button{white-space:nowrap}
  `;
  document.head.append(css);

  const overview=element('dialog','elevation-overview'),panel=element('section','elevation-live');
  overview.setAttribute('aria-labelledby','elevation-overview-title');
  panel.setAttribute('aria-label','Live elevation overlay');
  panel.hidden=true;
  const canvas=element('canvas','elevation-overview-canvas');
  canvas.setAttribute('role','img');
  const detail=element('p','elevation-overview-detail','Tap a tile to inspect its height.');
  detail.setAttribute('aria-live','polite');
  const overviewLegend=legend(),liveLegend=legend();
  function legend(){
    const node=element('div');
    node.className='elevation-legend';
    node.append(element('span'),element('span'));
    return node;
  }
  const overviewClose=button('elevation-overview-close','×',()=>dismissOverview());
  overviewClose.setAttribute('aria-label','Close Elevation Map');
  const liveClose=button('elevation-live-close','×',stopLive);
  liveClose.setAttribute('aria-label','Hide elevation overlay');
  const overviewHeader=element('header'),liveHeader=element('header');
  overviewHeader.append(element('h2','elevation-overview-title','Elevation Map'),overviewClose);
  liveHeader.append(element('h2',null,'Elevation'),liveClose);
  const overviewFooter=element('footer'),liveFooter=element('footer');
  const overviewTint=button('elevation-overview-colours','Height Colours',toggleTint);
  const liveTint=button('elevation-live-colours','Height Colours',toggleTint);
  overviewFooter.append(button('elevation-on-course','On Course',()=>{
    live=Module.elevationMapLive=true;
    dismissOverview(true);
    refresh();
  }),overviewTint);
  liveFooter.append(button('elevation-whole-course','Whole Course',()=>Module.openElevationMap(Module.elevationMapSource)),liveTint);
  overview.append(overviewHeader,canvas,detail,overviewLegend,overviewFooter);
  panel.append(liveHeader,liveLegend,liveFooter);
  document.body.append(overview,panel);

  function bounds(){
    const b=Module.getScreenBounds(),safe=b.safe;
    for(const el of [overview,panel])for(const side of ['top','right','bottom','left'])
      el.style.setProperty('--elevation-'+side,(safe[side]+8)+'px');
    const bar=document.getElementById('mobile-terrain-controls');
    const bottom=bar?.getClientRects().length?b.top+b.height-safe.bottom-bar.getBoundingClientRect().top+5:58;
    panel.style.setProperty('--elevation-tools',Math.max(58,bottom)+'px');
  }
  let lastOverview=null,lastSize='',lastRotation=-1;
  function drawOverview(data){
    if(!overview.open||!data)return;
    const width=canvas.clientWidth,height=canvas.clientHeight,rotation=Module.mobileState.rotation;
    const size=width+'x'+height;
    if(lastOverview===data&&lastSize===size&&lastRotation===rotation)return;
    lastOverview=data;lastSize=size;lastRotation=rotation;
    if(width<1||height<1)return;
    const ratio=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(width*ratio);
    canvas.height=Math.round(height*ratio);
    const frame={x:25,y:25,width:800,height:600,rotation,zoom:4};
    const cells=tilesFor(data,frame,true);
    let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
    for(const tile of cells)for(const [x,y] of tile.points){
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
    }
    const scale=Math.min((width-16)/(right-left),(height-16)/(bottom-top));
    const px=x=>width/2+(x-(left+right)/2)*scale,py=y=>height/2+(y-(top+bottom)/2)*scale;
    const g=canvas.getContext('2d');
    g.setTransform(ratio,0,0,ratio,0,0);
    g.lineWidth=.45;
    overviewTiles=cells.map(tile=>({...tile,points:tile.points.map(([x,y])=>[px(x),py(y)])}));
    const flags=new Uint16Array(Module.HEAPU8.buffer,0x53caf0,side*side);
    for(const tile of overviewTiles){
      trace(g,tile.points);
      const owned=tile.type!==voidTile;
      const path=(flags[tile.x*side+tile.y]&0x20)&&[4,5,11,13,14,15,16,22].includes(tile.type);
      g.fillStyle=path?'#c9b289':palette[tile.type];
      g.fill();
      if(owned&&tinted)tint(g,tile,data);
      g.strokeStyle=owned?'#23223a65':'#81799e55';
      g.stroke();
    }
    // Tees and greens are already distinguished by their native tile types.
    // Number the actual open-hole tees so the fitted map is easy to orient.
    g.font='bold 10px system-ui';
    g.textAlign='center';
    g.textBaseline='middle';
    for(let hole=1;hole<=18;hole++){
      const address=0x575ab0+hole*520,x=int(address+8),y=int(address+12);
      if(!u8(address)||x<0||x>=side||y<0||y>=side)continue;
      const tile=cells.find(t=>t.x===x&&t.y===y);
      if(!tile||tile.type===voidTile)continue;
      g.beginPath();g.arc(px(tile.cx),py(tile.cy),6,0,Math.PI*2);
      g.fillStyle='#fff4c9';g.fill();g.strokeStyle='#38334d';g.stroke();
      g.fillStyle='#20233a';g.fillText(String(hole),px(tile.cx),py(tile.cy)+.5);
    }
    if(selected){
      const tile=overviewTiles.find(t=>t.x===selected.x&&t.y===selected.y);
      if(tile){trace(g,tile.points);g.lineWidth=2;g.strokeStyle='#2c245a';g.stroke();}
    }
    fillLegend(overviewLegend,data);
    canvas.setAttribute('aria-label','Whole course elevation grid. '+data.owned+' mapped tiles. Heights '+level(data.min)+' to '+level(data.max)+' steps.');
  }
  canvas.onclick=event=>{
    const r=canvas.getBoundingClientRect(),x=event.clientX-r.left-canvas.clientLeft,y=event.clientY-r.top-canvas.clientTop;
    for(let i=overviewTiles.length-1;i>=0;i--){
      const tile=overviewTiles[i],points=tile.points;
      let inside=false;
      for(let a=0,b=3;a<4;b=a++){
        const [ax,ay]=points[a],[bx,by]=points[b];
        if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
      }
      if(!inside)continue;
      selected=tile;
      const lo=Math.min(...tile.heights),hi=Math.max(...tile.heights);
      detail.textContent=tile.type===voidTile?'Unpurchased land':'Height '+level(lo)+(lo!==hi?' to '+level(hi):'')+' steps';
      lastOverview=null;drawOverview(snapshot);
      break;
    }
  };
  function invalidate(){
    Module.elevationPaintRevision=(Module.elevationPaintRevision||0)+1;
    Module.applySmoothPan?.();
  }
  function toggleTint(){
    tinted=!tinted;
    for(const control of [overviewTint,liveTint])control.setAttribute('aria-pressed',String(tinted));
    for(const node of [overviewLegend,liveLegend])node.dataset.tinted=String(tinted);
    lastOverview=null;
    drawOverview(snapshot);
    invalidate();
  }
  for(const control of [overviewTint,liveTint])control.setAttribute('aria-pressed','false');
  function updateTimer(){
    if((live||overview.open)&&!timer)timer=setInterval(refresh,180);
    if(!live&&!overview.open&&timer){clearInterval(timer);timer=0;}
  }
  function dismissOverview(toCourse=false,restore=true){
    if(!overview.open)return;
    overview.close();
    Module.elevationOverviewOpen=false;
    overviewTiles=[];lastOverview=null;
    const done=returnToCourse;
    returnToCourse=null;
    if(restore)done?.(toCourse);
    updateTimer();invalidate();
  }
  function stopLive(){
    live=Module.elevationMapLive=false;panel.hidden=true;mesh=null;
    updateTimer();invalidate();
  }
  function refresh(){
    if(!allowed()||Module.atTitle){
      stopLive();dismissOverview(false,false);
      return;
    }
    const visible=courseVisible();
    if(overview.open&&!visible)dismissOverview(false,false);
    panel.hidden=!(live&&!overview.open&&visible&&document.getElementById('mobile-panel')?.hidden);
    if(!panel.hidden||overview.open)bounds();
    if(overview.open)drawOverview(observeTerrain());
    if(!panel.hidden&&snapshot)fillLegend(liveLegend,snapshot);
  }
  Module.canOpenElevationMap=()=>allowed()&&courseVisible()&&!overview.open&&!Module.shotPending&&
    !Module.featureSettingsOpen&&!Module.saveFilesOpen&&!Module.mobileReportOpen&&!Module.courseReviewOpen&&!Module.courseDesignLabOpen&&
    !Module.terrainPreview?.pending&&!Module.lotPending;
  Module.openElevationMap=(source,done)=>{
    if(!Module.canOpenElevationMap())return false;
    const data=observeTerrain(true);
    if(!data)return false;
    Module.cancelMapGesture();
    Module.elevationMapSource=source;
    returnToCourse=done;
    selected=null;lastOverview=null;detail.textContent='Tap a tile to inspect its height.';
    Module.elevationOverviewOpen=true;
    panel.hidden=true;
    bounds();
    overview.showModal();
    overviewClose.focus({preventScroll:true});
    drawOverview(data);updateTimer();invalidate();
    return true;
  };
  Module.saveRules.register(feature,{dispose(){
    stopLive();dismissOverview(false,false);
    snapshot=null;mesh=null;tinted=false;
    for(const control of [overviewTint,liveTint])control.setAttribute('aria-pressed','false');
    for(const node of [overviewLegend,liveLegend])node.dataset.tinted='false';
  }});

  Module.captureElevationFrame=frame=>{
    if(!live||overview.open||!frame.valid||!allowed()||!courseVisible())return null;
    const data=observeTerrain();
    if(!data)return null;
    const key=[frame.x,frame.y,frame.rotation,frame.zoom,frame.width,frame.height].join(',');
    if(mesh?.data===data&&mesh.key===key)return mesh;
    return mesh={data,key,tiles:tilesFor(data,frame,false)};
  };
  Module.paintElevationMap=(g,frame,b,r)=>{
    if(!live||overview.open||!courseVisible()||!allowed()||!frame.elevation)return;
    const {data,tiles}=frame.elevation,sx=r.width/frame.width,sy=r.height/frame.height;
    const ox=r.left-b.left,oy=r.top-b.top;
    const originalGrid=Module.mobileState.elevation;
    const label=frame.zoom*16*sx>=22;
    g.save();
    g.lineWidth=.65;
    g.strokeStyle='#222038ad';
    g.font='bold 11px system-ui';
    g.textAlign='center';g.textBaseline='middle';
    for(const tile of tiles){
      const x=ox+tile.cx*sx,y=oy+tile.cy*sy;
      if(x<-96||x>b.width+96||y<-96||y>b.height+96)continue;
      trace(g,tile.points.map(([px,py])=>[ox+px*sx,oy+py*sy]));
      if(tinted)tint(g,tile,data);
      if(!originalGrid)g.stroke();
      if(label){
        const lo=Math.min(...tile.heights),hi=Math.max(...tile.heights);
        const text=lo===hi?level(lo):level(lo)+'…'+level(hi);
        g.strokeStyle='#18202b';
        g.lineWidth=2;
        g.strokeText(text,x,y);
        g.fillStyle='#fff9e8';
        g.fillText(text,x,y);
        g.lineWidth=.65;
        g.strokeStyle='#222038ad';
      }
    }
    g.restore();
  };
  overview.addEventListener('cancel',event=>{event.preventDefault();dismissOverview();});
  // Keep releases from the overview from reaching original Build or Play.
  addEventListener('keydown',event=>{
    if(!overview.open)return;
    event.stopImmediatePropagation();
    if(event.key==='Escape'){event.preventDefault();escaped=true;dismissOverview();}
  },true);
  addEventListener('keyup',event=>{
    if(!overview.open&&!(escaped&&event.key==='Escape'))return;
    event.stopImmediatePropagation();
    if(escaped&&event.key==='Escape'){event.preventDefault();escaped=false;}
  },true);
  for(const root of [panel,overview])for(const type of ['pointerdown','pointerup','pointermove','pointercancel','mousedown','mouseup','click','dblclick','touchstart','touchmove','touchend','touchcancel','wheel','keydown','keyup','keypress'])
    root.addEventListener(type,event=>event.stopPropagation());
  addEventListener('simgolf-screen-resize',()=>{if(overview.open||live)refresh();});
})();
