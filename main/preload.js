const { ipcRenderer, contextBridge } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  message: {
    send: (payload) => ipcRenderer.send('message', payload),
    on: (handler) => ipcRenderer.on('message', handler),
    off: (handler) => ipcRenderer.off('message', handler),
  },
  abas: {
    send: (listener, payload) => ipcRenderer.send(`abas.${listener}`, payload),
    on: (listener, handler) => ipcRenderer.on(`abas.${listener}`, handler),
    off: (listener, handler) => ipcRenderer.off(`abas.${listener}`, handler),
    synchronize: {
      send: (listener, payload) => ipcRenderer.send(`sync.${listener}`, payload),
      on: (listener, handler) => ipcRenderer.on(`sync.${listener}`, handler),
      off: (listener, handler) => ipcRenderer.off(`sync.${listener}`, handler),
    }
  }
})
