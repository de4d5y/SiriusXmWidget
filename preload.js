const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sxmApi', {
  getInitialState: () => ipcRenderer.invoke('get_initial_state'),
  setDrawerOpen: (isOpen) => ipcRenderer.invoke('set_drawer_open', isOpen),
  saveTheme: (themeId) => ipcRenderer.invoke('save_theme', themeId),
  toggleFavorite: (chNum) => ipcRenderer.invoke('toggle_favorite', chNum),
  selectChannel: (chNum) => ipcRenderer.invoke('select_channel', chNum),
  stepChannel: (delta, filterOrFav, searchQuery) => ipcRenderer.invoke('step_channel', delta, filterOrFav, searchQuery),
  togglePlay: () => ipcRenderer.invoke('toggle_play'),
  stopStream: () => ipcRenderer.invoke('stop_stream'),
  jumpToLive: () => ipcRenderer.invoke('jump_to_live'),
  syncLiveChannels: () => ipcRenderer.invoke('sync_live_channels'),
  togglePlayerWindow: () => ipcRenderer.invoke('toggle_player_window'),
  toggleOnTop: () => ipcRenderer.invoke('toggle_on_top'),
  closeApp: () => ipcRenderer.invoke('close_app'),
  onMetadataUpdate: (callback) => {
    ipcRenderer.on('metadata_update', (_event, data) => callback(data));
  }
});
