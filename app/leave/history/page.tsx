"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, XCircle, AlertCircle, Calendar } from "lucide-react";
import Link from "next/link";

export default function LeaveHistoryPage() {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: "",
    leaveType: "",
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    loadLeaves();
  }, [filters]);

  async function loadLeaves() {
    setLoading(true);
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const params = new URLSearchParams();
      if (filters.status) params.append("status", filters.status);
      if (filters.leaveType) params.append("leaveType", filters.leaveType);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);

      const res = await fetch(`/api/leave/history?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setLeaves(data.leaves || []);
      } else {
        toast.error(data.error || "Failed to load leave history");
      }
    } catch (error) {
      toast.error("Failed to load leave history");
    } finally {
      setLoading(false);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Approved":
        return "bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800";
      case "Rejected":
        return "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800";
      case "Pending":
        return "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800";
      default:
        return "bg-muted";
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">Leave History</h1>
            <p className="text-muted-foreground">View and track all your leave requests</p>
          </div>
          <Link href="/leave/apply">
            <Button>Apply for Leave</Button>
          </Link>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Status</Label>
                <Select
                  value={filters.status}
                  onValueChange={(value) =>
                    setFilters({ ...filters, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Status</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Leave Type</Label>
                <Select
                  value={filters.leaveType}
                  onValueChange={(value) =>
                    setFilters({ ...filters, leaveType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Types</SelectItem>
                    <SelectItem value="CL">Casual Leave</SelectItem>
                    <SelectItem value="SL">Sick Leave</SelectItem>
                    <SelectItem value="EL">Earned Leave</SelectItem>
                    <SelectItem value="LOP">Loss of Pay</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) =>
                    setFilters({ ...filters, startDate: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) =>
                    setFilters({ ...filters, endDate: e.target.value })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leave List */}
        <Card>
          <CardHeader>
            <CardTitle>Leave Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : leaves.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No leave requests found
              </div>
            ) : (
              <div className="space-y-3">
                {leaves.map((leave: any) => {
                  let days = 0;
                  if (leave.isHalfDay) {
                    days = 0.5;
                  } else {
                    const from = new Date(leave.fromDate);
                    const to = new Date(leave.toDate);
                    const currentDate = new Date(from);
                    while (currentDate <= to) {
                      const dayOfWeek = currentDate.getDay();
                      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                        days++;
                      }
                      currentDate.setDate(currentDate.getDate() + 1);
                    }
                  }
                  return (
                    <div
                      key={leave._id}
                      className={`p-4 rounded-lg border ${getStatusColor(leave.status)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          {getStatusIcon(leave.status)}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold">{leave.leaveType}</span>
                              <span className="text-sm text-muted-foreground">•</span>
                              <span className="text-sm">
                                {new Date(leave.fromDate).toLocaleDateString()} -{" "}
                                {new Date(leave.toDate).toLocaleDateString()}
                              </span>
                              {leave.isHalfDay && (
                                <span className="text-xs bg-background px-2 py-0.5 rounded">
                                  {leave.halfDayType}
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground mb-2">
                              {days} {days === 1 ? "day" : "days"} • Applied on{" "}
                              {new Date(leave.appliedAt).toLocaleDateString()}
                            </div>
                            <div className="text-sm">{leave.reason}</div>
                            {leave.approverRemarks && (
                              <div className="mt-2 text-sm">
                                <strong>Remarks:</strong> {leave.approverRemarks}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="font-medium mb-1">
                            {leave.status}
                          </div>
                          {leave.approverId && (
                            <div className="text-muted-foreground">
                              by {leave.approverId.name}
                            </div>
                          )}
                          {leave.reviewedAt && (
                            <div className="text-muted-foreground text-xs">
                              {new Date(leave.reviewedAt).toLocaleDateString()}
                            </div>
                          )}
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

