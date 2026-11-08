import { useEffect, useMemo, useRef } from 'react';
import { horizontalCoordinates } from '../game/pitch';
import { type Formation } from '../game/types';

type Side = 0 | 1;
type Pt = { x: number; y: number };
export type PitchTeam = {
  formation: Formation;
  color: string;
  text?: string;
  ids: string[];
  numbers: Record<string, number>;
  names: Record<string, string>;
  dismissed?: string[];
};

export type PitchShot = {
  side: Side;
  key: string;
  type: 'goal' | 'save' | 'miss';
  playerId?: string;
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
  /** Finalização oficial pendente: a bola chega ao finalizador na área e ele chuta. */
  shoot?: PitchShot['type'];
  /** Depois de um chute defendido ou para fora, a bola fica com o goleiro adversário. */
  then?: { side: Side; index: number };
};

type Sim = { pos: Pt[][]; ball: Ball; time: number; holder: string; flipped: boolean };

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, (a.y - b.y) * 0.62);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const ease = (t: number) => 1 - (1 - t) * (1 - t);

/**
 * Simulação visual 2D contínua. Cada time joga em bloco: sobe as linhas quando tem a bola,
 * recua e fecha o meio quando defende, o marcador mais próximo pressiona e outro cobre.
 * A bola progride por passes escolhidos pela linha de passe livre; finalizações só
 * acontecem quando a engine registra uma, depois de a jogada chegar à área.
 * No segundo tempo os lados se invertem. Ilustrativa — o resultado oficial vem da engine.
 */
export function LivePitch({
  home,
  away,
  playing,
  speed,
  homePossession,
  shot,
  secondHalf = false,
}: {
  home: PitchTeam;
  away: PitchTeam;
  playing: boolean;
  speed: number;
  homePossession: number;
  /** Finalização oficial da engine, animada com o desfecho correspondente. */
  shot: PitchShot | null;
  secondHalf?: boolean;
}) {
  // Coordenadas relativas: x = profundidade a partir do próprio gol (4–48), y = faixa lateral.
  const shapes = useMemo(
    () => [
      horizontalCoordinates(home.formation, false),
      horizontalCoordinates(away.formation, false),
    ],
    [home.formation, away.formation],
  );
  const counts = [home.ids.length, away.ids.length];
  const active = [home, away].map((team) =>
    team.ids.flatMap((id, index) => (team.dismissed?.includes(id) ? [] : [index])),
  );
  const dots = useRef<(HTMLSpanElement | null)[][]>([[], []]);
  const ballEl = useRef<HTMLSpanElement>(null);
  const live = useRef({
    playing,
    speed,
    possession: homePossession,
    counts,
    shapes,
    active,
    flipped: secondHalf,
  });
  live.current = {
    playing,
    speed,
    possession: homePossession,
    counts,
    shapes,
    active,
    flipped: secondHalf,
  };

  /** Converte entre coordenadas do time (atacando para a direita) e do campo. */
  const flip = (side: Side, p: Pt, flipped: boolean): Pt =>
    (side === 0) !== flipped ? p : { x: 100 - p.x, y: 100 - p.y };
  const kickoff = (side: Side, i: number, flipped: boolean): Pt => {
    const base = live.current.shapes[side][i] || { x: 30, y: 50 };
    return flip(side, { x: Math.min(46, base.x), y: base.y }, flipped);
  };

  const sim = useRef<Sim | null>(null);
  if (!sim.current) {
    const kicker = Math.min(10, counts[0] - 1);
    sim.current = {
      pos: [0, 1].map((side) =>
        shapes[side].map((_, i) => kickoff(side as Side, i, secondHalf)),
      ),
      ball: {
        phase: 'held',
        side: 0,
        index: kicker,
        pos: { x: 50, y: 50 },
        from: { x: 50, y: 50 },
        to: { x: 50, y: 50 },
        t: 0,
        dur: 0,
        held: 0,
        hold: 0.9,
      },
      time: 0,
      holder: '',
      flipped: secondHalf,
    };
  }
  const lastShot = useRef<string | null>(shot?.key ?? null);

  useEffect(() => {
    const s = sim.current!;
    s.pos = shapes.map((team, side) =>
      team.map((_, i) => s.pos[side]?.[i] ?? kickoff(side as Side, i, s.flipped)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapes]);

  useEffect(() => {
    if (!shot || shot.key === lastShot.current) return;
    lastShot.current = shot.key;
    const s = sim.current!;
    const b = s.ball;
    const team = shot.side === 0 ? home : away;
    const index = Math.max(0, team.ids.indexOf(shot.playerId ?? ''));
    const shooter = s.pos[shot.side][index] ?? b.pos;
    // A jogada chega à área: a bola é servida no espaço onde o finalizador ataca.
    const rel = flip(shot.side, shooter, s.flipped);
    const spot = flip(
      shot.side,
      { x: clamp(rel.x + 10, 72, 89), y: 50 + (rel.y - 50) * 0.45 + (Math.random() - 0.5) * 10 },
      s.flipped,
    );
    Object.assign(b, {
      phase: 'pass',
      side: shot.side,
      index,
      from: { ...b.pos },
      to: spot,
      t: 0,
      dur: clamp(Math.max(dist(b.pos, spot) / 70, dist(shooter, spot) / 30), 0.35, 1.1),
      shoot: shot.type,
      then: undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot, home, away]);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const pickHold = () => 0.35 + Math.random() * 0.75;
    const rel = (side: Side, p: Pt) => flip(side, p, sim.current!.flipped);
    const abs = rel;

    const nearestOf = (s: Sim, side: Side, p: Pt, skipKeeper = true) =>
      live.current.active[side]
        .filter((j) => !skipKeeper || j > 0)
        .sort((j, k) => dist(s.pos[side][j], p) - dist(s.pos[side][k], p));

    const target = (side: Side, i: number, s: Sim): Pt => {
      const { shapes } = live.current;
      const base = shapes[side][i] || { x: 30, y: 50 };
      const b = s.ball;
      const me = rel(side, s.pos[side][i]);
      const ball = rel(side, b.pos);
      if (b.phase === 'reset') return kickoff(side, i, s.flipped);
      if (b.phase === 'held' && b.side === side && b.index === i) {
        // Conduz para frente quando há espaço; pressionado, protege a bola.
        const other: Side = side === 0 ? 1 : 0;
        const marker = nearestOf(s, other, s.pos[side][i], false)[0];
        const space = marker === undefined ? 30 : dist(s.pos[other][marker], s.pos[side][i]);
        const run = i === 0 ? 0 : space > 9 ? 7 : space > 5 ? 3 : 0;
        return abs(side, { x: clamp(me.x + run, 2, 92), y: me.y + (50 - me.y) * 0.08 });
      }
      if (b.phase === 'pass' && b.side === side && b.index === i) return b.to;
      const wobble = (k: number) => Math.sin(s.time * (0.55 + k * 0.1) + i * 1.9) * 1.4;
      if (i === 0)
        return abs(side, {
          x: 5 + clamp((ball.x - 30) * 0.12, 0, 10),
          y: 50 + (ball.y - 50) * 0.22,
        });
      const depth = clamp((base.x - 8) / 38, 0, 1);
      const attacking = b.side === side;
      let x: number;
      let y: number;
      if (attacking) {
        // Bloco sobe com a bola: zagueiros até a intermediária, atacantes atacam a última linha.
        const back = clamp(ball.x - 36, 16, 58);
        const front = clamp(ball.x + 22, 42, 90);
        x = back + depth * (front - back);
        y = 50 + (base.y - 50) * 1.2 + (ball.y - 50) * 0.12;
        // Atacantes e meias ofensivos fazem diagonais e infiltrações.
        if (depth > 0.7) x += (Math.sin(s.time * 0.8 + i * 2.1) * 0.5 + 0.5) * 7;
      } else {
        // Sem a bola: recua, compacta e fecha o lado da bola.
        const back = clamp(ball.x - 18, 6, 44);
        const front = clamp(ball.x + 12, 26, 70);
        x = back + depth * (front - back);
        y = 50 + (base.y - 50) * 0.78 + (ball.y - 50) * 0.32;
      }
      return abs(side, { x: clamp(x + wobble(1), 3, 95), y: clamp(y + wobble(2), 6, 94) });
    };

    const pass = (b: Ball, side: Side, index: number, to: Pt, speedK = 62) =>
      Object.assign(b, {
        phase: 'pass',
        side,
        index,
        from: { ...b.pos },
        to,
        t: 0,
        dur: dist(b.pos, to) / speedK + 0.15,
      });

    const decide = (s: Sim) => {
      const b = s.ball;
      const { possession, active } = live.current;
      const side = b.side;
      const other: Side = side === 0 ? 1 : 0;
      const holderAbs = s.pos[side][b.index];
      const holder = rel(side, holderAbs);
      const share = (side === 0 ? possession : 100 - possession) / 100;
      const markers = nearestOf(s, other, holderAbs, false);
      const marker = markers[0];
      // Desarme: pressionado de perto, pode perder a bola.
      if (
        marker !== undefined &&
        b.index > 0 &&
        dist(s.pos[other][marker], holderAbs) < 3.5 &&
        Math.random() < 0.22 + (0.5 - share) * 0.5
      ) {
        Object.assign(b, { side: other, index: marker, held: 0, hold: pickHold() });
        return;
      }
      const openness = (p: Pt) => {
        const n = nearestOf(s, other, p, false)[0];
        return n === undefined ? 20 : dist(s.pos[other][n], p);
      };
      const deep = holder.x > 76;
      const options = active[side]
        .filter((i) => i !== b.index && (i > 0 || holder.x < 40))
        .map((i) => {
          const p = s.pos[side][i];
          const r = rel(side, p);
          const d = dist(p, holderAbs);
          const progress = r.x - holder.x;
          const free = Math.min(14, openness(p));
          // No terço final sem finalização registrada, a jogada é recomposta.
          const forward = deep ? -Math.abs(progress) * 0.3 : progress * (0.35 + share * 0.4);
          const score =
            forward + free * 0.9 - Math.abs(d - 18) * 0.25 + (Math.random() - 0.5) * 9;
          return { i, p, r, d, free, score };
        })
        .filter((o) => o.d > 5 && o.d < (b.index === 0 ? 60 : 46))
        .sort((a, c) => c.score - a.score);
      const choice = options[0];
      if (!choice) {
        b.hold += 0.4;
        return;
      }
      const lead = abs(side, { x: clamp(choice.r.x + 2.5, 3, 95), y: choice.r.y });
      const risk =
        0.05 +
        Math.max(0, 9 - choice.free) * 0.025 +
        (0.5 - share) * 0.3 +
        (choice.r.x > 75 ? 0.18 : 0) +
        (deep ? 0.12 : 0);
      if (Math.random() < risk) {
        // Interceptação ou corte: o rival mais próximo da linha do passe fica com a bola.
        const mid = { x: (holderAbs.x + lead.x) / 2, y: (holderAbs.y + lead.y) / 2 };
        const thief = nearestOf(s, other, choice.r.x > 75 ? lead : mid)[0];
        if (thief !== undefined) {
          const t = s.pos[other][thief];
          pass(b, other, thief, { x: (mid.x + t.x * 2) / 3, y: (mid.y + t.y * 2) / 3 });
          return;
        }
      }
      pass(b, side, choice.i, lead, b.index === 0 ? 75 : 62);
    };

    const step = (s: Sim, dt: number) => {
      s.time += dt;
      const b = s.ball;
      const { counts, active, flipped } = live.current;
      if (s.flipped !== flipped) {
        // Intervalo: times trocam de lado e o visitante dá a saída.
        s.flipped = flipped;
        s.pos = [0, 1].map((side) =>
          live.current.shapes[side].map((_, i) => kickoff(side as Side, i, flipped)),
        );
        const kicker = active[1].at(-1) ?? 0;
        Object.assign(b, {
          phase: 'held',
          side: 1,
          index: kicker,
          held: 0,
          hold: 0.9,
          pos: { x: 50, y: 50 },
          shoot: undefined,
          then: undefined,
        });
        if (s.pos[1][kicker]) s.pos[1][kicker] = { x: 50, y: 50 };
      }
      if (b.phase === 'held' && !active[b.side].includes(b.index))
        b.index = active[b.side].find((index) => index > 0) ?? active[b.side][0] ?? 0;
      const presser: number[] = [];
      const cover: number[] = [];
      for (const side of [0, 1] as Side[]) {
        const ranked = b.side !== side && b.phase !== 'reset' ? nearestOf(s, side, b.pos) : [];
        presser[side] = ranked[0] ?? -1;
        cover[side] = ranked[1] ?? -1;
      }
      for (const side of [0, 1] as Side[]) {
        for (let i = 0; i < counts[side]; i++) {
          if (!active[side].includes(i)) continue;
          const p = s.pos[side][i];
          if (!p) continue;
          let goal = target(side, i, s);
          if (i === presser[side]) goal = { x: b.pos.x, y: b.pos.y };
          else if (i === cover[side]) {
            // Cobertura: fica entre a bola e o próprio gol.
            const ownGoal = abs(side, { x: 0, y: 50 });
            goal = { x: b.pos.x * 0.75 + ownGoal.x * 0.25, y: b.pos.y * 0.8 + 50 * 0.2 };
          }
          const sprint =
            (b.phase === 'pass' && b.side === side && b.index === i) || i === presser[side];
          const dx = goal.x - p.x;
          const dy = goal.y - p.y;
          const want = 1 - Math.exp(-dt * 3);
          const len = Math.hypot(dx, dy) * want;
          const max = (sprint ? 24 : 15) * dt;
          const k = len > max ? max / len : 1;
          p.x = clamp(p.x + dx * want * k, 1, 99);
          p.y = clamp(p.y + dy * want * k, 3, 97);
        }
      }
      if (b.phase === 'held') {
        const p = s.pos[b.side][b.index] || b.pos;
        const dir = (b.side === 0) !== s.flipped ? 1 : -1;
        b.pos = { x: p.x + dir * 1.3, y: p.y + 1.4 };
        b.held += dt;
        if (b.held >= b.hold) decide(s);
        return;
      }
      b.t += dt;
      const k = Math.min(1, b.t / b.dur);
      const e = b.phase === 'shot' ? k : ease(k);
      b.pos = { x: b.from.x + (b.to.x - b.from.x) * e, y: b.from.y + (b.to.y - b.from.y) * e };
      if (k < 1) return;
      if (b.phase === 'pass' && b.shoot) {
        // Recebeu na área: finaliza no gol de ataque.
        const type = b.shoot;
        const other: Side = b.side === 0 ? 1 : 0;
        const goalX = abs(b.side, { x: type === 'goal' ? 100.5 : 98.5, y: 50 }).x;
        const y =
          type === 'miss'
            ? Math.random() < 0.5
              ? 36
              : 64
            : type === 'goal'
              ? 46 + Math.random() * 8
              : 47 + Math.random() * 6;
        Object.assign(b, {
          phase: 'shot',
          from: { ...b.pos },
          to: { x: goalX, y },
          t: 0,
          dur: clamp(dist(b.pos, { x: goalX, y }) / 90, 0.25, 0.5),
          shoot: undefined,
          then: type === 'goal' ? undefined : { side: other, index: 0 },
        });
      } else if (b.phase === 'pass') Object.assign(b, { phase: 'held', held: 0, hold: pickHold() });
      else if (b.phase === 'shot' && b.then) {
        const keeper = s.pos[b.then.side][0];
        pass(b, b.then.side, 0, { ...keeper }, 40);
        b.then = undefined;
      } else if (b.phase === 'shot') {
        // Gol: comemora na rede e recomeça no meio-campo com quem sofreu.
        const conceded: Side = b.side === 0 ? 1 : 0;
        Object.assign(b, {
          phase: 'reset',
          side: conceded,
          t: 0,
          dur: 1.4,
          from: { ...b.pos },
          to: { ...b.pos },
        });
      } else {
        const kicker = active[b.side].at(-1) ?? 0;
        Object.assign(b, {
          phase: 'held',
          index: kicker,
          held: 0,
          hold: 0.9,
          pos: { x: 50, y: 50 },
        });
        if (s.pos[b.side][kicker]) s.pos[b.side][kicker] = { x: 50, y: 50 };
      }
    };

    const render = (s: Sim) => {
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
      const b = s.ball;
      if (live.current.playing || b.phase === 'shot' || b.shoot || live.current.flipped !== s.flipped)
        step(s, dt * Math.max(0.5, Math.min(3, live.current.speed)));
      render(s);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const teams = [home, away];
  return (
    <div
      className={`live-field ${playing ? 'live' : ''}`}
      role="img"
      aria-label="Simulação 2D ilustrativa da partida; os eventos aparecem no registro textual"
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
          if (team.dismissed?.includes(id)) return null;
          const p = sim.current!.pos[side]?.[i] || { x: 50, y: 50 };
          return (
            <span
              className={`field-dot ${side ? 'away' : 'home'} ${i === 0 ? 'keeper' : ''}`}
              key={id}
              ref={(el) => {
                dots.current[side][i] = el;
              }}
              title={team.names[id]}
              style={{ left: `${p.x}%`, top: `${p.y}%`, ['--dot' as string]: team.color,
                ['--dot-text' as string]: team.text || '#fff',
              }}
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
