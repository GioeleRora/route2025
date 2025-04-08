const express = require('express');
const bodyParser = require('body-parser');
const { Client } = require('pg'); // Import pg for PostgreSQL connection
const path = require('path');

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(express.static('views')); // Serve index.html from 'views'
app.use(express.static('public')); // Serve CSS and JS directly from 'public'

// Set up PostgreSQL client with the Neon connection string
const client = new Client({
    connectionString: process.env.DATABASE_URL, // Vercel environment variable
    ssl: {
        rejectUnauthorized: false, // SSL is required for Neon
    },
});

client.connect().catch(err => {
    console.error('Error connecting to Neon database:', err.message);
});

// Helper function to fetch data from Neon
const fetchAvailabilityData = async () => {
    try {
        const res = await client.query('SELECT * FROM availability'); // Query for availability data
        return res.rows; // Return rows (data)
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
            await client.query(
                `INSERT INTO availability (name, days) 
                 VALUES ($1, $2) 
                 ON CONFLICT (name) 
                 DO UPDATE SET days = EXCLUDED.days`, 
                [name, JSON.stringify(days)]
            );
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

        const existingIndex = availabilities.findIndex(entry => entry.name === name);
        if (existingIndex !== -1) {
            availabilities[existingIndex] = { name, days };
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

// Serve results.html for the /results route
app.get('/results', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'views', 'results.html'));
});

// Serve index.html for the / route
app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'views', 'index.html'));
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

module.exports = app;
