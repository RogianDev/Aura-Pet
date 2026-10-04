import { Menu, Tray, nativeImage, type NativeImage } from 'electron';
import { join } from 'node:path';
import type { WindowManager } from '../window/WindowManager';

/**
 * TrayManager — RF-04 (Bandeja del sistema)
 *
 * Sin la bandeja, cerrar la ventana la oculta (WindowManager usa
 * preventDefault) y la app quedaria inalcanzable: el proceso seguiria vivo
 * pero el usuario no tendria ninguna forma de volver a abrirla. La bandeja
 * es el punto de retorno de la aplicacion.
 */
export class TrayManager {
  private tray: Tray | null = null;

  /**
   * Icono generado en memoria como bitmap BGRA.
   *
   * Se evita depender de un fichero .ico/.png externo: un recurso ausente
   * haria que Electron lanzase al construir la Tray y la app no arrancaria.
   * Un circulo violeta con el "animo" actual es suficiente para el icono.
   */
  private buildIcon(color: [number, number, number]): NativeImage {
    const size = 32;
    const buffer = Buffer.alloc(size * size * 4);
    const center = (size - 1) / 2;
    const radius = size / 2 - 2;

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const dx = x - center;
        const dy = y - center;
        const distance = Math.hypot(dx, dy);
        // Suavizado simple en el borde para que no se vea escalonado.
        const alpha = distance <= radius ? 255 : 0;
        const offset = (y * size + x) * 4;
        // NativeImage.createFromBitmap espera BGRA, no RGBA.
        buffer[offset] = color[2];
        buffer[offset + 1] = color[1];
        buffer[offset + 2] = color[0];
        buffer[offset + 3] = alpha;
      }
    }

    return nativeImage.createFromBitmap(buffer, { width: size, height: size });
  }

  /** Crea la bandeja y su menu contextual. */
  public create(windowManager: WindowManager): void {
    if (this.tray) return;

    this.tray = new Tray(this.buildIcon([124, 92, 255]));
    this.tray.setToolTip('AuraPet');
    this.refreshContextMenu(windowManager);

    // Click izquierdo: mostrar u ocultar la ventana.
    this.tray.on('click', () => windowManager.toggleVisibility());
  }

  /** Reconstruye el menu (lo usa el test y futuros cambios de estado). */
  public refreshContextMenu(windowManager: WindowManager): void {
    if (!this.tray) return;

    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: 'Mostrar / Ocultar AuraPet',
          click: () => windowManager.toggleVisibility(),
        },
        { type: 'separator' },
        {
          label: 'Salir',
          click: () => {
            // Desactiva el ocultado ANTES de cerrar: si no, el handler de
            // 'close' interceptaria el cierre y la app no saldria nunca.
            windowManager.setKeepInTray(false);
            windowManager.destroy();
          },
        },
      ]),
    );
  }

  public isCreated(): boolean {
    return this.tray !== null;
  }

  /** Elimina la bandeja. Necesario en Windows antes de que la app salga. */
  public destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }
}