const express = require('express');
const bodyParser = require('body-parser');
const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Set up middleware for parsing request bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static assets from public/ directory
app.use(express.static(path.join(__dirname, 'public')));

// Choose the best available connection URL
const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
    console.error('ERROR: No database connection string available. Please check your .env file.');
    process.exit(1);
}

// Create SQL executor using neon's serverless driver
const sql = neon(connectionString);

const normalizeName = (name) => (typeof name === 'string' ? name.trim() : '');
const normalizeClan = (clan) => (typeof clan === 'string' && clan.trim() ? clan.trim() : 'default');

// Initialize database connection with retries
async function initializeDbConnection(retries = 5) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`Connection attempt ${attempt} of ${retries}...`);
            const testResult = await sql`SELECT NOW()`;
            console.log('✓ Successfully connected to Neon database:', testResult[0]);

            // Ensure availability table exists
            const tableCheck = await sql`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public'
                    AND table_name = 'availability'
                );
            `;

            if (!tableCheck[0].exists) {
                console.log('Creating availability table...');
                await sql`
                    CREATE TABLE availability (
                        id SERIAL PRIMARY KEY,
                        name TEXT NOT NULL,
                        clan TEXT NOT NULL,
                        days JSONB NOT NULL,
                        UNIQUE (name, clan)
                    );
                `;
                console.log('✓ Availability table created successfully');
            } else {
                console.log('✓ Availability table already exists');

                const columns = await sql`
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                    AND table_name = 'availability';
                `;

                const columnNames = columns.map(col => col.column_name);

                if (!columnNames.includes('clan')) {
                    console.log('Adding missing "clan" column to availability table...');
                    await sql`ALTER TABLE availability ADD COLUMN clan TEXT DEFAULT 'default';`;
                    await sql`UPDATE availability SET clan = 'default' WHERE clan IS NULL;`;
                    await sql`ALTER TABLE availability ALTER COLUMN clan SET NOT NULL;`;
                    console.log('✓ "clan" column added and initialized');
                }

                if (!columnNames.includes('id')) {
                    console.log('Adding surrogate "id" primary key to availability table...');
                    await sql`ALTER TABLE availability ADD COLUMN id SERIAL;`;
                    await sql`ALTER TABLE availability DROP CONSTRAINT IF EXISTS availability_pkey;`;
                    await sql`ALTER TABLE availability ADD PRIMARY KEY (id);`;
                    console.log('✓ "id" primary key added');
                }

                await sql`
                    CREATE UNIQUE INDEX IF NOT EXISTS availability_name_clan_unique
                    ON availability (name, clan);
                `;
                console.log('✓ Unique index on (name, clan) ensured');
            }

            // Ensure clans table exists
            await sql`
                CREATE TABLE IF NOT EXISTS clans (
                    name TEXT PRIMARY KEY
                );
            `;
            console.log('✓ Clans table ensured');

            // Populate clans table from existing availability data if any
            await sql`
                INSERT INTO clans (name)
                SELECT DISTINCT clan FROM availability
                WHERE clan IS NOT NULL AND clan != ''
                ON CONFLICT (name) DO NOTHING;
            `;

            return true;
        } catch (err) {
            console.error(`Database connection attempt ${attempt} failed:`, err.message);

            if (attempt < retries) {
                const delay = 2000 * attempt;
                console.log(`Retrying in ${delay / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.error('All connection attempts failed. Please check your database configuration.');
                return false;
            }
        }
    }
    return false;
}

// ==========================================
// API Endpoints
// ==========================================

// Get all clans
app.get('/api/clans', async (req, res) => {
    try {
        const rows = await sql`
            SELECT name FROM clans ORDER BY name ASC;
        `;
        const clans = rows.map(r => r.name);

        res.status(200).json({
            status: 'success',
            count: clans.length,
            clans
        });
    } catch (err) {
        console.error('Error fetching clans:', err);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch clans',
            error: err.message
        });
    }
});

// Create a new clan
app.post('/api/clan', async (req, res) => {
    try {
        const clanName = normalizeName(req.body.clanName);

        if (!clanName) {
            return res.status(400).json({ success: false, message: 'Nome clan non valido o vuoto' });
        }

        const existing = await sql`
            SELECT name FROM clans WHERE LOWER(name) = LOWER(${clanName});
        `;

        const isNew = existing.length === 0;

        if (isNew) {
            await sql`
                INSERT INTO clans (name) VALUES (${clanName})
                ON CONFLICT (name) DO NOTHING;
            `;
            console.log(`✓ Clan "${clanName}" creato con successo`);
        }

        res.status(200).json({
            success: true,
            message: isNew ? 'Clan creato con successo' : 'Clan già esistente',
            isNew,
            clanName: isNew ? clanName : existing[0].name
        });
    } catch (err) {
        console.error('Error creating clan:', err);
        res.status(500).json({
            success: false,
            message: 'Errore durante la creazione del clan',
            details: err.message
        });
    }
});

// Get all members for a clan (names and day count)
app.get('/api/members', async (req, res) => {
    try {
        const clan = normalizeClan(req.query.clan);
        const rows = await sql`
            SELECT name, jsonb_array_length(days) AS day_count
            FROM availability
            WHERE clan = ${clan}
            ORDER BY name ASC;
        `;

        res.status(200).json({
            status: 'success',
            count: rows.length,
            members: rows
        });
    } catch (err) {
        console.error('Error fetching members:', err);
        res.status(500).json({ error: 'Errore nel recupero dei partecipanti', details: err.message });
    }
});

// Get availability for all users in a clan
app.get('/api/availability', async (req, res) => {
    try {
        const clan = normalizeClan(req.query.clan);
        const rows = await sql`
            SELECT id, name, clan, days
            FROM availability
            WHERE clan = ${clan}
            ORDER BY name ASC;
        `;
        res.status(200).json(rows);
    } catch (err) {
        console.error('Error handling GET /api/availability:', err.message);
        res.status(500).json({ error: 'Errore nel recupero delle disponibilità', details: err.message });
    }
});

// Get availability for a specific user
app.get('/api/user/:name', async (req, res) => {
    try {
        const name = normalizeName(req.params.name);
        const clan = normalizeClan(req.query.clan);

        if (!name) {
            return res.status(400).json({ error: 'Nome non specificato' });
        }

        const rows = await sql`
            SELECT id, name, clan, days
            FROM availability
            WHERE LOWER(name) = LOWER(${name}) AND clan = ${clan};
        `;

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }

        res.status(200).json(rows[0]);
    } catch (err) {
        console.error('Error handling GET /api/user/:name:', err.message);
        res.status(500).json({ error: 'Errore nel recupero dati utente', details: err.message });
    }
});

// Save or overwrite availability for a user (atomic upsert)
app.post('/api/availability', async (req, res) => {
    const { name, days, clan } = req.body;
    const normalizedName = normalizeName(name);
    const normalizedClan = normalizeClan(clan);

    if (!normalizedName || !Array.isArray(days)) {
        return res.status(400).json({ error: 'Dati non validi: nome e giorni sono obbligatori' });
    }

    try {
        // Ensure clan exists
        await sql`
            INSERT INTO clans (name) VALUES (${normalizedClan})
            ON CONFLICT (name) DO NOTHING;
        `;

        // Upsert availability directly into PostgreSQL
        await sql`
            INSERT INTO availability (name, days, clan)
            VALUES (${normalizedName}, ${JSON.stringify(days)}, ${normalizedClan})
            ON CONFLICT (name, clan)
            DO UPDATE SET days = ${JSON.stringify(days)};
        `;

        res.status(200).json({ message: 'Disponibilità salvata con successo' });
    } catch (err) {
        console.error('Error handling POST /api/availability:', err.message);
        res.status(500).json({ error: 'Errore nel salvataggio della disponibilità', details: err.message });
    }
});

// Update availability for an existing user
app.put('/api/availability', async (req, res) => {
    const { name, days, clan } = req.body;
    const normalizedName = normalizeName(name);
    const normalizedClan = normalizeClan(clan);

    if (!normalizedName || !Array.isArray(days)) {
        return res.status(400).json({ error: 'Dati non validi: nome e giorni sono obbligatori' });
    }

    try {
        const result = await sql`
            UPDATE availability
            SET days = ${JSON.stringify(days)}
            WHERE LOWER(name) = LOWER(${normalizedName}) AND clan = ${normalizedClan}
            RETURNING id, name;
        `;

        if (result.length === 0) {
            return res.status(404).json({ error: 'Utente non trovato nel clan specificato' });
        }

        res.status(200).json({ message: 'Disponibilità aggiornata con successo' });
    } catch (err) {
        console.error('Error handling PUT /api/availability:', err.message);
        res.status(500).json({ error: 'Errore nell\'aggiornamento della disponibilità', details: err.message });
    }
});

// ==========================================
// Page Routes
// ==========================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'clan-select.html'));
});

app.get('/clan-select', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'clan-select.html'));
});

app.get('/home', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'home.html'));
});

app.get('/add', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'add.html'));
});

app.get('/modify', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'modify.html'));
});

app.get('/results', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'results.html'));
});

// Start the server only after trying to establish DB connection
initializeDbConnection().then(connected => {
    if (connected) {
        app.listen(port, () => {
            console.log(`✓ Server is running on port ${port}`);
        });
    } else {
        console.error('✗ Server not started due to database connection failure');
        process.exit(1);
    }
});

module.exports = app;
