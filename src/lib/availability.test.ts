// src/lib/availability.test.ts
import { describe, it, expect } from 'vitest'
import { timeToMinutes, minutesToTime } from './availability'

describe('timeToMinutes', () => {
  it('convierte "00:00" a 0', () => expect(timeToMinutes('00:00')).toBe(0))
  it('convierte "09:30" a 570', () => expect(timeToMinutes('09:30')).toBe(570))
  it('convierte "17:00" a 1020', () => expect(timeToMinutes('17:00')).toBe(1020))
  it('convierte "23:59" a 1439', () => expect(timeToMinutes('23:59')).toBe(1439))
})

describe('minutesToTime', () => {
  it('convierte 0 a "00:00"', () => expect(minutesToTime(0)).toBe('00:00'))
  it('convierte 570 a "09:30"', () => expect(minutesToTime(570)).toBe('09:30'))
  it('convierte 1020 a "17:00"', () => expect(minutesToTime(1020)).toBe('17:00'))
  it('rellena con cero: "09:05"', () => expect(minutesToTime(545)).toBe('09:05'))
})

describe('timeToMinutes / minutesToTime — ida y vuelta', () => {
  const cases = ['00:00', '08:00', '09:30', '12:00', '17:45', '23:59']
  cases.forEach((t) => {
    it(`roundtrip de "${t}"`, () => {
      expect(minutesToTime(timeToMinutes(t))).toBe(t)
    })
  })
})
