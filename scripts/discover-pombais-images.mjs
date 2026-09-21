const assets={
  "portugal/marvao-01.jpg": "https://www.pombais.pt/turismo/wp-content/uploads/2024/08/Imagem-WhatsApp-2025-03-13-as-09.25.12_637d469f-605x605.jpg",
  "portugal/marvao-02.jpg": "https://www.pombais.pt/turismo/wp-content/uploads/2024/08/caption-2-605x605.jpg",
  "portugal/marvao-03.webp": "https://www.pombais.pt/turismo/wp-content/uploads/2024/08/image00015-605x605.webp",
  "portugal/marvao-04.jpg": "https://www.pombais.pt/turismo/wp-content/uploads/2024/08/Imagem-WhatsApp-2025-05-17-as-13.52.53_ba150043-605x605.jpg",
  "budapest/img02.jpg": "https://ezraidereu.com/budapest/wp-content/themes/ezraider/img/gallery/img02.jpg",
  "budapest/img08.jpg": "https://ezraidereu.com/budapest/wp-content/themes/ezraider/img/gallery/img08.jpg",
  "budapest/img12.jpg": "https://ezraidereu.com/budapest/wp-content/themes/ezraider/img/gallery/img12.jpg",
  "budapest/img13.jpg": "https://ezraidereu.com/budapest/wp-content/themes/ezraider/img/gallery/img13.jpg",
  "budapest/img14.jpg": "https://ezraidereu.com/budapest/wp-content/themes/ezraider/img/gallery/img14.jpg",
  "budapest/img15.jpg": "https://ezraidereu.com/budapest/wp-content/themes/ezraider/img/gallery/img15.jpg",
  "budapest/img16.jpg": "https://ezraidereu.com/budapest/wp-content/themes/ezraider/img/gallery/img16.jpg",
  "budapest/img17.jpg": "https://ezraidereu.com/budapest/wp-content/themes/ezraider/img/gallery/img17.jpg"
};
for(const [name,url] of Object.entries(assets)){
  const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 VOY-PRO-image-mirror/1.0'}});
  if(!r.ok) throw new Error(name+' fetch failed: '+r.status);
  const buf=Buffer.from(await r.arrayBuffer());
  const b64=buf.toString('base64');
  console.log('ASSET_META|'+name+'|'+buf.length+'|'+(r.headers.get('content-type')||'application/octet-stream'));
  const size=6000;
  for(let i=0;i<b64.length;i+=size) console.log('ASSET_CHUNK|'+name+'|'+String(i/size).padStart(4,'0')+'|'+b64.slice(i,i+size));
  console.log('ASSET_END|'+name);
}
