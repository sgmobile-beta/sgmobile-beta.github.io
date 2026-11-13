// Bounded, revision-owned records from the shared completed-round observer.
(function(global) {
  'use strict';
  const MAX_LAYOUTS = 64, MAX_FORMER = 6, MAX_RECENT = 24, MAX_HONORS = 48;
  const thresholds = [25, 50, 100];
  const copy = value => JSON.parse(JSON.stringify(value));
  const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const int = (value, lo, hi) => Number.isInteger(value) && value >= lo && value <= hi;
  const text = (value, limit) => typeof value === 'string' && value.length > 0 && value.length <= limit;
  const courseKey = course => course.property + ':' + course.template;
  const courseOK = c => object(c) && int(c.property, 0, 15) && int(c.template, 0, 15) && text(c.name, 129);
  const layoutOK = value => typeof value === 'string' && /^[0-9a-f]{16}$/.test(value);
  const kinds = /^(gross|relative):(9|18)$|^hole:([1-9]|1[0-8])$/;
  const trim = (items, limit) => { if (items.length > limit) items.splice(0, items.length - limit); };
  function title(kind) {
    const [type, n] = kind.split(':');
    if (type === 'gross') return 'Lowest ' + n + '-Hole Score';
    if (type === 'relative') return 'Best ' + n + '-Hole Score to Par';
    if (type === 'hole') return 'Hole ' + n + ' Best Score';
    if (type === 'ace') return 'First Recorded Hole-in-One';
    return n + ' Recorded Rounds';
  }
  function score(kind, value) {
    if (kind.startsWith('relative:')) return value === 0 ? 'Even par' : value > 0 ? '+' + value : String(value);
    return String(value);
  }
  function markOK(m) {
    return object(m) && text(m.person, 96) && text(m.name, 80) && text(m.round, 160) &&
      text(m.date, 80) && int(m.frame, 0, 2147483647) && int(m.value, -162, 2286);
  }
  function recordMarkOK(kind, mark) {
    if (!markOK(mark)) return false;
    const [type, size] = kind.split(':');
    if (type === 'hole') return int(mark.value, 1, 127);
    if (type === 'gross') return int(mark.value, +size, +size*127);
    if (type === 'relative') return int(mark.value, -8*size, 126*size);
    return type === 'ace' ? mark.value === 1 : type === 'rounds' && mark.value === +size;
  }
  function valid(data) {
    if (!object(data)) return false;
    if (!Object.keys(data).length) return true;
    const {identities, boards, clubs, recent, seen} = data;
    if (data.version !== 1 || !text(data.career, 80) || !Array.isArray(boards) || boards.length > MAX_LAYOUTS ||
        !object(clubs) || Object.keys(clubs).length > 16 || !Array.isArray(recent) || recent.length > MAX_RECENT ||
        !Array.isArray(seen) || seen.length > 32 || !seen.every(id => text(id, 160)) ||
        new Set(seen).size !== seen.length || typeof data.limited !== 'boolean') return false;
    if (identities !== null && (!global.SGGolferHistoryModel.valid(identities) ||
        !identities.people?.every(p => !p.rounds.length))) return false;
    const eventOK = event => object(event) && typeof event.kind === 'string' && recordMarkOK(event.kind,event) && courseOK(event.course) &&
      (kinds.test(event.kind) || /^(ace:[1-9]|ace:1[0-8]|rounds:(25|50|100))$/.test(event.kind)) &&
      (event.previous === undefined || (markOK(event.previous) && event.previous.value > event.value));
    const keys = new Set();
    for (const board of boards) {
      if (!object(board) || !courseOK(board.course) || !layoutOK(board.layout) || !object(board.records) ||
          !text(board.started, 80) || !int(board.length, 1, 18)) return false;
      const key = courseKey(board.course) + '/' + board.layout;
      if (keys.has(key)) return false;
      keys.add(key);
      for (const [kind, holders] of Object.entries(board.records)) {
        if (!kinds.test(kind) || !Array.isArray(holders) || !holders.length || holders.length > MAX_FORMER + 1 ||
            !holders.every((mark, i) => recordMarkOK(kind,mark) && (!i || (mark.value < holders[i-1].value && mark.frame >= holders[i-1].frame)))) return false;
        const [type, n] = kind.split(':');
        if ((type === 'hole' && +n > board.length) || (type !== 'hole' && +n !== board.length)) return false;
      }
    }
    for (const [key, club] of Object.entries(clubs)) {
      if (!object(club) || !courseOK(club.course) || key !== courseKey(club.course) ||
          !object(club.people) || Object.keys(club.people).length > 150 ||
          !Array.isArray(club.honors) || club.honors.length > MAX_HONORS ||
          !club.honors.every(event => eventOK(event) && courseKey(event.course) === key)) return false;
      for (const entry of Object.values(club.people)) {
        if (!object(entry) || !markOK(entry) || !int(entry.count, 1, 1e9) || typeof entry.ace !== 'boolean') return false;
      }
    }
    return recent.every(eventOK) && JSON.stringify(data).length <= 6000000;
  }

  function validateCareer(data, career, history) {
    if (!valid(data) || (data.career && data.career !== career)) throw Error('Invalid club records for this career');
    const shared = history !== undefined;
    if (data.version && (shared ? data.identities !== null : !data.identities)) throw Error('Unexpected club record identity owner');
    const identities = shared ? history : data.identities || {};
    if (identities.career && identities.career !== career) throw Error('Club records belong to another career');
    const known = new Set((identities.people || []).map(person => person.id));
    const verify = mark => {
      if (!known.has(mark.person) || (mark.previous && !known.has(mark.previous.person))) throw Error('Unknown club record holder');
    };
    for (const board of data.boards || []) {
      const club = data.clubs[courseKey(board.course)];
      if (!club) throw Error('Missing club participation records');
      for (const holders of Object.values(board.records)) for (const mark of holders) {
        verify(mark);
        if (!club.people[mark.person]) throw Error('Missing club record participation');
      }
    }
    for (const club of Object.values(data.clubs || {})) {
      for (const [id, entry] of Object.entries(club.people)) {
        if (id !== entry.person) throw Error('Club participation identity mismatch');
        verify(entry);
      }
      club.honors.forEach(verify);
    }
    (data.recent || []).forEach(verify);
    return true;
  }

  function create(data, career, history) {
    validateCareer(data, career, history);
    const state = copy(data.version ? data : {version:1,career,identities:null,boards:[],clubs:{},recent:[],seen:[],limited:false});
    const identity = history === undefined ? global.SGGolferHistoryModel.create(state.identities || {}, career) : null;
    function complete(person, name, round, layout) {
      if (!layoutOK(layout) || !courseOK(round.course) || !int(round.holes.length,1,18) ||
          round.holes.some((hole, i) => hole.hole !== i+1 || !int(hole.score, 1, 127) || !int(hole.par, 1, 9)) ||
          state.seen.includes(round.id)) return null;
      const {course, holes, date, frame} = round, key = courseKey(course);
      if (!state.clubs[key] && Object.keys(state.clubs).length >= 16) { state.limited = true; return null; }
      state.seen.push(round.id);trim(state.seen, 32);
      const base = {person,name,round:round.id,date,frame};
      const club = state.clubs[key] ||= {course,people:{},honors:[]};
      club.course = course;
      const earlier = club.people[person];
      const count = (earlier?.count || 0) + 1;
      const ace = holes.find(hole => hole.score === 1);
      club.people[person] = {...base,value:1,count,ace:!!ace || !!earlier?.ace};
      const events = [];
      function add(kind, value, previous) {
        const event = {...base,kind,value,course};
        if (previous) event.previous = previous;
        events.push(event);
      }
      if (ace && !earlier?.ace) add('ace:' + ace.hole, 1);
      if (thresholds.includes(count)) add('rounds:' + count, count);
      club.honors.push(...events);trim(club.honors, MAX_HONORS);
      let board = state.boards.find(b => courseKey(b.course) === key && b.layout === layout);
      if (!board && state.boards.length < MAX_LAYOUTS) {
        board = {course,layout,length:holes.length,started:date,records:{}};
        state.boards.push(board);
      }
      if (!board) state.limited = true;
      else if (board.length === holes.length) {
        function lower(kind, value, announce) {
          const holders = board.records[kind] ||= [];
          const current = holders.at(-1);
          if (current && current.value <= value) return;
          holders.push({...base,value});trim(holders, MAX_FORMER + 1);
          if (announce) add(kind, value, current);
        }
        if (holes.length === 9 || holes.length === 18) {
          lower('gross:' + holes.length, holes.reduce((n,h) => n+h.score, 0), true);
          lower('relative:' + holes.length, holes.reduce((n,h) => n+h.score-h.par, 0), false);
        }
        for (const hole of holes) lower('hole:' + hole.hole, hole.score, false);
      }
      state.recent.push(...events);trim(state.recent, MAX_RECENT);
      return events.find(event => event.kind.startsWith('gross:') && event.previous) || events[0] || null;
    }
    function view(course) {
      const key = courseKey(course);
      return copy({course,boards:state.boards.filter(b => courseKey(b.course) === key),
        club:state.clubs[key] || null,recent:state.recent.filter(e => courseKey(e.course) === key),limited:state.limited});
    }
    function honorsFor(course, person) {
      const key = courseKey(course), honors = new Set();
      for (const board of state.boards) if (courseKey(board.course) === key)
        for (const [kind, holders] of Object.entries(board.records))
          if (holders.some(holder => holder.person === person))
            honors.add((holders.at(-1).person === person ? 'Current holder · ' : 'Former holder · ') + title(kind));
      for (const event of state.clubs[key]?.honors || []) if (event.person === person) honors.add(title(event.kind));
      return [...honors];
    }
    return {identity,complete,view,honorsFor,capture:model=>copy({...state,identities:history === undefined ? model.capture() : null})};
  }

  global.SGClubRecordsModel = Object.freeze({valid,validateCareer,create,title,score,MAX_LAYOUTS,MAX_FORMER,MAX_RECENT,MAX_HONORS});
})(globalThis);
