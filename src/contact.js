import { t } from './i18n.js'

/* Contact window: any [data-contact] opens the mailbox chooser; [data-copy] copies an address. */
export function initContact({ beforeOpen, lenis } = {}) {
  const dlg = document.getElementById('contact-dialog')
  if (!dlg) return
  let opener = null

  const open = (e) => {
    e?.preventDefault()
    opener = e?.currentTarget || null
    beforeOpen?.()
    if (typeof dlg.showModal === 'function') dlg.showModal()
    else dlg.setAttribute('open', '')
    document.documentElement.classList.add('has-dialog')
    lenis?.stop()
  }
  const close = () => { if (dlg.open) dlg.close() }
  dlg.addEventListener('close', () => {
    document.documentElement.classList.remove('has-dialog')
    lenis?.start()
    opener?.focus({ preventScroll: true })
  })

  document.querySelectorAll('[data-contact]').forEach((el) => el.addEventListener('click', open))
  dlg.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close))
  // a click on the backdrop (the dialog box itself, outside the card) closes it
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close() })
  if (location.hash === '#contact-us') open()

  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const value = btn.dataset.copy
      const label = btn.querySelector('[data-i18n="copy"]')
      let ok = true
      try { await navigator.clipboard.writeText(value) } catch { ok = false }
      btn.classList.toggle('is-done', ok)
      if (label) label.textContent = ok ? t('copied') : t('selectToCopy')
      btn.setAttribute('aria-label', ok ? `${t('copied')}: ${value}` : value)
      clearTimeout(btn._t)
      btn._t = setTimeout(() => {
        btn.classList.remove('is-done')
        if (label) label.textContent = t('copy')
        btn.setAttribute('aria-label', `${t('copy')}: ${value}`)
      }, 1600)
    })
  })
}
