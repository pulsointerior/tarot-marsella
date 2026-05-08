#!/usr/bin/env python3
"""
corregir_datos.py
Corrige los errores detectados en la auditoría de Fase 1.
Hace backup de cada archivo antes de modificarlo.
Ejecutar desde la raíz del proyecto:
  python scripts/corregir_datos.py

NUNCA inventa valores. Solo corrige lo que tiene equivalente claro.
"""

import json
import shutil
from pathlib import Path
from collections import defaultdict

RESET  = "\033[0m"
VERDE  = "\033[92m"
ROJO   = "\033[91m"
AMARILLO = "\033[93m"
NEGRITA = "\033[1m"

def ok(msg):   print(f"   \033[92m✓\033[0m {msg}")
def err(msg):  print(f"   \033[91m✗\033[0m {msg}")
def warn(msg): print(f"   \033[93m⚠\033[0m {msg}")
def info(msg): print(f"   → {msg}")

def backup(ruta):
    src = Path(ruta)
    dst = Path(str(ruta) + ".backup")
    if not dst.exists():
        shutil.copy2(src, dst)
        info(f"Backup creado: {dst.name}")
    else:
        info(f"Backup ya existe: {dst.name} (no se sobreescribe)")

def cargar(ruta):
    with open(ruta, encoding="utf-8") as f:
        return json.load(f)

def guardar(ruta, datos):
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, indent=2)

def guardar_chunk(ruta, datos):
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, separators=(",", ":"))

# ══════════════════════════════════════════════════════════════
# 1. cartas.json — corregir campo "tipo"
#    "ARCANO MAYOR" → "arcano_mayor"
#    "ARCANO MENOR" → "arcano_menor"
# ══════════════════════════════════════════════════════════════
def corregir_cartas():
    ruta = "data/cartas.json"
    print(f"\n{NEGRITA}{'─'*60}{RESET}")
    print(f"{NEGRITA}► Corrigiendo {ruta}{RESET}")

    if not Path(ruta).exists():
        err(f"Archivo no encontrado: {ruta}"); return

    backup(ruta)
    datos = cargar(ruta)
    MAPA_TIPO = {
        "ARCANO MAYOR": "arcano_mayor",
        "ARCANO MENOR": "arcano_menor",
        "Arcano Mayor": "arcano_mayor",
        "Arcano Menor": "arcano_menor",
    }
    n = 0
    for r in datos:
        tipo_orig = r.get("tipo", "")
        if tipo_orig in MAPA_TIPO:
            r["tipo"] = MAPA_TIPO[tipo_orig]
            n += 1

    guardar(ruta, datos)
    ok(f"Campo 'tipo' corregido en {n} registros")

# ══════════════════════════════════════════════════════════════
# 2. tiradas.json — corregir campo "tema"
#    nombres largos → enum canónico
# ══════════════════════════════════════════════════════════════
def corregir_tiradas():
    ruta = "data/tiradas.json"
    print(f"\n{NEGRITA}{'─'*60}{RESET}")
    print(f"{NEGRITA}► Corrigiendo {ruta}{RESET}")

    if not Path(ruta).exists():
        err(f"Archivo no encontrado: {ruta}"); return

    backup(ruta)
    datos = cargar(ruta)

    MAPA_TEMA = {
        "consultas_generales":      "general",
        "creatividad_proyectos":    "creatividad",
        "decisiones_elecciones":    "decisiones",
        "espiritualidad_crecimiento": "espiritualidad",
        "salud_bienestar":          "salud",
        "trabajo_dinero":           "finanzas_trabajo",
    }

    n_tema = 0
    n_num = 0
    num_invalidos = []

    for r in datos:
        tema_orig = r.get("tema", "")
        if tema_orig in MAPA_TEMA:
            r["tema"] = MAPA_TEMA[tema_orig]
            n_tema += 1

        nc = r.get("num_cartas")
        if nc == 8:
            warn(f"t019 num_cartas=8 — NO se corrige automáticamente (requiere revisión manual)")
            num_invalidos.append(r.get("id_tirada","?"))
            n_num += 1

    guardar(ruta, datos)
    ok(f"Campo 'tema' corregido en {n_tema} registros")
    if num_invalidos:
        warn(f"num_cartas=8 en tiradas {num_invalidos} — corregir manualmente en data/tiradas.json")

# ══════════════════════════════════════════════════════════════
# 3. posiciones.json — reportar tiradas con N incorrecto
#    No se corrige automáticamente (requiere saber qué posiciones faltan)
# ══════════════════════════════════════════════════════════════
def revisar_posiciones():
    ruta_pos = "data/posiciones.json"
    ruta_tir = "data/tiradas.json"
    print(f"\n{NEGRITA}{'─'*60}{RESET}")
    print(f"{NEGRITA}► Revisando {ruta_pos}{RESET}")

    if not Path(ruta_pos).exists() or not Path(ruta_tir).exists():
        err("Archivos no encontrados"); return

    tiradas = cargar(ruta_tir)
    posiciones = cargar(ruta_pos)

    num_cartas_por_tirada = {r["id_tirada"]: r["num_cartas"] for r in tiradas}
    conteo = defaultdict(int)
    for r in posiciones:
        conteo[r.get("id_tirada")] += 1

    problemas = []
    for id_tirada, n_esp in num_cartas_por_tirada.items():
        n_real = conteo.get(id_tirada, 0)
        if n_real != n_esp:
            problemas.append((id_tirada, n_real, n_esp))

    if problemas:
        warn(f"Las siguientes tiradas tienen posiciones incorrectas — CORREGIR MANUALMENTE:")
        for id_t, n_r, n_e in problemas:
            warn(f"  {id_t}: tiene {n_r} posiciones, necesita {n_e}")
        warn("Abre data/posiciones.json y añade/elimina las posiciones que faltan.")
    else:
        ok("Todas las tiradas tienen el número correcto de posiciones")

# ══════════════════════════════════════════════════════════════
# 4. sinonimos.json — eliminar registros con categoria vacía
# ══════════════════════════════════════════════════════════════
def corregir_sinonimos():
    ruta = "data/sinonimos.json"
    print(f"\n{NEGRITA}{'─'*60}{RESET}")
    print(f"{NEGRITA}► Corrigiendo {ruta}{RESET}")

    if not Path(ruta).exists():
        err(f"Archivo no encontrado: {ruta}"); return

    backup(ruta)
    datos = cargar(ruta)
    total_orig = len(datos)

    # Filtrar registros con categoria vacía o nula
    limpios = [r for r in datos if r.get("categoria") and r["categoria"].strip() != ""]
    eliminados = total_orig - len(limpios)

    guardar(ruta, limpios)
    ok(f"Registros eliminados (categoria vacía): {eliminados}")
    ok(f"Registros restantes: {len(limpios)}")

    if len(limpios) != 113:
        warn(f"Total tras limpieza: {len(limpios)} (esperado 113) — puede haber duplicados o faltantes reales")
    else:
        ok("Total = 113 ✓")

# ══════════════════════════════════════════════════════════════
# 5–8. combinaciones — dos correcciones:
#    A) Detectar nombre real de arcano_1/arcano_2
#    B) Normalizar comb_si_no a valores canónicos
#    C) Normalizar tipo (TENSIÓN → TENSION)
# ══════════════════════════════════════════════════════════════

MAPA_SINO = {
    "SÍ":                    "Sí",
    "Sí":                    "Sí",
    "SI":                    "Sí",
    "Si":                    "Sí",
    "NO":                    "No",
    "No":                    "No",
    "NO TODAVÍA":            "No por ahora",
    "NO ESTÁ CLARO":         "No por ahora",
    "DEPENDE":               "No por ahora",
    "No por ahora":          "No por ahora",
    "Indiferente":           "Indiferente",
    "INDIFERENTE":           "Indiferente",
    "SÍ, PERO NO COMO SE ESPERA": "No por ahora",
}

MAPA_TIPO = {
    "TENSIÓN": "TENSION",
    "TENSION": "TENSION",
    "RESONANCIA": "RESONANCIA",
    "COMPLEMENTO": "COMPLEMENTO",
    "NEUTRO": "NEUTRO",
}

def detectar_campos_arcano(muestra):
    """Detecta cómo se llaman arcano_1 y arcano_2 en los datos reales."""
    if not muestra:
        return None, None
    campos = list(muestra[0].keys())
    candidatos_1 = [c for c in campos if "carta_1" in c or "arcano_1" in c or "carta1" in c]
    candidatos_2 = [c for c in campos if "carta_2" in c or "arcano_2" in c or "carta2" in c]
    return candidatos_1, candidatos_2

def corregir_combinaciones(carpeta, ids_lista, label):
    print(f"\n{NEGRITA}{'─'*60}{RESET}")
    print(f"{NEGRITA}► Corrigiendo data/{carpeta}/ ({label}){RESET}")

    carpeta_path = Path(f"data/{carpeta}")
    if not carpeta_path.exists():
        err(f"Carpeta no encontrada: {carpeta_path}"); return

    # Cargar primer chunk para detectar estructura
    primer_chunk = carpeta_path / f"{ids_lista[0]}.json"
    if not primer_chunk.exists():
        err(f"Chunk {primer_chunk} no encontrado"); return

    with open(primer_chunk, encoding="utf-8") as f:
        muestra = json.load(f)

    campos = list(muestra[0].keys()) if muestra else []
    info(f"Campos detectados: {campos[:8]}{'...' if len(campos)>8 else ''}")

    # Detectar campo id_carta_1
    campo_id1 = next((c for c in campos if c in ["id_carta_1","carta_1","id1","carta1"]), None)
    campo_id2 = next((c for c in campos if c in ["id_carta_2","carta_2","id2","carta2"]), None)
    campo_arc1 = next((c for c in campos if c in ["arcano_1","nombre_arcano_1","arcano1"]), None)
    campo_arc2 = next((c for c in campos if c in ["arcano_2","nombre_arcano_2","arcano2"]), None)

    if not campo_id1:
        warn(f"No se detectó campo id_carta_1. Campos disponibles: {campos}")
    if not campo_id2:
        warn(f"No se detectó campo id_carta_2. Campos disponibles: {campos}")
    if not campo_arc1:
        warn(f"No se detectó campo arcano_1. Campos disponibles: {campos}")
    if not campo_arc2:
        warn(f"No se detectó campo arcano_2. Campos disponibles: {campos}")

    n_sino = 0; n_tipo = 0; n_rename_id1 = 0; n_rename_id2 = 0

    for id_ in ids_lista:
        ruta_chunk = carpeta_path / f"{id_}.json"
        if not ruta_chunk.exists():
            continue

        with open(ruta_chunk, encoding="utf-8") as f:
            registros = json.load(f)

        modificado = False
        nuevos = []
        for r in registros:
            # Renombrar id_carta_1 si tiene otro nombre
            if campo_id1 and campo_id1 != "id_carta_1" and campo_id1 in r:
                r["id_carta_1"] = r.pop(campo_id1)
                n_rename_id1 += 1; modificado = True

            if campo_id2 and campo_id2 != "id_carta_2" and campo_id2 in r:
                r["id_carta_2"] = r.pop(campo_id2)
                n_rename_id2 += 1; modificado = True

            # Renombrar arcano_1 si tiene otro nombre
            if campo_arc1 and campo_arc1 != "arcano_1" and campo_arc1 in r:
                r["arcano_1"] = r.pop(campo_arc1)
                modificado = True

            if campo_arc2 and campo_arc2 != "arcano_2" and campo_arc2 in r:
                r["arcano_2"] = r.pop(campo_arc2)
                modificado = True

            # Normalizar comb_si_no
            sino = r.get("comb_si_no", "")
            if sino in MAPA_SINO and MAPA_SINO[sino] != sino:
                r["comb_si_no"] = MAPA_SINO[sino]
                n_sino += 1; modificado = True
            elif sino not in {"Sí","No","No por ahora","Indiferente"}:
                if sino in MAPA_SINO:
                    r["comb_si_no"] = MAPA_SINO[sino]
                    n_sino += 1; modificado = True
                else:
                    warn(f"comb_si_no desconocido: '{sino}' — NO corregido")

            # Normalizar tipo
            tipo = r.get("tipo", "")
            if tipo in MAPA_TIPO and MAPA_TIPO[tipo] != tipo:
                r["tipo"] = MAPA_TIPO[tipo]
                n_tipo += 1; modificado = True

            nuevos.append(r)

        if modificado:
            guardar_chunk(ruta_chunk, nuevos)

    if n_rename_id1: ok(f"id_carta_1 renombrado en {n_rename_id1} registros")
    if n_rename_id2: ok(f"id_carta_2 renombrado en {n_rename_id2} registros")
    ok(f"comb_si_no normalizado en {n_sino} registros")
    if n_tipo: ok(f"tipo normalizado en {n_tipo} registros")

    # Verificar arcano_1/arcano_2 tras corrección
    with open(carpeta_path / f"{ids_lista[0]}.json", encoding="utf-8") as f:
        muestra2 = json.load(f)
    campos2 = list(muestra2[0].keys()) if muestra2 else []
    tiene_arc1 = "arcano_1" in campos2
    tiene_arc2 = "arcano_2" in campos2
    if tiene_arc1 and tiene_arc2:
        ok("Campos arcano_1 y arcano_2 presentes")
    else:
        warn(f"arcano_1={'presente' if tiene_arc1 else 'FALTA'}, arcano_2={'presente' if tiene_arc2 else 'FALTA'}")
        warn(f"Campos actuales: {campos2}")

# ══════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════
print(f"\n{NEGRITA}{'='*60}{RESET}")
print(f"{NEGRITA}CORRECCIÓN DE DATOS — Código de las Cartas{RESET}")
print(f"{'='*60}")
print("Se crearán backups .backup antes de cada modificación.")

corregir_cartas()
corregir_tiradas()
revisar_posiciones()
corregir_sinonimos()

IDS_MAYORES = list(range(1, 23))
IDS_MENORES = list(range(23, 79))

corregir_combinaciones("combinaciones-mm",     IDS_MAYORES, "Mayor×Mayor")
corregir_combinaciones("combinaciones-maymen", IDS_MAYORES, "Mayor×Menor")
corregir_combinaciones("combinaciones-menmay", IDS_MENORES, "Menor×Mayor")
corregir_combinaciones("combinaciones-menmen", IDS_MENORES, "Menor×Menor")

print(f"\n{NEGRITA}{'='*60}{RESET}")
print(f"{NEGRITA}CORRECCIÓN COMPLETADA{RESET}")
print("Vuelve a ejecutar auditar_datos.py para verificar el resultado.")
print("\nCORRECCIONES MANUALES PENDIENTES:")
print("  1. data/tiradas.json — t019: num_cartas=8 (cambiar al valor correcto: 1,2,3,4,5,6,7,10 o 12)")
print("  2. data/posiciones.json — t001 (falta 4 posiciones), t056/t144/t149 (falta 1 posición cada una)")
print("  3. data/sinonimos.json — verificar que quedan exactamente 113 categorías tras la limpieza")
