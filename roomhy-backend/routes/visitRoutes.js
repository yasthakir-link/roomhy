const express = require('express');
const router = express.Router();
const visitController = require('../controllers/visitController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Submit Report (Area Manager) - No auth required since form is filled offline
router.post('/submit', visitController.submitVisit);

// Get My Reports (Area Manager) - No auth required for syncing data after refresh
router.get('/', visitController.getMyVisits);

// Get All Pending Reports (Super Admin - Enquiry Page) - No auth required for development
router.get('/pending', visitController.getPendingVisits);

// Get Approved Properties for Website (Public - No Auth Required)
// Used by ourproperty.html to display live properties
router.get('/public/approved', visitController.getApprovedPropertiesForWebsite);

module.exports = router;