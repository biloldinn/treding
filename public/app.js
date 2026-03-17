// ===========================
// TRADING AI - Main App Logic
// ===========================

const API_BASE = window.location.origin;

// Fetch loaded books from server
async function fetchBooksStatus() {
    try {
        const res = await fetch(`${API_BASE}/api/books`);
        const data = await res.json();
        if (data.success && data.loaded > 0) {
            const booksEl = document.getElementById('booksStatus');
            if (booksEl) {
                booksEl.innerHTML = `✅ <strong>${data.loaded} ta kitob AI ga integratsiya qilindi:</strong><br><span style="color:var(--text-secondary)">${data.books.map(b => '• ' + b).join('<br>')}</span>`;
            }
            const headerBadge = document.getElementById('booksBadge');
            if (headerBadge) {
                headerBadge.textContent = `📚 ${data.loaded} kitob yuklangan`;
                headerBadge.style.color = 'var(--accent-green)';
            }
        }
    } catch (e) {
        console.log('Books status fetch failed (server may not be running)');
    }
}

// -------- State --------
let currentSymbol = 'XAUUSD';
let currentInterval = '1h';
let candles = [];
let currentPrice = 0;
let priceChange = 0;
let animFrame = null;
let uploadedImageBase64 = null;

// -------- DOM Refs --------
const tvContainer = document.getElementById('tvChartContainer');
const currentPriceEl = document.getElementById('currentPrice');
const priceChangeEl = document.getElementById('priceChange');
const statOpen = document.getElementById('statOpen');
const statHigh = document.getElementById('statHigh');
const statLow = document.getElementById('statLow');
const statVol = document.getElementById('statVol');
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('chartUpload');
const uploadPreview = document.getElementById('uploadPreview');
const uploadHint = document.getElementById('uploadHint');
const btnAnalyze = document.getElementById('btnAnalyze');
const analysisOutput = document.getElementById('analysisOutput');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');

// ===========================
// TRADINGVIEW CHART INIT
// ===========================
let chart, candleSeries;

function initChart() {
    if (!tvContainer) return;
    chart = LightweightCharts.createChart(tvContainer, {
        width: tvContainer.clientWidth,
        height: tvContainer.clientHeight,
        layout: {
            background: { type: 'solid', color: '#0a0e1a' },
            textColor: '#8892a4',
        },
        grid: {
            vertLines: { color: 'rgba(255,255,255,0.04)' },
            horzLines: { color: 'rgba(255,255,255,0.04)' },
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
        },
        rightPriceScale: {
            borderColor: 'rgba(255,255,255,0.1)',
        },
        timeScale: {
            borderColor: 'rgba(255,255,255,0.1)',
            timeVisible: true,
            secondsVisible: false,
        },
    });

    candleSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
    });

    window.addEventListener('resize', () => {
        chart.resize(tvContainer.clientWidth, tvContainer.clientHeight);
    });
}

// ===========================
// FETCH MARKET DATA
// ===========================
async function fetchCandles() {
    try {
        const url = `https://api.binance.com/api/v3/klines?symbol=${currentSymbol}&interval=${currentInterval}&limit=80`;
        const res = await fetch(url);
        const data = await res.json();
        if (!Array.isArray(data)) return;

        candles = data.map(k => ({
            time: k[0],
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5])
        }));

        if (candles.length > 0) {
            const last = candles[candles.length - 1];
            const first = candles[0];
            currentPrice = last.close;
            priceChange = ((last.close - first.open) / first.open * 100);
            updateStats();

            // Format for TradingView (time must be in seconds)
            const tvData = candles.map(c => ({
                time: c.time / 1000,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close
            }));
            candleSeries.setData(tvData);
        }
    } catch (e) {
        console.warn('Binance API error, generating demo data');
        generateDemoCandles();
    }
}

function updateStats() {
    if (!candles.length) return;
    const last = candles[candles.length - 1];
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const vols = candles.map(c => c.volume);

    currentPriceEl.textContent = formatPrice(currentPrice);
    priceChangeEl.textContent = (priceChange >= 0 ? '+' : '') + priceChange.toFixed(2) + '%';
    priceChangeEl.className = 'price-change ' + (priceChange >= 0 ? 'up' : 'down');

    statOpen.textContent = formatPrice(last.open);
    statHigh.textContent = formatPrice(Math.max(...highs));
    statLow.textContent = formatPrice(Math.min(...lows));
    statVol.textContent = formatVolume(vols.reduce((a, b) => a + b, 0));
}

function formatPrice(p) {
    if (currentSymbol.includes('XAU')) return p.toFixed(2);
    if (p > 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (p > 1) return p.toFixed(4);
    return p.toFixed(6);
}

function formatVolume(v) {
    if (v > 1e9) return (v / 1e9).toFixed(1) + 'B';
    if (v > 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (v > 1e3) return (v / 1e3).toFixed(1) + 'K';
    return v.toFixed(0);
}

// ===========================
// DEMO CANDLES (fallback)
// ===========================
function generateDemoCandles() {
    candles = [];
    let price = 43500;
    const now = Date.now();
    for (let i = 79; i >= 0; i--) {
        const open = price;
        const change = (Math.random() - 0.48) * price * 0.012;
        const close = open + change;
        const wick1 = Math.abs(Math.random() * price * 0.006);
        const wick2 = Math.abs(Math.random() * price * 0.006);
        candles.push({
            time: now - i * 3600000,
            open,
            high: Math.max(open, close) + wick1,
            low: Math.min(open, close) - wick2,
            close
        });
        price = close;
    }
    currentPrice = candles[candles.length - 1].close;
    priceChange = ((currentPrice - candles[0].open) / candles[0].open * 100);
    updateStats();

    // Format for TradingView
    const tvData = candles.map(c => ({
        time: c.time / 1000,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close
    }));
    candleSeries.setData(tvData);
}

// ===========================
// LIVE TICK ANIMATION
// ===========================
function startLiveTick() {
    if (!candles.length) return;
    const tickInterval = setInterval(() => {
        if (!candles.length) return;
        const last = candles[candles.length - 1];
        const change = (Math.random() - 0.49) * currentPrice * 0.0008;
        currentPrice = Math.max(currentPrice + change, 1);
        last.close = currentPrice;
        last.high = Math.max(last.high, currentPrice);
        last.low = Math.min(last.low, currentPrice);
        priceChange = ((currentPrice - candles[0].open) / candles[0].open * 100);

        currentPriceEl.textContent = formatPrice(currentPrice);
        priceChangeEl.textContent = (priceChange >= 0 ? '+' : '') + priceChange.toFixed(2) + '%';
        priceChangeEl.className = 'price-change ' + (priceChange >= 0 ? 'up' : 'down');

        candleSeries.update({
            time: last.time / 1000,
            open: last.open,
            high: last.high,
            low: last.low,
            close: last.close
        });
    }, 500);
    return tickInterval;
}

// ===========================
// NAVIGATION (BOTTOM TABS)
// ===========================
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        // Haptic feedback if supported
        if (navigator.vibrate) navigator.vibrate(50);

        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.view-section').forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(btn.dataset.view).classList.add('active');

        // Redraw chart if switching back to home
        if (btn.dataset.view === 'viewHome' && chart) {
            setTimeout(() => {
                chart.resize(tvContainer.clientWidth, tvContainer.clientHeight);
            }, 50);
        }
    });
});

// ===========================
// TIMEFRAME BUTTONS
// ===========================
document.querySelectorAll('.tf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (navigator.vibrate) navigator.vibrate(50);
        document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentInterval = btn.dataset.tf;
        fetchCandles();
    });
});

// ===========================
// MARKET SELECT
// ===========================
document.getElementById('marketSelect').addEventListener('change', (e) => {
    currentSymbol = e.target.value;
    fetchCandles();
});

// ===========================
// FILE UPLOAD
// ===========================
uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
});

uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));

uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleFileSelect(file);
});

fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFileSelect(fileInput.files[0]);
});

// Double input for re-selection
const fileInputReselect = document.getElementById('chartUploadReselect');
if (fileInputReselect) {
    fileInputReselect.addEventListener('change', () => {
        if (fileInputReselect.files[0]) handleFileSelect(fileInputReselect.files[0]);
    });
}

function handleFileSelect(file) {
    if (navigator.vibrate) navigator.vibrate(50);
    const reader = new FileReader();
    reader.onload = (e) => {
        uploadedImageBase64 = e.target.result;
        uploadPreview.src = uploadedImageBase64;

        document.getElementById('previewContainer').style.display = 'block';
        uploadZone.style.display = 'none'; // Hide native upload box

        btnAnalyze.disabled = false;
        showToast('📸 Rasm yuklandi!');

        // Scroll slightly down
        window.scrollBy({ top: 150, behavior: 'smooth' });
    };
    reader.readAsDataURL(file);
}

// ===========================
// AI ANALYSIS
// ===========================
btnAnalyze.addEventListener('click', analyzeChart);

async function analyzeChart() {
    if (!uploadedImageBase64) {
        showToast('⚠️ Avval bozor skrinshotini yuklang!');
        return;
    }

    const pair = document.getElementById('pairInput').value || currentSymbol;
    const timeframe = document.getElementById('tfInput').value || currentInterval;

    // Switch to analysis tab (mobile view)
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(c => c.classList.remove('active'));
    document.querySelector('[data-view="viewAnalysis"]').classList.add('active');
    document.getElementById('viewAnalysis').classList.add('active');

    // Show loading
    analysisOutput.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner"></div>
            <div>AI bozorni tahlil qilmoqda...</div>
            <div style="font-size:0.72rem; opacity:0.5">DFX Strategiyalari asosida</div>
        </div>
    `;

    btnAnalyze.disabled = true;
    btnAnalyze.textContent = '⏳ Tahlil qilinmoqda...';

    try {
        const res = await fetch(`${API_BASE}/api/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imageBase64: uploadedImageBase64,
                pair,
                timeframe,
                additionalContext: ''
            })
        });
        const data = await res.json();
        if (data.success) {
            renderAnalysis(data.analysis);
            showToast('✅ Tahlil tayyor!');
            updateSignalsPanel(data.analysis, pair);
        } else {
            analysisOutput.innerHTML = `<div style="color:#ff4757; padding:16px; font-size:0.82rem;">❌ Xato: ${data.error}</div>`;
        }
    } catch (e) {
        analysisOutput.innerHTML = `<div style="color:#ff4757; padding:16px; font-size:0.82rem;">❌ Server bilan ulanishda xato. Server ishlamoqdami?</div>`;
    }

    btnAnalyze.disabled = false;
    btnAnalyze.innerHTML = '🤖 AI Bilan Tahlil Qilish';
}

function renderAnalysis(text) {
    const sections = text.split(/## /g).filter(Boolean);
    let html = '<div class="analysis-result">';
    sections.forEach(sec => {
        const lines = sec.split('\n');
        const title = lines[0].trim();
        const body = lines.slice(1).join('\n').trim();
        html += `<div class="md-section">
            <div class="md-h2">${title}</div>
            <div class="md-text">${markdownToHtml(body)}</div>
        </div>`;
    });
    html += '</div>';
    analysisOutput.innerHTML = html;
}

function markdownToHtml(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#e8eaf6">$1</strong>')
        .replace(/🟢 SOTIB OL/g, '<span class="signal-badge signal-buy">🟢 SOTIB OL</span>')
        .replace(/🔴 SOT/g, '<span class="signal-badge signal-sell">🔴 SOT</span>')
        .replace(/🟡 KUTISH/g, '<span class="signal-badge signal-wait">🟡 KUTISH</span>')
        .replace(/\n/g, '<br>');
}

function updateSignalsPanel(analysisText, pair) {
    const isBuy = analysisText.includes('SOTIB OL');
    const isSell = analysisText.includes('SOT') && !isBuy;
    const dir = isBuy ? 'BUY' : (isSell ? 'SELL' : 'WAIT');
    const card = document.getElementById('latestSignalCard');
    if (!card) return;

    const dirClass = isBuy ? 'dir-buy' : (isSell ? 'dir-sell' : '');
    card.innerHTML = `
        <div class="signal-card-header">
            <span class="signal-pair">${pair}</span>
            <span class="signal-dir ${dirClass}">${dir}</span>
        </div>
        <div class="signal-card-body">
            <span>Vaqt:</span><span>${new Date().toLocaleTimeString()}</span>
            <span>Interval:</span><span>${currentInterval.toUpperCase()}</span>
            <span>AI Tahlil:</span><span style="color:${isBuy ? '#00d4aa' : '#ff4757'}">Tayyor ✓</span>
        </div>
    `;
}

// ===========================
// AI CHAT & VOICE
// ===========================

// Voice Recognition Init
const btnMic = document.getElementById('btnMicChat');
let recognition;
let isRecording = false;

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'uz-UZ';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        chatInput.value = transcript;
        showToast('🎙 Gap matnga aylantirildi!');
    };

    recognition.onerror = (e) => {
        showToast('🎙 Xato: ' + e.error);
        stopRecording();
    };

    recognition.onend = () => {
        stopRecording();
    };

    btnMic.addEventListener('click', () => {
        if (isRecording) stopRecording();
        else startRecording();
    });
} else {
    if (btnMic) btnMic.style.display = 'none'; // yashiramiz agar brauzer qo'llab-quvvatlamasa
}

function startRecording() {
    if (!recognition) return;
    if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
    recognition.start();
    isRecording = true;
    btnMic.style.color = '#ff4757';
    btnMic.style.animation = 'pulse 1.5s infinite';
}

function stopRecording() {
    if (!recognition) return;
    isRecording = false;
    btnMic.style.color = 'var(--accent-gold)';
    btnMic.style.animation = 'none';
}

chatInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        await sendChat();
    }
});

document.getElementById('btnSendChat').addEventListener('click', sendChat);

async function sendChat() {
    const msg = chatInput.value.trim();
    if (!msg) return;

    appendMsg(msg, 'user');
    chatInput.value = '';

    const thinking = appendMsg('⏳ Savol tahlil qilinmoqda...', 'ai');

    try {
        const res = await fetch(`${API_BASE}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg })
        });
        const data = await res.json();
        thinking.textContent = data.success ? data.response : '❌ ' + data.error;
    } catch {
        thinking.textContent = '❌ Server bilan ulanishda xato.';
    }
}

function appendMsg(text, type) {
    const div = document.createElement('div');
    div.className = `msg ${type}`;
    div.textContent = text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
}

// ===========================
// KNOWLEDGE CARDS (click)
// ===========================
document.querySelectorAll('.knowledge-card').forEach(card => {
    card.addEventListener('click', () => {
        if (navigator.vibrate) navigator.vibrate(50);
        const topic = card.querySelector('.knowledge-card-title').textContent;

        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.view-section').forEach(c => c.classList.remove('active'));
        document.querySelector('[data-view="viewChat"]').classList.add('active');
        document.getElementById('viewChat').classList.add('active');

        chatInput.value = topic + ' nima ekanligini muallif @demond_fx va DFX metodikasi asosida tushuntirib bering.';
        sendChat();
    });
});

// ===========================
// TOAST
// ===========================
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ===========================
// INIT
// ===========================
async function init() {
    initChart();
    generateDemoCandles(); // Show immediately
    startLiveTick();
    await fetchCandles();  // Then fetch real
    setInterval(fetchCandles, 60000); // Refresh every minute
    fetchBooksStatus();    // Load PDF books status from server
}

init();
