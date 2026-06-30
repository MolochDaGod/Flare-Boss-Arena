@echo off
set GIT_TERMINAL_PROMPT=
git push -u origin main > C:\Users\david\final-push-out.txt 2> C:\Users\david\final-push-err.txt
echo %ERRORLEVEL%> C:\Users\david\final-push-exit.txt