import {collection,getDocs,query,where} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
import {db,firebaseReady} from './auth-client.js';

export const escapeProductText=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function productImage(value){
  try{const url=new URL(value||'',location.href);return value&&/^https?:$/.test(url.protocol)?url.href:'assets/images/services/wifi.jpg'}catch{return 'assets/images/services/wifi.jpg'}
}
export async function loadCatalogue(){
  try{
    if(!firebaseReady||!db)throw new Error('Firebase configuration unavailable');
    const snapshot=await getDocs(query(collection(db,'products'),where('active','==',true)));
    return {products:snapshot.docs.map(doc=>({...doc.data(),id:doc.id})),source:'live'};
  }catch{
    const response=await fetch('data/products.seed.json');
    if(!response.ok)throw new Error('The product catalogue is unavailable. Please try again later.');
    const products=await response.json();
    if(!Array.isArray(products))throw new Error('Invalid product catalogue.');
    return {products:products.filter(product=>product.active!==false),source:'seed'};
  }
}
