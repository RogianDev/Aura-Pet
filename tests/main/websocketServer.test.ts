import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket as WsClient } from 'ws';
import { CliEventsServer } from '../../src/main/sockets/WebSocketServer';
import { CLI_EVENTS_PORT, type CliEvent } from '../../src/shared/contracts';

/**
 * Tests de integracion del servidor WebSocket (RF-05).
 *
 * TC-SOC-001 (seccion 5 del PDR): las alertas por ws://localhost:9001
 * deben cambiar el estado en menos de 50 ms.
 */

// Puerto alto fuera del rango habitual para evitar colisiones en CI.
const TEST_PORT = 9123;
const URL = `ws://127.0.0.1:${TEST_PORT}`;

let server: CliEventsServer | null = null;
let client: WsClient | null = null;

async function connect(): Promise<WsClient> {
  const socket = new WsClient(URL);
  await new Promise<void>((resolve, reject) => {
    socket.once('open', () => resolve());
    socket.once('error', reject);
  });
  return socket;
}

afterEach(async () => {
  client?.close();
  client = null;
  await server?.stop();
  server = null;
});

describe('CliEventsServer', () => {
  it('arranca y acepta conexiones locales', async () => {
    server = new CliEventsServer(TEST_PORT);
    await server.start();

    client = await connect();
    expect(server.getClientCount()).toBe(1);
    expect(server.getPort()).toBe(TEST_PORT);
  });

  it('TC-SOC-001: un evento cambia el estado en menos de 50 ms', async () => {
    server = new CliEventsServer(TEST_PORT);
    await server.start();
    client = await connect();

    const inicio = performance.now();
    const mood = await new Promise<string>((resolve) => {
      server?.once('mood', resolve);
      client?.send(JSON.stringify({ type: 'cli.command.started', data: { command: 'npm test' } }));
    });
    const latencia = performance.now() - inicio;

    expect(mood).toBe('curious');
    expect(latencia).toBeLessThan(50);
  });

  it('un comando fallido activa el animo alert', async () => {
    server = new CliEventsServer(TEST_PORT);
    await server.start();
    client = await connect();

    const mood = await new Promise<string>((resolve) => {
      server?.once('mood', resolve);
      client?.send(
        JSON.stringify({ type: 'cli.command.finished', data: { command: 'x', exitCode: 1 } }),
      );
    });

    expect(mood).toBe('alert');
  });

  it('soporta tres clientes simultaneos', async () => {
    server = new CliEventsServer(TEST_PORT);
    await server.start();

    const clients = await Promise.all([connect(), connect(), connect()]);
    expect(server.getClientCount()).toBe(3);

    const recibidos: string[] = [];
    server.on('mood', (m: string) => recibidos.push(m));
    for (const c of clients) {
      c.send(JSON.stringify({ type: 'cli.command.started', data: { command: 'x' } }));
    }

    await new Promise((r) => setTimeout(r, 100));
    expect(recibidos).toHaveLength(3);

    for (const c of clients) c.close();
  });

  it('un mensaje malformado no tumba el servidor', async () => {
    server = new CliEventsServer(TEST_PORT);
    await server.start();
    client = await connect();

    const invalidos: string[] = [];
    server.on('invalid', (r: string) => invalidos.push(r));

    client.send('esto-no-es-json');
    client.send(JSON.stringify({ type: 'desconocido', data: {} }));

    await new Promise((r) => setTimeout(r, 100));
    expect(invalidos.length).toBe(2);

    // El servidor sigue vivo y aceptando eventos validos.
    const mood = await new Promise<string>((resolve) => {
      server?.once('mood', resolve);
      client?.send(JSON.stringify({ type: 'cli.command.started', data: { command: 'x' } }));
    });
    expect(mood).toBe('curious');
  });

  it('stop() cierra las conexiones', async () => {
    server = new CliEventsServer(TEST_PORT);
    await server.start();
    client = await connect();
    expect(server.getClientCount()).toBe(1);

    await server.stop();
    server = null;
    expect(client?.readyState).not.toBe(1);
  });
});

describe('limites de seguridad', () => {
  it('rechaza un payload superior a 64 KB', async () => {
    server = new CliEventsServer(TEST_PORT);
    await server.start();
    client = await connect();

    const invalidos: string[] = [];
    server.on('invalid', (r: string) => invalidos.push(r));

    client.send(JSON.stringify({ type: 'cli.command.started', data: { command: 'x'.repeat(70_000) } }));

    await new Promise((r) => setTimeout(r, 150));
    expect(invalidos.length).toBeGreaterThan(0);
  });

  it('solo escucha en loopback', async () => {
    server = new CliEventsServer(TEST_PORT);
    await server.start();

    // Debe quedar listening en 127.0.0.1, no en 0.0.0.0 (superficie de ataque).
    const wss = (server as unknown as { wss: { options: { host?: string } } }).wss;
    expect(wss.options.host).toBe('127.0.0.1');
  });

  it('el puerto por defecto es el del PDR (9001)', () => {
    expect(CLI_EVENTS_PORT).toBe(9001);
    expect(new CliEventsServer().getPort()).toBe(9001);
  });
});

// Reexport para los tipos usados en el resto de tests.
export type { CliEvent };