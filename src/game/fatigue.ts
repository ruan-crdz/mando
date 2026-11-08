import type { Player, Tactic } from './types';

/** Carga física de cada função: laterais, pontas e meias correm mais; goleiro quase nada. */
const roleLoad: Record<string, number> = {
  GK: 0.35,
  CB: 0.85,
  LB: 1.12,
  RB: 1.12,
  DM: 1,
  CM: 1.1,
  AM: 1,
  LM: 1.12,
  RM: 1.12,
  LW: 1.08,
  RW: 1.08,
  ST: 0.95,
};

/**
 * Condição gasta por minuto. Um titular médio termina 90 minutos com ~10–13 pontos a menos;
 * pressão sufocante, ritmo frenético, pouco fôlego e idade elevam o custo.
 */
export function minuteDrain(player: Player, role: string, tactic: Tactic, age: number) {
  const plan =
    0.12 +
    (tactic.pressure - 3) * 0.025 +
    (tactic.tempo - 3) * 0.01 +
    (tactic.mentality === 'Ofensiva' ? 0.008 : tactic.mentality === 'Defensiva' ? -0.006 : 0);
  const stamina = 1.35 - player.attributes.stamina / 200;
  const veteran = age > 30 ? 1 + (age - 30) * 0.03 : 1;
  return Math.max(0.03, plan) * (roleLoad[role] ?? 1) * stamina * veteran;
}

/**
 * Recuperação diária: rápida quando o atleta está muito desgastado e mais lenta perto de 100.
 * Um titular volta a ~97% em três dias; veteranos recuperam mais devagar e jovens mais rápido.
 */
export function dailyRecovery(fitness: number, age: number, injured: boolean, stamina = 70) {
  if (injured) return 1.5;
  const ageFactor = age >= 33 ? 0.8 : age >= 30 ? 0.9 : age <= 23 ? 1.1 : 1;
  const engine = 0.9 + stamina / 700;
  return (3 + Math.max(0, 100 - fitness) * 0.15) * ageFactor * engine;
}

/** Rendimento pela condição atual: quase nada acima de 75, cai de verdade abaixo de 55. */
export function conditionFactor(energy: number) {
  if (energy >= 75) return 1;
  if (energy >= 55) return 1 - (75 - energy) * 0.0035;
  return Math.max(0.6, 0.93 - (55 - energy) * 0.008);
}

/** Risco de lesão por minuto em campo: só sobe quando a condição está realmente baixa. */
export const injuryRisk = (energy: number) => 0.0011 + Math.max(0, 60 - energy) * 0.00025;
