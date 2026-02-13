# Setup Guide

**Last Updated:** February 13, 2026

This guide walks you through setting up the JCN Financial Dashboard development environment.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 20.x or later
- **pnpm** 10.x or later (recommended) or npm
- **Git** 2.x or later
- **Python** 3.11+ (for data pipeline development)

## Local Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/alexbernal0/JCN_Vercel_Dashboard.git
cd JCN_Vercel_Dashboard
```

### 2. Install Dependencies

```bash
pnpm install
```

This will install all required npm packages including:
- Next.js 16
- React 19
- TypeScript 5.9
- Tailwind CSS 4
- ESLint

### 3. Environment Variables

Create a `.env.local` file in the project root:

```bash
cp .env.local.example .env.local
```

Add the following environment variables:

```env
# MotherDuck Configuration
MOTHERDUCK_TOKEN=your_motherduck_token_here

# Revalidation Secret (generate a random string)
REVALIDATE_SECRET=your_random_secret_here

# GitHub Token (for data pipeline)
GITHUB_TOKEN=your_github_token_here

# Vercel Configuration (optional for local development)
VERCEL_TOKEN=your_vercel_token_here
```

### 4. Run Development Server

```bash
pnpm dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## Project Structure

Understanding the project structure will help you navigate the codebase:

```
jcn-vercel-dashboard/
├── app/                    # Next.js App Router
│   ├── (dashboard)/        # Dashboard route group
│   │   ├── layout.tsx      # Shared dashboard layout
│   │   ├── page.tsx        # Homepage
│   │   └── portfolio/      # Portfolio routes
│   ├── api/                # API routes
│   │   └── revalidate/     # On-demand revalidation
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Root page
├── components/             # Reusable components
│   ├── ui/                 # Basic UI components
│   ├── charts/             # Chart components
│   ├── portfolio/          # Portfolio components
│   └── layout/             # Layout components
├── lib/                    # Utilities and shared logic
│   ├── data/               # Data fetching functions
│   └── utils/              # Helper functions
├── data/                   # Static JSON data
│   ├── portfolios/         # Portfolio data files
│   ├── market/             # Market data files
│   └── metadata.json       # Data refresh metadata
├── types/                  # TypeScript type definitions
├── docs/                   # Documentation
├── scripts/                # Build and data scripts
│   └── generate-data.py    # MotherDuck data fetch script
└── .github/workflows/      # GitHub Actions
    └── data-refresh.yml    # Hourly data refresh workflow
```

## Development Workflow

### Creating a New Page

1. Create a new folder in `app/(dashboard)/`:

```bash
mkdir -p app/(dashboard)/new-page
```

2. Create a `page.tsx` file:

```typescript
// app/(dashboard)/new-page/page.tsx
export const revalidate = 3600; // Revalidate every hour

export default function NewPage() {
  return (
    <div>
      <h1>New Page</h1>
    </div>
  );
}
```

3. The page will be automatically available at `/new-page`.

### Creating a New Component

1. Create a new file in the appropriate `components/` subdirectory:

```typescript
// components/ui/Button.tsx
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
}

export function Button({ children, onClick }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
    >
      {children}
    </button>
  );
}
```

2. Import and use in your pages:

```typescript
import { Button } from '@/components/ui/Button';
```

### Adding Static Data

1. Create a JSON file in the `data/` directory:

```json
// data/portfolios/example.json
{
  "id": "example",
  "name": "Example Portfolio",
  "performance": {
    "ytd": 12.5,
    "oneYear": 18.3,
    "threeYear": 45.2
  },
  "updated_at": "2026-02-13T10:00:00Z"
}
```

2. Import in your page:

```typescript
// app/(dashboard)/portfolio/[id]/page.tsx
export default async function PortfolioPage({ params }: { params: { id: string } }) {
  const data = await import(`@/data/portfolios/${params.id}.json`);
  return <div>{JSON.stringify(data.default)}</div>;
}
```

## Building for Production

### Local Production Build

```bash
pnpm build
pnpm start
```

This will:
1. Generate all static pages
2. Optimize assets
3. Start a production server on port 3000

### Testing ISR Locally

To test Incremental Static Regeneration locally:

1. Build the project:
```bash
pnpm build
```

2. Start the production server:
```bash
pnpm start
```

3. Visit a page and note the timestamp
4. Update the corresponding JSON file in `data/`
5. Wait for the revalidation period (1 hour) or trigger manually
6. Refresh the page to see the updated content

## Python Data Pipeline Setup

### Install Python Dependencies

```bash
cd scripts
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install duckdb python-dotenv
```

### Run Data Generation Script

```bash
python scripts/generate-data.py
```

This will:
1. Connect to MotherDuck
2. Query portfolio and market data
3. Generate JSON files in the `data/` directory
4. Update `data/metadata.json` with timestamp

## Deployment

### Vercel Deployment

1. Install Vercel CLI:
```bash
pnpm install -g vercel
```

2. Link project to Vercel:
```bash
vercel link
```

3. Deploy to production:
```bash
vercel --prod
```

### Environment Variables on Vercel

Set environment variables in the Vercel dashboard:

1. Go to Project Settings → Environment Variables
2. Add all variables from `.env.local`
3. Redeploy for changes to take effect

## Troubleshooting

### Port Already in Use

If port 3000 is already in use:

```bash
pnpm dev -- -p 3001
```

### Build Errors

Clear Next.js cache:

```bash
rm -rf .next
pnpm build
```

### Type Errors

Regenerate TypeScript types:

```bash
pnpm tsc --noEmit
```

### Data Not Updating

Check ISR configuration in `next.config.ts` and page-level `revalidate` settings.

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)

## Getting Help

For questions or issues:

1. Check the [documentation](docs/)
2. Review [CHANGELOG.md](docs/CHANGELOG.md)
3. Contact the development team

---

**Happy coding! 🚀**
