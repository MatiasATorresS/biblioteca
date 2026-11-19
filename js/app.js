// ==========================================================================
// BIBLIOTECA — app.js
// Punto de entrada compartido por todas las páginas. Se importa con
// type="module" en cada .html y prepara lo que es común a todas: datos
// de ejemplo, tema claro/oscuro y comportamiento del sidebar en móvil.
// ==========================================================================

import { sembrarDatosIniciales } from "./storage.js";
import { inicializarTema, alternarTema, inicializarSidebar } from "./ui.js";

export function inicializarApp() {
  sembrarDatosIniciales();
  inicializarTema();
  inicializarSidebar();

  document.querySelectorAll("[data-theme-toggle]").forEach((boton) => {
    boton.addEventListener("click", alternarTema);
  });

  // Año actual en el footer, si existe.
  document.querySelectorAll("[data-anio-actual]").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });

  // Sincronización entre pestañas: si otra pestaña modifica los datos,
  // cada página escucha este evento y vuelve a pintar sus tablas.
  window.addEventListener("storage", (evento) => {
    if (!evento.key || !evento.key.startsWith("biblioteca_")) return;
    document.dispatchEvent(
      new CustomEvent("biblioteca:datos-actualizados", { detail: { clave: evento.key } })
    );
  });
}

inicializarApp();
