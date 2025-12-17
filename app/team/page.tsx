"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Users, CheckCircle2, XCircle, Clock, Calendar } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function TeamOverviewPage() {
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTeamOverview();
    // Refresh every 30 seconds for live updates
    const interval = setInterval(loadTeamOverview, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadTeamOverview() {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch("/api/team/overview", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setTeamMembers(data.teamMembers || []);
      } else {
        toast.error(data.error || "Failed to load team overview");
      }
    } catch (error) {
      toast.error("Failed to load team overview");
    } finally {
      setLoading(false);
    }
  }

  const getStatusBadge = (status: string, statusColor: string) => {
    const colorMap: any = {
      "text-emerald-500": "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300",
      "text-red-500": "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300",
      "text-amber-500": "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300",
      "text-blue-500": "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300",
    };

    const bgColor = colorMap[statusColor] || "bg-muted";
    return (
      <span className={`px-2 py-1 rounded-md text-xs font-medium ${bgColor}`}>
        {status}
      </span>
    );
  };

  const stats = {
    present: teamMembers.filter((m) => m.status === "Present").length,
    absent: teamMembers.filter((m) => m.status === "Absent").length,
    onLeave: teamMembers.filter((m) => m.status === "On Leave").length,
    checkedOut: teamMembers.filter((m) => m.status === "Checked Out").length,
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">Team Overview</h1>
            <p className="text-muted-foreground">Live view of your team's presence and status</p>
          </div>
          <div className="flex gap-2">
            <Link href="/team/attendance">
              <Button variant="outline">View Attendance</Button>
            </Link>
            <Link href="/team/leave">
              <Button variant="outline">Leave Approvals</Button>
            </Link>
            <Link href="/team/regularisation">
              <Button variant="outline">Regularisation</Button>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Present</p>
                  <p className="text-2xl font-bold text-emerald-600">{stats.present}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Absent</p>
                  <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">On Leave</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.onLeave}</p>
                </div>
                <Calendar className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Checked Out</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.checkedOut}</p>
                </div>
                <Clock className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Team Members List */}
        <Card>
          <CardHeader>
            <CardTitle>Team Members ({teamMembers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : teamMembers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No team members found. Team members are assigned by HR.
              </div>
            ) : (
              <div className="space-y-3">
                {teamMembers.map((member) => (
                  <div
                    key={member.employeeId}
                    className="flex items-center justify-between p-4 rounded-lg border bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">{member.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {member.designation || "Employee"}
                          {member.department && ` • ${member.department}`}
                          {member.employeeCode && ` • ${member.employeeCode}`}
                        </div>
                        {member.details && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {member.details}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(member.status, member.statusColor)}
                      {member.attendance && (
                        <div className="text-sm text-muted-foreground">
                          {member.attendance.totalHours.toFixed(1)}h
                        </div>
                      )}
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

