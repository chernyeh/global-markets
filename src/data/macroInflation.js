// ═══════════════════════════════════════════════════════════════════════════════
// MACRO MONITOR — inflation detail (Phase 2)
// ═══════════════════════════════════════════════════════════════════════════════
// US CPI core-services breadth, after the 19 Nov 2026 oil/inflation/rates note
// (§5). Weights are the note's (% of CPI, BLS relative importance). The items
// are a NON-OVERLAPPING set: "Transportation services" is represented by its
// three children in the note (public transport, motor vehicle insurance,
// maintenance and repair); the ≈1pp residual (fees, leasing, rental) has no
// item series here and is left out. Coverage is therefore 55.9pp of CPI —
// most, not all, of core services — and the breadth figures are this
// monitor's own reconstruction, not Waller's method nor the note's exact one.
//
// Each item has a BLS code; the monitor fetches the seasonally adjusted index
// (CUSR0000<code>) for m/m and 3-month annualised changes, and the
// unadjusted index (CUUR0000<code>) for y/y, as BLS publishes them.
// Quality tags are the note's reading of each item (§5 "Quality of the items").

export const BREADTH_ITEMS = [
  { code: "SEHC",   label: "Owners' equivalent rent",       weight: 25.9, tag: "sticky",  note: "Sticky, only just above 3%" },
  { code: "SEHA",   label: "Rent of primary residence",     weight: 7.7,  tag: "stable",  note: "Main stabiliser" },
  { code: "SEHB",   label: "Lodging away from home",        weight: 1.4,  tag: "fading",  note: "Volatile; mean-reverting" },
  { code: "SEHG",   label: "Water, sewer & trash",          weight: 1.1,  tag: "sticky" },
  { code: "SEMD01", label: "Hospital services",             weight: 2.2,  tag: "sticky" },
  { code: "SEMC01", label: "Physicians' services",          weight: 1.7,  tag: "below",   note: "Below 3%" },
  { code: "SEMC02", label: "Dental services",               weight: 0.9,  tag: "sticky" },
  { code: "SEME",   label: "Health insurance",              weight: 0.8,  tag: "below",   note: "Below 3%" },
  { code: "SETD",   label: "Vehicle maintenance & repair",  weight: 1.1,  tag: "sticky" },
  { code: "SETE",   label: "Motor vehicle insurance",       weight: 2.5,  tag: "watch",   note: "Watch: turning up — non-oil pressure" },
  { code: "SETG",   label: "Public transport (incl. airfares)", weight: 1.7, tag: "fuel", note: "Fuel-linked" },
  { code: "SARS",   label: "Recreation services",           weight: 3.1,  tag: "sticky",  note: "Accelerating in the note" },
  { code: "SEEB",   label: "Tuition, school fees & childcare", weight: 2.6, tag: "fading", note: "Annual tuition reset" },
  { code: "SAE2",   label: "Communication",                 weight: 3.2,  tag: "oneoff",  note: "One-off August jump; includes some IT goods" },
];

export const QUALITY_TAGS = {
  sticky: { label: "sticky",   color: "#c0392b" },
  fuel:   { label: "fuel",     color: "#b84a00" },
  fading: { label: "fading",   color: "#8a6a20" },
  watch:  { label: "watch",    color: "#b84a00" },
  stable: { label: "stabiliser", color: "#3a6080" },
  below:  { label: "below 3%", color: "#3a6080" },
  oneoff: { label: "one-off",  color: "#888" },
};

export const BREADTH_THRESHOLD = 3; // % — the line Waller and the note use

// Registry entries for the breadth items: SA for m/m and 3m annualised,
// NSA for y/y. BLS first; FRED carries the same series IDs as a fallback;
// for m/m a last-resort NSA series is flagged on the table as not seasonally adjusted.
export function breadthRegistry() {
  const out = {};
  for (const it of BREADTH_ITEMS) {
    out[`sa_${it.code}`] = { hidden: true, group: "inflation", label: `${it.label} (SA)`, unit: "idx", dp: 3, freq: "M",
      src: [["bls", `CUSR0000${it.code}`], ["fred", `CUSR0000${it.code}`], ["bls", `CUUR0000${it.code}`]] };
    out[`nsa_${it.code}`] = { hidden: true, group: "inflation", label: `${it.label} (NSA)`, unit: "idx", dp: 3, freq: "M",
      src: [["bls", `CUUR0000${it.code}`], ["fred", `CUUR0000${it.code}`]] };
  }
  return out;
}

// US inflation prints table. kind: "mom" | "ann3m" | "yoy" of an index, or
// "level" for series that are already a rate. r1 = compare on BLS's published
// one-decimal basis. good(v) marks values at the disinflation trigger.
export const US_PRINT_ROWS = [
  { section: "CPI" },
  { label: "CPI y/y",                   id: "cpiNsa",   kind: "yoy" },
  { label: "Core CPI m/m",              id: "coreCpi",  kind: "mom", r1: true, good: v => v <= 0.2 },
  { label: "Core CPI 3m ann.",          id: "coreCpi",  kind: "ann3m" },
  { label: "Core CPI y/y",              id: "coreNsa",  kind: "yoy" },
  { label: "Core goods m/m",            id: "coreGoods", kind: "mom", r1: true },
  { label: "Core services m/m",         id: "coreServ", kind: "mom", r1: true },
  { label: "Services ex rent of shelter 3m ann.", id: "superCore", kind: "ann3m", note: "BLS 'services less rent of shelter' — includes energy services, as in the note" },
  { label: "Shelter m/m",               id: "shelter",  kind: "mom", r1: true },
  { label: "Restaurant meals y/y",      id: "foodAway", kind: "yoy" },
  { section: "ALTERNATIVE CORES" },
  { label: "Median CPI (ann. m/m)",     id: "medCpi",   kind: "level" },
  { label: "Trimmed-mean CPI (ann. m/m)", id: "trimCpi", kind: "level" },
  { label: "Sticky core CPI y/y",       id: "stickyCore", kind: "level" },
  { section: "PCE" },
  { label: "Core PCE m/m",              id: "corePce",  kind: "mom" },
  { label: "Core PCE 3m ann.",          id: "corePce",  kind: "ann3m" },
  { label: "PCE services ex energy & housing 3m ann.", id: "pceSuper", kind: "ann3m" },
  { label: "Dallas trimmed-mean PCE 12m", id: "trimPce", kind: "level" },
  { section: "PPI" },
  { label: "PPI final demand m/m",      id: "ppiFd",    kind: "mom", r1: true },
  { label: "Core PPI (ex food, energy, trade) m/m", id: "ppiCore", kind: "mom", r1: true },
  { label: "Core PPI (ex food, energy, trade) y/y", id: "ppiCoreNsa", kind: "yoy" },
  { label: "Diesel PPI y/y",            id: "diesel",   kind: "yoy" },
  { label: "Truck freight PPI y/y",     id: "trucking", kind: "yoy" },
];

// Euro-area HICP (Eurostat, ECOICOP ver.2). Annual rates unless stated.
export const EURO_ROWS = [
  { label: "Headline",                  id: "ezHicp" },
  { label: "Core (ex energy, food, alcohol, tobacco)", id: "ezCore" },
  { label: "Core m/m",                  id: "ezCoreMom" },
  { label: "Services",                  id: "ezServ" },
  { label: "Non-energy industrial goods", id: "ezNeig" },
  { label: "Energy",                    id: "ezEnergy" },
  { label: "Food, alcohol & tobacco",   id: "ezFood" },
  { section: "COUNTRIES · headline" },
  { label: "Germany",                   id: "deHicp" },
  { label: "France",                    id: "frHicp" },
  { label: "Italy",                     id: "itHicp" },
  { label: "Spain",                     id: "esHicp" },
];

// Gasoline base effects (19 Nov note §3): the note assumes ≈$3.85/gal and a
// ≈3–3.5% CPI weight. Both are editable on the card; these are the defaults.
export const GAS_DEFAULTS = { price: 3.85, weight: 3.3, months: 8 };
