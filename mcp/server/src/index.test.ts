import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import { createMcpServer } from './index.js';

/**
 * Smoke test: build the server, pair it to an in-memory client transport,
 * and confirm the MCP `initialize` handshake completes.
 *
 * Stdio transport isn't viable in unit tests (would require spawning a real
 * subprocess); the in-memory transport pair is the SDK's documented testing
 * primitive and exercises the same protocol path.
 */
describe('mcp server', () => {
  it('completes the MCP initialize handshake', async () => {
    const server = createMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    const client = new Client({ name: 'test-client', version: '0.0.0' }, { capabilities: {} });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    // Server identity must come through the handshake correctly — proves the
    // `initialize` request/response round-tripped over the transport.
    const serverInfo = client.getServerVersion();
    expect(serverInfo).toBeDefined();
    expect(serverInfo?.name).toBe('@super-meshine/mcp-server');
    expect(serverInfo?.version).toBe('0.0.0');

    // 7a advertises no capabilities; assert that contract so we notice if a
    // future change accidentally adds capabilities without registering tools.
    const capabilities = client.getServerCapabilities();
    expect(capabilities).toEqual({});

    await client.close();
    await server.close();
  });
});
