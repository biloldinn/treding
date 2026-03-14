const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'AIzaSyDn2SUrDcDUjyUKd8OQqlyf6Tzb663FcU0');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

const OPENROUTER_API_KEY = "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";
const OPENROUTER_MODEL = "arcee-ai/trinity-mini:free";

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
const STATIC_KNOWLEDGE = `
=== DFX STRATEGIYALARI (Statik Bilim Bazasi) ===

## SMC (Smart Money Concepts) - @demond_fx
Order Blocks: Bullish OB = kuchli o'sishdan oldingi so'nggi bearish sham. Bearish OB = kuchli tushishdan oldingi so'nggi bullish sham.
Fair Value Gaps (FVG): 3-shamlik naqsh, narx qaytib to'ldirishi kerak.
Likvidlik: Swing high/lowlar ustidagi va ostidagi stop-losslar. Smart money bu yerdan likvidlik yig'adi.
CHOCH: Likvidlik surilgandan so'ng birinchi qarama-qarshi BOS. Burilish signali.
BOS: Oldingi high (bullish) yoki low (bearish)ni sindirish. Davom etish signali.
Premium/Discount: 50% Fibonacci dan yuqori = Premium (sotish). Pastda = Discount (sotib olish).

## SNR (Qo'llab-quvvatlash va Qarshilik)
Kuchli darajalar: Ko'p marta tegilgan, oliy taym-freymdan, keskin harakat.
Flip zonalar: Eski qo'llab-quvvatlash → yangi qarshilik va aksincha.
Yumaloq raqamlar: 1.1000, 1.2000 - psixologik kuchli darajalar.

## Wyckoff Metodi
Akkumulyatsiya: Smart money sotib olmoqda. PS, SC, AR, ST, Spring, SOS bosqichlari.
Distribyusiya: Smart money sotmoqda. Akkumulyatsiyaning teskarisi.
Spring: Qo'llabdan yolg'on sindirish → haqiqiy o'sishdan oldin.
Upthrust: Qarshilikdan yolg'on sindirish → haqiqiy tushishdan oldin.
VSA: Yuqori hajm + tor spread = yutish. Past hajm + keng spread = zaiflik.

## Fibonacci
Asosiy darajalar: 0.618, 0.65, 0.705, 0.79 (Golden Pocket).
Kirish: BOSdan so'ng 0.618-0.705 korreksiya.
OTE: 0.618-0.79 - Optimal Trade Entry zonasi.

## Elliott Wave
Impuls: Trend yo'nalishida 5 to'lqin (1-2-3-4-5). To'lqin 3 har doim eng uzun.
Korreksiya: Trendga qarshi 3 to'lqin (A-B-C).
Qoidalar: To'lqin 2 hech qachon 100%dan ortiq korreksiya qilmaydi. To'lqin 4 To'lqin 1 bilan hech qachon o'chishmaydi.
Eng yaxshi kirish: To'lqin 2 (pastda sotib olish), To'lqin 4, To'lqin B.

## MO3 (Manipulyatsiya, Optimallashtirish, Kengayish) - DFX
Manipulyatsiya: Narx kunlik high/lowni surib treyderlarni tuzoqqa tushiradi.
Optimallashtirish (OP): Narx OB yoki FVGga qaytadi - optimal kirish zonasi.
Kengayish: OP dan haqiqiy yo'nalishli harakat boshlanadi.
Asosiy vaqtlar: 02:00-05:00 (Osiyo), 08:00-10:00 (London), 14:00-16:00 (NY).

## CHOCH Naqshi
Trend → Likvidlik surish → CHOCH (birinchi qarama-qarshi BOS) → Retestda kirish.
Tasdiq: RSI divergensiyasi + CHOCH = yuqori ehtimollik.

## Quasimodo (QM)
Kengaytirilgan burilish naqshi. Chap elka, bosh, o'ng elka (o'ng elka bearish QM uchun chapdan past).
Kirish: "Bo'yin" darajasining sinishi va retesti.

## SND Naqshi - Talab va Taklif
Yangi zonalar: Birinchi marta narx yetib borganda - eng kuchli.
Zona kuchi: Keskin harakat = kuchli zona. Asta-sekin = zaif.
Eng yaxshi kirish: Yangi zonalar + sessiya high/low surishi bilan mos kelsa.

## Shamlar Naqshlari
Hammer/Pin Bar: Uzun wick = narx rad etish. Qo'llab-quvvatlashda bullish pin → sotib ol.
Engulfing: Oldingi shamni to'liq qoplaydi. Kuchli burilish signali.
Doji: Noaniqlik. Kengayish davom etadi.
Sabah/Kechki Yulduz (Morning/Evening Star): 3 shamlik burilish naqshlari.
Marubozu: To'liq gavdali sham, wicksiz. Juda kuchli momentum.

## Risk Menejment
Risik: Depozitning 1-2%.
RRR: Minimal 1:2 (yaxshisi 1:3 yoki 1:5).
SLni erta zararbezarga ko'chirmang.
Trailing stop: Narx 1R foyda ko'rsatganda birinchi swingga ko'chiring.

## Sessiya Vaqtlari (UTC+5)
Osiyo sessiyasi: 02:00 - 11:00
London sessiyasi: 10:00 - 19:00
New York sessiyasi: 15:00 - 24:00
Kill zonalar (eng yaxshi kirish): 08:00-10:00, 13:00-15:00, 19:00-21:00

## Kirish Tekshiruvi
1. Bozor tuzilishini aniqlash (trend yoki range)
2. Muhim likvidlik havzalarini belgilash (swing high/low)
3. Likvidlik surishini kutish (fakeout)
4. CHOCH yoki kuchli rad etishni izlash
5. OB/FVG/Talab-Taklif zonasida kirish
6. SLni likvidlik havzasidan narida qo'yish
7. Daromad olishni keyingi likvidlik zonasida
`;

// ===================================================
// FULL PROMPT BUILDER
// ===================================================
function buildSystemPrompt() {
    return `SIZ PROFESSIONAL TRADING ANALISTISIZ. SIZNING BILIM BAZANGIZ:

${BOOK_KNOWLEDGE ? '=== YUKLANGAN KITOBLARDAN MA\'LUMOTLAR ===\n' + BOOK_KNOWLEDGE : ''}

${STATIC_KNOWLEDGE}

JAVOB BERISH QOIDALARI:
- FAQAT O'ZBEK TILIDA javob bering
- Professional, aniq va qisqa bo'lsin
- Har doim kitoblardagi aniq kontseptsiyalar va strategiyalarni ishlating
- ${loadedBooks.length > 0 ? `Yuklangan kitoblar: ${loadedBooks.join(', ')}` : 'Standart DFX bilim bazasi ishlatilmoqda'}`;
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
- Juftlik: ${pair || 'Noma\'lum'}
- Vaqt oralig'i: ${timeframe || 'Noma\'lum'}
- Qo'shimcha: ${additionalContext || 'Yo\'q'}

VAZIFANGIZ: Bu MetaTrader bozor skrinshotini to'liq professional tahlil qiling.

## 📊 BOZOR STRUKTURASI
[Trend yo'nalishi. Muhim HH, HL yoki LH, LL nuqtalar]

## 🕯️ SHAMLAR TAHLILI
[Ko'rinayotgan shamlar naqshlari, eng muhim so'nggi shamlar]

## 🏦 SMC TAHLILI
[Order Blocklar, FVGlar, Likvidlik zonalari]

## 📍 MUHIM ZONALAR
[Qo'llab-quvvatlash: ... | Qarshilik: ...]

## 🎯 SIGNAL
Signal: 🟢 SOTIB OL / 🔴 SOT / 🟡 KUTISH
Kirish: [narx]
To'xtatish (SL): [narx]
Maqsad 1 (TP1): [narx]
Maqsad 2 (TP2): [narx]
Risk/Reward: [1:X]
Strategiya: [SMC/Wyckoff/MO3/Elliott va h.k.]

## ⚠️ XAVF VA ISHONCH
Ishonch darajasi: [Yuqori/O'rta/Past] - XX%
[Sabab]

## 💡 XULOSA
[2-3 gapda qisqa xulosa va tavsiya]`;

    try {
        const result = await model.generateContent([
            { inlineData: { data: base64Data, mimeType } },
            prompt
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
            console.error("OpenRouter Response Error:", data);
            res.status(500).json({ success: false, error: 'OpenRouter tahlilida xatolik yuz berdi.' });
        }
    } catch (error) {
        console.error('Chat xatosi: ', error);
        res.status(500).json({ success: false, error: 'Chat xatosi: ' + error.message });
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
