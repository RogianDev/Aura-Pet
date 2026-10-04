import { app } from 'electron';
import { WindowManager } from './window/WindowManager';
import { registerIpcHandlers, applyPetMood } from './ipc/handlers';
import { CliEventsServer } from './sockets/WebSocketServer';

const windowManager = new WindowManager();
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
    windowManager.createMainWindow();

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
    void cliEvents.stop();
  });
}

app.on('window-all-closed', () => {
  // En Windows la app continua viva en la bandeja del sistema (RF-04).
  if (process.platform !== 'darwin') {
    windowManager.show();
  }
});