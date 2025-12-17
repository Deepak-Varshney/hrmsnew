"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function RegularisationPage() {
  const [date, setDate] = useState("");
  const [type, setType] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [existingAttendance, setExistingAttendance] = useState<any>(null);
  const [regularisations, setRegularisations] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedRequest, setSelectedRequest] = useState<any>(null);

  useEffect(() => {
    if (date) {
      loadAttendanceForDate();
    }
  }, [date]);

  useEffect(() => {
    loadRegularisations();
  }, [statusFilter]);

  async function loadAttendanceForDate() {
    const token = localStorage.getItem("token");
    if (!token || !date) return;

    try {
      const res = await fetch(`/api/attendance/history?startDate=${date}&endDate=${date}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setExistingAttendance(data.attendance?.[0] || null);
      }
    } catch (error) {
      // Ignore errors
    }
  }

  async function loadRegularisations() {
    setLoadingRequests(true);
    const token = localStorage.getItem("token");
    if (!token) {
      setLoadingRequests(false);
      return;
    }

    try {
      const url = statusFilter
        ? `/api/attendance/regularisation?status=${statusFilter}`
        : "/api/attendance/regularisation";
      const res = await fetch(url, {
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
      setLoadingRequests(false);
    }
  }

  function getStatusDisplay(status: string, reviewedAt?: Date) {
    if (status === "Approved") {
      return { text: "Approved", icon: CheckCircle2, color: "text-green-600", bgColor: "bg-green-50" };
    }
    if (status === "Rejected") {
      return { text: "Rejected", icon: XCircle, color: "text-red-600", bgColor: "bg-red-50" };
    }
    if (status === "Pending" && reviewedAt) {
      return { text: "Seen / Under review", icon: Eye, color: "text-blue-600", bgColor: "bg-blue-50" };
    }
    return { text: "Pending / Not yet seen", icon: Clock, color: "text-amber-600", bgColor: "bg-amber-50" };
  }

  async function submitRequest() {
    if (!date || !type || !reason.trim()) {
      toast.error("Please fill all required fields");
      return;
    }

    setLoading(true);
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Please login again");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/attendance/regularisation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          date,
          type,
          reason,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const managerName = data.managerName || "your manager";
        toast.success(
          `Regularisation request submitted successfully. The request has been successfully sent to ${managerName}.`
        );
        setDate("");
        setType("");
        setReason("");
        setExistingAttendance(null);
        loadRegularisations(); // Refresh the list
      } else {
        toast.error(data.error || "Failed to submit request");
      }
    } catch (error) {
      toast.error("Failed to submit request");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Attendance Regularisation</h1>
          <p className="text-muted-foreground">
            Request correction for missed attendance or work from home
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Submit Regularisation Request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                required
              />
            </div>

            {existingAttendance && (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm font-medium mb-2">Current Attendance for this date:</p>
                <div className="text-sm space-y-1">
                  <p>
                    Punches: {existingAttendance.punches?.length || 0}
                  </p>
                  <p>
                    Status: {existingAttendance.status || "N/A"}
                  </p>
                  {existingAttendance.totalHours && (
                    <p>Total Hours: {existingAttendance.totalHours.toFixed(2)}</p>
                  )}
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="type">Type *</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Forgot Punch">Forgot Punch</SelectItem>
                  <SelectItem value="Work From Home">Work From Home</SelectItem>
                  <SelectItem value="On Duty">On Duty</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="reason">Reason *</Label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full min-h-[100px] px-3 py-2 rounded-md border border-input bg-background text-sm"
                placeholder="Please provide a detailed reason..."
                required
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setDate("");
                setType("");
                setReason("");
                setExistingAttendance(null);
              }}>
                Clear
              </Button>
              <Button onClick={submitRequest} disabled={loading}>
                {loading ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>My Regularisation Requests</CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="status-filter" className="text-sm">Filter by Status:</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="status-filter" className="w-[180px]">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingRequests ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : regularisations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No regularisation requests found
              </div>
            ) : (
              <div className="space-y-4">
                {regularisations.map((reg: any) => {
                  const statusDisplay = getStatusDisplay(reg.status, reg.reviewedAt);
                  const StatusIcon = statusDisplay.icon;
                  return (
                    <div
                      key={reg._id}
                      className="p-4 rounded-lg border bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                      onClick={() => setSelectedRequest(reg)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <StatusIcon className={`h-5 w-5 mt-1 ${statusDisplay.color}`} />
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="font-semibold">
                                {new Date(reg.date + "T00:00:00").toLocaleDateString()}
                              </span>
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${statusDisplay.color} ${statusDisplay.bgColor}`}
                              >
                                {statusDisplay.text}
                              </span>
                            </div>
                            <div className="space-y-1 text-sm">
                              <div>
                                <strong>Type:</strong> {reg.type}
                              </div>
                              <div>
                                <strong>Reason:</strong> {reg.reason.substring(0, 100)}
                                {reg.reason.length > 100 && "..."}
                              </div>
                              <div className="text-xs text-muted-foreground mt-2">
                                Applied on {new Date(reg.appliedAt).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRequest(reg);
                          }}
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedRequest && (
          <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Regularisation Request Details</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Date</Label>
                  <p className="font-medium">
                    {new Date(selectedRequest.date + "T00:00:00").toLocaleDateString()}
                  </p>
                </div>

                <div>
                  <Label>Type</Label>
                  <p className="font-medium">{selectedRequest.type}</p>
                </div>

                <div>
                  <Label>Reason</Label>
                  <p className="text-sm mt-1">{selectedRequest.reason}</p>
                </div>

                <div>
                  <Label>Current Status</Label>
                  <div className="mt-1">
                    {(() => {
                      const statusDisplay = getStatusDisplay(
                        selectedRequest.status,
                        selectedRequest.reviewedAt
                      );
                      const StatusIcon = statusDisplay.icon;
                      return (
                        <div className="flex items-center gap-2">
                          <StatusIcon className={`h-4 w-4 ${statusDisplay.color}`} />
                          <span className={`font-medium ${statusDisplay.color}`}>
                            {statusDisplay.text}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {selectedRequest.originalAttendance && (
                  <div>
                    <Label>Original Attendance Data</Label>
                    <div className="text-sm mt-1 p-3 bg-muted rounded">
                      <div className="space-y-1">
                        <p>
                          <strong>Punches:</strong>{" "}
                          {selectedRequest.originalAttendance.punches?.length || 0}
                        </p>
                        {selectedRequest.originalAttendance.totalHours !== undefined && (
                          <p>
                            <strong>Total Hours:</strong>{" "}
                            {selectedRequest.originalAttendance.totalHours.toFixed(2)}
                          </p>
                        )}
                        <p>
                          <strong>Status:</strong>{" "}
                          {selectedRequest.originalAttendance.status || "N/A"}
                        </p>
                        {selectedRequest.originalAttendance.punches &&
                          selectedRequest.originalAttendance.punches.length > 0 && (
                            <div className="mt-2">
                              <strong>Punch Details:</strong>
                              <ul className="list-disc list-inside mt-1 space-y-1">
                                {selectedRequest.originalAttendance.punches.map(
                                  (punch: any, idx: number) => (
                                    <li key={idx}>
                                      {new Date(punch.time).toLocaleString()} - {punch.type}
                                    </li>
                                  )
                                )}
                              </ul>
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                )}

                {selectedRequest.approverRemarks && (
                  <div>
                    <Label>Manager Remarks</Label>
                    <div className="text-sm mt-1 p-3 bg-muted rounded">
                      {selectedRequest.approverRemarks}
                    </div>
                    {selectedRequest.reviewedAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Reviewed on {new Date(selectedRequest.reviewedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  <p>
                    <strong>Applied on:</strong> {new Date(selectedRequest.appliedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </DashboardLayout>
  );
}

