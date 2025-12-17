"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Pin, PinOff, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    isPinned: false,
    sendEmail: false,
    targetRoles: [] as string[],
    expiresAt: "",
  });

  useEffect(() => {
    loadUser();
    loadAnnouncements();
  }, []);

  async function loadUser() {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch("/api/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
      }
    } catch (error) {
      console.error("Failed to load user");
    }
  }

  async function loadAnnouncements() {
    setLoading(true);
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch("/api/announcements", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setAnnouncements(data.announcements || []);
      } else {
        toast.error(data.error || "Failed to load announcements");
      }
    } catch (error) {
      toast.error("Failed to load announcements");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const url = editingAnnouncement
        ? `/api/announcements/${editingAnnouncement._id}`
        : "/api/announcements";
      const method = editingAnnouncement ? "PUT" : "POST";

      const payload = {
        ...formData,
        expiresAt: formData.expiresAt || undefined,
        targetRoles: formData.targetRoles.length > 0 ? formData.targetRoles : [],
      };

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(
          editingAnnouncement
            ? "Announcement updated successfully"
            : "Announcement created successfully"
        );
        setDialogOpen(false);
        resetForm();
        loadAnnouncements();
      } else {
        toast.error(data.error || "Failed to save announcement");
      }
    } catch (error) {
      toast.error("Failed to save announcement");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this announcement?")) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch(`/api/announcements/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Announcement deleted successfully");
        loadAnnouncements();
      } else {
        toast.error(data.error || "Failed to delete announcement");
      }
    } catch (error) {
      toast.error("Failed to delete announcement");
    }
  }

  function resetForm() {
    setFormData({
      title: "",
      content: "",
      isPinned: false,
      sendEmail: false,
      targetRoles: [],
      expiresAt: "",
    });
    setEditingAnnouncement(null);
  }

  function openEditDialog(announcement: any) {
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      content: announcement.content,
      isPinned: announcement.isPinned,
      sendEmail: announcement.sendEmail,
      targetRoles: announcement.targetRoles || [],
      expiresAt: announcement.expiresAt
        ? new Date(announcement.expiresAt).toISOString().slice(0, 16)
        : "",
    });
    setDialogOpen(true);
  }

  function toggleRole(role: string) {
    const roles = formData.targetRoles;
    if (roles.includes(role)) {
      setFormData({
        ...formData,
        targetRoles: roles.filter((r) => r !== role),
      });
    } else {
      setFormData({ ...formData, targetRoles: [...roles, role] });
    }
  }

  const isHR = user?.role === "HR" || user?.role === "Admin";
  const roles = ["Employee", "Manager", "HR", "Admin"];

  // Separate pinned and regular announcements
  const pinnedAnnouncements = announcements.filter((a) => a.isPinned);
  const regularAnnouncements = announcements.filter((a) => !a.isPinned);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">Announcements</h1>
            <p className="text-muted-foreground">
              View company announcements and updates
            </p>
          </div>
          {isHR && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Announcement
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingAnnouncement
                      ? "Edit Announcement"
                      : "Create New Announcement"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="content">Content *</Label>
                    <textarea
                      id="content"
                      value={formData.content}
                      onChange={(e) =>
                        setFormData({ ...formData, content: e.target.value })
                      }
                      className="w-full min-h-[200px] px-3 py-2 border rounded-md"
                      placeholder="Announcement content..."
                      required
                    />
                  </div>

                  <div>
                    <Label>Target Audience</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Leave empty to show to all users
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {roles.map((role) => (
                        <Button
                          key={role}
                          type="button"
                          variant={
                            formData.targetRoles.includes(role)
                              ? "default"
                              : "outline"
                          }
                          onClick={() => toggleRole(role)}
                          size="sm"
                        >
                          {role}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="expiresAt">Expiration Date (Optional)</Label>
                      <Input
                        id="expiresAt"
                        type="datetime-local"
                        value={formData.expiresAt}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            expiresAt: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isPinned"
                        checked={formData.isPinned}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            isPinned: e.target.checked,
                          })
                        }
                        className="rounded"
                      />
                      <Label htmlFor="isPinned" className="cursor-pointer">
                        Pin to top
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="sendEmail"
                        checked={formData.sendEmail}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            sendEmail: e.target.checked,
                          })
                        }
                        className="rounded"
                      />
                      <Label htmlFor="sendEmail" className="cursor-pointer">
                        Send email notification (when implemented)
                      </Label>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setDialogOpen(false);
                        resetForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingAnnouncement ? "Update" : "Create"} Announcement
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Announcements List */}
        {loading ? (
          <Card>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Loading...
              </div>
            </CardContent>
          </Card>
        ) : announcements.length === 0 ? (
          <Card>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                No announcements found
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Pinned Announcements */}
            {pinnedAnnouncements.length > 0 && (
              <div className="space-y-4">
                {pinnedAnnouncements.map((announcement) => (
                  <Card
                    key={announcement._id}
                    className="border-primary/50 bg-primary/5"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Pin className="h-4 w-4 text-primary" />
                            <CardTitle>{announcement.title}</CardTitle>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {new Date(announcement.createdAt).toLocaleDateString()}
                            {announcement.targetRoles.length > 0 && (
                              <span className="ml-2">
                                • For: {announcement.targetRoles.join(", ")}
                              </span>
                            )}
                            {announcement.expiresAt && (
                              <span className="ml-2">
                                • Expires:{" "}
                                {new Date(announcement.expiresAt).toLocaleDateString()}
                              </span>
                            )}
                          </p>
                        </div>
                        {isHR && (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => openEditDialog(announcement)}
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleDelete(announcement._id)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="whitespace-pre-wrap">
                        {announcement.content}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Regular Announcements */}
            {regularAnnouncements.length > 0 && (
              <div className="space-y-4">
                {regularAnnouncements.map((announcement) => (
                  <Card key={announcement._id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle>{announcement.title}</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            {new Date(announcement.createdAt).toLocaleDateString()}
                            {announcement.targetRoles.length > 0 && (
                              <span className="ml-2">
                                • For: {announcement.targetRoles.join(", ")}
                              </span>
                            )}
                            {announcement.expiresAt && (
                              <span className="ml-2">
                                • Expires:{" "}
                                {new Date(announcement.expiresAt).toLocaleDateString()}
                              </span>
                            )}
                          </p>
                        </div>
                        {isHR && (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => openEditDialog(announcement)}
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleDelete(announcement._id)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="whitespace-pre-wrap">
                        {announcement.content}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

