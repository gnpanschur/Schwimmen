# Lobby Integration Guide für Antigravity

Dieses Dokument beschreibt, wie das standardisierte "Lobby-Template" aus `D:\Antigravity_Projeckte\Lobby` in zukünftige Multiplayer-Spiele integriert wird. 

## Wann wird die Lobby integriert?
Die Lobby sollte idealerweise **als Basis (Startpunkt)** für ein neues Projekt dienen. Es ist deutlich einfacher, das Spielbrett und die Spiellogik in die bestehende Struktur der Lobby hineinzubauen, anstatt eine fertige Singleplayer-App nachträglich an die Lobby anzupassen. 
Trotzdem ist ein nachträglicher Einbau möglich, erfordert aber das Umschreiben der Verbindungslogik.

---

## Architektur der Lobby

### Live Deployment (Render)
Dieses Projekt ist aktuell live auf Render gehostet:
- **URL:** [https://schwimmen.onrender.com](https://schwimmen.onrender.com)
- **Service ID:** `srv-d6e3qa94tr6s73d72ob0`

Die Lobby basiert auf **Node.js, Express und Socket.IO**. Sie besteht aus zwei Hauptkomponenten im Frontend:
1. `div#lobby`: Der Startbildschirm mit den zwei Sektionen (Blau: Erstellen, Gelb: Beitreten).
2. `div#game`: Der Bereich des eigentlichen Spiels (initial versteckt mit `display: none`).

### 1. Das Projekt starten
Kopiere den gesamten Inhalt von `D:\Antigravity_Projeckte\Lobby` in den neuen Projektordner oder nutze ihn als Vorlage.
Führe danach `npm install` im neuen Projekt aus.

### 2. Frontend anpassen (`public/index.html` & `public/style.css`)
- **Titel:** Ändere das `<h1>Project Title</h1>` und das `<title>`-Tag.
- **Spielbereich:** Suche den Container `<div id="game-placeholder">`. Ersetze diesen durch das HTML für das tatsächliche Spielfeld deines neuen Spiels.

### 3. Frontend-Logik anpassen (`public/script.js`)
Die Lobby übernimmt bereits das Generieren von UUIDs, das Abfragen der Spielernamen und die UI-Umstellung (`showGame()`).
- **Raum beigetreten:** Sobald zwei Spieler verbunden sind, feuert das Event `socket.on('playerJoined', ...)`. 
- **Zusatz-Logik:** Hier muss nun der Emit für den Startschuss des Spiels oder das Rendern des tatsächlichen Start-Zustands (`gameState`) andocken.

Beispiel für den Übergang zum Spiel:
```javascript
socket.on('playerJoined', ({ name }) => {
    // Die Basis-Logik ändert nur den Text
    document.querySelector('#game-placeholder p').textContent = `Spieler ${name} ist beigetreten!`;
    
    // HIER EINFÜGEN:
    // Sende Event an den Server, dass beide bereit sind und das Spielfeld aufgebaut werden soll
    // Socket emit ('initGameBoard') etc...
});
```

### 4. Backend-Logik anpassen (`server/index.js`)
Der Server verwaltet Räume in einer `Map`. Spieler betreten Räume über `createRoom` und `joinRoom`.
- In der `joinRoom`-Funktion musst du die Initialisierung für dein spezifisches Spiel hinzufügen.
- Sobald `room.players.length === 2` erreicht ist, das eigentliche Spiel-Objekt (Game Logic Class) instanziieren und das Spielfeld initialisieren.

Beispiel:
```javascript
socket.on('joinRoom', ({ roomId, playerName, playerId }) => {
    // ... [Standard Lobby Logik] ...

    room.players.push({ id: socket.id, name: playerName, pId: playerId });
    socket.join(roomId);
    socket.emit('roomJoined', { roomId, playerId });
    io.to(roomId).emit('playerJoined', { name: playerName });

    // HIER EINFÜGEN: Spiel-Status initialisieren
    if (room.players.length === 2) {
       // Starte das tatsächliche Spiel
       // const newGame = new MyGameEngine();
       // io.to(roomId).emit('gameStart', newGame.getInitialState());
    }
});
```

## Fazit: Best Practice
- Nutze dieses Template **immer als Fundament** für neue Multiplayer-Projekte.
- Füge deine spielspezifischen `socket.on('xyz')` Events in der `server/index.js` und `public/script.js` einfach unterhalb der Lobby-Logik hinzu.
- Das CSS des Spiels sollte unabhängig von `.lobby-section` gehalten werden, um Konflikte zu vermeiden.
