package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"regexp"
	"time"

	"critter-holdem/server/poker"
	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

type request struct {
	ID       int          `json:"id"`
	Type     string       `json:"type"`
	Name     string       `json:"name"`
	Code     string       `json:"code"`
	PlayerID string       `json:"playerId"`
	Secret   string       `json:"secret"`
	Turn     int          `json:"turn"`
	Action   poker.Action `json:"action"`
}

type message struct {
	Type      string     `json:"type"`
	ID        int        `json:"id,omitempty"`
	Error     string     `json:"error,omitempty"`
	ErrorCode string     `json:"errorCode,omitempty"`
	Code      string     `json:"code,omitempty"`
	Identity  *identity  `json:"identity,omitempty"`
	Room      *roomState `json:"room,omitempty"`
}

type client struct {
	room   *room
	member *member
	out    chan []byte
	cancel context.CancelFunc
}

func (c *client) send(m message) {
	data, err := json.Marshal(m)
	if err != nil {
		c.cancel()
		return
	}
	select {
	case c.out <- data:
	default:
		c.cancel()
	}
}

func (s *rooms) dispatch(c *client, req request) message {
	reply := message{Type: "reply", ID: req.ID}
	switch req.Type {
	case "create", "join", "resume":
		if c.room != nil {
			reply.Error = "请先离开当前房间"
			return reply
		}
		if req.Type == "create" {
			r, id := s.create(c, req.Name)
			reply.Code, reply.Identity = r.code, &id
			return reply
		}
		r := s.find(req.Code)
		if r == nil {
			reply.Error, reply.ErrorCode = "房间不存在或已关闭", "missing_room"
			return reply
		}
		r.mu.Lock()
		defer r.mu.Unlock()
		if r.closed {
			reply.Error, reply.ErrorCode = "房间不存在或已关闭", "missing_room"
		} else if req.Type == "join" {
			id, err := r.join(c, req.Name)
			if err != nil {
				reply.Error = err.Error()
			} else {
				reply.Code, reply.Identity = r.code, &id
			}
		} else if err := r.resume(c, req); err != nil {
			reply.Error, reply.ErrorCode = err.Error(), "invalid_session"
		}
	case "leave":
		s.detach(c, true)
	default:
		r := c.room
		if r == nil {
			reply.Error = "请先加入房间"
			return reply
		}
		r.mu.Lock()
		defer r.mu.Unlock()
		if err := r.play(c, req); err != nil {
			reply.Error = err.Error()
		}
	}
	return reply
}

func (s *rooms) serveSocket(w http.ResponseWriter, r *http.Request) {
	ws, err := websocket.Accept(w, r, nil)
	if err != nil {
		return
	}
	defer ws.CloseNow()
	ws.SetReadLimit(4096)
	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	c := &client{out: make(chan []byte, 32), cancel: cancel}
	defer s.detach(c, false)

	go func() {
		defer cancel()
		ticker := time.NewTicker(25 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case data := <-c.out:
				writeCtx, stop := context.WithTimeout(ctx, 5*time.Second)
				err := ws.Write(writeCtx, websocket.MessageText, data)
				stop()
				if err != nil {
					return
				}
			case <-ticker.C:
				pingCtx, stop := context.WithTimeout(ctx, 5*time.Second)
				err := ws.Ping(pingCtx)
				stop()
				if err != nil {
					return
				}
			}
		}
	}()
	for {
		var req request
		if err := wsjson.Read(ctx, ws, &req); err != nil {
			return
		}
		c.send(s.dispatch(c, req))
	}
}

var roomPath = regexp.MustCompile(`^/room/[0-9]{6}/?$`)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}
	staticDir := os.Getenv("STATIC_DIR")
	if staticDir == "" {
		staticDir = "dist"
	}

	s := &rooms{list: make(map[string]*room)}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /ws", s.serveSocket)
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	files := http.FileServer(http.Dir(staticDir))
	mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" || roomPath.MatchString(r.URL.Path) {
			w.Header().Set("Cache-Control", "no-cache")
			http.ServeFile(w, r, staticDir+"/index.html")
			return
		}
		files.ServeHTTP(w, r)
	})
	server := &http.Server{Addr: ":" + port, Handler: mux, ReadHeaderTimeout: 5 * time.Second, IdleTimeout: 60 * time.Second}
	log.Printf("Critter Hold'em listening on http://localhost:%s", port)
	if err := server.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}
