import { useEffect, useRef, useState } from 'react';
import { Trophy } from 'lucide-react';
import { Badge } from './ui';
import { PlayerFace } from './PlayerFace';
import { ControllerButtonHint } from '../controller/ControllerButtonHint';
import { finalBuildup, stopFinalBuildup } from '../audio/sound';
import type { Club, Player } from '../game/types';

type Side = {
  club: Pick<Club, 'name' | 'short' | 'color'> & { id: string };
  players: Player[];
  numbers: Record<string, number>;
};

/** Linha do tempo da cerimônia (segundos). */
const SCENES = [
  { at: 0, scene: 'night' },
  { at: 3.2, scene: 'versus' },
  { at: 6, scene: 'walkout' },
  { at: 10.6, scene: 'whistle' },
] as const;
const DURATION = 11.8;

/**
 * Cerimônia de final: estádio no escuro, o duelo dos escudos e os dois times saindo do túnel
 * lado a lado sob flashes, papel picado e a torcida crescendo, até o apito inicial.
 */
export function FinalIntro({
  competition,
  stage,
  stadium,
  home,
  away,
  onDone,
}: {
  competition: string;
  stage: string;
  stadium: string;
  home: Side;
  away: Side;
  onDone: () => void;
}) {
  const [scene, setScene] = useState<(typeof SCENES)[number]['scene']>('night');
  const skip = useRef<HTMLButtonElement>(null);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    void finalBuildup();
    skip.current?.focus();
    const timers = SCENES.slice(1).map(({ at, scene }) =>
      window.setTimeout(() => setScene(scene), at * 1000),
    );
    timers.push(window.setTimeout(() => done.current(), DURATION * 1000));
    return () => timers.forEach(clearTimeout);
  }, []);
  const finish = () => {
    stopFinalBuildup();
    done.current();
  };
  const confetti = Array.from({ length: 48 }, (_, i) => i);
  const flashes = Array.from({ length: 14 }, (_, i) => i);
  return (
    <div
      className={`final-intro scene-${scene}`}
      role="dialog"
      data-focus-scope="modal"
      aria-label={`${competition} · ${stage}: entrada dos times`}
      style={{ ['--home' as string]: home.club.color, ['--away' as string]: away.club.color }}
    >
      <div className="fi-lights" />
      <div className="fi-smoke" />
      <section className="fi-title">
        <p>{stadium.toUpperCase()}</p>
        <Trophy size={64} className="fi-trophy" />
        <h1>A GRANDE FINAL</h1>
        <h2>
          {competition} · {stage}
        </h2>
      </section>
      <section className="fi-versus">
        <div className="fi-club home">
          <Badge club={home.club} size="large" />
          <strong>{home.club.name}</strong>
        </div>
        <span className="fi-vs">VS</span>
        <div className="fi-club away">
          <Badge club={away.club} size="large" />
          <strong>{away.club.name}</strong>
        </div>
      </section>
      <section className="fi-walkout">
        <div className="fi-tunnel" />
        {[home, away].map((side, s) => (
          <ol key={side.club.id} className={`fi-line ${s ? 'away' : 'home'}`}>
            {side.players.map((p, i) => (
              <li key={p.id} style={{ ['--i' as string]: i }}>
                <PlayerFace player={p} size="sm" />
                <b>{side.numbers[p.id] ?? i + 1}</b>
                <span>{p.name.split(' ').at(-1)}</span>
              </li>
            ))}
          </ol>
        ))}
        {flashes.map((i) => (
          <i
            key={i}
            className="fi-flash"
            style={{
              left: `${(i * 37) % 100}%`,
              top: `${4 + ((i * 23) % 22)}%`,
              animationDelay: `${6.2 + ((i * 0.53) % 4)}s`,
            }}
          />
        ))}
        {confetti.map((i) => (
          <i
            key={i}
            className="fi-confetti"
            style={{
              left: `${(i * 29) % 100}%`,
              background: i % 2 ? home.club.color : away.club.color,
              animationDelay: `${6.4 + ((i * 0.17) % 3)}s`,
              animationDuration: `${2.6 + (i % 5) * 0.4}s`,
            }}
          />
        ))}
      </section>
      <section className="fi-whistle">
        <h1>APITO INICIAL</h1>
      </section>
      <button ref={skip} className="fi-skip" onClick={finish} data-controller-secondary>
        Pular <ControllerButtonHint action="confirm" label="Pular" />
      </button>
    </div>
  );
}
