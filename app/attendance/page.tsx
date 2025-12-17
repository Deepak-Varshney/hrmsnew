"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Link from "next/link";
import AttendanceCalendar from "@/components/AttendanceCalendar";

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

  const handleDateClick = (date: string) => {
    const record = attendance.find((r) => r.date === date);
    if (record) {
      const inPunch = record.punches?.find((p: any) => p.type === "IN");
      const outPunch = record.punches?.find((p: any) => p.type === "OUT");
      const details = [
        `Status: ${record.status || "N/A"}`,
        inPunch ? `Check-In: ${new Date(inPunch.time).toLocaleTimeString()}` : "Check-In: -",
        outPunch ? `Check-Out: ${new Date(outPunch.time).toLocaleTimeString()}` : "Check-Out: -",
        record.totalHours ? `Total Hours: ${record.totalHours.toFixed(2)} hrs` : "Total Hours: -",
      ].join("\n");
      toast.info(details, { duration: 5000 });
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
            ) : (
              <AttendanceCalendar
                attendance={attendance}
                month={month}
                onDateClick={handleDateClick}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

