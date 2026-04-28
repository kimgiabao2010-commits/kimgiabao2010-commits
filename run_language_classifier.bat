@echo off
chcp 65001 > nul
echo ================================================
echo Language Classifier - Phân loại ngôn ngữ
echo ================================================
echo.

REM Chỉ phân loại và thêm cột Language vào file gốc
echo Đang phân loại ngôn ngữ trong file "do an.csv"...
python language_classifier.py "do an.csv"

echo.
echo ================================================
echo Hoàn thành! Kiểm tra file "do an.csv"
echo ================================================
pause
