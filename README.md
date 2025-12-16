# HRMS - Human Resource Management System

A comprehensive Human Resource Management System built with Next.js 16, TypeScript, MongoDB, and Tailwind CSS. This system provides employee self-service, manager portal, and HR/Admin portal functionality.

## 📊 Feature Status

### ✅ Fully Working Features

#### 1. Authentication & Security
- ✅ **Secure Login System**
  - Email/password authentication
  - JWT-based session management
  - Role-based access control (Employee, Manager, HR, Admin)
  - Session expiration and logout functionality
  - Password hashing with bcrypt
- ✅ **User Registration** (with authentication)

#### 2. Employee Self-Service Portal

##### 2.1 Attendance Management
- ✅ **Mark Attendance (Check-In/Check-Out)**
  - Single button for check-in and check-out
  - Automatic punch type detection (IN/OUT)
  - Captures datetime, device type, and IP address
  - Real-time total hours calculation
  - Multiple punches support (for breaks)
  
- ✅ **Attendance History View**
  - Calendar/list view with month filter
  - Shows Present/Absent status
  - Displays in-time, out-time, and total hours
  - Clean table interface with status indicators

- ✅ **Attendance Regularisation Request**
  - Submit regularisation requests for missed attendance
  - Types: Forgot Punch, Work From Home, On Duty, Other
  - View current attendance data before submitting
  - Reason and optional attachment support
  - Automatic manager assignment
  - Status tracking (Pending/Approved/Rejected)

##### 2.2 Leave Management
- ✅ **Leave Balance View**
  - Dashboard cards showing leave balances
  - Support for CL (Casual Leave), SL (Sick Leave), EL (Earned Leave), LOP (Loss of Pay)
  - Year-wise balance tracking
  - Shows credited, used, and available balance

- ✅ **Apply for Leave**
  - Comprehensive leave application form
  - Date range selection with validation
  - Half-day leave support (First Half/Second Half)
  - Real-time balance checking
  - Automatic working days calculation (excludes weekends)
  - Balance validation (prevents over-application)
  - Manager assignment display

- ✅ **Leave Status & History**
  - Complete leave request history
  - Filter by status, type, and date range
  - Shows approver details and remarks
  - Color-coded status indicators
  - Detailed leave information display

#### 3. Manager/Supervisor Portal

##### 3.1 Team Overview
- ✅ **Live Team Presence View**
  - Real-time status of team members
  - Color-coded status indicators (Present, Absent, On Leave, Checked Out)
  - Statistics dashboard (Present count, Absent count, etc.)
  - Auto-refresh every 30 seconds
  - Employee details with department and designation

##### 3.2 Team Attendance Management
- ✅ **View Detailed Attendance for Team**
  - Calendar view of team attendance
  - Filter by employee and month
  - Grouped by employee for easy viewing
  - Shows check-in/check-out times and total hours
  - Export to CSV/Excel functionality

##### 3.3 Team Leave Management
- ✅ **Leave Approval Workflow**
  - View all pending leave requests from team
  - See leave balance information
  - Review leave details (dates, reason, duration)
  - Approve/Reject with remarks
  - Automatic leave balance update on approval

##### 3.4 Attendance Regularisation Approval
- ✅ **Regularisation Approval Workflow**
  - View pending regularisation requests
  - See current attendance data
  - Approve/Reject with remarks
  - Automatic attendance update on approval
  - Handles different regularisation types (WFH, Forgot Punch, etc.)

#### 4. HR/Admin Portal

##### 4.1 Employee Master Data Management
- ✅ **Create/Edit/Deactivate Employees**
  - Complete employee creation form
  - Employee code assignment
  - Department and designation management
  - Manager assignment (reporting structure)
  - Joining date and contact information
  - Role assignment (Employee, Manager, HR, Admin)
  - Soft delete (deactivation) functionality
  - Search and filter capabilities

##### 4.2 Leave & Attendance Configuration
- ✅ **Leave Balance Adjustment**
  - HR can adjust leave balances for any employee
  - Add or subtract leave days
  - Reason tracking for all adjustments
  - Automatic balance recalculation

##### 4.3 Reports & Analytics
- ✅ **Attendance Reports**
  - System-wide attendance reports
  - Filter by date range and department
  - Summary statistics (Present, Absent, WFH, Total Hours)
  - Export to CSV functionality

- ✅ **Leave Reports**
  - System-wide leave reports
  - Filter by date range, department, and status
  - Summary statistics (Pending, Approved, Rejected)
  - Breakdown by leave type

##### 4.4 Audit Logs (Admin Only)
- ✅ **Complete Audit Trail**
  - View all system activities
  - Filter by action type, user, and date range
  - Track employee changes, leave approvals, balance adjustments
  - Shows old and new values for changes
  - User and timestamp information

##### 4.5 Policy Library
- ✅ **Company Policy Management**
  - Policy document management (URL-based)
  - Category organization (HR, IT, Compliance, Other)
  - Version control system
  - Effective date tracking
  - Archive/deactivate functionality
  - Employee download access
  - Policy search and filtering
  - Full CRUD operations (Create, Read, Update, Delete)

##### 4.6 Announcements System
- ✅ **Company Announcements**
  - Create company-wide announcements
  - Pin important announcements
  - Role-based targeting
  - Dashboard notification display
  - Announcement expiration dates
  - Full CRUD operations

#### 5. UI/UX Features

##### 5.1 Theme System
- ✅ **Light/Dark Mode**
  - System preference detection
  - Manual theme toggle
  - Persistent theme selection
  - Smooth transitions

- ✅ **Color Theme Customization**
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
- ✅ **Responsive Navbar**
  - Sticky top navigation
  - User information display
  - Theme toggle and color picker
  - Logout functionality
  - Mobile menu support

- ✅ **Role-Based Sidebar**
  - Dynamic menu based on user role
  - Different navigation items for Employee, Manager, HR, Admin
  - Active route highlighting
  - Mobile-responsive with overlay
  - Smooth animations

##### 5.3 Dashboard
- ✅ **Personalized Dashboard**
  - Welcome message with user name
  - Today's attendance summary
  - Quick actions
  - Role-based content
  - Announcements display

### ⚠️ Partially Working / Incomplete Features

#### 1. Settings Page
- ⚠️ **Office Settings Configuration**
  - UI exists for office timings, weekly offs, geo-fence, and IP restrictions
  - **Status:** UI only - settings are not saved to backend (no API endpoint)
  - Settings are not enforced in attendance marking

#### 2. Announcements
- ⚠️ **Email Notifications**
  - Email notification option exists in UI
  - **Status:** Backend has TODO comment - email sending not implemented
  - Announcements are created and displayed, but emails are not sent

#### 3. Policy Library
- ⚠️ **File Upload**
  - Currently only accepts file URLs (not actual file uploads)
  - **Status:** Requires external file storage service or file upload implementation

### ❌ Not Implemented Features

The following features have navigation links in the sidebar but no pages/functionality exist:

1. **Payroll & Finance**
   - Salary slip download
   - Tax documents management
   - Financial year tracking

2. **Document Vault**
   - Employee document management
   - Document upload and storage
   - Document verification workflow

3. **Asset Management**
   - Asset allocation view
   - Asset tracking
   - Asset return workflow

4. **Holiday Calendar**
   - Company holiday management
   - Integration with leave calculation

5. **Email Notifications**
   - Leave approval/rejection emails
   - Regularisation approval emails
   - Password reset emails

6. **Advanced Reporting**
   - Excel export with formatting
   - PDF report generation
   - Custom report builder

7. **Biometric Integration**
   - Biometric device API integration
   - Automatic attendance import

8. **Mobile App**
   - React Native mobile application
   - GPS-based attendance
   - Push notifications

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
│   │   ├── audit/        # Audit log APIs
│   │   ├── policies/     # Policy management APIs
│   │   └── announcements/# Announcement APIs
│   ├── attendance/       # Attendance pages
│   ├── leave/            # Leave management pages
│   ├── team/             # Manager portal pages
│   ├── employees/        # Employee management pages
│   ├── reports/          # Reports pages
│   ├── settings/        # Settings page (UI only)
│   ├── audit/            # Audit logs page
│   ├── dashboard/        # Dashboard page
│   ├── policies/         # Policy library page
│   └── announcements/    # Announcements page
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
│   └── requireRole.ts    # Role-based access control
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
   
   Create a `.env.local` file in the root directory:
   
   ```env
   # MongoDB Database Connection (REQUIRED)
   MONGODB_URI=mongodb://localhost:27017/hrms
   
   # JWT Authentication Secret (REQUIRED)
   # Generate using: openssl rand -base64 32
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   
   # JWT Token Expiration (optional, default: 1h)
   JWT_EXPIRES_IN=1h
   
   # Session TTL in days (optional, default: 30)
   SESSION_TTL_DAYS=30
   ```
   
   **Important:** 
   - Replace `MONGODB_URI` with your MongoDB connection string
   - Generate a strong `JWT_SECRET` using: `openssl rand -base64 32`
   - Never commit `.env.local` to version control

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

### Policies (All Users)
- `GET /api/policies` - List policies
- `POST /api/policies` - Create policy (HR/Admin only)
- `GET /api/policies/[id]` - Get policy details
- `PUT /api/policies/[id]` - Update policy (HR/Admin only)
- `DELETE /api/policies/[id]` - Archive policy (HR/Admin only)

### Announcements (All Users)
- `GET /api/announcements` - List announcements
- `POST /api/announcements` - Create announcement (HR/Admin only)
- `GET /api/announcements/[id]` - Get announcement details
- `PUT /api/announcements/[id]` - Update announcement (HR/Admin only)
- `DELETE /api/announcements/[id]` - Delete announcement (HR/Admin only)

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

## 🔧 Configuration

### Environment Variables

**Required Variables:**
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT tokens (generate with: `openssl rand -base64 32`)

**Optional Variables:**
- `JWT_EXPIRES_IN` - Token expiration (default: `1h`)
- `SESSION_TTL_DAYS` - Session duration (default: `30`)

**Quick Setup:**
```env
MONGODB_URI=mongodb://localhost:27017/hrms
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

## 📋 Known Issues & Limitations

1. **Settings Page**: UI exists but settings are not persisted to database or enforced
2. **Email Notifications**: Backend ready but email sending not implemented
3. **File Uploads**: Policies require external URLs instead of file uploads
4. **Geo-fence & IP Restrictions**: Settings exist but not enforced in attendance API
5. **Missing Pages**: Payroll, Documents, and Assets pages are linked in sidebar but don't exist (will show 404)

## 🚧 Roadmap

### Planned Features
- Payroll & Finance module
- Document Vault with file uploads
- Asset Management system
- Holiday Calendar
- Email notification system
- Advanced reporting (Excel/PDF)
- Biometric integration
- Mobile application

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
