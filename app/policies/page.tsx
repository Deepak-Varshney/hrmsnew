"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Download, FileText, Search, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterActive, setFilterActive] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: "",
    category: "HR",
    description: "",
    fileUrl: "",
    version: "",
    effectiveDate: "",
    isActive: true,
  });

  useEffect(() => {
    loadUser();
    loadPolicies();
  }, [filterCategory, filterActive]);

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

  async function loadPolicies() {
    setLoading(true);
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const params = new URLSearchParams();
      if (filterCategory) params.append("category", filterCategory);
      if (filterActive !== "") params.append("isActive", filterActive);
      if (searchTerm) params.append("search", searchTerm);

      const res = await fetch(`/api/policies?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setPolicies(data.policies || []);
      } else {
        toast.error(data.error || "Failed to load policies");
      }
    } catch (error) {
      toast.error("Failed to load policies");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const url = editingPolicy
        ? `/api/policies/${editingPolicy._id}`
        : "/api/policies";
      const method = editingPolicy ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(
          editingPolicy
            ? "Policy updated successfully"
            : "Policy created successfully"
        );
        setDialogOpen(false);
        resetForm();
        loadPolicies();
      } else {
        toast.error(data.error || "Failed to save policy");
      }
    } catch (error) {
      toast.error("Failed to save policy");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to archive this policy?")) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch(`/api/policies/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Policy archived successfully");
        loadPolicies();
      } else {
        toast.error(data.error || "Failed to archive policy");
      }
    } catch (error) {
      toast.error("Failed to archive policy");
    }
  }

  function resetForm() {
    setFormData({
      title: "",
      category: "HR",
      description: "",
      fileUrl: "",
      version: "",
      effectiveDate: "",
      isActive: true,
    });
    setEditingPolicy(null);
  }

  function openEditDialog(policy: any) {
    setEditingPolicy(policy);
    setFormData({
      title: policy.title,
      category: policy.category,
      description: policy.description || "",
      fileUrl: policy.fileUrl,
      version: policy.version,
      effectiveDate: new Date(policy.effectiveDate).toISOString().slice(0, 10),
      isActive: policy.isActive,
    });
    setDialogOpen(true);
  }

  const isHR = user?.role === "HR" || user?.role === "Admin";

  const filteredPolicies = policies.filter((policy) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      policy.title.toLowerCase().includes(search) ||
      (policy.description && policy.description.toLowerCase().includes(search))
    );
  });

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">Policy Library</h1>
            <p className="text-muted-foreground">
              View and manage company policies
            </p>
          </div>
          {isHR && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Policy
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingPolicy ? "Edit Policy" : "Create New Policy"}
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

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="category">Category *</Label>
                      <Select
                        value={formData.category}
                        onValueChange={(value) =>
                          setFormData({ ...formData, category: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HR">HR</SelectItem>
                          <SelectItem value="IT">IT</SelectItem>
                          <SelectItem value="Compliance">Compliance</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="version">Version *</Label>
                      <Input
                        id="version"
                        value={formData.version}
                        onChange={(e) =>
                          setFormData({ ...formData, version: e.target.value })
                        }
                        placeholder="e.g., 1.0"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                      placeholder="Policy description..."
                    />
                  </div>

                  <div>
                    <Label htmlFor="fileUrl">File URL *</Label>
                    <Input
                      id="fileUrl"
                      value={formData.fileUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, fileUrl: e.target.value })
                      }
                      placeholder="https://example.com/policy.pdf"
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      URL to the policy PDF file
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="effectiveDate">Effective Date *</Label>
                      <Input
                        id="effectiveDate"
                        type="date"
                        value={formData.effectiveDate}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            effectiveDate: e.target.value,
                          })
                        }
                        required
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-8">
                      <input
                        type="checkbox"
                        id="isActive"
                        checked={formData.isActive}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            isActive: e.target.checked,
                          })
                        }
                        className="rounded"
                      />
                      <Label htmlFor="isActive" className="cursor-pointer">
                        Active
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
                      {editingPolicy ? "Update" : "Create"} Policy
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search policies..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select
                value={filterCategory}
                onValueChange={setFilterCategory}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="HR">HR</SelectItem>
                  <SelectItem value="IT">IT</SelectItem>
                  <SelectItem value="Compliance">Compliance</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterActive} onValueChange={setFilterActive}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="allstatus">All Status</SelectItem>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Archived</SelectItem>
                </SelectContent>
              </Select>
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearchTerm("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Policies List */}
        <Card>
          <CardHeader>
            <CardTitle>Policies ({filteredPolicies.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading...
              </div>
            ) : filteredPolicies.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No policies found
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPolicies.map((policy) => (
                  <div
                    key={policy._id}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <FileText className="h-5 w-5 text-primary" />
                          <h3 className="font-semibold text-lg">
                            {policy.title}
                          </h3>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              policy.isActive
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {policy.isActive ? "Active" : "Archived"}
                          </span>
                          <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            {policy.category}
                          </span>
                        </div>
                        {policy.description && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {policy.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span>Version: {policy.version}</span>
                          <span>
                            Effective:{" "}
                            {new Date(policy.effectiveDate).toLocaleDateString()}
                          </span>
                          <span>
                            Created:{" "}
                            {new Date(policy.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => window.open(policy.fileUrl, "_blank")}
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {isHR && (
                          <>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => openEditDialog(policy)}
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleDelete(policy._id)}
                              title="Archive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
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

