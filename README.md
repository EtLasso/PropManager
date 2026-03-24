# [PropManager](https://etlasso.github.io/PropManager/) - UI-Index

> Premium-Frontend fuer moderne Hausverwaltung
> Eine elegante, responsive HTML5-Schnittstelle mit Dark-Mode-Unterstuetzung.

---

## Features

- Modernes Design - Clean und minimalistisch mit Gold- und Gray-Palette
- Dark Mode - Vollstaendige Dunkel-Modus-Unterstuetzung mit Theme-Toggle
- Responsive Layout - Optimiert fuer Desktop, Tablet und Mobile
- Performance - Optimierte CSS, keine Heavy-Dependencies
- Supabase-Ready - Vorbereitet fuer Backend-Integration
- Accessible - Semantic HTML, WCAG-konform

---

## Inhalte

```text
PropManager/
|-- index.html        # Komplette Anwendungs-UI
|-- README.md         # Diese Datei
`-- [Backend-Ordner]  # Nicht in diesem Repo
```

### Enthaltene Komponenten

| Element | Beschreibung |
|---------|--------------|
| Cover-Seite | Hero-Landing mit Feature-Highlights |
| Login-Overlay | Authentifizierung fuer mehrere Rollen |
| Dashboard | KPI-Cards, Statistiken, Navigation |
| Komponenten | Cards, Buttons, Tags, Drawer-Menu |
| Theme-System | Light/Dark Mode mit CSS-Variablen |

---

## Rollen und Funktionen

- Admin - Vollstaendige Tenantenverwaltung
- Hausmeister - Immobilien- und Schadenverwaltung
- Buchhalter - Finanzberichte und Transaktionen
- Mieter - Portal fuer Dokumenten-Upload und Anfragen

---

## Verwendung

1. Lokal oeffnen:

   ```bash
   open index.html
   ```

2. Mit Backend verbinden:

- Frontend mit Supabase-Datenbank verbinden
- `js/supabase-config.js` konfigurieren
- Backend-Server starten (Node.js/Express)

3. Online aufrufen:

- [PropManager Live-Seite](https://etlasso.github.io/PropManager/)

---

## Design-Highlights

### Farbschema

```css
Light Mode: Gold (#B45309), Blue (#1E40AF), Green (#15803D), Teal (#0F766E)
Dark Mode: Warme Grays (#0F0E0C - #2E2B28) + Accent-Farben
```

### Typografie

- Display: Playfair Display
- Koerper: DM Sans
- Monospace: JetBrains Mono

---

## Technologie-Stack

| Layer | Tech |
|-------|------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Icons | RemixIcon-Set |
| Fonts | Google Fonts CDN |
| Backend | Supabase (PostgreSQL + Auth) |
| Deployment | Statisch, z. B. GitHub Pages |

---

## Konfiguration

Environment-Variablen in `js/supabase-config.js`:

```javascript
const SUPABASE_URL = "your-supabase-url";
const SUPABASE_ANON_KEY = "your-anon-key";
```

---

## Credits

Entwicklung: Ricardo dos Santos
Design-System: Custom, responsive CSS
Assets: RemixIcon, Google Fonts

---

## Support und Kontakt

Fragen oder Verbesserungen? Oeffne ein Issue oder kontaktiere das Team.

---

<div align="center">

**[Live Demo](https://etlasso.github.io/PropManager/)** • **[Dokumentation](#)** • **[Issues](../../issues)**

Gebaut fuer intelligente Hausverwaltung.

</div>
