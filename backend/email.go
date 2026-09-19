package main

import (
	"fmt"
	"log"
	"net/smtp"
	"os"
)

// SendOTPEmail sends an OTP verification code to the invited user's email address.
// If SMTP_HOST is not configured, it logs the OTP directly to the server log for local testing.
func SendOTPEmail(to, code, workspaceName string) error {
	host := os.Getenv("SMTP_HOST")
	port := os.Getenv("SMTP_PORT")
	from := os.Getenv("SMTP_FROM")
	user := os.Getenv("SMTP_USER")
	pass := os.Getenv("SMTP_PASS")

	if from == "" {
		from = "no-reply@agentforge.ai"
	}

	if host == "" {
		// Dev / fallback mode: Log OTP visibly to stdout
		log.Printf("\n" +
			"======================================================================\n" +
			"  [EMAIL DISPATCHER - DEV MODE]\n" +
			fmt.Sprintf("  To:          %s\n", to) +
			fmt.Sprintf("  Workspace:   %s\n", workspaceName) +
			fmt.Sprintf("  OTP Code:    >>> %s <<<\n", code) +
			"  Expires:     In 10 minutes\n" +
			"======================================================================\n")
		return nil
	}

	if port == "" {
		port = "587"
	}

	subject := fmt.Sprintf("Your AgentForge Verification Code for %s", workspaceName)
	body := fmt.Sprintf("Hello,\n\n"+
		"Your verification code to join %s on AgentForge is:\n\n"+
		"    %s\n\n"+
		"This code will expire in 10 minutes.\n"+
		"If you did not request this invitation, please disregard this email.\n\n"+
		"— The AgentForge Security Team", workspaceName, code)

	msg := []byte(fmt.Sprintf("From: %s\r\n"+
		"To: %s\r\n"+
		"Subject: %s\r\n"+
		"MIME-Version: 1.0\r\n"+
		"Content-Type: text/plain; charset=\"UTF-8\"\r\n\r\n"+
		"%s", from, to, subject, body))

	addr := fmt.Sprintf("%s:%s", host, port)

	var auth smtp.Auth
	if user != "" {
		auth = smtp.PlainAuth("", user, pass, host)
	}

	err := smtp.SendMail(addr, auth, from, []string{to}, msg)
	if err != nil {
		log.Printf("[Email] Failed to send OTP email to %s: %v", to, err)
		return err
	}

	log.Printf("[Email] OTP email successfully dispatched to %s via %s:%s", to, host, port)
	return nil
}
