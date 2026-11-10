# mylocalon

Expose a local app on a public HTTPS URL.

```bash
npm install -g mylocalon
mylocalon login          # opens your browser — sign up / approve
mylocalon http 3000      # → https://abc123xy.mylocalon.com
```

Requires Node.js 20 or newer.

## Commands

| Command | What it does |
|---|---|
| `mylocalon login` | Sign in through the browser; saves an API key to `~/.mylocalon` |
| `mylocalon http <port>` | Share `http://localhost:<port>` publicly |
| `mylocalon http <port> --subdomain myapp` | Use a subdomain you reserved at https://mylocalon.com/dashboard/subdomains |
| `mylocalon http https://localhost:8443` | Share an HTTPS dev server |
| `mylocalon status` / `logout` | Show or clear saved credentials |

Press `Ctrl+C` to stop sharing. Manage API keys and see your tunnels at https://mylocalon.com.
