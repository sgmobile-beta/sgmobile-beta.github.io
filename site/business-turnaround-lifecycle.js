(function(global){
'use strict';
// Own observations only for the committed, enabled Enhanced career.
function attachBusinessTurnaroundLifecycle(Module) {
  const {createBusinessTurnaround,validBusinessTurnaround,seasonLength,maxFrame}=global.SGBusinessTurnaroundModel;
  const id = 'businessChallenges';
  const rules = Module.saveRules;
  const propertyReset = 0x442223;
  const propertyOffset = 0x59bf90;
  const frameOffset = 0x834170;
  const flagsOffset = 0x59e7b8;
  const firstHole = 0x575ab0;
  let runtime = null;
  const counts = {posts:0, acceptedPosts:0, boundaries:0, acceptedBoundaries:0, nativeResets:0, propertyChanges:0};
  let lastPost = null, lastBoundary = null, lastReset = null;
  const isProperty = value => Number.isInteger(value) && value >= 0 && value < 16;
  const readingSave = () => !!(Module.loadState?.active || Module.courseLoading?.active);
  const ownsCareer = () => !!(runtime && rules.hasFeature(id) &&
    runtime.career === rules.active?.game.id && Module.gameEdition === 'enhanced' && !Module.atTitle);

  function nativeInt(offset) {
    const heap = Module.HEAPU8;
    if (!heap || heap.byteLength < offset + 4) return null;
    return new DataView(heap.buffer, heap.byteOffset, heap.byteLength).getInt32(offset, true);
  }

  // The original reset callback precedes the property write. No observation
  // from the old map can enter the model after a proven purchase is pending.
  // Save capture can occur with the course hidden, so use committed identity.
  function synchronize(property = nativeInt(propertyOffset)) {
    if (!ownsCareer() || readingSave() || !isProperty(property)) return false;
    if (runtime.pending !== null) {
      if (property !== runtime.pending) return false;
      runtime.pending = null;
    }
    if (runtime.property !== null && property !== runtime.property) {
      runtime.model.reset();
      runtime.property = null;
      counts.propertyChanges++;
    }
    return true;
  }

  function capture() {
    if (!runtime) return null;
    synchronize();
    return runtime.model.capture();
  }

  rules.register(id, {
    validate: validBusinessTurnaround,
    prepare(data, game) {
      return {model:createBusinessTurnaround(data), career:game.id, property:data.active?.property ?? null, pending:null};
    },
    activate(prepared) {
      runtime = prepared;
      Module.businessChallengeProbe = probe;
    },
    capture,
    dispose() {
      runtime = null;
      if (Module.businessChallengeProbe === probe) delete Module.businessChallengeProbe;
    }
  });

  const reconfigure = Module.reconfigureGolferStates;
  Module.reconfigureGolferStates = function (oldGame, newGame, states, dormant) {
    reconfigure?.call(this, oldGame, newGame, states, dormant);
    const state = states[id]?.data;
    if (oldGame.features[id]?.enabled || !newGame.features[id]?.enabled || !state?.active) return;
    const resumed = createBusinessTurnaround(state);
    const property = nativeInt(propertyOffset);
    if (isProperty(property) && !readingSave() && property !== state.active.property) resumed.reset();
    else resumed.interrupt();
    states[id].data = resumed.capture();
  };

  const ready = () => ownsCareer() && !readingSave() && !!Module.mobileState?.course && !Module.rulesetBlocked;
  const observe = event => ready() && event.property === nativeInt(propertyOffset) && synchronize(event.property);
  const probe = {
    post(event) {
      if (!observe(event)) return false;
      counts.posts++;
      const accepted = runtime.model.post(event);
      if (accepted) counts.acceptedPosts++;
      lastPost = {event, accepted};
      return accepted;
    },
    boundary(event) {
      if (!observe(event)) return false;
      counts.boundaries++;
      const before = runtime.model.capture();
      const accepted = runtime.model.boundary(event);
      if (accepted) {
        counts.acceptedBoundaries++;
        const state = runtime.model.capture();
        if (!state.active) runtime.property = null;
        const status = state.medal && !before.medal ? 'completed' :
          state.active?.baseline && !before.active?.baseline ? 'baseline-locked' : null;
        if (status && typeof global.dispatchEvent === 'function' && typeof global.CustomEvent === 'function') {
          global.dispatchEvent(new global.CustomEvent('simgolf-business-turnaround-change', {detail:{status}}));
        }
      }
      lastBoundary = {event, accepted};
      return accepted;
    },
    reset(event) {
      counts.nativeResets++;
      const destination = Module.locationResult?.record;
      const loading = readingSave();
      const staged = ownsCareer() && !loading && runtime.property !== null &&
        event.site === propertyReset && event.frame === 0 && event.property === runtime.property &&
        event.property === nativeInt(propertyOffset) && isProperty(destination) && destination !== event.property;
      if (staged) runtime.pending = destination;
      lastReset = {event, loading, staged:!!staged, destination:destination ?? null};
      return !!staged;
    }
  };

  function startState() {
    if (!ready()) return {reason:'course-unavailable'};
    if (nativeInt(flagsOffset) & 0x5000000) return {reason:'ordinary-career-required'};
    const site = nativeInt(propertyOffset), time = nativeInt(frameOffset);
    if (!synchronize(site)) return {reason:'course-unavailable'};
    const state = runtime.model.capture();
    if (state.medal) return {reason:'medal-earned'};
    if (state.active) return {reason:'already-active'};
    let openHoles = 0;
    for (let hole = 1; hole <= 18; hole++) {
      const par = Module.HEAPU8[firstHole + hole * 520];
      if (par >= 2 && par <= 6) openHoles++;
      else if (par !== 0) return {reason:'open-hole-required'};
    }
    if (!openHoles) return {reason:'open-hole-required'};
    if (!runtime.model.canStart(site, time, openHoles)) return {reason:'calendar-unavailable'};
    return {site, time, openHoles};
  }

  return {
    start(property, frame, holes) {
      const {reason, site, time, openHoles} = startState();
      if (reason || (property !== undefined && property !== site) || (frame !== undefined && frame !== time) ||
          (holes !== undefined && holes !== openHoles)) return false;
      const started = runtime.model.start(site, time, openHoles);
      if (started) runtime.property = site;
      return started;
    },
    capture,
    progress() {
      if (!ready() || !synchronize()) return null;
      const time = nativeInt(frameOffset);
      const start = Number.isInteger(time) && time >= 0 && time < maxFrame ?
        time - time % seasonLength : null;
      return {start, end:start === null ? null : start + seasonLength,
        rejection:runtime.model.rejection()};
    },
    abandon() {
      if (!ready() || !synchronize() || !runtime.model.abandon()) return false;
      runtime.property = null;
      return true;
    },
    diagnostic() {
      const {reason} = startState();
      return {career:runtime?.career ?? null, observing:ready(), pendingProperty:runtime?.pending ?? null,
        canStart:!reason, startUnavailable:reason ?? null, ...counts, lastPost, lastBoundary, lastReset};
    }
  };
}

global.SGBusinessTurnaroundLifecycle=Object.freeze({attachBusinessTurnaroundLifecycle});
const Module=global.Module;
if (Module?.saveRules && Module.featureRegistry?.get('businessChallenges')?.available) {
  Module.businessTurnaround=attachBusinessTurnaroundLifecycle(Module);
}
})(globalThis);
