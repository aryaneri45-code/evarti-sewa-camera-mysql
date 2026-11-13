import { encodeRaster, printGeometry } from './receipt-encoder.js';

export async function renderReceiptRaster(transaction, variant, paperWidth) {
  const key = String(transaction.id || transaction.receiptNo);
  const root = [...document.querySelectorAll('.receipt-print-root')].find(element =>
    element.dataset.receiptId === key && element.dataset.receiptVariant === variant && Number(element.dataset.paperWidth) === Number(paperWidth));
  const papers = [...(root?.querySelectorAll('.receipt-paper') || [])];
  if (!papers.length) throw new Error('Pratinjau struk belum siap. Buka kembali struk lalu coba cetak.');

  await document.fonts.ready;
  for (const image of root.querySelectorAll('img')) {
    try { await image.decode(); }
    catch { throw new Error('Logo struk belum berhasil dimuat. Muat ulang halaman lalu coba cetak.'); }
    if (!image.naturalWidth) throw new Error('Logo struk tidak tersedia. Muat ulang halaman lalu coba cetak.');
  }
  if (!root.isConnected) throw new Error('Halaman struk telah ditutup. Buka kembali struk lalu coba cetak.');

  const { default: html2canvas } = await import('html2canvas');
  const geometry = printGeometry(paperWidth);
  const scale = 8 * 25.4 / 96; // 203 dpi thermal heads: 8 dots/mm.
  const chunks = [];
  // Capture bounded sections so long reports cannot exceed canvas height limits.
  for (const [index, paper] of papers.entries()) {
    if (!root.isConnected) throw new Error('Halaman struk telah ditutup. Buka kembali struk lalu coba cetak.');
    chunks.push(await renderPaper(paper, root, html2canvas, geometry, scale, {
      initialize: index === 0, feed: index === papers.length - 1,
    }));
  }
  const bytes = new Uint8Array(chunks.reduce((length, chunk) => length + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

async function renderPaper(paper, root, html2canvas, geometry, scale, options) {
  const bounds = paper.getBoundingClientRect();
  const styles = getComputedStyle(paper);
  const leftPadding = parseFloat(styles.paddingLeft);
  const rightPadding = parseFloat(styles.paddingRight);
  const canvas = await html2canvas(paper, {
    scale, backgroundColor: '#ffffff', logging: false, scrollX: 0, scrollY: 0,
    // Clone only this section, rather than the workspace and every other
    // section of a long report, for each image capture.
    ignoreElements: (element) =>
      (element.parentElement === document.body && element !== root) ||
      (element.classList.contains('receipt-paper') && element !== paper),
    onclone: (clonedDocument) => {
      const clone = [...clonedDocument.querySelectorAll('.receipt-print-root')].find(element =>
        element.dataset.receiptId === root.dataset.receiptId && element.dataset.receiptVariant === root.dataset.receiptVariant);
      clone.style.left = '0';
      clone.style.visibility = 'visible';
    },
  });

  // A 58 mm roll has a 48 mm head. Side margins are supplied by the hardware.
  const printable = document.createElement('canvas');
  printable.width = geometry.dots;
  printable.height = canvas.height;
  const context = printable.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, printable.width, printable.height);
  context.drawImage(canvas, leftPadding * scale, 0, (bounds.width - leftPadding - rightPadding) * scale, canvas.height,
    0, 0, printable.width, printable.height);
  return encodeRaster(context.getImageData(0, 0, printable.width, printable.height), options);
}
