/**
 * combinations.js — Lógica de combinaciones entre arcanos
 * "El Código de las Cartas" — Tarot de Marsella
 *
 * Responsabilidad: Reglas de negocio de combinaciones. NO hace fetch() directamente.
 * Importa buscarCombinacion() y getPosicionCombinacion() de data.js.
 *
 * Exports:
 *   getCombinacionDirecta(carta1, carta2)
 *   getTodosLosPares(cartasArray)
 *   buildBadgeTipoCombinacion(tipo)
 *   renderCombinacionCompleta(comb, carta1obj, carta2obj)
 *   renderFilaResumenCombinacion(carta1obj, carta2obj, combinacion, urlDetalle)
 */

import { buscarCombinacion, getPosicionCombinacion } from './data.js';

// ── HELPERS INTERNOS ─────────────────────────────────────────────────────────

/**
 * Ejecuta tareas en lotes para no saturar el event loop.
 * @param {Array<() => Promise>} tasks
 * @param {number} batchSize
 * @param {number} delayMs
 * @returns {Promise<Array>}
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

/**
 * Escapa caracteres HTML para evitar XSS.
 * @param {string} str
 * @returns {string}
 */
function _esc(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renderiza una fila .dato-item usando las clases del <style> inline
 * de detalle-combinacion.html. Devuelve '' si el valor está vacío.
 *
 * @param {string} label
 * @param {string} valor
 * @param {string} [htmlValor]  — HTML ya construido para el valor (ej: badge)
 * @returns {string}
 */
function _datoItem(label, valor, htmlValor = null) {
  const contenido = htmlValor !== null ? htmlValor : _esc(valor);
  if (!contenido && contenido !== '0') return '';
  return `
    <div class="dato-item">
      <span class="dato-label">${_esc(label)}</span>
      <span class="dato-valor">${contenido}</span>
    </div>`;
}

// ── EXPORTS PÚBLICOS ──────────────────────────────────────────────────────────

/**
 * Obtiene la combinación directa entre dos cartas.
 * @param {{ id: number, orientacion: string }} carta1
 * @param {{ id: number, orientacion: string }} carta2
 * @returns {Promise<object|null>}
 */
export async function getCombinacionDirecta(carta1, carta2) {
  const posicion = getPosicionCombinacion(carta1.orientacion, carta2.orientacion);
  return buscarCombinacion(carta1.id, carta2.id, posicion);
}

/**
 * Obtiene todos los pares direccionales (A+B ≠ B+A).
 * Para N cartas genera N×(N-1) pares con batching de 15.
 * @param {Array<{ id: number, orientacion: string }>} cartasArray
 * @returns {Promise<Array<{ carta1, carta2, combinacion }>>}
 */
export async function getTodosLosPares(cartasArray) {
  const pares = [];
  for (let i = 0; i < cartasArray.length; i++) {
    for (let j = 0; j < cartasArray.length; j++) {
      if (i !== j) pares.push({ carta1: cartasArray[i], carta2: cartasArray[j] });
    }
  }
  const tasks = pares.map(({ carta1, carta2 }) => async () => {
    const combinacion = await getCombinacionDirecta(carta1, carta2);
    return { carta1, carta2, combinacion };
  });
  return _runInBatches(tasks, 15, 0);
}

/**
 * Badge de tipo usando .badge-tipo + .badge-{tipo} de components.css
 * y los estilos inline de detalle-combinacion.html.
 * Tipos: RESONANCIA · SINERGIA · TENSION · NEUTRO · BLOQUEO · REFUERZO
 * @param {string} tipo
 * @returns {string}
 */
export function buildBadgeTipoCombinacion(tipo) {
  if (!tipo) return '';
  const clase = tipo.toLowerCase();
  return `<span class="badge-tipo badge-${clase}">${_esc(tipo)}</span>`;
}

/**
 * Renderiza la ficha completa de una combinación con TODOS los campos del JSON.
 *
 * Usa EXCLUSIVAMENTE clases ya definidas en el proyecto:
 *   - detalle-combinacion.html <style>: .datos-grid, .dato-item, .dato-label,
 *     .dato-valor, .badge-tipo, .badge-resonancia, .badge-sinergia, etc.
 *   - components.css: .cluster, .empty-state, .text-muted, .mt-2/3/4
 *
 * Campos renderizados:
 *   posicion          → subtítulo "Recta · Invertida" etc.
 *   tipo              → badge de color
 *   comb_si_no        → badge verde/rojo/gris
 *   estado_energia_1  → energía carta 1 (label = nombre de la carta)
 *   estado_energia_2  → energía carta 2
 *   dinamica          → dinámica de la combinación
 *   dominancia        → carta dominante
 *   interpretacion    → texto principal destacado
 *   comb_habilidad    → clave principal
 *   comb_momento      → momento clave
 *   comb_proximo_paso → siguiente paso
 *   comb_alerta       → advertencia con icono (solo si no vacío)
 *   id_carta_1/2      → referencia técnica discreta en footer
 *
 * @param {object|null} comb      — registro del JSON de combinaciones
 * @param {object}      carta1obj — objeto carta de cartas.json
 * @param {object}      carta2obj — objeto carta de cartas.json
 * @returns {string}  — HTML listo para inyectar en #panel-tab
 */
export function renderCombinacionCompleta(comb, carta1obj, carta2obj) {

  // ── Sin combinación ────────────────────────────────────────────────────────
  if (!comb) {
    return `
      <div class="empty-state mt-4">
        <i class="ph ph-cards" aria-hidden="true"></i>
        <p>Sin interpretación específica para esta posición.</p>
      </div>`;
  }

  const nombre1 = _esc(carta1obj?.arcano_es ?? `Arcano #${comb.id_carta_1}`);
  const nombre2 = _esc(carta2obj?.arcano_es ?? `Arcano #${comb.id_carta_2}`);

  const ETIQ_POS = {
    RR: 'Recta · Recta',
    RI: 'Recta · Invertida',
    IR: 'Invertida · Recta',
    II: 'Invertida · Invertida',
  };
  const etiqPos = _esc(ETIQ_POS[comb.posicion] ?? comb.posicion ?? '');

  // ── Badge SI/NO ────────────────────────────────────────────────────────────
  const badgeSiNo = (() => {
    if (!comb.comb_si_no) return '';
    const v = String(comb.comb_si_no).toLowerCase();
    let estilo;
    if (v === 'no') {
      estilo = 'color:#F44336; border-color:#F44336; background:rgba(244,67,54,0.1);';
    } else if (v.startsWith('sí') || v.startsWith('si')) {
      estilo = 'color:#4CAF50; border-color:#4CAF50; background:rgba(76,175,80,0.1);';
    } else {
      estilo = 'color:#9E9E9E; border-color:#9E9E9E; background:rgba(158,158,158,0.1);';
    }
    return `<span class="badge-tipo" style="${estilo}">${_esc(comb.comb_si_no)}</span>`;
  })();

  const badgeTipo = buildBadgeTipoCombinacion(comb.tipo);

  // ── HTML final — solo clases existentes ───────────────────────────────────
  return `
    <div style="padding-bottom: var(--space-4);">

      <!-- ① ENCABEZADO: título + posición + badges ───────────────────── -->
      <div style="padding-bottom:var(--space-3); margin-bottom:var(--space-3);
                  border-bottom:1px solid rgba(201,168,76,0.15);">
        <h2 style="font-family:'Cinzel',serif;
                   font-size:clamp(1rem,2.5vw,1.25rem);
                   font-weight:700;
                   color:var(--text-main);
                   margin:0 0 var(--space-1) 0;">
          ${nombre1} + ${nombre2}
        </h2>
        ${etiqPos
          ? `<p style="font-size:0.82rem; color:var(--text-muted);
                       margin:0 0 var(--space-2) 0; font-family:'Cinzel',serif;
                       letter-spacing:0.05em;">
               Posición: <strong style="color:var(--secondary);">${etiqPos}</strong>
             </p>`
          : ''}
        <div class="cluster" style="gap:var(--space-1);">
          ${badgeTipo}
          ${badgeSiNo}
        </div>
      </div>

      <!-- ② ESTADO DE ENERGÍA ─────────────────────────────────────────── -->
      ${(comb.estado_energia_1 || comb.estado_energia_2) ? `
      <div class="mt-3">
        <p style="margin-bottom:var(--space-1); font-family:'Cinzel',serif; font-size:0.8rem;
                  font-weight:700; letter-spacing:0.1em; text-transform:uppercase;
                  color:var(--secondary);">Estado de energía</p>
        <div class="datos-grid">
          ${_datoItem(nombre1, comb.estado_energia_1)}
          ${_datoItem(nombre2, comb.estado_energia_2)}
        </div>
      </div>` : ''}

      <!-- ③ DINÁMICA ───────────────────────────────────────────────────── -->
      ${(comb.dinamica || comb.dominancia) ? `
      <div class="mt-3">
        <p style="margin-bottom:var(--space-1); font-family:'Cinzel',serif; font-size:0.8rem;
                  font-weight:700; letter-spacing:0.1em; text-transform:uppercase;
                  color:var(--secondary);">Dinámica</p>
        <div class="datos-grid">
          ${_datoItem('Dinámica',   comb.dinamica)}
          ${_datoItem('Dominancia', comb.dominancia)}
        </div>
      </div>` : ''}

      <!-- ④ INTERPRETACIÓN ────────────────────────────────────────────── -->
      ${comb.interpretacion ? `
      <div class="mt-3"
           style="padding:var(--space-3);
                  background:rgba(201,168,76,0.04);
                  border-left:2px solid rgba(201,168,76,0.35);
                  border-radius:0 6px 6px 0;">
        <p style="margin-bottom:var(--space-1); font-family:'Cinzel',serif; font-size:0.8rem; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:var(--secondary);">Interpretación</p>
        <p style="color:var(--text-main); line-height:1.7; margin:0; font-size:0.95rem;">
          ${_esc(comb.interpretacion)}
        </p>
      </div>` : ''}

      <!-- ⑤ CLAVES DE ACCIÓN ───────────────────────────────────────────── -->
      ${(comb.comb_habilidad || comb.comb_momento || comb.comb_proximo_paso) ? `
      <div class="mt-3">
        <p style="margin-bottom:var(--space-1); font-family:'Cinzel',serif; font-size:0.8rem; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:var(--secondary);">Claves</p>
        <div class="datos-grid">
          ${_datoItem('Clave principal', comb.comb_habilidad)}
          ${_datoItem('Momento clave',   comb.comb_momento)}
          ${_datoItem('Siguiente paso',  comb.comb_proximo_paso)}
        </div>
      </div>` : ''}

      <!-- ⑥ ADVERTENCIA (solo si existe) ──────────────────────────────── -->
      ${comb.comb_alerta ? `
      <div class="mt-3"
           style="display:flex; align-items:flex-start; gap:var(--space-1);
                  padding:var(--space-2) var(--space-3);
                  background:rgba(244,67,54,0.06);
                  border:1px solid rgba(244,67,54,0.2);
                  border-radius:6px;">
        <i class="ph ph-warning-circle"
           style="color:#F44336; font-size:1.1rem; flex-shrink:0; margin-top:2px;"
           aria-hidden="true"></i>
        <div>
          <span class="dato-label" style="display:block; margin-bottom:2px;">Advertencia</span>
          <span style="color:var(--text-main); font-size:0.9rem; line-height:1.5;">
            ${_esc(comb.comb_alerta)}
          </span>
        </div>
      </div>` : ''}

      <!-- ⑦ REFERENCIA TÉCNICA (discreta) ─────────────────────────────── -->
      <p class="text-muted mt-4"
         style="font-size:0.72rem; text-align:right; opacity:0.4; font-family:'Source Sans 3',sans-serif;">
        #${_esc(String(comb.id_carta_1))} · #${_esc(String(comb.id_carta_2))} · ${_esc(comb.posicion)}
      </p>

    </div>`;
}

/**
 * Renderiza una fila de resumen para resultado.html con >2 cartas.
 * @param {object}      carta1obj
 * @param {object}      carta2obj
 * @param {object|null} combinacion
 * @param {string}      urlDetalle
 * @returns {string}
 */
export function renderFilaResumenCombinacion(carta1obj, carta2obj, combinacion, urlDetalle) {
  const nombre1 = _esc(carta1obj?.arcano_es ?? '—');
  const nombre2 = _esc(carta2obj?.arcano_es ?? '—');

  if (!combinacion) {
    return `
      <div class="dato-item" style="opacity:0.45; padding:var(--space-1) 0;">
        <span class="dato-label">${nombre1} × ${nombre2}</span>
        <span class="dato-valor" style="font-size:0.8rem;">Sin interpretación específica</span>
      </div>`;
  }

  const badgeTipo = buildBadgeTipoCombinacion(combinacion.tipo);

  return `
    <a href="${_esc(urlDetalle)}"
       style="display:grid; grid-template-columns:1fr auto 1fr auto;
              align-items:center; gap:var(--space-2);
              padding:var(--space-2) var(--space-2);
              border-radius:6px;
              border:1px solid rgba(201,168,76,0.1);
              background:rgba(201,168,76,0.03);
              text-decoration:none;
              transition:background 0.2s, border-color 0.2s;"
       onmouseover="this.style.background='rgba(201,168,76,0.08)';this.style.borderColor='rgba(201,168,76,0.25)';"
       onmouseout="this.style.background='rgba(201,168,76,0.03)';this.style.borderColor='rgba(201,168,76,0.1)';">
      <span style="color:var(--text-main); font-size:0.9rem;">${nombre1}</span>
      <span>${badgeTipo}</span>
      <span style="color:var(--text-main); font-size:0.9rem; text-align:right;">${nombre2}</span>
      <i class="ph ph-arrow-right" style="color:var(--text-muted);" aria-hidden="true"></i>
    </a>`;
}
