import '@testing-library/jest-dom'

// Node.js 25 exposes a native localStorage without .clear() — replace with a
// proper in-memory implementation so tests can call localStorage.clear().
if (typeof localStorage === 'undefined' || typeof localStorage.clear !== 'function') {
  const store: Record<string, string> = {}
  const localStorageMock: Storage = {
    get length() { return Object.keys(store).length },
    key(index: number) { return Object.keys(store)[index] ?? null },
    getItem(key: string) { return key in store ? store[key] : null },
    setItem(key: string, value: string) { store[key] = String(value) },
    removeItem(key: string) { delete store[key] },
    clear() { Object.keys(store).forEach((k) => delete store[k]) },
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true,
  })
}
