"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "@/lib/session";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";

interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  is_admin?: boolean;
}

interface Subscription {
  id: string;
  plan: string;
  status: string;
  current_period_end: string;
  created_at: string;
  customer_email: string;
}

interface Invoice {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  customer_email: string;
  invoice_pdf: string;
}

export default function AdminPage() {
  const { session } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("users");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("user");
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use callback to prevent re-creation of function on each render
  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/admin/users");
      
      if (!response.ok) {
        throw new Error("You don't have permission to access this page");
      }
      
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Access denied",
        description: "You don't have permission to access the admin page",
        variant: "destructive",
      });
      router.push("/dashboard");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  // Example fetch subscriptions function
  const fetchSubscriptions = useCallback(async () => {
    // This is a mock function - you would implement real API call
    // For demo, we'll use placeholder data
    try {
      setIsLoading(true);
      // Mock data - replace with actual API call
      setTimeout(() => {
        const mockSubscriptions = [
          {
            id: "sub_1234",
            plan: "Enterprise",
            status: "active",
            current_period_end: "2023-12-31",
            created_at: "2023-01-01",
            customer_email: "customer@example.com"
          },
          {
            id: "sub_5678",
            plan: "Pro",
            status: "active", 
            current_period_end: "2023-11-30",
            created_at: "2023-02-15",
            customer_email: "another@example.com"
          }
        ];
        setSubscriptions(mockSubscriptions);
        setIsLoading(false);
      }, 500);
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
      setIsLoading(false);
    }
  }, []);

  // Example fetch invoices function
  const fetchInvoices = useCallback(async () => {
    // This is a mock function - you would implement real API call
    try {
      setIsLoading(true);
      // Mock data - replace with actual API call
      setTimeout(() => {
        const mockInvoices = [
          {
            id: "inv_1234",
            amount: 199.99,
            status: "paid",
            created_at: "2023-10-01",
            customer_email: "customer@example.com",
            invoice_pdf: "https://example.com/invoice-1234.pdf"
          },
          {
            id: "inv_5678",
            amount: 99.99,
            status: "paid",
            created_at: "2023-09-01",
            customer_email: "customer@example.com",
            invoice_pdf: "https://example.com/invoice-5678.pdf"
          },
          {
            id: "inv_9012",
            amount: 99.99,
            status: "paid",
            created_at: "2023-08-01",
            customer_email: "another@example.com",
            invoice_pdf: "https://example.com/invoice-9012.pdf"
          }
        ];
        setInvoices(mockInvoices);
        setIsLoading(false);
      }, 500);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      setIsLoading(false);
    }
  }, []);

  // Load data based on active tab
  useEffect(() => {
    if (!session) return;
    
    setIsLoading(true);
    
    if (activeTab === "users") {
      fetchUsers();
    } else if (activeTab === "subscriptions") {
      fetchSubscriptions();
    } else if (activeTab === "invoices") {
      fetchInvoices();
    }
  }, [session, activeTab, fetchUsers, fetchSubscriptions, fetchInvoices]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newUserEmail) {
      toast({
        title: "Error",
        description: "Email is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: newUserEmail,
          role: newUserRole,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to add user");
      }

      toast({
        title: "Success",
        description: "User added successfully",
      });
      
      setNewUserEmail("");
      setNewUserRole("user");
      setAddUserDialogOpen(false);
      // Refresh user list
      fetchUsers();
    } catch (error: any) {
      console.error("Error adding user:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to add user",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangeRole = async (userId: string, isAdmin: boolean) => {
    try {
      console.log(`Attempting to change user ${userId} to admin: ${isAdmin}`);
      
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          is_admin: isAdmin,
        }),
      });

      const data = await response.json();
      console.log("Response status:", response.status);
      console.log("Response data:", data);

      if (!response.ok) {
        throw new Error(data.error || "Failed to update user role");
      }

      toast({
        title: "Success",
        description: "User role updated successfully",
      });
      
      // Refresh user list
      fetchUsers();
    } catch (error: any) {
      console.error("Error updating user role:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update user role",
        variant: "destructive",
      });
    }
  };

  if (isLoading && !activeTab) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
        <div className="flex justify-center items-center h-64">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>
        
        <TabsContent value="users">
          <div className="flex justify-end mb-4">
            <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
              <DialogTrigger asChild>
                <Button>Add User</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New User</DialogTitle>
                  <DialogDescription>
                    Enter the email address of the user you want to add.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddUser}>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="user@example.com"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select
                        value={newUserRole}
                        onValueChange={(value) => setNewUserRole(value)}
                      >
                        <SelectTrigger id="role">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">Regular User</SelectItem>
                          <SelectItem value="admin">Administrator</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Adding..." : "Add User"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Manage user accounts and permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center h-32">
                  <p>Loading users...</p>
                </div>
              ) : (
                <Table>
                  <TableCaption>List of all users in the system</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.display_name || user.email.split("@")[0]}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={user.is_admin ? "destructive" : "secondary"}>
                            {user.is_admin ? "Administrator" : "Regular User"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {user.is_admin ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleChangeRole(user.id, false)}
                            >
                              Remove Admin
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleChangeRole(user.id, true)}
                            >
                              Make Admin
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscriptions">
          <Card>
            <CardHeader>
              <CardTitle>Subscription Management</CardTitle>
              <CardDescription>
                View and manage customer subscriptions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center h-32">
                  <p>Loading subscriptions...</p>
                </div>
              ) : (
                <Table>
                  <TableCaption>List of all active subscriptions</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Renewal Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscriptions.map((subscription) => (
                      <TableRow key={subscription.id}>
                        <TableCell className="font-medium">
                          {subscription.customer_email}
                        </TableCell>
                        <TableCell>{subscription.plan}</TableCell>
                        <TableCell>
                          <Badge variant={subscription.status === "active" ? "default" : "secondary"}>
                            {subscription.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(subscription.current_period_end).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                          >
                            Manage
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <CardTitle>Invoice History</CardTitle>
              <CardDescription>
                View and download customer invoices
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center h-32">
                  <p>Loading invoices...</p>
                </div>
              ) : (
                <Table>
                  <TableCaption>List of all invoices</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">
                          {invoice.id}
                        </TableCell>
                        <TableCell>{invoice.customer_email}</TableCell>
                        <TableCell>${invoice.amount.toFixed(2)}</TableCell>
                        <TableCell>
                          {new Date(invoice.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={invoice.status === "paid" ? "default" : "secondary"}>
                            {invoice.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(invoice.invoice_pdf, '_blank')}
                          >
                            Download
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 