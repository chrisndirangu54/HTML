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
    const {id, ...data} = product;
    batch.set(db.collection('products').doc(id), {
      ...data,
      seededFrom: 'data/products.json',
      seededAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, {merge: true});
  }
  await batch.commit();
}

console.log(`Seeded ${products.length} TeknTandao products.`);
