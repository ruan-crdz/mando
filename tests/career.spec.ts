import { expect, test, type Page } from '@playwright/test';

async function createCareer(page: Page) {
  await page.goto('./');
  await expect(page.getByRole('button', { name: /Continuar carreira/i })).toHaveCount(0);
  await page.getByRole('button', { name: /Nova carreira/i }).click();
  await page.getByRole('button', { name: /Brasileirão 2026/ }).click();
  await page.getByLabel('Nome', { exact: true }).fill('Alex');
  await page.getByLabel('Sobrenome').fill('Silva');
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
  await page.getByRole('button', { name: 'Responsabilidades' }).click();
  await page.locator('.role-card[data-role="Capitão"]').click();
  await expect(page.locator('.player-card').first()).toBeVisible();
  await page.getByRole('button', { name: 'Comissão', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Auxiliares por setor' })).toBeVisible();
  await page.getByRole('button', { name: 'Contratar auxiliar', exact: true }).first().click();
  const assistantDialog = page.getByRole('dialog', { name: 'Escolher auxiliar' });
  await expect(assistantDialog.locator('.assistant-card')).toHaveCount(5);
  await assistantDialog.getByRole('button', { name: 'Contratar Ana Ribeiro' }).click();
  await expect(page.locator('.assistant-grid')).toContainText('Ana Ribeiro');
  await page
    .getByRole('navigation', { name: 'Áreas do clube' })
    .getByRole('button', { name: /TRANSFERÊNCIAS/ })
    .click();
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
  const youthStats = page.getByRole('region', { name: 'Ficha do jogador' });
  await expect(youthStats).toBeVisible();
  await page.locator('.academy-roster-row[data-age="15"]').first().click();
  await expect(page.getByRole('button', { name: /Promover ao profissional/ })).toHaveCount(0);
  const eligibleYouth = page.locator('.academy-roster-row[data-age="16"]').first();
  const youthName = await eligibleYouth.locator('strong').innerText();
  await eligibleYouth.click();
  await expect(youthStats.getByRole('heading', { name: youthName, exact: true })).toBeVisible();
  await expect(youthStats.locator('.attribute-grid > div')).toHaveCount(19);
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
