// Native
const { join } = require('path');
const { format } = require('url');

// Packages
const { BrowserWindow, app, ipcMain, dialog, Notification, Tray, Menu } = require('electron');
const isDev = require('electron-is-dev');
const prepareNext = require('electron-next');
const abas = require('./app/abas');

// Variable
const icon = join(__dirname, '../renderer/public/icon.png');
const gotTheLock = app.requestSingleInstanceLock({ key : 'whs-portal_cikarang_synchronize' });
const port = process.env.NEXT_PORT_DEV;
const ChildProcess = (file_name, { name_label = null, name_process = null }) => {
  let processObject = null;

  let status = processObject ? true : false;

  const setStatus = () => {
    status = getStatus();

    return "Status updated.";
  }

  const getStatus = () => {
    return processObject ? true : false;
  }

  const stop = () => {
    const focusedWindow = BrowserWindow.getFocusedWindow() ?? undefined;
    if (processObject) {
      processObject.kill("SIGINT");
    }

    processObject = null;
    setStatus();

    sendSynchronizeEnableButton(focusedWindow, name_process, true);

    return ChildProcess;
  }

  const start = () => {
    const focusedWindow = BrowserWindow.getFocusedWindow() ?? undefined;
    
    if (!processObject) {
      stop();
      processObject = require('child_process').fork(file_name);

      processObject.on('message', m => {
        switch (m.type) {
          case "notification":
            sendNotification(name_label, m.param);
            break;
          case "setEnable":
            sendSynchronizeEnableButton(focusedWindow, name_process, m.param);
            break;
          case "message":
          default:
            sendLog(`[${name_label ?? ''}] : ${m.param ?? m}`, { window : focusedWindow });
            break;
        }
      });

      processObject.on('exit', (code, signal) => {
        if (code) {
          sendLog(`[${name_label ?? ''}] : Process exited with code, ${code}.`, { window : focusedWindow });
        } else if (signal) {
          sendLog(`[${name_label ?? ''}] : Process was killed with signal, ${signal}.`, { window : focusedWindow });
        } else {
          sendLog(`[${name_label ?? ''}] : Process exited.`, { window : focusedWindow });
        }

        stop();

        if (focusedWindow) sendSynchronizationStatus(focusedWindow);
      });
    }

    setStatus();
    return ChildProcess;
  }

  const reset = () => {
    return stop().start();
  }

  return {
    status,
    stop,
    start,
    reset,
    getStatus
  };
}
const synchronizations = {
  delivery_note : ChildProcess(join(__dirname, 'module/delivery_note'), { name_label: 'Delivery Note', name_process: 'delivery_note' })
}

// Browser Window and Tray
let mainWindow, tray;

// Add Ons
const sendSynchronizationStatus = (window) => {
  window.send(
    'sync.status.set',
    Object.fromEntries(
      Object.entries(synchronizations).map(
        ([key, value]) => [key, value.getStatus()]
      )
    )
  );
}

const sendSynchronizeEnableButton = (window, synchronizeName, setValue = true) => {
  window.send(
    'sync.button.setEnable',
    {
      name : synchronizeName,
      button_enable : setValue,
    }
  );
}

const sendLog = (message, { window = undefined, logType = 'log' } = {}) => {
  const date = new Date();

  if (typeof window !== "undefined") {
    window.send('message', message);
  }
  
  switch (logType) {
    case "warn":
      console.warn(date, message);
      break;
    case "error":
      console.error(date, message);
      break;
    case "log":
    default:
      console.log(date, message);
      break;
  }
}

const sendNotification = (title, body, icon = join(__dirname, '../renderer/public/icon.png')) => new Notification({ title: title, body: body, icon: icon }).show();

// Prepare the renderer once the app is ready
app.on('ready', async () => {
  await prepareNext('./renderer');

  // Base URL
  const url = (link = 'index') => {
    return isDev ?
      `http://localhost:${ port ?? 8000 }/${link}` :
      format({
        pathname: join(__dirname, `../renderer/out/${link}.html`),
        protocol: 'file:',
        slashes: true,
      });
  };
  
  // Splash window
  const splashWindow = new BrowserWindow({
    show: false,
    width: 500,
    height: 250,
    frame: false,
    resizable: false,
    title: "Loading",
    autoHideMenuBar: true,
    icon: icon,
    webPreferences: {
      nodeIntegration: false,
      preload: join(__dirname, 'preload.js'),
    }
  });

  splashWindow.webContents.on('dom-ready', () => splashWindow.show());
  await splashWindow.loadURL(url('splash'));

  // Checking Process
  setTimeout(() => {
    try {
      // Check app instance lock
      if (!gotTheLock) throw new Error("Application has been started already.");

      // Connect to ABAS
      splashWindow.webContents.send('message', 'Begin ABAS session');
      abas.connect();
      splashWindow.webContents.send('message', 'ABAS connected.');

      // Make main window
      (async() => {
        mainWindow = new BrowserWindow({
          show: false,
          width: 800,
          height: 480,
          resizable: false,
          autoHideMenuBar: true,
          icon: icon,
          webPreferences: {
            nodeIntegration: false,
            preload: join(__dirname, 'preload.js'),
          },
        });
        mainWindow.webContents.on('dom-ready', () => mainWindow.show());
        await mainWindow.loadURL(url());

        tray = new Tray(icon);
        tray.setToolTip("Synchronize");
        tray.on('double-click', (e) => {
          if (mainWindow.isMinimized()) {
            mainWindow.restore();
          }
        });
      })()
        .catch(err => {
          throw err;
        })
        .finally(
          () => {
            splashWindow.destroy();
          }
        );
    } catch (error) {
      dialog.showErrorBox('Error', error.message);
      app.quit();
    }
  }, 1000);
});

// Quit the app once all windows are closed
app.on('window-all-closed', () => {
  if (abas.isConnected()) abas.endSession();
  app.quit();
});

// IPC Listener
  // Message
  ipcMain.on('message', (event, message) => {
    event.sender.send('message', message)
  });

  // Get Synchronize Status
  ipcMain.on('sync.status.get', (event, message) => {
    sendSynchronizationStatus(event.sender);
  });

  // Toggle synchronize
  ipcMain.on('sync.toggle', (event, synchronize) => {
    const synchronizeName = synchronize.name;
    if (!synchronizeName) throw new Error("Cannot get synchronize name.");

    // Get status
    const currentSynchronize = synchronizations[synchronizeName];
    if (!currentSynchronize) throw new Error("Cannot find synchronize object.");
    
    const currentStatus = synchronizations[synchronizeName].getStatus();

    // Toggle value
    const value = synchronize.value ?? !currentStatus;

    if (value) {
      if (!currentStatus) {
        sendLog(`Starting ${synchronizeName} synchronize...`, {window: event.sender});
        synchronizations[synchronizeName].start();
      } else {
        sendLog(`Synchronize (${synchronizeName}) has been already running.`, {window: event.sender});
      }
    } else {
      if (currentStatus) {
        sendLog(`Stopping ${synchronizeName} synchronize...`, {window: event.sender});
        synchronizations[synchronizeName].stop();
      } else {
        sendLog(`Synchronize (${synchronizeName}) has been already stopped.`, {window: event.sender});
      }
    }
    
    sendSynchronizationStatus(event.sender);
  });
