const focusable =
  'button:not(:disabled):not([tabindex="-1"]), input:not(:disabled):not([tabindex="-1"]), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]';

const regionOf = (el: HTMLElement) =>
  el.closest('[data-focus-region], header, main, footer, [data-focus-scope="modal"]');
/** Bloco visual (painel, barra de abas) que contém o elemento. */
const boxOf = (el: HTMLElement) =>
  el.closest<HTMLElement>(
    '.panel, .segmented, [role="tablist"], nav, header, footer, [data-focus-region], [data-focus-scope="modal"]',
  );

export class FocusManager {
  private last: HTMLElement | null = null;
  private memories = new Map<string, string>();

  remember(root: HTMLElement, key: string) {
    const current = document.activeElement as HTMLElement;
    if (!root.contains(current)) return;
    const elements = this.elements().filter((element) => root.contains(element));
    const identity = this.identity(current);
    if (identity) this.memories.set(key, identity);
    else this.memories.set(key, `index:${elements.indexOf(current)}`);
  }

  private identity(element: HTMLElement) {
    for (const name of [
      'data-focus-id',
      'data-slot',
      'data-reserve-player',
      'data-role',
      'aria-label',
      'id',
    ]) {
      const value = element.getAttribute(name);
      if (value) return `${name}:${value}`;
    }
    return element.textContent?.trim() ? `text:${element.textContent.trim()}` : '';
  }

  restoreScope(root: HTMLElement, key: string) {
    const identity = this.memories.get(key);
    if (!identity) return false;
    const elements = this.elements().filter((element) => root.contains(element));
    const target = identity.startsWith('index:')
      ? elements[Number(identity.slice(6))]
      : elements.find((element) => this.identity(element) === identity);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return Boolean(target);
  }

  elements(): HTMLElement[] {
    const dialogs = [...document.querySelectorAll<HTMLElement>('[data-focus-scope="modal"]')];
    // Painéis "entráveis" (ex.: conversa de negociação) prendem o foco até o B.
    const scope =
      dialogs.at(-1) || document.querySelector<HTMLElement>('[data-focus-trap]') || document.body;
    return [...scope.querySelectorAll<HTMLElement>(focusable)].filter(
      (el) =>
        el.getClientRects().length > 0 &&
        !el.closest('[inert]') &&
        el.getAttribute('aria-hidden') !== 'true',
    );
  }

  ensure() {
    const elements = this.elements();
    if (!elements.includes(document.activeElement as HTMLElement)) {
      const root = document.querySelector<HTMLElement>('[data-focus-memory]');
      if (root && this.restoreScope(root, root.dataset.focusMemory!)) return;
      (
        elements.find((el) => el.dataset.autofocus !== undefined) ||
        elements.find((el) => el.closest('main')) ||
        elements[0]
      )?.focus();
    }
  }

  move(dx: number, dy: number) {
    const elements = this.elements();
    const current = document.activeElement as HTMLElement;
    if (!elements.includes(current)) {
      this.ensure();
      return;
    }
    const rect = current.getBoundingClientRect();
    const x = rect.x + rect.width / 2;
    const y = rect.y + rect.height / 2;
    const region = regionOf(current);
    const ownBox = boxOf(current);
    const lineUp = (r: DOMRect) =>
      dx
        ? Math.min(r.bottom, rect.bottom) - Math.max(r.top, rect.top) > 4
        : Math.min(r.right, rect.right) - Math.max(r.left, rect.left) > 4;
    // Prioridade: mesma região e alinhado no eixo perpendicular > mesma região > alinhado > resto.
    // "Alinhado" também vale quando o painel vizinho inteiro está na mesma linha/coluna do foco:
    // assim → numa lista vai para o painel ao lado, e não para uma aba distante.
    const candidates = elements
      .filter((el) => el !== current)
      .map((el) => {
        const r = el.getBoundingClientRect();
        const rx = r.x + r.width / 2 - x;
        const ry = r.y + r.height / 2 - y;
        const forward = rx * dx + ry * dy;
        const side = Math.abs(rx * dy - ry * dx);
        const box = boxOf(el);
        const overlap =
          lineUp(r) ||
          (!!box &&
            box !== ownBox &&
            !box.contains(current) &&
            lineUp(box.getBoundingClientRect()));
        const gap = dx
          ? dx > 0
            ? r.left - rect.right
            : rect.left - r.right
          : dy > 0
            ? r.top - rect.bottom
            : rect.top - r.bottom;
        const tier = (dx && regionOf(el) !== region ? 2 : 0) + (overlap ? 0 : 1);
        return {
          el,
          forward,
          tier,
          score: (overlap ? Math.max(0, gap) : forward) + side * (overlap ? 0.6 : 2.8),
        };
      })
      .filter((c) => c.forward > 3)
      .sort((a, b) => a.tier - b.tier || a.score - b.score);
    this.last = current;
    const next = candidates[0]?.el;
    const direction = dx ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    const ownRegion = current.closest<HTMLElement>('[data-focus-region]');
    const route = ownRegion?.getAttribute(`data-focus-${direction}`);
    const localAligned = candidates.find(
      (candidate) =>
        regionOf(candidate.el) === region && lineUp(candidate.el.getBoundingClientRect()),
    );
    const targetRegion =
      route &&
      elements
        .find(
          (element) =>
            element.closest<HTMLElement>('[data-focus-region]')?.dataset.focusRegion === route,
        )
        ?.closest<HTMLElement>('[data-focus-region]');
    const target =
      !localAligned && targetRegion
        ? candidates.find((candidate) => targetRegion.contains(candidate.el))?.el ||
          elements.find((element) => targetRegion.contains(element))
        : next;
    if (target) {
      target.focus({ preventScroll: true });
      target.scrollIntoView({
        block: 'nearest',
        inline: target.closest('.carousel') ? 'center' : 'nearest',
        behavior: 'smooth',
      });
    }
  }

  restore() {
    if (this.last?.isConnected) this.last.focus();
    else this.ensure();
  }
}
