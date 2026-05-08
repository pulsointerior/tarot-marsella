/**
 * @file navigation.js
 * @description Gestión de estado entre páginas y navegación.
 *   Es el ÚNICO módulo que accede a localStorage y URLSearchParams.
 *   Ninguna página HTML accede directamente a estas APIs.
 *
 * @architecture — Contrato de estado (Regla 9):
 *   URL params    → estado efímero de navegación (leído una vez al cargar).
 *                   Usado para pasar ids entre páginas (ej: ?id=t042&tema=amor).
 *   localStorage  → estado de sesión del usuario (persiste entre páginas y recargas).
 *                   Claves: mazo_seleccionado, modo_seleccionado, tirada_actual.
 *   sessionStorage → PROHIBIDO. No se usa en este proyecto para evitar
 *                    fragmentación del estado entre pestañas.
 *
 * @exports getMazo, setMazo, getModo, setModo, getTiradaActual, setTiradaActual,
 *          clearTiradaActual, navigateTo, getUrlParam, verificarEstadoRecovery
 */

// ── MAZO ───────────────────────────────────────────────────────────────────

/**
 * Lee el mazo seleccionado del usuario desde localStorage.
 * Si no hay valor guardado, devuelve el mazo por defecto.
 *
 * @returns {string} "1" | "2" | "3" — default "1"
 */
export function getMazo() {
  return localStorage.getItem('mazo_seleccionado') || '1';
}

/**
 * Guarda el mazo seleccionado en localStorage.
 * El valor persiste entre páginas y recargas sin expiración.
 *
 * @param {string} valor — "1" | "2" | "3"
 */
export function setMazo(valor) {
  localStorage.setItem('mazo_seleccionado', valor);
}

// ── MODO ────────────────────────────────────────────────────────────────────

/**
 * Lee el modo de selección de cartas del usuario desde localStorage.
 * Si no hay valor guardado, devuelve el modo por defecto.
 *
 * @returns {string} "automatico" | "manual" — default "automatico"
 */
export function getModo() {
  return localStorage.getItem('modo_seleccionado') || 'automatico';
}

/**
 * Guarda el modo de selección de cartas en localStorage.
 *
 * @param {string} valor — "automatico" | "manual"
 */
export function setModo(valor) {
  localStorage.setItem('modo_seleccionado', valor);
}

// ── TIRADA ACTUAL ───────────────────────────────────────────────────────────

/**
 * Lee la tirada actual del localStorage y verifica su validez temporal.
 * Si la tirada ha expirado (más de 24 horas desde el timestamp), la elimina.
 * Fase 8A: añade logs de debug para diagnóstico.
 *
 * @returns {Object|null} objeto tirada válido, o null si no existe o ha expirado.
 *   Estructura esperada del objeto devuelto:
 *   {
 *     id_tirada: string,
 *     nombre: string,
 *     tema: string,
 *     num_cartas: number,
 *     cartas: Array<{id, orientacion, posicion}>,
 *     timestamp: number
 *   }
 */
export function getTiradaActual() {
  try {
    const raw = localStorage.getItem('tirada_actual');
    if (!raw) return null;
    const tirada = JSON.parse(raw);
    if (!tirada.timestamp || Date.now() - tirada.timestamp > 86400000) {
      console.debug('[navigation] Tirada expirada, limpiando...');
      clearTiradaActual();
      return null;
    }
    console.debug('[navigation] Tirada válida, timestamp OK');
    return tirada;
  } catch {
    return null;
  }
}

/**
 * Guarda la tirada actual en localStorage con timestamp = Date.now().
 * El timestamp se usa para detectar expiración en getTiradaActual().
 *
 * @param {Object} obj — objeto tirada a guardar. Estructura:
 *   {
 *     id_tirada: string,
 *     nombre: string,
 *     tema: string,
 *     num_cartas: number,
 *     cartas: Array<{id, orientacion, posicion}>
 *   }
 */
export function setTiradaActual(obj) {
  const datos = { ...obj, timestamp: Date.now() };
  localStorage.setItem('tirada_actual', JSON.stringify(datos));
}

/**
 * Elimina la tirada actual del localStorage.
 * Debe llamarse al iniciar una nueva tirada o al navegar a inicio.
 */
export function clearTiradaActual() {
  localStorage.removeItem('tirada_actual');
}

// ── NAVEGACIÓN ──────────────────────────────────────────────────────────────

/**
 * Navega a la URL indicada usando window.location.href.
 * Centraliza toda la navegación programática del proyecto.
 *
 * @param {string} url — ruta relativa o absoluta, ej: "resultado.html" o "tipos-lecturas.html"
 */
export function navigateTo(url) {
  window.location.href = url;
}

/**
 * Lee el valor de un parámetro de la URL actual (query string).
 * Centraliza todo acceso a URLSearchParams.
 *
 * @param {string} param — nombre del parámetro, ej: "id", "tema", "id1"
 * @returns {string|null} valor del parámetro o null si no existe
 *
 * @example
 * // URL: detalle-tirada.html?id=t042&tema=amor
 * getUrlParam('id');   // → "t042"
 * getUrlParam('tema'); // → "amor"
 * getUrlParam('foo');  // → null
 */
export function getUrlParam(param) {
  const params = new URLSearchParams(window.location.search);
  return params.get(param);
}

// ── RECOVERY — FASE 8A ──────────────────────────────────────────────────────

/**
 * Verifica si existe el estado necesario para renderizar una página concreta.
 * Debe llamarse al inicio del script de init de cada página, antes de cualquier render.
 * Si devuelve { ok: false }, el caller debe llamar navigateTo(check.redirectTo) inmediatamente.
 *
 * @param {'indicar-cartas'|'resultado'|'combinaciones'|'arcanos'|'detalle-combinacion'} paginaActual
 * @returns {{ ok: boolean, redirectTo: string|null, motivo: string }}
 *
 * @example
 * const check = verificarEstadoRecovery('resultado');
 * if (!check.ok) { navigateTo(check.redirectTo); return; }
 *
 * Reglas por página:
 *   "indicar-cartas"      → necesita getTiradaActual() != null
 *                           si null: redirect a tipos-lecturas.html (motivo: sin_tirada)
 *   "resultado"           → necesita getTiradaActual() != null Y tirada.cartas.length > 0
 *                           si null/expirada: redirect a introduccion.html (motivo: sin_tirada)
 *                           si cartas vacías: redirect a introduccion.html (motivo: sin_cartas)
 *   "combinaciones"       → siempre ok (punto de entrada independiente)
 *   "arcanos"             → siempre ok (punto de entrada independiente)
 *   "detalle-combinacion" → necesita params id1 e id2 en URL
 *                           si faltan: redirect a combinaciones.html (motivo: sin_params)
 */
export function verificarEstadoRecovery(paginaActual) {
  switch (paginaActual) {

    case 'indicar-cartas': {
      const tirada = getTiradaActual();
      if (!tirada) {
        return { ok: false, redirectTo: 'tipos-lecturas.html', motivo: 'sin_tirada' };
      }
      return { ok: true, redirectTo: null, motivo: '' };
    }

    case 'resultado': {
      const tirada = getTiradaActual();
      if (!tirada) {
        return { ok: false, redirectTo: 'introduccion.html', motivo: 'sin_tirada' };
      }
      if (!tirada.cartas || tirada.cartas.length === 0) {
        return { ok: false, redirectTo: 'introduccion.html', motivo: 'sin_cartas' };
      }
      return { ok: true, redirectTo: null, motivo: '' };
    }

    case 'combinaciones':
      return { ok: true, redirectTo: null, motivo: '' };

    case 'arcanos':
      return { ok: true, redirectTo: null, motivo: '' };

    case 'detalle-combinacion': {
      const id1 = getUrlParam('id1');
      const id2 = getUrlParam('id2');
      if (!id1 || !id2) {
        return { ok: false, redirectTo: 'combinaciones.html', motivo: 'sin_params' };
      }
      return { ok: true, redirectTo: null, motivo: '' };
    }

    default:
      return { ok: true, redirectTo: null, motivo: '' };
  }
}
