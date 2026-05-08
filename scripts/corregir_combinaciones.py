#!/usr/bin/env python3
"""
corregir_combinaciones.py
Corrige los dos problemas pendientes en los 4 archivos de combinaciones:
  1. Añade arcano_1 y arcano_2 (copiando id_carta_1 e id_carta_2)
  2. Normaliza comb_si_no al enum canónico: Sí / No / No por ahora / Indiferente

Ejecutar desde la raíz del proyecto:
  python scripts/corregir_combinaciones.py
"""

import json
from pathlib import Path

VERDE   = "\033[92m"
ROJO    = "\033[91m"
AMARILLO= "\033[93m"
RESET   = "\033[0m"
NEGRITA = "\033[1m"

def ok(msg):   print(f"   {VERDE}✓{RESET} {msg}")
def err(msg):  print(f"   {ROJO}✗{RESET} {msg}")
def warn(msg): print(f"   {AMARILLO}⚠{RESET} {msg}")

# Mapa completo de todos los valores encontrados → canónico
MAPA_SINO = {
    # ya correctos
    "Sí":           "Sí",
    "No":           "No",
    "No por ahora": "No por ahora",
    "Indiferente":  "Indiferente",
    # mayúsculas simples
    "SÍ":           "Sí",
    "SI":           "Sí",
    "NO":           "No",
    "INDIFERENTE":  "Indiferente",
    # variantes "no por ahora"
    "NO TODAVÍA":   "No por ahora",
    "NO AHORA":     "No por ahora",
    "NO POR AHORA": "No por ahora",
    "NO ESTÁ CLARO":"No por ahora",
    "DEPENDE":      "No por ahora",
    # variantes "sí con matices" → No por ahora (es la más cercana al enum)
    "PROBABLEMENTE SÍ":          "Sí",
    "SÍ, CON CAMBIOS":           "Sí",
    "SÍ, PERO NO COMO SE ESPERA":"No por ahora",
}

CARPETAS = [
    ("combinaciones-mm",     list(range(1, 23))),
    ("combinaciones-maymen", list(range(1, 23))),
    ("combinaciones-menmay", list(range(23, 79))),
    ("combinaciones-menmen", list(range(23, 79))),
]

def corregir_carpeta(carpeta, ids_lista):
    print(f"\n{NEGRITA}{'─'*60}{RESET}")
    print(f"{NEGRITA}► data/{carpeta}/{RESET}")

    carpeta_path = Path(f"data/{carpeta}")
    if not carpeta_path.exists():
        err("Carpeta no encontrada"); return

    n_arc = 0; n_sino = 0; n_sino_desconocido = 0
    desconocidos = set()

    for id_ in ids_lista:
        ruta = carpeta_path / f"{id_}.json"
        if not ruta.exists():
            continue

        with open(ruta, encoding="utf-8") as f:
            registros = json.load(f)

        modificado = False
        nuevos = []
        for r in registros:

            # ── Añadir arcano_1 y arcano_2 si no existen ──
            if "arcano_1" not in r:
                r["arcano_1"] = r.get("id_carta_1")
                n_arc += 1; modificado = True
            if "arcano_2" not in r:
                r["arcano_2"] = r.get("id_carta_2")
                modificado = True

            # ── Normalizar comb_si_no ──
            sino = r.get("comb_si_no", "")
            if sino in MAPA_SINO:
                nuevo = MAPA_SINO[sino]
                if nuevo != sino:
                    r["comb_si_no"] = nuevo
                    n_sino += 1; modificado = True
            else:
                desconocidos.add(sino)
                n_sino_desconocido += 1

            nuevos.append(r)

        if modificado:
            with open(ruta, "w", encoding="utf-8") as f:
                json.dump(nuevos, f, ensure_ascii=False, separators=(",", ":"))

    ok(f"arcano_1/arcano_2 añadidos: {n_arc} registros")
    ok(f"comb_si_no normalizado: {n_sino} registros")
    if desconocidos:
        warn(f"comb_si_no desconocidos (NO corregidos): {desconocidos}")
        warn(f"Total sin corregir: {n_sino_desconocido}")
    else:
        ok("comb_si_no: sin valores desconocidos ✓")

# ── MAIN ──
print(f"\n{NEGRITA}{'='*60}{RESET}")
print(f"{NEGRITA}CORRECCIÓN DE COMBINACIONES v3{RESET}")
print(f"{'='*60}")

for carpeta, ids in CARPETAS:
    corregir_carpeta(carpeta, ids)

print(f"\n{NEGRITA}{'='*60}{RESET}")
print(f"{NEGRITA}LISTO{RESET}")
print("Ejecuta ahora la auditoría para verificar:")
print("  python scripts/auditar_datos.py")
