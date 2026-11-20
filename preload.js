const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sxmApi', {
  getInitialState: () => ipcRenderer.invoke('get_initial_state'),
  setDrawerOpen: (isOpen) => ipcRenderer.invoke('set_drawer_open', isOpen),
  setMiniMode: (isMini) => ipcRenderer.invoke('set_mini_mode', isMini),
  setWidgetScale: (scale) => ipcRenderer.invoke('set_widget_scale', scale),
  saveTheme: (themeId) => ipcRenderer.invoke('save_theme', themeId),
  saveVisualSettings: (settings) => ipcRenderer.invoke('save_visual_settings', settings),
  previewWidgetOpacity: (opacity) => ipcRenderer.invoke('preview_widget_opacity', opacity),
  setVolume: (volume, muted) => ipcRenderer.invoke('set_volume', volume, muted),
  clearHistory: () => ipcRenderer.invoke('clear_history'),
  setLaunchAtStartup: (enabled) => ipcRenderer.invoke('set_launch_at_startup', enabled),
  toggleFavorite: (chNum) => ipcRenderer.invoke('toggle_favorite', chNum),
  reorderFavorites: (newOrder) => ipcRenderer.invoke('reorder_favorites', newOrder),
  addCustomStream: (payload) => ipcRenderer.invoke('add_custom_stream', payload),
  removeCustomStream: (chNum) => ipcRenderer.invoke('remove_custom_stream', chNum),
  selectChannel: (chNum) => ipcRenderer.invoke('select_channel', chNum),
  stepChannel: (delta, filterOrFav, searchQuery) => ipcRenderer.invoke('step_channel', delta, filterOrFav, searchQuery),
  randomChannel: (filterOrFav, searchQuery) => ipcRenderer.invoke('random_channel', filterOrFav, searchQuery),
  togglePlay: () => ipcRenderer.invoke('toggle_play'),
  stopStream: () => ipcRenderer.invoke('stop_stream'),
  jumpToLive: () => ipcRenderer.invoke('jump_to_live'),
  syncLiveChannels: () => ipcRenderer.invoke('sync_live_channels'),
  togglePlayerWindow: () => ipcRenderer.invoke('toggle_player_window'),
  toggleOnTop: () => ipcRenderer.invoke('toggle_on_top'),
  closeApp: () => ipcRenderer.invoke('close_app'),
  openExternalUrl: (url) => ipcRenderer.invoke('open_external_url', url),
  exportSettings: () => ipcRenderer.invoke('export_settings'),
  importSettings: () => ipcRenderer.invoke('import_settings'),
  checkForUpdates: () => ipcRenderer.invoke('check_for_updates'),
  onMetadataUpdate: (callback) => {
    ipcRenderer.on('metadata_update', (_event, data) => callback(data));
  },
  onHistoryUpdate: (callback) => {
    ipcRenderer.on('history_update', (_event, history) => callback(history));
  },
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update_available', (_event, info) => callback(info));
  }
});
