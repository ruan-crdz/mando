// Levanta a posição específica real de cada atleta (Wikipedia pt/en + Wikidata) e grava data/positions.json.
// Uso: node scripts/fetch-positions.mjs  (respostas ficam em cache em node_modules/.cache/positions)
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const cacheDir = path.join(root, 'node_modules', '.cache', 'positions');
const UA = 'mando-dev/1.0 (personal football-manager game; position check-up)';
await mkdir(cacheDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let last = 0;
export async function get(url, html = false) {
  const file = path.join(cacheDir, createHash('sha1').update(url).digest('hex') + '.json');
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    // sem cache: busca na rede
  }
  for (let attempt = 0; ; attempt++) {
    const wait = last + (html ? 1500 : 1100) - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: html ? 'text/html' : 'application/json' },
    });
    if (res.ok) {
      const body = html ? { html: await res.text() } : await res.json();
      await writeFile(file, JSON.stringify(body));
      return body;
    }
    if (html && res.status === 404) return { html: '' };
    if (attempt >= 6) throw new Error(`${res.status} ${url}`);
    const retry = Number(res.headers.get('retry-after'));
    await sleep(Math.max(Number.isFinite(retry) ? retry * 1000 : 0, 5000 * 2 ** attempt));
  }
}

export const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\(.*?\)/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Wikitexto de vários artigos (lotes de 50), resolvendo redirecionamentos. Retorna Map(títuloPedido -> {title, text, qid}).
export async function pages(host, titles, size = 40) {
  const out = new Map();
  const uniq = [...new Set(titles)].sort();
  for (let i = 0; i < uniq.length; i += size) {
    const batch = uniq.slice(i, i + size);
    const j = await get(
      `https://${host}/w/api.php?action=query&prop=revisions|pageprops&ppprop=wikibase_item&rvprop=content&rvslots=main&redirects=1&format=json&formatversion=2&titles=` +
        encodeURIComponent(batch.join('|')),
    );
    const alias = new Map();
    for (const n of j.query.normalized || []) alias.set(n.from, n.to);
    const redirect = new Map((j.query.redirects || []).map((r) => [r.from, r.to]));
    const byTitle = new Map(j.query.pages.map((p) => [p.title, p]));
    const truncated = [];
    for (const t of batch) {
      let k = alias.get(t) || t;
      k = redirect.get(k) || k;
      const p = byTitle.get(k);
      if (!p || p.missing || p.invalid) continue;
      const text = p.revisions?.[0]?.slots?.main?.content;
      if (text == null) {
        if (batch.length > 1) truncated.push(t);
        continue;
      }
      out.set(t, { title: p.title, text, qid: p.pageprops?.wikibase_item });
    }
    if (truncated.length)
      for (const [t, v] of await pages(host, truncated, Math.max(1, Math.floor(size / 4))))
        out.set(t, v);
  }
  return out;
}

const PT_CLUBS = {
  'Athletico-PR': 'Club Athletico Paranaense',
  'Atlético-MG': 'Clube Atlético Mineiro',
  Bahia: 'Esporte Clube Bahia',
  Botafogo: 'Botafogo de Futebol e Regatas',
  Chapecoense: 'Associação Chapecoense de Futebol',
  Corinthians: 'Sport Club Corinthians Paulista',
  Coritiba: 'Coritiba Foot Ball Club',
  Cruzeiro: 'Cruzeiro Esporte Clube',
  Flamengo: 'Clube de Regatas do Flamengo',
  Fluminense: 'Fluminense Football Club',
  Grêmio: 'Grêmio Foot-Ball Porto Alegrense',
  Internacional: 'Sport Club Internacional',
  Mirassol: 'Mirassol Futebol Clube',
  Palmeiras: 'Sociedade Esportiva Palmeiras',
  'Red Bull Bragantino': 'Red Bull Bragantino',
  Remo: 'Clube do Remo',
  Santos: 'Santos Futebol Clube',
  'São Paulo': 'São Paulo Futebol Clube',
  Vasco: 'Club de Regatas Vasco da Gama',
  Vitória: 'Esporte Clube Vitória',
  'América-MG': 'América Futebol Clube (Belo Horizonte)',
  Athletic: 'Athletic Club (Minas Gerais)',
  'Atlético-GO': 'Atlético Clube Goianiense',
  Avaí: 'Avaí Futebol Clube',
  'Botafogo-SP': 'Botafogo Futebol Clube (Ribeirão Preto)',
  Ceará: 'Ceará Sporting Club',
  CRB: 'Clube de Regatas Brasil',
  Criciúma: 'Criciúma Esporte Clube',
  Cuiabá: 'Cuiabá Esporte Clube',
  Fortaleza: 'Fortaleza Esporte Clube',
  Goiás: 'Goiás Esporte Clube',
  Juventude: 'Esporte Clube Juventude',
  Londrina: 'Londrina Esporte Clube',
  Náutico: 'Clube Náutico Capibaribe',
  Novorizontino: 'Grêmio Novorizontino',
  'Operário-PR': 'Operário Ferroviário Esporte Clube',
  'Ponte Preta': 'Associação Atlética Ponte Preta',
  'São Bernardo': 'São Bernardo Futebol Clube',
  Sport: 'Sport Club do Recife',
  'Vila Nova': 'Vila Nova Futebol Clube',
};

// Texto livre de posição (pt/en) -> código do jogo; 'FB'/'W'/'MID' = lado/função indefinidos.
const RULES = [
  [/goleiro|guarda redes|goalkeeper/, 'GK'],
  [/lateral direito|ala direit|right back|right wing back|defesa direito/, 'RB'],
  [/lateral esquerdo|ala esquerd|left back|left wing back|defesa esquerdo/, 'LB'],
  [/zagueiro|central defender|centre back|center back|defesa central|libero|sweeper/, 'CB'],
  [/segundo volante/, 'CM'],
  [/volante|defensive midfield|medio defensivo|trinco|holding midfield/, 'DM'],
  [/ponta esquerd|extremo esquerdo|left wing|left midfield|meia esquerd/, 'LW'],
  [/ponta direit|extremo direito|right wing|right midfield|meia direit/, 'RW'],
  [
    /meia atacante|meia ofensivo|attacking midfield|medio ofensivo|playmaker|meia armador|armador|enganche/,
    'AM',
  ],
  [/central midfield|medio centro|box to box|segundo homem/, 'CM'],
  [
    /centroavante|centre forward|center forward|second striker|striker|avancado centro|ponta de lanca/,
    'ST',
  ],
  [/meio campista|meio campo|^medio$/, 'CM~'],
  [/^meia$|^meia /, 'AM~'],
  [/^atacante|^forward|^avancado/, 'ST~'],
  [/lateral|full back|wing back|fullback/, 'FB'],
  [/ponta|winger|extremo|^wing/, 'W'],
];
const EXTRA_ALIASES = {
  'Atlético-MG': ['atletico mineiro'],
  'Athletico-PR': ['athletico paranaense', 'atletico paranaense'],
  Vasco: ['vasco da gama'],
  'Red Bull Bragantino': ['bragantino'],
  'América-MG': ['america mineiro'],
  'Atlético-GO': ['atletico goianiense'],
  'Botafogo-SP': ['botafogo ribeirao preto'],
  'Operário-PR': ['operario ferroviario'],
  Sport: ['sport recife'],
  Athletic: ['athletic club'],
  Remo: ['clube do remo'],
  Grêmio: ['gremio fbpa'],
};
const OGOL_ALIASES = {
  'Operário-PR': ['operario ferroviario'],
  Novorizontino: ['gremio novorizontino'],
  Athletic: ['athletic mg'],
  'Red Bull Bragantino': ['rb bragantino', 'bragantino'],
};
const ENTITIES = { amp: '&', quot: '"', apos: "'", nbsp: ' ', lt: '<', gt: '>' };
const MARKS = {
  acute: '\u0301',
  grave: '\u0300',
  circ: '\u0302',
  tilde: '\u0303',
  uml: '\u0308',
  cedil: '\u0327',
};
const decodeEntities = (s) =>
  s
    .replace(/&([a-zA-Z])(acute|grave|circ|tilde|uml|cedil);/g, (_, l, m) =>
      (l + MARKS[m]).normalize('NFC'),
    )
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(\w+);/g, (m, n) => ENTITIES[n] ?? m);
const ELENCO = { G: 'GK', Z: 'CB', LD: 'RB', LE: 'LB', V: 'DM', L: 'FB' };
const MACRO = {
  GK: 'GOL',
  CB: 'DEF',
  LB: 'DEF',
  RB: 'DEF',
  FB: 'DEF',
  DM: 'MEI',
  CM: 'MEI',
  AM: 'MEI',
  MID: 'MEI',
  LW: 'ATA',
  RW: 'ATA',
  W: 'ATA',
  ST: 'ATA',
};
export const CANDIDATES = { FB: ['LB', 'RB'], W: ['LW', 'RW'] };

function stripMarkup(s) {
  return s
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<ref[\s\S]*?<\/ref>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\{\{(?:nowrap|small|hlist|flatlist|plainlist|ubl|unbulleted list)\s*\|/gi, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/'''?/g, '');
}
function classify(text) {
  if (!text) return null;
  const parts = stripMarkup(text)
    .split(/\n|,|;|\/|\be\b|\band\b|\bou\b|\bor\b|\*|\(|\)|\{\{|\}\}|\|/)
    .map(norm)
    .filter(Boolean);
  // Primeiro termo específico; depois lado indefinido (FB/W); por último termos genéricos (~).
  const found = parts.map((part) => RULES.find(([re]) => re.test(part))?.[1]).filter(Boolean);
  return (
    found.find((c) => !c.endsWith('~') && !CANDIDATES[c]) ||
    found.find((c) => CANDIDATES[c]) ||
    found[0] ||
    null
  );
}
// Todas as posi??es espec?ficas citadas (ex.: "centroavante, meia-atacante" -> ST, AM).
function classifyAll(text) {
  if (!text) return [];
  return stripMarkup(text)
    .split(/\n|,|;|\/|\be\b|\band\b|\bou\b|\bor\b|\*|\(|\)|\{\{|\}\}|\|/)
    .map(norm)
    .filter(Boolean)
    .map((part) => RULES.find(([re]) => re.test(part))?.[1])
    .filter((c) => c && !c.endsWith('~') && !CANDIDATES[c]);
}
function infoboxField(text, names) {
  for (const name of names) {
    const m = text.match(
      new RegExp(`\\|\\s*${name}\\s*=([^\\n]*(?:\\n(?!\\s*\\|)(?!\\}\\})[^\\n]*)*)`, 'i'),
    );
    if (m && m[1].trim()) return m[1].trim();
  }
  return null;
}
const links = (text) =>
  [...text.matchAll(/\[\[([^\]|#]+)(?:\|([^\]]*))?\]\]/g)].map((m) => ({
    target: m[1].trim(),
    label: (m[2] || m[1]).trim(),
  }));

async function wikidataPositions(qids) {
  const out = new Map();
  const list = [...new Set(qids.filter(Boolean))];
  for (let i = 0; i < list.length; i += 50) {
    const j = await get(
      'https://www.wikidata.org/w/api.php?action=wbgetentities&props=claims|sitelinks&sitefilter=enwiki|ptwiki&format=json&ids=' +
        list.slice(i, i + 50).join('|'),
    );
    for (const [id, e] of Object.entries(j.entities || {})) out.set(id, e);
  }
  return out;
}
async function labels(qids) {
  const out = new Map();
  const list = [...new Set(qids)];
  for (let i = 0; i < list.length; i += 50) {
    const j = await get(
      'https://www.wikidata.org/w/api.php?action=wbgetentities&props=labels&languages=en&format=json&ids=' +
        list.slice(i, i + 50).join('|'),
    );
    for (const [id, e] of Object.entries(j.entities || {})) out.set(id, e.labels?.en?.value || '');
  }
  return out;
}

async function main() {
  const rows = JSON.parse(await readFile(path.join(root, 'data', 'players.json'), 'utf8'));
  const byClub = Map.groupBy(rows, (r) => r.club_name);
  const evidence = new Map(); // player_id -> [{code, source, kind}]
  const extra = new Map(); // player_id -> posi??es citadas pelas fontes
  const more = (id, codes) => {
    if (!extra.has(id)) extra.set(id, new Set());
    for (const c of codes) extra.get(id).add(c);
  };
  const add = (id, code, source, kind) => {
    if (!code) return;
    if (!evidence.has(id)) evidence.set(id, []);
    evidence
      .get(id)
      .push({ code: code.replace('~', ''), generic: code.endsWith('~'), source, kind });
  };

  // 1) Artigos dos clubes (pt): elenco atual + navboxes "Elenco ...".
  const ptClubs = await pages('pt.wikipedia.org', Object.values(PT_CLUBS), 5);
  const candidates = new Map(); // club -> [{target,label,code,host,source}]
  const push = (club, c) => {
    if (!candidates.has(club)) candidates.set(club, []);
    candidates.get(club).push(c);
  };
  const navNames = new Map();
  for (const [club, title] of Object.entries(PT_CLUBS)) {
    const page = ptClubs.get(title);
    if (!page) continue;
    const url = `https://pt.wikipedia.org/wiki/${encodeURIComponent(page.title.replaceAll(' ', '_'))}`;
    const w = page.text;
    for (const m of w.matchAll(/\|\s*(c\d+_j\d+)_pos\s*=\s*([^\n|]*)/g)) {
      const nome = w.match(new RegExp(`\\|\\s*${m[1]}_nome\\s*=\\s*([^\\n]*)`));
      const l = nome && links(nome[1])[0];
      const raw = m[2].trim().split('/')[0];
      if (l)
        push(club, {
          ...l,
          code: ELENCO[raw],
          host: 'pt.wikipedia.org',
          source: url + '#Elenco_atual',
        });
    }
    for (const t of w.matchAll(/\{\{\s*(Elenco[^|}\n]*)\}\}/gi)) {
      const name = t[1].trim();
      if (/^elenco atual de futebol$|feminin|sub-|base/i.test(name)) continue;
      navNames.set('Predefinição:' + name, club);
    }
  }
  const navs = await pages('pt.wikipedia.org', [...navNames.keys()], 20);
  for (const [t, club] of navNames) {
    const page = navs.get(t);
    if (!page) continue;
    const url = `https://pt.wikipedia.org/wiki/${encodeURIComponent(page.title.replaceAll(' ', '_'))}`;
    for (const l of links(page.text)) push(club, { ...l, host: 'pt.wikipedia.org', source: url });
  }

  // 2) Artigos dos clubes (en): {{Fs player}} do elenco atual.
  const clubEntities = await wikidataPositions([...ptClubs.values()].map((p) => p.qid));
  const enTitles = new Map();
  for (const [club, title] of Object.entries(PT_CLUBS)) {
    const qid = ptClubs.get(title)?.qid;
    const en = qid && clubEntities.get(qid)?.sitelinks?.enwiki?.title;
    if (en) enTitles.set(en, club);
  }
  const enClubs = await pages('en.wikipedia.org', [...enTitles.keys()], 5);
  const enNav = new Map();
  for (const [t, club] of enTitles) {
    const page = enClubs.get(t);
    if (!page) continue;
    const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replaceAll(' ', '_'))}`;
    for (const m of page.text.matchAll(
      /\{\{\s*(?:fs|football squad) player([^}]*(?:\}\}[^}]*)?)\}\}/gi,
    )) {
      const nameField = m[1].match(/\|\s*name\s*=\s*([^|]*(?:\[\[[^\]]*\]\][^|]*)?)/i);
      const l = nameField && links(nameField[1])[0];
      if (l) push(club, { ...l, host: 'en.wikipedia.org', source: url + '#Current_squad' });
    }
    for (const t2 of page.text.matchAll(/\{\{\s*([^|}\n]*squad)\s*\}\}/gi))
      if (!/women|youth|u-?\d+/i.test(t2[1])) enNav.set('Template:' + t2[1].trim(), club);
  }
  const enNavPages = await pages('en.wikipedia.org', [...enNav.keys()], 20);
  for (const [t, club] of enNav) {
    const page = enNavPages.get(t);
    if (!page) continue;
    const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replaceAll(' ', '_'))}`;
    for (const l of links(page.text)) push(club, { ...l, host: 'en.wikipedia.org', source: url });
  }

  // 3) Casamento por nome dentro do clube.
  const matched = new Map(); // `${host}|${target}` -> [player ids]
  const currentList = new Set();
  const rowById = new Map(rows.map((r) => [r.player_id, r]));
  for (const [club, list] of candidates) {
    const clubRows = byClub.get(club) || [];
    const index = new Map();
    for (const r of clubRows)
      for (const k of new Set([norm(r.display_name), norm(r.full_name)]))
        index.set(k, index.has(k) && index.get(k) !== r ? null : r);
    for (const c of list) {
      const keys = new Set([norm(c.label), norm(c.target)]);
      let row = null;
      for (const k of keys) if (index.get(k)) row = index.get(k);
      if (!row) continue;
      c.row = row;
      if (c.code) add(row.player_id, c.code, c.source, 'elenco');
      const key = `${c.host}|${c.target}`;
      if (/#(Elenco_atual|Current_squad)$/.test(c.source))
        currentList.add(`${key}|${row.player_id}`);
      if (!matched.has(key)) matched.set(key, new Set());
      matched.get(key).add(row.player_id);
    }
  }

  const aliases = (club) => {
    const pt = PT_CLUBS[club];
    const short = new Set([norm(club), norm(club.replace(/-/g, ' '))]);
    const long = new Set([norm(pt), ...(EXTRA_ALIASES[club] || [])]);
    for (const [t, c] of enTitles) if (c === club) long.add(norm(t));
    return { short, long };
  };
  const clubAliases = new Map(Object.keys(PT_CLUBS).map((c) => [c, aliases(c)]));
  const mentionsClub = (field, club) => {
    if (!field) return false;
    const { short, long } = clubAliases.get(club);
    const keys = links(field).flatMap((l) => [norm(l.target), norm(l.label)]);
    for (const m of field.matchAll(/\{\{\s*(?:Futebol|Fb team|Fbaicon)\s+([^}|]+)/gi))
      keys.push(norm(m[1]));
    keys.push(norm(stripMarkup(field)));
    return keys.some((k) => long.has(k) || short.has(k));
  };
  // Artigo só vale se o clube atual do infobox for o do elenco (ou se veio de lista de elenco atual).
  const currentClubOk = (box, r, isPt) =>
    mentionsClub(
      infoboxField(
        box,
        isPt
          ? ['actualclube', 'clubeatual', 'atualclube', 'clube_atual', 'clube atual']
          : ['currentclub', 'current_club'],
      ),
      r.club_name,
    ) ||
    (isPt &&
      mentionsClub(
        box.match(/\}\}\s*\n[^\n]*?[Aa]tualmente[^.\n]*/)?.[0].replace(/^[\s\S]*?\}\}/, ''),
        r.club_name,
      ));
  const birthOk = (box, r, isPt) => {
    if (!r.birth_date) return true;
    const field = infoboxField(
      box,
      isPt
        ? ['nascimento_data', 'data_nascimento', 'datadenascimento', 'nascimento']
        : ['birth_date'],
    );
    const year = field?.match(/\b(19[5-9]\d|200\d|201\d)\b/)?.[1];
    return !year || year === r.birth_date.slice(0, 4);
  };
  const infoboxOf = (text) => {
    const i = text.search(/\{\{\s*(info\/futebolista|infobox football biography|info\/jogador)/i);
    return i < 0 ? null : text.slice(i, i + 8000);
  };
  // 4) Infobox dos atletas (pt e en) + Wikidata P413.
  const qidOf = new Map();
  for (const host of ['pt.wikipedia.org', 'en.wikipedia.org']) {
    const titles = [...matched.keys()]
      .filter((k) => k.startsWith(host))
      .map((k) => k.slice(host.length + 1));
    const got = await pages(host, titles, 20);
    for (const t of titles) {
      const page = got.get(t);
      if (!page) continue;
      const ids = matched.get(`${host}|${t}`);
      const isPt = host.startsWith('pt');
      const text = page.text;
      const box = infoboxOf(text);
      if (!box) continue;
      const field = infoboxField(box, isPt ? ['posição', 'posicao', 'position'] : ['position']);
      const code = classify(field);
      const url = `https://${host}/wiki/${encodeURIComponent(page.title.replaceAll(' ', '_'))}`;
      for (const id of ids) {
        const r = rowById.get(id);
        if (!birthOk(box, r, isPt)) continue;
        if (!currentList.has(`${host}|${t}|${id}`) && !currentClubOk(box, r, isPt)) continue;
        add(id, code, url, isPt ? 'pt' : 'en');
        more(id, classifyAll(field));
        if (page.qid && !qidOf.has(id)) qidOf.set(id, page.qid);
      }
    }
  }
  // 4b) Atletas sem artigo ligado ao elenco: tenta títulos prováveis e só aceita se o infobox citar o clube.
  const resolvedByArticle = new Set(
    [...evidence]
      .filter(([, ev]) => ev.some((e) => e.kind === 'pt' || e.kind === 'en'))
      .map(([id]) => id),
  );
  const pending = rows.filter(
    (r) => r.macro_position !== 'GOL' && !resolvedByArticle.has(r.player_id),
  );
  const guesses = { 'pt.wikipedia.org': new Map(), 'en.wikipedia.org': new Map() };
  const guess = (host, title, r) => {
    if (!guesses[host].has(title)) guesses[host].set(title, new Set());
    guesses[host].get(title).add(r);
  };
  for (const r of pending)
    for (const name of new Set([r.display_name.trim(), r.full_name.trim()])) {
      for (const s of [
        '',
        ' (futebolista)',
        ' (futebolista brasileiro)',
        ` (futebolista, nascido em ${(r.birth_date || '').slice(0, 4)})`,
      ])
        if (!s.includes('em )')) guess('pt.wikipedia.org', name + s, r);
      for (const s of [
        '',
        ' (footballer)',
        ' (Brazilian footballer)',
        ` (footballer, born ${(r.birth_date || '').slice(0, 4)})`,
      ])
        if (!s.includes('born )')) guess('en.wikipedia.org', name + s, r);
    }
  for (const host of Object.keys(guesses)) {
    const isPt = host.startsWith('pt');
    let got = await pages(host, [...guesses[host].keys()], 40);
    // Páginas de desambiguação: segue links para futebolistas.
    const extra = new Map();
    for (const [t, page] of got)
      if (
        /\{\{\s*(desambiguação|disambiguation|dis\b|hndis|human name disambiguation)/i.test(
          page.text,
        )
      )
        for (const l of links(page.text))
          if (/futebolista|footballer/i.test(l.target))
            for (const r of guesses[host].get(t)) {
              if (!extra.has(l.target)) extra.set(l.target, new Set());
              extra.get(l.target).add(r);
            }
    const got2 = await pages(host, [...extra.keys()], 40);
    const all = [
      ...[...got].map(([t, p]) => [p, guesses[host].get(t)]),
      ...[...got2].map(([t, p]) => [p, extra.get(t)]),
    ];
    for (const [page, rs] of all) {
      const box = infoboxOf(page.text);
      if (!box) continue;
      const url = `https://${host}/wiki/${encodeURIComponent(page.title.replaceAll(' ', '_'))}`;
      for (const r of rs) {
        if (
          resolvedByArticle.has(r.player_id) ||
          !currentClubOk(box, r, isPt) ||
          !birthOk(box, r, isPt)
        )
          continue;
        const field = infoboxField(box, isPt ? ['posição', 'posicao', 'position'] : ['position']);
        const code = classify(field);
        if (!code) continue;
        resolvedByArticle.add(r.player_id);
        add(r.player_id, code, url, isPt ? 'pt' : 'en');
        more(r.player_id, classifyAll(field));
        if (page.qid && !qidOf.has(r.player_id)) qidOf.set(r.player_id, page.qid);
      }
    }
  }

  const entities = await wikidataPositions([...qidOf.values()]);
  const posQids = [];
  for (const e of entities.values())
    for (const c of e.claims?.P413 || [])
      if (c.mainsnak?.datavalue) posQids.push(c.mainsnak.datavalue.value.id);
  const posLabel = await labels(posQids);
  for (const [id, qid] of qidOf) {
    const claims = entities.get(qid)?.claims?.P413 || [];
    const ranked = [...claims].sort((a, b) => (b.rank === 'preferred') - (a.rank === 'preferred'));
    more(
      id,
      ranked.flatMap((c) => classifyAll(posLabel.get(c.mainsnak?.datavalue?.value?.id))),
    );
    for (const c of ranked) {
      const code = classify(posLabel.get(c.mainsnak?.datavalue?.value?.id));
      if (code) {
        add(id, code, `https://www.wikidata.org/wiki/${qid}`, 'wikidata');
        break;
      }
    }
  }

  // 4c) oGol: página do elenco 2026 de cada clube -> página do atleta ("Posição"), só para quem ainda
  // não tem posição específica pelas fontes acima.
  const needsOgol = rows.filter((r) => {
    if (r.macro_position === 'GOL') return false;
    const ev = (evidence.get(r.player_id) || []).filter((e) => e.code !== 'GK');
    return !ev.some((e) => !e.generic && !CANDIDATES[e.code] && e.kind !== 'elenco');
  });
  const OGOL = 'https://www.ogol.com.br';
  const teamLinks = new Map();
  for (const ed of [
    '/edicao/brasileirao-serie-a-2026/210277',
    '/edicao/brasileirao-serie-b-2026/210278',
  ]) {
    const { html } = await get(OGOL + ed, true);
    for (const m of html.matchAll(/href="(\/equipe\/[^"?]+)[^"]*"[^>]*>\s*([^<]+?)\s*</g)) {
      const name = norm(decodeEntities(m[2]));
      const club = Object.keys(PT_CLUBS).find((c) => {
        const { short, long } = clubAliases.get(c);
        return short.has(name) || long.has(name) || (OGOL_ALIASES[c] || []).includes(name);
      });
      if (club && !teamLinks.has(club)) teamLinks.set(club, m[1]);
    }
  }
  const ogolCount = { teams: teamLinks.size, pages: 0 };
  for (const [club, link] of teamLinks) {
    const todo = needsOgol.filter((r) => r.club_name === club);
    if (!todo.length) continue;
    const { html } = await get(OGOL + link, true);
    const squad = [...html.matchAll(/href="(\/jogador\/[^"?]+)[^"]*">([^<]+)<\/a>/g)].map((m) => ({
      url: OGOL + m[1],
      key: norm(decodeEntities(m[2])),
    }));
    for (const r of todo) {
      const keys = new Set([norm(r.display_name), norm(r.full_name)]);
      const hits = [...new Set(squad.filter((s) => keys.has(s.key)).map((s) => s.url))];
      if (hits.length !== 1) continue;
      const { html: page } = await get(hits[0], true);
      ogolCount.pages++;
      const i = page.indexOf('>Posição</span>');
      if (i < 0) continue;
      const block = page.slice(i, page.indexOf('card-data__row', i + 20) >>> 0 || i + 3000);
      const values = [...block.matchAll(/card-data__value">([^<]+)</g)].map((m) =>
        decodeEntities(m[1]),
      );
      const code = classify(values[0]);
      if (code) add(r.player_id, code, hits[0], 'ogol');
      more(r.player_id, values.flatMap(classifyAll));
    }
  }
  console.log('oGol', ogolCount, 'pendentes', needsOgol.length);

  // 5) Consolidação. Ordem das fontes: infobox pt > infobox en > Wikidata > oGol > código do elenco atual.
  // Termo específico vence termo de lado indefinido (lateral/ponta), que vence termo genérico (atacante/meia).
  // Termos genéricos que contradizem a macroposição do elenco de origem são descartados.
  const order = ['pt', 'en', 'wikidata', 'ogol', 'elenco'];
  const result = {};
  const stats = { conflictsMacro: 0 };
  for (const r of rows) {
    if (r.macro_position === 'GOL') continue;
    const ev = (evidence.get(r.player_id) || [])
      .filter((e) => e.code !== 'GK' && (!e.generic || MACRO[e.code] === r.macro_position))
      .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
    if (!ev.length) continue;
    const specific = ev.filter((e) => !e.generic && !CANDIDATES[e.code]);
    const sameMacro = specific.find((e) => MACRO[e.code] === r.macro_position);
    let best =
      (sameMacro && sameMacro.kind !== 'elenco' ? sameMacro : specific[0]) ||
      ev.find((e) => CANDIDATES[e.code]) ||
      ev[0];
    if (CANDIDATES[best.code]) {
      const side = ev.find((e) => CANDIDATES[best.code].includes(e.code));
      if (side) best = side;
    }
    if (MACRO[best.code] !== r.macro_position) stats.conflictsMacro++;
    result[r.player_id] = CANDIDATES[best.code]
      ? { candidates: CANDIDATES[best.code], source: best.source }
      : { position: best.code, source: best.source };
    const main = result[r.player_id].position;
    const secondary = [...(extra.get(r.player_id) || [])]
      .filter((c) => c !== main && c !== 'GK')
      .slice(0, 2);
    if (main && secondary.length) result[r.player_id].secondary = secondary;
    result[r.player_id]._kind = best.kind;
  }
  return { rows, result, stats, evidence, candidates };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { rows, result, stats } = await main();
  const count = {};
  for (const v of Object.values(result)) {
    const k = v._kind + (v.position ? '' : '(side?)');
    count[k] = (count[k] || 0) + 1;
    delete v._kind;
  }
  const outfield = rows.filter((r) => r.macro_position !== 'GOL').length;
  const sorted = Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(
    path.join(root, 'data', 'positions.json'),
    JSON.stringify(sorted, null, 2) + '\n',
  );
  console.log({ outfield, resolved: Object.keys(result).length, ...count, ...stats });
}
