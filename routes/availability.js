const express = require('express');
const { put } = require('@vercel/blob'); // Import 'put' from '@vercel/blob'
const axios = require('axios'); // Import axios for HTTP requests
const router = express.Router();

const Availability = require('../models/availability');

const blobName = 'My database'; // Blob name in the Vercel Blob Database
const blobUrl = `https://route2025.vercel-storage.com/${blobName}`; // Replace with your actual blob URL

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

// Save data to blob
const saveDataToBlob = async (data) => {
    try {
        await put(blobName, JSON.stringify(data, null, 2), {
            contentType: 'application/json',
            access: 'public', // Optional: Make the blob publicly accessible
        });
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

// Calculate the best N-day slot
router.get('/best-slot', async (req, res) => {
    const N = 5;
    try {
        const availabilities = await fetchBlobData();
        const daysCount = {};

        availabilities.forEach(({ days }) => {
            days.forEach(day => {
                daysCount[day] = (daysCount[day] || 0) + 1;
            });
        });

        const sortedDays = Object.keys(daysCount).sort((a, b) => new Date(a) - new Date(b));
        let bestSlot = [];
        let maxMean = 0;

        for (let i = 0; i <= sortedDays.length - N; i++) {
            const slot = sortedDays.slice(i, i + N);
            const mean = slot.reduce((sum, day) => sum + (daysCount[day] || 0), 0) / N;
            if (mean > maxMean) {
                maxMean = mean;
                bestSlot = slot;
            }
        }

        res.json({ bestSlot, maxMean });
    } catch (err) {
        console.error('Error calculating best slot:', err.message);
        res.status(500).send('Internal server error ');
    }
});

module.exports = router;
module.exports = { fetchBlobData };