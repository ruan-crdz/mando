// Corrige datas de nascimento do snapshot com a idade real dos elencos do API-Football
// (cache em .cache/api-football, baixado em 04/11/2026). Uso: node scripts/fix-ages.mjs [--dry]
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const cacheDir = path.join(root, '.cache', 'api-football');
const worldFile = path.join(root, 'public', 'data', 'world-2026.json');
const teamIds = JSON.parse(
  (await readFile(path.join(root, 'scripts', 'sync-player-faces.mjs'), 'utf8'))
    .match(/const teamIds = (\{[\s\S]*?\});/)[1]
    .replace(/'([^']+)'/g, '"$1"')
    .replace(/(\w[\w-]*):/g, '"$1":')
    .replace(/""/g, '"')
    .replace(/,\s*}/, '}'),
);

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

const world = JSON.parse(await readFile(worldFile, 'utf8'));
const squads = {};
let fetchedAt = new Date('2026-11-04');
for (const club of world.clubs) {
  const file = path.join(cacheDir, `squad-${teamIds[club.id]}.json`);
  squads[club.id] = JSON.parse(await readFile(file, 'utf8')).map((p) => ({ ...p, clubId: club.id }));
  fetchedAt = (await stat(file)).mtime;
}

const ageAt = (birth, when) => {
  const [y, m, d] = birth.split('-').map(Number);
  let age = when.getFullYear() - y;
  if (when.getMonth() + 1 < m || (when.getMonth() + 1 === m && when.getDate() < d)) age--;
  return age;
};

const matches = [];
for (const club of world.clubs)
  matches.push(...pair(world.players.filter((p) => p.clubId === club.id), squads[club.id], 80));

let fixed = 0;
const examples = [];
for (const { p, t } of matches) {
  if (!t.age || t.age < 15 || t.age > 45) continue;
  const ours = ageAt(p.birthDate, fetchedAt);
  if (Math.abs(ours - t.age) < 2) continue;
  const [, m, d] = p.birthDate.split('-');
  let year = fetchedAt.getFullYear() - t.age;
  if (ageAt(`${year}-${m}-${d}`, fetchedAt) !== t.age) year--;
  const before = p.birthDate;
  p.birthDate = `${year}-${m}-${d}`;
  fixed++;
  if (examples.length < 15) examples.push(`${p.clubId} · ${p.name}: ${before} → ${p.birthDate} (${t.age} anos)`);
}
console.log(`Pareados ${matches.length}/${world.players.length} · corrigidos ${fixed}`);
for (const e of examples) console.log(e);

// Quem não está no API-Football: Wikidata pelo nome, exigindo passagem pelo clube (P54).
const keyword = {
  'atletico-mg': 'atletico mineiro',
  athletico: 'athletico paranaense',
  'sao-paulo': 'sao paulo',
  'atletico-go': 'atletico goianiense',
  america: 'america futebol clube',
  'vila-nova': 'vila nova',
  operario: 'operario',
  athletic: 'athletic club',
  'botafogo-sp': 'botafogo',
  'ponte-preta': 'ponte preta',
  'sao-bernardo': 'sao bernardo',
  bragantino: 'bragantino',
  crb: 'regatas brasil',
};
const clubKey = (club) => keyword[club.id] || normalize(club.name).split(' ')[0];
const matchedIds = new Set(matches.map((m) => m.p.id));
const rest = world.players.filter((p) => !matchedIds.has(p.id));
let wikiFixed = 0;
let wikiFound = 0;
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
for (let i = 0; i < rest.length; i += 30) {
  const chunk = rest.slice(i, i + 30);
  const values = chunk
    .flatMap((p) => ['pt', 'en', 'es'].map((l) => `"${esc(p.name)}"@${l}`))
    .join(' ');
  const query = `SELECT ?n ?d (GROUP_CONCAT(DISTINCT ?tl; separator="|") AS ?teams) WHERE {
    VALUES ?n { ${values} }
    { ?p rdfs:label ?n } UNION { ?p skos:altLabel ?n }
    ?p wdt:P106 wd:Q937857; wdt:P569 ?d; wdt:P54 ?t.
    ?t rdfs:label ?tl. FILTER(LANG(?tl) IN ("pt","en"))
  } GROUP BY ?p ?n ?d`;
  let rows = [];
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(
        `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`,
        {
          headers: {
            Accept: 'application/sparql-results+json',
            'User-Agent': 'MandoGame/1.0 (https://github.com/ruan-crdz/mando)',
          },
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      rows = (await res.json()).results.bindings;
      break;
    } catch (e) {
      console.warn(`Wikidata: ${e.message}`);
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
    }
  }
  await new Promise((r) => setTimeout(r, 1200));
  for (const p of chunk) {
    const club = world.clubs.find((c) => c.id === p.clubId);
    const key = clubKey(club);
    const years = new Set(
      rows
        .filter(
          (r) =>
            normalize(r.n.value) === normalize(p.name) &&
            r.teams.value.split('|').some((t) => normalize(t).includes(key)),
        )
        .map((r) => r.d.value.slice(0, 4)),
    );
    if (years.size !== 1) continue;
    const [year] = years;
    if (tokens(p.name).length < 2 || Number(year) < 1984) continue;
    wikiFound++;
    if (p.birthDate.slice(0, 4) === year) continue;
    if (examples.length < 30) console.log(`wikidata · ${p.clubId} · ${p.name}: ${p.birthDate.slice(0, 4)} → ${year}`);
    p.birthDate = `${year}${p.birthDate.slice(4)}`;
    wikiFixed++;
  }
  process.stdout.write(`\rWikidata ${Math.min(i + 30, rest.length)}/${rest.length}`);
}
console.log(`\nWikidata: ${wikiFound}/${rest.length} encontrados · ${wikiFixed} corrigidos`);
if (!process.argv.includes('--dry')) await writeFile(worldFile, `${JSON.stringify(world)}\n`, 'utf8');
