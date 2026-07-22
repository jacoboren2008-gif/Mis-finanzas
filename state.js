// Store mínimo tipo pub-sub + bus de eventos para refrescar vistas cuando
// cambian los datos desde otro punto de la app (ej. FAB de movimiento rápido).
function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
      listeners.forEach((fn) => fn(state));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export const appState = createStore({
  theme: localStorage.getItem("mf_theme") || "system",
  profile: null,
  filters: {},
});

export const bus = {
  listeners: new Map(),
  on(evt, fn) {
    if (!this.listeners.has(evt)) this.listeners.set(evt, new Set());
    this.listeners.get(evt).add(fn);
    return () => this.listeners.get(evt).delete(fn);
  },
  emit(evt, data) {
    (this.listeners.get(evt) || new Set()).forEach((fn) => fn(data));
  },
};

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "light") root.setAttribute("data-theme", "light");
  else if (theme === "dark") root.setAttribute("data-theme", "dark");
  else root.removeAttribute("data-theme");
  localStorage.setItem("mf_theme", theme);
  appState.set({ theme });
}
