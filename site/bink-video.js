// Play the original user-supplied Bink movie without conversion or extra copies
// in persistent storage. Decode on a worker; render with Canvas/Web Audio.
(function(){
 const base=new URL('./',document.currentScript.src);let current=null;
 Module.prepareBinkAudio=function(){
  if(Module.noVideos)return;
  const AC=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AC)return;
  let ctx=Module.openingAudioContext;
  if(!ctx||ctx.state==='closed')ctx=Module.openingAudioContext=new AC({sampleRate:44100});
  ctx.resume().catch(e=>{Module.openingAudioError=e.message;});
 };
 Module.playBinkVideo=async function(bytes,background){
  if(current)current('replaced');
  const root=document.createElement('section'),canvas=document.createElement('canvas'),skip=document.createElement('button');root.id='opening-video';root.setAttribute('aria-label',background?'Original SimGolf opening movie':'Original SimGolf closing movie');
  root.style.cssText='position:fixed;inset:0;z-index:995;background:#000;display:grid;place-items:center;touch-action:none';
  canvas.style.cssText='width:min(100%,calc(100dvh * 4 / 3));height:auto;max-height:100%;object-fit:contain;aspect-ratio:4/3';
  skip.textContent=background?'Skip intro':'Skip closing movie';skip.style.cssText='position:absolute;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));min-width:100px;min-height:48px;border:1px solid var(--menu-border);border-radius:6px;background:var(--menu-overlay);color:var(--menu-text);font:16px system-ui';root.append(canvas,skip);document.body.append(root);
  const audioEvents=background?new AbortController():null;
  const audio=audioEvents?Module.createAudioMuteButton('opening-video-mute',audioEvents.signal):null;
  if(audio)root.append(audio);
  const state=Module.binkVideo={phase:'loading',kind:background?'intro':'closing',frames:0,audioSamples:0};Module.binkVideoActive=true;
  let readyResolve,doneResolve,done=false,meta,clockStart=0,clockWall=0,raf=0,end=null,queue=[],sources=[],timeout;
  const ready=new Promise(r=>readyResolve=r),finished=new Promise(r=>doneResolve=r);let worker;
  const ctx=Module.soundDebug?.ctx||Module.openingAudioContext;const audioClock=ctx&&ctx.state==='running';
  function now(){return audioClock?ctx.currentTime-clockStart:(performance.now()-clockWall)/1000;}
  function mute(value){const gate=Module.soundDebug?.introGate;if(gate)gate.gain.value=value;}
  function finish(phase,error){
   if(done)return;done=true;current=null;Module.binkVideoActive=false;state.phase=phase;if(error){state.error=error;console.error('Opening movie:',error);}
   clearTimeout(timeout);cancelAnimationFrame(raf);worker?.terminate();for(const source of sources)try{source.stop();}catch{}sources=[];queue=[];audioEvents?.abort();root.remove();mute(1);
   removeEventListener('keydown',key,true);removeEventListener('pagehide',leave);document.removeEventListener('visibilitychange',visibility);readyResolve();doneResolve();
  }
  current=finish;
  function key(e){
   e.stopImmediatePropagation();
   if(audio&&(e.key==='Tab'||(e.target===audio&&(e.key==='Enter'||e.key===' '))))return;
   e.preventDefault();finish('skipped');
  }
  function leave(){finish('interrupted');}function visibility(){if(document.hidden)leave();}
  root.addEventListener('pointerdown',e=>{e.stopPropagation();if(audio?.contains(e.target))return;e.preventDefault();finish('skipped');});skip.onclick=()=>finish('skipped');
  for(const type of ['pointerup','click','touchstart','touchmove','touchend','wheel','keyup'])root.addEventListener(type,e=>e.stopPropagation());
  addEventListener('keydown',key,true);addEventListener('pagehide',leave);document.addEventListener('visibilitychange',visibility);
  timeout=setTimeout(()=>finish('error','The original opening decoder did not become ready'),15000);
  function frame(){
   if(done)return;mute(0);const time=now();
   while(queue.length&&queue[0].pts<=time){const next=queue.shift();canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(next.data),meta.width,meta.height),0,0);state.frames++;state.time=next.pts;worker.postMessage({type:'credit',count:1});}
   if(end!==null&&!queue.length&&time>=end){finish('ended');return;}raf=requestAnimationFrame(frame);
  }
  try{worker=new Worker(new URL('bink-video-worker.js',base));}catch(e){finish('error',e.message||'Opening movie worker could not start');return;}
  worker.onerror=e=>finish('error',e.message||'Opening movie worker failed');
  worker.onmessage=e=>{
   if(done)return;const m=e.data;
   if(m.type==='ready'){clearTimeout(timeout);meta=m;Object.assign(state,m,{phase:'playing',audio:!!audioClock});canvas.width=m.width;canvas.height=m.height;canvas.style.aspectRatio=m.width+'/'+m.height;canvas.style.width='min(100%,calc(100dvh * '+m.width+' / '+m.height+'))';clockStart=(ctx?.currentTime||0)+.2;clockWall=performance.now()+200;mute(0);raf=requestAnimationFrame(frame);readyResolve();}
   else if(m.type==='frame')queue.push(m);
   else if(m.type==='audio'){
    state.audioSamples+=m.frames;if(!audioClock)return;
    const buffer=ctx.createBuffer(meta.channels,m.frames,meta.rate),pcm=new Float32Array(m.data);for(let c=0;c<meta.channels;c++)buffer.copyToChannel(pcm.subarray(c*m.frames,(c+1)*m.frames),c);
    const source=ctx.createBufferSource();source.buffer=buffer;source.connect(Module.getAudioOutput?Module.getAudioOutput(ctx):ctx.destination);sources.push(source);source.onended=()=>{source.disconnect();sources=sources.filter(v=>v!==source);};source.start(Math.max(ctx.currentTime,clockStart+m.pts));
   }else if(m.type==='end')end=m.duration;else if(m.type==='error')finish('error',m.message);
  };
  const data=new Uint8Array(bytes);worker.postMessage({type:'open',data:data.buffer},[data.buffer]);
  await(background?ready:finished);
 };
})();
