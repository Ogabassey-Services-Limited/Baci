# Baci - AI E-commerce Builder

**"Your business, live in 3 minutes"**

Baci is an AI-native platform that allows merchants to create complete e-commerce stores in under 3 minutes. It leverages Google Gemini for logo analysis, color extraction, and product description generation.

## 📚 Documentation

### Core Resources
- **[Project Blueprint](project_brief.md)**: The master plan, product vision, and detailed requirements.
- **[Architecture Diagrams](docs/architecture/ARCHITECTURE_DIAGRAMS.md)**: Visual flows of the system.
- **[API Documentation](docs/api/README.md)**: Auto-generated API reference for the codebase.

### Developer Guides
- **[Testing Guide](docs/guides/TESTING_GUIDE.md)**: How to run and write tests.
- **[Migration Guide](docs/guides/MIGRATION_TESTING_GUIDE.md)**: Database and AI migration steps.
- **[Domain Setup](docs/guides/DOMAIN_SETUP.md)**: Configuring custom domains.

### AI System
- **[AI Context](docs/ai/AI_CONTEXT.md)**: Deep dive into the AI flows.
- **[Google AI Setup](docs/ai/GOOGLE_AI_SETUP.md)**: Configuring Gemini.
- **[Background Jobs](docs/ai/BACKGROUND_AI_JOBS.md)**: Worker architecture.

### Reports & Audits
- **[Security Audit 2025](docs/reports/SECURITY_AUDIT_2025.md)**
- **[Scalability Review](docs/reports/SCALABILITY_REVIEW.md)**

## 🚀 Getting Started

### Prerequisites
- Node.js 24.x
- pnpm 11.x
- Supabase CLI (for local backend)

### Installation

Run these commands from the repository root.

```bash
# Install dependencies
pnpm install

# Setup environment variables
# Create or update apps/web/.env.local with your Supabase and Google AI keys.
# See apps/web/docs/ai/GOOGLE_AI_SETUP.md and apps/web/docs/ai/AI_WORKER_ENV.md.
```

### Development

Run this command from the repository root.

```bash
# Run the development server
pnpm turbo dev

# Run the AI Worker (if needed for background tasks)
# See apps/web/docs/ai/AI_WORKER_ENV.md
```

### Generating Documentation

We use **TypeDoc** to generate "dynamic" API documentation from the source code.

```bash
# Generate/Update API docs in docs/api/
pnpm --filter @baci/web docs
```

## 🛠️ Tech Stack

- **Frontend**: Next.js 16.2.9 (App Router), Tailwind CSS, shadcn/ui
- **Backend**: Supabase (Auth, Postgres, Storage)
- **AI**: Google Genkit + Gemini 2.0 Flash/Vision
- **Language**: TypeScript
