package poker

import (
	"crypto/rand"
	"errors"
	"math/big"
	"slices"
)

const (
	SmallBlind = 10
	BigBlind   = 20
	ChipUnit   = 10
)

var denominations = [5]int{10, 20, 50, 100, 500}

type Card struct {
	Rank string `json:"rank"`
	Suit string `json:"suit"`
}

type Action struct {
	Type       string `json:"type"`
	Amount     int    `json:"amount"`
	ChipCounts []int  `json:"chipCounts"`
}

type Player struct {
	ID         string
	Seat       int
	Chips      int
	Hole       []Card
	Folded     bool
	AllIn      bool
	Bet        int
	Total      int
	TotalChips [5]int
	pending    bool
	acted      bool
	faced      int
}

func (p *Player) active() bool { return !p.Folded && !p.AllIn }

type Winner struct {
	PlayerID string `json:"playerId"`
	Amount   int    `json:"amount"`
	HandName string `json:"handName,omitempty"`
}

type Game struct {
	HandNumber     int
	Street         string
	Board          []Card
	Pot            int
	CurrentBet     int
	MinRaise       int
	SmallBlindSeat int
	Actor          *Player
	Players        []Player
	Winners        []Winner
	ShowCards      bool
	deck           []Card
}

func NewHand(players []Player, previous *Game) (*Game, error) {
	g := &Game{HandNumber: 1, Street: "preflop", MinRaise: BigBlind, CurrentBet: BigBlind, Board: make([]Card, 0, 5)}
	for _, p := range players {
		if p.Chips > 0 {
			g.Players = append(g.Players, Player{ID: p.ID, Seat: p.Seat, Chips: p.Chips})
		}
	}
	if len(g.Players) < 2 {
		return nil, errors.New("至少需要 2 名有筹码的玩家")
	}
	slices.SortFunc(g.Players, func(a, b Player) int { return a.Seat - b.Seat })
	for _, suit := range "shdc" {
		for _, rank := range "23456789TJQKA" {
			g.deck = append(g.deck, Card{Rank: string(rank), Suit: string(suit)})
		}
	}
	for i := len(g.deck) - 1; i > 0; i-- {
		j, err := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		if err != nil {
			return nil, err
		}
		g.deck[i], g.deck[j.Int64()] = g.deck[j.Int64()], g.deck[i]
	}
	small := &g.Players[0]
	if previous != nil {
		g.HandNumber = previous.HandNumber + 1
		small = g.after(previous.SmallBlindSeat, func(*Player) bool { return true })
	}
	g.SmallBlindSeat = small.Seat
	bigBlind := g.after(small.Seat, func(*Player) bool { return true })
	g.pay(small, min(SmallBlind, small.Chips), nil)
	g.pay(bigBlind, min(BigBlind, bigBlind.Chips), nil)
	for round := 0; round < 2; round++ {
		for i := range g.Players {
			p := &g.Players[i]
			p.Hole = append(p.Hole, g.draw())
			p.pending = p.active()
		}
	}
	g.advance(bigBlind.Seat)
	return g, nil
}

func (g *Game) after(seat int, matches func(*Player) bool) *Player {
	var first *Player
	for i := range g.Players {
		p := &g.Players[i]
		if !matches(p) {
			continue
		}
		if first == nil {
			first = p
		}
		if p.Seat > seat {
			return p
		}
	}
	return first
}

func (g *Game) Find(id string) *Player {
	for i := range g.Players {
		if g.Players[i].ID == id {
			return &g.Players[i]
		}
	}
	return nil
}

func (g *Game) draw() Card {
	i := len(g.deck) - 1
	card := g.deck[i]
	g.deck = g.deck[:i]
	return card
}

func validChips(amount int, counts []int) bool {
	if counts == nil {
		return true
	}
	if len(counts) != len(denominations) {
		return false
	}
	total := 0
	for i, count := range counts {
		if count < 0 || count > amount/denominations[i] {
			return false
		}
		total += count * denominations[i]
	}
	return total == amount
}

func (g *Game) pay(p *Player, amount int, counts []int) {
	if counts == nil {
		counts = make([]int, len(denominations))
		left := amount
		for i := len(counts) - 1; i >= 0; i-- {
			counts[i] = left / denominations[i]
			left %= denominations[i]
		}
	}
	for i, count := range counts {
		p.TotalChips[i] += count
	}
	p.Chips -= amount
	p.Bet += amount
	p.Total += amount
	p.AllIn = p.Chips == 0
	g.Pot += amount
}

func (g *Game) CallAmount(p *Player) int {
	return min(p.Chips, max(0, g.CurrentBet-p.Bet))
}

func (g *Game) CanRaise(p *Player) bool {
	if p.Chips <= g.CallAmount(p) {
		return false
	}
	for i := range g.Players {
		other := &g.Players[i]
		if other != p && other.active() {
			return !p.acted || g.CurrentBet-p.faced >= g.MinRaise
		}
	}
	return false
}

func (g *Game) MinRaiseTo() int {
	if g.CurrentBet < BigBlind {
		return BigBlind
	}
	return g.CurrentBet + g.MinRaise
}

func (g *Game) Apply(id string, action Action) error {
	p := g.Actor
	if p == nil || p.ID != id {
		return errors.New("还没轮到你")
	}
	paid, target := 0, p.Bet
	switch action.Type {
	case "fold":
	case "check":
		if g.CallAmount(p) > 0 {
			return errors.New("有人下注，不能过牌")
		}
	case "call":
		paid = g.CallAmount(p)
		if paid == 0 {
			return errors.New("没有需要跟的注")
		}
	case "bet", "raise", "all-in":
		target = action.Amount
		if action.Type == "all-in" {
			target = p.Bet + p.Chips
		}
		if target <= p.Bet || target > p.Bet+p.Chips || target%ChipUnit != 0 {
			return errors.New("下注金额无效")
		}
		paid = target - p.Bet
		if paid != p.Chips && target < g.MinRaiseTo() {
			return errors.New("加注低于最低额，请使用跟注")
		}
		if target > g.CurrentBet && !g.CanRaise(p) {
			return errors.New("本轮不能再次加注")
		}
	default:
		return errors.New("未知操作")
	}
	if !validChips(paid, action.ChipCounts) {
		return errors.New("筹码数量与下注金额不一致")
	}
	if action.Type == "fold" {
		p.Folded = true
	}
	if paid > 0 {
		g.pay(p, paid, action.ChipCounts)
	}
	if target > g.CurrentBet {
		g.MinRaise = max(g.MinRaise, target-g.CurrentBet)
		g.CurrentBet = target
		for i := range g.Players {
			other := &g.Players[i]
			if other.active() && other.Bet < target {
				other.pending = true
			}
		}
	}
	p.pending = false
	p.acted = true
	p.faced = g.CurrentBet
	g.advance(p.Seat)
	return nil
}

func (g *Game) advance(afterSeat int) {
	living, active := 0, 0
	for i := range g.Players {
		p := &g.Players[i]
		if !p.Folded {
			living++
		}
		if p.active() {
			active++
		}
	}
	if living == 1 {
		g.settle(false)
		return
	}
	g.Actor = g.after(afterSeat, func(p *Player) bool {
		return p.active() && p.pending && (active > 1 || g.CallAmount(p) > 0)
	})
	if g.Actor != nil {
		return
	}
	if active < 2 || g.Street == "river" {
		for len(g.Board) < 5 {
			g.Board = append(g.Board, g.draw())
		}
		g.settle(true)
		return
	}

	g.CurrentBet, g.MinRaise = 0, BigBlind
	for i := range g.Players {
		p := &g.Players[i]
		p.Bet = 0
		p.pending, p.acted, p.faced = p.active(), false, 0
	}
	switch g.Street {
	case "preflop":
		g.Street = "flop"
		g.Board = append(g.Board, g.draw(), g.draw(), g.draw())
	case "flop":
		g.Street = "turn"
		g.Board = append(g.Board, g.draw())
	case "turn":
		g.Street = "river"
		g.Board = append(g.Board, g.draw())
	}
	start := g.SmallBlindSeat - 1
	if len(g.Players) == 2 {
		start = g.SmallBlindSeat
	}
	g.Actor = g.after(start, func(p *Player) bool { return p.active() })
}

func (g *Game) settle(show bool) {
	g.Street, g.Actor, g.ShowCards = "showdown", nil, show
	var levels []int
	scores := make([]int, len(g.Players))
	for i, p := range g.Players {
		if p.Total > 0 {
			levels = append(levels, p.Total)
		}
		if show && !p.Folded {
			scores[i] = bestHand(p.Hole, g.Board)
		}
	}
	slices.Sort(levels)
	previous := 0
	winnings := make([]int, len(g.Players))
	for _, level := range slices.Compact(levels) {
		var contributors, winners []int
		best := -1
		for i, p := range g.Players {
			if p.Total < level {
				continue
			}
			contributors = append(contributors, i)
			if p.Folded || scores[i] < best {
				continue
			}
			if scores[i] > best {
				best, winners = scores[i], winners[:0]
			}
			winners = append(winners, i)
		}
		units := (level - previous) * len(contributors) / ChipUnit
		previous = level
		if len(contributors) == 1 || len(winners) == 0 {
			for _, i := range contributors {
				g.Players[i].Chips += units / len(contributors) * ChipUnit
			}
			continue
		}
		for pos, i := range winners {
			share := units / len(winners)
			if pos < units%len(winners) {
				share++
			}
			winnings[i] += share * ChipUnit
			g.Players[i].Chips += share * ChipUnit
		}
	}
	for i, amount := range winnings {
		if amount == 0 {
			continue
		}
		winner := Winner{PlayerID: g.Players[i].ID, Amount: amount}
		if show {
			winner.HandName = handNames[scores[i]>>20]
		}
		g.Winners = append(g.Winners, winner)
	}
	g.Pot = 0
}

func (g *Game) BotAction() Action {
	p := g.Actor
	a, b := rankOf(p.Hole[0]), rankOf(p.Hole[1])
	strength := 2*(max(a, b)-2) + (min(a, b)-2)/2
	if a == b {
		strength += 8
	}
	if p.Hole[0].Suit == p.Hole[1].Suit {
		strength += 2
	}
	if max(a, b)-min(a, b) <= 2 {
		strength++
	}
	if len(g.Board) >= 3 {
		strength = max(strength, 10+5*(bestHand(p.Hole, g.Board)>>20))
	}
	call := g.CallAmount(p)
	odds := float64(call) / float64(g.Pot+call+1)
	target := g.MinRaiseTo()
	if strength >= 30 && g.CanRaise(p) && target <= p.Bet+p.Chips {
		return Action{Type: "raise", Amount: target}
	}
	if call == 0 {
		return Action{Type: "check"}
	}
	if (call == p.Chips && strength < 16) || (strength < 14 && odds > .28) {
		return Action{Type: "fold"}
	}
	return Action{Type: "call"}
}
