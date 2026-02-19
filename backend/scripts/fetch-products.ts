import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabaseAdmin } from '../lib/supabase.js';
import { fetchProductImage } from '../lib/product-image.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

// Note: For web scraping, you can install puppeteer:
// npm install puppeteer @types/puppeteer
// Then uncomment the scraping functions below

interface ProductData {
  name: string;
  category: string;
  default_unit: string;
  image?: string;
}

// Türk marketlerinden yaygın ürün listesi
const TURKISH_PRODUCTS: ProductData[] = [
  // Sebzeler
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
  
  // Meyveler
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
  { name: 'Papaya', category: 'Meyve', default_unit: 'adet' },
  { name: 'Böğürtlen', category: 'Meyve', default_unit: 'kg' },
  { name: 'Ahududu', category: 'Meyve', default_unit: 'kg' },
  { name: 'Yaban Mersini', category: 'Meyve', default_unit: 'kg' },
  { name: 'Dut', category: 'Meyve', default_unit: 'kg' },
  { name: 'Vişne', category: 'Meyve', default_unit: 'kg' },
  { name: 'Kestane', category: 'Meyve', default_unit: 'kg' },
  { name: 'Ceviz', category: 'Meyve', default_unit: 'kg' },
  { name: 'Fındık', category: 'Meyve', default_unit: 'kg' },
  { name: 'Badem', category: 'Meyve', default_unit: 'kg' },
  
  // Et Ürünleri
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
  { name: 'Şiş', category: 'Et', default_unit: 'kg' },
  { name: 'Kuzu Eti', category: 'Et', default_unit: 'kg' },
  { name: 'Dana Eti', category: 'Et', default_unit: 'kg' },
  { name: 'Koyun Eti', category: 'Et', default_unit: 'kg' },
  
  // Süt Ürünleri
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
  { name: 'Krema', category: 'Süt Ürünleri', default_unit: 'adet' },
  { name: 'Kaymak', category: 'Süt Ürünleri', default_unit: 'kg' },
  { name: 'Kefir', category: 'Süt Ürünleri', default_unit: 'lt' },
  { name: 'Süzme Peynir', category: 'Süt Ürünleri', default_unit: 'kg' },
  { name: 'Rokfor Peyniri', category: 'Süt Ürünleri', default_unit: 'kg' },
  { name: 'Mozzarella', category: 'Süt Ürünleri', default_unit: 'kg' },
  { name: 'Cheddar Peyniri', category: 'Süt Ürünleri', default_unit: 'kg' },
  
  // Bakliyat
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
  
  // Temel Gıda
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
  { name: 'Salça', category: 'Temel Gıda', default_unit: 'kg' },
  { name: 'Domates Salçası', category: 'Temel Gıda', default_unit: 'kg' },
  { name: 'Biber Salçası', category: 'Temel Gıda', default_unit: 'kg' },
  { name: 'Baharat', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Karabiber', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Kırmızı Biber', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Kekik', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Nane', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Kimyon', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Zerdeçal', category: 'Temel Gıda', default_unit: 'paket' },
  { name: 'Zencefil', category: 'Temel Gıda', default_unit: 'paket' },
  
  // Diğer
  { name: 'Cips', category: 'Diğer', default_unit: 'paket' },
  { name: 'Çikolata', category: 'Diğer', default_unit: 'adet' },
  { name: 'Bisküvi', category: 'Diğer', default_unit: 'paket' },
  { name: 'Gazlı İçecek', category: 'Diğer', default_unit: 'lt' },
  { name: 'Su', category: 'Diğer', default_unit: 'lt' },
  { name: 'Meyve Suyu', category: 'Diğer', default_unit: 'lt' },
  { name: 'Soda', category: 'Diğer', default_unit: 'lt' },
  { name: 'Enerji İçeceği', category: 'Diğer', default_unit: 'adet' },
  { name: 'Sakız', category: 'Diğer', default_unit: 'paket' },
  { name: 'Şekerleme', category: 'Diğer', default_unit: 'paket' },
  { name: 'Kraker', category: 'Diğer', default_unit: 'paket' },
  { name: 'Kuruyemiş', category: 'Diğer', default_unit: 'kg' },
  { name: 'Fıstık', category: 'Diğer', default_unit: 'kg' },
  { name: 'Leblebi', category: 'Diğer', default_unit: 'kg' },
  { name: 'Ay Çekirdeği', category: 'Diğer', default_unit: 'kg' },
  { name: 'Kabak Çekirdeği', category: 'Diğer', default_unit: 'kg' },
];

/**
 * Ürünü veritabanına ekle (varsa güncelle)
 * @returns 'added' | 'updated' | 'skipped'
 */
async function upsertProduct(product: ProductData): Promise<'added' | 'updated' | 'skipped'> {
  try {
    // Önce ürünün var olup olmadığını kontrol et
    const { data: existing } = await supabaseAdmin
      .from('products')
      .select('id, name, image')
      .ilike('name', product.name.trim())
      .maybeSingle();

    if (existing) {
      // Ürün varsa, resmi güncelle (mevcut resim olsa bile)
      if (product.image) {
        const { error } = await supabaseAdmin
          .from('products')
          .update({ image: product.image })
          .eq('id', existing.id);
        
        if (error) {
          console.error(`Error updating image for ${product.name}:`, error);
        } else {
          if (existing.image) {
            console.log(`🔄 Updated existing image for: ${product.name}`);
          } else {
            console.log(`✅ Added image for: ${product.name}`);
          }
        }
        return 'updated';
      } else {
        console.log(`⏭️  Skipped (no image fetched): ${product.name}`);
        return 'skipped';
      }
    }

    // Yeni ürün ekle
    const { data: newProduct, error } = await supabaseAdmin
      .from('products')
      .insert({
        name: product.name.trim(),
        category: product.category,
        default_unit: product.default_unit,
        image: product.image || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error(`❌ Error inserting ${product.name}:`, error);
      throw error;
    }

    console.log(`✅ Added: ${product.name} (${product.category})`);
    return 'added';
  } catch (error) {
    console.error(`Failed to upsert product ${product.name}:`, error);
    throw error;
  }
}

/**
 * Ana fonksiyon: Tüm ürünleri işle
 */
async function main() {
  console.log('🚀 Starting product fetch and insert process...\n');
  console.log(`📦 Total products to process: ${TURKISH_PRODUCTS.length}\n`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (let i = 0; i < TURKISH_PRODUCTS.length; i++) {
    const product = TURKISH_PRODUCTS[i];
    const progress = `[${i + 1}/${TURKISH_PRODUCTS.length}]`;
    
    try {
      console.log(`${progress} Processing: ${product.name}...`);
      
      // Görsel fetch et (opsiyonel - hata olursa devam et)
      let imageUrl: string | null = null;
      try {
        imageUrl = await fetchProductImage(product.name, product.category);
        // Rate limiting için kısa bekleme
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.warn(`  ⚠️  Could not fetch image for ${product.name}, continuing without image`);
      }

      // Ürünü ekle
      const result = await upsertProduct({
        ...product,
        image: imageUrl || undefined,
      });

      if (result === 'added' || result === 'updated') {
        successCount++;
      } else if (result === 'skipped') {
        skipCount++;
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error: any) {
      console.error(`  ❌ Error processing ${product.name}:`, error.message);
      errorCount++;
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log('📊 Summary:');
  console.log(`  ✅ Success: ${successCount}`);
  console.log(`  ⏭️  Skipped: ${skipCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log('═══════════════════════════════════════\n');
}

// Script'i çalıştır
main()
  .then(() => {
    console.log('✨ Process completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });

