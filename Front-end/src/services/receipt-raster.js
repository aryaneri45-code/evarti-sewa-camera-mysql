import { encodeRaster, printGeometry } from './receipt-encoder.js';

export async function renderReceiptRaster(transaction, variant, paperWidth) {
  const key = String(transaction.id || transaction.receiptNo);
  const root = [...document.querySelectorAll('.receipt-print-root')].find(element =>
    element.dataset.receiptId === key && element.dataset.receiptVariant === variant && Number(element.dataset.paperWidth) === Number(paperWidth));
  const paper = root?.querySelector('.receipt-paper');
  if (!paper) throw new Error('Pratinjau struk belum siap. Buka kembali struk lalu coba cetak.');

  await document.fonts.ready;
  for (const image of paper.querySelectorAll('img')) {
    try { await image.decode(); }
    catch { throw new Error('Logo struk belum berhasil dimuat. Muat ulang halaman lalu coba cetak.'); }
    if (!image.naturalWidth) throw new Error('Logo struk tidak tersedia. Muat ulang halaman lalu coba cetak.');
  }
  if (!root.isConnected) throw new Error('Halaman struk telah ditutup. Buka kembali struk lalu coba cetak.');

  const { default: html2canvas } = await import('html2canvas');
  const geometry = printGeometry(paperWidth);
  const scale = 8 * 25.4 / 96; // 203 dpi thermal heads: 8 dots/mm.
  const bounds = paper.getBoundingClientRect();
  const styles = getComputedStyle(paper);
  const leftPadding = parseFloat(styles.paddingLeft);
  const rightPadding = parseFloat(styles.paddingRight);
  const canvas = await html2canvas(paper, {
    scale, backgroundColor: '#ffffff', logging: false, scrollX: 0, scrollY: 0,
    onclone: (clonedDocument) => {
      const clone = [...clonedDocument.querySelectorAll('.receipt-print-root')].find(element =>
        element.dataset.receiptId === key && element.dataset.receiptVariant === variant);
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
  return encodeRaster(context.getImageData(0, 0, printable.width, printable.height));
}
