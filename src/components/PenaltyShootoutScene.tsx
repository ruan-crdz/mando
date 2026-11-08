import { useEffect, useRef, useState } from 'react';
import { Badge } from './ui';
import { PlayerFace } from './PlayerFace';
import { ControllerButtonHint } from '../controller/ControllerButtonHint';
import { useControllerActions, useGamepad } from '../controller/GamepadProvider';
import { penaltyResult, penaltyTension, stopCeremony } from '../audio/sound';
import type { PenaltyShootout } from '../game/competitions';
import type { Club, Player } from '../game/types';

export type ShootoutSide = {
  club: Pick<Club, 'name' | 'short' | 'color'> & { id: string };
  color: string;
  text: string;
  lineup: string[];
  numbers: Record<string, number>;
  players: Record<string, Player | undefined>;
};

type Phase = 'intro' | 'walk' | 'set' | 'shot' | 'result' | 'end';
/** Duração de cada momento da cobrança (ms). */
const TIMING: Record<Exclude<Phase, 'end'>, number> = {
  intro: 2600,
  walk: 1500,
  set: 1900,
  shot: 650,
  result: 1700,
};

const lastName = (name: string) => name.split(' ').at(-1) || name;

/**
 * Disputa de pênaltis encenada: os dois times abraçados no meio-campo, o cobrador caminhando
 * sozinho até a marca, o silêncio antes do chute, o goleiro voando e a torcida reagindo.
 */
export function PenaltyShootoutScene({
  competition,
  home,
  away,
  shootout,
  ownSide,
  final,
  onDone,
}: {
  competition: string;
  home: ShootoutSide;
  away: ShootoutSide;
  shootout: PenaltyShootout;
  ownSide: 'home' | 'away';
  final: boolean;
  onDone: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('intro');
  const [fast, setFast] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const skipButton = useRef<HTMLButtonElement>(null);
  const continueButton = useRef<HTMLButtonElement>(null);
  const done = useRef(onDone);
  done.current = onDone;
  const { rumble } = useGamepad();
  const kick = shootout.kicks[index];
  const sides = { home, away };
  const shooter = kick ? sides[kick.side] : home;
  const defender = kick ? sides[kick.side === 'home' ? 'away' : 'home'] : away;
  const taker = kick ? shooter.players[kick.takerId] : undefined;
  const keeper = kick ? defender.players[kick.keeperId] : undefined;
  const won = shootout.winner === sides[ownSide].club.id;
  const shown = phase === 'result' || phase === 'end' ? index + 1 : index;
  const visible = shootout.kicks.slice(0, shown);
  const score = visible.at(-1) ?? { home: 0, away: 0 };

  useEffect(() => {
    skipButton.current?.focus();
    return () => stopCeremony();
  }, []);
  useEffect(() => {
    if (phase === 'end') {
      if (final) {
        const timer = window.setTimeout(() => done.current(), 3200);
        return () => clearTimeout(timer);
      }
      requestAnimationFrame(() => continueButton.current?.focus());
      return;
    }
    const scale = fast ? 0.4 : 1;
    if (phase === 'set') void penaltyTension((TIMING.set * scale) / 1000);
    if (phase === 'result' && kick) {
      const ours = kick.side === ownSide;
      penaltyResult(kick.scored, ours);
      rumble(kick.scored === ours ? 'goal' : 'concede');
    }
    const timer = window.setTimeout(() => {
      if (phase === 'intro') setPhase('walk');
      else if (phase === 'walk') setPhase('set');
      else if (phase === 'set') setPhase('shot');
      else if (phase === 'shot') setPhase('result');
      else if (index + 1 < shootout.kicks.length) {
        setIndex(index + 1);
        setPhase('walk');
      } else setPhase('end');
    }, TIMING[phase] * scale);
    return () => clearTimeout(timer);
  }, [phase, index, fast, final, kick, ownSide, rumble, shootout.kicks.length]);

  const skip = () => {
    setIndex(shootout.kicks.length - 1);
    setPhase('end');
  };
  useControllerActions(
    phase === 'end' ? {} : { secondary: () => setFast((value) => !value) },
    { secondary: fast ? 'Velocidade normal' : 'Acelerar cobranças' },
    root,
  );

  const caption = (() => {
    if (phase === 'intro') return 'Fim de jogo. A decisão vai para as penalidades.';
    if (!kick) return '';
    const name = taker?.name || `Camisa ${shooter.numbers[kick.takerId] ?? ''}`;
    if (phase === 'walk') return `${name} deixa o meio-campo e caminha sozinho até a marca…`;
    if (phase === 'set')
      return `${name} ajeita a bola. ${keeper ? lastName(keeper.name) : 'O goleiro'} encara. O estádio prende a respiração…`;
    if (phase === 'shot') return 'Correu… bateu!';
    if (kick.scored) return `${name} converte para o ${shooter.club.name}.`;
    if (kick.miss === 'post') return `Na trave! ${name} desperdiça.`;
    if (kick.miss === 'over') return `Por cima do gol! ${name} desperdiça.`;
    return `${keeper?.name || 'O goleiro'} voa e defende!`;
  })();
  const verdict =
    kick && (phase === 'result' || phase === 'end')
      ? kick.scored
        ? 'GOL!'
        : kick.miss === 'post'
          ? 'NA TRAVE!'
          : kick.miss === 'over'
            ? 'PRA FORA!'
            : 'DEFENDEU!'
      : '';
  const good = kick ? kick.scored === (kick.side === ownSide) : true;
  const slots = (side: 'home' | 'away') => {
    const own = shootout.kicks.filter((k) => k.side === side);
    const total = Math.max(5, own.length);
    const taken = visible.filter((k) => k.side === side);
    return Array.from({ length: total }, (_, i) =>
      i < taken.length ? (taken[i].scored ? 'scored' : 'missed') : 'pending',
    );
  };
  const rows = (['home', 'away'] as const).map((side) => ({ side, ids: sides[side].lineup }));
  const ballClass = `ps-ball ${phase === 'shot' || phase === 'result' ? `flight aim-${kick?.aim} ${kick?.miss ?? (kick?.scored ? 'net' : 'saved')}` : ''}`;
  return (
    <div
      ref={root}
      className={`penalty-shootout phase-${phase} ${phase === 'end' ? (won ? 'won' : 'lost') : ''}`}
      role="dialog"
      aria-modal="true"
      data-focus-scope="modal"
      aria-label={`${competition}: disputa de pênaltis`}
      style={{
        ['--shooter' as string]: shooter.color,
        ['--shooter-text' as string]: shooter.text,
        ['--keeper' as string]: defender.color,
        ['--ps-speed' as string]: fast ? 0.4 : 1,
      }}
    >
      <header className="ps-board">
        {(['home', 'away'] as const).map((side) => (
          <div key={side} className={`ps-team ${side}`}>
            <Badge club={sides[side].club} />
            <strong>{sides[side].club.short}</strong>
            <ol aria-label={`Cobranças de ${sides[side].club.name}`}>
              {slots(side).map((state, i) => (
                <li key={i} className={state} />
              ))}
            </ol>
          </div>
        ))}
        <div className="ps-score">
          <small>{competition.toUpperCase()} · PÊNALTIS</small>
          <strong>
            {score.home} <span>×</span> {score.away}
          </strong>
        </div>
      </header>

      <section className="ps-stage">
        <div className="ps-field">
          <div className="ps-box" />
          <div className="ps-small-box" />
          <div className="ps-spot" />
          <div className="ps-arc" />
          <div className="ps-center" />
          <div className="ps-goal">
            <div className="ps-net" />
            <div
              className={`ps-keeper ${phase === 'shot' || phase === 'result' ? `dive-${kick?.dive}` : 'ready'}`}
            >
              <span>{kick ? (defender.numbers[kick.keeperId] ?? 1) : 1}</span>
            </div>
          </div>
          <div className={ballClass} />
          {kick && phase !== 'intro' && phase !== 'end' && (
            <div className={`ps-taker ${phase}`}>
              <span>{shooter.numbers[kick.takerId] ?? ''}</span>
            </div>
          )}
          <div className="ps-line">
            {rows.map(({ side, ids }) => (
              <ol key={side} className={`ps-row ${side}`}>
                {ids.map((id) => {
                  const walking = kick && kick.takerId === id && phase !== 'intro' && phase !== 'end';
                  const team = sides[side];
                  return (
                    <li
                      key={id}
                      className={walking ? 'out' : ''}
                      style={{ background: team.color, color: team.text }}
                    >
                      {team.numbers[id] ?? ''}
                    </li>
                  );
                })}
              </ol>
            ))}
          </div>
        </div>
        <div className="ps-vignette" />
        {verdict && phase === 'result' && (
          <div className={`ps-verdict ${good ? 'good' : 'bad'}`}>{verdict}</div>
        )}
      </section>

      <footer className="ps-caption">
        {kick && phase !== 'intro' && phase !== 'end' && (
          <div className="ps-who">
            {taker && <PlayerFace player={taker} size="sm" />}
            <span>
              <b>{taker?.name || `Camisa ${shooter.numbers[kick.takerId] ?? ''}`}</b>
              <small>
                {shooter.club.name} · cobrança {shootout.kicks.filter((k, i) => i <= index && k.side === kick.side).length}
              </small>
            </span>
          </div>
        )}
        <p>{phase === 'end' ? '' : caption}</p>
        {phase !== 'end' && (
          <div className="ps-actions">
            <button type="button" onClick={() => setFast((value) => !value)}>
              {fast ? 'Velocidade normal' : 'Acelerar'}
              <ControllerButtonHint action="secondary" label="" />
            </button>
            <button ref={skipButton} type="button" onClick={skip}>
              Ver resultado
              <ControllerButtonHint action="confirm" label="" />
            </button>
          </div>
        )}
      </footer>

      {phase === 'end' && (
        <section className={`ps-end ${won ? 'won' : 'lost'}`}>
          {won &&
            Array.from({ length: 40 }, (_, i) => (
              <i
                key={i}
                className="ps-confetti"
                style={{
                  left: `${(i * 31) % 100}%`,
                  background: i % 2 ? sides[ownSide].color : '#f3c64f',
                  animationDelay: `${(i * 0.09) % 2}s`,
                }}
              />
            ))}
          {!won && Array.from({ length: 50 }, (_, i) => <i key={i} className="ps-rain" style={{ left: `${(i * 17) % 100}%`, animationDelay: `${(i * 0.13) % 1.6}s` }} />)}
          <h1>{won ? (final ? 'É CAMPEÃO!' : 'CLASSIFICADO!') : final ? 'VICE…' : 'ELIMINADO'}</h1>
          <p>
            {shootout.home} × {shootout.away} nos pênaltis ·{' '}
            {won
              ? `o ${sides[ownSide].club.name} venceu nos detalhes. Que frieza!`
              : 'a marca da cal foi cruel. O vestiário fica em silêncio.'}
          </p>
          {!final && (
            <button ref={continueButton} className="primary" type="button" onClick={() => done.current()}>
              Continuar <ControllerButtonHint action="confirm" label="" />
            </button>
          )}
        </section>
      )}
    </div>
  );
}
