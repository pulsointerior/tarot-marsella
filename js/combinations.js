/**
 * @file combinations.js
 * @description Lógica de combinaciones semánticas entre cartas.
 *   Obtiene combinaciones via data.js, genera pares direccionales con batching
 *   controlado y renderiza badges y HTML completo de combinaciones.
 *
 * @dependencies
 *   - data.js — buscarCombinacion(), getPosicionCombinacion()
 *
 * @architecture
 *   buscarCombinacion() existe SOLO en data.js.
 *   Este módulo la importa y llama — NUNCA la reimplementa.
 *   Las combinaciones son direccionales: A+B ≠ B+A.
 *   Para N cartas se generan N×(N-1) pares, procesados en lotes de 15.
 *
 * @exports TIPOS_COMBINACION, getCombinacionDirecta, getTodosLosPares,
 *          clasePorTipo, buildBadgeTipoCombinacion, renderCombinacionCompleta,
 *          renderFilaResumenCombinacion
 */

import { buscarCombinacion, getPosicionCombinacion } from './data.js';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS Y CLASES CSS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enum de tipos de combinación válidos (espejo del campo tipo en los JSON).
 * @type {Readonly<object>}
 */
export const TIPOS_COMBINACION = Object.freeze({
  RESONANCIA: 'RESONANCIA',
  SINERGIA:   'SINERGIA',
  TENSION:    'TENSION',
  NEUTRO:     'NEUTRO',
  BLOQUEO:    'BLOQUEO',
  REFUERZO:   'REFUERZO',
});

const _CLASE_TIPO = {
  RESONANCIA: 'badge-resonancia',
  SINERGIA:   'badge-sinergia',
  TENSION:    'badge-tension',
  NEUTRO:     'badge-neutro',
  BLOQUEO:    'badge-bloqueo',
  REFUERZO:   'badge-refuerzo',
};

// ─────────────────────────────────────────────────────────────────────────────
// BATCHING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ejecuta un array de funciones async en lotes de batchSize para no saturar el event loop.
 * Una tirada de 12 cartas genera 132 pares — no lanzar todos simultáneamente.
 *
 * @param {Array<() => Promise>} tasks — funciones que devuelven Promise
 * @param {number} batchSize — tamaño de lote (default 15)
 * @param {number} delayMs   — espera entre lotes en ms (default 0)
 * @returns {Promise<Array>} resultados en el mismo orden que tasks
 */
async function _runInBatches(tasks, batchSize = 15, delayMs = 0) {
  const results = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn => fn()));
    results.push(...batchResults);
    if (delayMs > 0 && i + batchSize < tasks.length) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// API PÚBLICA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Busca la combinación directa entre dos cartas en la posición calculada
 * a partir de sus orientaciones. Delega en data.js para el acceso al JSON.
 *
 * @param {{id: number, orientacion: string}} carta1
 * @param {{id: number, orientacion: string}} carta2
 * @returns {Promise<object|null>} objeto combinación o null si no existe
 */
export async function getCombinacionDirecta(carta1, carta2) {
  const pos = getPosicionCombinacion(carta1.orientacion, carta2.orientacion);
  return buscarCombinacion(carta1.id, carta2.id, pos);
}

/**
 * Genera TODOS los pares direccionales de un array de cartas y busca su combinación.
 * Las combinaciones son direccionales: para N cartas genera N×(N-1) pares.
 * Usa batching de 15 para no saturar el event loop en tiradas grandes.
 *
 * @param {Array<{id: number, orientacion: string}>} cartasArray
 * @returns {Promise<Array<{carta1: object, carta2: object, combinacion: object|null}>>}
 *   Array con todos los pares; el campo combinacion es null si no existe en los JSON.
 */
export async function getTodosLosPares(cartasArray) {
  const tareas = [];

  for (let i = 0; i < cartasArray.length; i++) {
    for (let j = 0; j < cartasArray.length; j++) {
      if (i === j) continue;
      const c1 = cartasArray[i];
      const c2 = cartasArray[j];
      tareas.push(() =>
        getCombinacionDirecta(c1, c2).then(combinacion => ({
          carta1: c1,
          carta2: c2,
          combinacion,
        }))
      );
    }
  }

  return _runInBatches(tareas, 15, 0);
}

/**
 * Devuelve la clase CSS del badge según el tipo de combinación.
 * Si el tipo no existe en el mapa, devuelve 'badge-neutro' como fallback.
 *
 * @param {string} tipo — "RESONANCIA" | "SINERGIA" | "TENSION" | "NEUTRO" | "BLOQUEO" | "REFUERZO"
 * @returns {string} clase CSS
 */
export function clasePorTipo(tipo) {
  return _CLASE_TIPO[tipo] || 'badge-neutro';
}

/**
 * Genera el HTML del badge de tipo de combinación.
 *
 * @param {string} tipo — "RESONANCIA" | "SINERGIA" | "TENSION" | "NEUTRO" | "BLOQUEO" | "REFUERZO"
 * @returns {string} HTML del badge
 */
export function buildBadgeTipoCombinacion(tipo) {
  const clase = clasePorTipo(tipo);
  const label = tipo || 'NEUTRO';
  return `<span class="badge-tipo ${clase}">${label}</span>`;
}

/**
 * Renderiza el HTML completo de una combinación con todos sus campos del JSON.
 * Si comb es null, muestra un mensaje de "sin interpretación específica".
 *
 * @param {object|null} comb      — objeto combinación de los JSON (o null)
 * @param {object}      carta1obj — objeto carta completo de cartas.json
 * @param {object}      carta2obj — objeto carta completo de cartas.json
 * @returns {string} HTML
 */
export function renderCombinacionCompleta(comb, carta1obj, carta2obj) {
  if (!comb) {
    return `
      <div class="combinacion-sin-dato text-muted center-content" style="padding: var(--space-4);">
        <i class="ph ph-question" style="font-size:2rem; opacity:0.4;"></i>
        <p>Sin interpretación específica para este par en esta posición.</p>
      </div>`;
  }

  const badge    = buildBadgeTipoCombinacion(comb.tipo);
  const badgeSiNo = comb.comb_si_no
    ? `<span class="badge-tipo" style="background:rgba(201,168,76,0.1); border-color:var(--secondary); color:var(--secondary);">${comb.comb_si_no}</span>`
    : '';

  // ── Bloque 1: Cabecera — título + badges ──────────────────────────────────
  const cabecera = `
    <div class="comb-cabecera" style="margin-bottom:var(--space-3);">
      <h3 style="margin:0 0 var(--space-2) 0; font-family:'Cinzel',serif; color:var(--secondary); font-size:1.1rem;">
        ${carta1obj.arcano_es} <span style="opacity:0.5; font-size:0.9em;">+</span> ${carta2obj.arcano_es}
      </h3>
      <div style="display:flex; flex-wrap:wrap; gap:var(--space-1);">
        ${badge}
        ${badgeSiNo}
      </div>
    </div>`;

  // ── Bloque 2: Energías — cards lado a lado ────────────────────────────────
  const energias = (comb.estado_energia_1 || comb.estado_energia_2) ? `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-2); margin-bottom:var(--space-3);">
      <div class="comb-card-campo" style="background:rgba(201,168,76,0.06); border:1px solid rgba(201,168,76,0.15); border-radius:8px; padding:var(--space-2);">
        <div class="dato-label" style="margin-bottom:4px;">${carta1obj.arcano_es}</div>
        <div style="font-size:0.95rem; color:var(--text-main); font-weight:600;">${comb.estado_energia_1 || '—'}</div>
      </div>
      <div class="comb-card-campo" style="background:rgba(201,168,76,0.06); border:1px solid rgba(201,168,76,0.15); border-radius:8px; padding:var(--space-2);">
        <div class="dato-label" style="margin-bottom:4px;">${carta2obj.arcano_es}</div>
        <div style="font-size:0.95rem; color:var(--text-main); font-weight:600;">${comb.estado_energia_2 || '—'}</div>
      </div>
    </div>` : '';

  // ── Bloque 3: Interpretación — texto principal ────────────────────────────
  const interpretacion = comb.interpretacion ? `
    <div style="margin-bottom:var(--space-3); padding:var(--space-3); background:rgba(255,255,255,0.03); border-left:2px solid var(--secondary); border-radius:0 6px 6px 0; line-height:1.7;">
      <p style="margin:0;">${comb.interpretacion}</p>
    </div>` : '';

  // ── Bloque 4: Cards de campos secundarios ────────────────────────────────
  const camposSecundarios = [
    { label: 'Dinámica',       valor: comb.dinamica },
    { label: 'Dominancia',     valor: comb.dominancia },
    { label: 'Momento clave',  valor: comb.comb_momento },
    { label: 'Habilidad clave',valor: comb.comb_habilidad },
  ].filter(c => c.valor);

  const gridSecundario = camposSecundarios.length > 0 ? `
    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:var(--space-2); margin-bottom:var(--space-3);">
      ${camposSecundarios.map(c => `
        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:var(--space-2);">
          <div class="dato-label" style="margin-bottom:4px;">${c.label}</div>
          <div style="font-size:0.9rem; color:var(--text-main);">${c.valor}</div>
        </div>`).join('')}
    </div>` : '';

  // ── Bloque 5: Siguiente paso — destacado ─────────────────────────────────
  const proximoPaso = comb.comb_proximo_paso ? `
    <div style="display:flex; align-items:flex-start; gap:var(--space-2); margin-bottom:var(--space-2); padding:var(--space-2) var(--space-3); background:rgba(201,168,76,0.08); border-radius:8px;">
      <i class="ph ph-arrow-circle-right" style="color:var(--secondary); font-size:1.1rem; flex-shrink:0; margin-top:2px;" aria-hidden="true"></i>
      <div>
        <div class="dato-label" style="margin-bottom:2px;">Siguiente paso</div>
        <div style="color:var(--text-main);">${comb.comb_proximo_paso}</div>
      </div>
    </div>` : '';

  // ── Bloque 6: Advertencia — solo si existe ────────────────────────────────
  const alerta = comb.comb_alerta ? `
    <div style="display:flex; align-items:flex-start; gap:var(--space-2); padding:var(--space-2) var(--space-3); background:rgba(244,67,54,0.08); border:1px solid rgba(244,67,54,0.2); border-radius:8px;">
      <i class="ph ph-warning-circle" style="color:#F44336; font-size:1.1rem; flex-shrink:0; margin-top:2px;" aria-hidden="true"></i>
      <div>
        <div class="dato-label" style="margin-bottom:2px; color:#F44336;">Advertencia</div>
        <div style="color:var(--text-main);">${comb.comb_alerta}</div>
      </div>
    </div>` : '';

  return `
    <div class="combinacion-completa">
      ${cabecera}
      ${energias}
      ${interpretacion}
      ${gridSecundario}
      ${proximoPaso}
      ${alerta}
    </div>`;
}

/**
 * Genera una fila resumen de combinación para la vista de resultado (>2 cartas).
 * Muestra: nombre carta1 · badge tipo · nombre carta2 · enlace a detalle.
 *
 * @param {object}      carta1obj   — objeto carta completo de cartas.json
 * @param {object}      carta2obj   — objeto carta completo de cartas.json
 * @param {object|null} combinacion — objeto combinación o null
 * @param {string|null} [urlDetalle] — URL para enlace al detalle, o null si no aplica
 * @returns {string} HTML
 */
export function renderFilaResumenCombinacion(carta1obj, carta2obj, combinacion, urlDetalle) {
  const badge = combinacion
    ? buildBadgeTipoCombinacion(combinacion.tipo)
    : `<span class="text-muted" style="font-size:0.8rem;">Sin interpretación específica</span>`;

  const enlace = urlDetalle
    ? `<a href="${urlDetalle}" class="comb-enlace-detalle" aria-label="Ver detalle">
         <i class="ph ph-arrow-right"></i>
       </a>`
    : '';

  return `
    <div class="comb-fila-resumen cluster" style="gap:var(--space-2); align-items:center; padding:var(--space-2) 0; border-bottom:1px solid rgba(201,168,76,0.08);">
      <span class="comb-carta-nombre" style="font-size:0.85rem; color:var(--text-main); min-width:120px;">${carta1obj.arcano_es}</span>
      ${badge}
      <span class="comb-carta-nombre" style="font-size:0.85rem; color:var(--text-main); min-width:120px;">${carta2obj.arcano_es}</span>
      ${enlace}
    </div>`;
}
