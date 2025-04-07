const express = require('express');
const bodyParser = require('body-parser');
const { put } = require('@vercel/blob'); // Import 'put' from '@vercel/blob'
const path = require('path');
const axios = require('axios'); // Import axios for HTTP requests

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(express.static('views')); // Serve index.html from 'views'
app.use(express.static('public')); // Serve CSS and JS directly from 'public'

const blobName = 'route2025-m8mzcPGnaGB3DtnHVYShWZp0DywYxq'.replace(/^\/*|\/*$/g, '');
const blobUrl = `https://aveoe7yulyygayoq.public.blob.vercel-storage.com/${encodeURIComponent(blobName)}`;
const fetchBlobData = async () => {
    try {
        console.log('Fetching data from blob:', blobUrl);
        const response = await axios.get(blobUrl);

        if (!response.data || Object.keys(response.data).length === 0) {
            console.warn('Blob is empty, returning empty array.');
            return []; // Return an empty array if the blob is empty
        }

        // Return the parsed JSON data directly
        return response.data;
    } catch (err) {
        if (err.response && err.response.status === 404) {
            console.warn('Blob not found, returning empty array.');
            return []; // Return an empty array if the blob does not exist
        }
        console.error('Error loading data from blob:', err.message, err.stack);
        throw new Error('Failed to load data from blob');
    }
};

const saveDataToBlob = async (data) => {
    try {
        let existingData = [];
        try {
            const file = await axios.get(blobUrl); // Attempt to fetch the blob
            if (file) {
                const content = file.data;
                existingData = Array.isArray(content) ? content : []; // Parse existing data
            }
        } catch (err) {
            if (err.response && err.response.status === 404) {
                console.warn('Blob not found, initializing new blob.');
                existingData = [];
            } else {
                throw new Error('Error fetching existing blob data: ' + err.message);
            }
        }
        existingData.push(data);    

        await put(blobUrl, JSON.stringify(existingData, null, 2), {
            contentType: 'application/json',
        });
        
        console.log('Data successfully saved to blob:', blobUrl);
    } catch (err) {
        console.error('Error saving data to blob:', err.message);
        throw new Error('Failed to save data to blob');
    }
};

app.post('/api/availability', async (req, res) => {
    const { name, days } = req.body;

    if (!name || !days || !Array.isArray(days)) {
        return res.status(400).json({ error: 'Invalid data' });
    }

    try {
        let availabilities = await fetchBlobData();
        const existingIndex = availabilities.findIndex(entry => entry.name === name);
        if (existingIndex !== -1) {
            availabilities[existingIndex] = { name, days };
        } else {
            availabilities.push({ name, days });
        }

        await saveDataToBlob(availabilities);

        res.status(200).json({ message: 'Availability submitted successfully', url });
    } catch (err) {
        console.error('Error interacting with Vercel Blob post:', err.message, err.stack);
        res.status(500).json({ error: 'Error interacting with Vercel Blob post 50:', details: err.message });
    }
});

app.get('/api/availability', async (req, res) => {
    try {
        const availabilities = await fetchBlobData();
        res.status(200).json(availabilities);
    } catch (err) {
        console.error('Error interacting with Vercel Blob get:', err.message, err.stack);
        res.status(500).json({ error: 'Error interacting with Vercel Blob get:', details: err.message });
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

module.exports = app;