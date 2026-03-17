// === SECCIÓN 0: CONEXIÓN A FIREBASE Y AUTH ===
const firebaseConfig = {
    apiKey: "AIzaSyBt7H1cC6rdi5gRYAWH97_XED7C5eSauZk",
    authDomain: "sudoku-area-7.firebaseapp.com",
    projectId: "sudoku-area-7",
    storageBucket: "sudoku-area-7.firebasestorage.app",
    messagingSenderId: "1054280436923",
    appId: "1:1054280436923:web:32868f894caa7cfab0ed9e"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth(); // Inicializamos el motor de cuentas

let currentUser = null; // Variable para saber si hay alguien conectado

const screens = {
    menu: document.getElementById('menu-screen'),
    diff: document.getElementById('difficulty-screen'),
    store: document.getElementById('store-screen'),
    calendar: document.getElementById('calendar-screen'),
    game: document.getElementById('game-screen'),
    ranking: document.getElementById('ranking-screen'),
    profile: document.getElementById('profile-screen')
};

let seconds = 0, timerInterval = null, selectedCell = null, isDailyMode = true;
let currentDifficulty = 40, dailyGameInProgress = false, mistakes = 0, correctAnswersNeeded = 0;
let currentSolution = [], currentTab = 'skins';

const solvedBoard = [
    [5,3,4,6,7,8,9,1,2], [6,7,2,1,9,5,3,4,8], [1,9,8,3,4,2,5,6,7],
    [8,5,9,7,6,1,4,2,3], [4,2,6,8,5,3,7,9,1], [7,1,3,9,2,4,8,5,6],
    [9,6,1,5,3,7,2,8,4], [2,8,7,4,1,9,6,3,5], [3,4,5,2,8,6,1,7,9]
];

const catalog = {
    skins: [ { id: 'default', name: 'Clásico Neón', price: 0, preview: '#121212', border: '#4facfe' }, { id: 'pearl', name: 'Perla (Premium)', price: 1.99, preview: '#F4F1EA', border: '#D4AF37' }, { id: 'ruby', name: 'Rubí Campeón', price: 0, preview: '#300', border: '#f00' } ],
    music: [ { id: 'none', name: 'Sin Música', price: 0, preview: '🔇' }, { id: 'lofi', name: 'Lo-Fi Chill (Gratis)', price: 0, preview: '🎧' }, { id: 'piano', name: 'Piano Zen', price: 0.99, preview: '🎹' } ],
    emojis: [{ id: 'none', name: 'Ninguno', price: 0, preview: '❌' }], anims: [{ id: 'static', name: 'Estático', price: 0, preview: '⬜' }],
    fonts: [ { id: 'sans', name: 'Estándar', price: 0, preview: 'ABC' }, { id: 'digital', name: 'Digital Pro', price: 0.99, preview: '8.8.' } ]
};

const themes = {
    'default': { '--bg-color': '#121212', '--card-bg': '#1e1e1e', '--main-color': '#4facfe', '--text-color': '#ffffff', '--cell-bg': '#1e1e1e', '--fixed-num': '#4facfe' },
    'pearl': { '--bg-color': '#F4F1EA', '--card-bg': '#E8E4D9', '--main-color': '#D4AF37', '--text-color': '#4A4A4A', '--cell-bg': '#FAF9F6', '--fixed-num': '#A67C00' },
    'ruby': { '--bg-color': '#1a0000', '--card-bg': '#330000', '--main-color': '#ff4d4d', '--text-color': '#ffffff', '--cell-bg': '#2b0000', '--fixed-num': '#ff4d4d' }
};

if(!localStorage.getItem('owned_default')) localStorage.setItem('owned_default', 'bought'); 
if(!localStorage.getItem('owned_sans')) localStorage.setItem('owned_sans', 'bought');
if(!localStorage.getItem('owned_none')) localStorage.setItem('owned_none', 'bought');
if(!localStorage.getItem('owned_lofi')) localStorage.setItem('owned_lofi', 'bought');

// === NUEVO: SISTEMA DE CUENTAS DE GOOGLE ===
auth.onAuthStateChanged((user) => {
    const btnProfile = document.getElementById('btn-profile-top');
    if (user) {
        currentUser = user;
        // Si hay usuario, cambia el botón al nombre de la persona
        let shortName = user.displayName ? user.displayName.split(' ')[0] : "Jugador";
        btnProfile.innerText = `👤 ${shortName}`;
        
        // Guardamos el nombre para el ranking
        localStorage.setItem('miNombreJugador', user.displayName);
        
        // Llenar datos en la pantalla de perfil
        document.getElementById('profile-name').innerText = user.displayName;
        document.getElementById('profile-email').innerText = user.email;
    } else {
        currentUser = null;
        btnProfile.innerText = "👤 Iniciar Sesión";
    }
});

function loginGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).then((result) => {
        console.log("Sesión iniciada con éxito", result.user.displayName);
        document.getElementById('game-modal').classList.add('hidden'); // Cierra el modal si estaba abierto
    }).catch((error) => {
        alert("Error al iniciar sesión: " + error.message);
    });
}

function logout() {
    if(confirm("¿Seguro que deseas cerrar sesión?")) {
        auth.signOut().then(() => {
            changeScreen('menu');
        });
    }
}

// Botones de sesión
document.getElementById('btn-profile-top').onclick = () => {
    if (currentUser) {
        changeScreen('profile');
    } else {
        loginGoogle();
    }
};
document.getElementById('btn-logout').onclick = logout;
document.getElementById('btn-back-profile').onclick = () => changeScreen('menu');

// === MODALES VISUALES ===
function showModal(title, message, showLoginBtn, callback) {
    const modal = document.getElementById('game-modal');
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-message').innerText = message;
    
    const btnLogin = document.getElementById('modal-btn-login');
    const btnAccept = document.getElementById('modal-btn');

    if (showLoginBtn) {
        btnLogin.classList.remove('hidden');
        btnLogin.onclick = () => { loginGoogle(); if(callback) callback(); };
        btnAccept.innerText = "Omitir por ahora";
    } else {
        btnLogin.classList.add('hidden');
        btnAccept.innerText = "Aceptar";
    }
    
    modal.classList.remove('hidden');
    
    btnAccept.onclick = () => {
        modal.classList.add('hidden');
        if (callback) callback();
    };
}

// === LÓGICA DE TIENDA Y MÚSICA ===
function changeScreen(to) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[to].classList.remove('hidden');
    
    // El botón flotante solo se ve en el menú principal
    if (to === 'menu') document.getElementById('btn-profile-top').classList.remove('hidden');
    else document.getElementById('btn-profile-top').classList.add('hidden');
}

function switchTab(tabName, event) {
    currentTab = tabName;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');
    renderStore();
}

function renderStore() {
    const container = document.getElementById('store-items-container');
    container.innerHTML = '';
    const items = catalog[currentTab];
    const equippedId = localStorage.getItem(`equipped_${currentTab}`) || items[0].id;

    items.forEach(item => {
        const isEq = item.id === equippedId;
        const ownership = localStorage.getItem(`owned_${item.id}`); 
        const isOwned = ownership !== null;

        const div = document.createElement('div');
        div.className = `store-item ${isEq ? 'equipped' : ''}`;
        
        let preview = item.preview.startsWith('#') ? `<div class="item-preview" style="background-color:${item.preview}; border-color:${item.border}"></div>` : `<div class="item-preview">${item.preview}</div>`;
        let nameClass = ownership === 'earned' ? 'prestige-text' : '';
        
        let actionButton = '';
        if (isEq) actionButton = `<button class="btn-equip" style="color:#4caf50; border-color:#4caf50;">Equipado</button>`;
        else if (isOwned) actionButton = `<button class="btn-equip" onclick="equipItem('${currentTab}', '${item.id}')">Usar</button>`;
        else actionButton = `<button class="btn-buy" onclick="procesarCompra('${item.id}', ${item.price})">Comprar $${item.price}</button>`;

        div.innerHTML = `${preview}<div class="item-info"><span class="${nameClass}">${item.name}</span></div>${actionButton}`;
        container.appendChild(div);
    });
}

function equipItem(cat, id) {
    localStorage.setItem(`equipped_${cat}`, id);
    if (cat === 'skins') applySkin(id);
    if (cat === 'fonts') applyFont(id);
    if (cat === 'music') applyMusic(id);
    renderStore();
}

function procesarCompra(itemId, precio) {
    if (confirm(`¿Proceder al pago seguro de $${precio} USD?`)) {
        showModal("COMPRA EXITOSA", "¡Gracias por apoyar a este desarrollador Indie!", false);
        localStorage.setItem(`owned_${itemId}`, 'bought'); 
        renderStore(); 
    }
}

function applySkin(name) {
    const theme = themes[name] || themes.default;
    Object.keys(theme).forEach(prop => document.documentElement.style.setProperty(prop, theme[prop]));
}

function applyFont(id) {
    const fontMap = { 'sans': 'sans-serif', 'digital': "'Orbitron', monospace" };
    document.documentElement.style.setProperty('--board-font', fontMap[id] || 'sans-serif');
}

function applyMusic(id) {
    const audio = document.getElementById('bg-audio');
    const tracks = { 'lofi': 'audio/lofi.mp3', 'piano': 'audio/piano.mp3' };
    if (id === 'none') { audio.pause(); } else if (tracks[id]) { audio.src = tracks[id]; audio.play().catch(e => console.log("Click para iniciar audio.")); }
}

// === RANKING Y CALENDARIO ===
function cargarRanking() {
    changeScreen('ranking');
    const rankingList = document.getElementById('ranking-list');
    rankingList.innerHTML = '<p style="color: #888;">Cargando el Top 30...</p>';

    db.collection("ranking").orderBy("tiempo", "asc").limit(30).get()
    .then((querySnapshot) => {
        rankingList.innerHTML = ''; 
        let posicion = 1, yoEstoyEnElTop = false;
        let miMejorTiempo = localStorage.getItem('miMejorTiempo'), miNombre = localStorage.getItem('miNombreJugador') || "Anónimo";

        if (querySnapshot.empty) { rankingList.innerHTML = '<p style="color: #888;">Aún no hay puntajes.</p>'; return; }

        querySnapshot.forEach((doc) => {
            let datos = doc.data();
            let m = Math.floor(datos.tiempo / 60).toString().padStart(2,'0'), s = (datos.tiempo % 60).toString().padStart(2,'0');
            let emoji = posicion === 1 ? "🥇" : (posicion === 2 ? "🥈" : (posicion === 3 ? "🥉" : posicion));
            let esMiRegistro = (miNombre === datos.nombre && parseInt(miMejorTiempo) === datos.tiempo);
            if (esMiRegistro) yoEstoyEnElTop = true;

            rankingList.innerHTML += `<div class="ranking-item ${esMiRegistro ? 'my-rank' : ''}"><span class="rank-pos">${emoji}</span><span class="rank-name">${datos.nombre} ${esMiRegistro ? '(Tú)' : ''}</span><span class="rank-time">${m}:${s}</span></div>`;
            posicion++;
        });

        if (miMejorTiempo && !yoEstoyEnElTop) {
            db.collection("ranking").where("tiempo", "<", parseInt(miMejorTiempo)).get().then((snap) => {
                let m = Math.floor(miMejorTiempo / 60).toString().padStart(2,'0'), s = (miMejorTiempo % 60).toString().padStart(2,'0');
                rankingList.innerHTML += `<div class="ranking-divider">...</div><div class="ranking-item my-rank"><span class="rank-pos">#${snap.size + 1}</span><span class="rank-name">${miNombre} (Tú)</span><span class="rank-time">${m}:${s}</span></div>`;
            });
        }
    }).catch(() => rankingList.innerHTML = '<p style="color: #ff4d4d;">Error al conectar.</p>');
}

function registrarVictoriaDiaria() {
    const d = new Date(), yearMonth = `${d.getFullYear()}_${d.getMonth()}`, hoy = d.getDate();
    let completados = JSON.parse(localStorage.getItem(`completed_${yearMonth}`)) || [];
    if (!completados.includes(hoy)) { completados.push(hoy); localStorage.setItem(`completed_${yearMonth}`, JSON.stringify(completados)); }
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    if (completados.length >= daysInMonth && !localStorage.getItem('owned_ruby')) {
        localStorage.setItem('owned_ruby', 'earned');
        showModal("🏆 ¡MES PERFECTO! 🏆", "Has completado todos los retos del mes. Acabas de ganar la skin 'Rubí Campeón'.", false);
    }
}

function generateCalendar() {
    const d = new Date(), daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(), firstDay = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
    const yearMonth = `${d.getFullYear()}_${d.getMonth()}`;
    let completados = JSON.parse(localStorage.getItem(`completed_${yearMonth}`)) || [];

    document.getElementById('month-title').innerText = d.toLocaleDateString('es-ES', {month:'long', year:'numeric'});
    document.getElementById('progress-text').innerText = `${completados.length} / ${daysInMonth} completados`;
    document.getElementById('progress-fill').style.width = `${(completados.length / daysInMonth) * 100}%`;

    const grid = document.getElementById('days-grid'); grid.innerHTML = '';
    for (let i = 0; i < firstDay; i++) grid.appendChild(Object.assign(document.createElement('div'), {className:'day-btn empty'}));
    
    for (let i = 1; i <= daysInMonth; i++) {
        const btn = document.createElement('button'); 
        let isToday = i === d.getDate(), isCompleted = completados.includes(i);
        btn.className = `day-btn ${isToday && !isCompleted ? 'today' : (isCompleted ? 'completed' : 'locked')}`;
        btn.innerText = isCompleted ? '✔️' : i; 
        if (isToday && !isCompleted) btn.onclick = () => startMatch(true, 40);
        grid.appendChild(btn);
    }
}

// === MOTOR DE JUEGO Y VALIDACIÓN ===
function startMatch(daily, diff) {
    isDailyMode = daily; currentDifficulty = diff;
    if (!daily || !dailyGameInProgress) {
        createBoard(); currentSolution = shuffleBoard(); correctAnswersNeeded = diff; mistakes = 0;
        fillBoard(createPuzzle(currentSolution, diff)); if (daily) dailyGameInProgress = true;
    }
    updateMistakesUI(); changeScreen('game'); startTimer(daily && dailyGameInProgress);
}
function shuffleBoard() { let nums = [1,2,3,4,5,6,7,8,9].sort(() => Math.random() - 0.5); return solvedBoard.map(row => row.map(cell => nums[cell - 1])); }
function createPuzzle(sol, count) { let puz = JSON.parse(JSON.stringify(sol)), rem = 0; while (rem < count) { let r = Math.floor(Math.random() * 9), c = Math.floor(Math.random() * 9); if (puz[r][c] !== '') { puz[r][c] = ''; rem++; } } return puz; }
function createBoard() {
    const b = document.getElementById('sudoku-board'); b.innerHTML = '';
    for (let i = 0; i < 81; i++) {
        const c = document.createElement('div'); c.className = 'cell'; c.dataset.row = Math.floor(i / 9); c.dataset.col = i % 9;
        c.onclick = () => { if (c.classList.contains('fixed-number') || c.classList.contains('correct-user-number')) return; if (selectedCell) selectedCell.classList.remove('selected'); selectedCell = c; c.classList.add('selected'); };
        b.appendChild(c);
    }
}
function fillBoard(data) { document.querySelectorAll('.cell').forEach((c, i) => { let val = data[Math.floor(i / 9)][i % 9]; c.innerText = val; c.className = 'cell' + (val !== '' ? ' fixed-number' : ''); }); }

// === LA MAGIA DEL "REGISTRO PEREZOSO" ===
document.querySelectorAll('.pad-btn').forEach(btn => {
    btn.onclick = () => {
        if (!selectedCell) return;
        if (btn.innerText === 'Borrar') { selectedCell.innerText = ''; return; }
        let val = parseInt(btn.innerText), r = selectedCell.dataset.row, c = selectedCell.dataset.col;
        
        if (val === currentSolution[r][c]) {
            selectedCell.innerText = val; selectedCell.classList.add('correct-user-number'); selectedCell.classList.remove('selected'); selectedCell = null;
            
            // Si Gana:
            if (--correctAnswersNeeded === 0) { 
                stopTimer();
                setTimeout(() => {
                    
                    let timeText = `Terminaste en ${seconds} segundos.`;

                    // Si NO ha iniciado sesión, le rogamos que lo haga mostrándole el botón rojo
                    if (!currentUser) {
                        showModal("¡VICTORIA!", `${timeText}\n\nConecta tu cuenta de Google gratis para guardar tu progreso, respaldar tus recompensas y entrar al Ranking Global.`, true, () => {
                            // Al cerrar u omitir, guardamos localmente
                            registrarLocal(seconds, isDailyMode);
                            dailyGameInProgress = false; changeScreen('menu');
                        });
                    } else {
                        // Si YA tiene sesión, lo guardamos en la nube directo y lo felicitamos
                        showModal("¡RETO SUPERADO!", `${timeText}\n\nTu récord ha sido sincronizado en la nube automáticamente.`, false, () => {
                            registrarNube(seconds, isDailyMode);
                            dailyGameInProgress = false; changeScreen('menu');
                        });
                    }
                    
                }, 100);
            }
        } else {
            if ("vibrate" in navigator) { navigator.vibrate(50); } 
            selectedCell.classList.add('error-anim'); setTimeout(() => selectedCell.classList.remove('error-anim'), 300);
            if (isDailyMode) { 
                if (++mistakes >= 3) { 
                    showModal("GAME OVER", "Te has quedado sin vidas. ¡Inténtalo de nuevo!", false, () => {
                        dailyGameInProgress = false; changeScreen('menu'); 
                    });
                } 
                updateMistakesUI(); 
            } else { seconds += 30; updateTimerUI(); }
        }
    };
});

function registrarLocal(secs, daily) {
    if (daily) registrarVictoriaDiaria();
    let myBest = localStorage.getItem('miMejorTiempo');
    if (!myBest || secs < parseInt(myBest)) { localStorage.setItem('miMejorTiempo', secs); }
}

function registrarNube(secs, daily) {
    registrarLocal(secs, daily);
    if (!daily && currentUser) {
        db.collection("ranking").add({ nombre: currentUser.displayName, tiempo: secs, dificultad: currentDifficulty, fecha: firebase.firestore.FieldValue.serverTimestamp() });
    }
}

// === CRONÓMETRO Y EVENTOS ===
function startTimer(res) { if(!res) seconds = 0; updateTimerUI(); clearInterval(timerInterval); timerInterval = setInterval(() => { seconds++; updateTimerUI(); }, 1000); }
function stopTimer() { clearInterval(timerInterval); }
function updateTimerUI() { let m = Math.floor(seconds/60).toString().padStart(2,'0'), s = (seconds%60).toString().padStart(2,'0'); document.getElementById('timer-display').innerText = `⏱ ${m}:${s}`; }
function updateMistakesUI() { document.getElementById('mistakes-display').innerText = isDailyMode ? `Vidas: ${'❤️'.repeat(3 - mistakes)}${'🖤'.repeat(mistakes)}` : "Modo Libre (+30s)"; }

window.onload = () => { 
    applySkin(localStorage.getItem('equipped_skins') || 'default'); 
    applyFont(localStorage.getItem('equipped_fonts') || 'sans'); 
    applyMusic(localStorage.getItem('equipped_music') || 'none');
    renderStore(); 
};

document.getElementById('btn-daily').onclick = () => { generateCalendar(); changeScreen('calendar'); };
document.getElementById('btn-free').onclick = () => changeScreen('diff');
document.getElementById('btn-store').onclick = () => { renderStore(); changeScreen('store'); };
document.getElementById('btn-ranking').onclick = () => cargarRanking();
document.getElementById('btn-exit').onclick = () => { if(confirm("¿Salir y perder el progreso actual?")){ stopTimer(); changeScreen('menu'); } };
document.getElementById('btn-back-calendar').onclick = () => changeScreen('menu');
document.getElementById('btn-back-diff').onclick = () => changeScreen('menu');
document.getElementById('btn-back-store').onclick = () => changeScreen('menu');
document.getElementById('btn-back-ranking').onclick = () => changeScreen('menu');

// Wakelock para mantener pantalla encendida
let wakeLock = null;
async function solicitarWakeLock() { try { if ('wakeLock' in navigator) { wakeLock = await navigator.wakeLock.request('screen'); } } catch (err) {} }
document.addEventListener('visibilitychange', async () => { if (wakeLock !== null && document.visibilityState === 'visible') { await solicitarWakeLock(); } });
solicitarWakeLock();

function startFreeGame(d) { startMatch(false, d); }