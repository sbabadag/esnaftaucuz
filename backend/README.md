# Mahallem Backend API

Backend API for the Mahallem price-sharing application built with Node.js, Express, and MongoDB.

## Features

- User authentication (Google OAuth & Guest login)
- Product management
- Price sharing with photo uploads
- Location management with geospatial queries
- Price verification system
- Search functionality
- User profiles with points and contributions

## Prerequisites

- Node.js (v18 or higher)
- MongoDB (local or MongoDB Atlas)
- npm or yarn

## Installation

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the backend directory:
```bash
cp .env.example .env
```

4. Update the `.env` file with your configuration:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/mahallem
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
NODE_ENV=development
```

## Running the Server

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm run build  # Compile TypeScript to JavaScript
npm start      # Run the compiled JavaScript
```

### Type Checking
```bash
npm run type-check
```

The server will start on `http://localhost:5000` (or the port specified in your `.env` file).

## API Endpoints

### Authentication
- `POST /api/auth/google` - Google OAuth login
- `POST /api/auth/guest` - Guest login
- `GET /api/auth/me` - Get current user (requires auth)

### Products
- `GET /api/products` - Get all products
- `GET /api/products/trending` - Get trending products
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create product

### Prices
- `GET /api/prices` - Get all prices (with filters)
- `GET /api/prices/product/:productId` - Get prices for a product
- `GET /api/prices/:id` - Get single price
- `POST /api/prices` - Create price (requires auth, supports photo upload)
- `POST /api/prices/:id/verify` - Verify a price (requires auth)
- `POST /api/prices/:id/report` - Report a price (requires auth)

### Locations
- `GET /api/locations` - Get all locations (supports geospatial queries)
- `GET /api/locations/:id` - Get single location
- `POST /api/locations` - Create location

### Users
- `GET /api/users/:id` - Get user profile
- `GET /api/users/:id/contributions` - Get user's contributions
- `PUT /api/users/:id` - Update user profile (requires auth)

### Search
- `GET /api/search?q=query&type=all` - Global search
- `GET /api/search/nearby-cheapest?lat=...&lng=...` - Get nearby cheapest prices

## Database Models

### User
- Authentication info
- Points and level system
- Contributions (shares, verifications)
- Location preferences

### Product
- Name and category
- Default unit
- Search count for trending

### Location
- Name, type, address
- Geospatial coordinates
- Verification status

### Price
- Product reference
- Price and unit
- Location reference
- User reference
- Photo URL
- Verification status
- Timestamps

## File Uploads

Photo uploads are stored in the `backend/uploads/` directory. Make sure this directory exists and has write permissions.

## Authentication

The API uses JWT tokens for authentication. Include the token in the Authorization header:
```
Authorization: Bearer <token>
```

## Error Handling

All errors return a JSON response with an `error` field:
```json
{
  "error": "Error message"
}
```

## Development Notes

- **TypeScript**: The entire backend is written in TypeScript for type safety
- The server uses ES modules (import/export syntax)
- MongoDB connection is handled automatically on server start
- Geospatial queries require MongoDB indexes (created automatically)
- Photo uploads are limited to 5MB
- JWT tokens expire after 7 days by default
- Type definitions are available for all models and Express request/response types

## Production Considerations

1. Change `JWT_SECRET` to a strong, random value
2. Use MongoDB Atlas or a managed MongoDB service
3. Set up proper CORS configuration
4. Use environment variables for all sensitive data
5. Set up image storage (S3, Cloudinary, etc.) instead of local storage
6. Add rate limiting
7. Set up proper logging
8. Add API documentation (Swagger/OpenAPI)

