// ------------------------------------------------------------------
// WAKE LOCK: Verhindert Standby während des Spiels
// ------------------------------------------------------------------
let wakeLock = null;

async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
        } catch (err) {
            // Gerät unterstützt es nicht oder hat es verweigert – kein Problem
            console.warn('Wake Lock nicht verfügbar:', err.message);
        }
    }
}

// Wake Lock automatisch neu anfordern, wenn Tab wieder aktiv wird
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        requestWakeLock();
    }
});

requestWakeLock();

const socket = io();

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

let playerId = sessionStorage.getItem('lobby_playerId');
if (!playerId) {
    playerId = generateUUID();
    sessionStorage.setItem('lobby_playerId', playerId);
}

const statusDiv = document.getElementById('status');
const lobbyDiv = document.getElementById('lobby');
const gameDiv = document.getElementById('game');
const currentRoomSpan = document.getElementById('currentRoom');

const creatorNameInput = document.getElementById('creatorName');
const opponentNameInput = document.getElementById('opponentNameInput');
const joinerNameInput = document.getElementById('joinerName');

// Lobby Buttons
const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const exitBtn = document.getElementById('exitBtn');
const infoBtn = document.getElementById('infoBtn');
const infoModal = document.getElementById('info-modal');
const closeInfoBtn = document.getElementById('close-info-btn');

// Confirm Modal
const confirmModal = document.getElementById('confirm-modal');
const confirmYesBtn = document.getElementById('confirm-yes-btn');
const confirmNoBtn = document.getElementById('confirm-no-btn');

// Game Board Elements
const preGameLobby = document.getElementById('pre-game-lobby');
const playerListUl = document.getElementById('player-list');
const startGameBtn = document.getElementById('startGameBtn');

const gameBoard = document.getElementById('game-board');
const endScreen = document.getElementById('end-screen');
const resultsDiv = document.getElementById('results');
const backToLobbyBtn = document.getElementById('backToLobbyBtn');
const nextRoundBtn = document.getElementById('nextRoundBtn');
const playAgainBtn = document.getElementById('playAgainBtn');
const potDisplay = document.getElementById('pot-display');
const potAmount = document.getElementById('pot-amount');

const centerCardsEl = document.getElementById('center-cards');
const actionButtonsDiv = document.getElementById('action-buttons');
const swapOneBtn = document.getElementById('swapOneBtn');
const swapAllBtn = document.getElementById('swapAllBtn');
const passBtn = document.getElementById('passBtn');

const myCardsEl = document.getElementById('my-cards');
const myNameEl = document.getElementById('my-name');
const knockBtn = document.getElementById('knockBtn');
const centerAreaEl = document.getElementById('center-area');

let currentRoomId = null;
let currentGameState = null;

function showToast(message) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.position = 'fixed';
        container.style.top = '50%';
        container.style.left = '50%';
        container.style.transform = 'translate(-50%, -50%)';
        container.style.zIndex = '9999';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '10px';
        container.style.pointerEvents = 'none';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.style.backgroundColor = '#e74c3c';
    toast.style.color = 'white';
    toast.style.padding = '15px 25px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 4px 15px rgba(0,0,0,0.5)';
    toast.style.fontSize = '1.2em';
    toast.style.fontWeight = 'bold';
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease-in-out';
    toast.style.textAlign = 'center';
    toast.style.fontFamily = 'sans-serif';

    toast.textContent = message;
    container.appendChild(toast);

    // Animate in
    setTimeout(() => toast.style.opacity = '1', 20);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            if (toast.parentElement) toast.remove();
        }, 300);
    }, 3000);
}

function showGame(roomId) {
    lobbyDiv.style.display = 'none';
    gameDiv.style.display = 'block';
    currentRoomSpan.textContent = roomId;
    currentRoomId = roomId;
}

// Logic: Room Creation
createBtn.addEventListener('click', () => {
    const name = creatorNameInput.value.trim();
    const opponentName = opponentNameInput.value.trim();

    if (!name) return alert('Bitte deinen Namen eingeben!');
    if (!opponentName) return alert('Bitte Namen des Gegners eingeben!');

    const customRoomId = opponentName.toLowerCase();
    sessionStorage.setItem('lobby_username', name);

    socket.emit('createRoom', { name, playerId, customRoomId });
});

// Logic: Joining
joinBtn.addEventListener('click', () => {
    const name = joinerNameInput.value.trim();
    const password = document.getElementById('joinerPassword').value.trim();

    if (!name) return alert('Bitte deinen Namen eingeben!');
    if (!password) return alert('Bitte Passwort eingeben!');

    const roomIdToJoin = password.toLowerCase();
    sessionStorage.setItem('lobby_username', name);

    socket.emit('joinRoom', { roomId: roomIdToJoin, playerName: name, playerId });
});

// Modals and UI
infoBtn.addEventListener('click', () => infoModal.classList.remove('hidden'));
const gameInfoBtn = document.getElementById('gameInfoBtn');
if (gameInfoBtn) {
    gameInfoBtn.addEventListener('click', () => infoModal.classList.remove('hidden'));
}
closeInfoBtn.addEventListener('click', () => infoModal.classList.add('hidden'));

document.getElementById('fullscreenBtnLobby').addEventListener('click', toggleFullscreen);

const gameFullscreenBtn = document.getElementById('gameFullscreenBtn');
if (gameFullscreenBtn) {
    gameFullscreenBtn.addEventListener('click', toggleFullscreen);
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
            alert(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
}

exitBtn.addEventListener('click', () => {
    location.reload();
});

// ------------------------------------------------------------------
// GAME LOGIC BOARD
// ------------------------------------------------------------------

function renderCard(card, isMini = false) {
    const el = document.createElement('div');
    el.className = `card playing-card ${isMini ? 'mini-card' : ''}`;

    if (!card) {
        if (isMini) {
            el.className += ' back';
        } else {
            el.className += ' empty';
        }
        return el;
    }

    el.classList.add(`suit-${card.suit}`);

    let suitSymbol = '';
    if (card.suit === 'Heart') suitSymbol = '♥';
    if (card.suit === 'Diamond') suitSymbol = '♦';
    if (card.suit === 'Club') suitSymbol = '♣';
    if (card.suit === 'Spade') suitSymbol = '♠';

    if (isMini) {
        // Mini cards just show the back
        el.className = 'card playing-card mini-card back';
    } else {
        el.innerHTML = `
            <div class="top-left-suit">${card.face}${suitSymbol}</div>
            <div class="center-suit">${suitSymbol}</div>
            <div class="bottom-right-suit">${card.face}${suitSymbol}</div>
        `;
    }
    return el;
}

function renderGameState(state) {
    currentGameState = state;

    if (state.status === 'waiting') {
        preGameLobby.style.display = 'block';
        gameBoard.style.display = 'none';

        playerListUl.innerHTML = '';
        state.players.forEach(p => {
            const li = document.createElement('li');
            li.textContent = p.name;
            playerListUl.appendChild(li);
        });
        return;
    }

    if (state.status === 'playing' || state.status === 'finished' || state.status === 'game_over') {
        preGameLobby.style.display = 'none';
        gameBoard.style.display = 'block';

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
                    document.getElementById('end-title').innerHTML = `Runde Vorbei!<br><span style="font-size: 0.8em; color: #ff9800; display: block; margin-top: 10px;">Hose</span>`;
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
                const me = state.players.find(p => p.pId === playerId);
                if (me && me.isCurrentTurn && state.status === 'playing') {
                    // Phase 1 or Discarded First: Center Cards are draggable if Hand has space
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
        const me = state.players.find(p => p.pId === playerId);
        const opponents = state.players.filter(p => p.pId !== playerId);

        const opponentPlayers = state.players.filter(p => !p.isOut); // Just an array for sorting
        if (me) {
            let meCoinsText = me.coins === 0 ? "ist Gast" : '<span class="coin-emoji">🪙</span>'.repeat(Math.max(0, me.coins));
            if (me.isOut) meCoinsText = "<span style='font-size:1.6em; line-height:1;'>☠️</span>";

            myNameEl.innerHTML = `${me.name} <span style="font-size: 0.8em; margin-left:10px;">${meCoinsText}</span> ${me.hasKnocked ? '<span class="knocked-indicator">geklopft!</span>' : ''}`;

            const playerBottom = document.getElementById('player-bottom');
            if (me.isCurrentTurn && state.status === 'playing' && !me.isOut) {
                playerBottom.classList.add('active-turn');
                actionButtonsDiv.style.display = 'flex';

                // Disable normal actions if mid-turn (length not 3)
                // SwapAll also requires exactly 3 different suits
                const isMidTurn = me.hand.length !== 3;
                if (isMidTurn || !me.canSwapAll) swapAllBtn.classList.add('btn-invalid');
                else swapAllBtn.classList.remove('btn-invalid');

                if (isMidTurn) passBtn.classList.add('btn-invalid');
                else passBtn.classList.remove('btn-invalid');

                if (isMidTurn) knockBtn.classList.add('btn-invalid');
                else knockBtn.classList.remove('btn-invalid');

                // Force clear native disabled attribute in case of aggressive browser caching
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
                        // Phase 2 or Drawing Next: Hand cards are draggable if Center has space
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
            el.innerHTML = '';
            el.classList.remove('active-turn');
        });

        opponents.forEach((opp, i) => {
            let oppPos = i;
            if (opponents.length === 1) oppPos = 0; // top
            if (opponents.length === 2) oppPos = i === 0 ? 1 : 2; // left, right

            let targetId = 'player-top';
            if (oppPos === 1) targetId = 'player-left';
            if (oppPos === 2) targetId = 'player-right';

            const oppArea = document.getElementById(targetId);
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

startGameBtn.addEventListener('click', () => {
    socket.emit('startGame', { roomId: currentRoomId });
});

swapAllBtn.addEventListener('click', () => {
    const me = currentGameState?.players.find(p => p.pId === playerId);
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

    // Show custom confirm dialog
    confirmModal.classList.remove('hidden');
});

confirmYesBtn.addEventListener('click', () => {
    confirmModal.classList.add('hidden');
    socket.emit('swapAll', { roomId: currentRoomId, playerId });
});

confirmNoBtn.addEventListener('click', () => {
    confirmModal.classList.add('hidden');
});

passBtn.addEventListener('click', () => {
    const me = currentGameState?.players.find(p => p.pId === playerId);
    if (!me || !me.isCurrentTurn) {
        showToast("Du bist nicht an der Reihe!");
        return;
    }
    if (me.hand.length !== 3) {
        showToast("Bitte beende zuerst deinen Tausch (ziehe bzw. lege eine Karte ab)!");
        return;
    }
    socket.emit('pass', { roomId: currentRoomId, playerId });
});

knockBtn.addEventListener('click', () => {
    const me = currentGameState?.players.find(p => p.pId === playerId);
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
    socket.emit('knock', { roomId: currentRoomId, playerId });
});

backToLobbyBtn.addEventListener('click', () => {
    location.reload();
});

nextRoundBtn.addEventListener('click', () => {
    socket.emit('startNextRound', { roomId: currentRoomId });
});

playAgainBtn.addEventListener('click', () => {
    socket.emit('startGame', { roomId: currentRoomId });
});

// ------------------------------------------------------------------
// SOCKET EVENTS
// ------------------------------------------------------------------
socket.on('connect', () => {
    statusDiv.textContent = 'Verbunden!';
    statusDiv.style.color = 'lightgreen';
});

socket.on('disconnect', () => {
    statusDiv.textContent = 'Verbindung verloren.';
    statusDiv.style.color = 'red';
    lobbyDiv.style.display = 'block';
    gameDiv.style.display = 'none';
});

socket.on('error', (msg) => {
    alert(msg);
});

socket.on('roomCreated', ({ roomId }) => {
    showGame(roomId);
});

socket.on('roomJoined', ({ roomId }) => {
    showGame(roomId);
});

socket.on('toast_msg', (msg) => {
    showToast(msg);
});

socket.on('gameState', (state) => {
    renderGameState(state);
});

socket.on('gameStateBroadcast', () => {
    if (currentRoomId) {
        socket.emit('requestState', { roomId: currentRoomId, playerId });
    }
});

socket.on('playerJoined', ({ name }) => {
    console.log(`${name} joined`);
});

socket.on('playerLeft', ({ name }) => {
    console.log(`${name} left`);
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
                const me = currentGameState?.players.find(p => p.pId === playerId);
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
                socket.emit('discardToCenter', { roomId: currentRoomId, playerId, handIndex: data.index });
            }
        } catch (err) {
            console.error('Drop parsing error', err);
        }
    });
}

if (myCardsEl) {
    myCardsEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation(); // Stop from bubbling to gameBoard (stops discard)
        e.dataTransfer.dropEffect = 'move';
    });

    myCardsEl.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation(); // Stop from bubbling to gameBoard
        const rawData = e.dataTransfer.getData('text/plain');
        if (!rawData) return;
        try {
            const data = JSON.parse(rawData);
            if (data.source === 'center') {
                const me = currentGameState?.players.find(p => p.pId === playerId);
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
                socket.emit('drawFromCenter', { roomId: currentRoomId, playerId, centerIndex: data.index });
            }
        } catch (err) {
            console.error('Drop parsing error', err);
        }
    });
}
