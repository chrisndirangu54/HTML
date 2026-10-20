# Isolated scanner worker — disabled reference skeleton

This Docker Compose baseline is deliberately **not** a functional scanner. It has no network access, root privileges, Linux capabilities, job credentials, Docker socket, or deployed PentAGI installation.

To test the sandbox configuration: `docker compose build && docker compose run --rm security-worker`.

Do not flip `SCAN_EXECUTION_ENABLED` to true: the worker refuses it. A future operational worker requires independently reviewed egress controls, target re-resolution, domain/IP scope verification, admin approval, auditing, timeouts, rate limits and worker authentication. For real scanner operation use an isolated worker network with **default deny** egress and explicit destination allowlisting; `network_mode: none` is not sufficient once outbound scanning is necessary.

## Integration adapter blueprint

- `nmap`: approved inventory discovery against narrowly authorized IPs only
- `nuclei`: low-impact templates, signed/pinned versions and explicit scan policy
- `trivy`: repository or image analysis from authenticated, approved sources
- `zap`: passive web scan before active testing approval
- `pentagi`: external service with strict MCP allowlist, non-destructive policies, and a manual approval gate; no autonomous shell on arbitrary customer URLs
- `defectdojo`: private authenticated ingestion after findings normalization

All results need tenant isolation, evidence integrity and permissioned retention. This scaffold must not be called 'deployed scanning infrastructure'.
