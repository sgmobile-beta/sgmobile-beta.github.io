// Shared Course Review content for the Enhanced panel and the original year-end report.
(function(){
  'use strict';
  const groups=[
    {sign:1,label:'Praise',empty:'No positive reactions recorded yet.',highlight:'Most recorded praise'},
    {sign:-1,label:'Complaints',empty:'No negative reactions recorded yet.',highlight:'Most recorded criticism'}
  ];
  const number=new Intl.NumberFormat('en-US');
  const style=document.createElement('style');
  style.textContent=`
    .course-review-results{color:var(--menu-text);font:15px/1.4 system-ui,sans-serif;overflow-wrap:anywhere}
    .course-review-results :is(h2,h3,h4,p,ul,dl){margin:0}
    .course-review-results h2{font-size:19px}
    .course-review-results h3{font-size:16px}
    .course-review-results h4{font-size:13px}
    .course-review-results .course-review-note{margin:4px 0 9px;color:var(--menu-muted);font-size:13px}
    .course-review-year{margin-top:12px;padding:9px;border:1px solid var(--menu-border);border-radius:10px;background:#fffef0}
    .course-review-grid,.course-review-highlights{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:7px}
    .course-review-highlights{margin:0 0 9px}
    .course-review-grid article,.course-review-highlights article{min-width:0;padding:7px 9px;border:1px solid #ded9e7;border-radius:8px;background:#fffef0}
    .course-review-highlights article{background:var(--menu-preview)}
    .course-review-hole-title{display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:2px 7px}
    .course-review-hole-title span{color:var(--menu-muted);font-size:13px}
    .course-review-results .course-review-metrics{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}
    .course-review-metrics div{flex:1 1 auto;padding:4px 6px;border-radius:6px;background:var(--menu-preview)}
    .course-review-metrics dt{font-size:12px;color:var(--menu-muted)}
    .course-review-metrics dd{margin:0;font-size:16px;font-weight:650;font-variant-numeric:tabular-nums}
    .course-review-results .course-review-components{margin-bottom:6px;color:var(--menu-muted);font-size:12px}
    .course-review-results .course-review-reactions{padding-top:5px;border-top:1px solid #ded9e7}
    .course-review-reactions + .course-review-reactions{margin-top:5px}
    .course-review-positive h4,.course-review-positive h3{color:#155239}
    .course-review-negative h4,.course-review-negative h3{color:#8d2b26}
    .course-review-results ul{list-style:none;padding:0}
    .course-review-results li+li{margin-top:3px}
    .course-review-count{display:inline-block;margin-left:5px;padding:0 4px;border-radius:4px;background:#e8e4f5;font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap}
    .course-review-results summary{box-sizing:border-box;min-height:44px;padding:11px 8px;border:1px solid var(--menu-border);border-radius:7px;background:var(--menu-button);cursor:pointer;touch-action:manipulation;font-weight:600}
    .course-review-results summary:focus-visible{outline:3px solid var(--menu-focus);outline-offset:2px}
    .course-review-results details[open]>summary{margin-bottom:7px}
    .course-review-hole-title::marker{content:''}
    summary.course-review-hole-title::after{content:'▸';margin-left:auto}
    details[open]>summary.course-review-hole-title::after{content:'▾'}
    .course-review-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
    .course-review-actions button:disabled{opacity:.65}
    @media(max-height:460px){.course-review-year,.course-review-grid article,.course-review-highlights article{padding:6px 8px}.course-review-year{margin-top:7px}}
  `;
  document.head.append(style);

  function element(tag,text,className){
    const node=document.createElement(tag);
    if(text!==undefined)node.textContent=text;
    if(className)node.className=className;
    return node;
  }
  function rating(value,digits){
    return Number.isFinite(value)?value.toFixed(digits):'Unavailable';
  }
  function metric(label,value){
    const row=element('div');
    row.append(element('dt',label),element('dd',value));
    return row;
  }
  function addCount(row,count){
    if(!Number.isInteger(count)||count<1)return;
    const value=element('span','×'+number.format(count),'course-review-count');
    value.setAttribute('aria-label','Recorded '+number.format(count)+' '+(count===1?'time':'times'));
    row.append(value);
  }
  function sentiment(sign){
    return sign===1?'course-review-positive':'course-review-negative';
  }
  function reactionRows(card,entries){
    for(const group of groups){
      const matches=entries.filter(entry=>entry.sign===group.sign).sort((a,b)=>b.count-a.count);
      const section=element('div',undefined,'course-review-reactions '+sentiment(group.sign));
      section.append(element('h4',group.label));
      if(matches.length){
        const list=element('ul');
        for(const entry of matches){
          const item=element('li',entry.text);
          addCount(item,entry.count);
          list.append(item);
        }
        section.append(list);
      }else{
        section.append(element('p',group.empty,'course-review-note'));
      }
      card.append(section);
    }
  }
  function holeCard(hole,action){
    const card=element('article'),heading=element(action?'summary':'div',undefined,'course-review-hole-title');
    const layout='Par '+hole.par+(Number.isFinite(hole.yards)?' · '+number.format(hole.yards)+' yd':'');
    heading.append(element(action?'strong':'h3','Hole '+hole.hole),element('span',layout));
    const details=action?element('details'):card;
    if(action){details.dataset.hole=String(hole.hole);card.append(details);}
    const stats=element('dl',undefined,'course-review-metrics');
    stats.append(metric('Fun',rating(hole.fun,0)),metric('Skill',rating(hole.skill,2)));
    const finishes=Number.isInteger(hole.finishes)?number.format(hole.finishes):'Unavailable';
    stats.append(metric('Avg. score',hole.averageText??'—'),metric('Recorded scores',finishes));
    details.append(heading,stats);
    if(hole.belowHoleStats)details.append(element('p',SGCourseAnalytics.holeStatsSampleNote(hole.belowHoleStats),'course-review-note'));
    if([hole.length,hole.accuracy,hole.imagination].every(Number.isFinite)){
      const values=[['Length',hole.length],['Accuracy',hole.accuracy],['Imagination',hole.imagination]];
      details.append(element('p',values.map(([label,value])=>label+' '+rating(value,2)).join(' · '),'course-review-components'));
    }
    if(Array.isArray(hole.comments))reactionRows(details,hole.comments);
    else details.append(element('p','Recorded reactions are unavailable for this hole.','course-review-note'));
    if(action){
      const links=element('div',undefined,'course-review-actions');
      for(const [feature,label] of [['courseAnalytics','View Analytics'],['courseDesignLab','Open Design Lab']]){
        if(!Module.hasGameFeature(feature))continue;
        const button=element('button',label);button.type='button';
        button.dataset.reviewAction=feature;
        button.onclick=()=>action(feature,hole.hole,button);links.append(button);
      }
      if(links.childElementCount)details.append(links);
      if(Module.hasGameFeature('courseDesignLab')){
        const note=element('p','','course-review-note');note.dataset.labIssue='';details.append(note);
      }
    }
    return card;
  }
  function annualHighlights(holes){
    const highlights=element('div',undefined,'course-review-highlights');
    for(const group of groups){
      let leading=null;
      for(const hole of holes){
        for(const comment of hole.comments||[]){
          if(comment.sign===group.sign&&(!leading||comment.count>leading.comment.count))leading={hole:hole.hole,comment};
        }
      }
      if(!leading)continue;
      const card=element('article',undefined,sentiment(group.sign));
      const row=element('p','Hole '+leading.hole+' · '+leading.comment.text);
      addCount(row,leading.comment.count);
      card.append(element('h3',group.highlight),row);
      highlights.append(card);
    }
    return highlights;
  }
  function routeKey(hole){
    const heap=Module.HEAPU8,course=Module.originalCourseObservations?.course();
    if(!heap||!course||!Number.isInteger(hole)||hole<1||hole>18)return null;
    const at=0x575ab0+hole*520;
    if(!(heap[at]>=1&&heap[at]<=9))return null;
    return [course.property,course.template,heap[at],...heap.subarray(at+4,at+32)].join(',');
  }
  // A single return edge belongs to the destination for this exact open hole
  // and active career. Keeping it out of save state also bounds its lifetime.
  Module.courseHoleContext=(hole,source,target,resume)=>{
    const owner=Module.saveRules?.active,route=routeKey(hole);
    const valid=()=>!!(owner&&route&&owner===Module.saveRules?.active&&
      Module.hasGameFeature(source)&&Module.hasGameFeature(target)&&route===routeKey(hole));
    return {valid,back:()=>valid()&&resume()};
  };
  Module.refreshCourseReviewActions=container=>{
    for(const button of container.querySelectorAll('[data-review-action=courseDesignLab]')){
      const details=button.closest('details');
      const issue=Module.courseDesignLabHoleIssue(Number(details.dataset.hole));
      button.disabled=!!issue;
      const note=details.querySelector('[data-lab-issue]');
      note.textContent=issue;note.hidden=!issue;
    }
  };
  Module.renderCourseReview=function(container,snapshot,{annual=false,action=null}={}){
    const root=element('section',undefined,'course-review-results'+(annual?' course-review-year':''));
    if(annual)root.append(element('h2','Course Review'));
    container.replaceChildren(root);
    if(!snapshot){
      root.append(element('p','Course Review data is unavailable.','course-review-note'));
      return;
    }
    const holes=snapshot.holes;
    if(!holes.length){
      root.append(element('p','Open a hole to review how it plays.','course-review-note'));
      return;
    }
    const period=annual?'Year-end snapshot. ':'';
    root.append(element('p',period+'Recorded scores count completed holes. Reaction counts include repeat visits and can reflect earlier seasons or layouts. They can fade or reset. Skill shows each hole’s contribution to the course rating.','course-review-note'));
    const grid=element('div',undefined,'course-review-grid');
    for(const hole of holes)grid.append(holeCard(hole,action));
    let cards=root;
    if(annual){
      const highlights=annualHighlights(holes);
      if(highlights.childElementCount)root.append(highlights);
      else if(holes.every(hole=>Array.isArray(hole.comments)))
        root.append(element('p','No positive or negative reactions have been recorded on these holes yet.','course-review-note'));
      cards=element('details');
      cards.append(element('summary','View '+holes.length+' open '+(holes.length===1?'hole':'holes')));
      root.append(cards);
    }
    cards.append(grid);
    if(holes.some(hole=>hole.averageText!==null))
      cards.append(element('p','The original score bins count any score of 9 or higher as 9.','course-review-note'));
    if(action)Module.refreshCourseReviewActions(container);
  };
})();
