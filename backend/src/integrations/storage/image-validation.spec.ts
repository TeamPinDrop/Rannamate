import { sniffImage, validateImage } from './image-validation';

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
const f = (buffer: Buffer, mimetype = 'image/jpeg', size = buffer.length) => ({ buffer, mimetype, originalname: 'x', size });
const opts = { maxBytes: 1000, allowed: ['image/jpeg', 'image/png'] };

describe('image validation', () => {
  it('detects real types from bytes', () => {
    expect(sniffImage(jpeg)).toBe('image/jpeg');
    expect(sniffImage(png)).toBe('image/png');
    expect(sniffImage(Buffer.from('<?php echo 1; ?>........'))).toBeNull();
  });
  it('ignores a lying MIME type', () => {
    expect(() => validateImage(f(Buffer.from('this is plain text, honestly'), 'image/jpeg'), opts)).toThrow(/not a supported image/);
  });
  it('rejects missing, too large and disallowed files', () => {
    expect(() => validateImage(undefined, opts)).toThrow(/attach/);
    expect(() => validateImage(f(jpeg, 'image/jpeg', 5000), opts)).toThrow(/larger than/);
    expect(validateImage(f(png, 'image/png'), opts)).toBe('image/png');
  });
});
