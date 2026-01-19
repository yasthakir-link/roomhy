const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

// Existing routes
router.get('/', protect, notificationController.listNotifications);
router.post('/chat-message', notificationController.sendChatMessageNotification);

// Website user notifications
router.get('/website/user/:userId', notificationController.getWebsiteUserNotifications);
router.post('/website/create', notificationController.createWebsiteNotification);
router.put('/website/:notificationId/read', notificationController.markWebsiteNotificationRead);
router.delete('/website/:notificationId', notificationController.deleteWebsiteNotification);

// For booking accept notifications
router.post('/booking-accept', notificationController.sendBookingAcceptNotification);

module.exports = router;
