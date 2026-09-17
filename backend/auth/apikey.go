package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"strings"
)

// GenerateAPIKey generates a cryptographically secure API key with prefix 'af_live_'
// Format: af_live_<random_hex_string>
func GenerateAPIKey() (rawKey string, err error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	rawKey = "af_live_" + hex.EncodeToString(bytes)
	return rawKey, nil
}

// HashAPIKey computes SHA-256 hash of the API key combined with a salt
func HashAPIKey(rawKey, salt string) string {
	hasher := sha256.New()
	hasher.Write([]byte(rawKey + salt))
	return hex.EncodeToString(hasher.Sum(nil))
}

// ValidateKeyFormat checks if rawKey starts with 'af_live_' and has correct length
func ValidateKeyFormat(rawKey string) bool {
	if !strings.HasPrefix(rawKey, "af_live_") {
		return false
	}
	// "af_live_" (8 chars) + 64 hex chars = 72 chars total
	if len(rawKey) != 72 {
		return false
	}
	_, err := hex.DecodeString(rawKey[8:])
	return err == nil
}
