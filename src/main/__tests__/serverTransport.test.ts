/// <reference types="vitest/globals" />
// @vitest-environment node

import { normalizeServerUrl, readBoundedResponse, serverRequest } from '../serverTransport';

describe('server transport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('accepts HTTPS and this-device HTTP while removing a trailing slash', () => {
    expect(normalizeServerUrl('https://cleardeck.example/')).toBe('https://cleardeck.example');
    expect(normalizeServerUrl('http://127.0.0.1:4312/')).toBe('http://127.0.0.1:4312');
    expect(normalizeServerUrl('http://[::1]:4312')).toBe('http://[::1]:4312');
  });

  it.each([
    'http://cleardeck.example',
    'https://cleardeck.example/workspace',
    'https://user:password@cleardeck.example',
    'https://cleardeck.example/?tenant=one',
    'https://cleardeck.example#workspace',
  ])('rejects a server URL that could redirect or select another resource: %s', (url) => {
    expect(() => normalizeServerUrl(url)).toThrow();
  });

  it('does not turn a failed request into local operation', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('connection refused'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(serverRequest('https://cleardeck.example', '/v1/snapshot')).rejects.toThrow(
      /nicht auf lokale Daten ausgewichen/,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://cleardeck.example/v1/snapshot',
      expect.objectContaining({ redirect: 'error', signal: expect.any(AbortSignal) }),
    );
  });

  it('maps a failed HTTP response without exposing its response body', async () => {
    const response = new Response('patient data must not appear in an error', { status: 409 });
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetchMock);

    await expect(serverRequest('https://cleardeck.example', '/v1/snapshot')).rejects.toThrow(
      'Serverbestand wurde geändert',
    );
    await expect(response.body?.cancel()).resolves.toBeUndefined();
  });

  it('returns a bounded response and cancels an oversized stream', async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const read = vi
      .fn()
      .mockResolvedValueOnce({ done: false, value: new Uint8Array([1, 2, 3]) })
      .mockResolvedValueOnce({ done: false, value: new Uint8Array([4]) });
    const response = {
      body: { getReader: () => ({ read, cancel }) },
    } as unknown as Response;

    await expect(readBoundedResponse(response, 3)).rejects.toThrow('Serverantwort ist zu groß');
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('accepts a response exactly at the configured limit', async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const read = vi
      .fn()
      .mockResolvedValueOnce({ done: false, value: new Uint8Array([1, 2]) })
      .mockResolvedValueOnce({ done: true, value: undefined });
    const response = {
      body: { getReader: () => ({ read, cancel }) },
    } as unknown as Response;

    await expect(readBoundedResponse(response, 2)).resolves.toEqual(Buffer.from([1, 2]));
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
