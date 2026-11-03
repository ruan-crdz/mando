const focusable =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]';

export class FocusManager {
  private last: HTMLElement | null = null;

  elements(): HTMLElement[] {
    const dialogs = [...document.querySelectorAll<HTMLElement>('[data-focus-scope="modal"]')];
    const scope = dialogs.at(-1) || document.body;
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
    const candidates = elements
      .filter((el) => el !== current)
      .map((el) => {
        const r = el.getBoundingClientRect();
        const rx = r.x + r.width / 2 - x;
        const ry = r.y + r.height / 2 - y;
        const forward = rx * dx + ry * dy;
        const side = Math.abs(rx * dy - ry * dx);
        return { el, forward, score: forward + side * 2.8 };
      })
      .filter((c) => c.forward > 3)
      .sort((a, b) => a.score - b.score);
    this.last = current;
    const next = candidates[0]?.el;
    if (next) {
      next.focus({ preventScroll: true });
      next.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  }

  restore() {
    if (this.last?.isConnected) this.last.focus();
    else this.ensure();
  }
}
