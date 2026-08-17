// model/registry.ts
//
// Imports every model for its side effect of registering the schema.
//
// populate() resolves refs by model NAME, looked up in Mongoose's registry.
// If the referenced model's module was never imported in this process, the
// lookup throws MissingSchemaError at query time â€” a 500 that only appears on
// the routes that happen to populate, and only on a cold start.
//
// connect() imports this, so a live connection always implies every schema is
// registered. Do not rely on a route importing the right models by hand.

import "./ActivityLog";
import "./Announcement";
import "./Attendance";
import "./ChangeRequest";
import "./Department";
import "./Designation";
import "./Document";
import "./Employee";
import "./EmploymentHistory";
import "./Grade";
import "./HRNotice";
import "./Leave";
import "./LeaveBalance";
import "./Location";
import "./Membership";
import "./Organization";
import "./PayrollRun";
import "./Payslip";
import "./Policy";
import "./SalaryStructure";
import "./Session";
import "./Settings";
import "./StatutoryConfig";
import "./User";

export {};

