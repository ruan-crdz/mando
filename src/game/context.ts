import { clamp, hash, random } from './random';
import { clubById, type NpcClub } from './npc';
import { crowdFor } from './economy';
import { type Career, type Fixture, type World } from './types';

/** Clássicos entre os clubes principais (ordem alfabética dos ids). */
const derbies: Record<string, string> = {};
const derby = (a: string, b: string, name: string) => {
  derbies[[a, b].sort().join('|')] = name;
};
derby('flamengo', 'fluminense', 'Fla-Flu');
derby('flamengo', 'vasco', 'Clássico dos Milhões');
derby('botafogo', 'flamengo', 'Clássico da Rivalidade');
derby('fluminense', 'vasco', 'Clássico dos Gigantes');
derby('botafogo', 'fluminense', 'Clássico Vovô');
derby('botafogo', 'vasco', 'Clássico da Amizade');
derby('corinthians', 'palmeiras', 'Derby Paulista');
derby('palmeiras', 'sao-paulo', 'Choque-Rei');
derby('palmeiras', 'santos', 'Clássico da Saudade');
derby('corinthians', 'sao-paulo', 'Majestoso');
derby('corinthians', 'santos', 'Clássico Alvinegro');
derby('santos', 'sao-paulo', 'San-São');
derby('gremio', 'internacional', 'Grenal');
derby('atletico-mg', 'cruzeiro', 'Clássico Mineiro');
derby('america', 'cruzeiro', 'Clássico das Multidões');
derby('america', 'atletico-mg', 'Clássico das Multidões');
derby('bahia', 'vitoria', 'Ba-Vi');
derby('athletico', 'coritiba', 'Atletiba');
derby('nautico', 'sport', 'Clássico dos Clássicos');
derby('ceara', 'fortaleza', 'Clássico-Rei');
derby('atletico-go', 'goias', 'Clássico Goiano');
derby('goias', 'vila-nova', 'Clássico Goiano');
derby('atletico-go', 'vila-nova', 'Clássico Goiano');
derby('avai', 'criciuma', 'Clássico Catarinense');
derby('avai', 'chapecoense', 'Clássico Catarinense');
derby('chapecoense', 'criciuma', 'Clássico Catarinense');
derby('athletico', 'operario', 'Clássico Paranaense');
derby('coritiba', 'londrina', 'Clássico Paranaense');
derby('londrina', 'operario', 'Clássico Paranaense');
derby('botafogo-sp', 'ponte-preta', 'Clássico do Interior');
derby('bragantino', 'ponte-preta', 'Clássico do Interior');

export const rivalry = (a: string, b: string): string | undefined =>
  derbies[[a, b].sort().join('|')];

export const isDerby = (fixture: Pick<Fixture, 'homeId' | 'awayId'>) =>
  Boolean(rivalry(fixture.homeId, fixture.awayId));

/** Capitais (lat, lon) por UF e países do continente. */
const coords: Record<string, [number, number]> = {
  AC: [-9.97, -67.8], AL: [-9.66, -35.73], AP: [0.03, -51.05], AM: [-3.1, -60.02],
  BA: [-12.97, -38.5], CE: [-3.73, -38.52], DF: [-15.78, -47.93], ES: [-20.31, -40.31],
  GO: [-16.68, -49.25], MA: [-2.53, -44.3], MT: [-15.6, -56.1], MS: [-20.44, -54.65],
  MG: [-19.92, -43.94], PA: [-1.46, -48.5], PB: [-7.12, -34.86], PR: [-25.43, -49.27],
  PE: [-8.05, -34.88], PI: [-5.09, -42.8], RJ: [-22.91, -43.17], RN: [-5.79, -35.21],
  RS: [-30.03, -51.23], RO: [-8.76, -63.9], RR: [2.82, -60.67], SC: [-27.6, -48.55],
  SP: [-23.55, -46.63], SE: [-10.91, -37.07], TO: [-10.18, -48.33],
  Brasil: [-15.79, -47.88], Argentina: [-34.6, -58.4], Uruguai: [-34.9, -56.16], Chile: [-33.45, -70.67],
  Colômbia: [4.7, -74.07], Paraguai: [-25.3, -57.6], Equador: [-0.18, -78.47],
  Peru: [-12.05, -77.04], Bolívia: [-16.5, -68.15], Venezuela: [10.5, -66.9],
};
const altitude: Record<string, number> = { Bolívia: 3600, Equador: 2800, Colômbia: 2600 };
const hotStates = new Set(['AC', 'AM', 'AP', 'PA', 'RR', 'RO', 'TO', 'MA', 'PI', 'CE', 'RN', 'PB', 'PE', 'AL', 'SE', 'BA', 'MT']);
const coldStates = new Set(['RS', 'SC', 'PR', 'SP', 'RJ', 'MG', 'ES', 'DF', 'GO', 'MS']);

export const regionOf = (state: string) =>
  ['RS', 'SC', 'PR'].includes(state)
    ? 'Sul'
    : ['SP', 'RJ', 'MG', 'ES'].includes(state)
      ? 'Sudeste'
      : ['MA', 'PI', 'CE', 'RN', 'PB', 'PE', 'AL', 'SE', 'BA'].includes(state)
        ? 'Nordeste'
        : ['AC', 'AM', 'AP', 'PA', 'RR', 'RO', 'TO'].includes(state)
          ? 'Norte'
          : 'Centro-Oeste';

function place(world: World, clubId: string) {
  const club = clubById(world, clubId);
  const npc = club as NpcClub;
  return npc.tier === 'continental' ? npc.country : club.state;
}

export function distanceKm(world: World, a: string, b: string) {
  const p = coords[place(world, a)];
  const q = coords[place(world, b)];
  if (!p || !q) return 0;
  const rad = Math.PI / 180;
  const h =
    Math.sin(((q[0] - p[0]) * rad) / 2) ** 2 +
    Math.cos(p[0] * rad) * Math.cos(q[0] * rad) * Math.sin(((q[1] - p[1]) * rad) / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(h)));
}

/** Química de uma escalação pelas amizades e rixas do vestiário. */
export function chemistry(career: Career, ids: string[]) {
  const set = new Set(ids);
  let value = 0;
  for (const r of career.living?.relations || [])
    if (set.has(r.a) && set.has(r.b)) value += r.kind === 'amizade' ? 0.006 : -0.012;
  return clamp(value, -0.04, 0.03);
}

export type Conditions = {
  /** Multiplicador de força (1 = neutro). */
  home: number;
  away: number;
  /** Multiplicador do desgaste físico por minuto. */
  homeTire: number;
  awayTire: number;
  derby?: string;
  notes: string[];
  weather?: 'Ensolarado' | 'Nublado' | 'Chuva' | 'Calor' | 'Frio';
  pitch?: 'Bom' | 'Molhado' | 'Pesado' | 'Irregular';
  referee?: { name: string; strictness: number; varEnabled: boolean };
};

const referees = [
  'André Amaral',
  'Bruno Valença',
  'Carla Meireles',
  'Daniel Fontes',
  'Fernanda Barros',
  'Luiz Nogueira',
  'Mariana Assis',
  'Rafael Farias',
];

/** Fatores fora das quatro linhas: viagem, clima, altitude, clássico, torcida, química e treino. */
export function matchConditions(
  career: Career,
  world: World,
  fixture: Fixture,
  homeLineup: string[] = [],
  awayLineup: string[] = [],
): Conditions {
  const r: Conditions = { home: 1, away: 1, homeTire: 1, awayTire: 1, notes: [] };
  const home = place(world, fixture.homeId);
  const away = place(world, fixture.awayId);
  const rng = random(hash(`${career.seed}:${fixture.id}:ambiente`));
  const roll = rng();
  const month = Number(fixture.date.slice(5, 7));
  r.weather =
    roll < 0.24
      ? 'Chuva'
      : roll < 0.42 && hotStates.has(home)
        ? 'Calor'
        : roll < 0.42 && coldStates.has(home) && month >= 5 && month <= 8
          ? 'Frio'
          : roll < 0.72
            ? 'Nublado'
            : 'Ensolarado';
  r.pitch =
    r.weather === 'Chuva'
      ? rng() < 0.35
        ? 'Pesado'
        : 'Molhado'
      : rng() < 0.08
        ? 'Irregular'
        : 'Bom';
  r.referee = {
    name: referees[Math.floor(rng() * referees.length)],
    strictness: 1 + Math.floor(rng() * 5),
    varEnabled: true,
  };
  if (r.pitch === 'Pesado') {
    r.homeTire += 0.08;
    r.awayTire += 0.08;
    r.notes.push('Gramado pesado: mais desgaste e menor qualidade nas finalizações');
  } else if (r.pitch === 'Irregular')
    r.notes.push('Gramado irregular reduz a qualidade das finalizações');
  else if (r.pitch === 'Molhado')
    r.notes.push('Gramado molhado deixa as finalizações um pouco mais difíceis');
  if (r.weather === 'Calor') {
    r.homeTire += 0.04;
    r.awayTire += 0.04;
    r.notes.push('Calor aumenta o desgaste dos dois times');
  }
  const km = distanceKm(world, fixture.homeId, fixture.awayId);
  if (km > 900) {
    r.awayTire += Math.min(0.12, km / 30000);
    r.away -= Math.min(0.025, km / 160000);
    r.notes.push(`Viagem de ${km.toLocaleString('pt-BR')} km desgasta o visitante`);
  }
  if (hotStates.has(home) && coldStates.has(away)) {
    r.awayTire += 0.06;
    r.notes.push('Calor forte: o visitante sente mais o desgaste');
  }
  const alt = altitude[home];
  if (alt && altitude[away] === undefined) {
    r.away -= alt / 80000;
    r.awayTire += alt / 20000;
    r.notes.push(`Altitude de ${alt.toLocaleString('pt-BR')} m: fôlego cai para quem vem de fora`);
  }
  const name = rivalry(fixture.homeId, fixture.awayId);
  if (name) {
    r.derby = name;
    r.home += 0.01;
    r.notes.push(`${name}: clássico com peso dobrado na torcida e na diretoria`);
  }
  const living = career.living;
  if (living) {
    const ourHome = fixture.homeId === career.clubId;
    const ourAway = fixture.awayId === career.clubId;
    const national = fixture.cup === 'SEL';
    const gate = ourHome && !national ? crowdFor(career, world, fixture, Boolean(name)) : null;
    if (gate)
      r.notes.push(
        `Público esperado: ${gate.crowd.toLocaleString('pt-BR')} (${Math.round(gate.occupancy * 100)}% da capacidade)`,
      );
    if (ourHome && !national && (living.fans >= 78 || (gate && gate.occupancy >= 0.92))) {
      r.home += 0.015;
      r.notes.push('Casa cheia empurra o time');
    } else if (ourHome && !national && living.fans < 30) {
      r.home -= 0.015;
      r.notes.push('Torcida impaciente: vaias pesam no time da casa');
    } else if (gate && gate.occupancy < 0.4) {
      r.home -= 0.005;
      r.notes.push('Arquibancada vazia: o fator casa quase some');
    }
    const focus = living.training;
    const side = ourHome ? 'home' : ourAway ? 'away' : null;
    if (side && !national) {
      const tire = side === 'home' ? 'homeTire' : 'awayTire';
      if (focus === 'Físico') r[tire] -= 0.08;
      if (focus === 'Recuperação') r[tire] -= 0.04;
      if (focus === 'Tático') r[side] += 0.012;
      if (focus === 'Finalização') r[side] += 0.008;
    }
    r.home += chemistry(career, homeLineup);
    r.away += chemistry(career, awayLineup);
  }
  return r;
}
