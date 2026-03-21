// PDF.js standalone build from CDN
const script = document.createElement('script');
script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
script.onload = () => {
  // Set up the worker source
  const workerScript = document.createElement('script');
  workerScript.type = 'application/javascript';
  workerScript.text = `
    pdfjsLib.GlobalWorkerOptions.workerSrc = '${self.location.origin}/pdf.worker.min.mjs';
  `;
  document.head.appendChild(workerScript);
  console.log('PDFJS loaded and configured');
};
document.head.appendChild(script);
