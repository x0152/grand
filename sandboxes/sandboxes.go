package sandboxes

import "embed"

//go:embed base browser email ffmpeg netsec runtimectl sandbox-base
var FS embed.FS
