import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createCareer } from './engine';
import { bestLineup, simulateMatch, syncBenchWithLineup } from './matches';
import { careerWorld } from './live';
import { expectedBalance, npcTactic, profile, recommendTactic, strength } from './tactics';
import { matchRatings } from './matchRatings';
import { formations } from './types';
import { worldSchema, type Career, type Fixture, type Tactic, type World } from './types';

/**
 * Prova de balanceamento: overall e plano de jogo mudam o resultado de verdade.
 * Rode com `npx vitest run src/game/balance.test.ts` para ver a tabela no console.
 */
const world = worldSchema.parse(
  JSON.parse(readFileSync(new URL('../../public/data/world-2026.json', import.meta.url), 'utf8')),
);
const manager = {
  firstName: 'Alex',
  lastName: 'Silva',
  age: 30,
  nationality: 'Brasil',
  style: 'Terno azul' as const,
  appearance: '',
};

type Tally = { w: number; d: number; l: number; gf: number; ga: number; n: number };
const empty = (): Tally => ({ w: 0, d: 0, l: 0, gf: 0, ga: 0, n: 0 });
const pct = (t: Tally) => `${Math.round((t.w / t.n) * 100)}%V ${Math.round((t.d / t.n) * 100)}%E`;
const gd = (t: Tally) => ((t.gf - t.ga) / t.n).toFixed(2);

function play(c: Career, live: World, homeId: string, awayId: string, n: number, tag: string) {
  const t = empty();
  for (let i = 0; i < n; i++) {
    const fixture: Fixture = {
      id: `${tag}-${i}`,
      date: c.date,
      round: 1,
      homeId: i % 2 ? awayId : homeId,
      awayId: i % 2 ? homeId : awayId,
      playoff: false,
    };
    const career = { ...c, fixtures: [...c.fixtures, fixture] };
    const m = simulateMatch(career, live, fixture);
    const home = fixture.homeId === homeId;
    const gf = home ? m.homeGoals : m.awayGoals;
    const ga = home ? m.awayGoals : m.homeGoals;
    t.n++;
    t.gf += gf;
    t.ga += ga;
    if (gf > ga) t.w++;
    else if (gf === ga) t.d++;
    else t.l++;
  }
  return t;
}

describe('balanceamento da engine', () => {
  const c = createCareer(world, manager, 'sao-paulo', 'Amador', 'Realista', 7);
  const live = careerWorld(world, c);
  const ovr = Object.fromEntries(
    live.clubs.map((club) => [club.id, npcTactic(c, live, club.id).ovr]),
  );
  const ranked = [...live.clubs].sort((a, b) => ovr[b.id] - ovr[a.id]);

  it('overall pesa: quem é mais forte vence mais', () => {
    const top = ranked.slice(0, 3);
    const mid = ranked.slice(18, 21);
    const low = ranked.slice(-3);
    const rows: string[] = [];
    const versus = (a: typeof top, b: typeof top, label: string) => {
      const t = empty();
      a.forEach((x, i) => {
        const r = play(c, live, x.id, b[i].id, 60, `${label}-${i}`);
        (Object.keys(t) as (keyof Tally)[]).forEach((k) => (t[k] += r[k]));
      });
      const gap = (a.reduce((s, x) => s + ovr[x.id], 0) - b.reduce((s, x) => s + ovr[x.id], 0)) / 3;
      rows.push(
        `${label.padEnd(18)} gap ${gap.toFixed(1).padStart(5)}  ${pct(t)}  saldo ${gd(t)}  gols/j ${((t.gf + t.ga) / t.n).toFixed(2)}`,
      );
      return t;
    };
    const topLow = versus(top, low, 'Top3 x Lanterna3');
    const topMid = versus(top, mid, 'Top3 x Meio3');
    const midLow = versus(mid, low, 'Meio3 x Lanterna3');
    const even = versus(top, [...top].reverse(), 'Top x Top');
    console.log(`\nOVERALL\n${rows.join('\n')}`);
    expect(topLow.w / topLow.n).toBeGreaterThan(0.6);
    expect(topLow.w / topLow.n).toBeGreaterThan(topMid.w / topMid.n);
    expect(midLow.w).toBeGreaterThan(midLow.l);
    expect(Math.abs(even.w - even.l) / even.n).toBeLessThan(0.2);
    const goals = (topMid.gf + topMid.ga) / topMid.n;
    expect(goals).toBeGreaterThan(1.8);
    expect(goals).toBeLessThan(3.8);
  }, 240_000);

  it('tática pesa: o plano certo rende mais que o padrão e o errado rende menos', () => {
    const opponent = ranked.find(
      (club) => club.id !== c.clubId && Math.abs(ovr[club.id] - ovr[c.clubId]) < 2,
    )!;
    const plan = npcTactic(c, live, opponent.id, ovr[c.clubId]);
    const rec = recommendTactic(c, live, { clubId: opponent.id, ...plan }, true);
    // O pior plano possível com o mesmo desenho, pela mesma conta do auxiliar.
    const theirs = {
      tactic: plan.tactic,
      profile: profile(c, live, plan.lineup, plan.tactic.formation),
      base: strength(c, live, plan.lineup, plan.tactic.formation),
    };
    const mine = {
      profile: profile(c, live, c.lineup, c.tactic.formation),
      base: strength(c, live, c.lineup, c.tactic.formation),
    };
    let bad = c.tactic;
    let low = Infinity;
    for (const mentality of ['Defensiva', 'Equilibrada', 'Ofensiva'] as const)
      for (let pressure = 1; pressure <= 5; pressure++)
        for (let width = 1; width <= 5; width++)
          for (let tempo = 1; tempo <= 5; tempo++)
            for (let line = 1; line <= 5; line++) {
              const tactic: Tactic = { ...c.tactic, mentality, pressure, width, tempo, line };
              const r = expectedBalance({ tactic, ...mine }, theirs, true);
              if (r.goalsFor - r.goalsAgainst < low) {
                low = r.goalsFor - r.goalsAgainst;
                bad = tactic;
              }
            }
    const run = (tactic: Tactic, lineup: string[], tag: string) =>
      play({ ...syncBenchWithLineup(c, lineup), tactic }, live, c.clubId, opponent.id, 300, tag);
    const base = run(c.tactic, c.lineup, 'base');
    const best = run(rec.tactic, rec.lineup, 'best');
    const worst = run(bad, c.lineup, 'worst');
    console.log(
      `\nTÁTICA (São Paulo x ${opponent.name}, overall ${ovr[c.clubId].toFixed(1)} x ${ovr[opponent.id].toFixed(1)})\n` +
        `padrão     ${pct(base)}  saldo ${gd(base)}\n` +
        `auxiliar   ${pct(best)}  saldo ${gd(best)}  (${rec.tactic.formation} ${rec.tactic.mentality} P${rec.tactic.pressure} L${rec.tactic.width} V${rec.tactic.tempo} D${rec.tactic.line})\n` +
        `plano ruim ${pct(worst)}  saldo ${gd(worst)}  (${bad.mentality} P${bad.pressure} L${bad.width} V${bad.tempo} D${bad.line})\n` +
        `motivos: ${rec.notes.map((n) => n.text).join('; ')}`,
    );
    expect(best.gf - best.ga).toBeGreaterThan(base.gf - base.ga);
    expect(base.gf - base.ga).toBeGreaterThan(worst.gf - worst.ga);
    expect(best.w).toBeGreaterThan(worst.w);
  }, 240_000);

  it('improvisar um atacante na zaga custa gols e derruba a nota dele', () => {
    const opponent = ranked[Math.floor(ranked.length / 2)];
    const roles = formations[c.tactic.formation];
    const cb = roles.findIndex((r) => r === 'CB');
    const st = roles.findIndex((r) => r === 'ST');
    const lineup = bestLineup(c, live);
    const swapped = [...lineup];
    [swapped[cb], swapped[st]] = [swapped[st], swapped[cb]];
    const striker = lineup[st];
    const runWith = (ids: string[], tag: string) => {
      const t = empty();
      let rating = 0;
      for (let i = 0; i < 200; i++) {
        const fixture: Fixture = {
          id: `${tag}-${i}`,
          date: c.date,
          round: 1,
          homeId: c.clubId,
          awayId: opponent.id,
          playoff: false,
        };
        const career = { ...c, lineup: ids, fixtures: [...c.fixtures, fixture] };
        const m = simulateMatch(career, live, fixture);
        t.n++;
        t.gf += m.homeGoals;
        t.ga += m.awayGoals;
        if (m.homeGoals > m.awayGoals) t.w++;
        else if (m.homeGoals === m.awayGoals) t.d++;
        rating += matchRatings(career, live, m).find((r) => r.id === striker)?.rating || 0;
      }
      return { t, rating: rating / 200 };
    };
    const normal = runWith(lineup, 'normal');
    const lost = runWith(swapped, 'lost');
    console.log(
      `\nIMPROVISO (centroavante de zagueiro)\n` +
        `normal     sofre ${(normal.t.ga / 200).toFixed(2)}/j  ${pct(normal.t)}  nota do atacante ${normal.rating.toFixed(2)}\n` +
        `improviso  sofre ${(lost.t.ga / 200).toFixed(2)}/j  ${pct(lost.t)}  nota do atacante ${lost.rating.toFixed(2)}`,
    );
    expect(lost.t.ga).toBeGreaterThan(normal.t.ga);
    expect(lost.rating).toBeLessThan(normal.rating - 0.5);
  }, 240_000);
});
