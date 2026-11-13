import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../dist/app.js';

class Element extends EventTarget {
 constructor(tagName = 'BUTTON') {
  super();
  this.tagName = tagName;
  this.style = {};
  const classes = new Set();
  this.classList = {
   add: name => classes.add(name),
   remove: name => classes.delete(name),
   contains: name => classes.has(name),
  };
 }
 setAttribute() {}
 setPointerCapture() {}
 focus() {}
 getContext() { throw new Error('WebGL disabled for input test'); }
}

function dispatch(target, type, props = {}) {
 target.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), props));
}

test('touch and keyboard holds are independent and clear when the duel is interrupted', t => {
 const elements = new Map();
 const movement = new Element();
 movement.dataset = { key: 'd' };
 const document = Object.assign(new EventTarget(), {
  getElementById(id) {
   if (!elements.has(id)) elements.set(id, new Element());
   return elements.get(id);
  },
  querySelectorAll: selector => selector === '[data-key]' ? [movement] : [],
 });
 const window = Object.assign(new EventTarget(), { matchMedia: () => ({ matches: false }) });
 let frame;
 const globals = { document, window, ResizeObserver: class { observe() {} },
  requestAnimationFrame: callback => { frame = callback; } };
 for (const [key, value] of Object.entries(globals)) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, { configurable: true, value });
  t.after(() => descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key]);
 }
 const { duel } = createGame();
 duel.phase = 'fight';
 const key = (type, repeat = false) => dispatch(window, type, { code: 'KeyD', repeat });
 const pointer = (type, pointerId) => dispatch(movement, type, { pointerId, button: 0 });
 const held = () => movement.classList.contains('held');

 key('keydown');
 pointer('pointerdown', 1);
 pointer('pointerdown', 2);
 pointer('pointerup', 1);
 assert.equal(held(), true);
 key('keyup');
 assert.equal(duel.keys.d, true);
 key('keydown');
 pointer('pointercancel', 2);
 assert.equal(held(), false);
 assert.equal(duel.keys.d, true);
 key('keyup');
 assert.equal(duel.keys.d, false);

 key('keydown');
 pointer('pointerdown', 3);
 elements.get('pause').onclick();
 assert.equal(held(), false);
 assert.equal(duel.phase, 'paused');
 elements.get('pause').onclick();
 key('keydown', true);
 assert.equal(Boolean(duel.keys.d), false);

 pointer('pointerdown', 4);
 pointer('lostpointercapture', 3);
 assert.equal(duel.keys.d, true);
 assert.equal(held(), true);
 duel.start();
 for (let i = 1; i <= 20; i++) frame(i * 1000 / 60);
 assert.equal(duel.swapped, true);
 assert.equal(held(), false);
 assert.equal(Boolean(duel.keys.d), false);

 pointer('pointerdown', 5);
 dispatch(window, 'blur');
 assert.equal(duel.phase, 'paused');
 assert.equal(held(), false);
 assert.equal(Boolean(duel.keys.d), false);
});
