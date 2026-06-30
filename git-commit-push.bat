@echo off
cd /d "%~dp0"
set GIT_TERMINAL_PROMPT=0
set GIT_LFS_SKIP_PUSH=0

echo === git add ===
git add -A
echo === git status ===
git status --short
echo === git commit ===
git commit -m "feat: perk/collectable GLBs, game flow pages, MMO-style nav

- Import 9 GLB props (perk machines, KF2 symbols, gumball, trenches, weapon panel)
- worldProps catalog + WorldPropLoader + camp/dungeon placement
- Camp perk alley with E-key stations; dungeon auto-pickup collectables
- New pages: /units, /perks, /rewards, /account, /content
- gameFlow.ts nav sections aligned with MMO/RTS/ARPG patterns
- Shell sidebar reorganized; War Panel links expanded"
echo commit exit: %ERRORLEVEL%
echo === git push ===
git -c http.postBuffer=524288000 push origin main
echo push exit: %ERRORLEVEL%
echo === remote ===
git ls-remote origin refs/heads/main
exit /b %ERRORLEVEL%