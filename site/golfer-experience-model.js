// Revision-owned native comment records. The profile model owns identities.
(function(global) {
  'use strict';
  const MAX_COMMENTS = 24;
  const MAX_PEOPLE = 150;
  const MAX_BYTES = 3500000;
  const clone = value => JSON.parse(JSON.stringify(value));
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
  const string = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;

  function validEvent(event) {
    return object(event) && integer(event.frame, 0, 2147483647) &&
      integer(event.hole, 1, 18) && integer(event.stroke, 0, 9) &&
      integer(event.sign, -1, 1) && string(event.text, 511) &&
      string(event.course, 129) && string(event.date, 80);
  }

  function valid(data) {
    if (!object(data)) return false;
    if (!Object.keys(data).length) return true;
    if (data.version !== 1 || !string(data.career, 80) || !object(data.comments)) return false;
    if (data.identities !== null && (!global.SGGolferHistoryModel.valid(data.identities) ||
        !data.identities.people?.every(person => !person.rounds.length) ||
        Object.keys(data.identities.visits).length)) return false;
    const entries = Object.entries(data.comments);
    return entries.length <= MAX_PEOPLE && entries.every(([id, comments]) =>
      id.startsWith(data.career + '-') && id.length <= 96 && Array.isArray(comments) &&
      comments.length > 0 && comments.length <= MAX_COMMENTS && comments.every(validEvent)
    ) && JSON.stringify(data).length <= MAX_BYTES;
  }

  function validateCareer(data, career, historyState) {
    if (!valid(data) || (data.career && data.career !== career))
      throw Error('Invalid golfer experiences for this career');
    const sharing = historyState !== undefined;
    if (data.version && (sharing ? data.identities !== null : !data.identities))
      throw Error('Unexpected golfer identity owner');
    const identities = sharing ? historyState : data.identities || {};
    if (identities.career && identities.career !== career)
      throw Error('Golfer identity belongs to a different career');
    const known = new Set((identities.people || []).map(person => person.id));
    if (Object.keys(data.comments || {}).some(id => !known.has(id)))
      throw Error('Golfer comment belongs to an unknown identity');
    return true;
  }

  function prepare(data, career, historyState) {
    validateCareer(data, career, historyState);
    const sharing = historyState !== undefined;
    const identity = sharing ? null : global.SGGolferHistoryModel.create(data.identities || {}, career);
    const entries = Object.entries(data.comments || {});
    const comments = new Map(clone(entries));
    return {
      identity,
      record(id, event) {
        if (!validEvent(event)) return;
        const recent = comments.get(id) || [];
        recent.push(event);
        if (recent.length > MAX_COMMENTS) recent.shift();
        comments.set(id, recent);
      },
      recent: id => comments.get(id) || [],
      capture: model => ({
        version: 1,
        career,
        identities: sharing ? null : model.identityState(),
        comments: Object.fromEntries(comments)
      })
    };
  }

  // The original card paints an 80-pixel bar, then darkens the right-hand remainder.
  function meters(fun, historyFlags, energy, hunger, thirst) {
    const clamp = n => Math.max(0, Math.min(80, Math.trunc(n)));
    let attitude = 0;
    for (const entry of historyFlags) {
      const bits = entry & 0xc000;
      if (bits === 0x4000) attitude++;
      if (bits === 0xc000) attitude--;
    }
    return [(8 - fun) * 10, (4 - attitude) * 10, energy / 4, hunger * 5 / 2, thirst * 5 / 2]
      .map(remainder => 80 - clamp(remainder));
  }

  function performance(rounds) {
    const last = rounds.at(-1);
    if (!last) return null;
    const sameCourse = round => round.course.property === last.course.property &&
      round.course.template === last.course.template && round.course.name === last.course.name;
    const comparable = rounds.filter(round => sameCourse(round) &&
      round.holes.length === last.holes.length &&
      round.holes.every((hole, i) => hole.par === last.holes[i].par));
    if (comparable.length < 2 || last.holes.length < 2) return null;
    const holes = last.holes.map((hole, i) => ({
      hole: hole.hole,
      average: comparable.reduce((sum, round) => sum + round.holes[i].score - hole.par, 0) / comparable.length
    })).sort((a, b) => a.average - b.average);
    if (holes[0].average === holes.at(-1).average) return null;
    return {course: last.course.name, count: comparable.length, best: holes[0], worst: holes.at(-1)};
  }

  global.SGGolferExperienceModel = Object.freeze({valid, validateCareer, prepare, meters, performance});
})(globalThis);
