interface AppConfig {
  noticePublicGistUrl?: string
  noticeUsersGistUrl?: string
}

interface Window {
  __APP_CONFIG__?: AppConfig
}
