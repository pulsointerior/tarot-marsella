/**
 * @file images.js
 * @description Resolución de rutas de imágenes de cartas y renderizado con fallback.
 *   Gestiona la construcción de URLs, la verificación de existencia y el fallback
 *   automático a placeholders CSS cuando las imágenes no están disponibles.
 *
 * @architecture
 *   Todas las carpetas de mazos están vacías en el estado actual del proyecto.
 *   getUrlImagen() devuelve null por defecto → el caller usa placeholder CSS.
 *   Cuando las imágenes estén disponibles, solo hay que modificar getUrlImagen().
 *   Ningún otro archivo necesita cambiarse.
 *
 * @dependencies
 *   Ninguna (leaf module, no importa otros módulos del proyecto)
 *
 * @exports VARIANTES, buildRutaImagen, getUrlImagen, imagenExiste,
 *          aplicarFallbackImagen, renderImagenConFallback, nombreASlug, precargarImagenes
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Variantes disponibles con sus dimensiones canónicas y calidad JPEG.
 * @type {Readonly<{icon: object, thumb: object, medium: object, full: object}>}
 */
export const VARIANTES = Object.freeze({
  icon:   { ancho: 60,  alto: 94,   calidad: 80 },
  thumb:  { ancho: 150, alto: 235,  calidad: 80 },
  medium: { ancho: 200, alto: 314,  calidad: 85 },
  full:   { ancho: 816, alto: 1280, calidad: 90 },
});

const BASE_PATH = 'assets/images';

// Caché de existencia de imágenes (evita peticiones HEAD repetidas)
const _existenciaCache = new Map();

// ─────────────────────────────────────────────────────────────────────────────
// API PÚBLICA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve la ruta canónica de imagen para un slug, variante y mazo.
 * NO verifica si el archivo existe — solo construye la ruta.
 * Para obtener la URL verificada, usar getUrlImagen().
 *
 * @param {string} slug     — campo slug de cartas.json, ej: "le-bateleur"
 * @param {string} variante — 'icon' | 'thumb' | 'medium' | 'full'
 * @param {string|number} mazoId — "1" | "2" | "3" o 1, 2, 3
 * @returns {string} ruta relativa, ej: "assets/images/mazo-1/le-bateleur-thumb.jpg"
 */
export function buildRutaImagen(slug, variante, mazoId) {
  return `${BASE_PATH}/mazo-${mazoId}/${slug}-${variante}.jpg`;
}

/**
 * Devuelve la ruta de imagen si está disponible, o null si no.
 * Actualmente todas las carpetas de mazos están vacías → siempre devuelve null.
 * Esto activa el fallback automático a placeholder CSS en todos los módulos.
 *
 * TODO — cuando las imágenes reales estén disponibles:
 *   Opción A (simple): eliminar el return null y devolver buildRutaImagen().
 *     El onerror del <img> activará el placeholder si algún archivo falta.
 *   Opción B (verificado): llamar a imagenExiste() antes de devolver la ruta.
 *
 * @param {string} slug
 * @param {string} variante — 'icon' | 'thumb' | 'medium' | 'full'
 * @param {string|number} mazoId
 * @returns {string|null} ruta si disponible, null si no
 */
export function getUrlImagen(slug, variante, mazoId) {
  /* TODO — por ahora retorna null para que el llamador use placeholder CSS */
  return null;
}

/**
 * Verifica de forma asíncrona si una imagen existe en el servidor.
 * Usa fetch HEAD para no descargar la imagen completa.
 * Los resultados se cachean por ruta para no repetir peticiones.
 *
 * @param {string} ruta — ruta relativa, ej: "assets/images/mazo-1/le-bateleur-thumb.jpg"
 * @returns {Promise<boolean>} true si la imagen existe y es accesible
 */
export async function imagenExiste(ruta) {
  if (_existenciaCache.has(ruta)) {
    return _existenciaCache.get(ruta);
  }
  try {
    const res = await fetch(ruta, { method: 'HEAD' });
    const existe = res.ok;
    _existenciaCache.set(ruta, existe);
    return existe;
  } catch {
    _existenciaCache.set(ruta, false);
    return false;
  }
}

/**
 * Asigna el handler onerror a un elemento <img> para que, si falla la carga,
 * oculte la imagen y muestre el elemento hermano siguiente (placeholder CSS).
 *
 * Patrón esperado en el DOM:
 *   <img src="..." >  ← aplicarFallbackImagen(img)
 *   <div class="placeholder-carta-thumb mazo-1" ...></div>
 *
 * @param {HTMLImageElement} imgElement — el elemento <img> al que aplicar el handler
 */
export function aplicarFallbackImagen(imgElement) {
  imgElement.onerror = function () {
    this.style.display = 'none';
    const siguiente = this.nextElementSibling;
    if (siguiente) siguiente.style.display = 'block';
  };
}

/**
 * Renderiza una imagen de carta con fallback automático a placeholder CSS.
 * Si getUrlImagen() devuelve null, genera directamente el placeholder sin <img>.
 * Si devuelve una URL, genera un <img> con onerror que activa el placeholder.
 *
 * @param {object} carta          — objeto de cartas.json (necesita slug, arcano_es, numero_original)
 * @param {string|number} mazoId  — "1" | "2" | "3"
 * @param {string} variante       — 'icon' | 'thumb' | 'medium' | 'full'
 * @param {string} [claseAdicional=''] — clases CSS extra para el div wrapper
 * @returns {string} HTML del wrapper con imagen o placeholder
 */
export function renderImagenConFallback(carta, mazoId, variante, claseAdicional = '') {
  const slug   = carta.slug;
  const nombre = carta.arcano_es;
  const numero = carta.numero_original !== null && carta.numero_original !== undefined
    ? carta.numero_original : '';
  const mazoClass        = `mazo-${mazoId}`;
  const placeholderClass = `placeholder-carta-${variante} ${mazoClass}`;
  const wrapperClass     = claseAdicional ? `carta-imagen-render ${claseAdicional}` : 'carta-imagen-render';

  const url = getUrlImagen(slug, variante, mazoId);

  if (!url) {
    return `
      <div class="${wrapperClass}">
        <div class="${placeholderClass}"
             data-numero="${numero}"
             data-nombre="${nombre}"
             aria-label="${nombre}">
        </div>
      </div>`;
  }

  return `
    <div class="${wrapperClass}">
      <img
        src="${url}"
        alt="${nombre}"
        loading="lazy"
        onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
      >
      <div class="${placeholderClass}"
           data-numero="${numero}"
           data-nombre="${nombre}"
           style="display:none;"
           aria-hidden="true">
      </div>
    </div>`;
}

/**
 * Construye el slug de una carta desde su nombre canónico.
 * Normaliza diacríticos, elimina caracteres especiales y reemplaza espacios por guiones.
 *
 * @param {string} nombre — nombre de la carta, ej: "Le Bateleur", "AS DE BÂTONS"
 * @returns {string} slug, ej: "le-bateleur", "as-de-batons"
 *
 * @example
 * nombreASlug('AS DE BÂTONS'); // → "as-de-batons"
 */
export function nombreASlug(nombre) {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Pre-carga un lote de imágenes en el caché del navegador.
 * Usa Promise.allSettled para ignorar errores silenciosamente.
 * Útil para pre-cargar las thumbs del mazo antes de la selección de cartas.
 *
 * @param {Array<string>} rutas — array de rutas relativas a pre-cargar
 * @returns {Promise<void>}
 */
export async function precargarImagenes(rutas) {
  if (!rutas || rutas.length === 0) return;
  await Promise.allSettled(
    rutas.map(ruta => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload  = resolve;
        img.onerror = resolve;
        img.src = ruta;
      });
    })
  );
}
