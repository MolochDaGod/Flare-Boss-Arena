import React from "react";
import { Link, useLocation } from "wouter";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarHeader } from "@/components/ui/sidebar";
import { Shield, Sword, Skull, Book, Flame, ScrollText } from "lucide-react";

export default function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { label: "War Panel", href: "/", icon: Flame },
    { label: "New Character", href: "/character/new", icon: ScrollText },
    { label: "Equipment", href: "/equipment", icon: Sword },
    { label: "Skills", href: "/skills", icon: Book },
    { label: "Boss Arena", href: "/boss", icon: Skull },
    { label: "Bestiary", href: "/enemies", icon: Shield },
  ];

  return (
    <SidebarProvider>
      <div className="flex min-h-[100dvh] w-full bg-background text-foreground selection:bg-primary/30">
        <Sidebar className="border-r border-border/50 bg-sidebar/50 backdrop-blur">
          <SidebarHeader className="py-6 px-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded bg-primary flex items-center justify-center text-primary-foreground">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-serif font-bold text-primary uppercase tracking-widest leading-none">Grudge</h1>
                <h2 className="text-xs font-sans text-muted-foreground uppercase tracking-[0.2em] leading-none mt-1">Warlords</h2>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-serif uppercase tracking-widest text-muted-foreground">Sanctuary</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={location === item.href} tooltip={item.label}>
                        <Link href={item.href} className="flex items-center gap-3">
                          <item.icon className="w-4 h-4" />
                          <span className="font-serif tracking-wide">{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <main className="flex-1 flex flex-col relative overflow-hidden h-[100dvh]">
          {/* Subtle noise/texture overlay */}
          <div className="pointer-events-none fixed inset-0 opacity-[0.015] mix-blend-overlay z-50 bg-[url('https://pub-e7fcf1fd4c9946ecb84b3766bbc7b50d.r2.dev/noise.png')] bg-repeat" />
          
          <div className="flex-1 overflow-y-auto">
            <div className="container max-w-7xl mx-auto p-4 md:p-8 h-full">
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
