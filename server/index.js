const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { Game } = require('./game');
const LobbyManager = require('./lobby/LobbyManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static(path.join(__dirname, '../public')));
app.use('/shared', express.static(path.join(__dirname, 'shared')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Map of roomId -> Game instance
const games = new Map();

// Initialize Lobby-Manager for Schwimmen
const lobbyManager = new LobbyManager(io, {
    gameId: 'schwimmen',
    gameTitle: 'Schwimmen',
    minPlayers: 2,
    maxPlayers: 4
});

// Callback when Host clicks "Spiel Starten" and room conditions are met
lobbyManager.onGameStart((room, hostSocketId) => {
    console.log(`[Game] Starting Schwimmen game for room ${room.code}`);
    const game = new Game(room.code);
    for (const player of room.players) {
        game.addPlayer(player.id, player.name, player.id);
    }
    game.start();
    games.set(room.code, game);

    // Broadcast state update to everyone in room
    io.to(room.code).emit('gameStateBroadcast');
});

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Attach standard lobby event listeners
    lobbyManager.attachSocketListeners(socket);

    // Schwimmen specific game listeners
    socket.on('requestState', ({ roomId, playerId }) => {
        const targetRoomCode = roomId || lobbyManager.socketToRoomMap.get(socket.id);
        const game = games.get(targetRoomCode);
        if (game) {
            const player = game.players.find(p => p.pId === playerId || p.id === socket.id);
            if (player) {
                player.id = socket.id;
            }
            socket.emit('gameState', game.getState(playerId || socket.id));
        }
    });

    socket.on('startNextRound', ({ roomId }) => {
        const targetRoomCode = roomId || lobbyManager.socketToRoomMap.get(socket.id);
        const game = games.get(targetRoomCode);
        if (game && game.startNextRound()) {
            io.to(targetRoomCode).emit('gameStateBroadcast');
        }
    });

    socket.on('startGame', ({ roomId }) => {
        // Re-start / play again support
        const targetRoomCode = roomId || lobbyManager.socketToRoomMap.get(socket.id);
        const game = games.get(targetRoomCode);
        if (game && game.start()) {
            io.to(targetRoomCode).emit('gameStateBroadcast');
        }
    });

    socket.on('drawFromCenter', ({ roomId, playerId, centerIndex }) => {
        const targetRoomCode = roomId || lobbyManager.socketToRoomMap.get(socket.id);
        const game = games.get(targetRoomCode);
        const pId = playerId || socket.id;
        if (game && game.drawFromCenter(pId, centerIndex)) {
            const p = game.players.find(x => x.pId === pId);
            if (p && p.hand.length === 3 && game.centerCards.length === 3) {
                game.nextTurn();
            }
            io.to(targetRoomCode).emit('gameStateBroadcast');
        }
    });

    socket.on('discardToCenter', ({ roomId, playerId, handIndex }) => {
        const targetRoomCode = roomId || lobbyManager.socketToRoomMap.get(socket.id);
        const game = games.get(targetRoomCode);
        const pId = playerId || socket.id;
        if (game && game.discardToCenter(pId, handIndex)) {
            const p = game.players.find(x => x.pId === pId);
            if (p && p.hand.length === 3 && game.centerCards.length === 3) {
                game.nextTurn();
            }
            io.to(targetRoomCode).emit('gameStateBroadcast');
        }
    });

    socket.on('swapAll', ({ roomId, playerId }) => {
        const targetRoomCode = roomId || lobbyManager.socketToRoomMap.get(socket.id);
        const game = games.get(targetRoomCode);
        const pId = playerId || socket.id;
        if (game) {
            const player = game.players.find(p => p.pId === pId);
            if (player && game.swapAll(pId)) {
                io.to(targetRoomCode).emit('toast_msg', `${player.name} hat alle 3 Karten getauscht!`);
                game.nextTurn();
                io.to(targetRoomCode).emit('gameStateBroadcast');
            }
        }
    });

    socket.on('pass', ({ roomId, playerId }) => {
        const targetRoomCode = roomId || lobbyManager.socketToRoomMap.get(socket.id);
        const game = games.get(targetRoomCode);
        const pId = playerId || socket.id;
        if (game && game.pass(pId)) {
            game.nextTurn();
            io.to(targetRoomCode).emit('gameStateBroadcast');
        }
    });

    socket.on('knock', ({ roomId, playerId }) => {
        const targetRoomCode = roomId || lobbyManager.socketToRoomMap.get(socket.id);
        const game = games.get(targetRoomCode);
        const pId = playerId || socket.id;
        if (game) {
            const player = game.players.find(p => p.pId === pId);
            if (player && game.knock(pId)) {
                io.to(targetRoomCode).emit('toast_msg', `${player.name} hat Stop gesagt!`);
                game.nextTurn();
                io.to(targetRoomCode).emit('gameStateBroadcast');
            }
        }
    });
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
    console.log(`Schwimmen Server with Lobby-Basis running on http://localhost:${PORT}`);
});
