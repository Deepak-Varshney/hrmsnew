# HRMS - Human Resource Management System

A comprehensive Human Resource Management System built with Next.js 16, TypeScript, MongoDB, and Tailwind CSS. This system provides complete employee self-service, manager portal, and HR/Admin portal functionality.

## 🚀 Features

### ✅ Implemented Features

#### 1. Authentication & Security
- **Secure Login System**
  - Email/password authentication
  - JWT-based session management
  - Role-based access control (Employee, Manager, HR, Admin)
  - Session expiration and logout functionality
  - Password hashing with bcrypt

#### 2. Employee Self-Service Portal

##### 2.1 Attendance Management
- **Mark Attendance (Check-In/Check-Out)**
  - Single button for check-in and check-out
  - Automatic punch type detection (IN/OUT)
  - Captures datetime, device type, and IP address
  - Real-time total hours calculation
  - Multiple punches support (for breaks)
  
- **Attendance History View**
  - Calendar/list view with month filter
  - Shows Present/Absent status
  - Displays in-time, out-time, and total hours
  - Clean table interface with status indicators

- **Attendance Regularisation Request**
  - Submit regularisation requests for missed attendance
  - Types: Forgot Punch, Work From Home, On Duty, Other
  - View current attendance data before submitting
  - Reason and optional attachment support
  - Automatic manager assignment
  - Status tracking (Pending/Approved/Rejected)

##### 2.2 Leave Management
- **Leave Balance View**
  - Dashboard cards showing leave balances
  - Support for CL (Casual Leave), SL (Sick Leave), EL (Earned Leave), LOP (Loss of Pay)
  - Year-wise balance tracking
  - Shows credited, used, and available balance

- **Apply for Leave**
  - Comprehensive leave application form
  - Date range selection with validation
  - Half-day leave support (First Half/Second Half)
  - Real-time balance checking
  - Automatic working days calculation (excludes weekends)
  - Balance validation (prevents over-application)
  - Manager assignment display

- **Leave Status & History**
  - Complete leave request history
  - Filter by status, type, and date range
  - Shows approver details and remarks
  - Color-coded status indicators
  - Detailed leave information display

#### 3. Manager/Supervisor Portal

##### 3.1 Team Overview
- **Live Team Presence View**
  - Real-time status of team members
  - Color-coded status indicators (Present, Absent, On Leave, Checked Out)
  - Statistics dashboard (Present count, Absent count, etc.)
  - Auto-refresh every 30 seconds
  - Employee details with department and designation

##### 3.2 Team Attendance Management
- **View Detailed Attendance for Team**
  - Calendar view of team attendance
  - Filter by employee and month
  - Grouped by employee for easy viewing
  - Shows check-in/check-out times and total hours
  - Export to CSV/Excel functionality

##### 3.3 Team Leave Management
- **Leave Approval Workflow**
  - View all pending leave requests from team
  - See leave balance information
  - Review leave details (dates, reason, duration)
  - Approve/Reject with remarks
  - Automatic leave balance update on approval
  - Email notification ready (backend ready)

##### 3.4 Attendance Regularisation Approval
- **Regularisation Approval Workflow**
  - View pending regularisation requests
  - See current attendance data
  - Approve/Reject with remarks
  - Automatic attendance update on approval
  - Handles different regularisation types (WFH, Forgot Punch, etc.)

#### 4. HR/Admin Portal

##### 4.1 Employee Master Data Management
- **Create/Edit/Deactivate Employees**
  - Complete employee creation form
  - Employee code assignment
  - Department and designation management
  - Manager assignment (reporting structure)
  - Joining date and contact information
  - Role assignment (Employee, Manager, HR, Admin)
  - Soft delete (deactivation) functionality
  - Search and filter capabilities

##### 4.2 Leave & Attendance Configuration
- **Leave Balance Adjustment**
  - HR can adjust leave balances for any employee
  - Add or subtract leave days
  - Reason tracking for all adjustments
  - Automatic balance recalculation

##### 4.3 System Settings
- **Office Timings Configuration**
  - Set office start and end times
  - Weekly offs selection
  - Geo-fence settings (enable/disable, radius configuration)
  - IP-based restriction settings
  - Allowed IPs management

##### 4.4 Reports & Analytics
- **Attendance Reports**
  - System-wide attendance reports
  - Filter by date range and department
  - Summary statistics (Present, Absent, WFH, Total Hours)
  - Export to CSV functionality

- **Leave Reports**
  - System-wide leave reports
  - Filter by date range, department, and status
  - Summary statistics (Pending, Approved, Rejected)
  - Breakdown by leave type

##### 4.5 Audit Logs (Admin Only)
- **Complete Audit Trail**
  - View all system activities
  - Filter by action type, user, and date range
  - Track employee changes, leave approvals, balance adjustments
  - Shows old and new values for changes
  - User and timestamp information

#### 5. UI/UX Features

##### 5.1 Theme System
- **Light/Dark Mode**
  - System preference detection
  - Manual theme toggle
  - Persistent theme selection
  - Smooth transitions

- **Color Theme Customization**
  - 7 professional color themes:
    - Default (Neutral)
    - Violet
    - Rose
    - Rose Gold
    - Emerald (Light Greenish)
    - Blue
    - Amber
  - Works with both light and dark modes
  - Persistent color selection
  - Visual color picker interface

##### 5.2 Navigation
- **Responsive Navbar**
  - Sticky top navigation
  - User information display
  - Theme toggle and color picker
  - Notifications icon (placeholder)
  - Logout functionality
  - Mobile menu support

- **Role-Based Sidebar**
  - Dynamic menu based on user role
  - Different navigation items for Employee, Manager, HR, Admin
  - Active route highlighting
  - Mobile-responsive with overlay
  - Smooth animations

##### 5.3 Dashboard
- **Personalized Dashboard**
  - Welcome message with user name
  - Today's attendance summary
  - Quick actions
  - Role-based content

## 🛠️ Tech Stack

### Frontend
- **Next.js 16.0.5** - React framework with App Router
- **React 19.2.0** - UI library
- **TypeScript 5** - Type safety
- **Tailwind CSS 4** - Styling
- **Radix UI** - Accessible component primitives
- **Lucide React** - Icon library
- **next-themes** - Theme management
- **Sonner** - Toast notifications

### Backend
- **Next.js API Routes** - Serverless API endpoints
- **MongoDB** - Database
- **Mongoose 9.0.0** - ODM for MongoDB
- **JWT (jsonwebtoken)** - Authentication tokens
- **bcrypt** - Password hashing

### Development Tools
- **ESLint** - Code linting
- **TypeScript** - Type checking

## 📁 Project Structure

```
hrms/
├── app/
│   ├── api/              # API routes
│   │   ├── auth/         # Authentication endpoints
│   │   ├── attendance/   # Attendance APIs
│   │   ├── leave/        # Leave management APIs
│   │   ├── team/         # Manager portal APIs
│   │   ├── employees/    # Employee management APIs
│   │   ├── reports/      # Reporting APIs
│   │   └── audit/        # Audit log APIs
│   ├── attendance/       # Attendance pages
│   ├── leave/            # Leave management pages
│   ├── team/             # Manager portal pages
│   ├── employees/        # Employee management pages
│   ├── reports/          # Reports pages
│   ├── settings/         # Settings page
│   ├── audit/            # Audit logs page
│   └── dashboard/        # Dashboard page
├── components/
│   ├── ui/               # Reusable UI components
│   ├── Navbar.tsx        # Top navigation
│   ├── Sidebar.tsx       # Side navigation
│   ├── DashboardLayout.tsx
│   ├── ThemeToggle.tsx
│   └── ThemeColorPicker.tsx
├── lib/
│   ├── auth.ts           # Authentication utilities
│   ├── mongoose.ts       # Database connection
│   ├── requireAuth.ts    # Auth middleware
│   └── requireRole.ts     # Role-based access control
├── model/                # Mongoose models
│   ├── User.ts
│   ├── Employee.ts
│   ├── Attendance.ts
│   ├── Leave.ts
│   ├── LeaveBalance.ts
│   ├── Regularisation.ts
│   ├── Policy.ts
│   ├── Announcement.ts
│   ├── AuditLog.ts
│   └── Session.ts
└── scripts/
    └── seed-admin.ts      # Admin user seeding script
```

## 🗄️ Database Models

### Core Models
- **User** - User accounts with roles and authentication
- **Employee** - Employee master data (department, manager, etc.)
- **Session** - Active user sessions for security

### Attendance Models
- **Attendance** - Daily attendance records with punches
- **Regularisation** - Attendance correction requests

### Leave Models
- **Leave** - Leave applications
- **LeaveBalance** - Leave balances per employee/year

### System Models
- **Policy** - Company policies
- **Announcement** - Company announcements
- **AuditLog** - System audit trail

## 🔐 Authentication & Authorization

### Roles
- **Employee** - Basic access (own attendance, leave)
- **Manager** - Team management (team attendance, leave approvals)
- **HR** - Employee management, leave balance adjustment, reports
- **Admin** - Full access including audit logs

### Security Features
- JWT-based authentication
- Session management with expiration
- Password hashing (bcrypt)
- Role-based route protection
- Audit logging for sensitive operations

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- MongoDB database
- pnpm (or npm/yarn)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd hrms
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file:
   ```env
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   JWT_EXPIRES_IN=1h
   SESSION_TTL_DAYS=30
   ```

4. **Seed admin user (optional)**
   ```bash
   npx tsx scripts/seed-admin.ts
   ```
   Default admin credentials:
   - Email: `admin@company.local`
   - Password: `Admin@123`

5. **Run development server**
   ```bash
   pnpm dev
   ```

6. **Open browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📝 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout
- `GET /api/me` - Get current user

### Attendance
- `POST /api/attendance/punch` - Check-in/Check-out
- `GET /api/attendance/today` - Get today's attendance
- `GET /api/attendance/history` - Get attendance history
- `POST /api/attendance/regularisation` - Submit regularisation request
- `GET /api/attendance/regularisation` - Get regularisation requests

### Leave Management
- `GET /api/leave/balance` - Get leave balances
- `POST /api/leave/apply` - Apply for leave
- `GET /api/leave/history` - Get leave history
- `POST /api/leave/balance/adjust` - Adjust leave balance (HR only)

### Manager Portal
- `GET /api/team/overview` - Get team overview
- `GET /api/team/attendance` - Get team attendance
- `GET /api/team/leave/pending` - Get pending leave requests
- `POST /api/team/leave/approve` - Approve/reject leave
- `GET /api/team/regularisation/pending` - Get pending regularisations
- `POST /api/team/regularisation/approve` - Approve/reject regularisation

### Employee Management (HR/Admin)
- `GET /api/employees` - List employees
- `POST /api/employees` - Create employee
- `GET /api/employees/[id]` - Get employee details
- `PUT /api/employees/[id]` - Update employee
- `DELETE /api/employees/[id]` - Deactivate employee
- `GET /api/employees/managers` - Get managers list

### Reports (HR/Admin)
- `GET /api/reports/attendance` - Attendance report
- `GET /api/reports/leave` - Leave report

### Audit (Admin Only)
- `GET /api/audit` - Get audit logs

## 🎨 Theme Customization

The system supports 7 color themes that work with both light and dark modes:
1. Default (Neutral)
2. Violet
3. Rose
4. Rose Gold
5. Emerald (Light Greenish)
6. Blue
7. Amber

Users can switch themes using the palette icon in the navbar.

## 📋 Upcoming Features

### 1. Payroll & Finance
- [ ] **Salary Slip Download**
  - Monthly salary slip generation
  - PDF download functionality
  - Employee access to own slips
  - Historical salary slip archive

- [ ] **Tax Documents Management**
  - Form 16 upload and download
  - TDS certificate management
  - Form 60 support
  - Financial year tagging
  - HR/Finance upload functionality

### 2. Document Vault
- [ ] **Employee Document Management**
  - Upload identity documents (PAN, Aadhaar, Passport)
  - Address proof management
  - KYC document storage
  - Document verification workflow
  - HR verification status tracking
  - Document replacement/update functionality
  - Structured folder organization
  - Metadata management (doc type, upload date)

### 3. Asset Management
- [ ] **Asset Allocation View**
  - List of allocated assets (laptop, phone, SIM, etc.)
  - Asset type and serial number tracking
  - Issue date and condition tracking
  - Login credentials storage
  - Employee acknowledgment system
  - Asset return workflow

### 4. Policy Library
- [ ] **Company Policy Management**
  - Policy document upload (PDF)
  - Category organization (HR, IT, Compliance)
  - Version control system
  - Effective date tracking
  - Archive old versions
  - Employee download access
  - Policy search functionality

### 5. Announcements System
- [ ] **Company Announcements**
  - Create company-wide announcements
  - Pin important announcements
  - Role-based targeting
  - Email notification integration
  - Dashboard notification display
  - Announcement expiration dates

### 6. Enhanced Features
- [ ] **Holiday Calendar**
  - Company holiday management
  - Integration with leave calculation
  - Regional holiday support

- [ ] **Email Notifications**
  - Leave approval/rejection emails
  - Regularisation approval emails
  - Announcement notifications
  - Password reset emails

- [ ] **Advanced Reporting**
  - Excel export with formatting
  - PDF report generation
  - Custom report builder
  - Scheduled reports

- [ ] **Biometric Integration**
  - Abstract attendance source layer
  - Biometric device API integration
  - Automatic attendance import

- [ ] **Mobile App**
  - React Native mobile application
  - GPS-based attendance
  - Push notifications

## 🔧 Configuration

### Environment Variables
```env
# Database
MONGODB_URI=mongodb://localhost:27017/hrms

# Authentication
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=1h
SESSION_TTL_DAYS=30

# Optional: Email Configuration (for future use)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-password
```

## 📊 Current Status

### ✅ Completed Modules
- ✅ Authentication & Authorization
- ✅ Attendance Management
- ✅ Leave Management
- ✅ Manager Portal
- ✅ HR/Admin Portal
- ✅ Reports & Analytics
- ✅ Audit Logging
- ✅ Theme System
- ✅ Responsive UI

### 🚧 In Progress
- None currently

### 📅 Planned
- Payroll & Finance
- Document Vault
- Asset Management
- Policy Library
- Announcements System

## 🤝 Contributing

This is a private project. For contributions, please contact the project maintainer.

## 📄 License

Private - All rights reserved

## 👥 Authors

- Development Team

## 📞 Support

For support and queries, please contact the development team.

---

**Last Updated:** December 2024
**Version:** 1.0.0
