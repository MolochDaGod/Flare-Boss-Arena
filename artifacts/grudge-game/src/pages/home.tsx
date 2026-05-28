import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { useListCharacters, useGetCharacterSkills } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Sword, Shield, Skull } from "lucide-react";

function CharacterViewport() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const w = mountRef.current.clientWidth;
    const h = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0c);

    const aspect = w / h;
    const d = 5;
    const camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
    
    // Isometric angle
    camera.position.set(20, 20, 20);
    camera.lookAt(scene.position);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    mountRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffaa00, 1); // Ember glow
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x8a0303, 0.5); // Blood red fill
    fillLight.position.set(-10, 0, -10);
    scene.add(fillLight);

    // Character placeholder
    const group = new THREE.Group();

    // Body
    const bodyGeo = new THREE.BoxGeometry(1.5, 2, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
    const body = new THREE.Mesh(bodyGeo, mat);
    body.position.y = 2;
    group.add(body);

    // Head
    const headGeo = new THREE.BoxGeometry(1, 1, 1);
    const head = new THREE.Mesh(headGeo, mat);
    head.position.y = 3.5;
    group.add(head);

    // Weapon arm (right)
    const armGeo = new THREE.BoxGeometry(0.5, 1.5, 0.5);
    const armR = new THREE.Mesh(armGeo, mat);
    armR.position.set(1, 2, 0);
    group.add(armR);

    // Sword (orange glowing)
    const swordGeo = new THREE.BoxGeometry(0.2, 3, 0.4);
    const swordMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xffaa00, emissiveIntensity: 0.5 });
    const sword = new THREE.Mesh(swordGeo, swordMat);
    sword.position.set(1, 3, 1);
    sword.rotation.x = Math.PI / 4;
    group.add(sword);

    // Shield arm (left)
    const armL = new THREE.Mesh(armGeo, mat);
    armL.position.set(-1, 2, 0);
    group.add(armL);

    scene.add(group);

    // Floor grid
    const gridHelper = new THREE.GridHelper(20, 20, 0xffaa00, 0x222222);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    const animate = () => {
      requestAnimationFrame(animate);
      group.rotation.y += 0.005;
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      const nw = mountRef.current.clientWidth;
      const nh = mountRef.current.clientHeight;
      const naspect = nw / nh;
      camera.left = -d * naspect;
      camera.right = d * naspect;
      camera.top = d;
      camera.bottom = -d;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} className="w-full h-full min-h-[400px]" />;
}

export default function Home() {
  const { data: characters, isLoading } = useListCharacters();
  const activeChar = characters?.[0]; // Default to first char for now
  
  const { data: skills } = useGetCharacterSkills(activeChar?.id ?? 0, {
    query: { enabled: !!activeChar?.id, queryKey: ["skills", activeChar?.id] }
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif text-primary uppercase tracking-widest">War Panel</h1>
          <p className="text-muted-foreground font-serif tracking-widest text-sm mt-2">Prepare for the cull</p>
        </div>
        <Button asChild size="lg" className="font-serif tracking-widest bg-secondary text-secondary-foreground hover:bg-secondary/80">
          <Link href="/boss" className="flex items-center gap-2">
            <Skull className="w-5 h-5" />
            Enter Arena
          </Link>
        </Button>
      </div>

      {!activeChar && !isLoading && (
        <Card className="border-dashed border-muted-foreground/30 bg-card/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Sword className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-serif mb-2">No Warlord Found</h3>
            <p className="text-sm text-muted-foreground mb-6">Forge your identity before stepping into the arena.</p>
            <Button asChild variant="outline">
              <Link href="/character/new">Create Character</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {activeChar && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-card/40 border-primary/20 shadow-[0_0_30px_-10px_rgba(255,165,0,0.1)] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent z-10 pointer-events-none" />
              <CardContent className="p-0 relative">
                <CharacterViewport />
                
                <div className="absolute bottom-6 left-6 z-20">
                  <h2 className="text-3xl font-serif text-white uppercase tracking-wider">{activeChar.name}</h2>
                  <div className="flex items-center gap-3 mt-2 font-serif text-sm tracking-widest">
                    <span className="text-primary">Level {activeChar.level}</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">{activeChar.race} {activeChar.class}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {skills && skills.activeSkills.length > 0 && (
              <Card className="border-border/50 bg-card/50">
                <CardHeader className="pb-3 border-b border-border/50">
                  <CardTitle className="text-sm font-serif tracking-widest uppercase text-muted-foreground">Derived Active Skills</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {skills.activeSkills.map(skill => (
                      <div key={skill.id} className="p-4 rounded-md border border-border/50 bg-background/50 flex flex-col items-center text-center gap-3 hover:border-primary/50 transition-colors">
                        <div className="w-12 h-12 rounded bg-muted/50 border border-border/50 flex items-center justify-center overflow-hidden">
                          {skill.icon ? (
                            <img src={`https://molochdagod.github.io/ObjectStore/icons/skill_nobg/${skill.icon}`} alt={skill.name} className="w-8 h-8 object-contain" />
                          ) : (
                            <Sword className="w-6 h-6 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="font-serif text-sm tracking-wide">{skill.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-1 uppercase">CD: {skill.cooldown || "0"}s</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-sm font-serif tracking-widest uppercase text-muted-foreground">Attributes</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {Object.entries(activeChar.attributes).map(([attr, val]) => (
                  <div key={attr} className="flex justify-between items-center">
                    <span className="text-sm font-serif tracking-widest text-muted-foreground uppercase">{attr}</span>
                    <span className="font-mono text-primary">{String(val)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-serif tracking-widest uppercase text-muted-foreground">Equipment</CardTitle>
                <Button variant="ghost" size="sm" asChild className="h-6 text-xs tracking-widest uppercase">
                  <Link href="/equipment">Change</Link>
                </Button>
              </CardHeader>
              <CardContent className="pt-6 space-y-3">
                {["mainHand", "offHand", "helm", "chest", "legs", "boots", "gloves", "amulet", "ring1", "ring2"].map(slot => {
                  const itemId = (activeChar.equipment as any)?.[slot];
                  return (
                    <div key={slot} className="flex items-center gap-3 p-2 rounded border border-border/30 bg-background/30">
                      <div className="w-8 h-8 rounded bg-muted/50 flex items-center justify-center text-[10px] uppercase font-mono text-muted-foreground shrink-0 border border-border/50">
                        {slot.slice(0, 2)}
                      </div>
                      <div className="flex-1 truncate">
                        <p className="text-xs font-serif tracking-widest text-muted-foreground uppercase">{slot}</p>
                        <p className="text-sm font-serif truncate text-foreground mt-0.5">{itemId || "Empty"}</p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
