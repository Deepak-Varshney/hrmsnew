// lib/rbac/scope.ts
//
// Turns a granted Scope into a MongoDB filter.
//
// The interesting case is "team": a manager's reach is their entire reporting
// subtree, resolved by walking `reportsTo` with $graphLookup, not just their
// direct reports.

import { Types } from "mongoose";
import { getContext, requireContext, setTeamIds } from "@/lib/context";
import type { Scope } from "./permissions";

/**
 * Employee ids in the current user's reporting subtree — themselves plus all
 * descendants, at any depth. Cached on the request context after first call.
 */
export async function resolveTeamIds(): Promise<string[]> {
  const ctx = requireContext();

  if (ctx.teamIds) return ctx.teamIds;

  if (!ctx.employeeId) {
    setTeamIds([]);
    return [];
  }

  const { default: Employee } = await import("@/model/Employee");
  const selfId = new Types.ObjectId(ctx.employeeId);

  const rows = await Employee.aggregate([
    { $match: { _id: selfId } },
    {
      $graphLookup: {
        from: Employee.collection.name,
        startWith: "$_id",
        connectFromField: "_id",
        connectToField: "reportsTo",
        as: "descendants",
        // $graphLookup reads the raw collection, so plugin query middleware
        // does not apply — soft-deleted rows must be excluded here.
        restrictSearchWithMatch: { deletedAt: null },
      },
    },
    { $project: { descendantIds: "$descendants._id" } },
  ]);

  const descendants: Types.ObjectId[] = rows[0]?.descendantIds ?? [];
  const ids = [ctx.employeeId, ...descendants.map((id) => id.toString())];

  const unique = Array.from(new Set(ids));
  setTeamIds(unique);
  return unique;
}

/**
 * Filter to apply to an Employee query for the given scope.
 *
 * Note "org" returns {} — the tenantScope plugin already pins orgId on every
 * query. Restating it here would be redundant and could mask a plugin bug.
 */
export async function employeeFilterForScope(
  scope: Scope
): Promise<Record<string, any>> {
  const ctx = requireContext();

  switch (scope) {
    case "platform":
    case "org":
      return {};

    case "team": {
      const teamIds = await resolveTeamIds();
      return { _id: { $in: teamIds.map((id) => new Types.ObjectId(id)) } };
    }

    case "self":
      if (!ctx.employeeId) {
        // No employee record — match nothing rather than everything.
        return { _id: { $in: [] } };
      }
      return { _id: new Types.ObjectId(ctx.employeeId) };

    case "none":
    default:
      return { _id: { $in: [] } };
  }
}

/**
 * Filter for records that hang off an employee (documents, assets,
 * attendance, leave) using the owning employee field.
 */
export async function ownerFilterForScope(
  scope: Scope,
  ownerField = "employeeId"
): Promise<Record<string, any>> {
  const ctx = requireContext();

  switch (scope) {
    case "platform":
    case "org":
      return {};

    case "team": {
      const teamIds = await resolveTeamIds();
      return {
        [ownerField]: { $in: teamIds.map((id) => new Types.ObjectId(id)) },
      };
    }

    case "self":
      if (!ctx.employeeId) return { [ownerField]: { $in: [] } };
      return { [ownerField]: new Types.ObjectId(ctx.employeeId) };

    case "none":
    default:
      return { [ownerField]: { $in: [] } };
  }
}

/** Is `employeeId` inside the caller's reach for this scope? */
export async function isWithinScope(
  scope: Scope,
  employeeId: string
): Promise<boolean> {
  const ctx = getContext();
  if (!ctx) return false;

  switch (scope) {
    case "platform":
    case "org":
      return true;
    case "team": {
      const teamIds = await resolveTeamIds();
      return teamIds.includes(employeeId);
    }
    case "self":
      return ctx.employeeId === employeeId;
    default:
      return false;
  }
}
