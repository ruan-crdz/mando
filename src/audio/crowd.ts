import { musicEnabled } from './music';

/**
 * Torcida de estádio sintetizada (WebAudio): murmúrio constante com ondas de
 * empolgação, bumbo e palmas da arquibancada, "uuuh" nas chances, explosão no gol
 * a favor, lamento no gol sofrido e o apito do árbitro.
 */
let ctx: AudioContext | null = null;
let out: GainNode;
let bed: GainNode;
let roar: GainNode;
let roarFilter: BiquadFilterNode;
let noise: AudioBuffer;
let running = false;
let swellTimer: number | undefined;
let chantTimer: number | undefined;
const VOLUME = 0.55;

function setup() {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  const c = new AC();
  out = c.createGain();
  out.gain.value = 0;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.ratio.value = 3;
  out.connect(comp).connect(c.destination);
  noise = c.createBuffer(2, c.sampleRate * 4, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = noise.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      // Ruído levemente "rosa": mais corpo, menos chiado.
      last = 0.97 * last + 0.03 * (Math.random() * 2 - 1);
      data[i] = (Math.random() * 2 - 1) * 0.35 + last * 4;
    }
  }
  // Murmúrio: ruído passando por formantes de voz humana.
  bed = c.createGain();
  bed.gain.value = 0.32;
  bed.connect(out);
  for (const [freq, q, gain] of [
    [380, 1.2, 1],
    [850, 1.6, 0.75],
    [1650, 2.2, 0.4],
    [2600, 3, 0.18],
  ]) {
    const s = c.createBufferSource();
    s.buffer = noise;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.value = gain;
    // Formantes oscilando devagar dão a sensação de milhares de vozes.
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.07 + Math.random() * 0.1;
    const depth = c.createGain();
    depth.gain.value = freq * 0.12;
    lfo.connect(depth).connect(f.frequency);
    lfo.start();
    s.connect(f).connect(g).connect(bed);
    s.start(0, Math.random() * 3);
  }
  // Camada de grito: aberta só nos lances, no gol e nos cânticos.
  roar = c.createGain();
  roar.gain.value = 0;
  roarFilter = c.createBiquadFilter();
  roarFilter.type = 'bandpass';
  roarFilter.frequency.value = 1100;
  roarFilter.Q.value = 0.6;
  const roarSource = c.createBufferSource();
  roarSource.buffer = noise;
  roarSource.loop = true;
  roarSource.connect(roarFilter).connect(roar).connect(out);
  roarSource.start(0, 1.3);
  return c;
}

function drum(t: number, peak = 0.7) {
  const c = ctx!;
  const o = c.createOscillator();
  const g = c.createGain();
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(48, t + 0.18);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.4);
}

function clap(t: number, peak = 0.35) {
  const c = ctx!;
  const s = c.createBufferSource();
  s.buffer = noise;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 1500;
  f.Q.value = 0.8;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  s.connect(f).connect(g).connect(out);
  s.start(t, Math.random() * 3);
  s.stop(t + 0.15);
}

/** Bumbo e palmas da organizada por alguns compassos. */
function chant(bars = 4) {
  if (!ctx || !running) return;
  const beat = 0.42;
  const start = ctx.currentTime + 0.05;
  // Batida clássica de arquibancada: tum · tum · tum-tum-tum.
  const pattern = [0, 2, 4, 5, 6];
  for (let bar = 0; bar < bars; bar++)
    for (const step of pattern) {
      const t = start + (bar * 8 + step) * beat;
      drum(t);
      clap(t + 0.01);
    }
  rise(0.35, bars * 8 * beat, 900);
}

/** Abre a camada de grito por um tempo. */
function rise(level: number, hold: number, freq: number, attack = 0.25, release = 1.6) {
  if (!ctx) return;
  const t = ctx.currentTime;
  roar.gain.cancelScheduledValues(t);
  roar.gain.setValueAtTime(roar.gain.value, t);
  roar.gain.linearRampToValueAtTime(level, t + attack);
  roar.gain.setValueAtTime(level, t + attack + hold);
  roar.gain.linearRampToValueAtTime(0, t + attack + hold + release);
  roarFilter.frequency.cancelScheduledValues(t);
  roarFilter.frequency.setTargetAtTime(freq, t, 0.15);
}

function swell() {
  if (!ctx || !running) return;
  // Ondas aleatórias: a torcida nunca fica num volume só.
  bed.gain.setTargetAtTime(0.22 + Math.random() * 0.22, ctx.currentTime, 1.4);
  swellTimer = window.setTimeout(swell, 1800 + Math.random() * 2600);
}

function scheduleChant() {
  chantTimer = window.setTimeout(
    () => {
      chant(3 + Math.floor(Math.random() * 3));
      scheduleChant();
    },
    14000 + Math.random() * 18000,
  );
}

export function startCrowd() {
  if (!musicEnabled() || typeof window === 'undefined') return;
  if (!ctx) ctx = setup();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  if (running) return;
  running = true;
  out.gain.setTargetAtTime(VOLUME, ctx.currentTime, 1.2);
  swell();
  scheduleChant();
}

export function stopCrowd() {
  if (!ctx || !running) return;
  running = false;
  window.clearTimeout(swellTimer);
  window.clearTimeout(chantTimer);
  out.gain.setTargetAtTime(0, ctx.currentTime, 0.6);
  const c = ctx;
  setTimeout(() => {
    if (!running && c.state === 'running') void c.suspend();
  }, 3000);
}

/** Narrador grita o gol com a voz pt-BR do navegador (gratuita e instantânea). */
function narrateGoal() {
  if (!('speechSynthesis' in window)) return;
  const voices = speechSynthesis.getVoices().filter((v) => /pt-?BR/i.test(v.lang));
  const voice =
    voices.find((v) => /antonio|daniel|natural|online/i.test(v.name)) ||
    voices.find((v) => /google/i.test(v.name)) ||
    voices[0];
  const shout = new SpeechSynthesisUtterance('Gooooooooool! É gol! Gol, gol, gol!');
  if (voice) shout.voice = voice;
  shout.lang = 'pt-BR';
  shout.rate = 0.82;
  shout.pitch = 1.35;
  shout.volume = 1;
  speechSynthesis.speak(shout);
}

/** Gol: explosão da torcida (a favor) ou lamento seguido de silêncio (contra). */
export function crowdGoal(ours: boolean) {
  if (!ctx || !running) return;
  const t = ctx.currentTime;
  if (ours) {
    // Sobe as vozes (formantes) em vez de ruído puro: soa como gente, não como rádio fora de sintonia.
    bed.gain.cancelScheduledValues(t);
    bed.gain.setValueAtTime(bed.gain.value, t);
    bed.gain.linearRampToValueAtTime(0.75, t + 0.4);
    bed.gain.setTargetAtTime(0.3, t + 6, 1.6);
    rise(0.32, 4, 700, 0.4, 3.5);
    roarFilter.Q.setValueAtTime(1.1, t);
    window.setTimeout(() => chant(4), 3500);
    narrateGoal();
  } else {
    rise(0.5, 0.6, 420, 0.15, 1.5);
    bed.gain.cancelScheduledValues(t);
    bed.gain.setTargetAtTime(0.08, t + 1.2, 0.8);
    bed.gain.setTargetAtTime(0.3, t + 8, 2);
  }
}

/** Chance de gol: o "uuuh" da arquibancada. */
export function crowdChance() {
  if (!ctx || !running) return;
  rise(0.55, 0.5, 650, 0.35, 1.3);
  roarFilter.frequency.setTargetAtTime(420, ctx.currentTime + 0.6, 0.4);
}

/** Apito do árbitro: um curto no início, dois no intervalo, três no fim. */
export function crowdWhistle(times = 1) {
  if (!ctx || !running) return;
  const c = ctx;
  for (let i = 0; i < times; i++) {
    const t = c.currentTime + 0.05 + i * 0.45;
    const length = i === times - 1 ? 0.7 : 0.3;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    g.gain.setValueAtTime(0.18, t + length - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    // Trinado da bolinha do apito.
    const trill = c.createOscillator();
    trill.frequency.value = 28;
    const trillDepth = c.createGain();
    trillDepth.gain.value = 140;
    trill.connect(trillDepth);
    for (const freq of [2950, 3150]) {
      const o = c.createOscillator();
      o.frequency.value = freq;
      trillDepth.connect(o.frequency);
      o.connect(g);
      o.start(t);
      o.stop(t + length + 0.05);
    }
    g.connect(out);
    trill.start(t);
    trill.stop(t + length + 0.05);
  }
}
