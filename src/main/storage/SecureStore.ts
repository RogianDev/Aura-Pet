import { app, safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * SecureStore — Persistencia cifrada de credenciales (Sprint 3, Dev A).
 *
 * Usa `safeStorage`, que en Windows delega en DPAPI. Las claves de IA nunca
 * se escriben en claro: se cifran con la clave del usuario de Windows y solo
 * ese usuario puede descifrarlas en esa maquina.
 *
 * No se expone nada de esto al renderer: el acceso ocurre siempre en Main.
 */

export class SecureStore {
  private readonly filePath: string;
  private cache: Record<string, string> | null = null;

  constructor(filePath: string = SecureStore.defaultPath()) {
    this.filePath = filePath;
  }

  /** Ruta por defecto dentro del perfil de usuario de la aplicacion. */
  static defaultPath(): string {
    return join(SecureStore.userDataDir(), 'credentials.enc');
  }

  static userDataDir(): string {
    try {
      if (app?.getPath) return app.getPath('userData');
    } catch {
      /* fuera de Electron: se usa el fallback */
    }
    return join(process.env['APPDATA'] ?? process.cwd(), 'AuraPet');
  }

  /**
   * Indica si el sistema puede cifrar. En Linux sin keyring puede fallar:
   * en ese caso se informa en vez de escribir credenciales en claro.
   */
  public static isAvailable(): boolean {
    try {
      return safeStorage.isEncryptionAvailable();
    } catch {
      return false;
    }
  }

  private assertAvailable(): void {
    if (!SecureStore.isAvailable()) {
      throw new Error(
        'safeStorage no disponible en este sistema. No se guardan credenciales en claro.',
      );
    }
  }

  private load(): Record<string, string> {
    if (this.cache) return this.cache;

    if (!existsSync(this.filePath)) {
      this.cache = {};
      return this.cache;
    }

    try {
      const raw = readFileSync(this.filePath);
      const decrypted = safeStorage.decryptString(raw);
      this.cache = JSON.parse(decrypted) as Record<string, string>;
    } catch {
      // Un fichero corrupto o cifrado con otra clave de usuario no debe
      // impedir que la app arranque: se descarta y se empieza de cero.
      this.cache = {};
    }
    return this.cache;
  }

  private persist(data: Record<string, string>): void {
    const encrypted = safeStorage.encryptString(JSON.stringify(data));
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, encrypted);
  }

  /** Guarda una credencial cifrada. */
  public set(key: string, value: string): void {
    this.assertAvailable();
    const data = { ...this.load(), [key]: value };
    this.persist(data);
    this.cache = data;
  }

  /** Recupera una credencial. Devuelve undefined si no existe. */
  public get(key: string): string | undefined {
    return this.load()[key];
  }

  public has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /** Indica si hay una credencial guardada SIN revelar su valor. */
  public isConfigured(provider: string): boolean {
    return this.has(`apiKey:${provider}`);
  }

  public delete(key: string): void {
    const data = { ...this.load() };
    delete data[key];
    this.persist(data);
    this.cache = data;
  }

  /** Nombres de las claves guardadas, sin sus valores. */
  public keys(): string[] {
    return Object.keys(this.load());
  }
}