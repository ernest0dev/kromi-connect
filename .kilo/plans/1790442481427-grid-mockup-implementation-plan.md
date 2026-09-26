# Plan CORRECCIÓN: Alinear `/social-media/grid` con mockup — brechas pendientes

## Estado actual

Se implementó la mayor parte del plan original. La siguiente tabla resume qué está hecho y qué brechas quedan por corregir:

| Archivo | Estado | Brecha de corrección |
|---|---|---|
| `page.tsx` | ✅ Eyebrow, descripción, summary | 2 — SLA duplica topbar; estilo chips no cards; scope no claro |
| `constants.ts` | ✅ `FORMATO_LABEL_UPPER`, `ESTATUS_STYLE` con dotVar | Sin cambios |
| `utils/sla.ts` | ✅ `dotVar` añadido a SLA_META | Sin cambios |
| `GridHeader.tsx` | ✅ "Formato:" label, focus-visible | 1 — Padding/gap excesivos; parece panel separado |
| `GridCalendar.tsx` | ✅ Legend row, scrollable, weekday header | 3 — Legend describe status no SLA dots; sin distinción explícita |
| `GridCell.tsx` | ✅ HOY badge, dotVar, aria-current | 3 — Dot SLA sin aria-label/sr-only; title genérico |
| `TicketCard.tsx` | ✅ Format abbreviation, role, focus | Sin cambios |
| `TicketDetailCard.tsx` | ✅ Jerarquía card-top→status→SLA→bottom | 6 — Sin label visible "Estado:"; texto "Editando…" redundante en pie |
| `StatusSelect.tsx` | ✅ focus-visible, aria-label | Sin cambios (el label visible lo pone TicketDetailCard) |
| `TicketEditForm.tsx` | ✅ focus-visible, aria-labels, role alert | Sin cambios |
| `GridView.tsx` | ⚠️ Title "Detalle de tickets y fichas de entregables" | 5 — Cambiar a "Publicaciones del mes", descripción debe explicar scope de filtro |

---

## Contexto rápido (ver plan original completo en este mismo archivo, sección 2)

- **Stack**: Next.js 16.3.4 App Router + Turbopack. Tailwind v4 (`@tailwindcss/postcss`) importado en `globals.css`. CSS-in-JS (inline `style` + CSS variables) es el patrón dominante.
- **CSS variables**: `--azul`, `--naranja`, `--verde`, `--gris`, `--tinta`, `--papel`, `--hueso`, `--borde`, `--font-display`, `--font-text`.
- **Hooks**: `useGridState`, `useTicketMutations`, `useDragDrop`, `useSLA` — NO modificar.
- **Server actions**: `ticket-quick-actions.ts`, `recalculateSla.ts` — NO modificar.
- **page.tsx** es SSR (server component) → no tiene acceso a estado interactivo (currentDate, formatoFiltro). Los totales se calculan allí con datos de Supabase.
- **GridView.tsx** es CSR → tiene acceso a `publicacionesFiltradas` (filtradas por formato, pero no por mes).

---

## Correcciones pendientes (ordenadas)

### Corrección 1: GridHeader — Barra compacta

**Archivo**: `components/GridHeader.tsx`

**Problema**: `p-4 rounded-2xl gap-4` hace que filtros y navegación parezcan un panel grande, no una barra compacta como el mockup (`.toolbar` con `padding: 10px 16px`, `gap: 16px`, sin border-radius).

**Cambios**:
1. Reducir padding: `p-4` → `p-3` (12px).
2. Reducir gap entre grupos: `gap-4` → `gap-3` (12px).
3. Reducir radio: `rounded-2xl` → `rounded-xl`.
4. Mantener `flex flex-col lg:flex-row lg:items-center justify-between`.
5. Mantener todos los botones, acciones, labels accesibles y focus-visible rings existentes.
6. En mobile (`lg:flex-row` → `flex-col`): los dos grupos (filtros + month-nav) se apilan verticalmente con `gap-3`.

```tsx
// Antes:
className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl border"
// Después:
className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 rounded-xl border"
```

---

### Corrección 2: page.tsx — Resumen: scope claro + sin duplicar SLA

**Archivo**: `page.tsx`

**Problema**: 
- Muestra 3 chips: totales, SLA vencidos, vence hoy → los SLA duplican el topbar (registrado en `social-media/layout.tsx` que ya muestra "⚠ N vencidos · M hoy").
- Usa estilo de chips, no cards compactas como el mockup (`.metric`).

**Cambios**:
1. **Eliminar** los chips de "SLA vencidos" y "vence hoy" del page header (ya están en el topbar).
2. **Mantener** el total de publicaciones como una **metric card compacta** (no chip):
   ```tsx
   <div className="flex items-end gap-3">
     <div
       className="flex flex-col items-start gap-0.5 px-3 py-1.5 rounded-xl border"
       style={{ background: 'var(--papel)', borderColor: 'var(--borde)' }}
     >
       <b className="text-sm font-bold" style={{ color: 'var(--tinta)' }}>{lista.length}</b>
       <span className="text-[10px]" style={{ color: 'var(--gris)' }}>Publicaciones registradas</span>
     </div>
   </div>
   ```
   - Label "Publicaciones registradas" deja explícito que es el **total** (no el filtrado por mes/filtro).
3. Eliminar el import de `calcularSlaState` (ya no se usa en page.tsx).
4. Mantener eyebrow, h1, descripción, y `<GridView publicacionesIniciales={lista} />`.

**Alternativa considerada**: Mover el resumen a GridView para hacerlo dinámico (mes + filtro). **Descartada** porque:
- page.tsx ya muestra el total de todas las publicaciones (útil como contexto global).
- ElGridView details header ya muestra el conteo filtrado (`{publicacionesFiltradas.length} ítems`).
- Mantener separación: page = scope global, GridView = scope filtrado.

---

### Corrección 3: GridCell + GridCalendar — SLA dot accesible + leyenda explícita

#### 3a. GridCell.tsx — Dot SLA accesible

**Archivo**: `components/GridCell.tsx`

**Problema**: El dot SLA tiene `title={SLA_META[peorEstado].label}` pero no tiene etiqueta accesible (screen readers no leen `title` de forma confiable). La leyenda describe estados de publicación (status) pero el dot representa SLA — ambigüedad.

**Cambios**:
1. Añadir `aria-label` al dot SLA con contexto explícito:
   ```tsx
   <span
     className="h-2 w-2 rounded-full shrink-0"
     style={{ backgroundColor: SLA_META[peorEstado].dotVar }}
     title={`SLA del día: ${SLA_META[peorEstado].label}`}
     aria-label={`Publicaciones de este día: ${SLA_META[peorEstado].label}`}
     role="img"
   />
   ```
2. Añadir texto sr-only para contexto: `<span className="sr-only">Indicador SLA: {label}</span>` antes o después del dot.
3. Mantener `aria-current="date"` en el día actual (ya implementado).

#### 3b. GridCalendar.tsx — Leyenda distingue status (cards) de SLA (dots)

**Archivo**: `components/GridCalendar.tsx`

**Problema**: La leyenda actual muestra 4 dots (gris/azul/ámbar/verde) etiquetados como "Pendiente/En proceso/Requiere atención/Aprobado / publicado" — que corresponde a los **colores de las tarjetas** (status). Pero el **dot de cada día** representa **SLA**, no status. Ambigüedad.

**Cambios**:
1. Importar `SLA_META` desde `../utils/sla` para usar los colores de dots reales.
2. Dividir la leyenda en **dos grupos claros**:
   ```
   [● gris] Pendiente  [● azul] En proceso  [● ámbar] Requiere atención  [● verde] Aprobado / publicado   ← color de las tarjetas
   [● rojo] SLA vencido  [● ámbar] Brief próximo   ← color del dot en la esquina de cada día
   💡 Arrastra una publicación para cambiar su fecha
   ```
3. Añadir encabezado visible o sr-only: "Color de las publicaciones" para el primer grupo, "Indicador SLA del día" para el segundo.
4. Mantener `aria-label="Calendario mensual"` en el section.

Código target:
```tsx
<div className="border-t" style={{ borderColor: 'var(--borde)' }}>
  {/* Grupo 1: colores de tarjetas (estatus) */}
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1.5 text-[11px]" style={{ color: 'var(--gris)' }}>
    <span className="font-semibold" style={{ color: 'var(--gris)' }}>Publicación:</span>
    {statusLegend.map(...)}
  </div>
  {/* Grupo 2: dots SLA del día */}
  <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 px-3 py-1 text-[10px] italic" style={{ color: 'var(--gris)' }}>
    <span className="font-semibold" style={{ color: 'var(--gris)' }}>Día:</span>
    <span className="flex items-center gap-1">
      <span className="h-2 w-2 rounded-full" style={{ background: SLA_META['vencido'].dotVar }} aria-hidden="true" />
      SLA vencido
    </span>
    <span className="flex items-center gap-1">
      <span className="h-2 w-2 rounded-full" style={{ background: SLA_META['hoy'].dotVar }} aria-hidden="true" />
      Brief próximo / hoy
    </span>
    <span className="flex items-center gap-1 lg:ml-auto">
      Arrastra una publicación para cambiar su fecha
    </span>
  </div>
</div>
```

---

### Corrección 4: GridCalendar — Scroll horizontal + alineación (verificado)

**Archivo**: `components/GridCalendar.tsx`

**Estado**: El inner grid ya tiene `overflow-x-auto` + `min-w-[700px]`. ✅
- **Sin cambios**. La corrección 3b incluye el legend; el scroll ya está implementado.

---

### Corrección 5: GridView.tsx — Título y descripción de la sección

**Archivo**: `GridView.tsx`

**Problema**: Título "Detalle de tickets y fichas de entregables" es genérico y no orientado al contenido. La descripción no explica el scope (mes + filtro).

**Cambios**:
1. Cambiar título: "Detalle de tickets y fichas de entregables" → **"Publicaciones"** (o "Publicaciones del mes").
2. Actualizar descripción para explicar scope y acciones:
   > "Muestra las publicaciones que coinciden con el filtro de formato. Selecciona una ficha para cambiar su estatus, editar el título y la fecha, o acceder a los assets de Google Drive."
3. El contador de ítems (`{publicacionesFiltradas.length} ítems`) ya existe — cambiar "ítems" → "publicaciones" para ser más explícito.
4. Mantener la grid de cards: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`.
5. Mantener todo el wiring de hooks y props.

---

### Corrección 6: TicketDetailCard.tsx — Label estado + eliminar "Editando…" + diferenciar fechas

**Archivo**: `components/TicketDetailCard.tsx`

**Problema**:
- StatusSelect no tiene label visible de "Estado:" (accesible sí, vía aria-label, pero no visible).
- Cuando `isEditing`, se muestra "Editando…" en el card-bottom además del formulario con Guardar/Cancelar → redundante.
- fecha_publicacion y fecha_limite_brief están en secciones distintas pero podrían diferenciarse mejor.

**Cambios**:
1. **Añadir label visible "Estado:"** antes del StatusSelect:
   ```tsx
   <div className="flex items-center gap-2">
     <span className="text-[10px] font-semibold" style={{ color: 'var(--gris)' }}>Estado:</span>
     <StatusSelect currentStatus={publicacion.estatus} onChange={onStatusChange} />
   </div>
   ```
2. **Eliminar el texto "Editando…"** del card-bottom. Cuando `isEditing`, ocultar el botón "Editar" y mostrar solo el acceso a assets:
   ```tsx
   <div className="flex items-center justify-between gap-2 pt-2.5 mt-0.5 border-t" style={{ borderColor: 'var(--borde)' }}>
     {!isEditing && (
       <button onClick={onStartEdit} aria-label="Editar título y fecha" ...>
         <Pencil size={12} aria-hidden="true" /> Editar
       </button>
     )}
     {publicacion.drive_folder_url ? (<a>Ver assets</a>) : (<span>Sin carpeta vinculada</span>)}
   </div>
   ```
   - Durante edición: el formulario (TicketEditForm) ya comunica el estado con sus botones Guardar/Cancelar.
3. **Diferenciar fechas mejor**:
   - card-top: "Publicación" + `formatDate(fecha_publicacion)` → ya existe, mantener.
   - SLA block: "Fecha límite del brief" + `formatDate(fecha_limite_brief)` → ya existe, mantener.
   - Añadir `aria-label` a diferenciar: `aria-label="Fecha de publicación: {fecha}"` y `aria-label="Fecha límite del brief: {fecha}"`.

---

## 7. Archivos NO modificar (confirmar)

- `src/app/actions/publicaciones/*` (server actions)
- `src/app/(dashboard)/social-media/grid/hooks/*` (todos)
- `src/app/(dashboard)/social-media/layout.tsx` (topbar)
- `src/app/(dashboard)/layout.tsx` (shell)
- `src/app/(dashboard)/components/*` (SocialMediaShell, ShellSlot)
- `src/app/globals.css` (a menos que sea estrictamente necesario)
- `src/types/*` (modelo de datos)
- `src/utils/sla.ts` (calcularMatrizSLA)

## 8. Archivos a modificar (resumen)

| Archivo | Corrección | Cambios clave |
|---|---|---|
| `page.tsx` | 2 | Eliminar chips SLA; 1 metric card con label "Publicaciones registradas"; eliminar import calcularSlaState |
| `GridHeader.tsx` | 1 | p-4→p-3, gap-4→gap-3, rounded-2xl→rounded-xl; mantener labels/focus |
| `GridCalendar.tsx` | 3 | Importar SLA_META; dividir leyenda en "Publicación:" (status) + "Día:" (SLA dots); mantener scrollable |
| `GridCell.tsx` | 3 | aria-label + role="img" en dot SLA; sr-only text; title contextual |
| `GridView.tsx` | 5 | Título → "Publicaciones"; descripción con scope de filtro; "ítems"→"publicaciones" |
| `TicketDetailCard.tsx` | 6 | Label visible "Estado:"; eliminar "Editando…" text; card-bottom condicional con isEditing |

## 9. Validación

1. **Typecheck**: `npx tsc --noEmit` — sin errores.
2. **Build**: `npx next build` (si está disponible) — exitoso.
3. **Visual**:
   - Header: eyebrow + h1 + descripción + 1 metric card (total, label claro).
   - Toolbar: compacto, filtros y month-nav en una sola barra.
   - Calendario: HOY badge, dots SLA con aria-label, leyenda 2-partes, scroll horizontal en mobile.
   - Cards: jerarquía card-top (format badge + fecha) → title → estado → SLA → edit/assets.
4. **Accesibilidad**: focus-visible en controles; `aria-current="date"` en HOY; `aria-label` en dots SLA y botones.
5. **No duplicación**: SLA indicator solo en topbar, no en page header.
