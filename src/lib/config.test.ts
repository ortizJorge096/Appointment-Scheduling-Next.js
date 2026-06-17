import { describe, it, expect } from 'vitest'
import { INSTAGRAM_URL, TIKTOK_URL, WHATSAPP_URL, MAILTO_URL, STUDIO, categoryLabel, CATEGORY_ORDER } from './config'

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

describe('categoryLabel', () => {
  it('devuelve la etiqueta de una categoría existente', () => {
    expect(categoryLabel('MANICURA')).toBe('Manicura')
  })

  it('devuelve la clave si la categoría no existe', () => {
    expect(categoryLabel('INVENTADA')).toBe('INVENTADA')
  })
})

describe('CATEGORY_ORDER', () => {
  it('contiene todas las categorías', () => {
    expect(CATEGORY_ORDER).toContain('MANICURA')
    expect(CATEGORY_ORDER).toContain('PEDICURA')
    expect(CATEGORY_ORDER).toContain('CEJAS_PESTANAS')
    expect(CATEGORY_ORDER).toContain('VIP')
  })
})
