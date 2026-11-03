import { describe, expect, it } from 'vitest';
import { createDemoWorld } from './world';
import {
  advanceDay,
  createCareer,
  finishMatch,
  respondMessage,
  startNextSeason,
  standings,
  validateCareerForWorld,
} from './engine';
import { bestLineup, simulateMatch } from './matches';
import { nextFixture } from './calendar';
import { cupGroups, cupTies } from './competitions';
import { careerWorld } from './live';
import { careerSchema, type Career, type Manager } from './types';

const world = createDemoWorld();
const manager: Manager = {
  firstName: 'Alex',
  lastName: 'Silva',
  age: 30,
  nationality: 'Brasil',
  style: 'Terno azul',
  appearance: 'Cabelo curto',
};

function playSeason(start: Career) {
  let c = start;
  for (let guard = 0; guard < 800 && !c.seasonEnded; guard++) {
    for (const m of c.messages.filter((m) => m.important && !m.resolved))
      c = respondMessage(c, m.id);
    const f = nextFixture(c);
    if (f && f.date <= c.date) {
      const live = careerWorld(world, c);
      c = { ...c, lineup: bestLineup(c, live) };
      c = finishMatch({ ...c, activeMatch: simulateMatch(c, live, f) }, live);
      continue;
    }
    c = advanceDay(c, world);
  }
  return c;
}

const first = createCareer(world, manager, 'sao-paulo', 'Amador', 'Realista', 7);
const ended = playSeason(first);

describe('temporada completa com copas', () => {
  it('cria estaduais, Supercopa, Copa do Brasil e torneios continentais', () => {
    const cups = new Set(first.fixtures.map((f) => f.cup).filter(Boolean));
    for (const cup of ['EST-SP', 'EST-RJ', 'SUP', 'CDB', 'LIB', 'SUL']) expect(cups).toContain(cup);
    expect(first.fixtures.filter((f) => f.cup === 'CDB')).toHaveLength(32);
    expect(cupGroups(first, 'LIB')).toHaveLength(8);
    expect(first.fixtures.some((f) => f.homeId.startsWith('npc-c-'))).toBe(true);
  });
  it('nunca escala um clube duas vezes no mesmo dia', () => {
    const seen = new Set<string>();
    for (const f of ended.fixtures)
      for (const id of [f.homeId, f.awayId]) {
        const key = `${id}:${f.date}`;
        expect(seen.has(key), key).toBe(false);
        seen.add(key);
      }
  });
  it('termina todas as competições com campeões e acesso definidos', () => {
    expect(ended.seasonEnded).toBe(true);
    expect(ended.date <= '2026-12-31').toBe(true);
    expect(ended.fixtures.every((f) => f.result)).toBe(true);
    const titles = ended.honours.filter((h) => h.season === 2026).map((h) => h.competition);
    for (const cup of ['A', 'B', 'SUP', 'CDB', 'LIB', 'SUL', 'EST-SP'])
      expect(titles).toContain(cup);
    expect(ended.promoted).toHaveLength(4);
    expect(ended.relegated).toHaveLength(4);
    expect(cupTies(ended, 'CDB').at(-1)?.winner).toBe(
      ended.honours.find((h) => h.competition === 'CDB')!.clubId,
    );
    expect(standings(ended, world, 'A')[0].played).toBe(38);
  });
  it('mantém o save bem abaixo do limite de 10 MB e válido', () => {
    expect(JSON.stringify(ended).length).toBeLessThan(4_000_000);
    expect(() => validateCareerForWorld(ended, world)).not.toThrow();
  });
  it('é determinística para a mesma seed', () => {
    const again = playSeason(createCareer(world, manager, 'sao-paulo', 'Amador', 'Realista', 7));
    expect(again.honours).toEqual(ended.honours);
  }, 180_000);
});

describe('virada de temporada', () => {
  const next = startNextSeason(ended, world);
  it('aplica acesso/rebaixamento, base e novo calendário', () => {
    expect(next.season).toBe(2027);
    expect(next.date).toBe('2027-01-01');
    expect(next.seasonEnded).toBe(false);
    const live = careerWorld(world, next);
    for (const id of ended.promoted) expect(live.clubs.find((c) => c.id === id)!.league).toBe('A');
    for (const id of ended.relegated) expect(live.clubs.find((c) => c.id === id)!.league).toBe('B');
    expect(live.clubs.filter((c) => c.league === 'A')).toHaveLength(20);
    expect(next.youth).toHaveLength(120);
    expect(next.fixtures.every((f) => f.date.startsWith('2027') && !f.result)).toBe(true);
    expect(next.fixtures.filter((f) => f.league === 'A')).toHaveLength(380);
    expect(next.history).toHaveLength(1);
    expect(Object.values(next.players).every((s) => s.goals === 0)).toBe(true);
    expect(() => validateCareerForWorld(careerSchema.parse(next), world)).not.toThrow();
    expect(() => startNextSeason(next, world)).toThrow('não terminou');
  });
  it('joga uma segunda temporada inteira', () => {
    const second = playSeason(next);
    expect(second.seasonEnded).toBe(true);
    expect(second.honours.filter((h) => h.season === 2027 && h.competition === 'A')).toHaveLength(
      1,
    );
    const third = startNextSeason(second, world);
    expect(third.season).toBe(2028);
    expect(JSON.stringify(third).length).toBeLessThan(6_000_000);
  }, 180_000);
});
