// infra/maintenance/cloudflare-worker.js
// Cloudflare Worker — serves the branded maintenance page when the origin
// (EC2/k3s) is unreachable or returns 5xx. Deploy it on a route that matches
// the whole site, e.g.  vjbeautystudio.com/*
//
// It's automatic: while the server is ON it passes traffic straight through;
// when you turn the server OFF (or it 5xx's), visitors get the maintenance page
// with the WhatsApp button — no manual DNS switch needed.
//
// The HTML below mirrors infra/maintenance/index.html (and the k3s error page).

const ORIGIN_TIMEOUT_MS = 4000 // don't make visitors wait long on a dead origin

const MAINTENANCE_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mantenimiento — Valentina Jimenez Beauty Studio</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: #111111; color: #F2EBD9; font-family: Georgia, 'Times New Roman', serif; padding: 2rem; text-align: center; }
    body::before { content: ''; position: fixed; inset: 0; background: radial-gradient(ellipse 80% 60% at 50% 0%, #1E1A10 0%, #111111 70%); z-index: 0; }
    .container { position: relative; z-index: 1; max-width: 480px; width: 100%; }
    .monogram { display: inline-block; width: 80px; height: 80px; border: 1.5px solid #B8932A; border-radius: 50%; line-height: 78px; font-size: 1.75rem; letter-spacing: 0.12em; color: #D4AD5A; margin-bottom: 2rem; font-family: Georgia, serif; }
    .divider { width: 48px; height: 1px; background: linear-gradient(90deg, transparent, #B8932A, transparent); margin: 1.75rem auto; }
    .studio-label { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 0.65rem; letter-spacing: 0.3em; text-transform: uppercase; color: #B8932A; margin-bottom: 0.75rem; }
    h1 { font-size: clamp(1.6rem, 5vw, 2.2rem); font-weight: 300; letter-spacing: 0.04em; color: #F2EBD9; line-height: 1.25; margin-bottom: 0.5rem; }
    .tagline { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 0.78rem; letter-spacing: 0.22em; text-transform: uppercase; color: #7A7060; }
    .message { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 0.95rem; line-height: 1.7; color: #A09888; margin-top: 0; }
    .dot { display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: #B8932A; margin: 0 0.35rem; vertical-align: middle; animation: pulse 2s ease-in-out infinite; }
    .dot:nth-child(2) { animation-delay: 0.3s; }
    .dot:nth-child(3) { animation-delay: 0.6s; }
    @keyframes pulse { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }
    .dots-row { margin: 1.5rem 0 1.25rem; }
    .footer { margin-top: 3rem; font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 0.7rem; letter-spacing: 0.15em; color: #4A4035; text-transform: uppercase; }
    .whatsapp-btn { display: inline-flex; align-items: center; gap: 0.5rem; margin-top: 1rem; padding: 0.7rem 1.5rem; border: 1px solid #B8932A; border-radius: 999px; color: #D4AD5A; text-decoration: none; font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 0.8rem; letter-spacing: 0.08em; transition: background-color 0.2s ease, color 0.2s ease; }
    .whatsapp-btn:hover { background-color: #B8932A; color: #111111; }
    .whatsapp-btn svg { width: 16px; height: 16px; fill: currentColor; }
  </style>
</head>
<body>
  <div class="container">
    <div class="monogram">VJ</div>
    <p class="studio-label">Valentina Jimenez</p>
    <h1>Beauty Studio</h1>
    <p class="tagline">Uñas · Pestañas · Cejas · Cabello</p>
    <div class="divider"></div>
    <p class="message">Estamos realizando mantenimiento.<br />Regresamos muy pronto.</p>
    <div class="dots-row"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>
    <p class="message" style="font-size:0.82rem;">Para agendar tu cita, escríbenos directamente por WhatsApp:</p>
    <a class="whatsapp-btn" href="https://wa.me/573001790511?text=Hola%2C%20quiero%20agendar%20una%20cita." target="_blank" rel="noopener noreferrer">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.978-1.207zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
      Escribir por WhatsApp
    </a>
    <div class="footer">© Valentina Jimenez Beauty Studio</div>
  </div>
</body>
</html>`

function maintenanceResponse() {
  return new Response(MAINTENANCE_HTML, {
    status: 503,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'retry-after': '3600',
      'cache-control': 'no-store',
    },
  })
}

export default {
  async fetch(request) {
    // Pass through to the origin, but bail to the maintenance page if it's
    // unreachable (server OFF → connection error/timeout) or returns a 5xx.
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), ORIGIN_TIMEOUT_MS)
      const resp = await fetch(request, { signal: controller.signal })
      clearTimeout(timer)
      if (resp.status >= 500) return maintenanceResponse()
      return resp
    } catch {
      return maintenanceResponse()
    }
  },
}
