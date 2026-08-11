import { describe, expect, it, vi } from 'vitest';
import { createSSEParser } from './sse';

const encoder = new TextEncoder();

describe('createSSEParser', () => {
  it('buffers JSON split across network chunks', () => {
    const onEvent = vi.fn();
    const parser = createSSEParser(onEvent);
    const bytes = encoder.encode('data: {"msg":"hello"}\n\n');

    parser.push(bytes.slice(0, 8));
    parser.push(bytes.slice(8, 17));
    expect(onEvent).not.toHaveBeenCalled();
    parser.push(bytes.slice(17));

    expect(onEvent).toHaveBeenCalledWith({
      event: 'message',
      data: '{"msg":"hello"}',
    });
  });

  it('preserves UTF-8 characters split across chunks', () => {
    const onEvent = vi.fn();
    const parser = createSSEParser(onEvent);
    const bytes = encoder.encode('event: error\ndata: blast 🚀\n\n');
    const split = bytes.indexOf(0xf0);

    parser.push(bytes.slice(0, split + 1));
    parser.push(bytes.slice(split + 1));

    expect(onEvent).toHaveBeenCalledWith({
      event: 'error',
      data: 'blast 🚀',
    });
  });
});
