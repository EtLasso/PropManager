# 🏢 PropManager – UI-Index

> **Premium-Frontend für moderne Hausverwaltung**  
> Eine elegante, responsive HTML5-Schnittstelle mit Dark-Mode-Unterstützung.

---

## ✨ Features

- 🎨 **Modernes Design** – Clean & minimalistisch mit Gold- und Gray-Palette
- 🌙 **Dark Mode** – Vollständige Dunkel-Modus-Unterstützung mit Theme-Toggle
- 📱 **Responsive Layout** – Optimiert für Desktop, Tablet & Mobile
- ⚡ **Performance** – Optimierte CSS, keine Heavy-Dependencies
- 🔐 **Supabase-Ready** – Vorbereitet für Backend-Integration
- ♿ **Accessible** – Semantic HTML, WCAG-konform

---

## 📋 Inhalte

```
PropManager/
├── index.html          # Komplette Anwendungs-UI
├── README.md           # Diese Datei
└── [Backend-Ordner]    # Nicht in diesem Repo
```

### Enthaltene Komponenten

| Element | Beschreibung |
|---------|------------|
| **Cover-Seite** | Hero-Landing mit Feature-Highlights |
| **Login-Overlay** | Authentifizierung für mehrere Rollen |
| **Dashboard** | KPI-Cards, Statistiken, Navigation |
| **Komponenten** | Cards, Buttons, Tags, Drawer-Menu |
| **Theme-System** | Light/Dark Mode mit CSS-Variablen |

---

## 🎯 Rollen & Funktionen

- 👤 **Admin** – Vollständige Tenantenverwaltung
- 🏠 **Hausmeister** – Immobilien- & Schadenverwaltung
- 📊 **Buchhalter** – Finanzberichte & Transaktionen
- 👥 **Mieter** – Portal für Dokumenten-Upload & Anfragen

---

## 🚀 Verwendung

1. **Lokal öffnen:**
   ```bash
   # Einfach im Browser öffnen
   open index.html
   ```

2. **Mit Backend verbinden:**
   - Frontend mit Supabase-Datenbank verbinden
   - `js/supabase-config.js` konfigurieren
   - Backend-Server starten (Node.js/Express)

---

## 🎨 Design-Highlights

### Farbschema
```css
Light Mode:  Gold (#B45309), Blue (#1E40AF), Green (#15803D), Teal (#0F766E)
Dark Mode:   Warme Grays (#0F0E0C–#2E2B28) + Accent-Farben
```

### Typografie
- **Display:** Playfair Display (Premium, elegant)
- **Körper:** DM Sans (modern, lesbar)
- **Monospace:** JetBrains Mono (Code & Data)

---

## 📦 Technologie-Stack

| Layer | Tech |
|-------|------|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript |
| **Icons** | RemixIcon-Set |
| **Fonts** | Google Fonts CDN |
| **Backend** | Supabase (PostgreSQL + Auth) |
| **Deployment** | Beliebig (statisch) |

---

## 🔧 Konfiguration

**Environment-Variablen** (in `supabase-config.js`):
```javascript
const SUPABASE_URL = "your-supabase-url";
const SUPABASE_ANON_KEY = "your-anon-key";
---

## 🤝 Credits

**Entwicklung:** Ricardo dos Santos  
**Design-System:** Custom, responsive CSS  
**Assets:** RemixIcon, Google Fonts

---

## 💬 Support & Kontakt

Fragen oder Verbesserungen? Öffne ein Issue oder kontaktiere das Team.

---

<div align="center">

**[Live Demo](#)** • **[Dokumentation](#)** • **[Issues](../../issues)**

*Gebaut mit ❤️ für intelligente Hausverwaltung.*

</div>
