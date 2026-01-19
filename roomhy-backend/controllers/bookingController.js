const BookingRequest = require('../models/BookingRequest');
const User = require('../models/user');

// ==================== BOOKING REQUEST OPERATIONS ====================

/**
 * CREATE BOOKING REQUEST OR BID
 * Auto-generates chat_room_id, routes to property owner, creates property hold if bid
 */
exports.createBookingRequest = async (req, res) => {
    try {
        const { 
            property_id, property_name, area, property_type, rent_amount,
            user_id, owner_id, name, phone, email, request_type, bid_amount, message,
            whatsapp_enabled, chat_enabled
        } = req.body;

        // Validation
        if (!property_id || !user_id || !request_type) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields: property_id, user_id, request_type' 
            });
        }

        // ✅ NEW: Validate owner_id is present
        if (!owner_id) {
            return res.status(400).json({
                success: false,
                message: 'Property owner ID is required'
            });
        }

        // Find area manager by area (for notifications)
        const manager = await User.findOne({ role: 'area_manager', area: area });
        
        // Generate unique chat room ID
        const chatRoomId = `chat_${property_id}_${Date.now()}`;

        // ✅ UPDATED: Create booking with owner_id properly set
        const newRequest = new BookingRequest({
            property_id,
            property_name,
            area,
            property_type,
            rent_amount,
            user_id,
            name,
            phone: phone || null,  // Allow null if phone not provided
            email,
            owner_id,                      // ✅ SET OWNER ID FROM REQUEST
            request_type,
            bid_amount: request_type === 'bid' ? (bid_amount || 500) : 0,
            message,
            whatsapp_enabled: whatsapp_enabled || true,
            area_manager_id: manager ? manager._id : null,
            status: 'pending',
            visit_status: 'not_scheduled'
        });

        await newRequest.save();
        if (request_type === 'bid') {
            const holdExpiry = new Date();
            holdExpiry.setDate(holdExpiry.getDate() + 7); // 7-day hold

            // Store hold info in booking (simplified approach)
            newRequest.hold_expiry_date = holdExpiry;
            newRequest.payment_status = 'paid';
            await newRequest.save();
        }

        // Send email notification to owner
        try {
            const owner = await User.findOne({ loginId: owner_id });
            if (owner && owner.email) {
                const mailer = require('../utils/mailer');
                const subject = `New ${request_type.charAt(0).toUpperCase() + request_type.slice(1)} Request`;
                const html = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #333;">New Booking Request</h2>
                        <p>You have received a new ${request_type} request for your property.</p>
                        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
                            <p><strong>Property:</strong> ${property_name}</p>
                            <p><strong>Tenant:</strong> ${name}</p>
                            <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
                            <p><strong>Email:</strong> ${email || 'N/A'}</p>
                            <p><strong>Type:</strong> ${request_type.charAt(0).toUpperCase() + request_type.slice(1)}</p>
                            ${request_type === 'bid' ? `<p><strong>Bid Amount:</strong> ₹${bid_amount || 0}</p>` : ''}
                            ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
                        </div>
                        <p>Please review this request in your booking requests panel.</p>
                    </div>
                `;
                await mailer.sendMail(owner.email, subject, '', html);
            }
        } catch (emailError) {
            console.error('Failed to send booking request notification email:', emailError);
        }

        // Send email notification to superadmin
        try {
            const mailer = require('../utils/mailer');
            const superadminEmail = 'roomhy01@gmail.com';
            const subject = `New ${request_type.charAt(0).toUpperCase() + request_type.slice(1)} Submitted`;
            const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">New Booking Request</h2>
                    <p>A new ${request_type} has been submitted.</p>
                    <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <p><strong>Property:</strong> ${property_name}</p>
                        <p><strong>Owner ID:</strong> ${owner_id}</p>
                        <p><strong>Tenant:</strong> ${name}</p>
                        <p><strong>Type:</strong> ${request_type.charAt(0).toUpperCase() + request_type.slice(1)}</p>
                        ${request_type === 'bid' ? `<p><strong>Bid Amount:</strong> ₹${bid_amount || 0}</p>` : ''}
                    </div>
                    <p>Please review this request in the superadmin booking panel.</p>
                </div>
            `;
            await mailer.sendMail(superadminEmail, subject, '', html);
        } catch (emailError) {
            console.error('Failed to send booking request notification to superadmin:', emailError);
        }

        res.status(201).json({
            success: true,
            message: `${request_type.charAt(0).toUpperCase() + request_type.slice(1)} submitted successfully`,
            data: newRequest
        });
    } catch (error) {
        console.error('Error creating booking:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

/**
 * CREATE BULK BOOKING REQUEST
 * Creates a single booking request that appears for multiple property owners
 */
exports.createBulkBookingRequest = async (req, res) => {
    try {
        const {
            owner_ids, property_filters, user_id, name, phone, email, bid_amount, message,
            whatsapp_enabled, chat_enabled
        } = req.body;

        // Validation
        if (!owner_ids || !Array.isArray(owner_ids) || owner_ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'owner_ids array is required and cannot be empty'
            });
        }

        if (!user_id || !name || !phone) {
            return res.status(400).json({
                success: false,
                message: 'user_id, name, and phone are required'
            });
        }

        // Create a single bulk booking request
        const newRequest = new BookingRequest({
            property_id: 'bulk_request', // Special identifier for bulk requests
            property_name: 'Bulk Property Request',
            area: property_filters?.area || 'Multiple Areas',
            property_type: property_filters?.property_type || 'Multiple Types',
            rent_amount: 0, // Not applicable for bulk
            user_id,
            name,
            phone,
            email,
            owner_ids, // Array of owner IDs instead of single owner_id
            request_type: 'bulk_request',
            bid_amount: bid_amount || 0,
            message: message || `Bulk request for ${owner_ids.length} properties matching filters`,
            whatsapp_enabled: whatsapp_enabled || true,
            area_manager_id: null, // Not applicable for bulk
            status: 'pending',
            visit_status: 'not_scheduled',
            property_filters, // Store the filters used for this bulk request
            is_bulk_request: true // Flag to identify bulk requests
        });

        await newRequest.save();

        // Send email notifications to all owners
        const mailer = require('../utils/mailer');
        let successCount = 0;
        let failureCount = 0;

        for (const ownerId of owner_ids) {
            try {
                const owner = await User.findOne({ loginId: ownerId });
                if (owner && owner.email) {
                    const subject = `New Bulk Booking Request`;
                    const html = `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #333;">New Bulk Booking Request</h2>
                            <p>You have received a new bulk booking request from a tenant.</p>
                            <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
                                <p><strong>Tenant:</strong> ${name}</p>
                                <p><strong>Phone:</strong> ${phone}</p>
                                <p><strong>Email:</strong> ${email}</p>
                                <p><strong>Bid Amount:</strong> ₹${bid_amount || 0}</p>
                                ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
                                <p><strong>Filter Applied:</strong> ${property_filters ? JSON.stringify(property_filters, null, 2) : 'All properties'}</p>
                            </div>
                            <p>This request matches your property filters. Please review it in your booking requests panel.</p>
                        </div>
                    `;
                    await mailer.sendMail(owner.email, subject, '', html);
                    successCount++;
                }
            } catch (emailError) {
                console.error(`Failed to send bulk booking notification to owner ${ownerId}:`, emailError);
                failureCount++;
            }
        }

        // Send email notification to superadmin
        try {
            const superadminEmail = 'roomhy01@gmail.com';
            const subject = `New Bulk Booking Request Submitted`;
            const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">New Bulk Booking Request</h2>
                    <p>A new bulk booking request has been submitted to ${owner_ids.length} property owners.</p>
                    <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <p><strong>Tenant:</strong> ${name}</p>
                        <p><strong>Owner Count:</strong> ${owner_ids.length}</p>
                        <p><strong>Bid Amount:</strong> ₹${bid_amount || 0}</p>
                        <p><strong>Filters:</strong> ${property_filters ? JSON.stringify(property_filters, null, 2) : 'All properties'}</p>
                    </div>
                    <p>Email notifications sent to ${successCount} owners (${failureCount} failed).</p>
                </div>
            `;
            await mailer.sendMail(superadminEmail, subject, '', html);
        } catch (emailError) {
            console.error('Failed to send bulk booking notification to superadmin:', emailError);
        }

        res.status(201).json({
            success: true,
            message: `Bulk booking request created successfully. Notifications sent to ${successCount} property owners.`,
            data: {
                ...newRequest.toObject(),
                email_notifications_sent: successCount,
                email_notifications_failed: failureCount
            }
        });
    } catch (error) {
        console.error('Error creating bulk booking:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * GET ALL BOOKING REQUESTS
 * Supports filtering by area, request_type, status, owner_id, or manager_id
 * Now also supports bulk requests that appear for multiple owners
 */
exports.getBookingRequests = async (req, res) => {
    try {
        const { area, manager_id, owner_id, user_id, type, status } = req.query;
        let query = {};

        // ✅ NEW: Support owner_id query param for property owner panel
        if (owner_id) {
            // For bulk requests, check if owner_id is in the owner_ids array
            query.$or = [
                { owner_id: owner_id }, // Regular requests
                { owner_ids: { $in: [owner_id] }, is_bulk_request: true } // Bulk requests
            ];
        } else if (user_id) {
            query.user_id = user_id;
        } else if (manager_id) {
            // ✅ Keep area_manager_id filtering for area managers
            query.area_manager_id = manager_id;
        }

        if (area) query.area = area;
        if (type) query.request_type = type;
        if (status) query.status = status;

        const requests = await BookingRequest.find(query)
            .sort({ created_at: -1 })
            .lean();

        res.status(200).json({
            success: true,
            total: requests.length,
            data: requests
        });
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * GET BOOKING REQUEST BY ID
 */
exports.getBookingRequestById = async (req, res) => {
    try {
        const request = await BookingRequest.findById(req.params.id);

        if (!request) {
            return res.status(404).json({ 
                success: false, 
                message: 'Booking request not found' 
            });
        }

        res.status(200).json({ 
            success: true, 
            data: request 
        });
    } catch (error) {
        console.error('Error fetching booking:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

/**
 * UPDATE BOOKING STATUS
 * Handles status change and optional visit information
 */
exports.updateBookingStatus = async (req, res) => {
    try {
        const { status, visit_type, visit_date, visit_time_slot, visit_status } = req.body;

        const updateData = {
            status,
            updated_at: Date.now()
        };

        // Update visit info if provided
        if (visit_type) updateData.visit_type = visit_type;
        if (visit_date) updateData.visit_date = visit_date;
        if (visit_time_slot) updateData.visit_time_slot = visit_time_slot;
        if (visit_status) updateData.visit_status = visit_status;

        const request = await BookingRequest.findByIdAndUpdate(
            req.params.id, 
            updateData, 
            { new: true }
        );

        if (!request) {
            return res.status(404).json({ 
                success: false, 
                message: 'Booking request not found' 
            });
        }

        res.status(200).json({ 
            success: true, 
            message: 'Booking status updated',
            data: request 
        });
    } catch (error) {
        console.error('Error updating booking status:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

/**
 * APPROVE BOOKING
 * Changes status to 'confirmed'
 */
exports.approveBooking = async (req, res) => {
    try {
        const request = await BookingRequest.findByIdAndUpdate(
            req.params.id,
            {
                status: 'confirmed',
                updated_at: Date.now()
            },
            { new: true }
        );

        if (!request) {
            return res.status(404).json({ 
                success: false, 
                message: 'Booking request not found' 
            });
        }

        // Send email notification to tenant
        try {
            const { sendBookingAcceptanceEmail } = require('../utils/emailNotifications');
            const tenantName = request.name || 'Valued Guest';
            const propertyName = request.property_name || 'Property';
            const ownerName = req.body.owner_name || 'Property Owner';
            
            await sendBookingAcceptanceEmail(
                request.email,
                tenantName,
                propertyName,
                ownerName
            );
            
            // Create in-app notification
            const notificationEndpoint = `${process.env.API_URL || 'http://localhost:5000'}/api/website-enquiry/notifications/create`;
            await fetch(notificationEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: request.user_id,
                    title: 'Booking Accepted! 🎉',
                    message: `Your booking for ${propertyName} has been accepted`,
                    type: 'booking_accept',
                    relatedId: request._id,
                    actionUrl: 'mystays.html'
                })
            }).catch(err => console.log('Notification API call failed:', err.message));
        } catch (emailErr) {
            console.error('Error sending approval email:', emailErr);
        }

        res.status(200).json({ 
            success: true, 
            message: 'Booking approved and notification sent',
            data: request 
        });
    } catch (error) {
        console.error('Error approving booking:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

/**
 * REJECT BOOKING
 * Changes status to 'rejected'
 */
exports.rejectBooking = async (req, res) => {
    try {
        const request = await BookingRequest.findByIdAndUpdate(
            req.params.id,
            {
                status: 'rejected',
                updated_at: Date.now()
            },
            { new: true }
        );

        if (!request) {
            return res.status(404).json({ 
                success: false, 
                message: 'Booking request not found' 
            });
        }

        res.status(200).json({ 
            success: true, 
            message: 'Booking rejected',
            data: request 
        });
    } catch (error) {
        console.error('Error rejecting booking:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

/**
 * SCHEDULE VISIT
 * Updates visit details and changes visit_status to 'scheduled'
 */
exports.scheduleVisit = async (req, res) => {
    try {
        const { visit_type, visit_date, visit_time_slot, visit_notes, visit_duration, contact_phone, contact_email } = req.body;

        if (!visit_type || !visit_date || !visit_time_slot) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: visit_type, visit_date, visit_time_slot'
            });
        }

        const request = await BookingRequest.findByIdAndUpdate(
            req.params.id,
            {
                visit_type,
                visit_date,
                visit_time_slot,
                visit_notes,
                visit_duration,
                contact_phone,
                contact_email,
                visit_status: 'scheduled',
                status: 'confirmed',
                updated_at: Date.now()
            },
            { new: true }
        );

        if (!request) {
            return res.status(404).json({ 
                success: false, 
                message: 'Booking request not found' 
            });
        }

        res.status(200).json({ 
            success: true, 
            message: 'Visit scheduled successfully',
            data: request 
        });
    } catch (error) {
        console.error('Error scheduling visit:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

/**
 * DELETE BOOKING
 */
exports.deleteBooking = async (req, res) => {
    try {
        const request = await BookingRequest.findByIdAndDelete(req.params.id);

        if (!request) {
            return res.status(404).json({ 
                success: false, 
                message: 'Booking request not found' 
            });
        }

        res.status(200).json({ 
            success: true, 
            message: 'Booking deleted successfully',
            data: request 
        });
    } catch (error) {
        console.error('Error deleting booking:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// ==================== CHAT MESSAGE OPERATIONS ====================

/**
 * SEND MESSAGE
 * Creates a chat message linked to a booking
 */
exports.sendMessage = async (req, res) => {
    return res.status(410).json({ 
        success: false, 
        message: 'Chat functionality has been removed' 
    });
};

// ==================== PROPERTY HOLD OPERATIONS ====================

/**
 * CHECK PROPERTY HOLD
 * Returns whether a property is currently on hold
 */
exports.checkPropertyHold = async (req, res) => {
    try {
        const { property_id } = req.params;

        // Find active bid/request for this property
        const booking = await BookingRequest.findOne({
            property_id,
            request_type: 'bid',
            status: { $in: ['pending', 'confirmed'] }
        });

        if (!booking) {
            return res.status(200).json({ 
                success: true, 
                is_on_hold: false,
                message: 'Property is not on hold'
            });
        }

        const now = new Date();
        const isOnHold = booking.hold_expiry_date && new Date(booking.hold_expiry_date) > now;

        res.status(200).json({ 
            success: true, 
            is_on_hold: isOnHold,
            booking_id: booking._id,
            hold_expiry_date: booking.hold_expiry_date,
            message: isOnHold ? 'Property is currently on hold' : 'Hold has expired'
        });
    } catch (error) {
        console.error('Error checking property hold:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

/**
 * RELEASE PROPERTY HOLD
 * Releases the hold on a property
 */
exports.releasePropertyHold = async (req, res) => {
    try {
        const { property_id } = req.params;

        const booking = await BookingRequest.findOneAndUpdate(
            {
                property_id,
                request_type: 'bid'
            },
            {
                hold_expiry_date: null,
                updated_at: Date.now()
            },
            { new: true }
        );

        if (!booking) {
            return res.status(404).json({ 
                success: false, 
                message: 'No active hold found for this property' 
            });
        }

        res.status(200).json({ 
            success: true, 
            message: 'Property hold released successfully',
            data: booking 
        });
    } catch (error) {
        console.error('Error releasing property hold:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

/**
 * UPDATE CHAT DECISION (LIKE/REJECT)
 * Updates owner_liked, user_liked, owner_rejected, or user_rejected
 */
exports.updateChatDecision = async (req, res) => {
    try {
        const { id } = req.params;
        const { decision, userType } = req.body; // decision: 'like' or 'reject', userType: 'owner' or 'user'

        if (!['like', 'reject'].includes(decision) || !['owner', 'user'].includes(userType)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid decision or userType' 
            });
        }

        const updateField = userType === 'owner' ? 
            (decision === 'like' ? 'owner_liked' : 'owner_rejected') : 
            (decision === 'like' ? 'user_liked' : 'user_rejected');

        const booking = await BookingRequest.findByIdAndUpdate(
            id,
            { 
                [updateField]: true,
                updated_at: Date.now()
            },
            { new: true }
        );

        if (!booking) {
            return res.status(404).json({ 
                success: false, 
                message: 'Booking request not found' 
            });
        }

        // Check if both liked
        if (booking.owner_liked && booking.user_liked) {
            // Set status to confirmed and schedule visit
            booking.status = 'confirmed';
            booking.visit_status = 'scheduled';
            booking.visit_date = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
            booking.visit_time_slot = '10:00 AM - 12:00 PM'; // Default slot
            await booking.save();

            // Send email notification to superadmin about confirmed booking
            try {
                const mailer = require('../utils/mailer');
                const superadminEmail = 'roomhy01@gmail.com';
                const subject = 'New Scheduled Booking Confirmed';
                const html = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #333;">New Booking Confirmed</h2>
                        <p>A booking has been confirmed through chat agreement.</p>
                        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
                            <p><strong>Property:</strong> ${booking.property_name || 'N/A'}</p>
                            <p><strong>Tenant:</strong> ${booking.name || 'N/A'}</p>
                            <p><strong>Owner:</strong> ${booking.owner_name || 'N/A'}</p>
                            <p><strong>Rent:</strong> ₹${booking.rent_amount || 0}</p>
                            <p><strong>Visit Date:</strong> ${booking.visit_date ? new Date(booking.visit_date).toLocaleDateString() : 'Not scheduled'}</p>
                            <p><strong>Visit Time:</strong> ${booking.visit_time_slot || 'Not specified'}</p>
                        </div>
                        <p>Please review the booking details in the superadmin panel.</p>
                    </div>
                `;
                await mailer.sendMail(superadminEmail, subject, '', html);
            } catch (emailError) {
                console.error('Failed to send booking confirmation notification email:', emailError);
            }
        }

        // Check if anyone rejected
        if (booking.owner_rejected || booking.user_rejected) {
            // Close chat by setting status to rejected
            booking.status = 'rejected';
            await booking.save();
        }

        res.status(200).json({ 
            success: true, 
            message: 'Decision updated successfully',
            data: booking 
        });
    } catch (error) {
        console.error('Error updating chat decision:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};