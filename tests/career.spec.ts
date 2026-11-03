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

test('criação, todas as abas, negociação, avanço e save/load persistente', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await createCareer(page);
  await expect(
    page.getByText('DEMONSTRAÇÃO · Atletas e finanças sintéticos', { exact: false }),
  ).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: /TIME/ }).click();
  await page.getByRole('button', { name: 'Tática', exact: true }).click();
  await page.getByLabel('Formação').selectOption('4-3-3');
  await page.getByRole('button', { name: 'Responsabilidades' }).click();
  await expect(page.getByRole('combobox', { name: 'Capitão', exact: true })).toBeVisible();
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
  await expect(page.getByRole('button', { name: /SALVO LOCAL/ })).toBeVisible();
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
  await page.getByRole('button', { name: 'A', exact: true }).focus();
  await press(0);
  await page.getByRole('button', { name: 'Concluir', exact: true }).focus();
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
  for (let i = 0; i < 27; i++) {
    while (await page.getByRole('button', { name: /Abrir escritório/ }).isVisible()) {
      await page.getByRole('button', { name: /Abrir escritório/ }).click();
      await page.getByRole('button', { name: 'Ciente. Continuar o trabalho.' }).click();
      await page
        .getByRole('navigation')
        .getByRole('button', { name: /CENTRAL/ })
        .click();
    }
    await page.getByRole('button', { name: /Avançar dia/ }).click();
    await expect(page.locator('.club-header')).toContainText(String(i + 2).padStart(2, '0'));
  }
  await page.getByRole('button', { name: /O ESTÁDIO ESTÁ PRONTO/ }).click();
  await page.getByRole('button', { name: /Começar partida/ }).click();
  await page.getByRole('button', { name: '4×', exact: true }).click();
  await page.getByRole('button', { name: 'Jogar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Segundo tempo', exact: true })).toBeVisible({
    timeout: 30000,
  });
  await page.getByRole('button', { name: 'Segundo tempo', exact: true }).click();
  await expect(page.getByRole('button', { name: /Confirmar resultado/ })).toBeVisible({
    timeout: 30000,
  });
  await page.getByRole('button', { name: /Confirmar resultado/ }).click();
  await page
    .getByRole('navigation')
    .getByRole('button', { name: /TEMPORADA/ })
    .click();
  const row = page.getByRole('row').filter({ hasText: 'São Paulo' });
  await expect(row.locator('td').nth(3)).toHaveText('1');
});

test('layout móvel não cria rolagem horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createCareer(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('navigation').getByRole('button', { name: /TIME/ }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('PWA mantém o jogo e o save acessíveis após ficar offline', async ({ page, context }) => {
  await createCareer(page);
  await expect(page.getByRole('button', { name: /SALVO LOCAL/ })).toBeVisible();
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
