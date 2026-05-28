import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "@/pages/home";
import CharacterNew from "@/pages/character-new";
import Equipment from "@/pages/equipment";
import Skills from "@/pages/skills";
import Boss from "@/pages/boss";
import Enemies from "@/pages/enemies";
import Game from "@/pages/game";
import Shell from "@/components/layout/Shell";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/game" component={Game} />
      <Route>
        <Shell>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/character/new" component={CharacterNew} />
            <Route path="/equipment" component={Equipment} />
            <Route path="/skills" component={Skills} />
            <Route path="/boss" component={Boss} />
            <Route path="/enemies" component={Enemies} />
            <Route component={NotFound} />
          </Switch>
        </Shell>
      </Route>
    </Switch>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
