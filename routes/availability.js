const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const Availability = require('../models/availability');

// File path for storing data
const dataFilePath = path.join(__dirname, '../data/availabilities.json');

// Load data from file
const loadDataFromFile = () => {
    if (fs.existsSync(dataFilePath)) {
        const fileData = fs.readFileSync(dataFilePath, 'utf-8').trim();
        return fileData ? JSON.parse(fileData) : []; // Return an empty array if the file is empty
    }
    return []; // Return an empty array if the file does not exist
};

// Save data to file
const saveDataToFile = (data) => {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
};

// Add availability
router.post('/', (req, res) => {
    const { name, days } = req.body;
    if (!name || !days || !Array.isArray(days)) {
        return res.status(400).send('Invalid input');
    }
    let availabilities = loadDataFromFile();
    availabilities = availabilities.filter(a => a.name !== name); // Remove existing entry
    availabilities.push(new Availability(name, days));
    saveDataToFile(availabilities); // Save to file
    res.status(201).send('Availability added');
});

// Get all availabilities
router.get('/', (req, res) => {
    const availabilities = loadDataFromFile();
    res.json(availabilities);
});

// Serve results page
router.get('/results', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/results.html'));
});

// Calculate the best N-day slot
router.get('/best-slot', (req, res) => {
    const N = 5;
    const availabilities = loadDataFromFile();
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
});

module.exports = router;
