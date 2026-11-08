import type { Message } from '../game/types';

export const soundtrack = [
  {
    title: 'Neon no Estádio',
    artist: 'Mando Studio',
    bpm: 126,
    roots: [45, 41, 48, 43],
    motif: [0, 7, 10, 12, 10, 7, 3, 7],
  },
  {
    title: 'Virada Elétrica',
    artist: 'Mando Studio',
    bpm: 132,
    roots: [40, 43, 47, 45],
    motif: [0, 3, 7, 10, 12, 10, 7, 3],
  },
  {
    title: 'Luzes da Linha',
    artist: 'Mando Studio',
    bpm: 124,
    roots: [50, 46, 53, 48],
    motif: [0, 7, 12, 14, 12, 7, 4, 2],
  },
  {
    title: 'Ritmo de Jogo',
    artist: 'Mando Studio',
    bpm: 128,
    roots: [43, 48, 45, 50],
    motif: [0, 5, 7, 12, 10, 7, 5, 2],
  },
  {
    title: 'Noite em São Paulo',
    artist: 'Mando Studio',
    bpm: 122,
    roots: [48, 45, 53, 50],
    motif: [12, 7, 4, 0, 7, 10, 12, 7],
  },
  {
    title: 'Pressão Alta',
    artist: 'Mando Studio',
    bpm: 134,
    roots: [40, 45, 43, 48],
    motif: [0, 7, 10, 7, 3, 7, 12, 10],
  },
  {
    title: 'Cidade em Movimento',
    artist: 'Mando Studio',
    bpm: 128,
    roots: [50, 53, 46, 48],
    motif: [0, 3, 7, 12, 14, 12, 7, 3],
  },
  {
    title: 'Manto Neon',
    artist: 'Mando Studio',
    bpm: 124,
    roots: [43, 40, 48, 45],
    motif: [0, 5, 7, 10, 12, 10, 7, 5],
  },
  {
    title: 'Contra o Tempo',
    artist: 'Mando Studio',
    bpm: 130,
    roots: [45, 50, 41, 48],
    motif: [0, 7, 12, 10, 7, 3, 10, 12],
  },
  {
    title: 'Último Minuto',
    artist: 'Mando Studio',
    bpm: 132,
    roots: [47, 43, 50, 45],
    motif: [7, 12, 14, 10, 7, 3, 0, 7],
  },
] as const;

const listeners = new Set<() => void>();
let state = {
  music: localStorage.getItem('mando-music') !== 'off',
  crowd: localStorage.getItem('mando-crowd') !== 'off',
  track: 0,
  sequence: 0,
  speaking: false,
  error: '',
};
let context: AudioContext | null = null;
let musicBus: GainNode;
let crowdBus: GainNode;
let effectsBus: GainNode;
let noise: AudioBufferSourceNode | null = null;
let whiteBuffer: AudioBuffer | null = null;
let percussionBuffer: AudioBuffer | null = null;
let scheduler: ReturnType<typeof setInterval> | null = null;
let scene: 'menu' | 'match' = 'menu';
let liveCrowd = false;
let beat = 0;
let nextBeat = 0;
let generation = 0;
let readingStart: ReturnType<typeof setTimeout> | null = null;
let phoneLine: {
  source: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
} | null = null;
const emit = () => listeners.forEach((listener) => listener());
const patch = (change: Partial<typeof state>) => {
  state = { ...state, ...change };
  emit();
};
export const audioState = () => state;
export const subscribeAudio = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

function tone(
  bus: GainNode,
  time: number,
  midi: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'triangle',
) {
  if (!context) return;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = type;
  oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
  envelope.gain.setValueAtTime(0, time);
  envelope.gain.linearRampToValueAtTime(volume, time + 0.015);
  envelope.gain.exponentialRampToValueAtTime(0.001, time + duration);
  oscillator.connect(envelope).connect(bus);
  oscillator.start(time);
  oscillator.stop(time + duration + 0.02);
  oscillator.onended = () => {
    oscillator.disconnect();
    envelope.disconnect();
  };
}

function noiseHit(
  time: number,
  duration: number,
  volume: number,
  cutoff: number,
  type: BiquadFilterType,
  bus: GainNode = musicBus,
) {
  if (!context || !percussionBuffer) return;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = percussionBuffer;
  filter.type = type;
  filter.frequency.setValueAtTime(cutoff, time);
  gain.gain.setValueAtTime(volume, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
  source.connect(filter).connect(gain).connect(bus);
  source.start(time);
  source.stop(time + duration + 0.01);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    gain.disconnect();
  };
}

function drums(time: number, count: number) {
  if (!context) return;
  if (count % 2 === 0) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(145, time);
    oscillator.frequency.exponentialRampToValueAtTime(42, time + 0.12);
    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
    oscillator.connect(gain).connect(musicBus);
    oscillator.start(time);
    oscillator.stop(time + 0.17);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
  if (count % 8 === 2 || count % 8 === 6) noiseHit(time, 0.12, 0.11, 2200, 'bandpass');
  if (count % 2 === 1) noiseHit(time, 0.04, 0.035, 7800, 'highpass');
  if (count % 16 === 15) noiseHit(time, 0.1, 0.065, 6500, 'highpass');
}

function levels() {
  if (!context) return;
  musicBus.gain.setTargetAtTime(
    scene === 'menu' && state.music ? (state.speaking ? 0.025 : 0.14) : 0,
    context.currentTime,
    0.12,
  );
  crowdBus.gain.setTargetAtTime(
    scene === 'match' && state.crowd ? (liveCrowd ? 0.16 : 0.055) : 0,
    context.currentTime,
    0.15,
  );
}

/**
 * Torcida sintetizada: dezenas de vozes (pulso glotal com vibrato e sílabas aleatórias)
 * sobre um rumor grave de estádio, com ondas lentas de volume e loop sem emenda.
 */
function crowdBuffer(ctx: AudioContext) {
  const rate = ctx.sampleRate;
  const seconds = 8;
  const fade = Math.floor(rate * 0.6);
  const length = rate * seconds;
  const total = length + fade;
  const mix = new Float32Array(total);
  let brown = 0;
  for (let i = 0; i < total; i++) {
    brown = (brown + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    mix[i] = brown * 2.2;
  }
  for (let v = 0; v < 42; v++) {
    const base = 95 + Math.random() * (v % 3 === 0 ? 200 : 110);
    const vibRate = 4 + Math.random() * 2;
    const vibDepth = 0.02 + Math.random() * 0.03;
    const loud = 0.02 + Math.random() * 0.025;
    let phase = Math.random();
    let env = 0;
    let target = 0;
    let nextSyllable = Math.floor(Math.random() * rate * 0.4);
    let glide = 1;
    for (let i = 0; i < total; i++) {
      if (i >= nextSyllable) {
        target = Math.random() < 0.7 ? 0.5 + Math.random() * 0.5 : 0;
        glide = 0.85 + Math.random() * 0.35;
        nextSyllable = i + Math.floor(rate * (0.12 + Math.random() * 0.35));
      }
      env += (target - env) * 0.0016;
      const f = base * glide * (1 + vibDepth * Math.sin((2 * Math.PI * vibRate * i) / rate));
      phase += f / rate;
      if (phase >= 1) phase -= 1;
      const p = 2 * Math.PI * phase;
      const voice = Math.sin(p) + 0.6 * Math.sin(2 * p) + 0.4 * Math.sin(3 * p) + 0.22 * Math.sin(5 * p);
      mix[i] += voice * env * loud;
    }
  }
  const out = ctx.createBuffer(1, length, rate);
  const data = out.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < length; i++) {
    const swell = 0.8 + 0.2 * Math.sin((2 * Math.PI * i) / length) * Math.sin((6 * Math.PI * i) / length);
    let s = mix[i];
    if (i < fade) s = mix[i] * (i / fade) + mix[length + i] * (1 - i / fade);
    data[i] = s * swell;
    peak = Math.max(peak, Math.abs(data[i]));
  }
  for (let i = 0; i < length; i++) data[i] = (data[i] / peak) * 0.6;
  return out;
}

export async function unlockAudio() {
  try {
    if (!context) {
      context = new AudioContext();
      musicBus = context.createGain();
      crowdBus = context.createGain();
      effectsBus = context.createGain();
      effectsBus.gain.value = 0.2;
      musicBus.gain.value = 0;
      crowdBus.gain.value = 0;
      const limiter = context.createDynamicsCompressor();
      musicBus.connect(limiter);
      crowdBus.connect(limiter);
      effectsBus.connect(limiter);
      limiter.connect(context.destination);
      const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;
      percussionBuffer = context.createBuffer(
        1,
        Math.ceil(context.sampleRate * 0.25),
        context.sampleRate,
      );
      const percussion = percussionBuffer.getChannelData(0);
      for (let index = 0; index < percussion.length; index++)
        percussion[index] = Math.random() * 2 - 1;
      whiteBuffer = buffer;
      noise = context.createBufferSource();
      noise.buffer = crowdBuffer(context);
      noise.loop = true;
      const body = context.createBiquadFilter();
      body.type = 'lowpass';
      body.frequency.value = 2200;
      body.Q.value = 0.6;
      const chest = context.createBiquadFilter();
      chest.type = 'peaking';
      chest.frequency.value = 600;
      chest.gain.value = 5;
      chest.Q.value = 0.8;
      noise.connect(body).connect(chest).connect(crowdBus);
      noise.start();
      nextBeat = context.currentTime + 0.08;
      scheduler = setInterval(() => {
        if (!context || context.state !== 'running') return;
        if (scene !== 'menu' || !state.music) {
          nextBeat = context.currentTime + 0.08;
          return;
        }
        if (nextBeat < context.currentTime) nextBeat = context.currentTime + 0.05;
        while (nextBeat < context.currentTime + 0.15) {
          if (beat === 0) patch({ sequence: state.sequence + 1 });
          const song = soundtrack[state.track];
          const step = 60 / song.bpm / 2;
          const root = song.roots[Math.floor(beat / 16) % 4];
          const bassPattern = [0, 0, 7, 0, 0, 3, 7, 3];
          tone(musicBus, nextBeat, root - 12 + bassPattern[beat % 8], step * 0.9, 0.13, 'sawtooth');
          tone(
            musicBus,
            nextBeat,
            root + 24 + song.motif[beat % 8],
            step * 0.72,
            0.075,
            'sawtooth',
          );
          if (beat % 2 === 1) {
            for (const interval of [0, state.track % 2 ? 3 : 4, 7])
              tone(musicBus, nextBeat, root + 12 + interval, step * 1.6, 0.045, 'square');
          }
          drums(nextBeat, beat);
          nextBeat += step;
          beat++;
          if (beat === 512) {
            beat = 0;
            patch({ track: (state.track + 1) % soundtrack.length });
          }
        }
      }, 50);
    }
    if (context.state !== 'running') {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          context.resume(),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(
              () =>
                reject(
                  new Error(
                    'O navegador bloqueou o audio. Clique ou pressione uma tecla para autorizar a reproducao.',
                  ),
                ),
              1500,
            );
          }),
        ]);
      } finally {
        if (timeout !== undefined) clearTimeout(timeout);
      }
    }
    if (context.state !== 'running')
      throw new Error(
        'O navegador bloqueou o audio. Ative o som em uma janela com permissao de reproducao.',
      );
    levels();
    if (state.error) patch({ error: '' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (state.error !== message) {
      console.warn('audio_unavailable', error);
      patch({ error: message });
    }
  }
}

export function setAudioScene(value: 'menu' | 'match', playing = false) {
  scene = value;
  liveCrowd = playing;
  levels();
}
export function setCrowdPlaying(value: boolean) {
  liveCrowd = value;
  levels();
}
export function toggleMusic() {
  patch({ music: !state.music });
  localStorage.setItem('mando-music', state.music ? 'on' : 'off');
  void unlockAudio();
  levels();
}
export function toggleCrowd() {
  patch({ crowd: !state.crowd });
  localStorage.setItem('mando-crowd', state.crowd ? 'on' : 'off');
  void unlockAudio();
  levels();
}
export async function mailboxChime() {
  await unlockAudio();
  if (!context || context.state !== 'running') return;
  const time = context.currentTime;
  noiseHit(time, 0.035, 0.8, 2300, 'highpass', effectsBus);
  tone(effectsBus, time + 0.04, 65, 0.12, 0.45, 'sine');
  tone(effectsBus, time + 0.04, 69, 0.12, 0.45, 'sine');
  tone(effectsBus, time + 0.2, 81, 0.1, 0.6, 'sine');
}
export function crowdGoal() {
  if (!context || !state.crowd) return;
  crowdBus.gain.cancelScheduledValues(context.currentTime);
  crowdBus.gain.setValueAtTime(0.38, context.currentTime);
  crowdBus.gain.setTargetAtTime(liveCrowd ? 0.16 : 0.055, context.currentTime + 1.5, 0.7);
}

let finalBus: GainNode | null = null;

/** Trilha da entrada em campo na final: batidas de coração, rufar, torcida crescendo, hino e apito. */
export async function finalBuildup() {
  await unlockAudio();
  if (!context || context.state !== 'running') return;
  finalBus?.disconnect();
  const bus = context.createGain();
  bus.connect(effectsBus);
  finalBus = bus;
  const t = context.currentTime;
  const heart = (time: number, v: number) => {
    const o = context!.createOscillator();
    const g = context!.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(70, time);
    o.frequency.exponentialRampToValueAtTime(38, time + 0.18);
    g.gain.setValueAtTime(v, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
    o.connect(g).connect(bus);
    o.start(time);
    o.stop(time + 0.24);
  };
  for (let i = 0; i < 4; i++) {
    heart(t + i * 0.85, 0.9);
    heart(t + i * 0.85 + 0.22, 0.6);
  }
  // Rufar que acelera até a entrada dos times.
  let time = t + 3.2;
  for (let gap = 0.16; time < t + 6; gap = Math.max(0.035, gap * 0.93)) {
    noiseHit(time, 0.06, 0.25 + (time - t - 3.2) * 0.12, 1800, 'bandpass', bus);
    time += gap;
  }
  // Acorde de hino na entrada em campo.
  for (const [i, note] of [55, 62, 67, 71, 74].entries()) {
    tone(bus, t + 6 + i * 0.03, note, 3.4, 0.16, 'sawtooth');
    tone(bus, t + 8.2, note + 2, 2.6, 0.12, 'triangle');
  }
  if (state.crowd) {
    crowdBus.gain.cancelScheduledValues(t);
    crowdBus.gain.setValueAtTime(0.02, t);
    crowdBus.gain.linearRampToValueAtTime(0.12, t + 5.8);
    crowdBus.gain.linearRampToValueAtTime(0.42, t + 6.4);
    crowdBus.gain.setTargetAtTime(0.055, t + 10.5, 0.8);
  }
  // Apito inicial.
  for (const d of [0, 0.32]) {
    tone(bus, t + 10.8 + d, 96, 0.22, 0.25, 'square');
    tone(bus, t + 10.8 + d, 97, 0.22, 0.18, 'square');
  }
}

export function stopFinalBuildup() {
  finalBus?.disconnect();
  finalBus = null;
  if (!context) return;
  crowdBus.gain.cancelScheduledValues(context.currentTime);
  levels();
}

function stopPhoneLine() {
  if (!phoneLine) return;
  phoneLine.source.stop();
  phoneLine = null;
}

function startPhoneLine() {
  if (!context || !whiteBuffer || context.state !== 'running') return;
  stopPhoneLine();
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = whiteBuffer;
  source.loop = true;
  filter.type = 'bandpass';
  filter.frequency.value = 1700;
  filter.Q.value = 0.7;
  gain.gain.value = 0.035;
  source.connect(filter).connect(gain).connect(effectsBus);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    gain.disconnect();
  };
  source.start();
  phoneLine = { source, filter, gain };
}

export function stopReading() {
  generation++;
  if (readingStart !== null) clearTimeout(readingStart);
  readingStart = null;
  stopPhoneLine();
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  patch({ speaking: false });
  levels();
}

export function readMailbox(messages: Message[], onMessage: (id: string) => void) {
  stopReading();
  if (!('speechSynthesis' in window)) {
    patch({ error: 'Este navegador nao oferece leitura de voz. Use Chrome ou Edge.' });
    return;
  }
  if (!messages.length) return;
  patch({ speaking: true });
  levels();
  const token = generation;
  const entries = messages.flatMap((message) => {
    const text = `${message.from}. ${message.title}. ${message.aiText || message.body}`;
    const chunks: string[] = [];
    let chunk = '';
    for (const word of text.trim().split(/\s+/)) {
      if (chunk && chunk.length + word.length + 1 > 180) {
        chunks.push(chunk);
        chunk = word;
      } else {
        chunk = chunk ? `${chunk} ${word}` : word;
      }
    }
    if (chunk) chunks.push(chunk);
    return chunks.map((piece) => ({ id: message.id, text: piece }));
  });
  let index = 0;
  const next = () => {
    if (token !== generation) return;
    if (index >= entries.length) {
      stopPhoneLine();
      patch({ speaking: false });
      levels();
      return;
    }
    const entry = entries[index++];
    onMessage(entry.id);
    const utterance = new SpeechSynthesisUtterance(entry.text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.9;
    utterance.pitch = 0.96;
    const voices = speechSynthesis.getVoices().filter((voice) => /^pt[-_]br$/i.test(voice.lang));
    utterance.voice =
      voices.find(
        (voice) => voice.localService && /natural|neural|enhanced|premium/i.test(voice.name),
      ) ||
      voices.find((voice) => voice.localService) ||
      voices[0] ||
      null;
    utterance.onend = next;
    utterance.onerror = (event) => {
      if (token !== generation || event.error === 'canceled' || event.error === 'interrupted')
        return;
      console.warn('mailbox_voice_failed', event.error);
      stopReading();
      patch({ error: `Falha na leitura de voz: ${event.error}.` });
    };
    speechSynthesis.speak(utterance);
  };
  void mailboxChime().then(() => {
    if (token !== generation) return;
    startPhoneLine();
    readingStart = setTimeout(() => {
      readingStart = null;
      next();
    }, 350);
  });
}

export function disposeAudio() {
  stopReading();
  if (scheduler) clearInterval(scheduler);
  scheduler = null;
  noise?.stop();
  noise = null;
  percussionBuffer = null;
  if (context) void context.close();
  context = null;
}
