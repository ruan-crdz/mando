import { type Career, type World } from './types';

export const trainingEffect = () => ({
  growth: 0,
  decay: 0.15,
  injury: 0,
});

export const youthBonus = () => 0;

export const tvIncome = (reputation: number) => Math.round(reputation * 75000 + 3e6);

export function economyMonth(career: Career, world: World) {
  const reputation = world.clubs.find((club) => club.id === career.clubId)?.reputation ?? 70;
  return { tv: tvIncome(reputation) };
}
