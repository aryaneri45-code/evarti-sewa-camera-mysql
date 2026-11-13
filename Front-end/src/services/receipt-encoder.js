export function printGeometry(paperWidth = 58) {
  return Number(paperWidth) === 80
    ? { paperWidth: 80, printableWidth: 72, sidePadding: 4, dots: 576 }
    : { paperWidth: 58, printableWidth: 48, sidePadding: 5, dots: 384 };
}

// Pack black pixels from left to right, most significant bit first (ESC/POS GS v 0).
export function monochromeRaster({ width, height, data }, threshold = 180) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || data.length !== width * height * 4) {
    throw new Error('Ukuran gambar struk tidak valid.');
  }
  const stride = Math.ceil(width / 8);
  const pixels = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const alpha = data[offset + 3] / 255;
      const gray = (data[offset] * .299 + data[offset + 1] * .587 + data[offset + 2] * .114) * alpha + 255 * (1 - alpha);
      if (gray < threshold) pixels[y * stride + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return { width, height, stride, pixels };
}

export function encodeRaster(imageData, { initialize = true, feed = true } = {}) {
  const { height, stride, pixels } = monochromeRaster(imageData);
  if (stride > 72) throw new Error('Gambar struk melebihi lebar printer 80 mm.');
  // Small image bands fit portable printer buffers and preserve continuous height.
  const bandHeight = 24;
  const bandCount = Math.ceil(height / bandHeight);
  const bytes = new Uint8Array((initialize ? 5 : 0) + bandCount * 8 + pixels.length + (feed ? 3 : 0));
  if (initialize) bytes.set([27, 64, 27, 97, 1]);
  let offset = initialize ? 5 : 0;
  for (let y = 0; y < height; y += bandHeight) {
    const rows = Math.min(bandHeight, height - y);
    bytes.set([29, 118, 48, 0, stride & 255, stride >> 8, rows & 255, rows >> 8], offset);
    offset += 8;
    const band = pixels.subarray(y * stride, (y + rows) * stride);
    bytes.set(band, offset);
    offset += band.length;
  }
  // Leave 12 mm after the final image so the tear edge clears the last text line.
  if (feed) bytes.set([27, 74, 96], offset);
  return bytes;
}
