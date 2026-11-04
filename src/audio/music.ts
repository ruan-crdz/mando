import { subscribeVoice, voiceState } from '../components/voice';

/**
 * Trilha eletrônica de menu gerada em tempo real (WebAudio): house melódico a
 * 124 BPM com kick, palmas, chimbal, baixo, pad com "sidechain" e arpejo com delay.
 * Nada de faixas licenciadas: tudo é sintetizado aqui.
 */
const BPM = 124;
const STEP = 60 / BPM / 4;
const VOLUME = 0.16;
const KEY = 'mando-music';
// Progressão Am – F – C – G (raiz em MIDI e tríade).
const progression = [
  { root: 45, chord: [57, 60, 64] },
  { root: 41, chord: [53, 57, 60] },
  { root: 48, chord: [55, 60, 64] },
  { root: 43, chord: [55, 59, 62] },
];
const arpPattern = [0, 1, 2, 1, 2, 0, 1, 2, 0, 2, 1, 2, 0, 1, 2, 1];

let ctx: AudioContext | null = null;
let master: GainNode;
let duck: GainNode;
let pump: GainNode;
let padFilter: BiquadFilterNode;
let delayIn: GainNode;
let noise: AudioBuffer;
let timer: number | undefined;
let nextTime = 0;
let step = 0;
let enabled = typeof localStorage === 'undefined' || localStorage.getItem(KEY) !== '0';
const listeners = new Set<() => void>();

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

function setup() {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  const c = new AC();
  master = c.createGain();
  master.gain.value = 0;
  duck = c.createGain();
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  duck.connect(master).connect(comp).connect(c.destination);
  // Pad passa por um ganho que "respira" a cada kick (efeito sidechain).
  pump = c.createGain();
  padFilter = c.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.Q.value = 3;
  padFilter.frequency.value = 900;
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 1 / (STEP * 16 * 8);
  lfoGain.gain.value = 700;
  lfo.connect(lfoGain).connect(padFilter.frequency);
  lfo.start();
  padFilter.connect(pump).connect(duck);
  // Delay em colcheia pontuada para o arpejo.
  delayIn = c.createGain();
  const delay = c.createDelay(1);
  delay.delayTime.value = STEP * 3;
  const feedback = c.createGain();
  feedback.gain.value = 0.38;
  const wet = c.createGain();
  wet.gain.value = 0.45;
  delayIn.connect(duck);
  delayIn.connect(delay).connect(feedback).connect(delay);
  delay.connect(wet).connect(duck);
  noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return c;
}

function env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function kick(t: number) {
  const c = ctx!;
  const o = c.createOscillator();
  const g = c.createGain();
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  env(g, t, 0.9, 0.002, 0.32);
  o.connect(g).connect(duck);
  o.start(t);
  o.stop(t + 0.4);
  pump.gain.cancelScheduledValues(t);
  pump.gain.setValueAtTime(0.25, t);
  pump.gain.linearRampToValueAtTime(1, t + STEP * 3);
}

function hiss(t: number, type: BiquadFilterType, freq: number, peak: number, decay: number) {
  const c = ctx!;
  const s = c.createBufferSource();
  s.buffer = noise;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = c.createGain();
  env(g, t, peak, 0.001, decay);
  s.connect(f).connect(g).connect(duck);
  s.start(t, Math.random() * 0.5);
  s.stop(t + decay + 0.05);
}

function tone(
  t: number,
  midi: number,
  type: OscillatorType,
  peak: number,
  attack: number,
  decay: number,
  out: AudioNode,
  cutoff?: number,
) {
  const c = ctx!;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = hz(midi);
  const g = c.createGain();
  env(g, t, peak, attack, decay);
  if (cutoff) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    o.connect(f).connect(g).connect(out);
  } else o.connect(g).connect(out);
  o.start(t);
  o.stop(t + attack + decay + 0.05);
}

function schedule(t: number, s: number) {
  const bar = Math.floor(s / 16);
  const beat = s % 16;
  const { root, chord } = progression[bar % 4];
  // Estrutura em blocos de 8 compassos: intro, drop, break, drop.
  const section = Math.floor(bar / 8) % 4;
  const drums = section !== 2;
  if (drums && beat % 4 === 0) kick(t);
  if (drums && (beat === 4 || beat === 12)) hiss(t, 'bandpass', 1600, 0.35, 0.16);
  if (beat % 4 === 2) hiss(t, 'highpass', 7500, 0.22, 0.09);
  else if (drums && section !== 0) hiss(t, 'highpass', 9000, 0.06, 0.03);
  if (drums && beat % 4 === 2) tone(t, root - 12, 'sawtooth', 0.32, 0.005, 0.18, duck, 380);
  if (beat === 0)
    for (const [i, n] of chord.entries()) {
      for (const detune of [-0.08, 0.08])
        tone(t, n + detune, 'sawtooth', 0.07, 0.25, STEP * 15, padFilter);
      if (i === 0) tone(t, n - 12, 'triangle', 0.06, 0.3, STEP * 15, padFilter);
    }
  if (section !== 0 || bar % 8 >= 4) {
    const note = chord[arpPattern[beat]] + 12 + (beat % 8 === 7 ? 12 : 0);
    tone(t, note, 'square', 0.05, 0.003, 0.14, delayIn, 2600);
  }
}

function tick() {
  if (!ctx) return;
  // Aba em segundo plano: não acumula atraso, retoma do tempo atual.
  if (nextTime < ctx.currentTime - 0.5) nextTime = ctx.currentTime + 0.05;
  while (nextTime < ctx.currentTime + 0.15) {
    schedule(nextTime, step);
    step += 1;
    nextTime += STEP;
  }
}

function applyDuck() {
  if (!ctx) return;
  duck.gain.setTargetAtTime(voiceState().current ? 0.3 : 1, ctx.currentTime, 0.25);
}

/** Liga o áudio no primeiro gesto do jogador (exigência dos navegadores). */
export function startMusic() {
  if (!enabled || typeof window === 'undefined') return;
  if (!ctx) {
    ctx = setup();
    if (!ctx) return;
    nextTime = ctx.currentTime + 0.1;
    subscribeVoice(applyDuck);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  if (timer === undefined) {
    nextTime = Math.max(nextTime, ctx.currentTime + 0.05);
    timer = window.setInterval(tick, 25);
  }
  master.gain.setTargetAtTime(VOLUME, ctx.currentTime, 0.8);
}

export function stopMusic() {
  if (!ctx) return;
  master.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
  window.clearInterval(timer);
  timer = undefined;
  const c = ctx;
  setTimeout(() => {
    if (!enabled && c.state === 'running') void c.suspend();
  }, 1200);
}

export const musicEnabled = () => enabled;

export function toggleMusic() {
  enabled = !enabled;
  localStorage.setItem(KEY, enabled ? '1' : '0');
  if (enabled) startMusic();
  else stopMusic();
  listeners.forEach((l) => l());
  return enabled;
}

export const subscribeMusic = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

if (typeof window !== 'undefined') {
  const unlock = () => startMusic();
  for (const event of ['pointerdown', 'keydown', 'touchstart'])
    window.addEventListener(event, unlock, { passive: true });
}
