# 📡 Complete API Reference

## Base URL
```
http://localhost:5000
```

---

## 🏠 VISIT DATA ENDPOINTS
**Base Path**: `/api/visits`

### 1. **POST** `/api/visits/submit`
**Purpose**: Submit a new property visit
**Called From**: `website/visit.html`

**Request Body**:
```json
{
  "visitorName": "string",
  "visitorEmail": "email",
  "visitorPhone": "phone",
  "propertyName": "string",
  "propertyType": "apartment|house|room|commercial",
  "city": "string",
  "area": "string",
  "address": "string",
  "pincode": "string",
  "description": "string",
  "monthlyRent": "number",
  "deposit": "string",
  "genderSuitability": "any|male|female|families",
  "amenities": ["array", "of", "strings"],
  "ownerName": "string",
  "ownerEmail": "email",
  "ownerPhone": "phone",
  "ownerCity": "string",
  "photos": ["base64", "images"],
  "professionalPhotos": ["base64", "images"]
}
```

**Response**:
```json
{
  "success": true,
  "message": "Visit submitted successfully",
  "visitId": "unique_id_generated",
  "data": { /* full document */ }
}
```

**Status Code**: 201 Created

---

### 2. **GET** `/api/visits/all`
**Purpose**: Get all visits (admin use)
**Called From**: `superadmin/enquiry-db.html`

**Response**:
```json
{
  "success": true,
  "count": 5,
  "visits": [
    {
      "visitId": "id",
      "propertyName": "...",
      "status": "submitted",
      ...
    }
  ]
}
```

**Status Code**: 200 OK

---

### 3. **GET** `/api/visits/pending`
**Purpose**: Get visits awaiting approval (most important for admin)
**Called From**: `superadmin/enquiry-db.html`

**Filters**: Only returns visits with status `submitted` or `pending_review`

**Response**:
```json
{
  "success": true,
  "count": 3,
  "visits": [
    {
      "visitId": "...",
      "propertyName": "...",
      "status": "submitted",
      ...
    }
  ]
}
```

**Status Code**: 200 OK

---

### 4. **GET** `/api/visits/approved`
**Purpose**: Get all approved visits
**Called From**: (Optional - for admin reporting)

**Response**:
```json
{
  "success": true,
  "count": 2,
  "visits": [...]
}
```

**Status Code**: 200 OK

---

### 5. **GET** `/api/visits/:visitId`
**Purpose**: Get single visit details
**Called From**: `superadmin/enquiry-db.html` (modal view)

**URL Param**: `visitId` - The visit ID

**Response**:
```json
{
  "success": true,
  "visit": { /* full visit document */ }
}
```

**Status Code**: 200 OK

---

### 6. **PUT** `/api/visits/:visitId/status`
**Purpose**: Update visit status manually
**Called From**: (Optional)

**Request Body**:
```json
{
  "status": "submitted|pending_review|approved|rejected"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Visit status updated",
  "visit": { /* updated document */ }
}
```

**Status Code**: 200 OK

---

### 7. **POST** `/api/visits/:visitId/approve`
**Purpose**: Approve a visit and move to ApprovedProperty collection
**Called From**: `superadmin/enquiry-db.html` (approve button)

**Request Body**:
```json
{
  "approvalNotes": "string (optional)",
  "approvedBy": "admin name"
}
```

**What it does**:
1. Updates VisitData status to "approved"
2. Sets approvedAt timestamp
3. Creates entry in ApprovedProperty collection
4. Sets isLiveOnWebsite = true
5. Sets isLiveOnOurProperty = true

**Response**:
```json
{
  "success": true,
  "message": "Visit approved and added to approved properties",
  "visit": { /* updated visit */ },
  "approvedProperty": { /* new approved property */ }
}
```

**Status Code**: 200 OK

---

### 8. **POST** `/api/visits/:visitId/reject`
**Purpose**: Reject a visit
**Called From**: `superadmin/enquiry-db.html` (reject button)

**Request Body**:
```json
{
  "approvalNotes": "reason for rejection",
  "approvedBy": "admin name"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Visit rejected",
  "visit": { /* updated visit with status: rejected */ }
}
```

**Status Code**: 200 OK

---

### 9. **DELETE** `/api/visits/:visitId`
**Purpose**: Delete a visit completely
**Called From**: (Admin delete action)

**Response**:
```json
{
  "success": true,
  "message": "Visit deleted successfully",
  "visit": { /* deleted visit */ }
}
```

**Status Code**: 200 OK

---

## 🏠 APPROVED PROPERTY ENDPOINTS
**Base Path**: `/api/approved-properties`

### 1. **GET** `/api/approved-properties/all`
**Purpose**: Get all approved properties
**Called From**: (Admin reporting)

**Response**:
```json
{
  "success": true,
  "count": 10,
  "properties": [ /* all approved */ ]
}
```

---

### 2. **GET** `/api/approved-properties/website/live`
**Purpose**: Get properties for website display
**Called From**: `website/index-db.html`

**Filters**: Only returns properties with `isLiveOnWebsite = true`

**Response**:
```json
{
  "success": true,
  "count": 5,
  "properties": [
    {
      "propertyId": "...",
      "propertyName": "...",
      "city": "...",
      "monthlyRent": 15000,
      "photos": ["base64..."],
      ...
    }
  ]
}
```

---

### 3. **GET** `/api/approved-properties/ourproperty/live`
**Purpose**: Get properties for ourproperty display
**Called From**: `ourproperty/index-db.html`

**Filters**: Only returns properties with `isLiveOnOurProperty = true`

**Response**: Same as `/website/live`

---

### 4. **GET** `/api/approved-properties/city/:city`
**Purpose**: Get properties for website by city
**Called From**: `website/index-db.html` (city filter)

**URL Param**: `city` - City name

**Response**:
```json
{
  "success": true,
  "count": 3,
  "properties": [ /* properties in that city */ ]
}
```

---

### 5. **GET** `/api/approved-properties/:propertyId`
**Purpose**: Get single property details
**Called From**: Frontend modals

**Response**:
```json
{
  "success": true,
  "property": { /* full property */ }
}
```

---

### 6. **PUT** `/api/approved-properties/:propertyId/toggle-website`
**Purpose**: Toggle property visibility on website
**Called From**: Admin action (future feature)

**What it does**: Flips `isLiveOnWebsite` boolean

**Response**:
```json
{
  "success": true,
  "message": "Property visibility on website toggled to true",
  "property": { /* updated */ }
}
```

---

### 7. **PUT** `/api/approved-properties/:propertyId/toggle-ourproperty`
**Purpose**: Toggle property visibility on ourproperty
**Called From**: Admin action (future feature)

**What it does**: Flips `isLiveOnOurProperty` boolean

**Response**:
```json
{
  "success": true,
  "message": "Property visibility on ourproperty toggled to true",
  "property": { /* updated */ }
}
```

---

### 8. **DELETE** `/api/approved-properties/:propertyId`
**Purpose**: Delete approved property
**Called From**: Admin delete action

**Response**:
```json
{
  "success": true,
  "message": "Property deleted successfully",
  "property": { /* deleted */ }
}
```

---

## 🔥 Most Important Endpoints

### For Visitors
```
POST /api/visits/submit
```
User submits a property visit here.

### For Admin
```
GET  /api/visits/pending
POST /api/visits/:id/approve
POST /api/visits/:id/reject
```
Admin gets pending visits, then approves or rejects.

### For Public
```
GET /api/approved-properties/website/live
GET /api/approved-properties/city/:city
```
Website fetches approved properties to display.

### For Owners
```
GET /api/approved-properties/ourproperty/live
```
Owner view fetches their approved properties.

---

## 🔀 Data Flow Through APIs

```
1. User visits website/visit.html
   └─► POST /api/visits/submit
       └─► Data saved to VisitData collection (status: submitted)

2. Admin opens superadmin/enquiry-db.html
   └─► GET /api/visits/pending
       └─► Shows list of unreviewed visits

3. Admin clicks View Details
   └─► GET /api/visits/:visitId
       └─► Shows full details in modal

4. Admin clicks Approve
   └─► POST /api/visits/:visitId/approve
       └─► Updates VisitData (status: approved)
       └─► Creates entry in ApprovedProperty

5. User opens website/index-db.html
   └─► GET /api/approved-properties/website/live
       └─► Fetches and displays all approved properties

6. Owner opens ourproperty/index-db.html
   └─► GET /api/approved-properties/ourproperty/live
       └─► Fetches and displays their properties
```

---

## 📝 Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "message": "Error description here",
  "error": "detailed error"
}
```

**Common HTTP Status Codes**:
- `200` - Success
- `201` - Created
- `400` - Bad request (missing fields)
- `404` - Not found
- `500` - Server error

---

## 💡 Usage Examples

### Example 1: Submit Visit
```javascript
fetch('http://localhost:5000/api/visits/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    visitorName: 'John Doe',
    visitorEmail: 'john@example.com',
    propertyName: 'Apartment',
    city: 'Chennai',
    ownerName: 'Owner',
    ownerEmail: 'owner@example.com',
    photos: ['base64image...']
  })
})
```

### Example 2: Get Pending Visits
```javascript
fetch('http://localhost:5000/api/visits/pending')
  .then(res => res.json())
  .then(data => console.log(data.visits))
```

### Example 3: Approve Visit
```javascript
fetch('http://localhost:5000/api/visits/abc123/approve', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    approvalNotes: 'Property looks good',
    approvedBy: 'Admin1'
  })
})
```

### Example 4: Get Website Properties
```javascript
fetch('http://localhost:5000/api/approved-properties/website/live')
  .then(res => res.json())
  .then(data => console.log(data.properties))
```

---

## 🎯 Endpoint Summary Table

| Method | Path | Purpose | Called By |
|--------|------|---------|-----------|
| POST | `/api/visits/submit` | Submit visit | website/visit.html |
| GET | `/api/visits/pending` | Get pending | enquiry-db.html |
| POST | `/api/visits/:id/approve` | Approve visit | enquiry-db.html |
| GET | `/api/approved-properties/website/live` | Website display | website/index-db.html |
| GET | `/api/approved-properties/ourproperty/live` | Owner display | ourproperty/index-db.html |

---

**Total Endpoints**: 17 (9 visit + 8 property)
**Status**: ✅ All working and integrated
