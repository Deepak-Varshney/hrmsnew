"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function RegularisationApprovalsPage() {
  const [regularisations, setRegularisations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReg, setSelectedReg] = useState<any>(null);
  const [remarks, setRemarks] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadPendingRegularisations();
  }, []);

  async function loadPendingRegularisations() {
    setLoading(true);
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch("/api/team/regularisation/pending", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setRegularisations(data.regularisations || []);
      } else {
        toast.error(data.error || "Failed to load regularisation requests");
      }
    } catch (error) {
      toast.error("Failed to load regularisation requests");
    } finally {
      setLoading(false);
    }
  }

  async function handleApproval(regularisationId: string, action: "approve" | "reject") {
    setActionLoading(true);
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Please login again");
      setActionLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/team/regularisation/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          regularisationId,
          action,
          remarks: remarks.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setSelectedReg(null);
        setRemarks("");
        loadPendingRegularisations();
      } else {
        toast.error(data.error || "Failed to process request");
      }
    } catch (error) {
      toast.error("Failed to process request");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Regularisation Approvals</h1>
          <p className="text-muted-foreground">
            Review and approve/reject attendance regularisation requests
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pending Regularisation Requests ({regularisations.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : regularisations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No pending regularisation requests
              </div>
            ) : (
              <div className="space-y-4">
                {regularisations.map((reg: any) => (
                  <div
                    key={reg._id}
                    className="p-4 rounded-lg border bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <AlertCircle className="h-5 w-5 text-amber-500 mt-1" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold text-lg">
                              {reg.userId?.name || "Unknown"}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {reg.userId?.email}
                            </span>
                          </div>
                          <div className="space-y-1 text-sm">
                            <div>
                              <strong>Date:</strong>{" "}
                              {new Date(reg.date + "T00:00:00").toLocaleDateString()}
                            </div>
                            <div>
                              <strong>Type:</strong> {reg.type}
                            </div>
                            <div>
                              <strong>Reason:</strong> {reg.reason}
                            </div>
                            {reg.originalAttendance && (
                              <div className="mt-2 p-2 bg-background rounded text-xs">
                                <strong>Current Attendance:</strong>{" "}
                                {reg.originalAttendance.punches?.length || 0} punches,{" "}
                                {reg.originalAttendance.totalHours?.toFixed(2) || 0} hours, Status:{" "}
                                {reg.originalAttendance.status || "N/A"}
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground mt-2">
                              Applied on {new Date(reg.appliedAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedReg(reg);
                                setRemarks("");
                              }}
                            >
                              Review
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                              <DialogTitle>Review Regularisation Request</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>Employee</Label>
                                <p className="font-medium">
                                  {reg.userId?.name} ({reg.userId?.email})
                                </p>
                              </div>
                              <div>
                                <Label>Request Details</Label>
                                <div className="text-sm space-y-1 mt-1">
                                  <p>
                                    <strong>Date:</strong>{" "}
                                    {new Date(reg.date + "T00:00:00").toLocaleDateString()}
                                  </p>
                                  <p>
                                    <strong>Type:</strong> {reg.type}
                                  </p>
                                  <p>
                                    <strong>Reason:</strong> {reg.reason}
                                  </p>
                                </div>
                              </div>
                              {reg.originalAttendance && (
                                <div>
                                  <Label>Current Attendance</Label>
                                  <div className="text-sm mt-1 p-2 bg-muted rounded">
                                    <p>
                                      Punches: {reg.originalAttendance.punches?.length || 0}
                                    </p>
                                    <p>
                                      Hours: {reg.originalAttendance.totalHours?.toFixed(2) || 0}
                                    </p>
                                    <p>Status: {reg.originalAttendance.status || "N/A"}</p>
                                  </div>
                                </div>
                              )}
                              <div>
                                <Label htmlFor="remarks">Remarks (Optional)</Label>
                                <textarea
                                  id="remarks"
                                  value={remarks}
                                  onChange={(e) => setRemarks(e.target.value)}
                                  className="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-background text-sm mt-1"
                                  placeholder="Add remarks for your decision..."
                                />
                              </div>
                              <div className="flex justify-end gap-2 pt-2">
                                <Button
                                  variant="destructive"
                                  onClick={() => handleApproval(reg._id, "reject")}
                                  disabled={actionLoading}
                                >
                                  Reject
                                </Button>
                                <Button
                                  onClick={() => handleApproval(reg._id, "approve")}
                                  disabled={actionLoading}
                                >
                                  Approve
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

