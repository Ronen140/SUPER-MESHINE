import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

/**
 * Internal MCP server stub.
 *
 * Per ADR-003 §AI/agents, Process Agents reach the ERP **only** through this
 * MCP server — direct DB / tRPC access from agents is forbidden. This is the
 * boundary where audit-log writes and agent-action gating (CLAUDE.md
 * invariant #3) will be enforced once tools are added in Round 7b+.
 *
 * Round 7a registers no tools; the server only proves the handshake plumbing
 * works end-to-end on stdio.
 */
export function createMcpServer(): Server {
  return new Server(
    {
      name: '@super-meshine/mcp-server',
      version: '0.0.0',
    },
    {
      // No capabilities advertised in 7a — tools, resources, and prompts arrive
      // alongside the first real ERP integration.
      capabilities: {},
    },
  );
}

/**
 * Entry point — wire the server to stdio and run until the transport closes.
 * Invoked by `pnpm --filter @super-meshine/mcp-server dev` and (in production)
 * by the agent runtime that spawns this binary.
 */
export async function main(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // SIGINT / SIGTERM → graceful shutdown so the parent process gets a clean
  // exit code instead of being killed mid-handshake.
  const shutdown = async (signal: NodeJS.Signals) => {
    process.stderr.write(`mcp-server: received ${signal}, shutting down\n`);
    await server.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

// Detect "ran as the entry point" without relying on `import.meta.main`
// (Node 22-compatible).
const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href;
if (invokedDirectly) {
  main().catch((err) => {
    process.stderr.write(`mcp-server: fatal: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
