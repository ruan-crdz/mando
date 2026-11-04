import { useSyncExternalStore } from 'react';

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

export type VoiceItem = { id: string; title: string; text: string };
export type VoiceState = {
  current: VoiceItem | null;
  position: number;
  total: number;
  /** Fila de várias mensagens (caixa postal) ou uma mensagem avulsa. */
  mailbox: boolean;
};

/**
 * Reprodutor global de mensagens: continua tocando ao trocar de aba ou avançar
 * o dia, até acabar a fila ou o jogador apertar "Parar".
 */
let queue: VoiceItem[] = [];
let index = -1;
let mailbox = false;
// Mantém a referência viva: o Chrome descarta utterances sem referência e o onend some.
let utterance: SpeechSynthesisUtterance | null = null;
let state: VoiceState = { current: null, position: 0, total: 0, mailbox: false };
const listeners = new Set<() => void>();

function emit() {
  state = {
    current: index >= 0 ? (queue[index] ?? null) : null,
    position: index + 1,
    total: queue.length,
    mailbox,
  };
  listeners.forEach((l) => l());
}

function speakCurrent() {
  const item = queue[index];
  if (!item) {
    stopVoice();
    return;
  }
  const u = new SpeechSynthesisUtterance(item.text);
  const voice = pickVoice();
  if (voice) u.voice = voice;
  u.lang = voice?.lang || 'pt-BR';
  // Tom mais grave e pausado, como um dirigente em pronunciamento.
  u.pitch = 0.78;
  u.rate = 0.96;
  const next = () => {
    if (utterance !== u) return;
    index += 1;
    if (index >= queue.length) stopVoice();
    else {
      emit();
      // Pequena pausa entre recados, como numa secretária eletrônica.
      setTimeout(() => utterance === u && speakCurrent(), 450);
    }
  };
  u.onend = next;
  u.onerror = (e) => {
    if (e.error === 'interrupted' || e.error === 'canceled') return;
    next();
  };
  utterance = u;
  speechSynthesis.speak(u);
}

export function playVoice(items: VoiceItem[], asMailbox = items.length > 1) {
  if (!speechAvailable() || !items.length) return;
  speechSynthesis.cancel();
  queue = items;
  index = 0;
  mailbox = asMailbox;
  emit();
  speakCurrent();
}

export function stopVoice() {
  utterance = null;
  queue = [];
  index = -1;
  mailbox = false;
  if (speechAvailable()) speechSynthesis.cancel();
  emit();
}

export function skipVoice() {
  if (index < 0) return;
  utterance = null;
  speechSynthesis.cancel();
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
