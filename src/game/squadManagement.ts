import { z } from 'zod';
import { available, syncBenchWithLineup } from './matches';
import { ageAt, hash } from './random';
import { familiarity, LEARNED, trainingGain } from './positions';
import { assistantPayroll, salaryBudgets } from './staff';
import {
  assistantAreas,
  formations,
  positionSchema,
  type AssistantArea,
  type AssistantCoach,
  type Career,
  type Formation,
  type Player,
  type Position,
  type World,
} from './types';

export { syncBenchWithLineup };
const lineupFileSchema = z.object({
  format: z.literal('mando-lineup'),
  version: z.literal(1),
  name: z.string().min(1).max(32),
  formation: z.enum(Object.keys(formations) as [Formation, ...Formation[]]),
  playerIds: z.array(z.string().min(1)).length(11),
});

export function selectBenchPlayer(career: Career, playerId: string): Career {
  const player = career.players[playerId];
  if (!player || player.clubId !== career.clubId)
    throw new Error('Só é possível selecionar reservas do seu elenco.');
  if (career.lineup.includes(playerId)) throw new Error('O atleta já está entre os titulares.');
  if (career.bench.includes(playerId)) throw new Error('O atleta já está entre os reservas.');
  if (career.bench.length >= 9) throw new Error('O banco comporta no máximo nove atletas.');
  return { ...career, bench: [...career.bench, playerId], benchConfigured: true };
}

export function removeBenchPlayer(career: Career, playerId: string): Career {
  return {
    ...career,
    bench: career.bench.filter((id) => id !== playerId),
    benchConfigured: true,
  };
}

export function replaceBenchPlayer(career: Career, incoming: string, outgoing: string): Career {
  if (!career.bench.includes(outgoing))
    throw new Error('Escolha um atleta do banco para substituir.');
  if (career.lineup.includes(incoming) || career.bench.includes(incoming))
    throw new Error('O atleta deve estar fora da relação.');
  if (career.players[incoming]?.clubId !== career.clubId || !available(career, incoming))
    throw new Error('O atleta não está disponível para o banco.');
  return {
    ...career,
    bench: career.bench.map((id) => (id === outgoing ? incoming : id)),
    benchConfigured: true,
  };
}

export function swapBenchPlayers(career: Career, first: string, second: string): Career {
  if (!career.bench.includes(first) || !career.bench.includes(second))
    throw new Error('Escolha dois atletas do banco para trocar a ordem.');
  if (first === second) throw new Error('Escolha reservas diferentes.');
  return {
    ...career,
    bench: career.bench.map((id) => (id === first ? second : id === second ? first : id)),
    benchConfigured: true,
  };
}

export function lineupImportError(
  input: string,
  career: Career,
  world: World,
): { name: string; formation: Formation; playerIds: string[] } {
  let decoded: unknown;
  try {
    decoded = JSON.parse(input);
  } catch {
    throw new Error('Arquivo de escalação inválido: o JSON não pôde ser lido.');
  }
  const parsed = lineupFileSchema.safeParse(decoded);
  if (!parsed.success) throw new Error('Arquivo de escalação inválido ou incompatível.');
  const { playerIds, formation } = parsed.data;
  if (new Set(playerIds).size !== 11) throw new Error('A escalação contém atletas duplicados.');
  const players = new Map([...world.players, ...career.youth].map((player) => [player.id, player]));
  for (const id of playerIds) {
    const player = players.get(id);
    if (!player || career.players[id]?.clubId !== career.clubId)
      throw new Error('A escalação inclui atleta que não pertence ao seu elenco.');
    if (!available(career, id)) throw new Error('A escalação inclui atleta indisponível.');
  }
  if (players.get(playerIds[0])?.position !== 'GK')
    throw new Error('A primeira posição da escalação precisa ser ocupada por um goleiro.');
  return { name: parsed.data.name, formation, playerIds };
}

export function lineupExport(name: string, formation: Formation, playerIds: string[]) {
  const parsed = lineupFileSchema.parse({
    format: 'mando-lineup',
    version: 1,
    name,
    formation,
    playerIds,
  });
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

export function saveLineup(career: Career, name: string): Career {
  const cleanName = name.trim();
  if (!cleanName) throw new Error('Dê um nome para a escalação.');
  if (cleanName.length > 32) throw new Error('O nome pode ter no máximo 32 caracteres.');
  if (career.savedLineups.some((lineup) => lineup.name.toLowerCase() === cleanName.toLowerCase()))
    throw new Error('Já existe uma escalação com esse nome.');
  return {
    ...career,
    savedLineups: [
      ...career.savedLineups,
      { name: cleanName, formation: career.tactic.formation, playerIds: [...career.lineup] },
    ],
  };
}

export function applySavedLineup(career: Career, index: number, world: World): Career {
  const saved = career.savedLineups[index];
  if (!saved) throw new Error('Escalação salva não encontrada.');
  const imported = lineupImportError(
    JSON.stringify({
      format: 'mando-lineup',
      version: 1,
      name: saved.name,
      formation: saved.formation,
      playerIds: saved.playerIds,
    }),
    career,
    world,
  );
  return {
    ...syncBenchWithLineup(career, imported.playerIds),
    tactic: { ...career.tactic, formation: imported.formation },
  };
}

export const positionsForArea: Record<AssistantArea, Position[]> = {
  ataque: ['LW', 'RW', 'ST', 'AM'],
  meio: ['DM', 'CM', 'AM'],
  defesa: ['CB', 'LB', 'RB', 'DM'],
  goleiro: ['GK'],
};

export function assistantArea(key: string, coach: AssistantCoach): AssistantArea {
  const area = coach.area ?? assistantAreas.find((item) => item === key);
  if (!area) throw new Error('Auxiliar sem setor válido.');
  return area;
}

export function assistantCandidates(career: Career, area: AssistantArea): AssistantCoach[] {
  if (!assistantAreas.includes(area)) throw new Error('Área de comissão inválida.');
  const names = [
    'Lucas Ferreira',
    'Ana Ribeiro',
    'Caio Mendes',
    'Elisa Rocha',
    'Pedro Santos',
    'André Lima',
    'Beatriz Costa',
    'Daniel Souza',
    'Fernanda Reis',
    'Gustavo Almeida',
    'Helena Duarte',
    'Igor Teixeira',
    'Joana Barros',
    'Leandro Melo',
    'Mariana Azevedo',
    'Nicolas Ramos',
    'Olívia Nunes',
    'Paulo Vieira',
    'Renata Lopes',
    'Tiago Cardoso',
  ];
  const employed = new Set(Object.values(career.assistantCoaches).map((coach) => coach.name));
  return names
    .map((name, index) => {
      const skill = (index % 5) + 1;
      const id = `assistant-${index}`;
      const specialtyArea = assistantAreas[Math.floor(index / 5)];
      const specialty =
        positionsForArea[specialtyArea][
          hash(`${career.seed}:${id}`) % positionsForArea[specialtyArea].length
        ];
      const stars = Object.fromEntries(
        positionSchema.options.map((position) => [
          position,
          position === specialty
            ? Math.min(5, skill + 1)
            : positionsForArea[specialtyArea].includes(position)
              ? Math.max(1, skill - 1)
              : 1,
        ]),
      ) as Record<Position, number>;
      return {
        id,
        name,
        skill,
        stars,
        tacticalVision: (['Ofensivo', 'Posse', 'Retranqueiro', 'Pressão'] as const)[
          Math.floor(index / 5)
        ],
        wageWeekly: [600, 1100, 2100, 3400, 5000][index % 5],
      };
    })
    .filter((coach) => !employed.has(coach.name));
}

export function assistantTrainingBonus(career: Career, position: Position): number {
  return Math.max(
    0,
    ...Object.entries(career.assistantCoaches).map(([key, coach]) =>
      positionsForArea[assistantArea(key, coach)].includes(position)
        ? (coach.skill + coach.stars[position] - 1) * 0.04
        : 0,
    ),
  );
}

export function hireAssistant(career: Career, area: AssistantArea, candidateId: string): Career {
  if (!assistantAreas.includes(area)) throw new Error('Área de comissão inválida.');
  if (Object.values(career.assistantCoaches).some((coach) => coach.id === candidateId))
    throw new Error('Este auxiliar já está contratado em um setor.');
  const candidate = assistantCandidates(career, area).find((coach) => coach.id === candidateId);
  if (!candidate) throw new Error('Auxiliar não encontrado na lista de candidatos.');
  if (
    assistantPayroll(career) + candidate.wageWeekly * (52 / 12) >
    salaryBudgets(career).assistants
  )
    throw new Error(
      'Orçamento salarial dos auxiliares insuficiente. Redistribua o orçamento antes de contratar.',
    );
  return {
    ...career,
    assistantCoaches: {
      ...career.assistantCoaches,
      [candidateId]: { ...candidate, area },
    },
  };
}

export function fireAssistant(career: Career, id: string): Career {
  if (!career.assistantCoaches[id]) throw new Error('Auxiliar contratado não encontrado.');
  const assistantCoaches = { ...career.assistantCoaches };
  delete assistantCoaches[id];
  return { ...career, assistantCoaches };
}

/** Reuses the same age-based daily rate as position training in the match engine. */
export function positionTrainingEta(player: Player, career: Career, target: Position) {
  const current = familiarity(player, target, career.players[player.id]);
  if (current >= LEARNED) return { days: 0, weeks: 0, current, learned: true };
  if ((target === 'GK') !== (player.position === 'GK'))
    return { days: null, weeks: null, current, learned: false };
  const remaining = LEARNED - current;
  const injuredDays = career.players[player.id]?.injuryDays ?? 0;
  const injuryProgress = injuredDays * 0.2;
  const gain =
    trainingGain(ageAt(player.birthDate, career.date)) *
    (1 + assistantTrainingBonus(career, target));
  const days =
    remaining <= injuryProgress
      ? Math.ceil(remaining / 0.2)
      : injuredDays + Math.ceil((remaining - injuryProgress) / gain);
  return { days, weeks: Math.ceil(days / 7), current, learned: false };
}
