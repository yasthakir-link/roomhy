# 🗺️ Complete System Architecture & File Map

## 📊 System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      ROOMHY PROPERTY SYSTEM                      │
│                   3-Stage Approval Workflow                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────┐
│   STAGE 1: INPUT    │
├─────────────────────┤
│  website/           │
│  └─ visit.html      │◄──── Visitor fills form
│                     │      + uploads photos
│  └─ Sends POST      │
└──────────┬──────────┘
           │
           │ POST /api/visits/submit
           │
           ▼
┌──────────────────────────┐
│ roomhy-backend/models/   │
│ └─ VisitData.js          │
│ (MongoDB Schema)         │
│                          │
│ 📦 VisitData Collection  │
│ • visitId                │
│ • visitorInfo            │
│ • propertyInfo           │
│ • photos (base64)        │
│ • status: submitted      │
│ • timestamps             │
└──────────┬───────────────┘
           │
           │ GET /api/visits/pending
           │
           ▼
┌──────────────────────┐
│   STAGE 2: REVIEW    │
├──────────────────────┤
│ superadmin/          │
│ └─ enquiry-db.html   │◄──── Admin reviews visits
│                      │      in modal view
│ Shows:               │
│ • Property details   │
│ • Photos carousel    │
│ • Visitor info       │
│ • Approval buttons   │
└──────────┬───────────┘
           │
           │ POST /api/visits/:id/approve
           │
           ▼
┌──────────────────────────────────┐
│ roomhy-backend/models/           │
│ └─ ApprovedProperty.js           │
│ (MongoDB Schema)                 │
│                                  │
│ 📦 ApprovedProperty Collection   │
│ • propertyId                     │
│ • visitDataId (link to original) │
│ • all property details           │
│ • isLiveOnWebsite: true          │
│ • isLiveOnOurProperty: true      │
│ • approvalInfo & timestamps      │
└──────────┬──────────────┬────────┘
           │              │
           │ GET /web     │ GET /our
           │              │
           ▼              ▼
┌──────────────────────────────────┐
│      STAGE 3: DISPLAY            │
├──────────────────────────────────┤
│ website/index-db.html            │ ourproperty/index-db.html
│ ◄─── Public sees approved        │ ◄─── Owners see their
│      properties                  │      approved properties
│                                  │
│ Features:                        │ Features:
│ • Property grid                  │ • Property grid
│ • Photo carousel                 │ • Photo carousel
│ • City filter                    │ • Owner filter
│ • Type filter                    │ • Type filter
│ • Details modal                  │ • Details modal
│ • Owner contact                  │ • Owner contact
└──────────────────────────────────┘
```

---

## 📁 Complete File Tree

```
c:\Users\yasmi\OneDrive\Desktop\roomhy final\
│
├─ 📄 QUICK_START.md ......................... Quick reference guide
├─ 📄 COMPLETE_MULTI_STAGE_SYSTEM.md ........ Full technical docs
├─ 📄 SYSTEM_READY_TO_USE.md ................ Implementation summary
├─ 📄 API_REFERENCE.md ...................... All 17 endpoints
├─ 📄 FILE_ARCHITECTURE_MAP.md .............. This file
│
├─ 🚀 roomhy-backend\ ........................ Node.js Express Server
│  │
│  ├─ 📄 server.js ......................... Main server (UPDATED)
│  │                                        Routes registered here
│  │
│  ├─ 📂 models\ ........................... MongoDB Schemas
│  │  ├─ ✨ VisitData.js ................... NEW - Stores submissions
│  │  └─ ApprovedProperty.js .............. Already exists (used)
│  │
│  └─ 📂 routes\ ........................... API Endpoints
│     ├─ ✨ visitDataRoutes.js ............ NEW - 9 endpoints
│     │   • POST /submit
│     │   • GET /all, /pending, /approved
│     │   • POST /:id/approve, /reject
│     │   • DELETE /:id
│     │   • PUT /:id/status
│     │
│     ├─ ✨ approvedPropertyRoutes.js ..... NEW - 8 endpoints
│     │   • GET /all, /website/live, /ourproperty/live
│     │   • GET /city/:city
│     │   • GET /:id
│     │   • PUT /:id/toggle-website, /toggle-ourproperty
│     │   • DELETE /:id
│     │
│     └─ (other existing routes)
│
├─ 🌐 website\ ............................... Public website
│  ├─ ✨ visit.html ........................ NEW - Visitor submission form
│  │   • Text inputs for property details
│  │   • Photo upload with preview
│  │   • Form validation
│  │   • Submits to POST /api/visits/submit
│  │
│  └─ ✨ index-db.html .................... NEW - Public property listing
│      • Fetches from GET /api/approved-properties/website/live
│      • Grid of approved properties
│      • Photo carousel for each
│      • City & type filters
│      • Details modal
│      • Owner contact info
│
├─ 👨‍💼 superadmin\ ........................... Admin panel
│  └─ ✨ enquiry-db.html .................. NEW - Admin review interface
│      • Lists pending visits
│      • Modal view for each visit
│      • Shows all property details
│      • Photo carousel
│      • Approve/Reject buttons
│      • Approval notes field
│      • Status filtering
│      • Fetches from GET /api/visits/pending
│      • Calls POST /api/visits/:id/approve
│
└─ 🏢 ourproperty\ .......................... Property owner view
   └─ ✨ index-db.html .................... NEW - Owner property listing
       • Similar to website/index-db.html
       • Fetches from GET /api/approved-properties/ourproperty/live
       • Owner filter instead of city
       • Shows properties filtered by isLiveOnOurProperty
```

---

## 🔗 API Route Mapping

```
FRONTEND CALLS          ROUTE HANDLER            MONGODB
─────────────           ──────────────           ──────

visit.html
└─ POST request ────►  visitDataRoutes.js  ────► VisitData
   (form submit)       /submit                   collection
                       └─ Creates record
                          Status: submitted

enquiry-db.html
├─ GET request ────►   visitDataRoutes.js  ────► VisitData
│  (load pending)      /pending                  collection
│                      └─ Filter status
│
└─ POST request ────►  visitDataRoutes.js  ────► VisitData (update)
   (approve)          /approve                   + ApprovedProperty
                       └─ Update status           (insert)
                       └─ Copy to Approved

website/index-db.html
└─ GET request ────►   approvedPropertyRoutes  ► ApprovedProperty
   (load page)         /website/live            collection
                       └─ Filter isLiveOnWebsite

ourproperty/index-db.html
└─ GET request ────►   approvedPropertyRoutes  ► ApprovedProperty
   (load page)         /ourproperty/live        collection
                       └─ Filter isLiveOnOurProperty
```

---

## 📊 Data Collections & Fields

### VisitData Collection
Used by: `website/visit.html` → `superadmin/enquiry-db.html`

```
visitdata
├─ visitId (unique identifier)
├─ visitorName, visitorEmail, visitorPhone
├─ propertyName, propertyType
├─ city, area, address, pincode
├─ description, amenities
├─ monthlyRent, deposit
├─ genderSuitability
├─ ownerName, ownerEmail, ownerPhone, ownerCity
├─ photos (base64 array)
├─ professionalPhotos (base64 array)
├─ status (submitted|pending_review|approved|rejected)
├─ approvalNotes
├─ approvedBy
├─ submittedAt, approvedAt, updatedAt
└─ _id (MongoDB auto ID)
```

### ApprovedProperty Collection
Used by: `website/index-db.html` and `ourproperty/index-db.html`

```
approvedproperties
├─ propertyId (unique identifier)
├─ visitDataId (reference to VisitData)
├─ propertyName, propertyType
├─ city, area, address, pincode
├─ description, amenities
├─ monthlyRent, deposit
├─ genderSuitability
├─ ownerName, ownerEmail, ownerPhone, ownerCity
├─ photos (base64 array)
├─ professionalPhotos (base64 array)
├─ isLiveOnWebsite (boolean)
├─ isLiveOnOurProperty (boolean)
├─ approvalNotes
├─ approvedBy
├─ submittedAt, approvedAt
└─ _id (MongoDB auto ID)
```

---

## 🔄 Complete Data Journey

```
1. SUBMISSION STAGE
   ┌─────────────────────────┐
   │ website/visit.html      │
   │ User fills form + photos│
   │ Clicks "Submit Visit"   │
   └──────────┬──────────────┘
              │
              │ Form data → Base64 photos
              │ POST /api/visits/submit
              │
              ▼
   ┌─────────────────────────┐
   │ visitDataRoutes.js      │
   │ /submit endpoint        │
   │ └─ Validates data       │
   │ └─ Generates visitId    │
   │ └─ Saves to MongoDB     │
   └──────────┬──────────────┘
              │
              ▼
   ┌─────────────────────────┐
   │ VisitData Collection    │
   │ New record created      │
   │ Status: "submitted"     │
   └─────────────────────────┘
   
   ✅ User sees success message with visitId

2. REVIEW STAGE
   ┌─────────────────────────┐
   │ superadmin/enquiry-db   │
   │ Admin opens page        │
   └──────────┬──────────────┘
              │
              │ GET /api/visits/pending
              │
              ▼
   ┌─────────────────────────┐
   │ visitDataRoutes.js      │
   │ /pending endpoint       │
   │ └─ Query VisitData      │
   │ └─ Filter status        │
   │ └─ Return array         │
   └──────────┬──────────────┘
              │
              ▼
   ┌─────────────────────────┐
   │ enquiry-db.html         │
   │ Shows list of pending   │
   │ Admin clicks View       │
   └──────────┬──────────────┘
              │
              │ Modal loads full visit data
              │ Admin reviews property + photos
              │ Clicks "✓ Approve"
              │
              ▼
   ┌─────────────────────────┐
   │ visitDataRoutes.js      │
   │ /:id/approve endpoint   │
   │ └─ Update VisitData     │
   │    Status → approved    │
   │ └─ Copy to              │
   │    ApprovedProperty     │
   │    with visibility flags│
   └──────────┬──────────────┘
              │
              ▼
   ┌─────────────────────────┐
   │ VisitData: Updated      │
   │ Status: "approved"      │
   │ approvedAt timestamp    │
   │                         │
   │ ApprovedProperty: New   │
   │ isLiveOnWebsite: true   │
   │ isLiveOnOurProperty: tr │
   └─────────────────────────┘
   
   ✅ Admin sees success message

3. DISPLAY STAGE - WEBSITE
   ┌─────────────────────────┐
   │ website/index-db.html   │
   │ Visitor opens page      │
   └──────────┬──────────────┘
              │
              │ GET /api/approved-properties/website/live
              │
              ▼
   ┌─────────────────────────┐
   │ approvedPropertyRoutes  │
   │ /website/live endpoint  │
   │ └─ Query ApprovedProp   │
   │ └─ Filter isLiveOnWeb   │
   │ └─ Return properties    │
   └──────────┬──────────────┘
              │
              ▼
   ┌─────────────────────────┐
   │ index-db.html displays │
   │ Property cards with:    │
   │ • Photo carousel        │
   │ • Property details      │
   │ • City/type filters     │
   │ • Details modal         │
   │ • Owner contact         │
   └─────────────────────────┘
   
   ✅ Website visitor sees approved properties

4. DISPLAY STAGE - OURPROPERTY
   ┌─────────────────────────┐
   │ ourproperty/index-db    │
   │ Owner opens page        │
   └──────────┬──────────────┘
              │
              │ GET /api/approved-properties/ourproperty/live
              │
              ▼
   ┌─────────────────────────┐
   │ approvedPropertyRoutes  │
   │ /ourproperty/live       │
   │ └─ Query ApprovedProp   │
   │ └─ Filter isLiveOnOurPr │
   │ └─ Return properties    │
   └──────────┬──────────────┘
              │
              ▼
   ┌─────────────────────────┐
   │ index-db.html displays │
   │ Property cards         │
   │ (Same as website)      │
   │ + Owner filter         │
   └─────────────────────────┘
   
   ✅ Property owner sees their properties
```

---

## 🎯 Key File Relationships

### visit.html ↔ visitDataRoutes.js
```
visit.html                          visitDataRoutes.js
  ├─ Collects form data             ├─ Receives POST /api/visits/submit
  ├─ Encodes photos to base64       ├─ Validates input
  ├─ Sends POST request             ├─ Creates VisitData record
  └─ Shows success/error            └─ Returns visitId + data
```

### enquiry-db.html ↔ visitDataRoutes.js
```
enquiry-db.html                     visitDataRoutes.js
  ├─ Loads on page open             ├─ Handles GET /api/visits/pending
  ├─ Fetches pending visits         ├─ Queries VisitData collection
  ├─ Displays in list               ├─ Filters by status
  ├─ Modal view on click            ├─ Returns visits array
  ├─ Admin approves/rejects         ├─ Handles POST /:id/approve
  └─ Shows success message          └─ Updates DB + returns result
```

### website/index-db.html ↔ approvedPropertyRoutes.js
```
website/index-db.html               approvedPropertyRoutes.js
  ├─ Loads on page open             ├─ Handles GET /api/approved-properties/website/live
  ├─ Fetches approved properties    ├─ Queries ApprovedProperty collection
  ├─ Filter by city/type            ├─ Filters by isLiveOnWebsite = true
  ├─ Display grid + carousel        ├─ Returns array of properties
  └─ Show details modal             └─ Handles other GET endpoints
```

### ourproperty/index-db.html ↔ approvedPropertyRoutes.js
```
ourproperty/index-db.html           approvedPropertyRoutes.js
  ├─ Loads on page open             ├─ Handles GET /api/approved-properties/ourproperty/live
  ├─ Fetches owner's properties     ├─ Queries ApprovedProperty collection
  ├─ Filter by owner/type           ├─ Filters by isLiveOnOurProperty = true
  ├─ Display grid + carousel        ├─ Returns array of properties
  └─ Show details modal             └─ Handles other GET endpoints
```

---

## 🚀 Server Configuration (server.js)

```javascript
// Lines added/updated for new system:

// New routes registered
app.use('/api/visits', require('./routes/visitDataRoutes'));
app.use('/api/approved-properties', require('./routes/approvedPropertyRoutes'));

// These make the endpoints available at:
// /api/visits/submit
// /api/visits/pending
// /api/visits/:id/approve
// /api/approved-properties/website/live
// /api/approved-properties/ourproperty/live
// ... and 12 more endpoints
```

---

## 📊 Status of All Files

| File | Status | Purpose |
|------|--------|---------|
| roomhy-backend/models/VisitData.js | ✨ NEW | MongoDB schema for submissions |
| roomhy-backend/routes/visitDataRoutes.js | ✨ NEW | 9 API endpoints for visits |
| roomhy-backend/routes/approvedPropertyRoutes.js | ✨ NEW | 8 API endpoints for display |
| roomhy-backend/server.js | ✏️ UPDATED | Routes registered |
| website/visit.html | ✨ NEW | Visitor submission form |
| website/index-db.html | ✨ NEW | Public property listing |
| superadmin/enquiry-db.html | ✨ NEW | Admin review interface |
| ourproperty/index-db.html | ✨ NEW | Property owner view |

---

## ✅ Verification

All connections verified:
- ✅ visit.html → visitDataRoutes.js (/submit)
- ✅ enquiry-db.html → visitDataRoutes.js (/pending, /approve)
- ✅ website/index-db.html → approvedPropertyRoutes.js (/website/live)
- ✅ ourproperty/index-db.html → approvedPropertyRoutes.js (/ourproperty/live)
- ✅ VisitData model created and functional
- ✅ ApprovedProperty model exists and functional
- ✅ All routes registered in server.js
- ✅ MongoDB collections ready

---

**System Architecture**: ✅ Complete
**All Files**: ✅ Created & Connected
**Ready to Deploy**: ✅ YES
