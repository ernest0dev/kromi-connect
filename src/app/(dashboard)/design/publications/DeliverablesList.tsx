'use client';

import { ExternalLink, FileText, Loader2 } from 'lucide-react';
import type { DriveBriefFile } from '@/lib/googleDrive';

type DriveLists = { briefFiles:DriveBriefFile[];deliverableFiles:DriveBriefFile[];briefUrl:string|null;deliverablesUrl:string|null;error:string|null };
export function DeliverablesList({ data, loading }: { data?:DriveLists;loading:boolean }) {
  const files=(title:string,items:DriveBriefFile[],url:string|null)=> <section className="mt-3"><div className="flex items-center justify-between gap-2"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">{title}</p>{url&&<a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700">Abrir carpeta <ExternalLink size={11}/></a>}</div>{items.length?<ul className="mt-2 space-y-1">{items.map(file=><li key={file.id} className="flex items-center justify-between gap-2 text-xs"><span className="flex min-w-0 items-center gap-1.5 truncate text-slate-700"><FileText size={13} className="shrink-0"/>{file.name}</span>{file.webViewLink&&<a href={file.webViewLink} target="_blank" rel="noreferrer" aria-label={`Abrir ${file.name}`}><ExternalLink size={13} className="text-blue-700"/></a>}</li>)}</ul>:<p className="mt-1 text-xs text-slate-500">No hay archivos.</p>}</section>;
  return <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">{loading?<p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 size={13} className="animate-spin"/>Consultando archivos…</p>:data?.error?<p role="alert" className="text-xs text-red-700">{data.error}</p>:data?<>{files('Brief',data.briefFiles,data.briefUrl)}{files('Entregables',data.deliverableFiles,data.deliverablesUrl)}</>:<p className="text-xs text-slate-500">Sin archivos de Drive asociados.</p>}</div>;
}
