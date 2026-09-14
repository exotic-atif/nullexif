import exifr from 'exifr';
import { synthesizeGoogleMapsCoordinates } from '../utils/coordinates';

/**
 * Ultra-fast client-side EXIF extractor.
 * Slices only the initial header block (128 KB) to achieve sub-millisecond parsing,
 * completely eliminating any perceived UI gap or lag when files are selected.
 */
export async function parseClientExif(file: File): Promise<Record<string, any>> {
  try {
    // Slicing the first 128KB reads EXIF headers instantly without loading large image payloads into memory
    const headerSlice = file.size > 131072 ? file.slice(0, 131072) : file;

    const raw = await exifr.parse(headerSlice, {
      tiff: true,
      xmp: true,
      iptc: true,
      gps: true,
      reviveValues: true,
      sanitize: true,
      mergeOutput: false,
    });

    if (!raw) return {};

    const meta: Record<string, any> = {};

    const assignTags = (obj: Record<string, any> | undefined, prefix: string) => {
      if (!obj || typeof obj !== 'object') return;
      for (const [key, value] of Object.entries(obj)) {
        if (value === undefined || value === null) continue;
        meta[`${prefix}:${key}`] = value;
      }
    };

    if (raw.exif) assignTags(raw.exif, 'EXIF');
    if (raw.xmp) assignTags(raw.xmp, 'XMP');
    if (raw.iptc) assignTags(raw.iptc, 'IPTC');
    if (raw.gps) assignTags(raw.gps, 'EXIF');

    for (const [key, value] of Object.entries(raw)) {
      if (typeof value !== 'object' && value !== null && value !== undefined) {
        if (!meta[`EXIF:${key}`]) {
          meta[`EXIF:${key}`] = value;
        }
      }
    }

    if (raw.DateTimeOriginal instanceof Date) {
      const d = raw.DateTimeOriginal;
      const pad = (n: number) => String(n).padStart(2, '0');
      meta['EXIF:DateTimeOriginal'] = `${d.getFullYear()}:${pad(d.getMonth() + 1)}:${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    const coords = synthesizeGoogleMapsCoordinates(meta);
    if (coords) {
      meta['EXIF:GoogleMapsCoordinates'] = coords;
    }

    return meta;
  } catch (err) {
    console.debug('Fast EXIF pre-parse completed or fallback to server:', err);
    return {};
  }
}
