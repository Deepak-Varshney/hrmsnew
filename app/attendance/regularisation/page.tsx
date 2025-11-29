"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FileText } from "lucide-react";

// Note: Textarea component might not exist, we'll create it or use a div
// For now, let's check if it exists or create a simple one

export default function RegularisationPage() {
  const [date, setDate] = useState("");
  const [type, setType] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [existingAttendance, setExistingAttendance] = useState<any>(null);

  useEffect(() => {
    if (date) {
      loadAttendanceForDate();
    }
  }, [date]);

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
        toast.success("Regularisation request submitted successfully");
        setDate("");
        setType("");
        setReason("");
        setExistingAttendance(null);
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
      <div className="max-w-3xl mx-auto space-y-6">
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
      </div>
    </DashboardLayout>
  );
}

