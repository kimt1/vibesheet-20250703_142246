for (const [column, cfg] of Object.entries(mapping)) {
      if (column === '__submit') continue;

      const selector = typeof cfg === 'string' ? cfg : cfg.selector;
      const el = await this.locateElement(page, selector);
      if (!el) {
        throw new Error(
          `FormFiller.prepare: Unable to locate element for column "${column}" using selector "${selector}"`
        );
      }
    }

    // Validate submit button if provided.
    if (mapping.__submit) {
      const submitSel =
        typeof mapping.__submit === 'string'
          ? mapping.__submit
          : mapping.__submit.selector;
      const btn = await this.locateElement(page, submitSel);
      if (!btn) {
        throw new Error(
          `FormFiller.prepare: Unable to locate submit button using selector "${submitSel}"`
        );
      }
    }

    this.prepared = true;
  }

  /** Fill all mapped inputs with the rowData. */
  async fill(page: Page, rowData: RowData): Promise<void> {
    if (!this.prepared)
      throw new Error('FormFiller.fill: call prepare() before fill().');

    for (const [column, cfg] of Object.entries(this.mapping)) {
      if (column === '__submit') continue; // skip submit mapping

      const value = rowData[column];
      if (value === undefined || value === null) continue; // nothing to fill

      const { selector, type, humanDelay } =
        typeof cfg === 'string'
          ? { selector: cfg, type: 'text' as const, humanDelay: 20 }
          : {
              selector: cfg.selector,
              type: cfg.type ?? 'text',
              humanDelay: cfg.humanDelay ?? 20,
            };

      const el = await this.locateElement(page, selector, { wait: true });
      if (!el) continue; // already validated in prepare, but safety.

      switch (type) {
        case 'checkbox':
          await this.handleCheckbox(el, Boolean(value));
          break;
        case 'radio':
          await el.check();
          break;
        case 'select':
          await (el as unknown as Locator).selectOption(String(value));
          break;
        case 'date':
          await el.fill(String(value));
          break;
        case 'file':
          await (el as unknown as Locator).setInputFiles(String(value));
          break;
        case 'text':
        default:
          await this.humanType(el, String(value), humanDelay);
      }
    }
  }

  /** Click submit button or first form[type=submit]. */
  async submit(page: Page): Promise<void> {
    let submitSel: string | undefined;
    if (this.mapping.__submit) {
      submitSel =
        typeof this.mapping.__submit === 'string'
          ? this.mapping.__submit
          : this.mapping.__submit.selector;
    }

    if (submitSel) {
      const btn = await this.locateElement(page, submitSel, { wait: true });
      if (btn) await btn.click();
      else throw new Error(`Submit button not found for selector ${submitSel}`);
    } else {
      const btn = await this.locateElement(
        page,
        'button[type="submit"],input[type="submit"]',
        { wait: true }
      );
      if (btn) await btn.click();
      else throw new Error('No submit button located.');
    }
  }

  /** Verify that inputs hold the expected values after filling. */
  async verify(page: Page, rowData: RowData): Promise<boolean> {
    for (const [column, cfg] of Object.entries(this.mapping)) {
      if (column === '__submit') continue;

      // If rowData does not contain this column we skip verification for it
      if (!(column in rowData)) continue;

      const expected = rowData[column];

      const { selector, type } =
        typeof cfg === 'string'
          ? { selector: cfg, type: 'text' as const }
          : { selector: cfg.selector, type: cfg.type ?? 'text' };

      const el = await this.locateElement(page, selector);
      if (!el) return false;

      switch (type) {
        case 'checkbox': {
          const checked = await el.isChecked();
          if (checked !== Boolean(expected)) return false;
          break;
        }
        case 'radio': {
          const checked = await el.isChecked();
          if (!checked) return false; // radios without group context
          break;
        }
        case 'select':
        case 'date':
        case 'file':
        case 'text':
        default: {
          const val = await el.inputValue();
          if (val !== String(expected)) return false;
          break;
        }
      }
    }
    return true;
  }

  /** Capture screenshot for audit/debug. */
  async capture(page: Page, name: string): Promise<void> {
    const dir = 'screenshots';
    await fs.promises.mkdir(dir, { recursive: true });
    const filePath = `${dir}/${Date.now()}_${name}.png`;
    await page.screenshot({ path: filePath, fullPage: true });
  }

  /** Orchestrates the entire flow. */
  async run(
    page: Page,
    mapping: Mapping,
    rowData: RowData
  ): Promise<boolean> {
    await this.prepare(page, mapping);
    await this.fill(page, rowData);
    const verifiedBeforeSubmit = await this.verify(page, rowData);
    if (!verifiedBeforeSubmit) {
      await this.capture(page, 'verify_failed_pre_submit');
      throw new Error('Verification failed before submit.');
    }
    await this.submit(page);
    await this.capture(page, 'after_submit');
    return true;
  }

  // ----------------------------------  HELPERS  ---------------------------------- //

  /** Attempts css first; if starts with // treat as XPath. */
  private async locateElement(
    page: Page,
    selector: string,
    opts: { wait?: boolean } = {}
  ): Promise<Locator | null> {
    const isXPath = selector.trim().startsWith('//');
    const locator = isXPath
      ? page.locator(`xpath=${selector}`)
      : page.locator(selector);

    if (opts.wait) {
      try {
        await locator.waitFor({ state: 'attached', timeout: 5000 });
      } catch {
        return null;
      }
    }
    const count = await locator.count();
    if (count === 0) return null;
    return locator.first();
  }

  private async humanType(
    locator: Locator,
    text: string,
    delayMs: number
  ): Promise<void> {
    await locator.click({ force: true });
    await locator.fill('');
    await locator.type(text, { delay: delayMs + this.rand(30) });
  }

  private async handleCheckbox(
    locator: Locator,
    desired: boolean
  ): Promise<void> {
    const current = await locator.isChecked();
    if (current !== desired) await locator.click();
  }

  private rand(max: number): number {
    return Math.floor(Math.random() * max);
  }
}