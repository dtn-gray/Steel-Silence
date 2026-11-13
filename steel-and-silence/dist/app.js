import { Duel, STEP, CONTROLS, MAX_HEALTH, inputKey, clamp, damp, MOVES } from './engine.js?v=10';
import { Renderer } from './render.js?v=10';
import { Sound } from './audio.js?v=10';

export function createGame({backend=null}={}) {
const $ = id => document.getElementById(id);
const canvas = $('game'), duel = new Duel(), sound = new Sound();
let mode='duel',lastFrame=0,accumulator=0,hudClock=0,lastScore='',renderAccumulator=0,lastDrawTime=0;
let preferences = {}, resumeAfterHelp = false;
const keyboardKeys = new Set(), touchPointers = new Map();
const healthGhost = [MAX_HEALTH, MAX_HEALTH];
try { preferences = JSON.parse(localStorage.getItem('steel-silence-prefs') || '{}'); } catch {}
const renderer=new Renderer(canvas,duel,{backend,quality:preferences.graphics||'auto'});
$('graphics').value=renderer.quality.mode;
$('difficulty').value = String(clamp(Number(preferences.level ?? 1) || 0, 0, 2));
duel.level = +$('difficulty').value;
$('reduced').checked = preferences.calm ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches;
renderer.reduced = $('reduced').checked;
sound.enabled = Boolean(preferences.sound);

function savePreferences() {
 try { localStorage.setItem('steel-silence-prefs', JSON.stringify({ level: +$('difficulty').value, calm:$('reduced').checked,sound:sound.enabled,graphics:$('graphics').value })); } catch {}
}
function focusGame() { canvas.focus({ preventScroll: true }); }
function announce(text) { $('announcer').textContent = text; }
function updateSoundButton() {
 const enabled = sound.enabled;
 $('sound').setAttribute('aria-label', enabled ? 'Mute sound' : 'Enable sound');
 $('sound').setAttribute('aria-pressed', String(enabled));
 $('sound').title = enabled ? 'Sound on' : 'Sound off';
 $('sound').innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="m11 4-6 5H2v6h3l6 5z' + (enabled ? 'M15 8q5 4 0 8m3-11q8 7 0 14' : 'M16 9l6 6m0-6-6 6') + '"/></svg>';
}
$('sound').onclick = () => { sound.setEnabled(!sound.enabled); updateSoundButton(); savePreferences(); };
$('reduced').onchange = () => { renderer.reduced = $('reduced').checked; savePreferences(); };
$('graphics').onchange=()=>{renderer.setGraphics($('graphics').value);savePreferences();focusGame();};
$('difficulty').onchange = () => { duel.level = +$('difficulty').value; savePreferences(); focusGame(); };

const modeName = () => mode === 'local' ? '2 Players' : mode === 'practice' ? 'Practice' : 'vs CPU';
function showOverlay(title, button, score = false) {
 $('start').disabled=!renderer.supported;
 if(!renderer.supported){title='3D unavailable';button='WebGL required';$('start').disabled=true;}
 $('overlay-mode').textContent = renderer.supported?modeName():renderer.error;
 $('title').textContent = title;
 $('start').innerHTML = button + ' <span>→</span>';
 $('result-score').hidden = !score;
 $('result-score').textContent = duel.scores.join(' — ');
 $('overlay').classList.remove('hidden');
 announce(title);
}
function hideOverlay() { $('overlay').classList.add('hidden'); }
function start() {
 if(!renderer.supported)return;
 sound.unlock();
 if (duel.phase === 'paused') duel.resume();
 else if (duel.phase === 'round') duel.nextRound();
 else duel.start({ mode, level: +$('difficulty').value });
 hideOverlay(); focusGame(); updateHud();
}
$('start').onclick = start;
function togglePause() {
 if (duel.phase === 'paused') { duel.resume(); hideOverlay(); focusGame(); }
 else if (duel.pause()) { clearInput(); showOverlay('Paused', 'Resume'); }
 updateHud();
}
$('pause').onclick = togglePause;
function clearInput() {
 keyboardKeys.clear();
 touchPointers.clear();
 for (const key of Object.keys(duel.keys)) duel.input(key, false);
 document.querySelectorAll('[data-key]').forEach(b => b.classList.remove('held'));
}
$('restart').onclick = () => {
 clearInput(); duel.start({ mode, level: +$('difficulty').value });
 hideOverlay(); sound.unlock(); focusGame(); updateHud();
};

function keyLabel(key) {
 return ({ ' ': 'Space', arrowleft: '←', arrowright: '→', arrowup: '↑', arrowdown: '↓', shiftright: 'R Shift' })[key] || key.toUpperCase();
}
function keycap(key) { return `<kbd class="${keyLabel(key).length > 2 ? 'wide-key' : ''}">${keyLabel(key)}</kbd>`; }
function controlsMarkup(i) {
 const k = CONTROLS[i];
 return `<span class="player-label">P${i + 1}</span>` + [
  [`<span class="key-pair">${keycap(k.left)}${keycap(k.right)}</span>`, 'Move'],
  [`<span class="key-pair">${keycap(k.sideUp)}${keycap(k.sideDown)}</span>`, 'Sidestep'],
  [`<span class="key-pair">${keycap(k.high)}${keycap(k.low)}</span>`, 'Guard'],
  [keycap(k.attack), 'Attack'], [keycap(k.dash), 'Dash']
 ].map(([keys, label]) => `<span class="control-group">${keys}<span>${label}</span></span>`).join('');
}
function updateMode() {
 document.querySelectorAll('[data-mode]').forEach(b => {
  b.classList.toggle('selected', b.dataset.mode === mode);
  b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
 });
 $('difficulty-label').hidden = mode !== 'duel';
 $('help-controls').innerHTML = `<div class="control-row">${controlsMarkup(0)}</div>` + (mode === 'local' ? `<div class="control-row">${controlsMarkup(1)}</div>` : '');
 $('touch-controls').hidden = mode === 'local';
 $('enemy-name').textContent = mode === 'local' ? 'Player 2' : mode === 'practice' ? 'Practice' : 'CPU';
 $('enemy-health').setAttribute('aria-label', $('enemy-name').textContent + ' health');
 $('enemy-stamina').setAttribute('aria-label', $('enemy-name').textContent + ' stamina');
 lastScore = '';
}
function changeMode(next) {
 if (next === mode) return;
 const wasReady = duel.phase === 'ready';
 clearInput(); mode = next; duel.mode = mode; updateMode();
 if (wasReady) showOverlay('Ready?', 'Play');
 else { duel.start({ mode, level: +$('difficulty').value }); hideOverlay(); sound.unlock(); focusGame(); }
 updateHud();
}
document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => changeMode(b.dataset.mode));

$('guide').onclick = () => {
 resumeAfterHelp = duel.pause(); clearInput(); $('help').showModal(); updateHud();
};
function closeHelp() {
 $('help').close();
 if (resumeAfterHelp) { duel.resume(); resumeAfterHelp = false; }
 focusGame(); updateHud();
}
$('close').onclick = closeHelp; $('close-bottom').onclick = closeHelp;
$('help').addEventListener('cancel', ev => { ev.preventDefault(); closeHelp(); });
$('help').addEventListener('click', ev => { if (ev.target === $('help')) closeHelp(); });

const activeKeys = new Set(CONTROLS.flatMap(k => Object.values(k)));
function touchHolds(key) {
 return [...touchPointers.values()].some(button => button.dataset.key === key);
}
window.addEventListener('keydown', ev => {
 const key = inputKey(ev.code || ev.key);
 if ($('help').open || ['SELECT', 'INPUT', 'TEXTAREA'].includes(ev.target.tagName)) return;
 if (key === 'escape') { ev.preventDefault(); if (!ev.repeat) togglePause(); return; }
 if (['BUTTON', 'A'].includes(ev.target.tagName) && [' ', 'enter'].includes(key)) return;
 if (key === 'enter' && ['ready', 'paused', 'round', 'match'].includes(duel.phase)) { ev.preventDefault(); if (!ev.repeat) start(); return; }
 if (activeKeys.has(key)) {
  ev.preventDefault();
  if (ev.repeat || !acceptsInput()) return;
  keyboardKeys.add(key);
  sound.unlock();
  duel.input(key, true);
 }
});
window.addEventListener('keyup', ev => {
 const key = inputKey(ev.code || ev.key);
 if (keyboardKeys.delete(key) && !touchHolds(key)) duel.input(key, false);
});
function acceptsInput() {
 return ['transition', 'countdown', 'fight'].includes(duel.phase);
}
function pauseForFocus() {
 clearInput();
 if (duel.pause()) showOverlay('Paused', 'Resume');
 lastFrame=0;accumulator=0;renderAccumulator=0;lastDrawTime=0;updateHud();
}
window.addEventListener('blur', pauseForFocus);
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseForFocus(); });
document.querySelectorAll('[data-key]').forEach(b => {
 b.addEventListener('pointerdown', ev => {
  if (ev.button !== 0 || mode === 'local' || !acceptsInput()) return;
  ev.preventDefault(); sound.unlock(); b.setPointerCapture(ev.pointerId);
  touchPointers.set(ev.pointerId, b);
  b.classList.add('held'); duel.input(b.dataset.key, true);
 });
 const release = ev => {
  if (touchPointers.get(ev.pointerId) !== b) return;
  touchPointers.delete(ev.pointerId);
  const stillHeld = touchHolds(b.dataset.key);
  if (!stillHeld) b.classList.remove('held');
  if (!stillHeld && !keyboardKeys.has(b.dataset.key)) duel.input(b.dataset.key, false);
 };
 b.addEventListener('pointerup', release); b.addEventListener('pointercancel', release); b.addEventListener('lostpointercapture', release);
});

$('fullscreen').onclick = async () => {
 try {
  if (document.fullscreenElement) await document.exitFullscreen();
  else await $('shell').requestFullscreen();
  focusGame();
 } catch { announce('Fullscreen unavailable'); }
};
if (!document.fullscreenEnabled) $('fullscreen').hidden = true;
document.addEventListener('fullscreenchange', () => {
 const on = Boolean(document.fullscreenElement);
 $('fullscreen').setAttribute('aria-label', on ? 'Exit fullscreen' : 'Enter fullscreen');
 renderer.resize();
});
new ResizeObserver(() => renderer.resize()).observe(canvas);

function fighterState(f) {
 if (f.dead) return 'Defeated';
 if (f.hurt > 0) return 'Hit';
 if (f.stun > 0) return 'Stunned';
 if (f.evade > 0) return 'Dash';
 if (f.attack) return f.attack.t < MOVES[f.attack.type].wind ? 'Wind-up' : f.attack.type === 'high' ? 'High cut' : 'Low cut';
 if (f.recovery > 0) return 'Recovery';
 return f.guard === 'high' ? 'High guard' : 'Low guard';
}
const hudValues=new Map(),guardButtons=document.querySelectorAll('[data-guard]');
function text(id,value){const key=id+':text';if(hudValues.get(key)!==value){$(id).textContent=value;hudValues.set(key,value);}}
function style(id,name,value){const key=id+':style:'+name;if(hudValues.get(key)!==value){$(id).style[name]=value;hudValues.set(key,value);}}
function attr(id,name,value){const key=id+':attr:'+name;if(hudValues.get(key)!==value){$(id).setAttribute(name,value);hudValues.set(key,value);}}
function updateHud() {
 for (const [i, prefix] of ['player', 'enemy'].entries()) {
  const f = duel.fighters[i];
  text(prefix+'-hp',f.health);
  style(prefix+'-health-fill','transform',`scaleX(${(f.health/MAX_HEALTH).toFixed(3)})`);
  style(prefix+'-health-loss','transform',`scaleX(${(healthGhost[i]/MAX_HEALTH).toFixed(3)})`);
  attr(prefix+'-health','aria-valuenow',String(f.health));
  style(prefix+'-energy','transform',`scaleX(${(f.stamina/100).toFixed(3)})`);
  style(prefix+'-energy','background',f.stamina<24?'#c18c69':'#d2bd84');
  attr(prefix+'-stamina','aria-valuenow',String(Math.round(f.stamina)));
  text(prefix+'-state',fighterState(f));
 }
 guardButtons.forEach(b=>{const value=String(b.dataset.guard===duel.fighters[0].guard);if(b._pressed!==value){b.setAttribute('aria-pressed',value);b._pressed=value;}});
 const scoreKey = duel.scores.join(',') + ':' + duel.round + ':' + mode;
 if (scoreKey !== lastScore) {
  lastScore = scoreKey;
  for (const [prefix, i] of [['player', 0], ['enemy', 1]]) {
   $(prefix + '-score').innerHTML = Array.from({ length: 3 }, (_, n) => `<i class="${n < duel.scores[i] ? 'won' : ''}"></i>`).join('');
   $(prefix + '-score').setAttribute('aria-label', `Player ${i + 1} rounds won: ${duel.scores[i]}`);
  }
  $('round-number').textContent = mode === 'practice' ? 'Practice' : `Round ${duel.round}`;
  $('match-to').textContent = mode === 'practice' ? '' : 'First to 3';
 }
 text('status',({ ready: 'Ready', transition: '', countdown: '', fight: '', paused: 'Paused', finish: 'Round over', round: 'Round over', match: 'Match over' })[duel.phase]||'');
 text('pause',duel.phase==='paused'?'▶':'Ⅱ');
 attr('pause','aria-label',duel.phase==='paused'?'Resume':'Pause');
 const disabled=['ready','round','match'].includes(duel.phase);if($('pause').disabled!==disabled)$('pause').disabled=disabled;
}
function events() {
 for (const e of duel.consumeEvents()) {
  if (e.type === 'roundStart' || e.type === 'result') clearInput();
  sound.event(e); renderer.impact(e.type, e.ko);
  if (e.type === 'parry' || e.type === 'perfectParry') renderer.message(e.type === 'perfectParry' ? 'Perfect parry' : 'Parry');
  if (e.type === 'hit') { renderer.damage(e); announce(`Player ${e.target + 1}: ${duel.fighters[e.target].health} health`); }
  if (e.type === 'result') {
   const r = e.result, final = duel.phase === 'match';
   const winner = r.winner === 0 ? 'Player 1' : mode === 'local' ? 'Player 2' : 'CPU';
   const title = r.practice ? 'Practice' : r.draw ? 'Draw' : `${winner} wins`;
   showOverlay(title, final ? 'Rematch' : r.practice ? 'Reset' : 'Next round', !r.practice);
  }
 }
}
function frame(timestamp){
 const elapsed=lastFrame?Math.max(0,(timestamp-lastFrame)/1000):1/60;lastFrame=timestamp;
 if(document.hidden){accumulator=0;renderAccumulator=0;lastDrawTime=0;requestAnimationFrame(frame);return;}
 const dt=Math.min(elapsed,1/15);accumulator+=dt;
 let count=0;
 while(accumulator>=STEP&&count<8){duel.tick(STEP);events();accumulator-=STEP;count++;}
 if(count>=8)accumulator=0;
 for(let i=0;i<2;i++){
  const f=duel.fighters[i];
  if(f.health>=healthGhost[i])healthGhost[i]=f.health;
  else if(f.hurt<.22&&duel.phase!=='paused')healthGhost[i]=damp(healthGhost[i],f.health,6,dt);
 }
 const active=['fight','countdown','transition','finish'].includes(duel.phase),interval=active?1/60:1/20;
 renderAccumulator+=elapsed;
 if(renderAccumulator+1e-7>=interval){
  const renderDt=lastDrawTime?Math.max(0,(timestamp-lastDrawTime)/1000):interval;lastDrawTime=timestamp;renderAccumulator=Math.max(0,renderAccumulator-interval);if(renderAccumulator>interval)renderAccumulator%=interval;
  renderer.recordFrame(renderDt,active);renderer.render(duel.phase==='paused'?1:accumulator/STEP,Math.min(renderDt,.1));
 }
 hudClock+=dt;if(hudClock>.035){updateHud();hudClock=0;}
 requestAnimationFrame(frame);
}

updateSoundButton(); updateMode(); updateHud(); showOverlay('Ready?','Play'); requestAnimationFrame(frame);

return {duel,renderer,sound};
}
