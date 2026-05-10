package types

type ConfigSource string

const (
	ConfigSourceUnset   ConfigSource = "unset"
	ConfigSourceEnv     ConfigSource = "env"
	ConfigSourceDB      ConfigSource = "db"
	ConfigSourceDefault ConfigSource = "default"
)

type ConfigField struct {
	Value  string       `json:"value"`
	Source ConfigSource `json:"source"`
}

type ConfigSecret struct {
	Set    bool         `json:"set"`
	Value  string       `json:"value"`
	Source ConfigSource `json:"source"`
}

type ConfigModelRow struct {
	Name string `json:"name"`
	Role string `json:"role"`
}

type OpenAIConfig struct {
	BaseURL ConfigField  `json:"baseUrl"`
	APIKey  ConfigSecret `json:"apiKey"`
}

type GonkaConfig struct {
	NodeURL    ConfigField  `json:"nodeUrl"`
	PrivateKey ConfigSecret `json:"privateKey"`
}

type TelegramConfig struct {
	Token          ConfigSecret `json:"token"`
	AllowedUserIDs []int64      `json:"allowedUserIds"`
	Skipped        bool         `json:"skipped"`
	Source         ConfigSource `json:"source"`
}

type EmailConfig struct {
	Address      ConfigField  `json:"address"`
	SMTPHost     ConfigField  `json:"smtpHost"`
	SMTPPort     ConfigField  `json:"smtpPort"`
	SMTPUsername ConfigField  `json:"smtpUsername"`
	SMTPPassword ConfigSecret `json:"smtpPassword"`
	IMAPHost     ConfigField  `json:"imapHost"`
	IMAPPort     ConfigField  `json:"imapPort"`
	IMAPUsername ConfigField  `json:"imapUsername"`
	IMAPPassword ConfigSecret `json:"imapPassword"`
	Skipped      bool         `json:"skipped"`
	Source       ConfigSource `json:"source"`
}

type GlobalConfig struct {
	Provider ConfigField      `json:"provider"`
	OpenAI   OpenAIConfig     `json:"openai"`
	Gonka    GonkaConfig      `json:"gonka"`
	Models   []ConfigModelRow `json:"models"`
	Telegram TelegramConfig   `json:"telegram"`
	Email    EmailConfig      `json:"email"`
}

type OpenAIDraft struct {
	BaseURL string `json:"baseUrl"`
	APIKey  string `json:"apiKey"`
}

type GonkaDraft struct {
	NodeURL    string `json:"nodeUrl"`
	PrivateKey string `json:"privateKey"`
}

type TelegramDraft struct {
	Token          string  `json:"token"`
	AllowedUserIDs []int64 `json:"allowedUserIds"`
	Skipped        bool    `json:"skipped"`
}

type EmailDraft struct {
	Address      string `json:"address"`
	SMTPHost     string `json:"smtpHost"`
	SMTPPort     string `json:"smtpPort"`
	SMTPUsername string `json:"smtpUsername"`
	SMTPPassword string `json:"smtpPassword"`
	IMAPHost     string `json:"imapHost"`
	IMAPPort     string `json:"imapPort"`
	IMAPUsername string `json:"imapUsername"`
	IMAPPassword string `json:"imapPassword"`
	Skipped      bool   `json:"skipped"`
}

type GlobalConfigDraft struct {
	Provider string           `json:"provider"`
	OpenAI   OpenAIDraft      `json:"openai"`
	Gonka    GonkaDraft       `json:"gonka"`
	Models   []ConfigModelRow `json:"models"`
	Telegram TelegramDraft    `json:"telegram"`
	Email    EmailDraft       `json:"email"`
}

type AppConfig struct {
	ID    string            `json:"id"`
	Draft GlobalConfigDraft `json:"draft"`
}
