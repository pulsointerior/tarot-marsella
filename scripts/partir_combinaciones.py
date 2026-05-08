#!/usr/bin/env python3
"""
partir_combinaciones.py
Parte los 4 JSON monolíticos de combinaciones en archivos por primera carta (ID numérico).
Los archivos resultantes se llaman {id_carta_1}.json (ej: 1.json, 23.json).

Ejecutar UNA SOLA VEZ desde la raíz del proyecto:
  python scripts/partir_combinaciones.py

Requisitos: Python 3.8+. Sin dependencias externas.
Tiempo estimado: < 30 segundos en cualquier máquina moderna.
"""

import json
import os
from pathlib import Path
from collections import defaultdict

# Campo en los JSON de combinaciones que contiene el ID de la primera carta
CAMPO_ID_CARTA1 = "id_carta_1"

ARCHIVOS = [
    ("data/combinaciones-mm.json",      "data/combinaciones-mm",      1848),
    ("data/combinaciones-maymen.json",  "data/combinaciones-maymen",  4928),
    ("data/combinaciones-menmay.json",  "data/combinaciones-menmay",  4928),
    ("data/combinaciones-menmen.json",  "data/combinaciones-menmen",  12320),
]


def partir(ruta_origen, ruta_destino, esperado):
    print(f"\n→ Procesando {ruta_origen}...")

    if not Path(ruta_origen).exists():
        print(f"   ✗ ERROR: Archivo no encontrado: {ruta_origen}")
        return False

    with open(ruta_origen, encoding="utf-8") as f:
        datos = json.load(f)

    total = len(datos)
    if total != esperado:
        print(f"   ⚠ AVISO: Se esperaban {esperado} registros, encontrados {total}")

    # Verificar que el campo id_carta_1 existe en el primer registro
    if datos and CAMPO_ID_CARTA1 not in datos[0]:
        campos = list(datos[0].keys())
        print(f"   ✗ ERROR: Campo '{CAMPO_ID_CARTA1}' no encontrado.")
        print(f"   Campos disponibles: {campos}")
        print(f"   Ajusta CAMPO_ID_CARTA1 en el script.")
        return False

    grupos = defaultdict(list)
    for registro in datos:
        id_carta1 = registro[CAMPO_ID_CARTA1]
        grupos[id_carta1].append(registro)

    Path(ruta_destino).mkdir(parents=True, exist_ok=True)

    total_escritos = 0
    for id_carta1, registros in sorted(grupos.items(), key=lambda x: int(x[0])):
        ruta_archivo = f"{ruta_destino}/{id_carta1}.json"
        with open(ruta_archivo, "w", encoding="utf-8") as f:
            json.dump(registros, f, ensure_ascii=False, separators=(",", ":"))
        total_escritos += len(registros)

    print(f"   ✓ {len(grupos)} archivos creados · {total_escritos} registros distribuidos")

    if total_escritos != total:
        print(f"   ✗ ERROR: Registros escritos ({total_escritos}) ≠ registros leídos ({total})")
        return False

    # Verificar rangos de IDs esperados
    ids = sorted(int(k) for k in grupos.keys())
    print(f"   IDs generados: {ids[0]}–{ids[-1]} ({len(ids)} archivos)")

    return True


def verificar_rangos(ruta_destino, ids_esperados, label):
    """Verificación post-escritura: comprueba que existen exactamente los archivos esperados."""
    carpeta = Path(ruta_destino)
    archivos_existentes = {int(p.stem) for p in carpeta.glob("*.json")}
    faltantes = set(ids_esperados) - archivos_existentes
    sobrantes = archivos_existentes - set(ids_esperados)

    if faltantes:
        print(f"   ⚠ {label}: Faltan archivos para IDs: {sorted(faltantes)}")
    if sobrantes:
        print(f"   ⚠ {label}: Archivos inesperados para IDs: {sorted(sobrantes)}")
    if not faltantes and not sobrantes:
        print(f"   ✓ {label}: Todos los {len(ids_esperados)} archivos presentes y correctos.")


# ── EJECUCIÓN ──────────────────────────────────────────────────────────────────

exitos = 0
for origen, destino, esperado in ARCHIVOS:
    if partir(origen, destino, esperado):
        exitos += 1

# Verificación final de rangos
print("\n── Verificación de rangos ──")
ids_mayores  = list(range(1, 23))        # 1–22 (22 arcanos mayores)
ids_menores  = list(range(23, 79))       # 23–78 (56 arcanos menores)

verificar_rangos("data/combinaciones-mm",      ids_mayores, "combinaciones-mm")
verificar_rangos("data/combinaciones-maymen",  ids_mayores, "combinaciones-maymen")
verificar_rangos("data/combinaciones-menmay",  ids_menores, "combinaciones-menmay")
verificar_rangos("data/combinaciones-menmen",  ids_menores, "combinaciones-menmen")

print(f"\n{'✅' if exitos == 4 else '❌'} Resultado: {exitos}/4 archivos procesados correctamente.")
if exitos == 4:
    print("Los JSON originales se conservan como backup. La app usará las carpetas nuevas.")
    print("\nEstructura esperada:")
    print("  data/combinaciones-mm/      → 22 archivos (1.json … 22.json)")
    print("  data/combinaciones-maymen/  → 22 archivos (1.json … 22.json)")
    print("  data/combinaciones-menmay/  → 56 archivos (23.json … 78.json)")
    print("  data/combinaciones-menmen/  → 56 archivos (23.json … 78.json)")
