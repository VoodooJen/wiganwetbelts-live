/* ============================================================
   Wet belt checker.

   Rule: never be confidently wrong.
     1. Engine code matches a verified family  -> definitive
     2. Engine is on the contested list        -> confirm, no verdict
     3. Make/model/engine narrow to one entry  -> likely
     4. Anything else                          -> confirm, no verdict
   ============================================================ */
(function(){
'use strict';

var reg = document.getElementById('chkReg');
var btn = document.getElementById('chkBtn');
var statusEl = document.getElementById('chkStatus');
var out = document.getElementById('verdict');

function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

function say(msg, cls){ statusEl.textContent = msg; statusEl.className = cls || ''; }

/* ---------- verdict engine ---------- */
function byEngineCode(code, year){
  if (!code) return null;
  var c = String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');
  var best = null;
  for (var i = 0; i < ENGINE_CODE_FAMILIES.length; i++){
    var fam = ENGINE_CODE_FAMILIES[i];
    for (var j = 0; j < fam.codes.length; j++){
      var k = fam.codes[j];
      if (c === k || c.indexOf(k) === 0){
        if (fam.yearTo && year && Number(year) > fam.yearTo) return null; // outside the known era, do not guess
        if (!best || k.length > best.matched.length) best = { fam: fam, matched: k };
      }
    }
  }
  if (!best) return null;
  return {
    confidence: 'definitive',
    kind: best.fam.kind,
    engineName: best.fam.engineName,
    family: best.fam.family,
    note: best.fam.note,
    interval: best.fam.interval,
    source: best.fam.source
  };
}

function byModelText(text, cc, year){
  if (!text || typeof MODEL_TEXT_FAMILIES === 'undefined') return null;
  for (var i = 0; i < MODEL_TEXT_FAMILIES.length; i++){
    var f = MODEL_TEXT_FAMILIES[i];
    if (!f.test.test(text)) continue;
    if (cc && f.ccFrom && (Number(cc) < f.ccFrom || Number(cc) > f.ccTo)) continue;
    if (f.yearTo && year && Number(year) > f.yearTo) continue;
    return {
      confidence: 'likely',
      kind: f.kind,
      engineName: f.engineName,
      note: f.note + ' Identified from the model description on your registration rather than an engine code, so we would confirm it from the VIN before any work.',
      interval: f.interval,
      source: f.source
    };
  }
  return null;
}

function contested(text){
  for (var i = 0; i < CONTESTED_ENGINES.length; i++){
    if (CONTESTED_ENGINES[i].match.test(text || '')) return CONTESTED_ENGINES[i];
  }
  return null;
}

/* Fall back to the audited pricing data: which engines could this be? */
function candidateEngines(make, cc){
  if (typeof PRICING === 'undefined' || !make) return [];
  var litres = cc ? (Math.round(Number(cc) / 100) / 10) : null;
  var found = {};
  for (var i = 0; i < PRICING.length; i++){
    var r = PRICING[i];
    var makes = r.makes || (r.make ? [r.make] : []);
    if (makes.length && makes.indexOf(make) === -1) continue;
    (r.engines || []).forEach(function(e){
      if (litres){
        var m = String(e).match(/(\d\.\d)/);
        if (m && Math.abs(parseFloat(m[1]) - litres) > 0.05) return;
      }
      found[e] = r.service;
    });
  }
  return Object.keys(found).map(function(e){ return { engine: e, service: found[e] }; });
}

function kindFromService(service){
  return /chain/i.test(service || '') ? 'chain' : 'wet';
}

/* ---------- rendering ---------- */
function render(v, vehicle){
  var kindMeta = TIMING_KINDS[v.kind] || TIMING_KINDS.confirm;
  var chips = [vehicle.make, vehicle.model, vehicle.year, vehicle.fuel,
               vehicle.engineSize ? vehicle.engineSize + 'cc' : null,
               vehicle.engineCode ? 'Engine code ' + vehicle.engineCode : null]
              .filter(Boolean).map(function(c){ return '<span class="v-chip">' + esc(c) + '</span>'; }).join('');

  var confLabel = v.confidence === 'definitive' ? 'Confirmed from engine code'
                : v.confidence === 'likely' ? 'Most likely, worth confirming'
                : 'We need to confirm this';

  var body =
    '<div class="v-card v-' + esc(kindMeta.tone) + '">' +
      '<div class="v-kind">' + esc(kindMeta.label) + '</div>' +
      '<h2>' + esc(v.headline || kindMeta.headline) + '</h2>' +
      '<span class="v-conf ' + esc(v.confidence) + '">' + esc(confLabel) + '</span>' +
      '<div class="v-vehicle">' + chips + '</div>' +
      (v.note ? '<p>' + esc(v.note) + '</p>' : '') +
      (v.interval ? '<div class="v-interval"><b>Replacement guidance</b>' + esc(v.interval) + '</div>' : '') +
      '<div class="v-actions">' +
        '<a class="btn btn-primary" href="index.html#quote">Get a price for this job</a>' +
        '<a class="btn btn-ghost" href="tel:01942800252">Talk it through, 01942 800252</a>' +
      '</div>' +
      (v.source ? '<div class="v-src">Checked against: ' + esc(v.source) + '</div>' : '') +
    '</div>';

  out.innerHTML = body;
  out.classList.add('show');
}

/* ---------- main ---------- */
function check(){
  var v = (reg.value || '').toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z0-9]{2,8}$/.test(v)){
    say('Please enter a valid UK registration.', 'err');
    reg.focus();
    return;
  }
  out.classList.remove('show');
  btn.disabled = true;
  say('Looking up ' + v + '…');

  fetch('/api/vehicle-lookup?vrm=' + encodeURIComponent(v))
    .then(function(r){ return r.json(); })
    .then(function(j){
      btn.disabled = false;
      if (!j || !j.ok){
        say((j && j.error) || 'We could not find that registration. Give us a ring and we will check it manually.', 'err');
        return;
      }
      say('');
      var vehicle = {
        make: j.make, model: j.model, year: j.year, fuel: j.fuel,
        engineSize: j.engineSize, engineCode: j.engineCode
      };
      var haystack = [j.model, j.variant, j.engineCode].filter(Boolean).join(' ');

      /* 1. engine code */
      var byCode = byEngineCode(j.engineCode, j.year);
      if (byCode){ render(byCode, vehicle); return; }

      /* 2. known contested engine */
      var cont = contested(haystack);
      if (cont){
        render({
          confidence: 'confirm', kind: 'confirm',
          headline: 'We will confirm this one properly.',
          note: cont.why + ' ' + cont.action
        }, vehicle);
        return;
      }

      /* 3. the manufacturer's model description names the engine family */
      var byText = byModelText(haystack, j.engineSize, j.year);
      if (byText){ render(byText, vehicle); return; }

      /* 4. narrow against our own audited data */
      var cands = candidateEngines(j.make, j.engineSize);
      if (cands.length === 1){
        var only = cands[0];
        var kind = kindFromService(only.service);
        render({
          confidence: 'likely', kind: kind,
          headline: kind === 'chain'
            ? 'This engine looks to be chain driven.'
            : 'This engine looks to have a wet timing belt.',
          note: 'Identified as a ' + only.engine + ' from your registration. Your reg did not return an engine code, so we would confirm this from the VIN before any work, but this is what our data shows for this vehicle.',
          engineName: only.engine
        }, vehicle);
        return;
      }

      /* 4. do not guess */
      render({
        confidence: 'confirm', kind: 'confirm',
        headline: 'We need one more detail to be certain.',
        note: cands.length > 1
          ? 'This model came with more than one engine (' + cands.slice(0,5).map(function(c){ return c.engine; }).join(', ') + '), and your registration did not return an engine code. Ring us with the reg and we will confirm it from the VIN in a minute, free of charge.'
          : 'Your registration did not return enough detail for us to be certain, and we would rather confirm it than guess. Ring us with the reg and we will check it properly, free of charge.'
      }, vehicle);
    })
    .catch(function(){
      btn.disabled = false;
      say('The lookup is not responding. Please ring us on 01942 800252 and we will check it for you.', 'err');
    });
}

if (btn) btn.addEventListener('click', check);
if (reg){
  reg.addEventListener('input', function(){
    var up = reg.value.toUpperCase();
    if (up !== reg.value) reg.value = up;
  });
  reg.addEventListener('keydown', function(e){ if (e.key === 'Enter') check(); });
}
})();
