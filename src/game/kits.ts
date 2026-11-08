/** Uniformes 1 (casa) e 2 (fora) de cada clube: cor da camisa e cor do número. */
export type Kit = { shirt: string; text: string };
type Kits = { home: Kit; away: Kit };

const k = (shirt: string, text: string): Kit => ({ shirt, text });
const W = '#ffffff';
const B = '#141414';

const clubKits: Record<string, Kits> = {
  flamengo: { home: k('#c4161c', B), away: k(W, '#c4161c') },
  palmeiras: { home: k('#006437', W), away: k(W, '#006437') },
  cruzeiro: { home: k('#0b3fa8', W), away: k(W, '#0b3fa8') },
  mirassol: { home: k('#f2c500', '#0a7a3b'), away: k('#0a7a3b', '#f2c500') },
  fluminense: { home: k('#7a1e3a', W), away: k(W, '#7a1e3a') },
  botafogo: { home: k(B, W), away: k(W, B) },
  bahia: { home: k(W, '#1d4fa0'), away: k('#1d4fa0', W) },
  'sao-paulo': { home: k(W, '#d0021b'), away: k('#d0021b', W) },
  gremio: { home: k('#0d80bf', W), away: k(W, '#0d80bf') },
  bragantino: { home: k(W, '#d0103a'), away: k('#0d1b3e', W) },
  'atletico-mg': { home: k(B, W), away: k(W, B) },
  santos: { home: k(W, B), away: k(B, W) },
  corinthians: { home: k(W, B), away: k(B, W) },
  vasco: { home: k(B, W), away: k(W, B) },
  vitoria: { home: k('#c8102e', B), away: k(W, '#c8102e') },
  internacional: { home: k('#d50032', W), away: k(W, '#d50032') },
  coritiba: { home: k(W, '#00543c'), away: k('#00543c', W) },
  athletico: { home: k('#c8102e', B), away: k(B, '#c8102e') },
  chapecoense: { home: k('#00843d', W), away: k(W, '#00843d') },
  remo: { home: k('#0b1f4b', W), away: k(W, '#0b1f4b') },
  sport: { home: k('#c8102e', B), away: k(W, '#c8102e') },
  fortaleza: { home: k('#1d3f94', W), away: k(W, '#1d3f94') },
  ceara: { home: k(B, W), away: k(W, B) },
  juventude: { home: k('#007a3d', W), away: k(W, '#007a3d') },
  'atletico-go': { home: k('#c8102e', B), away: k(W, '#c8102e') },
  goias: { home: k('#00693c', W), away: k(W, '#00693c') },
  cuiaba: { home: k('#f0c400', '#00843d'), away: k('#00843d', '#f0c400') },
  america: { home: k('#00843d', W), away: k(W, '#00843d') },
  novorizontino: { home: k('#f2c500', B), away: k(B, '#f2c500') },
  crb: { home: k('#c8102e', W), away: k(W, '#c8102e') },
  avai: { home: k('#0055a5', W), away: k(W, '#0055a5') },
  'vila-nova': { home: k('#c8102e', W), away: k(W, '#c8102e') },
  operario: { home: k(B, W), away: k(W, B) },
  athletic: { home: k(B, W), away: k(W, B) },
  'botafogo-sp': { home: k('#c8102e', W), away: k(W, '#c8102e') },
  criciuma: { home: k('#f6c700', B), away: k(B, '#f6c700') },
  'ponte-preta': { home: k(W, B), away: k(B, W) },
  londrina: { home: k('#4aa3df', W), away: k(W, '#1d3f94') },
  'sao-bernardo': { home: k('#f2c500', B), away: k(B, '#f2c500') },
  nautico: { home: k('#c8102e', W), away: k(W, '#c8102e') },
};

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const light = (hex: string) => {
  const [r, g, b] = rgb(hex);
  return r * 0.299 + g * 0.587 + b * 0.114 > 160;
};
/** Distância perceptiva aproximada entre duas cores. */
export const colorDistance = (a: string, b: string) => {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const r = (r1 + r2) / 2;
  return Math.sqrt(
    (2 + r / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - r) / 256) * (b1 - b2) ** 2,
  );
};
const clash = (a: Kit, b: Kit) => colorDistance(a.shirt, b.shirt) < 220;

/** Uniformes do clube; sem cadastro, o 1 usa a cor do clube e o 2 é branco (ou preto). */
export function kitsOf(club: { id?: string; color: string }): Kits {
  const known = club.id ? clubKits[club.id] : undefined;
  if (known) return known;
  const home = k(club.color, light(club.color) ? B : W);
  return { home, away: light(club.color) ? k(B, club.color) : k(W, club.color) };
}

/**
 * Uniformes da partida: o mandante joga com o 1; o visitante usa o 1 se não repetir a cor,
 * senão o 2, e em último caso um terceiro uniforme neutro. Nunca dois times da mesma cor.
 */
export function matchKits(
  home: { id?: string; color: string },
  away: { id?: string; color: string },
): { home: Kit & { number: 1 | 2 | 3 }; away: Kit & { number: 1 | 2 | 3 } } {
  const h = kitsOf(home).home;
  const a = kitsOf(away);
  if (!clash(h, a.home)) return { home: { ...h, number: 1 }, away: { ...a.home, number: 1 } };
  if (!clash(h, a.away)) return { home: { ...h, number: 1 }, away: { ...a.away, number: 2 } };
  const third = [k('#f2c500', B), k(B, W), k(W, B), k('#1d3f94', W)].sort(
    (x, y) => colorDistance(y.shirt, h.shirt) - colorDistance(x.shirt, h.shirt),
  )[0];
  return { home: { ...h, number: 1 }, away: { ...third, number: 3 } };
}
