# HRMS Testing Guide

This guide provides step-by-step instructions to test all working features of the HRMS application. Follow these workflows to verify that everything is functioning correctly.

## 📋 Table of Contents

1. [Initial Setup](#initial-setup)
2. [Test User Setup](#test-user-setup)
3. [Attendance Workflow](#attendance-workflow)
4. [Regularisation Workflow](#regularisation-workflow)
5. [Leave Management Workflow](#leave-management-workflow)
6. [Manager Portal Workflow](#manager-portal-workflow)
7. [HR/Admin Portal Workflow](#hradmin-portal-workflow)
8. [Policy Library Workflow](#policy-library-workflow)
9. [Announcements Workflow](#announcements-workflow)
10. [Reports & Audit Workflow](#reports--audit-workflow)

---

## Initial Setup

### 1. Start the Application

```bash
# Install dependencies (if not done)
pnpm install

# Start development server
pnpm dev
```

The application will be available at `http://localhost:3000`

### 2. Seed Admin User

```bash
npx tsx scripts/seed-admin.ts
```

**Default Admin Credentials:**
- Email: `admin@company.local`
- Password: `Admin@123`

---

## Test User Setup

### Step 1: Login as Admin

1. Navigate to `http://localhost:3000`
2. Click "Login" or go to `/auth/login`
3. Enter admin credentials:
   - Email: `admin@company.local`
   - Password: `Admin@123`
4. Click "Login"

**Expected Result:** You should be redirected to the dashboard.

### Step 2: Create Test Users

You need to create users with different roles for testing:

#### Create a Manager User

1. Go to **Dashboard** → Click "Create Test User" (or use Employees page)
2. Fill in the form:
   - Name: `Manager One`
   - Email: `manager@company.local`
   - Role: `Manager`
   - Password: `Manager@123`
3. Click "Create"

#### Create an Employee User

1. Create another user:
   - Name: `Employee One`
   - Email: `employee@company.local`
   - Role: `Employee`
   - Password: `Employee@123`

#### Create an HR User

1. Create another user:
   - Name: `HR User`
   - Email: `hr@company.local`
   - Role: `HR`
   - Password: `HR@123`

**Note:** Alternatively, you can use the Employees page (`/employees`) to create users with full employee details.

### Step 3: Set Up Employee-Manager Relationship

1. Stay logged in as Admin
2. Go to **Employees** page (`/employees`)
3. Find "Employee One" and click **Edit**
4. Set **Manager** to "Manager One"
5. Save the changes

**Important:** This relationship is required for:
- Leave approvals
- Regularisation approvals
- Team management features

---

## Attendance Workflow

### How Attendance Works

The attendance system uses a **punch-based** model:
- **Check-In (IN)**: First punch of the day
- **Check-Out (OUT)**: Second punch (after IN)
- Multiple IN/OUT pairs are supported (for breaks)
- Total hours are calculated automatically
- Status is set to "Present" when at least one punch exists

### Test Scenario 1: Basic Attendance Marking

**User:** Employee One (`employee@company.local`)

#### Step 1: Check-In

1. Logout and login as `employee@company.local`
2. Go to **Dashboard** (`/dashboard`)
3. In the "Today's Attendance" card, click **"Check-In / Check-Out"** button
4. You should see a success toast: "Attendance recorded: IN at [time]"

**Expected Result:**
- First punch is recorded as "IN"
- Time is captured
- Status shows "Present"
- Total hours: 0 (until you check out)

#### Step 2: View Attendance

1. Go to **Attendance** page (`/attendance`)
2. You should see today's date with:
   - Status: **Present**
   - In-time: [your check-in time]
   - Out-time: (empty, not checked out yet)
   - Total hours: 0

#### Step 3: Check-Out

1. Go back to **Dashboard**
2. Click **"Check-In / Check-Out"** button again
3. You should see: "Attendance recorded: OUT at [time]"

**Expected Result:**
- Second punch is recorded as "OUT"
- Total hours is calculated (OUT time - IN time)
- Status remains "Present"

#### Step 4: View Complete Attendance

1. Go to **Attendance** page
2. Today's record should show:
   - Status: **Present**
   - In-time: [check-in time]
   - Out-time: [check-out time]
   - Total hours: [calculated hours, e.g., 8.5]

### Test Scenario 2: Multiple Punches (Break Support)

1. After checking out, click the button again to check back in
2. Click again to check out
3. View attendance history - you should see multiple IN/OUT pairs
4. Total hours should be sum of all working periods

### Test Scenario 3: Attendance History

1. Go to **Attendance** page (`/attendance`)
2. Use the **month filter** to view different months
3. You should see:
   - Calendar view with dates
   - Present/Absent status for each day
   - Click on any date to see details
   - Table view showing all attendance records

**Expected Result:**
- Days with attendance show "Present" status
- Days without attendance show "Absent" status
- Clicking a date shows punch details

---

## Regularisation Workflow

### How Regularisation Works

Regularisation is used to **correct missed or incorrect attendance**:
1. Employee submits a regularisation request for a specific date
2. Request goes to their manager for approval
3. Manager approves/rejects with remarks
4. If approved, attendance is automatically updated

**Regularisation Types:**
- **Forgot Punch**: Employee forgot to mark attendance
- **Work From Home (WFH)**: Employee worked from home
- **On Duty**: Employee was on official duty
- **Other**: Any other reason

### Test Scenario 1: Submit Regularisation Request

**User:** Employee One (`employee@company.local`)

#### Step 1: Submit Request for Past Date

1. Login as `employee@company.local`
2. Go to **Regularisation** page (`/attendance/regularisation`)
3. Click **"Submit Regularisation Request"** button
4. Fill in the form:
   - **Date**: Select a past date (e.g., yesterday or 2 days ago)
   - **Type**: Select "Forgot Punch"
   - **Reason**: Enter "Forgot to mark attendance in the morning"
   - **Attachment**: (Optional) Leave empty or add a URL
5. Click **"Submit Request"**

**Expected Result:**
- Success toast: "Regularisation request submitted successfully"
- Request appears in the list with status: **Pending**
- You can see:
  - Date
  - Type
  - Reason
  - Status: Pending
  - Applied date

#### Step 2: View Your Regularisation Requests

1. On the same page, you should see all your regularisation requests
2. Filter by status: Pending, Approved, Rejected
3. Click on a request to see details including:
   - Original attendance data (if any existed)
   - Current status
   - Approver remarks (if reviewed)

### Test Scenario 2: Manager Approval Workflow

**User:** Manager One (`manager@company.local`)

#### Step 1: View Pending Regularisations

1. Logout and login as `manager@company.local`
2. Go to **Team** → **Regularisation** (`/team/regularisation`)
3. You should see all pending regularisation requests from your team members

**Expected Result:**
- List of pending requests
- Each request shows:
  - Employee name
  - Date
  - Type
  - Reason
  - Current attendance status (if any)

#### Step 2: Review and Approve

1. Click on a regularisation request to view details
2. You can see:
   - Original attendance data (what was there before)
   - Employee's reason
   - Date and type
3. Click **"Approve"** button
4. Add remarks (optional): "Approved - attendance will be updated"
5. Click **"Confirm Approval"**

**Expected Result:**
- Success toast: "Regularisation approved successfully"
- Request status changes to **Approved**
- Attendance for that date is automatically updated:
  - For "Forgot Punch": Creates IN/OUT punches (9 AM - 6 PM), 9 hours, Status: Present
  - For "Work From Home": Creates IN/OUT punches, Status: WFH
  - For "On Duty": Creates IN/OUT punches, Status: OnDuty

#### Step 3: Verify Attendance Update

1. Logout and login back as `employee@company.local`
2. Go to **Attendance** page
3. Find the date you regularised
4. You should see:
   - Status: **Present** (or WFH/OnDuty based on type)
   - In-time: 9:00 AM (default)
   - Out-time: 6:00 PM (default)
   - Total hours: 9

#### Step 4: Reject Regularisation (Alternative)

1. Login as manager
2. Go to **Team** → **Regularisation**
3. Click on a pending request
4. Click **"Reject"** button
5. Add remarks: "Rejected - please provide more details"
6. Click **"Confirm Rejection"**

**Expected Result:**
- Request status changes to **Rejected**
- Attendance is NOT updated
- Employee can see rejection reason

### Test Scenario 3: View Regularisation History

**User:** Employee One

1. Go to **Regularisation** page
2. You should see all your requests:
   - Pending requests (awaiting approval)
   - Approved requests (with updated attendance)
   - Rejected requests (with rejection reason)

---

## Leave Management Workflow

### How Leave Management Works

1. Employee applies for leave
2. System checks leave balance
3. Request goes to manager for approval
4. If approved, leave balance is automatically deducted
5. Employee can view leave history

### Test Scenario 1: Check Leave Balance

**User:** Employee One

1. Login as `employee@company.local`
2. Go to **Leave Management** (`/leave`)
3. You should see leave balance cards:
   - **CL** (Casual Leave): Shows credited, used, available
   - **SL** (Sick Leave): Shows credited, used, available
   - **EL** (Earned Leave): Shows credited, used, available
   - **LOP** (Loss of Pay): Shows credited, used, available

**Note:** If balances are 0, HR needs to credit leaves first (see HR workflow).

### Test Scenario 2: Apply for Leave

**User:** Employee One

#### Step 1: Apply for Full Day Leave

1. Go to **Leave Management** → **Apply Leave** (`/leave/apply`)
2. Fill in the form:
   - **Leave Type**: Select "CL" (Casual Leave)
   - **From Date**: Select tomorrow's date
   - **To Date**: Select tomorrow's date (same day for single day)
   - **Half Day**: Leave unchecked (full day)
   - **Reason**: "Personal work"
3. Click **"Apply for Leave"**

**Expected Result:**
- System calculates working days (excludes weekends)
- Checks if balance is sufficient
- If balance is low, shows error
- If successful, shows: "Leave application submitted successfully"
- Request status: **Pending**

#### Step 2: Apply for Half Day Leave

1. Go to **Apply Leave** again
2. Fill in:
   - **Leave Type**: "CL"
   - **From Date**: Select a future date
   - **To Date**: Same date
   - **Half Day**: Check this
   - **Half Day Type**: Select "First Half" or "Second Half"
   - **Reason**: "Medical appointment"
3. Click **"Apply for Leave"**

**Expected Result:**
- Only 0.5 days deducted from balance
- Working days calculation: 0.5

#### Step 3: Apply for Multiple Days

1. Apply for leave:
   - **From Date**: Select a date
   - **To Date**: Select 3 days later
   - **Half Day**: Unchecked
2. System should calculate working days (excluding weekends)

**Expected Result:**
- If you select Mon-Fri, working days = 5
- If includes weekend, working days = 3-4 (weekends excluded)

### Test Scenario 3: View Leave History

**User:** Employee One

1. Go to **Leave Management** → **Leave History** (`/leave/history`)
2. You should see all your leave applications:
   - Status: Pending, Approved, Rejected
   - Leave type
   - Dates
   - Duration
   - Reason
   - Approver remarks (if reviewed)

3. Use filters:
   - Filter by status
   - Filter by leave type
   - Filter by date range

### Test Scenario 4: Manager Leave Approval

**User:** Manager One

#### Step 1: View Pending Leave Requests

1. Login as `manager@company.local`
2. Go to **Team** → **Leave Approvals** (`/team/leave`)
3. You should see all pending leave requests from team members

**Expected Result:**
- List of pending requests
- Each shows:
  - Employee name
  - Leave type
  - Dates
  - Duration
  - Reason
  - Current leave balance

#### Step 2: Approve Leave

1. Click on a leave request
2. Review details:
   - Leave balance before approval
   - Working days calculation
   - Employee's reason
3. Click **"Approve"**
4. Add remarks (optional): "Approved - enjoy your leave"
5. Click **"Confirm Approval"**

**Expected Result:**
- Success toast: "Leave approved successfully"
- Leave balance is automatically deducted
- Request status: **Approved**
- Employee can see approval in their history

#### Step 3: Reject Leave

1. Click on another request
2. Click **"Reject"**
3. Add remarks: "Rejected - insufficient balance or business requirement"
4. Click **"Confirm Rejection"**

**Expected Result:**
- Request status: **Rejected**
- Leave balance is NOT deducted
- Employee can see rejection reason

---

## Manager Portal Workflow

### Test Scenario 1: Team Overview

**User:** Manager One

1. Login as `manager@company.local`
2. Go to **Team** → **Team Overview** (`/team`)
3. You should see:
   - **Live Team Presence**: Real-time status of all team members
   - **Statistics**:
     - Present count
     - Absent count
     - On Leave count
     - Checked Out count
   - **Team Members List**:
     - Each employee with:
       - Name
       - Department
       - Designation
       - Current status (Present, Absent, On Leave, Checked Out)
       - Color-coded status indicators

**Expected Result:**
- Page auto-refreshes every 30 seconds
- Status updates in real-time
- Color coding:
  - Green: Present
  - Red: Absent
  - Yellow: On Leave
  - Gray: Checked Out

### Test Scenario 2: Team Attendance

1. Go to **Team** → **Team Attendance** (`/team/attendance`)
2. You should see:
   - Calendar view of team attendance
   - Filter by employee (dropdown)
   - Filter by month
   - Grouped by employee

**Expected Result:**
- Each employee's attendance is shown separately
- Shows check-in/check-out times
- Shows total hours per day
- Can export to CSV/Excel

### Test Scenario 3: Team Reports

1. Go to **Reports** page (`/reports`)
2. View attendance and leave reports for your team
3. Filter by date range and department

---

## HR/Admin Portal Workflow

### Test Scenario 1: Employee Management

**User:** Admin or HR

1. Login as `admin@company.local` or `hr@company.local`
2. Go to **Employees** page (`/employees`)

#### Create New Employee

1. Click **"Add Employee"** button
2. Fill in the form:
   - **Name**: "New Employee"
   - **Email**: "newemployee@company.local"
   - **Employee Code**: "EMP001"
   - **Department**: "Engineering"
   - **Designation**: "Software Engineer"
   - **Manager**: Select a manager
   - **Joining Date**: Select a date
   - **Role**: "Employee"
   - **Phone**: "1234567890"
3. Click **"Create Employee"**

**Expected Result:**
- Employee created successfully
- Employee appears in the list
- User account is automatically created

#### Edit Employee

1. Find an employee in the list
2. Click **"Edit"** button
3. Update any field (e.g., change department)
4. Click **"Save"**

**Expected Result:**
- Changes saved successfully
- Updated information reflected in the list

#### Deactivate Employee

1. Find an employee
2. Click **"Deactivate"** button
3. Confirm deactivation

**Expected Result:**
- Employee status changes to inactive
- Employee cannot login (soft delete)

#### Search and Filter

1. Use search bar to find employees
2. Filter by department, designation, or status

### Test Scenario 2: Leave Balance Adjustment

**User:** HR or Admin

1. Go to **Leave Management** (`/leave`)
2. Click on **"Adjust Leave Balance"** (or navigate to employee's leave balance)
3. Select an employee
4. Select leave type (CL, SL, EL, LOP)
5. Enter adjustment:
   - **Action**: Add or Subtract
   - **Days**: Enter number of days
   - **Reason**: "Year-end credit" or "Correction"
6. Click **"Adjust Balance"**

**Expected Result:**
- Balance updated successfully
- Audit log entry created
- Employee can see updated balance

### Test Scenario 3: Reports

**User:** HR or Admin

1. Go to **Reports** page (`/reports`)

#### Attendance Report

1. Select **"Attendance Report"**
2. Set filters:
   - Date range
   - Department (optional)
3. Click **"Generate Report"**

**Expected Result:**
- Report shows:
  - Total employees
  - Present count
  - Absent count
  - WFH count
  - Total hours
- Can export to CSV

#### Leave Report

1. Select **"Leave Report"**
2. Set filters:
   - Date range
   - Department (optional)
   - Status (optional)
3. Click **"Generate Report"**

**Expected Result:**
- Report shows:
  - Total leave applications
  - Pending count
  - Approved count
  - Rejected count
  - Breakdown by leave type

### Test Scenario 4: Audit Logs (Admin Only)

**User:** Admin

1. Login as `admin@company.local`
2. Go to **Audit Logs** page (`/audit`)
3. You should see all system activities:
   - Employee creation/updates
   - Leave approvals
   - Regularisation approvals
   - Balance adjustments
   - Policy changes
   - Announcement changes

**Expected Result:**
- List of all audit entries
- Each entry shows:
  - Action type
  - User who performed action
  - Entity type and ID
  - Old value (if applicable)
  - New value
  - Timestamp
  - Remarks

4. Use filters:
   - Filter by action type
   - Filter by user
   - Filter by date range

---

## Policy Library Workflow

### Test Scenario 1: Create Policy (HR/Admin)

**User:** Admin or HR

1. Login as `admin@company.local`
2. Go to **Policies** page (`/policies`)
3. Click **"Add Policy"** button
4. Fill in the form:
   - **Title**: "Code of Conduct"
   - **Category**: Select "HR"
   - **Description**: "Company code of conduct policy"
   - **File URL**: "https://example.com/policy.pdf"
   - **Version**: "1.0"
   - **Effective Date**: Select a date
   - **Active**: Checked
5. Click **"Create Policy"**

**Expected Result:**
- Policy created successfully
- Appears in the policy list
- All users can view it

### Test Scenario 2: View Policies (All Users)

**User:** Any user

1. Go to **Policies** page
2. You should see all active policies
3. Use filters:
   - Search by title/description
   - Filter by category
   - Filter by status (Active/Archived)
4. Click **"Download"** icon to open policy file

**Expected Result:**
- Policy file opens in new tab
- Can view all policy details

### Test Scenario 3: Edit Policy (HR/Admin)

1. Find a policy
2. Click **"Edit"** button
3. Update any field (e.g., change version to "1.1")
4. Click **"Update Policy"**

**Expected Result:**
- Policy updated successfully
- Changes reflected in the list

### Test Scenario 4: Archive Policy (HR/Admin)

1. Find a policy
2. Click **"Archive"** button
3. Confirm archiving

**Expected Result:**
- Policy status changes to "Archived"
- Still visible but marked as archived
- Can be filtered out

---

## Announcements Workflow

### Test Scenario 1: Create Announcement (HR/Admin)

**User:** Admin or HR

1. Login as `admin@company.local`
2. Go to **Announcements** page (`/announcements`)
3. Click **"Create Announcement"** button
4. Fill in the form:
   - **Title**: "Holiday Notice"
   - **Content**: "Office will be closed on [date]"
   - **Target Audience**: Select roles (or leave empty for all)
   - **Expiration Date**: (Optional) Select a future date
   - **Pin to top**: Check if important
   - **Send email notification**: (Not implemented yet)
5. Click **"Create Announcement"**

**Expected Result:**
- Announcement created successfully
- Appears in announcements list
- If pinned, appears at top
- Visible to selected roles (or all if none selected)

### Test Scenario 2: View Announcements (All Users)

**User:** Any user

1. Go to **Announcements** page
2. You should see:
   - Pinned announcements at top (highlighted)
   - Regular announcements below
   - Filtered by your role (if role-based targeting is used)
   - Only non-expired announcements (if expiration date set)

**Expected Result:**
- Announcements visible based on role
- Expired announcements not shown
- Can view full content

### Test Scenario 3: View on Dashboard

1. Go to **Dashboard**
2. You should see announcements section:
   - Pinned announcements
   - Up to 3 most recent regular announcements
   - Link to view all

### Test Scenario 4: Edit/Delete Announcement (HR/Admin)

1. Find an announcement
2. Click **"Edit"** to modify
3. Or click **"Delete"** to remove

**Expected Result:**
- Changes saved or announcement deleted
- Updates reflected immediately

---

## Reports & Audit Workflow

### Test Scenario: Complete Reporting Flow

**User:** HR or Admin

1. Login as `admin@company.local`
2. Generate various reports:
   - Attendance reports for different date ranges
   - Leave reports filtered by department
   - Export reports to CSV
3. View audit logs to see all system activities
4. Filter audit logs by:
   - Action type (employee_create, leave_approve, etc.)
   - User
   - Date range

**Expected Result:**
- Reports generate correctly
- Data is accurate
- CSV exports work
- Audit logs show complete history

---

## Complete End-to-End Test Scenario

### Scenario: Employee Lifecycle

1. **Admin creates employee** → Employee appears in list
2. **HR credits leave balance** → Employee sees balance
3. **Employee marks attendance** → Attendance recorded
4. **Employee applies for leave** → Request pending
5. **Manager approves leave** → Leave balance deducted
6. **Employee forgets to mark attendance** → Submits regularisation
7. **Manager approves regularisation** → Attendance updated
8. **HR generates reports** → All data visible
9. **Admin views audit logs** → All actions logged

---

## Testing Checklist

Use this checklist to verify all features:

### Authentication
- [ ] Admin login works
- [ ] User registration works
- [ ] Logout works
- [ ] Session persistence works

### Attendance
- [ ] Check-in works
- [ ] Check-out works
- [ ] Multiple punches work
- [ ] Total hours calculated correctly
- [ ] Attendance history displays correctly
- [ ] Month filter works

### Regularisation
- [ ] Submit regularisation request works
- [ ] Manager sees pending requests
- [ ] Manager can approve/reject
- [ ] Attendance updates on approval
- [ ] Employee sees status updates

### Leave Management
- [ ] Leave balance displays correctly
- [ ] Apply for leave works
- [ ] Half-day leave works
- [ ] Multiple days leave works
- [ ] Manager sees pending requests
- [ ] Manager can approve/reject
- [ ] Balance deducted on approval
- [ ] Leave history displays correctly

### Manager Portal
- [ ] Team overview displays correctly
- [ ] Team attendance displays correctly
- [ ] Leave approvals work
- [ ] Regularisation approvals work

### HR/Admin Portal
- [ ] Employee CRUD works
- [ ] Leave balance adjustment works
- [ ] Reports generate correctly
- [ ] Audit logs display correctly
- [ ] Policy management works
- [ ] Announcement management works

### UI/UX
- [ ] Theme toggle works
- [ ] Color themes work
- [ ] Responsive design works
- [ ] Navigation works
- [ ] Toast notifications appear

---

## Troubleshooting

### Issue: Cannot login
- **Solution:** Check if user exists, verify password, check JWT_SECRET in .env.local

### Issue: Attendance not recording
- **Solution:** Check MongoDB connection, verify user is authenticated

### Issue: Manager cannot see team members
- **Solution:** Ensure employee-manager relationship is set in Employees page

### Issue: Leave balance is 0
- **Solution:** HR needs to credit leave balance using "Adjust Leave Balance"

### Issue: Regularisation not updating attendance
- **Solution:** Ensure manager approves the request, check if date is correct

### Issue: Reports not generating
- **Solution:** Check date range, ensure data exists for that period

---

## Notes

1. **Employee-Manager Relationship**: Critical for leave and regularisation approvals. Must be set in Employees page.

2. **Leave Balance**: Employees start with 0 balance. HR must credit leaves first.

3. **Regularisation Types**:
   - "Forgot Punch" → Creates Present status
   - "Work From Home" → Creates WFH status
   - "On Duty" → Creates OnDuty status

4. **Attendance Calculation**: Total hours calculated from IN/OUT pairs. Multiple pairs supported for breaks.

5. **Role-Based Access**: Different users see different menu items based on their role.

6. **Audit Logging**: All sensitive operations (employee changes, approvals, balance adjustments) are logged.

---

**Last Updated:** December 2024  
**Version:** 1.0.0

