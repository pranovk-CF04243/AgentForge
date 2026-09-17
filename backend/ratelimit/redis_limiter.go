package ratelimit

import (
	"net/http"
	"strconv"
)

type CmdResult struct {
	val interface{}
	err error
}

func (c *CmdResult) Result() (interface{}, error) {
	return c.val, c.err
}

// Redis Lua script for token bucket rate limiting (100 req/min)
const tokenBucketScript = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2]) -- tokens per second
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

local bucket = redis.call('HMGET', key, 'tokens', 'last_updated')
local tokens = tonumber(bucket[1])
local last_updated = tonumber(bucket[2])

if not tokens then
    tokens = capacity
    last_updated = now
else
    local delta = math.max(0, now - last_updated)
    tokens = math.min(capacity, tokens + delta * refill_rate)
    last_updated = now
end

if tokens < requested then
    redis.call('HMSET', key, 'tokens', tokens, 'last_updated', last_updated)
    redis.call('EXPIRE', key, 120)
    return {0, math.floor(tokens), math.ceil((requested - tokens) / refill_rate)}
else
    tokens = tokens - requested
    redis.call('HMSET', key, 'tokens', tokens, 'last_updated', last_updated)
    redis.call('EXPIRE', key, 120)
    return {1, math.floor(tokens), 0}
end
`

// RateLimitMiddleware enforces rate limiting (100 req/min)
func RateLimitMiddleware(limiter Limiter) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Identify client by IP or API Key
			clientKey := r.Header.Get("X-API-Key")
			if clientKey == "" {
				clientKey = r.RemoteAddr
			}

			allowed, remaining, retryAfter, err := limiter.Allow(r.Context(), "rl:"+clientKey)
			w.Header().Set("X-RateLimit-Limit", "100")
			w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(remaining))

			if err != nil {
				next.ServeHTTP(w, r)
				return
			}

			if !allowed {
				w.Header().Set("Retry-After", strconv.Itoa(int(retryAfter.Seconds())))
				http.Error(w, `{"error": "Rate limit exceeded. Maximum 100 requests per minute allowed."}`, http.StatusTooManyRequests)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
