/* ============================================================
   TIMING KNOWLEDGE BASE
   Used by the wet belt checker.

   Design rule: NEVER be confidently wrong. Every entry carries a
   confidence level, and anything contested or variant dependent
   returns "confirm" rather than a verdict.

     definitive — the engine code identifies one timing setup and
                  the sources agree.
     likely     — the make, model, engine size and year point to
                  one setup, but the code was not supplied.
     confirm    — more than one possibility, or the published
                  sources disagree. We ask rather than guess.

   Sources are recorded per family so anyone can re-check them.
   ============================================================ */

var TIMING_KINDS = {
  wet:      { label: 'Wet timing belt',  tone: 'wet',   headline: 'Your engine has a wet timing belt.' },
  wetpump:  { label: 'Wet oil pump belt', tone: 'wet',  headline: 'Your engine has a wet belt driving the oil pump.' },
  dry:      { label: 'Dry timing belt',  tone: 'dry',   headline: 'Your engine has a conventional dry timing belt.' },
  chain:    { label: 'Timing chain',     tone: 'chain', headline: 'Your engine is chain driven.' },
  confirm:  { label: 'Needs confirming', tone: 'warn',  headline: 'We need one more detail to be certain.' }
};

/* ---- engine code families -------------------------------------------------
   Matched on the engine code returned from the registration. Prefix match,
   longest first. Only families we could verify are listed. */
var ENGINE_CODE_FAMILIES = [
  {
    family: 'Ford 1.0 EcoBoost (wet belt era)',
    codes: ['M1DA','M1JA','M1JE','M1JC','M1JH','M2DA','SFJA','SFJB','SFJC','SFJD','SFDA','YYJA','YYJB'],
    yearTo: 2018,
    kind: 'wet',
    engineName: '1.0 EcoBoost',
    note: 'The belt runs inside the engine in oil. As it ages it sheds material that blocks the oil pickup, which is what destroys these engines. Ford shortened the interval after the fact.',
    interval: 'Commonly quoted at 10 years or 150,000 miles when new. Most specialists, us included, advise inspection or replacement far earlier.',
    source: 'NTN-SNR technical bulletin, Ford parts catalogues, TGPP'
  },
  {
    family: 'Ford 2.0 EcoBlue diesel',
    codes: ['BKFA','BKFB','BJFA','BJFB','BLFA','BLFB','YLFS','YLFA','YMFS','YMFA'],
    kind: 'wet',
    engineName: '2.0 EcoBlue',
    note: 'Two belts, both running in oil: the camshaft belt and a separate oil pump belt. Both are replaced together.',
    interval: 'Ford cut this to 6 years or 100,000 miles, down from 10 years or 150,000, because fuel getting into the oil during DPF regens breaks the belt down early.',
    source: 'Dayco technical bulletin, Fleet News (Ford interval revision)'
  },
  {
    family: 'PSA / Stellantis 1.2 PureTech turbo',
    codes: ['HN01','HN02','HN05','HNZ','HNY','HNW','HNP','HNS','HNK','HNV'],
    yearTo: 2022,
    kind: 'wet',
    engineName: '1.2 PureTech',
    note: 'The belt runs in oil. Stellantis has publicly acknowledged premature wear, where belt particles block the oil pickup and can seize the engine.',
    interval: 'Now 6 years or 100,000 km, shortened from 10 years or 175,000 km.',
    source: 'Stellantis service guidance, NTN-SNR technical bulletin'
  },
  {
    family: 'PSA / Stellantis 1.5 BlueHDi (DV5)',
    codes: ['YHZ','YHY','DV5RC','DV5RD','DV5R'],
    kind: 'wetpump',
    engineName: '1.5 BlueHDi',
    note: 'This engine uses both. A wet belt drives the crankshaft end and water pump, and an internal chain links the two camshafts. Earlier chains also suffer stretch, so both want checking.',
    interval: 'Belt on condition and interval, and the earlier 7mm chain design is a known weak point, superseded by an 8mm chain in 2023.',
    source: 'Sumax DV5 technical guide, GT Automotive, PSA recall notices'
  }
];

/* ---- engines where the published sources genuinely disagree ----------------
   We deliberately refuse to give a verdict on these. Saying "we will confirm"
   costs us nothing. Saying the wrong thing costs a customer an engine. */
var CONTESTED_ENGINES = [
  {
    match: /1\.5\s*ecoblue/i,
    engineName: '1.5 EcoBlue',
    why: 'Published sources disagree on this one. Some describe a wet cam belt, others a dry belt with a chain between the camshafts and a directly driven oil pump, and it appears to vary by year and application.',
    action: 'Send us the reg and we will confirm it from the VIN and the build data before quoting anything.'
  }
];

var TIMING_SOURCES_NOTE =
  'Verdicts are based on the engine code from your registration where available, cross checked against manufacturer bulletins and parts catalogue data. Where the evidence is not clear cut we say so rather than guess.';
