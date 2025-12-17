"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, XCircle, AlertCircle, Calendar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function LeaveApprovalsPage() {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeave, setSelectedLeave] = useState<any>(null);
  const [remarks, setRemarks] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadPendingLeaves();
  }, []);

  async function loadPendingLeaves() {
    setLoading(true);
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch("/api/team/leave/pending", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setLeaves(data.leaves || []);
      } else {
        toast.error(data.error || "Failed to load leave requests");
      }
    } catch (error) {
      toast.error("Failed to load leave requests");
    } finally {
      setLoading(false);
    }
  }

  async function handleApproval(leaveId: string, action: "approve" | "reject") {
    setActionLoading(true);
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Please login again");
      setActionLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/team/leave/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          leaveId,
          action,
          remarks: remarks.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setSelectedLeave(null);
        setRemarks("");
        loadPendingLeaves();
      } else {
        toast.error(data.error || "Failed to process request");
      }
    } catch (error) {
      toast.error("Failed to process request");
    } finally {
      setActionLoading(false);
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Approved":
        return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case "Rejected":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "Pending":
        return <AlertCircle className="h-5 w-5 text-amber-500" />;
      default:
        return null;
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Leave Approvals</h1>
          <p className="text-muted-foreground">
            Review and approve/reject leave requests from your team
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pending Leave Requests ({leaves.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : leaves.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No pending leave requests
              </div>
            ) : (
              <div className="space-y-4">
                {leaves.map((leave: any) => {
                  const days = leave.days || 0;
                  return (
                    <div
                      key={leave._id}
                      className="p-4 rounded-lg border bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          {getStatusIcon(leave.status)}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold text-lg">
                                {leave.userId?.name || "Unknown"}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {leave.userId?.email}
                              </span>
                            </div>
                            <div className="space-y-1 text-sm">
                              <div>
                                <strong>Leave Type:</strong> {leave.leaveType}
                                {leave.leaveType !== "LOP" && (
                                  <span className="ml-2 text-muted-foreground">
                                    (Balance: {leave.availableBalance} days)
                                  </span>
                                )}
                              </div>
                              <div>
                                <strong>Dates:</strong>{" "}
                                {new Date(leave.fromDate).toLocaleDateString()} -{" "}
                                {new Date(leave.toDate).toLocaleDateString()}
                                {leave.isHalfDay && (
                                  <span className="ml-2">
                                    ({leave.halfDayType} - Half Day)
                                  </span>
                                )}
                              </div>
                              <div>
                                <strong>Duration:</strong> {days} {days === 1 ? "day" : "days"}
                              </div>
                              <div>
                                <strong>Reason:</strong> {leave.reason}
                              </div>
                              <div className="text-xs text-muted-foreground mt-2">
                                Applied on {new Date(leave.appliedAt).toLocaleString()}
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
                                  setSelectedLeave(leave);
                                  setRemarks("");
                                }}
                              >
                                Review
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                              <DialogHeader>
                                <DialogTitle>Review Leave Request</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label>Employee</Label>
                                  <p className="font-medium">
                                    {leave.userId?.name} ({leave.userId?.email})
                                  </p>
                                </div>
                                <div>
                                  <Label>Leave Details</Label>
                                  <div className="text-sm space-y-1 mt-1">
                                    <p>
                                      <strong>Type:</strong> {leave.leaveType}
                                    </p>
                                    <p>
                                      <strong>Dates:</strong>{" "}
                                      {new Date(leave.fromDate).toLocaleDateString()} -{" "}
                                      {new Date(leave.toDate).toLocaleDateString()}
                                    </p>
                                    <p>
                                      <strong>Duration:</strong> {days} days
                                    </p>
                                    <p>
                                      <strong>Reason:</strong> {leave.reason}
                                    </p>
                                  </div>
                                </div>
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
                                    onClick={() => handleApproval(leave._id, "reject")}
                                    disabled={actionLoading}
                                  >
                                    Reject
                                  </Button>
                                  <Button
                                    onClick={() => handleApproval(leave._id, "approve")}
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
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

