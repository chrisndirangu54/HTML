import {readFile} from 'node:fs/promises';
import {getApps, initializeApp, applicationDefault} from 'firebase-admin/app';
import {FieldValue, getFirestore} from 'firebase-admin/firestore';

const products = JSON.parse(await readFile(new URL('../data/products.json', import.meta.url), 'utf8'));
if (!Array.isArray(products) || products.length === 0) throw new Error('data/products.json is empty');

if (!getApps().length) {
  initializeApp({credential: applicationDefault()});
}
const db = getFirestore();

for (let offset = 0; offset < products.length; offset += 400) {
  const batch = db.batch();
  for (const product of products.slice(offset, offset + 400)) {
    if (!product.id || !Number.isSafeInteger(product.priceKes) || product.priceKes < 1) {
      throw new Error(`Invalid product ${product.id || '<missing id>'}`);
    }

    // Market-reference catalogue data is intentionally separate from real
    // TeknTandao inventory. Re-running this script must never overwrite a
    // merchant's live stock or accidentally activate a product for checkout.
    const {id, stock: referenceStock, active: suggestedActive, ...catalogue} = product;
    batch.set(db.collection('products').doc(id), {
      ...catalogue,
      catalogueSuggestedActive: suggestedActive !== false,
      referenceStock,
      seededFrom: 'data/products.json',
      seededAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, {merge: true});
  }
  await batch.commit();
}

console.log(`Seeded ${products.length} catalogue records without changing live stock/active state.`);
console.log('Set each Firestore product active=true and a real integer stock quantity only after verifying TeknTandao inventory.');
