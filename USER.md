# Jarvis User Profile & Preferences (USER.md)

This file stores persistent user preferences and habits across sessions. Jarvis reads this to personalize behavior and remember your choices (e.g. Chrome profile, dev ports, notes). You or Jarvis can edit this anytime.

## Profile & Identity
- **Name**: Abdelfetah (S-fetah)
- **Preferred Chrome Profile**: Default
- **Default Email**: fettahsafi6@gmail.com
- **Preferred Email Mode**: browser_minimized

## Development Preferences
- **Preferred Dev Command**: npm run dev
- **Default Dev Port**: 5173
- **Preferred Language**: TypeScript

## Agent Interaction
- **Default Talking Style**: balanced
- **Default Task Mode**: chat
- **Default Thinking Depth**: standard

## Persistent Memory & Notes
- Keep all git commits strictly local on main branch (never git push).
- Always verify email delivery and maintain clean browser tab hygiene.
- NEVER automatically select or assume a Chrome profile without asking. Always ask which profile to use before launching Chrome or opening Gmail, unless explicitly specified in the user's message.
- Prefer verified direct delivery or closed-loop confirmation before assuming actions succeeded.
- Default email is fettahsafi6@gmail.com (Abdelfetah's profile).
- When Chrome is running without remote debugging enabled, proactively suggest closing Chrome, restarting it with --remote-debugging-port=9222, and executing Ctrl+Shift+T (reopen_tab) to seamlessly restore all closed tabs.
