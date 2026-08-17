// lib/cloudinary.ts
//
// File storage.
//
// ⚠ THE CENTRAL RULE: HR documents are uploaded as `type: "authenticated"`
// and only ever served through short-lived signed URLs.
//
// Cloudinary's DEFAULT delivery type is `upload`, which is public — anyone
// with the URL can fetch the asset forever, no session required, and it can
// be indexed. For an Aadhaar scan or a salary letter that is a breach, not a
// misconfiguration. Profile photos are the only thing uploaded publicly, and
// deliberately so.
//
// Nothing outside this module should call the Cloudinary SDK directly.

import { v2 as cloudinary } from "cloudinary";

let configured = false;

function configure() {
  if (configured) return;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET."
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
  configured = true;
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

/** 10 MB. Big enough for a scanned multi-page PDF, small enough to bound abuse. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
]);

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export interface UploadResult {
  publicId: string;
  bytes: number;
  format: string;
  resourceType: string;
}

/**
 * Upload a private HR document.
 *
 * Folder is scoped per organisation so one tenant's assets are never in
 * another's namespace, which matters if anyone ever browses the Cloudinary
 * console or runs a bulk operation by prefix.
 */
export async function uploadDocument(
  buffer: Buffer,
  opts: { orgId: string; employeeId: string; filename: string; mimeType: string }
): Promise<UploadResult> {
  configure();

  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error(`File is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
  }
  if (!ALLOWED_DOCUMENT_TYPES.has(opts.mimeType)) {
    throw new Error("Only PDF, JPEG, PNG, WebP and HEIC files can be uploaded.");
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        // The load-bearing line. Without it the asset is world-readable.
        type: "authenticated",
        resource_type: "auto",
        folder: `hrms/${opts.orgId}/employees/${opts.employeeId}`,
        use_filename: true,
        unique_filename: true,
        overwrite: false,
      },
      (error, result) => {
        if (error || !result) {
          return reject(new Error(error?.message ?? "Upload failed"));
        }
        resolve({
          publicId: result.public_id,
          bytes: result.bytes,
          format: result.format,
          resourceType: result.resource_type,
        });
      }
    );
    stream.end(buffer);
  });
}

/** Profile photo. Public on purpose — it is shown in lists and org charts. */
export async function uploadAvatar(
  buffer: Buffer,
  opts: { orgId: string; employeeId: string; mimeType: string }
): Promise<UploadResult> {
  configure();

  if (!ALLOWED_IMAGE_TYPES.has(opts.mimeType)) {
    throw new Error("A profile photo must be a JPEG, PNG or WebP image.");
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        type: "upload",
        resource_type: "image",
        folder: `hrms/${opts.orgId}/avatars`,
        public_id: opts.employeeId,
        overwrite: true,
        invalidate: true,
        transformation: [
          { width: 400, height: 400, crop: "fill", gravity: "face" },
          { quality: "auto", fetch_format: "auto" },
        ],
      },
      (error, result) => {
        if (error || !result) {
          return reject(new Error(error?.message ?? "Upload failed"));
        }
        resolve({
          publicId: result.public_id,
          bytes: result.bytes,
          format: result.format,
          resourceType: result.resource_type,
        });
      }
    );
    stream.end(buffer);
  });
}

/**
 * Time-limited URL for a private document.
 *
 * Default five minutes: long enough to open or download, short enough that a
 * URL pasted into a chat is useless by the time anyone else clicks it.
 */
export function signedDocumentUrl(
  publicId: string,
  opts: { resourceType?: string; expiresInSeconds?: number } = {}
): string {
  configure();

  const expiresAt = Math.floor(Date.now() / 1000) + (opts.expiresInSeconds ?? 300);

  return cloudinary.url(publicId, {
    type: "authenticated",
    resource_type: opts.resourceType ?? "image",
    sign_url: true,
    secure: true,
    expires_at: expiresAt,
  });
}

export async function deleteAsset(
  publicId: string,
  opts: { resourceType?: string; type?: string } = {}
): Promise<void> {
  configure();
  await cloudinary.uploader.destroy(publicId, {
    resource_type: opts.resourceType ?? "image",
    type: opts.type ?? "authenticated",
    invalidate: true,
  });
}
