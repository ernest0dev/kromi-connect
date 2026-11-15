import { renderToStaticMarkup } from "react-dom/server";
import StagingPage from "@/app/staging/page";

describe("staging page", () => {
  it("renders local fixtures without needing a Supabase client", () => {
    const html = renderToStaticMarkup(<StagingPage />);

    expect(html).toContain("Demostración de solo lectura");
    expect(html).toContain("Lanzamiento de temporada");
    expect(html).toContain("Inventario de activación");
    expect(html).toContain("Solicitud de diseño");
  });
});
