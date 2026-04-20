# CLAUDE.md

## DB-Migrationen lokal ausführen

Die lokale Datenbank liegt unter `eversports.db` im Projektwurzel-Verzeichnis.

### SQLite-Datenbank erstellen (einmalig)

Falls `eversports.db` noch nicht existiert, wird sie automatisch beim ersten Ausführen von `upgrade head` erstellt. Alternativ explizit anlegen:

```bash
touch eversports.db
```

Danach alle Migrationen einspielen:

```bash
DATABASE_URL=sqlite:///eversports.db \
  alembic -c backend/alembic.ini upgrade head
```

Neue Migration erstellen (autogenerate):

```bash
DATABASE_URL=sqlite:///eversports.db \
  alembic -c backend/alembic.ini revision --autogenerate -m "beschreibung"
```

Aktuellen Stand prüfen:

```bash
DATABASE_URL=sqlite:///eversports.db \
  alembic -c backend/alembic.ini current
```

## Tests ausführen

```bash
pytest tests/ -x
```
