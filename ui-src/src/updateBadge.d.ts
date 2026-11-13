export function updateView(latest: string | null | undefined, version: string, error?: boolean): {
  hasUpdate: boolean
  versionText: string
  badgeText: string
  title: string
}
