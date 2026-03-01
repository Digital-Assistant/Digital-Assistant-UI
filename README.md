# Developer Instructions

1. checkout https://github.com/Digital-Assistant/Digital-Assistant-SDK for UDAN-SDK as UDAN-CORE
    a. Compile the core package by going into UDAN-CORE folder and run the command `npm run build`
2. checkout https://github.com/Digital-Assistant/Digital-Assistant-UI for UI as UDAN-UI
3. create symbolic link to add the core package to UI as an dependency `ln -s ../UDAN-CORE/ ./UDAN-Core` (this will be removed once we publish our sdk to npm)
    a. Now you can compile the UI by going into UDAN-UI folder and run the command as `npm run build`