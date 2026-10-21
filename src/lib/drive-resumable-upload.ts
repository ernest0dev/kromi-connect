export async function getUploadOffset(uri: string, size: number) {
  return new Promise<number>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uri); xhr.setRequestHeader('Content-Range', `bytes */${size}`);
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201) return resolve(size);
      if (xhr.status !== 308) return reject(new Error(`Drive respondió ${xhr.status} al reanudar.`));
      const match = xhr.getResponseHeader('Range')?.match(/bytes=0-(\d+)/); resolve(match ? Number(match[1]) + 1 : 0);
    };
    xhr.onerror = () => reject(new Error('No se pudo consultar la sesión de Drive.')); xhr.send();
  });
}

export async function uploadFile(file: File, uri: string, mime: string, signal: AbortSignal, onProgress: (value: number) => void, resume = false) {
  const chunk = 8 * 1024 * 1024; let offset = resume ? await getUploadOffset(uri, file.size) : 0;
  while (offset < file.size) {
    if (signal.aborted) throw new DOMException('Carga cancelada', 'AbortError');
    const end = Math.min(offset + chunk, file.size);
    try {
      offset = await new Promise<number>((resolve, reject) => {
        const xhr = new XMLHttpRequest(); const abort = () => xhr.abort(); signal.addEventListener('abort', abort, { once: true });
        xhr.open('PUT', uri); xhr.setRequestHeader('Content-Type', mime); xhr.setRequestHeader('Content-Range', `bytes ${offset}-${end - 1}/${file.size}`);
        xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.min(99, Math.round((offset + event.loaded) / file.size * 100))); };
        xhr.onload = () => { signal.removeEventListener('abort', abort); if (xhr.status === 200 || xhr.status === 201) return resolve(file.size); if (xhr.status === 308) { const match = xhr.getResponseHeader('Range')?.match(/bytes=0-(\d+)/); if (!match) return reject(new Error('Drive no confirmó el rango recibido.')); return resolve(Math.min(file.size, Number(match[1]) + 1)); } reject(new Error(`Drive respondió ${xhr.status}.`)); };
        xhr.onerror = () => { signal.removeEventListener('abort', abort); reject(new Error('No se pudo conectar con Drive. Revisa CORS del dominio.')); };
        xhr.onabort = () => { signal.removeEventListener('abort', abort); reject(new DOMException('Carga cancelada', 'AbortError')); }; xhr.send(file.slice(offset, end));
      });
    } catch (cause) { if (cause instanceof DOMException && cause.name === 'AbortError') throw cause; const confirmed = await getUploadOffset(uri, file.size).catch(() => offset); if (confirmed <= offset) throw cause; offset = confirmed; }
    onProgress(Math.min(99, Math.round(offset / file.size * 100)));
  }
}
