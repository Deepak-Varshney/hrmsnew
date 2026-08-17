"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  Eye,
  Trash2,
  ShieldCheck,
  Building2,
  Loader2,
} from "lucide-react";

import { StatusPill, type PillTone } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

export interface DocumentRow {
  _id: string;
  name: string;
  category: string;
  source: "personal" | "company";
  verificationStatus: "pending" | "verified" | "rejected";
  rejectionReason?: string | null;
  sizeBytes?: number;
  expiryDate?: string | null;
  createdAt: string;
}

const VERIFICATION_TONE: Record<string, PillTone> = {
  verified: "success",
  pending: "warning",
  rejected: "danger",
};

const VERIFICATION_LABEL: Record<string, string> = {
  verified: "Verified",
  pending: "Awaiting check",
  rejected: "Rejected",
};

function fileSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentsCard({
  title,
  description,
  source,
  documents,
  categories,
  employeeId,
  canUpload,
  canDelete,
}: {
  title: string;
  description: string;
  source: "personal" | "company";
  documents: DocumentRow[];
  categories: string[];
  employeeId: string;
  canUpload: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState(categories[0] ?? "Other");
  const [uploading, setUploading] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function upload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("employeeId", employeeId);
      form.set("category", category);
      form.set("source", source);

      // No Content-Type header — the browser must set the multipart boundary.
      const res = await fetch("/api/documents", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Upload failed");

      toast.success("Uploaded", { description: file.name });
      startTransition(() => router.refresh());
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function open(doc: DocumentRow) {
    setOpening(doc._id);
    try {
      // The URL is minted per request and expires in five minutes, so it is
      // fetched at click time rather than rendered into the page.
      const res = await fetch(`/api/documents/${doc._id}/url`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not open that");
      window.open(body.url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setOpening(null);
    }
  }

  async function remove(doc: DocumentRow) {
    if (!confirm(`Remove "${doc.name}"?`)) return;
    try {
      const res = await fetch(`/api/documents/${doc._id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not remove that");
      toast.success(body.message);
      startTransition(() => router.refresh());
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  const Icon = source === "company" ? Building2 : ShieldCheck;

  return (
    <section className="rounded-lg border bg-surface">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
            {title}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>

        {canUpload ? (
          <div className="flex shrink-0 items-center gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Document type"
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <input
              ref={fileInput}
              type="file"
              className="sr-only"
              accept=".pdf,image/jpeg,image/png,image/webp,image/heic"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload(file);
              }}
            />
            <Button
              variant="outline"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Upload className="mr-2 h-4 w-4" aria-hidden />
              )}
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </div>
        ) : null}
      </div>

      {documents.length === 0 ? (
        <EmptyState
          className="border-0"
          icon={FileText}
          title={source === "company" ? "Nothing issued yet" : "No documents yet"}
          description={
            source === "company"
              ? "Letters issued by the company — offer, appraisal, experience — appear here as HR adds them."
              : "PDF or image, up to 10 MB. Uploads are private and only visible to you and HR."
          }
        />
      ) : (
        <ul className="divide-y">
          {documents.map((doc) => (
            <li key={doc._id} className="flex items-center gap-3 p-4">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{doc.name}</p>
                <p className="text-xs text-subtle-foreground">
                  {doc.category}
                  {doc.sizeBytes ? ` · ${fileSize(doc.sizeBytes)}` : ""} ·{" "}
                  {formatDate(doc.createdAt)}
                  {doc.expiryDate ? ` · expires ${formatDate(doc.expiryDate)}` : ""}
                </p>
                {doc.verificationStatus === "rejected" && doc.rejectionReason ? (
                  <p className="mt-1 text-xs text-danger">{doc.rejectionReason}</p>
                ) : null}
              </div>

              {source === "personal" ? (
                <StatusPill tone={VERIFICATION_TONE[doc.verificationStatus] ?? "neutral"}>
                  {VERIFICATION_LABEL[doc.verificationStatus]}
                </StatusPill>
              ) : null}

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => open(doc)}
                  disabled={opening === doc._id}
                  aria-label={`Open ${doc.name}`}
                >
                  {opening === doc._id ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )}
                </Button>

                {canDelete ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(doc)}
                    aria-label={`Remove ${doc.name}`}
                  >
                    <Trash2 className="h-4 w-4 text-danger" aria-hidden />
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
