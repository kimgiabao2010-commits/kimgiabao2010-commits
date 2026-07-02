const puppeteer = require('puppeteer');
const pptxgen = require('pptxgenjs');
const fs = require('fs');
const path = require('path');

const SLIDES_URL = 'file://' + path.join(__dirname, 'swg-shield-slides-v2.html');
const OUTPUT_FILE = 'SWG-Shield-Final.pptx';
const TOTAL_SLIDES = 11; 

(async () => {
    console.log('🚀 Đang khởi động tiến trình xuất PowerPoint...');
    const browser = await puppeteer.launch({ 
        headless: "new",
        executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
    });
    const page = await browser.newPage();
    
    // Đặt viewport chuẩn tỷ lệ 1920x1080 
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
    await page.goto(SLIDES_URL, { waitUntil: 'networkidle0' });

    // Ẩn các nút điều hướng và UI rác khỏi ảnh chụp
    await page.addStyleTag({ content: `
        #export-panel, #exp-toggle, #nav-prev, #nav-next, #key-hint { 
            display: none !important; 
        }
        img[alt="Admin Dashboard"], img[src="dashboard.png"] {
            display: none !important;
        }
    `});

    let pres = new pptxgen();
    pres.layout = 'LAYOUT_16x9';

    console.log('📸 Đang chụp ảnh tĩnh từng slide (đợi animation tải xong)...');
    for (let i = 0; i < TOTAL_SLIDES; i++) {
        // Mở từng trang để CSS animations & stagger chạy full
        await page.evaluate(`if (typeof goTo === "function") { goTo(${i}); }`);
        
        // Đợi 2 giây đảm bảo mọi thứ rõ nét, mượt mà trước khi chụp
        await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));

        // Chụp TOÀN BỘ MÀN HÌNH nguyên khối siêu nét
        const buffer = await page.screenshot({ type: 'png' });
        const base64Image = buffer.toString('base64');
        const dataUrl = `data:image/png;base64,${base64Image}`;

        let slide = pres.addSlide();
        // Giữ đúng tỷ lệ khung trình chiếu 16:9 
        slide.addImage({ data: dataUrl, x: 0, y: 0, w: 10, h: 5.625 });
        
        process.stdout.write(`\r✅ Đã chụp xong cấu trúc gốc hoàn hảo cho slide ${i + 1}/${TOTAL_SLIDES}`);
    }
    
    console.log('\n📦 Đang đóng gói file PPTX khối tĩnh...');
    await pres.writeFile({ fileName: OUTPUT_FILE });
    
    await browser.close();
    console.log(`🎉 Thành công! Tác phẩm cuối cùng ở dạng ảnh gốc tuyệt đối sắc nét được xuất tại: ${OUTPUT_FILE}`);
})();
