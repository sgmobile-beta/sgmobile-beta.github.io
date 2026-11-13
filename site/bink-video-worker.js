// Decode only the user's local movie. No encoders, remote media or uploads.
importScripts('bink.js');
let decoder,call,credit=0,running=false,ended=false,videoFrames=0,audioFrames=0,w,h,fps,rate,channels,layout;
async function pump(){
 if(running||!decoder||ended)return;running=true;
 try{
  while(credit>0&&!ended){
   const kind=call('bk_next');
   if(kind<0)throw Error('Original movie decode failed');
   if(!kind){ended=true;postMessage({type:'end',duration:Math.max(videoFrames/fps,rate?audioFrames/rate:0)});break;}
   if(kind===1){
    const data=new Uint8ClampedArray(w*h*4),heap=decoder.HEAPU8,planes=[0,1,2].map(i=>call('bk_plane','number',['number'],[i])),strides=[0,1,2].map(i=>call('bk_linesize','number',['number'],[i]));
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
     const yy=1.164383*(heap[planes[0]+y*strides[0]+x]-16),u=heap[planes[1]+(y>>1)*strides[1]+(x>>1)]-128,v=heap[planes[2]+(y>>1)*strides[2]+(x>>1)]-128,o=(y*w+x)*4;
     data[o]=yy+1.596027*v;data[o+1]=yy-.391762*u-.812968*v;data[o+2]=yy+2.017232*u;data[o+3]=255;
    }
    const pts=call('bk_pts');postMessage({type:'frame',pts:Number.isFinite(pts)&&pts>=0?pts/1e6:videoFrames/fps,data:data.buffer},[data.buffer]);videoFrames++;credit--;
   }else if(kind===2&&rate&&channels){
    const n=call('bk_nb_samples'),pcm=new Float32Array(n*channels),heap=decoder.HEAPF32;
    if(layout===1)for(let c=0;c<channels;c++){const p=call('bk_samples','number',['number'],[c])>>2;pcm.set(heap.subarray(p,p+n),c*n);}
    else if(layout===2){const p=call('bk_samples','number',['number'],[0])>>2;for(let c=0;c<channels;c++)for(let i=0;i<n;i++)pcm[c*n+i]=heap[p+i*channels+c];}
    else throw Error('Original movie audio layout is unsupported');
    postMessage({type:'audio',pts:audioFrames/rate,frames:n,data:pcm.buffer},[pcm.buffer]);audioFrames+=n;
   }
  }
 }catch(e){ended=true;postMessage({type:'error',message:e.message||String(e)});}finally{running=false;}
}
onmessage=async e=>{
 try{
  if(e.data.type==='open'){
   decoder=await createBink({locateFile:p=>p,print:()=>{},printErr:()=>{}});call=(n,r='number',a=[],v=[])=>decoder.ccall(n,r,a,v);decoder.FS.writeFile('/opening.bik',new Uint8Array(e.data.data));
   if(!call('bk_open','number',['string'],['/opening.bik']))throw Error('Cannot open the original movie');
   w=call('bk_width');h=call('bk_height');fps=call('bk_fps')||15;rate=call('bk_sample_rate');channels=call('bk_channels');layout=call('bk_audio_layout');
   if(w<1||h<1||w>1920||h>1080||channels>8||fps<=0||fps>120)throw Error('Original movie dimensions are unsupported');
   postMessage({type:'ready',width:w,height:h,fps,rate,channels});credit=6;await pump();
  }else if(e.data.type==='credit'){credit+=Math.min(6,e.data.count||1);await pump();}
 }catch(e){postMessage({type:'error',message:e.message||String(e)});}
};
