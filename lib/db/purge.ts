// lib/db/purge.ts
//
// Restore and permanent delete. Super Admin only.
//
// Purge is the one operation in this system that genuinely destroys data, so
// the record is SNAPSHOTTED into the activity log BEFORE it is removed. That
// log entry becomes the only surviving trace — writing it afterwards would
// mean a failure between the two leaves no evidence the row ever existed.

import mongoose from "mongoose";
import Employee from "@/model/Employee";
import Organization from "@/model/Organization";
import User from "@/model/User";
import { assertSuperAdmin } from "@/lib/rbac";
import { runUnscoped } from "@/lib/context";
import { labelFor } from "@/lib/db/recordLabel";
import { logActivity, redact } from "@/lib/activity";
import { ValidationError, ConflictError } from "@/lib/services/employee";

/** Only these may be restored or purged from the console. */
const PURGEABLE: Record<string, any> = {
  Employee,
  Organization,
  User,
};

function modelFor(entityType: string) {
  const model = PURGEABLE[entityType];
  if (!model) {
    throw new ValidationError(
      `${entityType} cannot be restored or purged here.`,
    );
  }
  return model;
}

export async function restoreRecord(entityType: string, id: string) {
  await assertSuperAdmin("restore a record");

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError("That is not a valid id.");
  }

  // Unscoped: the recycle bin spans every org, and a super admin in admin
  // mode is pinned to one — which would otherwise hide the row being restored.
  return runUnscoped(async () => {
    const model = modelFor(entityType);
    const doc = await model.findById(id).withDeleted();

    if (!doc) throw new ValidationError("Record not found.");
    if (!doc.deletedAt) throw new ConflictError("That record is not deleted.");

    // Restoring an employee whose org is gone would produce a row pointing at
    // nothing. Restore the parent first.
    if (entityType === "Employee" && doc.orgId) {
      const org = await Organization.findById(doc.orgId).withDeleted().lean();
      if (!org) throw new ConflictError("The organisation no longer exists.");
      if ((org as any).deletedAt) {
        throw new ConflictError(
          "Restore the organisation first — this employee belongs to a deleted one.",
        );
      }
    }

    await doc.restore();

    await logActivity({
      action: "record.restored",
      entityType,
      entityId: doc._id,
      entityLabel: labelFor(entityType, doc),
      orgId: doc.orgId ?? null,
      severity: "critical",
    });

    return doc;
  });
}

export async function purgeRecord(
  entityType: string,
  id: string,
  confirmLabel: string,
) {
  await assertSuperAdmin("permanently delete a record");

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError("That is not a valid id.");
  }

  return runUnscoped(async () => {
    const model = modelFor(entityType);
    const doc = await model.findById(id).withDeleted();

    if (!doc) throw new ValidationError("Record not found.");
    if (!doc.deletedAt) {
      throw new ConflictError(
        "Only a deleted record can be purged. Delete it first, so there is a chance to change your mind.",
      );
    }

    // The same label the recycle bin renders — the user types what they see.
    const label = labelFor(entityType, doc);

    // Typing the name is the guard against a misplaced click destroying the
    // wrong row — there is no undo after this.
    if (confirmLabel?.trim() !== label) {
      throw new ValidationError(
        `Type "${label}" exactly to confirm permanent deletion.`,
      );
    }

    const snapshot = redact(doc.toObject());

    // Written BEFORE the delete. See the note at the top of this file.
    await logActivity({
      action: "record.purged",
      entityType,
      entityId: doc._id,
      entityLabel: label,
      orgId: doc.orgId ?? null,
      changes: { before: snapshot },
      metadata: { irreversible: true },
      severity: "critical",
    });

    // `.withDeleted()` is essential: the soft-delete plugin adds `deletedAt: null`
    // to every deleteOne, which would match nothing here and leave the row alive
    // behind a log entry claiming it was destroyed.
    const result = await model.deleteOne({ _id: doc._id }).withDeleted();

    if (result.deletedCount !== 1) {
      throw new ConflictError(
        "The record could not be removed. Nothing was deleted.",
      );
    }

    return { label };
  });
}
