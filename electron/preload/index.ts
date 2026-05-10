import { contextBridge, ipcRenderer } from 'electron'

export interface ServerInfo {
  host: string
  port: number
  platform: 'java' | 'bedrock'
  name?: string
  online?: boolean
  players?: { online: number; max: number }
  version?: string
  motd?: string
  ping?: number
  lastUpdate?: number
}

export interface HistoryRecord {
  id: number
  host: string
  port: number
  connectedAt: string
  playersOnline?: number
}

export interface FavoriteRecord {
  id: number
  host: string
  port: number
  alias: string
  platform: 'java' | 'bedrock'
}

export interface GameStatus {
  running: boolean
  server: { host: string; port: number } | null
}

export interface ElectronAPI {
  pingServer: (host: string, port: number, platform?: 'java' | 'bedrock') => Promise<ServerInfo>
  getGameStatus: () => Promise<GameStatus>
  getHistory: (limit?: number) => Promise<HistoryRecord[]>
  addHistory: (record: Omit<HistoryRecord, 'id'>) => Promise<HistoryRecord>
  clearHistory: () => Promise<void>
  getFavorites: () => Promise<FavoriteRecord[]>
  addFavorite: (record: Omit<FavoriteRecord, 'id'>) => Promise<FavoriteRecord>
  removeFavorite: (id: number) => Promise<void>
  getLogPath: () => Promise<string>
  onGameStatus: (callback: (status: GameStatus) => void) => void
}

const api: ElectronAPI = {
  pingServer: (host: string, port: number, platform: 'java' | 'bedrock' = 'java') => {
    return ipcRenderer.invoke('server:ping', { host, port, platform })
  },

  getGameStatus: () => {
    return ipcRenderer.invoke('game:status')
  },

  getHistory: (limit?: number) => {
    return ipcRenderer.invoke('history:get', { limit })
  },

  addHistory: (record: Omit<HistoryRecord, 'id'>) => {
    return ipcRenderer.invoke('history:add', record)
  },

  clearHistory: () => {
    return ipcRenderer.invoke('history:clear')
  },

  getFavorites: () => {
    return ipcRenderer.invoke('favorites:get')
  },

  addFavorite: (record: Omit<FavoriteRecord, 'id'>) => {
    return ipcRenderer.invoke('favorites:add', record)
  },

  removeFavorite: (id: number) => {
    return ipcRenderer.invoke('favorites:remove', id)
  },

  getLogPath: () => {
    return ipcRenderer.invoke('app:getLogPath')
  },

  onGameStatus: (callback: (status: GameStatus) => void) => {
    ipcRenderer.on('game:status', (_, status) => callback(status))
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)
