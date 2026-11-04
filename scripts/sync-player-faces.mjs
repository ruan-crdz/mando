// Baixa uma única vez as fotos de rosto dos atletas para public/assets/jogadores/.
// Fonte: API-Football (players/squads). Uso: API_FOOTBALL_KEY=... npm run sync:player-faces
// As respostas da API ficam em .cache/api-football para não gastar a cota diária.
import { createHash } from 'node:crypto';
import { Resolver, lookup as systemLookup } from 'node:dns';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { removeBackground } from '@imgly/background-removal-node';

const root = fileURLToPath(new URL('../', import.meta.url));
const cacheDir = path.join(root, '.cache', 'api-football');
const folder = path.join(root, 'public', 'assets', 'jogadores');
const manifestFile = path.join(root, 'src', 'game', 'data', 'player-faces.json');
const key = process.env.API_FOOTBALL_KEY;

const teamIds = {
  flamengo: 127,
  palmeiras: 121,
  cruzeiro: 135,
  mirassol: 7848,
  fluminense: 124,
  botafogo: 120,
  bahia: 118,
  'sao-paulo': 126,
  gremio: 130,
  bragantino: 794,
  'atletico-mg': 1062,
  santos: 128,
  corinthians: 131,
  vasco: 133,
  vitoria: 136,
  internacional: 119,
  coritiba: 147,
  athletico: 134,
  chapecoense: 132,
  remo: 1198,
  sport: 123,
  fortaleza: 154,
  ceara: 129,
  juventude: 152,
  'atletico-go': 144,
  goias: 151,
  cuiaba: 1193,
  america: 125,
  novorizontino: 7834,
  crb: 146,
  avai: 145,
  'vila-nova': 142,
  operario: 1223,
  athletic: 13975,
  'botafogo-sp': 2618,
  criciuma: 140,
  'ponte-preta': 139,
  londrina: 148,
  'sao-bernardo': 7865,
  nautico: 755,
};

// Alguns DNS domésticos não resolvem o CDN de imagens; tenta o sistema e depois resolvedores públicos.
const resolver = new Resolver();
resolver.setServers(['1.1.1.1', '8.8.8.8']);
function lookup(host, options, callback) {
  systemLookup(host, options, (err, address, family) => {
    if (!err) return callback(null, address, family);
    resolver.resolve4(host, (err4, addresses) => {
      if (err4 || !addresses.length) return callback(err);
      if (options?.all) callback(null, [{ address: addresses[0], family: 4 }]);
      else callback(null, addresses[0], 4);
    });
  });
}

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers, lookup, timeout: 20000 }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        if (res.statusCode !== 200) reject(new Error(`HTTP ${res.statusCode} em ${url}`));
        else resolve(Buffer.concat(chunks));
      });
    });
    req.on('timeout', () => req.destroy(new Error(`timeout em ${url}`)));
    req.on('error', reject);
  });
}

async function squad(teamId) {
  const file = path.join(cacheDir, `squad-${teamId}.json`);
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    if (!key) throw new Error('Defina API_FOOTBALL_KEY para baixar os elencos.');
    for (let attempt = 0; ; attempt++) {
      // O plano gratuito aceita cerca de 10 chamadas por minuto.
      await new Promise((r) => setTimeout(r, 7000));
      let errors;
      let body;
      try {
        body = JSON.parse(
          (
            await get(`https://v3.football.api-sports.io/players/squads?team=${teamId}`, {
              'x-apisports-key': key,
            })
          ).toString('utf8'),
        );
        errors = Array.isArray(body.errors) ? body.errors : Object.values(body.errors || {});
      } catch (e) {
        errors = [e.message];
      }
      if (errors.length) {
        if (!/429|rate limit|too many/i.test(errors.join(' ')) || attempt >= 4)
          throw new Error(`API-Football: ${errors.join('; ')}`);
        await new Promise((r) => setTimeout(r, 61000));
        continue;
      }
      const players = body.response?.[0]?.players || [];
      await writeFile(file, JSON.stringify(players), 'utf8');
      return players;
    }
  }
}

const normalize = (s) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 .]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const filler = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'jr', 'junior', 'filho', 'neto']);
const tokens = (s) =>
  normalize(s)
    .replace(/\./g, ' ')
    .split(' ')
    .filter((t) => t && !filler.has(t));
const group = (pos) =>
  pos === 'GK' || pos === 'Goalkeeper'
    ? 'gk'
    : ['CB', 'LB', 'RB', 'Defender'].includes(pos)
      ? 'def'
      : ['DM', 'CM', 'AM', 'Midfielder'].includes(pos)
        ? 'mid'
        : 'att';

function score(ours, theirs) {
  if ((group(ours.position) === 'gk') !== (group(theirs.position) === 'gk')) return 0;
  const a = normalize(ours.name).replace(/\./g, '');
  const b = normalize(theirs.name).replace(/\./g, '');
  const ta = tokens(ours.name);
  const raw = normalize(theirs.name).split(' ');
  const tb = tokens(theirs.name);
  let s = 0;
  if (a === b) s = 100;
  else if (raw.length >= 2 && /^[a-z]\.$/.test(raw[0])) {
    // "E. Díaz": inicial + sobrenome presente no nosso nome.
    const surname = tokens(raw.slice(1).join(' '));
    if (ta[0]?.[0] === raw[0][0] && surname.every((t) => ta.includes(t))) s = 90;
    else if (surname.length && surname.every((t) => ta.includes(t))) s = 72;
  } else if (ta.length && tb.length) {
    const shared = ta.filter((t) => tb.includes(t));
    if (shared.length === Math.min(ta.length, tb.length)) s = 85;
    else if (ta[0] === tb[0] && ta.at(-1) === tb.at(-1)) s = 82;
    else if (shared.length >= 2) s = 75;
  }
  if (!s) return 0;
  return s + (group(ours.position) === group(theirs.position) ? 5 : -8);
}

/** Pareia um-para-um, do par mais forte ao mais fraco. */
function pair(ours, theirs, threshold) {
  const options = [];
  for (const p of ours)
    for (const t of theirs) {
      const s = score(p, t);
      if (s >= threshold) options.push({ p, t, s });
    }
  options.sort((x, y) => y.s - x.s);
  const usedP = new Set();
  const usedT = new Set();
  const result = [];
  for (const o of options) {
    if (usedP.has(o.p.id) || usedT.has(o.t.id)) continue;
    // Recusa empates ambíguos entre dois atletas nossos para a mesma foto.
    const rival = options.find(
      (x) => x !== o && x.t.id === o.t.id && x.s === o.s && !usedP.has(x.p.id),
    );
    if (rival) continue;
    usedP.add(o.p.id);
    usedT.add(o.t.id);
    result.push(o);
  }
  return result;
}

async function pool(items, size, task) {
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) await task(items[next++]);
    }),
  );
}

const world = JSON.parse(
  await readFile(path.join(root, 'public', 'data', 'world-2026.json'), 'utf8'),
);
await mkdir(cacheDir, { recursive: true });
const squads = {};
for (const club of world.clubs) {
  if (!teamIds[club.id]) throw new Error(`Sem time da API para ${club.id}`);
  squads[club.id] = (await squad(teamIds[club.id])).map((p) => ({ ...p, clubId: club.id }));
}

const matches = [];
const leftovers = [];
for (const club of world.clubs) {
  const ours = world.players.filter((p) => p.clubId === club.id);
  const found = pair(ours, squads[club.id], 80);
  matches.push(...found);
  const done = new Set(found.map((m) => m.p.id));
  leftovers.push(...ours.filter((p) => !done.has(p.id)));
}
// Atletas que trocaram de clube entre os 40: só nomes compostos e quase exatos.
const taken = new Set(matches.map((m) => m.t.id));
const freeApi = Object.values(squads)
  .flat()
  .filter((t) => !taken.has(t.id));
matches.push(
  ...pair(
    leftovers.filter((p) => tokens(p.name).length >= 2),
    freeApi,
    95,
  ),
);
const matchedIds = new Set(matches.map((m) => m.p.id));
await writeFile(
  path.join(cacheDir, 'report.json'),
  JSON.stringify(
    {
      matches: matches.map((m) => ({
        club: m.p.clubId,
        ours: m.p.name,
        pos: m.p.position,
        api: m.t.name,
        apiClub: m.t.clubId,
        apiPos: m.t.position,
        score: m.s,
      })),
      unmatched: world.players
        .filter((p) => !matchedIds.has(p.id))
        .map((p) => `${p.clubId} · ${p.name} · ${p.position}`),
    },
    null,
    1,
  ),
  'utf8',
);
if (process.argv.includes('--dry')) {
  console.log(`Pareados: ${matches.length}/${world.players.length} (relatório em .cache/api-football)`);
  process.exit(0);
}

await mkdir(folder, { recursive: true });
await mkdir(path.join(cacheDir, 'photos'), { recursive: true });
await mkdir(path.join(cacheDir, 'cutouts'), { recursive: true });
for (const f of await readdir(folder)) await rm(path.join(folder, f));
const images = new Map();
const failed = [];
await pool(matches, 8, async (m) => {
  const file = path.join(cacheDir, 'photos', `${m.t.id}.png`);
  try {
    let bytes;
    try {
      bytes = await readFile(file);
    } catch {
      bytes = await get(m.t.photo);
      await writeFile(file, bytes);
    }
    images.set(m.p.id, { bytes, apiId: m.t.id });
  } catch (e) {
    failed.push(`${m.p.name}: ${e.message}`);
  }
});
// A API devolve a mesma silhueta genérica para quem não tem foto; descarta imagens repetidas.
const sha = (bytes) => createHash('sha1').update(bytes).digest('hex');
const hashes = new Map();
for (const { bytes } of images.values()) hashes.set(sha(bytes), (hashes.get(sha(bytes)) || 0) + 1);
const faces = [];
let generic = 0;
let done = 0;
const real = [...images].filter(([, { bytes }]) => {
  if (hashes.get(sha(bytes)) > 2) generic++;
  return hashes.get(sha(bytes)) <= 2;
});
// Recorte do fundo com modelo de segmentação local (sem enviar fotos para terceiros).
for (const [id, { bytes, apiId }] of real) {
  const cutFile = path.join(cacheDir, 'cutouts', `${apiId}.png`);
  let cut;
  try {
    cut = await readFile(cutFile);
  } catch {
    const blob = await removeBackground(new Blob([bytes], { type: 'image/png' }), {
      model: 'medium',
      output: { format: 'image/png' },
    });
    cut = Buffer.from(await blob.arrayBuffer());
    await writeFile(cutFile, cut);
  }
  await sharp(cut)
    .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 80, alphaQuality: 90 })
    .toFile(path.join(folder, `${id}.webp`));
  faces.push(id);
  if (++done % 50 === 0) console.log(`recortes: ${done}/${real.length}`);
}
faces.sort();
await writeFile(manifestFile, `${JSON.stringify(faces)}\n`, 'utf8');
const total = world.players.length;
console.log(
  `Rostos: ${faces.length}/${total} atletas (${Math.round((faces.length / total) * 100)}%) · ` +
    `${matches.length} pareados · ${generic} silhuetas genéricas · ${failed.length} downloads falharam`,
);
for (const f of failed.slice(0, 10)) console.warn(f);
