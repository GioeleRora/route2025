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

// Print available environment variables (for debugging)
console.log('Available environment variables:', {
    DATABASE_URL: process.env.DATABASE_URL ? 'Set (hidden for security)' : 'Not set',
    POSTGRES_URL: process.env.POSTGRES_URL ? 'Set (hidden for security)' : 'Not set',
});

// Choose the best available connection URL
const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
    console.error('ERROR: No database connection string available. Please check your .env file.');
    process.exit(1);
}

// Create SQL executor using neon's serverless driver
const sql = neon(connectionString);

// Initialize database connection with retries
async function initializeDbConnection(retries = 5) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`Connection attempt ${attempt} of ${retries}...`);
            // Test if the database is properly set up
            const testResult = await sql`SELECT NOW()`;
            console.log('✓ Successfully connected to Neon database');
            console.log('✓ Database connection test successful:', testResult[0]);
            
            // Check if availability table exists, create if not
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

                // Ensure legacy schemas are upgraded for clan-scoped data isolation.
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
            
            return true;
        } catch (err) {
            console.error(`Database connection attempt ${attempt} failed:`, err.message);
            
            if (attempt < retries) {
                const delay = 2000 * attempt; // Exponential backoff
                console.log(`Retrying in ${delay/1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.error('All connection attempts failed. Please check your database configuration.');
                return false;
            }
        }
    }
    return false;
}

// Helper function to fetch data from Neon
const fetchAvailabilityData = async (clan) => {
    try {
        const rows = await sql`SELECT * FROM availability WHERE clan=${clan}`;
        return rows; // Return rows (data)
    } catch (err) {
        console.error('Error fetching data from database:', err.message);
        throw new Error('Failed to fetch data from Neon database');
    }
};

// Helper function to save data to Neon
const saveAvailabilityData = async (dataArray, clan) => {
    try {
        for (const entry of dataArray) {
            const { name, days} = entry;
            // Insert or update data in Neon
            await sql`
                INSERT INTO availability (name, days, clan) 
                VALUES (${name}, ${JSON.stringify(days)}, ${clan}) 
                ON CONFLICT (name, clan)
                DO UPDATE SET days = ${JSON.stringify(days)}
            `;
        }
        console.log('Data successfully saved to Neon database');
    } catch (err) {
        console.error('Error saving data to Neon database:', err.message);
        throw new Error('Failed to save data to Neon database');
    }
};

// Route to handle POST request to save availability
app.post('/api/availability', async (req, res) => {
    const { name, days, clan } = req.body;

    if (!name || !days || !Array.isArray(days)) {
        return res.status(400).json({ error: 'Invalid data' });
    }

    try {
        let availabilities = await fetchAvailabilityData(clan);
        console.log(availabilities); // Log fetched data for debugging
        console.log('Clan before post:', clan);

        const existingIndex = availabilities.findIndex(entry => entry.name === name);
        if (existingIndex !== -1) {
            const existingDays = availabilities[existingIndex].days;
            const updatedDays = [...new Set([...existingDays, ...days])];
            availabilities[existingIndex].days = updatedDays;
        } else {
            availabilities.push({ name, days });
        }

        await saveAvailabilityData(availabilities, clan);

        res.status(200).json({ message: 'Availability submitted successfully' });
    } catch (err) {
        console.error('Error handling POST request:', err.message);
        res.status(500).json({ error: 'Error interacting with Neon database', details: err.message });
    }
});

// Route to handle GET request for availability
app.get('/api/availability', async (req, res) => {
    try {
        const clan = req.query.clan;
        console.log('Clan:', clan); // Log the clan for debugging
        const availabilities = await fetchAvailabilityData(clan);
        res.status(200).json(availabilities);
    } catch (err) {
        console.error('Error handling GET request:', err.message);
        res.status(500).json({ error: 'Error interacting with Neon database', details: err.message });
    }
});

// Route to handle GET request for a specific user's availability
app.get('/api/user/:name', async (req, res) => {
    try {
        const name = req.params.name;
        const clan = req.query.clan;
        const availabilities = await fetchAvailabilityData(clan);
        const userAvailability = availabilities.find(entry => entry.name.toLowerCase() === name.toLowerCase());
        
        if (!userAvailability) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.status(200).json(userAvailability);
    } catch (err) {
        console.error('Error handling GET request for user:', err.message);
        res.status(500).json({ error: 'Error interacting with Neon database', details: err.message });
    }
});

// Route to handle PUT request to update availability
app.put('/api/availability', async (req, res) => {
    const { name, days, clan} = req.body;
    console.log('Received PUT request:', req.body);

    if (!name || !days || !Array.isArray(days)) {
        return res.status(400).json({ error: 'Invalid data' });
    }

    try {
        let availabilities = await fetchAvailabilityData(clan);
        const existingIndex = availabilities.findIndex(entry => entry.name === name);
        
        if (existingIndex === -1) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Update the user's days
        availabilities[existingIndex].days = days;
        
        console.log('Updated availability :', availabilities[existingIndex]);
        console.log('Clan before put:', clan);
        await saveAvailabilityData(availabilities, clan);
        
        res.status(200).json({ message: 'Availability updated successfully' });
    } catch (err) {
        console.error('Error handling PUT request:', err.message);
        res.status(500).json({ error: 'Error interacting with Neon database', details: err.message });
    }
});


// Add API endpoint to get all clan tables
app.get('/api/clans', async (req, res) => {
    try {
        const names = await sql`
            SELECT name FROM clans;
        `;

        const clans = names.map(row => {
            return row.name;
        });
        
        console.log('Clans found:', clans);
        
        res.status(200).json({
            status: 'success',
            count: clans.length,
            clans
        });
    } catch (err) {
        console.error('Error fetching clan tables:', err);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch clan tables',
            error: err.message
        });
    }
});

// Add API endpoint to create a new clan
app.post('/api/clan', async (req, res) => {
    console.log('Received clan creation request:', req.body);
    
    try {
        const { clanName } = req.body;
        
        if (!clanName) {
            return res.status(400).json({ success: false, message: 'Nome clan mancante' });
        }
        
        console.log(`Processing clan "${clanName}"`);
        
        const tableCheck = await sql`
            SELECT EXISTS (
                SELECT FROM clans 
                WHERE name = ${clanName}
            ) AS exists
        `;
        
        let isNew = !tableCheck[0].exists;
        
        console.log(`Clan exists: ${!isNew}, isNew: ${isNew}`);
        
        if (isNew) {
            // Insert the new clan
            await sql`
                INSERT INTO clans (name)
                VALUES (${clanName})
            `;
            console.log(`✓ Clan "${clanName}" created successfully`);
        } else {
            console.log(`Clan "${clanName}" already exists`);
        }
        
        res.status(200).json({ 
            success: true, 
            message: isNew ? 'Clan created successfully' : 'Clan already exists',
            isNew: isNew,
            clanName: clanName
        });
    } catch (err) {
        console.error('Error processing clan:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Server error', 
            details: err.message 
        });
    }
});

// Serve results.html for the /results route
app.get('/results', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'views', 'results.html'));
});

app.get('/modify', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'views', 'modify.html'));
});

app.get('/add', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'views', 'add.html'));
});

// Serve index.html for the / route
app.get('/clan-select', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'views', 'clan-select.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'views', 'clan-select.html'));
});

app.get('/home', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'views', 'home.html'));
});

// Add route for the clan selection page JavaScript
app.get('/js/clan-select.js', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public/js', 'clan-select.js'));
});

app.get('/css/styles.css', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public/css', 'styles.css'));
});

app.get('/js/script.js', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public/js', 'script.js'));
});

app.get('/js/home.js', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public/js', 'home.js'));
});

app.get('/js/results.js', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public/js', 'results.js'));
});

app.get('/js/modify.js', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public/js', 'modify.js'));
});

app.get('/js/add.js', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public/js', 'add.js'));
});

// Start the server only after trying to establish DB connection
initializeDbConnection().then(connected => {
    if (connected) {
        app.listen(port, () => {
            console.log(`✓ Server is running on port ${port}`);
            console.log(`• Try the database test endpoint: http://localhost:${port}/api/dbtest`);
        });
    } else {
        console.error('✗ Server not started due to database connection failure');
        process.exit(1); // Exit the application with an error code
    }
});

module.exports = app;
