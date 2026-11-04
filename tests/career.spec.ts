import { expect, test, type Page } from '@playwright/test';

async function createCareer(page: Page) {
  await page.goto('./');
  await expect(page.getByRole('button', { name: /Continuar carreira/i })).toHaveCount(0);
  await page.getByRole('button', { name: /Nova carreira/i }).click();
  await page.getByRole('button', { name: /Experimentar a demonstração/i }).click();
  await page.getByLabel('Nome', { exact: true }).fill('Alex');
  await page.getByLabel('Sobrenome').fill('Silva');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('button', { name: /São Paulo/ }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('button', { name: 'Assumir o clube' }).click();
  await expect(page.getByRole('heading', { name: /Bom trabalho, Alex/ })).toBeVisible();
}

async function pickCompetition(page: Page, name: RegExp) {
  const label = page.locator('.stick-switcher strong');
  for (let i = 0; i < 12 && !name.test((await label.textContent()) || ''); i++) {
    await page.locator('.stick-switcher').getByRole('button', { name: 'Próximo' }).click();
  }
  await expect(label).toHaveText(name);
}

test('criação, todas as abas, negociação, avanço e save/load persistente', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await createCareer(page);
  await expect(
    page.getByText('DEMONSTRAÇÃO · Atletas e finanças sintéticos', { exact: false }),
  ).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: /TIME/ }).click();
  await page.getByRole('button', { name: 'Tática', exact: true }).click();
  await page.getByRole('radiogroup', { name: 'Formação' }).getByRole('radio', { name: '4-3-3' }).click();
  await page.getByRole('button', { name: 'Responsabilidades' }).click();
  await page.locator('.role-card[data-role="Capitão"]').click();
  await expect(page.locator('.player-card').first()).toBeVisible();
  await page
    .getByRole('navigation')
    .getByRole('button', { name: /TRANSFERÊNCIAS/ })
    .click();
  await page.getByLabel('Nome', { exact: true }).fill('inexistente');
  await expect(page.getByText('Nenhum atleta atende a todos os critérios.')).toBeVisible();
  await page
    .getByRole('navigation')
    .getByRole('button', { name: /ESCRITÓRIO/ })
    .click();
  await page.getByRole('button', { name: 'Finanças', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Para onde vai o dinheiro' })).toBeVisible();
  await page
    .getByRole('navigation')
    .getByRole('button', { name: /TEMPORADA/ })
    .click();
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(21);
  await page
    .getByRole('navigation')
    .getByRole('button', { name: /CENTRAL/ })
    .click();
  await page.getByRole('button', { name: /Avançar dia/ }).click();
  await expect(page.locator('.club-header')).toContainText('02');
  await expect(page.locator('.save-status')).toHaveText(/SALVO/);
  await page.reload();
  await expect(page.getByRole('button', { name: /CONTINUAR CARREIRA/ })).toBeVisible();
  await page.getByRole('button', { name: /CONTINUAR CARREIRA/ }).click();
  await expect(page.locator('.club-header')).toContainText('02');
  await page.getByRole('navigation').getByRole('button', { name: /TIME/ }).click();
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
  await page.getByRole('button', { name: /Experimentar a demonstração/ }).focus();
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
  const resolvePending = async () => {
    while (await page.getByRole('button', { name: /Abrir escritório/ }).isVisible()) {
      await page.getByRole('button', { name: /Abrir escritório/ }).click();
      await page.getByRole('button', { name: 'Ciente. Continuar o trabalho.' }).click();
      await page
        .getByRole('navigation')
        .getByRole('button', { name: /CENTRAL/ })
        .click();
    }
  };
  // O primeiro compromisso é o estadual (a partir de 11/01).
  for (let i = 0; i < 27; i++) {
    await resolvePending();
    if (await page.getByRole('button', { name: /O ESTÁDIO ESTÁ PRONTO/ }).isVisible()) break;
    const before = await page.locator('.club-header strong').textContent();
    await page.getByRole('button', { name: /Avançar dia/ }).click();
    await expect(page.locator('.club-header strong')).not.toHaveText(before || '');
  }
  await resolvePending();
  await page.getByRole('button', { name: /O ESTÁDIO ESTÁ PRONTO/ }).click();
  await page.getByRole('button', { name: /Começar partida/ }).click();
  await page.getByRole('button', { name: '4×', exact: true }).click();
  // Momentos humanos pausam o jogo até a decisão do técnico.
  const playUntil = async (target: ReturnType<Page['getByRole']>) => {
    for (let i = 0; i < 120 && !(await target.isVisible()); i++) {
      const moment = page.locator('.moment-dialog');
      if (await moment.isVisible())
        await moment.locator('.moment-actions button:not(:disabled)').last().click();
      else await page.waitForTimeout(500);
    }
    await expect(target).toBeVisible();
  };
  await page.getByRole('button', { name: 'Jogar', exact: true }).click();
  await playUntil(page.getByRole('button', { name: 'Segundo tempo', exact: true }));
  await page.getByRole('button', { name: 'Segundo tempo', exact: true }).click();
  await playUntil(page.getByRole('button', { name: /Confirmar resultado/ }));
  await page.getByRole('button', { name: /Confirmar resultado/ }).click();
  // A coletiva pós-jogo abre após a partida; responde todas as perguntas.
  const pressRoom = page.getByRole('dialog', { name: 'Sala de imprensa' });
  await expect(pressRoom).toBeVisible();
  while (await pressRoom.isVisible()) {
    // A última resposta fecha a sala; o clique não pode esperar um botão que sumiu.
    await pressRoom
      .locator('.press-answer')
      .first()
      .click({ timeout: 3000 })
      .catch(() => {});
  }
  await page
    .getByRole('navigation')
    .getByRole('button', { name: /TEMPORADA/ })
    .click();
  await pickCompetition(page, /Paulist/);
  const row = page.getByRole('row').filter({ hasText: 'São Paulo' });
  await expect(row.locator('td').nth(3)).toHaveText('1');
});

test('layout móvel não cria rolagem horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createCareer(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('navigation').getByRole('button', { name: /TIME/ }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page
    .getByRole('navigation')
    .getByRole('button', { name: /TEMPORADA/ })
    .click();
  await pickCompetition(page, /Libertadores/);
  await expect(page.getByText('GRUPO A', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('PWA mantém o jogo e o save acessíveis após ficar offline', async ({ page, context }) => {
  await createCareer(page);
  await expect(page.locator('.save-status')).toHaveText(/SALVO/);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: /CONTINUAR CARREIRA/ }).click();
  await expect(page.getByRole('heading', { name: /Bom trabalho, Alex/ })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: /Bom trabalho, Alex/ })).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: /TIME/ }).click();
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
    for (const tab of [/TIME/, /TRANSFERÊNCIAS/, /ESCRITÓRIO/, /TEMPORADA/, /CENTRAL/]) {
      await page.getByRole('navigation').getByRole('button', { name: tab }).click();
      await page.waitForTimeout(400);
      expect(await fits(), `aba ${tab}`).toBe(true);
    }
  });
}