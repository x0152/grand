package usecases

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"mantis/core/base"
	"mantis/core/protocols"
	"mantis/core/types"
)

const (
	chatChannelID                  = "chat"
	telegramChannelName            = "Telegram"
	telegramChannelType            = "telegram"
	defaultPresetNamePrefix        = "Main profile"
	defaultPresetFallbackName      = "Default"
	defaultModelContextWindow      = 128000
	defaultModelReserveTokens      = 20000
	connectionsWaitTimeout         = 15 * time.Second
	connectionsWaitTickInterval    = 500 * time.Millisecond
)

var legacyEmailSkillNames = map[string]struct{}{
	"email_status": {},
	"email_list":   {},
	"email_search": {},
	"email_read":   {},
	"email_send":   {},
}

type ApplyConfig struct {
	store         protocols.Store[string, types.AppConfig]
	resolver      *Resolver
	llmConnStore  protocols.Store[string, types.LlmConnection]
	modelStore    protocols.Store[string, types.Model]
	presetStore   protocols.Store[string, types.Preset]
	settingsStore protocols.Store[string, types.Settings]
	channelStore  protocols.Store[string, types.Channel]
	connStore     protocols.Store[string, types.Connection]
	skillStore    protocols.Store[string, types.Skill]
	planStore     protocols.Store[string, types.Plan]
	onApply       func(context.Context, types.GlobalConfigDraft)
}

type ApplyDeps struct {
	LlmConnStore  protocols.Store[string, types.LlmConnection]
	ModelStore    protocols.Store[string, types.Model]
	PresetStore   protocols.Store[string, types.Preset]
	SettingsStore protocols.Store[string, types.Settings]
	ChannelStore  protocols.Store[string, types.Channel]
	ConnStore     protocols.Store[string, types.Connection]
	SkillStore    protocols.Store[string, types.Skill]
	PlanStore     protocols.Store[string, types.Plan]
}

func NewApplyConfig(store protocols.Store[string, types.AppConfig], resolver *Resolver, deps ApplyDeps) *ApplyConfig {
	return &ApplyConfig{
		store:         store,
		resolver:      resolver,
		llmConnStore:  deps.LlmConnStore,
		modelStore:    deps.ModelStore,
		presetStore:   deps.PresetStore,
		settingsStore: deps.SettingsStore,
		channelStore:  deps.ChannelStore,
		connStore:     deps.ConnStore,
		skillStore:    deps.SkillStore,
		planStore:     deps.PlanStore,
	}
}

func (uc *ApplyConfig) SetOnApply(f func(context.Context, types.GlobalConfigDraft)) {
	uc.onApply = f
}

func (uc *ApplyConfig) Execute(ctx context.Context) error {
	draft, err := loadDraft(ctx, uc.store)
	if err != nil {
		return err
	}
	values := uc.resolver.ResolveValues(draft)
	if err := validateApply(values); err != nil {
		return err
	}

	provider := strings.TrimSpace(values.Provider)
	baseURL, apiKey := providerCredentials(provider, values)

	connID, err := uc.applyLLMConnection(ctx, provider, baseURL, apiKey)
	if err != nil {
		return err
	}

	modelIDs, err := uc.applyModels(ctx, connID, values.Models)
	if err != nil {
		return err
	}

	preset, err := uc.applyPreset(ctx, connID, values.Models, modelIDs)
	if err != nil {
		return err
	}

	if err := uc.applySettings(ctx, preset.ID); err != nil {
		return err
	}

	if err := uc.applyChannels(ctx, values.Telegram); err != nil {
		return err
	}

	if err := uc.applySeeds(ctx); err != nil {
		return err
	}

	if uc.onApply != nil {
		uc.onApply(ctx, values)
	}

	return nil
}

func validateApply(values types.GlobalConfigDraft) error {
	provider := strings.TrimSpace(values.Provider)
	if provider != "openai" && provider != "gonka" {
		return fmt.Errorf("%w: provider must be openai or gonka", base.ErrValidation)
	}
	baseURL, apiKey := providerCredentials(provider, values)
	if baseURL == "" {
		return fmt.Errorf("%w: provider endpoint is required", base.ErrValidation)
	}
	if apiKey == "" {
		return fmt.Errorf("%w: provider credentials are required", base.ErrValidation)
	}
	if !hasChatModel(values.Models) {
		return fmt.Errorf("%w: pick at least one chat model", base.ErrValidation)
	}
	return nil
}

func providerCredentials(provider string, v types.GlobalConfigDraft) (string, string) {
	if provider == "gonka" {
		return strings.TrimSpace(v.Gonka.NodeURL), strings.TrimSpace(v.Gonka.PrivateKey)
	}
	return strings.TrimSpace(v.OpenAI.BaseURL), strings.TrimSpace(v.OpenAI.APIKey)
}

func hasChatModel(rows []types.ConfigModelRow) bool {
	for _, row := range rows {
		if row.Role == "chat" && strings.TrimSpace(row.Name) != "" {
			return true
		}
	}
	return false
}

func (uc *ApplyConfig) applyLLMConnection(ctx context.Context, provider, baseURL, apiKey string) (string, error) {
	existing, err := uc.llmConnStore.List(ctx, types.ListQuery{})
	if err != nil {
		return "", err
	}
	normalized := normalizeBaseURL(baseURL)
	ids := make(map[string]struct{}, len(existing))
	for _, c := range existing {
		ids[c.ID] = struct{}{}
		if normalizeBaseURL(c.BaseURL) == normalized {
			c.Provider = provider
			c.BaseURL = strings.TrimSpace(baseURL)
			c.APIKey = apiKey
			result, err := uc.llmConnStore.Update(ctx, []types.LlmConnection{c})
			if err != nil {
				return "", err
			}
			return result[0].ID, nil
		}
	}
	id := makeUniqueID(suggestEndpointID(baseURL, provider), ids)
	created, err := uc.llmConnStore.Create(ctx, []types.LlmConnection{{
		ID:       id,
		Provider: provider,
		BaseURL:  strings.TrimSpace(baseURL),
		APIKey:   apiKey,
	}})
	if err != nil {
		return "", err
	}
	return created[0].ID, nil
}

func (uc *ApplyConfig) applyModels(ctx context.Context, connID string, rows []types.ConfigModelRow) (map[string]string, error) {
	all, err := uc.modelStore.List(ctx, types.ListQuery{})
	if err != nil {
		return nil, err
	}
	byName := map[string]types.Model{}
	for _, m := range all {
		if m.ConnectionID == connID {
			byName[m.Name] = m
		}
	}
	out := map[string]string{}
	for _, row := range rows {
		name := strings.TrimSpace(row.Name)
		if name == "" {
			continue
		}
		if existing, ok := byName[name]; ok {
			out[name] = existing.ID
			continue
		}
		created, err := uc.modelStore.Create(ctx, []types.Model{{
			ID:            uuid.New().String(),
			ConnectionID:  connID,
			Name:          name,
			ContextWindow: defaultModelContextWindow,
			ReserveTokens: defaultModelReserveTokens,
			CompactTokens: defaultModelContextWindow - defaultModelReserveTokens,
		}})
		if err != nil {
			return nil, err
		}
		out[name] = created[0].ID
	}
	return out, nil
}

func (uc *ApplyConfig) applyPreset(ctx context.Context, connID string, rows []types.ConfigModelRow, modelIDs map[string]string) (types.Preset, error) {
	chatID, summaryID, imageID := pickModelIDs(rows, modelIDs)
	if chatID == "" {
		return types.Preset{}, fmt.Errorf("%w: chat model is required", base.ErrValidation)
	}
	name := fmt.Sprintf("%s (%s)", defaultPresetNamePrefix, connID)
	all, err := uc.presetStore.List(ctx, types.ListQuery{})
	if err != nil {
		return types.Preset{}, err
	}
	var match *types.Preset
	for i := range all {
		if all[i].Name == name {
			match = &all[i]
			break
		}
	}
	if match == nil {
		for i := range all {
			if all[i].Name == defaultPresetFallbackName {
				match = &all[i]
				break
			}
		}
	}
	preset := types.Preset{
		Name:           name,
		ChatModelID:    chatID,
		SummaryModelID: summaryID,
		ImageModelID:   imageID,
	}
	if match != nil {
		preset.ID = match.ID
		result, err := uc.presetStore.Update(ctx, []types.Preset{preset})
		if err != nil {
			return types.Preset{}, err
		}
		return result[0], nil
	}
	preset.ID = uuid.New().String()
	result, err := uc.presetStore.Create(ctx, []types.Preset{preset})
	if err != nil {
		return types.Preset{}, err
	}
	return result[0], nil
}

func pickModelIDs(rows []types.ConfigModelRow, ids map[string]string) (chat, summary, image string) {
	for _, row := range rows {
		name := strings.TrimSpace(row.Name)
		if name == "" {
			continue
		}
		switch row.Role {
		case "chat":
			chat = ids[name]
		case "summary":
			summary = ids[name]
		case "vision":
			image = ids[name]
		}
	}
	return
}

func (uc *ApplyConfig) applySettings(ctx context.Context, presetID string) error {
	settings := types.Settings{
		ID:             "default",
		ChatPresetID:   presetID,
		ServerPresetID: presetID,
		MemoryEnabled:  true,
		UserMemories:   []string{},
	}
	existing, err := uc.settingsStore.Get(ctx, []string{settings.ID})
	if err != nil {
		return err
	}
	if _, ok := existing[settings.ID]; ok {
		_, err := uc.settingsStore.Update(ctx, []types.Settings{settings})
		return err
	}
	_, err = uc.settingsStore.Create(ctx, []types.Settings{settings})
	return err
}

func (uc *ApplyConfig) applyChannels(ctx context.Context, tg types.TelegramDraft) error {
	if err := uc.applyChatChannel(ctx); err != nil {
		return err
	}
	return uc.applyTelegramChannel(ctx, tg)
}

func (uc *ApplyConfig) applyChatChannel(ctx context.Context) error {
	existing, err := uc.channelStore.Get(ctx, []string{chatChannelID})
	if err != nil {
		return err
	}
	if c, ok := existing[chatChannelID]; ok {
		if c.Name != "" && c.Token == "" && len(c.AllowedUserIDs) == 0 {
			return nil
		}
		c.Name = "Chat"
		c.Token = ""
		c.AllowedUserIDs = []int64{}
		_, err := uc.channelStore.Update(ctx, []types.Channel{c})
		return err
	}
	_, err = uc.channelStore.Create(ctx, []types.Channel{{
		ID:             chatChannelID,
		Type:           "chat",
		Name:           "Chat",
		AllowedUserIDs: []int64{},
	}})
	return err
}

func (uc *ApplyConfig) applyTelegramChannel(ctx context.Context, tg types.TelegramDraft) error {
	token := strings.TrimSpace(tg.Token)
	if token == "" || tg.Skipped {
		return nil
	}
	allowed := dedupeIDs(tg.AllowedUserIDs)
	all, err := uc.channelStore.List(ctx, types.ListQuery{})
	if err != nil {
		return err
	}
	for _, c := range all {
		if c.Type == telegramChannelType {
			c.Name = telegramChannelName
			c.Token = token
			c.AllowedUserIDs = allowed
			_, err := uc.channelStore.Update(ctx, []types.Channel{c})
			return err
		}
	}
	_, err = uc.channelStore.Create(ctx, []types.Channel{{
		ID:             uuid.New().String(),
		Type:           telegramChannelType,
		Name:           telegramChannelName,
		Token:          token,
		AllowedUserIDs: allowed,
	}})
	return err
}

func dedupeIDs(in []int64) []int64 {
	seen := map[int64]struct{}{}
	out := make([]int64, 0, len(in))
	for _, id := range in {
		if id == 0 {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out
}

func (uc *ApplyConfig) applySeeds(ctx context.Context) error {
	skills := seedSkills()
	wanted := make([]string, 0, len(skills))
	for name := range skills {
		wanted = append(wanted, name)
	}
	connsByName := uc.waitForConnections(ctx, wanted)
	for connName, list := range skills {
		conn, ok := connsByName[connName]
		if !ok {
			continue
		}
		if err := uc.seedSkillsFor(ctx, conn.ID, list); err != nil {
			return err
		}
	}
	if conn, ok := connsByName["email"]; ok {
		if err := uc.removeLegacyEmailSkills(ctx, conn.ID); err != nil {
			return err
		}
	}
	return uc.seedPlans(ctx)
}

func (uc *ApplyConfig) waitForConnections(ctx context.Context, names []string) map[string]types.Connection {
	deadline := time.Now().Add(connectionsWaitTimeout)
	for {
		current, err := uc.connStore.List(ctx, types.ListQuery{})
		if err != nil {
			return map[string]types.Connection{}
		}
		byName := map[string]types.Connection{}
		for _, c := range current {
			byName[c.Name] = c
		}
		complete := true
		for _, n := range names {
			if _, ok := byName[n]; !ok {
				complete = false
				break
			}
		}
		if complete || time.Now().After(deadline) {
			return byName
		}
		select {
		case <-ctx.Done():
			return byName
		case <-time.After(connectionsWaitTickInterval):
		}
	}
}

func (uc *ApplyConfig) seedSkillsFor(ctx context.Context, connID string, list []seedSkill) error {
	existing, err := uc.skillStore.List(ctx, types.ListQuery{Filter: map[string]string{"connection_id": connID}})
	if err != nil {
		return err
	}
	have := map[string]struct{}{}
	for _, s := range existing {
		have[s.Name] = struct{}{}
	}
	for _, sk := range list {
		if _, ok := have[sk.Name]; ok {
			continue
		}
		_, err := uc.skillStore.Create(ctx, []types.Skill{{
			ID:           uuid.New().String(),
			ConnectionID: connID,
			Name:         sk.Name,
			Description:  sk.Description,
			Parameters:   sk.Parameters,
			Script:       sk.Script,
		}})
		if err != nil {
			return err
		}
	}
	return nil
}

func (uc *ApplyConfig) removeLegacyEmailSkills(ctx context.Context, connID string) error {
	existing, err := uc.skillStore.List(ctx, types.ListQuery{Filter: map[string]string{"connection_id": connID}})
	if err != nil {
		return err
	}
	ids := make([]string, 0, len(existing))
	for _, sk := range existing {
		if _, ok := legacyEmailSkillNames[sk.Name]; ok {
			ids = append(ids, sk.ID)
		}
	}
	if len(ids) == 0 {
		return nil
	}
	return uc.skillStore.Delete(ctx, ids)
}

func (uc *ApplyConfig) seedPlans(ctx context.Context) error {
	existing, err := uc.planStore.List(ctx, types.ListQuery{})
	if err != nil {
		return err
	}
	have := map[string]struct{}{}
	for _, p := range existing {
		have[p.Name] = struct{}{}
	}
	for _, p := range seedPlans() {
		if _, ok := have[p.Name]; ok {
			continue
		}
		p.ID = uuid.New().String()
		if _, err := uc.planStore.Create(ctx, []types.Plan{p}); err != nil {
			return err
		}
	}
	return nil
}
