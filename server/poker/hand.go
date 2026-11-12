package poker

import "strings"

var handNames = [...]string{"高牌", "一对", "两对", "三条", "顺子", "同花", "葫芦", "四条", "同花顺"}

func rankOf(card Card) int { return strings.Index("23456789TJQKA", card.Rank) + 2 }

func bestHand(hole, board []Card) int {
	var cards [7]Card
	n := copy(cards[:], hole)
	n += copy(cards[n:], board)
	best := 0
	for a := 0; a < n-4; a++ {
		for b := a + 1; b < n-3; b++ {
			for c := b + 1; c < n-2; c++ {
				for d := c + 1; d < n-1; d++ {
					for e := d + 1; e < n; e++ {
						best = max(best, fiveCardScore([5]Card{cards[a], cards[b], cards[c], cards[d], cards[e]}))
					}
				}
			}
		}
	}
	return best
}

func score(category int, ranks ...int) int {
	value := category << 20
	for i, rank := range ranks {
		value |= rank << (16 - 4*i)
	}
	return value
}

func fiveCardScore(cards [5]Card) int {
	var counts [15]int
	flush := true
	for _, card := range cards {
		counts[rankOf(card)]++
		flush = flush && card.Suit == cards[0].Suit
	}
	var distinct, pairs, singles []int
	four, three := 0, 0
	for rank := 14; rank >= 2; rank-- {
		if counts[rank] > 0 {
			distinct = append(distinct, rank)
		}
		switch counts[rank] {
		case 4:
			four = rank
		case 3:
			three = rank
		case 2:
			pairs = append(pairs, rank)
		case 1:
			singles = append(singles, rank)
		}
	}
	straight := 0
	if len(distinct) == 5 {
		if distinct[0]-distinct[4] == 4 {
			straight = distinct[0]
		}
		if distinct[0] == 14 && distinct[1] == 5 && distinct[4] == 2 {
			straight = 5
		}
	}
	switch {
	case flush && straight > 0:
		return score(8, straight)
	case four > 0:
		return score(7, four, singles[0])
	case three > 0 && len(pairs) == 1:
		return score(6, three, pairs[0])
	case flush:
		return score(5, distinct...)
	case straight > 0:
		return score(4, straight)
	case three > 0:
		return score(3, three, singles[0], singles[1])
	case len(pairs) == 2:
		return score(2, pairs[0], pairs[1], singles[0])
	case len(pairs) == 1:
		return score(1, pairs[0], singles[0], singles[1], singles[2])
	default:
		return score(0, distinct...)
	}
}
