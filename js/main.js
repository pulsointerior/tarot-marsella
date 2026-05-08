/**
 * @file main.js
 * @description Inicialización global. Se carga en TODOS los HTML del proyecto.
 *   Gestiona la UI compartida (botones de scroll), el manejo global de errores
 *   no controlados y los handlers de Promises rechazadas.
 *
 * @architecture
 *   main.js NO llama funciones de inicialización específicas de cada página.
 *   NO importa módulos específicos de página (readings.js, combinations.js, etc.)
 *   Es el punto de arranque global — todas las páginas lo cargan con type="module".
 *
 * @dependencies
 *   animations.js — ANIMATION_LEVEL (para aplicar clase de nivel al body en todas las páginas)
 */

// ✅ FIX 3: importar ANIMATION_LEVEL para aplicar la clase al body en TODAS las páginas,
// no solo en indicar-cartas.html donde se llama inicializarMazo().
import { ANIMATION_LEVEL } from './animations.js';

// ─────────────────────────────────────────────────────────────────────────────
// UI GLOBAL
// ─────────────────────────────────────────────────────────────────────────────

function inicializar() {
  // Aplicar clase de nivel de animación al body en todas las páginas
  document.body.classList.add('anim-' + ANIMATION_LEVEL);

  initGlobalUI();
  registrarErrorHandlers();
}

function initGlobalUI() {
  const pagina = document.body.dataset.page;
  const PAGINAS_CON_SCROLL = ['resultado', 'arcanos', 'combinaciones', 'detalle-combinacion'];
  if (!PAGINAS_CON_SCROLL.includes(pagina)) return;

  const existentes = document.querySelector('.scroll-buttons');
  if (!existentes) {
    _crearBotonesScroll();
  }
  _initScrollVisibility();
}

function _crearBotonesScroll() {
  const wrapper = document.createElement('div');
  wrapper.className = 'scroll-buttons';
  wrapper.setAttribute('aria-label', 'Navegación rápida');

  wrapper.innerHTML = `
    <button
      class="btn-scroll"
      aria-label="Ir al inicio"
      id="btn-scroll-arriba"
    >
      <i class="ph ph-arrow-up" aria-hidden="true"></i>
    </button>
    <button
      class="btn-scroll"
      aria-label="Ir al final"
      id="btn-scroll-abajo"
    >
      <i class="ph ph-arrow-down" aria-hidden="true"></i>
    </button>`;

  document.body.appendChild(wrapper);

  document.getElementById('btn-scroll-arriba')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.getElementById('btn-scroll-abajo')?.addEventListener('click', () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  });
}

function _initScrollVisibility() {
  const UMBRAL = 200;

  function actualizarVisibilidad() {
    const scrollY   = window.scrollY;
    const alturaMax = document.body.scrollHeight - window.innerHeight;
    const btnArriba = document.querySelector('.scroll-buttons .btn-scroll:first-child');
    const btnAbajo  = document.querySelector('.scroll-buttons .btn-scroll:last-child');
    if (btnArriba) btnArriba.style.opacity = scrollY > UMBRAL ? '1' : '0.3';
    if (btnAbajo)  btnAbajo.style.opacity  = scrollY < alturaMax - UMBRAL ? '1' : '0.3';
  }

  let _scrollTimer = null;
  window.addEventListener('scroll', () => {
    if (_scrollTimer) return;
    _scrollTimer = setTimeout(() => {
      actualizarVisibilidad();
      _scrollTimer = null;
    }, 100);
  }, { passive: true });

  actualizarVisibilidad();
}

// ─────────────────────────────────────────────────────────────────────────────
// MANEJO GLOBAL DE ERRORES
// ─────────────────────────────────────────────────────────────────────────────

function registrarErrorHandlers() {
  window.onerror = function (mensaje, fuente, linea, columna, error) {
    console.error('[main.js] Error global:', { mensaje, fuente, linea, columna, error });
    _mostrarErrorGlobal(`Error inesperado: ${mensaje}`);
    return false;
  };

  window.onunhandledrejection = function (event) {
    console.error('[main.js] Promise rechazada:', event.reason);
    if (event.reason instanceof Error) {
      _mostrarErrorGlobal(`Error al procesar datos: ${event.reason.message}`);
    }
  };
}

function _mostrarErrorGlobal(mensaje) {
  if (document.getElementById('banner-error-global')) return;

  const banner = document.createElement('div');
  banner.id = 'banner-error-global';
  banner.setAttribute('role', 'alert');
  banner.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 9999;
    background: rgba(244, 67, 54, 0.92);
    color: #fff;
    font-family: 'Source Sans 3', sans-serif;
    font-size: 0.9rem;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 10px;
    backdrop-filter: blur(4px);
  `;
  banner.innerHTML = `
    <i class="ph ph-warning-circle" style="font-size:1.2rem; flex-shrink:0;"></i>
    <span>${mensaje}</span>
    <button
      onclick="this.parentElement.remove()"
      style="margin-left:auto; background:none; border:none; color:#fff; cursor:pointer; padding:4px; font-size:1rem;"
      aria-label="Cerrar aviso"
    ><i class="ph ph-x"></i></button>
  `;

  document.body.prepend(banner);
  setTimeout(() => banner.remove(), 6000);
}

// ─────────────────────────────────────────────────────────────────────────────
// ARRANQUE
// ─────────────────────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializar);
} else {
  inicializar();
}