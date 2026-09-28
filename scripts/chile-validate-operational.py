#!/usr/bin/env python3
"""Validate aggregate municipal CSV staging files offline. Never publishes data.
Usage: python3 scripts/chile-validate-operational.py KIND FILE
Rejects extra fields: no names, RUTs, free-text clinical data or private addresses.
"""
import csv
import datetime as dt
import json
import math
import sys
from pathlib import Path

COMMON = ['registro_id', 'unidad_id', 'periodo', 'observado_en', 'fuente_id']
FIELDS = {
    'solicitudes': ['tipo', 'recibidas', 'pendientes', 'resueltas'],
    'turnos': ['recurso_tipo', 'unidad_medida', 'programado', 'disponible'],
    'activos': ['activo_tipo', 'total_reportado', 'operativos', 'sin_verificar'],
    'suministros': ['producto_id', 'unidad_medida', 'stock_utilizable', 'consumo_periodo'],
    'compromisos': ['compromiso_id', 'estado', 'responsable_unidad_id', 'vence_en', 'evidencia_id'],
}
NUMERIC = {'recibidas', 'pendientes', 'resueltas', 'programado', 'disponible',
           'total_reportado', 'operativos', 'sin_verificar', 'stock_utilizable', 'consumo_periodo'}

def validate(kind, path):
    if kind not in FIELDS:
        raise ValueError('Tipo de registro no admitido')
    errors = []
    seen = set()
    with open(path, encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        if reader.fieldnames != COMMON + FIELDS[kind]:
            raise ValueError('Columnas distintas de la plantilla permitida')
        count = 0
        for index, row in enumerate(reader, 2):
            count += 1
            if count > 100000:
                raise ValueError('Límite de filas excedido')
            if None in row or any(v is None or not v.strip() for v in row.values()):
                errors.append(f'Fila {index}: campo vacío o columna extra'); continue
            # IDs are opaque tokens, not natural-language notes.
            for key, value in row.items():
                if len(value) > 120 or value.startswith(('=', '+', '@')):
                    errors.append(f'Fila {index}: valor no permitido en {key}')
                if key.endswith('_id') and not all(c.isascii() and (c.isalnum() or c in '-_:') for c in value):
                    errors.append(f'Fila {index}: identificador inválido en {key}')
            identity = (row['fuente_id'], row['registro_id'])
            if identity in seen:
                errors.append(f'Fila {index}: registro duplicado')
            seen.add(identity)
            try:
                dt.date.fromisoformat(row['periodo'])
                observed = dt.datetime.fromisoformat(row['observado_en'].replace('Z', '+00:00'))
                if observed.tzinfo is None or observed > dt.datetime.now(dt.timezone.utc):
                    raise ValueError()
                if kind == 'compromisos':
                    dt.date.fromisoformat(row['vence_en'])
            except ValueError:
                errors.append(f'Fila {index}: fecha inválida, futura o sin zona horaria')
            numbers = {}
            for key in NUMERIC.intersection(row):
                try:
                    value = float(row[key])
                    if not math.isfinite(value) or value < 0:
                        raise ValueError()
                    if key in {'recibidas','pendientes','resueltas','total_reportado','operativos','sin_verificar'} and not value.is_integer():
                        raise ValueError()
                    numbers[key] = value
                except ValueError:
                    errors.append(f'Fila {index}: cantidad inválida en {key}')
            if kind == 'activos' and all(k in numbers for k in ('operativos','sin_verificar','total_reportado')):
                if numbers['operativos'] + numbers['sin_verificar'] > numbers['total_reportado']:
                    errors.append(f'Fila {index}: activos inconsistentes')
            if kind == 'compromisos':
                if row['estado'] not in {'propuesto','validado','en_curso','bloqueado','cerrado'}:
                    errors.append(f'Fila {index}: estado no admitido')
                if row['estado'] == 'cerrado' and row['evidencia_id'] == 'pendiente':
                    errors.append(f'Fila {index}: cierre sin evidencia')
    if not count:
        errors.append('Sin registros; plantilla vacía')
    return {'valid': not errors, 'kind': kind, 'rows': count, 'errors': errors,
            'publication': 'none', 'notice': 'Validación estructural; requiere revisión de contenido, permisos y fuente.'}

if __name__ == '__main__':
    try:
        if len(sys.argv) != 3:
            raise ValueError('Uso: KIND FILE; no escribe ni publica datos')
        result = validate(sys.argv[1], Path(sys.argv[2]))
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(0 if result['valid'] else 1)
    except (ValueError, OSError, UnicodeError, csv.Error) as error:
        print(json.dumps({'valid': False, 'error': str(error)}, ensure_ascii=False))
        sys.exit(1)
