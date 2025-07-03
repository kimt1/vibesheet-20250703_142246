const MEMORY_STORE: { [key: string]: string } = {};

/**
 * Try to obtain storage object (browser or fallback to in-memory).
 */
function getSyncStorage() {
  // Chrome / MV3
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return {
      get: (k: string) =>
        new Promise<string | undefined>((resolve) =>
          chrome.storage.local.get([k], (res) => resolve(res[k]))
        ),
      set: (k: string, v: string) =>
        new Promise<void>((resolve) =>
          chrome.storage.local.set({ [k]: v }, () => resolve())
        ),
    };
  }

  // LocalStorage (browser / JSDOM)
  if (typeof localStorage !== 'undefined') {
    return {
      get: async (k: string) => localStorage.getItem(k) ?? undefined,
      set: async (k: string, v: string) => {
        localStorage.setItem(k, v);
      },
    };
  }

  // Fallback: in-memory
  return {
    get: async (k: string) => MEMORY_STORE[k],
    set: async (k: string, v: string) => {
      MEMORY_STORE[k] = v;
    },
  };
}

const storage = getSyncStorage();

//--------------------------------------------------------------
// Core
//--------------------------------------------------------------

export function generateMapping(
  selectors: Selector[],
  columns: ColumnName[]
): Mapping {
  if (selectors.length !== columns.length) {
    throw new Error(
      `generateMapping: length mismatch (selectors=${selectors.length}, columns=${columns.length})`
    );
  }

  const mapping: Mapping = {};

  for (let i = 0; i < selectors.length; i++) {
    mapping[selectors[i]] = columns[i];
  }

  return mapping;
}

export function validateMapping(mapping: Mapping): boolean {
  if (!mapping || typeof mapping !== 'object') return false;

  const selectors = Object.keys(mapping);
  const columns = Object.values(mapping);

  // Non-empty
  if (selectors.length === 0 || columns.length === 0) return false;

  // Keys/values must all be strings
  if (
    !selectors.every((s) => typeof s === 'string') ||
    !columns.every((c) => typeof c === 'string')
  )
    return false;

  // No duplicate selectors
  const selectorSet = new Set(selectors);
  if (selectorSet.size !== selectors.length) return false;

  // No empty strings
  if (
    selectors.some((s) => !s.trim()) ||
    columns.some((c) => !c.trim())
  )
    return false;

  return true;
}

export async function saveMapping(id: string, mapping: Mapping): Promise<void> {
  if (!validateMapping(mapping))
    throw new Error('Invalid mapping; save aborted.');

  const serialized = JSON.stringify(mapping);
  await storage.set(`mapping:${id}`, serialized);
}

export async function loadMapping(id: string): Promise<Mapping | null> {
  const raw = await storage.get(`mapping:${id}`);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);

    // Ensure the parsed object is a plain object with string keys/values
    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
    ) {
      const obj = parsed as { [key: string]: unknown };
      const casted: Mapping = {};

      for (const [k, v] of Object.entries(obj)) {
        if (typeof k !== 'string' || typeof v !== 'string') {
          return null; // invalid structure
        }
        casted[k] = v;
      }

      if (validateMapping(casted)) {
        return casted;
      }
    }
  } catch {
    /* swallow */
  }
  return null;
}

export function applyMapping(
  mapping: Mapping,
  rowData: RowData
): SelectorValueMap {
  const result: SelectorValueMap = {};

  for (const [selector, column] of Object.entries(mapping)) {
    if (column in rowData) {
      result[selector] = rowData[column];
    }
  }

  return result;
}

//--------------------------------------------------------------
// Auto-mapping heuristics
//--------------------------------------------------------------

function tokenize(str: string): string[] {
  return str
    .replace(/[^a-z0-9]+/gi, ' ')
    .toLowerCase()
    .split(' ')
    .filter(Boolean);
}

/**
 * Very light similarity: intersection size / union size.
 */
function jaccard(a: Set<string>, b: Set<string>): number {
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

interface AutoMapOptions {
  threshold?: number;
  scorer?: (a: Set<string>, b: Set<string>) => number;
}

/**
 * Attempt to infer mapping between selectors and sheet headers.
 */
export function autoMap(
  selectors: Selector[],
  headers: ColumnName[],
  options: AutoMapOptions = {}
): Mapping {
  const {
    threshold = 0.1,
    scorer = jaccard,
  } = options;

  const mapping: Mapping = {};
  const usedHeaders = new Set<string>();

  // Pre-tokenize headers
  const headerTokens = headers.map((h) => new Set(tokenize(h)));

  for (const selector of selectors) {
    let bestIdx = -1;
    let bestScore = 0;

    const selTokens = new Set(tokenize(selector));

    for (let i = 0; i < headers.length; i++) {
      if (usedHeaders.has(headers[i])) continue;

      const score = scorer(selTokens, headerTokens[i]);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    // Threshold to avoid random pairing
    if (bestIdx !== -1 && bestScore >= threshold) {
      mapping[selector] = headers[bestIdx];
      usedHeaders.add(headers[bestIdx]);
    }
  }

  return mapping;
}