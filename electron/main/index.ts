import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import log from 'electron-log'
import { ping } from 'mc-server-ping'
import { existsSync, readFileSync, watchFile, unwatchFile, readFile, writeFileSync, mkdirSync } from 'fs'
import { homedir } from 'os'

log.initialize()
log.info('Application starting...')

process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error)
  app.exit(1)
})

let mainWindow: BrowserWindow | null = null
let logWatcher: any = null

interface ServerInfo {
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

interface HistoryRecord {
  id: number
  host: string
  port: number
  connectedAt: string
  playersOnline?: number
}

interface FavoriteRecord {
  id: number
  host: string
  port: number
  alias: string
  platform: 'java' | 'bedrock'
}

const isDev = process.env.NODE_ENV !== 'production' || !app.isPackaged

const dataDir = isDev
  ? join(__dirname, '../../data')
  : join(app.getPath('userData'), 'data')

const historyFile = join(dataDir, 'history.json')
const favoritesFile = join(dataDir, 'favorites.json')

function ensureDataDir() {
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }
}

function loadHistory(): HistoryRecord[] {
  try {
    if (existsSync(historyFile)) {
      return JSON.parse(readFileSync(historyFile, 'utf-8'))
    }
  } catch (e) {
    log.error('Failed to load history:', e)
  }
  return []
}

function saveHistory(history: HistoryRecord[]) {
  ensureDataDir()
  writeFileSync(historyFile, JSON.stringify(history, null, 2))
}

function loadFavorites(): FavoriteRecord[] {
  try {
    if (existsSync(favoritesFile)) {
      return JSON.parse(readFileSync(favoritesFile, 'utf-8'))
    }
  } catch (e) {
    log.error('Failed to load favorites:', e)
  }
  return []
}

function saveFavorites(favorites: FavoriteRecord[]) {
  ensureDataDir()
  writeFileSync(favoritesFile, JSON.stringify(favorites, null, 2))
}

function getMinecraftLogPath(): string {
  const minecraftPath = isDev
    ? join(homedir(), '.minecraft', 'logs', 'latest.log')
    : join(app.getPath('userData'), 'mock-logs', 'latest.log')
  return minecraftPath
}

function getMinecraftLogDir(): string {
  return join(homedir(), '.minecraft', 'logs')
}

function parseServerFromLog(content: string): { host: string; port: number } | null {
  const connectingPattern = /Connecting to ([^\s,]+), (\d+)/
  const match = content.match(connectingPattern)
  if (match) {
    return { host: match[1], port: parseInt(match[2]) }
  }

  const serverPattern = /Server\s+(?:address|IP):\s*([^\s]+):(\d+)/
  const serverMatch = content.match(serverPattern)
  if (serverMatch) {
    return { host: serverMatch[1], port: parseInt(serverMatch[2]) }
  }

  return null
}

function isGameRunning(): boolean {
  const logPath = getMinecraftLogPath()
  if (!existsSync(logPath)) {
    return false
  }

  try {
    const content = readFileSync(logPath, 'utf-8')
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    const timePattern = /\[(\d{2}):(\d{2}):(\d{2})\].*/
    const lines = content.split('\n').filter(line => {
      const timeMatch = line.match(timePattern)
      if (timeMatch) {
        const currentHour = new Date().getHours()
        const logHour = parseInt(timeMatch[1])
        const minuteSec = parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3])
        const nowMinuteSec = currentHour * 60 + new Date().getMinutes() * 60 + new Date().getSeconds()

        if (Math.abs(nowMinuteSec - minuteSec) < 300) {
          return true
        }
      }
      return false
    })

    return lines.length > 0
  } catch (e) {
    log.error('Failed to check game running:', e)
    return false
  }
}

function getCurrentServerFromLog(): { host: string; port: number } | null {
  const logPath = getMinecraftLogPath()
  if (!existsSync(logPath)) {
    return null
  }

  try {
    const content = readFileSync(logPath, 'utf-8')
    const lines = content.split('\n')

    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]
      if (line.includes('Connecting to') || line.includes('Server address') || line.includes('Server IP')) {
        const result = parseServerFromLog(line)
        if (result) {
          return result
        }
      }
    }
  } catch (e) {
    log.error('Failed to get current server:', e)
  }
  return null
}

async function pingServer(host: string, port: number, platform: 'java' | 'bedrock' = 'java'): Promise<ServerInfo> {
  try {
    const result = await ping(host, { port, platform, timeout: 5000 })

    if (result.online) {
      return {
        host,
        port,
        platform,
        online: true,
        players: result.players,
        version: result.version?.name || 'Unknown',
        motd: result.motd,
        ping: result.ping,
        lastUpdate: Date.now()
      }
    }
  } catch (e) {
    log.error(`Failed to ping ${host}:${port}:`, e)
  }

  return {
    host,
    port,
    platform,
    online: false,
    lastUpdate: Date.now()
  }
}

function startLogWatcher() {
  const logPath = getMinecraftLogPath()
  const logDir = getMinecraftLogDir()

  if (!existsSync(logDir) && !isDev) {
    return
  }

  log.info('Starting log watcher on:', logPath)

  try {
    if (existsSync(logPath)) {
      logWatcher = watchFile(logPath, { interval: 1000 }, () => {
        if (mainWindow) {
          const gameRunning = isGameRunning()
          const currentServer = getCurrentServerFromLog()

          mainWindow.webContents.send('game:status', {
            running: gameRunning,
            server: currentServer
          })
        }
      })
    }
  } catch (e) {
    log.error('Failed to start log watcher:', e)
  }
}

function stopLogWatcher() {
  if (logWatcher) {
    unwatchFile(getMinecraftLogPath())
    logWatcher = null
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    show: false,
    backgroundColor: '#1a1a2e'
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    log.info('Window ready and shown')
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  log.info('App ready, creating window...')
  createWindow()
  startLogWatcher()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  stopLogWatcher()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('server:ping', async (_, { host, port, platform }) => {
  log.info(`Pinging server: ${host}:${port} (${platform})`)
  return await pingServer(host, port, platform || 'java')
})

ipcMain.handle('game:status', async () => {
  const gameRunning = isGameRunning()
  const currentServer = getCurrentServerFromLog()
  return { running: gameRunning, server: currentServer }
})

ipcMain.handle('history:get', async (_, { limit }: { limit?: number }) => {
  const history = loadHistory()
  return limit ? history.slice(-limit) : history
})

ipcMain.handle('history:add', async (_, record: Omit<HistoryRecord, 'id'>) => {
  const history = loadHistory()
  const newRecord: HistoryRecord = {
    ...record,
    id: Date.now()
  }
  history.push(newRecord)
  if (history.length > 100) {
    history.shift()
  }
  saveHistory(history)
  return newRecord
})

ipcMain.handle('history:clear', async () => {
  saveHistory([])
})

ipcMain.handle('favorites:get', async () => {
  return loadFavorites()
})

ipcMain.handle('favorites:add', async (_, record: Omit<FavoriteRecord, 'id'>) => {
  const favorites = loadFavorites()
  const exists = favorites.find(f => f.host === record.host && f.port === record.port)
  if (exists) {
    return exists
  }
  const newRecord: FavoriteRecord = {
    ...record,
    id: Date.now()
  }
  favorites.push(newRecord)
  saveFavorites(favorites)
  return newRecord
})

ipcMain.handle('favorites:remove', async (_, id: number) => {
  let favorites = loadFavorites()
  favorites = favorites.filter(f => f.id !== id)
  saveFavorites(favorites)
})

ipcMain.handle('app:getLogPath', async () => {
  return getMinecraftLogDir()
})

log.info('Main process initialized')
