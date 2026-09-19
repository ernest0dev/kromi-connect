"use client";

import { useState } from "react";
import { createPostWithDriveAction } from "@/app/actions/publicaciones/create";

export default function TestActionPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleTestSubmit = async () => {
    setLoading(true);
    setResult(null);

    const testPayload = {
      titulo: `Publicacion_Test_${Date.now()}`,
      formato: "REEL" as const,
      linea_contenido: "Promocional",
      fecha_publicacion: "2026-10-01",
      hook_texto: "Hook de prueba",
      body_texto: "Este es un texto de prueba para el ticket de contenido.",
      cta_texto: "Compra ahora",
      hashtags: ["#prueba", "#kromiconnect"],
    };

    const response = await createPostWithDriveAction(testPayload);
    setResult(response);
    setLoading(false);
  };

  return (
    <main
      style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: "600px" }}
    >
      <h1>Prueba de Server Action: Crear Publicación</h1>
      <p>
        Este test intentará crear una fila en Supabase y generar su carpeta en
        Google Drive.
      </p>

      <button
        onClick={handleTestSubmit}
        disabled={loading}
        style={{
          padding: "0.75rem 1.5rem",
          backgroundColor: loading ? "#ccc" : "#0070f3",
          color: "#fff",
          border: "none",
          borderRadius: "5px",
          cursor: loading ? "not-allowed" : "pointer",
          fontSize: "1rem",
        }}
      >
        {loading ? "Ejecutando prueba..." : "Ejecutar Prueba de Inserción"}
      </button>

      {result && (
        <div style={{ marginTop: "2rem" }}>
          <h3>Resultado de la ejecución:</h3>
          <pre
            style={{
              padding: "1rem",
              backgroundColor: "#f4f4f4",
              borderRadius: "5px",
              overflowX: "auto",
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
          {result.success && result.data?.drive_folder_url && (
            <p>
              <strong>Carpeta de Google Drive creada: </strong>
              <a
                href={result.data.drive_folder_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir carpeta en Drive
              </a>
            </p>
          )}
        </div>
      )}
    </main>
  );
}
