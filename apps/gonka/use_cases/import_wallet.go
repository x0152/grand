package usecases

import (
	"context"
	"fmt"
	"strings"

	"mantis/apps/gonka/inferenced"
	"mantis/core/base"
)

type ImportWallet struct {
	runner *inferenced.Runner
}

func NewImportWallet(runner *inferenced.Runner) *ImportWallet {
	return &ImportWallet{runner: runner}
}

func (uc *ImportWallet) Execute(ctx context.Context, mnemonic string) (inferenced.Wallet, error) {
	phrase, err := normalizeMnemonic(mnemonic)
	if err != nil {
		return inferenced.Wallet{}, err
	}
	wallet, err := uc.runner.ImportWallet(ctx, phrase)
	if err != nil {
		return inferenced.Wallet{}, fmt.Errorf("%w: %s", base.ErrValidation, err.Error())
	}
	return wallet, nil
}

func normalizeMnemonic(raw string) (string, error) {
	trimmed := strings.ToLower(strings.TrimSpace(raw))
	if trimmed == "" {
		return "", fmt.Errorf("%w: recovery phrase is required", base.ErrValidation)
	}
	for _, r := range trimmed {
		if r == ' ' || r == '\n' || r == '\r' || r == '\t' {
			continue
		}
		if r < 'a' || r > 'z' {
			return "", fmt.Errorf("%w: recovery phrase must contain only lowercase words separated by spaces", base.ErrValidation)
		}
	}
	words := strings.Fields(trimmed)
	switch len(words) {
	case 12, 15, 18, 21, 24:
	default:
		return "", fmt.Errorf("%w: recovery phrase must be 12, 15, 18, 21, or 24 words (got %d)", base.ErrValidation, len(words))
	}
	return strings.Join(words, " "), nil
}
