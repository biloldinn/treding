const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize with v1beta to ensure gemini-1.5-flash availability if v1 is restricted
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }, { apiVersion: 'v1beta' });
const visionModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }, { apiVersion: 'v1beta' });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "arcee-ai/trinity-mini:free";

// ===================================================
// PDF BOOKS LOADER
// ===================================================
let BOOK_KNOWLEDGE = '';
let loadedBooks = [];

async function loadPdfBooks() {
    const booksDir = path.join(__dirname, 'books');
    if (!fs.existsSync(booksDir)) {
        console.warn('⚠️ books/ papkasi topilmadi. Standart bilim bazasi ishlatiladi.');
        return;
    }

    let pdfParse;
    try {
        pdfParse = require('pdf-parse');
    } catch (e) {
        console.warn('⚠️ pdf-parse kutubxonasi topilmadi. npm install bajaring.');
        return;
    }

    const files = fs.readdirSync(booksDir).filter(f => f.endsWith('.pdf'));
    console.log(`📚 ${files.length} ta kitob topildi. O'qilmoqda...`);

    const texts = [];
    for (const file of files) {
        try {
            const filePath = path.join(booksDir, file);
            const buffer = fs.readFileSync(filePath);
            const data = await pdfParse(buffer); // Barcha sahifalarni o'qish (limisiz)
            const text = data.text
                .replace(/\s+/g, ' ')
                .replace(/(.)\1{5,}/g, '$1') // remove repeated chars
                .trim(); // Hech qanday qisqartirishsiz (to'liq matn)

            if (text.length > 100) {
                texts.push(`\n=== KITOB: "${file}" ===\n${text}\n`);
                loadedBooks.push(file);
                console.log(`  ✅ ${file} (${text.length} belgi yuklandi)`);
            }
        } catch (err) {
            console.warn(`  ⚠️ ${file} o'qishda xato:`, err.message);
        }
    }

    BOOK_KNOWLEDGE = texts.join('\n');
    console.log(`✅ Jami ${loadedBooks.length} ta kitob AI ga integratsiya qilindi!`);
}

// ===================================================
// STATIC KNOWLEDGE (fallback + supplement)
// ===================================================
// User requested to remove static hardcoded knowledge so it relies fully on PDFs:
const STATIC_KNOWLEDGE = ``;

// ===================================================
// FULL PROMPT BUILDER
// ===================================================
function buildSystemPrompt() {
    return `SIZ PROFESSIONAL TRADING ANALISTISIZ. 

=== YUKLANGAN KITOBLARDAN MA'LUMOTLAR ===
${BOOK_KNOWLEDGE}

JAVOB BERISH QOIDALARI:
- FAQAT O'ZBEK TILIDA javob bering
- Professional, aniq va qisqa bo'lsin
- Har doim kitoblardagi aniq kontseptsiyalar va strategiyalarni ishlating. Javobingiz faqat kitoblarga asoslangan bo'lishi shart!
- Yuklangan kitoblar: ${loadedBooks.join(', ')}`;
}

// ===================================================
// API: CHART ANALYSIS (with image)
// ===================================================
app.post('/api/analyze', async (req, res) => {
    const { imageBase64, timeframe, pair, additionalContext } = req.body;
    if (!imageBase64) return res.status(400).json({ success: false, error: 'Rasm kerak!' });

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = imageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';

    const prompt = `${buildSystemPrompt()}

TAHLIL QILISH UCHUN:
- Juftlik: ${pair || 'XAU/USD'}
- Vaqt oralig'i: ${timeframe || 'M5'}
- Qo'shimcha: ${additionalContext || 'Yo\'q'}

VAZIFANGIZ: Bu savdo terminali (MT4/MT5) skrinshotidir. Uni FAQAT GINA YUKLANGAN KITOBLARDAGI professional strategiyalarga (SMC, Wyckoff, Elliott Wave, MO3, SND va boshqalar) tayanib juda chuqur tahlil qiling. 

DIQQAT: Sizning tahlilingiz va beradigan BUY/SELL/WAIT signalingiz faqat yuklangan kitoblarda yozilgan texnik qoidalar (Order Block, FVG, BOS, CHoCH, Liquidity sweep va h.k.) asosida bo'lishi SHART. Agar rasmda kitoblardagi biror aniq pattern (masalan, Quasimodo yoki Spring) bo'lsa, uni nomi bilan ayting.

O'zbek tilida professional treyderdek javob bering. Quyidagi tuzilmaga qat'iy rioya qiling:

## 📊 BOZOR STRUKTURASI
[Joriy trend haqida batafsil ma'lumot. Kitoblar bo'yicha HH, HL, LH, LL qanday shakllanmoqda? Trend o'zgarishi bormi?]

## 🕯️ SHAMLAR VA ZONALAR TAHLILI
[Ko'rinayotgan shamlar naqshlari. Kitoblardagi qaysi pattern (Engulfing, Doji va h.k.) bor? Order Blocklar va FVG zonalari qayerda?]

## 🎯 KESKIN SIGNAL VA TAVSIYA
Signal: 🟢 SOTIB OL (BUY) / 🔴 SOT (SELL) / 🟡 KUTISH (WAIT)
[Kitoblar bilimiga asoslangan keskin va aniq xulosa.]
Kirish (Entry) zonasi: [Aniq narx yoki zona]
Zararni cheklash (SL): [Qayerga va nega?]
Foyda olish (TP): [Maqsad zonasi]

## 💡 MT5/PROFESSIONAL MASLAHAT
[Bu vaziyatda integratsiya qilingan kitoblar nimani uqtiradi? Risk va psixologiya bo'yicha qisqa tavsiya.]`;

    try {
        const result = await model.generateContent([
            {
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType
                }
            },
            { text: prompt }
        ]);
        res.json({ success: true, analysis: result.response.text(), booksUsed: loadedBooks });
    } catch (error) {
        console.error('AI tahlil xatosi:', error);
        res.status(500).json({ success: false, error: 'AI tahlilida xatolik: ' + error.message });
    }
});

// ===================================================
// API: CHAT
// ===================================================
app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    const systemPrompt = buildSystemPrompt();

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://github.com/biloldinn/treding",
                "X-Title": "Turon AI Trading"
            },
            body: JSON.stringify({
                model: OPENROUTER_MODEL,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `FOYDALANUVCHI SAVOLI: "${message}"\n\nO'zbek tilida qisqa, professional va aniq javob bering. Kitoblardagi kontseptsiyalardan foydalaning.` }
                ]
            })
        });

        const data = await response.json();
        if (data && data.choices && data.choices.length > 0) {
            res.json({ success: true, response: data.choices[0].message.content });
        } else {
            // Fallback to Gemini if OpenRouter fails or returns empty format
            const geminiResult = await model.generateContent(systemPrompt + `\n\nFOYDALANUVCHI SAVOLI: "${message}"\n\nO'zbek tilida qisqa, professional javob bering.`);
            res.json({ success: true, response: geminiResult.response.text() });
        }
    } catch (error) {
        try {
            // Second fallback to Gemini on catch error
            const geminiResult = await model.generateContent(systemPrompt + `\n\nFOYDALANUVCHI SAVOLI: "${message}"\n\nO'zbek tilida qisqa, professional javob bering.`);
            res.json({ success: true, response: geminiResult.response.text() });
        } catch (fallbackError) {
            res.status(500).json({ success: false, error: 'Chat xatosi: har ikkala API ham band.' });
        }
    }
});

// ===================================================
// API: BOOKS STATUS
// ===================================================
app.get('/api/books', (req, res) => {
    res.json({
        success: true,
        loaded: loadedBooks.length,
        books: loadedBooks,
        knowledgeSize: BOOK_KNOWLEDGE.length,
        status: loadedBooks.length > 0 ? 'Kitoblar integratsiya qilindi ✅' : 'Standart bilim bazasi ishlatilmoqda'
    });
});

// ===================================================
// API: MARKET DATA
// ===================================================
app.get('/api/market/:symbol', async (req, res) => {
    try {
        const url = `https://api.binance.com/api/v3/klines?symbol=${req.params.symbol}&interval=1h&limit=100`;
        const response = await fetch(url);
        const data = await response.json();
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Bozor ma\'lumotlari olishda xato' });
    }
});

// ===================================================
// START SERVER
// ===================================================
loadPdfBooks().then(() => {
    app.listen(PORT, () => {
        console.log(`\n🚀 Trading AI Server: http://localhost:${PORT}`);
        console.log(`📚 Integratsiya qilingan kitoblar: ${loadedBooks.length}`);
        if (loadedBooks.length > 0) {
            loadedBooks.forEach(b => console.log(`   • ${b}`));
        }
    });
});
