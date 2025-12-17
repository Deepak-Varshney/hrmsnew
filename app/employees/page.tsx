"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Users, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [managers, setManagers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "Employee",
    employeeCode: "",
    department: "",
    designation: "",
    managerId: "",
    joiningDate: "",
    phone: "",
  });

  useEffect(() => {
    loadEmployees();
    loadManagers();
  }, [filterRole, filterDepartment]);

  async function loadEmployees() {
    setLoading(true);
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const params = new URLSearchParams();
      if (filterRole) params.append("role", filterRole);
      if (filterDepartment) params.append("department", filterDepartment);

      const res = await fetch(`/api/employees?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setEmployees(data.employees || []);
      } else {
        toast.error(data.error || "Failed to load employees");
      }
    } catch (error) {
      toast.error("Failed to load employees");
    } finally {
      setLoading(false);
    }
  }

  async function loadManagers() {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch("/api/employees/managers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setManagers(data.managers || []);
      }
    } catch (error) {
      // Ignore errors
    }
  }

  function openCreateDialog() {
    setEditingEmployee(null);
    setFormData({
      name: "",
      email: "",
      password: "",
      role: "Employee",
      employeeCode: "",
      department: "",
      designation: "",
      managerId: "",
      joiningDate: "",
      phone: "",
    });
    setDialogOpen(true);
  }

  function openEditDialog(employee: any) {
    setEditingEmployee(employee);
    setFormData({
      name: employee.name,
      email: employee.email,
      password: "", // Don't prefill password
      role: employee.role,
      employeeCode: employee.employeeCode || "",
      department: employee.department || "",
      designation: employee.designation || "",
      managerId: employee.managerId || "",
      joiningDate: employee.joiningDate
        ? new Date(employee.joiningDate).toISOString().split("T")[0]
        : "",
      phone: employee.phone || "",
    });
    setDialogOpen(true);
  }

  async function saveEmployee() {
    if (!formData.name || !formData.email) {
      toast.error("Name and email are required");
      return;
    }

    if (!editingEmployee && !formData.password) {
      toast.error("Password is required for new employees");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Please login again");
      return;
    }

    try {
      const url = editingEmployee
        ? `/api/employees/${editingEmployee.id}`
        : "/api/employees";
      const method = editingEmployee ? "PUT" : "POST";

      const body: any = { ...formData };
      if (!editingEmployee || formData.password) {
        body.password = formData.password;
      } else {
        delete body.password;
      }

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(
          editingEmployee ? "Employee updated successfully" : "Employee created successfully"
        );
        setDialogOpen(false);
        loadEmployees();
      } else {
        toast.error(data.error || "Failed to save employee");
      }
    } catch (error) {
      toast.error("Failed to save employee");
    }
  }

  async function deactivateEmployee(id: string) {
    if (!confirm("Are you sure you want to deactivate this employee?")) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch(`/api/employees/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Employee deactivated successfully");
        loadEmployees();
      } else {
        toast.error(data.error || "Failed to deactivate employee");
      }
    } catch (error) {
      toast.error("Failed to deactivate employee");
    }
  }

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      !searchTerm ||
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employeeCode?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const departments = Array.from(new Set(employees.map((e) => e.department).filter(Boolean)));

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">Employee Management</h1>
            <p className="text-muted-foreground">Manage employees, roles, and departments</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Employee
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingEmployee ? "Edit Employee" : "Add New Employee"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Name *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Full name"
                    />
                  </div>
                  <div>
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@example.com"
                    />
                  </div>
                </div>
                <div>
                  <Label>Password {!editingEmployee && "*"}</Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingEmployee ? "Leave blank to keep current password" : "Password"}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Role *</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value) => setFormData({ ...formData, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Employee">Employee</SelectItem>
                        <SelectItem value="Manager">Manager</SelectItem>
                        <SelectItem value="HR">HR</SelectItem>
                        <SelectItem value="Admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Employee Code</Label>
                    <Input
                      value={formData.employeeCode}
                      onChange={(e) =>
                        setFormData({ ...formData, employeeCode: e.target.value })
                      }
                      placeholder="EMP001"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Department</Label>
                    <Input
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      placeholder="Department"
                    />
                  </div>
                  <div>
                    <Label>Designation</Label>
                    <Input
                      value={formData.designation}
                      onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                      placeholder="Designation"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Manager</Label>
                    <Select
                      value={formData.managerId}
                      onValueChange={(value) => setFormData({ ...formData, managerId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select manager" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nomgr">No Manager</SelectItem>
                        {managers.map((mgr) => (
                          <SelectItem key={mgr._id} value={mgr._id}>
                            {mgr.name} ({mgr.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Joining Date</Label>
                    <Input
                      type="date"
                      value={formData.joiningDate}
                      onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Phone number"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={saveEmployee}>Save</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div>
                <Select value={filterRole} onValueChange={setFilterRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allroles">All Roles</SelectItem>
                    <SelectItem value="Employee">Employee</SelectItem>
                    <SelectItem value="Manager">Manager</SelectItem>
                    <SelectItem value="HR">HR</SelectItem>
                    <SelectItem value="Admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alldep">All Departments</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Employees List */}
        <Card>
          <CardHeader>
            <CardTitle>Employees ({filteredEmployees.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : filteredEmployees.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No employees found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Email</th>
                      <th className="text-left p-2">Role</th>
                      <th className="text-left p-2">Department</th>
                      <th className="text-left p-2">Designation</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((emp) => (
                      <tr key={emp.id} className="border-b hover:bg-muted/50">
                        <td className="p-2 font-medium">{emp.name}</td>
                        <td className="p-2 text-sm text-muted-foreground">{emp.email}</td>
                        <td className="p-2">
                          <span className="px-2 py-1 rounded text-xs bg-primary/10 text-primary">
                            {emp.role}
                          </span>
                        </td>
                        <td className="p-2 text-sm">{emp.department || "-"}</td>
                        <td className="p-2 text-sm">{emp.designation || "-"}</td>
                        <td className="p-2">
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              emp.isActive
                                ? "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300"
                                : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                            }`}
                          >
                            {emp.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="p-2">
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(emp)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {emp.isActive && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deactivateEmployee(emp.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

