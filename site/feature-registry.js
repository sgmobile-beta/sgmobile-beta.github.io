// Central Enhanced definitions and pure configuration policy. No engine calls,
// storage, DOM or runtime feature activation. Native IDs are checked from the
// exact JSON block by tools/release/feature_ids.py; retain their numeric values.
(function(global){
  'use strict';
  const definitions = /* SG_FEATURE_DEFINITIONS_BEGIN */
{
  "categories": [
    {
      "id": "controls",
      "name": "Game Controls & Convenience"
    },
    {
      "id": "construction",
      "name": "Course Design & Construction"
    },
    {
      "id": "clubLife",
      "name": "Golfers & Club Life"
    },
    {
      "id": "operations",
      "name": "Business & Course Operations"
    },
    {
      "id": "progression",
      "name": "Tournaments & Progression"
    },
    {
      "id": "environment",
      "name": "Environment & Course Conditions"
    },
    {
      "id": "community",
      "name": "Community & Sharing"
    }
  ],
  "features": [
    {
      "id": "gameSpeed",
      "name": "Faster game speeds",
      "category": "controls",
      "description": "Choose 1\u00d7, 2\u00d7, 3\u00d7, 5\u00d7 or 10\u00d7 speed for quicker play, plus device-limited 20\u00d7, 50\u00d7 and 100\u00d7 testing speeds.",
      "icon": "speed",
      "featureVersion": "1.2.0",
      "schemaVersion": 1,
      "available": true,
      "defaultEnabled": true,
      "requires": [],
      "integrations": [],
      "conflicts": [],
      "affectsSimulation": true,
      "requiresPersistentState": false,
      "mutableDuringPlay": true,
      "saveCompatibility": {
        "supportedSchemas": [
          1
        ],
        "supportedStateSchemas": [
          1
        ],
        "policy": "native-compatible"
      },
      "discovery": {
        "menu": "Main menu",
        "controls": "Tap the speed button below Menu and select a rate. Pause is included when Pause control is enabled.",
        "screen": null,
        "gameplay": "Speeds the simulation; original gameplay remains at 1\u00d7 when disabled."
      },
      "native": {
        "symbol": "SIMGOLF_FEATURE_SPEED",
        "index": 0
      },
      "playContexts": [
        "career",
        "championship"
      ]
    },
    {
      "id": "pauseControl",
      "name": "Pause control",
      "category": "controls",
      "description": "Open Menu, tap the Game speed button, then choose Pause.",
      "icon": "pause",
      "featureVersion": "1.0.0",
      "schemaVersion": 1,
      "available": true,
      "defaultEnabled": true,
      "requires": [],
      "integrations": [],
      "conflicts": [],
      "affectsSimulation": true,
      "requiresPersistentState": false,
      "mutableDuringPlay": true,
      "saveCompatibility": {
        "supportedSchemas": [
          1
        ],
        "supportedStateSchemas": [
          1
        ],
        "policy": "native-compatible"
      },
      "discovery": {
        "menu": "Menu → Game speed → Pause",
        "controls": "Tap the button that shows your current speed, then choose Pause.",
        "screen": null,
        "gameplay": "Allows pausing through the mobile controls. Change this permission from Enhanced Settings while the course is idle."
      },
      "native": {
        "symbol": "SIMGOLF_FEATURE_PAUSE",
        "index": 1
      },
      "playContexts": [
        "career",
        "championship"
      ]
    },
    {
      "id": "clubhouseRelocation",
      "name": "Clubhouse relocation",
      "category": "construction",
      "description": "Move your starting clubhouse to a new location. Original replacement costs still apply.",
      "icon": "clubhouse",
      "featureVersion": "1.0.0",
      "schemaVersion": 1,
      "available": true,
      "defaultEnabled": true,
      "requires": [],
      "integrations": [],
      "conflicts": [],
      "affectsSimulation": true,
      "requiresPersistentState": false,
      "mutableDuringPlay": true,
      "saveCompatibility": {
        "supportedSchemas": [
          1
        ],
        "supportedStateSchemas": [
          1
        ],
        "policy": "native-compatible"
      },
      "discovery": {
        "menu": "Build \u2192 Course",
        "controls": "Choose Remove / Undo, tap the clubhouse and confirm, then place its replacement.",
        "screen": null,
        "gameplay": "Allows replacing the original clubhouse. Existing demolition and replacement costs apply."
      },
      "native": {
        "symbol": "SIMGOLF_FEATURE_CLUBHOUSE",
        "index": 2
      },
      "playContexts": [
        "career"
      ]
    },
    {
      "id": "courseAnalytics",
      "name": "Course Analytics & Heatmaps",
      "category": "construction",
      "description": "Explore hole performance, golfer activity, and course heatmaps to understand how your golf course actually plays.",
      "icon": "analytics",
      "featureVersion": "1.0.0",
      "schemaVersion": 1,
      "available": true,
      "defaultEnabled": false,
      "requires": [],
      "integrations": [],
      "conflicts": [],
      "affectsSimulation": false,
      "requiresPersistentState": false,
      "mutableDuringPlay": true,
      "saveCompatibility": {
        "supportedSchemas": [
          1
        ],
        "supportedStateSchemas": [
          1
        ],
        "policy": "native-observations"
      },
      "discovery": {
        "menu": "Menu \u2192 Enhanced \u2192 Course Analytics",
        "controls": "Choose a hole and a map layer; focus, pan, zoom or rotate the live course.",
        "screen": "Course Analytics",
        "gameplay": "Read-only native score bins and decaying tile activity. No custom shot history."
      },
      "native": {
        "symbol": "SIMGOLF_FEATURE_ANALYTICS",
        "index": 3
      },
      "playContexts": [
        "career"
      ]
    },
    {
      "id": "golferHistories",
      "name": "Golfer Profiles & Histories",
      "category": "clubLife",
      "description": "Follow individual golfers, review their rounds and performance, and watch their histories develop as they play your course.",
      "icon": "history",
      "featureVersion": "1.0.0",
      "schemaVersion": 1,
      "available": true,
      "defaultEnabled": false,
      "requires": [],
      "integrations": [
        "courseAnalytics"
      ],
      "conflicts": [],
      "affectsSimulation": false,
      "requiresPersistentState": true,
      "mutableDuringPlay": true,
      "saveCompatibility": {
        "supportedSchemas": [
          1
        ],
        "supportedStateSchemas": [
          1
        ],
        "policy": "career-revision-history"
      },
      "discovery": {
        "menu": "Golfer information \u2192 Profiles & Histories; Menu \u2192 Enhanced \u2192 Golfer Histories",
        "controls": "Open an original golfer card or the tracked golfer roster. Close returns to the original screen.",
        "screen": "Golfer Profiles & Histories",
        "gameplay": "Read-only identity-checked regular golfer profiles and newly observed completed rounds; excludes tournament substitutes."
      },
      "native": {
        "symbol": "SIMGOLF_FEATURE_HISTORIES",
        "index": 4
      },
      "playContexts": [
        "career"
      ]
    },
    {
      "id": "golferExperiences",
      "name": "Golfer Experiences & Preferences",
      "category": "clubLife",
      "description": "Discover how individual golfers experience your course, including their performances, verified reactions, and changing preferences.",
      "icon": "history",
      "featureVersion": "1.0.0",
      "schemaVersion": 1,
      "available": true,
      "defaultEnabled": false,
      "requires": [],
      "integrations": [
        "golferHistories",
        "courseAnalytics"
      ],
      "conflicts": [],
      "affectsSimulation": false,
      "requiresPersistentState": true,
      "mutableDuringPlay": true,
      "saveCompatibility": {
        "supportedSchemas": [
          1
        ],
        "supportedStateSchemas": [
          1
        ],
        "policy": "career-revision-observations"
      },
      "discovery": {
        "menu": "Menu \u2192 Enhanced \u2192 Golfer Experiences",
        "controls": "Open Experiences from an original golfer card or choose a golfer from the tracked roster.",
        "screen": "Golfer Experiences & Preferences",
        "gameplay": "Read individual native comments, current card meters and original profile interests."
      },
      "native": {
        "symbol": "SIMGOLF_FEATURE_EXPERIENCES",
        "index": 5
      },
      "playContexts": [
        "career"
      ]
    },
    {
      "id": "clubRecords",
      "name": "Club Records & Hall of Fame",
      "category": "clubLife",
      "description": "Track your course's greatest performances, record holders, memorable golfers, and historical accomplishments.",
      "icon": "history",
      "featureVersion": "1.0.0",
      "schemaVersion": 1,
      "available": true,
      "defaultEnabled": false,
      "requires": [],
      "integrations": [
        "golferHistories",
        "golferExperiences",
        "courseAnalytics"
      ],
      "conflicts": [],
      "affectsSimulation": false,
      "requiresPersistentState": true,
      "mutableDuringPlay": true,
      "saveCompatibility": {
        "supportedSchemas": [
          1
        ],
        "supportedStateSchemas": [
          1
        ],
        "policy": "career-revision-records"
      },
      "discovery": {
        "menu": "Menu \u2192 Enhanced \u2192 Club Records & Hall of Fame",
        "controls": "Browse course records, previous holders, and recent milestones.",
        "screen": "Club Records & Hall of Fame",
        "gameplay": "Records verified rounds on the original simulation scoring path."
      },
      "native": {
        "symbol": "SIMGOLF_FEATURE_CLUB_RECORDS",
        "index": 6
      },
      "playContexts": [
        "career"
      ]
    },
    {
      "id": "designChallenges",
      "name": "Course Design Challenges",
      "category": "construction",
      "description": "Take on optional golf-course design challenges with meaningful objectives, progress tracking, and accomplishments.",
      "icon": "analytics",
      "featureVersion": "1.0.0",
      "schemaVersion": 1,
      "available": true,
      "defaultEnabled": false,
      "requires": [],
      "integrations": [
        "courseAnalytics",
        "golferHistories",
        "golferExperiences",
        "clubRecords"
      ],
      "conflicts": [],
      "affectsSimulation": false,
      "requiresPersistentState": true,
      "mutableDuringPlay": true,
      "saveCompatibility": {
        "supportedSchemas": [
          1
        ],
        "supportedStateSchemas": [
          1
        ],
        "policy": "career-revision-challenges"
      },
      "discovery": {
        "menu": "Menu \u2192 Enhanced \u2192 Design Challenges",
        "controls": "Start one challenge, play normally, then review progress or a completed medal.",
        "screen": "Course Design Challenges",
        "gameplay": "Voluntary original-engine design and playtesting objectives."
      },
      "native": {
        "symbol": "SIMGOLF_FEATURE_DESIGN_CHALLENGES",
        "index": 7
      },
      "playContexts": [
        "career"
      ]
    },
    {
      "id": "courseDesignLab",
      "name": "Course Design Lab",
      "category": "construction",
      "description": "Test your golf-course designs using real golfer performance and compare the results of construction changes.",
      "icon": "analytics",
      "featureVersion": "1.0.0",
      "schemaVersion": 1,
      "available": true,
      "defaultEnabled": false,
      "requires": [],
      "integrations": [
        "courseAnalytics",
        "designChallenges",
        "golferHistories",
        "clubRecords"
      ],
      "conflicts": [],
      "affectsSimulation": false,
      "requiresPersistentState": true,
      "mutableDuringPlay": true,
      "saveCompatibility": {
        "supportedSchemas": [
          1
        ],
        "supportedStateSchemas": [
          1
        ],
        "policy": "career-revision-experiments"
      },
      "discovery": {
        "menu": "Menu \u2192 Enhanced \u2192 Course Design Lab",
        "controls": "Choose an open hole and collect baseline finishes. Edit the course in Build, then collect and compare revised finishes.",
        "screen": "Course Design Lab",
        "gameplay": "Observes real native finishes when the same verified layout was present from hole entry through scoring."
      },
      "native": {
        "symbol": "SIMGOLF_FEATURE_COURSE_DESIGN_LAB",
        "index": 10
      },
      "playContexts": [
        "career"
      ]
    },
    {
      "id": "clubhouseManagement",
      "name": "Clubhouse & Tee-Time Management",
      "category": "clubLife",
      "description": "Manage waiting golfers, organize groups, and improve how golfers move through your course.",
      "icon": "clubhouse",
      "featureVersion": "1.0.0",
      "schemaVersion": 1,
      "available": true,
      "defaultEnabled": false,
      "requires": [],
      "integrations": [
        "golferHistories",
        "golferExperiences",
        "courseAnalytics",
        "clubRecords"
      ],
      "conflicts": [],
      "affectsSimulation": true,
      "requiresPersistentState": false,
      "mutableDuringPlay": true,
      "saveCompatibility": {
        "supportedSchemas": [
          1
        ],
        "supportedStateSchemas": [
          1
        ],
        "policy": "native-compatible"
      },
      "discovery": {
        "menu": "Menu \u2192 Enhanced \u2192 Clubhouse & Tee Times",
        "controls": "Inspect waiting golfers and send a chosen pair using the original selector.",
        "screen": "Clubhouse & Tee Times",
        "gameplay": "Original pairing and dispatch, with readable mobile choices. Automatic scheduling stays original."
      },
      "native": {
        "symbol": "SIMGOLF_FEATURE_CLUBHOUSE_MANAGEMENT",
        "index": 8
      },
      "playContexts": [
        "career"
      ]
    },
    {
      "id": "creativeSandbox",
      "name": "Creative Sandbox",
      "category": "construction",
      "description": "Choose free construction for a new Enhanced game started from Sandbox Mode. Original placement, unlocks and operating costs still apply.",
      "icon": "clubhouse",
      "featureVersion": "1.0.0",
      "schemaVersion": 1,
      "available": true,
      "defaultEnabled": false,
      "requires": [],
      "integrations": [
        "courseAnalytics",
        "designChallenges"
      ],
      "conflicts": [],
      "affectsSimulation": true,
      "requiresPersistentState": false,
      "mutableDuringPlay": false,
      "saveCompatibility": {
        "supportedSchemas": [
          1
        ],
        "supportedStateSchemas": [
          1
        ],
        "policy": "native-compatible"
      },
      "discovery": {
        "menu": "Title screen \u2192 Sandbox Mode",
        "controls": "Choose Creative Sandbox during Enhanced Sandbox Mode setup. Menu \u2192 Enhanced explains the active Creative Sandbox rules. Construction quotes show Free alongside their original value.",
        "screen": null,
        "gameplay": "Waives original construction charges and construction refunds. Original home-site sale income and property buybacks are retained. Land purchases, salaries, maintenance, revenue, golfer AI, physics and scoring remain native. Choose the free-construction option when starting the original Sandbox Mode."
      },
      "native": {
        "symbol": "SIMGOLF_FEATURE_CREATIVE_SANDBOX",
        "index": 9
      },
      "playContexts": [
        "sandbox"
      ]
    },
    {
      "id": "businessChallenges",
      "name": "Business Management Challenges",
      "category": "operations",
      "description": "Turn a verified full-season operating loss into break-even or better through normal course management.",
      "icon": "analytics",
      "featureVersion": "1.0.0",
      "schemaVersion": 1,
      "available": true,
      "defaultEnabled": false,
      "requires": [],
      "integrations": [
        "designChallenges",
        "courseAnalytics",
        "clubhouseManagement"
      ],
      "conflicts": [],
      "affectsSimulation": false,
      "requiresPersistentState": true,
      "mutableDuringPlay": true,
      "saveCompatibility": {
        "supportedSchemas": [
          1
        ],
        "supportedStateSchemas": [
          1
        ],
        "policy": "career-revision-business-challenges"
      },
      "discovery": {
        "menu": "Menu \u2192 Enhanced \u2192 Business Challenges",
        "controls": "Start Profitability Turnaround, then complete full March-to-March seasons on the same property.",
        "screen": "Business Management Challenges",
        "gameplay": "Compares the original greens fees, food and drink, salaries, and maintenance and interest ledger rows."
      },
      "playContexts": [
        "career"
      ]
    },
    {
      "id": "courseReview",
      "name": "Course Review",
      "category": "construction",
      "description": "See each open hole’s original Fun and Skill ratings and the reasons golfers reacted positively or negatively.",
      "icon": "analytics",
      "featureVersion": "1.0.0",
      "schemaVersion": 1,
      "available": true,
      "defaultEnabled": false,
      "requires": [],
      "integrations": ["courseAnalytics"],
      "conflicts": [],
      "affectsSimulation": false,
      "requiresPersistentState": false,
      "mutableDuringPlay": true,
      "saveCompatibility": {
        "supportedSchemas": [1],
        "supportedStateSchemas": [1],
        "policy": "native-compatible"
      },
      "discovery": {
        "menu": "Menu → Enhanced → Course Review",
        "controls": "Open Course Review any time your course is ready, or expand it in the end-of-year report.",
        "screen": "Course Review",
        "gameplay": "Shows original per-hole ratings and retained native reactions. Reactions can include earlier seasons."
      },
      "playContexts": ["career"]
    },
    {
      "id": "deferredLandOffers",
      "name": "Keep Land Offers",
      "category": "operations",
      "description": "Keep a commissioner’s land offer for one purchase later if you decline or leave without buying.",
      "icon": "clubhouse",
      "featureVersion": "1.0.0",
      "schemaVersion": 1,
      "available": true,
      "defaultEnabled": false,
      "requires": [],
      "integrations": [],
      "conflicts": [],
      "affectsSimulation": true,
      "requiresPersistentState": true,
      "mutableDuringPlay": true,
      "saveCompatibility": {
        "supportedSchemas": [1],
        "supportedStateSchemas": [1],
        "policy": "career-revision-land-offer"
      },
      "discovery": {
        "menu": "Menu → Enhanced → Purchase Land",
        "controls": "Enable before a land offer. Reopen an unused offer from Enhanced.",
        "screen": "Purchase Land",
        "gameplay": "One successful purchase uses the offer. Original tract availability and prices apply."
      },
      "playContexts": ["career"],
      "native": {"symbol":"SIMGOLF_FEATURE_DEFERRED_LAND_OFFERS","index":11}
    },
    {
      "id": "elevationMap",
      "name": "Elevation Map",
      "category": "construction",
      "description": "View the whole course’s elevation grid or keep it over the course while building. Switch transparent height colours on or off.",
      "icon": "analytics",
      "featureVersion": "1.0.0",
      "schemaVersion": 1,
      "available": true,
      "defaultEnabled": false,
      "requires": [],
      "integrations": [],
      "conflicts": [],
      "affectsSimulation": false,
      "requiresPersistentState": false,
      "mutableDuringPlay": true,
      "saveCompatibility": {
        "supportedSchemas": [1],
        "supportedStateSchemas": [1],
        "policy": "native-compatible"
      },
      "discovery": {
        "menu": "Menu → Enhanced → Elevation Map, or Build → Terrain → Elevation Map",
        "controls": "Choose Whole Course or On Course. Toggle Height Colours to compare terrain heights.",
        "screen": "Elevation Map",
        "gameplay": "Reads the original terrain corner heights. Height steps use the original game’s ground level."
      },
      "playContexts": ["career"]
    },
    {
      "id": "eyesoreDemolition",
      "name": "Eyesore Demolition",
      "category": "construction",
      "description": "Remove original water towers, radio antennas and oil pumps for a demolition fee.",
      "icon": "clubhouse",
      "featureVersion": "1.0.0",
      "schemaVersion": 1,
      "available": true,
      "defaultEnabled": false,
      "requires": [],
      "integrations": [],
      "conflicts": [],
      "affectsSimulation": true,
      "requiresPersistentState": false,
      "mutableDuringPlay": true,
      "saveCompatibility": {
        "supportedSchemas": [1],
        "supportedStateSchemas": [1],
        "policy": "native-compatible"
      },
      "discovery": {
        "menu": "Menu → Enhanced → Eyesore Demolition",
        "controls": "Enable the feature, then tap the base of a landmark from the course or with Remove active.",
        "screen": "Demolish landmark",
        "gameplay": "Demolition permanently clears the site for construction and costs $10,000."
      },
      "playContexts": ["career"],
      "native": {"symbol":"SIMGOLF_FEATURE_EYESORE_DEMOLITION","index":12}
    },
    {
      "id": "buildingUpgrades",
      "name": "Direct Building Upgrades",
      "category": "construction",
      "description": "Pay to upgrade an eligible building on its existing site.",
      "icon": "clubhouse",
      "featureVersion": "1.0.0",
      "schemaVersion": 1,
      "available": true,
      "defaultEnabled": false,
      "requires": [],
      "integrations": [],
      "conflicts": [],
      "affectsSimulation": true,
      "requiresPersistentState": false,
      "mutableDuringPlay": true,
      "saveCompatibility": {
        "supportedSchemas": [1],
        "supportedStateSchemas": [1],
        "policy": "native-compatible"
      },
      "discovery": {
        "menu": "Build → Improvements → Buildings",
        "controls": "Select Upgrade in place on an eligible building to review its site and price.",
        "screen": "Upgrade building",
        "gameplay": "Uses the original building upgrade price, footprint and eligibility."
      },
      "playContexts": ["career"],
      "native": {"symbol":"SIMGOLF_FEATURE_BUILDING_UPGRADES","index":13}
    },
    {
      "id": "constructionUndoRedo",
      "name": "Construction Undo & Redo",
      "category": "construction",
      "description": "Undo or redo up to 100 supported course tile edits, pathways, Vertex changes, and eligible Improvement placements and removals.",
      "icon": "history",
      "featureVersion": "1.5.0",
      "schemaVersion": 1,
      "available": true,
      "defaultEnabled": false,
      "requires": [],
      "integrations": [],
      "conflicts": [],
      "affectsSimulation": true,
      "requiresPersistentState": false,
      "mutableDuringPlay": true,
      "saveCompatibility": {
        "supportedSchemas": [1],
        "supportedStateSchemas": [1],
        "policy": "native-compatible"
      },
      "discovery": {
        "menu": "Build → Undo / Redo",
        "controls": "In Build, paint or remove eligible course tiles and pathways, edit a Vertex, or place or remove eligible Improvements. Use Undo or Redo in the Build toolbar.",
        "screen": null,
        "gameplay": "Keeps up to 100 edits as you switch tools and pan. Loading a save or revision clears the history."
      },
      "playContexts": ["career"],
      "native": {"symbol":"SIMGOLF_FEATURE_CONSTRUCTION_UNDO_REDO","index":14}
    }
  ]
}

/* SG_FEATURE_DEFINITIONS_END */;
  const clone=v=>JSON.parse(JSON.stringify(v));
  const record=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
  const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
  const fail=message=>{throw Error(message);};
  function create(features,categories,validators={}){
    if(!Array.isArray(features)||!Array.isArray(categories))fail('Invalid feature registry.');
    const catalog=clone(features),groups=clone(categories),byId=new Map(),groupIds=new Set();
    for(const g of groups){if(!g||!g.id||!g.name||groupIds.has(g.id))fail('Invalid or duplicate feature category.');groupIds.add(g.id);}
    for(const f of catalog){
      if(!record(f)||!/^[a-zA-Z][a-zA-Z0-9]*$/.test(f.id)||byId.has(f.id))fail('Invalid or duplicate feature ID: '+f?.id);
      if(!f.name||!f.description||!groupIds.has(f.category)||!/^\d+\.\d+\.\d+$/.test(f.featureVersion)||!Number.isInteger(f.schemaVersion)||f.schemaVersion<1)fail('Invalid feature metadata: '+f.id);
      if(f.playContexts===undefined)f.playContexts=['career'];
      if(!Array.isArray(f.playContexts)||!f.playContexts.length||new Set(f.playContexts).size!==f.playContexts.length||f.playContexts.some(context=>!['career','championship','sandbox'].includes(context)))fail('Invalid play contexts for '+f.id);
      for(const key of ['available','defaultEnabled','affectsSimulation','requiresPersistentState','mutableDuringPlay'])if(typeof f[key]!=='boolean')fail('Invalid '+key+' for '+f.id);
      for(const key of ['requires','integrations','conflicts'])if(!Array.isArray(f[key])||new Set(f[key]).size!==f[key].length||f[key].includes(f.id))fail('Invalid '+key+' definition for '+f.id);
      const c=f.saveCompatibility;if(!record(c)||!c.policy||!['supportedSchemas','supportedStateSchemas'].every(k=>Array.isArray(c[k])&&c[k].length&&new Set(c[k]).size===c[k].length&&c[k].every(n=>Number.isInteger(n)&&n>0))||!c.supportedSchemas.includes(f.schemaVersion)||!c.supportedStateSchemas.includes(f.schemaVersion))fail('Invalid save compatibility for '+f.id);
      byId.set(f.id,f);
    }
    for(const f of catalog)for(const kind of ['requires','integrations','conflicts'])for(const id of f[kind])if(!byId.has(id))fail('Unknown '+kind+' reference '+id+' in '+f.id);
    for(const [id,validate]of Object.entries(validators))if(!byId.has(id)||typeof validate!=='function')fail('Invalid feature state validator: '+id);
    const seen=new Set(),visiting=new Set();
    function visit(id){if(visiting.has(id))fail('Circular feature dependency involving '+id);if(seen.has(id))return;visiting.add(id);for(const dep of byId.get(id).requires)visit(dep);visiting.delete(id);seen.add(id);}
    catalog.forEach(f=>visit(f.id));
    const incompatible=(a,b)=>byId.get(a).conflicts.includes(b)||byId.get(b).conflicts.includes(a);
    function prerequisites(id,set=new Set()){if(set.has(id))return set;set.add(id);for(const dep of byId.get(id).requires)prerequisites(dep,set);return set;}
    for(const f of catalog){const closure=[...prerequisites(f.id)];for(const a of closure)for(const b of closure)if(a!==b&&incompatible(a,b))fail('Unsatisfiable dependencies for '+f.name+': '+byId.get(a).name+' conflicts with '+byId.get(b).name);}
    function shape(config){
      if(!record(config))fail('Feature choices must be a configuration object.');
      for(const [id,on]of Object.entries(config))if(!byId.has(id)||typeof on!=='boolean')fail('Unknown feature or invalid setting: '+id);
      return Object.fromEntries(catalog.map(f=>[f.id,config[f.id]===true]));
    }
    function validate(config){
      const next=shape(config);
      for(const f of catalog)if(next[f.id]){
        if(!f.available)fail(f.name+' is unavailable in this build. Use a compatible SGMobile version.');
        for(const dep of f.requires)if(!next[dep])fail(f.name+' requires '+byId.get(dep).name+'.');
        for(const other of catalog)if(next[other.id]&&incompatible(f.id,other.id))fail(f.name+' is incompatible with '+other.name+'.');
      }
      return freeze(next);
    }
    function validateSaved(features,edition){
      if(!record(features)||!['classic','enhanced'].includes(edition))fail('Invalid saved feature configuration or edition.');
      const choices={};
      for(const [id,value]of Object.entries(features)){
        const f=byId.get(id);
        if(!f||!record(value)||!Number.isInteger(value.schema)||!f.saveCompatibility.supportedSchemas.includes(value.schema)||typeof value.enabled!=='boolean'||!f.available)fail('This save requires an unavailable feature or unsupported schema: '+id+'. Use a compatible SGMobile version.');
        if(edition==='classic'&&value.enabled)fail('Classic metadata contains Enhanced features. Loading has been stopped.');
        choices[id]=value.enabled;
      }
      validate(choices);return features;
    }
    function jsonState(value,seen=new Set()){
      if(value===null||typeof value==='string'||typeof value==='boolean')return true;
      if(typeof value==='number')return Number.isFinite(value);
      if(!value||typeof value!=='object'||seen.has(value))return false;
      seen.add(value);const ok=Object.values(value).every(v=>jsonState(v,seen));seen.delete(value);return ok;
    }
    function validateStates(features,states){
      if(!record(states))fail('Invalid persistent feature states.');
      for(const [id,s]of Object.entries(states)){
        const f=byId.get(id);if(!f||!features[id]?.enabled||!record(s)||!Number.isInteger(s.schema)||s.schema!==features[id].schema||!f.saveCompatibility.supportedStateSchemas.includes(s.schema)||!record(s.data)||!jsonState(s.data))fail('Unsupported persistent feature state: '+id);
        if(validators[id]&&validators[id](s.data)!==true)fail('Invalid persistent feature data: '+f.name);
      }
      for(const [id,f]of Object.entries(features))if(f.enabled&&!states[id])fail('Missing persistent feature state for '+id);
      return states;
    }
    function plan(config,requested){
      try{
        const before=shape(config),next={...before};if(!record(requested))fail('Invalid feature change.');
        for(const [id,on]of Object.entries(requested))if(!byId.has(id)||typeof on!=='boolean')fail('Unknown feature or invalid setting: '+id);else next[id]=on;
        const enabled=new Set(),off=new Set(Object.keys(requested).filter(id=>!requested[id])),explanations=[];
        for(const [id,on]of Object.entries(requested))if(on)for(const dep of prerequisites(id)){
          if(off.has(dep))fail(byId.get(id).name+' requires '+byId.get(dep).name+'.');
          enabled.add(dep);next[dep]=true;
          if(!before[dep]&&!(dep in requested))explanations.push(byId.get(id).name+' requires '+byId.get(dep).name+'. Enable both?');
        }
        for(const id of enabled)for(const other of catalog)if(next[other.id]&&incompatible(id,other.id)){
          if(enabled.has(other.id))fail('These requested enhancements are incompatible: '+byId.get(id).name+' and '+other.name+'. Choose them individually instead of enabling all.');
          off.add(other.id);explanations.push(byId.get(id).name+' is incompatible with '+other.name+'. Turn '+other.name+' off?');
        }
        let changed=true;while(changed){changed=false;for(const f of catalog)if(next[f.id]&&!off.has(f.id)&&f.requires.some(dep=>off.has(dep))){off.add(f.id);changed=true;explanations.push(f.name+' requires '+byId.get(f.requires.find(dep=>off.has(dep))).name+'. Turn both off?');}}
        for(const id of off){if(enabled.has(id))fail('The requested combination has incompatible requirements. Choose a different combination.');next[id]=false;}
        const validated=validate(next),changes=Object.fromEntries(catalog.filter(f=>before[f.id]!==next[f.id]).map(f=>[f.id,next[f.id]]));
        return freeze({ok:true,before,configuration:validated,changes,requiresConfirmation:Object.keys(changes).some(id=>!(id in requested)),explanations:[...new Set(explanations)]});
      }catch(e){return freeze({ok:false,error:String(e.message||e)});}
    }
    const defaults=Object.fromEntries(catalog.map(f=>[f.id,f.defaultEnabled]));validate(defaults);
    freeze(catalog);freeze(groups);
    return Object.freeze({catalog,categories:groups,get:id=>byId.get(id),validate,validateSaved,validateStates,plan,
      defaults(stored){return freeze(Object.fromEntries(catalog.map(f=>[f.id,typeof stored?.[f.id]==='boolean'?stored[f.id]:f.defaultEnabled])));},
      all(config,on){return plan(config,Object.fromEntries(catalog.filter(f=>f.available||!on).map(f=>[f.id,on])));}
    });
  }
  function validDeferredLandOffer(data){
    const count=Object.keys(data).length;
    return count===0||(count===2&&Number.isInteger(data.property)&&data.property>=0&&data.property<16&&
      Number.isInteger(data.stage)&&data.stage>=0&&data.stage<128);
  }
  const registry=create(definitions.features,definitions.categories,{deferredLandOffers:validDeferredLandOffer, golferHistories:data=>global.SGGolferHistoryModel?.valid(data)===true, golferExperiences:data=>global.SGGolferExperienceModel?.valid(data)===true, clubRecords:data=>global.SGClubRecordsModel?.valid(data)===true, designChallenges:data=>global.SGDesignChallengeModel?.valid(data)===true, courseDesignLab:data=>global.SGCourseDesignLabModel?.valid(data)===true, businessChallenges:data=>global.SGBusinessTurnaroundModel?.validBusinessTurnaround(data)===true});
  global.SGFeatureRegistry=Object.freeze({create,registry});
})(globalThis);
