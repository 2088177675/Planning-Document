@echo off
chcp 65001 >nul
title AI Server - Qwen2.5-0.5B (llama.cpp)
cd /d %~dp0
echo ============================================
echo  自学习平台本地 AI 服务 (OpenAI 兼容接口)
echo  地址: http://127.0.0.1:11434/v1/chat/completions
echo  关闭此窗口即停止 AI 服务
echo ============================================
llama-server.exe -m qwen2.5-1.5b-instruct-q8_0.gguf --host 127.0.0.1 --port 11434 --ctx-size 8192 --threads 8
pause
