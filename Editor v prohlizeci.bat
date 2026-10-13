@echo off
rem Otevre webovy editor jako samostatne okno v Microsoft Edge (bez instalace)
start "" msedge --app="file:///%~dp0index.html#/songs"
