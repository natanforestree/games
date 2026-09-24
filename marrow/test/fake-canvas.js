// Stand-ins for a canvas in Node. The context records what it's asked to draw: every fillRect with the
// fillStyle and globalAlpha in force, every drawImage with its arguments, and every fillText.
export function fakeContext() {
  const ctx = {
    fillStyle: '#000000', globalAlpha: 1, font: '', textAlign: 'left', textBaseline: 'top',
    strokeStyle: '#000000', lineWidth: 1, imageSmoothingEnabled: true,
    rects: [], images: [], texts: [],
    fillRect(x, y, w, h) {
      ctx.rects.push({ x, y, w, h, color: ctx.fillStyle, alpha: ctx.globalAlpha });
    },
    drawImage(img, ...args) {
      ctx.images.push({ img, args });
    },
    fillText(str, x, y) {
      ctx.texts.push({ str, x, y, color: ctx.fillStyle });
    },
    strokeRect() {}, save() {}, restore() {}, translate() {}, scale() {},
  };
  return ctx;
}

export function fakeCanvas(width, height) {
  const ctx = fakeContext();
  return { width, height, getContext: () => ctx };
}
