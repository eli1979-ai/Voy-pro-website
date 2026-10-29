(()=>{'use strict';
  const player=document.querySelector('[data-ez-video-player]');
  if(!player)return;
  const allowed=new Set(['1i2IQSShkQ8','fMcnMk6gzYA']);
  const buttons=[...player.querySelectorAll('[data-ez-video]')];
  const stage=player.querySelector('[data-ez-video-screen]');
  const watch=player.querySelector('[data-ez-watch]');
  const play=stage?.querySelector('[data-ez-play]');
  const playLabel=play?.querySelector('[data-ez-play-label]');
  // Without a first-party Play control, never silently load a third party.
  if(!stage||!watch||!buttons.length||!play||!playLabel)return;
  let selected=buttons[0];
  let started=false;

  const updatePreview=()=>{
    const id=selected.dataset.ezVideo;
    if(!allowed.has(id))return;
    watch.href='https://www.youtube.com/watch?v='+id;
    playLabel.textContent=selected.dataset.ezVideoTitle||selected.textContent.trim();
  };
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
  };
  play.addEventListener('click',()=>{
    // Only explicit user interaction may create a YouTube iframe.
    started=true;
    render();
  });
  for(const button of buttons){
    button.addEventListener('click',()=>{
      if(!allowed.has(button.dataset.ezVideo))return;
      selected=button;
      for(const other of buttons){
        const active=other===button;
        other.setAttribute('aria-pressed',String(active));
        other.classList.toggle('is-active',active);
      }
      updatePreview();
      // Once playback has been requested, switching clips stays seamless.
      if(started)render();
    });
  }
  // Leave the accessible, first-party poster visible until Play is pressed.
  // Even selecting another clip does not contact YouTube in advance.
  updatePreview();
})();
