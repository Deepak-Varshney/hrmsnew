"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Settings as SettingsIcon, Save } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    officeStartTime: "09:00",
    officeEndTime: "18:00",
    weeklyOffs: ["Sunday"],
    geoFenceEnabled: false,
    geoFenceRadius: 100,
    ipRestrictionEnabled: false,
    allowedIPs: "",
  });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/auth/login");
      return;
    }

    // Check user role
    fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => {
        if (j.error) {
          localStorage.removeItem("token");
          toast.error("Session expired");
          router.push("/auth/login");
          return;
        }
        if (j.user.role !== "Admin") {
          toast.error("Access denied. Admin only.");
          router.push("/dashboard");
          return;
        }
        setUser(j.user);
        loadSettings(token);
      })
      .catch(() => {
        localStorage.removeItem("token");
        toast.error("Session error");
        router.push("/auth/login");
      });
  }, [router]);

  async function loadSettings(token: string) {
    try {
      const res = await fetch("/api/settings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.settings) {
        setFormData({
          officeStartTime: data.settings.officeStartTime || "09:00",
          officeEndTime: data.settings.officeEndTime || "18:00",
          weeklyOffs: data.settings.weeklyOffs || ["Sunday"],
          geoFenceEnabled: data.settings.geoFenceEnabled || false,
          geoFenceRadius: data.settings.geoFenceRadius || 100,
          ipRestrictionEnabled: data.settings.ipRestrictionEnabled || false,
          allowedIPs: data.settings.allowedIPs || "",
        });
      } else {
        toast.error(data.error || "Failed to load settings");
      }
    } catch (error) {
      toast.error("Failed to load settings");
    } finally {
      setLoadingSettings(false);
    }
  }

  async function saveSettings() {
    setLoading(true);
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Please login again");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Settings saved successfully");
      } else {
        toast.error(data.error || "Failed to save settings");
      }
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setLoading(false);
    }
  }

  if (loadingSettings || !user) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading settings...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (user && user.role !== "Admin") {
    return null; // Will redirect
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">Configure system settings and preferences</p>
        </div>

        {/* Office Timings */}
        <Card>
          <CardHeader>
            <CardTitle>Office Timings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Office Start Time</Label>
                <Input
                  type="time"
                  value={formData.officeStartTime}
                  onChange={(e) =>
                    setFormData({ ...formData, officeStartTime: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Office End Time</Label>
                <Input
                  type="time"
                  value={formData.officeEndTime}
                  onChange={(e) =>
                    setFormData({ ...formData, officeEndTime: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <Label>Weekly Offs</Label>
              <div className="flex gap-2 mt-2">
                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(
                  (day) => (
                    <label key={day} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.weeklyOffs.includes(day)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              weeklyOffs: [...formData.weeklyOffs, day],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              weeklyOffs: formData.weeklyOffs.filter((d) => d !== day),
                            });
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{day.slice(0, 3)}</span>
                    </label>
                  )
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attendance Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Attendance Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Geo-fence Attendance</Label>
                <p className="text-sm text-muted-foreground">
                  Require GPS location for attendance marking
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.geoFenceEnabled}
                  onChange={(e) =>
                    setFormData({ ...formData, geoFenceEnabled: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
            {formData.geoFenceEnabled && (
              <div>
                <Label>Geo-fence Radius (meters)</Label>
                <Input
                  type="number"
                  value={formData.geoFenceRadius}
                  onChange={(e) =>
                    setFormData({ ...formData, geoFenceRadius: parseInt(e.target.value) })
                  }
                  min={50}
                  max={1000}
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t">
              <div>
                <Label>IP-based Restriction</Label>
                <p className="text-sm text-muted-foreground">
                  Restrict attendance to office network IPs
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.ipRestrictionEnabled}
                  onChange={(e) =>
                    setFormData({ ...formData, ipRestrictionEnabled: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
            {formData.ipRestrictionEnabled && (
              <div>
                <Label>Allowed IPs (one per line)</Label>
                <textarea
                  value={formData.allowedIPs}
                  onChange={(e) =>
                    setFormData({ ...formData, allowedIPs: e.target.value })
                  }
                  className="w-full min-h-[100px] px-3 py-2 rounded-md border border-input bg-background text-sm"
                  placeholder="192.168.1.1&#10;192.168.1.0/24"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={saveSettings} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}

