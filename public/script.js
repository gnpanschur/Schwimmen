// ------------------------------------------------------------------
// WAKE LOCK: Verhindert Standby während des Spiels
// ------------------------------------------------------------------
let wakeLock = null;

async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
        } catch (err) {
            console.warn('Wake Lock nicht verfügbar:', err.message);
        }
    }
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        requestWakeLock();
    }
});

requestWakeLock();

const socket = window.socketClient ? window.socketClient.socket : io();

const statusDiv = document.getElementById('status');
const currentRoomSpan = document.getElementById('currentRoom');

// Buttons & Modals
const exitBtn = document.getElementById('exitBtn');
const gameInfoBtn = document.getElementById('gameInfoBtn');
const gameFullscreenBtn = document.getElementById('gameFullscreenBtn');
const infoModal = document.getElementById('info-modal');
const closeInfoBtn = document.getElementById('close-info-btn');

// Confirm Modal
const confirmModal = document.getElementById('confirm-modal');
const confirmYesBtn = document.getElementById('confirm-yes-btn');
const confirmNoBtn = document.getElementById('confirm-no-btn');

// Game Board Elements
const gameBoard = document.getElementById('game-board');
const endScreen = document.getElementById('end-screen');
const resultsDiv = document.getElementById('results');
const backToLobbyBtn = document.getElementById('backToLobbyBtn');
const nextRoundBtn = document.getElementById('nextRoundBtn');
const playAgainBtn = document.getElementById('playAgainBtn');
const potDisplay = document.getElementById('pot-display');

const centerCardsEl = document.getElementById('center-cards');
const actionButtonsDiv = document.getElementById('action-buttons');
const swapAllBtn = document.getElementById('swapAllBtn');
const passBtn = document.getElementById('passBtn');
const knockBtn = document.getElementById('knockBtn');

const myCardsEl = document.getElementById('my-cards');
const myNameEl = document.getElementById('my-name');

let currentGameState = null;

function getMyPlayerId() {
    return window.socketClient ? window.socketClient.socketId : socket.id;
}

function getMyRoomCode() {
    return window.socketClient ? window.socketClient.currentRoomCode : (currentRoomSpan ? currentRoomSpan.textContent : null);
}

function showToast(message) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 20);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentElement) toast.remove();
        }, 300);
    }, 3000);
}

window.startSchwimmenGameUI = function (roomState) {
    if (window.showScreen) {
        window.showScreen('game');
    }
    const roomCode = roomState ? roomState.code : getMyRoomCode();
    if (currentRoomSpan) currentRoomSpan.textContent = roomCode;
    socket.emit('requestState', { roomId: roomCode, playerId: getMyPlayerId() });
};

// Modals and UI
if (gameInfoBtn) {
    gameInfoBtn.addEventListener('click', () => infoModal.classList.remove('hidden'));
}
if (closeInfoBtn) {
    closeInfoBtn.addEventListener('click', () => infoModal.classList.add('hidden'));
}

if (gameFullscreenBtn) {
    gameFullscreenBtn.addEventListener('click', toggleFullscreen);
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
            alert(`Fullscreen Fehler: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
}

if (exitBtn) {
    exitBtn.addEventListener('click', () => {
        if (window.socketClient) {
            window.socketClient.leaveRoom();
        }
        location.reload();
    });
}

// ------------------------------------------------------------------
// GAME CARD RENDERING
// ------------------------------------------------------------------

function renderCard(card, isMini = false) {
    const el = document.createElement('div');
    el.className = `card playing-card ${isMini ? 'mini-card' : ''}`;

    if (!card) {
        if (isMini) {
            el.className = 'card playing-card mini-card';
            const img = document.createElement('img');
            img.src = 'Doppeldeutsch_6-Ass/back.webp';
            img.className = 'card-img';
            img.draggable = false;
            el.appendChild(img);
        } else {
            el.classList.add('empty');
        }
        return el;
    }

    if (isMini) {
        const img = document.createElement('img');
        img.src = 'Doppeldeutsch_6-Ass/back.webp';
        img.className = 'card-img';
        img.draggable = false;
        el.appendChild(img);
    } else {
        const suitMap = { Heart: 'HEARTS', Diamond: 'DIAMONDS', Club: 'CLUBS', Spade: 'SPADES' };
        const suitName = suitMap[card.suit] || card.suit.toUpperCase() + 'S';
        const img = document.createElement('img');
        img.src = `Doppeldeutsch_6-Ass/${suitName}_${card.face}.webp`;
        img.className = 'card-img';
        img.draggable = false;
        el.appendChild(img);
    }
    return el;
}

function renderGameState(state) {
    currentGameState = state;
    const playerId = getMyPlayerId();

    if (state.status === 'playing' || state.status === 'finished' || state.status === 'game_over') {
        if (window.showScreen) {
            window.showScreen('game');
        }

        if (state.status === 'finished' || state.status === 'game_over') {
            endScreen.style.display = 'flex';
            resultsDiv.innerHTML = state.players.map((p, i) =>
                `<div style="${p.isOut ? 'text-decoration: line-through; color: gray;' : ''}">${i + 1}. ${p.name} - ${p.score !== null ? p.score : '?'} Pkt</div>`
            ).join('');

            if (state.status === 'game_over') {
                const winner = state.players.find(p => !p.isOut);
                if (winner) {
                    document.getElementById('end-title').innerHTML = `🏆 ${winner.name} hat gewonnen! 🏆`;
                } else {
                    document.getElementById('end-title').innerHTML = "Spiel Vorbei!";
                }
                nextRoundBtn.style.display = 'none';
                playAgainBtn.style.display = 'inline-block';
                backToLobbyBtn.style.display = 'inline-block';
            } else {
                if (state.endedByThirtyOne) {
                    document.getElementById('end-title').innerHTML = `Runde Vorbei!<br><span style="font-size: 0.8em; color: #ff9800; display: block; margin-top: 10px;">Hose (31 Punkte)</span>`;
                } else {
                    document.getElementById('end-title').innerHTML = "Runde Vorbei!";
                }
                nextRoundBtn.style.display = 'inline-block';
                playAgainBtn.style.display = 'none';
                backToLobbyBtn.style.display = 'none';
            }
        } else {
            endScreen.style.display = 'none';
        }

        // Render Turn Indicator
        const turnIndicatorEl = document.getElementById('turn-indicator');
        if (state.status === 'playing') {
            const activePlayer = state.players.find(p => p.isCurrentTurn);
            if (activePlayer) {
                turnIndicatorEl.style.display = 'block';
                turnIndicatorEl.textContent = `${activePlayer.name} ist am Zug!`;
            } else {
                turnIndicatorEl.style.display = 'none';
            }
        } else {
            turnIndicatorEl.style.display = 'none';
        }

        // Render Pot
        if (state.pot > 0) {
            potDisplay.style.display = 'block';
            let potText = "Kassa: ";
            for (let i = 0; i < state.pot; i++) {
                potText += '<span class="coin-emoji">🪙</span>';
            }
            potDisplay.innerHTML = potText;
        } else {
            potDisplay.style.display = 'block';
            potDisplay.innerHTML = 'Kassa: 0 <span class="coin-emoji">🪙</span>';
        }

        // Render Center Cards
        centerCardsEl.innerHTML = '';
        if (state.centerCards) {
            state.centerCards.forEach((card, index) => {
                const cardEl = renderCard(card);
                const me = state.players.find(p => p.pId === playerId || p.pId === socket.id);
                if (me && me.isCurrentTurn && state.status === 'playing') {
                    if (me.hand.length < 4) {
                        cardEl.draggable = true;
                        cardEl.style.cursor = 'grab';

                        cardEl.addEventListener('dragstart', (e) => {
                            e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'center', index }));
                        });
                    }
                }
                centerCardsEl.appendChild(cardEl);
            });
        }

        // Render Players
        const me = state.players.find(p => p.pId === playerId || p.pId === socket.id);
        const opponents = state.players.filter(p => p.pId !== playerId && p.pId !== socket.id);

        if (me) {
            let meCoinsText = me.coins === 0 ? "ist Gast" : '<span class="coin-emoji">🪙</span>'.repeat(Math.max(0, me.coins));
            if (me.isOut) meCoinsText = "<span style='font-size:1.6em; line-height:1;'>☠️</span>";

            myNameEl.innerHTML = `${me.name} <span style="font-size: 0.8em; margin-left:10px;">${meCoinsText}</span> ${me.hasKnocked ? '<span class="knocked-indicator">geklopft!</span>' : ''}`;

            const playerBottom = document.getElementById('player-bottom');
            if (me.isCurrentTurn && state.status === 'playing' && !me.isOut) {
                playerBottom.classList.add('active-turn');
                actionButtonsDiv.style.display = 'flex';

                const isMidTurn = me.hand.length !== 3;
                if (isMidTurn || !me.canSwapAll) swapAllBtn.classList.add('btn-invalid');
                else swapAllBtn.classList.remove('btn-invalid');

                if (isMidTurn) passBtn.classList.add('btn-invalid');
                else passBtn.classList.remove('btn-invalid');

                if (isMidTurn) knockBtn.classList.add('btn-invalid');
                else knockBtn.classList.remove('btn-invalid');

                swapAllBtn.disabled = false;
                passBtn.disabled = false;
                knockBtn.disabled = false;
            } else {
                playerBottom.classList.remove('active-turn');
                actionButtonsDiv.style.display = 'none';
            }

            myCardsEl.innerHTML = '';
            if (me.hand) {
                me.hand.forEach((card, index) => {
                    const cardEl = renderCard(card);
                    if (me.isCurrentTurn && state.status === 'playing') {
                        if (state.centerCards.length < 4) {
                            cardEl.draggable = true;
                            cardEl.style.cursor = 'grab';

                            cardEl.addEventListener('dragstart', (e) => {
                                e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'hand', index }));
                            });
                        }
                    }
                    myCardsEl.appendChild(cardEl);
                });
            }

            if (me.isCurrentTurn && state.status === 'playing' && !state.knockedPlayerId) {
                knockBtn.style.display = 'inline-block';
            } else {
                knockBtn.style.display = 'none';
            }
        }

        const positions = ['top-area', 'left-area', 'right-area'];
        ['player-top', 'player-left', 'player-right'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.innerHTML = '';
                el.classList.remove('active-turn');
            }
        });

        opponents.forEach((opp, i) => {
            let oppPos = i;
            if (opponents.length === 1) oppPos = 0;
            if (opponents.length === 2) oppPos = i === 0 ? 1 : 2;

            let targetId = 'player-top';
            if (oppPos === 1) targetId = 'player-left';
            if (oppPos === 2) targetId = 'player-right';

            const oppArea = document.getElementById(targetId);
            if (!oppArea) return;

            let oppCoinsText = opp.coins === 0 ? "ist Gast" : '<span class="coin-emoji">🪙</span>'.repeat(Math.max(0, opp.coins));
            if (opp.isOut) oppCoinsText = "<span style='font-size:1.6em; line-height:1;'>☠️</span>";

            oppArea.innerHTML = `<div class="player-info" style="${opp.isOut ? 'opacity: 0.5;' : ''}">${opp.name} <span style="font-size: 0.8em; margin-left:5px;">${oppCoinsText}</span> ${opp.hasKnocked ? '<span class="knocked-indicator">geklopft!</span>' : ''}</div>
                                 <div style="display: flex; gap: 5px; justify-content: center; ${opp.isOut ? 'opacity: 0.5;' : ''}"></div>`;

            const cardContainer = oppArea.querySelector('div:nth-child(2)');
            if ((state.status === 'finished' || state.status === 'game_over') && opp.hand) {
                opp.hand.forEach(c => cardContainer.appendChild(renderCard(c)));
            } else {
                for (let j = 0; j < opp.cardCount; j++) {
                    cardContainer.appendChild(renderCard(null, true));
                }
            }

            if (opp.isCurrentTurn && state.status === 'playing') {
                oppArea.classList.add('active-turn');
            }
        });
    }
}

// Action Handlers
if (swapAllBtn) {
    swapAllBtn.addEventListener('click', () => {
        const playerId = getMyPlayerId();
        const me = currentGameState?.players.find(p => p.pId === playerId || p.pId === socket.id);
        if (!me || !me.isCurrentTurn) {
            showToast("Du bist nicht an der Reihe!");
            return;
        }
        if (me.hand.length !== 3) {
            showToast("Bitte beende zuerst deinen Tausch (ziehe bzw. lege eine Karte ab)!");
            return;
        }
        if (!me.canSwapAll) {
            showToast("Alle tauschen geht nur mit 3 unterschiedlichen Farben auf der Hand!");
            return;
        }

        confirmModal.classList.remove('hidden');
    });
}

if (confirmYesBtn) {
    confirmYesBtn.addEventListener('click', () => {
        confirmModal.classList.add('hidden');
        socket.emit('swapAll', { roomId: getMyRoomCode(), playerId: getMyPlayerId() });
    });
}

if (confirmNoBtn) {
    confirmNoBtn.addEventListener('click', () => {
        confirmModal.classList.add('hidden');
    });
}

if (passBtn) {
    passBtn.addEventListener('click', () => {
        const playerId = getMyPlayerId();
        const me = currentGameState?.players.find(p => p.pId === playerId || p.pId === socket.id);
        if (!me || !me.isCurrentTurn) {
            showToast("Du bist nicht an der Reihe!");
            return;
        }
        if (me.hand.length !== 3) {
            showToast("Bitte beende zuerst deinen Tausch (ziehe bzw. lege eine Karte ab)!");
            return;
        }
        socket.emit('pass', { roomId: getMyRoomCode(), playerId });
    });
}

if (knockBtn) {
    knockBtn.addEventListener('click', () => {
        const playerId = getMyPlayerId();
        const me = currentGameState?.players.find(p => p.pId === playerId || p.pId === socket.id);
        if (!me || !me.isCurrentTurn) {
            showToast("Du bist nicht an der Reihe!");
            return;
        }
        if (me.hand.length !== 3) {
            showToast("Bitte beende zuerst deinen Tausch (ziehe bzw. lege eine Karte ab)!");
            return;
        }
        if (currentGameState.knockedPlayerId) {
            showToast("Es wurde bereits geklopft!");
            return;
        }
        socket.emit('knock', { roomId: getMyRoomCode(), playerId });
    });
}

if (backToLobbyBtn) {
    backToLobbyBtn.addEventListener('click', () => {
        location.reload();
    });
}

if (nextRoundBtn) {
    nextRoundBtn.addEventListener('click', () => {
        socket.emit('startNextRound', { roomId: getMyRoomCode() });
    });
}

if (playAgainBtn) {
    playAgainBtn.addEventListener('click', () => {
        socket.emit('startGame', { roomId: getMyRoomCode() });
    });
}

// ------------------------------------------------------------------
// SOCKET EVENTS
// ------------------------------------------------------------------

socket.on('connect', () => {
    if (statusDiv) {
        statusDiv.textContent = 'Verbunden!';
        statusDiv.style.color = 'lightgreen';
    }
});

socket.on('disconnect', () => {
    if (statusDiv) {
        statusDiv.textContent = 'Verbindung verloren.';
        statusDiv.style.color = 'red';
    }
});

socket.on('error', (msg) => {
    alert(msg);
});

socket.on('toast_msg', (msg) => {
    showToast(msg);
});

socket.on('gameState', (state) => {
    renderGameState(state);
});

socket.on('gameStateBroadcast', () => {
    const roomCode = getMyRoomCode();
    if (roomCode) {
        socket.emit('requestState', { roomId: roomCode, playerId: getMyPlayerId() });
    }
});

// ------------------------------------------------------------------
// GLOBAL DRAG AND DROP HANDLERS
// ------------------------------------------------------------------

if (gameBoard) {
    gameBoard.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    });

    gameBoard.addEventListener('drop', (e) => {
        e.preventDefault();
        const rawData = e.dataTransfer.getData('text/plain');
        if (!rawData) return;
        try {
            const data = JSON.parse(rawData);
            if (data.source === 'hand') {
                const playerId = getMyPlayerId();
                const me = currentGameState?.players.find(p => p.pId === playerId || p.pId === socket.id);
                if (!me) return;
                if (!me.isCurrentTurn) {
                    showToast("Du bist nicht an der Reihe!");
                    return;
                }
                if (currentGameState.centerCards.length >= 4) {
                    showToast("Die Mitte ist voll! Bitte ziehe zuerst eine Karte.");
                    return;
                }
                if (currentGameState.status !== 'playing') {
                    showToast("Das Spiel läuft gerade nicht!");
                    return;
                }
                socket.emit('discardToCenter', { roomId: getMyRoomCode(), playerId, handIndex: data.index });
            }
        } catch (err) {
            console.error('Drop parsing error', err);
        }
    });
}

if (myCardsEl) {
    myCardsEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
    });

    myCardsEl.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rawData = e.dataTransfer.getData('text/plain');
        if (!rawData) return;
        try {
            const data = JSON.parse(rawData);
            if (data.source === 'center') {
                const playerId = getMyPlayerId();
                const me = currentGameState?.players.find(p => p.pId === playerId || p.pId === socket.id);
                if (!me) return;
                if (!me.isCurrentTurn) {
                    showToast("Du bist nicht an der Reihe!");
                    return;
                }
                if (me.hand.length >= 4) {
                    showToast("Du hast bereits 4 Karten! Bitte lege eine ab.");
                    return;
                }
                if (currentGameState.status !== 'playing') {
                    showToast("Das Spiel läuft gerade nicht!");
                    return;
                }
                socket.emit('drawFromCenter', { roomId: getMyRoomCode(), playerId, centerIndex: data.index });
            }
        } catch (err) {
            console.error('Drop parsing error', err);
        }
    });
}
