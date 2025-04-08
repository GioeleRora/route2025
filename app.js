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
                        name TEXT PRIMARY KEY,
                        days JSONB NOT NULL
                    );
                `;
                console.log('✓ Availability table created successfully');
            } else {
                console.log('✓ Availability table already exists');
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
const fetchAvailabilityData = async () => {
    try {
        const rows = await sql`SELECT * FROM availability`; // Query for availability data
        return rows; // Return rows (data)
    } catch (err) {
        console.error('Error fetching data from database:', err.message);
        throw new Error('Failed to fetch data from Neon database');
    }
};

// Helper function to save data to Neon
const saveAvailabilityData = async (dataArray) => {
    try {
        // Assume "availability" table exists with columns "name" and "days"
        for (const entry of dataArray) {
            const { name, days } = entry;
            // Insert or update data in Neon
            await sql`
                INSERT INTO availability (name, days) 
                VALUES (${name}, ${JSON.stringify(days)}) 
                ON CONFLICT (name) 
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
    const { name, days } = req.body;

    if (!name || !days || !Array.isArray(days)) {
        return res.status(400).json({ error: 'Invalid data' });
    }

    try {
        let availabilities = await fetchAvailabilityData();
        console.log(availabilities); // Log fetched data for debugging

        const existingIndex = availabilities.findIndex(entry => entry.name === name);
        if (existingIndex !== -1) {
            const existingDays = availabilities[existingIndex].days;
            const updatedDays = [...new Set([...existingDays, ...days])];
            availabilities[existingIndex].days = updatedDays;
        } else {
            availabilities.push({ name, days });
        }

        await saveAvailabilityData(availabilities);

        res.status(200).json({ message: 'Availability submitted successfully' });
    } catch (err) {
        console.error('Error handling POST request:', err.message);
        res.status(500).json({ error: 'Error interacting with Neon database', details: err.message });
    }
});

// Route to handle GET request for availability
app.get('/api/availability', async (req, res) => {
    try {
        const availabilities = await fetchAvailabilityData();
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
        const availabilities = await fetchAvailabilityData();
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
    const { name, days } = req.body;

    if (!name || !days || !Array.isArray(days)) {
        return res.status(400).json({ error: 'Invalid data' });
    }

    try {
        let availabilities = await fetchAvailabilityData();
        const existingIndex = availabilities.findIndex(entry => entry.name === name);
        
        if (existingIndex === -1) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Update the user's days
        availabilities[existingIndex].days = days;
        
        await saveAvailabilityData(availabilities);
        
        res.status(200).json({ message: 'Availability updated successfully' });
    } catch (err) {
        console.error('Error handling PUT request:', err.message);
        res.status(500).json({ error: 'Error interacting with Neon database', details: err.message });
    }
});

// Serve results.html for the /results route
app.get('/results', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'views', 'results.html'));
});

// Serve index.html for the / route
app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'views', 'home.html'));
});

// Add route for the form to add new availability
app.get('/add', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'views', 'index.html'));
});

// Add route for the modify page
app.get('/modify', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'views', 'modify.html'));
});

app.get('/css/styles.css', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public/css', 'styles.css'));
});

app.get('/js/script.js', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public/js', 'script.js'));
});

app.get('/js/results.js', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public/js', 'results.js'));
});

app.get('/js/modify.js', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public/js', 'modify.js'));
});

// Add a database connection test endpoint 
app.get('/api/dbtest', async (req, res) => {
    try {
        const result = await sql`SELECT NOW() as server_time`;
        res.status(200).json({
            status: 'success',
            message: 'Database connection is working',
            serverTime: result[0].server_time
        });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            message: 'Database connection failed',
            error: err.message
        });
    }
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
