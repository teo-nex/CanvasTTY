export const MAX_DUO_RESOURCE_CHARS = 32 * 1024 * 1024;

/** Finish a paged host result, releasing its slot if a continuation fails. */
export async function readDuoResource(call: (channel: string, args: unknown[]) => Promise<any>, channel: string, args: unknown[], maxChars = MAX_DUO_RESOURCE_CHARS): Promise<any> {
  const first = await call(channel, args);
  if (!first?.chunk) return first?.value;
  const {chunk: id, total} = first;
  try {
    if (!Number.isSafeInteger(total) || total > maxChars || first.offset !== 0 ||
        typeof first.data !== 'string' || !first.data.length || first.data.length > total) {
      throw Error('Invalid shared resource size.');
    }
    let text = first.data;
    while (text.length < total) {
      const part = await call('chunk', [id, text.length]);
      if (part?.chunk !== id || part.offset !== text.length || part.total !== total ||
          typeof part.data !== 'string' || !part.data.length || part.data.length > total - text.length) {
        throw Error('Invalid shared resource chunk.');
      }
      text += part.data;
    }
    return JSON.parse(text);
  } catch (error) {
    // A disconnected host clears its own transfers. Keep the original read error.
    await call('chunk-abandon', [id]).catch(() => undefined);
    throw error;
  }
}
