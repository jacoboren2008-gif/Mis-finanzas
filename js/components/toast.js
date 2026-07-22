export function showToast(message, { duration = 2400 } = {}) {
  const root = document.getElementById("toast-root");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity 0.2s ease";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 200);
  }, duration);
}
