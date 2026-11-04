import { useState } from 'react';
import faces from '../game/data/player-faces.json';
import { type Player } from '../game/types';

const available = new Set<string>(faces);

export const playerFaceUrl = (id: string) =>
  available.has(id) ? `${import.meta.env.BASE_URL}assets/jogadores/${id}.webp` : null;

/** Rosto real do atleta; sem foto, um bonequinho neutro. */
export function PlayerFace({
  player,
  size = 'md',
  className = '',
}: {
  player: Pick<Player, 'id' | 'name'>;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const url = broken ? null : playerFaceUrl(player.id);
  if (url)
    return (
      <span className={`player-face ${size} ${className}`} aria-hidden="true">
        <img src={url} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />
      </span>
    );
  return (
    <span className={`player-face generated ${size} ${className}`} aria-hidden="true">
      <svg viewBox="0 0 64 64" preserveAspectRatio="xMidYMax meet">
        <circle cx="32" cy="22" r="13" />
        <path d="M6 64c2-16 13-24 26-24s24 8 26 24z" />
      </svg>
    </span>
  );
}
