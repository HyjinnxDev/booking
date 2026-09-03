/* TechniCourt booking widget loader. Usage:
   <script src="https://bookings.technicourt.com/embed.js"
           data-path="/s/<id>" data-mode="inline|popup"
           data-label="Book now" data-accent="#17181a" async></script>
   Drops an auto-resizing <iframe> where the tag sits (inline), or a button that
   opens the same iframe in a modal (popup). No dependencies. */
(function () {
  var me = document.currentScript;
  if (!me) return;
  var origin = new URL(me.src).origin;
  var path = me.getAttribute('data-path') || '/';
  var mode = me.getAttribute('data-mode') === 'popup' ? 'popup' : 'inline';
  var label = me.getAttribute('data-label') || 'Book now';
  var accent = me.getAttribute('data-accent') || '#17181a';
  var src = origin + path + (path.indexOf('?') < 0 ? '?' : '&') + 'embed=1';

  function makeFrame() {
    var f = document.createElement('iframe');
    f.src = src;
    f.title = 'Booking';
    f.loading = 'lazy';
    f.setAttribute('data-tc-frame', '');
    f.style.cssText = 'width:100%;border:0;display:block;background:transparent';
    f.style.height = mode === 'popup' ? '100%' : '640px'; // pre-resize guess
    return f;
  }

  // The framed page posts its height as it renders / as the user navigates.
  window.addEventListener('message', function (e) {
    if (e.origin !== origin || !e.data || e.data.type !== 'technicourt:height') return;
    var frames = document.querySelectorAll('iframe[data-tc-frame]');
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow === e.source) frames[i].style.height = e.data.height + 'px';
    }
  });

  if (mode === 'popup') {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.style.cssText =
      'font:inherit;font-weight:600;line-height:1;padding:.65rem 1.15rem;border:0;border-radius:.5rem;cursor:pointer;color:#fff;background:' +
      accent;

    var dlg = document.createElement('dialog');
    dlg.style.cssText =
      'width:min(560px,92vw);height:min(88vh,860px);padding:0;border:0;border-radius:.9rem;overflow:hidden;background:#fcfbf9';

    btn.addEventListener('click', function () {
      if (!dlg.firstChild) dlg.appendChild(makeFrame());
      dlg.showModal();
    });
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg) dlg.close(); // backdrop click (Esc closes natively)
    });

    me.parentNode.insertBefore(btn, me);
    document.body.appendChild(dlg);
  } else {
    me.parentNode.insertBefore(makeFrame(), me);
  }
})();
