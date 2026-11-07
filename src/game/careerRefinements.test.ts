import { describe, expect, it } from 'vitest';
import {
  advanceDay,
  createCareer,
  ensureAcademy,
  playerConversation,
  promoteAcademyPlayer,
  respondMessage,
  updateManager,
  validateCareerForWorld,
} from './engine';
import { createDemoWorld } from './world';
import { ageAt, addDays, hash, random } from './random';
import { formations, type Career, type Formation, type Manager, type Tactic } from './types';
import { pitchCoordinates, formationRows } from './pitch';
import {
  assistantCandidates,
  assistantTrainingBonus,
  hireAssistant,
  replaceBenchPlayer,
} from './squadManagement';
import { bestLineup, simulateMatch, syncBenchWithLineup } from './matches';
import { setTraining, familiarity } from './positions';

const world = createDemoWorld();
const manager: Manager = {
  firstName: 'Alex',
  lastName: 'Silva',
  nationality: 'Brasil',
  age: 38,
  style: 'Terno azul',
  appearance: '',
};
const start = () => createCareer(world, manager, 'sao-paulo', 'Amador', 'Realista', 42);

describe('refinamentos da carreira', () => {
  it('desenha as onze formações com linhas, pontas e centroavante corretos', () => {
    for (const formation of Object.keys(formations) as Formation[]) {
      const coordinates = pitchCoordinates(formation);
      expect(coordinates).toHaveLength(11);
      const rows = new Map<number, number>();
      for (const coordinate of coordinates.slice(1))
        rows.set(coordinate.y, (rows.get(coordinate.y) ?? 0) + 1);
      expect([...rows.values()], formation).toEqual(formationRows[formation]);
      expect(new Set(coordinates.map(({ x, y }) => `${x}:${y}`)).size).toBe(11);
    }
    const forwardRoles = formations['4-3-3'];
    const points = pitchCoordinates('4-3-3');
    expect(points[forwardRoles.indexOf('LW')].x).toBe(25);
    expect(points[forwardRoles.indexOf('ST')].x).toBe(50);
    expect(points[forwardRoles.indexOf('RW')].x).toBe(75);
  });

  it('começa somente com a conversa do capitão e impede respostas repetidas e contatos proativos', () => {
    const career = start();
    const incoming = career.messages.filter((message) => message.kind === 'player');
    expect(incoming).toHaveLength(1);
    expect(incoming[0].playerId).toBe(career.roles['Capitão']);
    const replied = respondMessage(career, incoming[0].id, 'support');
    const repeated = respondMessage(replied, incoming[0].id, 'support');
    expect(repeated.players[incoming[0].playerId!]).toEqual(replied.players[incoming[0].playerId!]);
    expect(repeated.memories).toEqual(replied.memories);
    expect(() => playerConversation(replied, incoming[0].playerId!, 'praise')).toThrow(
      /iniciar a conversa/,
    );
  });

  it('cria a base, protege atletas de 15 anos e mantém evolução ao promover', () => {
    let career = start();
    expect(career.living.academyRoster).toHaveLength(18);
    expect(career.living.academyFixtures).toHaveLength(56);
    const tooYoung = career.living.academyRoster.find(
      (player) => ageAt(player.birthDate, career.date) === 15,
    )!;
    expect(() => promoteAcademyPlayer(career, tooYoung.id)).toThrow(/16 anos/);
    const player = career.living.academyRoster.find(
      (item) => ageAt(item.birthDate, career.date) >= 16,
    )!;
    career.players[player.id].growth = 1.25;
    career = promoteAcademyPlayer(career, player.id);
    expect(career.youth.some((item) => item.id === player.id)).toBe(true);
    expect(career.living.academyRoster.some((item) => item.id === player.id)).toBe(false);
    expect(career.players[player.id].growth).toBe(1.25);
    expect(() => validateCareerForWorld(career, world)).not.toThrow();
  });

  it('simula torneio de base e concede minutos reais de desenvolvimento', () => {
    let career = start();
    career.messages.forEach((message) => {
      message.resolved = true;
    });
    career.fixtures = career.fixtures.map((fixture) => ({ ...fixture, date: '2026-12-29' }));
    const first = career.living.academyFixtures[0].date;
    career.date = addDays(first, -1);
    career = advanceDay(career, world);
    expect(
      career.living.academyFixtures.filter((fixture) => fixture.homeGoals !== undefined),
    ).toHaveLength(4);
    expect(
      career.living.academyRoster.filter((player) => career.players[player.id].minutes === 90),
    ).toHaveLength(11);
    expect(() => validateCareerForWorld(career, world)).not.toThrow();
  });

  it('o auxiliar escolhido melhora treino e evolução de verdade, não só a folha salarial', () => {
    const career = start();
    const player = career.living.academyRoster.find((item) => item.position === 'ST')!;
    const date = Array.from({ length: 365 }, (_, index) => addDays('2026-01-02', index)).find(
      (day) => random(hash(`${career.seed}:${day}:${player.id}`))() < 0.035,
    );
    if (!date) throw new Error('A seed de prova não contém um dia de evolução.');
    career.date = addDays(date, -1);
    career.fixtures = career.fixtures.map((fixture) => ({ ...fixture, date: '2026-12-29' }));
    career.messages.forEach((message) => {
      message.resolved = true;
    });
    const base = setTraining(career, player, 'CM');
    const candidate = assistantCandidates(base, 'ataque')[4];
    const staffed = hireAssistant(base, 'ataque', candidate.id!);
    const normal = advanceDay(base, world);
    const trained = advanceDay(staffed, world);
    const bonus = assistantTrainingBonus(staffed, player.position);
    expect(trained.players[player.id].growth).toBeGreaterThan(normal.players[player.id].growth);
    expect(trained.players[player.id].growth / normal.players[player.id].growth).toBeCloseTo(
      1 + bonus,
      6,
    );
    expect(familiarity(player, 'CM', trained.players[player.id])).toBeGreaterThan(
      familiarity(player, 'CM', normal.players[player.id]),
    );
    console.log(
      `PROVA AUXILIAR: ${candidate.name}, ${candidate.skill}/5, ${candidate.stars.ST} estrelas ST; crescimento ${normal.players[player.id].growth.toFixed(6)} -> ${trained.players[player.id].growth.toFixed(6)} (+${(bonus * 100).toFixed(0)}%); treino CM ${familiarity(player, 'CM', normal.players[player.id]).toFixed(1)} -> ${familiarity(player, 'CM', trained.players[player.id]).toFixed(1)}%.`,
    );
  });

  it('troca um atleta fora da relação pelo banco sem duplicatas e atualiza o manager completo', () => {
    const career = start();
    const migrated = ensureAcademy({ ...career, bench: [], benchConfigured: false }, world);
    expect(migrated.bench).toHaveLength(9);
    const outside = world.players.find(
      (player) =>
        player.clubId === career.clubId &&
        !career.lineup.includes(player.id) &&
        !career.bench.includes(player.id),
    )!;
    const changed = replaceBenchPlayer(career, outside.id, career.bench[0]);
    expect(changed.bench).toHaveLength(9);
    expect(new Set(changed.bench).size).toBe(9);
    expect(changed.bench).toContain(outside.id);
    expect(() => replaceBenchPlayer(career, career.lineup[0], career.bench[0])).toThrow(/fora/);
    const edited = updateManager(career, {
      ...career.manager,
      firstName: 'Bruno',
      birthDate: '1980-01-01',
      gender: 'Homem',
      formOfAddress: 'Sr.',
      nationality: 'Portugal',
      birthRegion: 'Porto',
    });
    expect(edited.manager.age).toBe(46);
    expect(edited.manager.firstName).toBe('Bruno');
    expect(edited.manager.birthRegion).toBe('Porto');
  });
});

function grid(c: Career) {
  const totals = { xg: 0, conceded: 0, possession: 0, energy: 0 };
  const opponent = world.clubs.find((club) => club.id !== c.clubId && club.league === 'A')!;
  const seeds = 32;
  for (let index = 0; index < seeds; index++) {
    const fixture = {
      id: `proof-${index}`,
      date: c.date,
      round: 1,
      homeId: c.clubId,
      awayId: opponent.id,
      playoff: false,
    };
    const career = { ...c, fixtures: [fixture] };
    const result = simulateMatch(career, world, fixture);
    totals.xg += result.home.xg;
    totals.conceded += result.awayGoals;
    totals.possession += result.home.possession;
    totals.energy += c.lineup.reduce((sum, id) => sum + (result.energySpent[id] ?? 0), 0) / 11;
  }
  return Object.fromEntries(
    Object.entries(totals).map(([key, value]) => [key, value / seeds]),
  ) as typeof totals;
}

describe('prova de controles táticos e condição em partidas simuladas', () => {
  it('cada ajuste produz efeito mensurável com as mesmas 32 seeds', () => {
    const career = start();
    const variants: { label: string; low: Partial<Tactic>; high: Partial<Tactic> }[] = [
      { label: 'mentalidade', low: { mentality: 'Defensiva' }, high: { mentality: 'Ofensiva' } },
      { label: 'pressao', low: { pressure: 1 }, high: { pressure: 5 } },
      { label: 'largura', low: { width: 1 }, high: { width: 5 } },
      { label: 'construcao', low: { tempo: 1 }, high: { tempo: 5 } },
      { label: 'linha defensiva', low: { line: 1 }, high: { line: 5 } },
      { label: 'formacao', low: { formation: '4-3-3' }, high: { formation: '3-5-2' } },
    ];
    for (const variant of variants) {
      const withTactic = (change: Partial<Tactic>) => {
        const tactic = { ...career.tactic, ...change };
        return {
          ...syncBenchWithLineup(
            career,
            bestLineup(career, world, career.clubId, tactic.formation),
          ),
          tactic,
        };
      };
      const low = grid(withTactic(variant.low)),
        high = grid(withTactic(variant.high));
      const distance =
        Math.abs(high.xg - low.xg) +
        Math.abs(high.possession - low.possession) / 100 +
        Math.abs(high.energy - low.energy) / 100;
      expect(distance, variant.label).toBeGreaterThan(0.005);
      if (variant.label === 'pressao') expect(high.energy - low.energy).toBeGreaterThan(2);
      if (variant.label === 'construcao') expect(high.energy - low.energy).toBeGreaterThan(0.5);
      console.log(
        `PROVA ${variant.label}: xG ${low.xg.toFixed(2)} -> ${high.xg.toFixed(2)}; posse ${low.possession.toFixed(1)} -> ${high.possession.toFixed(1)}%; desgaste ${low.energy.toFixed(2)} -> ${high.energy.toFixed(2)}.`,
      );
    }
    for (const status of ['fitness', 'morale', 'sharpness'] as const) {
      const withStatus = (value: number) => {
        const copy = structuredClone(career);
        for (const id of copy.lineup) copy.players[id][status] = value;
        return copy;
      };
      const low = grid(withStatus(40)),
        high = grid(withStatus(95));
      expect(high.xg - low.xg, status).toBeGreaterThan(0.01);
      console.log(
        `PROVA ${status} 40 -> 95: xG ${low.xg.toFixed(2)} -> ${high.xg.toFixed(2)}; gols sofridos ${low.conceded.toFixed(2)} -> ${high.conceded.toFixed(2)}.`,
      );
    }
  }, 120_000);
});
