# Request User Verification - Quick Reference

## 🎯 What Was Implemented

Implemented email-based user verification system for property requests:

1. **Email Check**: When user clicks "Send Request", verify email exists in `new_signups.html`
2. **Signup Prompt**: If email not found, show popup asking to sign up
3. **Chat Flow**: Initialize chat with signup user ID when booking created
4. **Booking Request**: Add signup user ID to booking data
5. **Display User ID**: Show signup user ID in booking_request.html
6. **Navigation**: Redirect to index.html only (no back button)

## 📝 File Changes

### `website/property.html` (Lines ~1538-1640)
**Added:**
- Email verification against `roomhy_kyc_verification` localStorage
- Check if user email exists in new signups
- Show popup if email not found
- Initialize chat flow data
- Add `signup_user_id` to booking request
- Redirect to index.html after success

**Key Variables:**
- `userId`: User ID from new_signups (if found)
- `signupUsers`: Array of signup records from localStorage
- `userSignup`: Found signup record for email
- `bookingData`: Includes `signup_user_id`
- `chatData`: For initializing tenant-owner chat

### `propertyowner/booking_request.html` (Line ~371)
**Changed:**
```javascript
// OLD: Display only user_id
<td>${req.user_id || 'N/A'}</td>

// NEW: Display signup_user_id first, fallback to user_id
<td class="px-4 py-3 text-gray-600 whitespace-nowrap font-mono text-xs">
    <strong>${req.signup_user_id || req.user_id || 'Guest'}</strong>
</td>
```

## 🔄 User Flow

```
User fills request form with email
↓
Email checked against new_signups database
↓
Email exists? ──YES──→ Get signup user ID
│                      ↓
│                   Create booking with signup_user_id
│                      ↓
│                   Initialize chat flow
│                      ↓
│                   Redirect to index.html
│
└──NO──→ Show popup: "Sign up first?"
         ├─ OK → Redirect to signup.html
         └─ Cancel → Proceed as guest, redirect to index.html
```

## 💾 localStorage Keys

| Key | Purpose | Data |
|-----|---------|------|
| `roomhy_kyc_verification` | New signups database | Array of user objects with `id`, `email`, etc |
| `roomhy_booking_chats` | Chat flow data | Object with `booking_id` as key, chat info as value |

## 🔍 Booking Request Object

```javascript
{
    _id: "BOOKING_ID",
    property_id: "PROP_001",
    property_name: "Property Name",
    area: "Area Name",
    user_id: "tenant_login_id",        // Tenant's login
    signup_user_id: "USER_ID_123",     // ✅ NEW: From new_signups
    owner_id: "owner_login_id",
    name: "Tenant Name",
    email: "tenant@email.com",
    request_type: "request",
    status: "pending",
    created_at: "2024-01-22T10:00:00Z"
}
```

## 💬 Chat Flow Data

```javascript
{
    booking_id: {
        user_id: "SIGNUP_USER_123",     // From new_signups
        tenant_id: "TENANT_LOGIN_ID",   // Tenant's login
        owner_id: "OWNER_LOGIN_ID",     // Owner's login
        property_id: "PROP_001",
        booking_id: "BOOKING_123",
        email: "tenant@email.com",
        name: "Tenant Name",
        created_at: "2024-01-22T10:00:00Z"
    }
}
```

## ✅ Testing Steps

1. **Register on new_signups.html first**
   - Sign up with email `test@example.com`
   - Verify signup appears in localStorage `roomhy_kyc_verification`

2. **Test registered user**
   - Go to property.html
   - Fill request form with registered email
   - Should NOT show signup popup
   - Should show success and redirect to index.html

3. **Test unregistered user**
   - Fill request form with unregistered email
   - Should show popup: "Email not registered"
   - Click OK → redirect to signup.html with email pre-filled
   - Click Cancel → proceed as guest

4. **Check booking_request.html**
   - Log in as property owner
   - Go to booking_request.html
   - User ID column shows signup user ID (if registered)

## 🐛 Common Issues

**Issue**: Popup not showing
- Check if `roomhy_kyc_verification` exists in localStorage
- Verify email comparison is case-insensitive

**Issue**: Chat flow not initializing
- Check if `userId` is properly extracted
- Verify `roomhy_booking_chats` is created in localStorage

**Issue**: User ID not showing in table
- Check if `signup_user_id` is included in API response
- Verify booking data structure in backend

## 🎨 UI Changes

### Property.html Request Form
- Same form, no visual changes
- Added email verification backend

### Booking Request Page
- User ID column now shows: **bold monospace text**
- Shows "Guest" if no user ID available
- Highlights registered vs unregistered users

## 📊 Data Flow Summary

```
new_signups.html database
    ↓ (check email)
property.html request form
    ├─ Email found → Get signup user ID
    └─ Email not found → Show signup popup
    ↓
Create booking request
    ├─ With signup_user_id (if found)
    └─ Without signup_user_id (if guest)
    ↓
Store chat flow data
    └─ Initialize user-owner chat
    ↓
Redirect to index.html
    └─ All requests go to index, no back
    ↓
booking_request.html
    └─ Display signup_user_id in table
```

## 🔐 Security Considerations

- Email verification is client-side only (localStorage)
- Backend should verify user ID when booking is created
- Chat initialization should validate user ownership
- Don't expose full signup details in API responses

## 📱 Mobile Compatibility

- Popup works on all devices
- Form remains fully responsive
- Table User ID column visible on all screen sizes
- Navigation works on mobile (no browser back)

## 🚀 Next Steps

1. **Backend Integration**: Accept `signup_user_id` in API
2. **Chat System**: Create chat room with signup user ID
3. **Notifications**: Include signup user ID in emails
4. **Admin Dashboard**: Show verified vs guest requests
5. **User Profiles**: Link signup user ID to full profile

---
**Last Updated**: January 22, 2026
**Status**: ✅ Implemented & Deployed
