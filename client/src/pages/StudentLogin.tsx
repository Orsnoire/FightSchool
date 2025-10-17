import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Swords } from "lucide-react";

const loginSchema = z.object({
  nickname: z.string().min(1, "Nickname is required"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  nickname: z.string().min(1, "Nickname is required"),
  password: z.string().min(4, "Password must be at least 4 characters"),
});

export default function StudentLogin() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isRegistering, setIsRegistering] = useState(false);

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { nickname: "", password: "" },
  });

  const registerForm = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { nickname: "", password: "" },
  });

  const handleLogin = async (data: z.infer<typeof loginSchema>) => {
    const response = await fetch("/api/student/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      const student = await response.json();
      localStorage.setItem("studentId", student.id);
      navigate("/student/character-select");
    } else {
      toast({ title: "Login failed", description: "Invalid credentials", variant: "destructive" });
    }
  };

  const handleRegister = async (data: z.infer<typeof registerSchema>) => {
    const response = await fetch("/api/student/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      const student = await response.json();
      localStorage.setItem("studentId", student.id);
      navigate("/student/character-select");
    } else {
      toast({ title: "Registration failed", description: "Nickname already taken", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-primary rounded-full flex items-center justify-center">
            <Swords className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-3xl font-serif" data-testid="text-login-title">
            {isRegistering ? "Join the Battle" : "Return to Battle"}
          </CardTitle>
          <CardDescription>
            {isRegistering ? "Create your warrior account" : "Login to continue your quest"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {isRegistering ? (
            <Form {...registerForm}>
              <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
                <FormField
                  control={registerForm.control}
                  name="nickname"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nickname</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-nickname" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={registerForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} data-testid="input-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" data-testid="button-register">
                  Create Account
                </Button>
              </form>
            </Form>
          ) : (
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                <FormField
                  control={loginForm.control}
                  name="nickname"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nickname</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-nickname" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} data-testid="input-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" data-testid="button-login">
                  Login
                </Button>
              </form>
            </Form>
          )}
        </CardContent>

        <CardFooter className="flex justify-center">
          <Button
            variant="ghost"
            onClick={() => setIsRegistering(!isRegistering)}
            data-testid="button-toggle-mode"
          >
            {isRegistering ? "Already have an account? Login" : "New warrior? Register"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
