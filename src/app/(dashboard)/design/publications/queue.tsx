'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, Loader2, PackageCheck, Play } from 'lucide-react';
import type { Publicacion } from '@/types';
import { transitionPublicationAction } from '@/app/actions/publicaciones/workflow';

type PublicationQueueItem = Publicacion & { comments: { id: string; texto: string; tipo: string; creado_en: string }[] };

export function DesignPublicationsQueue({ publications }: { publications: PublicationQueueItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const move = (publication: Publicacion, status: 'EN_DISENO' | 'EN_REVISION_CM') => {
    setPendingId(publication.id);
    setError('');
    startTransition(async () => {
      const result = await transitionPublicationAction({ publicationId: publication.id, status });
      if (!result.success) setError(result.error);
      else router.refresh();
      setPendingId(null);
    });
  };

  if (!publications.length) return <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No hay solicitudes pendientes.</p>;
  return <section className="space-y-3">
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {publications.map((publication) => {
      const busy = isPending && pendingId === publication.id;
      const correction = publication.estatus === 'EN_CORRECCION';
      return <article key={publication.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0 space-y-2">
            <span className={`inline-block rounded-full px-2 py-1 text-[11px] font-semibold ${correction ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900'}`}>{correction ? 'Devuelta con correcciones' : publication.estatus === 'EN_DISENO' ? 'En diseño' : 'Solicitada'}</span>
            <h2 className="text-base font-bold text-slate-900">{publication.titulo}</h2>
            <p className="text-xs text-slate-500">{publication.formato} · Publicación {publication.fecha_publicacion}</p>
            {publication.hook_texto && <p className="text-sm font-semibold text-slate-800">{publication.hook_texto}</p>}
            {publication.body_texto && <p className="whitespace-pre-wrap text-sm text-slate-600">{publication.body_texto}</p>}
            {publication.cta_texto && <p className="text-sm text-slate-600">CTA: {publication.cta_texto}</p>}
            {publication.hashtags?.length ? <p className="text-xs text-blue-700">{publication.hashtags.map((tag) => tag.startsWith('#') ? tag : `#${tag}`).join(' ')}</p> : null}
            {publication.comments.filter((comment) => comment.tipo === 'CORRECCION').map((comment) => <div key={comment.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="text-[10px] font-bold uppercase text-amber-900">Correcciones solicitadas</p><p className="mt-1 whitespace-pre-wrap text-sm text-amber-950">{comment.texto}</p></div>)}
            {publication.drive_folder_url && <a href={publication.drive_folder_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 underline">Abrir carpeta para cargar la pieza <ExternalLink size={12} /></a>}
            {publication.estatus === 'EN_DISENO' && <p className="text-[11px] text-slate-500">Carga el archivo final en Drive. La entrega se habilita cuando la carpeta contiene un archivo.</p>}
          </div>
          <div className="shrink-0">
            {publication.estatus === 'EN_DISENO'
              ? <button type="button" disabled={busy} onClick={() => move(publication, 'EN_REVISION_CM')} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <PackageCheck size={14} />}Entregar pieza final</button>
              : <button type="button" disabled={busy} onClick={() => move(publication, 'EN_DISENO')} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}Abrir solicitud</button>}
          </div>
        </div>
      </article>;
    })}
  </section>;
}
