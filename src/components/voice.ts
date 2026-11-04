import { useSyncExternalStore } from 'react';
import { requestVoice, supabase, type VoiceRole } from '../services/supabase';

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
const aiAvailable = () => Boolean(supabase) && typeof Audio !== 'undefined';
export const voiceAvailable = () => speechAvailable() || aiAvailable();
// Se a voz de IA falhar (sem créditos, offline), usa a voz do sistema por um tempo.
let aiPausedUntil = 0;

/**
 * Reprodutor global de mensagens: continua tocando ao trocar de aba ou avançar
 * o dia, até acabar a fila ou o jogador apertar "Parar".
 */
let queue: VoiceItem[] = [];
let index = -1;
let mailbox = false;
let loading = false;
let token = 0;
let audio: HTMLAudioElement | null = null;
// Mantém a referência viva: o Chrome descarta utterances sem referência e o onend some.
const utterances = new Set<SpeechSynthesisUtterance>();
let state: VoiceState = { current: null, position: 0, total: 0, mailbox: false, loading: false };
const listeners = new Set<() => void>();
const pending = new Map<string, Promise<Blob>>();

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

async function cacheKey(item: VoiceItem) {
  const bytes = new TextEncoder().encode(`${item.voice || 'president'}|${speakable(item.text)}`);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `https://voice.mando.local/${hex}.mp3`;
}

/** Cada fala é gerada uma única vez e fica guardada no navegador. */
async function voiceAudio(item: VoiceItem): Promise<Blob> {
  const key = await cacheKey(item);
  const running = pending.get(key);
  if (running) return running;
  const job = (async () => {
    const store = 'caches' in window ? await caches.open('mando-voice').catch(() => null) : null;
    const hit = await store?.match(key);
    if (hit) return hit.blob();
    const blob = await requestVoice(speakable(item.text), item.voice || 'president');
    await store
      ?.put(key, new Response(blob, { headers: { 'Content-Type': 'audio/mpeg' } }))
      .catch(() => undefined);
    return blob;
  })();
  pending.set(key, job);
  job.then(
    () => pending.delete(key),
    () => pending.delete(key),
  );
  return job;
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
  if (!aiAvailable() || Date.now() < aiPausedUntil || !navigator.onLine) {
    speakSystem(item, current);
    return;
  }
  loading = true;
  emit();
  void voiceAudio(item)
    .then((blob) => {
      if (current !== token) return;
      loading = false;
      emit();
      const url = URL.createObjectURL(blob);
      const player = new Audio(url);
      audio = player;
      const done = () => {
        URL.revokeObjectURL(url);
        if (audio === player) audio = null;
        advance(current);
      };
      player.onended = done;
      player.onerror = done;
      // Já prepara o próximo recado enquanto este toca.
      const next = queue[index + 1];
      if (next) void voiceAudio(next).catch(() => undefined);
      return player.play();
    })
    .catch(() => {
      if (current !== token) return;
      aiPausedUntil = Date.now() + 5 * 60_000;
      loading = false;
      emit();
      speakSystem(item, current);
    });
}

function silence() {
  token += 1;
  utterances.clear();
  loading = false;
  if (audio) {
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio = null;
  }
  if (speechAvailable()) speechSynthesis.cancel();
}

export function playVoice(items: VoiceItem[], asMailbox = items.length > 1) {
  if ((!speechAvailable() && !aiAvailable()) || !items.length) return;
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
