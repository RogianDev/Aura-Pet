import { app } from 'electron';
import { WindowManager } from './window/WindowManager';
import { registerIpcHandlers } from './ipc/handlers';

const windowManager = new WindowManager();

// RNF-02: una sola instancia. El segundo foco se dirige a la ventana existente.
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    windowManager.show();
  });

  void app.whenReady().then(() => {
    registerIpcHandlers(windowManager);
    windowManager.createMainWindow();

    app.on('activate', () => {
      windowManager.createMainWindow();
    });
  });
}

app.on('window-all-closed', () => {
  // En Windows la app continua viva en la bandeja del sistema (RF-04).
  if (process.platform !== 'darwin') {
    windowManager.show();
  }
});