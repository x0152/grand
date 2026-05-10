package usecases

import (
	"bufio"
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/smtp"
	"strconv"
	"strings"
	"time"

	"mantis/core/base"
	"mantis/core/types"
)

const (
	emailDialTimeout = 12 * time.Second
	emailIOTimeout   = 12 * time.Second
)

type VerifyEmail struct{}

func NewVerifyEmail() *VerifyEmail {
	return &VerifyEmail{}
}

type EmailProbe struct {
	OK      bool   `json:"ok"`
	Skipped bool   `json:"skipped"`
	Detail  string `json:"detail,omitempty"`
}

type EmailVerifyResult struct {
	SMTP EmailProbe `json:"smtp"`
	IMAP EmailProbe `json:"imap"`
}

func (uc *VerifyEmail) Execute(ctx context.Context, draft types.EmailDraft) (EmailVerifyResult, error) {
	addr := strings.TrimSpace(draft.Address)
	if addr == "" && draft.SMTPUsername == "" && draft.IMAPUsername == "" {
		return EmailVerifyResult{}, fmt.Errorf("%w: email address or username is required", base.ErrValidation)
	}
	smtpUser := firstNonEmpty(draft.SMTPUsername, addr)
	imapUser := firstNonEmpty(draft.IMAPUsername, addr)
	smtpPort := parsePort(draft.SMTPPort, 587)
	imapPort := parsePort(draft.IMAPPort, 993)
	smtp := probeSMTP(ctx, draft.SMTPHost, smtpPort, smtpUser, draft.SMTPPassword)
	imap := probeIMAP(ctx, draft.IMAPHost, imapPort, imapUser, draft.IMAPPassword)
	return EmailVerifyResult{SMTP: smtp, IMAP: imap}, nil
}

func probeSMTP(ctx context.Context, host string, port int, user, pass string) EmailProbe {
	host = strings.TrimSpace(host)
	if host == "" || strings.TrimSpace(user) == "" || strings.TrimSpace(pass) == "" {
		return EmailProbe{Skipped: true, Detail: "no SMTP credentials"}
	}
	addr := net.JoinHostPort(host, strconv.Itoa(port))
	dialer := &net.Dialer{Timeout: emailDialTimeout}
	var (
		conn net.Conn
		err  error
	)
	if port == 465 {
		conn, err = tls.DialWithDialer(dialer, "tcp", addr, &tls.Config{ServerName: host, MinVersion: tls.VersionTLS12})
	} else {
		conn, err = dialer.DialContext(ctx, "tcp", addr)
	}
	if err != nil {
		return EmailProbe{Detail: fmt.Sprintf("connect: %s", err)}
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(emailIOTimeout))
	client, err := smtp.NewClient(conn, host)
	if err != nil {
		return EmailProbe{Detail: fmt.Sprintf("smtp handshake: %s", err)}
	}
	defer client.Close()
	if port != 465 {
		if ok, _ := client.Extension("STARTTLS"); ok {
			if err := client.StartTLS(&tls.Config{ServerName: host, MinVersion: tls.VersionTLS12}); err != nil {
				return EmailProbe{Detail: fmt.Sprintf("starttls: %s", err)}
			}
		}
	}
	if err := client.Auth(smtp.PlainAuth("", user, pass, host)); err != nil {
		return EmailProbe{Detail: fmt.Sprintf("auth: %s", err)}
	}
	_ = client.Quit()
	return EmailProbe{OK: true, Detail: "login succeeded"}
}

func probeIMAP(ctx context.Context, host string, port int, user, pass string) EmailProbe {
	host = strings.TrimSpace(host)
	if host == "" || strings.TrimSpace(user) == "" || strings.TrimSpace(pass) == "" {
		return EmailProbe{Skipped: true, Detail: "no IMAP credentials"}
	}
	addr := net.JoinHostPort(host, strconv.Itoa(port))
	dialer := &net.Dialer{Timeout: emailDialTimeout}
	var (
		conn net.Conn
		err  error
	)
	if port == 993 {
		conn, err = tls.DialWithDialer(dialer, "tcp", addr, &tls.Config{ServerName: host, MinVersion: tls.VersionTLS12})
	} else {
		conn, err = dialer.DialContext(ctx, "tcp", addr)
	}
	if err != nil {
		return EmailProbe{Detail: fmt.Sprintf("connect: %s", err)}
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(emailIOTimeout))
	r := bufio.NewReader(conn)
	greeting, err := r.ReadString('\n')
	if err != nil {
		return EmailProbe{Detail: fmt.Sprintf("greeting: %s", err)}
	}
	if !strings.HasPrefix(strings.TrimSpace(greeting), "* OK") {
		return EmailProbe{Detail: fmt.Sprintf("unexpected greeting: %s", strings.TrimSpace(greeting))}
	}
	if port != 993 {
		if _, err := fmt.Fprintf(conn, "A001 STARTTLS\r\n"); err != nil {
			return EmailProbe{Detail: fmt.Sprintf("starttls write: %s", err)}
		}
		line, err := readIMAPTagged(r, "A001")
		if err != nil {
			return EmailProbe{Detail: fmt.Sprintf("starttls read: %s", err)}
		}
		if !strings.Contains(strings.ToUpper(line), "OK") {
			return EmailProbe{Detail: fmt.Sprintf("starttls rejected: %s", line)}
		}
		tlsConn := tls.Client(conn, &tls.Config{ServerName: host, MinVersion: tls.VersionTLS12})
		if err := tlsConn.HandshakeContext(ctx); err != nil {
			return EmailProbe{Detail: fmt.Sprintf("tls handshake: %s", err)}
		}
		conn = tlsConn
		_ = conn.SetDeadline(time.Now().Add(emailIOTimeout))
		r = bufio.NewReader(conn)
	}
	if _, err := fmt.Fprintf(conn, "A002 LOGIN %s %s\r\n", imapQuote(user), imapQuote(pass)); err != nil {
		return EmailProbe{Detail: fmt.Sprintf("login write: %s", err)}
	}
	line, err := readIMAPTagged(r, "A002")
	if err != nil {
		return EmailProbe{Detail: fmt.Sprintf("login read: %s", err)}
	}
	upper := strings.ToUpper(line)
	if !strings.Contains(upper, "OK") {
		return EmailProbe{Detail: fmt.Sprintf("auth: %s", strings.TrimSpace(line))}
	}
	_, _ = fmt.Fprintf(conn, "A003 LOGOUT\r\n")
	return EmailProbe{OK: true, Detail: "login succeeded"}
}

func readIMAPTagged(r *bufio.Reader, tag string) (string, error) {
	for {
		line, err := r.ReadString('\n')
		if err != nil {
			return "", err
		}
		if strings.HasPrefix(line, tag+" ") {
			return line, nil
		}
	}
}

func imapQuote(s string) string {
	escaped := strings.ReplaceAll(strings.ReplaceAll(s, `\`, `\\`), `"`, `\"`)
	return `"` + escaped + `"`
}

func parsePort(raw string, fallback int) int {
	v := strings.TrimSpace(raw)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil || n <= 0 || n > 65535 {
		return fallback
	}
	return n
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if s := strings.TrimSpace(v); s != "" {
			return s
		}
	}
	return ""
}
