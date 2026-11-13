(function(global){
'use strict';
// All money is in original $100 accounting units.
const seasonLength=8192,columns=[0,4,10,12];
const outcomes=['waiting','observing','interrupted','invalid-period','baseline-profitable',
  'baseline-locked','follow-up-loss','completed','property-changed'];
const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>object(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const property=x=>integer(x,0,15);
const frame=x=>integer(x,0,100*seasonLength);
const year=x=>integer(x,0,99);
const holes=x=>integer(x,1,18);
const word=x=>integer(x,-32768,32767);
const ordinary=event=>event.worldFlags===undefined||
  integer(event.worldFlags,0,0xffffffff)&&!(event.worldFlags&0x5000000);
const row=x=>Array.isArray(x)&&x.length===4&&x.every(word);
const copy=x=>JSON.parse(JSON.stringify(x));
const equal=(a,b)=>a.every((n,i)=>n===b[i]);
const sum=values=>values.reduce((total,n)=>total+n,0);
const period=x=>exact(x,['year','holes','rows'])&&year(x.year)&&holes(x.holes)&&row(x.rows);
const windowState=x=>exact(x,['start','holes','values','tainted'])&&frame(x.start)&&
  x.start%seasonLength===0&&x.start<100*seasonLength&&holes(x.holes)&&
  row(x.values)&&typeof x.tainted==='boolean';
const activeState=x=>exact(x,['property','started','lastBoundary','window','baseline','latest'])&&
  property(x.property)&&frame(x.started)&&
  (x.lastBoundary===null||frame(x.lastBoundary)&&x.lastBoundary%seasonLength===0&&x.lastBoundary>=x.started)&&
  (x.window===null||windowState(x.window)&&x.window.start===x.lastBoundary)&&
  (x.baseline===null||period(x.baseline)&&x.baseline.rows[0]>0&&sum(x.baseline.rows)<0)&&
  (x.latest===null||period(x.latest));
const qualifies=(baseline,latest)=>latest.year>baseline.year&&latest.holes===baseline.holes&&
  latest.rows[0]>0&&sum(latest.rows)>=0;

function validBusinessTurnaround(data) {
  if(object(data)&&!Object.keys(data).length)return true;
  return exact(data,['status','active','medal'])&&outcomes.includes(data.status)&&
    (data.active===null||activeState(data.active))&&
    (data.medal===null||exact(data.medal,['property','baseline','result'])&&property(data.medal.property)&&
      period(data.medal.baseline)&&data.medal.baseline.rows[0]>0&&sum(data.medal.baseline.rows)<0&&
      period(data.medal.result)&&qualifies(data.medal.baseline,data.medal.result))&&
    ((data.status==='completed')===!!data.medal)&&(!data.medal||data.active===null);
}

function createBusinessTurnaround(data={}) {
  if(!validBusinessTurnaround(data))throw Error('Invalid business challenge state.');
  const state=Object.keys(data).length?copy(data):{status:'waiting',active:null,medal:null};
  // Reasons describe the most recent native evaluation in this session.
  // Older saves carry the outcome without the reason.
  let rejection=null;
  function canStart(id,at,count) {
    return !state.active&&!state.medal&&property(id)&&frame(at)&&at<99*seasonLength&&holes(count);
  }
  function start(id,at,count) {
    if(!canStart(id,at,count))return false;
    state.active={property:id,started:at,lastBoundary:null,window:null,baseline:null,latest:null};
    rejection=null;
    state.status='waiting';
    return true;
  }
  function abandon() {
    if(!state.active)return false;
    state.active=null;
    rejection=null;
    state.status='waiting';
    return true;
  }
  function interrupt() {
    if(!state.active)return;
    rejection=null;
    state.active.window=null;
    state.status='interrupted';
  }
  function reset() {
    if(!state.active)return;
    state.active=null;
    rejection=null;
    state.status='property-changed';
  }
  function post(event) {
    const run=state.active,window=run?.window;
    if(!window||window.tainted)return false;
    if(event.property!==run.property){reset();return false;}
    const i=columns.indexOf(event.column);
    const observed=window.values[i]+event.delta;
    // Each original addition must agree with the preceding value. Overflow
    // invalidates the period because the native Financial Report would wrap.
    if(i<0||!ordinary(event)||!frame(event.frame)||event.frame<window.start||event.frame>window.start+seasonLength||
       event.year!==window.start/seasonLength||!word(event.delta)||!word(observed)||
       event.before!==window.values[i]){
      window.tainted=true;
      return false;
    }
    window.values[i]=observed;
    return true;
  }
  function boundary(event) {
    const run=state.active;
    if(!run||!frame(event.frame)||!event.frame||event.frame%seasonLength!==0||
       event.year!==event.frame/seasonLength-1||event.frame<=run.started||
       run.lastBoundary!==null&&event.frame<=run.lastBoundary)return false;
    if(event.property!==run.property){reset();return false;}
    if(!ordinary(event)||event.cachedYear!==undefined&&event.cachedYear!==event.year){
      interrupt();
      return false;
    }

    const window=run.window;
    run.lastBoundary=event.frame;
    run.window=null;
    rejection=null;
    if(window){
      const reason=window.tainted?'ledger-interrupted':
        event.frame!==window.start+seasonLength?'incomplete-window':
        event.holes!==window.holes?'open-holes-changed':
        !row(event.rows)||!equal(event.rows,window.values)?'ledger-unverified':
        event.rows[0]<=0?'no-positive-greens-fees':null;
      if(reason){
        rejection={year:event.year,reason};
        state.status='invalid-period';
      }else{
        const result={year:event.year,holes:event.holes,rows:event.rows.slice()};
        run.latest=result;
        if(!run.baseline){
          if(sum(result.rows)<0){
            run.baseline=result;
            state.status='baseline-locked';
          }else state.status='baseline-profitable';
        }else if(qualifies(run.baseline,result)){
          state.medal={property:run.property,baseline:run.baseline,result};
          state.active=null;
          state.status='completed';
          return true;
        }else if(result.holes===run.baseline.holes)state.status='follow-up-loss';
        else{
          rejection={year:event.year,reason:'different-baseline-holes'};
          state.status='invalid-period';
        }
      }
    }else state.status='observing';

    if(year(event.year+1)&&holes(event.holes)&&row(event.nextRows)&&event.nextRows.every(n=>n===0)){
      run.window={start:event.frame,holes:event.holes,values:event.nextRows.slice(),tainted:false};
    }else{
      if(!rejection)rejection={year:event.year+1,reason:'opening-unavailable'};
      state.status='invalid-period';
    }
    return true;
  }
  return {start,canStart,abandon,interrupt,reset,post,boundary,capture:()=>copy(state),
    rejection:()=>rejection&&{...rejection}};
}

global.SGBusinessTurnaroundModel=Object.freeze({createBusinessTurnaround,validBusinessTurnaround,seasonLength,maxFrame:100*seasonLength});
})(globalThis);
