// ==========================================================================
// BIBLIOTECA — ui.js
// Piezas de interfaz reutilizables entre páginas: sistema de modales con
// trampa de foco, toasts de notificación, alternancia de tema y manejo
// del sidebar en móvil.
// ==========================================================================

import { obtenerTemaGuardado, guardarTema } from "./storage.js";

/* -------------------------------------------------------------------------
   Toasts
   ------------------------------------------------------------------------- */
const ICONOS_TOAST = {
  success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`,
  error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>`,
  warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01M10.3 3.86 1.8 18a1.5 1.5 0 0 0 1.3 2.25h17.8A1.5 1.5 0 0 0 22.2 18L13.7 3.86a1.5 1.5 0 0 0-2.6 0Z"/></svg>`,
};

/** Iconos SVG (trazo, heredan color) para botones generados dinámicamente. */
export const ICONOS = {
  editar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg>`,
  eliminar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>`,
  devolver: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 3-7.7L3 7"/></svg>`,
  mas: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>`,
  buscar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>`,
  pdf: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 15h1.5a1.5 1.5 0 0 0 0-3H9v5M13.5 12v5M13.5 12H15a1.5 1.5 0 0 1 0 3h-1.5"/></svg>`,
  libro: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></svg>`,
  cerrar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`,
  vacio: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><path d="M9 7h6M9 11h6"/></svg>`,
};

function obtenerRegionToast() {
  let region = document.querySelector(".toast-region");
  if (!region) {
    region = document.createElement("div");
    region.className = "toast-region";
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    document.body.appendChild(region);
  }
  return region;
}

/** Muestra una notificación flotante. tipo: "success" | "error" | "warning" */
export function mostrarToast(mensaje, tipo = "success", duracion = 3200) {
  const region = obtenerRegionToast();
  const toast = document.createElement("div");
  toast.className = `toast toast--${tipo}`;
  toast.innerHTML = `${ICONOS_TOAST[tipo] ?? ICONOS_TOAST.success}<span>${mensaje}</span>`;
  region.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("is-leaving");
    setTimeout(() => toast.remove(), 220);
  }, duracion);
}

/* -------------------------------------------------------------------------
   Modales — con trampa de foco y cierre con Escape
   ------------------------------------------------------------------------- */
let modalActivo = null;
let elementoConFocoPrevio = null;

function manejarTeclaModal(evento) {
  if (!modalActivo) return;

  if (evento.key === "Escape") {
    const overlay = modalActivo;
    cerrarModal(overlay);
    overlay?.dispatchEvent(new CustomEvent("modal:escape"));
    return;
  }

  if (evento.key === "Tab") {
    const focuseables = modalActivo.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focuseables.length === 0) return;
    const primero = focuseables[0];
    const ultimo = focuseables[focuseables.length - 1];

    if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }
}

/** Abre un overlay de modal (elemento con la clase .modal-overlay). */
export function abrirModal(overlay) {
  if (!overlay) return;
  elementoConFocoPrevio = document.activeElement;
  overlay.classList.add("is-open");
  overlay.removeAttribute("aria-hidden");
  modalActivo = overlay;
  document.addEventListener("keydown", manejarTeclaModal);
  document.body.style.overflow = "hidden";

  const primerCampo = overlay.querySelector("input, select, textarea, button");
  requestAnimationFrame(() => primerCampo?.focus());
}

/** Cierra un overlay de modal. */
export function cerrarModal(overlay) {
  if (!overlay) return;
  overlay.classList.remove("is-open");
  overlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  document.removeEventListener("keydown", manejarTeclaModal);
  modalActivo = null;
  elementoConFocoPrevio?.focus?.();
}

/** Conecta el cierre estándar de un overlay: botones [data-cerrar-modal] y click fuera. */
export function conectarCierreModal(overlay) {
  overlay.addEventListener("click", (evento) => {
    if (evento.target === overlay) cerrarModal(overlay);
  });
  overlay.querySelectorAll("[data-cerrar-modal]").forEach((boton) => {
    boton.addEventListener("click", () => cerrarModal(overlay));
  });
}

/**
 * Muestra un modal de confirmación genérico y devuelve una Promise<boolean>.
 * Reutiliza el overlay #modal-confirmar presente en cada página.
 */
export function confirmar({ titulo, mensaje, textoConfirmar = "Eliminar", variante = "danger" }) {
  const overlay = document.getElementById("modal-confirmar");
  const tituloEl = overlay.querySelector("[data-confirmar-titulo]");
  const mensajeEl = overlay.querySelector("[data-confirmar-mensaje]");
  const botonOk = overlay.querySelector("[data-confirmar-ok]");
  const botonesCancelar = overlay.querySelectorAll("[data-cerrar-modal]");

  tituloEl.textContent = titulo;
  mensajeEl.textContent = mensaje;
  botonOk.textContent = textoConfirmar;
  botonOk.className = `btn btn--${variante}`;

  abrirModal(overlay);

  return new Promise((resolve) => {
    const limpiar = (resultado) => {
      botonOk.removeEventListener("click", onOk);
      botonesCancelar.forEach((boton) => boton.removeEventListener("click", onCancelar));
      overlay.removeEventListener("modal:escape", onEscape);
      resolve(resultado);
    };
    const onOk = () => { cerrarModal(overlay); limpiar(true); };
    const onCancelar = () => { cerrarModal(overlay); limpiar(false); };
    const onEscape = () => limpiar(false);

    botonOk.addEventListener("click", onOk);
    botonesCancelar.forEach((boton) => boton.addEventListener("click", onCancelar));
    overlay.addEventListener("modal:escape", onEscape);
  });
}

/* -------------------------------------------------------------------------
   Tema claro / oscuro
   ------------------------------------------------------------------------- */
export function inicializarTema() {
  const preferido = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const tema = obtenerTemaGuardado() ?? preferido;
  document.documentElement.setAttribute("data-theme", tema);
  actualizarIconoTema(tema);
}

export function alternarTema() {
  const actual = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  const nuevo = actual === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", nuevo);
  guardarTema(nuevo);
  actualizarIconoTema(nuevo);
}

function actualizarIconoTema(tema) {
  document.querySelectorAll("[data-theme-toggle]").forEach((boton) => {
    const etiqueta = boton.querySelector("[data-theme-label]");
    if (etiqueta) etiqueta.textContent = tema === "dark" ? "Modo oscuro" : "Modo claro";
    boton.setAttribute("aria-pressed", tema === "dark" ? "true" : "false");
  });
}

/* -------------------------------------------------------------------------
   Sidebar en móvil
   ------------------------------------------------------------------------- */
export function inicializarSidebar() {
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.querySelector(".sidebar-overlay");
  const botonAbrir = document.querySelector("[data-sidebar-toggle]");
  if (!sidebar || !botonAbrir) return;

  const abrir = () => {
    sidebar.classList.add("is-open");
    overlay?.classList.add("is-visible");
    botonAbrir.setAttribute("aria-expanded", "true");
  };
  const cerrar = () => {
    sidebar.classList.remove("is-open");
    overlay?.classList.remove("is-visible");
    botonAbrir.setAttribute("aria-expanded", "false");
  };

  botonAbrir.addEventListener("click", () => {
    sidebar.classList.contains("is-open") ? cerrar() : abrir();
  });
  overlay?.addEventListener("click", cerrar);
  sidebar.querySelectorAll(".sidebar__link").forEach((link) => link.addEventListener("click", cerrar));
}
