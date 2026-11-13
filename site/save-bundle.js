// Portable envelope. Original save bytes and sealed revision metadata travel
// together; save-rules verifies the native hash, edition and feature states.
(function(g){'use strict';
const MAX=24*1024*1024,MAX_NATIVE=8*1024*1024;
const nameOK=n=>typeof n==='string'&&n.length<=90&&!/[\\/:\0]/.test(n)&&/\.sve$/i.test(n);
async function encode(name,bytes,association,rules){if(!nameOK(name)||!bytes.length||bytes.length>MAX_NATIVE)throw Error('Invalid native save for portable backup');if(!association)throw Error('This save has no verified edition metadata. Use a standalone .sve backup.');await rules.validateImport(bytes,association);let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));const out=new TextEncoder().encode(JSON.stringify({format:'SGMobile-save-bundle',version:1,name,native:btoa(binary),association}));if(out.length>MAX)throw Error('Portable backup exceeds the supported size');return out;}
async function decode(bytes,rules){if(!bytes.length||bytes.length>MAX)throw Error('Invalid portable backup size');let p;try{p=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch(_){throw Error('Portable backup is unreadable');}if(p?.format!=='SGMobile-save-bundle'||p.version!==1||!nameOK(p.name)||typeof p.native!=='string'||p.native.length>Math.ceil(MAX_NATIVE/3)*4||/[^A-Za-z0-9+/=]/.test(p.native)||!p.association)throw Error('Unsupported or damaged portable backup');const native=Uint8Array.from(atob(p.native),c=>c.charCodeAt(0));if(!native.length)throw Error('Portable backup contains no save');await rules.validateImport(native,p.association);return {name:p.name,bytes:native,association:p.association};}
g.SGSaveBundle=Object.freeze({encode,decode,MAX});
})(globalThis);
