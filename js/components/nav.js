const ITEMS = [
  { path: "/dashboard", icon: "🏠", label: "Inicio" },
  { path: "/calendario", icon: "📅", label: "Calendario" },
  { path: "/historial", icon: "📊", label: "Historial" },
  { path: "/perfil", icon: "👤", label: "Perfil" },
];

export function bottomNavHtml(active) {
  return `<nav class="bottom-nav">${ITEMS.map(
    (it) => `<a href="#${it.path}" class="${active === it.path ? "active" : ""}"><span class="nav-icon">${it.icon}</span><span>${it.label}</span></a>`
  ).join("")}</nav>`;
}
