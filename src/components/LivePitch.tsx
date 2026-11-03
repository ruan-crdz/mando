import { useEffect, useMemo, useRef, useState } from 'react';
import { horizontalCoordinates } from '../game/pitch';
import { type Formation } from '../game/types';

type Side = 0 | 1;
export type PitchTeam = {
  formation: Formation;
  color: string;
  ids: string[];
  numbers: Record<string, number>;
  names: Record<string, string>;
};

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, (a.y - b.y) * 0.62);

/**
 * Simulação visual 2D: as bolinhas trocam passes conforme a posse do jogo.
 * É apenas ilustrativa; o resultado vem da engine.
 */
export function LivePitch({
  home,
  away,
  playing,
  speed,
  homePossession,
  goal,
}: {
  home: PitchTeam;
  away: PitchTeam;
  playing: boolean;
  speed: number;
  homePossession: number;
  /** Lado que acabou de marcar, para levar a bola até a rede. */
  goal: { side: Side; key: string } | null;
}) {
  const bases = useMemo(
    () => [horizontalCoordinates(home.formation, false), horizontalCoordinates(away.formation, true)],
    [home.formation, away.formation],
  );
  const [ball, setBall] = useState<{ side: Side; index: number; x: number; y: number; tick: number; free?: boolean }>({
    side: 0,
    index: 10,
    x: 50,
    y: 50,
    tick: 0,
    free: true,
  });
  const possession = useRef(homePossession);
  possession.current = homePossession;
  const lastGoal = useRef<string | null>(goal?.key ?? null);

  // Posição de cada atleta: a base da formação deslocada em bloco na direção da bola.
  const spot = (side: Side, index: number, b = ball) => {
    const base = bases[side][index] || { x: 50, y: 50 };
    if (index === 0) return { x: base.x, y: base.y + (b.y - 50) * 0.12 };
    const attacking = b.side === side;
    const push = attacking ? (side === 0 ? 7 : -7) : side === 0 ? -4 : 4;
    const wobble = Math.sin(b.tick * 0.9 + index * 1.7) * 1.4;
    return {
      x: Math.min(97, Math.max(3, base.x + (b.x - 50) * 0.22 + push + wobble)),
      y: Math.min(95, Math.max(5, base.y + (b.y - base.y) * 0.16 + Math.cos(b.tick + index) * 1.6)),
    };
  };

  useEffect(() => {
    if (!goal || goal.key === lastGoal.current) return;
    lastGoal.current = goal.key;
    const opponentGoalX = goal.side === 0 ? 99 : 1;
    setBall((b) => ({ side: goal.side, index: b.index, x: opponentGoalX, y: 50, tick: b.tick + 1, free: true }));
    const restart = setTimeout(
      () => setBall((b) => ({ side: goal.side === 0 ? 1 : 0, index: 10, x: 50, y: 50, tick: b.tick + 1, free: true })),
      1300,
    );
    return () => clearTimeout(restart);
  }, [goal]);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setBall((b) => {
        const side = b.side;
        const team = bases[side];
        const forward = (p: { x: number }) => (side === 0 ? p.x : 100 - p.x);
        const holder = spot(side, b.index, b);
        const share = side === 0 ? possession.current : 100 - possession.current;
        // Perde a bola com mais frequência quem tem menos posse.
        if (Math.random() < 0.1 + (50 - share) / 400 + (forward(holder) > 78 ? 0.25 : 0)) {
          const other: Side = side === 0 ? 1 : 0;
          const shot = forward(holder) > 78;
          const target = shot
            ? 0
            : bases[other]
                .map((_, i) => i)
                .filter((i) => i > 0)
                .sort((i, j) => dist(spot(other, i, b), holder) - dist(spot(other, j, b), holder))[0];
          const p = spot(other, target, b);
          return { side: other, index: target, x: p.x, y: p.y, tick: b.tick + 1 };
        }
        const options = team
          .map((_, i) => i)
          .filter((i) => i !== b.index && i > 0)
          .map((i) => ({ i, p: spot(side, i, b) }))
          .filter(({ p }) => dist(p, holder) < 46)
          .sort(
            (a, c) =>
              forward(c.p) - forward(a.p) + (Math.random() - 0.5) * 34,
          );
        const next = options[0] || { i: b.index, p: holder };
        return { side, index: next.i, x: next.p.x, y: next.p.y, tick: b.tick + 1 };
      });
    }, 900 / speed);
    return () => clearInterval(timer);
    // spot depende apenas de bases, já listada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, bases]);

  const teams = [home, away];
  const holderSpot = spot(ball.side, ball.index);
  const ballSpot = ball.free
    ? ball
    : { x: holderSpot.x + (ball.side === 0 ? 1.6 : -1.6), y: holderSpot.y + 2.2 };
  return (
    <div
      className={`live-field ${playing ? 'live' : ''}`}
      role="img"
      aria-label="Simulação 2D ilustrativa da partida; os lances oficiais aparecem na narração"
      style={{ ['--sim-speed' as string]: `${0.9 / speed}s` }}
    >
      <div className="field-half" />
      <div className="field-circle" />
      <div className="field-box left" />
      <div className="field-box right" />
      <div className="field-small left" />
      <div className="field-small right" />
      <div className="field-goal left" />
      <div className="field-goal right" />
      {teams.flatMap((team, side) =>
        team.ids.map((id, i) => {
          const p = spot(side as Side, i);
          const hasBall = ball.side === side && ball.index === i;
          return (
            <span
              className={`field-dot ${side ? 'away' : 'home'} ${i === 0 ? 'keeper' : ''} ${hasBall ? 'with-ball' : ''}`}
              key={id}
              title={team.names[id]}
              style={{ left: `${p.x}%`, top: `${p.y}%`, ['--dot' as string]: team.color }}
            >
              {team.numbers[id] ?? i + 1}
            </span>
          );
        }),
      )}
      <span className="ball-dot" style={{ left: `${ballSpot.x}%`, top: `${ballSpot.y}%` }} />
    </div>
  );
}
