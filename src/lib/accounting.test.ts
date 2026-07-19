// src/lib/accounting.test.ts
import { appointmentIncome, appointmentBalance, appointmentServiceTotal, type AppointmentMoney } from './accounting'

// Minimal builder for the money shape the helpers read.
const apt = (o: Partial<AppointmentMoney> & { paymentStatus: string }): AppointmentMoney => ({
  amountPaid: null, precioFinal: null, service: { price: 0 }, services: [], ...o,
})

describe('appointmentServiceTotal', () => {
  it('uses the single service price when there is one service', () => {
    expect(appointmentServiceTotal(apt({ paymentStatus: 'PAID', service: { price: 45000 }, services: [] }))).toBe(45000)
  })
  it('sums the line prices of a multi-service appointment', () => {
    expect(appointmentServiceTotal(apt({ paymentStatus: 'PAID', service: { price: 40000 }, services: [{ price: 40000 }, { price: 30000 }] }))).toBe(70000)
  })
})

describe('appointmentIncome', () => {
  it('is zero for a courtesy (WAIVED) or an unpaid charge (PENDING)', () => {
    expect(appointmentIncome(apt({ paymentStatus: 'WAIVED', service: { price: 50000 } }))).toBe(0)
    expect(appointmentIncome(apt({ paymentStatus: 'PENDING', precioFinal: 42000, service: { price: 50000 } }))).toBe(0)
  })
  it('counts the recorded payment when present', () => {
    expect(appointmentIncome(apt({ paymentStatus: 'PAID', amountPaid: 50000, service: { price: 60000 } }))).toBe(50000)
    expect(appointmentIncome(apt({ paymentStatus: 'PARTIAL', amountPaid: 30000, service: { price: 60000 } }))).toBe(30000)
  })
  it('falls back to the discounted snapshot, then the gross price', () => {
    expect(appointmentIncome(apt({ paymentStatus: 'PAID', amountPaid: null, precioFinal: 38000, service: { price: 45000 } }))).toBe(38000)
    expect(appointmentIncome(apt({ paymentStatus: 'PAID', amountPaid: null, precioFinal: null, service: { price: 45000 } }))).toBe(45000)
  })
})

describe('appointmentBalance', () => {
  it('is zero when settled (PAID) or waived', () => {
    expect(appointmentBalance(apt({ paymentStatus: 'PAID', amountPaid: 50000, service: { price: 50000 } }))).toBe(0)
    expect(appointmentBalance(apt({ paymentStatus: 'WAIVED', service: { price: 50000 } }))).toBe(0)
  })
  it('owes the full expected value when PENDING (snapshot before gross)', () => {
    expect(appointmentBalance(apt({ paymentStatus: 'PENDING', precioFinal: 42000, service: { price: 35000 } }))).toBe(42000)
  })
  it('owes the remainder when PARTIAL, never negative', () => {
    expect(appointmentBalance(apt({ paymentStatus: 'PARTIAL', amountPaid: 30000, service: { price: 60000 } }))).toBe(30000)
    // An overpayment must not surface as a negative balance.
    expect(appointmentBalance(apt({ paymentStatus: 'PARTIAL', amountPaid: 70000, service: { price: 60000 } }))).toBe(0)
  })
})
