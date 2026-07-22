// Ruteo por hash — necesario porque un hosting estático (GitHub Pages / Cloudflare
// Pages) no redirige sub-rutas a index.html sin configuración extra; con "#" la
// ruta nunca llega al servidor.
const routes = [];
let container = null;
let notFoundPath = "/dashboard";

function toRegex(path) {
  const keys = [];
  const pattern = path
    .replace(/\/:([^/]+)/g, (_, key) => {
      keys.push(key);
      return "/([^/]+)";
    })
    .replace(/\//g, "\\/");
  return { regex: new RegExp(`^${pattern}$`), keys };
}

export function registerRoute(path, render) {
  const { regex, keys } = toRegex(path);
  routes.push({ path, regex, keys, render });
}

export function setNotFoundPath(path) {
  notFoundPath = path;
}

export function navigate(path) {
  if (location.hash === "#" + path) {
    renderCurrent();
  } else {
    location.hash = "#" + path;
  }
}

export function currentPath() {
  return location.hash.slice(1) || "/";
}

async function renderCurrent() {
  if (!container) return;
  const [pathOnly, queryStr] = currentPath().split("?");
  const query = Object.fromEntries(new URLSearchParams(queryStr || ""));

  if (typeof container._cleanup === "function") {
    container._cleanup();
    container._cleanup = null;
  }

  for (const route of routes) {
    const match = pathOnly.match(route.regex);
    if (match) {
      const params = {};
      route.keys.forEach((key, i) => (params[key] = decodeURIComponent(match[i + 1])));
      window.scrollTo(0, 0);
      await route.render(container, params, query);
      return;
    }
  }
  navigate(notFoundPath);
}

export function startRouter(rootEl) {
  container = rootEl;
  window.addEventListener("hashchange", renderCurrent);
  if (!location.hash) location.hash = "#" + notFoundPath;
  else renderCurrent();
}

export function refresh() {
  renderCurrent();
}
