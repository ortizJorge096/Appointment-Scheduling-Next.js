// src/instrumentation.ts
// Next.js startup hook (runs once when the server boots). Importing the env
// module here executes its Zod validation as a side effect, so the app fails
// fast on missing/invalid configuration in production instead of erroring
// lazily on the first request that happens to need a given variable.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('@/lib/env')
  }
}
