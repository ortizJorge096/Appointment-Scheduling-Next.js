# Analytics (Python)

Herramientas de análisis **de solo lectura** sobre la base de datos del estudio.
Aisladas del app de Next: su propio `requirements.txt` y virtualenv. No escriben
nada en la base de datos.

## Setup (una vez)

```bash
cd analytics
python -m venv .venv
source .venv/bin/activate        # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Segmentación RFM de clientes

Clasifica a cada cliente activo por **Recencia** (días desde su última cita
completada), **Frecuencia** (nº de citas completadas) y **Monetario** (total
pagado), y arma la lista accionable de a quién contactar para que vuelva.

```bash
# La DATABASE_URL se toma del entorno o de .env.local / .env en la raíz del repo.
python client_segmentation.py

# O apuntando explícito (ej. una réplica de lectura):
DATABASE_URL=postgresql://user:pass@host:5432/db python client_segmentation.py
```

### Qué genera

- **Consola** — cuántos clientes hay por segmento (VIP, Activo, Nuevo, Tibio,
  En riesgo, Inactivo) y el top de la lista de re-enganche.
- **`output/clientes_rfm.csv`** — todos los clientes con sus scores R/F/M y segmento.
- **`output/reenganche_whatsapp.csv`** — los clientes *En riesgo* e *Inactivos*,
  cada uno con un **link `wa.me` listo** (mensaje de re-enganche pre-cargado).

> ⚠️ Los CSV traen datos personales (nombres, teléfonos): la carpeta `output/`
> está en `.gitignore`. Córrelo contra **dev o una réplica**, no contra la BD de
> producción con tráfico de escritura.

### Segmentos (umbrales en la cabecera del script, editables)

| Segmento    | Regla |
|-------------|-------|
| **VIP**       | ≥ 5 visitas y última ≤ 90 días |
| **Activo**    | ≥ 2 visitas y última ≤ 60 días |
| **Nuevo**     | 1 visita y última ≤ 60 días |
| **Tibio**     | última entre 60 y 90 días |
| **En riesgo** | ≥ 2 visitas y última entre 90 y 180 días |
| **Inactivo**  | última > 180 días |
| **Sin visitas** | sin citas completadas aún |
