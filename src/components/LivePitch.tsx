import { useEffect, useMemo, useRef } from 'react';
import { horizontalCoordinates } from '../game/pitch';
import { type Formation } from '../game/types';

type Side = 0 | 1;
type Pt = { x: number; y: number };
export type PitchTeam = {
  formation: Formation;
  color: string;
  ids: string[];
  numbers: Record<string, number>;
  names: Record<string, string>;
};

type Ball = {
  phase: 'held' | 'pass' | 'shot' | 'reset';
  /** Time com a posse (ou destino do passe). */
  side: Side;
  index: number;
  pos: Pt;
  from: Pt;
  to: Pt;
  t: number;
  dur: number;
  /** Segundos com a bola no pé. */
  held: number;
  hold: number;
  /** Depois de um chute defendido, a bola fica com o goleiro adversário. */
  then?: { side: Side; index: number };
};

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, (a.y - b.y) * 0.62);
const clampX = (v: number) => Math.min(98, Math.max(2, v));
const clampY = (v: number) => Math.min(95, Math.max(5, v));
const ease = (t: number) => 1 - (1 - t) * (1 - t);

/**
 * Simulação visual 2D contínua: atletas correm com inércia, a bola viaja no passe,
 * quem tem a posse conduz e o marcador mais próximo pressiona. Ilustrativa — o
 * resultado oficial vem da engine.
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
    () => [
      horizontalCoordinates(home.formation, false),
      horizontalCoordinates(away.formation, true),
    ],
    [home.formation, away.formation],
  );
  const counts = [home.ids.length, away.ids.length];
  const dots = useRef<(HTMLSpanElement | null)[][]>([[], []]);
  const ballEl = useRef<HTMLSpanElement>(null);
  const live = useRef({ playing, speed, possession: homePossession, counts, bases });
  live.current = { playing, speed, possession: homePossession, counts, bases };
  const sim = useRef<{ pos: Pt[][]; ball: Ball; time: number; holder: string } | null>(null);
  if (!sim.current)
    sim.current = {
      pos: bases.map((team) => team.map((p) => ({ ...p }))),
      ball: {
        phase: 'held',
        side: 0,
        index: Math.min(10, counts[0] - 1),
        pos: { x: 50, y: 50 },
        from: { x: 50, y: 50 },
        to: { x: 50, y: 50 },
        t: 0,
        dur: 0,
        held: 0,
        hold: 0.8,
      },
      time: 0,
      holder: '',
    };
  const lastGoal = useRef<string | null>(goal?.key ?? null);

  useEffect(() => {
    const s = sim.current!;
    s.pos = bases.map((team, side) => team.map((p, i) => s.pos[side]?.[i] ?? { ...p }));
  }, [bases]);

  useEffect(() => {
    if (!goal || goal.key === lastGoal.current) return;
    lastGoal.current = goal.key;
    const b = sim.current!.ball;
    const net = { x: goal.side === 0 ? 100.5 : -0.5, y: 47 + Math.random() * 6 };
    Object.assign(b, {
      phase: 'shot',
      from: { ...b.pos },
      to: net,
      t: 0,
      dur: 0.45,
      then: undefined,
    });
  }, [goal]);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const forward = (side: Side, p: Pt) => (side === 0 ? p.x : 100 - p.x);
    const pickHold = () => 0.45 + Math.random() * 0.9;

    const target = (side: Side, i: number, s: NonNullable<typeof sim.current>): Pt => {
      const { bases } = live.current;
      const base = bases[side][i] || { x: 50, y: 50 };
      const b = s.ball;
      if (i === 0) return { x: base.x, y: 50 + (b.pos.y - 50) * 0.18 };
      if (b.phase === 'reset') return base;
      if (b.phase === 'held' && b.side === side && b.index === i) {
        const dir = side === 0 ? 1 : -1;
        const run = Math.min(10, b.held * 6);
        return { x: clampX(s.pos[side][i].x + dir * run * 0.4), y: s.pos[side][i].y };
      }
      if (b.phase === 'pass' && b.side === side && b.index === i) return b.to;
      const attacking = b.side === side;
      const push = attacking ? (side === 0 ? 8 : -8) : side === 0 ? -5 : 5;
      const t = s.time;
      return {
        x: clampX(base.x + (b.pos.x - 50) * 0.26 + push + Math.sin(t * 0.7 + i * 1.7) * 1.6),
        y: clampY(base.y + (b.pos.y - base.y) * 0.18 + Math.cos(t * 0.55 + i * 2.3) * 1.8),
      };
    };

    const decide = (s: NonNullable<typeof sim.current>) => {
      const b = s.ball;
      const { possession, counts } = live.current;
      const side = b.side;
      const other: Side = side === 0 ? 1 : 0;
      const holder = s.pos[side][b.index];
      const share = side === 0 ? possession : 100 - possession;
      const deep = forward(side, holder) > 76;
      if (deep && Math.random() < 0.45) {
        // Finalização: a bola vai ao gol e fica com o goleiro.
        const mouth = { x: side === 0 ? 98.5 : 1.5, y: 44 + Math.random() * 12 };
        Object.assign(b, {
          phase: 'shot',
          from: { ...b.pos },
          to: mouth,
          t: 0,
          dur: dist(b.pos, mouth) / 95 + 0.12,
          then: { side: other, index: 0 },
        });
        return;
      }
      const mates = Array.from({ length: counts[side] }, (_, i) => i)
        .filter((i) => i !== b.index && i > 0)
        .map((i) => ({ i, p: s.pos[side][i] }))
        .filter(({ p }) => dist(p, holder) < 42 && dist(p, holder) > 6)
        .sort((a, c) => forward(side, c.p) - forward(side, a.p) + (Math.random() - 0.5) * 36);
      const mate = mates[0];
      if (!mate) {
        b.hold += 0.4;
        return;
      }
      const lead = { x: clampX(mate.p.x + (side === 0 ? 3 : -3)), y: mate.p.y };
      const lose = Math.random() < 0.12 + (50 - share) / 380;
      let receiver = { side, index: mate.i };
      let to = lead;
      if (lose) {
        // Interceptação: o adversário mais próximo da linha do passe fica com a bola.
        const mid = { x: (holder.x + lead.x) / 2, y: (holder.y + lead.y) / 2 };
        const thief = Array.from({ length: counts[other] }, (_, i) => i)
          .filter((i) => i > 0)
          .sort((i, j) => dist(s.pos[other][i], mid) - dist(s.pos[other][j], mid))[0];
        if (thief !== undefined) {
          receiver = { side: other, index: thief };
          to = { x: (mid.x + s.pos[other][thief].x) / 2, y: (mid.y + s.pos[other][thief].y) / 2 };
        }
      }
      Object.assign(b, {
        phase: 'pass',
        side: receiver.side,
        index: receiver.index,
        from: { ...b.pos },
        to,
        t: 0,
        dur: dist(b.pos, to) / 62 + 0.18,
      });
    };

    const step = (s: NonNullable<typeof sim.current>, dt: number) => {
      s.time += dt;
      const b = s.ball;
      const { counts } = live.current;
      // Movimento com inércia e velocidade máxima.
      for (const side of [0, 1] as Side[]) {
        for (let i = 0; i < counts[side]; i++) {
          const p = s.pos[side][i];
          if (!p) continue;
          let goal = target(side, i, s);
          const defending = b.side !== side && b.phase !== 'reset';
          if (defending && i > 0) {
            // O marcador mais próximo pressiona o portador.
            const nearest = Array.from({ length: counts[side] }, (_, j) => j)
              .filter((j) => j > 0)
              .sort((j, k) => dist(s.pos[side][j], b.pos) - dist(s.pos[side][k], b.pos))[0];
            if (nearest === i)
              goal = { x: (goal.x + b.pos.x * 2) / 3, y: (goal.y + b.pos.y * 2) / 3 };
          }
          const dx = goal.x - p.x;
          const dy = goal.y - p.y;
          const want = 1 - Math.exp(-dt * 2.6);
          const len = Math.hypot(dx, dy) * want;
          const max = 16 * dt;
          const k = len > max ? max / len : 1;
          p.x += dx * want * k;
          p.y += dy * want * k;
        }
      }
      if (b.phase === 'held') {
        const p = s.pos[b.side][b.index] || b.pos;
        b.pos = { x: p.x + (b.side === 0 ? 1.4 : -1.4), y: p.y + 1.6 };
        b.held += dt;
        if (b.held >= b.hold) decide(s);
      } else {
        b.t += dt;
        const k = Math.min(1, b.t / b.dur);
        const e = b.phase === 'shot' ? k : ease(k);
        b.pos = { x: b.from.x + (b.to.x - b.from.x) * e, y: b.from.y + (b.to.y - b.from.y) * e };
        if (k >= 1) {
          if (b.phase === 'pass') Object.assign(b, { phase: 'held', held: 0, hold: pickHold() });
          else if (b.phase === 'shot' && b.then) {
            const keeper = s.pos[b.then.side][0];
            Object.assign(b, {
              phase: 'pass',
              side: b.then.side,
              index: 0,
              from: { ...b.pos },
              to: { ...keeper },
              t: 0,
              dur: 0.25,
              then: undefined,
            });
          } else if (b.phase === 'shot') {
            // Gol: espera na rede e recomeça no meio-campo com quem sofreu.
            const conceded: Side = b.to.x > 50 ? 1 : 0;
            Object.assign(b, {
              phase: 'reset',
              side: conceded,
              t: 0,
              dur: 1.1,
              from: { ...b.pos },
              to: { ...b.pos },
            });
          } else {
            const kicker = Math.min(10, counts[b.side] - 1);
            Object.assign(b, {
              phase: 'held',
              index: kicker,
              held: 0,
              hold: 0.9,
              pos: { x: 50, y: 50 },
            });
            const p = s.pos[b.side][kicker];
            if (p) Object.assign(p, { x: b.side === 0 ? 48 : 52, y: 50 });
          }
        }
      }
    };

    const render = (s: NonNullable<typeof sim.current>) => {
      for (const side of [0, 1] as Side[])
        dots.current[side].forEach((el, i) => {
          const p = s.pos[side][i];
          if (!el || !p) return;
          el.style.left = `${p.x}%`;
          el.style.top = `${p.y}%`;
        });
      const holder = s.ball.phase === 'held' ? `${s.ball.side}:${s.ball.index}` : '';
      if (holder !== s.holder) {
        const [os, oi] = s.holder.split(':').map(Number);
        if (s.holder) dots.current[os]?.[oi]?.classList.remove('with-ball');
        if (holder) dots.current[s.ball.side]?.[s.ball.index]?.classList.add('with-ball');
        s.holder = holder;
      }
      if (ballEl.current) {
        ballEl.current.style.left = `${s.ball.pos.x}%`;
        ballEl.current.style.top = `${s.ball.pos.y}%`;
      }
    };

    const loop = (now: number) => {
      const s = sim.current!;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (live.current.playing) step(s, dt * Math.max(0.5, Math.min(3, live.current.speed)));
      render(s);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  const teams = [home, away];
  return (
    <div
      className={`live-field ${playing ? 'live' : ''}`}
      role="img"
      aria-label="Simulação 2D ilustrativa da partida; os lances oficiais aparecem na narração"
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
          const p = sim.current!.pos[side]?.[i] || bases[side][i] || { x: 50, y: 50 };
          return (
            <span
              className={`field-dot ${side ? 'away' : 'home'} ${i === 0 ? 'keeper' : ''}`}
              key={id}
              ref={(el) => {
                dots.current[side][i] = el;
              }}
              title={team.names[id]}
              style={{ left: `${p.x}%`, top: `${p.y}%`, ['--dot' as string]: team.color }}
            >
              {team.numbers[id] ?? i + 1}
            </span>
          );
        }),
      )}
      <span className="ball-dot" ref={ballEl} style={{ left: '50%', top: '50%' }} />
    </div>
  );
}
