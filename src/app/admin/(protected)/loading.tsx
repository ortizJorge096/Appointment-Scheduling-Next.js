// src/app/admin/(protected)/loading.tsx
export default function AdminLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto animate-pulse">
      <div className="h-3 w-24 bg-beige-dark rounded mb-3" />
      <div className="h-8 w-48 bg-beige-dark rounded mb-8" />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 bg-white rounded-xl border border-beige-dark" />
        ))}
      </div>

      <div className="bg-white rounded-xl border border-beige-dark h-72" />
    </div>
  )
}
