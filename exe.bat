@echo off
setlocal

echo Verificando se a porta 3000 está em uso...

REM Verifica se há algo rodando na porta 3000 e obtém o PID
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
    set PID=%%a
)

if defined PID (
    echo Porta 3000 em uso pelo processo com PID %PID%.
    echo Encerrando processo...
    taskkill /PID %PID% /F >nul 2>&1
    echo Processo encerrado com sucesso.
) else (
    echo Porta 3000 livre.
)

echo.
echo Iniciando o projeto em C:\relatorio-saurus...
cd /d C:\relatorio-saurus
npm start

endlocal
pause
