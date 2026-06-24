import { describe, it, expect } from 'vitest'
import { INSTAGRAM_URL, TIKTOK_URL, WHATSAPP_URL, MAILTO_URL, STUDIO, ICON_KEYS, ICON_LABELS } from './config'

describe('INSTAGRAM_URL', () => {
  it('incluye el handle de instagram', () => {
    expect(INSTAGRAM_URL).toContain(STUDIO.instagram)
  })

  it('es una URL válida de Instagram', () => {
    expect(INSTAGRAM_URL).toMatch(/^https:\/\/(www\.)?instagram\.com\/.+/)
  })
})

describe('TIKTOK_URL', () => {
  it('incluye el handle de tiktok', () => {
    expect(TIKTOK_URL).toContain(STUDIO.tiktok)
  })

  it('es una URL válida de TikTok', () => {
    expect(TIKTOK_URL).toMatch(/^https:\/\/(www\.)?tiktok\.com\/@.+/)
  })
})

describe('WHATSAPP_URL', () => {
  it('incluye el número de WhatsApp', () => {
    expect(WHATSAPP_URL).toContain(STUDIO.whatsapp)
  })

  it('es una URL wa.me válida', () => {
    expect(WHATSAPP_URL).toMatch(/^https:\/\/wa\.me\/\d+/)
  })
})

describe('MAILTO_URL', () => {
  it('usa el email del estudio', () => {
    expect(MAILTO_URL).toBe(`mailto:${STUDIO.email}`)
  })
})

describe('ICON_KEYS / ICON_LABELS', () => {
  it('cada clave de ícono tiene una etiqueta legible', () => {
    for (const key of ICON_KEYS) {
      expect(ICON_LABELS[key]).toBeTruthy()
    }
  })

  it('incluye el ícono por defecto "promo"', () => {
    expect(ICON_KEYS).toContain('promo')
  })
})
