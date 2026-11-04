import { useId } from 'react';
import { familiarity, familiarityLabel, pitchSpot, roleOf } from '../game/positions';
import { hash } from '../game/random';
import { type Player, type PlayerState } from '../game/types';
import { thresholdPercent } from './ui';

/**
 * Mapa de calor estimado do atleta numa função. Na posição natural a mancha
 * fica concentrada no setor; improvisado, ele "foge" para a posição de origem
 * e o calor se espalha pelo campo.
 */
export function HeatMap({
  player,
  position,
  state,
  compact = false,
}: {
  player: Player;
  position: string;
  state?: PlayerState;
  compact?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const role = roleOf(position);
  const fam = familiarity(player, role, state);
  const target = pitchSpot[role];
  const home = pitchSpot[player.position];
  const fit = fam / 100;
  // Pontos de calor: concentrados na função quando adaptado, dispersos quando não.
  const spread = 8 + (1 - fit) * 30;
  const blobs = Array.from({ length: 9 }, (_, i) => {
    const h = hash(`${player.id}:${role}:${i}`);
    const ax = ((h % 1000) / 1000 - 0.5) * 2;
    const ay = (((h >> 10) % 1000) / 1000 - 0.5) * 2;
    // Parte dos pontos é puxada para a posição de origem quando ele não conhece a função.
    const pull = i % 3 === 0 ? 1 - fit : (1 - fit) * 0.35;
    const cx = target.x + (home.x - target.x) * pull + ax * spread;
    const cy = target.y + (home.y - target.y) * pull + ay * spread * 1.2;
    return {
      x: Math.max(4, Math.min(96, cx)),
      y: 100 - Math.max(3, Math.min(97, cy)),
      r: 9 + fit * 7 + (h % 5),
      o: 0.35 + fit * 0.45 - (i % 3 === 0 ? 0.1 : 0),
    };
  });
  const tone = fam >= 85 ? 'good' : fam >= 60 ? 'mid' : 'bad';
  return (
    <figure className={`heat-map ${compact ? 'compact' : ''} ${tone}`}>
      <svg
        viewBox="0 0 100 140"
        role="img"
        aria-label={`Mapa de calor de ${player.name} como ${role}: ${familiarityLabel(fam)}`}
      >
        <defs>
          <radialGradient id={`hg-${id}`}>
            <stop offset="0%" stopColor="#ff2d2d" stopOpacity="1" />
            <stop offset="35%" stopColor="#ffb800" stopOpacity="0.85" />
            <stop offset="70%" stopColor="#c6ff00" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#00e5ff" stopOpacity="0" />
          </radialGradient>
          <filter id={`hb-${id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
        </defs>
        <rect x="0" y="0" width="100" height="140" rx="3" className="hm-grass" />
        <g className="hm-lines" fill="none">
          <rect x="3" y="3" width="94" height="134" />
          <line x1="3" y1="70" x2="97" y2="70" />
          <circle cx="50" cy="70" r="11" />
          <rect x="24" y="3" width="52" height="20" />
          <rect x="24" y="117" width="52" height="20" />
          <rect x="38" y="3" width="24" height="7" />
          <rect x="38" y="130" width="24" height="7" />
        </g>
        <g filter={`url(#hb-${id})`} style={{ mixBlendMode: 'screen' }}>
          {blobs.map((b, i) => (
            <ellipse
              key={i}
              cx={b.x}
              cy={b.y * 1.4}
              rx={b.r}
              ry={b.r * 1.25}
              fill={`url(#hg-${id})`}
              opacity={b.o}
            />
          ))}
        </g>
        <circle cx={target.x} cy={(100 - target.y) * 1.4} r="2.6" className="hm-role" />
      </svg>
      <figcaption>
        <strong>{role}</strong> · {familiarityLabel(fam)} · {thresholdPercent(fam)}%
      </figcaption>
    </figure>
  );
}
