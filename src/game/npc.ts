import { hash, random } from './random';
import {
  attributeKeys,
  type Attributes,
  type Club,
  type Player,
  type PlayerState,
  type Position,
  type World,
} from './types';

/** Clubes NPC: força, orçamento, reputação e elenco simplificado gerado por seed. */
export type NpcClub = Omit<Club, 'league'> & {
  league?: undefined;
  tier: 'nacional' | 'continental' | 'exterior';
  country: string;
};
export type AnyClub = Club | NpcClub;

type Row = [name: string, short: string, rep: number, color: string];
const br: Record<string, Row[]> = {
  SP: [
    ['Guarani', 'GUA', 60, '#1f7a4a'],
    ['Portuguesa', 'POR', 58, '#c3303e'],
    ['Ituano', 'ITU', 57, '#b73441'],
    ['Água Santa', 'AGS', 55, '#2e5aa8'],
    ['Velo Clube', 'VEL', 53, '#b84a3e'],
    ['Noroeste', 'NOR', 52, '#b73a3a'],
  ],
  RJ: [
    ['Volta Redonda', 'VRE', 58, '#c8b23a'],
    ['Nova Iguaçu', 'NIG', 55, '#d07a2e'],
    ['Madureira', 'MAD', 52, '#c5503a'],
    ['Bangu', 'BAN', 51, '#b83a3a'],
    ['Portuguesa-RJ', 'PRJ', 51, '#2e7a4a'],
    ['Boavista', 'BOA', 50, '#2e7a4a'],
  ],
  MG: [
    ['Tombense', 'TOM', 56, '#c03a3a'],
    ['Pouso Alegre', 'PAL', 52, '#3a5a8a'],
    ['Uberlândia', 'UBE', 51, '#2e7a4a'],
    ['Democrata-GV', 'DEM', 50, '#c03a3a'],
  ],
  RS: [
    ['Caxias', 'CAX', 57, '#7a2e3a'],
    ['Ypiranga', 'YPI', 55, '#c8b23a'],
    ['São José-RS', 'SJO', 54, '#2e4a8a'],
    ['Brasil de Pelotas', 'BRP', 53, '#b73a3a'],
    ['Novo Hamburgo', 'NHA', 51, '#2e5aa8'],
  ],
  PR: [
    ['Maringá', 'MAR', 55, '#2e5aa8'],
    ['Cascavel', 'CAS', 53, '#c8b23a'],
    ['Cianorte', 'CIA', 51, '#2e7a4a'],
    ['Azuriz', 'AZU', 50, '#2e5aa8'],
  ],
  SC: [
    ['Figueirense', 'FIG', 58, '#30373d'],
    ['Brusque', 'BRU', 57, '#c03a3a'],
    ['Joinville', 'JEC', 54, '#c03a3a'],
    ['Barra', 'BAR', 51, '#2e5aa8'],
    ['Marcílio Dias', 'MDI', 50, '#c03a3a'],
  ],
  BA: [
    ['Jacuipense', 'JAC', 52, '#c03a3a'],
    ['Juazeirense', 'JUA', 51, '#2e5aa8'],
    ['Atlético-BA', 'ABA', 51, '#c03a3a'],
    ['Barcelona de Ilhéus', 'BIL', 49, '#3a5a8a'],
    ['Bahia de Feira', 'BFE', 49, '#2e5aa8'],
    ['Jequié', 'JEQ', 48, '#c03a3a'],
  ],
  PE: [
    ['Santa Cruz', 'STA', 58, '#c03a3a'],
    ['Retrô', 'RET', 55, '#2e5aa8'],
    ['Central', 'CEN', 50, '#30373d'],
    ['Salgueiro', 'SAL', 49, '#c03a3a'],
    ['Maguary', 'MAG', 48, '#2e5aa8'],
    ['Afogados', 'AFO', 47, '#c8b23a'],
  ],
  CE: [
    ['Ferroviário', 'FER', 54, '#c03a3a'],
    ['Floresta', 'FLO', 52, '#2e7a4a'],
    ['Iguatu', 'IGU', 49, '#c8b23a'],
    ['Maracanã-CE', 'MCE', 48, '#2e5aa8'],
    ['Caucaia', 'CAU', 47, '#c03a3a'],
    ['Horizonte', 'HOR', 47, '#2e7a4a'],
  ],
  GO: [
    ['Anápolis', 'ANA', 54, '#c03a3a'],
    ['Aparecidense', 'APA', 54, '#2e7a4a'],
    ['Goiânia', 'GNA', 50, '#30373d'],
    ['Inhumas', 'INH', 48, '#2e5aa8'],
    ['CRAC', 'CRA', 48, '#c03a3a'],
  ],
  MT: [
    ['Mixto', 'MIX', 50, '#30373d'],
    ['Operário-MT', 'OMT', 49, '#c03a3a'],
    ['União Rondonópolis', 'URO', 48, '#c03a3a'],
    ['Luverdense', 'LUV', 50, '#2e7a4a'],
    ['Primavera', 'PRI', 47, '#2e5aa8'],
    ['Sinop', 'SIN', 47, '#c8b23a'],
    ['Nova Mutum', 'NMU', 46, '#2e7a4a'],
  ],
  AL: [
    ['CSA', 'CSA', 57, '#2e5aa8'],
    ['ASA', 'ASA', 52, '#c03a3a'],
    ['Murici', 'MUR', 47, '#2e5aa8'],
    ['CSE', 'CSE', 47, '#c03a3a'],
    ['Coruripe', 'COR', 46, '#2e7a4a'],
    ['Cruzeiro-AL', 'CAL', 46, '#2e5aa8'],
    ['Penedense', 'PEN', 45, '#c03a3a'],
  ],
  PA: [
    ['Paysandu', 'PAY', 62, '#3a8ad0'],
    ['Águia de Marabá', 'AGU', 50, '#2e5aa8'],
    ['Tuna Luso', 'TUN', 49, '#2e7a4a'],
    ['Cametá', 'CAM', 48, '#c03a3a'],
    ['Castanhal', 'CTN', 47, '#c8b23a'],
    ['Bragantino-PA', 'BPA', 47, '#30373d'],
    ['São Raimundo-PA', 'SRA', 46, '#2e5aa8'],
  ],
};
const cont: [string, Row[]][] = [
  [
    'Argentina',
    [
      ['River Plate', 'RIV', 83, '#c8333f'],
      ['Boca Juniors', 'BOC', 82, '#1f3f8a'],
      ['Racing', 'RAC', 79, '#5aa6dc'],
      ['Estudiantes', 'EST', 77, '#c8333f'],
      ['Vélez Sarsfield', 'VEL', 76, '#2e4a8a'],
      ['Independiente', 'IND', 75, '#c8333f'],
      ['San Lorenzo', 'SLO', 74, '#2e3a7a'],
      ['Talleres', 'TAL', 75, '#1f3f8a'],
      ['Lanús', 'LAN', 74, '#7a2e3a'],
      ['Rosario Central', 'ROS', 73, '#2e5aa8'],
      ['Argentinos Juniors', 'ARG', 73, '#c8333f'],
      ['Huracán', 'HUR', 71, '#c8333f'],
      ['Belgrano', 'BEL', 70, '#5aa6dc'],
      ["Newell's Old Boys", 'NOB', 70, '#c8333f'],
    ],
  ],
  [
    'Uruguai',
    [
      ['Peñarol', 'PEÑ', 75, '#c8a72a'],
      ['Nacional', 'NAC', 75, '#2e4a8a'],
      ['Defensor Sporting', 'DEF', 68, '#6a3a8a'],
      ['Liverpool-URU', 'LIV', 67, '#30373d'],
    ],
  ],
  [
    'Chile',
    [
      ['Colo-Colo', 'COL', 74, '#30373d'],
      ['Universidad de Chile', 'UCH', 72, '#2e4a8a'],
      ['Universidad Católica', 'UCA', 71, '#2e5aa8'],
      ['Palestino', 'PAL', 66, '#2e7a4a'],
    ],
  ],
  [
    'Colômbia',
    [
      ['Atlético Nacional', 'ANA', 75, '#2e7a4a'],
      ['Millonarios', 'MIL', 72, '#2e4a8a'],
      ['Junior', 'JUN', 72, '#c8333f'],
      ['América de Cali', 'AME', 71, '#c8333f'],
      ['Independiente Medellín', 'DIM', 70, '#c8333f'],
      ['Deportes Tolima', 'TOL', 69, '#c8a72a'],
      ['Independiente Santa Fe', 'SFE', 69, '#c8333f'],
    ],
  ],
  [
    'Paraguai',
    [
      ['Olimpia', 'OLI', 73, '#30373d'],
      ['Cerro Porteño', 'CER', 73, '#2e4a8a'],
      ['Libertad', 'LIB', 72, '#30373d'],
      ['Guaraní', 'GUA', 67, '#c8a72a'],
    ],
  ],
  [
    'Equador',
    [
      ['LDU Quito', 'LDU', 76, '#2e4a8a'],
      ['Independiente del Valle', 'IDV', 77, '#30373d'],
      ['Barcelona SC', 'BSC', 73, '#c8a72a'],
      ['Emelec', 'EME', 70, '#2e5aa8'],
      ['Aucas', 'AUC', 66, '#c8a72a'],
    ],
  ],
  [
    'Peru',
    [
      ['Universitario', 'UNI', 71, '#a8343a'],
      ['Alianza Lima', 'ALI', 70, '#2e3a7a'],
      ['Sporting Cristal', 'SCR', 70, '#5aa6dc'],
      ['Melgar', 'MEL', 66, '#c8333f'],
    ],
  ],
  [
    'Bolívia',
    [
      ['Bolívar', 'BOL', 68, '#5aa6dc'],
      ['The Strongest', 'STR', 67, '#c8a72a'],
      ['Always Ready', 'ALW', 64, '#c8333f'],
      ['Blooming', 'BLO', 63, '#2e5aa8'],
    ],
  ],
  [
    'Venezuela',
    [
      ['Caracas', 'CAR', 65, '#a8343a'],
      ['Deportivo Táchira', 'TAC', 64, '#c8a72a'],
      ['Monagas', 'MON', 62, '#2e5aa8'],
    ],
  ],
];

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

function make(row: Row, state: string, tier: NpcClub['tier'], country: string): NpcClub {
  const [name, short, reputation, color] = row;
  return {
    id: `npc-${tier === 'continental' ? 'c' : tier === 'exterior' ? 'x' : 'b'}-${slug(name)}`,
    name,
    short: short.slice(0, 4),
    color,
    state,
    stadium: `Estádio do ${name}`,
    reputation,
    budget: reputation * reputation * 2500,
    debt: 0,
    tier,
    country,
  };
}

export const brazilianNpcClubs: NpcClub[] = Object.entries(br).flatMap(([uf, rows]) =>
  rows.map((r) => make(r, uf, 'nacional', 'Brasil')),
);
export const continentalNpcClubs: NpcClub[] = cont.flatMap(([country, rows]) =>
  rows.map((r) => make(r, country.slice(0, 2).toUpperCase(), 'continental', country)),
);
const abroad: [string, Row[]][] = [
  ['Portugal', [['Benfica', 'BEN', 84, '#d0202e'], ['Porto', 'POR', 84, '#1f4fa0'], ['Sporting', 'SCP', 83, '#1f8a4a'], ['Braga', 'BRA', 78, '#c8333f']]],
  ['Espanha', [['Atlético de Madrid', 'ATM', 88, '#c8333f'], ['Sevilla', 'SEV', 80, '#d0202e'], ['Real Betis', 'BET', 80, '#1f8a4a'], ['Villarreal', 'VIL', 82, '#e8c800']]],
  ['Inglaterra', [['Chelsea', 'CHE', 89, '#1f3fa0'], ['West Ham', 'WHU', 82, '#7a2e3a'], ['Brighton', 'BHA', 83, '#1f5fb0'], ['Nottingham Forest', 'NFO', 81, '#c8333f'], ['Wolverhampton', 'WOL', 80, '#e8a000']]],
  ['Itália', [['Milan', 'MIL', 87, '#c8202e'], ['Roma', 'ROM', 84, '#8a1f2e'], ['Fiorentina', 'FIO', 81, '#6a2e9a'], ['Atalanta', 'ATA', 84, '#1f3f8a']]],
  ['França', [['Lyon', 'LYO', 82, '#1f3f8a'], ['Monaco', 'MON', 82, '#d0202e'], ['Lille', 'LIL', 81, '#c8202e']]],
  ['Alemanha', [['Bayer Leverkusen', 'B04', 86, '#d0202e'], ['Wolfsburg', 'WOB', 79, '#1f8a4a']]],
  ['Arábia Saudita', [['Al-Hilal', 'HIL', 82, '#1f3fa0'], ['Al-Nassr', 'NAS', 81, '#e8c800'], ['Al-Ahli', 'AHL', 79, '#1f8a4a'], ['Al-Ittihad', 'ITT', 80, '#e8c800']]],
  ['Estados Unidos', [['Inter Miami', 'MIA', 75, '#f0a0b8'], ['Atlanta United', 'ATL', 72, '#a01f2e']]],
  ['Rússia', [['Zenit', 'ZEN', 79, '#1f6fd0']]],
  ['Ucrânia', [['Shakhtar Donetsk', 'SHA', 78, '#e86a00']]],
];
/** Clubes estrangeiros que compram atletas do Brasil (não disputam competições do jogo). */
export const foreignClubs: NpcClub[] = abroad.flatMap(([country, rows]) =>
  rows.map((r) => make(r, country.slice(0, 2).toUpperCase(), 'exterior', country)),
);
export const BRAZIL_NATIONAL_ID = 'national-brasil';
export const nationalTeams: NpcClub[] = [
  {
    ...make(['Brasil', 'BRA', 87, '#e4c522'], 'RJ', 'continental', 'Brasil'),
    id: BRAZIL_NATIONAL_ID,
    stadium: 'Maracanã',
  },
  ...([
    ['Argentina', 'ARG', 87, '#76b5e3', 'AR'],
    ['Uruguai', 'URU', 82, '#72b5d8', 'UY'],
    ['Colômbia', 'COL', 81, '#e3bd24', 'CO'],
    ['Chile', 'CHI', 77, '#c83a3a', 'CL'],
    ['Equador', 'ECU', 78, '#d6ad20', 'EC'],
  ] as const).map(([name, short, reputation, color, state]) => ({
    ...make([name, short, reputation, color], state, 'continental', name),
    id: `npc-national-${slug(name)}`,
    stadium: `Estádio nacional de ${name}`,
  })),
];
export const isForeign = (id: string | null | undefined) => Boolean(id?.startsWith('npc-x-'));
const npcById = new Map<string, NpcClub>(
  [...brazilianNpcClubs, ...continentalNpcClubs, ...foreignClubs, ...nationalTeams].map((c) => [
    c.id,
    c,
  ]),
);

/** Completa estaduais de UFs sem lista curada com clubes NPC genéricos e estáveis. */
export function stateNpcClubs(uf: string, needed: number): NpcClub[] {
  const known = brazilianNpcClubs.filter((c) => c.state === uf);
  const prefixes = [
    'Atlético',
    'União',
    'Esporte',
    'Operário',
    'Real',
    'Independente',
    'Ferroviário',
    'Comercial',
  ];
  for (let i = 0; known.length < needed; i++) {
    const club = make(
      [
        `${prefixes[i % prefixes.length]} ${uf}`,
        `${prefixes[i % prefixes.length].slice(0, 2).toUpperCase()}${uf[0]}`,
        47,
        '#4a5a6a',
      ],
      uf,
      'nacional',
      'Brasil',
    );
    npcById.set(club.id, club);
    known.push(club);
  }
  return known.slice(0, needed);
}

export const isNpc = (id: string) => id.startsWith('npc-');

const roles: Position[] = [
  'GK',
  'GK',
  'CB',
  'CB',
  'CB',
  'CB',
  'LB',
  'RB',
  'DM',
  'DM',
  'CM',
  'CM',
  'AM',
  'LW',
  'RW',
  'ST',
  'ST',
  'ST',
];
const names = {
  br: [
    [
      'Alan',
      'Bruno',
      'Carlos',
      'Davi',
      'Everton',
      'Fábio',
      'Gustavo',
      'Hugo',
      'Ian',
      'Jonas',
      'Luan',
      'Marcos',
      'Natan',
      'Paulo',
      'Renan',
      'Sérgio',
      'Tiago',
      'Wesley',
    ],
    [
      'Araújo',
      'Batista',
      'Cardoso',
      'Duarte',
      'Freitas',
      'Garcia',
      'Moraes',
      'Nogueira',
      'Pinto',
      'Rocha',
      'Silveira',
      'Souza',
      'Tavares',
      'Xavier',
    ],
  ],
  es: [
    [
      'Agustín',
      'Diego',
      'Emiliano',
      'Facundo',
      'Franco',
      'Gonzalo',
      'Joaquín',
      'Juan',
      'Martín',
      'Matías',
      'Nicolás',
      'Rodrigo',
      'Santiago',
      'Sebastián',
      'Tomás',
    ],
    [
      'Acosta',
      'Álvarez',
      'Benítez',
      'Castro',
      'Díaz',
      'Fernández',
      'Gómez',
      'González',
      'Herrera',
      'López',
      'Martínez',
      'Pérez',
      'Romero',
      'Sánchez',
      'Torres',
    ],
  ],
};
const squadCache = new Map<string, Player[]>();
const npcPlayerById = new Map<string, Player>();

export function npcSquad(clubId: string): Player[] {
  const cached = squadCache.get(clubId);
  if (cached) return cached;
  const club = npcById.get(clubId);
  if (!club) return [];
  const [first, last] = club.country === 'Brasil' ? names.br : names.es;
  const players = roles.map((position, i) => {
    const rng = random(hash(`${club.id}:${i}`));
    const base = club.reputation - 9 + Math.round(rng() * 12);
    const attributes = Object.fromEntries(
      attributeKeys.map((key) => {
        const gk = ['handling', 'diving', 'reflexes'].includes(key);
        const v =
          gk !== (position === 'GK')
            ? 10 + Math.round(rng() * 20)
            : base - 8 + Math.round(rng() * 16);
        return [key, Math.max(8, Math.min(93, v))];
      }),
    ) as Attributes;
    const player: Player = {
      id: `${club.id}:${i}`,
      clubId: club.id,
      name: `${first[Math.floor(rng() * first.length)]} ${last[Math.floor(rng() * last.length)]}`,
      birthDate: `${1992 + Math.floor(rng() * 14)}-06-15`,
      nationality: club.country,
      position,
      foot: rng() > 0.75 ? 'E' : 'D',
      potential: Math.min(95, base + 4),
      uncertainty: 4,
      value: 0,
      wage: 0,
      contractEnd: '2099-12-31',
      attributes,
    };
    npcPlayerById.set(player.id, player);
    return player;
  });
  squadCache.set(clubId, players);
  return players;
}

export const npcState: PlayerState = {
  clubId: null,
  fitness: 92,
  morale: 70,
  injuryDays: 0,
  yellow: 0,
  suspension: 0,
  growth: 0,
  minutes: 0,
  goals: 0,
  assists: 0,
  wage: 0,
  contractEnd: '2099-12-31',
  relationship: 50,
  benchGames: 0,
  personality: 'Profissional',
  sharpness: 50,
  potentialDelta: 0,
  development: 'Equilibrado',
  role: 'Padrão',
  monthlyRatingTotal: 0,
  monthlyRated: 0,
};

const indexes = new WeakMap<World, { players: Map<string, Player>; clubs: Map<string, Club> }>();
function index(world: World) {
  let idx = indexes.get(world);
  if (!idx) {
    idx = {
      players: new Map(world.players.map((p) => [p.id, p])),
      clubs: new Map(world.clubs.map((c) => [c.id, c])),
    };
    indexes.set(world, idx);
  }
  return idx;
}

export function clubById(world: World, id: string): AnyClub {
  const club = index(world).clubs.get(id) || npcById.get(id);
  if (!club) throw new Error(`Clube desconhecido: ${id}`);
  return club;
}
export function findPlayer(world: World, id: string): Player | undefined {
  if (isNpc(id)) {
    if (!npcPlayerById.has(id)) npcSquad(id.split(':')[0]);
    return npcPlayerById.get(id);
  }
  return index(world).players.get(id);
}
export const knownClub = (world: World, id: string) =>
  index(world).clubs.has(id) || npcById.has(id);
