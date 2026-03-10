/**
 * Supabase Direct API Service
 * 
 * This service replaces the backend API and uses Supabase directly.
 * No backend server needed - everything runs client-side with Supabase.
 */

import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// AUTH API - Using Supabase Auth
// ============================================================================

export const authAPI = {
  register: async (email: string, password: string, name: string, isMerchant: boolean = false) => {
    try {
      console.log('🔄 Starting registration process...', { email, name, isMerchant });
      
      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      });

      if (authError) {
        // Handle specific Supabase errors
        if (authError.message.includes('leaked') || authError.message.includes('compromised')) {
          throw new Error('Bu şifre güvenlik açığına uğramış. Lütfen daha güçlü bir şifre seçin.');
        }
        if (authError.message.includes('already registered')) {
          throw new Error('Bu email adresi zaten kayıtlı. Lütfen giriş yapın.');
        }
        throw authError;
      }
      if (!authData.user) throw new Error('User creation failed');
      
      console.log('✅ Auth user created:', { userId: authData.user.id, email: authData.user.email });
      console.log('🔑 Auth session:', { hasSession: !!authData.session, hasToken: !!authData.session?.access_token });

      // Note: signUp() may not return a session if email confirmation is required
      // We'll proceed with INSERT anyway - RLS policy will check auth.users table
      let session = authData.session;
      if (!session) {
        console.log('⚠️ No session from signUp (email confirmation may be required)');
        console.log('📝 Proceeding with INSERT - RLS policy will check auth.users table');
        // Don't try signIn - it will fail with "Email not confirmed"
        // RLS policy should allow INSERT if user exists in auth.users
      } else {
        console.log('✅ Session available from signUp');
      }

      // Wait a moment to ensure auth state is propagated (if session exists)
      if (session) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Create user profile in public.users
      // IMPORTANT: Do NOT include is_merchant in INSERT - always use UPDATE after insert
      // This avoids any potential RLS issues with the is_merchant column
      const userProfileData: any = {
        id: authData.user.id,
        email: authData.user.email!,
        name,
        search_radius: 15, // Default search radius (ensures constraint is satisfied)
        // DO NOT include is_merchant here - it will be set via UPDATE after successful insert
      };
      
      console.log('📝 Inserting user profile (without is_merchant):', userProfileData);
      console.log('🔍 Current auth.uid():', (await supabase.auth.getUser()).data.user?.id);
      
      // Use UPSERT instead of INSERT to handle duplicate key errors
      // This will insert if user doesn't exist, or update if they do
      let profileData: any = null;
      let profileError: any = null;
      
      const { data: upsertData, error: upsertError } = await supabase
        .from('users')
        .upsert(userProfileData, {
          onConflict: 'id',
          ignoreDuplicates: false, // Update if exists
        })
        .select()
        .single();

      if (upsertError) {
        console.error('❌ Profile upsert error:', upsertError);
        console.error('Error code:', upsertError.code);
        console.error('Error message:', upsertError.message);
        console.error('Error details:', upsertError.details);
        console.error('Error hint:', upsertError.hint);
        console.error('Full error object:', JSON.stringify(upsertError, null, 2));
        
        // Handle duplicate key error - user profile already exists
        if (upsertError.code === '23505' || upsertError.message?.includes('duplicate key') || upsertError.message?.includes('unique constraint')) {
          console.log('⚠️ User profile already exists, fetching existing profile...');
          // Try to fetch existing profile
          const { data: existingProfile, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authData.user.id)
            .single();
          
          if (fetchError) {
            console.error('❌ Failed to fetch existing profile:', fetchError);
            throw new Error('Profil zaten mevcut ancak yüklenemedi. Lütfen giriş yapmayı deneyin.');
          }
          
          // Use existing profile and update is_merchant if needed
          if (existingProfile) {
            console.log('✅ Using existing profile');
            profileData = existingProfile;
            // Update is_merchant if it's different
            if (existingProfile.is_merchant !== isMerchant) {
              const { error: updateError } = await supabase
                .from('users')
                .update({ is_merchant: isMerchant })
                .eq('id', existingProfile.id);
              
              if (!updateError) {
                profileData.is_merchant = isMerchant;
              }
            }
            // Skip error handling - we have the profile
          } else {
            profileError = upsertError;
          }
        } else {
          profileError = upsertError;
        }
      } else {
        profileData = upsertData;
      }

      // Handle errors (except duplicate key which we already handled)
      if (profileError) {
        if (profileError.code === '42501' || profileError.code === 'PGRST301') {
          throw new Error('Profil oluşturulamadı: Yetki hatası (RLS). Lütfen Supabase migration 017_final_working_rls.sql dosyasını çalıştırdığınızdan emin olun. Hata detayları: ' + (profileError.message || 'Bilinmeyen'));
        }
        // Check if error is related to is_merchant column
        if (profileError.message?.includes('is_merchant') || profileError.message?.includes('column')) {
          throw new Error('Profil oluşturulamadı: Veritabanı hatası. is_merchant kolonu ile ilgili bir sorun var. Lütfen Supabase migration\'larını çalıştırdığınızdan emin olun.');
        }
        throw new Error('Profil oluşturulamadı: ' + (profileError.message || 'Bilinmeyen hata') + ' (Kod: ' + (profileError.code || 'N/A') + ')');
      }
      
      // Always update is_merchant after successful insert (whether true or false)
      // This ensures the value is set correctly without causing RLS issues
      if (profileData) {
        console.log('📝 Updating is_merchant to', isMerchant, 'for user:', profileData.id);
        const { error: updateError } = await supabase
          .from('users')
          .update({ is_merchant: isMerchant })
          .eq('id', profileData.id);
        
        if (updateError) {
          console.warn('⚠️ Failed to update is_merchant, but profile was created:', updateError);
          // Don't throw - profile was created successfully, just is_merchant update failed
          // The default value (false) will be used
        } else {
          // Update the returned profile data with the correct is_merchant value
          profileData.is_merchant = isMerchant;
          console.log('✅ is_merchant updated successfully to', isMerchant);
        }
      }

      // If no session from signUp, try to sign in to get session (for token storage)
      session = authData.session;
      if (!session) {
        console.log('⚠️ No session from signUp, attempting signIn...');
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          console.error('SignIn after signUp error:', signInError);
          // Continue anyway - session will be handled by onAuthStateChange
        } else {
          session = signInData.session;
          console.log('✅ Session obtained from signIn');
        }
      }

      // Store session in localStorage
      if (session?.access_token) {
        localStorage.setItem('authToken', session.access_token);
        console.log('✅ Token stored in localStorage');
      }

      // Store user in localStorage
      localStorage.setItem('user', JSON.stringify(profileData));
      console.log('✅ User stored in localStorage');

      return {
        user: {
          id: profileData.id,
          email: profileData.email,
          name: profileData.name,
          avatar: profileData.avatar,
          level: profileData.level,
          points: profileData.points,
          contributions: profileData.contributions,
          is_merchant: profileData.is_merchant || false, // Include is_merchant in returned user
        },
        token: session?.access_token || null,
        session: session,
      };
    } catch (error: any) {
      console.error('Registration error:', error);
      throw new Error(error.message || 'Kayıt başarısız');
    }
  },

  login: async (email: string, password: string) => {
    try {
      console.log('🔐 Starting email login...', { email });
      
      // Add timeout for iOS network issues
      const loginPromise = supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Giriş isteği zaman aşımına uğradı. Lütfen internet bağlantınızı kontrol edin.')), 30000)
      );
      
      const { data, error } = await Promise.race([loginPromise, timeoutPromise]) as any;

      if (error) {
        console.error('❌ Login error:', error);
        // Handle specific Supabase errors
        if (error.message?.includes('Invalid login credentials') || error.message?.includes('invalid')) {
          throw new Error('Email veya şifre hatalı');
        }
        if (error.message?.includes('Email not confirmed')) {
          throw new Error('Email adresinizi doğrulamanız gerekiyor');
        }
        if (error.message?.includes('timeout') || error.message?.includes('network')) {
          throw new Error('İnternet bağlantısı hatası. Lütfen tekrar deneyin.');
        }
        throw new Error(error.message || 'Giriş başarısız');
      }
      if (!data?.user || !data?.session) {
        console.error('❌ Login failed: No user or session');
        throw new Error('Giriş başarısız - kullanıcı veya oturum oluşturulamadı');
      }
      
      console.log('✅ Login successful, fetching profile...');

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        console.error('Profile fetch error:', profileError);
        throw new Error('Kullanıcı profili bulunamadı');
      }

      return {
        user: {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          avatar: profile.avatar,
          level: profile.level,
          points: profile.points,
          contributions: profile.contributions,
          is_merchant: profile.is_merchant || false, // Include is_merchant
        },
        token: data.session.access_token,
        session: data.session,
      };
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Giriş başarısız');
    }
  },

  googleLogin: async () => {
    try {
      console.log('🔐 Starting Google OAuth...');
      console.log('📍 Current origin:', window.location.origin);
      console.log('📍 Current href:', window.location.href);
      
      // Detect if we're on mobile (Capacitor)
      const isMobile = typeof window !== 'undefined' && 
        (window as any).Capacitor?.isNativePlatform();
      
      // OAuth options
      const oauthOptions: any = {
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      };
      
      if (isMobile) {
        // On mobile, explicitly use custom URL scheme for OAuth redirect
        // This ensures the callback goes to the app, not to localhost
        oauthOptions.redirectTo = 'com.esnaftaucuz.app://';
        // Prevent Supabase from auto-redirecting current webview on native.
        oauthOptions.skipBrowserRedirect = true;
        console.log('📱 Mobile detected, using custom URL scheme:', oauthOptions.redirectTo);
      } else {
        // On web, use the current origin
        oauthOptions.redirectTo = `${window.location.origin}/`;
        console.log('🌐 Web detected, using redirectTo:', oauthOptions.redirectTo);
      }
      
      // Supabase handles the redirect automatically
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: oauthOptions,
      });

      if (error) {
        console.error('❌ Google OAuth error:', error);
        throw error;
      }
      
      console.log('✅ Google OAuth redirect URL:', data.url);

      // On native mobile, open OAuth in system browser.
      // The callback deep link is handled by App.tsx via appUrlOpen listener.
      if (isMobile && data.url) {
        const nativeBrowser = (window as any)?.Capacitor?.Plugins?.Browser;
        if (nativeBrowser?.open) {
          await nativeBrowser.open({ url: data.url });
        } else {
          // Fallback if Browser plugin is unavailable at runtime
          window.location.href = data.url;
        }
        return { redirectUrl: data.url, openedInBrowser: true };
      }

      // On web, redirect in the same window
      return { redirectUrl: data.url, openedInBrowser: false };
    } catch (error: any) {
      console.error('Google login error:', error);
      if (error.message?.includes('redirect_uri_mismatch')) {
        throw new Error('Google OAuth yapılandırması hatalı. Lütfen geliştirici ile iletişime geçin.');
      }
      throw new Error(error.message || 'Google ile giriş başarısız');
    }
  },

  guestLogin: async () => {
    try {
      // Create guest user profile (without auth.users entry)
      const guestId = uuidv4();
      
      const { data: guestUser, error: createError } = await supabase
        .from('users')
        .insert({
          id: guestId,
          name: 'Misafir Kullanıcı',
          email: `guest_${Date.now()}@guest.com`,
          is_guest: true,
          search_radius: 15, // Default search radius (ensures constraint is satisfied: 1-1000)
        })
        .select()
        .single();

      if (createError) throw createError;
      if (!guestUser) throw new Error('Guest user creation failed');

      return {
        user: {
          id: guestUser.id,
          name: guestUser.name,
          email: guestUser.email,
          avatar: guestUser.avatar,
          level: guestUser.level,
          points: guestUser.points,
          contributions: guestUser.contributions,
          isGuest: true,
          is_merchant: false, // Guest users are never merchants
        },
        token: guestUser.id, // Use guest ID as token
        session: {
          access_token: guestUser.id,
          expires_in: 3600,
          token_type: 'Bearer',
          user: { id: guestUser.id, email: guestUser.email },
        },
      };
    } catch (error: any) {
      console.error('Guest login error:', error);
      throw new Error(error.message || 'Misafir girişi başarısız');
    }
  },

  getCurrentUser: async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        // Check if it's a guest user (UUID token)
        const token = localStorage.getItem('authToken');
        if (token && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
          const { data: guestUser } = await supabase
            .from('users')
            .select('*')
            .eq('id', token)
            .eq('is_guest', true)
            .single();
          
          if (guestUser) {
            return { user: guestUser };
          }
        }
        throw error || new Error('User not found');
      }

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      return { user: profile || user };
    } catch (error: any) {
      console.error('Get current user error:', error);
      throw error;
    }
  },

  logout: async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
    } catch (error) {
      console.error('Logout error:', error);
    }
  },
};

// ============================================================================
// PRODUCTS API - Using Supabase Database
// ============================================================================

export const productsAPI = {
  getAll: async (search?: string, category?: string) => {
    try {
      let query = supabase
        .from('products')
        .select('*')
        .eq('is_active', true);

      if (search) {
        query = query.ilike('name', `%${search}%`);
      }
      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query.order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Get products error:', error);
      throw new Error(error.message || 'Ürünler yüklenemedi');
    }
  },

  getTrending: async () => {
    try {
      console.log('🔍 Fetching trending products...');
      console.log('🌐 Supabase URL:', import.meta.env.VITE_SUPABASE_URL?.substring(0, 30) + '...');
      console.log('🔑 Supabase Key:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Set' : 'MISSING');
      
      // Check if Supabase is configured
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        console.warn('⚠️ Supabase not configured, returning empty array');
        return [];
      }
      
      // Test connection first with a simple query
      console.log('🧪 Testing Supabase connection...');
      const startTime = Date.now();
      
      // Direct query without Promise.race (timeout handled by Supabase client's custom fetch)
      const { data, error } = await supabase
        .from('products')
        .select('id, name, category, image')
        .eq('is_active', true)
        .order('search_count', { ascending: false })
        .limit(6);
      
      const endTime = Date.now();
      console.log(`⏱️ Query completed in ${endTime - startTime}ms`);

      if (error) {
        console.error('❌ Supabase error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error details:', error.details);
        console.error('Error hint:', error.hint);
        // Return empty array instead of throwing
        return [];
      }
      
      console.log('✅ Trending products fetched:', data?.length || 0);
      return data || [];
    } catch (error: any) {
      console.error('❌ Get trending products exception:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      // Return empty array instead of throwing to prevent app from hanging
      return [];
    }
  },

  getById: async (id: string) => {
    try {
      // Get product
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (productError) throw productError;
      if (!product) throw new Error('Product not found');

      // Increment search count
      await supabase
        .from('products')
        .update({ search_count: (product.search_count || 0) + 1 })
        .eq('id', id);

      return product;
    } catch (error: any) {
      console.error('Get product error:', error);
      throw new Error(error.message || 'Ürün bulunamadı');
    }
  },

  create: async (name: string, category?: string, defaultUnit?: string) => {
    try {
      console.log('Creating product:', { name, category, defaultUnit });
      const { data, error } = await supabase
        .from('products')
        .insert({
          name: name.trim(),
          category: category || 'Diğer',
          default_unit: defaultUnit || 'adet',
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error('Product creation error:', error);
        throw new Error(`Ürün oluşturulamadı: ${error.message}`);
      }
      if (!data) {
        throw new Error('Ürün oluşturulamadı: Yeni ürün döndürülmedi');
      }
      console.log('Product created successfully:', data.id);
      return data;
    } catch (error: any) {
      console.error('Create product error:', error);
      throw new Error(error.message || 'Ürün oluşturulamadı');
    }
  },
};

// ============================================================================
// LOCATIONS API - Using Supabase Database
// ============================================================================

export const locationsAPI = {
  getAll: async (filters?: {
    type?: string;
    city?: string;
    district?: string;
    lat?: number;
    lng?: number;
    radius?: number;
  }) => {
    try {
      let query = supabase.from('locations').select('*');

      if (filters?.type) {
        query = query.eq('type', filters.type);
      }
      if (filters?.city) {
        query = query.eq('city', filters.city);
      }
      if (filters?.district) {
        query = query.eq('district', filters.district);
      }

      // Note: Geospatial filtering would require PostGIS functions
      // For now, we'll fetch all and filter client-side if needed
      const { data, error } = await query.order('name', { ascending: true });

      if (error) throw error;

      // Client-side geospatial filtering if coordinates provided
      if (filters?.lat && filters?.lng && filters?.radius && data) {
        const radiusKm = filters.radius / 1000;
        return data.filter((loc: any) => {
          if (!loc.coordinates) return false;
          const coords = loc.coordinates;
          const lat = coords.lat || coords.y || 0;
          const lng = coords.lng || coords.x || 0;
          const distance = calculateDistance(filters.lat!, filters.lng!, lat, lng);
          return distance <= radiusKm;
        });
      }

      return data || [];
    } catch (error: any) {
      console.error('Get locations error:', error);
      throw new Error(error.message || 'Konumlar yüklenemedi');
    }
  },

  getById: async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Location not found');
      return data;
    } catch (error: any) {
      console.error('Get location error:', error);
      throw new Error(error.message || 'Konum bulunamadı');
    }
  },

  create: async (data: {
    name: string;
    type: string;
    address?: string;
    lat: number;
    lng: number;
    city?: string;
    district?: string;
  }) => {
    try {
      const { data: location, error } = await supabase
        .from('locations')
        .insert({
          name: data.name,
          type: data.type,
          address: data.address,
          coordinates: `(${data.lng},${data.lat})`, // PostgreSQL POINT format
          city: data.city,
          district: data.district,
        })
        .select()
        .single();

      if (error) throw error;
      return location;
    } catch (error: any) {
      console.error('Create location error:', error);
      throw new Error(error.message || 'Konum oluşturulamadı');
    }
  },
};

// ============================================================================
// PRICES API - Using Supabase Database + Storage
// ============================================================================

export const pricesAPI = {
  getAll: async (filters?: {
    product?: string;
    location?: string;
    city?: string;
    district?: string;
    verified?: boolean;
    todayOnly?: boolean;
    withPhoto?: boolean;
    sort?: 'newest' | 'cheapest' | 'expensive' | 'verified';
    limit?: number;
    lat?: number;
    lng?: number;
    radius?: number;
  }) => {
    try {
      console.log('🔍 Fetching prices with filters:', filters);
      let query = supabase
        .from('prices')
        .select(`
          *,
          product:products(id, name, category, default_unit, image),
          location:locations(id, name, type, address, coordinates, city, district),
          user:users(id, name, avatar, level)
        `)
        .eq('is_active', true);

      if (filters?.product) {
        query = query.eq('product_id', filters.product);
      }
      if (filters?.location) {
        query = query.eq('location_id', filters.location);
      }
      if (filters?.verified) {
        query = query.eq('is_verified', filters.verified);
      }
      if (filters?.withPhoto) {
        query = query.not('photo', 'is', null);
      }
      if (filters?.todayOnly) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        query = query.gte('created_at', today.toISOString());
      }

      // Apply sorting
      switch (filters?.sort) {
        case 'cheapest':
          query = query.order('price', { ascending: true });
          break;
        case 'expensive':
          query = query.order('price', { ascending: false });
          break;
        case 'verified':
          query = query.order('is_verified', { ascending: false });
          query = query.order('verification_count', { ascending: false });
          break;
        case 'newest':
        default:
          query = query.order('created_at', { ascending: false });
          break;
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      } else {
        query = query.limit(500); // Default limit
      }

      // Direct query (timeout handled by Supabase client's custom fetch)
      const { data, error } = await query;
      
      // Debug: Log raw data to see location structure
      if (data && data.length > 0) {
        console.log('🔍 Raw price data sample (first item):', JSON.stringify(data[0], null, 2));
        console.log('📍 Location in raw data:', data[0].location);
      }

      if (error) {
        console.error('❌ Supabase query error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        // Return empty array instead of throwing
        return [];
      }

      // Normalize coordinates for frontend consumption
      const normalizedData = (data || []).map((price: any) => {
        let latVal: number | undefined;
        let lngVal: number | undefined;

        // First check if price has direct coordinates
        if (price.coordinates) {
          const coords = price.coordinates;
          if (typeof coords === 'string') {
            // PostgreSQL POINT string format: (lng,lat)
            const match = coords.match(/\(([^,]+),([^)]+)\)/);
            if (match) {
              lngVal = parseFloat(match[1]);
              latVal = parseFloat(match[2]);
            }
          } else if (typeof coords === 'object') {
            if (typeof coords.lat === 'number' && typeof coords.lng === 'number') {
              latVal = coords.lat;
              lngVal = coords.lng;
            } else if (typeof coords.x === 'number' && typeof coords.y === 'number') {
              latVal = coords.y; // PostgreSQL POINT stores as (lng, lat)
              lngVal = coords.x;
            }
          }
        }

        // Then check location coordinates
        if ((!latVal || !lngVal) && price.location?.coordinates) {
          const coords = price.location.coordinates;
          if (typeof coords === 'string') {
            // PostgreSQL POINT string format: (lng,lat)
            const match = coords.match(/\(([^,]+),([^)]+)\)/);
            if (match) {
              lngVal = parseFloat(match[1]);
              latVal = parseFloat(match[2]);
            }
          } else if (typeof coords === 'object') {
            if (typeof coords.lat === 'number' && typeof coords.lng === 'number') {
              latVal = coords.lat;
              lngVal = coords.lng;
            } else if (typeof coords.x === 'number' && typeof coords.y === 'number') {
              latVal = coords.y; // PostgreSQL POINT stores as (lng, lat)
              lngVal = coords.x;
            }
          }
        }

        // Add normalized coordinates to price object
        if (typeof latVal === 'number' && typeof lngVal === 'number' && !isNaN(latVal) && !isNaN(lngVal)) {
          return { ...price, lat: latVal, lng: lngVal };
        }
        return price;
      });

      console.log(`📍 Normalized ${normalizedData.filter((p: any) => p.lat && p.lng).length} prices with coordinates`);

      // Client-side geospatial filtering if coordinates provided
      let filteredData = normalizedData;
      if (filters?.lat && filters?.lng && filters?.radius) {
        const radiusKm = filters.radius / 1000;
        filteredData = filteredData.filter((price: any) => {
          // Use normalized lat/lng if available
          if (price.lat && price.lng) {
            const distance = calculateDistance(filters.lat!, filters.lng!, price.lat, price.lng);
            return distance <= radiusKm;
          }
          return false;
        });
      }

      console.log('✅ Prices fetched:', filteredData?.length || 0);
      
      // Debug: Log location data for first few prices
      if (filteredData.length > 0) {
        console.log('📍 Sample price location data:', filteredData.slice(0, 3).map((p: any) => ({
          id: p.id,
          location: p.location,
          locationName: p.location?.name,
          locationId: p.location?.id,
          hasLocation: !!p.location,
        })));
      }
      
      return filteredData;
    } catch (error: any) {
      console.error('❌ Get prices error:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      // Return empty array instead of throwing to prevent app from hanging
      return [];
    }
  },

  getByProduct: async (productId: string, sort: 'newest' | 'cheapest' | 'expensive' | 'verified' = 'cheapest') => {
    return pricesAPI.getAll({ product: productId, sort });
  },

  getById: async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('prices')
        .select(`
          *,
          product:products(id, name, category, default_unit, image),
          location:locations(id, name, type, address, coordinates, city, district),
          user:users(id, name, avatar, level)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Price not found');
      return data;
    } catch (error: any) {
      console.error('Get price error:', error);
      throw new Error(error.message || 'Fiyat bulunamadı');
    }
  },

  create: async (data: {
    product: string;
    price: number;
    unit: string;
    location: string;
    lat?: number;
    lng?: number;
    photo?: File;
  }) => {
    // Add overall timeout for the entire operation
    const overallTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('İşlem zaman aşımına uğradı. Lütfen tekrar deneyin.')), 30000); // 30 second timeout
    });

    const createOperation = async () => {
      try {
        console.log('🚀 Starting price creation...');
        
        // Get current user - ALWAYS use auth.getUser() for authenticated users
        console.log('👤 Getting user...');
        const { data: { user: authUser }, error: getUserError } = await supabase.auth.getUser();
        
        if (getUserError) {
          console.error('❌ Get user error:', getUserError);
          throw new Error('Oturum doğrulanamadı. Lütfen tekrar giriş yapın.');
        }
        
        if (!authUser) {
          console.error('❌ No authenticated user');
          throw new Error('Giriş yapmanız gerekiyor');
        }
        
        let userId = authUser.id;
        console.log('✅ Authenticated user found:', userId);

      // Find or create product
      console.log('🔍 Finding or creating product...');
      // data.product can be either an ID (UUID) or a product name
      let productId = data.product;
      
      // Check if it's a UUID (ID format)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.product);
      console.log('Product is UUID:', isUUID, 'Value:', data.product);
      
      let existingProduct = null;
      if (isUUID) {
        // Search by ID
        console.log('Searching product by ID...');
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('id')
          .eq('id', data.product)
          .maybeSingle();
        if (productError) {
          console.error('Product search error:', productError);
        }
        existingProduct = product;
      } else {
        // Search by name (case-insensitive)
        console.log('Searching product by name...');
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('id')
          .ilike('name', data.product.trim())
          .maybeSingle();
        if (productError) {
          console.error('Product search error:', productError);
        }
        existingProduct = product;
      }

      if (!existingProduct) {
        console.log('Creating new product:', data.product);
        const { data: newProduct, error: createError } = await supabase
          .from('products')
          .insert({
            name: data.product.trim(),
            default_unit: data.unit,
            is_active: true,
          })
          .select('id')
          .single();

        if (createError) {
          console.error('Product creation error:', createError);
          throw new Error(`Ürün oluşturulamadı: ${createError.message}`);
        }
        if (!newProduct) {
          throw new Error('Ürün oluşturulamadı: Yeni ürün döndürülmedi');
        }
        productId = newProduct.id;
        console.log('Product created with ID:', productId);
      } else {
        productId = existingProduct.id;
        console.log('Using existing product ID:', productId);
      }

      // Find or create location
      console.log('🔍 Finding or creating location...');
      // data.location can be either an ID (UUID) or a location name
      let locationId = data.location;
      
      // Check if it's a UUID (ID format)
      const isLocationUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.location);
      console.log('Location is UUID:', isLocationUUID, 'Value:', data.location);
      
      let existingLocation = null;
      if (isLocationUUID) {
        // Search by ID
        console.log('Searching location by ID...');
        const { data: location, error: locationError } = await supabase
          .from('locations')
          .select('id')
          .eq('id', data.location)
          .maybeSingle();
        if (locationError) {
          console.error('Location search error:', locationError);
        }
        existingLocation = location;
      } else {
        // Search by name (case-insensitive)
        console.log('Searching location by name...');
        const { data: location, error: locationError } = await supabase
          .from('locations')
          .select('id')
          .ilike('name', data.location.trim())
          .maybeSingle();
        if (locationError) {
          console.error('Location search error:', locationError);
        }
        existingLocation = location;
      }

      if (!existingLocation) {
        console.log('Creating new location:', data.location);
        const defaultLat = data.lat || 37.8667;
        const defaultLng = data.lng || 32.4833;
        
        const { data: newLocation, error: createError } = await supabase
          .from('locations')
          .insert({
            name: data.location.trim(),
            type: 'diğer',
            coordinates: `(${defaultLng},${defaultLat})`,
          })
          .select('id')
          .single();

        if (createError) {
          console.error('Location creation error:', createError);
          throw new Error(`Konum oluşturulamadı: ${createError.message}`);
        }
        if (!newLocation) {
          throw new Error('Konum oluşturulamadı: Yeni konum döndürülmedi');
        }
        locationId = newLocation.id;
        console.log('Location created with ID:', locationId);
      } else {
        locationId = existingLocation.id;
        console.log('Using existing location ID:', locationId);
      }

      // Upload photo to Supabase Storage if provided
      let photoUrl: string | null = null;
      let photoUploadError: string | null = null;
      
      if (data.photo) {
        try {
          console.log('📸 Uploading photo to Supabase Storage...', {
            fileName: data.photo.name,
            fileSize: data.photo.size,
            fileType: data.photo.type,
          });
          
          const fileExt = data.photo.name.split('.').pop() || 'jpg';
          const fileName = `${userId}/${uuidv4()}.${fileExt}`;
          
          console.log('📤 Uploading to:', fileName);
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('price-photos')
            .upload(fileName, data.photo, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) {
            console.error('❌ Photo upload error:', uploadError);
            console.error('Upload error details:', {
              message: uploadError.message,
              statusCode: uploadError.statusCode,
              error: uploadError.error,
            });
            // Store error message but continue with price creation
            photoUploadError = uploadError.message || 'Bilinmeyen hata';
            console.warn('⚠️ Continuing without photo due to upload error');
          } else {
            console.log('✅ Photo uploaded to storage:', uploadData);
            console.log('📁 Uploaded file path:', uploadData.path);
            
            // Get public URL
            const { data: urlData } = supabase.storage
              .from('price-photos')
              .getPublicUrl(uploadData.path);
            
            photoUrl = urlData.publicUrl;
            console.log('✅ Photo URL generated:', photoUrl);
            console.log('🔗 Full photo URL:', photoUrl);
            
            // Verify URL is valid
            if (!photoUrl || photoUrl.includes('undefined') || photoUrl.includes('null')) {
              console.error('❌ Invalid photo URL generated:', photoUrl);
              photoUploadError = 'Fotoğraf URL\'i oluşturulamadı';
            }
          }
        } catch (photoError: any) {
          console.error('❌ Photo upload exception:', photoError);
          // Store error message but continue with price creation
          photoUploadError = photoError.message || 'Bilinmeyen hata';
          console.warn('⚠️ Continuing without photo due to exception');
        }
      } else {
        console.log('ℹ️ No photo provided, skipping photo upload');
      }

      // Verify user_id matches auth.uid() for RLS policy
      const { data: { user: currentAuthUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error('❌ Auth error:', authError);
        throw new Error('Oturum doğrulanamadı. Lütfen tekrar giriş yapın.');
      }
      
      if (!currentAuthUser) {
        console.error('❌ No authenticated user found');
        throw new Error('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
      }
      
      // Always use current auth user ID
      userId = currentAuthUser.id;
      console.log('✅ Using authenticated user ID:', userId);
      
      if (currentAuthUser.id !== userId) {
        console.warn('⚠️ User ID mismatch - using auth user ID instead');
        userId = currentAuthUser.id;
      }

      // Create price
      const priceData: any = {
        product_id: productId,
        price: data.price,
        unit: data.unit,
        location_id: locationId,
        user_id: userId,
        photo: photoUrl,
        is_active: true, // Ensure is_active is set
      };

      if (data.lat && data.lng) {
        priceData.coordinates = `(${data.lng},${data.lat})`;
      }

      console.log('📝 Creating price with data:', {
        product_id: priceData.product_id,
        location_id: priceData.location_id,
        user_id: priceData.user_id,
        auth_uid: currentAuthUser?.id,
        user_id_match: currentAuthUser?.id === priceData.user_id,
        price: priceData.price,
        hasPhoto: !!priceData.photo,
        photoUrl: priceData.photo || 'null',
        hasCoordinates: !!(priceData.coordinates),
      });

      // Double-check auth.uid() before insert
      if (!currentAuthUser) {
        throw new Error('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
      }
      
      if (currentAuthUser.id !== priceData.user_id) {
        console.warn('⚠️ User ID mismatch - correcting user_id');
        priceData.user_id = currentAuthUser.id;
      }

      console.log('💾 Inserting price into database...');
      const { data: priceRecord, error: priceError } = await supabase
        .from('prices')
        .insert(priceData)
        .select(`
          *,
          product:products(id, name, category, default_unit, image),
          location:locations(id, name, type, address, coordinates, city, district),
          user:users(id, name, avatar, level)
        `)
        .single();
      
      if (priceRecord) {
        console.log('✅ Price record created:', {
          id: priceRecord.id,
          photo: priceRecord.photo || 'null',
          hasPhoto: !!priceRecord.photo,
        });
      }

      if (priceError) {
        console.error('❌ Price creation error:', priceError);
        console.error('❌ Error code:', priceError.code);
        console.error('❌ Error message:', priceError.message);
        console.error('❌ Error details:', priceError.details);
        console.error('❌ Error hint:', priceError.hint);
        console.error('❌ Price data:', priceData);
        console.error('❌ Current auth user:', currentAuthUser?.id);
        console.error('❌ User ID in price data:', priceData.user_id);
        console.error('❌ User ID match:', currentAuthUser?.id === priceData.user_id);
        
        // Provide more helpful error message
        let errorMessage = 'Fiyat oluşturulamadı';
        if (priceError.code === '42501' || priceError.message?.includes('permission denied') || priceError.message?.includes('row-level security')) {
          errorMessage = 'Yetki hatası: Fiyat ekleme yetkiniz yok. Lütfen tekrar giriş yapın.';
        } else if (priceError.message) {
          errorMessage = `Fiyat oluşturulamadı: ${priceError.message}`;
        }
        
        throw new Error(errorMessage);
      }
      
      if (!priceRecord) {
        throw new Error('Fiyat oluşturulamadı: Yeni fiyat döndürülmedi');
      }
      
      console.log('Price created successfully:', priceRecord.id);

      // Update user points
      const { data: userProfile } = await supabase
        .from('users')
        .select('points, contributions')
        .eq('id', userId)
        .single();

      if (userProfile) {
        const newPoints = (userProfile.points || 0) + 10;
        const contributions = userProfile.contributions || { shares: 0, verifications: 0 };
        
        await supabase
          .from('users')
          .update({
            points: newPoints,
            contributions: {
              ...contributions,
              shares: (contributions.shares || 0) + 1,
            },
          })
          .eq('id', userId);
      }

        console.log('✅ Price creation completed successfully');
        
        // Return price record with photo upload error info if any
        return {
          ...priceRecord,
          photoUploadError: photoUploadError || undefined,
        };
      } catch (error: any) {
        console.error('❌ Create price error:', error);
        console.error('Error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        throw new Error(error.message || 'Fiyat oluşturulamadı');
      }
    };

    // Race between operation and timeout
    return Promise.race([createOperation(), overallTimeout]) as Promise<any>;
  },

  verify: async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const token = localStorage.getItem('authToken');
      
      if (!user && !token) {
        throw new Error('Giriş yapmanız gerekiyor');
      }

      // Get current price to increment verification_count
      const { data: currentPrice, error: fetchError } = await supabase
        .from('prices')
        .select('verification_count')
        .eq('id', id)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching current price:', fetchError);
        throw fetchError;
      }

      // Update the price
      const { error: updateError } = await supabase
        .from('prices')
        .update({
          is_verified: true,
          verification_count: (currentPrice?.verification_count || 0) + 1,
        })
        .eq('id', id);

      if (updateError) {
        console.error('Error updating price:', updateError);
        throw updateError;
      }

      // Fetch the updated price with all relations
      const { data: price, error: selectError } = await supabase
        .from('prices')
        .select(`
          *,
          product:products(id, name, category, default_unit, image),
          location:locations(id, name, type, address, coordinates, city, district),
          user:users(id, name, avatar, level)
        `)
        .eq('id', id)
        .maybeSingle();

      if (selectError) {
        console.error('Error fetching updated price:', selectError);
        throw selectError;
      }

      if (!price) {
        throw new Error('Fiyat bulunamadı');
      }

      return { message: 'Fiyat doğrulandı', price };
    } catch (error: any) {
      console.error('Verify price error:', error);
      throw new Error(error.message || 'Fiyat doğrulanamadı');
    }
  },

  report: async (id: string) => {
    try {
      // Get current price to increment report_count
      const { data: currentPrice } = await supabase
        .from('prices')
        .select('report_count')
        .eq('id', id)
        .single();

      // Increment report count
      const { data, error } = await supabase
        .from('prices')
        .update({
          report_count: (currentPrice?.report_count || 0) + 1,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { message: 'Fiyat raporlandı' };
    } catch (error: any) {
      console.error('Report price error:', error);
      throw new Error(error.message || 'Fiyat raporlanamadı');
    }
  },
};

// ============================================================================
// USERS API - Using Supabase Database
// ============================================================================

export const usersAPI = {
  getById: async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) throw new Error('User not found');
      return data;
    } catch (error: any) {
      console.error('Get user error:', error);
      throw new Error(error.message || 'Kullanıcı bulunamadı');
    }
  },

  getContributions: async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('prices')
        .select(`
          *,
          product:products(id, name, category, default_unit, image),
          location:locations(id, name, type, address, coordinates, city, district)
        `)
        .eq('user_id', id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Get contributions error:', error);
      throw new Error(error.message || 'Katkılar yüklenemedi');
    }
  },

  update: async (id: string, data: {
    name?: string;
    location?: {
      city?: string;
      district?: string;
      coordinates?: { lat: number; lng: number };
    };
    preferences?: {
      notifications?: boolean;
      searchRadius?: number; // in kilometers
    };
  }) => {
    try {
      // First, get current user data to merge preferences
      const { data: currentUser, error: fetchError } = await supabase
        .from('users')
        .select('preferences')
        .eq('id', id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching current user:', fetchError);
        // Continue anyway - might be first time setting preferences
      }

      const updateData: any = {};
      if (data.name) updateData.name = data.name;
      
      if (data.preferences) {
        // Merge with existing preferences to avoid overwriting other settings
        const existingPreferences = currentUser?.preferences || {};
        updateData.preferences = {
          ...existingPreferences,
          ...data.preferences,
        };
        
        // Also store searchRadius at root level for easier access
        if (data.preferences.searchRadius !== undefined) {
          // Validate searchRadius is within allowed range (1-1000 km)
          const searchRadius = data.preferences.searchRadius;
          if (typeof searchRadius === 'number' && searchRadius >= 1 && searchRadius <= 1000) {
            updateData.search_radius = Math.round(searchRadius); // Ensure integer
          } else {
            console.error('❌ Invalid searchRadius value:', searchRadius);
            throw new Error(`Geçersiz arama genişliği değeri: ${searchRadius}. Değer 1-1000 km arasında olmalıdır.`);
          }
        }
      }
      
      if (data.location) {
        if (data.location.city) updateData.city = data.location.city;
        if (data.location.district) updateData.district = data.location.district;
        if (data.location.coordinates) {
          updateData.coordinates = `(${data.location.coordinates.lng},${data.location.coordinates.lat})`;
        }
      }

      console.log('📝 Updating user:', { id, updateData });

      const { data: updated, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ Supabase update error:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw error;
      }
      
      console.log('✅ User updated successfully:', updated);
      return updated;
    } catch (error: any) {
      console.error('❌ Update user error:', error);
      throw new Error(error.message || 'Kullanıcı güncellenemedi');
    }
  },

  deleteAccount: async (id: string) => {
    try {
      console.log('🗑️ Starting account deletion for user:', id);
      
      // Step 1: Delete user-related data (cascade should handle most, but we'll be explicit)
      // Delete favorites
      const { error: favoritesError } = await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', id);
      
      if (favoritesError) {
        console.error('Error deleting favorites:', favoritesError);
        // Continue - might not exist
      }

      // Delete notifications
      const { error: notificationsError } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', id);
      
      if (notificationsError) {
        console.error('Error deleting notifications:', notificationsError);
        // Continue - might not exist
      }

      // Delete prices (user contributions)
      const { error: pricesError } = await supabase
        .from('prices')
        .delete()
        .eq('user_id', id);
      
      if (pricesError) {
        console.error('Error deleting prices:', pricesError);
        // Continue - might not exist
      }

      // Delete merchant products if user is a merchant
      const { error: merchantProductsError } = await supabase
        .from('merchant_products')
        .delete()
        .eq('merchant_id', id);
      
      if (merchantProductsError) {
        console.error('Error deleting merchant products:', merchantProductsError);
        // Continue - might not exist
      }

      // Delete verifications
      const { error: verificationsError } = await supabase
        .from('verifications')
        .delete()
        .eq('user_id', id);
      
      if (verificationsError) {
        console.error('Error deleting verifications:', verificationsError);
        // Continue - might not exist
      }

      // Step 2: Delete user profile from public.users
      const { error: profileError } = await supabase
        .from('users')
        .delete()
        .eq('id', id);

      if (profileError) {
        console.error('Error deleting user profile:', profileError);
        throw new Error('Kullanıcı profili silinemedi: ' + profileError.message);
      }

      console.log('✅ User profile and related data deleted successfully');

      // Note: Auth user deletion requires admin privileges and must be done server-side
      // All user data has been deleted from the database
      // The auth user account will remain but won't have access to any data
      // For complete deletion, an admin function or Edge Function would be needed

      return { success: true };
    } catch (error: any) {
      console.error('❌ Delete account error:', error);
      throw new Error(error.message || 'Hesap silinirken bir hata oluştu');
    }
  },
};

// ============================================================================
// SEARCH API - Using Supabase Full-Text Search
// ============================================================================

export const searchAPI = {
  search: async (query: string, type: 'all' | 'products' | 'prices' | 'locations' = 'all') => {
    try {
      const results: {
        products: any[];
        prices: any[];
        locations: any[];
      } = {
        products: [],
        prices: [],
        locations: [],
      };

      if (type === 'all' || type === 'products') {
        const { data: products } = await supabase
          .from('products')
          .select('*')
          .ilike('name', `%${query}%`)
          .eq('is_active', true)
          .limit(10);
        results.products = products || [];
      }

      if (type === 'all' || type === 'prices') {
        const { data: prices } = await supabase
          .from('prices')
          .select(`
            *,
            product:products(id, name, category, default_unit, image),
            location:locations(id, name, type, address, coordinates, city, district),
            user:users(id, name, avatar, level)
          `)
          .eq('is_active', true)
          .limit(20);
        
        // Filter by product name match
        if (prices) {
          results.prices = prices.filter((p: any) => 
            p.product?.name?.toLowerCase().includes(query.toLowerCase())
          );
        }
      }

      if (type === 'all' || type === 'locations') {
        const { data: locations } = await supabase
          .from('locations')
          .select('*')
          .or(`name.ilike.%${query}%,address.ilike.%${query}%,city.ilike.%${query}%,district.ilike.%${query}%`)
          .limit(10);
        results.locations = locations || [];
      }

      return results;
    } catch (error: any) {
      console.error('Search error:', error);
      throw new Error(error.message || 'Arama başarısız');
    }
  },

  getNearbyCheapest: async (lat: number, lng: number, radius: number = 5000, limit: number = 10) => {
    try {
      console.log('🔍 Fetching nearby cheapest prices...', { lat, lng, radius, limit });
      
      // Get all prices (geospatial filtering would require PostGIS)
      // Timeout handled by Supabase client's custom fetch
      // Remove 24-hour limit to show all available prices
      const { data: prices, error } = await supabase
        .from('prices')
        .select(`
          *,
          product:products(id, name, category, default_unit, image),
          location:locations(id, name, type, address, coordinates, city, district),
          user:users(id, name, avatar, level)
        `)
        .eq('is_active', true)
        .order('price', { ascending: true })
        .limit(500); // Increased limit to get more prices for filtering

      if (error) {
        console.error('❌ Supabase error:', error);
        throw error;
      }
      
      console.log('✅ Nearby prices fetched:', prices?.length || 0);
      console.log('📍 User location:', { lat, lng, radiusKm: radius / 1000 });

      // Normalize coordinates first (same logic as pricesAPI.getAll)
      const normalizedPrices = (prices || []).map((price: any) => {
        let latVal: number | undefined = price.lat;
        let lngVal: number | undefined = price.lng;
        
        // Check price.coordinates (direct on price object)
        if ((!latVal || !lngVal) && price.coordinates) {
          const coords = price.coordinates;
          if (typeof coords === 'string') {
            // PostgreSQL POINT string format: (lng,lat)
            const match = coords.match(/\(([^,]+),([^)]+)\)/);
            if (match) {
              lngVal = parseFloat(match[1]);
              latVal = parseFloat(match[2]);
            }
          } else if (typeof coords === 'object') {
            if (typeof coords.lat === 'number' && typeof coords.lng === 'number') {
              latVal = coords.lat;
              lngVal = coords.lng;
            } else if (typeof coords.x === 'number' && typeof coords.y === 'number') {
              latVal = coords.y; // PostgreSQL POINT stores as (lng, lat)
              lngVal = coords.x;
            }
          }
        }
        
        // Then check location coordinates
        if ((!latVal || !lngVal) && price.location?.coordinates) {
          const coords = price.location.coordinates;
          if (typeof coords === 'string') {
            // PostgreSQL POINT string format: (lng,lat)
            const match = coords.match(/\(([^,]+),([^)]+)\)/);
            if (match) {
              lngVal = parseFloat(match[1]);
              latVal = parseFloat(match[2]);
            }
          } else if (typeof coords === 'object') {
            if (typeof coords.lat === 'number' && typeof coords.lng === 'number') {
              latVal = coords.lat;
              lngVal = coords.lng;
            } else if (typeof coords.x === 'number' && typeof coords.y === 'number') {
              latVal = coords.y; // PostgreSQL POINT stores as (lng, lat)
              lngVal = coords.x;
            }
          }
        }
        
        // Also check if coordinates are in location object directly
        if (!latVal && price.location?.lat) {
          latVal = typeof price.location.lat === 'number' ? price.location.lat : parseFloat(String(price.location.lat));
        }
        if (!lngVal && price.location?.lng) {
          lngVal = typeof price.location.lng === 'number' ? price.location.lng : parseFloat(String(price.location.lng));
        }
        
        // Add normalized coordinates to price object
        if (typeof latVal === 'number' && typeof lngVal === 'number' && !isNaN(latVal) && !isNaN(lngVal)) {
          return { ...price, lat: latVal, lng: lngVal };
        }
        return price;
      });
      
      // Client-side geospatial filtering
      const radiusKm = radius / 1000;
      console.log(`📍 Filtering prices within ${radiusKm} km radius...`);
      console.log(`📍 Prices with coordinates: ${normalizedPrices.filter((p: any) => p.lat && p.lng).length} out of ${normalizedPrices.length}`);
      
      const nearbyPrices = normalizedPrices.filter((price: any) => {
        // Use normalized lat/lng
        if (!price.lat || !price.lng || isNaN(price.lat) || isNaN(price.lng)) {
          return false;
        }
        
        const distance = calculateDistance(lat, lng, price.lat, price.lng);
        const isWithinRadius = distance <= radiusKm;
        
        if (isWithinRadius) {
          console.log(`📍 Price within radius: ${distance.toFixed(2)} km - ${price.product?.name || 'Unknown'} - ${price.price} TL/${price.unit}`);
        }
        
        return isWithinRadius;
      });
      
      console.log(`📍 Filtered ${nearbyPrices.length} prices within ${radiusKm} km radius from ${normalizedPrices.length} total`);
      
      if (nearbyPrices.length === 0 && normalizedPrices.length > 0) {
        // Log some sample prices to debug why they're not within radius
        const samplePrices = normalizedPrices.slice(0, 5);
        console.log('⚠️ No prices within radius. Sample prices:', samplePrices.map((p: any) => ({
          product: p.product?.name,
          lat: p.lat,
          lng: p.lng,
          hasCoords: !!(p.lat && p.lng),
          distance: p.lat && p.lng ? calculateDistance(lat, lng, p.lat, p.lng).toFixed(2) + ' km' : 'N/A',
        })));
      }

      // Group by product and get cheapest
      const cheapestByProduct: Record<string, any> = {};
      nearbyPrices.forEach((price: any) => {
        const productId = price.product?.id;
        if (!productId) return;
        if (!cheapestByProduct[productId] || price.price < cheapestByProduct[productId].price) {
          cheapestByProduct[productId] = price;
        }
      });

      const result = Object.values(cheapestByProduct).slice(0, limit);
      console.log('✅ Nearby cheapest prices processed:', result.length);
      return result;
    } catch (error: any) {
      console.error('❌ Get nearby cheapest error:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      // Return empty array instead of throwing to prevent app from hanging
      return [];
    }
  },
};

// ============================================================================
// FAVORITES API
// ============================================================================

export const favoritesAPI = {
  // Add product to favorites
  add: async (productId: string, userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_favorites')
        .insert({
          user_id: userId,
          product_id: productId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('❌ Add favorite error:', error);
      throw error;
    }
  },

  // Remove product from favorites
  remove: async (productId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', userId)
        .eq('product_id', productId);

      if (error) throw error;
      return true;
    } catch (error: any) {
      console.error('❌ Remove favorite error:', error);
      throw error;
    }
  },

  // Check if product is favorited by user
  isFavorited: async (productId: string, userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_favorites')
        .select('id')
        .eq('user_id', userId)
        .eq('product_id', productId)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    } catch (error: any) {
      console.error('❌ Check favorite error:', error);
      throw error;
    }
  },

  // Get all favorites for a user
  getByUser: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_favorites')
        .select(`
          *,
          product:products(*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('❌ Get favorites error:', error);
      throw error;
    }
  },

  // Toggle favorite (add if not exists, remove if exists)
  toggle: async (productId: string, userId: string) => {
    try {
      const isFavorited = await favoritesAPI.isFavorited(productId, userId);
      if (isFavorited) {
        await favoritesAPI.remove(productId, userId);
        return false;
      } else {
        await favoritesAPI.add(productId, userId);
        return true;
      }
    } catch (error: any) {
      console.error('❌ Toggle favorite error:', error);
      throw error;
    }
  },
};

// ============================================================================
// NOTIFICATIONS API
// ============================================================================

export const notificationsAPI = {
  // Get all notifications for a user
  getByUser: async (userId: string, limit: number = 50) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          product:products(id, name, image, category)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        // If table doesn't exist, return empty array
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          return [];
        }
        throw error;
      }
      return data || [];
    } catch (error: any) {
      // If table doesn't exist, return empty array instead of throwing
      if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
        return [];
      }
      console.error('❌ Get notifications error:', error);
      throw error;
    }
  },

  // Get unread notifications count
  getUnreadCount: async (userId: string) => {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) {
        // If table doesn't exist, return 0 instead of throwing
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          return 0;
        }
        throw error;
      }
      return count || 0;
    } catch (error: any) {
      // If table doesn't exist, return 0
      if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
        return 0;
      }
      console.error('❌ Get unread count error:', error);
      throw error;
    }
  },

  // Mark notification as read
  markAsRead: async (notificationId: string, userId: string) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('❌ Mark as read error:', error);
      throw error;
    }
  },

  // Mark all notifications as read
  markAllAsRead: async (userId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      return true;
    } catch (error: any) {
      console.error('❌ Mark all as read error:', error);
      throw error;
    }
  },

  // Delete notification
  delete: async (notificationId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error: any) {
      console.error('❌ Delete notification error:', error);
      throw error;
    }
  },
};

// ============================================================================
// MERCHANT PRODUCTS API
// ============================================================================

const MERCHANT_SUBSCRIPTION_MONTHLY_FEE_TL = 1000;

const getMerchantSubscriptionAccessError = () =>
  `Esnaf aboneliğiniz aktif değil. Dükkanınızı yönetmek için aylık ${MERCHANT_SUBSCRIPTION_MONTHLY_FEE_TL} TL abonelik gereklidir.`;

const ensureMerchantSubscriptionActive = async (merchantId: string) => {
  const { data, error } = await supabase.rpc('has_active_merchant_subscription', {
    p_user_id: merchantId,
  });

  if (error) {
    console.error('❌ Subscription check RPC error:', error);
    throw new Error('Abonelik durumu kontrol edilemedi. Lütfen tekrar deneyin.');
  }

  if (!data) {
    throw new Error(getMerchantSubscriptionAccessError());
  }
};

export const merchantProductsAPI = {
  // Get all merchant products for a specific merchant
  getByMerchant: async (merchantId: string) => {
    try {
      const { data, error } = await supabase
        .from('merchant_products')
        .select(`
          *,
          product:products(*),
          location:locations(*),
          merchant:users!merchant_products_merchant_id_fkey(id, name, avatar)
        `)
        .eq('merchant_id', merchantId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('❌ Get merchant products error:', error);
      throw error;
    }
  },

  // Get a single merchant product by ID
  getById: async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('merchant_products')
        .select(`
          *,
          product:products(*),
          location:locations(*),
          merchant:users!merchant_products_merchant_id_fkey(id, name, avatar, email)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('❌ Get merchant product error:', error);
      throw error;
    }
  },

  // Create a new merchant product
  create: async (data: {
    merchant_id: string;
    product_id: string;
    price: number;
    unit: string;
    images: string[];
    location_id?: string;
    coordinates?: { lat: number; lng: number };
  }) => {
    try {
      await ensureMerchantSubscriptionActive(data.merchant_id);

      const insertData: any = {
        merchant_id: data.merchant_id,
        product_id: data.product_id,
        price: data.price,
        unit: data.unit,
        images: data.images || [],
        location_id: data.location_id || null,
      };

      // Add coordinates if provided
      if (data.coordinates) {
        insertData.coordinates = `(${data.coordinates.lng},${data.coordinates.lat})`;
      }
      // Use upsert with conflict on (merchant_id, product_id) so adding the same product
      // for the same merchant will update the existing row instead of throwing a duplicate key error.
      const { data: result, error } = await supabase
        .from('merchant_products')
        .upsert(insertData, { onConflict: 'merchant_id,product_id' })
        .select(`
          *,
          product:products(*),
          location:locations(*)
        `)
        .single();

      if (error) {
        console.error('❌ Create/Upsert merchant product error:', error);
        throw error;
      }

      return result;
    } catch (error: any) {
      console.error('❌ Create merchant product error:', error);
      throw error;
    }
  },

  // Update a merchant product
  update: async (id: string, data: {
    price?: number;
    unit?: string;
    images?: string[];
    location_id?: string;
    coordinates?: { lat: number; lng: number };
    is_active?: boolean;
  }) => {
    try {
      const { data: currentProduct, error: currentProductError } = await supabase
        .from('merchant_products')
        .select('merchant_id')
        .eq('id', id)
        .single();

      if (currentProductError || !currentProduct?.merchant_id) {
        console.error('❌ Failed to fetch merchant product for subscription check:', currentProductError);
        throw new Error('Ürün bulunamadı');
      }

      await ensureMerchantSubscriptionActive(currentProduct.merchant_id);

      const updateData: any = {};

      if (data.price !== undefined) updateData.price = data.price;
      if (data.unit !== undefined) updateData.unit = data.unit;
      if (data.images !== undefined) updateData.images = data.images;
      if (data.location_id !== undefined) updateData.location_id = data.location_id;
      if (data.is_active !== undefined) updateData.is_active = data.is_active;
      if (data.coordinates) {
        updateData.coordinates = `(${data.coordinates.lng},${data.coordinates.lat})`;
      }

      updateData.updated_at = new Date().toISOString();

      const { data: result, error } = await supabase
        .from('merchant_products')
        .update(updateData)
        .eq('id', id)
        .select(`
          *,
          product:products(*),
          location:locations(*)
        `)
        .single();

      if (error) throw error;
      return result;
    } catch (error: any) {
      console.error('❌ Update merchant product error:', error);
      throw error;
    }
  },

  // Delete a merchant product
  delete: async (id: string) => {
    try {
      const { data: currentProduct, error: currentProductError } = await supabase
        .from('merchant_products')
        .select('merchant_id')
        .eq('id', id)
        .single();

      if (currentProductError || !currentProduct?.merchant_id) {
        console.error('❌ Failed to fetch merchant product for subscription check:', currentProductError);
        throw new Error('Ürün bulunamadı');
      }

      await ensureMerchantSubscriptionActive(currentProduct.merchant_id);

      const { error } = await supabase
        .from('merchant_products')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error: any) {
      console.error('❌ Delete merchant product error:', error);
      throw error;
    }
  },

  // Verify a merchant product (user confirms price is correct)
  verify: async (merchantProductId: string, userId: string, isVerified: boolean = true) => {
    try {
      // Use UPSERT to handle both insert and update
      const { data, error } = await supabase
        .from('merchant_product_verifications')
        .upsert({
          merchant_product_id: merchantProductId,
          user_id: userId,
          is_verified: isVerified,
        }, {
          onConflict: 'merchant_product_id,user_id'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('❌ Verify merchant product error:', error);
      throw error;
    }
  },

  // Get user's verification status for a merchant product
  getUserVerification: async (merchantProductId: string, userId: string) => {
    try {
      const { data, error } = await supabase
        .from('merchant_product_verifications')
        .select('*')
        .eq('merchant_product_id', merchantProductId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('❌ Get user verification error:', error);
      throw error;
    }
  },

  // Get all merchant shops (merchants with products)
  getAllMerchantShops: async (limit: number = 50) => {
    try {
      // Get distinct merchants who have active products
      const { data, error } = await supabase
        .from('merchant_products')
        .select(`
          merchant_id,
          merchant:users!merchant_products_merchant_id_fkey(id, name, avatar, email, is_merchant),
          coordinates
        `)
        .eq('is_active', true)
        .limit(limit);

      if (error) throw error;

      // Group by merchant_id and get unique merchants
      const merchantMap = new Map();
      (data || []).forEach((item: any) => {
        if (item.merchant && !merchantMap.has(item.merchant.id)) {
          merchantMap.set(item.merchant.id, {
            ...item.merchant,
            coordinates: item.coordinates,
          });
        }
      });

      return Array.from(merchantMap.values());
    } catch (error: any) {
      console.error('❌ Get all merchant shops error:', error);
      throw error;
    }
  },
};

// ============================================================================
// MERCHANT SUBSCRIPTION API
// ============================================================================

export const merchantSubscriptionAPI = {
  getStatus: async (userId: string) => {
    try {
      const { error: syncError } = await supabase.rpc('sync_merchant_subscription_status', {
        p_user_id: userId,
      });

      if (syncError) {
        console.warn('⚠️ Failed to sync merchant subscription status:', syncError);
      }

      const [{ data: profile, error: profileError }, { data: isActive, error: activeError }] = await Promise.all([
        supabase
          .from('users')
          .select(`
            id,
            is_merchant,
            merchant_subscription_status,
            merchant_subscription_plan,
            merchant_subscription_fee_tl,
            merchant_subscription_current_period_start,
            merchant_subscription_current_period_end
          `)
          .eq('id', userId)
          .single(),
        supabase.rpc('has_active_merchant_subscription', { p_user_id: userId }),
      ]);

      if (profileError) throw profileError;
      if (activeError) throw activeError;

      return {
        ...(profile || {}),
        is_active: !!isActive,
      };
    } catch (error: any) {
      console.error('❌ Get merchant subscription status error:', error);
      throw new Error(error.message || 'Abonelik durumu alınamadı');
    }
  },

  getPayments: async (userId: string, limit: number = 20) => {
    try {
      const { data, error } = await supabase
        .from('merchant_subscription_payments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('❌ Get merchant subscription payments error:', error);
      throw new Error(error.message || 'Ödeme geçmişi alınamadı');
    }
  },

  cleanupOldPayments: async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        throw new Error('Oturum bulunamadı');
      }

      const { data, error } = await supabase.functions.invoke('merchant-subscription-cleanup', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (error) throw error;
      return data || { deletedCount: 0 };
    } catch (error: any) {
      console.error('❌ Cleanup old payments error:', error);
      throw new Error(error.message || 'Ödeme geçmişi temizlenemedi');
    }
  },

  createManualEftPayment: async (data: {
    userId: string;
    amountTl?: number;
    billingPeriodMonths?: number;
    providerReference?: string;
    receiptUrl?: string;
    metadata?: Record<string, any>;
  }) => {
    try {
      const amountTl = data.amountTl || 1000;
      const billingPeriodMonths = data.billingPeriodMonths || 1;

      const { data: payment, error } = await supabase
        .from('merchant_subscription_payments')
        .insert({
          user_id: data.userId,
          provider: 'manual_eft',
          status: 'pending',
          amount_tl: amountTl,
          billing_period_months: billingPeriodMonths,
          provider_reference: data.providerReference || null,
          receipt_url: data.receiptUrl || null,
          metadata: data.metadata || {},
        })
        .select()
        .single();

      if (error) throw error;
      return payment;
    } catch (error: any) {
      console.error('❌ Create manual EFT payment error:', error);
      throw new Error(error.message || 'EFT ödeme kaydı oluşturulamadı');
    }
  },

  startProviderCheckout: async (data: {
    userId: string;
    amountTl?: number;
    billingPeriodMonths?: number;
  }) => {
    try {
      const amountTl = data.amountTl || 1000;
      const billingPeriodMonths = data.billingPeriodMonths || 1;
      const plan = billingPeriodMonths >= 12
        ? 'merchant_pro_annual_20_discount'
        : 'merchant_basic_1000_tl_monthly';

      // Create a pending payment row first so webhook handlers can finalize it.
      const { data: payment, error: paymentError } = await supabase
        .from('merchant_subscription_payments')
        .insert({
          user_id: data.userId,
          provider: 'stripe',
          status: 'pending',
          amount_tl: amountTl,
          billing_period_months: billingPeriodMonths,
          metadata: {
            source: 'app_checkout_init',
          },
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Provider checkout session should be created in a secure Edge Function.
      // The function must return checkoutUrl + providerPaymentId and
      // update this payment row's provider_payment_id.
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        throw new Error('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
      }

      const { data: fnData, error: fnError } = await supabase.functions.invoke('merchant-subscription-checkout', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: {
          paymentId: payment.id,
          provider: 'stripe',
          amountTl,
          billingPeriodMonths,
          currency: 'TRY',
          plan,
        },
      });

      if (fnError) {
        console.error('❌ Checkout function error:', fnError);
        let detailedMessage = '';
        try {
          const contextResponse = (fnError as any)?.context;
          if (contextResponse) {
            const errorPayload = await contextResponse.clone().json().catch(() => null);
            detailedMessage =
              errorPayload?.error ||
              errorPayload?.details ||
              '';
          }
        } catch (parseError) {
          console.warn('⚠️ Could not parse checkout function error payload:', parseError);
        }

        throw new Error(
          detailedMessage
            ? `Ödeme oturumu oluşturulamadı: ${detailedMessage}`
            : (fnError.message || 'Ödeme oturumu oluşturulamadı.')
        );
      }

      if (!fnData?.checkoutUrl) {
        console.error('❌ Checkout function returned no URL:', fnData);
        throw new Error(
          typeof fnData?.error === 'string'
            ? `Ödeme bağlantısı oluşturulamadı: ${fnData.error}`
            : 'Ödeme bağlantısı oluşturulamadı. Lütfen Stripe yapılandırmasını kontrol edin.'
        );
      }

      return {
        payment,
        checkoutUrl: fnData.checkoutUrl,
        providerPaymentId: fnData?.providerPaymentId || null,
      };
    } catch (error: any) {
      console.error('❌ Start provider checkout error:', error);
      throw new Error(error.message || 'Ödeme başlatılamadı');
    }
  },
};

// ============================================================================
// FEEDBACK API
// ============================================================================

export const feedbackAPI = {
  send: async (data: { user_id: string | null; message: string; platform?: string }) => {
    try {
      // Try to insert into feedback table; if table missing, fallback to console/mailto
      const insert = {
        user_id: data.user_id,
        message: data.message,
        platform: data.platform || 'web',
        created_at: new Date().toISOString(),
      };

      const { data: inserted, error } = await supabase
        .from('feedback')
        .insert(insert)
        .select()
        .single();

      if (error) {
        // If table doesn't exist or permission denied, log and throw
        console.warn('Feedback insert error:', error);
        throw error;
      }
      return inserted;
    } catch (err: any) {
      console.error('Failed to send feedback:', err);
      throw err;
    }
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

