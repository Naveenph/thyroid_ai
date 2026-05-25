@echo off
echo ========================================
echo Project Setup and Execution
echo ========================================

echo.
echo [1/4] Checking Python virtual environment...
IF NOT EXIST venv (
    echo Creating Python virtual environment...
    python -m venv venv
) ELSE (
    echo Virtual environment already exists.
)

echo.
echo [2/4] Installing backend dependencies...
call .\venv\Scripts\activate.bat
pip install -r requirements.txt

echo.
echo [3/4] Installing root NPM dependencies (concurrently)...
call npm install

echo.
echo [4/4] Installing frontend NPM dependencies...
cd frontend
call npm install
cd ..

echo.
echo ========================================
echo Starting the application...
echo Both backend and frontend will start now!
echo ========================================
npm run dev
