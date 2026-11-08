import { expect, test, type Page } from '@playwright/test';
import { type SavedCareer } from '../src/services/storage';

async function createCareer(page: Page, prepareManager?: () => Promise<void>) {
  await page.goto('./');
  await expect(page.getByRole('button', { name: /Continuar carreira/i })).toHaveCount(0);
  await page.getByRole('button', { name: /Nova carreira/i }).click();
  await page.getByRole('button', { name: /Brasileirão 2026/ }).click();
  await page.getByLabel('Nome', { exact: true }).fill('Alex');
  await page.getByLabel('Sobrenome').fill('Silva');
  await prepareManager?.();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('button', { name: /São Paulo/ }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('button', { name: 'Assumir o clube' }).click();
  await page.getByRole('button', { name: 'Assinar contrato' }).click();
  await page.getByRole('button', { name: 'Pular tutorial' }).click();
  await expect(page.getByRole('heading', { name: /Bom trabalho, Alex/ })).toBeVisible();
}

async function pickCompetition(page: Page, name: RegExp) {
  const label = page.locator('.stick-switcher strong');
  for (let i = 0; i < 12 && !name.test((await label.textContent()) || ''); i++) {
    await page.locator('.stick-switcher').getByRole('button', { name: 'Próximo' }).click();
  }
  await expect(label).toHaveText(name);
}

async function openSeason(page: Page, view: 'table' | 'calendar' = 'table') {
  await page
    .getByRole('navigation', { name: 'Áreas do clube' })
    .getByRole('button', { name: 'ESCRITÓRIO', exact: true })
    .click();
  await page
    .getByRole('navigation', { name: 'Atalhos do Escritório' })
    .getByRole('button', { name: view === 'table' ? 'Classificação' : 'Calendário', exact: true })
    .click();
}

async function resolvePendingMessages(page: Page) {
  const openOffice = page.getByRole('button', { name: /Abrir escritório|Abrir notificações/ });
  while (await openOffice.isVisible()) {
    await openOffice.click();
    await page.locator('.response-area button').first().click();
    await page
      .getByRole('navigation', { name: 'Áreas do clube' })
      .getByRole('button', { name: /CENTRAL/ })
      .click();
  }
}

test('criação, todas as abas, negociação, avanço e save/load persistente', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await createCareer(page);
  await page
    .getByRole('navigation', { name: 'Áreas do clube' })
    .getByRole('button', { name: /TIME/ })
    .click();
  await page.getByRole('button', { name: 'Tática', exact: true }).click();
  await page
    .getByRole('radiogroup', { name: 'Formação' })
    .getByRole('radio', { name: '4-3-3' })
    .click();
  await expect(page.locator('.football-pitch .pitch-player-face')).toHaveCount(11);
  const pitchRows = await page.locator('.football-pitch .pitch-player').evaluateAll((buttons) => {
    const rows = new Map<string, number>();
    for (const button of buttons) {
      const top = (button as HTMLElement).style.top;
      rows.set(top, (rows.get(top) ?? 0) + 1);
    }
    return [...rows.values()];
  });
  expect(pitchRows).toEqual([1, 4, 3, 3]);
  await page.getByRole('button', { name: 'Escalação', exact: true }).click();
  const benchPlayer = page
    .locator('[data-bench-player]:not(:disabled):not([aria-label*=", GK,"])')
    .first();
  const benchName = (await benchPlayer.getAttribute('aria-label'))!.split(',')[0];
  await benchPlayer.click();
  await page.locator('[data-slot="10"]').click();
  await expect(page.locator('[data-slot="10"]')).toHaveAttribute(
    'aria-label',
    new RegExp(benchName),
  );
  await page.getByRole('button', { name: 'Responsabilidades' }).click();
  await page.locator('.role-card[data-role="Capitão"]').click();
  await expect(page.locator('.player-card').first()).toBeVisible();
  await page.getByRole('button', { name: 'Comissão', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Auxiliares por setor' })).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Orçamento mensal dos auxiliares', exact: true })
    .fill('20000');
  await page.getByRole('button', { name: 'Contratar auxiliar', exact: true }).first().click();
  const assistantDialog = page.getByRole('dialog', { name: 'Escolher auxiliar' });
  await expect(assistantDialog.locator('.assistant-card')).toHaveCount(20);
  await assistantDialog.getByRole('button', { name: 'Contratar Ana Ribeiro' }).click();
  await expect(page.locator('.assistant-grid')).toContainText('Ana Ribeiro');
  await page.getByRole('button', { name: 'Contratar auxiliar', exact: true }).first().click();
  await expect(assistantDialog.locator('.assistant-card')).toHaveCount(19);
  await expect(assistantDialog.getByRole('button', { name: 'Contratar Ana Ribeiro' })).toHaveCount(
    0,
  );
  await assistantDialog.getByRole('button', { name: 'Contratar Lucas Ferreira' }).click();
  await expect(
    page.getByRole('region', { name: 'Ataque', exact: true }).locator('.assistant-card'),
  ).toHaveCount(2);
  await page
    .getByRole('navigation', { name: 'Áreas do clube' })
    .getByRole('button', { name: /TRANSFERÊNCIAS/ })
    .click();
  const marketRows = page.locator('.market-row[data-market-player]');
  await expect(marketRows.first()).toBeVisible();
  const photoIndex = await marketRows.evaluateAll((rows) =>
    rows.findIndex((row) => row.querySelector('.face-tier img')),
  );
  expect(photoIndex).toBeGreaterThanOrEqual(0);
  const marketFace = marketRows.nth(photoIndex).locator('.player-face.face-tier');
  const tierBackground = await marketFace.evaluate(
    (face) => getComputedStyle(face).backgroundImage,
  );
  expect(tierBackground).toContain('gradient');
  await marketFace.locator('img').dispatchEvent('error');
  await expect(marketFace).toHaveClass(/generated/);
  await expect(marketFace).toHaveCSS('background-image', tierBackground);
  await page.getByLabel('Nome', { exact: true }).fill('inexistente');
  await expect(page.getByText('Nenhum atleta atende a todos os critérios.')).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Áreas do clube' })
    .getByRole('button', { name: 'NOTIFICAÇÕES', exact: true })
    .click();
  await page.getByRole('button', { name: 'Conversas com atletas', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Conversas com atletas' }).getByRole('button'),
  ).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Elogiar esforço', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /Responder com apoio/ }).click();
  await expect(page.getByRole('button', { name: /Responder com apoio/ })).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Recados e conversas com o elenco.' }),
  ).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Áreas do clube' })
    .getByRole('button', { name: 'ACADEMIA', exact: true })
    .click();
  await page.getByRole('button', { name: 'Torneio de base', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Liga de base Sub-20/ })).toBeVisible();
  await expect(page.locator('.academy-fixture-list article')).toHaveCount(14);
  await page.getByRole('button', { name: 'Elenco jovem', exact: true }).click();
  const youthRows = page.locator('.academy-roster-list .roster-row');
  await expect(youthRows).toHaveCount(18);
  const youthFace = youthRows.first().locator('.player-face.generated');
  await expect(youthFace).toHaveCount(1);
  await expect(youthFace).toHaveCSS('background-image', /gradient/);
  const youthStats = page.getByRole('region', { name: 'Ficha do jogador' });
  await expect(youthStats).toBeVisible();
  await page.locator('.academy-roster-row[data-age="15"]').first().click();
  await expect(page.getByRole('button', { name: /Promover ao profissional/ })).toHaveCount(0);
  const eligibleYouth = page.locator('.academy-roster-row[data-age="16"]').first();
  const youthName = await eligibleYouth.locator('strong').innerText();
  await eligibleYouth.click();
  await expect(youthStats.getByRole('heading', { name: youthName, exact: true })).toBeVisible();
  await expect(youthStats.locator('.attribute-grid > div')).toHaveCount(19);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /Promover ao profissional/ })).toHaveCount(0);
  await eligibleYouth.click();
  await page.getByRole('button', { name: /Promover ao profissional/ }).click();
  await expect(youthRows).toHaveCount(17);
  await expect(page.locator('.academy-roster-list .roster-row:focus')).toHaveCount(1);
  await page
    .getByRole('navigation', { name: 'Áreas do clube' })
    .getByRole('button', { name: /ESCRITÓRIO/ })
    .click();
  await page
    .getByRole('navigation', { name: 'Atalhos do Escritório' })
    .getByRole('button', { name: 'Orçamento', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Para onde vai o dinheiro' })).toBeVisible();
  await openSeason(page);
  await expect(page.getByRole('group', { name: 'Áreas da Temporada' })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Atalhos do Escritório' })).toBeVisible();
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(21);
  await page
    .getByRole('navigation', { name: 'Áreas do clube' })
    .getByRole('button', { name: /CENTRAL/ })
    .click();
  await page.getByRole('button', { name: /Avançar dia/ }).click();
  await expect(page.locator('.club-header')).toContainText('02');
  await expect(page.locator('.save-status')).toHaveText(/SALVO/);
  await page.reload();
  await expect(page.getByRole('button', { name: /CONTINUAR CARREIRA/ })).toBeVisible();
  await page.getByRole('button', { name: /CONTINUAR CARREIRA/ }).click();
  await expect(page.locator('.club-header')).toContainText('02');
  await page
    .getByRole('navigation', { name: 'Áreas do clube' })
    .getByRole('button', { name: /TIME/ })
    .click();
  await expect(page.getByRole('heading', { name: '4-3-3', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('banco compartilhado permite ordenar reservas e substituir titulares', async ({ page }) => {
  await createCareer(page);
  await page
    .getByRole('navigation', { name: 'Áreas do clube' })
    .getByRole('button', { name: 'TIME', exact: true })
    .click();
  const bench = page.getByRole('group', { name: 'Banco de reservas', exact: true });
  const outside = page.getByRole('group', { name: 'Atletas fora da relação', exact: true });
  const benchIds = () =>
    bench
      .locator('button')
      .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('data-bench-player')));
  await expect(page.locator('.lineup-list-row')).toHaveCount(0);
  const original = await benchIds();
  expect(original).toHaveLength(9);
  await bench.locator('button').nth(0).click();
  await bench.locator('button').nth(1).click();
  const reordered = await benchIds();
  expect(reordered[0]).toBe(original[1]);
  expect(reordered[1]).toBe(original[0]);
  const incoming = outside.locator('button:not(:disabled)').first();
  const incomingId = await incoming.getAttribute('data-reserve-player');
  await incoming.click();
  await bench.locator('button').nth(0).click();
  expect((await benchIds())[0]).toBe(incomingId);
  await expect(outside.locator(`[data-reserve-player="${reordered[0]}"]`)).toBeVisible();
  const starter = page.locator('[data-slot="10"]');
  const starterName = await starter.getAttribute('aria-label');
  await starter.click();
  await expect(bench).toBeVisible();
  await expect(outside).toBeVisible();
  await expect(page.getByText(/Recomendados para/)).toHaveCount(0);
  const substituteName = await bench.locator('button').nth(0).locator('strong').textContent();
  await bench.locator('button').nth(0).click();
  await expect(starter).toContainText(substituteName!);
  expect(await starter.getAttribute('aria-label')).not.toBe(starterName);
  await expect(bench.locator('button')).toHaveCount(9);
  await expect(page.locator('.save-status')).toHaveText(/SALVO/);
  const savedOrder = await benchIds();
  await page.reload();
  await page.getByRole('button', { name: /CONTINUAR CARREIRA/ }).click();
  await page
    .getByRole('navigation', { name: 'Áreas do clube' })
    .getByRole('button', { name: 'TIME', exact: true })
    .click();
  expect(await benchIds()).toEqual(savedOrder);
  await expect(starter).toContainText(substituteName!);
});

test('menu escolhe saves e mantém a lixeira compacta quando focada', async ({ page }) => {
  await createCareer(page);
  await expect(page.locator('.save-status')).toHaveText(/SALVO/);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('mando-careers', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('careers', 'readwrite');
          const store = tx.objectStore('careers');
          const read = store.getAll();
          read.onsuccess = () => {
            const record: SavedCareer | undefined = read.result[0];
            if (!record) {
              tx.abort();
              return;
            }
            const copy = structuredClone(record);
            copy.career.id = crypto.randomUUID();
            copy.career.manager.firstName = 'Bruno';
            copy.cloudRevision = 0;
            copy.savedAt = new Date().toISOString();
            store.put(copy);
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
          tx.onabort = () => {
            db.close();
            reject(tx.error ?? new Error('Save de teste ausente.'));
          };
        };
      }),
  );
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Salvar e sair para o menu/ }).click();
  await expect(page.getByRole('button', { name: /CONTINUAR CARREIRA/ })).toHaveCount(0);
  await expect(page.locator('main .save-slot')).toHaveCount(0);
  await page.getByRole('button', { name: /CARREGAR JOGO/ }).click();
  const picker = page.getByRole('dialog', { name: 'Carregar jogo', exact: true });
  await expect(picker.locator('.save-slot')).toHaveCount(2);
  const trash = picker.locator('.slot-delete').first();
  await picker.locator('.slot-tile').first().focus();
  await page.keyboard.press('ArrowUp');
  await expect(trash).toBeFocused();
  expect(
    await trash.evaluate((button) => {
      const style = getComputedStyle(button);
      return { position: style.position, width: style.width, height: style.height };
    }),
  ).toEqual({ position: 'absolute', width: '36px', height: '36px' });
  await trash.click();
  const confirmation = page.getByRole('dialog', { name: 'Excluir carreira?', exact: true });
  await confirmation.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(picker.locator('.save-slot')).toHaveCount(2);
  await trash.click();
  await confirmation.getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(picker.locator('.save-slot')).toHaveCount(1);
  await picker.locator('[data-dialog-close]').click();
  await page.reload();
  await expect(page.getByRole('button', { name: /CARREGAR JOGO/ })).toHaveCount(0);
  await page.getByRole('button', { name: /CONTINUAR CARREIRA/ }).click();
  await expect(page.getByRole('heading', { name: /Bom trabalho, Bruno/ })).toBeVisible();
});

test('controle Xbox e DualSense navegam, teclado virtual confirma sem mouse', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 17 }, () => ({
      pressed: false,
      touched: false,
      value: 0,
    }));
    const pad = {
      id: 'Xbox Controller',
      index: 0,
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons,
      timestamp: 0,
    };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad] });
    Object.defineProperty(window, '__testPad', { value: pad });
  });
  const press = async (index: number) => {
    await page.evaluate(async (i) => {
      const pad = Reflect.get(window, '__testPad');
      const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      // The provider must sample both states, even when CI frames take longer than 70 ms.
      pad.buttons[i].pressed = true;
      await frame();
      await frame();
      pad.buttons[i].pressed = false;
      await frame();
      await frame();
    }, index);
  };
  await page.goto('./');
  await page.getByRole('button', { name: /Nova carreira/i }).focus();
  await press(0);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: /Brasileirão 2026/ }).focus();
  await press(0);
  await page.getByLabel('Nome', { exact: true }).focus();
  await press(0);
  await expect(page.getByRole('dialog', { name: 'Teclado do controle' })).toBeVisible();
  await page.getByRole('button', { name: 'a', exact: true }).focus();
  await press(0);
  await page.getByRole('button', { name: /Salvar/ }).focus();
  await press(0);
  await expect(page.getByLabel('Nome', { exact: true })).toHaveValue('a');
  await page.evaluate(() => {
    Reflect.get(window, '__testPad').id = 'DualSense Wireless Controller';
  });
  await press(15);
  await expect(page.locator('.control-hint').first()).toContainText('✕');
  await press(1);
  await expect(page.getByRole('heading', { name: /O clube é seu/ })).toBeVisible();
});

test('controle define data de nascimento na criação e no perfil do manager', async ({ page }) => {
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 17 }, () => ({
      pressed: false,
      touched: false,
      value: 0,
    }));
    const pad = {
      id: 'Xbox Controller',
      index: 0,
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons,
      timestamp: 0,
    };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad] });
    Object.defineProperty(window, '__testPad', { value: pad });
  });
  const press = async (index: number) => {
    await page.evaluate(async (buttonIndex) => {
      const pad = Reflect.get(window, '__testPad');
      const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      pad.buttons[buttonIndex].pressed = true;
      await frame();
      await frame();
      pad.buttons[buttonIndex].pressed = false;
      await frame();
      await frame();
    }, index);
    if (index >= 12 && index <= 15) await page.waitForTimeout(200);
  };
  await createCareer(page, async () => {
    const day = page.getByRole('button', { name: /Dia de nascimento:/ });
    const month = page.getByRole('button', { name: /Mês de nascimento:/ });
    const year = page.getByRole('button', { name: /Ano de nascimento:/ });
    await page.getByRole('button', { name: /Gênero:/ }).focus();
    await press(13);
    await expect(day).toBeFocused();
    await press(0);
    await expect(day).toHaveAttribute('aria-pressed', 'true');
    await press(15);
    await expect(day.locator('strong')).toHaveText('02');
    await press(0);
    await press(15);
    await expect(month).toBeFocused();
    await press(0);
    await press(15);
    await expect(month.locator('strong')).toHaveText('02');
    await press(0);
    await press(15);
    await expect(year).toBeFocused();
    await press(0);
    await press(15);
    await expect(year.locator('strong')).toHaveText('1989');
    await press(1);
    await expect(year).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.portrait-caption p')).toContainText('36 anos');
  });
  await page
    .getByRole('navigation', { name: 'Áreas do clube' })
    .getByRole('button', { name: 'ESCRITÓRIO', exact: true })
    .click();
  await page
    .getByRole('navigation', { name: 'Atalhos do Escritório' })
    .getByRole('button', { name: 'Personalização', exact: true })
    .click();
  const day = page.getByRole('button', { name: /Dia de nascimento:/ });
  const month = page.getByRole('button', { name: /Mês de nascimento:/ });
  const year = page.getByRole('button', { name: /Ano de nascimento:/ });
  await expect(day.locator('strong')).toHaveText('02');
  await expect(month.locator('strong')).toHaveText('02');
  await expect(year.locator('strong')).toHaveText('1989');
  await page.evaluate(() => {
    Reflect.get(window, '__testPad').id = 'DualSense Wireless Controller';
  });
  await year.focus();
  await press(0);
  await expect(year).toHaveAttribute('aria-pressed', 'true');
  await press(15);
  await expect(year.locator('strong')).toHaveText('1990');
  await press(1);
  await expect(year).toHaveAttribute('aria-pressed', 'false');
  await expect(
    page.getByRole('group', { name: 'Data de nascimento' }).locator('.control-hint').first(),
  ).toContainText('✕');
  await page.getByRole('button', { name: /Salvar personalização/ }).focus();
  await press(0);
  await expect(page.getByText('Personalização do manager salva.')).toHaveCount(0);
  await expect(page.locator('.save-status')).toBeHidden();
  await expect(page.locator('.save-status')).toHaveText(/SALVO/);
  await page.reload();
  await page.getByRole('button', { name: /CONTINUAR CARREIRA/ }).click();
  await page
    .getByRole('navigation', { name: 'Áreas do clube' })
    .getByRole('button', { name: 'ESCRITÓRIO', exact: true })
    .click();
  await page
    .getByRole('navigation', { name: 'Atalhos do Escritório' })
    .getByRole('button', { name: 'Personalização', exact: true })
    .click();
  await expect(day.locator('strong')).toHaveText('02');
  await expect(month.locator('strong')).toHaveText('02');
  await expect(year.locator('strong')).toHaveText('1990');
  await expect(page.locator('.profile-panel')).toContainText('35 anos');
});

test('partida completa registra placar e volta à tabela sem duplicar resultado', async ({
  page,
}) => {
  await createCareer(page);
  // O primeiro compromisso é o estadual (a partir de 11/01).
  for (let i = 0; i < 27; i++) {
    await resolvePendingMessages(page);
    if (await page.getByRole('button', { name: /O ESTÁDIO ESTÁ PRONTO/ }).isVisible()) break;
    const before = await page.locator('.club-header strong').textContent();
    await page.getByRole('button', { name: /Avançar dia/ }).click();
    await expect(page.locator('.club-header strong')).not.toHaveText(before || '');
  }
  await resolvePendingMessages(page);
  await page.getByRole('button', { name: /O ESTÁDIO ESTÁ PRONTO/ }).click();
  await page.getByRole('button', { name: /Começar partida/ }).click();
  await page.getByRole('button', { name: '4×', exact: true }).click();
  const playUntil = async (target: ReturnType<Page['getByRole']>) => {
    for (let i = 0; i < 120 && !(await target.isVisible()); i++) {
      await page.waitForTimeout(500);
    }
    await expect(target).toBeVisible();
  };
  await page.getByRole('button', { name: 'Jogar', exact: true }).click();
  await playUntil(page.getByRole('button', { name: 'Segundo tempo', exact: true }));
  await page.getByRole('button', { name: 'Segundo tempo', exact: true }).click();
  await playUntil(page.getByRole('button', { name: /Confirmar resultado/ }));
  await page.getByRole('button', { name: /Confirmar resultado/ }).click();
  await openSeason(page);
  await pickCompetition(page, /Paulist/);
  const row = page.getByRole('row').filter({ hasText: 'São Paulo' });
  await expect(row.locator('td').nth(3)).toHaveText('1');
});

test('layout móvel deitado não cria rolagem horizontal e retrato pede rotação', async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await createCareer(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page
    .getByRole('navigation', { name: 'Áreas do clube' })
    .getByRole('button', { name: /TIME/ })
    .click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await openSeason(page);
  await pickCompetition(page, /Libertadores/);
  await expect(page.getByText('GRUPO A', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  const orientationWarning = page.locator('.orientation-warning');
  await expect(orientationWarning).toBeVisible();
  await expect(orientationWarning).toContainText('Vire o celular');
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(orientationWarning).toBeHidden();
});

test('PWA mantém o jogo e o save acessíveis após ficar offline', async ({ page, context }) => {
  await createCareer(page);
  await expect(page.locator('.save-status')).toHaveText(/SALVO/);
  await page.waitForFunction(
    () =>
      new Promise<boolean>((resolve) => {
        const request = indexedDB.open('mando-careers', 1);
        request.onerror = () => resolve(false);
        request.onsuccess = () => {
          const db = request.result;
          const read = db.transaction('careers', 'readonly').objectStore('careers').getAll();
          read.onsuccess = () => {
            const record = read.result.find((item) => item.career.manager.firstName === 'Alex');
            db.close();
            resolve(
              record?.career.onboarding?.contractSigned === true &&
                record?.career.onboarding?.tutorialComplete === true,
            );
          };
          read.onerror = () => {
            db.close();
            resolve(false);
          };
        };
      }),
    { timeout: 10000 },
  );
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  const continueCareer = page.getByRole('button', { name: /CONTINUAR CARREIRA/ });
  await expect(continueCareer).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(continueCareer).toBeVisible();
  await continueCareer.click();
  await expect(page.getByRole('heading', { name: /Bom trabalho, Alex/ })).toBeVisible();
  await resolvePendingMessages(page);
  await page.getByRole('button', { name: /Avançar dia/ }).click();
  await expect(page.locator('.club-header')).toContainText('02');
  await context.setOffline(false);
});

test('Brasileirão 2026 com elencos reais e escudos locais', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await page.getByRole('button', { name: /Nova carreira/i }).click();
  await page.getByRole('button', { name: /Brasileirão 2026/ }).click();
  await page.getByLabel('Nome', { exact: true }).fill('Alex');
  await page.getByLabel('Sobrenome').fill('Silva');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  const club = page.getByRole('button', { name: /São Paulo/ });
  const crest = club.locator('.club-badge img');
  await expect(crest).toHaveAttribute('src', /assets\/escudos\/sao-paulo\.svg$/);
  await expect
    .poll(() => crest.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
    .toBeGreaterThan(0);
  await club.click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('button', { name: 'Assumir o clube' }).click();
  await page.getByRole('button', { name: 'Assinar contrato' }).click();
  await page.getByRole('button', { name: 'Pular tutorial' }).click();
  await expect(page.getByRole('heading', { name: /Bom trabalho, Alex/ })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Áreas do clube' })
    .getByRole('button', { name: /TIME/ })
    .click();
  await expect(page.getByText('Lucas Moura').first()).toBeVisible();
  expect(errors).toEqual([]);
});

for (const [width, height] of [
  [1440, 900],
  [1280, 720],
] as const) {
  test(`telas cabem em ${width}x${height} sem rolagem vertical`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const fits = () =>
      page.evaluate(() => {
        const stage = document.querySelector('main.stage')!;
        return (
          document.documentElement.scrollHeight <= innerHeight &&
          stage.scrollHeight <= stage.clientHeight + 1
        );
      });
    await page.goto('./');
    expect(await fits()).toBe(true);
    await createCareer(page);
    expect(await fits()).toBe(true);
    for (const tab of [
      /NOTIFICAÇÕES/,
      /TIME/,
      /TRANSFERÊNCIAS/,
      /ACADEMIA/,
      /ESCRITÓRIO/,
      /CENTRAL/,
    ]) {
      await page
        .getByRole('navigation', { name: 'Áreas do clube' })
        .getByRole('button', { name: tab })
        .click();
      await page.waitForTimeout(400);
      expect(await fits(), `aba ${tab}`).toBe(true);
    }
  });
}
