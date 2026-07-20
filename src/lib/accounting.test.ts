// src/lib/accounting.test.ts
import {
  appointmentIncome, appointmentBalance, appointmentCharge, appointmentServiceTotal,
  type AppointmentMoney,
} from './accounting'

type Line = AppointmentMoney['services'][number]

// Builders for the money shape the helpers read. Every field is required in the
// type on purpose: a consumer that forgets to select one is a compile error, not a
// silently wrong total.
const line = (o: Partial<Line> & { price: number }): Line => ({
  descuentoTipo: null, descuentoValor: null, extras: [], ...o,
})
const apt = (o: Partial<AppointmentMoney> & { paymentStatus: string }): AppointmentMoney => ({
  amountPaid: null, precioFinal: null,
  descuentoTipo: null, descuentoValor: null, extras: [],
  service: { price: 0 }, services: [], ...o,
})

describe('appointmentServiceTotal (gross subtotal — no discounts, no extras)', () => {
  it('uses the single service price when there are no service lines', () => {
    expect(appointmentServiceTotal(apt({ paymentStatus: 'PAID', service: { price: 45000 } }))).toBe(45000)
  })
  it('sums the line prices of a multi-service appointment', () => {
    expect(appointmentServiceTotal(apt({
      paymentStatus: 'PAID', service: { price: 40000 },
      services: [line({ price: 40000 }), line({ price: 30000 })],
    }))).toBe(70000)
  })
})

describe('appointmentCharge', () => {
  // The reported bug: the list and accounting showed 65000 for an appointment with a
  // 15000 discount, because the charge was a raw sum of catalog prices.
  it('subtracts a per-line discount (65000 − 15000 = 50000)', () => {
    expect(appointmentCharge(apt({
      paymentStatus: 'PAID', service: { price: 65000 },
      services: [line({ price: 65000, descuentoTipo: 'VALOR_FIJO', descuentoValor: 15000 })],
    }))).toBe(50000)
  })

  it('applies an order-level discount over services + extras', () => {
    // (50000 + 10000) − 10% = 54000
    expect(appointmentCharge(apt({
      paymentStatus: 'PAID', service: { price: 50000 },
      services: [line({ price: 50000 })],
      extras: [{ amount: 10000, appointmentServiceId: null }],
      descuentoTipo: 'PORCENTAJE', descuentoValor: 10,
    }))).toBe(54000)
  })

  it('adds extras — they were silently dropped before, understating the charge', () => {
    expect(appointmentCharge(apt({
      paymentStatus: 'PAID', service: { price: 50000 },
      services: [line({ price: 50000 })],
      extras: [{ amount: 8000, appointmentServiceId: null }],
    }))).toBe(58000)
  })

  it('never double-counts an extra that belongs to a service line', () => {
    // Every extra row carries appointmentId, so the appointment-level list also
    // contains the line's extra. It must be counted once (inside its line).
    expect(appointmentCharge(apt({
      paymentStatus: 'PAID', service: { price: 50000 },
      services: [line({ price: 50000, extras: [{ amount: 8000 }] })],
      extras: [{ amount: 8000, appointmentServiceId: 'svc-1' }],
    }))).toBe(58000)
  })

  it('falls back to the single service price for a legacy appointment with no lines', () => {
    expect(appointmentCharge(apt({ paymentStatus: 'PAID', service: { price: 45000 } }))).toBe(45000)
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
  it('falls back to the discounted snapshot when there is no payment', () => {
    expect(appointmentIncome(apt({
      paymentStatus: 'PAID', precioFinal: 38000, service: { price: 45000 },
    }))).toBe(38000)
  })
  it('without a snapshot, falls back to the DISCOUNTED charge — not the gross price', () => {
    // precioFinal is only written in a few flows, so this fallback is what most
    // discounted appointments actually hit. It used to return 65000.
    expect(appointmentIncome(apt({
      paymentStatus: 'PAID', service: { price: 65000 },
      services: [line({ price: 65000, descuentoTipo: 'VALOR_FIJO', descuentoValor: 15000 })],
    }))).toBe(50000)
  })
})

describe('appointmentBalance', () => {
  it('is zero when settled (PAID) or waived', () => {
    expect(appointmentBalance(apt({ paymentStatus: 'PAID', amountPaid: 50000, service: { price: 50000 } }))).toBe(0)
    expect(appointmentBalance(apt({ paymentStatus: 'WAIVED', service: { price: 50000 } }))).toBe(0)
  })
  it('owes the full expected value when PENDING (snapshot before computed charge)', () => {
    expect(appointmentBalance(apt({ paymentStatus: 'PENDING', precioFinal: 42000, service: { price: 35000 } }))).toBe(42000)
  })
  it('owes the DISCOUNTED charge when PENDING and there is no snapshot', () => {
    expect(appointmentBalance(apt({
      paymentStatus: 'PENDING', service: { price: 65000 },
      services: [line({ price: 65000, descuentoTipo: 'VALOR_FIJO', descuentoValor: 15000 })],
    }))).toBe(50000)
  })
  it('owes the remainder when PARTIAL, never negative', () => {
    expect(appointmentBalance(apt({ paymentStatus: 'PARTIAL', amountPaid: 30000, service: { price: 60000 } }))).toBe(30000)
    // An overpayment must not surface as a negative balance.
    expect(appointmentBalance(apt({ paymentStatus: 'PARTIAL', amountPaid: 70000, service: { price: 60000 } }))).toBe(0)
  })
})
