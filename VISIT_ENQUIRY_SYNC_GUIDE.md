# VISIT/ENQUIRY DATA SYNC - DIAGNOSTIC & FIX GUIDE

## Problem Statement
Data added in visit.html (Areamanager) is not showing up in enquiry.html (Superadmin)

## Data Flow Architecture

```
visit.html (Area Manager)
    ↓
[1] Store in localStorage (roomhy_visits)
    ↓
[2] POST to /api/visits/submit
    ↓
MongoDB VisitReport Collection
    ↓
enquiry.html (Super Admin)
[1] GET /api/visits/pending
    ↓
Filter by status: 'submitted'
    ↓
Display in table
```

## Root Causes & Solutions

### **Issue 1: Status Not Set to 'submitted'**

**Symptoms:**
- Data saved but not showing in enquiry.html
- Check MongoDB: status is undefined or different value

**Solution:**
```javascript
// In visitController.js - submitVisit function
visitData.status = 'submitted';  // ← Must be set
visitData.submittedAt = new Date();
visitData.submittedToAdmin = true;
```

**Verification:**
- Open browser console in visit.html
- Submit a visit
- Look for: "Visit data being submitted:" log
- Check status field shows "submitted"

---

### **Issue 2: API Endpoint Not Responding**

**Symptoms:**
- POST /api/visits/submit returns error
- Network tab shows 500 or timeout

**Solution:**
1. Verify route in server.js:
```javascript
app.use('/api/visits', require('./routes/visitRoutes'));
```

2. Verify route in visitRoutes.js:
```javascript
router.post('/submit', visitController.submitVisit);
```

3. Check controller exists:
```javascript
exports.submitVisit = async (req, res) => { ... }
```

**Test Endpoint:**
```bash
curl -X POST http://localhost:5000/api/visits/submit \
  -H "Content-Type: application/json" \
  -d '{"_id":"test_123","status":"submitted","propertyInfo":{"name":"Test"}}'
```

---

### **Issue 3: Enquiry.html Calling Wrong Endpoint**

**Current Code (enquiry.html line 267):**
```javascript
const apiUrl = API_URL + '/api/visits/pending';
```

**Should Be:**
```javascript
const apiUrl = API_URL + '/api/visits/pending';  // ← CORRECT
// NOT: /api/admin/visits or /api/visits/list
```

**Verification:**
- Open browser DevTools Network tab
- Click "Refresh" button in enquiry.html
- Look for GET request to `/api/visits/pending`
- Check response status: should be 200
- Check response includes array of visits

---

### **Issue 4: Status Filter Too Strict**

**Current Filter (enquiry.html line 313):**
```javascript
const filtered = visits.filter(v => {
    const hasStatus = ['pending', 'submitted'].includes(v.status);
    return hasStatus;
});
```

**Check:**
- Should accept both 'pending' and 'submitted'
- If status is undefined, won't show
- If status is typo like 'Submitted' (capital), won't show

**Fix:**
```javascript
const filtered = visits.filter(v => {
    // Accept various status values
    const acceptedStatuses = ['pending', 'submitted', 'Submitted'];
    const hasStatus = acceptedStatuses.includes(v.status);
    if (!hasStatus && v._id) {
        console.warn('Skipped visit:', v._id, 'Status:', v.status);
    }
    return hasStatus;
});
```

---

## Step-by-Step Troubleshooting

### Step 1: Check Backend is Running
```bash
# Terminal: Is node running?
Get-Process node
# Should show: node.exe running

# Check port 5000
netstat -ano | findstr :5000
```

### Step 2: Verify Data Saved to MongoDB
```javascript
// In browser console (anywhere on site):
db.visitreports.find({ status: 'submitted' }).count()
// Should show > 0 if data exists
```

**OR** Check in MongoDB Compass:
1. Connect to MongoDB
2. Select database: "test" or "roomhy"
3. Collection: "visitreports"
4. Filter: `{ "status": "submitted" }`
5. Should show submitted visits

### Step 3: Test API Directly
Open browser console and run:
```javascript
fetch('http://localhost:5000/api/visits/pending')
    .then(r => r.json())
    .then(d => console.log('Response:', d));
```

Expected response:
```javascript
{
    success: true,
    visits: [ /* array of visits */ ],
    count: 5
}
```

### Step 4: Check Visit Data Structure
Submit a test visit from visit.html and check:
1. Open DevTools → Storage → LocalStorage → website
2. Key: `roomhy_visits`
3. Check if saved visit has:
   - `_id`: some value
   - `status`: "submitted"
   - `propertyInfo`: { name: ..., ownerName: ... }
   - `submittedBy`: area manager name
   - `submittedAt`: timestamp

### Step 5: Check Console Logs

**In visit.html (submit action):**
Look for these logs in order:
```
✓ "📋 Form submission started. Mode: create"
✓ "📸 Photo validation. New mandatory: 4"
✓ "📝 New visit created: v_TIMESTAMP"
✓ "💾 Attempting to save visit to backend..."
✓ "✅ Visit saved to backend database"
✓ "📝 Backend response: { success: true, report: { _id, status: 'submitted' } }"
```

**If missing any**, check previous logs for errors.

**In enquiry.html (load action):**
Look for these logs:
```
✓ "🔄 fetchEnquiries() called"
✓ "🔗 Fetching from API: http://localhost:5000/api/visits/pending"
✓ "📡 API response: { success: true, visits: [ ... ] }"
✓ "✅ Loaded from API: 5 visits"
✓ "? Filtered to pending/submitted: 5 visits"
✓ "📋 Rendering 5 visits to table"
```

If shows:
```
"⚠️ No pending visits found"
```
Then check why filtered array is empty.

---

## Quick Fix Checklist

- [ ] **Backend Running**: `npm start` in roomhy-backend folder
- [ ] **Port 5000 Free**: No other process using it
- [ ] **MongoDB Connected**: Check backend logs show "MongoDB Connected"
- [ ] **Status Set**: visitController sets `status = 'submitted'`
- [ ] **Route Exists**: `/api/visits/submit` POST route exists
- [ ] **Route Registered**: server.js includes visit routes
- [ ] **API Called**: enquiry.html calls `/api/visits/pending`
- [ ] **Filter Correct**: Checks for 'submitted' status
- [ ] **Response Format**: API returns `{ success, visits, count }`
- [ ] **Console Logs**: Check browser DevTools console for errors

---

## Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `ECONNREFUSED` | Backend not running | Run `npm start` |
| `ERR_NAME_NOT_RESOLVED` | Wrong API URL | Check API_URL in file |
| `404 Not Found` | Wrong endpoint path | Verify `/api/visits/pending` exists |
| `500 Server Error` | Controller error | Check backend console logs |
| `No pending visits found` | Status not 'submitted' OR empty collection | Check MongoDB data |
| `Table shows no data` | Filter too strict | Add logging to filter |

---

## Testing Flow

### Test 1: Direct API Call
```javascript
// Run in browser console
fetch('http://localhost:5000/api/visits/pending', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
})
.then(r => r.json())
.then(data => {
    console.log('Total visits:', data.visits?.length || 0);
    if (data.visits?.length > 0) {
        console.log('First visit:', data.visits[0]);
    }
});
```

### Test 2: Full Submission & Retrieval
1. Open visit.html
2. Submit a new visit
3. Check console logs
4. Open enquiry.html
5. Click "Refresh"
6. Check if new visit appears

### Test 3: MongoDB Query
```bash
# In MongoDB Shell
use test
db.visitreports.find({ status: 'submitted' }).pretty()
# Should show all submitted visits
```

---

## Performance Optimization

If data appears but slowly:

1. **Add Indexes** to MongoDB:
```javascript
db.visitreports.createIndex({ status: 1, submittedAt: -1 })
db.visitreports.createIndex({ submittedById: 1 })
```

2. **Optimize Query** in getPendingVisits:
```javascript
// Already sorted by submittedAt descending
.sort({ submittedAt: -1 })
.lean()  // Faster than regular query
```

3. **Limit Results** in enquiry.html:
```javascript
// Add pagination for large datasets
const pageSize = 50;
const filtered = visits.slice(0, pageSize);
```

---

## Logs to Enable Debugging

### In Backend (server.js)
Add request logging:
```javascript
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});
```

### In Frontend (visit.html & enquiry.html)
Already has comprehensive logging - check browser console

---

## Next Steps if Problem Persists

1. **Check Backend Logs**: Run `npm start` and watch for errors
2. **Check Browser Console**: Look for red error messages
3. **Check Network Tab**: Verify API calls and responses
4. **Check MongoDB**: Verify data is actually saved with status: 'submitted'
5. **Check API URL**: Verify `API_URL` matches backend URL
6. **Check Routes**: Verify all routes registered in server.js

---

## Emergency Workaround

If backend sync not working, data is still in localStorage:

**From enquiry.html, use localStorage as fallback:**
```javascript
// In enquiry.html fetchEnquiries() - already implemented
const raw = localStorage.getItem('roomhy_visits');
visits = JSON.parse(raw || '[]');
```

This ensures data shows even if API fails.

---

**Need Help?**
1. Check backend console logs
2. Check browser DevTools console (F12)
3. Check Network tab for API responses
4. Verify MongoDB contains the data

---

*Updated: January 19, 2026*
