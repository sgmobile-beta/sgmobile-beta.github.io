// SGMobile rulesets: native saves stay byte-for-byte original .sve files.
// Sidecars share the native save's existing IDBFS mount/transaction. No network.
(function(global){
  'use strict';
  const FORMAT=1,CONFIGURED_REVISION=2,ROOT='/persist/.sgmobile';
  const clone=value=>JSON.parse(JSON.stringify(value));
  const record=value=>value&&typeof value==='object'&&!Array.isArray(value);
  const ordered=value=>Array.isArray(value)?value.map(ordered):record(value)?
    Object.fromEntries(Object.keys(value).sort().map(key=>[key,ordered(value[key])])):value;
  const canonical=value=>JSON.stringify(ordered(value));
  const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
  const key=name=>('Saved Games/'+name).toLowerCase();
  const validName=n=>typeof n==='string'&&n.length>4&&n.length<=90&&!/[\\/:\0]/.test(n)&&/\.sve$/i.test(n);
  const encode=value=>new TextEncoder().encode(JSON.stringify(value));
  async function sha256(crypto,bytes){
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  }
  async function checkedSidecar(envelope,crypto){
    if(envelope?.format!==FORMAT||!envelope.payload||envelope.sha256!==await sha256(crypto,encode(envelope.payload)))
      throw Error('Save metadata failed its version or integrity check. The original save has been preserved.');
    return envelope.payload;
  }
  // Before the engine starts, match the current save's binding to its native
  // write journal. Imported copies and replaced or deleted revisions cannot
  // outrank a genuine manual save.
  async function recentManualSave(entries,readMany){
    const indexPath=ROOT+'/index.json';
    if(!entries[indexPath])return null;
    const journalPaths=Object.keys(entries).filter(path=>path.startsWith(ROOT+'/journal/')&&path.endsWith('.json'));
    const decode=bytes=>bytes?JSON.parse(new TextDecoder().decode(bytes)):null;
    const [indexBytes,...journalBytes]=await readMany([indexPath,...journalPaths]);
    const index=await checkedSidecar(decode(indexBytes),global.crypto);
    if(index.format!==FORMAT||!index.paths)return null;
    const journals=new Map();
    for(const bytes of journalBytes){
      const envelope=decode(bytes),j=envelope?.payload;
      if(j?.format===FORMAT&&j.source==='native'&&['prepared','committed'].includes(j.status)&&validName(j.name)&&
        !/^&(?:autosave\d+|quitsave)\.sve$|^while_browsing\.sve$/i.test(j.name)&&
        index.paths[key(j.name)]?.revision===j.revision&&index.paths[key(j.name)]?.sha256===j.sha256)
        journals.set(j.revision,envelope);
    }
    const candidates=Object.entries(entries).flatMap(([path,info])=>{
      const name=/^\/persist\/saved games\/([^/]+)$/i.exec(path)?.[1];
      const binding=validName(name)?index.paths[key(name)]:null;
      const modified=Number(info.timestamp);
      return binding&&binding.name===name&&modified>0&&journals.has(binding.revision)?[{path,name,binding,modified}]:[];
    }).sort((a,b)=>b.modified-a.modified||a.name.localeCompare(b.name));
    for(const {path,name,binding,modified} of candidates){
      await checkedSidecar(journals.get(binding.revision),global.crypto);
      const [bytes]=await readMany([path]);
      if(!bytes||bytes.length<0x47f4d||await sha256(global.crypto,bytes)!==binding.sha256)continue;
      // The original tutorial automatically writes One.sve.
      if(/^one\.sve$/i.test(name)&&new DataView(bytes.buffer,bytes.byteOffset).getUint32(0x44e09,true)&0x8000)continue;
      return {name,modified,bytes,sha256:binding.sha256,revision:binding.revision};
    }
    return null;
  }
  function create(options){
    const fs=()=>options.fs(),registry=options.registry||global.SGFeatureRegistry.create(options.catalog,options.categories||global.SGFeatureRegistry.registry.categories),catalog=registry.catalog,byId=new Map(catalog.map(f=>[f.id,f]));
    let index={format:FORMAT,paths:{}},ready=false,failure='',pending=Promise.resolve(),active=null,draft=null,load=null,sequence=0;
    const games=new Map(),revisions=new Map(),journals=new Map(),hooks=new Map();
    const uuid=()=>options.crypto.randomUUID();
    const sha=bytes=>sha256(options.crypto,bytes);
    const idValid=id=>typeof id==='string'&&/^[a-zA-Z0-9-]{8,80}$/.test(id);
    const error=m=>{throw Error(m);};
    const assertReady=()=>{if(!ready||failure)error(failure||'Save rules are not ready. Wait for loading, then try again.');};
    function mkdir(){for(const p of [ROOT,ROOT+'/games',ROOT+'/revisions',ROOT+'/journal'])fs().mkdirTree(p);}
    async function write(path,value){const payload=clone(value);fs().writeFile(path,JSON.stringify({format:FORMAT,sha256:await sha(encode(payload)),payload}));}
    async function read(path){
      let envelope;try{envelope=JSON.parse(fs().readFile(path,{encoding:'utf8'}));}catch(e){error('Save metadata is missing or damaged. Preserve this save and restore a backup, or import its complete SGMobile bundle when available.');}
      return checkedSidecar(envelope,options.crypto);
    }
    function validateGame(game){
      if(!game||game.format!==FORMAT||!idValid(game.id)||!['classic','enhanced'].includes(game.edition)||!game.features||typeof game.features!=='object')error('This saved game uses unsupported or damaged SGMobile metadata.');
      registry.validateSaved(game.features,game.edition);
      const ids=game.featureIds||Object.keys(game.features);
      if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.length!==Object.keys(game.features).length||ids.some(id=>!game.features[id]))error('This save is missing part of its recorded feature configuration.');
      // Features introduced after this career was created stay off. New
      // device defaults must never silently expand an existing ruleset.
      return game;
    }
    function configuredGame(base,features){
      if(!record(features))error('This saved revision is missing its feature configuration.');
      for(const [id,f]of Object.entries(base.features))
        if(features[id]?.schema!==f.schema)error('This saved revision changes the career’s recorded feature schema: '+id);
      return validateGame({...base,features,featureIds:Object.keys(features)});
    }
    function effectiveGame(a){return a.revision.format===CONFIGURED_REVISION?configuredGame(a.game,a.revision.features):a.game;}
    function validateStates(game,states,dormant={}){
      registry.validateStates(game.features,states);
      if(!record(dormant))error('Invalid disabled feature states.');
      for(const [id,h]of hooks)if(game.features[id]?.enabled&&h.validate&&h.validate(clone(states[id].data),game,states)!==true)
        error('Invalid persistent feature data: '+id);
      // A dormant payload must be independently valid even if its former
      // runtime identity owner has since been switched off.
      for(const [id,state]of Object.entries(dormant)){
        const f=game.features[id];
        if(!f||f.enabled||!byId.get(id)?.requiresPersistentState)error('Invalid disabled feature data: '+id);
        const owner={...game,features:Object.fromEntries(Object.entries(game.features).map(([key,value])=>[key,{...value,enabled:key===id}]))};
        const ownerStates={[id]:state},h=hooks.get(id);
        registry.validateStates(owner.features,ownerStates);
        if(h?.validate&&h.validate(clone(state.data),owner,ownerStates)!==true)error('Invalid disabled feature data: '+id);
      }
    }
    async function seal(game,revision){const body={format:FORMAT,game:clone(game),revision:clone(revision)};return Object.assign(body,{metadataSha256:await sha(encode(body))});}
    async function validateAssociation(a,hash){
      if(!a||a.format!==FORMAT||!a.game||!a.revision)error('The saved ruleset association is missing. Restore a complete backup.');
      validateGame(a.game);const v=a.revision;
      if(![FORMAT,CONFIGURED_REVISION].includes(v.format)||!idValid(v.id)||v.game!==a.game.id||v.sha256!==hash||!record(v.states))error('Native save bytes and Enhanced metadata do not match. The save was kept unchanged.');
      if(v.format===FORMAT&&('features' in v||'dormant' in v))error('The saved revision uses unsupported feature metadata.');
      if(v.format===CONFIGURED_REVISION&&(a.game.edition!=='enhanced'||!record(v.dormant)))error('Invalid configured Enhanced revision.');
      const body={format:a.format,game:a.game,revision:a.revision};if(a.metadataSha256!==await sha(encode(body)))error('The saved ruleset metadata failed its integrity check. Restore a complete backup; the native save is unchanged.');
      validateStates(effectiveGame(a),v.states,v.dormant);
      return clone(a);
    }
    async function gameRecord(id){
      if(!idValid(id))error('Invalid saved career identity.');
      let game=games.get(id);
      if(!game){game=await read(ROOT+'/games/'+id+'.json');games.set(id,game);}
      return game;
    }
    async function checkGameRecord(game,store=false){
      const path=ROOT+'/games/'+game.id+'.json';
      if(fs().analyzePath(path).exists){
        if(canonical(await gameRecord(game.id))!==canonical(game))error('This backup conflicts with the immutable record for the same career. The existing career was kept unchanged.');
      }else if(store){await write(path,game);games.set(game.id,clone(game));}
    }
    async function association(revision,hash){
      let v=revisions.get(revision);if(!v){v=await read(ROOT+'/revisions/'+revision+'.json');revisions.set(revision,v);}
      return validateAssociation(await seal(await gameRecord(v.game),v),hash);
    }
    function associationKey(a){
      return canonical([a.game.id,a.game.edition,effectiveGame(a).features,a.revision.states,a.revision.dormant||{}]);
    }
    function nativePath(name){const d='/game/'+(fs().readdir('/game').find(n=>n.toLowerCase()==='saved games')||'Saved Games');return d+'/'+name;}
    function nativeBytes(name){if(!validName(name))error('Invalid saved-game filename.');return fs().readFile(nativePath(name)).slice();}
    function enqueue(job){const task=pending.then(async()=>{await options.beforeWrite?.();return job();});pending=task.catch(e=>{failure=String(e.message||e);options.onError?.(failure);});return task;}
    async function initialize(){
      if(ready)return !failure;
      try{
        if(fs().analyzePath(ROOT+'/index.json').exists){index=await read(ROOT+'/index.json');if(index.format!==FORMAT||!index.paths||typeof index.paths!=='object')error('Unsupported SGMobile save catalog.');}
        if(fs().analyzePath(ROOT+'/journal').exists){for(const n of fs().readdir(ROOT+'/journal').filter(n=>/\.json$/.test(n))){const j=await read(ROOT+'/journal/'+n);if(j.format!==FORMAT||!idValid(j.id)||!validName(j.name))error('Damaged save journal. Keep your files and restore a backup.');journals.set(j.id,j);}}
        // Establish the existing unclassified cohort once, before any copy
        // can share its bytes. This records uncertainty, never a Classic or
        // Enhanced claim, and leaves every native save byte untouched.
        if(!index.legacyInventory){
          const folder='/game/'+(fs().readdir('/game').find(n=>n.toLowerCase()==='saved games')||'Saved Games');
          if(fs().analyzePath(folder).exists)for(const name of fs().readdir(folder).filter(n=>validName(n)&&!/^while_browsing\.sve$/i.test(n))){if(!index.paths[key(name)])index.paths[key(name)]={name,sha256:await sha(fs().readFile(folder+'/'+name)),revision:null};}
          index.legacyInventory=true;mkdir();await write(ROOT+'/index.json',index);
        }
        ready=true;return true;
      }catch(e){failure='The SGMobile save catalog could not be verified. Keep this browser data and report diagnostics before attempting recovery. Native .sve downloads remain available, but loading and saving are blocked to protect the associated rules. Details: '+String(e.message||e);ready=true;options.onError?.(failure);return false;}
    }
    async function assess(name){
      assertReady();await pending;const bytes=nativeBytes(name),hash=await sha(bytes),binding=index.paths[key(name)];
      try{
        if(binding){
          if(binding.ambiguous)error('This standalone save matches multiple careers or rulesets. Restore a backup with its metadata instead.');
          if(binding.sha256!==hash){
            // Only exact journal evidence can repair a partially committed binding.
            const matches=[...journals.values()].filter(j=>key(j.name)===key(name)&&j.sha256===hash&&j.revision);
            const candidates=await Promise.all(matches.map(j=>association(j.revision,hash)));const unique=new Map(candidates.map(a=>[associationKey(a),a]));
            if(unique.size!==1)error('This file no longer matches its recorded save revision. Keep it unchanged and restore a backup or import the matching metadata.');
            const a=[...unique.values()][0];return {kind:a.game.edition,name,sha256:hash,association:a,recovered:true};
          }
          if(binding.revision){const a=await association(binding.revision,hash);return {kind:a.game.edition,name,sha256:hash,association:a};}
          return {kind:'legacy',name,sha256:hash,reason:'Unclassified standalone save. Earlier versions did not store an edition or feature configuration.'};
        }
        // Renaming an exact revision must not erase its Enhanced identity. Multiple
        // careers can deliberately contain identical bytes, so ambiguity blocks.
        const candidates=[];
        for(const j of journals.values())if(j.sha256===hash&&j.revision)candidates.push(await association(j.revision,hash));
        const unique=new Map(candidates.map(a=>[associationKey(a),a]));
        if(unique.size===1&&!Object.values(index.paths).some(p=>!p.revision&&p.sha256===hash)){const a=[...unique.values()][0];return {kind:a.game.edition,name,sha256:hash,association:a,renamed:true};}
        if(unique.size>1||(unique.size&&Object.values(index.paths).some(p=>!p.revision&&p.sha256===hash)))return {kind:'blocked',name,sha256:hash,reason:'These native bytes match more than one SGMobile career or ruleset. Restore the named backup with its metadata; a standalone .sve cannot identify which ruleset it belongs to.'};
        return {kind:'legacy',name,sha256:hash,reason:'Unclassified standalone save. Earlier versions did not store an edition or feature configuration.'};
      }catch(e){return {kind:'blocked',name,sha256:hash,reason:String(e.message||e)};}
    }
    function makeGame(edition,preferences,origin,context='career'){
      assertReady();
      if(!['career','championship','sandbox'].includes(context))error('Invalid new-game context.');
      const selected=registry.validate(preferences),features={};
      for(const f of catalog.filter(f=>f.available)){
        const allowed=f.id!=='creativeSandbox'||context==='sandbox';
        const enabled=edition==='enhanced'&&allowed&&selected[f.id]===true;
        // Keep new default-off careers portable to builds before this opt-in.
        if(f.id==='constructionUndoRedo'&&!enabled)continue;
        features[f.id]={schema:f.schemaVersion,enabled};
      }
      return validateGame({format:FORMAT,id:uuid(),edition,features,featureIds:Object.keys(features),created:Date.now(),origin:origin||{kind:'new'}});
    }
    function statesFor(game){return Object.fromEntries(Object.entries(game.features).filter(([,f])=>f.enabled).map(([id,f])=>[id,{schema:f.schema,data:{}}]));}
    function disposeFeatures(game){
      for(const [id,h]of hooks)if(game?.features[id]?.enabled)h.dispose?.();
    }
    function dispose(){disposeFeatures(active?.game);active=null;options.onActivate?.(null);}
    function discard(prepared){for(const [,h,p]of prepared)h.discard?.(p);}
    function prepare(game,states){
      const prepared=[];
      try{
        for(const [id,h]of hooks)if(game.features[id]?.enabled)prepared.push([id,h,h.prepare?.(clone(states[id]?.data||{}),game,states)]);
      }catch(e){discard(prepared);throw e;}
      return prepared;
    }
    function activatePrepared(prepared){for(const [,h,p]of prepared)h.activate?.(p);}
    function snapshot(game,states,revision,base,dormant){
      return freeze(clone({game,states,revision:revision||null,...(base?{base,dormant}:{})}));
    }
    function activationFailed(e){
      failure='Feature activation failed. Keep this browser data and use a compatible build: '+e.message;
      options.onError?.(failure);error(failure);
    }
    function activate(game,states,revision,base,dormant,beforeActivate){
      validateGame(game);
      const next=snapshot(game,states,revision,base,dormant),prepared=prepare(game,states);
      try{beforeActivate?.();}catch(e){discard(prepared);throw e;}
      dispose();active=next;
      try{activatePrepared(prepared);options.onActivate?.(active);}
      catch(e){dispose();activationFailed(e);}
      return active;
    }
    function captureStates(current){
      const states=clone(current.states);
      for(const [id,h]of hooks)if(current.game.features[id]?.enabled&&h.capture)
        states[id]={schema:current.game.features[id].schema,data:clone(h.capture())};
      return states;
    }
    function configuration(previous,preferences){
      const base=previous.base||previous.game;
      const choices=registry.validate(preferences),features=clone(previous.game.features);
      let changed=false;
      for(const [id,on]of Object.entries(choices)){
        // Preserve legacy paid/free rules when a caller omits the title-only option.
        if(id==='creativeSandbox'&&!Object.hasOwn(preferences,id))continue;
        const existing=features[id],f=byId.get(id);
        if(!!existing?.enabled===on)continue;
        if(!f.mutableDuringPlay)error(f.name+' cannot be changed during this career.');
        features[id]={schema:existing?.schema??f.schemaVersion,enabled:on};
        changed=true;
      }
      return changed?{game:configuredGame(base,features),base}:null;
    }
    function configuredSnapshot(previous,{game,base},captured){
      const features=game.features,states={},dormant={};
      for(const [id,f]of Object.entries(features)){
        const saved=captured[id]||previous.dormant?.[id];
        if(f.enabled)states[id]=saved?clone(saved):{schema:f.schema,data:{}};
        else if(saved&&byId.get(id).requiresPersistentState)dormant[id]=clone(saved);
      }
      options.transformStates?.(previous.game,game,states,dormant);
      validateStates(game,states,dormant);
      return snapshot(game,states,previous.revision,base,dormant);
    }
    function reconfigure(expectedActive,preferences){
      assertReady();
      if(!active||active!==expectedActive||active.game.edition!=='enhanced'||options.edition()!=='enhanced'||draft||load)
        error('The active Enhanced career changed. Reopen its settings and try again.');
      const previous=active,choices=configuration(previous,preferences);
      if(!choices)return previous;

      const captured=captureStates(previous),next=configuredSnapshot(previous,choices,captured);
      const prepared=prepare(next.game,next.states);
      // Prepare the live pre-edit state as well, so an activation failure
      // restores the current career rather than its last saved snapshot.
      let rollback;
      try{rollback=prepare(previous.game,captured);}
      catch(e){discard(prepared);throw e;}

      try{
        disposeFeatures(previous.game);
        active=next;
        activatePrepared(prepared);
        options.onActivate?.(active);
      }catch(e){
        try{
          if(active===next)disposeFeatures(next.game);else discard(prepared);
          active=previous;
          activatePrepared(rollback);
          options.onActivate?.(active);
        }catch(rollbackError){
          active=null;
          activationFailed(rollbackError);
        }
        throw e;
      }
      discard(rollback);
      return active;
    }
    function beginNew(preferences,context='career'){
      const edition=options.edition();
      makeGame(edition,preferences,undefined,context);
      draft={edition,preferences:clone(preferences),context};
      return true;
    }
    function cancelNew(){draft=null;}
    async function commitNew(){
      if(!draft)return !!active;assertReady();const d=draft,g=d.game||(d.game=makeGame(d.edition,d.preferences,undefined,d.context));const states=statesFor(g);
      await enqueue(async()=>{mkdir();await checkGameRecord(g,true);});
      if(!await options.flush())error('New-game rules could not be stored. Free device storage and retry; existing saves are unchanged.');
      activate(g,states);draft=null;return true;
    }
    async function stage(name,bytes,game,states,source,base,dormant){
      assertReady();mkdir();const hash=await sha(bytes);
      const revision={format:base?CONFIGURED_REVISION:FORMAT,id:uuid(),game:game.id,sha256:hash,bytes:bytes.length,created:Date.now(),states:clone(states)};
      if(base){revision.features=clone(game.features);revision.dormant=clone(dormant);}
      const original=base||game,a=await validateAssociation(await seal(original,revision),hash);
      const journal={format:FORMAT,id:uuid(),name,sha256:hash,revision:revision.id,previous:index.paths[key(name)]||null,status:'prepared',sequence:++sequence,source:source||'native'};
      await checkGameRecord(original,true);
      await write(ROOT+'/revisions/'+revision.id+'.json',revision);await write(ROOT+'/journal/'+journal.id+'.json',journal);
      revisions.set(revision.id,revision);journals.set(journal.id,journal);
      index.paths[key(name)]={name,sha256:hash,revision:revision.id};await write(ROOT+'/index.json',index);return a;
    }
    function stageAssociation(name,bytes,a,source){
      const v=a.revision,base=v.format===CONFIGURED_REVISION?a.game:undefined;
      return stage(name,bytes,effectiveGame(a),v.states,source,base,v.dormant);
    }
    function captureWrite(context){
      const ctx=Object.assign({},context||{kind:'native'},{capturedAtClose:true,captured:active?clone(active):null});
      if(ctx.captured&&ctx.kind==='native'){try{ctx.captured.states=captureStates(active);}catch(e){ctx.captureError='Feature save capture failed: '+String(e.message||e);}}
      return ctx;
    }
    function fileWritten(rel,data,context){
      // top10.sve is the original global high-score table, not a course save.
      const parts=rel.split('/'),name=parts[parts.length-1];if(parts.length!==2||parts[0].toLowerCase()!=='saved games'||!/\.sve$/i.test(name)||/^while_browsing\.sve$/i.test(name))return Promise.resolve(null);
      const bytes=data.slice(),ctx=context?.capturedAtClose?context:captureWrite(context),captured=ctx.captured;
      return enqueue(async()=>{
        assertReady();if(ctx.captureError)error(ctx.captureError);
        if(ctx.association){const a=await validateAssociation(ctx.association,await sha(bytes));return stageAssociation(name,bytes,a,ctx.kind);}
        if(ctx.kind==='import'){
          // Native-only imports never inherit the game currently being played.
          const hash=await sha(bytes),matches=[];for(const j of journals.values())if(j.sha256===hash&&j.revision)matches.push(await association(j.revision,hash));
          const unique=new Map(matches.map(a=>[associationKey(a),a]));if(unique.size===1&&!Object.values(index.paths).some(p=>!p.revision&&p.sha256===hash)){const a=[...unique.values()][0];return stageAssociation(name,bytes,a,'import-known');}
          mkdir();index.paths[key(name)]={name,sha256:hash,revision:null,ambiguous:unique.size>1||(unique.size>0&&Object.values(index.paths).some(p=>!p.revision&&p.sha256===hash))};await write(ROOT+'/index.json',index);return null;
        }
        if(!captured&&draft)return null;
        if(!captured)error('A native save has no committed game ruleset. Keep this page open and export a backup.');
        const states=clone(captured.states);
        return stage(name,bytes,captured.game,states,'native',captured.base,captured.dormant);
      });
    }
    async function settle(){let observed;do{observed=pending;await observed;}while(observed!==pending);if(failure)error(failure);}
    async function markCommitted(){
      const work=[...journals.values()].filter(j=>j.status==='prepared');for(const j of work){j.status='committed';await write(ROOT+'/journal/'+j.id+'.json',j);}return work.length>0;
    }
    function assertAutomaticLoad(){
      if(options.edition()!==null||active||draft)error('A saved game can choose the edition only before an edition or career is selected.');
    }
    async function prepareLoad(name,automatic=false,preview=null,preferences=null){
      if(automatic)assertAutomaticLoad();
      const request={};load=request;
      let a;
      try{a=await assess(name);}catch(e){if(load===request)cancelLoad();throw e;}
      if(load!==request)error('The selected load was canceled.');
      cancelLoad();
      if(preview&&(a.sha256!==preview.sha256||(a.association?.revision.id??null)!==preview.revision))
        error('This save or its rules changed after preview. Select it again before loading.');
      if(a.kind==='blocked')error(a.reason);
      if(automatic)assertAutomaticLoad();
      else if(a.kind==='enhanced'&&options.edition()!=='enhanced')error('Enhanced saves can only be loaded in Enhanced Mode. Return to edition selection; your save is unchanged.');
      if(preferences&&a.kind!=='enhanced')error('Only an Enhanced save can use these enhancement choices.');
      if(a.association&&(automatic||a.kind===options.edition())){
        let settings;
        if(preferences){
          const saved=savedSnapshot(a.association),choices=configuration(saved,preferences);
          if(choices)settings=configuredSnapshot(saved,choices,saved.states);
        }
        load={...clone(a),automatic,settings};
      }
      return a;
    }
    function savedSnapshot(a){
      const v=a.revision;
      return {game:effectiveGame(a),states:v.states,revision:v.id,base:v.format===CONFIGURED_REVISION?a.game:undefined,dormant:v.dormant};
    }
    async function finishLoad(name){
      const staged=load;
      if(!staged?.association||staged.name!==name)error('This load has no validated ruleset.');
      let again;
      try{again=await assess(name);}catch(e){if(load===staged)cancelLoad();throw e;}
      if(load!==staged)error('The selected load was canceled.');
      cancelLoad();
      if(again.kind!==staged.kind||again.sha256!==staged.sha256||again.association?.revision.id!==staged.association.revision.id)
        error('The selected save changed during loading.');
      if(staged.automatic)assertAutomaticLoad();
      const a=staged.association,{game,states,revision,base,dormant}=staged.settings||savedSnapshot(a);
      // The original reader has returned. Commit the saved edition only after
      // its exact revision still matches and feature preparation succeeds.
      const select=staged.automatic?()=>{
        assertAutomaticLoad();
        if(!options.selectEdition?.(a.game.edition)||options.edition()!==a.game.edition)
          error('The saved game’s edition could not be selected.');
      }:undefined;
      activate(game,states,revision,base,dormant,select);
      draft=null;return true;
    }
    function cancelLoad(){load=null;}
    async function copyAssociation(source,edition,preferences){
      if(source.kind==='enhanced'&&edition==='classic')error('Enhanced games cannot be converted to Classic.');
      if(source.kind==='blocked')error(source.reason);
      const game=makeGame(edition,preferences,{kind:source.kind==='legacy'?'legacy-copy':'classic-upgrade',source:source.association?.revision.id||null,sourceHash:source.sha256});
      return seal(game,{format:FORMAT,id:uuid(),game:game.id,sha256:source.sha256,states:statesFor(game),created:Date.now()});
    }
    return Object.freeze({initialize,assess,beginNew,cancelNew,commitNew,captureWrite,fileWritten,settle,markCommitted,prepareLoad,finishLoad,cancelLoad,copyAssociation,reconfigure,
      get active(){return active;},get draft(){return draft?clone(draft):null;},get error(){return failure;},get pending(){return pending;},
      unload(){draft=load=null;dispose();},hasFeature(id){return !!(byId.get(id)?.available&&active?.game.edition==='enhanced'&&active.game.features[id]?.enabled);},
      async validateImport(bytes,a){if(a){const checked=await validateAssociation(a,await sha(bytes));await checkGameRecord(checked.game);}return true;},
      register(id,hook){if(active||!byId.has(id)||hooks.has(id))error('Register feature lifecycle hooks before a game starts.');hooks.set(id,hook);},
      diagnostic(){return {format:FORMAT,ready,error:failure,game:active?.game.id||null,edition:active?.game.edition||null,features:active?.game.features||null,revision:active?.revision||null,draft:!!draft,pendingLoad:!!load,paths:Object.keys(index.paths).length,journals:journals.size};}
    });
  }
  global.SGSaveRules=Object.freeze({create,recentManualSave,format:FORMAT});
  if(global.Module?.localFiles){const m=global.Module;m.saveRules=create({fs:()=>FS,crypto:global.crypto,registry:m.featureRegistry,edition:()=>m.gameEdition,selectEdition:value=>m.selectGameEdition(value),flush:()=>m.persistFlush(),beforeWrite:()=>m.awaitSaveSnapshot?.(),onError:message=>{m.rulesetBlocked=true;m.saveRulesError=message;m.showEditionNotice?.(message);},transformStates:(...args)=>m.reconfigureGolferStates?.(...args),onActivate:()=>{global.dispatchEvent(new Event('simgolf-ruleset-change'));}});}
})(globalThis);
