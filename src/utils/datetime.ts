/**
 * Utilities for fast date/time conversions between EXIF and HTML5 formats.
 */

const EXIF_DATE_PATTERN = /^(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/;

/**
 * Converts EXIF format (e.g. 2024:03:05 18:00:00) to HTML datetime-local format (2024-03-05T18:00)
 */
export function exifToHtml(exifStr: string | null | undefined): string {
  if (!exifStr) return '';
  const match = String(exifStr).trim().match(EXIF_DATE_PATTERN);
  if (!match) {
    const parts = String(exifStr).split(' ');
    if (parts.length < 2) return String(exifStr);
    return `${parts[0].replace(/:/g, '-')  }T${  parts[1].substring(0, 5)}`;
  }
  const [, year, month, day, hours, minutes] = match;
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Converts HTML datetime-local format (2024-03-05T18:00) to standard EXIF format (2024:03:05 18:00:00)
 */
export function htmlToExif(htmlStr: string | null | undefined): string {
  if (!htmlStr) return '';
  const trimmed = String(htmlStr).trim();
  const parts = trimmed.split('T');
  if (parts.length < 2) {
    return trimmed;
  }
  const datePart = parts[0].replace(/-/g, ':');
  const timeRaw = parts[1] || '00:00';
  const timePart = timeRaw.length === 5 ? `${timeRaw}:00` : timeRaw;
  return `${datePart} ${timePart}`;
}
