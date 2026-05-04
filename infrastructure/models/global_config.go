package models

import (
	"encoding/json"

	"github.com/uptrace/bun"
)

type GlobalConfigRow struct {
	bun.BaseModel `bun:"table:app_config"`
	ID            string          `bun:"id,pk"`
	Data          json.RawMessage `bun:"data,type:jsonb"`
}
