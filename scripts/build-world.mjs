// Converte os CSVs de data/ (MANDO WORLD_2026) no snapshot jogável do jogo.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import Papa from 'papaparse';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const WORLD_ID = '2026a000-0101-4000-8000-0000000000a1';
const EUR_BRL = 6;
const MAX_VALUE_EUR = 35_000_000;

// Posições conhecidas de atletas cuja fonte só informa a macroposição.
const known = {
  Flamengo: {
    'Agustín Rossi': ['GK', 'Argentina'],
    'Giorgian De Arrascaeta': ['AM', 'Uruguai'],
    'Lucas Paquetá': ['CM'],
    Pedro: ['ST'],
    Jorginho: ['DM', 'Itália'],
    'Samuel Lino': ['LW'],
    'Léo Ortiz': ['CB'],
    'Bruno Henrique': ['LW'],
    'Ayrton Lucas': ['LB'],
  },
  Palmeiras: {
    'Vitor Roque': ['ST'],
    'Flaco López': ['ST', 'Argentina'],
    'Gustavo Gómez': ['CB', 'Paraguai'],
    'Andreas Pereira': ['CM'],
    'Jhon Arias': ['RW', 'Colômbia'],
    Maurício: ['AM'],
    'Joaquín Piquerez': ['LB', 'Uruguai'],
    'Agustín Giay': ['RB', 'Argentina'],
  },
  Cruzeiro: {
    Gerson: ['CM'],
    'Kaio Jorge': ['ST'],
    'Matheus Pereira': ['AM'],
    'Fabrício Bruno': ['CB'],
    'Keny Arroyo': ['LW', 'Equador'],
    'Lucas Villalba': ['CB', 'Argentina'],
  },
  Corinthians: {
    'Yuri Alberto': ['ST'],
    'Memphis Depay': ['ST', 'Holanda'],
    'Rodrigo Garro': ['AM', 'Argentina'],
    'Breno Bidon': ['CM'],
    'Jesse Lingard': ['AM', 'Inglaterra'],
  },
  Santos: {
    Neymar: ['LW'],
    'Gabriel Barbosa': ['ST'],
    'Philippe Coutinho': ['AM'],
    'Benjamín Rollheiser': ['RW', 'Argentina'],
    'Álvaro Barreal': ['LW', 'Argentina'],
    'Everton Cebolinha': ['LW'],
  },
  'São Paulo': {
    'Marcos Antônio': ['DM'],
    'Lucas Moura': ['RW'],
    'Jonathan Calleri': ['ST', 'Argentina'],
    Luciano: ['ST'],
  },
  'Atlético-MG': {
    'Gustavo Scarpa': ['AM'],
    Lyanco: ['CB'],
    'Renan Lodi': ['LB'],
    Bernard: ['LW'],
    'Alan Minda': ['RW', 'Equador'],
    Alexsander: ['DM'],
  },
  Bahia: {
    'Luciano Juba': ['LB'],
    'Éverton Ribeiro': ['AM'],
    'Jean Lucas': ['CM'],
    'Willian José': ['ST'],
  },
  Botafogo: {
    'Alex Telles': ['LB'],
    'Álvaro Montoro': ['AM', 'Argentina'],
    'Arthur Cabral': ['ST'],
    'Mateo Ponte': ['RB', 'Uruguai'],
    Marçal: ['LB'],
    'Cristian Medina': ['CM', 'Argentina'],
  },
  Fluminense: {
    'Thiago Silva': ['CB'],
    'Lucho Acosta': ['AM', 'Argentina'],
    'Germán Cano': ['ST', 'Argentina'],
    'PH Ganso': ['AM'],
    'Rodrigo Castillo': ['ST', 'Argentina'],
    Renê: ['LB'],
  },
  Grêmio: {
    'Carlos Vinícius': ['ST'],
    'Wálter Kannemann': ['CB', 'Argentina'],
    Dodi: ['DM'],
    'Cristian Pavón': ['RW', 'Argentina'],
  },
  Internacional: {
    'Alan Patrick': ['AM'],
    'Johan Carbonero': ['RW', 'Colômbia'],
    'Alexandro Bernabei': ['LB', 'Argentina'],
  },
  Vasco: {
    'Andrés Gómez': ['RW', 'Colômbia'],
    'Robert Renan': ['CB'],
    'Paulo Henrique': ['RB'],
  },
  Coritiba: { Keno: ['LW'] },
};
const specific = { ZAG: 'CB', LD: 'RB', LE: 'LB', VOL: 'DM', MC: 'CM', PD: 'RW', PE: 'LW' };
const shares = {
  DEF: { CB: 0.5, LB: 0.25, RB: 0.25 },
  MEI: { DM: 0.36, CM: 0.36, AM: 0.28 },
  ATA: { ST: 0.4, LW: 0.3, RW: 0.3 },
};

const server = await createServer({
  root,
  server: { middlewareMode: true, watch: null },
  logLevel: 'error',
});
try {
  const load = (file) => server.ssrLoadModule(path.join(root, 'src', 'game', file));
  const [
    { clubProfiles },
    { overall, weights },
    { hash, random, clamp },
    { worldSchema, SNAPSHOT },
  ] = await Promise.all([
    load('world.ts'),
    load('ratings.ts'),
    load('random.ts'),
    load('types.ts'),
  ]);
  const csv = async (file) =>
    Papa.parse(await readFile(path.join(root, 'data', file), 'utf8'), {
      header: true,
      skipEmptyLines: 'greedy',
    }).data;
  const [clubRows, playerRows, attributeRows, manifest] = await Promise.all([
    csv('clubs.csv'),
    csv('players.csv'),
    csv('player-attributes.csv'),
    readFile(path.join(root, 'data', 'manifest.json'), 'utf8').then(JSON.parse),
  ]);

  const profileByName = new Map(clubProfiles.map((c) => [c.name, c]));
  const clubId = new Map();
  for (const row of clubRows) {
    const profile = profileByName.get(row.club_name);
    const league = row.division === 'Serie A' ? 'A' : 'B';
    if (!profile || profile.league !== league)
      throw new Error(`Clube sem perfil ou divisão divergente: ${row.club_name}`);
    clubId.set(row.club_id, profile.id);
  }
  if (clubId.size !== 40) throw new Error(`Esperados 40 clubes, recebidos ${clubId.size}.`);
  const attributesById = new Map(attributeRows.map((r) => [r.player_id, r]));

  const position = new Map();
  const byClub = Map.groupBy(playerRows, (r) => r.club_name);
  for (const [clubName, rows] of byClub) {
    const overrides = known[clubName] || {};
    for (const name of Object.keys(overrides))
      if (!rows.some((r) => r.display_name === name))
        throw new Error(`Atleta conhecido ausente: ${name} (${clubName})`);
    for (const macro of ['GOL', 'DEF', 'MEI', 'ATA']) {
      const group = rows
        .filter((r) => r.macro_position === macro)
        .sort(
          (a, b) => b.overall_mando - a.overall_mando || a.player_id.localeCompare(b.player_id),
        );
      if (macro === 'GOL') {
        group.forEach((r) => position.set(r.player_id, 'GK'));
        continue;
      }
      const count = Object.fromEntries(Object.keys(shares[macro]).map((p) => [p, 0]));
      const fixed = (r) => overrides[r.display_name]?.[0] || specific[r.primary_position];
      for (const r of group)
        if (fixed(r)) {
          position.set(r.player_id, fixed(r));
          if (fixed(r) in count) count[fixed(r)]++;
        }
      group
        .filter((r) => !fixed(r))
        .forEach((r, i, rest) => {
          const total = group.length - rest.length + i + 1;
          const pick = Object.entries(shares[macro]).sort(
            ([a, sa], [b, sb]) =>
              sb * total - count[b] - (sa * total - count[a]) || a.localeCompare(b),
          )[0][0];
          count[pick]++;
          position.set(r.player_id, pick);
        });
    }
  }

  const players = playerRows.map((r) => {
    const rng = random(hash(r.player_id));
    const noise = (spread) => Math.round((rng() - 0.5) * 2 * spread);
    const a = Object.fromEntries(
      Object.entries(attributesById.get(r.player_id) || {}).map(([k, v]) => [k, Number(v)]),
    );
    if (!Number.isFinite(a.pace)) throw new Error(`Atributos ausentes: ${r.player_id}`);
    const pos = position.get(r.player_id);
    const gk = pos === 'GK';
    const keep = (v) => clamp(Math.round(v), 1, 99);
    const attributes = {
      pace: keep(a.pace),
      acceleration: keep(a.pace + noise(4)),
      finishing: keep(a.finishing),
      shortPass: keep(a.passing),
      longPass: keep((a.passing + a.vision) / 2 + noise(3)),
      vision: keep(a.vision),
      dribbling: keep(a.dribbling),
      control: keep(a.technique),
      strength: keep(a.strength),
      stamina: keep(a.stamina),
      positioning: keep(
        gk ? a.goalkeeping : (a.mental + (pos === 'ST' ? a.finishing : a.defending)) / 2,
      ),
      marking: keep(a.defending + noise(3)),
      tackling: keep(a.defending + noise(3)),
      interception: keep((a.defending + a.mental) / 2 + noise(2)),
      heading: keep((a.physical + a.strength) / 2 - (gk ? 20 : 0) + noise(3)),
      composure: keep(a.mental),
      reflexes: keep(a.goalkeeping + noise(3)),
      handling: keep(a.goalkeeping + noise(3)),
      diving: keep(a.goalkeeping + noise(3)),
    };
    const target = Number(r.overall_mando);
    const player = { attributes, position: pos };
    for (let i = 0; i < 4; i++) {
      const delta = target - overall(player, pos);
      if (!delta) break;
      for (const key of Object.keys(weights[pos])) attributes[key] = keep(attributes[key] + delta);
    }
    const potential = Math.max(target, Number(r.potential_mando));
    const gap = potential - target;
    const reported = Number(r.age_reported_in_source);
    const age =
      Number.isFinite(reported) && reported > 14
        ? reported
        : gap >= 8
          ? 17 + Math.floor(rng() * 4)
          : gap >= 4
            ? 20 + Math.floor(rng() * 5)
            : 23 + Math.floor(rng() * 12);
    const birthDate =
      r.birth_date ||
      `${2026 - age}-${String(1 + Math.floor(rng() * 6)).padStart(2, '0')}-${String(1 + Math.floor(rng() * 28)).padStart(2, '0')}`;
    const left = ['LB', 'LW'].includes(pos) ? 0.7 : ['RB', 'RW'].includes(pos) ? 0.06 : 0.18;
    const footRoll = rng();
    const rawEur = Number(r.market_value_external_eur) || Number(r.market_value_mando_eur);
    const valueEur = Math.min(MAX_VALUE_EUR, rawEur <= 8e6 ? rawEur : 8e6 + (rawEur - 8e6) * 0.35);
    const years = age >= 32 ? 1 : 1 + Math.floor(rng() * (age <= 23 ? 4 : 3));
    const knownNationality = known[r.club_name]?.[r.display_name]?.[1];
    return {
      id: r.player_id,
      clubId: clubId.get(r.club_id),
      name: r.display_name.trim(),
      birthDate,
      nationality: knownNationality || r.nationality.split(';')[0] || 'Brasil',
      position: pos,
      foot: footRoll < left ? 'E' : footRoll > 0.96 ? 'A' : 'D',
      potential,
      uncertainty: clamp(Math.round(gap / 2) + (age <= 21 ? 2 : 1), 1, 8),
      value: Math.round((valueEur * EUR_BRL) / 10_000) * 10_000,
      wage: Math.round((Number(r.salary_mando_eur_month) * EUR_BRL) / 100) * 100,
      contractEnd: `${2025 + years}-12-31`,
      attributes,
      ...(Number(r.shirt_number) >= 1 && Number(r.shirt_number) <= 99
        ? { number: Number(r.shirt_number) }
        : {}),
    };
  });

  const world = worldSchema.parse({
    id: WORLD_ID,
    snapshot: SNAPSHOT,
    date: '2026-01-01',
    mode: 'official',
    source: `MANDO ${manifest.dataset} ${manifest.version}: ${manifest.clubs} clubes e ${manifest.players} atletas com nomes de elencos da temporada 2026 (oGol, GuiaGol e sites oficiais; coleta ${manifest.collection_build_date}). Overall, potencial, atributos, valores e salários são estimativas do jogo; idades e contratos sem fonte foram estimados.`,
    license:
      'Nomes de clubes e atletas usados como referência factual. Ratings e finanças são ficção de game design do MANDO. Escudos são marcas de seus respectivos clubes, usados apenas para identificação.',
    clubs: clubProfiles,
    players,
  });
  const out = path.join(root, 'public', 'data', 'world-2026.json');
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(world), 'utf8');
  const off = world.players.filter((p) => {
    const row = playerRows.find((r) => r.player_id === p.id);
    return Math.abs(overall(p) - Number(row.overall_mando)) > 1;
  });
  console.log(
    `world-2026.json: ${world.clubs.length} clubes, ${world.players.length} atletas, ${off.length} com overall divergente.`,
  );
} finally {
  await server.close();
}
