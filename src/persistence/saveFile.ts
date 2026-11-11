/** Dispara o download de um arquivo no navegador. */
export const downloadBlob = (data: BlobPart, filename: string, type = 'application/octet-stream'): void => {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Abre o seletor de arquivos e devolve o arquivo escolhido. */
export const pickFile = (accept: string): Promise<File | null> =>
  new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = accept;
    inp.style.display = 'none';
    inp.onchange = () => {
      const f = inp.files?.[0] ?? null;
      inp.remove();
      resolve(f);
    };
    inp.addEventListener('cancel', () => {
      inp.remove();
      resolve(null);
    });
    document.body.appendChild(inp);
    inp.click();
  });

/** Nome do arquivo de save baixado. */
export const saveFileName = (year: number, short: string) => 'prancheta-' + year + '-' + short.toLowerCase() + '.save';
