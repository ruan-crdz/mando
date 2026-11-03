import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const shared = path.join(root, 'supabase', 'functions', '_shared');
const output = path.join(root, 'dist-edge');
const types = await readFile(path.join(shared, 'database.types.ts'), 'utf8');
const handler = await readFile(path.join(shared, 'handler.ts'), 'utf8');
const localImport = "import { type Database, type Json } from './database.types.ts';";
if (!handler.includes(localImport)) {
  throw new Error('O import compartilhado mudou. Atualize o bundler antes de publicar.');
}
await mkdir(output, { recursive: true });
for (const kind of ['message', 'news', 'staff', 'avatar']) {
  const name = kind === 'avatar' ? 'ai-manager-avatar' : `ai-${kind}`;
  const source = `${types}\n${handler.replace(localImport, '')}\nDeno.serve((req) => handle(req, '${kind}'));\n`;
  await writeFile(path.join(output, `${name}.ts`), source, 'utf8');
  console.log(`Generated ${name}.ts`);
}
