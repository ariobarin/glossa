# @ariobarin/glossa

This package publishes the `glossa` executable.

```bash
npm install --global @ariobarin/glossa
glossa login
glossa status
glossa whoami
glossa logout
```

Login uses Auth0 Device Authorization Flow and opens the complete verification URL when Auth0 provides one. Refresh credentials use the operating-system credential store. If that store is unavailable, Glossa prints a warning before using its mode-0600 credential-file fallback.
