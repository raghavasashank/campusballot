const IMAGE_DATA_URL_RE = /^data:image\/(png|jpeg|jpg|gif|webp);base64,([a-zA-Z0-9+/]+=*)$/i;

// Cheap prefix + base64-shape check — not full magic-byte sniffing, but
// enough to stop arbitrary non-image content (or garbage) from being stored
// and rendered via <img src> as if it were a photo. See security review.
export function isValidImageDataUrl(value: string): boolean {
  return IMAGE_DATA_URL_RE.test(value);
}
