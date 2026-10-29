'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createGeneralDesignRequestAction, finishGeneralRequestReferenceUploadAction, startGeneralRequestReferenceUploadAction } from '@/app/actions/general-design-requests';
import { uploadFile } from '@/lib/drive-resumable-upload';

const CATEGORIES = ['Carnicería', 'Charcutería', 'Pescadería', 'Víveres', 'Panadería', 'Farmacia', 'Eventos', 'Otros'];
const SCOPES = ['Prebo', 'Mañongo', 'Trigal Sur', 'Trigal Norte', 'Guataparo', 'Castillito', 'San Felipe', 'Online'];
const DEPARTMENTS = ['Mercadeo', 'Operaciones', 'Capital Humano', 'Selección', 'Compras', 'Farmacia', 'Ventas Online'];
const field = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900';
const label = 'block text-sm font-semibold text-slate-800';

export function GeneralRequestForm({ requesterName, requesterRole, today }: { requesterName: string | null; requesterRole: string; today: string }) {
  const router = useRouter(); const [pending, startTransition] = useTransition(); const [error, setError] = useState('');
  const [submissionKey] = useState(() => crypto.randomUUID());
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [type, setType] = useState('DIGITAL'); const [categories, setCategories] = useState<string[]>([]); const [scopes, setScopes] = useState<string[]>([]);
  const toggle = (items: string[], item: string, setter: (value: string[]) => void) => setter(items.includes(item) ? items.filter((value) => value !== item) : [...items, item]);
  const submit = (form: FormData) => {
    setError('');
    if (referenceFiles.length > 10) { setError('Adjunta como máximo 10 archivos de referencia.'); return; }
    const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.mp4']);
    if (referenceFiles.some((file) => !allowedExtensions.has(file.name.slice(file.name.lastIndexOf('.')).toLowerCase()) || file.size > 100 * 1024 * 1024 || file.size === 0)) { setError('Cada referencia debe ser imagen, PDF o MP4 y pesar hasta 100 MB.'); return; }
    const input = { title: String(form.get('title') ?? ''), designType: type, otherType: String(form.get('otherType') ?? ''), instructions: String(form.get('instructions') ?? ''), categories, scopes, department: String(form.get('department') ?? ''), requiredDate: String(form.get('requiredDate') ?? ''), specifications: String(form.get('specifications') ?? ''), submissionKey };
    startTransition(async () => {
      const result = await createGeneralDesignRequestAction(input);
      if (!result.success) { setError(result.error); return; }
      let uploadError = false;
      for (const file of referenceFiles) {
        const upload = await startGeneralRequestReferenceUploadAction({ id: result.id, name: file.name, size: file.size });
        if (!upload.success) { uploadError = true; break; }
        try {
          await uploadFile(file, upload.sessionUri, upload.mimeType, new AbortController().signal, () => undefined);
          const finished = await finishGeneralRequestReferenceUploadAction(upload.uploadId);
          if (!finished.success) { uploadError = true; break; }
        } catch { uploadError = true; break; }
      }
      router.push(`/requests/mine?created=${result.id}${uploadError ? '&uploadError=1' : ''}`);
    });
  };
  const checkGroup = (title: string, values: string[], selected: string[], setter: (value: string[]) => void) => <fieldset><legend className={label}>{title}</legend><div className="mt-2 flex flex-wrap gap-2">{values.map((item) => <label key={item} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${selected.includes(item) ? 'border-blue-700 bg-blue-50 text-blue-900' : 'border-slate-300 text-slate-700'}`}><input type="checkbox" className="sr-only" checked={selected.includes(item)} onChange={() => toggle(selected, item, setter)} />{item}</label>)}</div></fieldset>;
  return <form action={submit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
    <div className="grid gap-3 sm:grid-cols-2"><p className="text-sm text-slate-700"><strong>Solicitante:</strong> {requesterName || 'Usuario autenticado'}</p><p className="text-sm text-slate-700"><strong>Rol:</strong> {requesterRole}</p></div>
    <label className={label}>Título de la solicitud *<input name="title" required maxLength={200} className={field} /></label>
    <div className="grid gap-4 sm:grid-cols-2"><label className={label}>Tipo de diseño *<select value={type} onChange={(event) => setType(event.target.value)} className={field}><option value="DIGITAL">Digital</option><option value="PRINT">Impreso</option><option value="BOTH">Digital e Impreso</option><option value="OTHER">Otro</option></select></label>{type === 'OTHER' && <label className={label}>Describe el tipo *<input name="otherType" required maxLength={120} className={field} /></label>}</div>
    <label className={label}>Descripción e instrucciones *<textarea name="instructions" required maxLength={5000} rows={5} className={field} /></label>
    {checkGroup('Categorías', CATEGORIES, categories, setCategories)}{checkGroup('Sedes o ámbitos (opcional)', SCOPES, scopes, setScopes)}
    <div className="grid gap-4 sm:grid-cols-2"><label className={label}>Departamento *<select name="department" required defaultValue="Mercadeo" className={field}>{DEPARTMENTS.map((item) => <option key={item}>{item}</option>)}</select></label><label className={label}>Fecha requerida *<input type="date" name="requiredDate" min={today} required className={field} /></label></div>
    <p className="-mt-3 text-xs text-slate-500">La fecha de hoy está permitida; Diseño asigna prioridad y no se aplica un plazo mínimo automático.</p>
    <label className={label}>Cantidad o especificaciones adicionales<textarea name="specifications" maxLength={3000} rows={3} className={field} /></label>
    <div><label className={label}>Archivos de referencia (opcional)<input type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf,.mp4" onChange={(event) => setReferenceFiles(Array.from(event.currentTarget.files ?? []))} className={field} /></label><p className="mt-1 text-xs text-slate-500">Hasta 10 archivos de imagen, PDF o video; máximo 100 MB por archivo.</p>{referenceFiles.length > 0 && <ul className="mt-2 space-y-1 text-xs text-slate-600">{referenceFiles.map((file) => <li key={`${file.name}-${file.size}`}>{file.name}</li>)}</ul>}</div>
    <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">La solicitud se guardará mientras se configura su carpeta de Drive. Los archivos de referencia no están disponibles hasta que se habilite esa integración.</p>
    {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
    <div className="flex justify-end"><button disabled={pending} className="rounded-lg bg-blue-800 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{pending ? 'Enviando…' : 'Enviar solicitud'}</button></div>
  </form>;
}
