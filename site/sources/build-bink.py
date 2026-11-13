#!/usr/bin/env python3
"""Build the pinned minimal Bink decoder; original movie bytes are never inputs."""
from pathlib import Path
import hashlib,json,subprocess,sys,tarfile,os
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'third_party/ffmpeg/sources/ffmpeg-7.1.1.tar.xz'
SHA='733984395e0dbbe5c046abda2dc49a5544e7e0e1e2366bba849222ae9e3a03b1'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def build(out):
 out=Path(out).resolve();assert sha(SOURCE)==SHA
 key=hashlib.sha256((SHA+sha(Path(__file__))+sha(ROOT/'src/install/bink_wasm.c')).encode()).hexdigest()[:20]
 cache=ROOT/'build/codec-cache'/key;marker=cache/'complete.json';prefix=cache/'out'
 def run(cmd,cwd=ROOT):
  import shlex
  shell='source '+shlex.quote('/home/localuser/projects/emsdk/emsdk_env.sh')+' >/dev/null 2>&1 && '+shlex.join([str(x) for x in cmd])
  subprocess.run(['bash','-c',shell],cwd=cwd,check=True)
 if cache.exists():
  if not marker.exists():raise ValueError('Preserved incomplete codec build: '+str(cache))
  for n,h in json.loads(marker.read_text()).items():assert sha(cache/n)==h
 else:
  cache.mkdir(parents=True)
  with tarfile.open(SOURCE) as t:t.extractall(cache,filter='data')
  source=cache/'ffmpeg-7.1.1'
  run(['emconfigure','./configure','--prefix='+str(prefix),'--target-os=none','--arch=x86_32','--enable-cross-compile','--cc=emcc','--cxx=em++','--ar=emar','--ranlib=emranlib','--nm=emnm','--disable-everything','--disable-programs','--disable-doc','--disable-network','--disable-autodetect','--disable-asm','--disable-pthreads','--disable-x86asm','--disable-inline-asm','--disable-avdevice','--disable-swscale','--disable-swresample','--disable-avfilter','--disable-postproc','--enable-decoder=bink,binkaudio_rdft,binkaudio_dct','--enable-demuxer=bink','--enable-protocol=file','--extra-cflags=-O2'],source)
  run(['emmake','make','-j8'],source);run(['emmake','make','install'],source)
  files=[prefix/'lib'/n for n in ['libavformat.a','libavcodec.a','libavutil.a']]
  marker.write_text(json.dumps({str(p.relative_to(cache)):sha(p) for p in files},indent=2)+'\n')
 for n in ['bink.js','bink.wasm']:
  if(out/n).exists():raise ValueError('Existing decoder output: '+str(out/n))
 run(['emcc','-O2','-I'+str(prefix/'include'),ROOT/'src/install/bink_wasm.c',*[prefix/'lib'/n for n in ['libavformat.a','libavcodec.a','libavutil.a']],'-sMODULARIZE=1','-sEXPORT_NAME=createBink','-sENVIRONMENT=worker','-sALLOW_MEMORY_GROWTH=1','-lworkerfs.js','-sFORCE_FILESYSTEM=1','-sEXPORTED_RUNTIME_METHODS=ccall,FS,WORKERFS,HEAPU8,HEAPF32','-o',out/'bink.js'])
if __name__=='__main__':build(sys.argv[1])
