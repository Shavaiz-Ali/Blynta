The adjacent certificate and private key are public, disposable **test fixtures**
for a loopback-only HTTPS server. They authenticate no external service and must
never be used in production. Tests trust this certificate on their own agent;
they do not disable TLS verification or change global certificate settings.
