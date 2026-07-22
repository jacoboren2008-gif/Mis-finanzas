export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

export function openModal({ title, content, actions = [], center = false, onClose }) {
  const root = document.getElementById("modal-root");
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  const sheet = document.createElement("div");
  sheet.className = "modal-sheet" + (center ? " center" : "");
  sheet.innerHTML = `
    ${center ? "" : '<div class="modal-handle"></div>'}
    <div class="modal-head"><h2>${escapeHtml(title)}</h2><button class="icon-btn ghost" data-close type="button">✕</button></div>
    <div class="modal-body"></div>
  `;
  const body = sheet.querySelector(".modal-body");
  if (typeof content === "string") body.innerHTML = content;
  else if (content) body.appendChild(content);

  if (actions.length) {
    const actionsEl = document.createElement("div");
    actionsEl.className = "modal-actions";
    actions.forEach((a) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-block " + (a.className || "btn-secondary");
      btn.textContent = a.label;
      btn.addEventListener("click", () => a.onClick && a.onClick(close));
      actionsEl.appendChild(btn);
    });
    sheet.appendChild(actionsEl);
  }

  backdrop.appendChild(sheet);
  root.appendChild(backdrop);
  document.body.classList.add("scroll-lock");

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    backdrop.remove();
    if (!root.children.length) document.body.classList.remove("scroll-lock");
    onClose && onClose();
  }
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  sheet.querySelector("[data-close]").addEventListener("click", close);

  return { close, body, sheet };
}

export function confirmDialog({ title = "¿Estás seguro?", message, okText = "Confirmar", cancelText = "Cancelar", danger = false }) {
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (value) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };
    openModal({
      title,
      center: true,
      content: `<p style="color:var(--ink-secondary);font-size:0.9rem;line-height:1.5;margin:0">${escapeHtml(message || "")}</p>`,
      actions: [
        { label: cancelText, className: "btn-secondary", onClick: (c) => { finish(false); c(); } },
        { label: okText, className: danger ? "btn-danger" : "btn-primary", onClick: (c) => { finish(true); c(); } },
      ],
      onClose: () => finish(false),
    });
  });
}
