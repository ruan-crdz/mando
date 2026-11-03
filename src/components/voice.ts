import { useEffect, useState } from 'react';

const maleHints = /antonio|daniel|fabio|humberto|julio|donato|nicolau|valerio|male|masculin/i;
const femaleHints = /francisca|maria|luciana|thalita|leila|brenda|elza|giovanna|manuela|yara|female|feminin/i;

function pickVoice() {
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('pt'));
  const br = voices.filter((v) => /br/i.test(v.lang));
  const pool = br.length ? br : voices;
  return (
    pool.find((v) => maleHints.test(v.name) && !femaleHints.test(v.name) && /natural|online/i.test(v.name)) ||
    pool.find((v) => maleHints.test(v.name) && !femaleHints.test(v.name)) ||
    pool.find((v) => /natural|online|google/i.test(v.name)) ||
    pool[0]
  );
}

export const speechAvailable = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function useSpeech() {
  const [speaking, setSpeaking] = useState<string | null>(null);
  useEffect(() => {
    if (!speechAvailable()) return;
    speechSynthesis.getVoices();
    return () => speechSynthesis.cancel();
  }, []);
  const stop = () => {
    if (speechAvailable()) speechSynthesis.cancel();
    setSpeaking(null);
  };
  const speak = (id: string, text: string) => {
    if (!speechAvailable()) return;
    speechSynthesis.cancel();
    if (speaking === id) return setSpeaking(null);
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang || 'pt-BR';
    // Tom mais grave e pausado, como um dirigente em pronunciamento.
    utterance.pitch = 0.78;
    utterance.rate = 0.96;
    utterance.onend = () => setSpeaking((s) => (s === id ? null : s));
    utterance.onerror = () => setSpeaking((s) => (s === id ? null : s));
    setSpeaking(id);
    speechSynthesis.speak(utterance);
  };
  return { speaking, speak, stop };
}
