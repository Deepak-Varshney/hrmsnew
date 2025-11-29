"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Calendar, Clock, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";

export default function AttendancePage() {
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  useEffect(() => {
    loadAttendance();
  }, [month]);

  async function loadAttendance() {
    setLoading(true);
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch(`/api/attendance/history?month=${month}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setAttendance(data.attendance || []);
      } else {
        toast.error(data.error || "Failed to load attendance");
      }
    } catch (error) {
      toast.error("Failed to load attendance");
    } finally {
      setLoading(false);
    }
  }

  async function punch() {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch("/api/attendance/punch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Attendance recorded: ${data.attendance.punches[data.attendance.punches.length - 1].type}`);
        loadAttendance();
      } else {
        toast.error(data.error || "Failed to record attendance");
      }
    } catch (error) {
      toast.error("Failed to record attendance");
    }
  }

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "Present":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "Absent":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">Attendance</h1>
            <p className="text-muted-foreground">View and manage your attendance records</p>
          </div>
          <div className="flex gap-2">
            <Link href="/attendance/regularisation">
              <Button variant="outline">Request Regularisation</Button>
            </Link>
            <Button onClick={punch}>Check-In / Check-Out</Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Attendance History</CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="month">Month:</Label>
                <Input
                  id="month"
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="w-auto"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : attendance.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No attendance records found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
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
                    {attendance.map((record) => {
                      const inPunch = record.punches?.find((p: any) => p.type === "IN");
                      const outPunch = record.punches?.find((p: any) => p.type === "OUT");
                      return (
                        <tr key={record._id} className="border-b hover:bg-muted/50">
                          <td className="p-2">
                            {new Date(record.date + "T00:00:00").toLocaleDateString()}
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(record.status)}
                              <span>{record.status || "N/A"}</span>
                            </div>
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
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

