import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, UserCheck, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function InviteAccept() {
  const [, params] = useRoute("/invite/:token");
  const token = params?.token || "";

  const [form, setForm] = useState({
    name: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [accountCreated, setAccountCreated] = useState(false);

  // Validate the invite token
  const { data: invite, isLoading: validating, error: validateError } = trpc.invites.validate.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  // Accept invite mutation
  const acceptInvite = trpc.invites.accept.useMutation({
    onSuccess: () => {
      setAccountCreated(true);
      toast.success("Account created successfully!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create account");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    acceptInvite.mutate({
      token,
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      password: form.password,
    });
  };

  // Loading state
  if (validating) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-muted-foreground">Validating invite...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid/expired invite
  if (validateError || !invite) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 flex flex-col items-center gap-4">
            <XCircle className="h-12 w-12 text-red-500" />
            <h2 className="text-xl font-bold">Invalid Invite</h2>
            <p className="text-muted-foreground text-center">
              This invite link is expired, already used, or invalid. Please contact your administrator for a new invite.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Account created success
  if (accountCreated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 flex flex-col items-center gap-4">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <h2 className="text-xl font-bold">Account Created!</h2>
            <p className="text-muted-foreground text-center">
              Your account has been created successfully. You can now log in to the CRM.
            </p>
            <Button onClick={() => window.location.href = "/"} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Registration form
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Join 123Drive CRM</CardTitle>
          <CardDescription>
            You've been invited to join as{" "}
            {invite.role === "admin" ? (
              <Badge className="bg-blue-600 text-white ml-1">
                <Shield className="h-3 w-3 mr-1" /> Admin
              </Badge>
            ) : (
              <Badge variant="secondary" className="ml-1">
                <UserCheck className="h-3 w-3 mr-1" /> Agent
              </Badge>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                placeholder="Enter your full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Optional. Your personal phone number.
              </p>
            </div>
            <div>
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={6}
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm Password *</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                required
              />
            </div>
            {invite.email && (
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Email: <strong>{invite.email}</strong>
                </p>
              </div>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={acceptInvite.isPending}
            >
              {acceptInvite.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
