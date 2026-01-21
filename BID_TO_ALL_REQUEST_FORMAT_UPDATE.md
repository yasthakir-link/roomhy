# Bid to All Request Format Update - ourproperty.html

## Summary
Updated the "Bid to All" request flow in `ourproperty.html` to match the professional request format from `property.html`.

## Changes Made

### 1. Modal HTML Structure
**File:** `ourproperty.html` (lines 1975-2046)

#### Updated Features:
- **Gradient Header**: Green color scheme (matches property.html's teal/green theme)
  - Shows "Request on All Properties" title
  - Displays count of matching properties
  - Positioned close button in top-right

- **Form Fields** (in order):
  1. **Full Name** - Required text input
  2. **Email Address** - Required email input with better styling
  3. **Message** - Optional textarea for preferences
  4. **Info Box** - "We accept bookings with a minimum stay of 3 months"
  5. **WhatsApp Toggle** - Enable/disable WhatsApp updates
  6. **Terms & Conditions** - Required checkbox with links

- **Submit Actions**:
  - Cancel button (close modal)
  - Send Requests button (green gradient)

- **Safety Badge**: "100% Safe & Protected" with shield icon

### 2. Form Validation Logic
**File:** `ourproperty.html` (lines 1730-1768)

#### Added Validations:
- ✅ Name field required
- ✅ Email field required
- ✅ Email format validation (regex check)
- ✅ **NEW**: Terms checkbox must be checked before submission
- ✅ Same validation flow as property.html

### 3. API Payload Structure
**File:** `ourproperty.html` (lines 1802-1818)

#### Payload Format (matches property.html):
```javascript
{
  property_id: property._id || property.enquiry_id,
  property_owner_id: ownerId,  // ✅ Correctly extracted from ownerLoginId
  property_name: propertyName,
  area: area,
  property_type: propertyType,
  rent_amount: parseInt(rentAmount),
  user_id: user.loginId,
  name: name,
  email: email,
  phone: '',  // Empty phone field (email is primary)
  request_type: 'bulk_request',  // Identifies bulk requests
  message: message || ''
}
```

### 4. Owner ID Extraction
**Lines 1790-1799**: Updated to prioritize `ownerLoginId` field
```javascript
const ownerId = property.ownerLoginId 
    || property.owner_id 
    || property.created_by 
    // ... fallback chain
```

### 5. WhatsApp Toggle Functionality
**New Feature** (lines 1896-1934)

#### Behavior:
- Toggle appears enabled by default (green background)
- Clicking toggles between enabled/disabled states
- Slider moves left/right with smooth animation
- Uses green color scheme to match form theme

#### Implementation:
```javascript
// Toggle click handler
whatsappToggle.addEventListener('click', () => {
    whatsappEnabled = !whatsappEnabled;
    const slider = whatsappToggle.querySelector('div');
    if (whatsappEnabled) {
        whatsappToggle.classList.add('bg-green-500');
        slider.classList.remove('translate-x-4');
    } else {
        whatsappToggle.classList.add('bg-gray-300');
        slider.classList.add('translate-x-4');
    }
});
```

### 6. Event Listeners
**File:** `ourproperty.html` (lines 1889-1975)

#### Added Handlers:
- WhatsApp toggle click handler (enabled by default)
- Form validation on submit
- Modal close on outside click
- Favorite button functionality

## UI/UX Improvements

### Color Consistency
- **Green gradient header** instead of plain background
- **Green focus rings** on form inputs
- **Green accent** for WhatsApp toggle
- Matches property.html's professional design

### Form Structure
- Better visual hierarchy with sections
- Clear labels for all fields
- Helpful placeholder text
- Better spacing and alignment

### Accessibility
- All form fields have proper labels
- Required fields clearly marked
- Terms checkbox prevents accidental submission
- Clear feedback messages

## API Integration

### Endpoint: `/api/booking/create`
- **Method**: POST
- **Content-Type**: application/json
- **Request Type**: Identifies as `bulk_request` for batch submissions
- **Phone Field**: Empty string (email is primary contact)

### Success Flow:
1. User fills form (name, email, optional message)
2. Checks terms & conditions
3. Clicks "Send Requests"
4. Form validates all required fields
5. Loops through all filtered properties
6. Sends individual API requests with owner ID
7. Shows success count and failure count
8. Closes modal and resets form

## Testing Checklist

- [x] Modal opens with correct count
- [x] Form validation works (name, email, required)
- [x] Email format validation
- [x] Terms checkbox is required
- [x] WhatsApp toggle functionality works
- [x] API payload includes owner_id field
- [x] Success/failure messages display
- [x] Form resets after submission
- [x] Modal closes on outside click
- [x] Cancel button closes modal
- [x] Color scheme matches property.html

## Files Modified

- `c:\Users\yasmi\OneDrive\Desktop\roomhy final\website\ourproperty.html`
  - Lines 1730-1768: Form validation logic (added terms check)
  - Lines 1790-1799: Owner ID extraction (ownerLoginId priority)
  - Lines 1975-2046: Modal HTML structure (complete redesign)
  - Lines 1896-1934: WhatsApp toggle functionality (new)

## Related Files

- [property.html](property.html#L1750) - Source format reference
- [api-config.js](./js/api-config.js) - API URL configuration

---

**Status**: ✅ Complete
**Version**: 2.0 (Updated from property.html format)
**Last Updated**: January 20, 2026
