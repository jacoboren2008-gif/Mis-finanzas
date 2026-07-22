import { getProfile } from "./db.js";
import { startRouter, registerRoute, refresh } from "./router.js";
import { applyTheme, appState } from "./state.js";
import { renderOnboarding } from "./views/onboarding.js";
import { renderLock } from "./views/lock.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderSpaceDetail } from "./views/space-detail.js";
import { renderCalendar } from "./views/calendar.js";
import { renderHistory } from "./views/history.js";
import { renderProfile } from "./views/profile.js";

const appEl = document.getElementById("app");

async function boot() {
  applyTheme(appState.get().theme);

  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }

  let profile = await getProfile();
  if (!profile || !profile.onboarded) {
    await new Promise((resolve) => renderOnboarding(appEl, { onComplete: resolve }));
    profile = await getProfile();
  }
  appState.set({ profile });

  if (profile && profile.pinHash) {
    await new Promise((resolve) => renderLock(appEl, { mode: "unlock", onSuccess: resolve }));
  }

  setupReLockOnHide();
  registerRoutes();
  startRouter(appEl);
  registerServiceWorker();
}

function registerRoutes() {
  registerRoute("/dashboard", renderDashboard);
  registerRoute("/espacio/:id", renderSpaceDetail);
  registerRoute("/calendario", renderCalendar);
  registerRoute("/historial", renderHistory);
  registerRoute("/perfil", renderProfile);
}

function setupReLockOnHide() {
  let hiddenAt = null;
  const THRESHOLD_MS = 15000;
  document.addEventListener("visibilitychange", async () => {
    if (document.hidden) {
      hiddenAt = Date.now();
      return;
    }
    if (!hiddenAt || Date.now() - hiddenAt < THRESHOLD_MS) return;
    hiddenAt = null;
    const profile = await getProfile();
    if (profile && profile.pinHash) {
      await new Promise((resolve) => renderLock(appEl, { mode: "unlock", onSuccess: resolve }));
      refresh();
    }
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker
    .register("service-worker.js")
    .then((reg) => {
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateBanner(newWorker);
          }
        });
      });
    })
    .catch((err) => console.warn("[SW] No se pudo registrar:", err));

  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
}

function showUpdateBanner(worker) {
  const el = document.createElement("div");
  el.className = "update-banner";
  el.innerHTML = `<span style="flex:1">Hay una nueva versión disponible</span><button class="btn btn-primary btn-sm" type="button">Actualizar</button>`;
  el.querySelector("button").addEventListener("click", () => {
    worker.postMessage("SKIP_WAITING");
    el.remove();
  });
  document.body.appendChild(el);
}

boot();
