/* ============================================================
   WET BELT RUN — game engine
   Standalone module. Exposes window.WBR with open()/close() so
   the quote success handler can trigger it. Touch drag + arrow
   keys. Canvas auto-resizes with devicePixelRatio. Best score
   stored in localStorage under 'wbr.best.v1'.
   Recoloured for the 2026 ice rebrand.
   ============================================================ */
(function(){
var modal = document.getElementById('wbrModal');
var canvas = document.getElementById('wbrCanvas');
if (!modal || !canvas) return;
var ctx = canvas.getContext('2d');

var elScore = document.getElementById('wbrScore');
var elBest = document.getElementById('wbrBest');
var elOver = document.getElementById('wbrOver');
var elFinalScore = document.getElementById('wbrFinalScore');
var elBestScore = document.getElementById('wbrBestScore');
var btnAgain = document.getElementById('wbrAgain');

var BEST_KEY = 'wbr.best.v1';
var W = 0, H = 0;
var running = false, alive = false, rafId = 0, lastTime = 0;
var roadOffset = 0, speed = 0, score = 0, bestScore = 0;
var spawnTimer = 0, spawnEvery = 0;
var obstacles = [];
var player = null;
var keys = { left:false, right:false };
var touch = { active:false, lastX:0 };

var ACCENT = '158,208,255';     /* ice */
var ACCENT2 = '230,243,255';   /* light ice */

function loadBest(){
  try { bestScore = parseInt(localStorage.getItem(BEST_KEY), 10) || 0; }
  catch(e){ bestScore = 0; }
  if (elBest) elBest.textContent = bestScore;
}
function saveBest(){
  try { localStorage.setItem(BEST_KEY, String(bestScore)); } catch(e){}
}

function resize(){
  var rect = canvas.getBoundingClientRect();
  var dpr = Math.max(1, window.devicePixelRatio || 1);
  W = Math.max(240, Math.round(rect.width));
  H = Math.max(360, Math.round(rect.height));
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function newGame(){
  resize();
  var pw = Math.max(34, Math.min(64, W * 0.13));
  player = {
    w: pw, h: pw * 1.7,
    x: W * 0.5 - pw * 0.5, tx: W * 0.5 - pw * 0.5,
    y: H - pw * 1.7 - Math.max(20, H * 0.06)
  };
  obstacles = [];
  roadOffset = 0;
  speed = Math.max(3.4, H * 0.0055);
  score = 0;
  spawnTimer = 0;
  spawnEvery = 78;
  alive = true;
  if (elOver) elOver.hidden = true;
  if (elScore) elScore.textContent = 0;
}

function spawnObstacle(){
  var TYPES = [
    { t:'car', w:0.13, h:0.22, c:'#2c3038' },
    { t:'oil', w:0.18, h:0.10, c:'#0c0e10' },
    { t:'debris', w:0.12, h:0.06, c:'#48413a' },
    { t:'triangle', w:0.10, h:0.10, c:'#f5a524' },
    { t:'tool', w:0.09, h:0.18, c:'#7a808a' },
    { t:'cone', w:0.07, h:0.10, c:'#f97316' }
  ];
  var pick = TYPES[(Math.random() * TYPES.length) | 0];
  var ow = Math.max(28, W * pick.w);
  var oh = Math.max(22, H * pick.h);
  var lanePad = Math.max(12, W * 0.05);
  var ox = lanePad + Math.random() * (W - ow - 2 * lanePad);
  obstacles.push({ type:pick.t, x:ox, y:-oh - 10, w:ow, h:oh, colour:pick.c });
}

function updatePlayer(dt){
  var step = Math.max(4, W * 0.012) * dt * 60;
  if (keys.left) player.tx -= step;
  if (keys.right) player.tx += step;
  var pad = Math.max(8, W * 0.03);
  if (player.tx < pad) player.tx = pad;
  if (player.tx + player.w > W - pad) player.tx = W - pad - player.w;
  player.x += (player.tx - player.x) * 0.22;
}
function updateObstacles(dt){
  for (var i = 0; i < obstacles.length; i++) obstacles[i].y += speed * dt * 60;
  obstacles = obstacles.filter(function(o){ return o.y < H + 40; });
}
function checkCollision(){
  var p = player;
  var pl = p.x + p.w * 0.12, pr = p.x + p.w * 0.88;
  var pt = p.y + p.h * 0.10, pb = p.y + p.h * 0.95;
  for (var i = 0; i < obstacles.length; i++){
    var o = obstacles[i];
    if (pr < o.x || pl > o.x + o.w) continue;
    if (pb < o.y || pt > o.y + o.h) continue;
    return true;
  }
  return false;
}

function update(dt){
  if (!alive) return;
  roadOffset = (roadOffset + speed * dt * 60) % 80;
  updatePlayer(dt);
  updateObstacles(dt);
  spawnTimer += dt * 60;
  if (spawnTimer >= spawnEvery){
    spawnTimer = 0;
    spawnObstacle();
    if (spawnEvery > 28) spawnEvery -= 0.35;
  }
  speed += 0.0025 * dt * 60;
  score += Math.max(1, Math.round(speed * 0.6));
  if (elScore) elScore.textContent = score;
  if (checkCollision()) endGame();
}

function drawRoad(){
  ctx.fillStyle = '#07090c';
  ctx.fillRect(0, 0, W, H);
  var roadPad = Math.max(8, W * 0.04);
  ctx.fillStyle = '#15181c';
  ctx.fillRect(roadPad, 0, W - 2 * roadPad, H);
  var grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, 'rgba(' + ACCENT + ',.10)');
  grad.addColorStop(0.5, 'rgba(' + ACCENT + ',0)');
  grad.addColorStop(1, 'rgba(' + ACCENT + ',.10)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,.30)';
  ctx.lineWidth = Math.max(2, W * 0.005);
  ctx.setLineDash([24, 28]);
  ctx.lineDashOffset = -roadOffset;
  for (var i = 1; i < 3; i++){
    var lx = roadPad + (W - 2 * roadPad) * (i / 3);
    ctx.beginPath();
    ctx.moveTo(lx, -20);
    ctx.lineTo(lx, H + 20);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
  ctx.fillStyle = 'rgba(' + ACCENT + ',.35)';
  ctx.fillRect(roadPad - 2, 0, 2, H);
  ctx.fillRect(W - roadPad, 0, 2, H);
}
function drawPlayer(){
  var p = player;
  ctx.save();
  ctx.shadowColor = 'rgba(' + ACCENT + ',.55)';
  ctx.shadowBlur = 18;
  roundedRect(p.x, p.y, p.w, p.h, Math.min(8, p.w * 0.18));
  var g = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
  g.addColorStop(0, '#1c2127');
  g.addColorStop(0.55, '#0f1216');
  g.addColorStop(1, '#06080a');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(' + ACCENT2 + ',.18)';
  ctx.fillRect(p.x + p.w * 0.18, p.y + p.h * 0.16, p.w * 0.64, p.h * 0.30);
  ctx.fillStyle = 'rgba(255,255,255,.05)';
  ctx.fillRect(p.x + p.w * 0.18, p.y + p.h * 0.52, p.w * 0.64, p.h * 0.22);
  ctx.fillStyle = 'rgba(' + ACCENT2 + ',.85)';
  ctx.fillRect(p.x + p.w * 0.16, p.y + p.h * 0.05, p.w * 0.18, p.h * 0.04);
  ctx.fillRect(p.x + p.w * 0.66, p.y + p.h * 0.05, p.w * 0.18, p.h * 0.04);
  ctx.fillStyle = 'rgba(239, 68, 68, .80)';
  ctx.fillRect(p.x + p.w * 0.16, p.y + p.h * 0.92, p.w * 0.18, p.h * 0.04);
  ctx.fillRect(p.x + p.w * 0.66, p.y + p.h * 0.92, p.w * 0.18, p.h * 0.04);
}
function roundedRect(x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
function drawObstacles(){
  for (var i = 0; i < obstacles.length; i++){
    var o = obstacles[i];
    ctx.save();
    switch (o.type){
      case 'car':
        ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 10;
        roundedRect(o.x, o.y, o.w, o.h, 6);
        var gc = ctx.createLinearGradient(o.x, o.y, o.x, o.y + o.h);
        gc.addColorStop(0, '#2c3038'); gc.addColorStop(1, '#15181c');
        ctx.fillStyle = gc; ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.10)';
        ctx.fillRect(o.x + o.w * 0.18, o.y + o.h * 0.30, o.w * 0.64, o.h * 0.18);
        ctx.fillStyle = 'rgba(239,68,68,.7)';
        ctx.fillRect(o.x + o.w * 0.10, o.y + o.h * 0.06, o.w * 0.22, o.h * 0.04);
        ctx.fillRect(o.x + o.w * 0.68, o.y + o.h * 0.06, o.w * 0.22, o.h * 0.04);
        break;
      case 'oil':
        var og = ctx.createRadialGradient(o.x + o.w/2, o.y + o.h/2, 2, o.x + o.w/2, o.y + o.h/2, o.w/1.4);
        og.addColorStop(0, 'rgba(' + ACCENT + ',.35)');
        og.addColorStop(0.4, 'rgba(0,0,0,.95)');
        og.addColorStop(1, 'rgba(0,0,0,.0)');
        ctx.fillStyle = og;
        ctx.beginPath();
        ctx.ellipse(o.x + o.w/2, o.y + o.h/2, o.w/2, o.h/2, 0, 0, Math.PI*2);
        ctx.fill();
        break;
      case 'debris':
        ctx.fillStyle = '#3a342d';
        for (var k = 0; k < 4; k++){
          var dx = o.x + Math.random() * o.w * 0.7;
          var dy = o.y + Math.random() * o.h * 0.6;
          ctx.fillRect(dx, dy, o.w * 0.2, 3);
        }
        ctx.fillStyle = 'rgba(' + ACCENT2 + ',.25)';
        ctx.fillRect(o.x, o.y + o.h*0.3, o.w, 2);
        break;
      case 'triangle':
        ctx.fillStyle = o.colour;
        ctx.beginPath();
        ctx.moveTo(o.x + o.w/2, o.y);
        ctx.lineTo(o.x + o.w, o.y + o.h);
        ctx.lineTo(o.x, o.y + o.h);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.fillRect(o.x + o.w*0.42, o.y + o.h*0.3, o.w*0.16, o.h*0.4);
        ctx.fillRect(o.x + o.w*0.42, o.y + o.h*0.78, o.w*0.16, o.h*0.10);
        break;
      case 'tool':
        ctx.fillStyle = '#7a808a';
        roundedRect(o.x + o.w*0.30, o.y, o.w*0.4, o.h*0.85, 3);
        ctx.fill();
        ctx.fillStyle = '#15181c';
        ctx.fillRect(o.x + o.w*0.30, o.y + o.h*0.78, o.w*0.4, o.h*0.18);
        ctx.fillStyle = 'rgba(255,255,255,.18)';
        ctx.fillRect(o.x + o.w*0.32, o.y + o.h*0.10, o.w*0.36, 2);
        break;
      case 'cone':
        ctx.fillStyle = o.colour;
        ctx.beginPath();
        ctx.moveTo(o.x + o.w/2, o.y);
        ctx.lineTo(o.x + o.w, o.y + o.h*0.85);
        ctx.lineTo(o.x, o.y + o.h*0.85);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.7)';
        ctx.fillRect(o.x + o.w*0.18, o.y + o.h*0.35, o.w*0.64, 3);
        ctx.fillStyle = '#15181c';
        ctx.fillRect(o.x - o.w*0.05, o.y + o.h*0.85, o.w*1.1, o.h*0.13);
        break;
    }
    ctx.restore();
  }
}
function render(){
  drawRoad();
  drawObstacles();
  drawPlayer();
}

function tick(now){
  if (!running) return;
  if (!lastTime) lastTime = now;
  var dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  render();
  rafId = requestAnimationFrame(tick);
}

function endGame(){
  alive = false;
  if (score > bestScore){ bestScore = score; saveBest(); }
  if (elBest) elBest.textContent = bestScore;
  if (elFinalScore) elFinalScore.textContent = score;
  if (elBestScore) elBestScore.textContent = bestScore;
  if (elOver) elOver.hidden = false;
}

function onKeyDown(e){
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
  if (e.key === 'Escape') close();
}
function onKeyUp(e){
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
}
function onTouchStart(e){
  if (!e.touches || !e.touches.length) return;
  touch.active = true;
  touch.lastX = e.touches[0].clientX;
}
function onTouchMove(e){
  if (!touch.active || !e.touches || !e.touches.length) return;
  e.preventDefault();
  var x = e.touches[0].clientX;
  var dx = x - touch.lastX;
  touch.lastX = x;
  if (player) player.tx += dx;
}
function onTouchEnd(){ touch.active = false; }
function onPointerDown(e){
  if (e.pointerType === 'mouse') return;
  touch.active = true; touch.lastX = e.clientX;
}
function onPointerMove(e){
  if (!touch.active || e.pointerType === 'mouse') return;
  var x = e.clientX; var dx = x - touch.lastX; touch.lastX = x;
  if (player) player.tx += dx;
}
function onPointerUp(){ touch.active = false; }
function onResize(){ resize(); }

function bindInputs(){
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('touchstart', onTouchStart, {passive:true});
  canvas.addEventListener('touchmove', onTouchMove, {passive:false});
  canvas.addEventListener('touchend', onTouchEnd);
  canvas.addEventListener('touchcancel', onTouchEnd);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  window.addEventListener('resize', onResize);
}
function unbindInputs(){
  document.removeEventListener('keydown', onKeyDown);
  document.removeEventListener('keyup', onKeyUp);
  canvas.removeEventListener('touchstart', onTouchStart);
  canvas.removeEventListener('touchmove', onTouchMove);
  canvas.removeEventListener('touchend', onTouchEnd);
  canvas.removeEventListener('touchcancel', onTouchEnd);
  canvas.removeEventListener('pointerdown', onPointerDown);
  canvas.removeEventListener('pointermove', onPointerMove);
  canvas.removeEventListener('pointerup', onPointerUp);
  canvas.removeEventListener('pointercancel', onPointerUp);
  window.removeEventListener('resize', onResize);
}

function open(){
  loadBest();
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('wbr-locked');
  requestAnimationFrame(function(){
    newGame();
    bindInputs();
    running = true;
    lastTime = 0;
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
    try { canvas.focus({preventScroll:true}); } catch(e){}
  });
}
function close(){
  running = false;
  cancelAnimationFrame(rafId);
  rafId = 0;
  unbindInputs();
  if (elOver) elOver.hidden = true;
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('wbr-locked');
}
function restart(){
  newGame();
  running = true;
  lastTime = 0;
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(tick);
}

if (btnAgain) btnAgain.addEventListener('click', restart);
modal.addEventListener('click', function(e){
  var t = e.target;
  while (t && t !== modal){
    if (t.hasAttribute && t.hasAttribute('data-close')){ close(); return; }
    t = t.parentNode;
  }
  if (t === modal) return;
});
modal.querySelectorAll('[data-close]').forEach(function(el){
  el.addEventListener('click', close);
});

window.WBR = { open: open, close: close };
loadBest();
})();
