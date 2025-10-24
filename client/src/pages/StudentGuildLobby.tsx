import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ArrowLeft, Users } from "lucide-react";

export default function StudentGuildLobby() {
  const [, params] = useRoute("/student/guild-lobby/:id");
  const guildId = params?.id;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/student/lobby">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-serif font-bold text-primary" data-testid="text-title">
            Guild Lobby
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Guild Lobby
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg text-muted-foreground" data-testid="text-guild-id">
              Guild Lobby for {guildId}
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              This is a placeholder page. Guild lobby functionality will be implemented here.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
