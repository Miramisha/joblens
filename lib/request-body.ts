export async function smallJson(
  request: Request,
  maxBytes = 2048,
): Promise<unknown> {
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new Error('Expected JSON');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Empty request');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error('Request too large');
    }
    chunks.push(chunk.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
