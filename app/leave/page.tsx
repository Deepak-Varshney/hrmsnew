"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Calendar, Clock, CheckCircle2, XCircle, AlertCircle, Plus } from "lucide-react";
import Link from "next/link";

export default function LeavePage() {
  const [balances, setBalances] = useState<any>({});
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [recentLeaves, setRecentLeaves] = useState<any[]>([]);

  useEffect(() => {
    loadBalances();
    loadRecentLeaves();
  }, [year]);

  async function loadBalances() {
    setLoading(true);
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch(`/api/leave/balance?year=${year}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setBalances(data.balances || {});
      } else {
        toast.error(data.error || "Failed to load leave balances");
      }
    } catch (error) {
      toast.error("Failed to load leave balances");
    } finally {
      setLoading(false);
    }
  }

  async function loadRecentLeaves() {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch("/api/leave/history?status=Pending", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setRecentLeaves(data.leaves?.slice(0, 5) || []);
      }
    } catch (error) {
      // Ignore errors
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Approved":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "Rejected":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "Pending":
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const leaveTypes = [
    { code: "CL", name: "Casual Leave", color: "bg-blue-500" },
    { code: "SL", name: "Sick Leave", color: "bg-red-500" },
    { code: "EL", name: "Earned Leave", color: "bg-emerald-500" },
    { code: "LOP", name: "Loss of Pay", color: "bg-amber-500" },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">Leave Management</h1>
            <p className="text-muted-foreground">View balances and manage your leave requests</p>
          </div>
          <div className="flex gap-2">
            <Link href="/leave/history">
              <Button variant="outline">View History</Button>
            </Link>
            <Link href="/leave/apply">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Apply for Leave
              </Button>
            </Link>
          </div>
        </div>

        {/* Leave Balances */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Leave Balance ({year})</h2>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="px-3 py-1.5 rounded-md border border-input bg-background text-sm"
            >
              {[year - 1, year, year + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {leaveTypes.map((type) => {
              const balance = balances[type.code] || { totalCredited: 0, used: 0, balance: 0 };
              return (
                <Card key={type.code}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{type.name}</CardTitle>
                      <div className={`w-3 h-3 rounded-full ${type.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Credited:</span>
                        <span className="font-medium">{balance.totalCredited}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Used:</span>
                        <span className="font-medium">{balance.used}</span>
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t">
                        <span className="font-semibold">Balance:</span>
                        <span className="font-bold text-lg">{balance.balance}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Pending Leaves */}
        {recentLeaves.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Pending Leave Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentLeaves.map((leave: any) => (
                  <div
                    key={leave._id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(leave.status)}
                      <div>
                        <div className="font-medium">
                          {leave.leaveType} - {new Date(leave.fromDate).toLocaleDateString()} to{" "}
                          {new Date(leave.toDate).toLocaleDateString()}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Applied: {new Date(leave.appliedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {leave.approverId?.name || "Manager not assigned"}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Link href="/leave/history">
                  <Button variant="outline" className="w-full">
                    View All Leaves
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

