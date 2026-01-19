const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

// Existing routes
router.get('/', notificationController.getNotifications);
router.post('/chat-message', notificationController.sendChatMessageNotification);

// Website user notifications
router.get('/website/user/:userId', notificationController.getWebsiteUserNotifications);
router.post('/website/create', notificationController.createWebsiteNotification);
router.put('/website/:notificationId/read', notificationController.markWebsiteNotificationRead);
router.delete('/website/:notificationId', notificationController.deleteWebsiteNotification);

// For booking accept notifications
router.post('/booking-accept', notificationController.sendBookingAcceptNotification);

module.exports = router;
