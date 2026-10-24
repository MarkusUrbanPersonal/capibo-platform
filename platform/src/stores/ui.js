import { reactive } from 'vue'

export const ui = reactive({
  settingsOpen: false,
  settingsSection: 'organization',
})

export function openSettings(section = 'organization') {
  ui.settingsSection = section
  ui.settingsOpen = true
}
