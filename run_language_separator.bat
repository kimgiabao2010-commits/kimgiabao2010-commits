@echo off
chcp 65001 > nul
echo ================================================
echo Language Separator - Tách file theo ngôn ngữ
echo ================================================
echo.

REM Tách file thành 2 file riêng biệt
echo Đang tách file "do an.csv" thành 2 file riêng biệt...
python language_classifier.py "do an.csv" --separate

echo.
echo ================================================
echo Hoàn thành!
echo - File gốc: do an.csv (đã thêm cột Language)
echo - File tiếng Việt: do an_vietnamese.csv
echo - File tiếng Anh: do an_english.csv
echo ================================================
pause
