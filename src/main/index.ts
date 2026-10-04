import { app } from 'electron';
import { WindowManager } from './window/WindowManager';
import { TrayManager } from './tray/TrayManager';
import { registerIpcHandlers, applyPetMood } from './ipc/handlers';
import { CliEventsServer } from './sockets/WebSocketServer';

const windowManager = new WindowManager();
const trayManager = new TrayManager();
const cliEvents = new CliEventsServer();

// RNF-02: una sola instancia. El segundo foco se dirige a la ventana existente.
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    windowManager.show();
  });

  void app.whenReady().then(async () => {
    registerIpcHandlers(windowManager);
    const mainWindow = windowManager.createMainWindow();

    // Reenvia la consola del renderer a la terminal. Sin esto, los errores del
    // renderer son invisibles durante el desarrollo y se manifiestan como
    // "no funciona" sin ninguna pista.
    mainWindow.webContents.on('console-message', (_event, level, message) => {
      const marcas = ['debug', 'info', 'warn', 'error'];
      const etiqueta = marcas[level] ?? 'log';
      console.log(`[renderer:${etiqueta}] ${message}`);
    });

    // RF-04: la bandeja es el punto de retorno de la app. Closing la ventana
    // solo la oculta, asi que sin bandeja el usuario se quedaria sin forma
    // de volver a abrirla.
    trayManager.create(windowManager);

    // RF-05: los eventos de la CLI actualizan el animo de la mascota.
    cliEvents.on('mood', (mood: 'idle' | 'happy' | 'curious' | 'alert') => {
      applyPetMood(mood);
    });
    // Un evento invalido se registra pero nunca interrumpe la app.
    cliEvents.on('invalid', (reason: string) => {
      console.warn(`[AuraPet] Evento de CLI descartado: ${reason}`);
    });

    try {
      await cliEvents.start();
      console.log(`[AuraPet] Escuchando eventos de CLI en ws://localhost:${cliEvents.getPort()}`);
    } catch (error) {
      // Un puerto ocupado no debe impedir que la app arranque.
      console.error('[AuraPet] No se pudo iniciar el servidor WebSocket:', error);
    }

    app.on('activate', () => {
      windowManager.createMainWindow();
    });
  });

  app.on('before-quit', () => {
    trayManager.destroy();
    void cliEvents.stop();
  });
}

// RF-04: en Windows la app sigue viva en la bandeja. No se llama a quit()
// porque la ventana se oculta en lugar de cerrarse; cerrarla no debe
// terminar el proceso. En macOS el comportamiento por defecto ya es ese.
app.on('window-all-closed', () => {
  // Sin accion intencionada: la bandeja mantiene la app residente.
});