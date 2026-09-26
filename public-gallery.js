(function(){
  'use strict';
  var cfg=window.KS_CONFIG||{}, client=null;
  var grid=document.getElementById('liveGallery'), status=document.getElementById('galleryStatus');
  if(!grid||!window.supabase||!cfg.supabaseUrl||!cfg.supabaseAnonKey)return;
  try{client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);}catch(e){return;}
  function esc(v){return String(v==null?'':v).replace(/[&<>'"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c];});}
  function render(items){
    if(!items.length){if(status)status.textContent='Selected work from Kishore Studios.';return;}
    var uploaded=items.map(function(item){
      var type=item.resource_type==='video'?'video':'image';
      var media=type==='video'?'<video src="'+esc(item.secure_url)+'" controls muted playsinline preload="metadata"></video>':'<img src="'+esc(item.secure_url)+'" alt="'+esc(item.title||'Kishore Studios photo')+'" loading="lazy">';
      return '<figure class="gallery-item uploaded-work">'+media+'<figcaption>'+esc(item.title||'Kishore Studios')+'<small>'+esc(item.category||'Gallery')+'</small></figcaption></figure>';
    }).join('');
    grid.insertAdjacentHTML('afterbegin',uploaded);
    if(status)status.textContent=items.length+' published item'+(items.length===1?'':'s')+' from Kishore Studios.';
  }
  client.from('gallery').select('id,secure_url,resource_type,title,category,created_at').order('created_at',{ascending:false}).then(function(r){
    if(r.error){if(status)status.textContent='Selected work from Kishore Studios.';return;}
    render(r.data||[]);
  });
})();
