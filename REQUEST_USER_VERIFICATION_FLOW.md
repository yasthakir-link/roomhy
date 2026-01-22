# Request User Verification & Chat Flow Implementation

## Overview
Implemented a complete email-based user verification system that checks if a user's email exists in the `new_signups.html` database before allowing them to submit property requests. If the email is not found, users are prompted to sign up first.

## Key Features

### 1. **Email Verification Against New Signups**
When user clicks "Send Request" button on property.html:
- Check if email exists in `new_signups.html` (stored as `roomhy_kyc_verification` in localStorage)
- If user found: Extract their user ID from the signup record
- If user NOT found: Show popup asking to sign up

### 2. **Signup Prompt Popup**
```javascript
const shouldSignup = confirm(
    `Your email (${email}) is not registered in our system yet.\n\n` +
    `Would you like to sign up first?\n\n` +
    `Click OK to go to signup page, or Cancel to proceed as guest.`
);
```
- **OK**: Redirects to signup.html with email and return URL pre-filled
- **Cancel**: Allows proceeding without signup (as guest)

### 3. **Chat Flow Initialization**
When booking request is created:
```javascript
const chatData = {
    user_id: userId,
    tenant_id: user.loginId,
    owner_id: propertyOwnerId,
    property_id: propertyId,
    booking_id: bookingId,
    email: email,
    name: name,
    created_at: new Date().toISOString()
};
```
- Chat data stored in `roomhy_booking_chats` localStorage
- Links signup user ID to booking for tenant-owner communication
- Ready for WebSocket/real-time chat implementation

### 4. **User ID in Booking Request**
Booking request now includes:
- `user_id`: Tenant's login ID
- `signup_user_id`: User ID from new_signups.html (if available)
- `owner_id`: Property owner's login ID

### 5. **Display User ID in Booking Request Page**
In `propertyowner/booking_request.html`:
- User ID column shows `signup_user_id` if available
- Falls back to `user_id` if not
- Shows "Guest" if no ID available

```html
<td class="px-4 py-3 text-gray-600 whitespace-nowrap font-mono text-xs">
    <strong>${req.signup_user_id || req.user_id || 'Guest'}</strong>
</td>
```

### 6. **Navigation Flow**
After successful request submission:
1. Show success alert
2. Wait 1.5 seconds
3. Redirect to **index.html only** (not back to previous page)
```javascript
setTimeout(() => {
    window.location.href = '../index.html';
}, 1500);
```

## Data Structure

### New Signups Table (localStorage key: `roomhy_kyc_verification`)
```javascript
{
    id: "USER_ID_123",           // Unique signup user ID
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    phone: "9876543210",
    password: "hashed_password",
    status: "verified",           // pending | verified | rejected
    aadhar: "XXXX XXXX 1234",
    pan: "ABCD1234E",
    createdAt: "2024-01-22T10:00:00Z"
}
```

### Booking Request Object
```javascript
{
    _id: "BOOKING_ID_123",
    property_id: "PROP_001",
    property_name: "Athena House",
    area: "Hinjawadi",
    property_type: "PG",
    rent_amount: 8000,
    user_id: "TENANT_LOGIN_ID",       // Tenant's login ID
    signup_user_id: "SIGNUP_USER_123", // NEW: From new_signups
    owner_id: "OWNER_LOGIN_ID",
    name: "John Doe",
    email: "john@example.com",
    request_type: "request",
    status: "pending",
    created_at: "2024-01-22T10:00:00Z"
}
```

### Chat Data Object (localStorage key: `roomhy_booking_chats`)
```javascript
{
    "BOOKING_ID_123": {
        user_id: "SIGNUP_USER_123",     // From new_signups
        tenant_id: "TENANT_LOGIN_ID",
        owner_id: "OWNER_LOGIN_ID",
        property_id: "PROP_001",
        booking_id: "BOOKING_ID_123",
        email: "john@example.com",
        name: "John Doe",
        created_at: "2024-01-22T10:00:00Z"
    }
}
```

## Implementation Details

### File: `website/property.html`

#### 1. Schedule Visit Form Handler (Line ~1538)
```javascript
scheduleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // 1. Check user login
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    
    // 2. Get form data
    const name = document.getElementById('visit-name').value;
    const email = document.getElementById('visit-email').value;
    
    // 3. ✅ CHECK IF EMAIL HAS USER ID IN NEW_SIGNUPS
    const kycTableKey = 'roomhy_kyc_verification';
    const signupUsers = JSON.parse(localStorage.getItem(kycTableKey) || '[]');
    const userSignup = signupUsers.find(u => 
        u.email && u.email.toLowerCase() === email.toLowerCase()
    );
    
    let userId = null;
    if (userSignup && userSignup.id) {
        userId = userSignup.id;
        console.log('✅ User found in new_signups with ID:', userId);
    } else {
        // Show popup for signup
        const shouldSignup = confirm(
            `Your email (${email}) is not registered...\n` +
            `Would you like to sign up first?`
        );
        
        if (shouldSignup) {
            window.location.href = '../signup.html?email=' + 
                encodeURIComponent(email);
            return;
        }
    }
    
    // 4. Create booking request with signup user ID
    const bookingData = {
        property_id: propertyId,
        property_name: propertyName,
        // ... other fields ...
        signup_user_id: userId  // ✅ ADD THIS
    };
    
    const response = await fetch(`${API_URL}/api/booking/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData)
    });
    
    // 5. Initialize chat flow
    if (response.ok) {
        const result = await response.json();
        const bookingId = result.bookingId || result._id;
        
        if (userId) {
            const chatData = {
                user_id: userId,
                tenant_id: user.loginId,
                owner_id: propertyOwnerId,
                property_id: propertyId,
                booking_id: bookingId,
                email: email,
                name: name,
                created_at: new Date().toISOString()
            };
            
            const existingChats = JSON.parse(
                localStorage.getItem('roomhy_booking_chats') || '{}'
            );
            existingChats[bookingId] = chatData;
            localStorage.setItem('roomhy_booking_chats', 
                JSON.stringify(existingChats));
        }
        
        // 6. Show success and redirect to index only
        alert(`Thank you ${name}! Your request sent.`);
        scheduleForm.reset();
        
        setTimeout(() => {
            window.location.href = '../index.html';
        }, 1500);
    }
});
```

### File: `propertyowner/booking_request.html`

#### 2. Display User ID (Line ~371)
```javascript
// OLD:
<td class="px-4 py-3">${req.user_id || 'N/A'}</td>

// NEW:
<td class="px-4 py-3 font-mono text-xs">
    <strong>${req.signup_user_id || req.user_id || 'Guest'}</strong>
</td>
```

## User Flow Diagram

```
User on Property Page
    ↓
Click "Send Request"
    ↓
Fill Form (Name, Email)
    ↓
Check: Email in new_signups? ─────→ YES ─→ Get signup user ID
    ↓                                        ↓
    NO                              Create booking with signup_user_id
    ↓                               ↓
Show Popup:                         Initialize chat flow
"Sign up first?"                    ↓
    ↓                               Success message
├─ OK → Redirect to signup.html     ↓
│   (with email pre-filled)         Redirect to index.html
│                                   
└─ Cancel → Proceed as guest
    ↓
    Create booking without user ID
    ↓
    Success message
    ↓
    Redirect to index.html
```

## Backend Integration (Optional)

### API Endpoint: `POST /api/booking/create`

**New Request Body:**
```json
{
    "property_id": "PROP_001",
    "property_name": "Athena House",
    "area": "Hinjawadi",
    "property_type": "PG",
    "rent_amount": 8000,
    "user_id": "tenant_login_123",
    "owner_id": "owner_login_456",
    "signup_user_id": "signup_user_789",
    "name": "John Doe",
    "email": "john@example.com",
    "request_type": "request"
}
```

**Backend should:**
1. Accept and store `signup_user_id` in booking collection
2. Create chat room with `user_id` from signup table
3. Trigger email notification to owner with tenant name and signup user ID
4. Create chat history entry linking signup user ID to booking

## Testing Checklist

- [ ] Test with registered email (should proceed without popup)
- [ ] Test with unregistered email (should show popup)
- [ ] Click OK on popup (should redirect to signup with email)
- [ ] Click Cancel on popup (should proceed as guest)
- [ ] Verify `signup_user_id` in booking request object
- [ ] Verify chat data stored in localStorage
- [ ] Verify User ID column in booking_request.html shows correct ID
- [ ] Verify redirect goes to index.html only
- [ ] Test on mobile and desktop screens

## Error Handling

### Email Not Found
```javascript
if (!userSignup) {
    // Show popup to encourage signup
    const shouldSignup = confirm(`Email not registered...`);
}
```

### No Signup User ID
```javascript
if (userId) {
    // Only add chat data if user has signup ID
    existingChats[bookingId] = chatData;
}
// Always allow booking request even without signup ID
```

### Missing New Signups Data
```javascript
const signupUsers = JSON.parse(
    localStorage.getItem(kycTableKey) || '[]'  // Empty array if not found
);
```

## Future Enhancements

1. **Real-time Chat**: Use chat data to initiate WebSocket connection
2. **Automatic Chat Room Creation**: Backend creates Firebase Firestore document
3. **Email Notifications**: Include signup user ID in tenant notification emails
4. **User Profile Link**: Link signup user ID to full profile in admin panel
5. **Verification Badge**: Show verified status based on KYC status
6. **Chat History**: Retrieve past messages using signup user ID
7. **Tenant Dashboard**: Show pending requests grouped by signup status

## Conclusion

This implementation provides a seamless experience where:
- **Registered users** can immediately create bookings with their signup ID
- **New users** are prompted to sign up for a complete profile
- **Guests** can still submit requests without full signup
- **Chat flow** is automatically initialized for owner-tenant communication
- **Navigation** returns to index page for a clean user experience

All user IDs are properly tracked and can be used for chat, notifications, and future CRM features.
