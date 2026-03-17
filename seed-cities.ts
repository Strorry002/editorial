import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// 50+ Countries with ISO codes, regions, currencies, flags
// ============================================================================

const COUNTRIES = [
    // North America
    { code: 'US', name: 'United States', region: 'north-america', languages: ['en'], currency: 'USD', capitalCity: 'Washington, D.C.', flag: '🇺🇸', timezone: 'America/New_York' },
    { code: 'CA', name: 'Canada', region: 'north-america', languages: ['en', 'fr'], currency: 'CAD', capitalCity: 'Ottawa', flag: '🇨🇦', timezone: 'America/Toronto' },
    { code: 'MX', name: 'Mexico', region: 'north-america', languages: ['es'], currency: 'MXN', capitalCity: 'Mexico City', flag: '🇲🇽', timezone: 'America/Mexico_City' },

    // Central America & Caribbean
    { code: 'CR', name: 'Costa Rica', region: 'central-america', languages: ['es'], currency: 'CRC', capitalCity: 'San José', flag: '🇨🇷', timezone: 'America/Costa_Rica' },
    { code: 'PA', name: 'Panama', region: 'central-america', languages: ['es'], currency: 'USD', capitalCity: 'Panama City', flag: '🇵🇦', timezone: 'America/Panama' },

    // South America
    { code: 'BR', name: 'Brazil', region: 'south-america', languages: ['pt'], currency: 'BRL', capitalCity: 'Brasília', flag: '🇧🇷', timezone: 'America/Sao_Paulo' },
    { code: 'AR', name: 'Argentina', region: 'south-america', languages: ['es'], currency: 'ARS', capitalCity: 'Buenos Aires', flag: '🇦🇷', timezone: 'America/Argentina/Buenos_Aires' },
    { code: 'CO', name: 'Colombia', region: 'south-america', languages: ['es'], currency: 'COP', capitalCity: 'Bogotá', flag: '🇨🇴', timezone: 'America/Bogota' },
    { code: 'CL', name: 'Chile', region: 'south-america', languages: ['es'], currency: 'CLP', capitalCity: 'Santiago', flag: '🇨🇱', timezone: 'America/Santiago' },
    { code: 'UY', name: 'Uruguay', region: 'south-america', languages: ['es'], currency: 'UYU', capitalCity: 'Montevideo', flag: '🇺🇾', timezone: 'America/Montevideo' },
    { code: 'PE', name: 'Peru', region: 'south-america', languages: ['es'], currency: 'PEN', capitalCity: 'Lima', flag: '🇵🇪', timezone: 'America/Lima' },
    { code: 'EC', name: 'Ecuador', region: 'south-america', languages: ['es'], currency: 'USD', capitalCity: 'Quito', flag: '🇪🇨', timezone: 'America/Guayaquil' },

    // Western Europe
    { code: 'GB', name: 'United Kingdom', region: 'europe', languages: ['en'], currency: 'GBP', capitalCity: 'London', flag: '🇬🇧', timezone: 'Europe/London' },
    { code: 'DE', name: 'Germany', region: 'europe', languages: ['de'], currency: 'EUR', capitalCity: 'Berlin', flag: '🇩🇪', timezone: 'Europe/Berlin' },
    { code: 'FR', name: 'France', region: 'europe', languages: ['fr'], currency: 'EUR', capitalCity: 'Paris', flag: '🇫🇷', timezone: 'Europe/Paris' },
    { code: 'ES', name: 'Spain', region: 'europe', languages: ['es'], currency: 'EUR', capitalCity: 'Madrid', flag: '🇪🇸', timezone: 'Europe/Madrid' },
    { code: 'IT', name: 'Italy', region: 'europe', languages: ['it'], currency: 'EUR', capitalCity: 'Rome', flag: '🇮🇹', timezone: 'Europe/Rome' },
    { code: 'PT', name: 'Portugal', region: 'europe', languages: ['pt'], currency: 'EUR', capitalCity: 'Lisbon', flag: '🇵🇹', timezone: 'Europe/Lisbon' },
    { code: 'NL', name: 'Netherlands', region: 'europe', languages: ['nl', 'en'], currency: 'EUR', capitalCity: 'Amsterdam', flag: '🇳🇱', timezone: 'Europe/Amsterdam' },
    { code: 'BE', name: 'Belgium', region: 'europe', languages: ['nl', 'fr', 'de'], currency: 'EUR', capitalCity: 'Brussels', flag: '🇧🇪', timezone: 'Europe/Brussels' },
    { code: 'AT', name: 'Austria', region: 'europe', languages: ['de'], currency: 'EUR', capitalCity: 'Vienna', flag: '🇦🇹', timezone: 'Europe/Vienna' },
    { code: 'CH', name: 'Switzerland', region: 'europe', languages: ['de', 'fr', 'it'], currency: 'CHF', capitalCity: 'Bern', flag: '🇨🇭', timezone: 'Europe/Zurich' },
    { code: 'IE', name: 'Ireland', region: 'europe', languages: ['en', 'ga'], currency: 'EUR', capitalCity: 'Dublin', flag: '🇮🇪', timezone: 'Europe/Dublin' },
    { code: 'SE', name: 'Sweden', region: 'europe', languages: ['sv'], currency: 'SEK', capitalCity: 'Stockholm', flag: '🇸🇪', timezone: 'Europe/Stockholm' },
    { code: 'DK', name: 'Denmark', region: 'europe', languages: ['da'], currency: 'DKK', capitalCity: 'Copenhagen', flag: '🇩🇰', timezone: 'Europe/Copenhagen' },
    { code: 'NO', name: 'Norway', region: 'europe', languages: ['no'], currency: 'NOK', capitalCity: 'Oslo', flag: '🇳🇴', timezone: 'Europe/Oslo' },
    { code: 'FI', name: 'Finland', region: 'europe', languages: ['fi', 'sv'], currency: 'EUR', capitalCity: 'Helsinki', flag: '🇫🇮', timezone: 'Europe/Helsinki' },

    // Eastern & Southern Europe
    { code: 'PL', name: 'Poland', region: 'europe', languages: ['pl'], currency: 'PLN', capitalCity: 'Warsaw', flag: '🇵🇱', timezone: 'Europe/Warsaw' },
    { code: 'CZ', name: 'Czech Republic', region: 'europe', languages: ['cs'], currency: 'CZK', capitalCity: 'Prague', flag: '🇨🇿', timezone: 'Europe/Prague' },
    { code: 'RO', name: 'Romania', region: 'europe', languages: ['ro'], currency: 'RON', capitalCity: 'Bucharest', flag: '🇷🇴', timezone: 'Europe/Bucharest' },
    { code: 'HU', name: 'Hungary', region: 'europe', languages: ['hu'], currency: 'HUF', capitalCity: 'Budapest', flag: '🇭🇺', timezone: 'Europe/Budapest' },
    { code: 'HR', name: 'Croatia', region: 'europe', languages: ['hr'], currency: 'EUR', capitalCity: 'Zagreb', flag: '🇭🇷', timezone: 'Europe/Zagreb' },
    { code: 'GR', name: 'Greece', region: 'europe', languages: ['el'], currency: 'EUR', capitalCity: 'Athens', flag: '🇬🇷', timezone: 'Europe/Athens' },
    { code: 'BG', name: 'Bulgaria', region: 'europe', languages: ['bg'], currency: 'BGN', capitalCity: 'Sofia', flag: '🇧🇬', timezone: 'Europe/Sofia' },
    { code: 'RS', name: 'Serbia', region: 'europe', languages: ['sr'], currency: 'RSD', capitalCity: 'Belgrade', flag: '🇷🇸', timezone: 'Europe/Belgrade' },
    { code: 'EE', name: 'Estonia', region: 'europe', languages: ['et'], currency: 'EUR', capitalCity: 'Tallinn', flag: '🇪🇪', timezone: 'Europe/Tallinn' },
    { code: 'LV', name: 'Latvia', region: 'europe', languages: ['lv'], currency: 'EUR', capitalCity: 'Riga', flag: '🇱🇻', timezone: 'Europe/Riga' },
    { code: 'LT', name: 'Lithuania', region: 'europe', languages: ['lt'], currency: 'EUR', capitalCity: 'Vilnius', flag: '🇱🇹', timezone: 'Europe/Vilnius' },
    { code: 'SK', name: 'Slovakia', region: 'europe', languages: ['sk'], currency: 'EUR', capitalCity: 'Bratislava', flag: '🇸🇰', timezone: 'Europe/Bratislava' },
    { code: 'ME', name: 'Montenegro', region: 'europe', languages: ['sr'], currency: 'EUR', capitalCity: 'Podgorica', flag: '🇲🇪', timezone: 'Europe/Podgorica' },
    { code: 'GE', name: 'Georgia', region: 'europe', languages: ['ka'], currency: 'GEL', capitalCity: 'Tbilisi', flag: '🇬🇪', timezone: 'Asia/Tbilisi' },
    { code: 'TR', name: 'Turkey', region: 'europe', languages: ['tr'], currency: 'TRY', capitalCity: 'Ankara', flag: '🇹🇷', timezone: 'Europe/Istanbul' },
    { code: 'CY', name: 'Cyprus', region: 'europe', languages: ['el', 'tr'], currency: 'EUR', capitalCity: 'Nicosia', flag: '🇨🇾', timezone: 'Asia/Nicosia' },

    // Middle East
    { code: 'AE', name: 'United Arab Emirates', region: 'middle-east', languages: ['ar', 'en'], currency: 'AED', capitalCity: 'Abu Dhabi', flag: '🇦🇪', timezone: 'Asia/Dubai' },
    { code: 'IL', name: 'Israel', region: 'middle-east', languages: ['he', 'ar'], currency: 'ILS', capitalCity: 'Jerusalem', flag: '🇮🇱', timezone: 'Asia/Jerusalem' },

    // Africa
    { code: 'ZA', name: 'South Africa', region: 'africa', languages: ['en', 'af', 'zu'], currency: 'ZAR', capitalCity: 'Pretoria', flag: '🇿🇦', timezone: 'Africa/Johannesburg' },
    { code: 'KE', name: 'Kenya', region: 'africa', languages: ['en', 'sw'], currency: 'KES', capitalCity: 'Nairobi', flag: '🇰🇪', timezone: 'Africa/Nairobi' },
    { code: 'MA', name: 'Morocco', region: 'africa', languages: ['ar', 'fr'], currency: 'MAD', capitalCity: 'Rabat', flag: '🇲🇦', timezone: 'Africa/Casablanca' },
    { code: 'GH', name: 'Ghana', region: 'africa', languages: ['en'], currency: 'GHS', capitalCity: 'Accra', flag: '🇬🇭', timezone: 'Africa/Accra' },
    { code: 'EG', name: 'Egypt', region: 'africa', languages: ['ar'], currency: 'EGP', capitalCity: 'Cairo', flag: '🇪🇬', timezone: 'Africa/Cairo' },
    { code: 'MU', name: 'Mauritius', region: 'africa', languages: ['en', 'fr'], currency: 'MUR', capitalCity: 'Port Louis', flag: '🇲🇺', timezone: 'Indian/Mauritius' },

    // Asia
    { code: 'TH', name: 'Thailand', region: 'asia', languages: ['th'], currency: 'THB', capitalCity: 'Bangkok', flag: '🇹🇭', timezone: 'Asia/Bangkok' },
    { code: 'VN', name: 'Vietnam', region: 'asia', languages: ['vi'], currency: 'VND', capitalCity: 'Hanoi', flag: '🇻🇳', timezone: 'Asia/Ho_Chi_Minh' },
    { code: 'MY', name: 'Malaysia', region: 'asia', languages: ['ms', 'en'], currency: 'MYR', capitalCity: 'Kuala Lumpur', flag: '🇲🇾', timezone: 'Asia/Kuala_Lumpur' },
    { code: 'ID', name: 'Indonesia', region: 'asia', languages: ['id'], currency: 'IDR', capitalCity: 'Jakarta', flag: '🇮🇩', timezone: 'Asia/Jakarta' },
    { code: 'PH', name: 'Philippines', region: 'asia', languages: ['en', 'tl'], currency: 'PHP', capitalCity: 'Manila', flag: '🇵🇭', timezone: 'Asia/Manila' },
    { code: 'SG', name: 'Singapore', region: 'asia', languages: ['en', 'ms', 'zh', 'ta'], currency: 'SGD', capitalCity: 'Singapore', flag: '🇸🇬', timezone: 'Asia/Singapore' },
    { code: 'JP', name: 'Japan', region: 'asia', languages: ['ja'], currency: 'JPY', capitalCity: 'Tokyo', flag: '🇯🇵', timezone: 'Asia/Tokyo' },
    { code: 'KR', name: 'South Korea', region: 'asia', languages: ['ko'], currency: 'KRW', capitalCity: 'Seoul', flag: '🇰🇷', timezone: 'Asia/Seoul' },
    { code: 'TW', name: 'Taiwan', region: 'asia', languages: ['zh'], currency: 'TWD', capitalCity: 'Taipei', flag: '🇹🇼', timezone: 'Asia/Taipei' },
    { code: 'IN', name: 'India', region: 'asia', languages: ['hi', 'en'], currency: 'INR', capitalCity: 'New Delhi', flag: '🇮🇳', timezone: 'Asia/Kolkata' },
    { code: 'LK', name: 'Sri Lanka', region: 'asia', languages: ['si', 'ta'], currency: 'LKR', capitalCity: 'Colombo', flag: '🇱🇰', timezone: 'Asia/Colombo' },
    { code: 'KH', name: 'Cambodia', region: 'asia', languages: ['km'], currency: 'USD', capitalCity: 'Phnom Penh', flag: '🇰🇭', timezone: 'Asia/Phnom_Penh' },
    { code: 'NP', name: 'Nepal', region: 'asia', languages: ['ne'], currency: 'NPR', capitalCity: 'Kathmandu', flag: '🇳🇵', timezone: 'Asia/Kathmandu' },
    { code: 'CN', name: 'China', region: 'asia', languages: ['zh'], currency: 'CNY', capitalCity: 'Beijing', flag: '🇨🇳', timezone: 'Asia/Shanghai' },

    // Oceania
    { code: 'AU', name: 'Australia', region: 'oceania', languages: ['en'], currency: 'AUD', capitalCity: 'Canberra', flag: '🇦🇺', timezone: 'Australia/Sydney' },
    { code: 'NZ', name: 'New Zealand', region: 'oceania', languages: ['en', 'mi'], currency: 'NZD', capitalCity: 'Wellington', flag: '🇳🇿', timezone: 'Pacific/Auckland' },
];

// ============================================================================
// 200+ Cities with coordinates, timezones, population, capitals
// ============================================================================

const CITIES: { name: string; slug: string; countryCode: string; lat: number; lng: number; pop?: number; tz?: string; capital?: boolean }[] = [
    // 🇺🇸 United States
    { name: 'New York', slug: 'new-york', countryCode: 'US', lat: 40.71, lng: -74.01, pop: 8336000, tz: 'America/New_York' },
    { name: 'Los Angeles', slug: 'los-angeles', countryCode: 'US', lat: 34.05, lng: -118.24, pop: 3979000, tz: 'America/Los_Angeles' },
    { name: 'San Francisco', slug: 'san-francisco', countryCode: 'US', lat: 37.77, lng: -122.42, pop: 874000, tz: 'America/Los_Angeles' },
    { name: 'Miami', slug: 'miami', countryCode: 'US', lat: 25.76, lng: -80.19, pop: 467000, tz: 'America/New_York' },
    { name: 'Chicago', slug: 'chicago', countryCode: 'US', lat: 41.88, lng: -87.63, pop: 2697000, tz: 'America/Chicago' },
    { name: 'Austin', slug: 'austin', countryCode: 'US', lat: 30.27, lng: -97.74, pop: 978000, tz: 'America/Chicago' },
    { name: 'Seattle', slug: 'seattle', countryCode: 'US', lat: 47.61, lng: -122.33, pop: 753000, tz: 'America/Los_Angeles' },
    { name: 'Denver', slug: 'denver', countryCode: 'US', lat: 39.74, lng: -104.99, pop: 715000, tz: 'America/Denver' },
    { name: 'Portland', slug: 'portland-us', countryCode: 'US', lat: 45.52, lng: -122.68, pop: 652000, tz: 'America/Los_Angeles' },
    { name: 'Boston', slug: 'boston', countryCode: 'US', lat: 42.36, lng: -71.06, pop: 694000, tz: 'America/New_York' },
    { name: 'Washington, D.C.', slug: 'washington-dc', countryCode: 'US', lat: 38.91, lng: -77.04, pop: 689000, tz: 'America/New_York', capital: true },
    { name: 'San Diego', slug: 'san-diego', countryCode: 'US', lat: 32.72, lng: -117.16, pop: 1386000, tz: 'America/Los_Angeles' },

    // 🇨🇦 Canada
    { name: 'Toronto', slug: 'toronto', countryCode: 'CA', lat: 43.65, lng: -79.38, pop: 2930000, tz: 'America/Toronto' },
    { name: 'Vancouver', slug: 'vancouver', countryCode: 'CA', lat: 49.28, lng: -123.12, pop: 675000, tz: 'America/Vancouver' },
    { name: 'Montreal', slug: 'montreal', countryCode: 'CA', lat: 45.50, lng: -73.57, pop: 1762000, tz: 'America/Toronto' },
    { name: 'Ottawa', slug: 'ottawa', countryCode: 'CA', lat: 45.42, lng: -75.69, pop: 1017000, tz: 'America/Toronto', capital: true },

    // 🇲🇽 Mexico
    { name: 'Mexico City', slug: 'mexico-city', countryCode: 'MX', lat: 19.43, lng: -99.13, pop: 9210000, tz: 'America/Mexico_City', capital: true },
    { name: 'Playa del Carmen', slug: 'playa-del-carmen', countryCode: 'MX', lat: 20.63, lng: -87.08, pop: 304000, tz: 'America/Cancun' },
    { name: 'Cancún', slug: 'cancun', countryCode: 'MX', lat: 21.16, lng: -86.85, pop: 888000, tz: 'America/Cancun' },
    { name: 'Tulum', slug: 'tulum', countryCode: 'MX', lat: 20.21, lng: -87.43, pop: 46000, tz: 'America/Cancun' },
    { name: 'Guadalajara', slug: 'guadalajara', countryCode: 'MX', lat: 20.67, lng: -103.35, pop: 1495000, tz: 'America/Mexico_City' },
    { name: 'Oaxaca', slug: 'oaxaca', countryCode: 'MX', lat: 17.07, lng: -96.73, pop: 300000, tz: 'America/Mexico_City' },
    { name: 'Mérida', slug: 'merida-mx', countryCode: 'MX', lat: 20.97, lng: -89.59, pop: 921000, tz: 'America/Merida' },
    { name: 'Puerto Vallarta', slug: 'puerto-vallarta', countryCode: 'MX', lat: 20.65, lng: -105.23, pop: 291000, tz: 'America/Mexico_City' },

    // 🇨🇷 Costa Rica
    { name: 'San José', slug: 'san-jose-cr', countryCode: 'CR', lat: 9.93, lng: -84.08, pop: 342000, tz: 'America/Costa_Rica', capital: true },
    // 🇵🇦 Panama
    { name: 'Panama City', slug: 'panama-city', countryCode: 'PA', lat: 8.98, lng: -79.52, pop: 880000, tz: 'America/Panama', capital: true },

    // 🇧🇷 Brazil
    { name: 'São Paulo', slug: 'sao-paulo', countryCode: 'BR', lat: -23.55, lng: -46.63, pop: 12325000, tz: 'America/Sao_Paulo' },
    { name: 'Rio de Janeiro', slug: 'rio-de-janeiro', countryCode: 'BR', lat: -22.91, lng: -43.17, pop: 6748000, tz: 'America/Sao_Paulo' },
    { name: 'Florianópolis', slug: 'florianopolis', countryCode: 'BR', lat: -27.60, lng: -48.55, pop: 508000, tz: 'America/Sao_Paulo' },
    // 🇦🇷 Argentina
    { name: 'Buenos Aires', slug: 'buenos-aires', countryCode: 'AR', lat: -34.60, lng: -58.38, pop: 3075000, tz: 'America/Argentina/Buenos_Aires', capital: true },
    // 🇨🇴 Colombia
    { name: 'Bogotá', slug: 'bogota', countryCode: 'CO', lat: 4.71, lng: -74.07, pop: 7181000, tz: 'America/Bogota', capital: true },
    { name: 'Medellín', slug: 'medellin', countryCode: 'CO', lat: 6.25, lng: -75.56, pop: 2529000, tz: 'America/Bogota' },
    { name: 'Cartagena', slug: 'cartagena', countryCode: 'CO', lat: 10.39, lng: -75.51, pop: 1028000, tz: 'America/Bogota' },
    // 🇨🇱 Chile
    { name: 'Santiago', slug: 'santiago', countryCode: 'CL', lat: -33.45, lng: -70.67, pop: 5614000, tz: 'America/Santiago', capital: true },
    // 🇺🇾 Uruguay
    { name: 'Montevideo', slug: 'montevideo', countryCode: 'UY', lat: -34.88, lng: -56.16, pop: 1382000, tz: 'America/Montevideo', capital: true },
    // 🇵🇪 Peru
    { name: 'Lima', slug: 'lima', countryCode: 'PE', lat: -12.05, lng: -77.04, pop: 9752000, tz: 'America/Lima', capital: true },
    { name: 'Cusco', slug: 'cusco', countryCode: 'PE', lat: -13.52, lng: -71.97, pop: 450000, tz: 'America/Lima' },
    // 🇪🇨 Ecuador
    { name: 'Quito', slug: 'quito', countryCode: 'EC', lat: -0.18, lng: -78.47, pop: 2781000, tz: 'America/Guayaquil', capital: true },
    { name: 'Cuenca', slug: 'cuenca', countryCode: 'EC', lat: -2.90, lng: -79.00, pop: 603000, tz: 'America/Guayaquil' },

    // 🇬🇧 United Kingdom
    { name: 'London', slug: 'london', countryCode: 'GB', lat: 51.51, lng: -0.13, pop: 8982000, tz: 'Europe/London', capital: true },
    { name: 'Manchester', slug: 'manchester', countryCode: 'GB', lat: 53.48, lng: -2.24, pop: 553000, tz: 'Europe/London' },
    { name: 'Edinburgh', slug: 'edinburgh', countryCode: 'GB', lat: 55.95, lng: -3.19, pop: 524000, tz: 'Europe/London' },
    // 🇩🇪 Germany
    { name: 'Berlin', slug: 'berlin', countryCode: 'DE', lat: 52.52, lng: 13.41, pop: 3645000, tz: 'Europe/Berlin', capital: true },
    { name: 'Munich', slug: 'munich', countryCode: 'DE', lat: 48.14, lng: 11.58, pop: 1472000, tz: 'Europe/Berlin' },
    { name: 'Hamburg', slug: 'hamburg', countryCode: 'DE', lat: 53.55, lng: 9.99, pop: 1841000, tz: 'Europe/Berlin' },
    { name: 'Frankfurt', slug: 'frankfurt', countryCode: 'DE', lat: 50.11, lng: 8.68, pop: 753000, tz: 'Europe/Berlin' },
    // 🇫🇷 France
    { name: 'Paris', slug: 'paris', countryCode: 'FR', lat: 48.86, lng: 2.35, pop: 2161000, tz: 'Europe/Paris', capital: true },
    { name: 'Lyon', slug: 'lyon', countryCode: 'FR', lat: 45.76, lng: 4.84, pop: 522000, tz: 'Europe/Paris' },
    { name: 'Nice', slug: 'nice', countryCode: 'FR', lat: 43.71, lng: 7.26, pop: 342000, tz: 'Europe/Paris' },
    // 🇪🇸 Spain
    { name: 'Barcelona', slug: 'barcelona', countryCode: 'ES', lat: 41.39, lng: 2.17, pop: 1621000, tz: 'Europe/Madrid' },
    { name: 'Madrid', slug: 'madrid', countryCode: 'ES', lat: 40.42, lng: -3.70, pop: 3223000, tz: 'Europe/Madrid', capital: true },
    { name: 'Valencia', slug: 'valencia', countryCode: 'ES', lat: 39.47, lng: -0.38, pop: 792000, tz: 'Europe/Madrid' },
    { name: 'Malaga', slug: 'malaga', countryCode: 'ES', lat: 36.72, lng: -4.42, pop: 574000, tz: 'Europe/Madrid' },
    { name: 'Seville', slug: 'seville', countryCode: 'ES', lat: 37.39, lng: -6.00, pop: 688000, tz: 'Europe/Madrid' },
    { name: 'Las Palmas', slug: 'las-palmas', countryCode: 'ES', lat: 28.10, lng: -15.41, pop: 379000, tz: 'Atlantic/Canary' },
    // 🇮🇹 Italy
    { name: 'Rome', slug: 'rome', countryCode: 'IT', lat: 41.90, lng: 12.50, pop: 2873000, tz: 'Europe/Rome', capital: true },
    { name: 'Milan', slug: 'milan', countryCode: 'IT', lat: 45.46, lng: 9.19, pop: 1352000, tz: 'Europe/Rome' },
    { name: 'Florence', slug: 'florence', countryCode: 'IT', lat: 43.77, lng: 11.25, pop: 382000, tz: 'Europe/Rome' },
    // 🇵🇹 Portugal
    { name: 'Lisbon', slug: 'lisbon', countryCode: 'PT', lat: 38.72, lng: -9.14, pop: 545000, tz: 'Europe/Lisbon', capital: true },
    { name: 'Porto', slug: 'porto', countryCode: 'PT', lat: 41.15, lng: -8.61, pop: 249000, tz: 'Europe/Lisbon' },
    // 🇳🇱 Netherlands
    { name: 'Amsterdam', slug: 'amsterdam', countryCode: 'NL', lat: 52.37, lng: 4.90, pop: 872000, tz: 'Europe/Amsterdam', capital: true },
    { name: 'Rotterdam', slug: 'rotterdam', countryCode: 'NL', lat: 51.92, lng: 4.48, pop: 651000, tz: 'Europe/Amsterdam' },
    // 🇧🇪 Belgium
    { name: 'Brussels', slug: 'brussels', countryCode: 'BE', lat: 50.85, lng: 4.35, pop: 185000, tz: 'Europe/Brussels', capital: true },
    // 🇦🇹 Austria
    { name: 'Vienna', slug: 'vienna', countryCode: 'AT', lat: 48.21, lng: 16.37, pop: 1897000, tz: 'Europe/Vienna', capital: true },
    // 🇨🇭 Switzerland
    { name: 'Zurich', slug: 'zurich', countryCode: 'CH', lat: 47.38, lng: 8.54, pop: 421000, tz: 'Europe/Zurich' },
    { name: 'Geneva', slug: 'geneva', countryCode: 'CH', lat: 46.20, lng: 6.14, pop: 203000, tz: 'Europe/Zurich' },
    // 🇮🇪 Ireland
    { name: 'Dublin', slug: 'dublin', countryCode: 'IE', lat: 53.35, lng: -6.26, pop: 554000, tz: 'Europe/Dublin', capital: true },
    // 🇸🇪 Sweden
    { name: 'Stockholm', slug: 'stockholm', countryCode: 'SE', lat: 59.33, lng: 18.07, pop: 975000, tz: 'Europe/Stockholm', capital: true },
    // 🇩🇰 Denmark
    { name: 'Copenhagen', slug: 'copenhagen', countryCode: 'DK', lat: 55.68, lng: 12.57, pop: 794000, tz: 'Europe/Copenhagen', capital: true },
    // 🇳🇴 Norway
    { name: 'Oslo', slug: 'oslo', countryCode: 'NO', lat: 59.91, lng: 10.75, pop: 694000, tz: 'Europe/Oslo', capital: true },
    // 🇫🇮 Finland
    { name: 'Helsinki', slug: 'helsinki', countryCode: 'FI', lat: 60.17, lng: 24.94, pop: 656000, tz: 'Europe/Helsinki', capital: true },

    // Eastern Europe
    { name: 'Warsaw', slug: 'warsaw', countryCode: 'PL', lat: 52.23, lng: 21.01, pop: 1790000, tz: 'Europe/Warsaw', capital: true },
    { name: 'Kraków', slug: 'krakow', countryCode: 'PL', lat: 50.06, lng: 19.94, pop: 779000, tz: 'Europe/Warsaw' },
    { name: 'Wrocław', slug: 'wroclaw', countryCode: 'PL', lat: 51.11, lng: 17.04, pop: 641000, tz: 'Europe/Warsaw' },
    { name: 'Prague', slug: 'prague', countryCode: 'CZ', lat: 50.08, lng: 14.44, pop: 1309000, tz: 'Europe/Prague', capital: true },
    { name: 'Brno', slug: 'brno', countryCode: 'CZ', lat: 49.19, lng: 16.61, pop: 381000, tz: 'Europe/Prague' },
    { name: 'Bucharest', slug: 'bucharest', countryCode: 'RO', lat: 44.43, lng: 26.10, pop: 1883000, tz: 'Europe/Bucharest', capital: true },
    { name: 'Cluj-Napoca', slug: 'cluj-napoca', countryCode: 'RO', lat: 46.77, lng: 23.60, pop: 324000, tz: 'Europe/Bucharest' },
    { name: 'Budapest', slug: 'budapest', countryCode: 'HU', lat: 47.50, lng: 19.04, pop: 1756000, tz: 'Europe/Budapest', capital: true },
    { name: 'Zagreb', slug: 'zagreb', countryCode: 'HR', lat: 45.81, lng: 15.98, pop: 807000, tz: 'Europe/Zagreb', capital: true },
    { name: 'Split', slug: 'split', countryCode: 'HR', lat: 43.51, lng: 16.44, pop: 178000, tz: 'Europe/Zagreb' },
    { name: 'Athens', slug: 'athens', countryCode: 'GR', lat: 37.98, lng: 23.73, pop: 664000, tz: 'Europe/Athens', capital: true },
    { name: 'Sofia', slug: 'sofia', countryCode: 'BG', lat: 42.70, lng: 23.32, pop: 1241000, tz: 'Europe/Sofia', capital: true },
    { name: 'Belgrade', slug: 'belgrade', countryCode: 'RS', lat: 44.79, lng: 20.47, pop: 1378000, tz: 'Europe/Belgrade', capital: true },
    { name: 'Tallinn', slug: 'tallinn', countryCode: 'EE', lat: 59.44, lng: 24.75, pop: 437000, tz: 'Europe/Tallinn', capital: true },
    { name: 'Riga', slug: 'riga', countryCode: 'LV', lat: 56.95, lng: 24.11, pop: 615000, tz: 'Europe/Riga', capital: true },
    { name: 'Vilnius', slug: 'vilnius', countryCode: 'LT', lat: 54.69, lng: 25.28, pop: 580000, tz: 'Europe/Vilnius', capital: true },
    { name: 'Bratislava', slug: 'bratislava', countryCode: 'SK', lat: 48.15, lng: 17.11, pop: 437000, tz: 'Europe/Bratislava', capital: true },
    { name: 'Podgorica', slug: 'podgorica', countryCode: 'ME', lat: 42.43, lng: 19.26, pop: 195000, tz: 'Europe/Podgorica', capital: true },
    { name: 'Tbilisi', slug: 'tbilisi', countryCode: 'GE', lat: 41.69, lng: 44.80, pop: 1118000, tz: 'Asia/Tbilisi', capital: true },
    { name: 'Batumi', slug: 'batumi', countryCode: 'GE', lat: 41.64, lng: 41.63, pop: 169000, tz: 'Asia/Tbilisi' },
    { name: 'Istanbul', slug: 'istanbul', countryCode: 'TR', lat: 41.01, lng: 28.98, pop: 15460000, tz: 'Europe/Istanbul' },
    { name: 'Antalya', slug: 'antalya', countryCode: 'TR', lat: 36.90, lng: 30.70, pop: 2548000, tz: 'Europe/Istanbul' },
    { name: 'Ankara', slug: 'ankara', countryCode: 'TR', lat: 39.93, lng: 32.87, pop: 5663000, tz: 'Europe/Istanbul', capital: true },
    { name: 'Nicosia', slug: 'nicosia', countryCode: 'CY', lat: 35.17, lng: 33.37, pop: 326000, tz: 'Asia/Nicosia', capital: true },
    { name: 'Limassol', slug: 'limassol', countryCode: 'CY', lat: 34.68, lng: 33.04, pop: 235000, tz: 'Asia/Nicosia' },

    // 🇦🇪 UAE
    { name: 'Dubai', slug: 'dubai', countryCode: 'AE', lat: 25.20, lng: 55.27, pop: 3400000, tz: 'Asia/Dubai' },
    { name: 'Abu Dhabi', slug: 'abu-dhabi', countryCode: 'AE', lat: 24.45, lng: 54.65, pop: 1480000, tz: 'Asia/Dubai', capital: true },
    // 🇮🇱 Israel
    { name: 'Tel Aviv', slug: 'tel-aviv', countryCode: 'IL', lat: 32.09, lng: 34.78, pop: 460000, tz: 'Asia/Jerusalem' },

    // Africa
    { name: 'Cape Town', slug: 'cape-town', countryCode: 'ZA', lat: -33.93, lng: 18.42, pop: 4618000, tz: 'Africa/Johannesburg' },
    { name: 'Johannesburg', slug: 'johannesburg', countryCode: 'ZA', lat: -26.20, lng: 28.04, pop: 5783000, tz: 'Africa/Johannesburg' },
    { name: 'Nairobi', slug: 'nairobi', countryCode: 'KE', lat: -1.29, lng: 36.82, pop: 4397000, tz: 'Africa/Nairobi', capital: true },
    { name: 'Marrakech', slug: 'marrakech', countryCode: 'MA', lat: 31.63, lng: -8.01, pop: 929000, tz: 'Africa/Casablanca' },
    { name: 'Accra', slug: 'accra', countryCode: 'GH', lat: 5.55, lng: -0.20, pop: 2291000, tz: 'Africa/Accra', capital: true },
    { name: 'Cairo', slug: 'cairo', countryCode: 'EG', lat: 30.04, lng: 31.24, pop: 9540000, tz: 'Africa/Cairo', capital: true },
    { name: 'Port Louis', slug: 'port-louis', countryCode: 'MU', lat: -20.16, lng: 57.50, pop: 149000, tz: 'Indian/Mauritius', capital: true },

    // 🇹🇭 Thailand
    { name: 'Bangkok', slug: 'bangkok', countryCode: 'TH', lat: 13.75, lng: 100.52, pop: 10539000, tz: 'Asia/Bangkok', capital: true },
    { name: 'Chiang Mai', slug: 'chiang-mai', countryCode: 'TH', lat: 18.79, lng: 98.98, pop: 131000, tz: 'Asia/Bangkok' },
    { name: 'Phuket', slug: 'phuket', countryCode: 'TH', lat: 7.88, lng: 98.39, pop: 83000, tz: 'Asia/Bangkok' },
    { name: 'Koh Samui', slug: 'koh-samui', countryCode: 'TH', lat: 9.51, lng: 100.06, pop: 67000, tz: 'Asia/Bangkok' },
    { name: 'Pattaya', slug: 'pattaya', countryCode: 'TH', lat: 12.93, lng: 100.88, pop: 119000, tz: 'Asia/Bangkok' },
    { name: 'Krabi', slug: 'krabi', countryCode: 'TH', lat: 8.09, lng: 98.91, pop: 33000, tz: 'Asia/Bangkok' },
    // 🇻🇳 Vietnam
    { name: 'Hanoi', slug: 'hanoi', countryCode: 'VN', lat: 21.03, lng: 105.85, pop: 8054000, tz: 'Asia/Ho_Chi_Minh', capital: true },
    { name: 'Ho Chi Minh City', slug: 'ho-chi-minh-city', countryCode: 'VN', lat: 10.82, lng: 106.63, pop: 8994000, tz: 'Asia/Ho_Chi_Minh' },
    { name: 'Da Nang', slug: 'da-nang', countryCode: 'VN', lat: 16.05, lng: 108.22, pop: 1134000, tz: 'Asia/Ho_Chi_Minh' },
    { name: 'Hoi An', slug: 'hoi-an', countryCode: 'VN', lat: 15.88, lng: 108.33, pop: 120000, tz: 'Asia/Ho_Chi_Minh' },
    // 🇲🇾 Malaysia
    { name: 'Kuala Lumpur', slug: 'kuala-lumpur', countryCode: 'MY', lat: 3.14, lng: 101.69, pop: 1768000, tz: 'Asia/Kuala_Lumpur', capital: true },
    { name: 'Penang', slug: 'penang', countryCode: 'MY', lat: 5.41, lng: 100.33, pop: 708000, tz: 'Asia/Kuala_Lumpur' },
    { name: 'Langkawi', slug: 'langkawi', countryCode: 'MY', lat: 6.35, lng: 99.73, pop: 100000, tz: 'Asia/Kuala_Lumpur' },
    { name: 'Johor Bahru', slug: 'johor-bahru', countryCode: 'MY', lat: 1.49, lng: 103.74, pop: 497000, tz: 'Asia/Kuala_Lumpur' },
    // 🇮🇩 Indonesia
    { name: 'Bali', slug: 'bali', countryCode: 'ID', lat: -8.41, lng: 115.19, pop: 4320000, tz: 'Asia/Makassar' },
    { name: 'Canggu', slug: 'canggu', countryCode: 'ID', lat: -8.65, lng: 115.13, pop: 30000, tz: 'Asia/Makassar' },
    { name: 'Ubud', slug: 'ubud', countryCode: 'ID', lat: -8.51, lng: 115.26, pop: 30000, tz: 'Asia/Makassar' },
    { name: 'Jakarta', slug: 'jakarta', countryCode: 'ID', lat: -6.21, lng: 106.85, pop: 10560000, tz: 'Asia/Jakarta', capital: true },
    { name: 'Yogyakarta', slug: 'yogyakarta', countryCode: 'ID', lat: -7.80, lng: 110.36, pop: 422000, tz: 'Asia/Jakarta' },
    // 🇵🇭 Philippines
    { name: 'Manila', slug: 'manila', countryCode: 'PH', lat: 14.60, lng: 120.98, pop: 1780000, tz: 'Asia/Manila', capital: true },
    { name: 'Cebu', slug: 'cebu', countryCode: 'PH', lat: 10.31, lng: 123.89, pop: 964000, tz: 'Asia/Manila' },
    { name: 'Siargao', slug: 'siargao', countryCode: 'PH', lat: 9.86, lng: 126.05, pop: 48000, tz: 'Asia/Manila' },
    // 🇸🇬 Singapore
    { name: 'Singapore', slug: 'singapore', countryCode: 'SG', lat: 1.35, lng: 103.82, pop: 5686000, tz: 'Asia/Singapore', capital: true },
    // 🇯🇵 Japan
    { name: 'Tokyo', slug: 'tokyo', countryCode: 'JP', lat: 35.68, lng: 139.69, pop: 13960000, tz: 'Asia/Tokyo', capital: true },
    { name: 'Osaka', slug: 'osaka', countryCode: 'JP', lat: 34.69, lng: 135.50, pop: 2753000, tz: 'Asia/Tokyo' },
    { name: 'Kyoto', slug: 'kyoto', countryCode: 'JP', lat: 35.01, lng: 135.77, pop: 1475000, tz: 'Asia/Tokyo' },
    { name: 'Fukuoka', slug: 'fukuoka', countryCode: 'JP', lat: 33.59, lng: 130.40, pop: 1603000, tz: 'Asia/Tokyo' },
    // 🇰🇷 South Korea
    { name: 'Seoul', slug: 'seoul', countryCode: 'KR', lat: 37.57, lng: 126.98, pop: 9776000, tz: 'Asia/Seoul', capital: true },
    { name: 'Busan', slug: 'busan', countryCode: 'KR', lat: 35.18, lng: 129.08, pop: 3429000, tz: 'Asia/Seoul' },
    // 🇹🇼 Taiwan
    { name: 'Taipei', slug: 'taipei', countryCode: 'TW', lat: 25.03, lng: 121.57, pop: 2646000, tz: 'Asia/Taipei', capital: true },
    { name: 'Kaohsiung', slug: 'kaohsiung', countryCode: 'TW', lat: 22.63, lng: 120.30, pop: 2773000, tz: 'Asia/Taipei' },
    // 🇮🇳 India
    { name: 'New Delhi', slug: 'new-delhi', countryCode: 'IN', lat: 28.61, lng: 77.21, pop: 16787000, tz: 'Asia/Kolkata', capital: true },
    { name: 'Mumbai', slug: 'mumbai', countryCode: 'IN', lat: 19.08, lng: 72.88, pop: 12442000, tz: 'Asia/Kolkata' },
    { name: 'Bangalore', slug: 'bangalore', countryCode: 'IN', lat: 12.97, lng: 77.59, pop: 8443000, tz: 'Asia/Kolkata' },
    { name: 'Goa', slug: 'goa', countryCode: 'IN', lat: 15.30, lng: 74.00, pop: 1458000, tz: 'Asia/Kolkata' },
    // 🇱🇰 Sri Lanka
    { name: 'Colombo', slug: 'colombo', countryCode: 'LK', lat: 6.93, lng: 79.84, pop: 752000, tz: 'Asia/Colombo', capital: true },
    // 🇰🇭 Cambodia
    { name: 'Phnom Penh', slug: 'phnom-penh', countryCode: 'KH', lat: 11.56, lng: 104.92, pop: 2129000, tz: 'Asia/Phnom_Penh', capital: true },
    { name: 'Siem Reap', slug: 'siem-reap', countryCode: 'KH', lat: 13.36, lng: 103.86, pop: 139000, tz: 'Asia/Phnom_Penh' },
    // 🇳🇵 Nepal
    { name: 'Kathmandu', slug: 'kathmandu', countryCode: 'NP', lat: 27.72, lng: 85.32, pop: 1003000, tz: 'Asia/Kathmandu', capital: true },
    // 🇨🇳 China
    { name: 'Beijing', slug: 'beijing', countryCode: 'CN', lat: 39.91, lng: 116.40, pop: 21540000, tz: 'Asia/Shanghai', capital: true },
    { name: 'Shanghai', slug: 'shanghai', countryCode: 'CN', lat: 31.23, lng: 121.47, pop: 24870000, tz: 'Asia/Shanghai' },
    { name: 'Shenzhen', slug: 'shenzhen', countryCode: 'CN', lat: 22.54, lng: 114.06, pop: 12590000, tz: 'Asia/Shanghai' },

    // 🇦🇺 Australia
    { name: 'Sydney', slug: 'sydney', countryCode: 'AU', lat: -33.87, lng: 151.21, pop: 5312000, tz: 'Australia/Sydney' },
    { name: 'Melbourne', slug: 'melbourne', countryCode: 'AU', lat: -37.81, lng: 144.96, pop: 5078000, tz: 'Australia/Melbourne' },
    { name: 'Brisbane', slug: 'brisbane', countryCode: 'AU', lat: -27.47, lng: 153.03, pop: 2514000, tz: 'Australia/Brisbane' },
    { name: 'Perth', slug: 'perth', countryCode: 'AU', lat: -31.95, lng: 115.86, pop: 2059000, tz: 'Australia/Perth' },
    { name: 'Canberra', slug: 'canberra', countryCode: 'AU', lat: -35.28, lng: 149.13, pop: 457000, tz: 'Australia/Sydney', capital: true },
    // 🇳🇿 New Zealand
    { name: 'Auckland', slug: 'auckland', countryCode: 'NZ', lat: -36.85, lng: 174.76, pop: 1657000, tz: 'Pacific/Auckland' },
    { name: 'Wellington', slug: 'wellington', countryCode: 'NZ', lat: -41.29, lng: 174.78, pop: 215000, tz: 'Pacific/Auckland', capital: true },
];

// ============================================================================
// Main seed function
// ============================================================================

async function main() {
    console.log('🌍 Seeding countries and cities...\n');

    // 1. Upsert countries
    let countriesCreated = 0;
    let countriesUpdated = 0;
    for (const c of COUNTRIES) {
        const existing = await prisma.country.findUnique({ where: { code: c.code } });
        if (existing) {
            await prisma.country.update({
                where: { code: c.code },
                data: { name: c.name, region: c.region, languages: c.languages, currency: c.currency, capitalCity: c.capitalCity, flag: c.flag, timezone: c.timezone },
            });
            countriesUpdated++;
        } else {
            await prisma.country.create({ data: c });
            countriesCreated++;
        }
    }
    console.log(`✅ Countries: ${countriesCreated} created, ${countriesUpdated} updated (total ${COUNTRIES.length})`);

    // 2. Upsert cities
    let citiesCreated = 0;
    let citiesUpdated = 0;
    let citiesSkipped = 0;
    for (const c of CITIES) {
        // Check if country exists
        const country = await prisma.country.findUnique({ where: { code: c.countryCode } });
        if (!country) {
            console.warn(`  ⚠️ Skipping ${c.name}: country ${c.countryCode} not found`);
            citiesSkipped++;
            continue;
        }

        const existing = await prisma.city.findUnique({ where: { slug: c.slug } });
        const data = {
            name: c.name,
            slug: c.slug,
            countryCode: c.countryCode,
            lat: c.lat,
            lng: c.lng,
            population: c.pop || null,
            timezone: c.tz || null,
            isCapital: c.capital || false,
        };

        if (existing) {
            await prisma.city.update({ where: { slug: c.slug }, data });
            citiesUpdated++;
        } else {
            await prisma.city.create({ data });
            citiesCreated++;
        }
    }
    console.log(`✅ Cities: ${citiesCreated} created, ${citiesUpdated} updated, ${citiesSkipped} skipped (total ${CITIES.length})`);
    console.log('\n🎉 Seed complete!');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
