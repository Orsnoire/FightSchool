import { validateRig } from '../../../shared/avatar/rig.mjs';
import { prepareTextures } from '../../../shared/avatar/textures.mjs';
import { drawStage } from '../../../shared/avatar/render.mjs';

async function start() {
  const data = window.AVATAR_WORKSHOP_DATA;
  validateRig(data.rig, data.clips);
  const $ = id => document.getElementById(id);
  const makeCanvas = (w, h) => { const c = document.createElement('canvas');c.width = w;c.height = h;return c; };
  const images = Object.fromEntries(await Promise.all(Object.entries(data.images).map(async ([id, url]) => {
    const image = new Image();image.src = url;await image.decode();return [id, image];
  })));
  const state = { clip: 'idle', time: 0, outfit: 'starter', speed: 1, playing: !matchMedia('(prefers-reduced-motion: reduce)').matches, skeleton: false, weapons: true, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches };
  const colors = { ...data.manifest.defaultColors };
  for (const channel of ['hair', 'eyes', 'skin']) {
    const options = data.manifest.palettes[data.manifest.channels[channel].paletteId];
    for (const option of options) $(channel).add(new Option(option.label, option.hex));
    $(channel).value = colors[channel];
  }
  let textures = prepareTextures(data, images, makeCanvas, colors);
  const canvas = $('stage'), ctx = canvas.getContext('2d');
  const notes = { idle: 'A gentle breathing loop, with both feet planted.', attack: 'Wind-up, a brief hold, the downward strike, and recovery to rest.', block: 'Raise the shield, brace for an impact, then return to rest.' };
  let frame;
  function render() {
    frame = drawStage(ctx, canvas.width, canvas.height, data, textures, state);
    $('timeline').value = state.time;
    $('time').value = `${state.time.toFixed(2)} / ${data.clips[state.clip].duration.toFixed(2)} s`;
  }
  function sync() {
    for (const button of document.querySelectorAll('[data-clip]')) button.setAttribute('aria-pressed', String(button.dataset.clip === state.clip));
    for (const button of document.querySelectorAll('[data-outfit]')) button.setAttribute('aria-pressed', String(button.dataset.outfit === state.outfit));
    $('kit-label').textContent = state.outfit === 'armor' ? 'Steel & blue armor' : 'Starter clothing';
    $('motion-note').textContent = notes[state.clip];
    $('timeline').max = data.clips[state.clip].duration;
    $('play').textContent = state.playing ? 'Pause' : 'Play';
    $('reduced').checked = state.reducedMotion;
    $('skeleton').checked = state.skeleton;
    $('weapons').checked = state.weapons;
    render();
  }
  for (const button of document.querySelectorAll('[data-clip]')) button.addEventListener('click', () => { state.clip = button.dataset.clip;state.time = 0;sync();$('status').textContent = data.clips[state.clip].name; });
  for (const button of document.querySelectorAll('[data-outfit]')) button.addEventListener('click', () => { state.outfit = button.dataset.outfit;sync();$('status').textContent = 'Equipment changed; motion and appearance preserved.'; });
  $('play').addEventListener('click', () => { state.playing = !state.playing;if (state.playing) state.reducedMotion = false;sync(); });
  $('restart').addEventListener('click', () => { state.time = 0;render(); });
  $('speed').addEventListener('change', () => { state.speed = Number($('speed').value); });
  $('timeline').addEventListener('input', () => { state.time = Number($('timeline').value);state.playing = false;state.reducedMotion = false;sync(); });
  $('skeleton').addEventListener('change', () => { state.skeleton = $('skeleton').checked;render(); });
  $('weapons').addEventListener('change', () => { state.weapons = $('weapons').checked;render(); });
  $('reduced').addEventListener('change', () => { state.reducedMotion = $('reduced').checked;if (state.reducedMotion) { state.playing = false;state.time = 0; }sync(); });
  for (const channel of ['hair', 'eyes', 'skin']) $(channel).addEventListener('change', () => { colors[channel] = $(channel).value;textures = prepareTextures(data, images, makeCanvas, colors);render(); });
  const resize = () => { const rect = canvas.getBoundingClientRect();canvas.width = Math.round(rect.width * Math.min(devicePixelRatio, 2));canvas.height = Math.round(rect.height * Math.min(devicePixelRatio, 2));render(); };
  new ResizeObserver(resize).observe(canvas);
  let previous = performance.now();
  function tick(now) {
    const delta = Math.min((now - previous) / 1000, .1);previous = now;
    if (state.playing && !document.hidden && !state.reducedMotion) { state.time = (state.time + delta * state.speed) % data.clips[state.clip].duration;render(); }
    requestAnimationFrame(tick);
  }
  sync();resize();requestAnimationFrame(tick);$('status').textContent = 'Ready to inspect.';
  // Read-only snapshots and deterministic seek for browser acceptance tests.
  window.avatarWorkshop = {
    get state() { return { ...state, colors: { ...colors } }; },
    get frame() { return structuredClone(frame); },
    seek(clip, time, outfit = state.outfit) { if (!data.clips[clip] || !data.rig.kits[outfit] || !Number.isFinite(time)) throw new Error('Invalid preview request');Object.assign(state, { clip, time: Math.max(0, Math.min(time, data.clips[clip].duration)), outfit, playing: false, reducedMotion: false });sync(); },
  };
}
start().catch(error => { document.getElementById('error').textContent = `The workshop could not start: ${error.message}`;console.error(error); });
