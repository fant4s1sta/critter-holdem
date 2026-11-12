package main

import (
	"time"

	"critter-holdem/server/poker"
)

type publicPlayer struct {
	ID            string       `json:"id"`
	Name          string       `json:"name"`
	Seat          int          `json:"seat"`
	Chips         int          `json:"chips"`
	IsHost        bool         `json:"isHost"`
	Connected     bool         `json:"connected"`
	AIControlled  bool         `json:"aiControlled"`
	Folded        bool         `json:"folded"`
	AllIn         bool         `json:"allIn"`
	Bet           int          `json:"betThisStreet"`
	TotalChips    [5]int       `json:"totalBetChips"`
	HoleCards     []poker.Card `json:"holeCards"`
	HoleCardCount int          `json:"holeCardCount"`
}

type publicGame struct {
	HandNumber     int            `json:"handNumber"`
	Street         string         `json:"street"`
	CommunityCards []poker.Card   `json:"communityCards"`
	Pot            int            `json:"pot"`
	CurrentBet     int            `json:"currentBet"`
	ActingPlayerID string         `json:"actingPlayerId,omitempty"`
	Turn           int            `json:"turn"`
	NextHandAt     int64          `json:"nextHandAt,omitempty"`
	Winners        []poker.Winner `json:"winners,omitempty"`
}

type viewerState struct {
	PlayerID   string `json:"playerId"`
	Spectator  bool   `json:"spectator"`
	CanAct     bool   `json:"canAct"`
	CanRaise   bool   `json:"canRaise"`
	CallAmount int    `json:"callAmount"`
	MinRaiseTo int    `json:"minRaiseTo"`
}

type roomState struct {
	Code       string         `json:"code"`
	Status     string         `json:"status"`
	MaxPlayers int            `json:"maxPlayers"`
	Players    []publicPlayer `json:"players"`
	You        viewerState    `json:"you"`
	Game       *publicGame    `json:"game"`
	ServerNow  int64          `json:"serverNow"`
}

func (r *room) state(viewer *member) roomState {
	state := roomState{
		Code: r.code, Status: r.status, MaxPlayers: maxPlayers,
		Players:   make([]publicPlayer, 0, len(r.players)),
		You:       viewerState{PlayerID: viewer.PlayerID, Spectator: viewer.seat < 0},
		ServerNow: time.Now().UnixMilli(),
	}
	g := r.game
	if g != nil {
		state.Game = &publicGame{HandNumber: g.HandNumber, Street: g.Street, CommunityCards: g.Board, Pot: g.Pot, CurrentBet: g.CurrentBet, Turn: r.turn, Winners: g.Winners}
		if !r.nextHandAt.IsZero() {
			state.Game.NextHandAt = r.nextHandAt.UnixMilli()
		}
		if g.Actor != nil {
			state.Game.ActingPlayerID = g.Actor.ID
			if viewer.PlayerID == g.Actor.ID && !viewer.away {
				state.You.CanAct = true
				state.You.CanRaise = g.CanRaise(g.Actor)
				state.You.CallAmount = g.CallAmount(g.Actor)
				state.You.MinRaiseTo = g.MinRaiseTo()
			}
		}
	}
	for _, p := range r.players {
		out := publicPlayer{ID: p.PlayerID, Name: p.Name, Seat: p.seat, Chips: p.chips, IsHost: p == r.host, Connected: p.bot || p.connection != nil, AIControlled: p.bot || p.away}
		if g != nil {
			if inHand := g.Find(p.PlayerID); inHand != nil {
				out.Folded, out.AllIn, out.Bet = inHand.Folded, inHand.AllIn, inHand.Bet
				out.TotalChips = inHand.TotalChips
				out.HoleCardCount = len(inHand.Hole)
				if p == viewer || (g.ShowCards && !inHand.Folded) {
					out.HoleCards = inHand.Hole
				}
			}
		}
		state.Players = append(state.Players, out)
	}
	return state
}

func (r *room) publish() {
	for _, p := range r.members {
		if p.connection == nil {
			continue
		}
		state := r.state(p)
		p.connection.send(message{Type: "state", Room: &state})
	}
}
