// ==========================================================================
// BIBLIOTECA — ui.js
// Piezas de interfaz reutilizables entre páginas: sistema de modales con
// trampa de foco, toasts de notificación, alternancia de tema, manejo del
// sidebar en móvil y helpers de formularios.
// ==========================================================================

import { obtenerTemaGuardado, guardarTema } from "./storage.js";

/* -------------------------------------------------------------------------
   Toasts
   ------------------------------------------------------------------------- */
const ICONOS_TOAST = {
  success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>`,
  error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>`,
  warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 9v4M12 17h.01M10.3 3.86 1.8 18a1.5 1.5 0 0 0 1.3 2.25h17.8A1.5 1.5 0 0 0 22.2 18L13.7 3.86a1.5 1.5 0 0 0-2.6 0Z"/></svg>`,
};

/** Iconos SVG (trazo, heredan color) para botones generados dinámicamente. */
export const ICONOS = {
  editar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg>`,
  eliminar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>`,
  devolver: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 3-7.7L3 7"/></svg>`,
  mas: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
  buscar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>`,
  pdf: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 15h1.5a1.5 1.5 0 0 0 0-3H9v5M13.5 12v5M13.5 12H15a1.5 1.5 0 0 1 0 3h-1.5"/></svg>`,
  libro: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></svg>`,
  cerrar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`,
  vacio: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><path d="M9 7h6M9 11h6"/></svg>`,
  respaldo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>`,
  importar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/></svg>`,
  restaurar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 3-7.7L3 7"/></svg>`,
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

  const icono = document.createElement("span");
  icono.className = "toast__icon";
  icono.innerHTML = ICONOS_TOAST[tipo] ?? ICONOS_TOAST.success;

  // textContent (no innerHTML): evita inyectar HTML desde títulos o datos.
  const texto = document.createElement("span");
  texto.textContent = mensaje;

  toast.append(icono, texto);
  region.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("is-leaving");
    setTimeout(() => toast.remove(), 220);
  }, duracion);
}

/* -------------------------------------------------------------------------
   Helpers de formularios (compartidos por libros, usuarios y préstamos)
   ------------------------------------------------------------------------- */
export function limpiarErrores(form) {
  form.querySelectorAll(".field").forEach((campo) => {
    campo.classList.remove("has-error");
    campo.querySelectorAll("[aria-invalid]").forEach((control) => {
      control.removeAttribute("aria-invalid");
      control.removeAttribute("aria-describedby");
    });
  });
}

export function marcarError(campoId) {
  const control = document.getElementById(campoId);
  if (!control) return;
  const field = control.closest(".field");
  field?.classList.add("has-error");
  control.setAttribute("aria-invalid", "true");

  const error = field?.querySelector(".field__error");
  if (error) {
    if (!error.id) error.id = `${campoId}-error`;
    control.setAttribute("aria-describedby", error.id);
  }
}

/* -------------------------------------------------------------------------
   Modales — con trampa de foco, cierre con Escape e inert
   ------------------------------------------------------------------------- */
let modalActivo = null;
let elementoConFocoPrevio = null;

/** Compatibilidad: algunos navegadores antiguos no exponen `inert`. */
function fijarInert(elemento, valor) {
  if (!elemento) return;
  if ("inert" in elemento) elemento.inert = valor;
  else if (valor) elemento.setAttribute("inert", "");
  else elemento.removeAttribute("inert");
}

// Los modales cerrados no deben ser enfocables ni anunciados.
document.querySelectorAll(".modal-overlay").forEach((overlay) => fijarInert(overlay, true));

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
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
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
  fijarInert(overlay, false);
  overlay.classList.add("is-open");
  overlay.removeAttribute("aria-hidden");
  modalActivo = overlay;
  document.addEventListener("keydown", manejarTeclaModal);
  document.body.classList.add("modal-abierto");
  fijarInert(document.querySelector(".app-shell"), true);

  const primerCampo = overlay.querySelector("input, select, textarea, button");

  // Enfocar en el mismo tick (forzando el cálculo de estilo): si se deja
  // para el siguiente frame, el blur que provoca `inert` en el shell puede
  // ejecutarse después y devolver el foco al <body>.
  void overlay.offsetHeight;
  primerCampo?.focus();
  if (document.activeElement !== primerCampo) {
    setTimeout(() => {
      if (overlay.classList.contains("is-open")) primerCampo?.focus();
    }, 60);
  }
}

/** Cierra un overlay de modal. */
export function cerrarModal(overlay) {
  if (!overlay) return;
  overlay.classList.remove("is-open");
  overlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-abierto");
  document.removeEventListener("keydown", manejarTeclaModal);
  modalActivo = null;
  fijarInert(overlay, true);
  fijarInert(document.querySelector(".app-shell"), false);
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
  if (!overlay) return Promise.resolve(window.confirm(`${titulo}\n\n${mensaje}`));

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
      overlay.removeEventListener("click", onBackdrop);
      overlay.removeEventListener("modal:escape", onEscape);
      resolve(resultado);
    };
    const onOk = () => { cerrarModal(overlay); limpiar(true); };
    const onCancelar = () => { cerrarModal(overlay); limpiar(false); };
    const onEscape = () => limpiar(false);
    const onBackdrop = (evento) => {
      if (evento.target === overlay) onCancelar();
    };

    botonOk.addEventListener("click", onOk);
    botonesCancelar.forEach((boton) => boton.addEventListener("click", onCancelar));
    overlay.addEventListener("click", onBackdrop);
    overlay.addEventListener("modal:escape", onEscape);
  });
}

/* -------------------------------------------------------------------------
   Tema claro / oscuro
   ------------------------------------------------------------------------- */
function temaDelSistema() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function aplicarTema(tema) {
  const valido = tema === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", valido);
  actualizarIconoTema(valido);
}

export function inicializarTema() {
  const guardado = obtenerTemaGuardado();
  aplicarTema(guardado === "dark" || guardado === "light" ? guardado : temaDelSistema());

  // Si el usuario nunca eligió manualmente, seguir el cambio del sistema.
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener?.("change", (evento) => {
    if (!obtenerTemaGuardado()) aplicarTema(evento.matches ? "dark" : "light");
  });

  // Sincronizar el tema entre pestañas abiertas.
  window.addEventListener("storage", (evento) => {
    if (evento.key === "biblioteca_tema") aplicarTema(evento.newValue ?? temaDelSistema());
  });
}

export function alternarTema() {
  const actual = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  const nuevo = actual === "dark" ? "light" : "dark";
  aplicarTema(nuevo);
  guardarTema(nuevo);
}

function actualizarIconoTema(tema) {
  const esOscuro = tema === "dark";
  document.querySelectorAll("[data-theme-toggle]").forEach((boton) => {
    const etiqueta = boton.querySelector("[data-theme-label]");
    if (etiqueta) etiqueta.textContent = esOscuro ? "Modo oscuro" : "Modo claro";
    boton.setAttribute("aria-pressed", esOscuro ? "true" : "false");
    boton.setAttribute("aria-label", esOscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
  });

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", esOscuro ? "#15161a" : "#f7f7f5");
}

/* -------------------------------------------------------------------------
   Sidebar en móvil (drawer)
   ------------------------------------------------------------------------- */
export function inicializarSidebar() {
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.querySelector(".sidebar-overlay");
  const botonAbrir = document.querySelector("[data-sidebar-toggle]");
  if (!sidebar || !botonAbrir) return;

  const media = window.matchMedia("(max-width: 860px)");

  const alEscape = (evento) => {
    if (evento.key === "Escape") cerrar();
  };

  function abrir() {
    sidebar.classList.add("is-open");
    overlay?.classList.add("is-visible");
    botonAbrir.setAttribute("aria-expanded", "true");
    document.body.classList.add("drawer-abierto");
    document.addEventListener("keydown", alEscape);
    const primerEnlace = sidebar.querySelector(".sidebar__link");
    void sidebar.offsetHeight;
    primerEnlace?.focus();
    if (document.activeElement !== primerEnlace) {
      setTimeout(() => {
        if (sidebar.classList.contains("is-open")) primerEnlace?.focus();
      }, 60);
    }
  }

  function cerrar({ devolverFoco = true } = {}) {
    if (!sidebar.classList.contains("is-open")) return;
    sidebar.classList.remove("is-open");
    overlay?.classList.remove("is-visible");
    botonAbrir.setAttribute("aria-expanded", "false");
    document.body.classList.remove("drawer-abierto");
    document.removeEventListener("keydown", alEscape);
    if (devolverFoco) botonAbrir.focus();
  }

  botonAbrir.addEventListener("click", () => {
    sidebar.classList.contains("is-open") ? cerrar() : abrir();
  });
  overlay?.addEventListener("click", () => cerrar());
  sidebar.querySelectorAll(".sidebar__link").forEach((link) =>
    link.addEventListener("click", () => cerrar({ devolverFoco: false }))
  );

  // Si la pantalla crece (tablet/escritorio), el drawer deja de tener sentido.
  media.addEventListener?.("change", (evento) => {
    if (!evento.matches) cerrar({ devolverFoco: false });
  });
}
