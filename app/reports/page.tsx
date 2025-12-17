"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Download, FileText, Calendar, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Note: Tabs component might not exist, we'll create a simple one or use divs
export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("attendance");
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [leaveData, setLeaveData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    department: "",
  });

  async function loadAttendanceReport() {
    setLoading(true);
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const params = new URLSearchParams();
      params.append("startDate", filters.startDate);
      params.append("endDate", filters.endDate);
      if (filters.department) params.append("department", filters.department);

      const res = await fetch(`/api/reports/attendance?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setAttendanceData(data);
      } else {
        toast.error(data.error || "Failed to load attendance report");
      }
    } catch (error) {
      toast.error("Failed to load attendance report");
    } finally {
      setLoading(false);
    }
  }

  async function loadLeaveReport() {
    setLoading(true);
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const params = new URLSearchParams();
      params.append("startDate", filters.startDate);
      params.append("endDate", filters.endDate);
      if (filters.department) params.append("department", filters.department);

      const res = await fetch(`/api/reports/leave?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setLeaveData(data);
      } else {
        toast.error(data.error || "Failed to load leave report");
      }
    } catch (error) {
      toast.error("Failed to load leave report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "attendance") {
      loadAttendanceReport();
    } else if (activeTab === "leave") {
      loadLeaveReport();
    }
  }, [activeTab, filters]);

  function exportAttendance() {
    if (!attendanceData) return;

    const headers = ["Employee", "Date", "Status", "Check-In", "Check-Out", "Total Hours"];
    const rows = attendanceData.attendance.map((record: any) => [
      record.userId?.name || "N/A",
      record.date,
      record.status || "N/A",
      record.punches?.find((p: any) => p.type === "IN")
        ? new Date(record.punches.find((p: any) => p.type === "IN").time).toLocaleTimeString()
        : "-",
      record.punches?.find((p: any) => p.type === "OUT")
        ? new Date(record.punches.find((p: any) => p.type === "OUT").time).toLocaleTimeString()
        : "-",
      record.totalHours?.toFixed(2) || "0",
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-report-${filters.startDate}-${filters.endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Report exported successfully");
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Reports</h1>
          <p className="text-muted-foreground">View and export system-wide reports</p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <div>
                <Label>Department</Label>
                <Input
                  value={filters.department}
                  onChange={(e) =>
                    setFilters({ ...filters, department: e.target.value })
                  }
                  placeholder="All Departments"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="border-b">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("attendance")}
              className={`pb-2 px-1 border-b-2 ${
                activeTab === "attendance"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground"
              }`}
            >
              Attendance Report
            </button>
            <button
              onClick={() => setActiveTab("leave")}
              className={`pb-2 px-1 border-b-2 ${
                activeTab === "leave"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground"
              }`}
            >
              Leave Report
            </button>
          </div>
        </div>

        {/* Attendance Report */}
        {activeTab === "attendance" && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Attendance Report</CardTitle>
                <Button onClick={exportAttendance} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : attendanceData ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="text-sm text-muted-foreground">Total Records</div>
                      <div className="text-2xl font-bold">{attendanceData.summary.totalRecords}</div>
                    </div>
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950 rounded-lg">
                      <div className="text-sm text-muted-foreground">Present</div>
                      <div className="text-2xl font-bold text-emerald-600">
                        {attendanceData.summary.present}
                      </div>
                    </div>
                    <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                      <div className="text-sm text-muted-foreground">Absent</div>
                      <div className="text-2xl font-bold text-red-600">
                        {attendanceData.summary.absent}
                      </div>
                    </div>
                    <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                      <div className="text-sm text-muted-foreground">Total Hours</div>
                      <div className="text-2xl font-bold text-blue-600">
                        {attendanceData.summary.totalHours.toFixed(1)}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Showing {attendanceData.attendance.length} records
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">No data available</div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Leave Report */}
        {activeTab === "leave" && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Leave Report</CardTitle>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : leaveData ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="text-sm text-muted-foreground">Total Requests</div>
                      <div className="text-2xl font-bold">{leaveData.summary.total}</div>
                    </div>
                    <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg">
                      <div className="text-sm text-muted-foreground">Pending</div>
                      <div className="text-2xl font-bold text-amber-600">
                        {leaveData.summary.pending}
                      </div>
                    </div>
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950 rounded-lg">
                      <div className="text-sm text-muted-foreground">Approved</div>
                      <div className="text-2xl font-bold text-emerald-600">
                        {leaveData.summary.approved}
                      </div>
                    </div>
                    <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                      <div className="text-sm text-muted-foreground">Rejected</div>
                      <div className="text-2xl font-bold text-red-600">
                        {leaveData.summary.rejected}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Showing {leaveData.leaves.length} records
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">No data available</div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

