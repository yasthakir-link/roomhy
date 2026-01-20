const express = require('express');
const router = express.Router();
const websitePropertyController = require('../controllers/websitePropertyController');

// Get all website properties (for admin)
router.get('/all', websitePropertyController.getAllWebsiteProperties);

// Get properties by status (online/offline)
router.get('/status/:status', websitePropertyController.getWebsitePropertiesByStatus);

// Get properties for public website (only online ones)
router.get('/public', websitePropertyController.getPublicWebsiteProperties);

// Add property to website
router.post('/add', websitePropertyController.addWebsiteProperty);

// Toggle property status
router.put('/toggle/:visitId', websitePropertyController.toggleWebsiteStatus);

// Delete property from website
router.delete('/delete/:visitId', websitePropertyController.deleteWebsiteProperty);

module.exports = router;