// Pure view-model for the header Update control. Kept out of React/DOM so it can be unit-tested.
export function updateView(latest, version, error) {
  const hasUpdate = !!(latest && String(latest).trim())
  return {
    hasUpdate,
    versionText: 'v' + version,
    badgeText: hasUpdate ? 'Update ' + latest : 'Update',
    title: hasUpdate
      ? 'Update available: v' + latest + ' — click to install'
      : error
        ? 'Couldn’t check for updates'
        : 'Check for updates',
  }
}
