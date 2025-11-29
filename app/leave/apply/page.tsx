"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Calendar, Info } from "lucide-react";

export default function ApplyLeavePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    leaveType: "",
    fromDate: "",
    toDate: "",
    isHalfDay: false,
    halfDayType: "",
    reason: "",
  });
  const [balance, setBalance] = useState<any>(null);
  const [managerName, setManagerName] = useState("");

  useEffect(() => {
    if (formData.leaveType && formData.leaveType !== "LOP") {
      loadBalance();
    }
  }, [formData.leaveType]);

  async function loadBalance() {
    const token = localStorage.getItem("token");
    if (!token || !formData.leaveType) return;

    try {
      const res = await fetch(`/api/leave/balance?year=${new Date().getFullYear()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        const bal = data.balances[formData.leaveType];
        setBalance(bal);
      }
    } catch (error) {
      // Ignore errors
    }
  }

  function calculateDays() {
    if (!formData.fromDate || !formData.toDate) return 0;
    if (formData.isHalfDay) return 0.5;

    const from = new Date(formData.fromDate);
    const to = new Date(formData.toDate);
    let days = 0;
    const currentDate = new Date(from);

    while (currentDate <= to) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        days++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return days;
  }

  async function submitLeave() {
    if (!formData.leaveType || !formData.fromDate || !formData.toDate || !formData.reason.trim()) {
      toast.error("Please fill all required fields");
      return;
    }

    if (formData.isHalfDay && !formData.halfDayType) {
      toast.error("Please select half day type");
      return;
    }

    const days = calculateDays();
    if (formData.leaveType !== "LOP" && balance && balance.balance < days) {
      toast.error(`Insufficient leave balance. Available: ${balance.balance}, Required: ${days}`);
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
      const res = await fetch("/api/leave/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          leaveType: formData.leaveType,
          fromDate: formData.fromDate,
          toDate: formData.toDate,
          isHalfDay: formData.isHalfDay,
          halfDayType: formData.isHalfDay ? formData.halfDayType : undefined,
          reason: formData.reason,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Leave request submitted successfully");
        setManagerName(data.managerName || "");
        router.push("/leave/history");
      } else {
        toast.error(data.error || "Failed to submit leave request");
      }
    } catch (error) {
      toast.error("Failed to submit leave request");
    } finally {
      setLoading(false);
    }
  }

  const days = calculateDays();
  const leaveTypes = [
    { value: "CL", label: "Casual Leave (CL)" },
    { value: "SL", label: "Sick Leave (SL)" },
    { value: "EL", label: "Earned Leave (EL)" },
    { value: "LOP", label: "Loss of Pay (LOP)" },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Apply for Leave</h1>
          <p className="text-muted-foreground">Submit a leave request for approval</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Leave Application Form</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="leaveType">Leave Type *</Label>
              <Select
                value={formData.leaveType}
                onValueChange={(value) =>
                  setFormData({ ...formData, leaveType: value })
                }
              >
                <SelectTrigger id="leaveType">
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.leaveType && formData.leaveType !== "LOP" && balance && (
                <div className="mt-2 p-2 bg-muted rounded-md text-sm">
                  <Info className="h-4 w-4 inline mr-1" />
                  Available Balance: <strong>{balance.balance}</strong> days
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fromDate">From Date *</Label>
                <Input
                  id="fromDate"
                  type="date"
                  value={formData.fromDate}
                  onChange={(e) =>
                    setFormData({ ...formData, fromDate: e.target.value })
                  }
                  min={new Date().toISOString().split("T")[0]}
                  required
                />
              </div>
              <div>
                <Label htmlFor="toDate">To Date *</Label>
                <Input
                  id="toDate"
                  type="date"
                  value={formData.toDate}
                  onChange={(e) =>
                    setFormData({ ...formData, toDate: e.target.value })
                  }
                  min={formData.fromDate || new Date().toISOString().split("T")[0]}
                  required
                />
              </div>
            </div>

            {formData.fromDate && formData.toDate && (
              <div className="p-3 bg-muted rounded-md">
                <div className="text-sm">
                  <strong>Total Days:</strong> {days} {days === 1 ? "day" : "days"}
                  {formData.isHalfDay && " (Half Day)"}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isHalfDay"
                checked={formData.isHalfDay}
                onChange={(e) =>
                  setFormData({ ...formData, isHalfDay: e.target.checked, halfDayType: "" })
                }
                className="rounded"
              />
              <Label htmlFor="isHalfDay" className="cursor-pointer">
                Half Day
              </Label>
            </div>

            {formData.isHalfDay && (
              <div>
                <Label htmlFor="halfDayType">Half Day Type *</Label>
                <Select
                  value={formData.halfDayType}
                  onValueChange={(value) =>
                    setFormData({ ...formData, halfDayType: value })
                  }
                >
                  <SelectTrigger id="halfDayType">
                    <SelectValue placeholder="Select half day type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="First Half">First Half</SelectItem>
                    <SelectItem value="Second Half">Second Half</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="reason">Reason *</Label>
              <textarea
                id="reason"
                value={formData.reason}
                onChange={(e) =>
                  setFormData({ ...formData, reason: e.target.value })
                }
                className="w-full min-h-[100px] px-3 py-2 rounded-md border border-input bg-background text-sm"
                placeholder="Please provide a detailed reason for your leave request..."
                required
              />
            </div>

            {formData.leaveType && formData.leaveType !== "LOP" && balance && days > balance.balance && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md">
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Warning:</strong> You are requesting {days} days but only have{" "}
                  {balance.balance} days available. Consider using Loss of Pay (LOP) for
                  additional days.
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => router.back()}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button onClick={submitLeave} disabled={loading}>
                {loading ? "Submitting..." : "Submit Leave Request"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

