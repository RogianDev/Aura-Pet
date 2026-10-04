import { WebSocketServer, type WebSocket } from 'ws';
import { EventEmitter } from 'node:events';
import {
  CLI_EVENTS_IDLE_TIMEOUT_MS,
  CLI_EVENTS_PORT,
  type CliEvent,
} from '../../shared/contracts';
import { moodForEvent, parseCliEvent } from './events';

/**
 * WebSocketServer — RF-05 (Receptor de eventos WebSocket)
 *
 * Servidor local que escucha alertas de la CLI y las expone como eventos.
 * Solo escucha en loopback: el servidor es local por diseno y exponerlo en
 * otras interfaces seria una vulnerabilidad.
 *
 * No ejecuta comandos: solo traduce eventos a cambios de estado.
 */
export class CliEventsServer extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private readonly port: number;

  /** Conexiones vivas (para pruebas y diagnostico). */
  private clients = new Set<WebSocket>();

  constructor(port: number = CLI_EVENTS_PORT) {
    super();
    this.port = port;
  }

  /** Arranca el servidor. Lanza si el puerto ya esta ocupado. */
  public async start(): Promise<void> {
    if (this.wss) return;

    // '127.0.0.1' = solo loopback. Rechaza conexiones externas.
    this.wss = new WebSocketServer({ host: '127.0.0.1', port: this.port });

    await new Promise<void>((resolve, reject) => {
      const wss = this.wss as WebSocketServer;
      wss.once('listening', () => {
        wss.off('error', reject);
        resolve();
      });
      wss.once('error', reject);
    });

    this.wss.on('connection', (socket: WebSocket) => this.handleConnection(socket));

    this.emit('listening', this.port);
  }

  /** Cierra el servidor y todas las conexiones abiertas. */
  public async stop(): Promise<void> {
    for (const client of this.clients) {
      client.close();
    }
    this.clients.clear();

    const wss = this.wss;
    this.wss = null;
    if (!wss) return;

    await new Promise<void>((resolve) => wss.close(() => resolve()));
    this.emit('closed');
  }

  public getClientCount(): number {
    return this.clients.size;
  }

  public getPort(): number {
    return this.port;
  }

  private handleConnection(socket: WebSocket): void {
    this.clients.add(socket);

    // Cierra conexiones zombis: si no llegan eventos, se cierran solas.
    let idleTimer: NodeJS.Timeout | null = null;
    const resetIdleTimer = (): void => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        socket.close(1001, 'Idle timeout');
      }, CLI_EVENTS_IDLE_TIMEOUT_MS);
    };
    resetIdleTimer();

    socket.on('message', (data: Buffer) => {
      resetIdleTimer();

      // Nunca dejamos que un mensaje malo tumbe el servidor.
      try {
        const result = parseCliEvent(data);
        if (!result.ok) {
          this.emit('invalid', result.reason);
          return;
        }

        const event = result.event;
        this.emit('cli-event', event);
        this.emit('mood', moodForEvent(event));
      } catch (error) {
        this.emit('invalid', error instanceof Error ? error.message : 'error desconocido');
      }
    });

    socket.on('close', () => {
      if (idleTimer) clearTimeout(idleTimer);
      this.clients.delete(socket);
    });

    socket.on('error', () => {
      // Un error en una conexion no debe propagarse al servidor.
      this.clients.delete(socket);
    });
  }

  /** Envia un evento de prueba. Usado en tests y por la CLI. */
  public broadcast(event: CliEvent): void {
    const payload = JSON.stringify(event);
    for (const client of this.clients) {
      if (client.readyState === 1 /* OPEN */) {
        client.send(payload);
      }
    }
  }
}