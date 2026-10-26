#!/usr/bin/env python3
"""Read-only, privacy-conscious simulation of the Design request XLSX import."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sys
import unicodedata
import zipfile
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path, PurePosixPath
from typing import Any
from xml.etree import ElementTree
from zoneinfo import ZoneInfo

MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = {"m": MAIN_NS, "r": REL_NS}
SOURCE_SHEET = "Solicitudes de diseño"
TIME_ZONE = ZoneInfo("America/Caracas")
EXPECTED_HEADERS = (
    "Marca temporal",
    "Fecha de entrega",
    "Nombre de arte/flyer",
    "¿Qué se quiere lograr con esta pieza?",
    "¿Qué se publica?",
    "Diseñador",
    "Responsble",
    "Prioridad",
    "Estatus",
    "Fecha de termino",
    "Departamento",
    "Imagen referencial",
    "¿Qué se imprime?",
    "Área",
    "¿Cuántos diseños se necesita?",
    "¿A que medio pertenece?",
    "Dirección de correo electrónico",
    "¿Cuántas piezas?",
    "¿Qué se publica? 2",
    "¿Qué se imprime? 2",
    "En qué material",
    "Definir las medidas",
)
DEPARTMENTS = {
    "mercadeo",
    "compras",
    "farmacia",
    "seleccion",
    "capital humano",
    "ventas online",
    "operaciones perecederos",
    "seguridad laboral",
}
AREAS = {"digital", "eventos", "interno", "gerencia"}
MEDIUMS = {"digital", "impreso", "digital e impreso"}
PRIORITIES = {"urgente", "importante", "normal"}
SENSITIVE_HEADERS = {"Diseñador", "Responsble", "Dirección de correo electrónico"}
SAFE_VALUE_HEADERS = (
    "Departamento",
    "Área",
    "Prioridad",
    "Estatus",
    "¿A que medio pertenece?",
    "¿Qué se publica?",
    "¿Qué se imprime?",
    "¿Qué se publica? 2",
    "¿Qué se imprime? 2",
)
EXCEL_EPOCH = datetime(1899, 12, 30)
CELL_REF = re.compile(r"^([A-Z]+)")
NUMBER = re.compile(r"^\s*(\d+)\s*$")
QUANTITY = re.compile(
    r"^\s*(\d+)\s*(?:diseños?|piezas?)\s*$",
    re.IGNORECASE,
)


class WorkbookError(ValueError):
    pass


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def column_index(cell_ref: str) -> int:
    match = CELL_REF.match(cell_ref)
    if not match:
        raise WorkbookError(f"Referencia de celda inválida: {cell_ref}")
    result = 0
    for char in match.group(1):
        result = result * 26 + ord(char) - ord("A") + 1
    return result - 1


def normalize(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.casefold())
    return " ".join(
        "".join(char for char in decomposed if not unicodedata.combining(char)).split()
    )


def cell_value(cell: ElementTree.Element, shared_strings: list[str]) -> str | None:
    cell_type = cell.get("t")
    value = cell.find(f"{{{MAIN_NS}}}v")
    if cell_type == "inlineStr":
        return "".join(node.text or "" for node in cell.findall(f".//{{{MAIN_NS}}}t"))
    if value is None:
        return None
    if cell_type == "s":
        try:
            return shared_strings[int(value.text or "")]
        except (ValueError, IndexError) as error:
            raise WorkbookError("El archivo contiene una referencia shared-string inválida.") from error
    if cell_type == "b":
        return "TRUE" if value.text == "1" else "FALSE"
    return value.text or ""


def worksheet_path(target: str) -> str:
    path = PurePosixPath(target.lstrip("/"))
    if not target.startswith("/"):
        path = PurePosixPath("xl") / path
    if ".." in path.parts:
        raise WorkbookError("La ruta de la hoja sale del paquete XLSX.")
    return str(path)


def read_workbook(path: Path) -> tuple[list[str], list[dict[str, str | None]], list[int]]:
    try:
        archive = zipfile.ZipFile(path)
    except (OSError, zipfile.BadZipFile) as error:
        raise WorkbookError("No se pudo abrir el archivo como un XLSX válido.") from error

    with archive:
        try:
            workbook = ElementTree.fromstring(archive.read("xl/workbook.xml"))
            relationships = ElementTree.fromstring(
                archive.read("xl/_rels/workbook.xml.rels")
            )
        except (KeyError, ElementTree.ParseError) as error:
            raise WorkbookError("El paquete XLSX no contiene el índice esperado.") from error

        relationship_targets = {
            item.get("Id", ""): item.get("Target", "")
            for item in relationships.findall(f"{{{PKG_REL_NS}}}Relationship")
        }
        sheets: dict[str, str] = {}
        for sheet in workbook.findall(".//m:sheets/m:sheet", NS):
            relation_id = sheet.get(f"{{{REL_NS}}}id", "")
            if relation_id not in relationship_targets:
                raise WorkbookError("El libro contiene una hoja sin relación válida.")
            sheets[sheet.get("name", "")] = worksheet_path(
                relationship_targets[relation_id]
            )

        if SOURCE_SHEET not in sheets:
            raise WorkbookError(f"No se encontró la hoja «{SOURCE_SHEET}».")
        if "Hoja 1" in sheets:
            empty_root = ElementTree.fromstring(archive.read(sheets["Hoja 1"]))
            if any(
                any(cell_value(cell, []) not in (None, "") for cell in row.findall("m:c", NS))
                for row in empty_root.findall(".//m:sheetData/m:row", NS)
            ):
                raise WorkbookError("La hoja auxiliar «Hoja 1» no está vacía.")

        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            strings_root = ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))
            shared_strings = [
                "".join(node.text or "" for node in item.findall(".//m:t", NS))
                for item in strings_root.findall("m:si", NS)
            ]

        sheet_root = ElementTree.fromstring(archive.read(sheets[SOURCE_SHEET]))
        physical_rows: list[tuple[int, dict[int, str | None]]] = []
        for row in sheet_root.findall(".//m:sheetData/m:row", NS):
            values: dict[int, str | None] = {}
            for cell in row.findall("m:c", NS):
                reference = cell.get("r", "")
                values[column_index(reference)] = cell_value(cell, shared_strings)
            physical_rows.append((int(row.get("r", "0")), values))

    if not physical_rows:
        raise WorkbookError("La hoja fuente no contiene encabezados.")
    header_cells = physical_rows[0][1]
    headers = [header_cells.get(index) or "" for index in range(max(header_cells, default=-1) + 1)]
    if len(headers) != len(EXPECTED_HEADERS) or len(set(headers)) != len(headers):
        raise WorkbookError("La hoja debe tener exactamente 22 encabezados únicos.")
    if tuple(headers) != EXPECTED_HEADERS:
        raise WorkbookError("Los encabezados u orden de columnas no coinciden con la fuente aprobada.")

    records: list[dict[str, str | None]] = []
    physical_numbers: list[int] = []
    for physical_row, values in physical_rows[1:]:
        record = {header: values.get(index) for index, header in enumerate(headers)}
        if any(value is not None and value.strip() for value in record.values()):
            records.append(record)
            physical_numbers.append(physical_row)
    return headers, records, physical_numbers


def row_fingerprint(headers: tuple[str, ...] | list[str], row: dict[str, str | None]) -> str:
    canonical = json.dumps(
        [[header, row.get(header)] for header in headers],
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def excel_datetime(value: str | None) -> datetime | None:
    if value is None or not value.strip():
        return None
    try:
        serial = float(value)
    except ValueError:
        return None
    if not math.isfinite(serial) or serial < 1:
        return None
    try:
        local = EXCEL_EPOCH + timedelta(days=serial)
        return local.replace(tzinfo=TIME_ZONE)
    except OverflowError:
        return None


def parse_quantity(value: str | None) -> int | None:
    if value is None:
        return None
    text = value.strip()
    if text.casefold() in {"un", "una"}:
        return 1
    match = NUMBER.fullmatch(text) or QUANTITY.fullmatch(text)
    return int(match.group(1)) if match and int(match.group(1)) > 0 else None


def category_counts(rows: list[dict[str, str | None]]) -> dict[str, dict[str, int]]:
    result: dict[str, dict[str, int]] = {}
    for header in SAFE_VALUE_HEADERS:
        counts: Counter[str] = Counter()
        for row in rows:
            value = row.get(header)
            if value and value.strip():
                if header.startswith("¿Qué se publica?") or header.startswith("¿Qué se imprime?"):
                    counts.update(token.strip() for token in value.split(",") if token.strip())
                else:
                    counts[value.strip()] += 1
        result[header] = dict(sorted(counts.items(), key=lambda item: (-item[1], item[0].casefold())))
    return result


def simulate(path: Path) -> dict[str, Any]:
    headers, rows, physical_rows = read_workbook(path)
    status_counts: Counter[str] = Counter()
    warning_counts: Counter[str] = Counter()
    field_coverage: Counter[str] = Counter()
    fingerprints: Counter[str] = Counter()
    timestamp_dates: list[str] = []

    for row in rows:
        fingerprints[row_fingerprint(headers, row)] += 1
        for header, value in row.items():
            if header not in SENSITIVE_HEADERS and value and value.strip():
                field_coverage[header] += 1

        has_title = bool((row.get("Nombre de arte/flyer") or "").strip())
        timestamp_raw = row.get("Marca temporal")
        timestamp = excel_datetime(timestamp_raw)
        if not has_title and not timestamp_raw:
            status_counts["EXCLUIDA_SIN_IDENTIDAD_MINIMA"] += 1
        elif not has_title or timestamp is None:
            status_counts["PENDIENTE_REVISION"] += 1
        else:
            status_counts["IMPORTADA_PARCIAL"] += 1
            timestamp_dates.append(timestamp.isoformat())

        if timestamp_raw and timestamp is None:
            warning_counts["FECHA_INVALIDA"] += 1

        for header, allowed in (
            ("Departamento", DEPARTMENTS),
            ("Área", AREAS),
            ("¿A que medio pertenece?", MEDIUMS),
            ("Prioridad", PRIORITIES),
        ):
            value = row.get(header)
            if value and normalize(value) not in allowed:
                warning_counts[f"SIN_EQUIVALENCIA:{header}"] += 1

        if (row.get("¿Cuántos diseños se necesita?") or "").strip():
            warning_counts["COLUMNA_ESPERADA_VACIA"] += 1

        if row.get("¿Qué se publica?") or row.get("¿Qué se imprime?") or row.get("¿Qué se publica? 2") or row.get("¿Qué se imprime? 2"):
            warning_counts["FORMATOS_PENDIENTES_DE_ALIAS"] += 1

        requester = (row.get("Responsble") or "").strip()
        designer = (row.get("Diseñador") or "").strip()
        if requester:
            warning_counts["IDENTIDAD_SOLICITANTE_PENDIENTE_DE_REVISION"] += 1
        if designer:
            warning_counts["IDENTIDAD_EJECUTOR_PENDIENTE_DE_REVISION"] += 1
        if row.get("¿Cuántas piezas?") and parse_quantity(row["¿Cuántas piezas?"]) is None:
            warning_counts["CANTIDAD_NO_INEQUIVOCA"] += 1

    duplicate_fingerprint_groups = sum(1 for count in fingerprints.values() if count > 1)
    if duplicate_fingerprint_groups:
        warning_counts["HUELLA_DUPLICADA_EN_ARCHIVO"] = duplicate_fingerprint_groups

    if sum(status_counts.values()) != len(rows):
        raise WorkbookError("El control de resultados no coincide con las filas de origen.")

    return {
        "modo": "SIMULACION_SIN_ESCRITURAS",
        "archivo_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "hoja": SOURCE_SHEET,
        "filas_origen": len(rows),
        "filas_fisicas": physical_rows,
        "resultados": dict(sorted(status_counts.items())),
        "advertencias": dict(sorted(warning_counts.items())),
        "marcas_temporales": {
            "zona_horaria": "America/Caracas",
            "validas": len(timestamp_dates),
            "minima_local": min(timestamp_dates) if timestamp_dates else None,
            "maxima_local": max(timestamp_dates) if timestamp_dates else None,
        },
        "cobertura_campos_sin_datos_personales": dict(sorted(field_coverage.items())),
        "valores_categoricos_seguros": category_counts(rows),
        "no_escrituras": {
            "supabase": True,
            "archivo_fuente": True,
            "servicios_externos": True,
        },
    }


def markdown_report(report: dict[str, Any]) -> str:
    lines = [
        "# Simulación de importación histórica de solicitudes de Diseño",
        "",
        "- **Modo:** solo lectura; no escribe en Supabase ni modifica el Excel.",
        f"- **Hoja:** {report['hoja']}",
        f"- **SHA-256:** `{report['archivo_sha256']}`",
        f"- **Filas:** {report['filas_origen']}",
        "",
        "## Resultados",
        "",
        "| Resultado | Filas |",
        "|---|---:|",
    ]
    lines.extend(f"| `{name}` | {count} |" for name, count in report["resultados"].items())
    lines.extend(["", "## Advertencias agregadas", "", "| Código | Filas / grupos |", "|---|---:|"])
    lines.extend(f"| `{name}` | {count} |" for name, count in report["advertencias"].items())
    lines.extend(
        [
            "",
            "## Marcas temporales",
            "",
            f"- Zona: `{report['marcas_temporales']['zona_horaria']}`",
            f"- Válidas: {report['marcas_temporales']['validas']}",
            f"- Rango local: {report['marcas_temporales']['minima_local']} — {report['marcas_temporales']['maxima_local']}",
            "",
            "## Valores categóricos observados",
            "",
            "No se incluyen nombres de solicitantes, diseñadores ni correos.",
        ]
    )
    for header, values in report["valores_categoricos_seguros"].items():
        lines.extend(["", f"### {header}", ""])
        lines.extend(f"- {value}: {count}" for value, count in values.items())
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "workbook",
        type=Path,
        help="Path to the privately stored source workbook.",
    )
    parser.add_argument("--format", choices=("json", "markdown"), default="markdown")
    parser.add_argument("--output", type=Path, help="Write the aggregate report to this path.")
    args = parser.parse_args()
    try:
        report = simulate(args.workbook)
    except (OSError, WorkbookError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    output = json.dumps(report, ensure_ascii=False, indent=2) if args.format == "json" else markdown_report(report)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output, encoding="utf-8")
    else:
        print(output, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
