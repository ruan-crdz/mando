import { useId, type ReactElement } from 'react';

type Shape = 'classic' | 'globe' | 'flag' | 'ball' | 'tall';
type Metal = 'gold' | 'silver';

const styles: Record<string, { shape: Shape; metal: Metal; accent: Metal }> = {
  A: { shape: 'flag', metal: 'silver', accent: 'gold' },
  B: { shape: 'tall', metal: 'silver', accent: 'silver' },
  CDB: { shape: 'classic', metal: 'gold', accent: 'gold' },
  SUP: { shape: 'ball', metal: 'silver', accent: 'gold' },
  LIB: { shape: 'globe', metal: 'silver', accent: 'silver' },
  SUL: { shape: 'tall', metal: 'gold', accent: 'silver' },
};

const stops: Record<Metal, string[]> = {
  gold: ['#fff6c2', '#ffd84a', '#d99a0b', '#7a4f00'],
  silver: ['#ffffff', '#e3e7ec', '#9aa3ad', '#4b525b'],
};

export function TrophyArt({ id, className }: { id: string; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const style = styles[id] || {
    shape: 'classic' as Shape,
    metal: 'silver' as Metal,
    accent: 'gold' as Metal,
  };
  const m = `url(#m${uid})`;
  const a = `url(#a${uid})`;
  const wood = `url(#w${uid})`;
  const grad = (key: string, metal: Metal) => (
    <linearGradient id={key} x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stopColor={stops[metal][3]} />
      <stop offset="0.22" stopColor={stops[metal][1]} />
      <stop offset="0.38" stopColor={stops[metal][0]} />
      <stop offset="0.62" stopColor={stops[metal][2]} />
      <stop offset="1" stopColor={stops[metal][3]} />
    </linearGradient>
  );

  const base = (
    <g>
      <ellipse cx="100" cy="292" rx="62" ry="6" fill="rgba(0,0,0,0.45)" />
      <path d="M44 262 h112 l-4 28 H48 Z" fill={wood} />
      <path d="M58 240 h84 l-3 22 H61 Z" fill={wood} opacity="0.92" />
      <rect x="56" y="238" width="88" height="4" rx="2" fill={a} />
      <rect x="78" y="268" width="44" height="12" rx="2" fill={a} />
    </g>
  );

  const shine = (d: string) => (
    <path d={d} fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.55" />
  );

  let body;
  switch (style.shape) {
    case 'globe':
      body = (
        <g>
          <rect x="48" y="196" width="104" height="94" rx="6" fill={wood} />
          {[0, 1, 2, 3].map((r) =>
            [0, 1, 2].map((col) => (
              <rect
                key={`${r}-${col}`}
                x={56 + col * 31}
                y={204 + r * 20}
                width="26"
                height="14"
                rx="1.5"
                fill={m}
                opacity="0.95"
              />
            )),
          )}
          <rect x="54" y="180" width="92" height="18" rx="4" fill={m} />
          <path d="M88 180 Q96 160 96 132 h8 Q104 160 112 180 Z" fill={m} />
          <circle cx="100" cy="96" r="42" fill={m} />
          <ellipse
            cx="100"
            cy="98"
            rx="42"
            ry="9"
            fill="none"
            stroke={stops.silver[3]}
            strokeWidth="3"
          />
          <rect x="48" y="88" width="12" height="18" rx="3" fill={m} />
          <rect x="140" y="88" width="12" height="18" rx="3" fill={m} />
          {shine('M74 72 Q80 62 92 58')}
          <circle cx="100" cy="36" r="6" fill={m} />
          <path d="M96 43 h8 l2 14 l6 10 l-4 2 l-6 -8 l-4 8 l-5 -2 l4 -10 Z" fill={m} />
          <circle cx="112" cy="56" r="4" fill={m} />
        </g>
      );
      return frame(uid, grad, style, wood, body, false, undefined, className);
    case 'flag':
      body = (
        <g>
          <rect x="93" y="30" width="14" height="212" rx="5" fill={m} />
          <path d="M107 44 C140 30 152 66 176 54 L176 118 C152 132 140 96 107 110 Z" fill={m} />
          <path
            d="M93 70 C64 58 54 92 30 82 L30 140 C54 152 64 118 93 130 Z"
            fill={m}
            opacity="0.88"
          />
          <path
            d="M107 128 C134 120 146 150 166 142 L166 168 C146 178 134 150 107 156 Z"
            fill={a}
          />
          <path
            d="M93 150 C70 144 62 168 44 162 L44 182 C62 190 70 168 93 174 Z"
            fill={a}
            opacity="0.9"
          />
          <circle cx="100" cy="26" r="10" fill={a} />
          {shine('M112 52 C130 44 140 58 150 62')}
        </g>
      );
      break;
    case 'ball':
      body = (
        <g>
          <path d="M92 240 V150 L62 100 l8 -6 l26 40 h8 l26 -40 l8 6 L108 150 V240 Z" fill={m} />
          <path d="M92 196 l-22 -22 l6 -6 l16 16 Z M108 196 l22 -22 l-6 -6 l-16 16 Z" fill={m} />
          <ellipse cx="100" cy="94" rx="44" ry="8" fill={a} />
          <circle cx="100" cy="58" r="38" fill={m} />
          <path d="M100 42 l14 10 l-5 16 h-18 l-5 -16 Z" fill={stops.silver[3]} opacity="0.8" />
          <path
            d="M100 42 V22 M114 52 l18 -6 M109 68 l12 14 M91 68 l-12 14 M86 52 l-18 -6"
            stroke={stops.silver[3]}
            strokeWidth="2.5"
            opacity="0.7"
          />
          {shine('M76 44 Q82 32 94 28')}
        </g>
      );
      break;
    case 'tall':
      body = (
        <g>
          <ellipse cx="100" cy="238" rx="34" ry="7" fill={a} />
          <path d="M90 236 Q94 214 96 196 h8 Q106 214 110 236 Z" fill={m} />
          <ellipse cx="100" cy="200" rx="14" ry="6" fill={a} />
          <path d="M60 52 Q58 150 94 196 h12 Q142 150 140 52 Z" fill={m} />
          <ellipse cx="100" cy="52" rx="40" ry="9" fill={a} />
          <path d="M64 120 Q100 136 136 120" fill="none" stroke={a} strokeWidth="6" />
          <path
            d="M60 64 C36 64 34 120 70 136 M140 64 C164 64 166 120 130 136"
            fill="none"
            stroke={m}
            strokeWidth="8"
            strokeLinecap="round"
          />
          {shine('M72 70 Q70 120 88 168')}
        </g>
      );
      break;
    default:
      body = (
        <g>
          <ellipse cx="100" cy="238" rx="36" ry="7" fill={m} />
          <path d="M88 236 Q94 214 96 192 h8 Q106 214 112 236 Z" fill={m} />
          <ellipse cx="100" cy="206" rx="12" ry="6" fill={a} />
          <path d="M46 84 Q46 162 92 190 h16 Q154 162 154 84 Z" fill={m} />
          <path
            d="M48 96 C14 96 14 156 72 166 M152 96 C186 96 186 156 128 166"
            fill="none"
            stroke={m}
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path d="M56 120 h88" stroke={a} strokeWidth="5" />
          <ellipse cx="100" cy="84" rx="54" ry="10" fill={a} />
          <path d="M62 80 Q100 36 138 80 Z" fill={m} />
          <circle cx="100" cy="42" r="9" fill={a} />
          {shine('M62 100 Q62 150 90 180')}
        </g>
      );
  }
  return frame(uid, grad, style, wood, body, true, base, className);
}

function frame(
  uid: string,
  grad: (key: string, metal: Metal) => ReactElement,
  style: { metal: Metal; accent: Metal },
  _wood: string,
  body: ReactElement,
  withBase: boolean,
  base?: ReactElement,
  className?: string,
) {
  return (
    <svg className={className || 'trophy-art'} viewBox="0 0 200 300" aria-hidden="true">
      <defs>
        {grad(`m${uid}`, style.metal)}
        {grad(`a${uid}`, style.accent)}
        <linearGradient id={`w${uid}`} x1="0" x2="1">
          <stop offset="0" stopColor="#2a1206" />
          <stop offset="0.4" stopColor="#6b3414" />
          <stop offset="1" stopColor="#24100a" />
        </linearGradient>
        <radialGradient id={`g${uid}`} cx="0.5" cy="0.35" r="0.6">
          <stop offset="0" stopColor="rgba(255,230,140,0.35)" />
          <stop offset="1" stopColor="rgba(255,230,140,0)" />
        </radialGradient>
      </defs>
      <rect width="200" height="300" fill={`url(#g${uid})`} />
      {withBase && base}
      {body}
    </svg>
  );
}
