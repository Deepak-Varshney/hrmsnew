// lib/db/recordLabel.ts
//
// How a record is named in the recycle bin.
//
// This exists in one place because the label is also the purge confirmation:
// the user types what the screen shows. If the list and the guard computed it
// separately, a correct confirmation would be rejected forever.

export function labelFor(entityType: string, doc: any): string {
  switch (entityType) {
    case "Employee":
      return `${doc.displayName} (${doc.employeeCode})`;
    case "Organization":
      return `${doc.name} (${doc.slug})`;
    case "User":
      return `${doc.name} <${doc.email}>`;
    default:
      return doc.displayName ?? doc.name ?? doc.email ?? String(doc._id);
  }
}
