import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Shell from "@/components/layout/Shell";
import { AuthGate } from "@/components/AuthGate";
import { InfoPanelHost } from "@/components/InfoPanel";
import { ensureEconomyBootstrapped } from "@/data/flareEconomy";
import { bootArmadaEngine } from "@/data/armadaEngine";

// Route pages are lazy-loaded so the initial bundle/dev-transform of the entry
// graph does not have to pull in the heavy Three.js engines (game/camp/boss).
// Eager-importing every page forced the dev server to process the entire
// Three.js + all-pages graph in one pass, which blows past the container memory
// limit and gets the dev server OOM-killed. Code-splitting per route keeps each
// transform pass bounded to the route the user is actually viewing.
const Home = lazy(() => import("@/pages/home"));
const Select = lazy(() => import("@/pages/select"));
const CharacterNew = lazy(() => import("@/pages/character-new"));
const Equipment = lazy(() => import("@/pages/equipment"));
const Skills = lazy(() => import("@/pages/skills"));
const Boss = lazy(() => import("@/pages/boss"));
const Enemies = lazy(() => import("@/pages/enemies"));
const Units = lazy(() => import("@/pages/units"));
const Perks = lazy(() => import("@/pages/perks"));
const Rewards = lazy(() => import("@/pages/rewards"));
const Account = lazy(() => import("@/pages/account"));
const Content = lazy(() => import("@/pages/content"));
const Game = lazy(() => import("@/pages/game"));
const Camp = lazy(() => import("@/pages/camp"));
const Party = lazy(() => import("@/pages/party"));
const Moba = lazy(() => import("@/pages/moba"));
const AuthCallback = lazy(() => import("@/pages/auth-callback"));
const Leaderboards = lazy(() => import("@/pages/leaderboards"));
const Pvp = lazy(() => import("@/pages/pvp"));
const Connections = lazy(() => import("@/pages/connections"));

const queryClient = new QueryClient();

function PageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="font-serif text-sm uppercase tracking-widest text-[#c5a059] animate-pulse">
        Summoning…
      </p>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/auth/callback" component={AuthCallback} />
      <Route path="/game" component={Game} />
      <Route path="/camp" component={Camp} />
      <Route path="/boss" component={Boss} />
      <Route path="/moba" component={Moba} />
      <Route>
        <Shell>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/select" component={Select} />
            <Route path="/character/new" component={CharacterNew} />
            <Route path="/equipment" component={Equipment} />
            <Route path="/skills" component={Skills} />
            <Route path="/perks" component={Perks} />
            <Route path="/units" component={Units} />
            <Route path="/party" component={Party} />
            <Route path="/rewards" component={Rewards} />
            <Route path="/account" component={Account} />
            <Route path="/content" component={Content} />
            <Route path="/enemies" component={Enemies} />
            <Route path="/leaderboards" component={Leaderboards} />
            <Route path="/pvp" component={Pvp} />
            <Route path="/connections" component={Connections} />
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
    ensureEconomyBootstrapped();
    bootArmadaEngine();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthGate>
            <Suspense fallback={<PageFallback />}>
              <Router />
            </Suspense>
            <InfoPanelHost />
          </AuthGate>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
