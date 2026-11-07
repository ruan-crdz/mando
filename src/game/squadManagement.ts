import { z } from 'zod';
import { available, syncBenchWithLineup } from './matches';
import { ageAt, hash } from './random';
import { familiarity, LEARNED, trainingGain } from './positions';
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

export const ASSISTANT_STAFF_LIMIT = 4;
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

const assistantTemplates: Record<
  AssistantArea,
  {
    name: string;
    vision: 'Ofensivo' | 'Retranqueiro' | 'Pressão' | 'Posse' | 'Contra-ataque';
    skill: number;
  }
> = {
  ataque: { name: 'Rafael Nascimento', vision: 'Ofensivo', skill: 3 },
  meio: { name: 'Marina Alves', vision: 'Posse', skill: 3 },
  defesa: { name: 'Bruno Carvalho', vision: 'Retranqueiro', skill: 3 },
  goleiro: { name: 'Diego Martins', vision: 'Pressão', skill: 3 },
};

export function assistantCandidates(career: Career, area: AssistantArea): AssistantCoach[] {
  const positionsForArea: Record<AssistantArea, Position[]> = {
    ataque: ['LW', 'RW', 'ST', 'AM'],
    meio: ['DM', 'CM', 'AM'],
    defesa: ['CB', 'LB', 'RB', 'DM'],
    goleiro: ['GK'],
  };
  const names = ['Lucas Ferreira', 'Ana Ribeiro', 'Caio Mendes', 'Elisa Rocha', 'Pedro Santos'];
  return names.map((name, index) => {
    const skill = index + 1;
    const id = `assistant-${career.season}-${area}-${index}`;
    const specialty =
      positionsForArea[area][hash(`${career.seed}:${id}`) % positionsForArea[area].length];
    const stars = Object.fromEntries(
      positionSchema.options.map((position) => [
        position,
        position === specialty
          ? Math.min(5, skill + 1)
          : positionsForArea[area].includes(position)
            ? Math.max(1, skill - 1)
            : 1,
      ]),
    ) as Record<Position, number>;
    return {
      id,
      name,
      skill,
      stars,
      tacticalVision: assistantTemplates[area].vision,
      wageWeekly: [600, 1100, 2100, 3400, 5000][index],
    };
  });
}

export function assistantTrainingBonus(career: Career, position: Position): number {
  return Math.max(
    0,
    ...Object.values(career.assistantCoaches).map(
      (coach) => (coach.skill + coach.stars[position] - 1) * 0.04,
    ),
  );
}

export function hireAssistant(career: Career, area: AssistantArea, candidateId: string): Career {
  if (!assistantAreas.includes(area)) throw new Error('Área de comissão inválida.');
  if (career.assistantCoaches[area]) throw new Error('Esta vaga já está ocupada.');
  if (Object.keys(career.assistantCoaches).length >= ASSISTANT_STAFF_LIMIT)
    throw new Error('O limite de auxiliares da comissão foi atingido.');
  const candidate = assistantCandidates(career, area).find((coach) => coach.id === candidateId);
  if (!candidate) throw new Error('Auxiliar não encontrado na lista de candidatos.');
  return {
    ...career,
    assistantCoaches: {
      ...career.assistantCoaches,
      [area]: candidate,
    },
  };
}

export function fireAssistant(career: Career, area: AssistantArea): Career {
  const assistantCoaches = { ...career.assistantCoaches };
  delete assistantCoaches[area];
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
