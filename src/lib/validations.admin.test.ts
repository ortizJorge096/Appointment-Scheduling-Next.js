// src/lib/validations.admin.test.ts
import { describe, it, expect } from 'vitest'
import { changePasswordSchema, createUserSchema, updateUserSchema } from './validations'
import { Role } from '@prisma/client'

const STRONG = 'NewPass1'

describe('changePasswordSchema', () => {
  it('accepts a strong, matching, distinct new password', () => {
    const r = changePasswordSchema.safeParse({ currentPassword: 'OldPass1', newPassword: STRONG, confirmPassword: STRONG })
    expect(r.success).toBe(true)
  })
  it('rejects when confirmation does not match', () => {
    const r = changePasswordSchema.safeParse({ currentPassword: 'OldPass1', newPassword: STRONG, confirmPassword: 'Other1AA' })
    expect(r.success).toBe(false)
  })
  it('rejects a weak new password (no uppercase / digit / length)', () => {
    expect(changePasswordSchema.safeParse({ currentPassword: 'x', newPassword: 'short1', confirmPassword: 'short1' }).success).toBe(false)
    expect(changePasswordSchema.safeParse({ currentPassword: 'x', newPassword: 'nouppercase1', confirmPassword: 'nouppercase1' }).success).toBe(false)
    expect(changePasswordSchema.safeParse({ currentPassword: 'x', newPassword: 'NoDigitsHere', confirmPassword: 'NoDigitsHere' }).success).toBe(false)
  })
  it('rejects when the new password equals the current one', () => {
    const r = changePasswordSchema.safeParse({ currentPassword: STRONG, newPassword: STRONG, confirmPassword: STRONG })
    expect(r.success).toBe(false)
  })
})

describe('createUserSchema', () => {
  it('accepts a valid admin and defaults role to ADMIN', () => {
    const r = createUserSchema.safeParse({ name: 'Ana', email: 'ana@test.com', password: STRONG })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.role).toBe('ADMIN')
  })
  it('rejects an invalid email and a weak password', () => {
    expect(createUserSchema.safeParse({ name: 'Ana', email: 'nope', password: STRONG }).success).toBe(false)
    expect(createUserSchema.safeParse({ name: 'Ana', email: 'ana@test.com', password: 'weak' }).success).toBe(false)
  })
  it('accepts every role defined in the Prisma enum', () => {
    for (const role of Object.values(Role)) {
      const r = createUserSchema.safeParse({ name: 'Ana', email: 'ana@test.com', password: STRONG, role })
      expect(r.success).toBe(true)
      if (r.success) expect(r.data.role).toBe(role)
    }
  })
  it('rejects a role outside the Prisma enum', () => {
    expect(createUserSchema.safeParse({ name: 'Ana', email: 'ana@test.com', password: STRONG, role: 'GOD_MODE' }).success).toBe(false)
  })
})

describe('updateUserSchema', () => {
  it('rejects an empty patch (nothing to update)', () => {
    expect(updateUserSchema.safeParse({}).success).toBe(false)
  })
  it('accepts a partial update', () => {
    expect(updateUserSchema.safeParse({ isActive: false }).success).toBe(true)
    expect(updateUserSchema.safeParse({ role: 'SUPER_ADMIN' }).success).toBe(true)
  })
  it('rejects a weak reset password', () => {
    expect(updateUserSchema.safeParse({ newPassword: 'weak' }).success).toBe(false)
  })
  it('accepts every role defined in the Prisma enum', () => {
    for (const role of Object.values(Role)) {
      expect(updateUserSchema.safeParse({ role }).success).toBe(true)
    }
  })
  it('rejects a role outside the Prisma enum', () => {
    expect(updateUserSchema.safeParse({ role: 'GOD_MODE' }).success).toBe(false)
  })
})
