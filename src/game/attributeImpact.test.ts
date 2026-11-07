import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createCareer } from './engine';
import { simulateMatch } from './matches';
import { careerWorld } from './live';
import { matchRatings } from './matchRatings';
import { npcTactic } from './tactics';
import {
  formations,
  worldSchema,
  type Attributes,
  type Career,
  type Fixture,
  type World,
} from './types';

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
const SEEDS = 72;
const BOOST = 35;

type AttributeFamily = {
  label: string;
  position: string;
  attributes: (keyof Attributes)[];
  metric: 'xgFor' | 'goalsAgainst' | 'playerRating';
  direction: 1 | -1;
};

const families: AttributeFamily[] = [
  { label: 'pace', position: 'ST', attributes: ['pace'], metric: 'xgFor', direction: 1 },
  { label: 'shooting', position: 'ST', attributes: ['finishing'], metric: 'xgFor', direction: 1 },
  {
    label: 'passing/vision',
    position: 'DM',
    attributes: ['shortPass', 'vision'],
    metric: 'playerRating',
    direction: 1,
  },
  {
    label: 'defending',
    position: 'CB',
    attributes: ['marking', 'tackling', 'interception'],
    metric: 'goalsAgainst',
    direction: -1,
  },
  {
    label: 'goalkeeper',
    position: 'GK',
    attributes: ['handling', 'reflexes'],
    metric: 'goalsAgainst',
    direction: -1,
  },
];

function boostedWorld(base: World, career: Career, family: AttributeFamily): World {
  const roles = formations[career.tactic.formation];
  const targetId = career.lineup.find((_, index) => roles[index] === family.position);
  if (!targetId) throw new Error(`No ${family.position} in the test lineup`);
  return {
    ...base,
    players: base.players.map((player) => {
      if (player.id !== targetId) return player;
      const attributes = { ...player.attributes };
      for (const key of family.attributes) attributes[key] = Math.min(99, attributes[key] + BOOST);
      return { ...player, attributes };
    }),
  };
}

function playGrid(career: Career, live: World, opponentId: string) {
  const totals = {
    goalsFor: 0,
    goalsAgainst: 0,
    xgFor: 0,
    xgAgainst: 0,
    possession: 0,
    playerRatings: {} as Record<string, number>,
  };
  for (let i = 0; i < SEEDS; i++) {
    const fixture: Fixture = {
      id: `attribute-impact-${i}`,
      date: career.date,
      round: 1,
      homeId: career.clubId,
      awayId: opponentId,
      playoff: false,
    };
    const matchCareer = { ...career, fixtures: [...career.fixtures, fixture] };
    const match = simulateMatch(matchCareer, live, fixture);
    totals.goalsFor += match.homeGoals;
    totals.goalsAgainst += match.awayGoals;
    totals.xgFor += match.home.xg;
    totals.xgAgainst += match.away.xg;
    totals.possession += match.home.possession;
    for (const rating of matchRatings(matchCareer, live, match))
      totals.playerRatings[rating.id] = (totals.playerRatings[rating.id] || 0) + rating.rating;
  }
  return {
    goalsFor: totals.goalsFor / SEEDS,
    goalsAgainst: totals.goalsAgainst / SEEDS,
    xgFor: totals.xgFor / SEEDS,
    xgAgainst: totals.xgAgainst / SEEDS,
    possession: totals.possession / SEEDS,
    playerRatings: Object.fromEntries(
      Object.entries(totals.playerRatings).map(([id, rating]) => [id, rating / SEEDS]),
    ),
  };
}

describe('efeito de atributos individuais nas partidas', () => {
  it('muda desempenho real ao elevar uma família de atributos por vez', () => {
    const career = createCareer(world, manager, 'sao-paulo', 'Amador', 'Realista', 7);
    const live = careerWorld(world, career);
    const ownOvr = npcTactic(career, live, career.clubId).ovr;
    const opponent = live.clubs
      .filter((club) => club.id !== career.clubId)
      .sort(
        (a, b) =>
          Math.abs(npcTactic(career, live, a.id).ovr - ownOvr) -
          Math.abs(npcTactic(career, live, b.id).ovr - ownOvr),
      )[0];
    const baseline = playGrid(career, live, opponent.id);
    const rows: string[] = [];

    for (const family of families) {
      const modified = boostedWorld(live, career, family);
      const result = playGrid(career, modified, opponent.id);
      const targetId = career.lineup.find(
        (_, index) => formations[career.tactic.formation][index] === family.position,
      )!;
      const before =
        family.metric === 'playerRating'
          ? baseline.playerRatings[targetId]
          : baseline[family.metric];
      const after =
        family.metric === 'playerRating' ? result.playerRatings[targetId] : result[family.metric];
      const delta = after - before;
      rows.push(
        `${family.label.padEnd(16)} ${family.metric} ${before.toFixed(2)} → ${after.toFixed(2)} (${delta >= 0 ? '+' : ''}${delta.toFixed(2)})`,
      );
      expect(
        family.direction * delta,
        `${family.label} must improve ${family.metric}`,
      ).toBeGreaterThan(family.metric === 'playerRating' ? 0.05 : 0.03);
    }

    console.log(
      `\nATRIBUTOS (São Paulo x ${opponent.name}; ${SEEDS} seeds pareados; +${BOOST} por atributo, até 99)\n` +
        `base: ${baseline.goalsFor.toFixed(2)}–${baseline.goalsAgainst.toFixed(2)} gols/j, ` +
        `${baseline.xgFor.toFixed(2)}–${baseline.xgAgainst.toFixed(2)} xG/j, posse ${baseline.possession.toFixed(1)}%\n` +
        rows.join('\n'),
    );
  }, 120_000);
});
