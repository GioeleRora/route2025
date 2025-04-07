const express = require('express');
const { put } = require('@vercel/blob'); // Import 'put' from '@vercel/blob'
const router = express.Router();
const { fetchBlobData } = require('../routes/availability.js');

const Availability = require('../models/availability');

const blobName = 'route2025';
const blobUrl = 'https://aveoe7yulyygayoq.public.blob.vercel-storage.com/' + blobName;

// Save data to blob
const saveDataToBlob = async (data) => {
    try {
        let existingData = [];
        try {
            const file = await getBlob(blobUrl); // Attempt to fetch the blob
            if (file) {
                const content = await file.text();
                existingData = JSON.parse(content); // Parse existing data
            }
        } catch (err) {
            if (err.response && err.response.status === 404) {
                console.warn('Blob not found, initializing new blob.');
            } else {
                throw new Error('Error fetching existing blob data: ' + err.message);
            }
        }
        existingData.push(data);

        await put(blobUrl, JSON.stringify(existingData, null, 2), {
            contentType: 'application/json'
        });
        
        console.log('Data successfully saved to blob:', blobUrl);
    } catch (err) {
        console.error('Error saving data to blob:', err.message);
        throw new Error('Failed to save data to blob');
    }
};

// Add availability
router.post('/', async (req, res) => {
    const { name, days } = req.body;
    if (!name || !days || !Array.isArray(days)) {
        return res.status(400).send('Invalid input');
    }

    try {
        let availabilities = await fetchBlobData();
        availabilities = availabilities.filter(a => a.name !== name); // Remove existing entry
        availabilities.push(new Availability(name, days));
        await saveDataToBlob(availabilities); // Save to blob
        res.status(201).send('Availability added');
    } catch (err) {
        console.error('Error adding availability:', err.message);
        res.status(500).send('Internal server error add availability');
    }
});

// Get all availabilities
router.get('/', async (req, res) => {
    try {
        const availabilities = await fetchBlobData();
        res.json(availabilities);
    } catch (err) {
        console.error('Error fetching availabilities:', err.message);
        res.status(500).send('Internal server error get availabilities');
    }
});

module.exports = router;