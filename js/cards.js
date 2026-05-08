/**
 * @file cards.js
 * @description Renderizado de cartas (thumbnails, previews, modal de detalle).
 *   Gestiona el modal completo de la ficha de carta en arcanos.html:
 *   apertura, cierre, navegación prev/next, toggle de orientación y focus trap.
 *
 * @dependencies
 *   - render-carta.js — renderSeccionesCarta(), getBadgeTipoCarta()
 *   - navigation.js   — navigateTo() (importado dinámicamente en el handler del modal)
 *
 * @architecture
 *   Las secciones 1–6 del modal se delegan completamente a render-carta.js (Fase 6).
 *   cards.js solo gestiona el shell del modal (overlay, botones, focus trap) y
 *   el toggle de orientación, que es específico del contexto del modal.
 *   NO contiene lógica de combinaciones — eso es combinations.js.
 *   NO importa de resultado.js (sin imports cruzados entre módulos de página).
 *
 * @exports renderPlaceholderCarta, renderThumbnailCarta, getNombreCompleto,
 *          getBadgeTipo, renderModalDetalleCarta, abrirModal, cerrarModal, navegarModal
 */

import { renderSeccionesCarta, getBadgeTipoCarta } from './render-carta.js';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE PLACEHOLDER Y THUMBNAIL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve el HTML de un placeholder CSS para una carta.
 * Los placeholders son divs con clases CSS que representan visualmente la carta
 * mientras no hay imagen real disponible.
 *
 * @param {object} carta — objeto de cartas.json
 * @param {string|number} mazo — "1" | "2" | "3"
 * @param {string} tamano — "full" | "medium" | "thumb" | "icon"
 * @returns {string} HTML string
 */
export function renderPlaceholderCarta(carta, mazo, tamano) {
  const numero = carta.numero_original !== null && carta.numero_original !== undefined
    ? carta.numero_original : '';

  return `<div class="placeholder-carta-${tamano} mazo-${mazo}"
               data-numero="${numero}"
               data-nombre="${carta.arcano_es}"
               aria-label="${carta.arcano_es}"></div>`;
}

/**
 * Devuelve el HTML de una celda de grid con imagen real (si existe) o placeholder thumb.
 * Usa srcset para pantallas retina: thumb (1x) + medium (2x).
 * El onerror oculta la imagen y muestra el placeholder si el archivo no existe.
 *
 * @param {object} carta
 * @param {string|number} mazo
 * @returns {string} HTML string
 */
export function renderThumbnailCarta(carta, mazo) {
  const thumbSrc    = `assets/images/mazo-${mazo}/${carta.slug}-thumb.jpg`;
  const mediumSrc   = `assets/images/mazo-${mazo}/${carta.slug}-medium.jpg`;
  const placeholder = renderPlaceholderCarta(carta, mazo, 'thumb');

  let etiqueta = '';
  if (carta.tipo === 'arcano_mayor') {
    etiqueta = carta.numero_original
      ? `<span class="carta-numero">${carta.numero_original}</span>
         <span class="carta-nombre">${carta.arcano_es}</span>`
      : `<span class="carta-nombre">${carta.arcano_es}</span>`;
  } else {
    etiqueta = `<span class="carta-nombre">${carta.arcano_es}</span>`;
  }

  return `<div class="carta-thumbnail-wrapper" data-id="${carta.id}" tabindex="0"
               role="button" aria-label="Ver detalle de ${carta.arcano_es}">
    <div class="carta-imagen-container">
      <img
        src="${thumbSrc}"
        srcset="${thumbSrc} 1x, ${mediumSrc} 2x"
        alt="${carta.arcano_es}"
        loading="lazy"
        onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
      />
      <div style="display:none;">${placeholder}</div>
    </div>
    <div class="carta-etiqueta">${etiqueta}</div>
  </div>`;
}

/**
 * Devuelve el nombre completo de una carta para usar en selectores y listados.
 * Formato según tipo:
 *   - Arcano mayor con número:  "VII - LE CHARIOT"
 *   - Arcano mayor sin número:  "LE MAT"
 *   - Arcano menor:             "AS DE BÂTONS"
 *
 * @param {object} carta
 * @returns {string}
 */
export function getNombreCompleto(carta) {
  if (carta.tipo === 'arcano_mayor') {
    return carta.numero_original
      ? `${carta.numero_original} - ${carta.arcano_es}`
      : carta.arcano_es;
  }
  return carta.arcano_es;
}

/**
 * Devuelve el HTML del badge de tipo de carta.
 * Wrapper de getBadgeTipoCarta() de render-carta.js para evitar imports directos.
 *
 * @param {object} carta
 * @returns {string} HTML string
 */
export function getBadgeTipo(carta) {
  return getBadgeTipoCarta(carta);
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO INTERNO DEL MODAL
// ─────────────────────────────────────────────────────────────────────────────

let _modalTodasLasCartas = [];
let _modalMazo           = '1';
let _modalCartaActual    = null;
let _modalOrientacion    = 'recta';

// ─────────────────────────────────────────────────────────────────────────────
// MODAL DE DETALLE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera el HTML completo de la ficha de carta para el modal.
 * El toggle de orientación se gestiona aquí (no en render-carta.js).
 * Las secciones 1–6 se delegan a renderSeccionesCarta() en modo 'arcanos'.
 *
 * @param {object} carta       — objeto de cartas.json
 * @param {string} orientacion — "recta" | "invertida"
 * @param {string|number} mazo — "1" | "2" | "3"
 * @returns {string} HTML string
 */
export function renderModalDetalleCarta(carta, orientacion = 'recta', mazo = '1') {
  const esRecta = orientacion === 'recta';
  const toggleOrientacion = `
    <div class="modal-orientacion-toggle" role="group" aria-label="Orientación de la carta">
      <button
        class="btn-orientacion ${esRecta ? 'activo' : ''}"
        data-orientacion="recta"
        data-action="toggle-orientacion"
        aria-pressed="${esRecta}"
      >Recta</button>
      <button
        class="btn-orientacion ${!esRecta ? 'activo' : ''}"
        data-orientacion="invertida"
        data-action="toggle-orientacion"
        aria-pressed="${!esRecta}"
      >Invertida</button>
    </div>`;

  const seccionesHTML = renderSeccionesCarta(carta, {
    temaActivo:  null,
    orientacion,
    modo:        'arcanos',
    posicion:    null,
    mazo:        parseInt(mazo, 10) || 1,
  });

  const botones = `
    <div class="modal-navegacion">
      <button class="btn btn-secondary btn-sm" data-action="prev" aria-label="Carta anterior">
        <i class="ph ph-caret-left" aria-hidden="true"></i> Anterior
      </button>
      <button class="btn btn-secondary btn-sm" data-action="combinaciones"
              aria-label="Explorar combinaciones">
        <i class="ph ph-git-merge" aria-hidden="true"></i> Combinaciones
      </button>
      <button class="btn btn-secondary btn-sm" data-action="next" aria-label="Carta siguiente">
        Siguiente <i class="ph ph-caret-right" aria-hidden="true"></i>
      </button>
    </div>`;

  return `
    <div class="modal-toggle-wrapper">${toggleOrientacion}</div>
    ${seccionesHTML}
    ${botones}`;
}

/**
 * Abre el modal con la carta indicada.
 * Crea el overlay, inyecta el contenido, activa el focus trap y registra eventos.
 *
 * @param {number} cartaId        — ID de la carta a mostrar (1–78)
 * @param {Array}  todasLasCartas — array completo de 78 cartas (para navegación prev/next)
 * @param {string|number} mazo    — "1" | "2" | "3"
 */
export function abrirModal(cartaId, todasLasCartas, mazo) {
  _modalTodasLasCartas = todasLasCartas;
  _modalMazo           = String(mazo);
  _modalOrientacion    = 'recta';

  const carta = todasLasCartas.find(c => c.id === cartaId);
  if (!carta) {
    console.warn('[cards.js] abrirModal: carta no encontrada, id:', cartaId);
    return;
  }
  _modalCartaActual = carta;

  cerrarModal(false);

  const overlay    = document.createElement('div');
  overlay.id        = 'modal-carta-overlay';
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', `Detalle de ${carta.arcano_es}`);

  const contenedor    = document.createElement('div');
  contenedor.id        = 'modal-carta-contenedor';
  contenedor.className = 'modal-contenedor';

  const btnCerrar = document.createElement('button');
  btnCerrar.className      = 'modal-btn-cerrar';
  btnCerrar.setAttribute('aria-label', 'Cerrar detalle de carta');
  btnCerrar.innerHTML      = '<i class="ph ph-x" aria-hidden="true"></i>';
  btnCerrar.dataset.action = 'close';

  contenedor.innerHTML = renderModalDetalleCarta(carta, _modalOrientacion, _modalMazo);
  contenedor.prepend(btnCerrar);
  overlay.appendChild(contenedor);
  document.body.appendChild(overlay);

  _activarFocusTrap(overlay);

  overlay.addEventListener('click', _onModalClick);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cerrarModal();
  });
  document.addEventListener('keydown', _onModalKeydown);

  btnCerrar.focus();
  document.body.style.overflow = 'hidden';
}

/**
 * Cierra y destruye el modal del DOM.
 * Restaura el foco al elemento disparador si restaurarFoco es true.
 *
 * @param {boolean} [restaurarFoco=true] — si true, devuelve el foco al thumbnail disparador
 */
export function cerrarModal(restaurarFoco = true) {
  const overlay = document.getElementById('modal-carta-overlay');
  if (!overlay) return;

  overlay.removeEventListener('click', _onModalClick);
  document.removeEventListener('keydown', _onModalKeydown);
  overlay.remove();
  document.body.style.overflow = '';

  if (restaurarFoco && _modalCartaActual) {
    const disparador = document.querySelector(
      `.carta-thumbnail-wrapper[data-id="${_modalCartaActual.id}"]`
    );
    if (disparador) disparador.focus();
  }
}

/**
 * Navega al anterior o siguiente carta en el modal (navegación circular).
 * Reinicia la orientación a 'recta' en cada carta nueva.
 *
 * @param {'prev'|'next'} direccion
 */
export function navegarModal(direccion) {
  if (!_modalCartaActual || _modalTodasLasCartas.length === 0) return;

  const idx = _modalTodasLasCartas.findIndex(c => c.id === _modalCartaActual.id);
  if (idx === -1) return;

  const nuevoIdx = direccion === 'next'
    ? (idx + 1) % _modalTodasLasCartas.length
    : (idx - 1 + _modalTodasLasCartas.length) % _modalTodasLasCartas.length;

  _modalCartaActual = _modalTodasLasCartas[nuevoIdx];
  _modalOrientacion = 'recta';
  _refrescarContenidoModal();
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS PRIVADOS DEL MODAL
// ─────────────────────────────────────────────────────────────────────────────

/** Refresca el contenido del modal conservando el botón cerrar. */
function _refrescarContenidoModal() {
  const contenedor = document.getElementById('modal-carta-contenedor');
  if (!contenedor || !_modalCartaActual) return;

  const btnCerrar = contenedor.querySelector('.modal-btn-cerrar');
  contenedor.innerHTML = renderModalDetalleCarta(_modalCartaActual, _modalOrientacion, _modalMazo);
  if (btnCerrar) contenedor.prepend(btnCerrar);

  const overlay = document.getElementById('modal-carta-overlay');
  if (overlay) overlay.setAttribute('aria-label', `Detalle de ${_modalCartaActual.arcano_es}`);
}

/** Handler de clicks dentro del overlay — delega por data-action. */
function _onModalClick(e) {
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (!action) return;

  switch (action) {
    case 'close':
      cerrarModal();
      break;
    case 'prev':
      navegarModal('prev');
      break;
    case 'next':
      navegarModal('next');
      break;
    case 'combinaciones':
      import('./navigation.js').then(({ navigateTo }) => navigateTo('combinaciones.html'));
      break;
    case 'toggle-orientacion': {
      const nuevaOrientacion = e.target.closest('[data-orientacion]')?.dataset.orientacion;
      if (nuevaOrientacion && nuevaOrientacion !== _modalOrientacion) {
        _modalOrientacion = nuevaOrientacion;
        _refrescarContenidoModal();
      }
      break;
    }
    case 'toggle-expandible': {
      const btn = e.target.closest('[data-action="toggle-expandible"]');
      if (!btn) break;
      const bodyId   = btn.getAttribute('aria-controls');
      const body     = document.getElementById(bodyId);
      if (!body) break;
      const expandido = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expandido));
      body.hidden = expandido;
      const icono = btn.querySelector('.modal-expandible-icono');
      if (icono) {
        icono.className = `ph ${expandido ? 'ph-caret-down' : 'ph-caret-up'} modal-expandible-icono`;
      }
      break;
    }
  }
}

/** Handler de teclado global mientras el modal está abierto. */
function _onModalKeydown(e) {
  if (e.key === 'Escape')     { cerrarModal();        return; }
  if (e.key === 'ArrowRight') { navegarModal('next'); return; }
  if (e.key === 'ArrowLeft')  { navegarModal('prev'); return; }
}

/**
 * Activa el focus trap dentro del overlay del modal.
 * Tab y Shift+Tab ciclan únicamente entre los elementos focusables del overlay.
 * @param {HTMLElement} overlay
 */
function _activarFocusTrap(overlay) {
  const focusables = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  overlay.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const elementos = [...overlay.querySelectorAll(focusables)].filter(
      el => !el.disabled && el.offsetParent !== null
    );
    if (elementos.length === 0) return;
    const primero = elementos[0];
    const ultimo  = elementos[elementos.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
    } else {
      if (document.activeElement === ultimo)  { e.preventDefault(); primero.focus(); }
    }
  });
}
