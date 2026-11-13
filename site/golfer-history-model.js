// Pure, bounded career/revision data. Never reads native memory or invents play.
(function(g){
'use strict';
const MAX_PEOPLE=150,MAX_ROUNDS=32,clone=v=>JSON.parse(JSON.stringify(v)),obj=v=>!!v&&typeof v==='object'&&!Array.isArray(v),integer=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
const courseOK=c=>obj(c)&&integer(c.property,0,15)&&integer(c.template,0,15)&&typeof c.name==='string'&&c.name.length>0&&c.name.length<=129;
const empty=()=>({version:1,career:'',next:1,people:[],bindings:{},visits:{},limited:false});
function check(s){
 if(!obj(s))throw Error('Invalid golfer history');if(!Object.keys(s).length)return true;
 if(s.version!==1||typeof s.career!=='string'||s.career.length>80||!integer(s.next,1,1000000000)||!Array.isArray(s.people)||s.people.length>MAX_PEOPLE||!obj(s.bindings)||!obj(s.visits)||typeof s.limited!=='boolean')throw Error('Unsupported golfer history state');
 const ids=new Set();for(const p of s.people){if(!obj(p)||typeof p.id!=='string'||!p.id.startsWith(s.career+'-')||ids.has(p.id)||!integer(p.slot,1,75)||typeof p.fingerprint!=='string'||p.fingerprint.length>300||typeof p.name!=='string'||p.name.length>80||!Array.isArray(p.rounds)||p.rounds.length>MAX_ROUNDS)throw Error('Invalid golfer identity');ids.add(p.id);const rounds=new Set();for(const r of p.rounds){if(!obj(r)||typeof r.id!=='string'||!courseOK(r.course)||rounds.has(r.id)||!integer(r.frame,0,2147483647)||typeof r.date!=='string'||r.date.length>80||!Array.isArray(r.holes)||r.holes.length<1||r.holes.length>18)throw Error('Invalid golfer round');rounds.add(r.id);let h=0;for(const v of r.holes){if(!obj(v)||v.hole!==++h||!integer(v.par,1,9)||!integer(v.score,1,127))throw Error('Invalid hole result');}}}
 for(const [slot,id]of Object.entries(s.bindings))if(!integer(+slot,1,75)||!ids.has(id)||s.people.find(p=>p.id===id)?.slot!==+slot)throw Error('Invalid profile binding');
 if(Object.keys(s.visits).length>152)throw Error('Too many active visits');for(const [actor,v]of Object.entries(s.visits)){if(!integer(+actor,0,151)||!obj(v)||!ids.has(v.person)||typeof v.birth!=='number'||!Number.isInteger(v.birth)||!courseOK(v.course)||!integer(v.last,0,18)||!Array.isArray(v.pars)||v.pars.length>18||v.pars.some(n=>!integer(n,1,9))||!Array.isArray(v.scores)||v.scores.length!==v.last||v.scores.some(n=>!integer(n,1,127))||typeof v.done!=='boolean'||(v.layout!==undefined&&v.layout!==''&&!/^[0-9a-f]{16}$/.test(v.layout)))throw Error('Invalid pending golfer round');}
 if(JSON.stringify(s).length>8000000)throw Error('Golfer history exceeds storage limit');return true;
}
function valid(s){try{return check(s);}catch(_){return false;}}
function create(data,career){check(data);let state=Object.keys(data).length?clone(data):empty();if(state.career&&state.career!==career)throw Error('Golfer history belongs to another career');state.career=career;
 function person(row){if(!row||!integer(row.slot,1,75)||typeof row.fingerprint!=='string'||!row.fingerprint||!row.name)return null;const prior=state.people.find(p=>p.id===state.bindings[row.slot]);if(prior?.fingerprint===row.fingerprint)return prior;if(state.people.length>=MAX_PEOPLE){state.limited=true;return null;}const p={id:career+'-'+state.next++,slot:row.slot,fingerprint:row.fingerprint,name:row.name,rounds:[]};state.people.push(p);state.bindings[row.slot]=p.id;return p;}
 function observe(row){const p=person(row);if(!p)return null;const v=state.visits[row.actor];if(v&&(v.person!==p.id))delete state.visits[row.actor];return p;}
 function invalidate(slot){delete state.bindings[slot];for(const [a,v]of Object.entries(state.visits))if(state.people.find(p=>p.id===v.person)?.slot===slot)delete state.visits[a];}
 function hole(e,onComplete,retain=true){const p=observe(e);if(!p||!courseOK(e.course)||!integer(e.hole,1,18)||!integer(e.score,1,127)||e.card[e.hole-1]!==e.score)return false;
 let v=state.visits[e.actor];if(!v){if(e.hole!==1||e.before.some(n=>n!==0))return false;v=state.visits[e.actor]={person:p.id,birth:e.birth,last:0,course:clone(e.course),pars:e.pars.slice(),scores:[],done:false};}
 if(v.done||JSON.stringify(v.course)!==JSON.stringify(e.course)||e.hole!==v.last+1||JSON.stringify(v.pars)!==JSON.stringify(e.pars)||e.hole>v.pars.length||v.scores.some((n,i)=>n!==e.card[i]))return false;
 // Layout observation is optional for the original Histories feature. An
 // inconsistent or missing layout rules out Records without losing Histories.
 if(onComplete)v.layout=v.last===0?e.layout||'':v.layout===e.layout?v.layout:'';
 v.scores.push(e.score);v.last=e.hole;
 if(e.ended&&v.last===v.pars.length){const id=p.id+':'+e.actor+':'+v.birth+':'+e.frame;v.done=true;
   if(p.rounds.some(r=>r.id===id))return false;
   const round={id,frame:e.frame,date:e.date,course:clone(v.course),holes:v.scores.map((score,i)=>({hole:i+1,par:v.pars[i],score}))};
   if(retain){p.rounds.push(round);if(p.rounds.length>MAX_ROUNDS)p.rounds.shift();}
   onComplete?.(p.id,p.name,round,v.layout||'');return true;}return false;
 }
 return {observe,hole,invalidate,depart:actor=>{delete state.visits[actor];},capture:()=>clone(state),identityState:()=>({
   version:state.version,career:state.career,next:state.next,
   people:state.people.map(p=>({...p,rounds:[]})),bindings:{...state.bindings},visits:{},limited:state.limited
 }),people:()=>clone(state.people),roster:()=>state.people.map(p=>({id:p.id,name:p.name,slot:p.slot})),person:id=>{const p=state.people.find(p=>p.id===id);return p?clone(p):null;},info:()=>({people:state.people.length,rounds:state.people.reduce((n,p)=>n+p.rounds.length,0),limited:state.limited}),pending:id=>{const v=Object.values(state.visits).find(v=>v.person===id&&!v.done);return v?clone(v):null;},summary:id=>{const p=state.people.find(p=>p.id===id),rounds=p?.rounds||[],totals=rounds.map(r=>r.holes.reduce((n,h)=>n+h.score,0));return {count:rounds.length,best:totals.length?Math.min(...totals):null,average:totals.length?totals.reduce((a,b)=>a+b,0)/totals.length:null,recent:rounds.at(-1)||null};}};
}
// Configuration changes can move the shared identity roster between these
// ledgers. Keep stable IDs and historical records, and start fresh live visits.
function reconfigure(oldGame,newGame,states,dormant){
 const ids=['golferHistories','clubRecords','golferExperiences'];
 const enabled=(game,id)=>game.features[id]?.enabled===true;
 if(!ids.some(id=>enabled(oldGame,id)!==enabled(newGame,id)))return;
 const envelopes=ids.map(id=>states[id]||dormant[id]);
 const [history,records,experiences]=envelopes.map(state=>state?.data);
 const rosters=[history,records?.identities,experiences?.identities];
 const owner=rosters[ids.findIndex(id=>enabled(oldGame,id))];
 const available=rosters.filter(roster=>roster?.version);
 const richest=[owner,...available].filter(roster=>roster?.version)
   .reduce((latest,roster)=>roster.next>latest.next?roster:latest,{next:0});
 const roster=create(richest.version?richest:{},newGame.id).identityState();
 const people=new Map(roster.people.map(person=>[person.id,person]));
 for(const other of available){
   const retained=create(other,newGame.id).identityState();
   for(const person of retained.people){
     const known=people.get(person.id);
     if(!known||known.slot!==person.slot||known.fingerprint!==person.fingerprint||known.name!==person.name)
       throw Error('The saved golfer identities cannot be safely combined.');
   }
 }
 if(envelopes[0]){
   const rounds=new Map((history.people||[]).map(person=>[person.id,person.rounds]));
   envelopes[0].data={...roster,people:roster.people.map(person=>({...person,rounds:rounds.get(person.id)||[]}))};
 }
 const historiesEnabled=enabled(newGame,ids[0]);
 if(envelopes[1]){
   const shares=enabled(newGame,ids[1])&&historiesEnabled;
   envelopes[1].data=records.version?{...records,identities:shares?null:roster}:
     g.SGClubRecordsModel.create({},newGame.id,shares?envelopes[0].data:undefined).capture(create(roster,newGame.id));
 }
 if(envelopes[2]){
   const shares=enabled(newGame,ids[2])&&(historiesEnabled||enabled(newGame,ids[1]));
   envelopes[2].data=experiences.version?{...experiences,identities:shares?null:roster}:
     g.SGGolferExperienceModel.prepare({},newGame.id,shares?roster:undefined).capture(create(roster,newGame.id));
 }
}
g.SGGolferHistoryModel=Object.freeze({create,valid,reconfigure,MAX_PEOPLE,MAX_ROUNDS});
})(globalThis);
