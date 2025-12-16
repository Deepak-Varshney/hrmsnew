"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Calendar, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TeamAttendancePage() {
  const [attendance, setAttendance] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    employeeId: "",
    month: new Date().toISOString().slice(0, 7),
  });

  useEffect(() => {
    loadAttendance();
  }, [filters]);

  async function loadAttendance() {
    setLoading(true);
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const params = new URLSearchParams();
      if (filters.employeeId) params.append("employeeId", filters.employeeId);
      if (filters.month) params.append("month", filters.month);

      const res = await fetch(`/api/team/attendance?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setAttendance(data.attendance || []);
        setEmployees(data.employees || []);
      } else {
        toast.error(data.error || "Failed to load attendance");
      }
    } catch (error) {
      toast.error("Failed to load attendance");
    } finally {
      setLoading(false);
    }
  }

  function exportToExcel() {
    // Simple CSV export for now
    const headers = ["Employee", "Date", "Status", "Check-In", "Check-Out", "Total Hours"];
    const rows = attendance.map((record: any) => [
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
    a.download = `team-attendance-${filters.month}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Attendance exported successfully");
  }

  // Group attendance by employee
  const groupedAttendance: any = {};
  attendance.forEach((record: any) => {
    const empId = record.userId?._id || record.userId;
    if (!groupedAttendance[empId]) {
      groupedAttendance[empId] = {
        employee: record.userId,
        records: [],
      };
    }
    groupedAttendance[empId].records.push(record);
  });

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">Team Attendance</h1>
            <p className="text-muted-foreground">View detailed attendance for your team</p>
          </div>
          <Button onClick={exportToExcel} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export to Excel
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Employee</Label>
                <Select
                  value={filters.employeeId}
                  onValueChange={(value) =>
                    setFilters({ ...filters, employeeId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Employees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allemp">All Employees</SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name} {emp.employeeCode && `(${emp.employeeCode})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Month</Label>
                <Input
                  type="month"
                  value={filters.month}
                  onChange={(e) =>
                    setFilters({ ...filters, month: e.target.value })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attendance List */}
        <Card>
          <CardHeader>
            <CardTitle>Attendance Records</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : Object.keys(groupedAttendance).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No attendance records found
              </div>
            ) : (
              <div className="space-y-6">
                {Object.values(groupedAttendance).map((group: any) => (
                  <div key={group.employee._id || group.employee} className="space-y-2">
                    <h3 className="font-semibold text-lg mb-3">
                      {group.employee.name || group.employee}
                      {group.employee.email && (
                        <span className="text-sm text-muted-foreground ml-2">
                          ({group.employee.email})
                        </span>
                      )}
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Date</th>
                            <th className="text-left p-2">Status</th>
                            <th className="text-left p-2">Check-In</th>
                            <th className="text-left p-2">Check-Out</th>
                            <th className="text-left p-2">Total Hours</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.records.map((record: any) => {
                            const inPunch = record.punches?.find((p: any) => p.type === "IN");
                            const outPunch = record.punches?.find((p: any) => p.type === "OUT");
                            return (
                              <tr key={record._id} className="border-b hover:bg-muted/50">
                                <td className="p-2">
                                  {new Date(record.date + "T00:00:00").toLocaleDateString()}
                                </td>
                                <td className="p-2">
                                  <span
                                    className={`px-2 py-1 rounded text-xs ${
                                      record.status === "Present"
                                        ? "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300"
                                        : record.status === "Absent"
                                        ? "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                                        : "bg-muted"
                                    }`}
                                  >
                                    {record.status || "N/A"}
                                  </span>
                                </td>
                                <td className="p-2">
                                  {inPunch
                                    ? new Date(inPunch.time).toLocaleTimeString()
                                    : "-"}
                                </td>
                                <td className="p-2">
                                  {outPunch
                                    ? new Date(outPunch.time).toLocaleTimeString()
                                    : "-"}
                                </td>
                                <td className="p-2">
                                  {record.totalHours
                                    ? `${record.totalHours.toFixed(2)} hrs`
                                    : "-"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
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

