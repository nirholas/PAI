@echo off
:: SPDX-License-Identifier: GPL-3.0-or-later
:: pai.cmd — shim that invokes pai.ps1 from cmd.exe
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0pai.ps1" %*
