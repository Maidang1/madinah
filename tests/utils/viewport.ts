type MediaQueryListener = (event: MediaQueryListEvent) => void;

interface MediaQueryInstance {
  state: { matches: boolean };
  mql: MediaQueryListMock;
}

interface MediaQueryRegistryEntry {
  listeners: Set<MediaQueryListener>;
  instances: Set<MediaQueryInstance>;
}

interface MediaQueryListMock extends MediaQueryList {
  onchange: MediaQueryListener | null;
}

const registry = new Map<string, MediaQueryRegistryEntry>();

const viewportState = {
  width: typeof window !== 'undefined' ? window.innerWidth : 1024,
  height: typeof window !== 'undefined' ? window.innerHeight : 768,
  prefersReducedMotion: false,
};

const normalizeQuery = (query: string) => query.replace(/\s+/g, ' ').trim().toLowerCase();

const evaluateSingleExpression = (expression: string) => {
  if (expression.includes('prefers-reduced-motion: reduce')) {
    return viewportState.prefersReducedMotion;
  }

  if (expression.includes('prefers-reduced-motion: no-preference')) {
    return !viewportState.prefersReducedMotion;
  }

  const minWidth = expression.match(/\(min-width:\s*(\d+)px\)/);
  if (minWidth && viewportState.width < Number(minWidth[1])) {
    return false;
  }

  const maxWidth = expression.match(/\(max-width:\s*(\d+)px\)/);
  if (maxWidth && viewportState.width > Number(maxWidth[1])) {
    return false;
  }

  const minHeight = expression.match(/\(min-height:\s*(\d+)px\)/);
  if (minHeight && viewportState.height < Number(minHeight[1])) {
    return false;
  }

  const maxHeight = expression.match(/\(max-height:\s*(\d+)px\)/);
  if (maxHeight && viewportState.height > Number(maxHeight[1])) {
    return false;
  }

  return true;
};

const evaluateQuery = (query: string) => {
  const parts = normalizeQuery(query).split(' and ');
  return parts.every((part) => evaluateSingleExpression(part));
};

const getRegistryEntry = (query: string): MediaQueryRegistryEntry => {
  if (!registry.has(query)) {
    registry.set(query, { listeners: new Set(), instances: new Set() });
  }
  return registry.get(query)!;
};

const createEvent = (matches: boolean, media: string) => ({ matches, media } as MediaQueryListEvent);

const createMediaQueryList = (query: string): MediaQueryListMock => {
  const entry = getRegistryEntry(query);
  const state = { matches: evaluateQuery(query) };

  const mql: MediaQueryListMock = {
    media: query,
    onchange: null,
    get matches() {
      return state.matches;
    },
    addEventListener(event, listener) {
      if (event === 'change') {
        entry.listeners.add(listener as MediaQueryListener);
      }
    },
    removeEventListener(event, listener) {
      if (event === 'change') {
        entry.listeners.delete(listener as MediaQueryListener);
      }
    },
    addListener(listener) {
      entry.listeners.add(listener as MediaQueryListener);
    },
    removeListener(listener) {
      entry.listeners.delete(listener as MediaQueryListener);
    },
    dispatchEvent(event) {
      if (event.type !== 'change') {
        return false;
      }
      const changeEvent = createEvent(state.matches, query);
      entry.listeners.forEach((listener) => listener(changeEvent));
      if (typeof mql.onchange === 'function') {
        mql.onchange(changeEvent);
      }
      return true;
    },
  } as MediaQueryListMock;

  entry.instances.add({ state, mql });
  return mql;
};

const notifyMatchMediaSubscribers = () => {
  registry.forEach((entry, query) => {
    const matches = evaluateQuery(query);
    entry.instances.forEach((instance) => {
      const hasChanged = instance.state.matches !== matches;
      instance.state.matches = matches;
      if (!hasChanged) {
        return;
      }
      const event = createEvent(matches, query);
      entry.listeners.forEach((listener) => listener(event));
      if (typeof instance.mql.onchange === 'function') {
        instance.mql.onchange(event);
      }
    });
  });
};

const ensureMatchMediaMock = () => {
  if (typeof window.matchMedia === 'function' && (window.matchMedia as { __isMock?: boolean }).__isMock) {
    return;
  }

  const mock = (query: string) => createMediaQueryList(query);
  (mock as { __isMock?: boolean }).__isMock = true;
  window.matchMedia = mock as typeof window.matchMedia;
};

export const resizeViewport = (width: number, height = viewportState.height) => {
  ensureMatchMediaMock();
  viewportState.width = width;
  viewportState.height = height;

  Object.assign(window, { innerWidth: width, innerHeight: height });
  window.dispatchEvent(new Event('resize'));

  notifyMatchMediaSubscribers();
};

export const setReducedMotionPreference = (shouldReduce: boolean) => {
  ensureMatchMediaMock();
  viewportState.prefersReducedMotion = shouldReduce;
  notifyMatchMediaSubscribers();
};

export const getViewportState = () => ({ ...viewportState });

declare global {
  // eslint-disable-next-line no-var
  var resizeViewport: typeof resizeViewport | undefined;
  // eslint-disable-next-line no-var
  var setReducedMotionPreference: typeof setReducedMotionPreference | undefined;
}

globalThis.resizeViewport = resizeViewport;
globalThis.setReducedMotionPreference = setReducedMotionPreference;

ensureMatchMediaMock();
