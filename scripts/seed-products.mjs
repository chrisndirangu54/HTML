import {readFile} from 'node:fs/promises';
import {getApps, initializeApp, applicationDefault} from 'firebase-admin/app';
import {FieldValue, getFirestore} from 'firebase-admin/firestore';

const products = JSON.parse(await readFile(new URL('../data/products.json', import.meta.url), 'utf8'));
if (!Array.isArray(products) || products.length === 0) throw new Error('data/products.json is empty');

if (!getApps().length) {
  initializeApp({credential: applicationDefault()});
}
const db = getFirestore();

for (let offset = 0; offset < products.length; offset += 200) {
  const batch = db.batch();
  for (const product of products.slice(offset, offset + 200)) {
    if (!product.id || (!product.quoteOnly && (!Number.isSafeInteger(product.priceKes) || product.priceKes < 1))) {
      throw new Error(`Invalid product ${product.id || '<missing id>'}`);
    }

    if (product.quoteOnly === true) {
      // Reference models must never receive a merchant price or stock record.
      const { id, stock: ignoredStock, ...reference } = product;
      batch.set(db.collection('ictCommerceCatalog').doc(id), {
        ...reference,
        priceKes: null,
        compareAtKes: null,
        quoteOnly: true,
        active: product.active !== false,
        seededFrom: 'data/products.json',
        seededAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      continue;
    }

    // Market-reference catalogue data is intentionally separate from real
    // TeknTandao inventory. Re-running this script must never overwrite the
    // merchant's live price, stock or active state.
    const {
      id,
      priceKes: marketReferencePriceKes,
      compareAtKes: marketReferenceCompareAtKes,
      stock: referenceStock,
      active: suggestedActive,
      ...catalogue
    } = product;

    batch.set(db.collection('ictCommerceCatalog').doc(id), {
      ...catalogue,
      priceKes: marketReferencePriceKes,
      compareAtKes: marketReferenceCompareAtKes,
      active: suggestedActive !== false,
      marketReferencePriceKes,
      marketReferenceCompareAtKes,
      catalogueSuggestedActive: suggestedActive !== false,
      seededFrom: 'data/products.json',
      seededAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, {merge: true});

    const inventoryRef = db.collection('ictCommerceProducts').doc(id);
    const inventorySnapshot = await inventoryRef.get();
    if (!inventorySnapshot.exists) {
      batch.create(inventoryRef, {
        name: catalogue.name,
        sku: catalogue.sku || id,
        priceKes: 0,
        stock: 0,
        active: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }
  await batch.commit();
}

console.log(`Seeded ${products.length} market-reference catalogue records.`);
console.log('Private inventory documents are initialized only when missing.');
console.log('Set priceKes, stock and active=true only after verifying TeknTandao selling price and physical inventory.');
