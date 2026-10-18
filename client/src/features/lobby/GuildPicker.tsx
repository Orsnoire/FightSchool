import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type Guild } from "@shared/schema";
import { Trophy, Users } from "lucide-react";


export function GuildPicker({ studentGuilds, showGuildDialog, setShowGuildDialog, navigate }: { studentGuilds: Guild[]; showGuildDialog: boolean; setShowGuildDialog: (open: boolean) => void; navigate: (path: string) => void }) {
  return (
    <Dialog open={showGuildDialog} onOpenChange={setShowGuildDialog}>
      <DialogContent className="max-w-2xl" data-testid="dialog-guild-selection">
        <DialogHeader>
          <DialogTitle className="text-2xl font-serif">Select a Guild</DialogTitle>
          <DialogDescription>
            Choose a guild to access its fights and leaderboards
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {studentGuilds.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                You haven't joined any guilds yet
              </p>
              <Button
                onClick={() => {
                  setShowGuildDialog(false);
                  navigate("/student/guilds");
                }}
                data-testid="button-browse-guilds"
              >
                Browse Guilds
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 max-h-96 overflow-y-auto">
              {studentGuilds.map((guild) => (
                <Card
                  key={guild.id}
                  className="cursor-pointer hover-elevate active-elevate-2"
                  onClick={() => {
                    setShowGuildDialog(false);
                    navigate(`/student/guild-lobby/${guild.id}`);
                  }}
                  data-testid={`button-select-guild-${guild.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg" data-testid={`text-guild-name-${guild.id}`}>
                          {guild.name}
                        </h3>
                        {guild.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                            {guild.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Trophy className="h-3 w-3" />
                          Lv {guild.level}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
