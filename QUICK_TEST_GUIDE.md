# Quick Test Guide - Visit Submission & Approval Flow

## 🚀 Testing the Fix

### Prerequisites
- Backend running at `http://localhost:5000`
- MongoDB running locally
- Browser with Developer Tools open (F12)

---

## Test 1: Submit a Visit Report

### Step 1: Open Area Manager Portal
```
File: Areamanager/visit.html
URL: file:///path/to/Areamanager/visit.html
```

### Step 2: Create a New Visit
1. Click "+ New Report" button
2. Fill in these required fields:
   - Property Type: "PG" (or any type)
   - Property Name: "Test Property"
   - Owner Name: "Test Owner"
   - Owner Email: "owner@example.com"
   - Contact Phone: "9999999999"
   - City: "Pune"
   - Area: "Hinjawadi"
   - Monthly Rent: "10000"

### Step 3: Watch Console Logs
Open Browser DevTools (F12) → Console tab

**Expected logs when you click "Save":**
```
📝 [submitVisit] Received visit data with _id: v_1705684923456
✅ [submitVisit] Visit created successfully with _id: v_1705684923456
Status: created
```

### Step 4: Check Backend Logs
Look at the terminal where server is running:
```
📝 [submitVisit] Received visit data with _id: v_1705684923456
📝 [submitVisit] Setting status to: submitted
✅ [submitVisit] Visit created successfully with _id: v_1705684923456
📧 Enquiry notification email sent successfully
```

**✅ SUCCESS**: You should see all these logs = Visit is in database!

---

## Test 2: Approve the Visit

### Step 1: Open Super Admin Enquiry Page
```
File: superadmin/enquiry.html
```

### Step 2: View Pending Visits
The page should automatically load and show your submitted visit in the table:
```
Status: submitted
Property: Test Property
Owner: Test Owner
```

### Step 3: Click Approve Button
On the row, click the ✅ Green Checkmark

A dialog should appear asking:
```
"Do you want to upload this property to the website?"
```

### Step 4: Click "Yes, Upload" or "No, Keep Offline"
Either option should work for this test

### Step 5: Watch Browser Console
**Expected logs:**
```
confirmApproval called { shouldUpload: true/false, currentApprovingId: "v_1705684923456" }
🔄 fetchEnquiries() called
📋 Rendering 1/1 visits to table
✅ Visit approved and synced to backend: { success: true, message: "Visit approved successfully", ... }
```

### Step 6: Check Backend Logs
**Expected logs in terminal:**
```
📝 [approveVisit] Starting approval for visitId: v_1705684923456
🔍 [approveVisit] Updating visit status to approved
🔎 [approveVisit] Search result - Visit found: true
✅ [approveVisit] Visit updated successfully
```

**✅ SUCCESS**: Shows "Visit found: true" = Approval worked!

---

## 🐛 Troubleshooting

### Issue 1: "Visit not found" on Approval
```
❌ [approveVisit] Visit not found with id: v_1705684923456
```

**Solutions:**
1. Check if Submit logs show visit was created
2. Check MongoDB is running
3. Check browser console for submit errors
4. Try submitting again

### Issue 2: No logs appear in backend terminal
```
Problem: Terminal shows nothing when you click Save
```

**Solutions:**
1. Is backend running? Check for "Server running on port 5000"
2. Is the fetch request reaching the backend?
   - Open DevTools → Network tab
   - Look for `POST /api/visits/submit`
   - Status should be 201 if successful

### Issue 3: CORS Error in Console
```
❌ Access to XMLHttpRequest at 'http://localhost:5000/api/visits/submit'
from origin 'file://' has been blocked by CORS policy
```

**Solution:**
- This is expected when opening HTML files locally
- The backend returns 500 error
- Use a local server instead:
  ```bash
  cd website
  npython -m http.server 8000
  # Then visit http://localhost:8000/Areamanager/visit.html
  ```

---

## 📊 Database Verification

### Check if visits are in MongoDB

### Method 1: Using MongoDB Compass
1. Connect to: `mongodb://localhost:27017`
2. Database: `roomhy`
3. Collection: `visitreports`
4. Should see your submitted visits there

### Method 2: Using CLI
```bash
# Open MongoDB shell
mongosh

# Switch to database
use roomhy

# Check how many visits exist
db.visitreports.countDocuments()

# See all visits
db.visitreports.find().pretty()

# See only submitted visits
db.visitreports.find({status: "submitted"}).pretty()

# See only approved visits
db.visitreports.find({status: "approved"}).pretty()
```

---

## ✅ Verification Checklist

After running these tests, verify:

- [ ] Submit logs appear in browser console
- [ ] Submit logs appear in backend terminal
- [ ] MongoDB shows new visit in database
- [ ] Super Admin page shows "submitted" visit in table
- [ ] Approval logs show "Visit found: true"
- [ ] No 500 errors in browser or backend
- [ ] MongoDB shows visit with status: "approved"

---

## 📋 Key Endpoints Being Tested

| Endpoint | Method | Purpose | Expected Status |
|----------|--------|---------|-----------------|
| `/api/visits/submit` | POST | Submit a new visit | 201 |
| `/api/visits/pending` | GET | Get all pending visits | 200 |
| `/api/visits/approve` | POST | Approve a visit | 200 |
| `/api/visits/hold` | POST | Put visit on hold | 200 |
| `/api/visits/reject` | POST | Reject a visit | 200 |

---

## 💡 Tips

1. **Don't refresh the page** during approval - it may interrupt the process
2. **Keep backend terminal visible** to see logs in real-time
3. **Clear browser cache** (Ctrl+Shift+Delete) if you see old data
4. **Use DevTools Network tab** to inspect actual request/response bodies
5. **Check email logs** - approval should send email to owner (check SMTP_USER in .env)

---

## 🎯 Success Indicators

### ✅ Submission Successful When:
- Browser console shows ✅ messages
- Backend terminal shows "Visit created successfully"
- MongoDB shows new document with `status: "submitted"`

### ✅ Approval Successful When:
- Backend terminal shows "Visit found: true"
- Backend terminal shows "Visit updated successfully"
- MongoDB shows same document with `status: "approved"`
- Credentials appear in the success popup
- No 500 or 404 errors

---

*Test Guide Generated: Jan 20, 2026*
*Updated Error Handling in: visitController.js*
