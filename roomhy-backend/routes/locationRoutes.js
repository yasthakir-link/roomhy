const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');

// ================== LOCATION ROUTES ==================

// Get all cities
router.get('/cities', locationController.getCities);

// Get all areas
router.get('/areas', locationController.getAreas);

// Get areas by city
router.get('/areas/city/:city', locationController.getAreasByCity);

module.exports = router;