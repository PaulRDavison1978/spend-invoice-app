import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const currencies = [
  { code: 'EUR', name: 'Euro',                     exchangeRateToEur: 1.0 },
  { code: 'GBP', name: 'British Pound',             exchangeRateToEur: 1.17 },
  { code: 'USD', name: 'US Dollar',                 exchangeRateToEur: 0.92 },
  { code: 'CHF', name: 'Swiss Franc',               exchangeRateToEur: 1.06 },
  { code: 'SEK', name: 'Swedish Krona',             exchangeRateToEur: 0.088 },
  { code: 'NOK', name: 'Norwegian Krone',            exchangeRateToEur: 0.086 },
  { code: 'DKK', name: 'Danish Krone',               exchangeRateToEur: 0.134 },
  { code: 'PLN', name: 'Polish Zloty',               exchangeRateToEur: 0.232 },
  { code: 'CZK', name: 'Czech Koruna',               exchangeRateToEur: 0.040 },
  { code: 'HUF', name: 'Hungarian Forint',           exchangeRateToEur: 0.0025 },
  { code: 'RON', name: 'Romanian Leu',               exchangeRateToEur: 0.201 },
  { code: 'BGN', name: 'Bulgarian Lev',              exchangeRateToEur: 0.511 },
  { code: 'HRK', name: 'Croatian Kuna',              exchangeRateToEur: 0.133 },
  { code: 'CAD', name: 'Canadian Dollar',             exchangeRateToEur: 0.68 },
  { code: 'AUD', name: 'Australian Dollar',           exchangeRateToEur: 0.60 },
  { code: 'NZD', name: 'New Zealand Dollar',          exchangeRateToEur: 0.55 },
  { code: 'JPY', name: 'Japanese Yen',               exchangeRateToEur: 0.0062 },
  { code: 'CNY', name: 'Chinese Yuan',               exchangeRateToEur: 0.127 },
  { code: 'HKD', name: 'Hong Kong Dollar',            exchangeRateToEur: 0.118 },
  { code: 'SGD', name: 'Singapore Dollar',             exchangeRateToEur: 0.69 },
  { code: 'KRW', name: 'South Korean Won',            exchangeRateToEur: 0.00069 },
  { code: 'INR', name: 'Indian Rupee',                exchangeRateToEur: 0.011 },
  { code: 'MXN', name: 'Mexican Peso',                exchangeRateToEur: 0.052 },
  { code: 'BRL', name: 'Brazilian Real',               exchangeRateToEur: 0.17 },
  { code: 'ZAR', name: 'South African Rand',           exchangeRateToEur: 0.050 },
  { code: 'AED', name: 'UAE Dirham',                   exchangeRateToEur: 0.251 },
  { code: 'SAR', name: 'Saudi Riyal',                  exchangeRateToEur: 0.245 },
  { code: 'ILS', name: 'Israeli Shekel',               exchangeRateToEur: 0.254 },
  { code: 'TRY', name: 'Turkish Lira',                exchangeRateToEur: 0.027 },
  { code: 'THB', name: 'Thai Baht',                   exchangeRateToEur: 0.026 },
  { code: 'MYR', name: 'Malaysian Ringgit',            exchangeRateToEur: 0.208 },
  { code: 'IDR', name: 'Indonesian Rupiah',             exchangeRateToEur: 0.000058 },
  { code: 'PHP', name: 'Philippine Peso',              exchangeRateToEur: 0.016 },
  { code: 'TWD', name: 'Taiwan Dollar',                exchangeRateToEur: 0.029 },
  { code: 'CLP', name: 'Chilean Peso',                exchangeRateToEur: 0.00098 },
  { code: 'COP', name: 'Colombian Peso',              exchangeRateToEur: 0.00022 },
  { code: 'ARS', name: 'Argentine Peso',               exchangeRateToEur: 0.00085 },
  { code: 'EGP', name: 'Egyptian Pound',               exchangeRateToEur: 0.019 },
  { code: 'NGN', name: 'Nigerian Naira',               exchangeRateToEur: 0.00058 },
  { code: 'KES', name: 'Kenyan Shilling',              exchangeRateToEur: 0.0071 },
  { code: 'QAR', name: 'Qatari Riyal',                exchangeRateToEur: 0.253 },
  { code: 'KWD', name: 'Kuwaiti Dinar',               exchangeRateToEur: 3.00 },
  { code: 'BHD', name: 'Bahraini Dinar',              exchangeRateToEur: 2.44 },
  { code: 'OMR', name: 'Omani Rial',                  exchangeRateToEur: 2.39 },
  { code: 'JOD', name: 'Jordanian Dinar',             exchangeRateToEur: 1.30 },
  { code: 'ISK', name: 'Icelandic Krona',             exchangeRateToEur: 0.0067 },
  { code: 'RUB', name: 'Russian Ruble',               exchangeRateToEur: 0.0098 },
  { code: 'UAH', name: 'Ukrainian Hryvnia',            exchangeRateToEur: 0.022 },
  { code: 'VND', name: 'Vietnamese Dong',              exchangeRateToEur: 0.000037 },
  { code: 'PKR', name: 'Pakistani Rupee',              exchangeRateToEur: 0.0033 },
  { code: 'BDT', name: 'Bangladeshi Taka',             exchangeRateToEur: 0.0077 },
  { code: 'LKR', name: 'Sri Lankan Rupee',             exchangeRateToEur: 0.0030 },
];

async function main() {
  let created = 0;
  let updated = 0;

  for (const c of currencies) {
    const existing = await prisma.currency.findUnique({ where: { code: c.code } });
    if (existing) {
      await prisma.currency.update({ where: { code: c.code }, data: { name: c.name, exchangeRateToEur: c.exchangeRateToEur } });
      updated++;
    } else {
      await prisma.currency.create({ data: c });
      created++;
    }
  }

  console.log(`Done: ${created} created, ${updated} updated, ${currencies.length} total.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
