// app/dashboard/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DashboardLayout from "@/components/DashboardLayout";

export default function Dashboard() {
  const router = useRouter();
  const [attendance, setAttendance] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalName, setModalName] = useState("");
  const [modalEmail, setModalEmail] = useState("");
  const [modalRole, setModalRole] = useState("Employee");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    
    fetch("/api/attendance/today", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(j => setAttendance(j.attendance || null));
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

  async function createTestUser() {
    const token = localStorage.getItem("token");
    if (!modalName || !modalEmail) {
      toast.error("Name and email required");
      return;
    }
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: modalName, email: modalEmail, password: "Temp@1234", role: modalRole })
    });
    const j = await res.json();
    if (!res.ok) {
      toast.error(j.error || "Create user failed");
      return;
    }
    toast.success(`User created: ${j.user.email}`);
    setModalName("");
    setModalEmail("");
    setModalRole("Employee");
    setModalOpen(false);
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

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    Create Test User
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create test user</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4">
                    <div>
                      <Label>Name</Label>
                      <Input 
                        value={modalName} 
                        onChange={(e) => setModalName(e.target.value)} 
                        placeholder="Enter name"
                      />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input 
                        value={modalEmail} 
                        onChange={(e) => setModalEmail(e.target.value)} 
                        placeholder="Enter email"
                        type="email"
                      />
                    </div>
                    <div>
                      <Label>Role</Label>
                      <Input 
                        value={modalRole} 
                        onChange={(e) => setModalRole(e.target.value)} 
                        placeholder="Employee"
                      />
                    </div>
                    <div className="flex justify-end gap-2 mt-2">
                      <Button variant="outline" onClick={() => setModalOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={createTestUser}>Create</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
