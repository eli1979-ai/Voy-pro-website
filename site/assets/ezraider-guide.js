(()=>{'use strict';
  const player=document.querySelector('[data-ez-video-player]');
  if(!player)return;
  const allowed=new Set(['1i2IQSShkQ8','fMcnMk6gzYA','NHWLOcUc8Vg']);
  const buttons=[...player.querySelectorAll('[data-ez-video]')];
  const stage=player.querySelector('[data-ez-video-screen]');
  const watch=player.querySelector('[data-ez-watch]');
  if(!stage||!watch||!buttons.length)return;
  let selected=buttons[0];

  const render=()=>{
    const id=selected.dataset.ezVideo;
    if(!allowed.has(id))return;
    const frame=document.createElement('iframe');
    frame.title=selected.dataset.ezVideoTitle||'EZRaider riding video';
    frame.src='https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1&mute=1&playsinline=1&controls=1&rel=0&loop=1&playlist='+id;
    frame.allow='autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen';
    frame.allowFullscreen=true;
    frame.loading='eager';
    frame.referrerPolicy='strict-origin-when-cross-origin';
    stage.replaceChildren(frame);
    watch.href='https://www.youtube.com/watch?v='+id;
  };
  for(const button of buttons){
    button.addEventListener('click',()=>{
      if(!allowed.has(button.dataset.ezVideo))return;
      selected=button;
      for(const other of buttons){
        const active=other===button;
        other.setAttribute('aria-pressed',String(active));
        other.classList.toggle('is-active',active);
      }
      render();
    });
  }
  // Muted inline autoplay is supported by modern browsers; browser/user
  // preferences can still block playback, leaving the native player controls.
  render();
})();
