import { type Career, type Player, type PlayerState, type Position, positions } from './types';

/** Coordenadas aproximadas de cada função no campo (x: esquerda→direita, y: própria meta→ataque). */
export const pitchSpot: Record<Position, { x: number; y: number }> = {
  GK: { x: 50, y: 6 },
  CB: { x: 50, y: 24 },
  LB: { x: 12, y: 30 },
  RB: { x: 88, y: 30 },
  DM: { x: 50, y: 42 },
  CM: { x: 50, y: 55 },
  AM: { x: 50, y: 70 },
  LW: { x: 14, y: 76 },
  RW: { x: 86, y: 76 },
  ST: { x: 50, y: 88 },
};

export const positionNames: Record<Position, string> = {
  GK: 'Goleiro',
  CB: 'Zagueiro',
  LB: 'Lateral esquerdo',
  RB: 'Lateral direito',
  DM: 'Volante',
  CM: 'Meia central',
  AM: 'Meia-atacante',
  LW: 'Ponta esquerda',
  RW: 'Ponta direita',
  ST: 'Centroavante',
};

/** LM/RM das formações usam as notas de ponta. */
export const roleOf = (position: string): Position =>
  position === 'LM' ? 'LW' : position === 'RM' ? 'RW' : (position as Position);

/** Familiaridade natural (sem treino) entre duas funções, de 5 a 100. */
export function naturalFamiliarity(from: Position, to: Position): number {
  if (from === to) return 100;
  if (from === 'GK' || to === 'GK') return 5;
  const a = pitchSpot[from];
  const b = pitchSpot[to];
  const d = Math.hypot((a.x - b.x) * 0.6, a.y - b.y);
  return Math.max(10, Math.round(100 - d * 1.4));
}

/** Nível de treino máximo alcançável numa posição nova. */
export const TRAIN_CAP = 92;
/** A partir daqui o atleta é considerado apto e a posição vira secundária. */
export const LEARNED = 85;

/** Quanto o atleta conhece a função (100 = posição principal). */
export function familiarity(player: Player, position: string, state?: PlayerState): number {
  const role = roleOf(position);
  if (role === player.position) return 100;
  const secondary = player.secondary?.indexOf(role) ?? -1;
  return Math.max(
    naturalFamiliarity(player.position, role),
    secondary === 0 ? 92 : secondary > 0 ? 87 : 0,
    state?.trained?.[role] ?? 0,
  );
}

/** Pontos de overall perdidos fora de posição. */
export const positionPenalty = (fam: number) => Math.round((100 - fam) * 0.22);

/** Rótulo curto do nível de adaptação. */
export const familiarityLabel = (fam: number) =>
  fam >= 100
    ? 'Natural'
    : fam >= LEARNED
      ? 'Apto'
      : fam >= 65
        ? 'Adaptável'
        : fam >= 40
          ? 'Improvisado'
          : 'Fora de posição';

/** Posições que o atleta já domina (principal, secundárias e treinadas). */
export function knownPositions(player: Player, state?: PlayerState): Position[] {
  return positions.filter((p) => familiarity(player, p, state) >= LEARNED);
}

/** Ganho diário de treino conforme a idade. */
export const trainingGain = (age: number) => (age <= 23 ? 1.5 : age <= 29 ? 1 : 0.6);

/** Escolhe (ou cancela, com null) a posição que o atleta treina diariamente. */
export function setTraining(career: Career, player: Player, role: Position | null): Career {
  const s = career.players[player.id];
  if (!s || s.clubId !== career.clubId)
    throw new Error('Só é possível treinar atletas do seu elenco.');
  if (role && (role === 'GK') !== (player.position === 'GK'))
    throw new Error('Goleiros e jogadores de linha não trocam de função no treino.');
  if (role && familiarity(player, role, s) >= TRAIN_CAP)
    throw new Error('O atleta já domina esta posição.');
  const next = { ...s };
  if (role) next.training = role;
  else delete next.training;
  return { ...career, players: { ...career.players, [player.id]: next } };
}

/** Define a posição principal do atleta; exige que ele já seja apto na função. */
export function setMainPosition(career: Career, player: Player, role: Position): Career {
  const s = career.players[player.id];
  if (!s || s.clubId !== career.clubId)
    throw new Error('Só é possível alterar atletas do seu elenco.');
  if (role === player.position) return career;
  if (familiarity(player, role, s) < LEARNED)
    throw new Error('Treine o atleta nesta posição antes de torná-la principal.');
  const next = { ...s, position: role, trained: { ...s.trained, [player.position]: 100 } };
  if (next.training === role) delete next.training;
  return { ...career, players: { ...career.players, [player.id]: next } };
}
