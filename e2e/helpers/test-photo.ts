import { PNG } from "pngjs";
import * as fs from "node:fs";
import * as path from "node:path";

/** 3:4 portrait fixture used as the mock camera still. */
export const TEST_PHOTO_WIDTH = 480;
export const TEST_PHOTO_HEIGHT = 640;

export const TEST_PHOTO_BANDS = {
  red: [220, 40, 40],
  green: [40, 180, 40],
  blue: [40, 40, 220],
  yellow: [220, 200, 40],
} as const;

export function generateTestPhotoPng(): Buffer {
  const width = TEST_PHOTO_WIDTH;
  const height = TEST_PHOTO_HEIGHT;
  const png = new PNG({ width, height });
  const bands = [
    TEST_PHOTO_BANDS.red,
    TEST_PHOTO_BANDS.green,
    TEST_PHOTO_BANDS.blue,
    TEST_PHOTO_BANDS.yellow,
  ];
  const bandH = height / 4;

  for (let y = 0; y < height; y++) {
    const band = bands[Math.min(3, Math.floor(y / bandH))]!;
    for (let x = 0; x < width; x++) {
      const i = (width * y + x) << 2;
      png.data[i] = band[0];
      png.data[i + 1] = band[1];
      png.data[i + 2] = band[2];
      png.data[i + 3] = 255;
    }
  }

  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  const hub = 28;
  for (let y = cy - hub; y <= cy + hub; y++) {
    for (let x = cx - hub; x <= cx + hub; x++) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const i = (width * y + x) << 2;
      png.data[i] = 0;
      png.data[i + 1] = 0;
      png.data[i + 2] = 0;
      png.data[i + 3] = 255;
    }
  }

  const arm = 48;
  const thick = 6;
  for (let y = cy - arm; y <= cy + arm; y++) {
    for (let x = cx - thick; x <= cx + thick; x++) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const i = (width * y + x) << 2;
      png.data[i] = 255;
      png.data[i + 1] = 255;
      png.data[i + 2] = 255;
      png.data[i + 3] = 255;
    }
  }
  for (let y = cy - thick; y <= cy + thick; y++) {
    for (let x = cx - arm; x <= cx + arm; x++) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const i = (width * y + x) << 2;
      png.data[i] = 255;
      png.data[i + 1] = 255;
      png.data[i + 2] = 255;
      png.data[i + 3] = 255;
    }
  }

  return PNG.sync.write(png);
}

export function testPhotoDataUrl(): string {
  return `data:image/png;base64,${generateTestPhotoPng().toString("base64")}`;
}

export function writeTestPhotoFixture(): string {
  const dir = path.join(process.cwd(), "e2e", "fixtures");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "test-photo.png");
  fs.writeFileSync(file, generateTestPhotoPng());
  return file;
}
