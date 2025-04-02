const express = require('express');
const { createClient } = require('@vercel/blob');
const router = express.Router();
const Availability = require('../models/availability');

// Initialize Vercel Blob client
const blobClient = createClient();
const blobName = 'My database'; // Blob name in the Vercel Blob Database

// Load data from blob
const loadDataFromBlob = async () => {
    try {
        const blob = await blobClient.get(blobName);
        if (blob) {
            const data = await blob.text();
            return JSON.parse(data); // Parse and return the data
        }
        return []; // Return an empty array if no data exists
    } catch (err) {
        console.error('Error loading data from blob:', err);
        return [];
    }
};

// Save data to blob
const saveDataToBlob = async (data) => {
    try {
        await blobClient.put(blobName, JSON.stringify(data, null, 2), {
            contentType: 'application/json',
        });
    } catch (err) {
        console.error('Error saving data to blob:', err);
    }
};

// Add availability
router.post('/', async (req, res) => {
    const { name, days } = req.body;
    if (!name || !days || !Array.isArray(days)) {
        return res.status(400).send('Invalid input');
    }

    try {
        let availabilities = await loadDataFromBlob();
        availabilities = availabilities.filter(a => a.name !== name); // Remove existing entry
        availabilities.push(new Availability(name, days));
        await saveDataToBlob(availabilities); // Save to blob
        res.status(201).send('Availability added');
    } catch (err) {
        console.error('Error adding availability:', err);
        res.status(500).send('Internal server error');
    }
});

// Get all availabilities
router.get('/', async (req, res) => {
    try {
        const availabilities = await loadDataFromBlob();
        res.json(availabilities);
    } catch (err) {
        console.error('Error fetching availabilities:', err);
        res.status(500).send('Internal server error');
    }
});

// Serve results page
router.get('/results', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/results.html'));
});

// Calculate the best N-day slot
router.get('/best-slot', async (req, res) => {
    const N = 5;
    try {
        const availabilities = await loadDataFromBlob();
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

        if (bestSlot.length > 0) {
            const startIndex = sortedDays.indexOf(bestSlot[0]);
            const endIndex = sortedDays.indexOf(bestSlot[bestSlot.length - 1]);

            // Extend the slot to include consecutive days with the same or higher count
            let extendedSlot = [...bestSlot];

            // Extend forward
            for (let i = endIndex + 1; i < sortedDays.length; i++) {
                const day = sortedDays[i];
                if (daysCount[day] >= maxMean) {
                    extendedSlot.push(day);
                } else {
                    break;
                }
            }

            // Extend backward
            for (let i = startIndex - 1; i >= 0; i--) {
                const day = sortedDays[i];
                if (daysCount[day] >= maxMean) {
                    extendedSlot.unshift(day);
                } else {
                    break;
                }
            }

            if (extendedSlot.length > N) {
                bestSlot = extendedSlot;
            }
        }

        res.json({ bestSlot, maxMean });
    } catch (err) {
        console.error('Error calculating best slot:', err);
        res.status(500).send('Internal server error');
    }
});

module.exports = router;