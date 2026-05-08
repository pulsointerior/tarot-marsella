/**
 * @file automatic.js
 * @description Lógica del modo automático en indicar-cartas.html.
 *   Coordina la precarga de datos, la inicialización del mazo visual
 *   y la ejecución del barajado/reparto. Actúa como puente entre data.js y animations.js.
 *
 * @dependencies
 *   - animations.js — inicializarMazo, ejecutarAnimacionCompleta, ANIMATION_LEVEL
 *   - data.js       — getCartas (para precarga garantizada antes de habilitar el botón)
 *
 * @exports inicializarModoAutomatico, barajarYRepartir
 */

import {
  inicializarMazo,
  ejecutarAnimacionCompleta,
  ANIMATION_LEVEL
} from './animations.js';

import { getCartas } from './data.js';

// ── ESTADO INTERNO DEL MÓDULO ─────────────────────────────────────────────────

/** Indica si cartas.json ya está en caché y el botón barajar puede habilitarse. */
let _datosListos = false;

// ── API PÚBLICA ───────────────────────────────────────────────────────────────

/**
 * Inicializa el modo automático de selección de cartas:
 *   1. Muestra el mazo visual de 78 capas CSS inmediatamente.
 *   2. Deshabilita el botón barajar con spinner mientras precarga cartas.json.
 *   3. Habilita el botón barajar solo cuando los datos están en caché de data.js.
 *
 * Si la precarga falla, el botón queda deshabilitado con mensaje de error.
 *
 * @param {HTMLElement} container    — elemento contenedor del mazo visual
 * @param {object}      tirada       — objeto tirada (se usa tirada.num_cartas)
 * @param {number}      mazo         — número de mazo seleccionado (1 | 2 | 3)
 * @param {HTMLElement} botonBarajar — botón que activará barajarYRepartir()
 * @returns {Promise<void>}
 */
export async function inicializarModoAutomatico(container, tirada, mazo, botonBarajar) {
  inicializarMazo(container, mazo ?? 1);

  _setBotonCargando(botonBarajar, true);
  _datosListos = false;

  try {
    await getCartas();
    _datosListos = true;
    _setBotonCargando(botonBarajar, false);
  } catch (err) {
    console.error('[automatic.js] Error al precargar cartas.json:', err);
    _setBotonError(botonBarajar);
  }
}

/**
 * Baraja el mazo y reparte N cartas con animación completa.
 * Añade el campo posicion (C1, C2, ..., Cn) a cada carta revelada.
 * Si los datos no están listos (precarga falló), aborta silenciosamente.
 *
 * @param {HTMLElement} container  — elemento contenedor del mazo visual
 * @param {object}      tirada     — objeto tirada (se usa tirada.num_cartas)
 * @param {Function}    onComplete — callback llamado al terminar la animación.
 *   Recibe: Array<{id: number, orientacion: string, posicion: string}>
 * @returns {Promise<void>}
 */
export async function barajarYRepartir(container, tirada, onComplete) {
  if (!_datosListos) {
    console.warn('[automatic.js] barajarYRepartir llamado antes de que los datos estén listos');
    return;
  }

  const numCartas = tirada.num_cartas ?? 1;

  await ejecutarAnimacionCompleta(container, numCartas, (cartasReveladas) => {
    const cartasArray = cartasReveladas.map((carta, i) => ({
      id:          carta.id,
      orientacion: carta.orientacion,
      posicion:    `C${i + 1}`
    }));
    onComplete(cartasArray);
  });
}

// ── HELPERS INTERNOS ──────────────────────────────────────────────────────────

/**
 * Pone el botón barajar en modo carga (spinner + texto) o lo habilita con el texto normal.
 * @param {HTMLElement} boton
 * @param {boolean}     cargando — true para mostrar spinner, false para habilitar
 */
function _setBotonCargando(boton, cargando) {
  if (!boton) return;
  if (cargando) {
    boton.disabled = true;
    boton.innerHTML = '<i class="ph ph-spinner"></i> Cargando...';
    boton.classList.add('btn-cargando');
    boton.classList.remove('btn-listo');
  } else {
    boton.disabled = false;
    boton.innerHTML = '<i class="ph ph-shuffle"></i> BARAJAR Y REPARTIR';
    boton.classList.remove('btn-cargando');
    boton.classList.add('btn-listo');
  }
}

/**
 * Pone el botón barajar en estado de error permanente (no recuperable sin recargar).
 * @param {HTMLElement} boton
 */
function _setBotonError(boton) {
  if (!boton) return;
  boton.disabled = true;
  boton.innerHTML = '<i class="ph ph-warning-circle"></i> Error al cargar datos';
  boton.classList.add('btn-error');
  boton.classList.remove('btn-cargando', 'btn-listo');
}
