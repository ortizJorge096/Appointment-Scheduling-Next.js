import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Suspense } from 'react'
import ClienteDetailPage from './page'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))
// SUPER_ADMIN → the permission guard never redirects and "Editar datos" renders.
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'a1', role: 'SUPER_ADMIN' } }, status: 'authenticated' }),
}))

// A client WITHOUT email — the case that used to hang the "Editar datos" save:
// null.trim() threw and, with no try/catch, the "Guardando…" spinner never cleared.
const CLIENT = {
  id: 'c1', name: 'Ana Sin Correo', email: null, phone: '3001112233', notes: null,
  createdAt: '2026-06-10T10:00:00.000Z',
  appointments: [], _count: { appointments: 0 },
}

function makeFetch() {
  return vi.fn((_url: string, opts?: { method?: string }) => {
    const method = opts?.method ?? 'GET'
    if (method === 'PATCH') {
      return Promise.resolve({ json: () => Promise.resolve({ success: true, data: { ...CLIENT, name: 'Ana Editada' } }) })
    }
    return Promise.resolve({ json: () => Promise.resolve({ success: true, data: CLIENT }) })
  })
}

// React 19's use() reads a thenable SYNCHRONOUSLY when it's pre-tagged as
// fulfilled. A plain Promise.resolve() instead makes use() suspend, and in jsdom
// the microtask retry never settles → the tree stays stuck on the Suspense
// fallback ("cargando"). Pre-tagging renders synchronously and avoids the hang.
function resolvedParams<T>(value: T): Promise<T> {
  return Object.assign(Promise.resolve(value), { status: 'fulfilled', value })
}

describe('ClienteDetailPage — editar un cliente sin email', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('no se cuelga al guardar el nombre (email null → "" y PATCH se dispara)', async () => {
    global.fetch = makeFetch() as unknown as typeof fetch

    const params = resolvedParams({ id: 'c1' })
    render(
      <Suspense fallback={<div>cargando</div>}>
        <ClienteDetailPage params={params} />
      </Suspense>,
    )

    await screen.findByRole('heading', { name: 'Ana Sin Correo' })

    fireEvent.click(screen.getByRole('button', { name: /editar datos/i }))

    // email null is coerced to '' — the input is empty, not the string "null".
    expect(screen.getByPlaceholderText(/email/i)).toHaveValue('')

    fireEvent.change(screen.getByPlaceholderText('Nombre'), { target: { value: 'Ana Editada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    // The PATCH fires (no crash on null.trim)…
    await waitFor(() => {
      const patched = vi.mocked(global.fetch as ReturnType<typeof makeFetch>).mock.calls
        .some((c) => (c[1] as { method?: string } | undefined)?.method === 'PATCH')
      expect(patched).toBe(true)
    })
    // …and the spinner clears (no infinite "Guardando…").
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /guardando/i })).not.toBeInTheDocument()
    })
  })
})
