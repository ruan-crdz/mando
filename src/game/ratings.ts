import { type Attributes, type Player, type PlayerState, type Position } from './types';
import { clamp } from './random';

export const weights: Record<Position, Partial<Record<keyof Attributes, number>>> = {
  GK: { reflexes: 30, handling: 25, diving: 25, positioning: 10, composure: 5, shortPass: 5 },
  CB: {
    marking: 22,
    tackling: 20,
    interception: 18,
    heading: 15,
    strength: 10,
    positioning: 10,
    pace: 5,
  },
  LB: {
    pace: 15,
    stamina: 15,
    tackling: 20,
    marking: 15,
    shortPass: 15,
    longPass: 10,
    interception: 10,
  },
  RB: {
    pace: 15,
    stamina: 15,
    tackling: 20,
    marking: 15,
    shortPass: 15,
    longPass: 10,
    interception: 10,
  },
  DM: {
    interception: 20,
    tackling: 20,
    shortPass: 20,
    positioning: 15,
    stamina: 10,
    longPass: 10,
    strength: 5,
  },
  CM: { shortPass: 25, longPass: 20, vision: 15, control: 15, stamina: 15, tackling: 10 },
  AM: { vision: 25, shortPass: 20, control: 20, dribbling: 15, finishing: 10, composure: 10 },
  LW: { pace: 20, acceleration: 15, dribbling: 25, control: 15, finishing: 15, shortPass: 10 },
  RW: { pace: 20, acceleration: 15, dribbling: 25, control: 15, finishing: 15, shortPass: 10 },
  ST: { finishing: 30, positioning: 20, composure: 15, heading: 15, strength: 10, pace: 10 },
};

export function overall(
  player: Player,
  position: string = player.position,
  state?: PlayerState,
): number {
  const role = position === 'LM' ? 'LW' : position === 'RM' ? 'RW' : position;
  const entries = Object.entries(weights[role as Position] || weights[player.position]) as [
    keyof Attributes,
    number,
  ][];
  return Math.round(
    clamp(
      entries.reduce((sum, [key, w]) => sum + player.attributes[key] * w, 0) / 100 +
        (state?.growth || 0),
      1,
      99,
    ),
  );
}
