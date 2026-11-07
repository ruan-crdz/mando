import { useEffect, useSyncExternalStore } from 'react';
import { Music2, Volume2 } from 'lucide-react';
import { audioState, setAudioScene, soundtrack, subscribeAudio, unlockAudio } from '../audio/sound';

export function AudioDirector({ inMatch }: { inMatch: boolean }) {
  const state = useSyncExternalStore(subscribeAudio, audioState);
  useEffect(() => {
    setAudioScene(inMatch ? 'match' : 'menu');
  }, [inMatch]);
  useEffect(() => {
    const unlock = () => {
      void unlockAudio();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('mando:audio-unlock', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('mando:audio-unlock', unlock);
    };
  }, []);
  return (
    <>
      {!inMatch && state.music && state.sequence > 0 && (
        <aside key={state.sequence} className="now-playing" role="status">
          <Music2 size={28} />
          <div>
            <small>TOCANDO AGORA</small>
            <strong>{soundtrack[state.track].title}</strong>
            <span>{soundtrack[state.track].artist} · eletrônica original</span>
          </div>
        </aside>
      )}
      {state.error && (
        <div className="audio-error" role="alert">
          <Volume2 size={15} /> {state.error}
        </div>
      )}
    </>
  );
}
