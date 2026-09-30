/**
 * Recolor the neutral base using three exclusive grayscale data masks.
 * Masks are non-premultiplied coverage values; base alpha is preserved verbatim.
 * Byte math is in sRGB, matching the catalog's artist-selected swatches.
 * This function has no DOM/Node dependencies and can be used in a Canvas renderer.
 */
export function recolorAvatar(base, masks, colors) {
  if (base.length % 4) throw new Error('Expected RGBA base');
  const count = base.length / 4;
  const channels = ['hair', 'eyes', 'skin'];
  for (const channel of channels) {
    if (masks[channel]?.length !== count) throw new Error(`Invalid ${channel} mask length`);
    if (!Array.isArray(colors[channel]) || colors[channel].length !== 3 ||
      colors[channel].some(v => !Number.isInteger(v) || v < 0 || v > 255)) throw new Error(`Invalid ${channel} color`);
  }
  const output = new Uint8ClampedArray(base);
  for (let i = 0; i < count; i++) {
    const sum = channels.reduce((n, c) => n + masks[c][i], 0);
    if (sum > 255) throw new Error('Recoloring masks overlap');
    if (!sum || !base[i * 4 + 3]) continue;
    for (let rgb = 0; rgb < 3; rgb++) {
      let tint = 1 - sum / 255;
      for (const channel of channels) tint += masks[channel][i] / 255 * colors[channel][rgb] / 255;
      output[i * 4 + rgb] = Math.round(base[i * 4 + rgb] * tint);
    }
  }
  return output;
}

export function hexToRgb(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error('Expected #RRGGBB color');
  return [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
}
