/* ============================================================
   WIGAN WETBELTS — app.js
   Quote engine + UI wiring. Behaviour is intentionally identical
   to the previous site: same job types, same estimate maths
   (autoQuote / VAT 20%), same FormSubmit + Supabase submission,
   same localStorage backup keys.
   ============================================================ */
(function(){
'use strict';

/* ---------------- entry animation ----------------
   3D logo intro. Shows once per browser session, skippable with a
   tap/click, removed entirely for reduced-motion users. Lightweight:
   pure CSS transforms, no libraries, mobile safe. */
(function intro(){
  var el = document.getElementById('intro');
  if (!el) return;
  var reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion:reduce)').matches; } catch(_){}
  var seen = false;
  try { seen = sessionStorage.getItem('wwb.intro.v1') === '1'; } catch(_){}
  if (reduced || seen){ el.parentNode.removeChild(el); return; }
  try { sessionStorage.setItem('wwb.intro.v1', '1'); } catch(_){}
  document.body.classList.add('intro-lock');
  var finished = false;
  function done(){
    if (finished) return;
    finished = true;
    el.classList.add('intro-done');
    document.body.classList.remove('intro-lock');
    setTimeout(function(){ if (el.parentNode) el.parentNode.removeChild(el); }, 750);
  }
  el.addEventListener('click', done);
  el.addEventListener('touchend', done, {passive:true});
  setTimeout(done, 2700);
})();

/* ---------------- hero background video ----------------
   Muted looping clip. Fades in only once it can actually play (so a
   missing file just leaves the styled dark hero), pauses off-screen to
   save phone batteries, and is removed for reduced-motion users. */
(function loopVideos(){
  var vids = document.querySelectorAll('video.loopvid');
  if (!vids.length) return;
  var reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion:reduce)').matches; } catch(_){}
  vids.forEach(function(vid){
    if (reduced){ vid.parentNode.removeChild(vid); return; }
    vid.addEventListener('canplay', function(){
      vid.classList.add('hv-ready');
      try { vid.playbackRate = 0.85; } catch(_){}
    });
    vid.addEventListener('error', function(){ vid.classList.remove('hv-ready'); }, true);
    if ('IntersectionObserver' in window){
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(e){
          if (e.isIntersecting){ var p = vid.play(); if (p && p.catch) p.catch(function(){}); }
          else vid.pause();
        });
      }, { threshold: 0.05 });
      io.observe(vid);
    }
  });
})();

/* ---------------- sound toggle on motion tiles ----------------
   Autoplay must stay muted (browser policy); a tap on the speaker
   button unmutes that clip. Tapping again mutes it. */
document.querySelectorAll('.mt-sound').forEach(function(btn){
  btn.addEventListener('click', function(e){
    e.stopPropagation();
    var vid = btn.parentNode.querySelector('video');
    if (!vid) return;
    vid.muted = !vid.muted;
    var on = !vid.muted;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-label', on ? 'Turn sound off' : 'Turn sound on');
    var offIcon = btn.querySelector('.ms-off');
    var onIcon = btn.querySelector('.ms-on');
    if (offIcon) offIcon.style.display = on ? 'none' : '';
    if (onIcon) onIcon.style.display = on ? '' : 'none';
    if (on){ var p = vid.play(); if (p && p.catch) p.catch(function(){}); }
  });
});

/* ---------------- basic chrome ---------------- */
var yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

var nav = document.getElementById('nav');
function onScroll(){ if (nav) nav.classList.toggle('scrolled', window.scrollY > 24); }
document.addEventListener('scroll', onScroll, {passive:true});
onScroll();

var menuBtn = document.getElementById('menuBtn');
var mobileMenu = document.getElementById('mobileMenu');
function setMenu(open){
  if (!menuBtn || !mobileMenu) return;
  menuBtn.classList.toggle('open', open);
  mobileMenu.classList.toggle('open', open);
  menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  mobileMenu.setAttribute('aria-hidden', open ? 'false' : 'true');
  document.body.style.overflow = open ? 'hidden' : '';
}
if (menuBtn) menuBtn.addEventListener('click', function(){ setMenu(!menuBtn.classList.contains('open')); });
if (mobileMenu) mobileMenu.querySelectorAll('a').forEach(function(a){ a.addEventListener('click', function(){ setMenu(false); }); });

var NAV_OFFSET = 86;
document.querySelectorAll('a[href^="#"]').forEach(function(link){
  link.addEventListener('click', function(e){
    var href = link.getAttribute('href');
    if (!href || href.length < 2) return;
    var target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    var top = target.getBoundingClientRect().top + window.pageYOffset - NAV_OFFSET;
    window.scrollTo({ top: top, behavior: 'smooth' });
    history.replaceState(null, '', href);
  });
});

/* section highlighting + reveal */
if ('IntersectionObserver' in window){
  var sections = ['home','services','quote','why','videos','reviews','contact']
    .map(function(id){ return document.getElementById(id); }).filter(Boolean);
  var navLinks = document.querySelectorAll('.nav-links a');
  var sectionIO = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if (entry.isIntersecting && entry.intersectionRatio > 0.4){
        var id = entry.target.id;
        navLinks.forEach(function(l){ l.classList.toggle('active', l.getAttribute('href') === '#' + id); });
      }
    });
  }, { threshold: [0.4] });
  sections.forEach(function(s){ sectionIO.observe(s); });

  var revealIO = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if (entry.isIntersecting){ entry.target.classList.add('in'); revealIO.unobserve(entry.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach(function(r){ revealIO.observe(r); });
} else {
  document.querySelectorAll('.reveal').forEach(function(r){ r.classList.add('in'); });
}

/* ---------------- vehicle index (from PRICING in data.js) ---------------- */
var VEHICLES = (function buildVehicles(){
  var v = {};
  for (var i = 0; i < PRICING.length; i++){
    var r = PRICING[i];
    var makes = r.makes || (r.make ? [r.make] : []);
    var models = r.models || (r.model ? [r.model] : []);
    var engines = r.engines || (r.engine ? [r.engine] : []);
    for (var m = 0; m < makes.length; m++){
      var mk = makes[m];
      if (!v[mk]) v[mk] = {};
      for (var n = 0; n < models.length; n++){
        var md = models[n];
        if (!v[mk][md]) v[mk][md] = [];
        for (var e = 0; e < engines.length; e++){
          if (v[mk][md].indexOf(engines[e]) === -1) v[mk][md].push(engines[e]);
        }
      }
    }
  }
  Object.keys(v).forEach(function(mk){
    var sorted = {};
    Object.keys(v[mk]).sort().forEach(function(md){ sorted[md] = v[mk][md]; });
    v[mk] = sorted;
  });
  return v;
})();

/* ---------------- pricing engine ----------------
   Public job "Timing Belt / Wet Belt Replacement" merges the two
   internal services so the customer never has to choose between a
   cam belt job and a wet oil pump belt job. When both match, the
   most comprehensive (highest priced) rule wins and the result is
   flagged hasWetSystem. */
function serviceMatches(ruleService, jobType){
  if (ruleService === jobType) return true;
  if (jobType === 'Timing Belt / Wet Belt Replacement'){
    return ruleService === 'Belt / Wet Belt Replacement'
        || ruleService === 'Wet Oil Pump Belt Replacement';
  }
  return false;
}

function calculateNet(make, model, engine, jobType, year){
  if (!make || !model || !engine || !jobType) return null;
  var y = year ? parseInt(year, 10) : null;
  var matches = [], sawWetSystem = false;

  for (var i = 0; i < PRICING.length; i++){
    var r = PRICING[i];
    if (!serviceMatches(r.service, jobType)) continue;
    if (r.make && r.make !== make) continue;
    if (r.makes && r.makes.indexOf(make) === -1) continue;
    var engineList = r.engines || (r.engine ? [r.engine] : null);
    if (engineList && engineList.indexOf(engine) === -1) continue;
    var modelList = r.models || (r.model ? [r.model] : null);
    if (modelList && modelList.indexOf(model) === -1) continue;
    if (y !== null && (r.yearFrom !== undefined || r.yearTo !== undefined)){
      if (r.yearFrom !== undefined && y < r.yearFrom) continue;
      if (r.yearTo !== undefined && y > r.yearTo) continue;
    }
    matches.push(r);
    if (r.service === 'Wet Oil Pump Belt Replacement') sawWetSystem = true;
  }
  if (matches.length === 0) return null;

  matches.sort(function(a, b){
    var aMax = (a.to !== undefined) ? a.to : a.from;
    var bMax = (b.to !== undefined) ? b.to : b.from;
    if (bMax !== aMax) return bMax - aMax;
    return b.from - a.from;
  });
  var r2 = matches[0];

  var p = { from: r2.from };
  if (r2.to !== undefined) p.to = r2.to;
  if (r2.plus === true) p.plus = true;
  if (r2.exact === true) p.exact = true;
  if (r2.noFloor === true) p.noFloor = true;
  if (r2.note) p.note = r2.note;
  if (r2.hrsFrom !== undefined) p.hrsFrom = r2.hrsFrom;
  if (r2.hrsTo !== undefined) p.hrsTo = r2.hrsTo;
  if (r2.kitFrom !== undefined) p.kitFrom = r2.kitFrom;
  if (r2.kitTo !== undefined) p.kitTo = r2.kitTo;
  p.hasWetSystem = sawWetSystem || r2.service === 'Wet Oil Pump Belt Replacement';
  p.serviceUsed = r2.service;
  p.jobType = jobType;
  return p;
}

/* auto-quote figure: range spread >= £100 -> (max - 100); tighter -> max; fixed -> from */
function autoQuote(p){
  if (!p || typeof p.from !== 'number') return 0;
  if (p.to === undefined) return p.from;
  var spread = p.to - p.from;
  return spread >= 100 ? (p.to - 100) : p.to;
}

/* ---------------- dropdown filtering ---------------- */
function _allMakes(){ return Object.keys(VEHICLES); }
function _allModelsForMake(make){ return VEHICLES[make] ? Object.keys(VEHICLES[make]) : []; }
function _allEnginesForMakeModel(make, model){
  return (VEHICLES[make] && VEHICLES[make][model]) ? VEHICLES[make][model].slice() : [];
}

function makesForService(service){
  if (!service) return [];
  var matched = {}, hasUniversal = false;
  for (var i = 0; i < PRICING.length; i++){
    var r = PRICING[i];
    if (!serviceMatches(r.service, service)) continue;
    var ms = r.makes || (r.make ? [r.make] : []);
    if (ms.length === 0){ hasUniversal = true; continue; }
    for (var j = 0; j < ms.length; j++) matched[ms[j]] = true;
  }
  if (hasUniversal) _allMakes().forEach(function(m){ matched[m] = true; });
  return Object.keys(matched).sort();
}

function modelsForMakeService(make, service){
  if (!make || !service) return [];
  var matched = {}, hasUniversal = false;
  for (var i = 0; i < PRICING.length; i++){
    var r = PRICING[i];
    if (!serviceMatches(r.service, service)) continue;
    var ms = r.makes || (r.make ? [r.make] : []);
    if (ms.length > 0 && ms.indexOf(make) === -1) continue;
    var mds = r.models || (r.model ? [r.model] : []);
    if (mds.length === 0){ hasUniversal = true; continue; }
    for (var j = 0; j < mds.length; j++) matched[mds[j]] = true;
  }
  if (hasUniversal) _allModelsForMake(make).forEach(function(m){ matched[m] = true; });
  return Object.keys(matched).sort();
}

function enginesForMakeModelService(make, model, service, year){
  if (!make || !model || !service) return [];
  var y = year ? parseInt(year, 10) : null;
  var matched = {}, hasUniversal = false, ordered = [];
  for (var i = 0; i < PRICING.length; i++){
    var r = PRICING[i];
    if (!serviceMatches(r.service, service)) continue;
    var ms = r.makes || (r.make ? [r.make] : []);
    if (ms.length > 0 && ms.indexOf(make) === -1) continue;
    var mds = r.models || (r.model ? [r.model] : []);
    if (mds.length > 0 && mds.indexOf(model) === -1) continue;
    if (y !== null && (r.yearFrom !== undefined || r.yearTo !== undefined)){
      if (r.yearFrom !== undefined && y < r.yearFrom) continue;
      if (r.yearTo !== undefined && y > r.yearTo) continue;
    }
    var es = r.engines || (r.engine ? [r.engine] : []);
    if (es.length === 0){ hasUniversal = true; continue; }
    for (var j = 0; j < es.length; j++){
      if (!matched[es[j]]){ matched[es[j]] = true; ordered.push(es[j]); }
    }
  }
  if (hasUniversal){
    _allEnginesForMakeModel(make, model).forEach(function(e){
      if (!matched[e]){ matched[e] = true; ordered.push(e); }
    });
  }
  return ordered;
}

/* ---------------- formatting ---------------- */
function fmt(n){
  return '£' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmt0(n){
  var v = Number(n);
  if (v === Math.floor(v)) return '£' + v.toLocaleString('en-GB', { maximumFractionDigits: 0 });
  return fmt(v);
}

function serviceIncludesFor(jobType, p){
  if (jobType === 'Timing Belt / Wet Belt Replacement'){
    return [
      'OEM timing belt kit (belt, tensioners, idlers)',
      'Oil pump belt replacement where applicable',
      'Pickup strainer inspection &amp; clean',
      'Fresh engine oil and filter',
      'Coolant refill where applicable',
      'Timing alignment &amp; calibration check'
    ];
  }
  if (jobType === 'Timing Chain Replacement'){
    return [
      'OEM timing chain kit (chain, tensioners, guides, sprockets where required)',
      'Crankshaft &amp; camshaft alignment',
      'Fresh engine oil and filter',
      'Coolant refill where applicable',
      'Timing alignment &amp; calibration check',
      'Road test after fitting'
    ];
  }
  if (jobType === 'Diagnosis / Inspection'){
    return [
      'Workshop diagnostic inspection',
      'Visual + listening assessment of timing system condition',
      'Photo / short video evidence where useful',
      'Written repair recommendation &amp; quote'
    ];
  }
  return [];
}

function priceLabel(p, kind){
  if (!p) return 'Quote required';
  var auto = autoQuote(p);
  if (kind === 'range'){
    if (p.exact) return fmt(p.from);
    if (p.to === undefined) return 'From ' + fmt(p.from) + (p.plus ? '+' : '');
    return 'FROM ' + fmt(p.from) + ' to ' + fmt(p.to);
  }
  var amount;
  if (kind === 'vat') amount = +(auto * 0.20).toFixed(2);
  else if (kind === 'gross') amount = +((auto * 1.20)).toFixed(2);
  else amount = auto;
  return fmt(amount);
}

/* ---------------- element refs ---------------- */
var qMake = document.getElementById('qMake');
var qModel = document.getElementById('qModel');
var qEngine = document.getElementById('qEngine');
var qJob = document.getElementById('qJob');
var qDate = document.getElementById('qDate');
var qName = document.getElementById('qName');
var qPhone = document.getElementById('qPhone');
var qEmail = document.getElementById('qEmail');
var qMsg = document.getElementById('qMsg');
var qReg = document.getElementById('qReg');
var qYear = document.getElementById('qYear');
var qContact = document.getElementById('qContact');
var qContactGrid = document.getElementById('qContactGrid');

var qcMake = document.getElementById('qcMake');
var qcModel = document.getElementById('qcModel');
var qcEngine = document.getElementById('qcEngine');
var qcYear = document.getElementById('qcYear');
var qcJob = document.getElementById('qcJob');
var qcStatus = document.getElementById('qcStatus');
var qcPrices = document.getElementById('qcPrices');
var qcNet = document.getElementById('qcNet');
var qcVat = document.getElementById('qcVat');
var qcGross = document.getElementById('qcGross');
var qcRange = document.getElementById('qcRange');
var qcRangeBlock = document.getElementById('qcRangeBlock');
var qcHrs = document.getElementById('qcHrs');
var qcHrsLine = document.getElementById('qcHrsLine');
var qcServiceIncludes = document.getElementById('qcServiceIncludes');
var qcServiceIncludesList = document.getElementById('qcServiceIncludesList');
var qcMessage = document.getElementById('qcMessage');
var qcConfirm = document.getElementById('qcConfirm');
var qcFeedback = document.getElementById('qcFeedback');
var qcSummary = document.getElementById('qcSummary');

var PLACEHOLDER = '…';

/* year dropdown 2026 -> 2008 */
(function fillYears(){
  if (!qYear) return;
  for (var y = 2026; y >= 2008; y--){
    var o = document.createElement('option');
    o.value = String(y); o.textContent = String(y);
    qYear.appendChild(o);
  }
})();

/* ---------------- contact method tiles ---------------- */
function setContactMethod(value, fire){
  if (!qContact || !qContactGrid) return;
  var tiles = qContactGrid.querySelectorAll('.qf-pcm-opt');
  var matched = false;
  tiles.forEach(function(b){
    var active = (b.getAttribute('data-value') === value);
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-checked', active ? 'true' : 'false');
    b.tabIndex = active ? 0 : -1;
    if (active) matched = true;
  });
  if (!matched){
    var first = qContactGrid.querySelector('.qf-pcm-opt[data-value="Phone Call"]');
    if (first){ first.classList.add('is-active'); first.setAttribute('aria-checked','true'); first.tabIndex = 0; value = 'Phone Call'; }
  }
  qContact.value = value;
  if (fire){ try { qContact.dispatchEvent(new Event('change', {bubbles:true})); } catch(_){} }
}
if (qContactGrid){
  qContactGrid.addEventListener('click', function(e){
    var btn = e.target.closest('.qf-pcm-opt');
    if (!btn || !qContactGrid.contains(btn)) return;
    setContactMethod(btn.getAttribute('data-value'), true);
  });
  qContactGrid.addEventListener('keydown', function(e){
    var current = e.target.closest('.qf-pcm-opt');
    if (!current) return;
    var tiles = Array.prototype.slice.call(qContactGrid.querySelectorAll('.qf-pcm-opt'));
    var idx = tiles.indexOf(current);
    if (idx === -1) return;
    var next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown'){ next = tiles[(idx + 1) % tiles.length]; }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp'){ next = tiles[(idx - 1 + tiles.length) % tiles.length]; }
    else if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); setContactMethod(current.getAttribute('data-value'), true); return; }
    if (next){ e.preventDefault(); setContactMethod(next.getAttribute('data-value'), true); next.focus(); }
  });
  qContactGrid.querySelectorAll('.qf-pcm-opt').forEach(function(b){
    b.tabIndex = b.classList.contains('is-active') ? 0 : -1;
  });
}

/* ---------------- cascade ---------------- */
function clearAndAdd(select, items, placeholder){
  if (!select) return;
  select.innerHTML = '';
  var ph = document.createElement('option');
  ph.value = ''; ph.textContent = placeholder;
  select.appendChild(ph);
  items.forEach(function(it){
    var o = document.createElement('option');
    o.value = it; o.textContent = it;
    select.appendChild(o);
  });
}
function resetMakeDropdown(){ if (qMake){ clearAndAdd(qMake, [], 'Select job type first…'); qMake.value=''; qMake.disabled = true; } }
function resetModelDropdown(){ if (qModel){ clearAndAdd(qModel, [], 'Select model…'); qModel.value=''; qModel.disabled = true; } }
function resetEngineDropdown(){ if (qEngine){ clearAndAdd(qEngine, [], 'Select engine…'); qEngine.value=''; qEngine.disabled = true; } }

resetMakeDropdown(); resetModelDropdown(); resetEngineDropdown();

if (qJob) qJob.addEventListener('change', function(){
  var service = qJob.value;
  resetMakeDropdown(); resetModelDropdown(); resetEngineDropdown();
  if (service){
    var makes = makesForService(service);
    clearAndAdd(qMake, makes, 'Select make…');
    qMake.disabled = (makes.length === 0);
  }
  updateQuoteCard();
});

if (qMake) qMake.addEventListener('change', function(){
  var make = qMake.value;
  var service = qJob ? qJob.value : '';
  resetModelDropdown(); resetEngineDropdown();
  if (make && service){
    var models = modelsForMakeService(make, service);
    clearAndAdd(qModel, models, 'Select model…');
    qModel.disabled = (models.length === 0);
  }
  updateQuoteCard();
});

function rebuildEngines(){
  var make = qMake ? qMake.value : '';
  var model = qModel ? qModel.value : '';
  var service = qJob ? qJob.value : '';
  var year = qYear ? qYear.value : '';
  resetEngineDropdown();
  if (make && model && service){
    var engines = enginesForMakeModelService(make, model, service, year);
    clearAndAdd(qEngine, engines, 'Select engine…');
    qEngine.disabled = (engines.length === 0);
    if (engines.length === 1) qEngine.value = engines[0];
  }
}
if (qModel) qModel.addEventListener('change', function(){ rebuildEngines(); updateQuoteCard(); });
if (qEngine) qEngine.addEventListener('change', updateQuoteCard);
if (qYear) qYear.addEventListener('change', function(){ rebuildEngines(); updateQuoteCard(); });

/* included panel highlight */
function updateIncludedPanel(service){
  var panel = document.getElementById('qcIncluded');
  if (!panel) return;
  var key = (service === 'Timing Chain Replacement') ? 'chain' : 'wet';
  panel.setAttribute('data-service', key);
  panel.querySelectorAll('.qci-list').forEach(function(ul){
    ul.hidden = false;
    ul.classList.toggle('qci-list--active', ul.getAttribute('data-for') === key);
  });
}

function updateExtraNote(noteText){
  var el = document.getElementById('qcExtraNote');
  if (!el) return;
  if (noteText){
    el.innerHTML = '<span><strong>Note: </strong>' + noteText + '</span>';
    el.hidden = false;
  } else {
    el.innerHTML = '';
    el.hidden = true;
  }
}

/* ---------------- quote card ---------------- */
function updateQuoteCard(){
  var make = qMake ? qMake.value : '';
  var model = qModel ? qModel.value : '';
  var engine = qEngine ? qEngine.value : '';
  var job = qJob ? qJob.value : '';
  var year = qYear ? qYear.value : '';

  if (qcMake) qcMake.textContent = make || PLACEHOLDER;
  if (qcModel) qcModel.textContent = model || PLACEHOLDER;
  if (qcEngine) qcEngine.textContent = engine || PLACEHOLDER;
  if (qcYear) qcYear.textContent = year || PLACEHOLDER;
  if (qcJob) qcJob.textContent = job || PLACEHOLDER;

  /* timing drive badge — shown as soon as the vehicle is identified */
  var qcDrive = document.getElementById('qcDrive');
  if (qcDrive){
    var verdict = (make && model && engine) ? timingVerdict(make, model, engine, year) : null;
    if (verdict){
      qcDrive.className = 'drive-badge drive-' + verdict.kind;
      qcDrive.innerHTML =
        '<span class="db-kind">' + verdict.label + '</span>' +
        '<span class="db-note">' + verdict.note + '</span>';
      qcDrive.hidden = false;
    } else {
      qcDrive.hidden = true;
      qcDrive.innerHTML = '';
    }
  }

  updateIncludedPanel(job);

  if (qcFeedback){ qcFeedback.classList.remove('show','success','error'); qcFeedback.textContent = ''; }

  if (!make || !model || !engine || !job){
    qcStatus.textContent = 'Awaiting selection';
    qcStatus.classList.remove('ready','enq');
    qcPrices.hidden = true;
    qcMessage.style.display = '';
    qcMessage.classList.remove('warn');
    qcMessage.textContent = 'Please select a make, model, engine and job type to view your estimate.';
    updateExtraNote(null);
    return;
  }

  var p = calculateNet(make, model, engine, job, year);

  if (p === null){
    qcStatus.textContent = 'Enquiry required';
    qcStatus.classList.remove('ready');
    qcStatus.classList.add('enq');
    qcPrices.hidden = true;
    qcMessage.style.display = '';
    qcMessage.classList.add('warn');
    qcMessage.textContent = 'Quote required, our team will confirm.';
    updateExtraNote(null);
    return;
  }

  qcNet.textContent = priceLabel(p, 'net');
  qcVat.textContent = priceLabel(p, 'vat');
  qcGross.textContent = priceLabel(p, 'gross');

  if (qcRange){
    if (p.exact){
      qcRange.innerHTML = '<span class="qc-dealer-line">Estimated From ' + fmt0(p.from) + ' + VAT</span>';
    } else if (p.to === undefined){
      qcRange.innerHTML = '<span class="qc-dealer-line">Estimated From ' + fmt0(p.from) + (p.plus ? '+' : '') + ' + VAT</span>';
    } else {
      qcRange.innerHTML =
        '<span class="qc-dealer-line">FROM ' + fmt0(p.from) + ' + VAT</span>' +
        '<span class="qc-dealer-line">TO ' + fmt0(p.to) + ' + VAT</span>';
    }
    if (qcRangeBlock) qcRangeBlock.hidden = false;
  }

  if (qcHrsLine && qcHrs){
    if (typeof p.hrsFrom === 'number' && typeof p.hrsTo === 'number'){
      qcHrs.textContent = p.hrsFrom.toFixed(1) + ' to ' + p.hrsTo.toFixed(1) + ' hrs';
      qcHrsLine.hidden = false;
    } else {
      qcHrs.textContent = '';
      qcHrsLine.hidden = true;
    }
  }

  if (qcServiceIncludes && qcServiceIncludesList){
    var items = serviceIncludesFor(job, p);
    qcServiceIncludesList.innerHTML = items.map(function(s){ return '<li>' + s + '</li>'; }).join('');
    qcServiceIncludes.hidden = items.length === 0;
  }

  qcPrices.hidden = false;
  qcStatus.textContent = 'Estimate ready';
  qcStatus.classList.add('ready');
  qcStatus.classList.remove('enq');
  qcMessage.classList.remove('warn');
  qcMessage.textContent = '';
  qcMessage.style.display = 'none';
  updateExtraNote(p.note || null);
}
updateQuoteCard();

/* ---------------- submit ---------------- */
if (qcConfirm){
  qcConfirm.addEventListener('click', function(){
    var name = (qName && qName.value.trim()) || '';
    var phone = (qPhone && qPhone.value.trim()) || '';
    var email = (qEmail && qEmail.value.trim()) || '';
    var reg = (qReg && qReg.value.trim().toUpperCase()) || '';
    var make = qMake ? qMake.value : '';
    var model = qModel ? qModel.value : '';
    var engine = qEngine ? qEngine.value : '';
    var job = qJob ? qJob.value : '';
    var date = qDate ? qDate.value : '';
    var msg = qMsg ? qMsg.value.trim() : '';
    var year = qYear ? qYear.value : '';
    var contact = (qContact && qContact.value) || 'Phone Call';

    qcFeedback.classList.remove('show','success','error');

    if (!reg || !name || !phone){
      var missing = [];
      if (!reg) missing.push('vehicle registration');
      if (!name) missing.push('your name');
      if (!phone) missing.push('phone number');
      qcFeedback.textContent = 'Please complete the required fields (' + missing.join(', ') + ') so we can call you back.';
      qcFeedback.classList.add('show','error');
      if (qcSummary){ qcSummary.hidden = true; qcSummary.innerHTML = ''; }
      if (!reg && qReg) qReg.focus();
      else if (!name && qName) qName.focus();
      else if (!phone && qPhone) qPhone.focus();
      return;
    }

    var p = calculateNet(make, model, engine, job, year);
    var netLbl = priceLabel(p, 'net');
    var vatLbl = priceLabel(p, 'vat');
    var grossLbl = priceLabel(p, 'gross');
    var isRangeOrPlus = !!(p && (p.to || p.plus));

    function v(val){ return (val && String(val).trim()) ? String(val).trim() : 'Not provided'; }
    function esc(s){ return String(s).replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]; }); }

    /* plain-text summary (mailto fallback body) */
    var lines = [];
    lines.push('NEW WEBSITE QUOTE ENQUIRY');
    lines.push('');
    lines.push('CUSTOMER DETAILS');
    lines.push('Name: ' + name);
    lines.push('Phone: ' + phone);
    lines.push('Email: ' + v(email));
    lines.push('Preferred Contact Method: ' + contact);
    lines.push('');
    lines.push('VEHICLE DETAILS');
    lines.push('Registration: ' + v(reg));
    lines.push('Year: ' + v(year));
    lines.push('Make: ' + v(make));
    lines.push('Model: ' + v(model));
    lines.push('Engine: ' + v(engine));
    lines.push('');
    lines.push('SERVICE REQUESTED');
    lines.push('Selected job: ' + v(job));
    if (date) lines.push('Preferred date: ' + date);
    lines.push('');
    lines.push('ESTIMATE');
    if (p){
      var dealerRangeText;
      if (p.exact) dealerRangeText = 'Estimated From ' + fmt0(p.from) + ' + VAT';
      else if (p.to === undefined) dealerRangeText = 'Estimated From ' + fmt0(p.from) + (p.plus ? '+' : '') + ' + VAT';
      else dealerRangeText = 'FROM ' + fmt0(p.from) + ' + VAT / TO ' + fmt0(p.to) + ' + VAT';
      lines.push('Estimated Repair Pricing: ' + dealerRangeText);
      if (isRangeOrPlus){
        var topVal = p.to ? fmt(p.to) : (fmt(p.from) + '+');
        lines.push('Estimated from: ' + fmt(p.from) + (p.to ? (' to ' + topVal) : '+') + ' (excluding VAT)');
      }
      lines.push('Estimated Workshop Quote (ex VAT): ' + netLbl);
      lines.push('VAT (20%): ' + vatLbl);
      lines.push('Total (including VAT): ' + grossLbl);
      if (typeof p.hrsFrom === 'number' && typeof p.hrsTo === 'number'){
        lines.push('Estimated Repair Time: ' + p.hrsFrom.toFixed(1) + ' to ' + p.hrsTo.toFixed(1) + ' hours');
      }
      var siList = serviceIncludesFor(job, p);
      if (siList && siList.length){
        lines.push('');
        lines.push('SERVICE INCLUDES');
        siList.forEach(function(s){ lines.push('- ' + s.replace(/&amp;/g, '&')); });
      }
      if (p.note){ lines.push(''); lines.push('SERVICE NOTE'); lines.push(p.note); }
    } else {
      lines.push('Quote required. Our team will confirm.');
    }
    if (msg){ lines.push(''); lines.push('CUSTOMER NOTES'); lines.push(msg); }
    lines.push('');
    lines.push('Submitted via wiganwetbelts.co.uk');

    /* on-page enquiry summary */
    var labelStyle = 'font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;font-weight:600;';
    var groupGap = 'margin:14px 0 6px;';
    var firstGap = 'margin:0 0 6px;';
    var estimateRows;
    if (p){
      var dealerRangeHtml;
      if (p.exact){
        dealerRangeHtml = '<span style="display:block">Estimated From ' + esc(fmt0(p.from)) + ' + VAT</span>';
      } else if (p.to === undefined){
        dealerRangeHtml = '<span style="display:block">Estimated From ' + esc(fmt0(p.from)) + (p.plus ? '+' : '') + ' + VAT</span>';
      } else {
        dealerRangeHtml = '<span style="display:block">FROM ' + esc(fmt0(p.from)) + ' + VAT</span>' +
                          '<span style="display:block">TO ' + esc(fmt0(p.to)) + ' + VAT</span>';
      }
      estimateRows =
        '<div style="font-size:.68rem;color:var(--muted);text-transform:uppercase;letter-spacing:.2em;font-weight:600;margin-bottom:8px">Estimated Repair Pricing</div>' +
        '<div style="font-size:1rem;color:var(--text);font-weight:600;margin-bottom:10px;line-height:1.45">' + dealerRangeHtml + '</div>' +
        '<div style="font-size:.74rem;color:var(--muted);line-height:1.5;margin-bottom:14px;font-weight:400">Final pricing can vary depending on vehicle condition, engine configuration, required components and inspection findings.</div>' +
        '<div class="qc-line"><span>Estimated Workshop Quote (ex VAT)</span><strong>' + esc(netLbl) + '</strong></div>' +
        '<div class="qc-line"><span>VAT (20%)</span><strong>' + esc(vatLbl) + '</strong></div>' +
        '<div class="qc-line qc-total"><span>Total (including VAT)</span><strong>' + esc(grossLbl) + '</strong></div>';
      if (typeof p.hrsFrom === 'number' && typeof p.hrsTo === 'number'){
        estimateRows += '<div class="qc-line"><span>Estimated Repair Time</span><strong>' +
          esc(p.hrsFrom.toFixed(1) + ' to ' + p.hrsTo.toFixed(1) + ' hrs') + '</strong></div>';
      }
      var siSummary = serviceIncludesFor(job, p);
      if (siSummary && siSummary.length){
        estimateRows +=
          '<div style="margin-top:14px;padding:12px 13px 11px;background:var(--accent-dim);border:1px solid var(--accent-line);border-radius:10px">' +
          '<div style="font-size:.62rem;font-weight:600;letter-spacing:.24em;text-transform:uppercase;color:var(--accent);margin-bottom:8px">Service Includes</div>' +
          '<ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:5px">' +
          siSummary.map(function(s){
            return '<li style="font-size:.82rem;color:var(--text-2);line-height:1.5;position:relative;padding-left:14px">' +
              '<span style="position:absolute;left:2px;top:.55em;width:4px;height:4px;border-radius:50%;background:var(--accent)"></span>' + s + '</li>';
          }).join('') +
          '</ul></div>';
      }
      if (p.note){
        estimateRows += '<div style="margin-top:10px;padding:10px 12px;background:var(--accent-dim);border:1px solid var(--accent-line);border-radius:10px;font-size:.85rem;color:var(--text-2);line-height:1.5"><strong style="color:var(--accent);font-weight:600">Note:</strong> ' + esc(p.note) + '</div>';
      }
    } else {
      estimateRows = '<div class="qc-line"><span>Status</span><strong style="color:var(--warn);font-size:.92rem">Quote required, our team will confirm</strong></div>';
    }

    if (qcSummary){
      var stamp = new Date().toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
      qcSummary.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px;flex-wrap:wrap">' +
          '<span style="font-size:.78rem;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--accent)">Enquiry Summary</span>' +
          '<span style="font-size:.7rem;color:var(--muted);letter-spacing:.04em">Sent ' + esc(stamp) + '</span>' +
        '</div>' +
        '<div style="' + labelStyle + firstGap + '">Customer</div>' +
        '<div class="qc-line"><span>Name</span><strong>' + esc(name) + '</strong></div>' +
        '<div class="qc-line"><span>Phone</span><strong>' + esc(phone) + '</strong></div>' +
        '<div class="qc-line"><span>Email</span><strong>' + esc(email || 'Not provided') + '</strong></div>' +
        '<div class="qc-line"><span>Preferred Contact</span><strong>' + esc(contact) + '</strong></div>' +
        '<div style="' + labelStyle + groupGap + '">Vehicle</div>' +
        '<div class="qc-line"><span>Registration</span><strong>' + esc(reg || 'Not provided') + '</strong></div>' +
        '<div class="qc-line"><span>Year</span><strong>' + esc(year || 'Not provided') + '</strong></div>' +
        '<div class="qc-line"><span>Make</span><strong>' + esc(make || 'Not provided') + '</strong></div>' +
        '<div class="qc-line"><span>Model</span><strong>' + esc(model || 'Not provided') + '</strong></div>' +
        '<div class="qc-line"><span>Engine</span><strong>' + esc(engine || 'Not provided') + '</strong></div>' +
        '<div style="' + labelStyle + groupGap + '">Service</div>' +
        '<div class="qc-line"><span>Selected job</span><strong>' + esc(job || 'Not provided') + '</strong></div>' +
        (date ? '<div class="qc-line"><span>Preferred date</span><strong>' + esc(date) + '</strong></div>' : '') +
        '<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--line)">' +
          '<div style="' + labelStyle + firstGap + '">Estimate</div>' + estimateRows +
        '</div>' +
        (msg ? '<div style="' + labelStyle + groupGap + '">Customer notes</div>' +
               '<div style="font-size:.92rem;color:var(--text-2);line-height:1.6;white-space:pre-wrap">' + esc(msg) + '</div>' : '');
      qcSummary.hidden = false;
    }

    /* sending state */
    qcFeedback.classList.remove('success','error');
    qcFeedback.textContent = 'Sending your enquiry, please wait…';
    qcFeedback.classList.add('show','sending');
    qcConfirm.disabled = true;
    qcConfirm.style.opacity = '0.65';
    qcConfirm.style.cursor = 'wait';

    function _restoreBtn(){
      qcConfirm.disabled = false;
      qcConfirm.style.opacity = '';
      qcConfirm.style.cursor = '';
    }

    function _showSuccess(){
      qcFeedback.classList.remove('error','sending');
      qcFeedback.innerHTML =
        '<span class="qc-fb-icon" aria-hidden="true">✓</span>' +
        '<div class="qc-fb-body">' +
          '<strong>Enquiry sent successfully</strong>' +
          '<small>Thank you for contacting <strong>Wigan Wetbelts</strong>. A member of our team will be in touch shortly. For urgent enquiries call ' +
          '<a href="tel:01942800252" style="color:inherit;text-decoration:underline">01942 800252</a>.</small>' +
          '<div class="qc-after-actions">' +
            '<button type="button" class="btn btn-primary qc-play-btn" id="qcPlayGame">' +
              '<span>Play Wet Belt Run</span>' +
              '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"/></svg>' +
            '</button>' +
            '<button type="button" class="btn btn-ghost qc-play-close" id="qcPlayClose">Close</button>' +
            '<small class="qc-play-hint">A small thank-you while we get to your enquiry.</small>' +
          '</div>' +
        '</div>';
      qcFeedback.classList.add('show','success');
      _restoreBtn();
      var playBtn = document.getElementById('qcPlayGame');
      var closeBtn = document.getElementById('qcPlayClose');
      if (playBtn) playBtn.addEventListener('click', function(){
        if (window.WBR && typeof window.WBR.open === 'function') window.WBR.open();
      });
      if (closeBtn) closeBtn.addEventListener('click', function(){
        qcFeedback.classList.remove('show','success');
        qcFeedback.innerHTML = '';
      });
      try {
        if (qcSummary && qcSummary.scrollIntoView){
          setTimeout(function(){ qcSummary.scrollIntoView({behavior:'smooth', block:'center'}); }, 140);
        }
      } catch(e){}
    }

    function _showError(){
      qcFeedback.classList.remove('success','sending');
      qcFeedback.innerHTML =
        '<span class="qc-fb-icon" aria-hidden="true">!</span>' +
        '<div class="qc-fb-body">' +
          '<strong>We couldn’t send your enquiry just now</strong>' +
          '<small>Please try again in a moment, or contact us directly: ' +
          '<a href="tel:01942800252" style="color:inherit;text-decoration:underline">01942 800252</a> &nbsp;·&nbsp; ' +
          '<a href="mailto:wiganwetbelts@gmail.com" style="color:inherit;text-decoration:underline">wiganwetbelts@gmail.com</a></small>' +
        '</div>';
      qcFeedback.classList.add('show','error');
      _restoreBtn();
    }

    var FORMSUBMIT_URL = 'https://formsubmit.co/ajax/wiganwetbelts@gmail.com';

    var customerAutoReply =
      'Thank you for your interest.\n\n' +
      'A member of our team will pick up your enquiry and create your own vehicle quote and availability.\n\n' +
      'We have received your vehicle details and preferred contact method. Our team will review the information and be in touch shortly.\n\n' +
      'For urgent enquiries, call us on 01942 800252.\n\n' +
      'Thanks,\n' +
      'Wigan Wetbelts\n' +
      'Unit 2E, Cricket Street, Wigan, WN6 7TP\n\n' +
      '━━━━━━━━━━━━━━━━━━━━\n' +
      'Please do not reply to this email as this is an automated notification inbox.\n' +
      'For direct support or urgent enquiries, contact:\n' +
      '01942 800252\n' +
      '━━━━━━━━━━━━━━━━━━━━';

    var estimateLine, dealerRangeLine, repairTimeLine, kitCostLine;
    if (p){
      if (p.to) estimateLine = 'Range ' + fmt(p.from) + ' to ' + fmt(p.to) + ' (ex VAT)';
      else if (p.plus) estimateLine = 'From ' + fmt(p.from) + '+ (ex VAT)';
      else if (p.exact) estimateLine = fmt(p.from) + ' (ex VAT, VAT-inclusive total displayed)';
      else estimateLine = 'From ' + fmt(p.from) + ' (ex VAT)';
      if (p.exact) dealerRangeLine = 'Estimated From ' + fmt0(p.from) + ' + VAT';
      else if (p.to === undefined) dealerRangeLine = 'Estimated From ' + fmt0(p.from) + (p.plus ? '+' : '') + ' + VAT';
      else dealerRangeLine = 'FROM ' + fmt0(p.from) + ' + VAT / TO ' + fmt0(p.to) + ' + VAT';
      repairTimeLine = (typeof p.hrsFrom === 'number' && typeof p.hrsTo === 'number')
        ? (p.hrsFrom.toFixed(1) + ' to ' + p.hrsTo.toFixed(1) + ' hours') : 'Not applicable';
      kitCostLine = (typeof p.kitFrom === 'number' && typeof p.kitTo === 'number')
        ? (fmt0(p.kitFrom) + ' to ' + fmt0(p.kitTo)) : 'Not applicable';
    } else {
      estimateLine = 'Quote required, workshop to confirm';
      dealerRangeLine = 'Not applicable';
      repairTimeLine = 'Not applicable';
      kitCostLine = 'Not applicable';
    }

    var quickReg = (reg && reg.toUpperCase()) || 'NO REG';
    var quickName = name || 'No name';
    var quickJobShort = (function(){
      if (!job) return 'Enquiry';
      if (job.indexOf('Timing Belt') !== -1) return 'Timing/Wet Belt';
      if (job.indexOf('Timing Chain') !== -1) return 'Timing Chain';
      if (job.indexOf('Diagnosis') !== -1) return 'Diagnosis';
      return job;
    })();
    var phoneSubject = 'QUOTE: ' + quickName + ' · ' + quickReg + ' · ' + quickJobShort;

    var payload = {
      _subject: phoneSubject,
      _template: 'table',
      _captcha: 'false',
      _autoresponse: customerAutoReply,
      'Name': name,
      'Phone': phone,
      'Registration': quickReg,
      'Job Type': job || 'Not provided',
      'Preferred Date': date || 'Not provided',
      'Email Address': email || 'Not provided',
      'Preferred Contact Method': contact,
      'Year': year || 'Not provided',
      'Make': make || 'Not provided',
      'Model': model || 'Not provided',
      'Engine': engine || 'Not provided',
      'Estimated Repair Pricing': dealerRangeLine,
      'Service Includes': (serviceIncludesFor(job, p) || []).map(function(s){ return s.replace(/&amp;/g, '&'); }).join(' • '),
      'Estimate Type': estimateLine,
      'Estimated Workshop Quote (ex VAT)': netLbl,
      'VAT (20%)': vatLbl,
      'Total (including VAT)': grossLbl,
      'Estimated Repair Time': repairTimeLine,
      'Service Note': (p && p.note) ? p.note : 'None',
      'Customer Message': msg || 'No additional notes.',
      'Website Source': 'Wigan Wetbelts Instant Quote'
    };

    /* Supabase mirror — publishable key + insert-only RLS policy */
    (function pushToSupabase(){
      var SB_URL = 'https://ukwakszeslxkxcyosigp.supabase.co';
      var SB_ANON = 'sb_publishable_QuwBESO6L6SwTK7a2kB6fw_bXDQElMo';
      var quoteAmount = (p && typeof p.from === 'number')
        ? (p.to ? Math.round((p.from + p.to) / 2) : p.from) : null;
      var row = {
        name: name, phone: phone, email: email || null, contact: contact || null,
        reg: (reg||'').toUpperCase(), year: year ? parseInt(year, 10) : null,
        make: make || null, model: model || null, engine: engine || null,
        job: job || null, pref_date: date || null, quote_amount: quoteAmount,
        status: 'new', source: 'website', notes: msg || null
      };
      try {
        fetch(SB_URL + '/rest/v1/quotes', {
          method: 'POST',
          headers: {
            'apikey': SB_ANON,
            'Authorization': 'Bearer ' + SB_ANON,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(row)
        }).catch(function(){});
      } catch(_){}
    })();

    /* localStorage admin mirror */
    try {
      var adminKey = 'wwbAdminData.v1';
      var adminData = { quotes: [], bookings: [] };
      try { adminData = JSON.parse(localStorage.getItem(adminKey) || '{"quotes":[],"bookings":[]}'); } catch(_){}
      if (!adminData.quotes) adminData.quotes = [];
      if (!adminData.bookings) adminData.bookings = [];
      adminData.quotes.unshift({
        id: 'Q-' + Date.now(),
        created: new Date().toISOString(),
        name: name, phone: phone, email: email || '', contact: contact,
        reg: (reg||'').toUpperCase(), year: year || '', make: make || '',
        model: model || '', engine: engine || '', job: job || '',
        prefDate: (date ? new Date(date) : new Date()).toISOString(),
        quote: (p && typeof p.from === 'number') ? (p.to ? Math.round((p.from+p.to)/2) : p.from) : 0,
        status: 'new'
      });
      localStorage.setItem(adminKey, JSON.stringify(adminData));
    } catch(_){}

    try {
      if (typeof fetch === 'function'){
        fetch(FORMSUBMIT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload)
        }).then(function(response){
          if (!response.ok) throw new Error('HTTP ' + response.status);
          return response.text().then(function(text){
            var parsed = null;
            try { parsed = JSON.parse(text); } catch(_){ parsed = { raw: text }; }
            return parsed;
          });
        }).then(function(data){
          _showSuccess();
        }).catch(function(err){
          _showError();
        });
      } else {
        _showError();
      }
    } catch(e){
      _showError();
    }
  });
}

/* ---------------- videos ---------------- */
function _openVideo(card, sourceBtn){
  if (!card) return;
  var link = card.getAttribute('data-link');
  if (link){
    try { window.open(link, '_blank', 'noopener,noreferrer'); }
    catch(e){ window.location.href = link; }
  } else if (sourceBtn){
    sourceBtn.disabled = true;
    sourceBtn.style.opacity = '0.55';
    sourceBtn.style.cursor = 'default';
  }
}
document.querySelectorAll('.vc-play').forEach(function(btn){
  btn.addEventListener('click', function(e){
    e.stopPropagation();
    _openVideo(btn.closest('.video-card'), btn);
  });
});
document.querySelectorAll('.video-card .vc-watch').forEach(function(btn){
  btn.addEventListener('click', function(){ _openVideo(btn.closest('.video-card'), btn); });
});
document.querySelectorAll('.video-card .vc-thumb').forEach(function(thumb){
  thumb.addEventListener('click', function(){ _openVideo(thumb.closest('.video-card')); });
  thumb.addEventListener('keydown', function(e){
    if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); _openVideo(thumb.closest('.video-card')); }
  });
});

/* ---------------- registration lookup ----------------
   Calls a small serverless endpoint (/api/reg-lookup) which queries the
   DVLA Vehicle Enquiry Service and, when configured, the DVSA MOT History
   API (that one supplies the model). The endpoint is configurable via
   window.REG_LOOKUP_ENDPOINT so the API can be hosted on Vercel even if
   the site itself is served elsewhere. */
var REG_ENDPOINT = window.REG_LOOKUP_ENDPOINT || '/api/reg-lookup';
var qRegFind = document.getElementById('qRegFind');
var qRegStatus = document.getElementById('qRegStatus');

var MAKE_MAP = {
  'FORD':'Ford','VAUXHALL':'Vauxhall','VOLKSWAGEN':'Volkswagen','BMW':'BMW',
  'MERCEDES':'Mercedes','MERCEDES-BENZ':'Mercedes','AUDI':'Audi','SKODA':'Skoda',
  'SEAT':'SEAT','CITROEN':'Citroen','PEUGEOT':'Peugeot','RENAULT':'Renault',
  'NISSAN':'Nissan','TOYOTA':'Toyota','HONDA':'Honda','HYUNDAI':'Hyundai',
  'KIA':'Kia','MAZDA':'Mazda','MINI':'MINI','VOLVO':'Volvo','JAGUAR':'Jaguar',
  'LAND ROVER':'Land Rover','FIAT':'Fiat','JEEP':'Jeep','ALFA ROMEO':'Alfa Romeo',
  'DS':'DS','DS AUTOMOBILES':'DS'
};
var DIESEL_HINTS = /TDCI|HDI|BLUEHDI|DCI|CDTI|CDI|TDI|CRDI|D4D|D-4D|MULTIJET|ECOBLUE|SD4|TD4|JTD|MZ-CD|CITD|MZR-CD|SKYACTIV-D|I-DTEC|I-CTDI|TURBO D|DIESEL|TDV6|SDV6|TDV8|SDV8|TURBODIESEL|BITDI|ECOFLEX D/i;

function regStatus(msg, cls){
  if (!qRegStatus) return;
  qRegStatus.textContent = msg;
  qRegStatus.className = cls || '';
}

function normLabel(s){ return String(s).toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function isDieselFuel(f){ return /DIESEL|HEAVY OIL/i.test(f || ''); }
function prettyFuel(f){
  if (!f) return null;
  if (/HEAVY OIL|DIESEL/i.test(f)) return 'Diesel';
  if (/PETROL/i.test(f)) return /HYBRID/i.test(f) ? 'Petrol Hybrid' : 'Petrol';
  return f;
}

/* Smart model match for lookup strings like "TIPO EASY + MULTIJET S-A":
   find dropdown models contained in the lookup string, pick the longest,
   and refuse to guess when longer variants exist (e.g. Transit Custom FWD/RWD). */
function selectModelSmart(dvlaModel){
  if (!qModel || qModel.disabled || !dvlaModel) return false;
  var dvla = normLabel(dvlaModel);
  var opts = Array.prototype.slice.call(qModel.options)
    .map(function(o){ return o.value; }).filter(Boolean);
  var cands = opts.filter(function(o){
    var n = normLabel(o);
    return n.length >= 3 && dvla.indexOf(n) !== -1;
  });
  if (!cands.length) return false;
  cands.sort(function(a, b){ return normLabel(b).length - normLabel(a).length; });
  var best = cands[0], bestN = normLabel(best);
  var longerVariants = opts.filter(function(o){
    var n = normLabel(o);
    return n !== bestN && n.indexOf(bestN) === 0;
  });
  if (longerVariants.length) return 'ambiguous';
  qModel.value = best;
  qModel.dispatchEvent(new Event('change', {bubbles:true}));
  return true;
}

/* ---------------- timing drive verdict ----------------
   Derived from the corrected pricing database plus the verified
   wet-belt engine list (cross-checked against parts catalogues,
   manufacturer service data and published wet belt engine lists). */
var WET_CAM_ENGINES = [
  '1.0 EcoBoost', '1.1 Ti-VCT',
  '1.5 EcoBlue', '2.0 EcoBlue',
  '1.0 PureTech', '1.2 PureTech', '1.2 Turbo PureTech',
  '1.5 BlueHDi', '1.5 Turbo D', '1.5 D4D',
  '1.0 VTEC Turbo'
];

/* Verified special cases (Honest John wet belt guide, Dayco/NTN-SNR
   bulletins, TGPP changeover guides, parts catalogues):
   - Ford 1.0 EcoBoost Hybrid (48V mHEV): revised CHAIN engine + wet oil pump belt
   - Ford 1.5 EcoBoost 3-cyl (2018+ incl. Fiesta ST): chain + wet oil pump belt
   - Ford 1.8 TDCi: dry cam belt + lower belt-in-oil (injection pump)
   - Ford revised the non-hybrid 1.0 EcoBoost to a chain around 2019 —
     year-dependent, so later cars get a "confirmed at inspection" note. */
var ENGINE_OVERRIDES = {
  '1.0 EcoBoost Hybrid': 'chainpump',
  '1.5 EcoBoost ST': 'chainpump',
  '1.8 TDCi': 'drypump'
};

var VERDICT_KINDS = {
  chain: { label:'Timing chain',
    note:'This engine is chain driven. No scheduled belt change, but chains stretch and tensioners wear. Rattles on start up are the warning sign.' },
  chainpump: { label:'Timing chain plus wet oil pump belt',
    note:'Chain driven camshafts, plus a hidden belt in oil driving the oil pump that needs scheduled replacement.' },
  wet: { label:'Wet timing belt (belt in oil)',
    note:'The timing belt runs inside the engine, immersed in oil. As it degrades it sheds rubber that blocks the oil pickup. It is the exact failure we specialise in preventing.' },
  dry: { label:'Dry timing belt',
    note:'A conventional external timing belt with a scheduled replacement interval. Missed intervals on interference engines destroy valves and pistons.' },
  drypump: { label:'Dry timing belt plus belt in oil',
    note:'A conventional cam belt plus a hidden belt in oil (oil or injection pump belt). Both are scheduled service items.' },
  mixed: { label:'Belt or chain, year dependent',
    note:'This model changed timing systems between generations. Select the year of manufacture and we will confirm at inspection.' }
};

function verdictOf(kind, noteSuffix){
  var k = VERDICT_KINDS[kind];
  return { kind: kind, label: k.label, note: k.note + (noteSuffix || '') };
}

function drivesFor(make, model, engine, year){
  var y = year ? parseInt(year, 10) : null;
  var out = { belt:false, pump:false, chain:false };
  for (var i = 0; i < PRICING.length; i++){
    var r = PRICING[i];
    if (r.make && r.make !== make) continue;
    if (r.makes && r.makes.indexOf(make) === -1) continue;
    var el = r.engines || (r.engine ? [r.engine] : null);
    if (!el || el.indexOf(engine) === -1) continue;
    var ml = r.models || (r.model ? [r.model] : null);
    if (!ml || ml.indexOf(model) === -1) continue;
    if (y !== null && (r.yearFrom !== undefined || r.yearTo !== undefined)){
      if (r.yearFrom !== undefined && y < r.yearFrom) continue;
      if (r.yearTo !== undefined && y > r.yearTo) continue;
    }
    if (r.service === 'Belt / Wet Belt Replacement') out.belt = true;
    else if (r.service === 'Wet Oil Pump Belt Replacement') out.pump = true;
    else if (r.service === 'Timing Chain Replacement') out.chain = true;
  }
  return out;
}

function timingVerdict(make, model, engine, year){
  if (!make || !model || !engine) return null;
  var y = year ? parseInt(year, 10) : null;

  /* verified special cases first */
  if (ENGINE_OVERRIDES[engine]) return verdictOf(ENGINE_OVERRIDES[engine]);

  /* Ford revised the non-hybrid 1.0 EcoBoost to a chain around 2019 */
  if (engine === '1.0 EcoBoost'){
    if (y !== null && y <= 2018) return verdictOf('wet');
    if (y !== null && y >= 2020) return verdictOf('chainpump',
      ' Ford revised this engine around 2019. We confirm which type your car has at inspection.');
    return verdictOf('mixed',
      ' Early 1.0 EcoBoosts run a wet belt; from around 2019 Ford switched to a chain with a wet oil pump belt.');
  }

  var d = drivesFor(make, model, engine, year);
  var wetCam = WET_CAM_ENGINES.indexOf(engine) !== -1;
  if (!d.belt && !d.pump && !d.chain) return null;

  if (d.chain && (d.belt || (d.pump && wetCam))) return verdictOf('mixed');
  if (d.chain){
    /* Ford 1.5 EcoBoost 3-cyl (2018+) carries a wet oil pump belt */
    if (engine === '1.5 EcoBoost') return verdictOf('chainpump');
    return verdictOf(d.pump ? 'chainpump' : 'chain');
  }
  if (wetCam){
    var suffix = /PureTech/i.test(engine)
      ? ' Note: 2023-on 48V hybrid PureTechs switched to a chain, confirmed at inspection.'
      : '';
    return verdictOf('wet', suffix);
  }
  return verdictOf(d.pump ? 'drypump' : 'dry');
}

function selectOptionByText(select, wanted){
  if (!select || !wanted) return false;
  var target = normLabel(wanted);
  var opts = Array.prototype.slice.call(select.options).filter(function(o){ return o.value; });
  var exact = opts.filter(function(o){ return normLabel(o.value) === target; });
  var partial = opts.filter(function(o){
    var n = normLabel(o.value);
    return n.indexOf(target) === 0 || target.indexOf(n) === 0;
  });
  var pick = exact.length === 1 ? exact[0] : (exact.length === 0 && partial.length === 1 ? partial[0] : null);
  if (!pick) return false;
  select.value = pick.value;
  select.dispatchEvent(new Event('change', {bubbles:true}));
  return true;
}

function narrowEngine(cc, fuel){
  if (!qEngine || qEngine.disabled) return false;
  var litres = cc ? (Math.round(cc / 100) / 10).toFixed(1) : null;
  var wantDiesel = isDieselFuel(fuel);
  var haveFuel = !!fuel;
  var opts = Array.prototype.slice.call(qEngine.options).filter(function(o){ return o.value; });
  var candidates = opts.filter(function(o){
    var label = o.value;
    if (litres && label.indexOf(litres) !== 0) return false;
    if (haveFuel && DIESEL_HINTS.test(label) !== wantDiesel) return false;
    return true;
  });
  if (candidates.length === 1){
    qEngine.value = candidates[0].value;
    qEngine.dispatchEvent(new Event('change', {bubbles:true}));
    return true;
  }
  return false;
}

if (qRegFind){
  qRegFind.addEventListener('click', function(){
    var reg = (qReg && qReg.value.trim().toUpperCase().replace(/\s+/g, '')) || '';
    if (!/^[A-Z0-9]{2,8}$/.test(reg)){
      regStatus('Please enter a valid registration first.', 'err');
      if (qReg) qReg.focus();
      return;
    }
    if (!qJob || !qJob.value){
      regStatus('Select the job type first, then press Find my vehicle.', 'warn');
      qJob && qJob.focus();
      return;
    }
    regStatus('Looking up ' + reg + '…', '');
    qRegFind.disabled = true;

    var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function(){ ctrl.abort(); }, 10000) : null;

    fetch(REG_ENDPOINT + '?reg=' + encodeURIComponent(reg), { signal: ctrl ? ctrl.signal : undefined })
      .then(function(r){ return r.json().then(function(j){ return { ok: r.ok, body: j }; }); })
      .then(function(res){
        if (timer) clearTimeout(timer);
        qRegFind.disabled = false;
        var v = res.body || {};
        if (!res.ok || !v.ok){
          if (v.reason === 'not_found'){
            regStatus('We couldn’t find that registration. Please check it, or select your vehicle manually.', 'err');
          } else if (v.reason === 'not_configured'){
            regStatus('Registration lookup isn’t switched on yet. Please select your vehicle manually.', 'warn');
          } else {
            regStatus('Lookup didn’t work just now. Please select your vehicle manually.', 'warn');
          }
          return;
        }
        /* normalise both response shapes:
           our own /api/reg-lookup: {make, model, year, fuelType, engineCapacityCc}
           voodoofiles /api/reg-lookup: {make, model, year, fuel, engineCc} */
        var vMake = v.make || null;
        var vModel = v.model || null;
        var vYear = v.year || null;
        var vFuel = v.fuelType || v.fuel || null;
        var vCc = v.engineCapacityCc || v.engineCc || null;

        /* fill what we can: year, make, model, engine */
        if (vYear && qYear){
          var ys = String(vYear);
          var validYears = Array.prototype.map.call(qYear.options, function(o){ return o.value; });
          if (validYears.indexOf(ys) !== -1){
            qYear.value = ys;
            qYear.dispatchEvent(new Event('change', {bubbles:true}));
          }
        }
        var ourMake = MAKE_MAP[(vMake || '').toUpperCase()] || null;
        var makeSet = ourMake ? selectOptionByText(qMake, ourMake) : false;
        var modelSet = makeSet && vModel ? selectModelSmart(vModel) : false;
        var engineSet = (modelSet === true) ? narrowEngine(vCc, vFuel) : false;

        var summary = [vMake, vModel, vYear, prettyFuel(vFuel), vCc ? vCc + 'cc' : null]
          .filter(Boolean).join(' · ');
        var verdict = (engineSet && qMake && qModel && qEngine)
          ? timingVerdict(qMake.value, qModel.value, qEngine.value, qYear ? qYear.value : '')
          : null;
        var verdictTxt = verdict ? (' This engine runs a ' + verdict.label.toLowerCase() + '.') : '';
        if (!makeSet){
          regStatus('Found: ' + summary + '. We couldn’t match it to our list automatically, please select your vehicle below.', 'warn');
        } else if (modelSet === 'ambiguous'){
          regStatus('Found: ' + summary + '. Make and year filled in. This model has more than one variant, please pick it below.', 'ok');
        } else if (!modelSet){
          regStatus('Found: ' + summary + '. Make and year filled in, please choose the model and engine.', 'ok');
        } else if (!engineSet){
          regStatus('Found: ' + summary + '. Please confirm the engine below.', 'ok');
        } else {
          regStatus('Found: ' + summary + '. Details filled in below.' + verdictTxt, 'ok');
        }
        saveBackup();
      })
      .catch(function(){
        if (timer) clearTimeout(timer);
        qRegFind.disabled = false;
        regStatus('Registration lookup isn’t available here. Please select your vehicle manually.', 'warn');
      });
  });
}

/* ---------------- date picker: min = today + 14 days ---------------- */
if (qDate){
  var _earliest = new Date();
  _earliest.setDate(_earliest.getDate() + 14);
  var _yyyy = _earliest.getFullYear();
  var _mm = String(_earliest.getMonth()+1).padStart(2,'0');
  var _dd = String(_earliest.getDate()).padStart(2,'0');
  var _minISO = _yyyy + '-' + _mm + '-' + _dd;
  qDate.min = _minISO;
  function _enforceMin(){ if (qDate.value && qDate.value < _minISO) qDate.value = ''; }
  _enforceMin();
  function _syncDateAttr(){
    if (qDate.value) qDate.setAttribute('data-has-value','true');
    else qDate.removeAttribute('data-has-value');
  }
  qDate.addEventListener('change', function(){ _enforceMin(); _syncDateAttr(); });
  qDate.addEventListener('input', function(){ _enforceMin(); _syncDateAttr(); });
  qDate.addEventListener('focus', function(){ try { if (qDate.showPicker) qDate.showPicker(); } catch(_){} });
  qDate.addEventListener('click', function(){ try { if (qDate.showPicker) qDate.showPicker(); } catch(_){} });
  _syncDateAttr();
}

/* ---------------- localStorage backup ---------------- */
var STORAGE_KEY = 'wiganwetbelts.quote.v1';
function saveBackup(){
  try {
    var data = {
      reg: qReg ? qReg.value : '',
      year: qYear ? qYear.value : '',
      make: qMake ? qMake.value : '',
      model: qModel ? qModel.value : '',
      engine: qEngine ? qEngine.value : '',
      job: qJob ? qJob.value : '',
      date: qDate ? qDate.value : '',
      name: qName ? qName.value : '',
      phone: qPhone ? qPhone.value : '',
      email: qEmail ? qEmail.value : '',
      msg: qMsg ? qMsg.value : '',
      contact: qContact ? qContact.value : 'Phone Call',
      ts: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch(e){}
}
function restoreBackup(){
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    var data = JSON.parse(raw);
    if (qReg && data.reg) qReg.value = data.reg;
    if (qYear && data.year) qYear.value = data.year;
    if (qName && data.name) qName.value = data.name;
    if (qPhone && data.phone) qPhone.value = data.phone;
    if (qEmail && data.email) qEmail.value = data.email;
    if (qMsg && data.msg) qMsg.value = data.msg;
    if (qContact && data.contact) setContactMethod(data.contact, false);
    if (qDate && data.date){
      qDate.value = data.date;
      try { qDate.dispatchEvent(new Event('change', {bubbles:true})); } catch(_){}
    }
    if (qJob && data.job){
      qJob.value = data.job;
      qJob.dispatchEvent(new Event('change', {bubbles:true}));
    }
    if (qMake && data.make){
      var validMakes = Array.prototype.map.call(qMake.options, function(o){ return o.value; });
      if (validMakes.indexOf(data.make) !== -1){
        qMake.value = data.make;
        qMake.dispatchEvent(new Event('change', {bubbles:true}));
        if (qModel && data.model){
          var validModels = Array.prototype.map.call(qModel.options, function(o){ return o.value; });
          if (validModels.indexOf(data.model) !== -1){
            qModel.value = data.model;
            qModel.dispatchEvent(new Event('change', {bubbles:true}));
            if (qEngine && data.engine){
              var validEngines = Array.prototype.map.call(qEngine.options, function(o){ return o.value; });
              if (validEngines.indexOf(data.engine) !== -1){
                qEngine.value = data.engine;
                qEngine.dispatchEvent(new Event('change', {bubbles:true}));
              }
            }
          }
        }
      }
    }
    if (qDate && qDate.value) qDate.setAttribute('data-has-value','true');
  } catch(e){}
}
[qReg, qYear, qMake, qModel, qEngine, qJob, qDate, qName, qPhone, qEmail, qMsg, qContact].forEach(function(el){
  if (!el) return;
  el.addEventListener('input', saveBackup);
  el.addEventListener('change', saveBackup);
});
restoreBackup();

})();
