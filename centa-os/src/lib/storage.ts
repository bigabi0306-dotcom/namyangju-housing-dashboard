import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 10;
const dir = () => path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
const KEY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;
export const MIME: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/** 파일 내용(매직바이트)으로 이미지 종류를 판별한다. 확장자·Content-Type은 신뢰하지 않는다. SVG·GIF 등은 허용하지 않는다. */
export function sniffImage(b: Uint8Array): 'jpg' | 'png' | 'webp' | null {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length > 12 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'png';
  if (b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return 'webp';
  return null;
}
export const isValidKey = (k: string) => KEY_RE.test(k);
export async function saveImage(buf: Uint8Array, ext: 'jpg' | 'png' | 'webp'): Promise<string> {
  await fs.mkdir(dir(), { recursive: true, mode: 0o750 });
  const key = `${randomUUID()}.${ext}`;
  await fs.writeFile(path.join(dir(), key), buf, { mode: 0o640, flag: 'wx' });
  return key;
}
export async function readImage(key: string): Promise<Buffer | null> {
  if (!isValidKey(key)) return null; // 경로 조작 차단
  try { return await fs.readFile(path.join(dir(), key)); } catch { return null; }
}
export async function deleteImageFile(key: string) {
  if (!isValidKey(key)) return;
  try { await fs.unlink(path.join(dir(), key)); } catch { /* 이미 없음 */ }
}
