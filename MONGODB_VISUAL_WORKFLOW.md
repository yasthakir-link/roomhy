# MongoDB Integration - Visual Workflow Guide

## Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                        ROOMHY PROPERTY MANAGEMENT SYSTEM                           │
│                          MongoDB Integration Flow                                   │
└─────────────────────────────────────────────────────────────────────────────────────┘

1️⃣  VISIT SUBMISSION & DISPLAY
═══════════════════════════════════════════════════════════════════════════════════════

   User fills form → Uploads photos → Submits visit
   │
   ▼
   POST /api/visits/submit
   │
   ▼
   ┌─────────────────────┐
   │   MongoDB Atlas     │
   │  VisitData Table    │
   │ ✅ visitId          │
   │ ✅ visitorName      │
   │ ✅ propertyName     │
   │ ✅ city             │
   │ ✅ photos (base64)  │
   │ ✅ status           │
   │ ✅ createdAt        │
   └─────────────────────┘
   │
   ▼
   GET /api/visits/all → Fetch all visits
   │
   ▼
   Display in Card Grid with:
   ├─ Property photo
   ├─ Property name & city
   ├─ Visitor info
   ├─ Status badge (submitted/approved/rejected)
   └─ "View Details" button

   📍 Location: website/visit.html


2️⃣  ENQUIRY APPROVAL WORKFLOW
═══════════════════════════════════════════════════════════════════════════════════════

   Page Loads → GET /api/website-enquiries/all
   │
   ▼
   ┌──────────────────────────────────────┐
   │  Display Enquiries by Status Tabs    │
   ├──────────────────────────────────────┤
   │ ✓ Pending Enquiries                  │
   │ ✓ For Approval                       │
   │ ✓ Approved                           │
   │ ✓ All Enquiries (searchable table)   │
   └──────────────────────────────────────┘
   │
   ▼
   User clicks "Approve" button
   │
   ▼
   ┌───────────────────────────────────────────┐
   │      APPROVAL MODAL OPENS                 │
   ├───────────────────────────────────────────┤
   │ Property: Summer Apartment                │
   │ Owner: John Smith                         │
   │ City: Bangalore                           │
   │ Rent: ₹25,000                             │
   │                                           │
   │ Approval Notes: _______________          │
   │ Assigned To: ________________             │
   │ Assigned Area: ________________           │
   │                                           │
   │ [Approve] [Cancel] [Reject]              │
   └───────────────────────────────────────────┘
   │
   ▼
   PUT /api/website-enquiries/:id
   Body: {
     status: "assigned",
     notes: "User's notes",
     assigned_to: "Area Manager Name",
     assigned_area: "Whitefield",
     assigned_date: new Date()
   }
   │
   ▼
   ┌─────────────────────────────┐
   │   MongoDB Atlas             │
   │ WebsiteEnquiry Collection   │
   │ ✅ status → "assigned"      │
   │ ✅ assigned_to stored       │
   │ ✅ assigned_area stored     │
   │ ✅ notes stored             │
   │ ✅ assigned_date stored     │
   │ ✅ updated_at refreshed     │
   └─────────────────────────────┘
   │
   ▼
   Enquiry moves to "Approved" tab
   GET /api/website-enquiries/by-status/assigned
   │
   ▼
   Display in separate tab/view with approval metadata

   📍 Location: website/enquiry.html


3️⃣  WEBSITE PROPERTIES - FETCH & STORE
═══════════════════════════════════════════════════════════════════════════════════════

   Page Loads → GET /api/website-properties/all
   │
   ▼
   ┌──────────────────────────────────────┐
   │  Display Properties in Grid          │
   ├──────────────────────────────────────┤
   │ Card 1: Modern Studio, ₹20,000       │
   │ Card 2: Cozy Apartment, ₹25,000      │
   │ Card 3: Family Home, ₹35,000         │
   │ ...                                  │
   └──────────────────────────────────────┘
   │
   ▼
   Apply Filters:
   ├─ City dropdown
   ├─ Property type dropdown
   ├─ Price range slider
   └─ Search box
   │
   ▼
   Display filtered results
   │
   ▼
   User clicks "+ Submit Property"
   │
   ▼
   ┌────────────────────────────────────────┐
   │      SUBMIT PROPERTY MODAL             │
   ├────────────────────────────────────────┤
   │ Property Name: __________________      │
   │ Property Type: ▼ (dropdown)            │
   │ City: ________________________          │
   │ Rent: ________________________          │
   │ Owner Name: ___________________        │
   │ Owner Phone: __________________        │
   │                                        │
   │ [Submit] [Cancel]                      │
   └────────────────────────────────────────┘
   │
   ▼
   POST /api/website-properties/add
   Body: {
     property_type: "apartment",
     property_name: "Sunset View",
     city: "Bangalore",
     rent: 30000,
     owner_name: "Alice Johnson",
     owner_phone: "9876543210",
     ...
   }
   │
   ▼
   ┌───────────────────────────────────┐
   │   MongoDB Atlas                   │
   │ WebsiteProperty Collection        │
   │ ✅ property_id (generated)        │
   │ ✅ property_name saved            │
   │ ✅ city saved                     │
   │ ✅ rent saved                     │
   │ ✅ owner_name saved               │
   │ ✅ status: "active"               │
   │ ✅ created_at timestamp           │
   └───────────────────────────────────┘
   │
   ▼
   New property appears in list immediately
   Show success message to user

   📍 Location: website/website.html


4️⃣  OUR PROPERTY - FETCH & DISPLAY
═══════════════════════════════════════════════════════════════════════════════════════

   Page Loads → GET /api/visits/public/approved
   │
   ▼
   ┌─────────────────────────────────────┐
   │  Apply Query Filters                │
   ├─────────────────────────────────────┤
   │ ?city=Bangalore                     │
   │ ?area=Koramangala                   │
   │ ?gender=any                         │
   │ ?minPrice=10000&maxPrice=50000      │
   │ ?propertyType=apartment             │
   └─────────────────────────────────────┘
   │
   ▼
   Backend filters MongoDB data:
   - Find where status = "approved"
   - Match city filter
   - Match price range
   - Match property type
   - Match gender suitability
   │
   ▼
   ┌────────────────────────────────────────┐
   │   MongoDB Atlas                        │
   │ VisitData Collection (filtered)        │
   │ Only records with status='approved'    │
   └────────────────────────────────────────┘
   │
   ▼
   Return filtered properties to frontend
   │
   ▼
   Display in Property Cards:
   ├─ Professional photos carousel
   ├─ Property name & type
   ├─ City & area location
   ├─ Monthly rent with badge
   ├─ Rating & reviews
   ├─ Amenities
   └─ "Bid Now" button
   │
   ▼
   User interactions:
   ├─ Change city filter → Re-fetch & display
   ├─ Change price range → Filter client-side
   ├─ Search property → Filter client-side
   └─ Click Bid Now → Navigate to property details

   📍 Location: website/ourproperty.html


MONGODB COLLECTIONS STRUCTURE
═════════════════════════════════════════════════════════════════════════════════════

┌─ VisitData Collection ────────────────────────────────────────────────────────────┐
│ Used by: visit.html, ourproperty.html                                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│ {                                                                               │
│   "_id": ObjectId,                                                              │
│   "visitId": "1611220000000_abc123",                                            │
│   "visitorName": "John Doe",                                                    │
│   "visitorEmail": "john@email.com",                                             │
│   "visitorPhone": "9876543210",                                                 │
│   "propertyName": "Sunset Apartment",                                           │
│   "propertyType": "apartment",                                                  │
│   "city": "Bangalore",                                                          │
│   "area": "Koramangala",                                                        │
│   "address": "123 Main Street",                                                 │
│   "monthlyRent": 25000,                                                         │
│   "genderSuitability": "any",                                                   │
│   "ownerName": "Alice",                                                         │
│   "ownerPhone": "9988776655",                                                   │
│   "photos": ["base64_photo_1", "base64_photo_2"],                              │
│   "professionalPhotos": ["base64_pro_photo_1"],                                │
│   "status": "approved",                           ← for ourproperty.html       │
│   "approvedAt": ISODate("2025-01-21T12:00:00Z"),                               │
│   "createdAt": ISODate("2025-01-21T10:00:00Z"),                                │
│   "updatedAt": ISODate("2025-01-21T12:00:00Z")                                 │
│ }                                                                               │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─ WebsiteEnquiry Collection ───────────────────────────────────────────────────────┐
│ Used by: enquiry.html                                                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│ {                                                                               │
│   "_id": ObjectId,                                                              │
│   "enquiry_id": "1611220000000_xyz789",                                         │
│   "property_type": "apartment",                                                 │
│   "property_name": "Modern Studio",                                             │
│   "city": "Bangalore",                                                          │
│   "locality": "Whitefield",                                                     │
│   "address": "456 Tech Park",                                                   │
│   "rent": 22000,                                                                │
│   "owner_name": "Bob",                                                          │
│   "owner_phone": "9966554433",                                                  │
│   "status": "assigned",              ← Updated after approval                  │
│   "assigned_to": "Raj Kumar",         ← Stored on approval                     │
│   "assigned_area": "Whitefield",      ← Stored on approval                     │
│   "assigned_date": ISODate("2025-01-21T12:05:00Z"),  ← Stored on approval     │
│   "notes": "Property verified and ready",  ← Stored on approval               │
│   "photos": ["base64_photo_1"],                                                 │
│   "created_at": ISODate("2025-01-21T10:00:00Z"),                               │
│   "updated_at": ISODate("2025-01-21T12:05:00Z")                                │
│ }                                                                               │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─ WebsiteProperty Collection ──────────────────────────────────────────────────────┐
│ Used by: website.html                                                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│ {                                                                               │
│   "_id": ObjectId,                                                              │
│   "property_id": "1611220000000_prop456",                                       │
│   "property_type": "apartment",                                                 │
│   "property_name": "Luxury Penthouse",                                          │
│   "city": "Bangalore",                                                          │
│   "locality": "Indiranagar",                                                    │
│   "address": "789 Sky Tower",                                                   │
│   "rent": 40000,                                                                │
│   "deposit": "2 months",                                                        │
│   "owner_name": "Charlie",                                                      │
│   "owner_email": "charlie@email.com",                                           │
│   "owner_phone": "9944332211",                                                  │
│   "photos": ["base64_photo_1", "base64_photo_2"],                              │
│   "description": "Modern luxury apartment with amenities",                       │
│   "amenities": ["WiFi", "AC", "Parking", "Gym"],                               │
│   "status": "active",                                                           │
│   "created_at": ISODate("2025-01-21T10:00:00Z"),                               │
│   "updated_at": ISODate("2025-01-21T10:00:00Z")                                │
│ }                                                                               │
└─────────────────────────────────────────────────────────────────────────────────┘


APPROVAL STATUS JOURNEY
═════════════════════════════════════════════════════════════════════════════════════

WebsiteEnquiry Status Flow:

  "pending"  ────→  "assigned"  ────→  "accepted"  ────→  "completed"
    │                  │                  │                  │
    │                  │                  │                  │
    └──────────────────┴──────────────────┴──────────────────┘
              (any status can be rejected)
                        │
                        ▼
                    "rejected"

Status Change Points:
- pending    : Initial enquiry submission
- assigned   : Admin approves and assigns area/manager
- accepted   : Property owner accepts the booking
- completed  : Booking completed successfully
- rejected   : Rejected by admin or property owner


KEY STORED DATA ON APPROVAL (enquiry.html)
═════════════════════════════════════════════════════════════════════════════════════

When user clicks "Approve" in enquiry.html, this data is stored in MongoDB:

{
  "_id": "...",
  "status": "assigned",                    ← Changed from "pending"
  "notes": "[User's approval notes]",      ← What admin wrote
  "assigned_to": "[Manager Name]",         ← Who it's assigned to
  "assigned_area": "[Area Name]",          ← Which area
  "assigned_date": "2025-01-21T12:05Z",    ← When it was approved
  "updated_at": "2025-01-21T12:05Z"        ← Timestamp
}

This data persists in MongoDB and can be viewed in:
- Approved tab
- All Enquiries table
- MongoDB Atlas dashboard


BROWSER CONSOLE DEBUG INFO
═════════════════════════════════════════════════════════════════════════════════════

To verify data flow, open browser console (F12) and check:

visit.html:
  console.log("API Response:", result);  // Shows submitted visit data

enquiry.html:
  console.log("Fetched enquiries:", result.enquiries);  // Shows all enquiries
  console.log("Approval submitted", response.json());   // Shows update response

website.html:
  console.log("Properties loaded", result.properties);  // Shows all properties
  console.log("New property added", result.property);   // Shows new property

ourproperty.html:
  console.log("Filtered properties:", visits);  // Shows filtered results
```

---

## Testing with Browser DevTools

### Network Tab (F12 > Network)
1. **POST requests should show 201 Created** - For new submissions
2. **PUT requests should show 200 OK** - For approvals/updates
3. **GET requests should show 200 OK** - For fetching data
4. **Response body should contain:** success: true, data: {...}

### Console Tab (F12 > Console)
1. Check for any errors (red messages)
2. Look for console.log outputs showing data
3. No CORS errors should appear

### Application Tab (F12 > Application)
1. Under Storage > Local Storage, you should see visited page URLs
2. MongoDB data persists across page reloads

---

## Success Indicators Checklist

- [ ] visit.html form submits successfully
- [ ] Submitted visits appear in MongoDB VisitData collection
- [ ] Visit display tab shows cards with correct data
- [ ] enquiry.html loads pending enquiries
- [ ] Approval modal opens with all fields
- [ ] Clicking approve updates MongoDB with assigned_to, assigned_area, notes
- [ ] Approved enquiries appear in "Approved" tab
- [ ] website.html loads properties in grid
- [ ] Filters (city, type, price) work correctly
- [ ] Submit property modal works and stores data
- [ ] ourproperty.html displays approved properties
- [ ] All filters work on ourproperty.html
- [ ] No console errors in browser
- [ ] No errors in backend terminal

---

**🎉 You now have a complete MongoDB-integrated property management system!**
