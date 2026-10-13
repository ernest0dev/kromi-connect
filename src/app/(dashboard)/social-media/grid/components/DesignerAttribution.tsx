'use client';

import { useEffect, useState } from 'react';
import { getPublicationDesignerNameAction } from '@/app/actions/publicaciones/design-drive';

export function DesignerAttribution({ publicationId }: { publicationId: string }) {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => { let alive = true; void getPublicationDesignerNameAction(publicationId).then((result) => { if (alive && result.success) setName(result.name); }); return () => { alive = false; }; }, [publicationId]);
  return name ? <span className="text-xs text-slate-500">Tomada por {name}</span> : null;
}
