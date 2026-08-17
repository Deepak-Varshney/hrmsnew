// lib/documentCategories.ts
//
// Client-safe constants. They live here rather than in documentService
// because that module imports the Cloudinary SDK and Mongoose models, which
// cannot cross into a client component.

export const PERSONAL_CATEGORIES = [
  "Aadhaar",
  "PAN",
  "Passport",
  "Educational certificate",
  "Previous experience letter",
  "Bank proof",
  "Address proof",
  "Other",
];

export const COMPANY_CATEGORIES = [
  "Offer letter",
  "Appointment letter",
  "Confirmation letter",
  "Appraisal letter",
  "Experience letter",
  "Relieving letter",
  "Salary certificate",
  "Other",
];
