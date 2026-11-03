// Baixa os escudos dos 40 clubes uma única vez para public/assets/escudos/.
// Fonte principal: campeonato-brasileiro-api (ge.globo). Reserva: API pública da ESPN.
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { tabela } from 'campeonato-brasileiro-api';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const folder = path.join(root, 'public', 'assets', 'escudos');
const manifestFile = path.join(root, 'src', 'game', 'data', 'club-logos.json');

const aliases = {
  athletico: ['Athletico-PR', 'Athletico Paranaense', 'Athletico'],
  'atletico-mg': ['Atlético-MG', 'Atlético Mineiro'],
  bragantino: ['Red Bull Bragantino', 'Bragantino'],
  vasco: ['Vasco', 'Vasco da Gama'],
  america: ['América-MG', 'América Mineiro'],
  'atletico-go': ['Atlético-GO', 'Atlético Goianiense'],
  operario: ['Operário-PR', 'Operário PR', 'Operário'],
  athletic: ['Athletic', 'Athletic Club'],
};
const normalize = (s) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

async function fromGe() {
  const [a, b] = await Promise.all([tabela('a'), tabela('b')]);
  return [...a, ...b].map((t) => ({ name: t.nome, short: t.sigla, url: t.escudo, source: 'ge' }));
}
async function fromEspn() {
  const leagues = await Promise.all(
    ['bra.1', 'bra.2'].map(async (league) => {
      const res = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/teams`,
      );
      if (!res.ok) throw new Error(`ESPN ${league}: HTTP ${res.status}`);
      return (await res.json()).sports[0].leagues[0].teams.map(({ team }) => ({
        name: team.displayName,
        short: team.abbreviation,
        url: team.logos?.[0]?.href,
        source: 'espn',
      }));
    }),
  );
  return leagues.flat().filter((t) => t.url);
}

function match(club, teams) {
  const names = new Set([club.name, ...(aliases[club.id] || [])].map(normalize));
  const found = teams.filter((t) => names.has(normalize(t.name)));
  return found.length === 1 ? found[0] : null;
}

async function download(club, team) {
  const res = await fetch(team.url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const head = bytes.subarray(0, 512).toString('utf8');
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const svg = !png && /<svg[\s>]/i.test(bytes.toString('utf8'));
  if (!png && !svg) throw new Error(`formato inesperado (${head.slice(0, 30)})`);
  if (svg && /<script|\son\w+\s*=|javascript:/i.test(bytes.toString('utf8')))
    throw new Error('SVG com conteúdo ativo recusado');
  if (bytes.length < 200 || bytes.length > 600_000) throw new Error(`tamanho ${bytes.length}`);
  const file = `${club.id}.${png ? 'png' : 'svg'}`;
  await writeFile(path.join(folder, file), bytes);
  return { file, source: team.source, url: team.url, bytes: bytes.length };
}

const server = await createServer({
  root,
  server: { middlewareMode: true, watch: null },
  logLevel: 'error',
});
try {
  const { clubProfiles } = await server.ssrLoadModule(path.join(root, 'src', 'game', 'world.ts'));
  const sources = [];
  for (const [label, load] of [
    ['campeonato-brasileiro-api', fromGe],
    ['ESPN', fromEspn],
  ])
    try {
      sources.push(await load());
    } catch (e) {
      console.warn(`Fonte ${label} indisponível: ${e.message}`);
    }
  await mkdir(folder, { recursive: true });
  for (const f of await readdir(folder)) await rm(path.join(folder, f));
  const logos = {};
  const missing = [];
  for (const club of clubProfiles) {
    let saved = null;
    for (const teams of sources) {
      const team = match(club, teams);
      if (!team) continue;
      try {
        saved = await download(club, team);
        break;
      } catch (e) {
        console.warn(`${club.name}: ${team.source} falhou (${e.message})`);
      }
    }
    if (saved) logos[club.id] = saved;
    else missing.push(club.name);
  }
  await mkdir(path.dirname(manifestFile), { recursive: true });
  await writeFile(manifestFile, `${JSON.stringify(logos, null, 2)}\n`, 'utf8');
  const bySource = Object.values(logos).reduce(
    (acc, l) => ({ ...acc, [l.source]: (acc[l.source] || 0) + 1 }),
    {},
  );
  console.log(
    `Escudos: ${clubProfiles.length} clubes · ${Object.keys(logos).length} baixados e validados ` +
      `(${JSON.stringify(bySource)}) · ${missing.length} ausentes${missing.length ? `: ${missing.join(', ')}` : ''}`,
  );
  if (missing.length) process.exitCode = 1;
} finally {
  await server.close();
}
