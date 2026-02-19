/**
 * Turkey Bazaar Products Seeder
 *
 * Collects Turkey bazaar (pazar/hal) product names and adds them to the product database.
 *
 * Data sources:
 * 1. Curated list of common Turkey bazaar products (sebze, meyve, bakliyat, kuruyemiş, etc.)
 * 2. Optional: CollectAPI Bazaar Price API (requires COLLECTAPI_API_KEY in .env)
 *
 * Usage:
 *   cd backend
 *   npm run seed-bazaar-products
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabaseAdmin } from '../lib/supabase.js';
import { fetchProductImage } from '../lib/product-image.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const SKIP_IMAGES = process.argv.includes('--skip-images');

// Valid categories from products table schema
const VALID_CATEGORIES = ['Sebze', 'Meyve', 'Et', 'Süt Ürünleri', 'Bakliyat', 'Temel Gıda', 'Diğer'] as const;
const VALID_UNITS = ['kg', 'adet', 'lt', 'paket'] as const;

type Category = (typeof VALID_CATEGORIES)[number];
type Unit = (typeof VALID_UNITS)[number];

interface ProductEntry {
  name: string;
  category: Category;
  default_unit: Unit;
}

/**
 * Comprehensive list of all Turkish market products
 * Covers: pazar, market, bakkal - sebze, meyve, et, süt, bakliyat, konserve, dondurulmuş, atıştırmalık, içecek, unlu mamuller, soslar
 */
const TURKEY_BAZAAR_PRODUCTS: ProductEntry[] = [
  // ========== SEBZE (Vegetables) - Most common at pazar ==========
  { name: 'Domates', category: 'Sebze', default_unit: 'kg' },
  { name: 'Salatalık', category: 'Sebze', default_unit: 'kg' },
  { name: 'Biber', category: 'Sebze', default_unit: 'kg' },
  { name: 'Patlıcan', category: 'Sebze', default_unit: 'kg' },
  { name: 'Kabak', category: 'Sebze', default_unit: 'kg' },
  { name: 'Soğan', category: 'Sebze', default_unit: 'kg' },
  { name: 'Sarımsak', category: 'Sebze', default_unit: 'kg' },
  { name: 'Havuç', category: 'Sebze', default_unit: 'kg' },
  { name: 'Patates', category: 'Sebze', default_unit: 'kg' },
  { name: 'Lahana', category: 'Sebze', default_unit: 'kg' },
  { name: 'Karnabahar', category: 'Sebze', default_unit: 'kg' },
  { name: 'Brokoli', category: 'Sebze', default_unit: 'kg' },
  { name: 'Ispanak', category: 'Sebze', default_unit: 'kg' },
  { name: 'Marul', category: 'Sebze', default_unit: 'adet' },
  { name: 'Roka', category: 'Sebze', default_unit: 'kg' },
  { name: 'Maydanoz', category: 'Sebze', default_unit: 'adet' },
  { name: 'Dereotu', category: 'Sebze', default_unit: 'adet' },
  { name: 'Nane', category: 'Sebze', default_unit: 'adet' },
  { name: 'Taze Fasulye', category: 'Sebze', default_unit: 'kg' },
  { name: 'Bezelye', category: 'Sebze', default_unit: 'kg' },
  { name: 'Bamya', category: 'Sebze', default_unit: 'kg' },
  { name: 'Börülce', category: 'Sebze', default_unit: 'kg' },
  { name: 'Semizotu', category: 'Sebze', default_unit: 'kg' },
  { name: 'Pazı', category: 'Sebze', default_unit: 'kg' },
  { name: 'Kırmızı Biber', category: 'Sebze', default_unit: 'kg' },
  { name: 'Yeşil Biber', category: 'Sebze', default_unit: 'kg' },
  { name: 'Dolmalık Biber', category: 'Sebze', default_unit: 'kg' },
  { name: 'Taze Soğan', category: 'Sebze', default_unit: 'adet' },
  { name: 'Turp', category: 'Sebze', default_unit: 'kg' },
  { name: 'Kereviz', category: 'Sebze', default_unit: 'kg' },
  { name: 'Pırasa', category: 'Sebze', default_unit: 'kg' },
  { name: 'Enginar', category: 'Sebze', default_unit: 'adet' },
  { name: 'Kuşkonmaz', category: 'Sebze', default_unit: 'kg' },
  { name: 'Taze Mısır', category: 'Sebze', default_unit: 'adet' },
  { name: 'Balkabağı', category: 'Sebze', default_unit: 'kg' },
  { name: 'Kıvırcık Salata', category: 'Sebze', default_unit: 'adet' },
  { name: 'Göbek Salata', category: 'Sebze', default_unit: 'adet' },
  { name: 'Rezene', category: 'Sebze', default_unit: 'kg' },
  { name: 'Şalgam', category: 'Sebze', default_unit: 'kg' },

  // ========== MEYVE (Fruits) ==========
  { name: 'Elma', category: 'Meyve', default_unit: 'kg' },
  { name: 'Armut', category: 'Meyve', default_unit: 'kg' },
  { name: 'Muz', category: 'Meyve', default_unit: 'kg' },
  { name: 'Portakal', category: 'Meyve', default_unit: 'kg' },
  { name: 'Mandalin', category: 'Meyve', default_unit: 'kg' },
  { name: 'Limon', category: 'Meyve', default_unit: 'adet' },
  { name: 'Çilek', category: 'Meyve', default_unit: 'kg' },
  { name: 'Kiraz', category: 'Meyve', default_unit: 'kg' },
  { name: 'Üzüm', category: 'Meyve', default_unit: 'kg' },
  { name: 'Karpuz', category: 'Meyve', default_unit: 'kg' },
  { name: 'Kavun', category: 'Meyve', default_unit: 'kg' },
  { name: 'Şeftali', category: 'Meyve', default_unit: 'kg' },
  { name: 'Kayısı', category: 'Meyve', default_unit: 'kg' },
  { name: 'Erik', category: 'Meyve', default_unit: 'kg' },
  { name: 'İncir', category: 'Meyve', default_unit: 'kg' },
  { name: 'Nar', category: 'Meyve', default_unit: 'kg' },
  { name: 'Ayva', category: 'Meyve', default_unit: 'kg' },
  { name: 'Kivi', category: 'Meyve', default_unit: 'kg' },
  { name: 'Ananas', category: 'Meyve', default_unit: 'adet' },
  { name: 'Avokado', category: 'Meyve', default_unit: 'adet' },
  { name: 'Mango', category: 'Meyve', default_unit: 'adet' },
  { name: 'Böğürtlen', category: 'Meyve', default_unit: 'kg' },
  { name: 'Ahududu', category: 'Meyve', default_unit: 'kg' },
  { name: 'Yaban Mersini', category: 'Meyve', default_unit: 'kg' },
  { name: 'Dut', category: 'Meyve', default_unit: 'kg' },
  { name: 'Vişne', category: 'Meyve', default_unit: 'kg' },
  { name: 'Kestane', category: 'Meyve', default_unit: 'kg' },
  { name: 'Hurma', category: 'Meyve', default_unit: 'kg' },
  { name: 'Ceviz', category: 'Meyve', default_unit: 'kg' },
  { name: 'Fındık', category: 'Meyve', default_unit: 'kg' },
  { name: 'Badem', category: 'Meyve', default_unit: 'kg' },
  { name: 'Kuru İncir', category: 'Meyve', default_unit: 'kg' },
  { name: 'Kuru Üzüm', category: 'Meyve', default_unit: 'kg' },
  { name: 'Kuru Kayısı', category: 'Meyve', default_unit: 'kg' },
  { name: 'Kuru Erik', category: 'Meyve', default_unit: 'kg' },

  // ========== KURUYEMİŞ (Nuts - common at bazaar) ==========
  { name: 'Leblebi', category: 'Diğer', default_unit: 'kg' },
  { name: 'Fıstık', category: 'Diğer', default_unit: 'kg' },
  { name: 'Ay Çekirdeği', category: 'Diğer', default_unit: 'kg' },
  { name: 'Kabak Çekirdeği', category: 'Diğer', default_unit: 'kg' },
  { name: 'Kaju', category: 'Diğer', default_unit: 'kg' },
  { name: 'Antep Fıstığı', category: 'Diğer', default_unit: 'kg' },
  { name: 'Kuru Yemiş Karışımı', category: 'Diğer', default_unit: 'kg' },

  // ========== BAKLİYAT (Legumes - very common at pazar) ==========
  { name: 'Mercimek', category: 'Bakliyat', default_unit: 'kg' },
  { name: 'Nohut', category: 'Bakliyat', default_unit: 'kg' },
  { name: 'Fasulye', category: 'Bakliyat', default_unit: 'kg' },
  { name: 'Barbunya', category: 'Bakliyat', default_unit: 'kg' },
  { name: 'Pirinç', category: 'Bakliyat', default_unit: 'kg' },
  { name: 'Bulgur', category: 'Bakliyat', default_unit: 'kg' },
  { name: 'Makarna', category: 'Bakliyat', default_unit: 'paket' },
  { name: 'Un', category: 'Bakliyat', default_unit: 'kg' },
  { name: 'Mısır', category: 'Bakliyat', default_unit: 'kg' },
  { name: 'Arpa', category: 'Bakliyat', default_unit: 'kg' },
  { name: 'Yulaf', category: 'Bakliyat', default_unit: 'kg' },
  { name: 'Kinoa', category: 'Bakliyat', default_unit: 'kg' },
  { name: 'Kuru Fasulye', category: 'Bakliyat', default_unit: 'kg' },
  { name: 'Yeşil Mercimek', category: 'Bakliyat', default_unit: 'kg' },
  { name: 'Kırmızı Mercimek', category: 'Bakliyat', default_unit: 'kg' },
  { name: 'Sarı Mercimek', category: 'Bakliyat', default_unit: 'kg' },
  { name: 'Mercimek Köftelik', category: 'Bakliyat', default_unit: 'kg' },
  { name: 'Erişte', category: 'Bakliyat', default_unit: 'paket' },
  { name: 'Şehriye', category: 'Bakliyat', default_unit: 'paket' },

  // ========== ET (Meat - kasap at pazar) ==========
  { name: 'Kıyma', category: 'Et', default_unit: 'kg' },
  { name: 'Kuşbaşı', category: 'Et', default_unit: 'kg' },
  { name: 'Bonfile', category: 'Et', default_unit: 'kg' },
  { name: 'Tavuk Göğsü', category: 'Et', default_unit: 'kg' },
  { name: 'Tavuk But', category: 'Et', default_unit: 'kg' },
  { name: 'Tavuk Kanat', category: 'Et', default_unit: 'kg' },
  { name: 'Tavuk Bütün', category: 'Et', default_unit: 'adet' },
  { name: 'Balık', category: 'Et', default_unit: 'kg' },
  { name: 'Somon', category: 'Et', default_unit: 'kg' },
  { name: 'Levrek', category: 'Et', default_unit: 'kg' },
  { name: 'Çupra', category: 'Et', default_unit: 'kg' },
  { name: 'Hamsi', category: 'Et', default_unit: 'kg' },
  { name: 'Sardalya', category: 'Et', default_unit: 'kg' },
  { name: 'Ton Balığı', category: 'Et', default_unit: 'paket' },
  { name: 'Sucuk', category: 'Et', default_unit: 'kg' },
  { name: 'Sosis', category: 'Et', default_unit: 'paket' },
  { name: 'Pastırma', category: 'Et', default_unit: 'kg' },
  { name: 'Kavurma', category: 'Et', default_unit: 'kg' },
  { name: 'Döner', category: 'Et', default_unit: 'kg' },
  { name: 'Köfte', category: 'Et', default_unit: 'kg' },
  { name: 'Kuzu Eti', category: 'Et', default_unit: 'kg' },
  { name: 'Dana Eti', category: 'Et', default_unit: 'kg' },
  { name: 'Koyun Eti', category: 'Et', default_unit: 'kg' },

  // ========== SÜT ÜRÜNLERİ (Dairy - sometimes at pazar) ==========
  { name: 'Süt', category: 'Süt Ürünleri', default_unit: 'lt' },
  { name: 'Yoğurt', category: 'Süt Ürünleri', default_unit: 'kg' },
  { name: 'Peynir', category: 'Süt Ürünleri', default_unit: 'kg' },
  { name: 'Beyaz Peynir', category: 'Süt Ürünleri', default_unit: 'kg' },
  { name: 'Kaşar Peyniri', category: 'Süt Ürünleri', default_unit: 'kg' },
  { name: 'Tulum Peyniri', category: 'Süt Ürünleri', default_unit: 'kg' },
  { name: 'Lor Peyniri', category: 'Süt Ürünleri', default_unit: 'kg' },
  { name: 'Labne', category: 'Süt Ürünleri', default_unit: 'kg' },
  { name: 'Tereyağı', category: 'Süt Ürünleri', default_unit: 'kg' },
  { name: 'Ayran', category: 'Süt Ürünleri', default_unit: 'lt' },
  { name: 'Kaymak', category: 'Süt Ürünleri', default_unit: 'kg' },
  { name: 'Kefir', category: 'Süt Ürünleri', default_unit: 'lt' },
  { name: 'Süzme Peynir', category: 'Süt Ürünleri', default_unit: 'kg' },
  { name: 'Mozzarella', category: 'Süt Ürünleri', default_unit: 'kg' },

  // ========== TEMEL GIDA (Staples) ==========
  { name: 'Ekmek', category: 'Temel Gıda', default_unit: 'adet' },
  { name: 'Yumurta', category: 'Temel Gıda', default_unit: 'adet' },
  { name: 'Zeytinyağı', category: 'Temel Gıda', default_unit: 'lt' },
  { name: 'Ayçiçek Yağı', category: 'Temel Gıda', default_unit: 'lt' },
  { name: 'Tuz', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Şeker', category: 'Temel Gıda', default_unit: 'kg' },
  { name: 'Çay', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Kahve', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Bal', category: 'Temel Gıda', default_unit: 'kg' },
  { name: 'Reçel', category: 'Temel Gıda', default_unit: 'kg' },
  { name: 'Zeytin', category: 'Temel Gıda', default_unit: 'kg' },
  { name: 'Pekmez', category: 'Temel Gıda', default_unit: 'kg' },
  { name: 'Tahin', category: 'Temel Gıda', default_unit: 'kg' },
  { name: 'Sirke', category: 'Temel Gıda', default_unit: 'lt' },
  { name: 'Domates Salçası', category: 'Temel Gıda', default_unit: 'kg' },
  { name: 'Biber Salçası', category: 'Temel Gıda', default_unit: 'kg' },
  { name: 'Karabiber', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Kırmızı Biber', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Kekik', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Kimyon', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Zerdeçal', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Zencefil', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Pul Biber', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Sumak', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Tarçın', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Karanfil', category: 'Temel Gıda', default_unit: 'paket' },

  // ========== DİĞER (Other) ==========
  { name: 'Cips', category: 'Diğer', default_unit: 'paket' },
  { name: 'Çikolata', category: 'Diğer', default_unit: 'adet' },
  { name: 'Bisküvi', category: 'Diğer', default_unit: 'paket' },
  { name: 'Gazlı İçecek', category: 'Diğer', default_unit: 'lt' },
  { name: 'Su', category: 'Diğer', default_unit: 'lt' },
  { name: 'Meyve Suyu', category: 'Diğer', default_unit: 'lt' },
  { name: 'Soda', category: 'Diğer', default_unit: 'lt' },
  { name: 'Kraker', category: 'Diğer', default_unit: 'paket' },
  { name: 'Kuruyemiş', category: 'Diğer', default_unit: 'kg' },
  { name: 'Şekerleme', category: 'Diğer', default_unit: 'paket' },
  { name: 'Sakız', category: 'Diğer', default_unit: 'paket' },
  { name: 'Enerji İçeceği', category: 'Diğer', default_unit: 'adet' },
  // Konserve
  { name: 'Konserve Fasulye', category: 'Diğer', default_unit: 'paket' },
  { name: 'Konserve Mısır', category: 'Diğer', default_unit: 'paket' },
  { name: 'Konserve Bezelye', category: 'Diğer', default_unit: 'paket' },
  { name: 'Konserve Domates', category: 'Diğer', default_unit: 'paket' },
  { name: 'Turşu', category: 'Diğer', default_unit: 'kg' },
  { name: 'Zeytin Konservesi', category: 'Diğer', default_unit: 'paket' },
  // Dondurulmuş
  { name: 'Dondurulmuş Sebze', category: 'Diğer', default_unit: 'paket' },
  { name: 'Dondurulmuş Patates', category: 'Diğer', default_unit: 'paket' },
  { name: 'Dondurulmuş Börek', category: 'Diğer', default_unit: 'paket' },
  { name: 'Dondurulmuş Pizza', category: 'Diğer', default_unit: 'adet' },
  { name: 'Dondurulmuş Köfte', category: 'Diğer', default_unit: 'paket' },
  { name: 'Dondurulmuş Mantı', category: 'Diğer', default_unit: 'paket' },
  // Unlu mamuller
  { name: 'Simit', category: 'Temel Gıda', default_unit: 'adet' },
  { name: 'Poğaça', category: 'Temel Gıda', default_unit: 'adet' },
  { name: 'Açma', category: 'Temel Gıda', default_unit: 'adet' },
  { name: 'Börek', category: 'Temel Gıda', default_unit: 'adet' },
  { name: 'Pide', category: 'Temel Gıda', default_unit: 'adet' },
  { name: 'Lahmacun', category: 'Temel Gıda', default_unit: 'adet' },
  { name: 'Tost', category: 'Temel Gıda', default_unit: 'adet' },
  { name: 'Kruvasan', category: 'Temel Gıda', default_unit: 'adet' },
  { name: 'Pasta', category: 'Temel Gıda', default_unit: 'adet' },
  { name: 'Kek', category: 'Temel Gıda', default_unit: 'adet' },
  { name: 'Kurabiye', category: 'Temel Gıda', default_unit: 'paket' },
  // Soslar ve hazır
  { name: 'Ketçap', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Mayonez', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Hardal', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Sos', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Bulyon', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Hazır Çorba', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Çorba', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Hazır Yemek', category: 'Temel Gıda', default_unit: 'paket' },
  // Kahvaltılık
  { name: 'Müsli', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Corn Flakes', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Yulaf Gevreği', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Ballı Gevrek', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Fındık Ezmesi', category: 'Temel Gıda', default_unit: 'kg' },
  { name: 'Çikolata Ezmesi', category: 'Temel Gıda', default_unit: 'kg' },
  // İçecekler
  { name: 'Kola', category: 'Diğer', default_unit: 'lt' },
  { name: 'Limonata', category: 'Diğer', default_unit: 'lt' },
  { name: 'Ice Tea', category: 'Diğer', default_unit: 'lt' },
  { name: 'Yoğurt İçeceği', category: 'Süt Ürünleri', default_unit: 'lt' },
  { name: 'Süzme Yoğurt', category: 'Süt Ürünleri', default_unit: 'kg' },
  { name: 'Meyveli Yoğurt', category: 'Süt Ürünleri', default_unit: 'adet' },
  { name: 'Kaymaklı Yoğurt', category: 'Süt Ürünleri', default_unit: 'kg' },
  // Süt ürünleri ekstra
  { name: 'Rokfor Peyniri', category: 'Süt Ürünleri', default_unit: 'kg' },
  { name: 'Cheddar Peyniri', category: 'Süt Ürünleri', default_unit: 'kg' },
  { name: 'Krema', category: 'Süt Ürünleri', default_unit: 'adet' },
  { name: 'Süt Tozu', category: 'Süt Ürünleri', default_unit: 'paket' },
  // Et ekstra
  { name: 'Dana Antrikot', category: 'Et', default_unit: 'kg' },
  { name: 'Kuzu Pirzola', category: 'Et', default_unit: 'kg' },
  { name: 'Dana Kıyma', category: 'Et', default_unit: 'kg' },
  { name: 'Kuzu Kıyma', category: 'Et', default_unit: 'kg' },
  { name: 'Tavuk Nugget', category: 'Et', default_unit: 'paket' },
  { name: 'Salam', category: 'Et', default_unit: 'paket' },
  { name: 'Jambon', category: 'Et', default_unit: 'paket' },
  { name: 'Sucuk Salam', category: 'Et', default_unit: 'paket' },
  // Bakliyat ekstra
  { name: 'Kepekli Un', category: 'Bakliyat', default_unit: 'kg' },
  { name: 'Mısır Unu', category: 'Bakliyat', default_unit: 'kg' },
  { name: 'Nohut Unu', category: 'Bakliyat', default_unit: 'kg' },
  { name: 'Couscous', category: 'Bakliyat', default_unit: 'kg' },
  { name: 'Pirinç Unu', category: 'Bakliyat', default_unit: 'kg' },
  { name: 'İrmik', category: 'Bakliyat', default_unit: 'kg' },
  { name: 'Lazanya', category: 'Bakliyat', default_unit: 'paket' },
  { name: 'Spagetti', category: 'Bakliyat', default_unit: 'paket' },
  { name: 'Fettuccine', category: 'Bakliyat', default_unit: 'paket' },
  // Daha fazla sebze
  { name: 'Brüksel Lahanası', category: 'Sebze', default_unit: 'kg' },
  { name: 'Hindiba', category: 'Sebze', default_unit: 'kg' },
  { name: 'Kırmızı Lahana', category: 'Sebze', default_unit: 'kg' },
  // Daha fazla meyve
  { name: 'Papaya', category: 'Meyve', default_unit: 'adet' },
  { name: 'Greyfurt', category: 'Meyve', default_unit: 'kg' },
  { name: 'Meyve Sepeti', category: 'Meyve', default_unit: 'adet' },
  { name: 'Taze Sıkılmış Portakal Suyu', category: 'Diğer', default_unit: 'lt' },
  { name: 'Smoothie', category: 'Diğer', default_unit: 'adet' },
  // Kahve ve çay
  { name: 'Türk Kahvesi', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Filtre Kahve', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Granül Kahve', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Yeşil Çay', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Bitki Çayı', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Ihlamur', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Adaçayı', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Papatya Çayı', category: 'Temel Gıda', default_unit: 'paket' },
  // Daha fazla baharat
  { name: 'Defne Yaprağı', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Köri', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Muskat', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Biberiye', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Fesleğen', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Oregano', category: 'Temel Gıda', default_unit: 'paket' },
  // Bebek ve çocuk
  { name: 'Bebek Maması', category: 'Diğer', default_unit: 'paket' },
  { name: 'Bebek Bezi', category: 'Diğer', default_unit: 'paket' },
  { name: 'Çocuk Bisküvisi', category: 'Diğer', default_unit: 'paket' },
  // Dondurma ve tatlı
  { name: 'Dondurma', category: 'Diğer', default_unit: 'adet' },
  { name: 'Baklava', category: 'Diğer', default_unit: 'kg' },
  { name: 'Lokum', category: 'Diğer', default_unit: 'kg' },
  { name: 'Helva', category: 'Diğer', default_unit: 'kg' },
  { name: 'Tahin Helvası', category: 'Diğer', default_unit: 'kg' },
  { name: 'Fıstık Ezmesi', category: 'Temel Gıda', default_unit: 'kg' },
  { name: 'Dondurma', category: 'Diğer', default_unit: 'adet' },
];

const productsToUse = TURKEY_BAZAAR_PRODUCTS;

/**
 * Optional: Fetch product names from CollectAPI Bazaar Price API
 * Sign up at https://collectapi.com and get your token from Profile → Token
 * Add COLLECTAPI_API_KEY to backend/.env
 * API docs: https://docs.collectapi.com (check bazaar endpoint path)
 */
async function fetchFromCollectAPI(): Promise<ProductEntry[]> {
  const apiKey = process.env.COLLECTAPI_API_KEY;
  if (!apiKey) {
    console.log('⏭️  COLLECTAPI_API_KEY not set, using curated list only');
    return [];
  }

  try {
    // CollectAPI bazaar endpoint - verify path at https://docs.collectapi.com
    const res = await fetch('https://api.collectapi.com/economy/halFiyat', {
      headers: { Authorization: `apikey ${apiKey}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const items: ProductEntry[] = [];
    const arr = data.result ?? data.data ?? data.products ?? [];
    if (Array.isArray(arr)) {
      for (const item of arr) {
        const name = item.name ?? item.urun ?? item.product ?? item.urunAdi ?? item.title ?? '';
        if (typeof name === 'string' && name.trim().length > 0) {
          const normalized = name.trim().replace(/\s+/g, ' ');
          if (!items.some((i) => i.name.toLowerCase() === normalized.toLowerCase())) {
            items.push({
              name: normalized,
              category: inferCategory(normalized),
              default_unit: 'kg',
            });
          }
        }
      }
    }
    if (items.length > 0) console.log(`📡 Fetched ${items.length} products from CollectAPI`);
    return items;
  } catch {
    return [];
  }
}

function inferCategory(name: string): Category {
  const n = name.toLowerCase();
  const veg = ['domates', 'salatalık', 'biber', 'patlıcan', 'kabak', 'soğan', 'sarımsak', 'havuç', 'patates', 'lahana', 'ıspanak', 'marul', 'roka', 'maydanoz', 'fasulye', 'bezelye', 'bamya', 'semizotu', 'pazı', 'turp', 'kereviz', 'pırasa', 'enginar'];
  const fruit = ['elma', 'armut', 'muz', 'portakal', 'mandalin', 'limon', 'çilek', 'kiraz', 'üzüm', 'karpuz', 'kavun', 'şeftali', 'kayısı', 'erik', 'incir', 'nar', 'ayva', 'kivi', 'avokado', 'mango', 'böğürtlen', 'dut', 'vişne', 'kestane', 'hurma', 'ceviz', 'fındık', 'badem'];
  const meat = ['kıyma', 'kuşbaşı', 'tavuk', 'balık', 'sucuk', 'sosis', 'pastırma', 'köfte', 'kuzu', 'dana', 'koyun', 'somon', 'hamsi', 'ton'];
  const dairy = ['süt', 'yoğurt', 'peynir', 'tereyağı', 'ayran', 'kaymak', 'kefir', 'labne', 'lor'];
  const legume = ['mercimek', 'nohut', 'fasulye', 'barbunya', 'pirinç', 'bulgur', 'makarna', 'un', 'mısır', 'arpa', 'yulaf', 'kinoa'];
  const staple = ['ekmek', 'yumurta', 'zeytin', 'zeytinyağı', 'ayçiçek', 'tuz', 'şeker', 'çay', 'kahve', 'bal', 'reçel', 'pekmez', 'tahin', 'salça', 'baharat', 'karabiber', 'kimyon'];
  if (veg.some((v) => n.includes(v))) return 'Sebze';
  if (fruit.some((v) => n.includes(v))) return 'Meyve';
  if (meat.some((v) => n.includes(v))) return 'Et';
  if (dairy.some((v) => n.includes(v))) return 'Süt Ürünleri';
  if (legume.some((v) => n.includes(v))) return 'Bakliyat';
  if (staple.some((v) => n.includes(v))) return 'Temel Gıda';
  return 'Diğer';
}

type UpsertResult = 'added' | 'skipped' | 'updated';

/**
 * Upsert product into database (skip if exists by name).
 * For existing products without image: updates with fetched image.
 */
async function upsertProduct(product: ProductEntry, image: string | null): Promise<UpsertResult> {
  const { data: existing } = await supabaseAdmin
    .from('products')
    .select('id, image')
    .ilike('name', product.name.trim())
    .maybeSingle();

  if (existing) {
    if (image && !existing.image) {
      const { error } = await supabaseAdmin
        .from('products')
        .update({ image })
        .eq('id', existing.id);
      if (!error) return 'updated';
    }
    return 'skipped';
  }

  const { error } = await supabaseAdmin.from('products').insert({
    name: product.name.trim(),
    category: product.category,
    default_unit: product.default_unit,
    image: image || null,
    is_active: true,
  });

  if (error) {
    if (error.code === '23505') return 'skipped';
    throw error;
  }
  return 'added';
}

/**
 * Main execution
 */
async function main() {
  console.log('🇹🇷 Turkey Bazaar Products Seeder\n');
  console.log('Collecting products and adding to database...\n');

  const allProducts: ProductEntry[] = [...productsToUse];

  // Optionally fetch from CollectAPI
  const apiProducts = await fetchFromCollectAPI();
  for (const p of apiProducts) {
    if (p.name && !allProducts.some((e) => e.name.toLowerCase() === p.name.toLowerCase())) {
      allProducts.push(p);
    }
  }

  const uniqueByName = new Map<string, ProductEntry>();
  for (const p of allProducts) {
    const key = p.name.trim().toLowerCase();
    if (!uniqueByName.has(key)) uniqueByName.set(key, p);
  }
  const toInsert = Array.from(uniqueByName.values());

  console.log(`📦 Total unique products to process: ${toInsert.length}`);
  if (SKIP_IMAGES) console.log('⏭️  --skip-images: no photos will be fetched\n');
  else console.log('📷 Fetching photos (Pexels/Unsplash)...\n');

  let added = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < toInsert.length; i++) {
    const p = toInsert[i];
    const progress = `[${i + 1}/${toInsert.length}]`;
    try {
      let image: string | null = null;
      if (!SKIP_IMAGES) {
        try {
          image = await fetchProductImage(p.name, p.category);
          await new Promise((r) => setTimeout(r, 400));
        } catch {
          // continue without image
        }
      }

      const result = await upsertProduct(p, image);
      if (result === 'added') {
        added++;
        console.log(`${progress} ✅ Added: ${p.name} (${p.category})${image ? ' 📷' : ''}`);
      } else if (result === 'updated') {
        updated++;
        console.log(`${progress} 📷 Updated image: ${p.name}`);
      } else {
        skipped++;
        if (i < 50) console.log(`${progress} ⏭️  Skipped (exists): ${p.name}`);
      }
      await new Promise((r) => setTimeout(r, 50));
    } catch (err: any) {
      errors++;
      console.error(`${progress} ❌ ${p.name}: ${err.message}`);
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log('📊 Summary:');
  console.log(`  ✅ Added: ${added}`);
  console.log(`  📷 Images updated: ${updated}`);
  console.log(`  ⏭️  Skipped (already exist): ${skipped}`);
  console.log(`  ❌ Errors: ${errors}`);
  console.log('═══════════════════════════════════════\n');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
  });
