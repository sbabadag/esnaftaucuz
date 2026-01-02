# esnaftaucuz - Price Sharing App

A community-driven price sharing application where users can share and discover product prices from local markets and stores.

## Features

- 🔍 Search and browse product prices
- 📍 Location-based price discovery
- 📸 Photo uploads for price verification
- ✅ Community verification system
- 🏆 User points and levels
- 🗺️ Map view of prices
- 📱 Mobile-friendly responsive design (iOS & Android)
- 🔐 Google OAuth authentication
- 👤 Guest user support

## Tech Stack

### Frontend
- React with TypeScript
- Vite
- React Router
- Tailwind CSS
- Radix UI components
- Motion (animations)
- Capacitor (iOS & Android)

### Backend & Database
- **Supabase** (PostgreSQL database, Authentication, Storage)
- Direct Supabase integration (no custom backend server needed)
- Row Level Security (RLS) for data protection

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn
- Supabase account (free tier available)

### Setup

1. **Clone the repository:**
```bash
git clone https://github.com/sbabadag/esnaftaucuz.git
cd esnaftaucuz
```

2. **Install dependencies:**
```bash
npm install
```

3. **Create a `.env` file:**
```env
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

4. **Set up Supabase:**
   - Create a new Supabase project
   - Run migrations from `supabase/migrations/` directory
   - Configure Google OAuth in Supabase Dashboard
   - Create a `price-photos` storage bucket

5. **Start the development server:**
```bash
npm run dev
```

### Mobile Development

1. **Build and sync:**
```bash
npm run mobile:build
```

2. **Open native project:**
```bash
npm run mobile:ios      # Opens Xcode (Mac only)
npm run mobile:android # Opens Android Studio
```

## Project Structure

```
esnaftaucuz/
├── app/                    # Frontend React app
│   ├── components/         # React components
│   ├── contexts/           # React contexts (Auth)
│   ├── services/           # Supabase API service layer
│   └── App.tsx            # Main app component
├── backend/                # Scripts and utilities
│   ├── scripts/           # Utility scripts (fetch-products)
│   └── lib/               # Shared libraries
├── supabase/              # Supabase migrations
│   └── migrations/        # SQL migration files
├── android/               # Android native project
├── ios/                   # iOS native project
│   ├── routes/            # API routes
│   ├── middleware/        # Express middleware
│   └── server.js         # Server entry point
└── styles/                # Global styles
```

## API Documentation

See [backend/README.md](./backend/README.md) for detailed API documentation.

## Features in Detail

### Authentication
- Google OAuth login (simplified for demo)
- Guest mode
- JWT token-based authentication

### Price Sharing
- Multi-step form for adding prices
- Product and location search/creation
- Photo upload support
- Automatic point rewards

### Discovery
- Trending products
- Nearby cheapest prices
- Recent price entries
- Advanced filtering

### Verification
- Community-driven price verification
- Report system for inaccurate prices
- Verified badge system

## Development

### Adding New Features

1. **Backend**: Add routes in `backend/routes/`
2. **Frontend**: Add API calls in `app/services/api.ts`
3. **Components**: Update or create components in `app/components/`

### Environment Variables

**Frontend (.env)**
- `VITE_API_URL` - Backend API URL

**Backend (.env)**
- `PORT` - Server port
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - JWT signing secret
- `JWT_EXPIRES_IN` - Token expiration time

**Note:** The backend is written in TypeScript. Use `npm run dev` for development (runs TypeScript directly) or `npm run build && npm start` for production.

## Production Deployment

1. Build the frontend:
```bash
npm run build
```

2. Set up MongoDB Atlas or managed database
3. Configure environment variables
4. Set up file storage (S3, Cloudinary, etc.)
5. Deploy backend to a Node.js hosting service
6. Deploy frontend to a static hosting service

## License

This project is created for educational purposes.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

