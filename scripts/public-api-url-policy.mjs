// Static fail-closed validation only. A valid hostname does NOT prove that
// DNS, TLS, Production isolation, CORS, auth or payment capability is live.
import {isIP} from 'node:net';

export function validPublicApiUrl(value){
  try{
    if(typeof value!=='string'||!value)return false;
    const url=new URL(value);
    const host=url.hostname.replace(/^\\[|\\]$/g,'');
    // A dot alone does not establish a DNS hostname: reject empty labels,
    // underscores, leading/trailing hyphens, trailing dots and overlong names.
    // URL.hostname is canonical ASCII/punycode. This is syntax only: no DNS lookup.
    const labels=host.split('.');
    const dnsShape=host.length<=253&&labels.length>=2&&
      labels.every(label=>label.length<=63&&
        /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))&&
      /^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/.test(labels.at(-1));
    return url.protocol==='https:'&&url.href===value&&
      url.pathname==='/api/v1'&&dnsShape&&
      !isIP(host)&&
      !/(?:^|\.)(?:localhost|local|internal|invalid)$/i.test(host)&&
      !/staging|(^|[-.])stg([-.]|$)/i.test(host)&&
      !url.username&&!url.password&&!url.port&&!url.search&&!url.hash;
  }catch{return false;}
}
