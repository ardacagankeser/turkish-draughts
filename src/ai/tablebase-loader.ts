import { Tablebase } from './tablebase';

/**
 * Downloads the three-piece tablebase shipped with the site. Some servers decompress .gz
 * files on the fly, so the bytes are only inflated if they are still gzip. Resolves to
 * `null` when it cannot be loaded; everything still works without it, just less exactly.
 */
export async function loadTablebase(
  baseUrl: string = import.meta.env.BASE_URL,
): Promise<Tablebase | null> {
  try {
    const response = await fetch(`${baseUrl}tablebase/3pieces.bin.gz`);
    if (!response.ok) return null;
    let bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    }
    return new Tablebase(bytes);
  } catch {
    return null;
  }
}
