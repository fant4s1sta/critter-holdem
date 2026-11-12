package poker

import (
	"slices"
	"testing"
)

func apply(t *testing.T, g *Game, id string, action Action) {
	t.Helper()
	if err := g.Apply(id, action); err != nil {
		t.Fatalf("%s %s: %v", id, action.Type, err)
	}
}

func TestHeadsUpTurnOrderAndChipValidation(t *testing.T) {
	g, err := NewHand([]Player{{ID: "a", Seat: 0, Chips: 1000}, {ID: "b", Seat: 1, Chips: 1000}}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if g.Actor.ID != "a" || g.Pot != 30 {
		t.Fatal("invalid blinds or first actor")
	}
	if err := g.Apply("b", Action{Type: "check"}); err == nil {
		t.Fatal("out-of-turn check accepted")
	}
	if err := g.Apply("a", Action{Type: "raise", Amount: 40, ChipCounts: []int{0, 0, 0, 0, 1}}); err == nil || g.Pot != 30 || g.Actor.ID != "a" {
		t.Fatal("invalid chips changed state")
	}
	apply(t, g, "a", Action{Type: "call", ChipCounts: []int{1, 0, 0, 0, 0}})
	apply(t, g, "b", Action{Type: "check"})
	if g.Street != "flop" || len(g.Board) != 3 || g.Actor.ID != "b" || g.Pot != 40 {
		t.Fatal("invalid heads-up flop")
	}
	if g.Find("a").Bet != 0 || g.Find("a").TotalChips[0] != 2 {
		t.Fatal("wagers were not carried across streets")
	}
	apply(t, g, "b", Action{Type: "fold"})
	if g.ShowCards || g.Pot != 0 || len(g.Winners) != 1 || g.Winners[0].PlayerID != "a" || g.Winners[0].Amount != 40 {
		t.Fatalf("wrong fold settlement: %+v", g.Winners)
	}
	next, err := NewHand(g.Players, g)
	if err != nil {
		t.Fatal(err)
	}
	if next.HandNumber != 2 || next.SmallBlindSeat != 1 {
		t.Fatal("blinds did not rotate")
	}
}

func TestShortAllInDoesNotReopenBetting(t *testing.T) {
	g, err := NewHand([]Player{
		{ID: "a", Seat: 0, Chips: 1000},
		{ID: "b", Seat: 1, Chips: 50},
		{ID: "c", Seat: 2, Chips: 1000},
	}, nil)
	if err != nil {
		t.Fatal(err)
	}
	apply(t, g, "c", Action{Type: "raise", Amount: 40})
	apply(t, g, "a", Action{Type: "call"})
	apply(t, g, "b", Action{Type: "all-in"})
	if g.Actor.ID != "c" || g.CallAmount(g.Actor) != 10 || g.CanRaise(g.Actor) {
		t.Fatal("short raise reopened betting")
	}
	if err := g.Apply("c", Action{Type: "raise", Amount: 70}); err == nil {
		t.Fatal("raise accepted")
	}
	apply(t, g, "c", Action{Type: "call"})
	apply(t, g, "a", Action{Type: "call"})
	if g.Street != "flop" || g.Pot != 150 {
		t.Fatal("flop did not advance")
	}
}

func cards(values ...string) []Card {
	out := make([]Card, 0, len(values))
	for _, value := range values {
		out = append(out, Card{Rank: value[:1], Suit: value[1:]})
	}
	return out
}

func TestSidePotsAndUncalledWager(t *testing.T) {
	g := Game{
		Pot:   270,
		Board: cards("2h", "3d", "4s", "8c", "9c"),
		Players: []Player{
			{ID: "main", Total: 50, Hole: cards("5d", "6d")},
			{ID: "side", Total: 100, Hole: cards("As", "Ah")},
			{ID: "excess", Total: 120, Hole: cards("Ks", "Kh")},
		},
	}
	g.settle(true)
	if !slices.Equal(g.Winners, []Winner{{"main", 150, "顺子"}, {"side", 100, "一对"}}) {
		t.Fatalf("wrong pots: %+v", g.Winners)
	}
	if g.Players[2].Chips != 20 || g.Pot != 0 || !g.ShowCards {
		t.Fatal("uncalled wager not returned")
	}
}

func TestSplitPotRemainder(t *testing.T) {
	g := Game{
		Pot: 90, Board: cards("Ts", "Js", "Qs", "Ks", "As"),
		Players: []Player{
			{ID: "a", Total: 30, Hole: cards("2d", "3d")},
			{ID: "b", Total: 30, Hole: cards("4h", "5h")},
			{ID: "c", Total: 30, Folded: true},
		},
	}
	g.settle(true)
	if !slices.Equal(g.Winners, []Winner{{"a", 50, "同花顺"}, {"b", 40, "同花顺"}}) {
		t.Fatalf("wrong split: %+v", g.Winners)
	}
}

func TestHandRanking(t *testing.T) {
	wheel := bestHand(cards("As", "2d"), cards("3c", "4h", "5d", "9d", "Th"))
	sixHigh := bestHand(cards("6s", "2d"), cards("3c", "4h", "5d", "9d", "Th"))
	twoTrips := bestHand(cards("As", "Ad"), cards("Ac", "Kh", "Kd", "Ks", "Th"))
	if wheel>>20 != 4 || sixHigh <= wheel || twoTrips>>20 != 6 {
		t.Fatal("wrong wheel or full house ranking")
	}
}
