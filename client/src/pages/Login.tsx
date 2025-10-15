import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Swords, Shield } from "lucide-react";

export default function Login() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [teacherUsername, setTeacherUsername] = useState("");
  const [teacherPassword, setTeacherPassword] = useState("");
  const [teacherClassCode, setTeacherClassCode] = useState("");
  const [studentNickname, setStudentNickname] = useState("");
  const [studentPassword, setStudentPassword] = useState("");

  const handleTeacherLogin = () => {
    if (teacherUsername === "1" && teacherPassword === "2") {
      localStorage.setItem("isTeacher", "true");
      localStorage.setItem("teacherClassCode", teacherClassCode || "DEMO123");
      navigate("/teacher");
    } else {
      toast({ 
        title: "Invalid credentials", 
        description: "Please check your username and password",
        variant: "destructive" 
      });
    }
  };

  const handleStudentLogin = async () => {
    try {
      const response = await fetch("/api/student/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          nickname: studentNickname, 
          password: studentPassword
        }),
      });

      if (response.ok) {
        const student = await response.json();
        localStorage.setItem("studentId", student.id);
        navigate("/student/character-select");
      } else {
        const error = await response.json();
        toast({ 
          title: "Login failed", 
          description: error.error || "Failed to login",
          variant: "destructive" 
        });
      }
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to login",
        variant: "destructive" 
      });
    }
  };

  const handleStudentRegister = async () => {
    try {
      const response = await fetch("/api/student/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: studentNickname,
          password: studentPassword,
          classCode: studentClassCode,
        }),
      });

      if (response.ok) {
        const student = await response.json();
        localStorage.setItem("studentId", student.id);
        navigate("/student/character-select");
      } else {
        const error = await response.json();
        toast({ 
          title: "Registration failed", 
          description: error.error || "Failed to register",
          variant: "destructive" 
        });
      }
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to register",
        variant: "destructive" 
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-gray-900 to-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-serif font-bold text-white mb-2">
            Quest Academy
          </h1>
          <p className="text-gray-400">Choose your path to adventure</p>
        </div>

        <Tabs defaultValue="teacher" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="teacher" data-testid="tab-teacher">
              <Shield className="mr-2 h-4 w-4" />
              Teacher
            </TabsTrigger>
            <TabsTrigger value="student" data-testid="tab-student">
              <Swords className="mr-2 h-4 w-4" />
              Student
            </TabsTrigger>
          </TabsList>

          <TabsContent value="teacher">
            <Card>
              <CardHeader>
                <CardTitle>Teacher Login</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="teacher-username">Username</Label>
                  <Input
                    id="teacher-username"
                    value={teacherUsername}
                    onChange={(e) => setTeacherUsername(e.target.value)}
                    placeholder="Enter username"
                    data-testid="input-teacher-username"
                  />
                </div>
                <div>
                  <Label htmlFor="teacher-password">Password</Label>
                  <Input
                    id="teacher-password"
                    type="password"
                    value={teacherPassword}
                    onChange={(e) => setTeacherPassword(e.target.value)}
                    placeholder="Enter password"
                    data-testid="input-teacher-password"
                  />
                </div>
                <div>
                  <Label htmlFor="teacher-classcode">Class Code</Label>
                  <Input
                    id="teacher-classcode"
                    value={teacherClassCode}
                    onChange={(e) => setTeacherClassCode(e.target.value)}
                    placeholder="Enter your class code (e.g., DEMO123)"
                    data-testid="input-teacher-classcode"
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  onClick={handleTeacherLogin}
                  data-testid="button-teacher-login"
                >
                  Login as Teacher
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="student">
            <Card>
              <CardHeader>
                <CardTitle>Student Access</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="student-nickname">Nickname</Label>
                  <Input
                    id="student-nickname"
                    value={studentNickname}
                    onChange={(e) => setStudentNickname(e.target.value)}
                    placeholder="Enter your nickname"
                    data-testid="input-student-nickname"
                  />
                </div>
                <div>
                  <Label htmlFor="student-password">Password</Label>
                  <Input
                    id="student-password"
                    type="password"
                    value={studentPassword}
                    onChange={(e) => setStudentPassword(e.target.value)}
                    placeholder="Enter password"
                    data-testid="input-student-password"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  First login auto-creates your account
                </p>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  onClick={handleStudentLogin}
                  data-testid="button-student-login"
                >
                  Login
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
