const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(express.static('views')); // Serve index.html from 'views'
app.use(express.static('public')); // Serve CSS and JS directly from 'public'


app.post('/api/availability', (req, res) => {
    const { name, days } = req.body;

    if (!name || !days || !Array.isArray(days)) {
        return res.status(400).json({ error: 'Invalid data' });
    }

    const filePath = path.join(__dirname, 'data', 'availabilities.json');

    // Ensure the file exists or create it if it doesn't
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '[]', 'utf8'); // Create an empty JSON array
    }

    // Read the existing datas
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Internal server error' });
        }

        let availabilities = [];
        try {
            availabilities = JSON.parse(data); // Parse existing data
        } catch (parseErr) {
            console.error('Error parsing availabilities.json:', parseErr);
        }

        // Add the new availability
        availabilities.push({ name, days });

        // Write the updated data back to the file
        fs.writeFile(filePath, JSON.stringify(availabilities, null, 2), (writeErr) => {
            if (writeErr) {
                return res.status(500).json({ error: 'Internal server error' });
            }

            res.status(200).json({ message: 'Availability submitted successfully' });
        });
    });
});

// Serve results.html for the /results route
app.get('/results', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'results.html'));
});

// API route to fetch availabilities for results.js
app.get('/api/availabilities', (req, res) => {
    const filePath = path.join(__dirname, 'data', 'availabilities.json');

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading availabilities.json:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        try {
            const availabilities = JSON.parse(data);
            res.status(200).json(availabilities);
        } catch (parseErr) {
            console.error('Error parsing availabilities.json:', parseErr);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
