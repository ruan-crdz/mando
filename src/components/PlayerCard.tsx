import { type ReactNode } from 'react';
import { stateOf } from '../game/matches';
import { overall } from '../game/ratings';
import { type Career, type Player, type Position } from '../game/types';
import { cardTier } from './cardTier';
import { PlayerFace } from './PlayerFace';

const group = (pos: string) =>
  pos === 'GK'
    ? 'gk'
    : ['CB', 'LB', 'RB'].includes(pos)
      ? 'def'
      : ['DM', 'CM', 'AM', 'LM', 'RM'].includes(pos)
        ? 'mid'
        : 'att';

export const positionOrder: Position[] = [
  'GK',
  'CB',
  'LB',
  'RB',
  'DM',
  'CM',
  'AM',
  'LW',
  'RW',
  'ST',
];
export const shortName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return parts.length > 2 ? parts.at(-1)! : name;
};

/** Card quadrado de atleta, no estilo dos cards do Ultimate Team. */
export function PlayerCard({
  player,
  career,
  role,
  onClick,
  active = false,
  disabled = false,
  autoFocus = false,
  badge,
}: {
  player: Player;
  career: Career;
  role?: string;
  number?: number;
  note?: ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  badge?: ReactNode;
}) {
  const s = stateOf(career, player.id)!;
  const ovr = overall(player, role || player.position, s);
  const status = s.injuryDays
    ? `Lesão ${s.injuryDays}d`
    : s.suspension
      ? `Suspenso ${s.suspension}`
      : null;
  return (
    <button
      type="button"
      className={`player-card ${group(player.position)} ${cardTier(ovr)} ${active ? 'active' : ''} ${status ? 'out' : ''}`}
      onClick={onClick}
      disabled={disabled}
      data-player={player.id}
      data-autofocus={autoFocus ? '' : undefined}
      aria-label={`${player.name}, ${player.position}, overall ${ovr}${status ? `, ${status}` : ''}`}
    >
      <span className="pc-top">
        <strong className="pc-ovr">{ovr}</strong>
        <span className="pc-pos">{role && role !== player.position ? role : player.position}</span>
      </span>
      <PlayerFace player={player} className="pc-face" />
      {badge && <span className="pc-badge">{badge}</span>}
      <strong className="pc-name">{shortName(player.name)}</strong>
      {status && <span className="pc-meta">{status}</span>}
    </button>
  );
}

/**
 * Grade de cards (5 por linha): recomendados primeiro, um divisor e o restante
 * do elenco ordenado por posição.
 */
export function PlayerPicker({
  recommended,
  others,
  render,
  recommendedLabel = 'Recomendados',
  othersLabel = 'Demais atletas',
  extra,
}: {
  recommended: Player[];
  others: Player[];
  render: (p: Player, index: number) => ReactNode;
  recommendedLabel?: string;
  othersLabel?: string;
  extra?: ReactNode;
}) {
  return (
    <div className="card-scroll">
      {recommended.length > 0 && (
        <>
          <p className="grid-divider">{recommendedLabel}</p>
          <div className="card-grid">
            {extra}
            {recommended.map((p, i) => render(p, i))}
          </div>
        </>
      )}
      <p className="grid-divider">{othersLabel}</p>
      <div className="card-grid">
        {!recommended.length && extra}
        {others.map((p, i) => render(p, recommended.length + i))}
      </div>
    </div>
  );
}

export const byPosition = (career: Career) => (a: Player, b: Player) =>
  positionOrder.indexOf(a.position) - positionOrder.indexOf(b.position) ||
  overall(b, b.position, stateOf(career, b.id)) - overall(a, a.position, stateOf(career, a.id));

/** Posições naturais que servem para cada função da formação. */
export const roleFits: Record<string, string[]> = {
  GK: ['GK'],
  CB: ['CB', 'DM'],
  LB: ['LB', 'LW', 'CB'],
  RB: ['RB', 'RW', 'CB'],
  DM: ['DM', 'CM', 'CB'],
  CM: ['CM', 'DM', 'AM'],
  AM: ['AM', 'CM', 'LW', 'RW'],
  LM: ['LW', 'CM', 'LB', 'AM'],
  RM: ['RW', 'CM', 'RB', 'AM'],
  LW: ['LW', 'RW', 'AM', 'ST'],
  RW: ['RW', 'LW', 'AM', 'ST'],
  ST: ['ST', 'AM', 'LW', 'RW'],
};
