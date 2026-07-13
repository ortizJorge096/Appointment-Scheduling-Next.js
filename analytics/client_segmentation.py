#!/usr/bin/env python3
"""
analytics/client_segmentation.py

RFM client segmentation for Valentina Jimenez Beauty Studio — READ-ONLY.

Reads the Postgres database (DATABASE_URL) and buckets every active client by:
  • Recency   — days since their last COMPLETED visit
  • Frequency — number of COMPLETED visits
  • Monetary  — total pesos actually paid

It writes nothing to the database. Outputs:
  • a console summary per segment,
  • output/clientes_rfm.csv        — every client with R/F/M + segment,
  • output/reenganche_whatsapp.csv — the "En riesgo" / "Inactivo" list, each row
                                     with a ready-to-send wa.me win-back link.

Run against dev or a read replica — never write traffic. The CSVs contain PII
(names, phones), so the output/ folder is git-ignored.

Usage:
    export DATABASE_URL=postgresql://user:pass@host:5432/db   # or read from .env.local
    python analytics/client_segmentation.py
    python analytics/client_segmentation.py --out ./analytics/output
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from datetime import date
from pathlib import Path
from urllib.parse import parse_qsl, quote, urlencode, urlsplit, urlunsplit

try:
    import pandas as pd
    import psycopg2
except ImportError:
    sys.exit("✖ Faltan dependencias. Corre:  pip install -r analytics/requirements.txt")

# ── Business thresholds (tweak these to taste) ───────────────────────────────
RECENCY_ACTIVE = 60    # days: last visit within → still "active"
RECENCY_RISK   = 90    # days: beyond → starts cooling off ("en riesgo")
RECENCY_LOST   = 180   # days: beyond → "inactivo"
VIP_MIN_VISITS = 5     # completed visits to qualify as VIP
WA_COUNTRY     = os.environ.get("WHATSAPP_COUNTRY", "57")  # Colombia dialing code

WINBACK_MSG = (
    "¡Hola {name}! 💅 Hace un tiempo que no te vemos por Valentina Jimenez Beauty "
    "Studio. ¿Te gustaría agendar tu próxima cita? Con gusto te damos un horario 😊"
)

QUERY = """
    SELECT
        c.id,
        c.name,
        c.phone,
        c."phoneNormalized" AS phone_norm,
        c.email,
        c."createdAt"       AS client_since,
        a.date              AS appt_date,
        a.status            AS status,
        a."amountPaid"      AS amount_paid
    FROM clients c
    LEFT JOIN appointments a ON a."clientId" = c.id
    WHERE c."deletedAt" IS NULL
"""

# libpq understands these; Prisma-only params (schema, connection_limit, pgbouncer)
# are dropped so psycopg2 doesn't choke on them.
LIBPQ_PARAMS = {"sslmode", "sslrootcert", "sslcert", "sslkey", "connect_timeout", "application_name", "options"}


def load_database_url() -> str:
    """DATABASE_URL from the environment, or from .env.local / .env at the repo root."""
    if os.environ.get("DATABASE_URL"):
        return os.environ["DATABASE_URL"]
    root = Path(__file__).resolve().parent.parent
    for name in (".env.local", ".env"):
        f = root / name
        if not f.exists():
            continue
        for line in f.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("✖ No encontré DATABASE_URL (ni en el entorno ni en .env.local/.env).")


def connect(database_url: str):
    """Open a psycopg2 connection, keeping only libpq-safe query params."""
    p = urlsplit(database_url)
    q = [(k, v) for k, v in parse_qsl(p.query) if k in LIBPQ_PARAMS]
    dsn = urlunsplit(("postgresql", p.netloc, p.path, urlencode(q), ""))
    return psycopg2.connect(dsn)


def fetch(conn) -> pd.DataFrame:
    with conn.cursor() as cur:
        cur.execute(QUERY)
        cols = [d[0] for d in cur.description]
        return pd.DataFrame(cur.fetchall(), columns=cols)


def segment(recency_days: float, visits: int) -> str:
    """Map one client to an actionable, human segment (priority order matters)."""
    if visits == 0 or pd.isna(recency_days):
        return "Sin visitas"
    if recency_days > RECENCY_LOST:
        return "Inactivo"
    if visits >= VIP_MIN_VISITS and recency_days <= RECENCY_RISK:
        return "VIP"
    if visits >= 2 and recency_days > RECENCY_RISK:      # 90 < r <= 180, a regular cooling off
        return "En riesgo"
    if recency_days <= RECENCY_ACTIVE:
        return "Nuevo" if visits == 1 else "Activo"
    return "Tibio"                                       # 60 < r <= 90


def rfm_score(series: pd.Series, higher_is_better: bool) -> pd.Series:
    """1–5 quintile score; robust to sparse data (few distinct values)."""
    labels = [1, 2, 3, 4, 5] if higher_is_better else [5, 4, 3, 2, 1]
    try:
        binned = pd.qcut(series.rank(method="first"), 5, labels=labels)
        return binned.astype(int)
    except (ValueError, IndexError):
        return pd.Series(0, index=series.index)


def wa_link(phone_norm, phone, name) -> str:
    digits = str(phone_norm or "") or re.sub(r"\D", "", str(phone or ""))
    if not digits:
        return ""
    if len(digits) == 10:                # local 10-digit number → prepend country code
        digits = WA_COUNTRY + digits
    first = (str(name or "").strip().split(" ") or [""])[0]
    return f"https://wa.me/{digits}?text={quote(WINBACK_MSG.format(name=first))}"


def cop(n) -> str:
    return f"${int(n):,}".replace(",", ".")


def main() -> None:
    ap = argparse.ArgumentParser(description="Segmentación RFM de clientes (solo lectura).")
    ap.add_argument("--out", default=str(Path(__file__).resolve().parent / "output"),
                    help="Carpeta de salida para los CSV (default: analytics/output)")
    args = ap.parse_args()

    conn = connect(load_database_url())
    try:
        raw = fetch(conn)
    finally:
        conn.close()

    if raw.empty:
        sys.exit("✖ No hay clientes activos en la base de datos.")

    today = pd.Timestamp(date.today())
    raw["appt_date"] = pd.to_datetime(raw["appt_date"])

    # Realized value = COMPLETED visits only (ignores cancelled / no-show / pending).
    done = raw[raw["status"] == "COMPLETED"]
    agg = done.groupby("id").agg(
        visits=("appt_date", "count"),
        last_visit=("appt_date", "max"),
        spent=("amount_paid", lambda s: pd.to_numeric(s, errors="coerce").fillna(0).sum()),
    )
    no_shows = raw[raw["status"] == "NO_SHOW"].groupby("id").size().rename("no_shows")

    clients = raw.drop_duplicates("id").set_index("id")[["name", "phone", "phone_norm", "email", "client_since"]]
    df = clients.join(agg).join(no_shows).reset_index()
    df["visits"] = df["visits"].fillna(0).astype(int)
    df["spent"] = df["spent"].fillna(0).astype(int)
    df["no_shows"] = df["no_shows"].fillna(0).astype(int)
    df["recency_days"] = (today - df["last_visit"]).dt.days
    df["segmento"] = [segment(r, v) for r, v in zip(df["recency_days"], df["visits"])]

    # Standard R/F/M 1–5 scores over clients who have at least one visit.
    visited = df["visits"] > 0
    df["R"], df["F"], df["M"] = 0, 0, 0
    if visited.any():
        df.loc[visited, "R"] = rfm_score(df.loc[visited, "recency_days"], higher_is_better=False)
        df.loc[visited, "F"] = rfm_score(df.loc[visited, "visits"], higher_is_better=True)
        df.loc[visited, "M"] = rfm_score(df.loc[visited, "spent"], higher_is_better=True)

    # ── Console summary ──────────────────────────────────────────────────────
    order = ["VIP", "Activo", "Nuevo", "Tibio", "En riesgo", "Inactivo", "Sin visitas"]
    counts = df["segmento"].value_counts()
    print(f"\n📊 Segmentación RFM — {len(df)} clientes activos  (corte: {today.date()})\n")
    for seg in order:
        n = int(counts.get(seg, 0))
        if n:
            print(f"  {seg:<12} {n:>4}")

    reengage = df[df["segmento"].isin(["En riesgo", "Inactivo"])].copy()
    reengage = reengage[reengage["visits"] >= 1]
    reengage["wa_link"] = [wa_link(pn, p, n) for pn, p, n in
                           zip(reengage["phone_norm"], reengage["phone"], reengage["name"])]
    # En riesgo first (higher intent), then by historical spend.
    reengage["_prio"] = (reengage["segmento"] == "En riesgo").astype(int)
    reengage = reengage.sort_values(["_prio", "spent"], ascending=[False, False]).drop(columns="_prio")

    on_the_table = int(reengage["spent"].sum())
    print(f"\n💤 Para re-enganchar por WhatsApp: {len(reengage)} clientes "
          f"(histórico ${on_the_table:,} en compras).".replace(",", "."))
    for _, r in reengage.head(10).iterrows():
        print(f"   • {str(r['name'])[:26]:<26} {str(r['phone'] or '—'):<14} "
              f"{r['visits']}x · {cop(r['spent']):>10} · hace {int(r['recency_days'])}d · {r['segmento']}")
    if len(reengage) > 10:
        print(f"   … y {len(reengage) - 10} más en el CSV.")

    # ── CSV output ───────────────────────────────────────────────────────────
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    cols = ["name", "phone", "email", "segmento", "visits", "spent", "recency_days",
            "last_visit", "no_shows", "R", "F", "M", "client_since"]
    df.sort_values(["segmento", "spent"], ascending=[True, False])[cols].to_csv(
        out / "clientes_rfm.csv", index=False)
    reengage[["name", "phone", "segmento", "visits", "spent", "recency_days", "last_visit", "wa_link"]].to_csv(
        out / "reenganche_whatsapp.csv", index=False)

    print(f"\n✔ Listo:\n   {out / 'clientes_rfm.csv'}\n   {out / 'reenganche_whatsapp.csv'}\n")


if __name__ == "__main__":
    main()
