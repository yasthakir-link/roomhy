const express = require('express');
const router = express.Router();
const { sendMail } = require('../utils/mailer');

// POST: Send an email
router.post('/send', async (req, res) => {
    try {
        const { to, subject, html, text } = req.body;

        if (!to || !subject || (!html && !text)) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: to, subject, and html or text'
            });
        }

        // Send email asynchronously
        sendMail(to, subject, text, html);

        res.json({
            success: true,
            message: 'Email sent successfully'
        });

    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending email',
            error: error.message
        });
    }
});

module.exports = router;