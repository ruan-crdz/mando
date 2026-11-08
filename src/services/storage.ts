import { careerSchema, worldSchema, type Career, type World } from '../game/types';
import { validateCareerForWorld } from '../game/engine';
import { applyPlayerBirthYearCorrections } from '../game/realWorld';
import { z } from 'zod';

const recordSchema = z.object({
  career: careerSchema,
  world: worldSchema,
  savedAt: z.string().datetime(),
  cloudRevision: z.number().int().nonnegative().default(0),
});
export type SavedCareer = z.infer<typeof recordSchema>;

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('mando-careers', 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore('careers', { keyPath: 'career.id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          'Não foi possível abrir o armazenamento local. Verifique as permissões do navegador.',
        ),
      );
  });
}

async function transaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
  afterRead?: (value: T, store: IDBObjectStore) => void,
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('careers', mode);
    const store = tx.objectStore('careers');
    const request = operation(store);
    let operationError: unknown;
    if (afterRead)
      request.onsuccess = () => {
        try {
          afterRead(request.result, store);
        } catch (error) {
          operationError = error;
          tx.abort();
        }
      };
    tx.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    tx.onerror = () => {
      db.close();
      reject(operationError || tx.error || new Error('Erro ao persistir a carreira.'));
    };
    tx.onabort = () => {
      db.close();
      reject(operationError || tx.error || new Error('Gravação da carreira interrompida.'));
    };
  });
}

export async function saveLocal(career: Career, world: World, cloudRevision = 0) {
  const correctedWorld = applyPlayerBirthYearCorrections(world);
  validateCareerForWorld(career, correctedWorld);
  const record: SavedCareer = {
    career,
    world: correctedWorld,
    savedAt: new Date().toISOString(),
    cloudRevision,
  };
  await transaction('readwrite', (store) => store.put(record));
  return record;
}

export async function listLocal(): Promise<SavedCareer[]> {
  let records: SavedCareer[] = [];
  await transaction<unknown[]>(
    'readwrite',
    (store) => store.getAll(),
    (values, store) => {
      records = values.map((value) => {
        const record = recordSchema.parse(value);
        const world = applyPlayerBirthYearCorrections(record.world);
        validateCareerForWorld(record.career, world);
        if (world === record.world) return record;
        const corrected = { ...record, world };
        store.put(corrected);
        return corrected;
      });
    },
  );
  return records.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function removeLocal(id: string) {
  await transaction('readwrite', (store) => store.delete(id));
}

export function exportSave(career: Career, world: World) {
  const text = JSON.stringify({
    career,
    world: applyPlayerBirthYearCorrections(world),
    savedAt: new Date().toISOString(),
    cloudRevision: 0,
  });
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `mando-${career.clubId}-${career.date}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importSave(file: File) {
  if (file.size > 20000000) throw new Error('Save acima do limite de 20 MB.');
  const record = recordSchema.parse(JSON.parse(await file.text()));
  validateCareerForWorld(record.career, record.world);
  return saveLocal(record.career, record.world, 0);
}
