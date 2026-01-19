const Notification = require('../models/Notification');

exports.createNotification = async (req, res) => {
  try {
    const { toRole, toLoginId, from, type, meta } = req.body || {};
    if (!from || !type) return res.status(400).json({ message: 'from and type required' });

    const n = await Notification.create({ toRole: toRole || '', toLoginId: toLoginId || '', from, type, meta: meta || {}, read: false });
    return res.status(201).json({ success: true, notification: n });
  } catch (err) {
    console.error('createNotification error', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    // Only allow Super Admin to fetch all notifications, optionally filter by unread
    const onlyUnread = req.query.unread === '1' || req.query.unread === 'true';
    const filter = {};
    if (onlyUnread) filter.read = false;
    // If user provided toLoginId query, filter for that
    if (req.query.toLoginId) filter.toLoginId = req.query.toLoginId;
    const notifs = await Notification.find(filter).sort({ createdAt: -1 }).limit(50);
    res.json(notifs);
  } catch (err) {
    console.error('getNotifications error', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.markRead = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ message: 'id required' });
    await Notification.findByIdAndUpdate(id, { read: true });
    res.json({ success: true });
  } catch (err) {
    console.error('markRead error', err);
    res.status(500).json({ success: false, message: err.message });
  }
};


exports.listNotifications = async (req, res) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ message: 'Auth required' });
        const notes = await Notification.find({ recipient: user._id }).sort({ createdAt: -1 }).lean();
        res.json({ success: true, notifications: notes });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.sendChatMessageNotification = async (req, res) => {
    try {
        const { ownerId, tenantName, message, chatId } = req.body;

        if (!ownerId) {
            return res.status(400).json({ success: false, message: 'Owner ID is required' });
        }

        // Find owner by loginId
        const User = require('../models/user');
        const owner = await User.findOne({ loginId: ownerId });

        if (owner && owner.email) {
            const mailer = require('../utils/mailer');
            const subject = `New Message from ${tenantName}`;
            const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">New Chat Message</h2>
                    <p>You have received a new message from a tenant.</p>
                    <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <p><strong>From:</strong> ${tenantName}</p>
                        <p><strong>Message:</strong> ${message}</p>
                    </div>
                    <p>Please check your chat in the owner panel to respond.</p>
                </div>
            `;
            await mailer.sendMail(owner.email, subject, '', html);
        }

        res.status(200).json({ success: true, message: 'Notification sent' });
    } catch (error) {
        console.error('Error sending chat message notification:', error);
        res.status(500).json({ success: false, message: 'Error sending notification' });
    }
};
