const suits = ['Club', 'Diamond', 'Heart', 'Spade'];
const values = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function createDeck() {
    let deck = [];
    for (const suit of suits) {
        for (const value of values) {
            let numValue = parseInt(value);
            if (['J', 'Q', 'K'].includes(value)) numValue = 10;
            if (value === 'A') numValue = 11;
            deck.push({ suit, face: value, value: numValue });
        }
    }
    // shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function calculateHandTotal(hand) {
    if (!hand || hand.length === 0) return 0;

    let maxScore = 0;
    for (const s of suits) {
        const suitSum = hand.filter(c => c.suit === s).reduce((sum, c) => sum + c.value, 0);
        if (suitSum > maxScore) maxScore = suitSum;
    }

    // 3 of a kind yields 30.5
    if (hand.length === 3 && hand[0].face === hand[1].face && hand[1].face === hand[2].face) {
        maxScore = 30.5;
    }
    return maxScore;
}

class Game {
    constructor(roomId) {
        this.roomId = roomId;
        this.players = [];
        this.deck = createDeck();
        this.centerCards = [this.deck.pop(), this.deck.pop(), this.deck.pop()];
        this.turnIndex = 0;
        this.status = 'waiting'; // 'waiting', 'playing', 'finished', 'game_over'
        this.knockedPlayerId = null;
        this.turnsLeftAfterKnock = 0;
        this.pot = 0;
        this.roundStarterIndex = 0;
    }

    addPlayer(id, name, pId) {
        if (this.players.length < 4 && this.status === 'waiting') {
            this.players.push({ id, name, pId, hand: [], hasKnocked: false, active: true, coins: 3, isOut: false, lostLifeThisRound: false, score: 0 });
            return true;
        }
        return false;
    }

    removePlayer(pId) {
        this.players = this.players.filter(p => p.pId !== pId);
        if (this.status === 'playing') {
            if (this.players.length < 2) {
                this.status = 'waiting';
                return;
            }
            if (this.turnIndex >= this.players.length) {
                this.turnIndex = 0;
            }
        }
    }

    start() {
        if (this.players.length < 2) return false;
        this.status = 'playing';
        this.deck = createDeck();
        this.centerCards = [this.deck.pop(), this.deck.pop(), this.deck.pop()];
        this.knockedPlayerId = null;
        this.turnIndex = 0;
        this.roundStarterIndex = 0;
        this.pot = 0;
        this.endedByThirtyOne = false;

        for (const player of this.players) {
            player.active = true;
            player.hasKnocked = false;
            player.coins = 3;
            player.isOut = false;
            player.lostLifeThisRound = false;
            player.hand = [this.deck.pop(), this.deck.pop(), this.deck.pop()];
        }

        this.checkThirtyOne();
        return true;
    }

    startNextRound() {
        if (this.status !== 'finished') return false;

        // Find next round starter
        let initialStarter = this.roundStarterIndex;
        let activePlayers = this.players.filter(p => !p.isOut);
        if (activePlayers.length <= 1) return false; // Game over actually

        do {
            this.roundStarterIndex = (this.roundStarterIndex + 1) % this.players.length;
        } while (this.players[this.roundStarterIndex].isOut && this.roundStarterIndex !== initialStarter);

        this.status = 'playing';
        this.deck = createDeck();
        this.centerCards = [this.deck.pop(), this.deck.pop(), this.deck.pop()];
        this.knockedPlayerId = null;
        this.turnIndex = this.roundStarterIndex;
        this.endedByThirtyOne = false;

        for (const player of this.players) {
            player.active = !player.isOut;
            player.hasKnocked = false;
            player.lostLifeThisRound = false;
            if (!player.isOut) {
                player.hand = [this.deck.pop(), this.deck.pop(), this.deck.pop()];
            } else {
                player.hand = [];
            }
        }

        this.checkThirtyOne();
        return true;
    }

    getCurrentPlayer() {
        return this.players[this.turnIndex];
    }

    checkThirtyOne() {
        if (this.status !== 'playing') return false;

        for (const p of this.players) {
            if (!p.isOut && p.hand.length === 3) {
                if (calculateHandTotal(p.hand) === 31) {
                    this.endedByThirtyOne = true;
                    this.finish();
                    return true;
                }
            }
        }
        return false;
    }

    nextTurn() {
        if (this.status !== 'playing') return 'finished';

        let originalTurn = this.turnIndex;
        do {
            this.turnIndex = (this.turnIndex + 1) % this.players.length;
        } while (this.players[this.turnIndex].isOut && this.turnIndex !== originalTurn);

        if (this.knockedPlayerId !== null) {
            // Game ends if we wrap around back to the knocker
            if (this.players[this.turnIndex].pId === this.knockedPlayerId) {
                this.finish();
                return 'finished';
            }
        }
        return 'next';
    }

    drawFromCenter(pId, centerIndex) {
        let player = this.players.find(p => p.pId === pId);
        // Ensure player is active, it's their turn, hand is less than 4 cards
        if (!player || this.getCurrentPlayer().pId !== pId || player.hand.length >= 4) return false;
        if (centerIndex < 0 || centerIndex >= this.centerCards.length) return false;

        const cCard = this.centerCards.splice(centerIndex, 1)[0];
        player.hand.push(cCard); // Hand now has 1 more card

        this.checkThirtyOne();
        return true;
    }

    discardToCenter(pId, handIndex) {
        let player = this.players.find(p => p.pId === pId);
        // Ensure player is active, it's their turn, center has less than 4 cards
        if (!player || this.getCurrentPlayer().pId !== pId || this.centerCards.length >= 4) return false;
        if (handIndex < 0 || handIndex >= player.hand.length) return false;

        const pCard = player.hand.splice(handIndex, 1)[0];
        this.centerCards.push(pCard); // Center now has 1 more card

        this.checkThirtyOne();
        return true;
    }

    swapAll(pId) {
        let player = this.players.find(p => p.pId === pId);
        if (!player || this.getCurrentPlayer().pId !== pId || player.hand.length !== 3) return false;

        const suits = new Set(player.hand.map(c => c.suit));
        if (suits.size !== 3) return false; // Must have 3 different colors (suits)

        const pHand = [...player.hand];
        player.hand = [...this.centerCards];
        this.centerCards = pHand;

        this.checkThirtyOne();
        return true;
    }

    pass(pId) {
        let player = this.players.find(p => p.pId === pId);
        if (!player || this.getCurrentPlayer().pId !== pId) return false;
        // effectively does nothing except validating it's their turn
        return true;
    }

    knock(pId) {
        let player = this.players.find(p => p.pId === pId);
        if (!player || this.getCurrentPlayer().pId !== pId || this.knockedPlayerId !== null || player.hand.length !== 3) return false;

        this.knockedPlayerId = pId;
        player.hasKnocked = true;
        this.turnsLeftAfterKnock = this.players.length - 1;
        return true;
    }

    finish() {
        this.status = 'finished';
        let activePlayers = this.players.filter(p => !p.isOut);

        for (const p of activePlayers) {
            p.score = calculateHandTotal(p.hand);
        }

        // Find the lowest score
        let lowestScore = Math.min(...activePlayers.map(p => p.score));

        for (const p of activePlayers) {
            if (p.score === lowestScore) {
                p.coins--;
                this.pot++;
                p.lostLifeThisRound = true;
                if (p.coins < 0) {
                    p.isOut = true;
                }
            } else {
                p.lostLifeThisRound = false;
            }
        }

        // Check for overall winner
        let survivors = this.players.filter(p => !p.isOut);
        if (survivors.length <= 1) {
            this.status = 'game_over';
            if (survivors.length === 1) {
                survivors[0].coins += this.pot; // Winner takes all
                this.pot = 0;
            }
        }

        this.players.sort((a, b) => {
            if (a.isOut !== b.isOut) return a.isOut ? 1 : -1;
            return b.score - a.score;
        });
    }

    getState(requestingPId) {
        return {
            status: this.status,
            pot: this.pot,
            players: this.players.map(p => ({
                pId: p.pId,
                name: p.name,
                cardCount: p.hand.length,
                hasKnocked: p.hasKnocked,
                score: (this.status === 'finished' || this.status === 'game_over') ? p.score : null,
                isCurrentTurn: this.players.length > 0 ? this.players.indexOf(p) === this.turnIndex : false,
                hand: (p.pId === requestingPId || this.status === 'finished' || this.status === 'game_over') ? p.hand : null,
                isMyTurn: p.pId === requestingPId && this.players.length > 0 && this.players.indexOf(p) === this.turnIndex,
                isHoldingFour: p.hand.length === 4,
                canSwapAll: p.hand.length === 3 && new Set(p.hand.map(c => c.suit)).size === 3,
                coins: p.coins,
                isOut: p.isOut,
                lostLifeThisRound: p.lostLifeThisRound
            })),
            centerCards: this.centerCards,
            deckCount: this.deck.length,
            knockedPlayerId: this.knockedPlayerId,
            endedByThirtyOne: this.endedByThirtyOne
        };
    }
}

module.exports = { Game, calculateHandTotal, createDeck };
