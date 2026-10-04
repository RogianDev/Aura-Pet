import { BrowserWindow, screen, app } from 'electron';
import { join } from 'node:path';

/** URL del dev server de Vite en desarrollo (vite.config.ts -> port 5173). */
const DEV_SERVER_URL = process.env['ELECTRON_RENDERER_URL'] ?? 'http://localhost:5173';
const isDev = !app.isPackaged && process.env['NODE_ENV'] !== 'production';

/**
 * WindowManager — RF-01 (Ventana flotante transparente)
 *
 * Ventana nativa frameless, transparente, always-on-top y arrastrable.
 * No contiene NINGUNA logica de UI (ver seccion 4.1 del PDR).
 */
export class WindowManager {
  private mainWindow: BrowserWindow | null = null;

  /** Devuelve la ventana principal, creandola si no existe. */
  public createMainWindow(): BrowserWindow {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      return this.mainWindow;
    }

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    // La ventana se posiciona centrada en el area de trabajo.
    const WINDOW_WIDTH = 320;
    const WINDOW_HEIGHT = 400;
    const originX = Math.round((width - WINDOW_WIDTH) / 2);
    const originY = Math.round((height - WINDOW_HEIGHT) / 2);

    this.mainWindow = new BrowserWindow({
      width: WINDOW_WIDTH,
      height: WINDOW_HEIGHT,
      x: originX,
      y: originY,
      // Zona de arrastre: la ventana se mueve desde el cuerpo del SVG.
      // El resto de la ventana debe declarar `-webkit-app-region: no-drag`.
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      resizable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      fullscreenable: false,
      webPreferences: {
        // OJO: __dirname en ejecucion es dist-electron/main/window, por lo que
        // el preload (dist-electron/preload) queda DOS niveles arriba. Con un
        // solo "../" la ruta resuelva a dist-electron/main/preload/index.js,
        // que no existe, y el preload falla en silencio dejando
        // window.aurapetAPI sin definir (seccion 4.1 del PDR).
        preload: join(__dirname, '../../preload/index.js'),
        // RNF-02: aislamiento de contexto obligatorio.
        contextIsolation: true,
        nodeIntegration: false,
        // sandbox: false porque el preload importa '../shared/contracts' y los
        // preloads en sandbox no pueden usar require de ficheros relativos.
        // El aislamiento que exige el PDR (contextIsolation) sigue activo, y el
        // renderer sigue sin acceso a Node ni al sistema de archivos: el preload
        // es la unica frontera expuesta (seccion 4.1).
        sandbox: false,
      },
    });

    // Mantener la ventana por encima sin pisar el fullscreen del usuario.
    this.mainWindow.setAlwaysOnTop(true, 'screen-saver');
    this.mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });

    // Un solo click en la ventana la trae al frente.
    this.mainWindow.on('focus', () => this.mainWindow?.show());

    if (isDev) {
      // En desarrollo el renderer lo sirve el dev server de Vite.
      this.mainWindow.loadURL(DEV_SERVER_URL);
    } else {
      // Misma regla que el preload: dist-electron/renderer queda dos niveles arriba.
      this.mainWindow.loadFile(join(__dirname, '../../renderer/index.html'));
    }

    // Cerrar solo oculta (la app vive en la bandeja del sistema, RF-04).
    this.mainWindow.on('close', (event) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed() && this.shouldKeepInTray) {
        event.preventDefault();
        this.mainWindow.hide();
      }
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    return this.mainWindow;
  }

  private shouldKeepInTray = true;

  /**
   * Desactiva el ocultado al cerrar (usado por "Salir" en la bandeja, RF-04).
   * Sin esto, la accion "Salir" no cerraria nada: el handler de 'close'
   * interceptaria el cierre y volveria a esconder la ventana.
   */
  public setKeepInTray(keep: boolean): void {
    this.shouldKeepInTray = keep;
  }

  public getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  /** Alterna la visibilidad de la ventana (usado desde el System Tray). */
  public toggleVisibility(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
    if (this.mainWindow.isVisible()) {
      this.mainWindow.hide();
    } else {
      this.mainWindow.show();
    }
  }

  public show(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.show();
    }
  }

  public destroy(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.destroy();
    }
    this.mainWindow = null;
  }
}