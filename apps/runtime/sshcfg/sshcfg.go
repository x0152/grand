package sshcfg

import "encoding/json"

const ContainerHostPrefix = "mantis-sb-"

const SandboxUser = "mantis"

func HostFor(name, ip string) string {
	if ip != "" {
		return ip
	}
	return ContainerHostPrefix + name
}

func Build(name, ip, privateKey string) ([]byte, error) {
	return json.Marshal(map[string]any{
		"host":       HostFor(name, ip),
		"port":       22,
		"username":   SandboxUser,
		"privateKey": privateKey,
	})
}
