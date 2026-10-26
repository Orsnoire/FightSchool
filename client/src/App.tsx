import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { deferred } from "@/components/Deferred";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import StudentLogin from "@/pages/StudentLogin";
const TeacherSignup = deferred(() => import("@/pages/TeacherSignup"), "teacher signup", true);
const TeacherDashboard = deferred(() => import("@/pages/TeacherDashboard"), "your battles", true);
const TeacherStats = deferred(() => import("@/pages/TeacherStats"), "teacher statistics", true);
const ItemManagement = deferred(() => import("@/pages/ItemManagement"), "items", true);
const CreateFight = deferred(() => import("@/pages/CreateFight"), "the fight editor", true);
const HostFight = deferred(() => import("@/pages/HostFight"), "the host view", true);
const TeacherGuilds = deferred(() => import("@/pages/TeacherGuilds"), "your guilds", true);
const TeacherGuildDetail = deferred(() => import("@/pages/TeacherGuildDetail"), "the guild", true);
const CharacterSelect = deferred(() => import("@/pages/CharacterSelect"), "character selection", true);
const Lobby = deferred(() => import("@/pages/Lobby"), "the lobby", true);
const Combat = deferred(() => import("@/pages/Combat"), "combat", true);
const StudentStats = deferred(() => import("@/pages/StudentStats"), "your statistics", true);
const StudentEquipment = deferred(() => import("@/pages/StudentEquipment"), "equipment", true);
const Advancement = deferred(() => import('@/pages/Advancement'), 'advancement', true);
const StudentGuilds = deferred(() => import("@/pages/StudentGuilds"), "your guilds", true);
const StudentGuildDetail = deferred(() => import("@/pages/StudentGuildDetail"), "the guild", true);
const StudentGuildLobby = deferred(() => import("@/pages/StudentGuildLobby"), "the guild lobby", true);
const GuildRoster = deferred(() => import("@/pages/GuildRoster"), "the roster", true);
const GuildLeaderboard = deferred(() => import("@/pages/GuildLeaderboard"), "the leaderboard", true);
const GuildFights = deferred(() => import("@/pages/GuildFights"), "guild fights", true);
const GuildShop = deferred(() => import("@/pages/GuildShop"), "the shop", true);

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
      <Route path="/student/login" component={StudentLogin} />
      <Route path="/student">
        <Redirect to="/student/lobby" />
      </Route>
      <Route path="/student/character-select" component={CharacterSelect} />
      <Route path="/student/equipment" component={StudentEquipment} />
      <Route path="/student/advancement" component={Advancement} />
      <Route path="/student/shop" component={GuildShop} />
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
