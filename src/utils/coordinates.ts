import { ParsedGpsCoordinates } from '../types';

export function normalizeGpsRef(ref: unknown): string {
  const text = String(ref ?? '').trim().toUpperCase();
  if (text.startsWith('N')) return 'N';
  if (text.startsWith('S')) return 'S';
  if (text.startsWith('E')) return 'E';
  if (text.startsWith('W')) return 'W';
  return '';
}

export function normalizeDms(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/ deg /g, '°')
    .replace(/\b(N|S|E|W|North|South|East|West)\b/gi, '')
    .replace(/\s+/g, '');
}

/**
 * Parses coordinate string in either DMS or decimal format into GPS components.
 */
export function parseCoordinates(coordStr: string | null | undefined): ParsedGpsCoordinates | null {
  if (!coordStr) return null;
  const raw = String(coordStr).trim();
  if (!raw) return null;

  // Decimal format: e.g. 22.9000, 88.0897
  const decimalPattern = /^\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*$/;
  const decimalMatch = raw.match(decimalPattern);
  if (decimalMatch) {
    const latRaw = parseFloat(decimalMatch[1]);
    const lonRaw = parseFloat(decimalMatch[2]);
    if (isNaN(latRaw) || isNaN(lonRaw)) return null;

    const toDms = (val: number): [number, number, number] => {
      const absVal = Math.abs(val);
      const totalSeconds = Math.round(absVal * 3600 * 10000) / 10000;
      const deg = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = Math.round((totalSeconds % 60) * 10000) / 10000;
      return [deg, minutes, seconds];
    };

    const [latDeg, latMin, latSec] = toDms(latRaw);
    const [lonDeg, lonMin, lonSec] = toDms(lonRaw);

    return {
      GPSLatitude: `${latDeg} ${latMin} ${latSec}`,
      GPSLatitudeRef: latRaw >= 0 ? 'N' : 'S',
      GPSLongitude: `${lonDeg} ${lonMin} ${lonSec}`,
      GPSLongitudeRef: lonRaw >= 0 ? 'E' : 'W',
    };
  }

  // DMS format: 22°54'00.0"N 88°05'23.0"E
  const dmsText = raw.replace(/ deg /g, '°').replace(/,/g, ' ');
  const dmsPattern = /(\d+)\s*°\s*(\d+)'\s*([\d.]+)"?\s*(N|S|North|South)\s+(\d+)\s*°\s*(\d+)'\s*([\d.]+)"?\s*(E|W|East|West)/i;
  const dmsMatch = dmsText.match(dmsPattern);

  if (dmsMatch) {
    const [, latDeg, latMin, latSec, latRefRaw, lonDeg, lonMin, lonSec, lonRefRaw] = dmsMatch;
    return {
      GPSLatitude: `${latDeg} ${latMin} ${latSec}`,
      GPSLatitudeRef: normalizeGpsRef(latRefRaw),
      GPSLongitude: `${lonDeg} ${lonMin} ${lonSec}`,
      GPSLongitudeRef: normalizeGpsRef(lonRefRaw),
    };
  }

  return null;
}

/**
 * Synthesizes human-friendly coordinates string (e.g. 22°54'00.0"N 88°05'23.0"E) from metadata dictionary.
 */
export function synthesizeGoogleMapsCoordinates(meta: Record<string, any> | null | undefined): string {
  if (!meta) return '';
  const existing = meta['EXIF:GoogleMapsCoordinates'] || '';

  const lat = meta['EXIF:GPSLatitude'] ?? meta['Composite:GPSLatitude'] ?? meta['GPSLatitude'];
  const lon = meta['EXIF:GPSLongitude'] ?? meta['Composite:GPSLongitude'] ?? meta['GPSLongitude'];

  if (!lat || !lon) return String(existing);

  const latRef = normalizeGpsRef(
    meta['EXIF:GPSLatitudeRef'] ?? meta['XMP:GPSLatitudeRef'] ?? meta['GPSLatitudeRef'] ?? lat
  );
  const lonRef = normalizeGpsRef(
    meta['EXIF:GPSLongitudeRef'] ?? meta['XMP:GPSLongitudeRef'] ?? meta['GPSLongitudeRef'] ?? lon
  );

  if (!latRef || !lonRef) return String(existing);

  return `${normalizeDms(lat)}${latRef} ${normalizeDms(lon)}${lonRef}`;
}
