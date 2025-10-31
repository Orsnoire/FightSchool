import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import TeacherSignup from "@/pages/TeacherSignup";
import TeacherDashboard from "@/pages/TeacherDashboard";
import TeacherStats from "@/pages/TeacherStats";
import ItemManagement from "@/pages/ItemManagement";
import CreateFight from "@/pages/CreateFight";
import HostFight from "@/pages/HostFight";
import TeacherGuilds from "@/pages/TeacherGuilds";
import TeacherGuildDetail from "@/pages/TeacherGuildDetail";
import CharacterSelect from "@/pages/CharacterSelect";
import Lobby from "@/pages/Lobby";
import Combat from "@/pages/Combat";
import StudentStats from "@/pages/StudentStats";
import StudentEquipment from "@/pages/StudentEquipment";
import StudentGuilds from "@/pages/StudentGuilds";
import StudentGuildDetail from "@/pages/StudentGuildDetail";
import StudentGuildLobby from "@/pages/StudentGuildLobby";
import GuildRoster from "@/pages/GuildRoster";
import GuildLeaderboard from "@/pages/GuildLeaderboard";
import GuildFights from "@/pages/GuildFights";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/teacher/login" component={Login} />
      <Route path="/teacher/signup" component={TeacherSignup} />
      <Route path="/teacher" component={TeacherDashboard} />
      <Route path="/teacher/stats" component={TeacherStats} />
      <Route path="/teacher/items" component={ItemManagement} />
      <Route path="/teacher/guilds" component={TeacherGuilds} />
      <Route path="/teacher/guild/:id" component={TeacherGuildDetail} />
      <Route path="/teacher/create" component={CreateFight} />
      <Route path="/teacher/edit/:id" component={CreateFight} />
      <Route path="/teacher/host/:id" component={HostFight} />
      <Route path="/student">
        <Redirect to="/student/lobby" />
      </Route>
      <Route path="/student/character-select" component={CharacterSelect} />
      <Route path="/student/equipment" component={StudentEquipment} />
      <Route path="/student/lobby" component={Lobby} />
      <Route path="/student/guilds" component={StudentGuilds} />
      <Route path="/student/guild/:id" component={StudentGuildDetail} />
      <Route path="/student/guild-lobby/:id" component={StudentGuildLobby} />
      <Route path="/student/guilds/:guildId/roster" component={GuildRoster} />
      <Route path="/student/guilds/:guildId/leaderboard" component={GuildLeaderboard} />
      <Route path="/student/guilds/:guildId/fights" component={GuildFights} />
      <Route path="/student/combat" component={Combat} />
      <Route path="/student/:id/stats" component={StudentStats} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
