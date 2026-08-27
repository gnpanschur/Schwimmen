/**
 * Clientseitige Konfiguration für Schwimmen
 */
const GAME_LOBBY_CONFIG = {
  // Name & Branding des Spiels
  gameTitle: 'SCHWIMMEN',
  logoLetters: [
    { text: 'S', color: 'red' },
    { text: 'C', color: 'yellow' },
    { text: 'H', color: 'green' },
    { text: 'W', color: 'blue' },
    { text: 'I', color: 'red' },
    { text: 'M', color: 'yellow' },
    { text: 'M', color: 'green' },
    { text: 'E', color: 'blue' },
    { text: 'N', color: 'red' }
  ],
  subtitle: 'Multiplayer Kartenspiel 31',

  // Lobby-Parameter
  minPlayers: 2,
  maxPlayers: 4,
  
  // Storage Key für den Spielernamen
  storageKeyName: 'schwimmen_player_name',

  // Feature Flags
  enableWhatsAppShare: true,
  enableCopyCode: true,
  enableReadySystem: true,

  // Ziel-URL oder Screen nach Spielstart
  onGameStart: function(roomState) {
    console.log('[Lobby] Game started event received! Room:', roomState);
    if (typeof window.startSchwimmenGameUI === 'function') {
      window.startSchwimmenGameUI(roomState);
    }
  }
};

if (typeof window !== 'undefined') {
  window.GAME_LOBBY_CONFIG = GAME_LOBBY_CONFIG;
}
