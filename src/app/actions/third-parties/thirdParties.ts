"use server";

const MODULE_UNAVAILABLE = "El módulo de Clientes y Marcas Aliadas está temporalmente no disponible mientras se recupera su esquema de datos.";

export interface Tercero {
  id: string;
  nombre_comercial: string;
  razon_social?: string;
  tipo: "MARCA_ALIADA" | "PROVEEDOR" | "INTERNO";
  contacto_nombre?: string;
  contacto_email?: string;
  contacto_telefono?: string;
  created_at?: string;
}

export async function getThirdPartiesAction() {
  return { success: false, error: MODULE_UNAVAILABLE, data: [] as Tercero[] };
}

export async function createThirdPartyAction(datos: {
  nombre_comercial: string;
  razon_social?: string;
  tipo: "MARCA_ALIADA" | "PROVEEDOR" | "INTERNO";
  contacto_nombre?: string;
  contacto_email?: string;
  contacto_telefono?: string;
}) {
  void datos;
  return { success: false, error: MODULE_UNAVAILABLE };
}
