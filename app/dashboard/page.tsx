// app/dashboard/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Pin, Bell } from "lucide-react";
import Link from "next/link";

export default function Dashboard() {
  const router = useRouter();
  const [attendance, setAttendance] = useState<any>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    
    fetch("/api/attendance/today", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(j => setAttendance(j.attendance || null));
    
    fetch("/api/announcements?isPinned=true", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => {
        if (j.announcements) {
          // Get pinned announcements and up to 3 most recent regular announcements
          const pinned = j.announcements.filter((a: any) => a.isPinned);
          fetch("/api/announcements", { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then(j2 => {
              if (j2.announcements) {
                const regular = j2.announcements.filter((a: any) => !a.isPinned).slice(0, 3);
                setAnnouncements([...pinned, ...regular].slice(0, 5));
              }
            });
        }
      });
  }, []);

  async function punch() {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/attendance/punch", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({}) });
    const j = await res.json();
    if (!res.ok) {
      if (j.error && j.error.toLowerCase().includes("unauthorized")) {
        localStorage.removeItem("token");
        toast.error("Please login again");
        return router.push("/auth/login");
      }
      toast.error(j.error || "Punch failed");
      return;
    }
    setAttendance(j.attendance);
    const last = j.attendance.punches.slice(-1)[0];
    toast.success(`Attendance recorded: ${last.type} at ${new Date(last.time).toLocaleTimeString()}`);
  }


  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your overview.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Today's Attendance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                {attendance ? (
                  <>
                    <div className="mb-2 font-medium">Punches:</div>
                    <ul className="list-disc ml-6 mb-2 space-y-1">
                      {attendance.punches.map((p: any, i: number) => (
                        <li key={i} className="text-sm">
                          {p.type} — {new Date(p.time).toLocaleTimeString()}
                        </li>
                      ))}
                    </ul>
                    <div className="text-lg font-semibold">
                      Total hours: {attendance.totalHours ?? 0}
                    </div>
                  </>
                ) : (
                  <div className="text-muted-foreground">No punches yet.</div>
                )}
              </div>

              <Button onClick={punch} className="w-full">
                Check-In / Check-Out
              </Button>
            </CardContent>
          </Card>

        </div>

        {/* Announcements Section */}
        {announcements.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  <CardTitle>Announcements</CardTitle>
                </div>
                <Link href="/announcements">
                  <Button variant="outline" size="sm">
                    View All
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {announcements.map((announcement) => (
                  <div
                    key={announcement._id}
                    className={`p-4 rounded-lg border ${
                      announcement.isPinned
                        ? "bg-primary/5 border-primary/50"
                        : "bg-muted/50"
                    }`}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      {announcement.isPinned && (
                        <Pin className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <h3 className="font-semibold">{announcement.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {new Date(announcement.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm whitespace-pre-wrap line-clamp-3">
                      {announcement.content}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
