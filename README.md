# Roger Barahona — AI Career Agent

Recruiter-facing career portfolio and AI assistant for Roger Barahona.

This project presents Roger's verified professional background in Product Ownership, Product Management, QSR/POS technology, enterprise SaaS, omnichannel delivery, Agile delivery, and international/LATAM implementations.

## Site structure
- `index.html` — recruiter-facing portfolio and Ask Roger interface
- `style.css` — responsive visual design
- `script.js` — chat experience
- `api/chat.js` — server-side AI endpoint
- `data/profile.json` — approved professional knowledge base

## Deployment
Designed for deployment on Vercel. Configure `OPENAI_API_KEY` as a protected environment variable. Never commit API keys to GitHub.

## AI guardrail
The agent is instructed to answer only from Roger's approved professional information. When the knowledge base does not support an answer, it should say so instead of inventing experience.

- GitHub: https://github.com/RogerBarahona
- LinkedIn: https://www.linkedin.com/in/rogerbarahona/
