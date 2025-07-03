const DEFAULT_OPTIONS: Required<Omit<DOMScannerOptions, 'maxDepth'>> = {
  includeShadowDOM: true,
  includeIframes: false,
  targetTagNames: ['input', 'select', 'textarea', 'button'],
  attributePriority: [
    'id',
    'name',
    'data-testid',
    'data-test',
    'data-test-id',
    'aria-label',
    'placeholder',
    'title'
  ],
  blacklistSelectors: []
};

export class DOMScanner {
  private readonly options: DOMScannerOptions;
  private readonly selectorMap: Map<string, SelectorInfo>;

  constructor(options?: DOMScannerOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.selectorMap = new Map();
  }

  /**
   * Public API ? traverse the supplied root (or document) and populate
   * the internal selector map.
   */
  scan(root: TraversableRoot = document, options?: Partial<DOMScannerOptions>): void {
    // Clear previous results so each scan is isolated
    this.selectorMap.clear();

    const merged: DOMScannerOptions = { ...this.options, ...options };
    this.walk(root, merged, 0, root);
  }

  /**
   * Returns a map of selector ? { selector, score, element }
   */
  getSelectorMap(): Map<string, SelectorInfo> {
    return this.selectorMap;
  }

  /**
   * JSON serialisation helper
   */
  toJSON(): Record<string, Omit<SelectorInfo, 'element'>> {
    const out: Record<string, Omit<SelectorInfo, 'element'>> = {};
    for (const [key, info] of this.selectorMap.entries()) {
      out[key] = { selector: info.selector, score: info.score };
    }
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Internals                                                          */
  /* ------------------------------------------------------------------ */

  private walk(
    node: TraversableRoot,
    opts: DOMScannerOptions,
    depth: number,
    scopeRoot: ParentNode
  ): void {
    if (opts.maxDepth !== undefined && depth > opts.maxDepth) return;

    const children: Element[] =
      node instanceof Element || node instanceof ShadowRoot
        ? Array.from(node.children)
        : Array.from((node as Document).documentElement?.children ?? []);

    for (const el of children) {
      this.handleElement(el, opts, scopeRoot);

      // Shadow DOM
      if (opts.includeShadowDOM && (el as HTMLElement).shadowRoot) {
        this.walk(
          (el as HTMLElement).shadowRoot as ShadowRoot,
          opts,
          depth + 1,
          (el as HTMLElement).shadowRoot as ShadowRoot
        );
      }

      // Iframe
      if (opts.includeIframes && el.tagName.toLowerCase() === 'iframe') {
        try {
          const doc = (el as HTMLIFrameElement).contentDocument;
          if (doc) this.walk(doc, opts, depth + 1, doc);
        } catch {
          /* cross-origin iframe ? ignore */
        }
      }

      // Recurse children
      this.walk(el, opts, depth + 1, scopeRoot);
    }
  }

  private handleElement(el: Element, opts: DOMScannerOptions, scopeRoot: ParentNode): void {
    if (!this.isTarget(el, opts)) return;

    const candidates = this.deriveSelectors(el, opts);
    const ranked = this.rankSelectors(candidates, opts, scopeRoot);

    for (const info of ranked) {
      // Blacklist
      if (opts.blacklistSelectors?.some(b => this.matchesSelector(info.selector, b))) continue;

      const existing = this.selectorMap.get(info.selector);
      if (!existing || info.score > existing.score) {
        this.selectorMap.set(info.selector, info);
      }
      // We only keep the best-ranked selector per element.
      break;
    }
  }

  /**
   * Ranking algorithm:
   *  Start with highest weight (attributePriority.length) and decrease.
   *  Additional +2 if selector is unique within the supplied root.
   */
  private rankSelectors(
    selectors: string[],
    opts: DOMScannerOptions,
    scopeRoot: ParentNode
  ): SelectorInfo[] {
    const ranked: SelectorInfo[] = [];
    let weight = opts.attributePriority?.length ?? 0;

    for (const sel of selectors) {
      let uniqueBonus = 0;
      try {
        uniqueBonus = scopeRoot.querySelectorAll(sel).length === 1 ? 2 : 0;
      } catch {
        // Invalid selector ? skip
        continue;
      }

      const element = scopeRoot.querySelector(sel);
      if (!element) continue;

      ranked.push({
        selector: sel,
        score: weight + uniqueBonus,
        element
      });
      weight -= 1;
    }

    // Highest score first
    ranked.sort((a, b) => b.score - a.score);
    return ranked;
  }

  private deriveSelectors(el: Element, opts: DOMScannerOptions): string[] {
    const list: string[] = [];
    const attrs = opts.attributePriority ?? [];

    for (const attr of attrs) {
      if (!el.hasAttribute(attr)) continue;
      const val = el.getAttribute(attr);
      if (!val) continue;

      switch (attr) {
        case 'id':
          list.push(`#${this.cssEscape(val)}`);
          break;
        default:
          list.push(`[${attr}="${this.cssEscape(val)}"]`);
          break;
      }
    }

    // Fallback tag selector if nothing else
    if (list.length === 0) list.push(el.tagName.toLowerCase());

    return list;
  }

  private isTarget(el: Element, opts: DOMScannerOptions): boolean {
    const targetList = opts.targetTagNames ?? [];
    return targetList.includes(el.tagName.toLowerCase());
  }

  private cssEscape(value: string): string {
    // Prefer the standard implementation when available
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }
    // Basic fallback escaping adhering to CSSOM spec
    return value.replace(/[^a-zA-Z0-9_\u00A0-\uFFFF-]/g, ch => {
      const hex = ch.codePointAt(0)!.toString(16).toUpperCase();
      return '\\' + hex + ' ';
    });
  }

  private matchesSelector(selector: string, blacklistEntry: string): boolean {
    if (blacklistEntry === selector) return true;
    try {
      return !!document.querySelector(selector)?.matches(blacklistEntry);
    } catch {
      return false;
    }
  }
}