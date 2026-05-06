package sandboxes

import "embed"

//go:embed base browser ffmpeg netsec runtimectl sandbox-base
var FS embed.FS
