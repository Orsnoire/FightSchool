import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PlusCircle, Swords, Users, BarChart3, Copy, UserCheck, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Fight, Student } from "@shared/schema";

export default function TeacherDashboard() {
  const { toast } = useToast();
  const [studentsDialogOpen, setStudentsDialogOpen] = useState(false);
  const teacherId = localStorage.getItem("teacherId");
  const teacherClassCode = localStorage.getItem("teacherClassCode") || "";
  
  const { data: fights, isLoading } = useQuery<Fight[]>({
    queryKey: [`/api/teacher/${teacherId}/fights`],
    enabled: !!teacherId,
  });

  const { data: students, isLoading: studentsLoading } = useQuery<Omit<Student, 'password'>[]>({
    queryKey: [`/api/students/used-fight-codes/${teacherClassCode}`],
    enabled: studentsDialogOpen,
  });

  const copyClassCode = (classCode: string) => {
    navigator.clipboard.writeText(classCode);
    toast({ title: "Class code copied!", description: "Share this code with your students" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-serif font-bold text-primary" data-testid="text-title">
            Quest Master
          </h1>
          <div className="flex gap-2">
            <Link href="/teacher/items">
              <Button variant="outline" size="default" data-testid="button-manage-items">
                <Swords className="mr-2 h-5 w-5" />
                Manage Items
              </Button>
            </Link>
            <Link href="/teacher/stats">
              <Button variant="outline" size="default" data-testid="button-view-stats">
                <BarChart3 className="mr-2 h-5 w-5" />
                Statistics
              </Button>
            </Link>
            <Dialog open={studentsDialogOpen} onOpenChange={setStudentsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="default" data-testid="button-view-students">
                  <UserCheck className="mr-2 h-5 w-5" />
                  View Students
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Students Who Used Your Class Codes</DialogTitle>
                </DialogHeader>
                <div className="mt-4">
                  {studentsLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                      ))}
                    </div>
                  ) : students && students.length > 0 ? (
                    <div className="space-y-2">
                      {students.map((student) => (
                        <Card key={student.id} data-testid={`student-card-${student.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold" data-testid={`student-nickname-${student.id}`}>
                                  {student.nickname}
                                </p>
                                <div className="flex gap-2 items-center mt-1">
                                  <Badge variant="outline" data-testid={`student-class-${student.id}`}>
                                    {student.characterClass}
                                  </Badge>
                                  <Badge variant="secondary" data-testid={`student-gender-${student.id}`}>
                                    {student.gender === 'A' ? 'Male' : 'Female'}
                                  </Badge>
                                  {student.classCode && (
                                    <Badge variant="secondary" data-testid={`student-classcode-${student.id}`}>
                                      {student.classCode}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <UserCheck className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">
                        No students have used your class codes yet
                      </p>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Link href="/teacher/create">
              <Button size="default" data-testid="button-create-fight">
                <PlusCircle className="mr-2 h-5 w-5" />
                Create Fight
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-4xl font-serif font-bold mb-2" data-testid="text-page-title">
            Your Battles
          </h2>
          <p className="text-muted-foreground">
            Create epic quiz battles and launch them for your students
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : fights && fights.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {fights.map((fight) => (
              <Card key={fight.id} className="hover-elevate" data-testid={`card-fight-${fight.id}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Swords className="h-5 w-5 text-primary" />
                    {fight.title}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Class Code:</span>
                    <Badge variant="secondary" className="font-mono" data-testid={`badge-class-code-${fight.id}`}>
                      {fight.classCode}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => copyClassCode(fight.classCode)}
                      data-testid={`button-copy-code-${fight.id}`}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>{fight.questions.length} Questions</span>
                    <span>{fight.enemies.length} Enemies</span>
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Link href={`/teacher/edit/${fight.id}`} className="flex-1">
                    <Button variant="outline" className="w-full" data-testid={`button-edit-${fight.id}`}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  </Link>
                  <Link href={`/teacher/host/${fight.id}`} className="flex-1">
                    <Button variant="default" className="w-full" data-testid={`button-host-${fight.id}`}>
                      <Users className="mr-2 h-4 w-4" />
                      Launch Host
                    </Button>
                  </Link>
                  <Button variant="destructive" size="icon" data-testid={`button-delete-${fight.id}`}>
                    <span className="sr-only">Delete</span>
                    ×
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Swords className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No fights yet</h3>
              <p className="text-muted-foreground mb-6 text-center max-w-md">
                Create your first quiz battle and start engaging your students with epic RPG-themed learning
              </p>
              <Link href="/teacher/create">
                <Button size="lg" data-testid="button-create-first">
                  <PlusCircle className="mr-2 h-5 w-5" />
                  Create Your First Fight
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
