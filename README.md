# 🏕️ Route Planner — *In Route sì! Ma quando?*

[![Node.js](https://img.shields.io/badge/Node.js-20+-68a063?logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon_Serverless-4169e1?logo=postgresql&logoColor=white)](https://neon.tech/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel&logoColor=white)](https://vercel.com/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

Una web application moderna, ad alte prestazioni e ottimizzata per smartphone, pensata per **Clan e Fuoco scout** (e gruppi di amici) per raccogliere le disponibilità estive individuali e calcolare automaticamente le **date migliori per la Route estiva** tra Luglio e Agosto.

---

## 🧭 Il Problema che Risolve

Ogni anno, per i capi e i ragazzi di Clan/Fuoco, organizzare la Route estiva significa affrontare il consueto caos:
- Messaggi dispersi su chat WhatsApp.
- Tabelle e sondaggi infiniti difficili da consultare su smartphone.
- Esami universitari, sessioni estive, lavori stagionali e vacanze di famiglia che si sovrappongono.

**Route Planner** centralizza tutto in una singola interfaccia pulita e immediata: ogni partecipante tocca i propri giorni liberi dal telefono e il sistema genera una **mappa termica delle presenze** calcolando all'istante l'intervallo continuo con la massima affluenza possibile.

---

## ✨ Funzionalità Principali

### 🏕️ Gestione Multi-Clan
* Supporto per gruppi distinti con isolamento completo dei dati.
* Accesso immediato con salvataggio automatico del Clan nel browser.
* Creazione rapida di nuovi gruppi con selezione automatica senza dover ricaricare la pagina.

### 📅 Calendario Disponibilità a Prova di Smartphone
* **Copertura Completa**: tutti i 62 giorni di Luglio e Agosto.
* **Touch Intelligente**: algoritmo di rilevamento che distingue tra **tap** (< 8px) e **scorrimento verticale della pagina**, garantendo uno scroll naturale al 100% senza blocchi o selezioni involontarie.
* **Strumento "Seleziona Periodo"**: tocca il giorno di inizio e il giorno di fine per selezionare intere settimane in un attimo, senza bisogno di trascinare il dito.
* **Scorciatoie Rapide**: *"Tutti i weekend"*, *"Tutto Luglio"*, *"Tutto Agosto"*, *"Svuota selezione"*.
* **Desktop Compatto**: vista ottimizzata che racchiude entrambi i mesi in una sola schermata senza dover scorrere verticalmente.

### 🔄 Modifica Dati Senza Errori
* Menu a tendina che elenca i nomi già registrati nel Clan: non serve ricordare l'esatta sintassi con cui ci si era iscritti.
* Caricamento immediato del calendario pre-compilato con le date precedentemente salvate.
* Aggiornamento e de-duplicazione atomica sul database.

### 🏆 Algoritmo "Miglior Slot Continuo"
* Calcola le finestre continuative di almeno $N$ giorni (personalizzabili da 2 a 31 giorni, default 6) con il maggior numero di partecipanti presenti.
* **Resiliente**: se nel gruppo nessuno ha il 100% di giorni liberi contemporaneamente, l'algoritmo non fallisce ma calcola e propone le migliori opzioni con la massima affluenza e media giornaliera.
* Espansione automatica dell'intervallo se anche i giorni adiacenti mantengono la stessa presenza.

### 📊 Heatmap Visiva & Dettaglio "Chi c'è / Chi manca"
* Griglia del calendario colorata con intensità di verde proporzionale alla percentuale di presenze del giorno.
* **Modale interattiva**: cliccando su un giorno qualsiasi si apre la scheda dettagliata con:
  - Percentuale e barra di avanzamento delle presenze.
  - Badge verdi con spunta per i membri **Presenti**.
  - Badge per i membri **Assenti / Non disponibili**.

### 📋 Condivisione con un Click su WhatsApp
* Pulsante dedicato nella pagina dei risultati per copiare negli appunti un messaggio pre-formattato con emoji, date dello slot migliore e riassunto delle presenze, pronto da incollare nella chat del Clan.

---

## 🏗️ Architettura & Stack Tecnologico

L'applicazione segue la filosofia **Zero-Build**: nessun bundler pesante (Webpack, Vite), nessun framework frontend (React, Vue) e nessun compilatore CSS (Tailwind). Tutto il codice è nativo, leggero e si carica istantaneamente anche con connessioni mobili 3G/4G in montagna.

* **Backend**: Node.js + Express.js (architettura CommonJS `require`).
* **Database**: PostgreSQL cloud su [Neon](https://neon.tech/) tramite `@neondatabase/serverless` su HTTP over-the-wire.
* **Frontend**: Vanilla HTML5 semantico, JavaScript ES6+ e CSS3 con Custom Properties (sistema di design *"Modern Alpine"*).
* **Hosting**: Compatibile sia in locale sia come serverless function su [Vercel](https://vercel.com/) (`vercel.json`).

---

## 📁 Struttura del Progetto

```text
route-planner/
├── views/                        # Viste HTML statiche
│   ├── clan-select.html          # Selezione e creazione Clan
│   ├── home.html                 # Dashboard del gruppo con statistiche membri
│   ├── add.html                  # Compilazione disponibilità con calendario touch
│   ├── modify.html               # Modifica date per membri registrati
│   └── results.html              # Risultati, Heatmap e calcolo slot migliore
├── public/                       # Risorse statiche servite da Express / Vercel
│   ├── css/
│   │   └── styles.css            # Design System Modern Alpine (variabili CSS)
│   └── js/
│       ├── clan-select.js        # Logica di onboarding e memorizzazione Clan
│       ├── home.js               # Caricamento statistiche e badge partecipanti
│       ├── add.js                # Interazione calendario, range picker e salvataggio
│       ├── modify.js             # Ricerca partecipante e aggiornamento atomico
│       └── results.js            # Heatmap presenze, slot algorithm e modale
├── app.js                        # Server Express, middleware cold-start e API REST
├── dbtest.js                     # Script di verifica connettività a Neon
├── vercel.json                   # Configurazione per il deploy su Vercel
├── AGENTS.md                     # Linee guida universali per AI coding assistants
└── package.json                  # Dipendenze e script di avvio
```

---

## 🚀 Guida all'Avvio in Locale

### 1. Prerequisiti
* [Node.js](https://nodejs.org/) (versione 18 o superiore raccomandata).
* Un database PostgreSQL (es. istanza gratuita su [Neon Console](https://console.neon.tech)).

### 2. Installazione
Clona il repository ed entra nella cartella:
```bash
git clone https://github.com/GioeleRora/route2025.git
cd route2025
npm install
```

### 3. Configurazione Ambiente
Crea un file `.env` nella radice del progetto e inserisci la stringa di connessione a PostgreSQL:
```env
PORT=3000
POSTGRES_URL=postgres://user:password@ep-example-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

### 4. Verifica Connessione Database
Esegui lo script di test per verificare la connettività al database Neon:
```bash
node dbtest.js
```

### 5. Avvio del Server
Avvia l'applicazione:
```bash
npm start
```
Apri il browser su [http://localhost:3000](http://localhost:3000).

---

## 🌐 Deploy su Vercel

Il progetto è pre-configurato per il deployment istantaneo su Vercel:

1. Collega il repository GitHub su [vercel.com](https://vercel.com).
2. Aggiungi la variabile d'ambiente `POSTGRES_URL` (o `DATABASE_URL`) nella dashboard di Vercel (sezione *Settings -> Environment Variables*).
3. Esegui il Deploy. Vercel utilizzerà automaticamente `vercel.json` per servire le viste statiche e inoltrare le chiamate `/api/*` alla serverless function `app.js`.

---

## 🛡️ Gestione del Database & Sicurezza

* **Query Parametrizzate**: tutte le query utilizzano tagged template literals (`sql\`...\``) che prevengono alla radice qualsiasi vulnerabilità di tipo SQL Injection.
* **Protezione Cold-Start**: il middleware `ensureDatabase()` gestisce l'inizializzazione lazy delle tabelle e degli indici all'arrivo della prima richiesta serverless.
* **Sanitizzazione Payload**: le date inviate dai client vengono validate con formato ISO `YYYY-MM-DD` con limite massimo a 62 giorni per impedire payload anomali.

---

## 👤 Autore & Licenza

* **Autore**: Gioele Rora
* **Licenza**: [ISC License](LICENSE)
* Realizzato con ❤️ per le comunità scout di Clan e Fuoco.
