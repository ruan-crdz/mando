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
if (!process.argv.includes('--dry')) await writeFile(worldFile, `${JSON.stringify(world)}\n`, 'utf8');
