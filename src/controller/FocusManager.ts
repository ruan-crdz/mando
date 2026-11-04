const focusable =
  'button:not(:disabled):not([tabindex="-1"]), input:not(:disabled):not([tabindex="-1"]), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]';

const regionOf = (el: HTMLElement) =>
  el.closest('[data-focus-region], header, main, footer, [data-focus-scope="modal"]');

export class FocusManager {
  private last: HTMLElement | null = null;

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
    if (!elements.includes(document.activeElement as HTMLElement))
      (
        elements.find((el) => el.dataset.autofocus !== undefined) ||
        elements.find((el) => el.closest('main')) ||
        elements[0]
      )?.focus();
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
    // Prioridade: mesma região e alinhado no eixo perpendicular > mesma região > alinhado > resto.
    const candidates = elements
      .filter((el) => el !== current)
      .map((el) => {
        const r = el.getBoundingClientRect();
        const rx = r.x + r.width / 2 - x;
        const ry = r.y + r.height / 2 - y;
        const forward = rx * dx + ry * dy;
        const side = Math.abs(rx * dy - ry * dx);
        const overlap = dx
          ? Math.min(r.bottom, rect.bottom) - Math.max(r.top, rect.top) > 4
          : Math.min(r.right, rect.right) - Math.max(r.left, rect.left) > 4;
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
    if (next) {
      next.focus({ preventScroll: true });
      next.scrollIntoView({
        block: 'nearest',
        inline: next.closest('.carousel') ? 'center' : 'nearest',
        behavior: 'smooth',
      });
    }
  }

  restore() {
    if (this.last?.isConnected) this.last.focus();
    else this.ensure();
  }
}
