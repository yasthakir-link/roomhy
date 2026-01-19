const express = require('express');
const router = express.Router();

// Initialize global signups array if not exists
if (!global.signups) global.signups = [];

// Get all signups
router.get('/', (req, res) => {
    res.json(global.signups);
});

// Submit new signup
router.post('/submit', async (req, res) => {
    try {
        const signupData = req.body;

        // Check if email already exists
        const existing = global.signups.find(s => s.email === signupData.email);
        if (existing) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        // Add to signups array
        global.signups.push(signupData);

        // Send email notification to superadmin
        try {
            const mailer = require('../utils/mailer');
            const superadminEmail = process.env.SMTP_USER || 'roomhy01@gmail.com';
            const subject = 'New User Signup - Account Created';
            const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">New User Account Created</h2>
                    <p>A new user has created an account and is pending verification.</p>
                    <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <p><strong>Name:</strong> ${signupData.firstName} ${signupData.lastName || ''}</p>
                        <p><strong>Email:</strong> ${signupData.email}</p>
                        <p><strong>Phone:</strong> ${signupData.phone || 'Not provided'}</p>
                        <p><strong>User ID:</strong> ${signupData.id}</p>
                        <p><strong>Status:</strong> ${signupData.status}</p>
                        <p><strong>Created:</strong> ${new Date(signupData.createdAt).toLocaleString()}</p>
                    </div>
                    <p>Please review and verify this user in the superadmin new signups panel.</p>
                </div>
            `;
            await mailer.sendMail(superadminEmail, subject, '', html);
            console.log('Signup notification email sent successfully');
        } catch (emailError) {
            console.error('Failed to send signup notification email:', emailError);
        }

        res.status(201).json({ message: 'Signup submitted successfully', data: signupData });
    } catch (error) {
        console.error('Error submitting signup:', error);
        res.status(500).json({ message: 'Error submitting signup' });
    }
});

// Update signup status
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const signup = global.signups.find(s => s.id === id);
    if (!signup) {
        return res.status(404).json({ message: 'Signup not found' });
    }

    signup.status = status;
    res.json({ message: 'Signup updated successfully', data: signup });
});

module.exports = router;
