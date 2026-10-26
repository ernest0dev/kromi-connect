import sys
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch

SCRIPT_ROOT = Path(__file__).parents[1] / "scripts" / "design-requests"
sys.path.insert(0, str(SCRIPT_ROOT))

import import_requests
import simulate_import


class DesignImportSimulationTests(unittest.TestCase):
    def setUp(self):
        self.catalogs = {
            "departments": {},
            "areas": {},
            "mediums": import_requests.catalog_index([
                {"id": "medium-digital", "nombre": "Digital", "activo": True},
                {"id": "medium-print", "nombre": "Impreso", "activo": True},
            ]),
            "formats_digital": import_requests.catalog_index(
                [{"id": "format-post", "nombre": "RRSS Post", "categoria": "DIGITAL", "activo": True}],
                "DIGITAL",
            ),
            "formats_impreso": {},
        }

    def source_row(self):
        return {header: None for header in simulate_import.EXPECTED_HEADERS}

    def test_fingerprint_covers_every_source_cell(self):
        row = {header: None for header in simulate_import.EXPECTED_HEADERS}
        first = simulate_import.row_fingerprint(simulate_import.EXPECTED_HEADERS, row)
        row["¿Qué se imprime? 2"] = "Avisos"
        second = simulate_import.row_fingerprint(simulate_import.EXPECTED_HEADERS, row)
        self.assertNotEqual(first, second)

    def test_fingerprint_is_stable_for_same_row(self):
        row = {header: None for header in simulate_import.EXPECTED_HEADERS}
        self.assertEqual(
            simulate_import.row_fingerprint(simulate_import.EXPECTED_HEADERS, row),
            simulate_import.row_fingerprint(simulate_import.EXPECTED_HEADERS, row),
        )

    def test_quantity_parser_only_accepts_unambiguous_values(self):
        self.assertEqual(simulate_import.parse_quantity("3 piezas"), 3)
        self.assertEqual(simulate_import.parse_quantity("una"), 1)
        self.assertIsNone(simulate_import.parse_quantity("varias piezas"))
        self.assertIsNone(simulate_import.parse_quantity("1 para diferentes formatos"))

    def test_simulation_report_excludes_sensitive_values(self):
        row = {header: None for header in simulate_import.EXPECTED_HEADERS}
        row["Marca temporal"] = "45956.5"
        row["Nombre de arte/flyer"] = "Solicitud de prueba"
        row["Responsble"] = "Nombre privado de prueba"
        row["Dirección de correo electrónico"] = "privado@example.invalid"
        with tempfile.NamedTemporaryFile() as workbook:
            workbook.write(b"synthetic fixture")
            workbook.flush()
            with patch.object(
                simulate_import,
                "read_workbook",
                return_value=(list(simulate_import.EXPECTED_HEADERS), [row], [2]),
            ):
                report = simulate_import.simulate(Path(workbook.name))

        self.assertEqual(report["filas_origen"], 1)
        self.assertEqual(sum(report["resultados"].values()), 1)
        self.assertTrue(all(report["no_escrituras"].values()))
        serialized = str(report)
        self.assertNotIn("Dirección de correo electrónico", report["valores_categoricos_seguros"])
        self.assertNotIn("Responsble", report["cobertura_campos_sin_datos_personales"])
        self.assertNotIn("Diseñador", report["cobertura_campos_sin_datos_personales"])
        self.assertNotIn("solicitante_usuario_id", serialized)
        self.assertNotIn("Nombre privado de prueba", serialized)
        self.assertNotIn("privado@example.invalid", serialized)

    def test_caracas_timestamp_conversion(self):
        converted = simulate_import.excel_datetime("45956.5")
        self.assertIsNotNone(converted)
        self.assertEqual(str(converted.tzinfo), "America/Caracas")

    def test_normalize_row_maps_a_complete_request_and_deliverable(self):
        row = self.source_row()
        row.update({
            "Marca temporal": "45956.5",
            "Fecha de entrega": "45957",
            "Nombre de arte/flyer": "  Arte   de prueba ",
            "¿Qué se publica?": "RRSS Post",
            "Prioridad": "Normal",
            "Estatus": "Terminado",
            "Fecha de termino": "45958",
            "¿A que medio pertenece?": "Digital",
        })

        result, warnings, errors, request, deliverables = import_requests.normalize_row(
            row, self.catalogs, "a" * 64
        )

        self.assertEqual(result, "IMPORTADA")
        self.assertEqual(warnings, [])
        self.assertEqual(errors, [])
        self.assertEqual(request["titulo"], "Arte de prueba")
        self.assertFalse(request["requiere_revision"])
        self.assertEqual(len(deliverables), 1)
        self.assertEqual(deliverables[0]["formato_id"], "format-post")
        self.assertEqual(deliverables[0]["campo_origen"], "PUBLICACION_PRINCIPAL")
        self.assertEqual(deliverables[0]["categoria"], "DIGITAL")

    def test_normalize_row_preserves_unknown_values_and_marks_review(self):
        row = self.source_row()
        row.update({
            "Marca temporal": "45956.5",
            "Nombre de arte/flyer": "Solicitud privada de prueba",
            "Responsble": "Solicitante ficticio",
            "¿Qué se publica?": "Formato no catalogado",
            "¿A que medio pertenece?": "Digital",
            "Dirección de correo electrónico": "example.invalid",
        })

        result, warnings, _, request, deliverables = import_requests.normalize_row(
            row, self.catalogs, "b" * 64
        )

        self.assertEqual(result, "IMPORTADA_PARCIAL")
        self.assertEqual(deliverables, [])
        self.assertEqual(request["solicitante_nombre_original"], "Solicitante ficticio")
        self.assertTrue(request["requiere_revision"])
        self.assertIn("ENTREGABLES_NO_RESUELTOS", request["motivos_revision"])
        self.assertNotIn("Solicitante ficticio", str(warnings))
        self.assertNotIn("example.invalid", str(warnings))

    def test_duplicate_rows_are_imported_with_a_review_warning(self):
        request = {"requiere_revision": False, "motivos_revision": []}
        warnings = []

        result = import_requests.flag_in_file_duplicate("IMPORTADA", warnings, request)

        self.assertEqual(result, "IMPORTADA_PARCIAL")
        self.assertEqual(warnings[0]["codigo"], "POSIBLE_DUPLICADO")
        self.assertTrue(request["requiere_revision"])
        self.assertEqual(request["motivos_revision"], ["POSIBLE_DUPLICADO"])

    def test_real_import_rejects_a_workbook_inside_the_repository(self):
        with self.assertRaisesRegex(import_requests.ImportErrorSafe, "fuera del repositorio"):
            import_requests.run_import(Path(__file__), "00000000-0000-0000-0000-000000000000")

    def test_real_import_posts_each_row_to_the_transactional_rpc(self):
        row = self.source_row()
        row.update({
            "Marca temporal": "45956.5",
            "Nombre de arte/flyer": "Solicitud de prueba",
            "¿Qué se publica?": "RRSS Post",
            "¿A que medio pertenece?": "Digital",
        })
        headers = list(simulate_import.EXPECTED_HEADERS)

        def respond(method, resource, query=None, payload=None):
            if method == "POST" and resource == "solicitud_diseno_importaciones":
                return [{"id": "00000000-0000-0000-0000-000000000001"}]
            if method == "GET" and resource == "catalogo_medios":
                return [{"id": "medium-digital", "nombre": "Digital", "activo": True}]
            if method == "GET" and resource == "catalogo_formatos_entregable":
                return [{
                    "id": "format-post",
                    "nombre": "RRSS Post",
                    "categoria": "DIGITAL",
                    "activo": True,
                }]
            if method == "GET":
                return []
            if method == "POST" and resource == "rpc/import_solicitud_diseno_fila":
                return {"resultado": payload["p_resultado"], "advertencias": payload["p_advertencias"]}
            if method == "PATCH":
                return [{"id": "00000000-0000-0000-0000-000000000001"}]
            self.fail(f"Unexpected mocked request: {method} {resource}")

        with tempfile.NamedTemporaryFile(suffix=".xlsx") as workbook:
            with (
                patch.dict("os.environ", {
                    "NEXT_PUBLIC_SUPABASE_URL": "https://example.invalid",
                    "SUPABASE_SERVICE_ROLE_KEY": "test-service-role-key",
                }),
                patch.object(import_requests, "SupabaseRest") as client_class,
                patch.object(import_requests, "batch_rows", return_value=[]),
                patch.object(
                    simulate_import,
                    "read_workbook",
                    return_value=(headers, [row], [2]),
                ),
            ):
                client_class.return_value.request.side_effect = respond
                report = import_requests.run_import(Path(workbook.name), str(uuid.uuid4()))

        self.assertEqual(report["estado"], "COMPLETADO")
        rpc_call = next(
            call for call in client_class.return_value.request.call_args_list
            if call.args[1] == "rpc/import_solicitud_diseno_fila"
        )
        self.assertEqual(rpc_call.kwargs["payload"]["p_fila_origen"], 2)
        self.assertEqual(rpc_call.kwargs["payload"]["p_resultado"], "IMPORTADA")


if __name__ == "__main__":
    unittest.main()
