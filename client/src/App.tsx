import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import TeacherDashboard from "@/pages/TeacherDashboard";
import CreateFight from "@/pages/CreateFight";
import HostFight from "@/pages/HostFight";
import StudentLogin from "@/pages/StudentLogin";
import CharacterSelect from "@/pages/CharacterSelect";
import Lobby from "@/pages/Lobby";
import Combat from "@/pages/Combat";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/teacher" component={TeacherDashboard} />
      <Route path="/teacher/create" component={CreateFight} />
      <Route path="/teacher/host/:id" component={HostFight} />
      <Route path="/student/login" component={StudentLogin} />
      <Route path="/student/character-select" component={CharacterSelect} />
      <Route path="/student/lobby" component={Lobby} />
      <Route path="/student/combat" component={Combat} />
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
