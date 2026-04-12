const fs = require('fs');
const path = require('path');

// three different field naming conventions in the raw data:
// PLN cases:  case_no, project_title, location, desc, case_type, current_status, filed_date, applicant_name, property_owner, est_cost, lat, lng, portal_link
// BP permits: CaseNumber, ProjectName, Address, Description, Type, Status, DateFiled, Applicant, Owner, EstimatedCost, Latitude, Longitude, URL
// RES permits: permit_id, name, street_address, project_description, permit_type, status, date_submitted, applicant, owner_name, valuation, x_coord, y_coord, link

function pick(raw, ...keys) {
  for (const k of keys) {
    const v = raw[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}

const getId          = r => pick(r, 'case_no', 'CaseNumber', 'permit_id');
const getName        = r => pick(r, 'project_title', 'ProjectName', 'name');
const getAddress     = r => pick(r, 'location', 'Address', 'street_address');
const getDescription = r => pick(r, 'desc', 'Description', 'description', 'project_description');
const getType        = r => pick(r, 'case_type', 'Type', 'permit_type');
const getStatus      = r => pick(r, 'current_status', 'Status', 'status');
const getDate        = r => pick(r, 'filed_date', 'DateFiled', 'date_filed', 'date_submitted');
const getApplicant   = r => pick(r, 'applicant_name', 'Applicant', 'applicant');
const getOwner       = r => pick(r, 'property_owner', 'Owner', 'owner_name', 'owner');
const getCost        = r => pick(r, 'est_cost', 'EstimatedCost', 'estimated_cost', 'valuation');
// RES permits store coordinates as x_coord/y_coord instead of lat/lng
const getLat         = r => pick(r, 'lat', 'Latitude', 'latitude', 'x_coord');
const getLng         = r => pick(r, 'lng', 'Longitude', 'longitude', 'y_coord');
const getUrl         = r => pick(r, 'portal_link', 'URL', 'link', 'source_url');

// date parsing — raw data has at least 6 different formats
// need both full month names and 3-letter abbreviations for different formats
const MONTHS = {
  january:1, february:2, march:3, april:4, may:5, june:6,
  july:7, august:8, september:9, october:10, november:11, december:12,
  jan:1, feb:2, mar:3, apr:4, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,
};

function parseDate(val) {
  if (!val) return null;
  const s = String(val).trim();

  // ISO with time component e.g. 2024-02-28T00:00:00
  const isoT = s.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoT) return isoT[1];

  // plain ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // MM/DD/YYYY or M/D/YYYY
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) return `${us[3]}-${us[1].padStart(2,'0')}-${us[2].padStart(2,'0')}`;

  // M/D/YY — assume 2000s
  const usShort = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (usShort) {
    const year = +usShort[3] >= 50 ? `19${usShort[3]}` : `20${usShort[3]}`;
    return `${year}-${usShort[1].padStart(2,'0')}-${usShort[2].padStart(2,'0')}`;
  }

  // "April 2, 2024" or "January 15, 2024"
  const longForm = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (longForm) {
    const m = MONTHS[longForm[1].toLowerCase()];
    if (m) return `${longForm[3]}-${String(m).padStart(2,'0')}-${longForm[2].padStart(2,'0')}`;
  }

  // 15-Jan-2024
  const dmy = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (dmy) {
    const m = MONTHS[dmy[2].toLowerCase()];
    if (m) return `${dmy[3]}-${String(m).padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
  }

  return null;
}

function parseCost(val) {
  if (val === null || val === undefined || val === '') return null;
  // some records store cost as a number already, others as "$24,500,000"
  if (typeof val === 'number') return val;
  const n = parseFloat(String(val).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

// status mapping — raw data has a lot of variation ("APPROVED", "Approved", "Permit Issued" all mean the same thing)
const STATUS_MAP = {
  'In Review': [
    'under review','in review','review','pending review','submitted',
    'application submitted','intake','received','pending','under examination',
    'corrections required','revision requested','corrections needed',
    'resubmittal required','deficiency notice',
  ],
  'Approved': [
    'approved','permit issued','issued','finalized',
    'complete','completed','certificate issued',
  ],
  'Planning Commission': [
    'planning commission','commission review','public hearing',
    'commission','hearing scheduled',
  ],
  'Withdrawn': [
    'withdrawn','denied','cancelled','canceled','voided','expired',
  ],
  'Under Construction': [
    'under construction','construction','building','in progress',
  ],
};

function mapStatus(raw) {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  for (const [normalized, values] of Object.entries(STATUS_MAP)) {
    if (values.includes(lower)) return normalized;
  }
  return null; // unmapped status — preserved in raw_data
}

const TYPE_MAP = {
  'Residential':   ['residential','single family','multi-family','apartment','townhouse','condo','duplex','sfr','mfr','residential new','new home'],
  'Commercial':    ['commercial','office','retail','restaurant','hotel','shopping','com','commercial new','commercial renovation'],
  'Mixed Use':     ['mixed use','mixed-use','mxd','residential/commercial','live-work','live/work'],
  'Industrial':    ['industrial','warehouse','manufacturing','distribution','ind'],
  'Institutional': ['institutional','school','church','hospital','government','library','fire station','public'],
  'Subdivision':   ['subdivision','plat','lot split','land division','sub'],
  'Demolition':    ['demolition','demo','tear down'],
  'Renovation':    ['renovation','remodel','alteration','addition','rehab','tenant improvement','ti','interior renovation'],
};

function mapType(raw) {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  for (const [normalized, values] of Object.entries(TYPE_MAP)) {
    if (values.includes(lower)) return normalized;
  }
  return raw; // keep original if no match per spec
}

// normalize address for dedup comparison only (not stored in output)
// handles cases like "445 elm st" vs "445 Elm Street", "2847  Riverside Dr." vs "2847 Riverside Dr"
const ABBREVS = [
  [/\bstreet\b/g, 'st'], [/\bboulevard\b/g, 'blvd'], [/\bdrive\b/g, 'dr'],
  [/\bavenue\b/g, 'ave'], [/\broad\b/g, 'rd'], [/\blane\b/g, 'ln'],
  [/\bcourt\b/g, 'ct'], [/\bplace\b/g, 'pl'], [/\bparkway\b/g, 'pkwy'],
];

function normalizeAddr(addr) {
  if (!addr) return null;
  let s = addr.toLowerCase().trim();
  s = s.replace(/\b(suite|ste|apt|unit|#)\s*[\w-]+/g, ''); // strip unit numbers
  s = s.replace(/\(parcel[^)]*\)/g, '');                    // strip parcel refs
  s = s.replace(/[,.']+$/, '').replace(/\s+/g, ' ').trim();
  for (const [pattern, abbrev] of ABBREVS) s = s.replace(pattern, abbrev);
  return s;
}

function countFields(r) {
  return Object.entries(r).filter(([k, v]) => k !== 'raw_data' && v !== null && v !== undefined).length;
}

// merge two records — primary is the more complete one
// for fields where both have a value, prefer the one with the more recent application_date
function mergeTwo(primary, secondary) {
  const primaryIsNewer = primary.application_date && secondary.application_date
    ? primary.application_date >= secondary.application_date
    : true;

  const result = { ...primary };
  for (const [k, v] of Object.entries(secondary)) {
    if (k === 'raw_data') continue;
    if (result[k] === null || result[k] === undefined) {
      result[k] = v;
    } else if (v !== null && v !== undefined && !primaryIsNewer) {
      result[k] = v;
    }
  }
  return result;
}

function deduplicate(records) {
  const groups = new Map();

  for (const r of records) {
    const key = normalizeAddr(r.address) || `__naddr__${r.proposal_number}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  const out = [];
  for (const group of groups.values()) {
    if (group.length === 1) { out.push(group[0]); continue; }
    // sort most-complete first, then merge remainder into it
    group.sort((a, b) => countFields(b) - countFields(a));
    let merged = group[0];
    for (let i = 1; i < group.length; i++) merged = mergeTwo(merged, group[i]);
    out.push(merged);
  }
  return out;
}

const raw = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'raw-permits.json'), 'utf8')
);

const records = raw.map(r => ({
  proposal_number:  getId(r) != null ? String(getId(r)) : null,
  name:             getName(r),
  address:          getAddress(r),
  description:      getDescription(r),
  project_type:     mapType(getType(r)),
  status:           mapStatus(getStatus(r)),
  application_date: parseDate(getDate(r)),
  applicant:        getApplicant(r),
  owner:            getOwner(r),
  estimated_cost:   parseCost(getCost(r)),
  latitude:         getLat(r),
  longitude:        getLng(r),
  source_url:       getUrl(r),
  raw_data:         r,
}));

// filter out anything with no id, or no name AND no address (basically empty records)
const filtered = records.filter(r => r.proposal_number && (r.name || r.address));

const dropped = raw.length - filtered.length;
if (dropped > 0) {
  const droppedIds = records
    .filter(r => !r.proposal_number || (!r.name && !r.address))
    .map(r => r.proposal_number || '(no id)');
  console.log(`Filtered out ${dropped} record(s) with insufficient data: ${droppedIds.join(', ')}`);
}

const deduped = deduplicate(filtered);

const mergedCount = filtered.length - deduped.length;
if (mergedCount > 0) {
  console.log(`Merged ${mergedCount} duplicate address(es)`);
}

fs.writeFileSync(
  path.join(__dirname, 'transformed.json'),
  JSON.stringify(deduped, null, 2)
);

console.log(`Done: ${raw.length} raw → ${filtered.length} after filter → ${deduped.length} after dedup`);
