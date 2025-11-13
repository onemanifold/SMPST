# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are currently being supported with security updates:

| Version | Supported          | Status |
| ------- | ------------------ | ------ |
| 1.0.x   | :white_check_mark: | Stable (when released) |
| 0.3.x-beta | :white_check_mark: | Beta testing |
| 0.2.x-beta | :white_check_mark: | Active development |
| < 0.2.0 | :x:                | Pre-release, unsupported |

**Note:** Pre-release versions (alpha/beta) receive best-effort security updates but are not recommended for production use.

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please follow responsible disclosure:

### Do NOT

- ❌ **Open a public GitHub issue** for security vulnerabilities
- ❌ **Discuss vulnerabilities publicly** before a fix is available
- ❌ **Exploit vulnerabilities** beyond proof-of-concept testing

### Do

✅ **Report privately** via one of these methods:

1. **GitHub Security Advisories** (Preferred)
   - Go to the [Security tab](https://github.com/onemanifold/SMPST/security/advisories)
   - Click "Report a vulnerability"
   - Fill out the form with details

2. **Email** (Alternative)
   - Send details to the maintainers (check GitHub profile)
   - Use subject line: `[SECURITY] Brief description`
   - Include steps to reproduce

### What to Include

A good security report includes:

- **Description**: What is the vulnerability?
- **Impact**: What can an attacker do?
- **Steps to reproduce**: How to trigger the issue?
- **Affected versions**: Which versions are vulnerable?
- **Suggested fix**: (Optional) How to fix it?
- **Credit**: How you'd like to be credited (or anonymous)

### Example Report

```
Title: XSS vulnerability in protocol editor

Description:
The Scribble protocol editor does not properly sanitize user input,
allowing injection of malicious JavaScript through protocol names.

Impact:
An attacker could craft a malicious protocol file that, when loaded,
executes arbitrary JavaScript in the user's browser.

Steps to Reproduce:
1. Create a protocol with name: <script>alert('XSS')</script>
2. Save the protocol
3. Reload the page
4. The alert fires

Affected Versions:
0.2.0-beta and later

Suggested Fix:
Sanitize protocol names in src/lib/stores/editor.ts before rendering

Credit:
John Doe (john@example.com)
```

## Response Timeline

We aim to respond to security reports with the following timeline:

- **24 hours**: Initial acknowledgment
- **7 days**: Assessment and severity classification
- **30 days**: Patch development and testing
- **Release**: Coordinated disclosure with reporter

### Severity Classification

We use CVSS (Common Vulnerability Scoring System) to assess severity:

| Severity | CVSS Score | Response Time | Priority |
|----------|------------|---------------|----------|
| **Critical** | 9.0-10.0 | 24-48 hours | P0 |
| **High** | 7.0-8.9 | 7 days | P1 |
| **Medium** | 4.0-6.9 | 30 days | P2 |
| **Low** | 0.1-3.9 | Best effort | P3 |

## Security Measures

### Web Application

The web version (GitHub Pages) implements:

- ✅ **Content Security Policy**: Restricts script execution
- ✅ **Input Sanitization**: All user input is sanitized
- ✅ **No Server-Side**: Static site, no server vulnerabilities
- ✅ **HTTPS Only**: Encrypted communication
- ✅ **Dependency Scanning**: Automated with Dependabot

### Desktop Application

The desktop version (Tauri) implements:

- ✅ **Sandboxed WebView**: Isolated from system
- ✅ **Explicit API Exposure**: Only whitelisted Rust functions accessible
- ✅ **File System Restrictions**: Limited to user's documents
- ✅ **Code Signing**: Verified publisher identity
- ✅ **Automatic Updates**: (Planned) Secure update mechanism

### Development

- ✅ **Dependency Audits**: `npm audit` in CI/CD
- ✅ **TypeScript Strict Mode**: Type safety
- ✅ **Code Review**: All PRs reviewed before merge
- ✅ **Automated Testing**: 100% test coverage for critical paths

## Known Limitations

As a protocol specification tool, Scribble MPST IDE:

- ⚠️ **Does not validate code security**: Generated TypeScript is not automatically secure
- ⚠️ **Trust user input**: Protocols are assumed to come from trusted sources
- ⚠️ **No authentication**: Web version has no user accounts (by design)
- ⚠️ **Local storage**: Protocols stored in browser are not encrypted

**Recommendation:** Use desktop version for sensitive protocols, or clear browser data after use.

## Dependencies

We monitor dependencies for vulnerabilities:

### Automated Scanning

- **Dependabot**: Weekly scans, automatic PR for updates
- **npm audit**: Runs in CI/CD pipeline
- **GitHub Security Advisories**: Notifications enabled

### Manual Review

- **Major updates**: Reviewed before adoption
- **Security updates**: Applied within 7 days
- **Breaking changes**: Evaluated for security impact

## Disclosure Policy

When a vulnerability is fixed:

1. **Patch Released**: New version published
2. **Security Advisory**: GitHub advisory created
3. **Credit Given**: Reporter credited (if desired)
4. **Notification**: Users notified via GitHub Releases
5. **CVE Assigned**: (If applicable) CVE ID requested

### Public Disclosure

- **Timeline**: 90 days after patch release (or sooner with reporter's consent)
- **Details**: Full technical writeup published
- **Remediation**: Fix guidance for users

## Bug Bounty

**Status:** Not currently offering bug bounties

We're a research/educational project and don't have budget for bounties. However, we deeply appreciate security researchers and will:

- ✅ Credit you in security advisories
- ✅ Acknowledge your contribution in release notes
- ✅ List you in CONTRIBUTORS.md (if you wish)

## Security Best Practices for Users

### Web Version

- ✅ Use HTTPS only (enforced)
- ✅ Don't paste untrusted protocol code
- ✅ Clear browser data after working with sensitive protocols
- ✅ Keep browser updated

### Desktop Version

- ✅ Download only from official GitHub Releases
- ✅ Verify code signatures (when implemented)
- ✅ Keep application updated
- ✅ Review file permissions

### Generated Code

- ⚠️ **Review generated TypeScript** before deploying
- ⚠️ **Add security measures** (authentication, rate limiting, etc.)
- ⚠️ **Test thoroughly** for your specific use case
- ⚠️ **Don't trust user input** in deployed applications

## Questions?

- **General security questions**: Open a [Discussion](https://github.com/onemanifold/SMPST/discussions)
- **Report a vulnerability**: Use [Security Advisories](https://github.com/onemanifold/SMPST/security/advisories)
- **Check status**: See [Security tab](https://github.com/onemanifold/SMPST/security)

---

**Last Updated:** 2025-11-12
**Policy Version:** 1.0

Thank you for helping keep Scribble MPST IDE secure! 🔒
