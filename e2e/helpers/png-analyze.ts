import * as fs from "node:fs";
import { PNG } from "pngjs";

export type PngStats = {
  width: number;
  height: number;
  aspect: number;
  opaqueRatio: number;
  whiteRatio: number;
  blackRatio: number;
  distinctColors: number;
  bytes: number;
};

export function analyzePng(filePath: string): PngStats {
  const buf = fs.readFileSync(filePath);
  const png = PNG.sync.read(buf);
  const { width, height, data } = png;
  let opaque = 0;
  let nearWhite = 0;
  let nearBlack = 0;
  const colors = new Set<string>();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const a = data[i + 3]!;
    if (a < 8) continue;
    opaque++;
    if (r > 245 && g > 245 && b > 245) nearWhite++;
    if (r < 20 && g < 20 && b < 20) nearBlack++;
    colors.add(`${r >> 4},${g >> 4},${b >> 4}`);
  }
  return {
    width,
    height,
    aspect: width / height,
    opaqueRatio: opaque / (width * height),
    whiteRatio: nearWhite / Math.max(1, opaque),
    blackRatio: nearBlack / Math.max(1, opaque),
    distinctColors: colors.size,
    bytes: buf.length,
  };
}

/** True when the mock camera's four color bands survive capture + html2canvas. */
export function pngHasTestPhotoBands(filePath: string): boolean {
  const buf = fs.readFileSync(filePath);
  const png = PNG.sync.read(buf);
  const { data } = png;
  let red = 0;
  let green = 0;
  let blue = 0;
  let yellow = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! < 8) continue;
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    if (r > 150 && g < 110 && b < 110) red++;
    else if (g > 130 && r < 110 && b < 110) green++;
    else if (b > 150 && r < 110 && g < 110) blue++;
    else if (r > 150 && g > 130 && b < 120) yellow++;
  }
  const minPixels = 200;
  return red > minPixels && green > minPixels && blue > minPixels && yellow > minPixels;
}
