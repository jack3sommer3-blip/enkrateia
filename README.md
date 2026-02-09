Enkrateia is a Next.js app for daily self-mastery tracking with Supabase auth and history.

## Getting Started

1) Install dependencies:

```bash
npm install
```

2) Create a Supabase project and apply the schema in `supabase/schema.sql`.

3) Add environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

4) Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Supabase Notes

- Enable Email + Password and Google providers in Supabase Auth.
- Turn on email confirmation (Auth settings).
- Set the Site URL and redirect URLs to match your deployed domain (and `http://localhost:3000` for dev).
