"""Fehler-Taxonomie für die Eversports-Plattform.

Erbt von RuntimeError, damit bestehende `except RuntimeError`-Handler
(Worker, API) während der Migration weiter funktionieren.
"""


class EversportsError(RuntimeError):
    """Basisklasse aller Eversports-Fehler."""


class AuthFailed(EversportsError):
    """Login fehlgeschlagen (falsche Credentials oder Plattform lehnt ab)."""


class SlotNotFound(EversportsError):
    """Kurs/Slot im Kalender nicht gefunden (Name, Zeit oder Datum passen nicht)."""


class PlatformError(EversportsError):
    """HTTP- oder GraphQL-Fehler der Plattform (5xx, ExpectedErrors ohne bekannte Klassifikation)."""


class MarkupDrift(EversportsError):
    """Erwartete HTML-Struktur nicht gefunden — Eversports hat das Markup geändert.

    Signal für: Parser-Fixtures aktualisieren, Selektoren anpassen.
    """

    def __init__(self, message: str, page: str = ""):
        super().__init__(f"{message} (Seite: {page})" if page else message)
        self.page = page
