# Website Pages - Navigation & Notification Integration Guide

## Quick Setup for All Website Pages

### Step 1: Add Shared Header to HTML Head
Add this line to the `<head>` section of each page:

```html
<!-- Shared Header and Notifications -->
<script src="./js/shared-header.js"></script>
<script src="./js/notification-system.js"></script>
```

### Step 2: Remove Old Header Markup
Remove the old `<header>` element and mobile menu markup from the page body. The shared-header.js will inject a new consistent header.

### Step 3: Keep Your Page Content
Keep all your existing content sections, filters, forms, etc. The header is injected above the first element.

---

## Pages to Update

1. **index.html** - Home page
2. **ourproperty.html** - Our Properties (✅ DONE)
3. **mystays.html** - My Stays
4. **fav.html** - Favorites  
5. **websitechat.html** - Chat
6. **property.html** - Property Details
7. **about.html** - About Us
8. **contact.html** - Contact Us
9. **profile.html** - User Profile
10. **booking.html** - Booking Page

---

## Notification Features Implemented

### 1. In-App Notifications
- Bell icon in header
- Notification dropdown
- Red badge when new notifications arrive
- Auto-refreshes every 30 seconds

### 2. Toast Notifications
- Pop-up alerts for important events
- Auto-dismiss after 5 seconds
- Color-coded (info, success, error)

### 3. Events Triggering Notifications
- **Booking Request Accepted**: Shows when owner accepts booking
- **New Chat Messages**: Shows when new messages arrive
- **New Booking Requests**: Shows when new request received

---

## Backend Integration

### New API Endpoints

1. **GET /api/notifications/website/user/:userId**
   - Returns all notifications for a user

2. **POST /api/notifications/website/create**
   - Creates a new notification
   - Body: `{ userId, title, message, type, relatedId, actionUrl }`

3. **POST /api/notifications/booking-accept**
   - Sends email + in-app notification for booking acceptance

4. **POST /api/email/send**
   - Generic email notification endpoint

---

## Email Notifications

### Enabled Email Types

1. **Booking Acceptance Email**
   - Sent when owner accepts booking request
   - Includes property name and owner details
   - Direct action link to view booking

2. **New Chat Message Email**
   - Sent when new message arrives
   - Includes sender name and message preview
   - Direct action link to chat page

3. **Booking Request Email** (to owner)
   - Sent to property owner when new booking comes in
   - Includes tenant details
   - Action link to manage requests

---

## How to Send Notifications Programmatically

### From Backend (Node.js)

```javascript
// Send notification + email
const { sendBookingAcceptanceEmail } = require('./utils/emailNotifications');

await sendBookingAcceptanceEmail(
    'user@email.com',
    'John Doe',
    'PG Apartment in Bangalore',
    'Property Owner Name'
);

// Create in-app notification
const notifResponse = await fetch('http://localhost:5000/api/notifications/website/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        userId: '123',
        title: 'Booking Accepted!',
        message: 'Your booking has been accepted',
        type: 'booking_accept',
        relatedId: 'booking_id',
        actionUrl: 'mystays.html'
    })
});
```

### From Frontend (JavaScript)

```javascript
// Trigger notification
NOTIFICATION_SERVICE.addNotification(
    'Booking Accepted! 🎉',
    'Your booking for XYZ has been accepted',
    'booking_accept',
    'booking_123',
    'mystays.html'
);

// Show toast
NOTIFICATION_SERVICE.showToast('Success!', 'Action completed', 'success');
```

---

## Mobile Responsiveness

### Shared Header Features
- ✅ Responsive navigation menu
- ✅ Mobile hamburger menu
- ✅ Notification dropdown on mobile
- ✅ Touch-friendly buttons

### Making Existing Content Mobile Responsive

Add these Tailwind classes to ensure responsiveness:

```html
<!-- Desktop only -->
<div class="hidden md:block">Desktop content</div>

<!-- Mobile only -->
<div class="md:hidden">Mobile content</div>

<!-- Responsive grid -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
```

---

## Testing Notifications

1. **Test In-App Notifications**
   ```javascript
   // In browser console
   NOTIFICATION_SERVICE.addNotification('Test Title', 'Test Message', 'info', 'test', 'index.html');
   ```

2. **Test Toast**
   ```javascript
   NOTIFICATION_SERVICE.showToast('Test Toast', 'Message here', 'success');
   ```

3. **Test Email** (requires SMTP configured)
   - Backend will log success/failure
   - Check Gmail inbox for test emails

---

## Configuration

### Polling Interval
Default: 30 seconds. To change:

```javascript
// In website/js/notification-system.js
NOTIFICATION_SERVICE.startPolling(60000); // 60 seconds
```

### API URL
Set in each page's head (if needed):
```javascript
window.API_URL = 'http://localhost:5000';
```

---

## Troubleshooting

### Notifications Not Appearing
1. Check browser console for errors
2. Verify userId is set: `localStorage.getItem('websiteUserId')`
3. Check API is running on correct port
4. Verify notification endpoint exists

### Emails Not Sending
1. Check .env file for SMTP configuration
2. Verify Gmail app password is correct
3. Check server logs for email errors
4. Test with `npm run test-email` in roomhy-backend

### Header Not Appearing
1. Verify shared-header.js is loaded
2. Check browser console for script errors
3. Ensure lucide icons library is loaded

---

## Next Steps

1. ✅ Add shared-header.js to all website pages
2. ✅ Remove old header markup from each page
3. ✅ Test navigation between pages
4. ✅ Test notifications appearing
5. ✅ Configure SMTP for email sending
6. ✅ Test email notifications
7. Test responsive design on mobile browsers
