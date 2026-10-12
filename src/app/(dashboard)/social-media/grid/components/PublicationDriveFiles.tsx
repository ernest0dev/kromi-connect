'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, FileText, Loader2, RefreshCw, UploadCloud } from 'lucide-react';
import { cancelPublicacionBriefUploadAction, finishPublicacionBriefUploadAction, listPublicacionBriefFilesAction, resumePublicacionBriefUploadAction, startPublicacionBriefUploadAction } from '@/app/actions/publicaciones/drive';
import type { DriveBriefFile } from '@/lib/googleDrive';

type UploadRow = { name: string; progress: number; error?: string; uploadId?: string; sessionUri?: string; file?: File; mimeType?: string; size?: number };
const ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf,.mp4';
const mimeByExtension: Record<string,string> = { '.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.pdf':'application/pdf','.mp4':'video/mp4' };
function formatSize(bytes: number) { return bytes < 1024*1024 ? `${Math.max(1,Math.round(bytes/1024))} KB` : `${(bytes/1024/1024).toFixed(1)} MB`; }
function formatDate(value: string) { if (!value) return 'Fecha no disponible'; const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : new Intl.DateTimeFormat('es-VE',{day:'numeric',month:'short',year:'numeric',timeZone:'America/Caracas'}).format(date); }

async function queryResumeOffset(uri: string, size: number) {
  return new Promise<number>((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('PUT',uri);xhr.setRequestHeader('Content-Range',`bytes */${size}`);xhr.onload=()=>{if(xhr.status===200||xhr.status===201){resolve(size);return;}if(xhr.status!==308){reject(new Error(`Drive respondió ${xhr.status} al consultar la sesión.`));return;}const range=xhr.getResponseHeader('Range');const match=range?.match(/bytes=0-(\d+)/);resolve(match?Number(match[1])+1:0);};xhr.onerror=()=>reject(new Error('No se pudo consultar el estado de la sesión resumible.'));xhr.send();});
}
async function uploadResumable(file: File, uri: string, onProgress: (percent:number)=>void, signal: AbortSignal, resume = false) {
  const chunkSize = 8 * 1024 * 1024;
  let offset = resume ? await queryResumeOffset(uri,file.size) : 0;
  if(offset>=file.size)return;
  while (offset < file.size) {
    if (signal.aborted) throw new DOMException('Carga cancelada','AbortError');
    const end = Math.min(offset + chunkSize, file.size);
    await new Promise<void>((resolve,reject) => {
      const xhr = new XMLHttpRequest();
      const abort = () => xhr.abort();
      signal.addEventListener('abort',abort,{once:true});
      xhr.open('PUT',uri);
      xhr.setRequestHeader('Content-Type',file.type);
      xhr.setRequestHeader('Content-Range',`bytes ${offset}-${end-1}/${file.size}`);
      xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.min(99,Math.round((offset+event.loaded)/file.size*100))); };
      xhr.onload = () => { signal.removeEventListener('abort',abort); if (xhr.status >= 200 && xhr.status < 300) { offset=end; resolve(); } else reject(new Error(`Drive respondió ${xhr.status}.`)); };
      xhr.onerror = () => { signal.removeEventListener('abort',abort); reject(new Error('El navegador no pudo conectar con Drive. Comprueba CORS del dominio de la aplicación.')); };
      xhr.onabort = () => { signal.removeEventListener('abort',abort); reject(new DOMException('Carga cancelada','AbortError')); };
      xhr.send(file.slice(offset,end));
    });
    onProgress(Math.min(99,Math.round(offset/file.size*100)));
  }
}

export function PublicationDriveFiles({ publicationId, canUpload = true, title = 'Archivos del brief', onBriefState }: { publicationId: string; canUpload?: boolean; title?: string; onBriefState?: (count:number,checkedAt:string)=>void }) {
  const [files,setFiles] = useState<DriveBriefFile[]>([]);
  const [folderUrl,setFolderUrl] = useState('');
  const [count,setCount] = useState(0);
  const [loading,setLoading] = useState(true);
  const [pending,setPending] = useState(false);
  const [error,setError] = useState('');
  const [uploads,setUploads] = useState<UploadRow[]>([]);
  const [refresh,setRefresh] = useState(0);
  const controllers = useRef(new Map<string,AbortController>());
  const onBriefStateRef=useRef(onBriefState);
  useEffect(()=>{onBriefStateRef.current=onBriefState;},[onBriefState]);

  const resumeUpload = async (rowIndex:number, override?:UploadRow) => {
    const row=override||uploads[rowIndex]; if(!row?.uploadId||!row.sessionUri||!row.file)return;
    const controller=new AbortController();controllers.current.set(row.uploadId,controller);
    setUploads((rows)=>rows.map((item,index)=>index===rowIndex?{...item,error:undefined}:item));
    try{await uploadResumable(row.file,row.sessionUri,(progress)=>setUploads((rows)=>rows.map((item,index)=>index===rowIndex?{...item,progress}:item)),controller.signal,true);const finished=await finishPublicacionBriefUploadAction(row.uploadId);if(!finished.success)throw new Error(finished.error);setUploads((rows)=>rows.map((item,index)=>index===rowIndex?{...item,progress:100,error:undefined,uploadId:undefined,sessionUri:undefined,file:undefined}:item));await load();}
    catch(cause){if(cause instanceof DOMException&&cause.name==='AbortError')await cancelPublicacionBriefUploadAction(row.uploadId);setUploads((rows)=>rows.map((item,index)=>index===rowIndex?{...item,error:cause instanceof Error?cause.message:'Falló la carga.'}:item));}
    finally{controllers.current.delete(row.uploadId);}
  };

  const resumeAfterReselect=async(rowIndex:number,file:File)=>{
    const row=uploads[rowIndex];if(!row?.uploadId)return;
    const mime=file.type||mimeByExtension[file.name.slice(file.name.lastIndexOf('.')).toLowerCase()];
    if(file.name!==row.name||file.size!==row.size||mime!==row.mimeType){setUploads((rows)=>rows.map((item,index)=>index===rowIndex?{...item,error:'Selecciona el mismo archivo, con igual nombre, tamaño y tipo.'}:item));return;}
    const result=await resumePublicacionBriefUploadAction(row.uploadId);
    if(!result.success){setUploads((rows)=>rows.map((item,index)=>index===rowIndex?{...item,error:result.error||'No se pudo reanudar la carga.'}:item));return;}
    const resumable={...row,file,sessionUri:result.data.sessionUri,error:undefined};
    setUploads((rows)=>rows.map((item,index)=>index===rowIndex?resumable:item));
    await resumeUpload(rowIndex,resumable);
  };

  const cancelUpload = async (uploadId:string) => { const controller=controllers.current.get(uploadId);if(controller){controller.abort();return;}const result=await cancelPublicacionBriefUploadAction(uploadId);if(result.success){setUploads((rows)=>rows.map((row)=>row.uploadId===uploadId?{...row,uploadId:undefined,sessionUri:undefined,file:undefined,error:undefined}:row));await load();}else setUploads((rows)=>rows.map((row)=>row.uploadId===uploadId?{...row,error:result.error}:row)); };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const result = await listPublicacionBriefFilesAction(publicationId);
    if (result.success) { setFiles(result.data.files); setCount(result.data.count); setFolderUrl(result.data.folderUrl); onBriefStateRef.current?.(result.data.count,result.data.checkedAt); setUploads((current)=>{const known=new Set(current.map((row)=>row.uploadId));return [...current,...result.data.pendingUploads.filter((item:{id:string;name:string;mimeType:string;size:number;expiresAt:string})=>!known.has(item.id)).map((item:{id:string;name:string;mimeType:string;size:number;expiresAt:string})=>({name:item.name,progress:0,error:'Carga interrumpida. Selecciona el mismo archivo para reanudar.',uploadId:item.id,mimeType:item.mimeType,size:item.size}))];}); }
    else setError(result.error || 'No se pudo cargar la lista de Drive.');
    setLoading(false);
  },[publicationId]);
  useEffect(()=>{ void load(); },[load,refresh]);

  const onChooseFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setPending(true); setError('');
    const selected = Array.from(list);
    for (const [position,file] of selected.entries()) {
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      const mime = file.type || mimeByExtension[ext];
      if (mimeByExtension[ext] !== mime) { setUploads((rows)=>[...rows,{name:file.name,progress:0,error:'Tipo de archivo no permitido.'}]); continue; }
      const started = await startPublicacionBriefUploadAction({publicationId,name:file.name,mimeType:mime,size:file.size});
      if (!started.success) { setUploads((rows)=>[...rows,{name:file.name,progress:0,error:started.error}]); continue; }
      const controller = new AbortController();
      const rowIndex = uploads.length + position;
      controllers.current.set(started.data.uploadId,controller);
      setUploads((rows)=>[...rows,{name:file.name,progress:0,uploadId:started.data.uploadId,sessionUri:started.data.sessionUri,file,mimeType:mime,size:file.size}]);
      try {
        await uploadResumable(file,started.data.sessionUri,(progress)=>setUploads((rows)=>rows.map((row,index)=>index===rowIndex?{...row,progress}:row)),controller.signal);
        const finished = await finishPublicacionBriefUploadAction(started.data.uploadId);
        if (!finished.success) throw new Error(finished.error);
        setUploads((rows)=>rows.map((row,index)=>index===rowIndex?{...row,progress:100,uploadId:undefined,sessionUri:undefined,file:undefined}:row));
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') await cancelPublicacionBriefUploadAction(started.data.uploadId);
        setUploads((rows)=>rows.map((row,index)=>index===rowIndex?{...row,error:cause instanceof Error?cause.message:'Falló la carga.'}:row));
      } finally {
        controllers.current.delete(started.data.uploadId);
      }
    }
    setPending(false); setRefresh((value)=>value+1);
  };

  return <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" aria-label={title}>
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-bold text-slate-900">{title}</h3><p className="mt-0.5 text-xs text-slate-500">{count}/10 archivos · JPG, PNG, WebP, PDF o MP4 · hasta 100 MB c/u</p></div><button type="button" onClick={()=>setRefresh((value)=>value+1)} disabled={loading} aria-label="Actualizar lista" className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-50"><RefreshCw size={15} className={loading?'animate-spin':''}/></button></div>
    {canUpload && count < 10 && <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50 px-4 py-4 text-sm font-semibold text-blue-800 ${pending?'pointer-events-none opacity-60':''}`}><UploadCloud size={18}/>{pending?'Subiendo archivo…':'Seleccionar archivos'}<input type="file" accept={ACCEPT} multiple hidden disabled={pending} onChange={(event)=>{void onChooseFiles(event.currentTarget.files); event.currentTarget.value='';}}/></label>}
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">{error}</p>}
    {uploads.map((upload,index)=><div key={`${upload.name}-${index}`} className="rounded-lg bg-slate-50 p-2 text-xs"><div className="flex items-center justify-between gap-2"><span className="truncate font-medium text-slate-800">{upload.name}</span><span className="flex items-center gap-2">{upload.error?<span className="text-red-700">{upload.error}</span>:<span className="text-slate-500">{upload.progress}%</span>}{upload.uploadId&&<>{upload.error&&upload.file&&<button type="button" onClick={()=>void resumeUpload(index)} className="font-semibold text-blue-700 underline">Reanudar</button>}{upload.error&&!upload.file&&<label className="cursor-pointer font-semibold text-blue-700 underline">Seleccionar para reanudar<input type="file" accept={ACCEPT} hidden onChange={(event)=>{const file=event.currentTarget.files?.[0];if(file)void resumeAfterReselect(index,file);event.currentTarget.value='';}}/></label>}<button type="button" onClick={()=>void cancelUpload(upload.uploadId!)} className="font-semibold text-slate-600 underline">Cancelar</button></>}</span></div>{!upload.error&&<div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-blue-700 transition-all" style={{width:`${upload.progress}%`}}/></div>}</div>)}
    {loading?<p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin"/>Consultando Drive…</p>:files.length?<ul className="divide-y divide-slate-100">{files.map((file)=><li key={file.id} className="flex items-center justify-between gap-3 py-2"><span className="flex min-w-0 items-center gap-2"><FileText size={16} className="shrink-0 text-slate-500"/><span className="min-w-0"><span className="block truncate text-xs font-semibold text-slate-800">{file.name}</span><span className="text-[10px] text-slate-500">{formatSize(file.size)} · {formatDate(file.createdTime)}</span></span></span>{file.webViewLink&&<a href={file.webViewLink} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-blue-700">Abrir <ExternalLink size={12}/></a>}</li>)}</ul>:!error?<p className="text-xs text-slate-500">Faltan archivos para enviar el brief a Design.</p>:null}
    {folderUrl&&<a href={folderUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">Ver carpeta en Drive <ExternalLink size={11}/></a>}
  </section>;
}
