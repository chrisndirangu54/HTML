

function color1() {
    document.documentElement.style.setProperty('--primary_color', '#28e98c');
}
function color2() {
    document.documentElement.style.setProperty('--primary_color', '#e4af12');
}
function color3() {
    document.documentElement.style.setProperty('--primary_color', '#fe6f1d');
}
function color4() {
    document.documentElement.style.setProperty('--primary_color', '#14c5fd');
}
function color5() {
    document.documentElement.style.setProperty('--primary_color', '#c0c0c0');
}
function color6() {
    document.documentElement.style.setProperty('--primary_color', '#1338f3');
}
function color7() {
    document.documentElement.style.setProperty('--primary_color', '#f31313');
}
function color8() {
    document.documentElement.style.setProperty('--primary_color', '#ff99cc');
}

// Lazy-load the interactive homepage orb without changing the large legacy index.html bundle.
(function loadTeknTandaoOrb() {
    if (document.getElementById('tt-orb-loader')) return;
    const start = function () {
        if (!document.querySelector('#home') || document.getElementById('tt-orb-loader')) return;
        const script = document.createElement('script');
        script.id = 'tt-orb-loader';
        script.src = 'assets/js/orb-hero.js';
        script.defer = true;
        document.body.appendChild(script);
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, {once: true});
    } else {
        start();
    }
})();
