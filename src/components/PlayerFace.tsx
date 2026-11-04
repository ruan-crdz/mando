import { useState } from 'react';
import faces from '../game/data/player-faces.json';
import { hash } from '../game/random';
import { type Player } from '../game/types';

const available = new Set<string>(faces);

export const playerFaceUrl = (id: string) =>
  available.has(id) ? `${import.meta.env.BASE_URL}assets/jogadores/${id}.webp` : null;

const initials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts.at(-1)![0] : name.slice(0, 2)).toUpperCase();
};

/** Rosto real do atleta; sem foto, um avatar gerado e estável por atleta. */
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
  const hue = hash(player.id) % 360;
  return (
    <span
      className={`player-face generated ${size} ${className}`}
      aria-hidden="true"
      style={{ background: `linear-gradient(160deg, hsl(${hue} 45% 42%), hsl(${hue} 55% 18%))` }}
    >
      <svg viewBox="0 0 64 64">
        <circle cx="32" cy="25" r="12" />
        <path d="M8 64c2-14 12-21 24-21s22 7 24 21z" />
      </svg>
      <b>{initials(player.name)}</b>
    </span>
  );
}
