const express = require('express');
const bodyParser = require('body-parser');
const { put } = require('@vercel/blob'); // Import 'put' from '@vercel/blob'
const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(express.static('views')); // Serve index.html from 'views'
app.use(express.static('public')); // Serve CSS and JS directly from 'public'

const blobName = 'My database'; // Blob name in the Vercel Blob Database

app.post('/api/availability', async (req, res) => {
    const { name, days } = req.body;

    if (!name || !days || !Array.isArray(days)) {
        return res.status(400).json({ error: 'Invalid data' });
    }

    try {
        // Fetch existing data from the blob
        let availabilities = [];
        const blob = await blobClient.get(blobName);
        if (blob) {
            const data = await blob.text();
            availabilities = JSON.parse(data);
        }

        // Check if the name already exists
        const existingIndex = availabilities.findIndex(entry => entry.name === name);
        if (existingIndex !== -1) {
            // Replace the existing entry
            availabilities[existingIndex] = { name, days };
        } else {
            // Add the new availability
            availabilities.push({ name, days });
        }

        // Write the updated data back to the blob using 'put'
        const { url } = await put(blobName, JSON.stringify(availabilities, null, 2), {
            access: 'public', // Optional: Make the blob publicly accessible
            contentType: 'application/json',
        });

        res.status(200).json({ message: 'Availability submitted successfully', url });
    } catch (err) {
        console.error('Error interacting with Vercel Blob:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/availabilities', async (req, res) => {
    try {
        // Fetch existing data from the blob
        const blob = await blobClient.get(blobName);
        if (!blob) {
            return res.status(200).json([]); // Return an empty array if no data exists
        }

        const data = await blob.text();
        const availabilities = JSON.parse(data);
        res.status(200).json(availabilities);
    } catch (err) {
        console.error('Error interacting with Vercel Blob:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Serve results.html for the /results route
app.get('/results', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'views', 'results.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'views', 'index.html'));
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});