// Bounded summaries of native hole finishes, owned by one exact save revision.
(function(global) {
  'use strict';
  const MAX_VERSIONS=12, MAX_HISTORY=12, MAX_SAMPLES=65535, MIN_COMPARISON=3;
  const copy=value=>JSON.parse(JSON.stringify(value));
  const int=(value,min,max)=>Number.isInteger(value)&&value>=min&&value<=max;
  const text=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max;
  const frame=value=>int(value,0,0x7fffffff);
  const digest=value=>typeof value==='string'&&/^[0-9a-f]{16}$/.test(value);
  const fields=(value,names)=>value&&typeof value==='object'&&!Array.isArray(value)&&
    Object.keys(value).length===names.length&&names.every(name=>Object.hasOwn(value,name));
  const courseOK=c=>fields(c,['property','template','name'])&&
    int(c.property,0,15)&&int(c.template,0,15)&&text(c.name,129);
  const sameCourse=(a,b)=>a&&b&&a.property===b.property&&a.template===b.template;
  const conditionsOK=e=>digest(e.context)&&int(e.environment,0,3)&&int(e.difficulty,0,3)&&int(e.coverage,0,3);
  const geometryOK=v=>digest(v.design)&&frame(v.frame)&&int(v.par,2,6)&&int(v.yards,1,32767)&&
    (v.fun===null||int(v.fun,-819200,819175));
  function scoresOK(s){
    if(!fields(s,['count','total','low','high'])||!int(s.count,0,MAX_SAMPLES))return false;
    if(!s.count)return s.total===0&&s.low===null&&s.high===null;
    if(!int(s.low,1,127)||!int(s.high,s.low,127))return false;
    if(s.count===1)return s.low===s.high&&s.total===s.low;
    return int(s.total,s.low*(s.count-1)+s.high,s.high*(s.count-1)+s.low);
  }
  function experimentOK(e,ended){
    return fields(e,['course','hole','context','environment','difficulty','coverage','versions','ended'])&&
      courseOK(e.course)&&int(e.hole,1,18)&&conditionsOK(e)&&Array.isArray(e.versions)&&
      e.versions.length>=1&&e.versions.length<=MAX_VERSIONS&&
      e.versions.every((v,i)=>fields(v,['design','frame','par','yards','fun','scores'])&&geometryOK(v)&&
        scoresOK(v.scores)&&(!i||v.frame>=e.versions[i-1].frame))&&
      new Set(e.versions.map(v=>v.design)).size===e.versions.length&&
      (ended?frame(e.ended)&&e.ended>=e.versions.at(-1).frame:e.ended===null);
  }
  function valid(data){
    if(!data||typeof data!=='object'||Array.isArray(data))return false;
    if(!Object.keys(data).length)return true;
    return fields(data,['version','career','active','history'])&&data.version===1&&text(data.career,80)&&
      (data.active===null||experimentOK(data.active,false))&&Array.isArray(data.history)&&
      data.history.length<=MAX_HISTORY&&data.history.every(e=>experimentOK(e,true));
  }
  function create(data,career){
    if(!text(career,80)||!valid(data)||(data.career&&data.career!==career))
      throw Error('Invalid Course Design Lab data for this career');
    const state=copy(data.version?data:{version:1,career,active:null,history:[]});
    let live=null, status='waiting', seen=new Set(), entryFloor=0;
    function clear(next){
      live=null;status=next;seen.clear();entryFloor=0;
    }
    function observe(layout){
      const e=state.active;
      if(!e)return false;
      if(!layout||!geometryOK(layout)||!conditionsOK(layout)||!int(layout.epoch,1,0xffffffff)||
          layout.hole!==e.hole||!sameCourse(e.course,layout)){
        clear('waiting');return false;
      }
      if(layout.context!==e.context||layout.environment!==e.environment||layout.difficulty!==e.difficulty||
          layout.coverage!==e.coverage){
        clear('conditions');return false;
      }
      let version=e.versions.find(v=>v.design===layout.design);
      if(version&&(version.par!==layout.par||version.yards!==layout.yards)){
        clear('waiting');return false;
      }
      if(!version){
        if(e.versions.length>=MAX_VERSIONS){clear('limit');return false;}
        if(layout.frame<e.versions.at(-1).frame){clear('waiting');return false;}
        version=baseline(layout);e.versions.push(version);
      }
      if(!live||live.epoch!==layout.epoch)clear('observing');
      live={epoch:layout.epoch,version};
      return true;
    }
    function baseline(layout){
      const {design,frame,par,yards,fun}=layout;
      return {design,frame,par,yards,fun,scores:{count:0,total:0,low:null,high:null}};
    }
    function start(course,layout){
      if(state.active||!courseOK(course)||!layout||!sameCourse(course,layout)||!geometryOK(layout)||
          !conditionsOK(layout)||!int(layout.hole,1,18)||!int(layout.epoch,1,0xffffffff))return false;
      const {hole,context,environment,difficulty,coverage}=layout;
      state.active={course:{...course},hole,context,environment,difficulty,coverage,versions:[baseline(layout)],ended:null};
      return observe(layout);
    }
    function score(row){
      if(!live||row.epoch!==live.epoch||!frame(row.frame)||row.frame<live.version.frame||
          !int(row.entry,1,0xffffffff)||row.entry<=entryFloor||seen.has(row.entry)||!int(row.strokes,1,127))
        return false;
      const s=live.version.scores;
      if(s.count>=MAX_SAMPLES)return false;
      seen.add(row.entry);
      // Entry tokens can finish out of order. Keep a bounded duplicate guard.
      if(seen.size>256){entryFloor=Math.min(...seen);seen.delete(entryFloor);}
      s.count++;s.total+=row.strokes;
      s.low=s.low===null?row.strokes:Math.min(s.low,row.strokes);
      s.high=s.high===null?row.strokes:Math.max(s.high,row.strokes);
      return true;
    }
    function complete(at){
      const e=state.active;
      if(!e||!frame(at)||at<e.versions.at(-1).frame)return false;
      e.ended=at;state.history.push(e);
      if(state.history.length>MAX_HISTORY)state.history.shift();
      abandon();return true;
    }
    function abandon(){state.active=null;clear('waiting');}
    return Object.freeze({start,observe,score,complete,abandon,
      selected:()=>state.active?.hole||0,
      capture:()=>copy(state),
      view:()=>({...copy(state),status,current:live?.version.design||null})});
  }
  global.SGCourseDesignLabModel=Object.freeze({create,valid,MIN_COMPARISON,MAX_SAMPLES});
})(globalThis);
