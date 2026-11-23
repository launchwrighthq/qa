// The file extension of a media type and the reverse, for the files of an issue record.
const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'text/plain': 'txt',
  'application/json': 'json',
};

/** The extension of a media type, without the dot. `bin` for an unknown type. */
export function extensionOf(mime: string): string {
  return EXTENSIONS[mime] ?? 'bin';
}

/** The media type of an extension, or null. */
export function mimeOfExtension(name: string): string | null {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  if (ext === undefined) return null;
  if (ext === 'jpeg') return 'image/jpeg';
  return Object.entries(EXTENSIONS).find(([, e]) => e === ext)?.[0] ?? null;
}
