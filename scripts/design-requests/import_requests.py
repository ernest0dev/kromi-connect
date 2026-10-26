#!/usr/bin/env python3
"""Import the Design request workbook through the audited Supabase RPC."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from collections import Counter
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

import simulate_import

ROW_RPC = "import_solicitud_diseno_fila"
URL_PATTERN = re.compile(r"https?://[^\s<>\"']+", re.IGNORECASE)
FIELD_SOURCES = (
    ("¿Qué se publica?", "DIGITAL", "PUBLICACION_PRINCIPAL"),
    ("¿Qué se publica? 2", "DIGITAL", "PUBLICACION_ADICIONAL"),
    ("¿Qué se imprime?", "IMPRESO", "IMPRESION_PRINCIPAL"),
    ("¿Qué se imprime? 2", "IMPRESO", "IMPRESION_ADICIONAL"),
)
PRIORITY_MAP = {
    "urgente": "URGENTE",
    "importante": "IMPORTANTE",
    "normal": "NORMAL",
}


class ImportErrorSafe(RuntimeError):
    pass


def load_local_env(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        value = value.strip().strip("\"'")
        os.environ.setdefault(key.strip(), value)


def clean_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = " ".join(value.split())
    return cleaned or None


def parse_excel_date(value: str | None) -> date | None:
    if value is None or not value.strip():
        return None
    try:
        serial = float(value)
        if serial < 1:
            return None
        return (simulate_import.EXCEL_EPOCH + timedelta(days=serial)).date()
    except (ValueError, OverflowError):
        try:
            return date.fromisoformat(value.strip()[:10])
        except ValueError:
            return None


def safe_url(value: str) -> str | None:
    candidate = value.rstrip(".,;:!?)]}")
    parsed = urlsplit(candidate)
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.hostname:
        return None
    return candidate


def extract_urls(value: str | None) -> list[str]:
    if not value:
        return []
    urls: list[str] = []
    for match in URL_PATTERN.finditer(value):
        url = safe_url(match.group(0))
        if url and url not in urls:
            urls.append(url)
    return urls


def catalog_index(rows: list[dict[str, Any]], category: str | None = None) -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    for row in rows:
        if not row.get("activo", True):
            continue
        if category and row.get("categoria") != category:
            continue
        for value in [row.get("nombre"), row.get("codigo"), *(row.get("alias") or [])]:
            if isinstance(value, str) and value.strip():
                index[simulate_import.normalize(value)] = row
    return index


class SupabaseRest:
    def __init__(self, url: str, key: str):
        self.base_url = url.rstrip("/")
        self.key = key

    def request(
        self,
        method: str,
        resource: str,
        query: dict[str, str] | None = None,
        payload: Any | None = None,
    ) -> Any:
        url = f"{self.base_url}/rest/v1/{resource}"
        if query:
            url += "?" + urllib.parse.urlencode(query, safe="(),.*:")
        body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
        request = urllib.request.Request(url, data=body, method=method)
        request.add_header("apikey", self.key)
        request.add_header("Authorization", f"Bearer {self.key}")
        request.add_header("Accept", "application/json")
        if body is not None:
            request.add_header("Content-Type", "application/json")
        if method in {"POST", "PATCH"}:
            request.add_header("Prefer", "return=representation")
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                content = response.read()
        except urllib.error.HTTPError as error:
            safe_detail = error.read(4096).decode("utf-8", errors="replace")
            raise ImportErrorSafe(
                f"Supabase respondió HTTP {error.code} al ejecutar {resource}: {safe_detail}"
            ) from None
        except (urllib.error.URLError, TimeoutError) as error:
            raise ImportErrorSafe(f"No se pudo conectar con Supabase: {error}") from None
        if not content:
            return None
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            raise ImportErrorSafe(f"Respuesta JSON inválida de Supabase en {resource}.") from None


def warning(code: str, column: str | None = None, value: str | None = None) -> dict[str, str]:
    result = {"codigo": code}
    if column:
        result["columna"] = column
    if value:
        result["valor_original"] = value
    return result


def flag_in_file_duplicate(
    result: str,
    warnings: list[dict[str, str]],
    request_data: dict[str, Any] | None,
) -> str:
    if result not in {"IMPORTADA", "IMPORTADA_PARCIAL"} or request_data is None:
        return result
    warnings.append(warning("POSIBLE_DUPLICADO"))
    request_data["requiere_revision"] = True
    request_data["motivos_revision"] = sorted(
        set(request_data.get("motivos_revision", [])) | {"POSIBLE_DUPLICADO"}
    )
    return "IMPORTADA_PARCIAL"


def map_catalog(
    index: dict[str, dict[str, Any]],
    value: str | None,
) -> dict[str, Any] | None:
    if not value:
        return None
    return index.get(simulate_import.normalize(value))


def normalize_row(
    row: dict[str, str | None],
    catalogs: dict[str, dict[str, dict[str, Any]]],
    fingerprint: str,
) -> tuple[str, list[dict[str, str]], list[dict[str, str]], dict[str, Any] | None, list[dict[str, Any]]]:
    warnings: list[dict[str, str]] = []
    errors: list[dict[str, str]] = []
    title_raw = row.get("Nombre de arte/flyer")
    timestamp_raw = row.get("Marca temporal")
    title = clean_text(title_raw)
    requested_at = simulate_import.excel_datetime(timestamp_raw)
    any_content = any(value and value.strip() for value in row.values())
    if not any_content:
        return "EXCLUIDA_VACIA", warnings, errors, None, []
    if not title and requested_at is None:
        return "EXCLUIDA_SIN_IDENTIDAD_MINIMA", warnings, errors, None, []
    if not title or requested_at is None:
        if timestamp_raw and requested_at is None:
            warnings.append(warning("FECHA_INVALIDA", "Marca temporal", timestamp_raw))
        return "PENDIENTE_REVISION", warnings, errors, None, []

    if title_raw and not title_raw.strip():
        warnings.append(warning("TITULO_NORMALIZADO", "Nombre de arte/flyer"))

    priority_raw = row.get("Prioridad")
    priority = PRIORITY_MAP.get(simulate_import.normalize(priority_raw)) if priority_raw else None
    if priority_raw and priority is None:
        warnings.append(warning("SIN_EQUIVALENCIA", "Prioridad", priority_raw))

    department_raw = row.get("Departamento")
    department = map_catalog(catalogs["departments"], department_raw)
    if department_raw and not department:
        warnings.append(warning("SIN_EQUIVALENCIA", "Departamento", department_raw))

    area_raw = row.get("Área")
    area = map_catalog(catalogs["areas"], area_raw)
    if area_raw and not area:
        warnings.append(warning("SIN_EQUIVALENCIA", "Área", area_raw))

    requester = row.get("Responsble")
    designer = row.get("Diseñador")
    if requester and requester.strip():
        warnings.append(warning("IDENTIDAD_SOLICITANTE_NO_RESUELTA", "Responsble"))
    if designer and designer.strip():
        warnings.append(warning("IDENTIDAD_EJECUTOR_NO_RESUELTA", "Diseñador"))

    target_raw = row.get("Fecha de entrega")
    target_date = parse_excel_date(target_raw)
    if target_raw and target_date is None:
        warnings.append(warning("FECHA_INVALIDA", "Fecha de entrega", target_raw))
    elif target_date and target_date < requested_at.date():
        warnings.append(warning("OBJETIVO_ANTERIOR_A_SOLICITUD", "Fecha de entrega", target_raw))

    ended_raw = row.get("Fecha de termino")
    ended_date = parse_excel_date(ended_raw)
    if ended_raw and ended_date is None:
        warnings.append(warning("FECHA_INVALIDA", "Fecha de termino", ended_raw))
    historical_status = row.get("Estatus")
    if bool(ended_date) != (simulate_import.normalize(historical_status or "") == "terminado"):
        warnings.append(warning("ESTADO_Y_TERMINO_INCONSISTENTES", "Estatus"))

    quantity_raw = row.get("¿Cuántas piezas?")
    quantity = simulate_import.parse_quantity(quantity_raw)
    if quantity_raw and quantity is None:
        warnings.append(warning("CANTIDAD_NO_INEQUIVOCA", "¿Cuántas piezas?", quantity_raw))

    medium_raw = row.get("¿A que medio pertenece?")
    medium_normalized = simulate_import.normalize(medium_raw or "")
    deliverables: list[dict[str, Any]] = []
    known_categories: set[str] = set()
    for header, category, source_field in FIELD_SOURCES:
        original = row.get(header)
        if not original or not original.strip():
            continue
        tokens = [part.strip() for part in original.split(",") if part.strip()]
        for token in tokens:
            format_row = map_catalog(catalogs[f"formats_{category.lower()}"], token)
            if not format_row:
                warnings.append(warning("SIN_EQUIVALENCIA", header, token))
                continue
            known_categories.add(category)
            medium_name = "Digital" if category == "DIGITAL" else "Impreso"
            medium_row = map_catalog(catalogs["mediums"], medium_name)
            if medium_normalized == "digital e impreso" or medium_normalized == simulate_import.normalize(medium_name):
                pass
            elif medium_raw:
                warnings.append(warning("MEDIO_Y_FORMATO_INCONSISTENTES", "¿A que medio pertenece?", medium_raw))
            deliverables.append({
                "pieza": title,
                "categoria": category,
                "campo_origen": source_field,
                "formato_id": format_row["id"],
                "formato_original": token,
                "medio_id": medium_row["id"] if medium_row else None,
                "medio_original": medium_raw,
                "cantidad_piezas": quantity,
                "cantidad_formatos": 1,
                "alcance_texto": quantity_raw,
                "material": clean_text(row.get("En qué material")) if category == "IMPRESO" else None,
                "medidas": clean_text(row.get("Definir las medidas")) if category == "IMPRESO" else None,
                "fecha_objetivo": target_date.isoformat() if target_date else None,
                "datos_adicionales": {},
            })

    if not deliverables:
        warnings.append(warning("ENTREGABLES_NO_RESUELTOS"))
    expected_categories = (
        {"DIGITAL", "IMPRESO"}
        if medium_normalized == "digital e impreso"
        else {"DIGITAL"} if medium_normalized == "digital"
        else {"IMPRESO"} if medium_normalized == "impreso"
        else set()
    )
    if expected_categories and not expected_categories.issubset(known_categories):
        warnings.append(warning("MEDIO_SIN_FORMATO_RESUELTO", "¿A que medio pertenece?", medium_raw))

    if row.get("¿Cuántos diseños se necesita?") and row["¿Cuántos diseños se necesita?"].strip():
        warnings.append(warning("COLUMNA_ESPERADA_VACIA", "¿Cuántos diseños se necesita?"))

    if not deliverables:
        scope_parts = [
            value.strip()
            for value in (
                row.get("¿Cuántas piezas?"),
                row.get("¿Qué se publica?"),
                row.get("¿Qué se publica? 2"),
                row.get("¿Qué se imprime?"),
                row.get("¿Qué se imprime? 2"),
                row.get("En qué material"),
                row.get("Definir las medidas"),
            )
            if value and value.strip()
        ]
        scope = "\n".join(scope_parts) or None
    else:
        scope = None

    originals = row
    normalized_request = {
        "titulo": title,
        "objetivo": clean_text(row.get("¿Qué se quiere lograr con esta pieza?")),
        "alcance_original": scope,
        "solicitante_nombre_original": requester,
        "departamento_id": department["id"] if department else None,
        "departamento_original": department_raw,
        "area_id": area["id"] if area else None,
        "area_original": area_raw,
        "tipo_id": None,
        "prioridad": priority,
        "prioridad_original": priority_raw,
        "solicitada_en_original": requested_at.isoformat(),
        "fecha_objetivo": target_date.isoformat() if target_date else None,
        "fecha_objetivo_original": target_raw,
        "estado_historico_original": historical_status,
        "fecha_termino_historica": ended_date.isoformat() if ended_date else None,
        "fecha_termino_original": ended_raw,
        "ejecutor_historico_nombre": designer,
        "referencias_originales": row.get("Imagen referencial"),
        "referencias_urls": extract_urls(row.get("Imagen referencial")),
        "requiere_revision": bool(warnings),
        "motivos_revision": sorted({item["codigo"] for item in warnings}),
        "huella": fingerprint,
    }
    result = "IMPORTADA_PARCIAL" if warnings else "IMPORTADA"
    return result, warnings, errors, normalized_request, deliverables


def load_catalogs(client: SupabaseRest) -> dict[str, dict[str, dict[str, Any]]]:
    def fetch(table: str) -> list[dict[str, Any]]:
        result = client.request(
            "GET", table,
            {"select": "id,codigo,nombre,activo,alias,categoria", "activo": "eq.true", "limit": "1000"},
        )
        if not isinstance(result, list):
            raise ImportErrorSafe(f"Respuesta inesperada al leer el catálogo {table}.")
        return result

    formats = fetch("catalogo_formatos_entregable")
    return {
        "departments": catalog_index(fetch("catalogo_departamentos_solicitud")),
        "areas": catalog_index(fetch("catalogo_areas_solicitud")),
        "mediums": catalog_index(fetch("catalogo_medios")),
        "formats_digital": catalog_index(formats, "DIGITAL"),
        "formats_impreso": catalog_index(formats, "IMPRESO"),
    }


def batch_rows(client: SupabaseRest, file_hash: str) -> list[dict[str, Any]]:
    rows = client.request(
        "GET",
        "solicitud_diseno_importaciones",
        {
            "select": "id,clave_lote,intento,estado,modo,hoja",
            "archivo_sha256": f"eq.{file_hash}",
            "hoja": f"eq.{simulate_import.SOURCE_SHEET}",
            "order": "intento.desc",
            "limit": "100",
        },
    )
    if not isinstance(rows, list):
        raise ImportErrorSafe("Respuesta inesperada al consultar lotes previos.")
    return rows


def run_import(path: Path, actor_id: str) -> dict[str, Any]:
    path = path.resolve()
    repository_root = Path(__file__).resolve().parents[2]
    if path.is_relative_to(repository_root):
        raise ImportErrorSafe("El Excel de origen debe estar fuera del repositorio.")

    try:
        actor_id = str(uuid.UUID(actor_id))
    except ValueError:
        raise ImportErrorSafe("--actor-id debe ser el UUID del usuario autenticado que autoriza la carga.") from None

    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise ImportErrorSafe("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.")
    client = SupabaseRest(url, key)
    headers, rows, physical_rows = simulate_import.read_workbook(path)
    file_hash = hashlib.sha256(path.read_bytes()).hexdigest()
    previous_batches = batch_rows(client, file_hash)
    completed = next(
        (batch for batch in previous_batches if batch["estado"] == "COMPLETADO" and batch["modo"] == "REAL"),
        None,
    )
    if completed:
        return {"estado": "YA_IMPORTADO", "lote_id": completed["id"], "filas_origen": len(rows)}

    resumable = next(
        (batch for batch in previous_batches if batch["estado"] in {"EN_CURSO", "FALLIDO"} and batch["modo"] == "REAL"),
        None,
    )
    if resumable:
        batch = resumable
        if batch["estado"] == "FALLIDO":
            resumed = client.request("PATCH", "solicitud_diseno_importaciones", {
                "id": f"eq.{batch['id']}",
            }, {"estado": "EN_CURSO", "finalizado_en": None})
            if not isinstance(resumed, list) or not resumed:
                raise ImportErrorSafe("Supabase no confirmó la reanudación del lote fallido.")
    else:
        attempt = max((int(batch["intento"]) for batch in previous_batches), default=0) + 1
        batch_key = f"{file_hash}:{simulate_import.SOURCE_SHEET}:{attempt}"
        created = client.request(
            "POST",
            "solicitud_diseno_importaciones",
            payload={
                "clave_lote": batch_key,
                "intento": attempt,
                "archivo_nombre": path.name,
                "archivo_sha256": file_hash,
                "hoja": simulate_import.SOURCE_SHEET,
                "filas_origen": len(rows),
                "modo": "REAL",
                "estado": "EN_CURSO",
                "iniciado_por": actor_id,
            },
        )
        if not isinstance(created, list) or not created:
            raise ImportErrorSafe("Supabase no devolvió el lote creado.")
        batch = created[0]

    catalogs = load_catalogs(client)
    fingerprint_counts = Counter(
        simulate_import.row_fingerprint(headers, row) for row in rows
    )
    result_counts: Counter[str] = Counter()
    warning_counts: Counter[str] = Counter()
    try:
        for row, physical_row in zip(rows, physical_rows, strict=True):
            fingerprint = simulate_import.row_fingerprint(headers, row)
            result, warnings, errors, request_data, deliverables = normalize_row(row, catalogs, fingerprint)
            if fingerprint_counts[fingerprint] > 1:
                result = flag_in_file_duplicate(result, warnings, request_data)
            response = client.request(
                "POST",
                f"rpc/{ROW_RPC}",
                payload={
                    "p_lote_id": batch["id"],
                    "p_fila_origen": physical_row,
                    "p_huella": fingerprint,
                    "p_datos_originales": row,
                    "p_resultado": result,
                    "p_advertencias": warnings,
                    "p_errores": errors,
                    "p_solicitud": request_data,
                    "p_entregables": deliverables,
                },
            )
            if not isinstance(response, dict) or not response.get("resultado"):
                raise ImportErrorSafe(f"RPC de importación devolvió una respuesta inválida en la fila {physical_row}.")
            result_counts[response["resultado"]] += 1
            warning_counts.update(
                item["codigo"]
                for item in response.get("advertencias", [])
                if isinstance(item, dict) and isinstance(item.get("codigo"), str)
            )

        summary = {
            "resultados": dict(sorted(result_counts.items())),
            "advertencias": dict(sorted(warning_counts.items())),
            "filas_origen": len(rows),
            "archivo_sha256": file_hash,
        }
        finalized = client.request(
            "PATCH",
            "solicitud_diseno_importaciones",
            {"id": f"eq.{batch['id']}"},
            {"estado": "COMPLETADO", "finalizado_en": datetime.now().astimezone().isoformat(), "resumen": summary},
        )
        if not isinstance(finalized, list) or not finalized:
            raise ImportErrorSafe("Supabase no confirmó la finalización del lote de importación.")
    except Exception as error:
        safe_summary = {
            "filas_procesadas_antes_del_error": sum(result_counts.values()),
            "error": "FALLO_DE_FILA; revisar el error mostrado por el proceso.",
        }
        try:
            failed_batch = client.request(
                "PATCH",
                "solicitud_diseno_importaciones",
                {"id": f"eq.{batch['id']}"},
                {"estado": "FALLIDO", "finalizado_en": datetime.now().astimezone().isoformat(), "resumen": safe_summary},
            )
            if not isinstance(failed_batch, list) or not failed_batch:
                print("Supabase no confirmó el cambio del lote a FALLIDO.", file=sys.stderr)
        except Exception as batch_error:
            print(f"No se pudo marcar el lote como FALLIDO: {batch_error}", file=sys.stderr)
        if isinstance(error, ImportErrorSafe):
            raise
        raise ImportErrorSafe(f"Importación interrumpida; el lote puede reanudarse: {error}") from None

    return {
        "estado": "COMPLETADO",
        "lote_id": batch["id"],
        "filas_origen": len(rows),
        "resultados": dict(sorted(result_counts.items())),
        "advertencias": dict(sorted(warning_counts.items())),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", type=Path, help="Ruta privada al Excel original.")
    parser.add_argument("--env-file", type=Path, default=Path(".env.local"))
    parser.add_argument("--apply", action="store_true", help="Escribe la importación en Supabase.")
    parser.add_argument("--confirm-production", action="store_true", help="Confirma explícitamente escrituras en producción.")
    parser.add_argument("--actor-id", help="UUID del usuario que autoriza la importación.")
    args = parser.parse_args()

    try:
        if not args.apply:
            report = simulate_import.simulate(args.workbook)
            print(simulate_import.markdown_report(report), end="")
            print("\nSimulación únicamente: no se escribió en Supabase.", file=sys.stderr)
            return 0
        if not args.confirm_production:
            raise ImportErrorSafe("Para escribir debe incluir --confirm-production tras revisar la simulación.")
        if not args.actor_id:
            raise ImportErrorSafe("Para auditar la carga, --actor-id es obligatorio.")
        load_local_env(args.env_file)
        report = run_import(args.workbook, args.actor_id)
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0
    except (OSError, simulate_import.WorkbookError, ImportErrorSafe) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
