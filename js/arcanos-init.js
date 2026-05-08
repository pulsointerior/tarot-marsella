// arcanos-init.js — Punto de entrada de arcanos.html (v26)
//
// Responsabilidad:
//   · Cargar las 78 cartas desde data.js
//   · Renderizar galería por secciones: Mayores / Bastos / Coupes / Épées / Deniers
//   · Buscador en tiempo real
//   · Selector de mazo
//   · Modal de detalle al hacer clic

import { getCartas } from './data.js';
import { renderThumbnailCarta, abrirModal } from './cards.js';
import { getUrlParam, navigateTo } from './navigation.js';

// ─────────────────────────────────────────────────────────────────────────────
// SECCIONES
// ─────────────────────────────────────────────────────────────────────────────

const SECCIONES = [
  {
    id:        'mayores',
    titulo:    'Arcanos Mayores',
    subtitulo: 'Los 22 arcanos que representan arquetipos universales',
    filtro:    c => c.tipo === 'arcano_mayor',
  },
  {
    id:        'bastos',
    titulo:    'Bastos',
    subtitulo: 'Fuego · Acción, voluntad e iniciativa',
    filtro:    c => c.palo === 'BÂTONS',
  },
  {
    id:        'coupes',
    titulo:    'Coupes',
    subtitulo: 'Agua · Emoción, intuición y vínculos',
    filtro:    c => c.palo === 'COUPES',
  },
  {
    id:        'epees',
    titulo:    'Épées',
    subtitulo: 'Aire · Verdad, conflicto y discernimiento',
    filtro:    c => c.palo === 'ÉPÉES',
  },
  {
    id:        'deniers',
    titulo:    'Deniers',
    subtitulo: 'Tierra · Materia, trabajo y seguridad',
    filtro:    c => c.palo === 'DENIERS',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO
// ─────────────────────────────────────────────────────────────────────────────

let _todasLasCartas = [];
let _mazo = parseInt(localStorage.getItem('mazo_seleccionado') || '1', 10);
let _terminoBusqueda = '';

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZAR — para búsqueda sin acentos
// ─────────────────────────────────────────────────────────────────────────────

function _normalizar(str) {
  return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function _cartaMatchBusqueda(carta) {
  if (!_terminoBusqueda) return true;
  const t = _terminoBusqueda;
  return _normalizar(carta.arcano_es).includes(t)
    || _normalizar(String(carta.numero_original || '')).includes(t)
    || _normalizar(carta.palabras_clave_recta || '').includes(t);
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER — GALERÍA POR SECCIONES
// ─────────────────────────────────────────────────────────────────────────────

function _renderGaleria() {
  const grid = document.getElementById('grid-arcanos');
  if (!grid) return;

  let html = '';
  let totalVisibles = 0;

  for (const seccion of SECCIONES) {
    const cartas = _todasLasCartas.filter(seccion.filtro).filter(_cartaMatchBusqueda);

    if (cartas.length === 0) continue; // ocultar sección si no hay resultados

    totalVisibles += cartas.length;

    html += `
      <section class="arcanos-seccion" id="sec-${seccion.id}" aria-label="${seccion.titulo}">
        <div class="arcanos-seccion-header">
          <h2 class="arcanos-seccion-titulo">${seccion.titulo}</h2>
          <p class="arcanos-seccion-subtitulo text-muted">${seccion.subtitulo}</p>
        </div>
        <div class="arcanos-grid">
          ${cartas.map(carta => renderThumbnailCarta(carta, _mazo)).join('')}
        </div>
      </section>`;
  }

  if (totalVisibles === 0) {
    html = `
      <div class="center-content" style="padding:var(--space-6); width:100%;">
        <i class="ph ph-magnifying-glass" style="font-size:2.5rem; opacity:0.3;" aria-hidden="true"></i>
        <p class="text-muted" style="margin-top:var(--space-2);">No se encontraron cartas para "<strong>${_terminoBusqueda}</strong>"</p>
      </div>`;
  }

  grid.innerHTML = html;

  // Contador de resultados en buscador
  const contador = document.getElementById('buscador-contador');
  if (contador) {
    contador.textContent = _terminoBusqueda
      ? `${totalVisibles} carta${totalVisibles !== 1 ? 's' : ''} encontrada${totalVisibles !== 1 ? 's' : ''}`
      : '';
  }

  // Eventos de clic en cartas
  grid.querySelectorAll('.carta-thumbnail-wrapper').forEach(wrapper => {
    const handler = () => {
      const id = parseInt(wrapper.dataset.id, 10);
      if (id) abrirModal(id, _todasLasCartas, _mazo);
    };
    wrapper.addEventListener('click', handler);
    wrapper.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER — CONTROLES (buscador + mazo + botón volver)
// ─────────────────────────────────────────────────────────────────────────────

function _renderControles() {
  const cont = document.getElementById('controles-arcanos');
  if (!cont) return;

  const desde = getUrlParam('desde');

  cont.innerHTML = `
    <div class="arcanos-controles-wrapper">
      <div class="buscador-arcanos-wrapper">
        <i class="ph ph-magnifying-glass buscador-icono" aria-hidden="true"></i>
        <input
          type="text"
          id="buscador-arcanos"
          class="buscador-input"
          placeholder="Buscar carta por nombre, número o palabra clave..."
          autocomplete="off"
          aria-label="Buscar carta"
        />
        <button id="buscador-arcanos-limpiar" class="buscador-btn-limpiar" type="button" aria-label="Limpiar búsqueda" style="display:none;">
          <i class="ph ph-x" aria-hidden="true"></i>
        </button>
      </div>
      <span id="buscador-contador" class="text-muted" style="font-size:0.85rem;"></span>
      <select class="select-mazo" id="selector-mazo" aria-label="Seleccionar mazo">
        <option value="1"${_mazo === 1 ? ' selected' : ''}>Mazo 1 — Clásico</option>
        <option value="2"${_mazo === 2 ? ' selected' : ''}>Mazo 2 — Art Nouveau</option>
        <option value="3"${_mazo === 3 ? ' selected' : ''}>Mazo 3 — Impasto</option>
      </select>
      ${desde === 'resultado' ? `
        <button class="btn btn-secondary btn-sm" id="btn-volver-resultado">
          <i class="ph ph-arrow-left" aria-hidden="true"></i> Volver al resultado
        </button>` : ''}
      <a href="index.html" class="btn btn-secondary btn-sm">
        <i class="ph ph-house" aria-hidden="true"></i> Inicio
      </a>
    </div>`;

  // Buscador
  const input   = document.getElementById('buscador-arcanos');
  const limpiar = document.getElementById('buscador-arcanos-limpiar');

  input?.addEventListener('input', () => {
    _terminoBusqueda = _normalizar(input.value.trim());
    limpiar.style.display = input.value ? 'flex' : 'none';
    _renderGaleria();
  });

  limpiar?.addEventListener('click', () => {
    input.value = '';
    _terminoBusqueda = '';
    limpiar.style.display = 'none';
    _renderGaleria();
    input.focus();
  });

  // Mazo
  document.getElementById('selector-mazo')?.addEventListener('change', e => {
    _mazo = parseInt(e.target.value, 10);
    localStorage.setItem('mazo_seleccionado', String(_mazo));
    _renderGaleria();
  });

  // Volver resultado
  document.getElementById('btn-volver-resultado')?.addEventListener('click', () => {
    navigateTo('resultado.html');
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────

async function init() {
  clearTimeout(window.__arcanos_init_watchdog);

  const grid = document.getElementById('grid-arcanos');
  if (grid) {
    grid.innerHTML = `
      <div class="center-content" style="padding:var(--space-6); width:100%;">
        <i class="ph ph-spinner" style="font-size:2rem; color:var(--secondary); animation:spin 1s linear infinite;" aria-hidden="true"></i>
        <p class="text-muted" style="margin-top:var(--space-2);">Cargando arcanos…</p>
      </div>`;
  }

  try {
    _todasLasCartas = await getCartas();
  } catch (err) {
    console.error('[arcanos-init.js] Error:', err);
    if (grid) {
      grid.innerHTML = `<p class="text-muted" style="text-align:center; padding:var(--space-4);">Error al cargar las cartas.</p>`;
    }
    return;
  }

  _renderControles();
  _renderGaleria();

  // Limpiar tabs de palos (ya no se usan)
  const tabsPalos = document.getElementById('tabs-palos');
  if (tabsPalos) tabsPalos.innerHTML = '';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
