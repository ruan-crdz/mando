import type { Message } from '../game/types';

export const soundtrack = [
  { title: 'Primeiro Mando', bpm: 112, roots: [48, 53, 55, 48], motif: [0, 7, 12, 4, 7, 2, 4, 0] },
  { title: 'Noite de Derby', bpm: 126, roots: [45, 41, 48, 43], motif: [0, 3, 7, 10, 7, 3, 12, 7] },
  { title: 'Linha de Passe', bpm: 104, roots: [50, 55, 47, 52], motif: [4, 7, 2, 0, 9, 7, 4, 2] },
  {
    title: 'Arquibancada Azul',
    bpm: 118,
    roots: [43, 48, 52, 50],
    motif: [0, 4, 7, 11, 12, 7, 4, 2],
  },
  { title: 'Depois do Apito', bpm: 96, roots: [48, 45, 53, 55], motif: [12, 7, 4, 0, 2, 4, 7, 9] },
  { title: 'Contra-ataque', bpm: 132, roots: [40, 43, 45, 47], motif: [0, 7, 3, 10, 12, 10, 7, 3] },
  { title: 'Talento da Base', bpm: 108, roots: [53, 48, 50, 46], motif: [0, 5, 7, 9, 12, 9, 5, 2] },
  {
    title: 'Luzes do Estadio',
    bpm: 122,
    roots: [47, 43, 50, 45],
    motif: [7, 12, 14, 10, 7, 3, 0, 3],
  },
  { title: 'Janela Aberta', bpm: 116, roots: [50, 46, 53, 48], motif: [0, 3, 5, 7, 10, 7, 5, 3] },
  {
    title: 'Uma Nova Temporada',
    bpm: 120,
    roots: [48, 55, 57, 53],
    motif: [0, 4, 7, 12, 14, 12, 9, 7],
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
let scheduler: ReturnType<typeof setInterval> | null = null;
let scene: 'menu' | 'match' = 'menu';
let liveCrowd = false;
let beat = 0;
let nextBeat = 0;
let generation = 0;
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

function drums(time: number, count: number) {
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.setValueAtTime(count % 2 ? 170 : 100, time);
  oscillator.frequency.exponentialRampToValueAtTime(35, time + 0.14);
  gain.gain.setValueAtTime(0.17, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
  oscillator.connect(gain).connect(musicBus);
  oscillator.start(time);
  oscillator.stop(time + 0.16);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
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
      noise = context.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 900;
      filter.Q.value = 0.5;
      noise.connect(filter).connect(crowdBus);
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
          tone(musicBus, nextBeat, root + 24 + song.motif[beat % 8], step * 1.4, 0.14);
          if (beat % 4 === 0) {
            tone(musicBus, nextBeat, root - 12, step * 3, 0.26, 'sine');
            for (const interval of [0, state.track % 2 ? 3 : 4, 7])
              tone(musicBus, nextBeat, root + 12 + interval, step * 5, 0.07, 'sine');
          }
          if (beat % 2 === 0) drums(nextBeat, beat);
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
export function mailboxChime() {
  void unlockAudio().then(() => {
    if (!context) return;
    tone(effectsBus, context.currentTime, 76, 0.18, 0.7, 'sine');
    tone(effectsBus, context.currentTime + 0.13, 83, 0.25, 0.5, 'sine');
  });
}
export function crowdGoal() {
  if (!context || !state.crowd) return;
  crowdBus.gain.cancelScheduledValues(context.currentTime);
  crowdBus.gain.setValueAtTime(0.38, context.currentTime);
  crowdBus.gain.setTargetAtTime(liveCrowd ? 0.16 : 0.055, context.currentTime + 1.5, 0.7);
}

export function stopReading() {
  generation++;
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
  mailboxChime();
  patch({ speaking: true });
  levels();
  const token = generation;
  const entries = messages.flatMap((message) => {
    const text = `${message.from}. ${message.title}. ${message.aiText || message.body}`;
    const chunks = text.match(/[^.!?]+[.!?]?/g) || [text];
    return chunks.flatMap((chunk) => {
      const pieces: string[] = [];
      for (let index = 0; index < chunk.length; index += 180)
        pieces.push(chunk.slice(index, index + 180));
      return pieces.map((piece) => ({ id: message.id, text: piece }));
    });
  });
  let index = 0;
  const next = () => {
    if (token !== generation) return;
    if (index >= entries.length) {
      patch({ speaking: false });
      levels();
      return;
    }
    const entry = entries[index++];
    onMessage(entry.id);
    const utterance = new SpeechSynthesisUtterance(entry.text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.05;
    utterance.voice = speechSynthesis.getVoices().find((voice) => voice.lang === 'pt-BR') || null;
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
  next();
}

export function disposeAudio() {
  stopReading();
  if (scheduler) clearInterval(scheduler);
  scheduler = null;
  noise?.stop();
  noise = null;
  if (context) void context.close();
  context = null;
}
