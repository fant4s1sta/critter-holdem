package main

import (
	cryptorand "crypto/rand"
	"crypto/subtle"
	"errors"
	"fmt"
	"math/rand/v2"
	"slices"
	"strings"
	"sync"
	"time"

	"critter-holdem/server/poker"
)

const (
	maxPlayers      = 8
	startingChips   = 1000
	disconnectGrace = 12 * time.Second
	botDelay        = 600 * time.Millisecond
	handPause       = 5 * time.Second
	roomIdle        = 2 * time.Hour
)

type identity struct {
	PlayerID string `json:"playerId"`
	Secret   string `json:"secret"`
	Name     string `json:"name"`
}

type member struct {
	identity
	critter    string
	seat       int
	chips      int
	bot        bool
	away       bool
	connection *client
	disconnect *time.Timer
}

type room struct {
	mu         sync.Mutex
	code       string
	status     string
	host       *member
	players    []*member
	members    map[string]*member
	game       *poker.Game
	turn       int
	nextHandAt time.Time
	advance    *time.Timer
	idle       *time.Timer
	closed     bool
}

type rooms struct {
	mu   sync.RWMutex
	list map[string]*room
}

func (s *rooms) find(code string) *room {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.list[code]
}

func newMember(name string, seat int) *member {
	name = strings.TrimSpace(name)
	if letters := []rune(name); len(letters) > 16 {
		name = string(letters[:16])
	}
	if name == "" {
		name = "玩家"
	}
	return &member{identity: identity{PlayerID: cryptorand.Text(), Secret: cryptorand.Text(), Name: name}, seat: seat, chips: startingChips}
}

func (s *rooms) create(c *client, name, critter string) (*room, identity) {
	host := newMember(name, 0)
	host.critter = critter
	r := &room{status: "lobby", host: host, players: []*member{host}, members: map[string]*member{host.PlayerID: host}}
	r.mu.Lock()
	defer r.mu.Unlock()
	s.mu.Lock()
	for {
		r.code = fmt.Sprintf("%06d", rand.IntN(900000)+100000)
		if s.list[r.code] == nil {
			break
		}
	}
	s.list[r.code] = r
	s.mu.Unlock()
	r.bind(c, host)
	return r, host.identity
}

func (r *room) join(c *client, name, critter string) (identity, error) {
	seat := -1
	if r.status == "lobby" {
		seat = r.freeSeat()
		if seat == -1 {
			return identity{}, errors.New("房间已满")
		}
	}
	if len(r.members) >= 64 {
		return identity{}, errors.New("房间人数已达上限")
	}
	p := newMember(name, seat)
	p.critter = critter
	if seat >= 0 {
		r.players = append(r.players, p)
		slices.SortFunc(r.players, func(a, b *member) int { return a.seat - b.seat })
	}
	r.members[p.PlayerID] = p
	r.bind(c, p)
	return p.identity, nil
}

func (r *room) freeSeat() int {
	for seat := 0; seat < maxPlayers; seat++ {
		if !slices.ContainsFunc(r.players, func(p *member) bool { return p.seat == seat }) {
			return seat
		}
	}
	return -1
}

func (r *room) bind(c *client, p *member) {
	if r.idle != nil {
		r.idle.Stop()
		r.idle = nil
	}
	if p.disconnect != nil {
		p.disconnect.Stop()
		p.disconnect = nil
	}
	if old := p.connection; old != nil && old != c {
		old.send(message{Type: "session_ended", Error: "已在另一个窗口连接"})
	}
	c.room, c.member = r, p
	p.connection, p.away = c, false
	r.publish()
}

func (s *rooms) detach(c *client, leaving bool) {
	r, p := c.room, c.member
	if r == nil {
		return
	}
	c.room, c.member = nil, nil
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.closed || p.connection != c {
		return
	}
	p.connection = nil
	switch {
	case p.seat < 0:
		if leaving {
			delete(r.members, p.PlayerID)
		}
	case leaving && r.status != "playing":
		delete(r.members, p.PlayerID)
		r.players = slices.DeleteFunc(r.players, func(player *member) bool { return player == p })
		if r.host == p {
			r.host = nil
			for _, candidate := range r.players {
				if !candidate.bot {
					r.host = candidate
					break
				}
			}
		}
		if r.host == nil && r.status == "lobby" {
			s.closeRoom(r)
			return
		}
	case leaving:
		p.away = true
		delete(r.members, p.PlayerID)
	default:
		var timer *time.Timer
		timer = time.AfterFunc(disconnectGrace, func() {
			r.mu.Lock()
			defer r.mu.Unlock()
			if r.closed || p.connection != nil || p.disconnect != timer {
				return
			}
			p.disconnect = nil
			p.away = true
			r.publish()
			r.schedule()
		})
		p.disconnect = timer
	}
	r.publish()
	r.schedule()
	if r.idle == nil && !r.hasConnections() {
		var timer *time.Timer
		timer = time.AfterFunc(roomIdle, func() {
			r.mu.Lock()
			defer r.mu.Unlock()
			if !r.closed && r.idle == timer && !r.hasConnections() {
				s.closeRoom(r)
			}
		})
		r.idle = timer
	}
}

func (r *room) hasConnections() bool {
	for _, p := range r.members {
		if p.connection != nil {
			return true
		}
	}
	return false
}

func (s *rooms) closeRoom(r *room) {
	r.closed = true
	if r.advance != nil {
		r.advance.Stop()
	}
	if r.idle != nil {
		r.idle.Stop()
	}
	for _, p := range r.players {
		if p.disconnect != nil {
			p.disconnect.Stop()
		}
	}
	s.mu.Lock()
	delete(s.list, r.code)
	s.mu.Unlock()
}

var critterChoices = [...]struct{ kind, name string }{
	{"panda", "熊猫"}, {"pig", "小猪"}, {"fox", "狐狸"}, {"tiger", "小老虎"}, {"rabbit", "小兔"}, {"dog", "小狗"}, {"cow", "奶牛"},
}

func validCritter(kind string) bool {
	for _, animal := range critterChoices {
		if animal.kind == kind {
			return true
		}
	}
	return false
}

func (r *room) bot() error {
	seat := r.freeSeat()
	if seat < 0 {
		return errors.New("房间已满")
	}
	animal := critterChoices[seat%len(critterChoices)]
	p := newMember(fmt.Sprintf("%s %d", animal.name, seat+1), seat)
	p.critter = animal.kind
	p.bot = true
	r.players = append(r.players, p)
	slices.SortFunc(r.players, func(a, b *member) int { return a.seat - b.seat })
	return nil
}

func (r *room) startHand() error {
	players := make([]poker.Player, 0, len(r.players))
	for _, p := range r.players {
		players = append(players, poker.Player{ID: p.PlayerID, Seat: p.seat, Chips: p.chips})
	}
	game, err := poker.NewHand(players, r.game)
	if err != nil {
		return err
	}
	r.status, r.game = "playing", game
	r.changedTurn()
	return nil
}

func (r *room) changedTurn() {
	if r.advance != nil {
		r.advance.Stop()
		r.advance = nil
	}
	r.turn++
	for _, p := range r.players {
		if inHand := r.game.Find(p.PlayerID); inHand != nil {
			p.chips = inHand.Chips
		}
	}
	r.nextHandAt = time.Time{}
	if r.game.Actor == nil {
		r.nextHandAt = time.Now().Add(handPause)
	}
	r.schedule()
}

func (r *room) schedule() {
	if r.closed || r.status != "playing" || r.advance != nil {
		return
	}
	delay := botDelay
	if r.game.Actor == nil {
		delay = time.Until(r.nextHandAt)
	} else {
		p := r.player(r.game.Actor.ID)
		if p == nil || (!p.bot && !p.away) {
			return
		}
	}
	turn := r.turn
	r.advance = time.AfterFunc(delay, func() {
		r.mu.Lock()
		defer r.mu.Unlock()
		if r.closed || r.turn != turn {
			return
		}
		r.advance = nil
		if r.game.Actor == nil {
			if err := r.startHand(); err != nil {
				r.status = "finished"
				r.nextHandAt = time.Time{}
			}
		} else if p := r.player(r.game.Actor.ID); p != nil && (p.bot || p.away) {
			if err := r.game.Apply(p.PlayerID, r.game.BotAction()); err != nil {
				_ = r.game.Apply(p.PlayerID, poker.Action{Type: "fold"})
			}
			r.changedTurn()
		}
		r.publish()
	})
}

func (r *room) player(id string) *member {
	for _, p := range r.players {
		if p.PlayerID == id {
			return p
		}
	}
	return nil
}

func (r *room) resume(c *client, req request) error {
	p := r.members[req.PlayerID]
	if p == nil || subtle.ConstantTimeCompare([]byte(p.Secret), []byte(req.Secret)) != 1 {
		return errors.New("房间身份已失效")
	}
	r.bind(c, p)
	return nil
}

func (r *room) play(c *client, req request) error {
	p := c.member
	if c.room != r || p == nil || p.connection != c {
		return errors.New("房间连接已失效")
	}
	switch req.Type {
	case "select_critter":
		if r.status != "lobby" || p.seat < 0 {
			return errors.New("只能在准备开局时选择角色")
		}
		if !validCritter(req.Critter) {
			return errors.New("请选择有效的小动物角色")
		}
		p.critter = req.Critter
	case "add_bot", "start":
		if p != r.host || r.status != "lobby" {
			return errors.New("只有房主可以在大厅执行此操作")
		}
		if req.Type == "add_bot" {
			if err := r.bot(); err != nil {
				return err
			}
		} else if err := r.startHand(); err != nil {
			return err
		}
	case "action":
		if r.status != "playing" || p.seat < 0 || req.Turn != r.turn {
			return errors.New("牌局已更新，请重新操作")
		}
		if err := r.game.Apply(p.PlayerID, req.Action); err != nil {
			return err
		}
		r.changedTurn()
	default:
		return errors.New("未知操作")
	}
	r.publish()
	return nil
}
