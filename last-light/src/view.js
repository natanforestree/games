// The view's size for a window. The world is drawn at a low internal resolution and scaled up by a
// whole number: the one that makes the view closest to 270 pixels tall (1080p is exactly 4x, giving
// 480x270). The width fills the window, so a wider window sees more to the sides, up to 21:9; past
// that the view stops widening and sits centred between dark bars. The vertical field of view is
// fixed; pixels are square, so one focal length serves both directions.
import { VIEW } from './tuning.js';

export function chooseView(cssW, cssH, dpr = 1) {
  const dw = Math.max(1, Math.round(cssW * dpr));
  const dh = Math.max(1, Math.round(cssH * dpr));
  const scale = Math.max(1, Math.round(dh / VIEW.targetHeight));
  const h = Math.ceil(dh / scale);
  const w = Math.max(1, Math.min(Math.ceil(dw / scale), Math.floor(h * VIEW.maxAspect)));
  const focal = h / 2 / VIEW.tanHalfV; // pixels per unit of lateral offset at depth 1
  return {
    dw, dh, scale, w, h, focal,
    plane: w / 2 / focal, // tan of the horizontal half-angle
    ox: Math.floor((dw - w * scale) / 2), // where the scaled view sits in the device-pixel canvas
    oy: Math.floor((dh - h * scale) / 2),
  };
}