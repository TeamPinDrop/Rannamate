import { Errors } from '../../common/errors';

/** Detects the real image type from the file's first bytes — the client-supplied MIME type is not trusted. */
export function sniffImage(buf: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'image/avif' | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.toString('ascii', 0, 6) === 'GIF87a' || buf.toString('ascii', 0, 6) === 'GIF89a') return 'image/gif';
  if (buf.toString('ascii', 4, 8) === 'ftyp' && /^avi[fs]$/.test(buf.toString('ascii', 8, 12))) return 'image/avif';
  return null;
}

export interface UploadedImage { buffer: Buffer; mimetype: string; originalname: string; size: number }

export function validateImage(file: UploadedImage | undefined, opts: { maxBytes: number; allowed: string[]; label?: string }) {
  const label = opts.label ?? 'image';
  if (!file || !file.buffer?.length) throw Errors.badRequest('INVALID_IMAGE', `Please attach an ${label}.`);
  if (file.size > opts.maxBytes) throw Errors.payloadTooLarge(`${file.originalname || 'The file'} is larger than ${Math.round(opts.maxBytes / 1024 / 1024)} MB.`);
  const real = sniffImage(file.buffer);
  if (!real) throw Errors.unsupportedMedia(`${file.originalname || 'The file'} is not a supported image (JPG, PNG, WebP${opts.allowed.includes('image/gif') ? ', GIF' : ''}${opts.allowed.includes('image/avif') ? ', AVIF' : ''}).`);
  if (!opts.allowed.includes(real)) throw Errors.unsupportedMedia(`${real} images are not accepted here.`);
  return real;
}
