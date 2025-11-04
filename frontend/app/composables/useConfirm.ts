import { inject } from 'vue'

export function useConfirm() {
  const confirmPopup = inject<any>('confirmPopup')
  if (!confirmPopup) throw new Error('ConfirmPopup not provided')
  return {
    confirm: (options: { title: string; message: string }) =>
      confirmPopup.value.open(options)
  }
}
