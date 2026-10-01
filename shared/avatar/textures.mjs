import { recolorAvatar, hexToRgb } from '../avatar-recolor.mjs';

// Images are provided by the caller. Atlas rectangles are runtime sprite regions;
// the generated atlas and approved source images remain unchanged on disk.
export function prepareTextures(data, images, makeCanvas, colors) {
  const textures = {};
  for (const [id, sprite] of Object.entries(data.rig.sprites)) {
    if (sprite.source === 'neutral') continue;
    const [x, y, w, h] = sprite.crop;
    const canvas = makeCanvas(w, h), ctx = canvas.getContext('2d');
    ctx.drawImage(images[sprite.source], x, y, w, h, 0, 0, w, h);
    if (sprite.tint === 'skin') {
      const pixels = ctx.getImageData(0, 0, w, h), tint = hexToRgb(colors.skin);
      for (let p = 0; p < pixels.data.length; p += 4) for (let c = 0; c < 3; c++) pixels.data[p + c] = Math.round(pixels.data[p + c] * tint[c] / 255);
      ctx.putImageData(pixels, 0, 0);
    }
    textures[id] = canvas;
  }
  const head = makeCanvas(1024, 1536), ctx = head.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(images.neutral, 0, 0);
  const base = ctx.getImageData(0, 0, 1024, 1536), masks = {};
  const maskCanvas = makeCanvas(1024, 1536), maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
  for (const channel of ['hair', 'eyes', 'skin']) {
    maskCtx.clearRect(0, 0, 1024, 1536);maskCtx.drawImage(images[channel], 0, 0);
    const bytes = maskCtx.getImageData(0, 0, 1024, 1536).data;
    masks[channel] = Uint8Array.from({ length: 1024 * 1536 }, (_, i) => bytes[i * 4]);
  }
  base.data.set(recolorAvatar(base.data, masks, Object.fromEntries(Object.entries(colors).map(([k, v]) => [k, hexToRgb(v)]))));
  ctx.putImageData(base, 0, 0);
  const crop = data.rig.sprites.head.crop;
  textures.head = makeCanvas(crop[2], crop[3]);
  textures.head.getContext('2d').drawImage(head, ...crop, 0, 0, crop[2], crop[3]);
  return textures;
}
