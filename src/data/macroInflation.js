// ═══════════════════════════════════════════════════════════════════════════════
// MACRO MONITOR — inflation detail (Phase 2)
// ═══════════════════════════════════════════════════════════════════════════════
// US CPI core-services breadth, after the 19 Nov 2026 oil/inflation/rates note
// (§5). The items are a NON-OVERLAPPING set covering all of core services
// (BLS "services less energy services", 60.098% of CPI in Sep 2026): 60.086pp,
// the ≈0.01pp gap being rounding inside education and communication services.
//   group "note"  — the note's items, with its quality reads. Its "Communication"
//                   (SAE2) is split into telephone and internet services, because
//                   SAE2 also holds ≈0.75pp of IT goods (computers, phones).
//   group "added" — the rest of core services, added for full coverage; no reads.
// The breadth figures are this monitor's own reconstruction, not Waller's
// method nor the note's exact one.
//
// Weights: BLS relative importance, Sep 2026, as printed in CPI Table 2 of the
// Oct 2026 release (bls.gov/news.release/cpi.t02.htm). Marked † where BLS prints
// no figure and the weight is derived from its totals: household operations
// (services less energy services less its printed parts), tenants' insurance
// (shelter less rent of shelter), home health care (hospital and related
// services less hospital services and nursing homes).
// Codes: BLS cu.item list (download.bls.gov/pub/time.series/cu/cu.item).
//
// Series: the seasonally adjusted index (CUSR0000<code>) for m/m and 3-month
// annualised changes, the unadjusted index (CUUR0000<code>) for y/y, as BLS
// publishes them. blsSa: false = BLS does not seasonally adjust the item (Table 2
// footnote 1, "Not seasonally adjusted", or no CUSR series): its m/m is the
// unadjusted change, as in BLS's own tables. noSaSeries: BLS publishes no CUSR
// series at all, so the unadjusted index is fetched directly.
// Quality tags are the note's reading of each item (§5 "Quality of the items").

export const BREADTH_ITEMS = [
  // From the note
  { code: "SEHC",   group: "note", label: "Owners' equivalent rent",       weight: 25.853, tag: "sticky",  note: "Sticky, only just above 3%" },
  { code: "SEHA",   group: "note", label: "Rent of primary residence",     weight: 7.707,  tag: "stable",  note: "Main stabiliser" },
  { code: "SEHB",   group: "note", label: "Lodging away from home",        weight: 1.392,  tag: "fading",  note: "Volatile; mean-reverting" },
  { code: "SEHG",   group: "note", label: "Water, sewer & trash",          weight: 1.143,  tag: "sticky" },
  { code: "SEMD01", group: "note", label: "Hospital services",             weight: 2.163,  tag: "sticky", blsSa: false },
  { code: "SEMC01", group: "note", label: "Physicians' services",          weight: 1.648,  tag: "below",   note: "Below 3%", blsSa: false },
  { code: "SEMC02", group: "note", label: "Dental services",               weight: 0.912,  tag: "sticky", blsSa: false },
  { code: "SEME",   group: "note", label: "Health insurance",              weight: 0.811,  tag: "below",   note: "Below 3%", blsSa: false, noSaSeries: true },
  { code: "SETD",   group: "note", label: "Vehicle maintenance & repair",  weight: 1.065,  tag: "sticky", blsSa: false },
  { code: "SETE",   group: "note", label: "Motor vehicle insurance",       weight: 2.510,  tag: "watch",   note: "Watch: turning up — non-oil pressure" },
  { code: "SETG",   group: "note", label: "Public transport (incl. airfares)", weight: 1.651, tag: "fuel", note: "Fuel-linked" },
  { code: "SARS",   group: "note", label: "Recreation services",           weight: 3.127,  tag: "sticky",  note: "Accelerating in the note" },
  { code: "SEEB",   group: "note", label: "Tuition, school fees & childcare", weight: 2.558, tag: "fading", note: "Annual tuition reset" },
  { code: "SEED",   group: "note", label: "Telephone services",            weight: 1.483,  tag: "oneoff",  note: "One-off August jump (+5.4% m/m); in the note's Communication item", blsSa: false, noSaSeries: true },
  { code: "SEEE03", group: "note", label: "Internet services",             weight: 0.889,  note: "In the note's Communication item", blsSa: false },
  // Added for full core-services coverage
  { code: "SEGD",   group: "added", label: "Miscellaneous personal services", weight: 0.929, note: "Legal, funeral, laundry, financial and other services", blsSa: false },
  { code: "SEHP",   group: "added", label: "Household operations",          weight: 0.917, note: "Domestic help, gardening, moving and similar · weight derived †", blsSa: false, noSaSeries: true },
  { code: "SEGC",   group: "added", label: "Personal care services",        weight: 0.667, note: "Haircuts and similar", blsSa: false, noSaSeries: true },
  { code: "SEMC04", group: "added", label: "Other medical professionals",   weight: 0.514, blsSa: false },
  { code: "SETF",   group: "added", label: "Motor vehicle fees",            weight: 0.495, note: "Registration, licence, parking", blsSa: false, noSaSeries: true },
  { code: "SETA03", group: "added", label: "Leased cars & trucks",          weight: 0.382, blsSa: false },
  { code: "SEMC03", group: "added", label: "Eyeglasses & eye care",         weight: 0.315, blsSa: false },
  { code: "SEHD",   group: "added", label: "Tenants' & household insurance", weight: 0.286, note: "Weight derived †", blsSa: false, noSaSeries: true },
  { code: "SEMD03", group: "added", label: "Home health care",              weight: 0.228, note: "Weight derived †", blsSa: false, noSaSeries: true },
  { code: "SEMD02", group: "added", label: "Nursing homes & adult day care", weight: 0.222, blsSa: false },
  { code: "SETA04", group: "added", label: "Car & truck rental",            weight: 0.153 },
  { code: "SEEC",   group: "added", label: "Postage & delivery",            weight: 0.066 },
];
// Core services in CPI (services less energy services), Sep 2026 relative importance.
export const CORE_SERVICES_WEIGHT = 60.098;

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
// for m/m a last-resort NSA series is flagged on the table as not seasonally
// adjusted — unless BLS publishes no SA series (noSaSeries), when the
// unadjusted index is the m/m source by design.
export function breadthRegistry() {
  const out = {};
  for (const it of BREADTH_ITEMS) {
    out[`sa_${it.code}`] = { hidden: true, group: "inflation", label: `${it.label} (${it.noSaSeries ? "NSA" : "SA"})`, unit: "idx", dp: 3, freq: "M",
      src: it.noSaSeries ? [["bls", `CUUR0000${it.code}`], ["fred", `CUUR0000${it.code}`]]
        : [["bls", `CUSR0000${it.code}`], ["fred", `CUSR0000${it.code}`], ["bls", `CUUR0000${it.code}`]] };
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
