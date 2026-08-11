export function createSSEParser(onEvent) {
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let eventType = 'message';
  let data = [];

  const processLine = (line) => {
    if (line === '') {
      if (data.length) onEvent({ event: eventType, data: data.join('\n') });
      eventType = 'message';
      data = [];
      return;
    }
    if (line.startsWith(':')) return;

    const separator = line.indexOf(':');
    const field = separator < 0 ? line : line.slice(0, separator);
    let value = separator < 0 ? '' : line.slice(separator + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') eventType = value || 'message';
    if (field === 'data') data.push(value);
  };

  const processBuffer = () => {
    while (true) {
      const newline = buffer.indexOf('\n');
      if (newline < 0) return;
      const line = buffer.slice(0, newline).replace(/\r$/, '');
      buffer = buffer.slice(newline + 1);
      processLine(line);
    }
  };

  return {
    push(chunk) {
      buffer += decoder.decode(chunk, { stream: true });
      processBuffer();
    },
    finish() {
      buffer += decoder.decode();
      processBuffer();
    },
  };
}

export async function readSSEStream(body, onEvent) {
  const reader = body.getReader();
  const parser = createSSEParser(onEvent);
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      parser.push(value);
    }
    parser.finish();
  } finally {
    reader.releaseLock();
  }
}
