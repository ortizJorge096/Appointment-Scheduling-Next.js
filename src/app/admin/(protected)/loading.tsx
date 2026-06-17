// src/app/admin/(protected)/loading.tsx
// Shared loading skeleton for every protected admin route — improves perceived
// performance while the server component fetches data.
export default function AdminLoading() {
  return (
    <div className="p-8 max-w-6xl animate-pulse">
      <div className="h-3 w-24 bg-beige-dark rounded mb-3" />
      <div className="h-8 w-48 bg-beige-dark rounded mb-8" />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 bg-white border border-beige-dark/60 rounded-2xl shadow-sm" />
        ))}
      </div>

      {/* Content block */}
      <div className="bg-white border border-beige-dark/60 rounded-2xl shadow-sm h-72" />
    </div>
  )
}
