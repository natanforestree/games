// localStorage can throw (private windows, blocked site data), so every access goes through here.
// When it fails, the game just doesn't remember things.
function defaultBackend() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function safeStorage(backend = defaultBackend()) {
  return {
    get(key) {
      try {
        return backend ? backend.getItem(key) : null;
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        backend?.setItem(key, String(value));
      } catch {
        // not saved; the game still works
      }
    },
  };
}
