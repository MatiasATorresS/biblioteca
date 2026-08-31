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

  // Año actual en el footer del sidebar, si existe.
  const anioEl = document.querySelector("[data-anio-actual]");
  if (anioEl) anioEl.textContent = new Date().getFullYear();
}

inicializarApp();
