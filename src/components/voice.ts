import { useSyncExternalStore } from 'react';
import { type VoiceRole } from '../services/supabase';

export type { VoiceRole };
export type VoiceItem = { id: string; title: string; text: string; voice?: VoiceRole };
export type VoiceState = {
  current: VoiceItem | null;
  position: number;
  total: number;
  /** Fila de várias mensagens (caixa postal) ou uma mensagem avulsa. */
  mailbox: boolean;
  /** Gerando o áudio da fala atual. */
  loading: boolean;
};

/** Deixa o texto pronto para ser falado: "São Paulo x Palmeiras" vira "contra", placar vira "a". */
export function speakable(text: string) {
  return text
    .replace(/(\d+)\s*[xX×]\s*(\d+)/g, '$1 a $2')
    .replace(/\s[xX×]\s/g, ' contra ')
    .replace(/R\$\s?([\d.,]+)\s?mi\b/gi, '$1 milhões de reais')
    .replace(/R\$\s?([\d.,]+)\s?bi\b/gi, '$1 bilhões de reais')
    .replace(/R\$\s?([\d.,]+)\s?mil\b/gi, '$1 mil reais')
    .replace(/\bOVR\b/g, 'overall')
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1500);
}

const maleHints = /antonio|daniel|fabio|humberto|julio|donato|nicolau|valerio|male|masculin/i;
const femaleHints =
  /francisca|maria|luciana|thalita|leila|brenda|elza|giovanna|manuela|yara|female|feminin/i;

function pickVoice() {
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('pt'));
  const br = voices.filter((v) => /br/i.test(v.lang));
  const pool = br.length ? br : voices;
  return (
    pool.find(
      (v) => maleHints.test(v.name) && !femaleHints.test(v.name) && /natural|online/i.test(v.name),
    ) ||
    pool.find((v) => maleHints.test(v.name) && !femaleHints.test(v.name)) ||
    pool.find((v) => /natural|online|google/i.test(v.name)) ||
    pool[0]
  );
}

export const speechAvailable = () => typeof window !== 'undefined' && 'speechSynthesis' in window;
export const voiceAvailable = () => speechAvailable();

/**
 * Reprodutor global de mensagens: continua tocando ao trocar de aba ou avançar
 * o dia, até acabar a fila ou o jogador apertar "Parar".
 */
let queue: VoiceItem[] = [];
let index = -1;
let mailbox = false;
let loading = false;
let token = 0;
// Mantém a referência viva: o Chrome descarta utterances sem referência e o onend some.
const utterances = new Set<SpeechSynthesisUtterance>();
let state: VoiceState = { current: null, position: 0, total: 0, mailbox: false, loading: false };
const listeners = new Set<() => void>();

function emit() {
  state = {
    current: index >= 0 ? (queue[index] ?? null) : null,
    position: index + 1,
    total: queue.length,
    mailbox,
    loading,
  };
  listeners.forEach((l) => l());
}

let fx: AudioContext | null = null;
let hiss: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
function audioCtx() {
  if (typeof window === 'undefined' || !window.AudioContext) return null;
  fx ??= new AudioContext();
  if (fx.state === 'suspended') void fx.resume();
  return fx;
}
/** Clique de telefone ao começar cada recado. */
function phoneClick() {
  const c = audioCtx();
  if (!c) return;
  const t = c.currentTime;
  for (const [at, peak] of [
    [0, 0.5],
    [0.07, 0.28],
  ]) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(1800, t + at);
    o.frequency.exponentialRampToValueAtTime(300, t + at + 0.03);
    g.gain.setValueAtTime(peak, t + at);
    g.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.04);
    o.connect(g).connect(c.destination);
    o.start(t + at);
    o.stop(t + at + 0.05);
  }
}
/** Chiado baixo de linha telefônica enquanto o recado toca. */
function lineOn() {
  const c = audioCtx();
  if (!c || hiss) return;
  const buffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 1700;
  band.Q.value = 0.9;
  const gain = c.createGain();
  gain.gain.value = 0;
  gain.gain.setTargetAtTime(0.018, c.currentTime, 0.1);
  src.connect(band).connect(gain).connect(c.destination);
  src.start();
  hiss = { src, gain };
}
function lineOff() {
  if (!hiss || !fx) return;
  const { src, gain } = hiss;
  hiss = null;
  gain.gain.setTargetAtTime(0, fx.currentTime, 0.08);
  setTimeout(() => src.stop(), 400);
}

function advance(from: number) {
  if (from !== token) return;
  index += 1;
  if (index >= queue.length) stopVoice();
  else {
    emit();
    // Pequena pausa entre recados, como numa secretária eletrônica.
    setTimeout(() => from === token && speakCurrent(), 450);
  }
}

function speakSystem(item: VoiceItem, current: number) {
  if (!speechAvailable()) {
    advance(current);
    return;
  }
  const u = new SpeechSynthesisUtterance(speakable(item.text));
  const voice = pickVoice();
  if (voice) u.voice = voice;
  u.lang = voice?.lang || 'pt-BR';
  u.pitch = 0.85;
  u.rate = 1;
  u.onend = () => advance(current);
  u.onerror = (e) => {
    if (e.error === 'interrupted' || e.error === 'canceled') return;
    advance(current);
  };
  utterances.clear();
  utterances.add(u);
  speechSynthesis.speak(u);
}

function speakCurrent() {
  const item = queue[index];
  if (!item) {
    stopVoice();
    return;
  }
  const current = ++token;
  phoneClick();
  lineOn();
  // O clique do telefone vem antes da fala, como numa secretária eletrônica.
  setTimeout(() => current === token && speakSystem(item, current), 260);
}

function silence() {
  token += 1;
  utterances.clear();
  loading = false;
  lineOff();
  if (speechAvailable()) speechSynthesis.cancel();
}

export function playVoice(items: VoiceItem[], asMailbox = items.length > 1) {
  if (!speechAvailable() || !items.length) return;
  silence();
  queue = items;
  index = 0;
  mailbox = asMailbox;
  emit();
  speakCurrent();
}

export function stopVoice() {
  silence();
  queue = [];
  index = -1;
  mailbox = false;
  emit();
}

export function skipVoice() {
  if (index < 0) return;
  silence();
  index += 1;
  if (index >= queue.length) stopVoice();
  else {
    emit();
    speakCurrent();
  }
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const voiceState = () => state;
export const subscribeVoice = subscribe;
export const useVoice = () => useSyncExternalStore(subscribe, voiceState, voiceState);

if (speechAvailable()) speechSynthesis.getVoices();
