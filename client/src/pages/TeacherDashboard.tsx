import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { PlusCircle, Swords, Users, BarChart3 } from "lucide-react";
import type { Fight } from "@shared/schema";

export default function TeacherDashboard() {
  const { data: fights, isLoading } = useQuery<Fight[]>({
    queryKey: ["/api/fights"],
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-serif font-bold text-primary" data-testid="text-title">
            Quest Master
          </h1>
          <div className="flex gap-2">
            <Link href="/teacher/stats">
              <Button variant="outline" size="default" data-testid="button-view-stats">
                <BarChart3 className="mr-2 h-5 w-5" />
                Statistics
              </Button>
            </Link>
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
                  <CardDescription>Class Code: {fight.classCode}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>{fight.questions.length} Questions</span>
                    <span>{fight.enemies.length} Enemies</span>
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2">
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
