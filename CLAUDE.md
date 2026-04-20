# CLAUDE.md

## DB-Migrationen lokal ausführen

Die lokale Datenbank liegt unter `eversports.db` im Projektwurzel-Verzeichnis.

```bash
DATABASE_URL=sqlite:////Users/gerrit/Code/Automate-Eversports-Bookings/eversports.db \
  alembic -c backend/alembic.ini upgrade head
```

Neue Migration erstellen (autogenerate):

```bash
DATABASE_URL=sqlite:////Users/gerrit/Code/Automate-Eversports-Bookings/eversports.db \
  alembic -c backend/alembic.ini revision --autogenerate -m "beschreibung"
```

Aktuellen Stand prüfen:

```bash
DATABASE_URL=sqlite:////Users/gerrit/Code/Automate-Eversports-Bookings/eversports.db \
  alembic -c backend/alembic.ini current
```

## Tests ausführen

```bash
pytest tests/ -x
```
