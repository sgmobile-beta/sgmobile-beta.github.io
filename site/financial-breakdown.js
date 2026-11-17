(function(global) {
  'use strict';

  const Module = global.Module;
  const id = 'financialBreakdown';
  const rules = Module?.saveRules;
  if (!rules) return;

  // All values use the original ledger's signed $100 units.
  const isCost = value => Number.isInteger(value) && value >= -32768 && value <= 0;
  const isProperty = value => Number.isInteger(value) && value >= 0 && value < 16;
  const yearKey = key => /^(0|[1-9][0-9]{0,4})$/.test(key) && Number(key) <= 32767;
  const total = row => row.combined + row.maintenance + row.interest;
  const validRow = row => row && Object.keys(row).length === 3 &&
    isCost(row.combined) && isCost(row.maintenance) && isCost(row.interest) && isCost(total(row));
  let runtime = null;

  function validate(data) {
    if (!Object.keys(data).length) return true;
    if (Object.keys(data).length !== 2 || !isProperty(data.property) ||
        !data.years || Array.isArray(data.years) || typeof data.years !== 'object') return false;
    const years = Object.keys(data.years);
    return years.length <= 100 && new Set(years.map(year => Number(year) % 100)).size === years.length &&
      years.every(year => yearKey(year) && validRow(data.years[year]));
  }

  function ownsCourse() {
    return runtime && !Module.atTitle && !Module.rulesetBlocked && !Module.loadState?.active &&
      !Module.courseLoading?.active && rules.hasFeature(id) && rules.active?.game.id === runtime.career;
  }

  rules.register(id, {
    validate,
    prepare(data, game) { return {career: game.id, data}; },
    activate(prepared) { runtime = prepared; },
    capture() { return runtime.data; },
    dispose() { runtime = null; }
  });

  Module.recordFinancialExpense = function(event) {
    if (!ownsCourse() || !isProperty(event.property) || !yearKey(String(event.year)) ||
        !isCost(event.before) || !isCost(event.delta) || event.delta === 0) return;
    const category = event.site === 0x41787c ? 'maintenance' : event.site === 0x417ef9 ? 'interest' : null;
    if (!category) return;
    const initial = runtime.data;
    const data = initial.property === event.property ? initial : (runtime.data = {property: event.property, years: {}});
    const years = data.years;
    const key = String(event.year);
    for (const year of Object.keys(years))
      if (year !== key && Number(year) % 100 === event.year % 100) delete years[year];

    if (!isCost(event.before + event.delta)) {
      delete years[key]; // Don't reinterpret a wrapped native accounting cell.
      return;
    }
    const known = years[key];
    const row = known && total(known) === event.before ? known :
      {combined: event.before, maintenance: 0, interest: 0};
    row[category] += event.delta;
    years[key] = row;
  };

  Module.clearFinancialExpenses = function(site) {
    // The original new-property/reset routine clears all native ledger rows.
    // A save load restores the exact revision through the normal lifecycle.
    if (site === 0x442223 && ownsCourse()) runtime.data = {};
  };

  Module.financialExpenseDetails = function(year, originalTotal) {
    if (!ownsCourse()) return null;
    const data = runtime.data;
    const row = data.years?.[year - 2001];
    const property = new DataView(Module.HEAPU8.buffer).getInt32(0x59bf90, true);
    if (!row || data.property !== property || total(row) * 100 !== originalTotal) return null;
    return {maintenance: row.maintenance * 100, interest: row.interest * 100, combined: row.combined * 100};
  };
})(globalThis);
